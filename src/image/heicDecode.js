import { validateDimensions } from './imageLimits.js';

/** Validate metadata before reserving the RGBA buffer, including in the worker process. */
export async function decodeHeicPixels(library, buffer) {
  const decoder = new library.HeifDecoder();
  let images;
  try {
    images = decoder.decode(new Uint8Array(buffer));
    if (!images?.length) throw new Error('El archivo HEIC no contiene imágenes.');
    const image = images[0];
    const width = image.get_width();
    const height = image.get_height();
    validateDimensions(width, height);
    const pixels = await new Promise((resolve, reject) => {
      image.display({ data: new Uint8ClampedArray(width * height * 4), width, height }, (display) => {
        if (!(display?.data instanceof Uint8ClampedArray) || display.data.length !== width * height * 4) {
          reject(new Error('No se pudo decodificar la foto HEIC.'));
        } else resolve(display.data);
      });
    });
    return { width, height, pixels };
  } finally {
    images?.forEach((image) => image.free?.());
    decoder.free?.();
  }
}
