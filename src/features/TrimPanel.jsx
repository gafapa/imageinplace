import { processPixels } from './pixelTask';
import useBatchTask, { checkCancelled } from './useBatchTask';
import React, { useEffect, useState } from 'react';
import { Scan, X } from 'lucide-react';
import { canvasFromUrl, cropCanvas, findContentBounds } from './background';
import { RangeField } from './BackgroundPanel';
import { saveFormatFor, SAVE_QUALITY } from './imageEngine';
import './BackgroundPanel.css';
import { t, tn } from '../i18n/index.js';

const PREVIEW_SIDE = 320;
const DEFAULTS = { tolerance: 8, padding: 0 };

const naturalWidthOf = (url) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image.naturalWidth);
  image.onerror = () => reject(new Error(t('No se pudo leer la imagen.')));
  image.src = url;
});

/** Crop one canvas to its content; `scale` shrinks the padding for previews. */
function trim(canvas, { tolerance, padding }, scale = 1) {
  const imageData = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height);
  const { bounds, background } = findContentBounds(imageData, { tolerance });
  if (!bounds) return { canvas, status: 'empty' };
  const unchanged = bounds.width === canvas.width && bounds.height === canvas.height && padding === 0;
  if (unchanged) return { canvas, status: 'unchanged' };
  return { canvas: cropCanvas(canvas, bounds, padding * scale, background), status: 'trimmed', before: [canvas.width, canvas.height] };
}

export default function TrimPanel({ items = [], onApply, onClose, onBusy, onPreview }) {
  const task = useBatchTask();
  const [options, setOptions] = useState(DEFAULTS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [preview, setPreview] = useState(null);

  useEffect(() => () => { onBusy?.(false); onPreview?.({}); }, [onBusy, onPreview]);

  useEffect(() => {
    if (busy) return;
    let cancelled = false;
    const previewController = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const thumbnails = {};
        let first = null;
        for (const [index, item] of items.entries()) {
          const source = await canvasFromUrl(item.url, PREVIEW_SIDE);
          if (cancelled) return;
          const naturalWidth = item.width || await naturalWidthOf(item.url);
          const result = trim(source, options, source.width / naturalWidth);
          thumbnails[item.id] = result.canvas.toDataURL('image/png');
          // Only the first image is measured at full size, for an exact caption.
          if (index === 0) {
            const full = await processPixels(item.url, 'trim', options, saveFormatFor(item.type), SAVE_QUALITY, previewController.signal);
            first = { url: thumbnails[item.id], status: full.status, before: full.before, after: full.after };
          }
        }
        if (!cancelled) { onPreview?.(thumbnails); setPreview(first); }
      } catch (cause) { if (!cancelled) { onPreview?.({}); setPreview(null); setError(cause.message); } }
    }, 180);
    return () => { cancelled = true; previewController.abort(); clearTimeout(timer); };
  }, [items, options, onPreview, busy]);

  const setOption = (key, value) => { setOptions((current) => ({ ...current, [key]: value })); setError(''); setNotice(''); };

  const apply = async () => {
    setBusy(true); setError(''); setNotice(''); onBusy?.(true);
    const signal = task.start();
    try {
      const results = [];
      let empty = 0; let unchanged = 0; let taskIndex = 1;
      for (const item of items) {
        await checkCancelled(signal);
        const result = await processPixels(item.url, 'trim', options, saveFormatFor(item.type), SAVE_QUALITY, signal);
        task.advance(taskIndex++);
        if (result.status === 'empty') { empty += 1; continue; }
        if (result.status === 'unchanged') { unchanged += 1; continue; }
        results.push({ item, blob: result.blob });
      }
      if (!results.length) {
        setError(empty === items.length ? t('No se encontró contenido: la imagen parece vacía.') : t('No hay bordes vacíos que recortar. Sube la tolerancia si el fondo no es del todo uniforme.'));
        return;
      }
      await checkCancelled(signal);
      await onApply?.(results, signal);
      const skipped = empty + unchanged;
      if (skipped) setNotice(`${t('Recortadas: {count}.', { count: results.length })} ${tn(skipped, '{n} imagen no tenía bordes que quitar.', '{n} imágenes no tenían bordes que quitar.')}`);
      else onClose?.();
    } catch (cause) {
      setError(cause?.name === 'AbortError' ? t('Operación cancelada. No se han aplicado cambios.') : cause?.message || t('No se pudo recortar al contenido.'));
    } finally {
      setBusy(false); onBusy?.(false);
    }
  };

  return <section className="background-panel" aria-busy={busy}>
    <div className="batch-heading"><div><span className="panel-kicker"><Scan size={14} />{' '}{t('Recorte')}</span><h2>{t('Recortar al contenido')}</h2></div><button className="icon-button" type="button" onClick={onClose} disabled={busy} aria-label={t('Cerrar')}><X /></button></div>
    <p className="batch-hint">{t('Elimina los márgenes transparentes o de color uniforme alrededor del contenido, sin deformarlo.')}</p>
    {preview && <figure className="background-preview">
      <img className="transparency-grid" src={preview.url} alt={t('Vista previa recortada')} />
      <figcaption>{preview.status === 'trimmed' ? `${preview.before.join(' × ')} px → ${preview.after.join(' × ')} px` : preview.status === 'empty' ? t('No se encontró contenido.') : t('Sin bordes que quitar con esta tolerancia.')}</figcaption>
    </figure>}
    <fieldset className="batch-fields" disabled={busy}>
      <RangeField label={t('Tolerancia del fondo')} value={options.tolerance} min={0} max={40} onChange={(value) => setOption('tolerance', value)} />
      <label className="text-field"><span>{t('Margen alrededor (px)')}</span><input type="number" min="0" max="2000" value={options.padding} onChange={(event) => setOption('padding', Math.max(0, Math.min(2000, Math.round(Number(event.target.value) || 0))))} /></label>
    </fieldset>
    {notice && <p className="batch-hint" role="status">{notice}</p>}
    {error && <p className="error-message" role="alert">{error}</p>}
    <div className="batch-footer"><span role="status">{busy ? t('Procesando {done}/{total}…', { done: task.progress, total: items.length }) : tn(items.length, '{n} imagen', '{n} imágenes')}</span><button className="toolbar-button" type="button" onClick={busy ? task.cancel : onClose}>{t('Cancelar')}</button><button className="primary-button" type="button" onClick={apply} disabled={busy || !items.length}>{busy ? t('Procesando…') : t('Recortar')}</button></div>
  </section>;
}
