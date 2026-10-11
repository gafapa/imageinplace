import { canvasFromUrl } from '../background.js';
import { expandBox, refineAlpha } from './models.js';
import { t } from '../../i18n/index.js';

const SALIENT_SIZE = 320;
const FACE_WIDTH = 640;
const FACE_HEIGHT = 480;

let worker = null;
let nextId = 1;
const pending = new Map();

function failAll(cause) {
  pending.forEach(({ reject }) => reject(cause));
  pending.clear();
}

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./aiWorker.js', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data: { id, result, error } }) => {
    const request = pending.get(id);
    if (!request) return;
    pending.delete(id);
    if (error) request.reject(new Error(error)); else request.resolve(result);
  };
  worker.onerror = (event) => { event.preventDefault?.(); resetWorker(new Error(t('No se pudo cargar el modelo en este navegador.'))); };
  return worker;
}

/** Stop the worker (and any model run in progress); the next request starts a fresh one. */
function resetWorker(cause) {
  worker?.terminate();
  worker = null;
  failAll(cause);
}

function request(operation, payload, transfer, signal) {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const id = nextId++;
    const abort = () => resetWorker(new DOMException(t('Operación cancelada.'), 'AbortError'));
    signal?.addEventListener('abort', abort, { once: true });
    const settle = (callback) => (value) => { signal?.removeEventListener('abort', abort); callback(value); };
    pending.set(id, { resolve: settle(resolve), reject: settle(reject) });
    getWorker().postMessage({ id, operation, payload }, transfer);
  });
}

function pixelsAt(canvas, width, height) {
  const scaled = document.createElement('canvas');
  scaled.width = width; scaled.height = height;
  const context = scaled.getContext('2d', { willReadFrequently: true });
  context.imageSmoothingQuality = 'high';
  context.drawImage(canvas, 0, 0, width, height);
  return context.getImageData(0, 0, width, height).data;
}

/**
 * Cut out the main subject with the on-device U²-Netp model. Returns a full-resolution canvas whose
 * alpha is the original alpha multiplied by the refined mask, and the share of pixels made transparent.
 */
export async function removeBackgroundWithAI(url, signal) {
  const canvas = await canvasFromUrl(url);
  signal?.throwIfAborted();
  const pixels = pixelsAt(canvas, SALIENT_SIZE, SALIENT_SIZE);
  const { alpha } = await request('background', { pixels, size: SALIENT_SIZE }, [pixels.buffer], signal);
  signal?.throwIfAborted();

  // Upscale the low-resolution mask with smooth interpolation by drawing it as an alpha-only image.
  const mask = document.createElement('canvas');
  mask.width = SALIENT_SIZE; mask.height = SALIENT_SIZE;
  const maskData = new ImageData(SALIENT_SIZE, SALIENT_SIZE);
  for (let index = 0; index < alpha.length; index += 1) maskData.data[index * 4 + 3] = alpha[index];
  mask.getContext('2d').putImageData(maskData, 0, 0);
  const fullMask = document.createElement('canvas');
  fullMask.width = canvas.width; fullMask.height = canvas.height;
  const fullMaskContext = fullMask.getContext('2d', { willReadFrequently: true });
  fullMaskContext.imageSmoothingQuality = 'high';
  fullMaskContext.drawImage(mask, 0, 0, canvas.width, canvas.height);
  const maskPixels = fullMaskContext.getImageData(0, 0, canvas.width, canvas.height).data;

  const context = canvas.getContext('2d', { willReadFrequently: true });
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  let removed = 0;
  for (let offset = 3; offset < image.data.length; offset += 4) {
    const next = Math.round(image.data[offset] * refineAlpha(maskPixels[offset]) / 255);
    if (next < 16 && image.data[offset] >= 16) removed += 1;
    image.data[offset] = next;
  }
  context.putImageData(image, 0, 0);
  return { canvas, removedShare: removed / (canvas.width * canvas.height) };
}

/** Faces in a rendered canvas as normalised, slightly enlarged boxes ready to become privacy zones. */
export async function detectFaces(canvas, { signal, threshold = 0.6 } = {}) {
  const pixels = pixelsAt(canvas, FACE_WIDTH, FACE_HEIGHT);
  const { faces } = await request('faces', { pixels, width: FACE_WIDTH, height: FACE_HEIGHT, threshold }, [pixels.buffer], signal);
  return faces.map((face) => expandBox(face, 0.18));
}
