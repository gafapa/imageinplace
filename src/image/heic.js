import { validateDimensions } from './imageLimits.js';
import { t } from '../i18n/index.js';

const HEIC_TYPES = new Set(['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence']);
export const isHeicType = (type) => HEIC_TYPES.has(type);

function decodeNatively(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('native decode failed')); };
    image.src = url;
  });
}

function decodeWithLibheif(file) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./heicWorker.js', import.meta.url), { type: 'module' });
    const finish = (callback, value) => { worker.terminate(); callback(value); };
    worker.onmessage = ({ data }) => {
      if (data.error) { finish(reject, new Error(data.error)); return; }
      try {
        validateDimensions(data.width, data.height);
        const canvas = document.createElement('canvas');
        canvas.width = data.width; canvas.height = data.height;
        canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(data.pixels), data.width, data.height), 0, 0);
        finish(resolve, canvas);
      } catch (cause) { finish(reject, cause); }
    };
    worker.onerror = (event) => { event.preventDefault?.(); finish(reject, new Error(t('No se pudo cargar el lector de fotos HEIC.'))); };
    file.arrayBuffer().then((buffer) => worker.postMessage({ buffer }, [buffer])).catch((cause) => finish(reject, cause));
  });
}

/**
 * Convert an iPhone HEIC/HEIF photo into a JPEG File so every browser (and saved projects) can use it.
 * Uses the browser's own decoder when it has one (Safari), otherwise libheif in a worker.
 */
export async function convertHeicToJpeg(file) {
  let source;
  let image;
  try {
    image = await decodeNatively(file);
  } catch {
    source = await decodeWithLibheif(file);
  }
  // A successfully decoded but oversized image must not trigger a second decoder.
  if (image) {
    validateDimensions(image.naturalWidth, image.naturalHeight);
    source = document.createElement('canvas');
    source.width = image.naturalWidth; source.height = image.naturalHeight;
    source.getContext('2d').drawImage(image, 0, 0);
  }
  const blob = await new Promise((resolve, reject) => source.toBlob((value) => (value ? resolve(value) : reject(new Error('No se pudo convertir la foto HEIC.'))), 'image/jpeg', 0.92));
  const name = `${file.name.replace(/\.[^.]+$/, '') || 'foto'}.jpg`;
  return new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified });
}
