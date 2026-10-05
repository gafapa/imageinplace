import React, { useEffect, useState } from 'react';
import { Scan, X } from 'lucide-react';
import { canvasFromUrl, canvasToBlob, cropCanvas, findContentBounds, flattenForFormat } from './background';
import { RangeField } from './BackgroundPanel';
import { saveFormatFor, SAVE_QUALITY } from './imageEngine';
import './BackgroundPanel.css';

const PREVIEW_SIDE = 320;
const DEFAULTS = { tolerance: 8, padding: 0 };

const naturalWidthOf = (url) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image.naturalWidth);
  image.onerror = () => reject(new Error('No se pudo leer la imagen.'));
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
  const [options, setOptions] = useState(DEFAULTS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [preview, setPreview] = useState(null);

  useEffect(() => () => { onBusy?.(false); onPreview?.({}); }, [onBusy, onPreview]);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const thumbnails = {};
        let first = null;
        for (const [index, item] of items.entries()) {
          const source = await canvasFromUrl(item.url, PREVIEW_SIDE);
          if (cancelled) return;
          const naturalWidth = await naturalWidthOf(item.url);
          const result = trim(source, options, source.width / naturalWidth);
          thumbnails[item.id] = result.canvas.toDataURL('image/png');
          // Only the first image is measured at full size, for an exact caption.
          if (index === 0) {
            const full = trim(await canvasFromUrl(item.url), options);
            first = { url: thumbnails[item.id], status: full.status, before: full.before, after: [full.canvas.width, full.canvas.height] };
          }
        }
        if (!cancelled) { onPreview?.(thumbnails); setPreview(first); }
      } catch (cause) { if (!cancelled) { onPreview?.({}); setPreview(null); setError(cause.message); } }
    }, 180);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [items, options, onPreview]);

  const setOption = (key, value) => { setOptions((current) => ({ ...current, [key]: value })); setError(''); setNotice(''); };

  const apply = async () => {
    setBusy(true); setError(''); setNotice(''); onBusy?.(true);
    try {
      const results = [];
      let empty = 0; let unchanged = 0;
      for (const item of items) {
        const result = trim(await canvasFromUrl(item.url), options);
        if (result.status === 'empty') { empty += 1; continue; }
        if (result.status === 'unchanged') { unchanged += 1; continue; }
        const format = saveFormatFor(item.type);
        results.push({ item, blob: await canvasToBlob(flattenForFormat(result.canvas, format), format, SAVE_QUALITY) });
      }
      if (!results.length) {
        setError(empty === items.length ? 'No se encontró contenido: la imagen parece vacía.' : 'No hay bordes vacíos que recortar. Sube la tolerancia si el fondo no es del todo uniforme.');
        return;
      }
      onApply?.(results);
      const skipped = empty + unchanged;
      if (skipped) setNotice(`Recortadas ${results.length}. ${skipped} ${skipped === 1 ? 'imagen no tenía' : 'imágenes no tenían'} bordes que quitar.`);
      else onClose?.();
    } catch (cause) {
      setError(cause?.message || 'No se pudo recortar al contenido.');
    } finally {
      setBusy(false); onBusy?.(false);
    }
  };

  return <section className="background-panel" aria-busy={busy}>
    <div className="batch-heading"><div><span className="panel-kicker"><Scan size={14} /> Recorte</span><h2>Recortar al contenido</h2></div><button className="icon-button" type="button" onClick={onClose} disabled={busy} aria-label="Cerrar"><X /></button></div>
    <p className="batch-hint">Elimina los márgenes transparentes o de color uniforme alrededor del contenido, sin deformarlo.</p>
    {preview && <figure className="background-preview">
      <img className="transparency-grid" src={preview.url} alt="Vista previa recortada" />
      <figcaption>{preview.status === 'trimmed' ? `${preview.before.join(' × ')} px → ${preview.after.join(' × ')} px` : preview.status === 'empty' ? 'No se encontró contenido.' : 'Sin bordes que quitar con esta tolerancia.'}</figcaption>
    </figure>}
    <fieldset className="batch-fields" disabled={busy}>
      <RangeField label="Tolerancia del fondo" value={options.tolerance} min={0} max={40} onChange={(value) => setOption('tolerance', value)} />
      <label className="text-field"><span>Margen alrededor (px)</span><input type="number" min="0" max="2000" value={options.padding} onChange={(event) => setOption('padding', Math.max(0, Math.min(2000, Math.round(Number(event.target.value) || 0))))} /></label>
    </fieldset>
    {notice && <p className="batch-hint" role="status">{notice}</p>}
    {error && <p className="error-message" role="alert">{error}</p>}
    <div className="batch-footer"><span role="status">{busy ? 'Procesando…' : `${items.length} ${items.length === 1 ? 'imagen' : 'imágenes'}`}</span><button className="toolbar-button" type="button" onClick={onClose} disabled={busy}>Cancelar</button><button className="primary-button" type="button" onClick={apply} disabled={busy || !items.length}>{busy ? 'Procesando…' : 'Recortar'}</button></div>
  </section>;
}
