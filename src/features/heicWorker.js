// Decodes HEIC/HEIF photos with libheif (WebAssembly) for browsers without native support.
let modulePromise = null;

function loadLibheif() {
  modulePromise ||= import(/* @vite-ignore */ '/ai/vendor/heif/libheif-bundle.js').then(({ default: factory }) => new Promise((resolve, reject) => {
    try {
      // The embedded WebAssembly may initialise synchronously, calling the hook before `factory` returns.
      let library = null;
      let initialised = false;
      library = factory({ onRuntimeInitialized: () => { initialised = true; if (library) resolve(library); } });
      if (initialised) resolve(library);
    } catch (cause) { reject(cause); }
  })).catch((cause) => { modulePromise = null; throw cause; });
  return modulePromise;
}

self.onmessage = async ({ data: { buffer } }) => {
  try {
    const libheif = await loadLibheif();
    const decoder = new libheif.HeifDecoder();
    const images = decoder.decode(new Uint8Array(buffer));
    if (!images?.length) throw new Error('El archivo HEIC no contiene imágenes.');
    // The first image is the primary photo; others are thumbnails or burst frames.
    const image = images[0];
    const width = image.get_width();
    const height = image.get_height();
    const pixels = await new Promise((resolve, reject) => {
      image.display({ data: new Uint8ClampedArray(width * height * 4), width, height }, (display) => (display ? resolve(display.data) : reject(new Error('No se pudo decodificar la foto HEIC.'))));
    });
    images.forEach((entry) => entry.free?.());
    decoder.free?.();
    self.postMessage({ width, height, pixels }, [pixels.buffer]);
  } catch (cause) {
    self.postMessage({ error: cause?.message || 'No se pudo decodificar la foto HEIC.' });
  }
};
