import * as ort from 'onnxruntime-web/wasm';
import { decodeFaces, salientInput } from './models.js';

// Single-threaded WebAssembly (bundled by Vite next to this worker): works without cross-origin
// isolation and keeps memory predictable.
ort.env.wasm.numThreads = 1;
ort.env.wasm.proxy = false;

const sessions = new Map();
function session(name) {
  if (!sessions.has(name)) {
    sessions.set(name, ort.InferenceSession.create(`/ai/models/${name}.onnx`, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' })
      .catch((cause) => { sessions.delete(name); throw cause; }));
  }
  return sessions.get(name);
}

async function run(name, data, dims) {
  const model = await session(name);
  const outputs = await model.run({ [model.inputNames[0]]: new ort.Tensor('float32', data, dims) });
  return model.outputNames.map((output) => outputs[output]);
}

const operations = {
  /** U²-Netp salient-object mask for a 320×320 RGBA input, returned as 0–255 alpha values. */
  async background({ pixels, size }) {
    const [mask] = await run('u2netp', salientInput(pixels, size), [1, 3, size, size]);
    const values = mask.data.subarray(0, size * size);
    let min = Infinity; let max = -Infinity;
    for (const value of values) { if (value < min) min = value; if (value > max) max = value; }
    const alpha = new Uint8ClampedArray(size * size);
    const range = max - min || 1;
    for (let index = 0; index < alpha.length; index += 1) alpha[index] = ((values[index] - min) / range) * 255;
    return { alpha };
  },
  /** UltraFace boxes (normalised corners) for a 640×480 RGBA input. */
  async faces({ pixels, width, height, threshold }) {
    const input = new Float32Array(3 * width * height);
    const plane = width * height;
    for (let index = 0; index < plane; index += 1) {
      input[index] = (pixels[index * 4] - 127) / 128;
      input[plane + index] = (pixels[index * 4 + 1] - 127) / 128;
      input[2 * plane + index] = (pixels[index * 4 + 2] - 127) / 128;
    }
    const [scores, boxes] = await run('ultraface-rfb-640', input, [1, 3, height, width]);
    return { faces: decodeFaces(scores.data, boxes.data, threshold) };
  },
};

self.onmessage = async ({ data: { id, operation, payload } }) => {
  try {
    const result = await operations[operation](payload);
    self.postMessage({ id, result }, result.alpha ? [result.alpha.buffer] : []);
  } catch (cause) {
    self.postMessage({ id, error: cause?.message || String(cause) });
  }
};
