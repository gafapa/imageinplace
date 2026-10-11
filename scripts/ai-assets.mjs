import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

/**
 * Third-party runtimes for the on-device AI and HEIC tools, served from /ai/vendor/ exactly as
 * published by their packages. They are loaded only when a tool needs them; the service worker
 * caches them on first use instead of during installation (see offline-build.mjs).
 */
const OCR_LANGUAGES = ['spa', 'eng', 'cat', 'glg', 'eus'];

export const AI_VENDOR_FILES = {
  'ai/vendor/tesseract/worker.min.js': 'node_modules/tesseract.js/dist/worker.min.js',
  // The worker picks the fastest LSTM build the browser supports.
  'ai/vendor/tesseract/core/tesseract-core-relaxedsimd-lstm.wasm.js': 'node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js',
  'ai/vendor/tesseract/core/tesseract-core-simd-lstm.wasm.js': 'node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js',
  'ai/vendor/tesseract/core/tesseract-core-lstm.wasm.js': 'node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js',
  ...Object.fromEntries(OCR_LANGUAGES.map((language) => [
    `ai/vendor/tesseract/lang/${language}.traineddata.gz`,
    `node_modules/@tesseract.js-data/${language}/4.0.0_best_int/${language}.traineddata.gz`,
  ])),
  'ai/vendor/heif/libheif-bundle.js': 'node_modules/libheif-js/libheif-wasm/libheif-bundle.mjs',
};

const CONTENT_TYPES = { '.wasm': 'application/wasm', '.js': 'text/javascript', '.mjs': 'text/javascript', '.gz': 'application/octet-stream' };

export function aiAssets() {
  let root;
  return {
    name: 'ai-vendor-assets',
    configResolved(config) { root = config.root; },
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const path = decodeURIComponent((request.url || '').split('?')[0]).replace(/^\//, '');
        const source = AI_VENDOR_FILES[path];
        if (!source) { next(); return; }
        const file = resolve(root, source);
        const { size } = await stat(file);
        const extension = Object.keys(CONTENT_TYPES).find((suffix) => path.endsWith(suffix));
        response.setHeader('Content-Type', CONTENT_TYPES[extension] || 'application/octet-stream');
        response.setHeader('Content-Length', size);
        createReadStream(file).pipe(response);
      });
    },
    async generateBundle() {
      for (const [fileName, source] of Object.entries(AI_VENDOR_FILES)) {
        this.emitFile({ type: 'asset', fileName, source: await readFile(resolve(root, source)) });
      }
    },
  };
}
