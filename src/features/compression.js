import { t } from '../i18n/index.js';
const MAX_CANVAS_SIDE = 10000;
const MAX_CANVAS_PIXELS = 40_000_000;

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('El navegador no pudo codificar la imagen.'))), type, quality);
  });
}

function loadSource(source) {
  if (typeof HTMLCanvasElement !== 'undefined' && source instanceof HTMLCanvasElement) return Promise.resolve(source);
  if (typeof OffscreenCanvas !== 'undefined' && source instanceof OffscreenCanvas) return Promise.resolve(source);
  if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) return Promise.resolve(source);
  if (typeof Image !== 'undefined' && source instanceof Image) return Promise.resolve(source);

  const url = typeof source === 'string' ? source : URL.createObjectURL(source);
  const ownsUrl = typeof source !== 'string';
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => { if (ownsUrl) URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { if (ownsUrl) URL.revokeObjectURL(url); reject(new Error(t('No se pudo leer la imagen.'))); };
    image.src = url;
  });
}

function dimensionsOf(source) {
  return {
    width: source.width || source.naturalWidth,
    height: source.height || source.naturalHeight,
  };
}

/** Encode an image locally, finding the highest quality that meets targetBytes. */
export async function compressToTarget(sourceOrCanvas, options = {}) {
  if (typeof document === 'undefined') throw new Error(t('La compresión necesita un navegador.'));
  const signal = options.signal;
  signal?.throwIfAborted();
  const targetBytes = Number(options.targetBytes);
  if (!Number.isFinite(targetBytes) || targetBytes <= 0) throw new Error(t('El tamaño objetivo no es válido.'));
  const format = options.format === 'image/webp' ? 'image/webp' : 'image/jpeg';
  const minQuality = clamp(Number(options.minQuality ?? 0.35), 0.05, 0.99);
  const maxQuality = clamp(Number(options.maxQuality ?? 0.9), minQuality, 1);
  const allowResize = options.allowResize !== false;
  const minDimension = Math.max(1, Math.floor(Number(options.minDimension ?? 320)));
  const source = await loadSource(sourceOrCanvas);
  const original = dimensionsOf(source);
  if (!original.width || !original.height) throw new Error(t('No se pudieron leer las dimensiones.'));
  if (original.width > MAX_CANVAS_SIDE || original.height > MAX_CANVAS_SIDE || original.width * original.height > MAX_CANVAS_PIXELS) {
    if (!allowResize) throw new Error(t('La imagen supera el límite de memoria del navegador.'));
  }

  const canvas = document.createElement('canvas');
  let scale = Math.min(1, MAX_CANVAS_SIDE / original.width, MAX_CANVAS_SIDE / original.height, Math.sqrt(MAX_CANVAS_PIXELS / (original.width * original.height)));
  let best = null;
  const maxPasses = allowResize ? 32 : 1;

  for (let pass = 0; pass < maxPasses; pass += 1) {
    signal?.throwIfAborted();
    const width = Math.max(1, Math.round(original.width * scale));
    const height = Math.max(1, Math.round(original.height * scale));
    if (Math.min(width, height) < minDimension && scale < 1) break;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha: format !== 'image/jpeg' });
    if (!context) throw new Error(t('El navegador no ofrece un lienzo 2D.'));
    context.clearRect(0, 0, width, height);
    if (format === 'image/jpeg') { context.fillStyle = '#ffffff'; context.fillRect(0, 0, width, height); }
    context.drawImage(source, 0, 0, width, height);

    let low = minQuality;
    let high = maxQuality;
    let fitting = null;
    for (let attempt = 0; attempt < 9; attempt += 1) {
      signal?.throwIfAborted();
      const quality = (low + high) / 2;
      const blob = await canvasToBlob(canvas, format, quality);
      if (blob.size <= targetBytes) { fitting = { blob, quality }; low = quality; }
      else high = quality;
    }
    const minimumBlob = await canvasToBlob(canvas, format, minQuality);
    if (!fitting && minimumBlob.size <= targetBytes) fitting = { blob: minimumBlob, quality: minQuality };
    if (fitting) {
      best = { blob: fitting.blob, metTarget: fitting.blob.size <= targetBytes, width, height, quality: fitting.quality };
      break;
    }
    if (!allowResize || Math.min(width, height) <= minDimension) {
      best = { blob: minimumBlob, metTarget: minimumBlob.size <= targetBytes, width, height, quality: minQuality };
      break;
    }
    scale = Math.max(minDimension / Math.min(original.width, original.height), scale * 0.82);
  }
  if (!best) throw new Error(t('No se pudo generar un resultado dentro de los límites.'));
  signal?.throwIfAborted();
  return best;
}

export { MAX_CANVAS_PIXELS, MAX_CANVAS_SIDE };
