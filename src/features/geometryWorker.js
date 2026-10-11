import { warpPerspective } from './geometry.js';

self.onmessage = ({ data }) => {
  try {
    const pixels = warpPerspective({ width: data.width, height: data.height, data: new Uint8ClampedArray(data.pixels) }, data.points, data.size);
    self.postMessage({ pixels: pixels.buffer }, [pixels.buffer]);
  } catch (cause) { self.postMessage({ error: cause.message }); }
};
