import { geometrySize, renderGeometryCanvas } from './geometry.js';
import { loadImage, saveFormatFor, SAVE_QUALITY } from './imageEngine.js';
import { canvasToBlob, flattenForFormat } from './background.js';
import { t } from '../i18n/index.js';

function warpInWorker(imageData, points, size, signal) {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const worker = new Worker(new URL('./geometryWorker.js', import.meta.url), { type: 'module' });
    const finish = (cause, pixels) => { signal?.removeEventListener('abort', abort); worker.terminate(); if (cause) reject(cause); else resolve(pixels); };
    const abort = () => finish(new DOMException(t('Operación cancelada.'), 'AbortError'));
    signal?.addEventListener('abort', abort, { once: true });
    worker.onerror = () => finish(new Error(t('No se pudo corregir la perspectiva.')));
    worker.onmessage = ({ data }) => data.error ? finish(new Error(data.error)) : finish(null, data.pixels);
    try { worker.postMessage({ pixels: imageData.data.buffer, width: imageData.width, height: imageData.height, points, size }, [imageData.data.buffer]); }
    catch (cause) { finish(cause); }
  });
}

export async function applyGeometry(item, tool, options, signal) {
  signal?.throwIfAborted();
  const source = await loadImage(item.url);
  signal?.throwIfAborted();
  let canvas;
  if (tool === 'perspective') {
    const size = geometrySize(source.naturalWidth, source.naturalHeight, tool, options);
    const input = document.createElement('canvas'); input.width = source.naturalWidth; input.height = source.naturalHeight;
    const context = input.getContext('2d', { willReadFrequently: true }); context.drawImage(source, 0, 0);
    const pixels = await warpInWorker(context.getImageData(0, 0, input.width, input.height), options.points, size, signal);
    canvas = document.createElement('canvas'); canvas.width = size.width; canvas.height = size.height;
    canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(pixels), size.width, size.height), 0, 0);
  } else canvas = renderGeometryCanvas(source, tool, options);
  signal?.throwIfAborted();
  const format = tool === 'deskew' && options.background === 'transparent' ? 'image/png' : saveFormatFor(item.type);
  const blob = await canvasToBlob(flattenForFormat(canvas, format), format, SAVE_QUALITY);
  signal?.throwIfAborted();
  return blob;
}
