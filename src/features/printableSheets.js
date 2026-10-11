import { checkCancelled } from './batchTask.js';
import { t } from '../i18n/index.js';
export const A4_POINTS = { portrait: { width: 595.2756, height: 841.8898 }, landscape: { width: 841.8898, height: 595.2756 } };
export const mmToPoints = (value) => Number(value) * 72 / 25.4;

export function printableLayout({ orientation = 'portrait', rows = 3, columns = 2, margin = 12, gap = 4, title = '' } = {}) {
  const page = A4_POINTS[orientation] || A4_POINTS.portrait;
  const safeRows = Math.max(1, Math.min(12, Math.floor(Number(rows) || 1)));
  const safeColumns = Math.max(1, Math.min(12, Math.floor(Number(columns) || 1)));
  const marginPt = Math.max(0, mmToPoints(Math.min(40, Number(margin) || 0)));
  const gapPt = Math.max(0, mmToPoints(Math.min(20, Number(gap) || 0)));
  const titleHeight = title ? 18 : 0;
  const cellWidth = (page.width - marginPt * 2 - gapPt * (safeColumns - 1)) / safeColumns;
  const cellHeight = (page.height - marginPt * 2 - titleHeight - gapPt * (safeRows - 1)) / safeRows;
  if (cellWidth < 18 || cellHeight < 18) throw new Error(t('La cuadrícula no deja espacio suficiente para las imágenes.'));
  return { ...page, rows: safeRows, columns: safeColumns, marginPt, gapPt, titleHeight, cellWidth, cellHeight, perPage: safeRows * safeColumns };
}

const RASTER_SCALE = 3; // pixels per PDF point (~216 dpi)
const CAPTION_SPACE = 42;

const loadImage = (url) => new Promise((resolve, reject) => {
  const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error(t('No se pudo leer una imagen.'))); image.src = url;
});
const canvasBytes = (canvas, type, quality) => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => (blob ? blob.arrayBuffer().then(resolve, reject) : reject(new Error('No se pudo preparar la página.'))), type, quality);
});

async function rasterize(item, cellWidth, cellHeight, caption) {
  const image = await loadImage(item.url);
  const width = Math.max(1, Math.round(cellWidth * RASTER_SCALE));
  const height = Math.max(1, Math.round(cellHeight * RASTER_SCALE));
  const captionSpace = caption ? CAPTION_SPACE : 0;
  const scale = Math.min(width / image.naturalWidth, (height - captionSpace) / image.naturalHeight, 1);
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d'); context.fillStyle = '#ffffff'; context.fillRect(0, 0, width, height);
  const drawWidth = image.naturalWidth * scale; const drawHeight = image.naturalHeight * scale;
  context.drawImage(image, (width - drawWidth) / 2, (height - captionSpace - drawHeight) / 2, drawWidth, drawHeight);
  if (caption) { context.fillStyle = '#111827'; context.font = '700 28px Arial, sans-serif'; context.textAlign = 'center'; context.textBaseline = 'bottom'; context.fillText(caption, width / 2, height - 10, width - 24); }
  // JPEG keeps photo sheets several times smaller than PNG; the cell background is opaque anyway.
  return canvasBytes(canvas, 'image/jpeg', 0.9);
}

/** Rasterize the title at the exact aspect ratio of its box so it is never stretched. */
async function rasterizeTitle(title, boxWidth, boxHeight) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(boxWidth * RASTER_SCALE)); canvas.height = Math.max(1, Math.round(boxHeight * RASTER_SCALE));
  const context = canvas.getContext('2d'); context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#111827'; context.font = `700 ${Math.round(canvas.height * 0.8)}px Arial, sans-serif`; context.textBaseline = 'middle';
  context.fillText(title, 0, canvas.height / 2, canvas.width);
  return canvasBytes(canvas, 'image/png');
}

/** Build an A4 PDF from current gallery URLs. All image content is rasterized locally. */
export async function generatePrintableSheets(items, options = {}) {
  if (typeof document === 'undefined') throw new Error(t('La impresión necesita un navegador.'));
  if (!Array.isArray(items) || !items.length) throw new Error(t('No hay imágenes seleccionadas.'));
  if (items.length > 500) throw new Error(t('El límite es de 500 imágenes por documento.'));
  const layout = printableLayout(options); const pages = Math.ceil(items.length / layout.perPage);
  if (pages > 100) throw new Error(t('El documento supera el límite de 100 páginas.'));
  const { PDFDocument } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  const title = options.title ? String(options.title).slice(0, 120) : '';
  const titleBox = { width: layout.width - layout.marginPt * 2, height: layout.titleHeight - 3 };
  const titleImage = title ? await pdf.embedPng(await rasterizeTitle(title, titleBox.width, titleBox.height)) : null;
  let completed = 0;
  for (let pageIndex = 0; pageIndex < pages; pageIndex += 1) {
    const page = pdf.addPage([layout.width, layout.height]);
    if (titleImage) page.drawImage(titleImage, { x: layout.marginPt, y: layout.height - layout.marginPt - layout.titleHeight + 2, ...titleBox });
    const pageItems = items.slice(pageIndex * layout.perPage, (pageIndex + 1) * layout.perPage);
    for (let index = 0; index < pageItems.length; index += 1) {
      await checkCancelled(options.signal);
      const row = Math.floor(index / layout.columns); const column = index % layout.columns;
      const x = layout.marginPt + column * (layout.cellWidth + layout.gapPt);
      const y = layout.height - layout.marginPt - layout.titleHeight - (row + 1) * layout.cellHeight - row * layout.gapPt;
      const item = pageItems[index];
      const caption = options.captions ? String(item.name || '') : '';
      const embedded = await pdf.embedJpg(await rasterize(item, layout.cellWidth, layout.cellHeight, caption));
      page.drawImage(embedded, { x, y, width: layout.cellWidth, height: layout.cellHeight });
      options.onProgress?.(++completed);
    }
  }
  const bytes = await pdf.save();
  options.signal?.throwIfAborted();
  return new Blob([bytes], { type: 'application/pdf' });
}
