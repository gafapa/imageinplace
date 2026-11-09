import { flattenForFormat } from './background.js';

export const OUTPUT_FORMATS = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * The one place that turns a canvas into a file. JPEG gets a white background instead of black
 * transparency. With `strict`, a browser that silently falls back to PNG (Safari and WebP) is an error.
 */
export async function encodeCanvas(canvas, type = 'image/png', quality, { signal, strict = false } = {}) {
  signal?.throwIfAborted();
  const blob = await new Promise((resolve, reject) => flattenForFormat(canvas, type).toBlob((value) => (value ? resolve(value) : reject(new Error('Encoding failed'))), type, quality));
  signal?.throwIfAborted();
  if (strict && blob.type !== type) throw new Error('This browser cannot encode the selected format');
  return blob;
}
