// Decodes HEIC/HEIF photos with libheif (WebAssembly) for browsers without native support.
import { decodeHeicPixels } from './heicDecode.js';
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
    const { width, height, pixels } = await decodeHeicPixels(libheif, buffer);
    self.postMessage({ width, height, pixels }, [pixels.buffer]);
  } catch (cause) {
    self.postMessage({ error: cause?.message || 'No se pudo decodificar la foto HEIC.' });
  }
};
