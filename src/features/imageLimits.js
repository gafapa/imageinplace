export const MAX_FILE_BYTES = 40 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 40_000_000;
export const MAX_IMAGE_SIDE = 10000;
export const MAX_WORKSPACE_PIXELS = 120_000_000;
export const MAX_WORKSPACE_BYTES = 250 * 1024 * 1024;
export const MAX_WORKSPACE_ITEMS = 100;

export function validateDimensions(width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1
    || width > MAX_IMAGE_SIDE || height > MAX_IMAGE_SIDE || width * height > MAX_IMAGE_PIXELS) {
    throw new Error('La imagen supera el límite de 40 megapíxeles o 10 000 píxeles por lado.');
  }
}

export function validateWorkspace(items) {
  if (items.length > MAX_WORKSPACE_ITEMS
    || items.reduce((sum, item) => sum + Math.max((item.width || 0) * (item.height || 0), (item.originalWidth || 0) * (item.originalHeight || 0)), 0) > MAX_WORKSPACE_PIXELS
    || items.reduce((sum, item) => sum + (item.url && item.originalUrl && item.url !== item.originalUrl ? (item.size || 0) + (item.originalSize || 0) : Math.max(item.size || 0, item.originalSize || 0)), 0) > MAX_WORKSPACE_BYTES) {
    throw new Error('El espacio admite hasta 100 imágenes, 120 megapíxeles y 250 MB en total.');
  }
}

export async function inspectImage(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const image = await new Promise((resolve, reject) => {
      const source = new Image();
      source.onload = () => resolve(source);
      source.onerror = () => reject(new Error('El archivo no contiene una imagen compatible o está dañado.'));
      source.src = url;
    });
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    validateDimensions(width, height);
    const scale = Math.min(1, 480 / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    const thumbnail = await new Promise((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('No se pudo crear la miniatura.')), 'image/png'));
    return { width, height, thumbnail };
  } finally { URL.revokeObjectURL(url); }
}

export function releaseItems(items) {
  const urls = new Set(items.flatMap((item) => [item.url, item.originalUrl, item.thumbnailUrl, item.originalThumbnailUrl]));
  urls.forEach((url) => { if (url) URL.revokeObjectURL(url); });
}
