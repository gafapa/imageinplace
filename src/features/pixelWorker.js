import { removeBackground, findContentBounds } from './background';
import { restorePixels } from './restoration.js';

self.onmessage = (event) => {
  try {
    const { data, width, height, operation, options } = event.data;
    const imageData = { data: new Uint8ClampedArray(data), width, height };
    let result;
    if (operation === 'background') {
      result = removeBackground(imageData, options);
      if (options.trim && result.removedShare > 0) result.bounds = findContentBounds(imageData).bounds;
    } else if (operation === 'restore') { restorePixels(imageData, options); result = {}; }
    else result = findContentBounds(imageData, options);
    self.postMessage({ data: imageData.data.buffer, ...result }, [imageData.data.buffer]);
  } catch (cause) { self.postMessage({ error: cause.message }); }
};
