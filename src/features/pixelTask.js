import { canvasFromUrl, canvasToBlob, cropCanvas, flattenForFormat } from './background';
import { validateDimensions } from './imageLimits';

export function runPixelWorker(imageData, operation, options, signal) {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const worker = new Worker(new URL('./pixelWorker.js', import.meta.url), { type: 'module' });
    const finish = (cause, result) => {
      signal?.removeEventListener('abort', abort);
      worker.terminate();
      if (cause) reject(cause); else resolve(result);
    };
    const abort = () => finish(new DOMException('Operación cancelada.', 'AbortError'));
    signal?.addEventListener('abort', abort, { once: true });
    worker.onerror = () => finish(new Error('No se pudo procesar la imagen.'));
    worker.onmessage = ({ data }) => data.error ? finish(new Error(data.error)) : finish(null, data);
    try {
      worker.postMessage({ data: imageData.data.buffer, width: imageData.width, height: imageData.height, operation, options }, [imageData.data.buffer]);
    } catch (cause) { finish(cause); }
  });
}

export async function processPixels(url, operation, options, format = 'image/png', quality, signal) {
  signal?.throwIfAborted();
  const canvas = await canvasFromUrl(url);
  signal?.throwIfAborted();
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const result = await runPixelWorker(context.getImageData(0, 0, canvas.width, canvas.height), operation, options, signal);
  signal?.throwIfAborted();
  context.putImageData(new ImageData(new Uint8ClampedArray(result.data), canvas.width, canvas.height), 0, 0);
  let output = canvas;
  let status;
  if (operation === 'trim') {
    status = !result.bounds ? 'empty' : result.bounds.width === canvas.width && result.bounds.height === canvas.height && !options.padding ? 'unchanged' : 'trimmed';
    if (status === 'trimmed') {
      validateDimensions(result.bounds.width + options.padding * 2, result.bounds.height + options.padding * 2);
      output = cropCanvas(canvas, result.bounds, options.padding, result.background);
    }
  } else if (result.bounds) output = cropCanvas(canvas, result.bounds);
  const blob = await canvasToBlob(flattenForFormat(output, format), format, quality);
  signal?.throwIfAborted();
  return { blob, status, removedShare: result.removedShare, before: [canvas.width, canvas.height], after: [output.width, output.height] };
}
