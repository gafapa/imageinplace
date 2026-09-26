import { createRenames } from './rename.js';

const MAX_SIDE = 10000; const MAX_PIXELS = 40_000_000;
const mime = (format) => ({ jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[format] || format || 'image/jpeg');
const load = (url) => new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error('No se pudo leer una imagen.')); image.src = url; });
const blobFrom = (canvas, type, quality) => new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('No se pudo exportar la imagen.')), type, quality));
const numberOr = (value, fallback) => { const number = Number(value); return value !== '' && value != null && Number.isFinite(number) ? number : fallback; };
const safeSize = (width, height) => { if (width < 1 || height < 1 || width > MAX_SIDE || height > MAX_SIDE || width * height > MAX_PIXELS) throw new Error('El resultado supera los límites del navegador.'); };

export const defaultWorkflow = { version: 1, steps: [] };
export const WORKFLOW_STORAGE_KEY = 'imageinplace-workflows-v1';
const ALLOWED_STEPS = new Set(['resize', 'crop', 'rotate', 'watermark', 'format', 'rename']);

export function readWorkflows(storage) {
  try { const target = storage || globalThis.localStorage; const value = JSON.parse(target.getItem(WORKFLOW_STORAGE_KEY) || '{}'); if (!value || Array.isArray(value) || typeof value !== 'object') return {}; return Object.fromEntries(Object.entries(value).filter(([, workflow]) => workflow && workflow.version === 1 && Array.isArray(workflow.steps) && workflow.steps.every((step) => step && ALLOWED_STEPS.has(step.type) && step.params && typeof step.params === 'object' && !Array.isArray(step.params)))); } catch { return {}; }
}
export function writeWorkflows(workflows, storage) { try { (storage || globalThis.localStorage).setItem(WORKFLOW_STORAGE_KEY, JSON.stringify(workflows)); return true; } catch { return false; } }

function canvasFor(width, height) { safeSize(width, height); const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; return canvas; }
function drawSource(source, width, height) { const canvas = canvasFor(width, height); const context = canvas.getContext('2d'); context.drawImage(source, 0, 0, width, height); return canvas; }

/** Apply a versioned workflow to one current gallery URL. */
export async function applyWorkflow(item, workflow, context = {}) {
  if (typeof document === 'undefined') throw new Error('Los flujos necesitan un navegador.');
  const source = await load(item.url); let canvas = drawSource(source, source.naturalWidth, source.naturalHeight); let name = item.name;
  for (const step of workflow?.steps || []) {
    const p = step.params || {};
    if (step.type === 'resize') { const edge = Math.max(1, Number(p.maxEdge) || 2000); const scale = Math.min(1, edge / Math.max(canvas.width, canvas.height)); if (scale < 1) canvas = drawSource(canvas, Math.max(1, Math.round(canvas.width * scale)), Math.max(1, Math.round(canvas.height * scale))); }
    if (step.type === 'crop') { let left = 0; let top = 0; let right = 0; let bottom = 0; if (p.ratio > 0) { const target = Number(p.ratio); const current = canvas.width / canvas.height; if (current > target) { const width = canvas.height * target; left = right = (canvas.width - width) / 2; } else { const height = canvas.width / target; top = bottom = (canvas.height - height) / 2; } } else { const edges = ['left', 'top', 'right', 'bottom'].map((key) => Math.min(100, Math.max(0, numberOr(p[key], 0)))); if (edges[0] + edges[2] >= 100 || edges[1] + edges[3] >= 100) throw new Error('El recorte del flujo elimina toda la imagen. Revisa los bordes.'); left = canvas.width * edges[0] / 100; top = canvas.height * edges[1] / 100; right = canvas.width * edges[2] / 100; bottom = canvas.height * edges[3] / 100; } const out = canvasFor(Math.round(canvas.width - left - right), Math.round(canvas.height - top - bottom)); out.getContext('2d').drawImage(canvas, left, top, out.width, out.height, 0, 0, out.width, out.height); canvas = out; }
    if (step.type === 'rotate') { const degrees = ((Number(p.degrees) || 0) % 360 + 360) % 360; const radians = degrees * Math.PI / 180; const out = canvasFor(Math.ceil(Math.abs(canvas.width * Math.cos(radians)) + Math.abs(canvas.height * Math.sin(radians))), Math.ceil(Math.abs(canvas.width * Math.sin(radians)) + Math.abs(canvas.height * Math.cos(radians)))); const rotateContext = out.getContext('2d'); rotateContext.translate(out.width / 2, out.height / 2); rotateContext.rotate(radians); rotateContext.drawImage(canvas, -canvas.width / 2, -canvas.height / 2); canvas = out; }
    if (step.type === 'watermark') {
      const text = String(p.text || '');
      if (text) {
        const context = canvas.getContext('2d');
        // sizePercent is relative to the image width; legacy workflows stored an absolute pixel size.
        const fontSize = p.sizePercent != null ? Math.max(12, canvas.width * Math.min(30, Math.max(1, numberOr(p.sizePercent, 5))) / 100) : Math.max(12, numberOr(p.size, 28));
        const padding = Math.max(12, canvas.width * 0.025);
        context.save();
        context.globalAlpha = Math.min(1, Math.max(0, numberOr(p.opacity, 70) / 100));
        context.font = `700 ${fontSize}px 'Segoe UI', system-ui, sans-serif`;
        context.fillStyle = '#ffffff'; context.shadowColor = 'rgba(0, 0, 0, 0.55)'; context.shadowBlur = fontSize * 0.18;
        context.textAlign = 'right'; context.textBaseline = 'bottom';
        context.fillText(text, canvas.width - padding, canvas.height - padding);
        context.restore();
      }
    }
    if (step.type === 'rename') name = context.renameName || createRenames([item], { pattern: p.pattern || '{name}-{n}', start: p.start || 1, padding: p.padding || 2 }, [item])[0].name;
  }
  const output = [...(workflow?.steps || [])].reverse().find((step) => step.type === 'format'); const requested = output?.params?.format; const format = ['jpeg', 'png', 'webp'].includes(requested) ? mime(requested) : (['image/jpeg', 'image/png', 'image/webp'].includes(item.type) ? item.type : 'image/png'); const quality = Math.min(1, Math.max(0.05, numberOr(output?.params?.quality, 85) / 100));
  if (format === 'image/jpeg') { const opaque = canvasFor(canvas.width, canvas.height); const opaqueContext = opaque.getContext('2d'); opaqueContext.fillStyle = '#ffffff'; opaqueContext.fillRect(0, 0, opaque.width, opaque.height); opaqueContext.drawImage(canvas, 0, 0); canvas = opaque; }
  const blob = await blobFrom(canvas, format, quality); const extension = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }[blob.type] || '.png';
  name = `${name.replace(/\.[^.]*$/, '')}${extension}`;
  return { blob, name, width: canvas.width, height: canvas.height };
}

export { MAX_PIXELS, MAX_SIDE };
