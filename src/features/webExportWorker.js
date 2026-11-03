import createEncoder from '@jsquash/avif/codec/enc/avif_enc.js';
import wasmUrl from '@jsquash/avif/codec/enc/avif_enc.wasm?url';
import { defaultOptions } from '@jsquash/avif/meta.js';

self.onmessage = async ({ data: { imageData, quality } }) => {
  try {
    const encoder = await createEncoder({ locateFile: () => wasmUrl });
    const output = encoder.encode(imageData.data, imageData.width, imageData.height, { ...defaultOptions, quality: Math.round(quality * 100), qualityAlpha: 100, speed: 8 });
    if (!output) throw new Error('AVIF encoding failed');
    const buffer = output.slice().buffer;
    self.postMessage({ buffer }, [buffer]);
  } catch (error) { self.postMessage({ error: error.message }); }
};
