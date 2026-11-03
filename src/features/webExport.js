import { flattenForFormat } from './background.js';
import { validateDimensions } from './imageLimits.js';

export const EXPORT_FORMATS = ['image/avif', 'image/webp', 'image/jpeg', 'image/png'];

export function hasTransparency({ data }) {
  for (let index = 3; index < data.length; index += 4) if (data[index] !== 255) return true;
  return false;
}

function encodeAvif(imageData, quality, signal) {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const worker = new Worker(new URL('./webExportWorker.js', import.meta.url), { type: 'module' });
    let settled = false;
    const finish = (error, blob) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer); signal?.removeEventListener('abort', abort); worker.terminate();
      if (error) reject(error); else resolve(blob);
    };
    const abort = () => finish(new DOMException('Cancelled', 'AbortError'));
    const timer = setTimeout(() => finish(new Error('AVIF encoding timed out')), 180000);
    signal?.addEventListener('abort', abort, { once: true });
    worker.onerror = () => finish(new Error('AVIF encoding failed'));
    worker.onmessageerror = () => finish(new Error('Invalid AVIF worker response'));
    worker.onmessage = ({ data }) => data.error ? finish(new Error(data.error)) : finish(null, new Blob([data.buffer], { type: 'image/avif' }));
    try { worker.postMessage({ imageData, quality }, [imageData.data.buffer]); }
    catch (cause) { finish(cause); }
  });
}

/** Compare actual encoded bytes at the selected quality, excluding JPEG when alpha is needed. */
export async function encodeWebImage(canvas, format, quality = 0.84, signal, onCandidate) {
  validateDimensions(canvas.width, canvas.height);
  if (!Number.isFinite(quality) || quality < 0 || quality > 1) throw new Error('Invalid quality');
  signal?.throwIfAborted();
  const automatic = format === 'auto';
  const pixels = automatic || format === 'image/avif' ? canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height) : null;
  const transparent = automatic && hasTransparency(pixels);
  const formats = automatic ? EXPORT_FORMATS.filter((type) => type !== 'image/jpeg' || !transparent) : [format];
  let smallest = null;
  for (const type of formats) {
    signal?.throwIfAborted();
    if (!EXPORT_FORMATS.includes(type)) throw new Error('Unsupported output format');
    let blob;
    if (type === 'image/avif') {
      // Transfer a copy: alpha detection and following candidates retain their source pixels.
      blob = await encodeAvif({ width: pixels.width, height: pixels.height, data: pixels.data.slice() }, quality, signal);
    } else {
      blob = await new Promise((resolve, reject) => flattenForFormat(canvas, type).toBlob((value) => value ? resolve(value) : reject(new Error('Encoding failed')), type, quality));
    }
    signal?.throwIfAborted();
    if (blob.type !== type) {
      if (automatic) continue;
      throw new Error('This browser cannot encode the selected format');
    }
    if (!smallest || blob.size < smallest.size) smallest = blob;
    onCandidate?.({ type, size: blob.size });
  }
  if (!smallest) throw new Error('No supported output format');
  return smallest;
}
