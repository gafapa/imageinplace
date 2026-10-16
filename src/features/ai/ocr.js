import { looksSensitive } from './models.js';
import { t } from '../../i18n/index.js';

const BASE = '/ai/vendor/tesseract';
export const OCR_LANGUAGES = { es: 'spa', en: 'eng', ca: 'cat', gl: 'glg', eu: 'eus' };

let workerPromise = null;
let workerLanguages = '';
let workerGeneration = 0;
let activeRequest = null;

/** Spanish and English always, plus the interface language when it is another supported one. */
export function ocrLanguagesFor(locale = 'es') {
  const extra = OCR_LANGUAGES[locale];
  return [...new Set(['spa', 'eng', extra].filter(Boolean))].join('+');
}

function getWorker(languages) {
  if (workerPromise && workerLanguages === languages) return workerPromise;
  const previous = workerPromise;
  previous?.then((worker) => worker.terminate()).catch(() => {});
  const generation = ++workerGeneration;
  workerLanguages = languages;
  const promise = import('tesseract.js').then(({ createWorker }) => createWorker(languages, 1, {
    workerPath: `${BASE}/worker.min.js`,
    corePath: `${BASE}/core`,
    langPath: `${BASE}/lang`,
    workerBlobURL: false,
    // The service worker already caches the language files; do not keep a second copy in IndexedDB.
    cacheMethod: 'none',
    gzip: true,
    logger: (message) => {
      if (generation === workerGeneration && !activeRequest?.controller.signal.aborted) activeRequest?.onProgress?.(message);
    },
  })).catch((cause) => {
    // A cancelled initialization must not discard the replacement worker.
    if (workerPromise === promise) workerPromise = null;
    throw cause;
  });
  workerPromise = promise;
  return promise;
}

export async function stopOcr() {
  const request = activeRequest;
  activeRequest = null;
  const current = workerPromise;
  workerPromise = null;
  workerGeneration += 1;
  request?.controller.abort();
  (await current?.catch(() => null))?.terminate();
}

/**
 * Recognise text lines in a canvas. Returns `{ text, box, sensitive }` per line, with boxes
 * normalised to the canvas size and slightly padded so a solid fill covers the glyphs.
 */
export async function recognizeLines(canvas, { locale = 'es', signal, onProgress } = {}) {
  signal?.throwIfAborted();
  activeRequest?.controller.abort();
  const request = { controller: new AbortController(), onProgress };
  activeRequest = request;
  const abort = () => request.controller.abort();
  let cancel;
  const cancelled = new Promise((_, reject) => {
    cancel = () => {
      if (activeRequest === request) void stopOcr().catch(() => {});
      reject(new DOMException(t('Operación cancelada.'), 'AbortError'));
    };
    request.controller.signal.addEventListener('abort', cancel, { once: true });
  });
  signal?.addEventListener('abort', abort, { once: true });
  try {
    const worker = await Promise.race([getWorker(ocrLanguagesFor(locale)), cancelled]);
    request.controller.signal.throwIfAborted();
    const { data } = await Promise.race([worker.recognize(canvas, {}, { blocks: true, text: false }), cancelled]);
    request.controller.signal.throwIfAborted();
    const lines = [];
    for (const block of data.blocks || []) {
      for (const paragraph of block.paragraphs || []) {
        for (const line of paragraph.lines || []) {
          const text = (line.text || '').trim();
          if (!text || line.confidence < 30) continue;
          const { x0, y0, x1, y1 } = line.bbox;
          const padX = (y1 - y0) * 0.25; const padY = (y1 - y0) * 0.2;
          const left = Math.max(0, x0 - padX) / canvas.width; const top = Math.max(0, y0 - padY) / canvas.height;
          const right = Math.min(canvas.width, x1 + padX) / canvas.width; const bottom = Math.min(canvas.height, y1 + padY) / canvas.height;
          lines.push({ text, box: { x: left, y: top, width: right - left, height: bottom - top }, sensitive: looksSensitive(text) });
        }
      }
    }
    return lines;
  } catch (cause) {
    if (request.controller.signal.aborted) throw new DOMException(t('Operación cancelada.'), 'AbortError');
    throw cause;
  } finally {
    signal?.removeEventListener('abort', abort);
    request.controller.signal.removeEventListener('abort', cancel);
    if (activeRequest === request) activeRequest = null;
  }
}
