import { looksSensitive } from './models.js';
import { t } from '../../i18n/index.js';

const BASE = '/ai/vendor/tesseract';
export const OCR_LANGUAGES = { es: 'spa', en: 'eng', ca: 'cat', gl: 'glg', eu: 'eus' };

let workerPromise = null;
let workerLanguages = '';

/** Spanish and English always, plus the interface language when it is another supported one. */
export function ocrLanguagesFor(locale = 'es') {
  const extra = OCR_LANGUAGES[locale];
  return [...new Set(['spa', 'eng', extra].filter(Boolean))].join('+');
}

async function getWorker(languages, onProgress) {
  if (workerPromise && workerLanguages === languages) return workerPromise;
  if (workerPromise) (await workerPromise.catch(() => null))?.terminate();
  workerLanguages = languages;
  workerPromise = import('tesseract.js').then(({ createWorker }) => createWorker(languages, 1, {
    workerPath: `${BASE}/worker.min.js`,
    corePath: `${BASE}/core`,
    langPath: `${BASE}/lang`,
    workerBlobURL: false,
    // The service worker already caches the language files; do not keep a second copy in IndexedDB.
    cacheMethod: 'none',
    gzip: true,
    logger: (message) => onProgress?.(message),
  })).catch((cause) => { workerPromise = null; throw cause; });
  return workerPromise;
}

export async function stopOcr() {
  const current = workerPromise;
  workerPromise = null;
  (await current?.catch(() => null))?.terminate();
}

/**
 * Recognise text lines in a canvas. Returns `{ text, box, sensitive }` per line, with boxes
 * normalised to the canvas size and slightly padded so a solid fill covers the glyphs.
 */
export async function recognizeLines(canvas, { locale = 'es', signal, onProgress } = {}) {
  signal?.throwIfAborted();
  const abort = () => stopOcr();
  signal?.addEventListener('abort', abort, { once: true });
  try {
    const worker = await getWorker(ocrLanguagesFor(locale), onProgress);
    signal?.throwIfAborted();
    const { data } = await worker.recognize(canvas, {}, { blocks: true, text: false });
    signal?.throwIfAborted();
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
    if (signal?.aborted) throw new DOMException(t('Operación cancelada.'), 'AbortError');
    throw cause;
  } finally { signal?.removeEventListener('abort', abort); }
}
