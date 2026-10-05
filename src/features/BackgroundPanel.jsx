import React, { useEffect, useState } from 'react';
import { Eraser, X } from 'lucide-react';
import { canvasFromUrl, canvasToBlob, cropCanvas, findContentBounds, removeBackground } from './background';
import './BackgroundPanel.css';

const PREVIEW_SIDE = 320;
const DEFAULTS = { tolerance: 15, softness: 8, interior: false, trim: false };

function process(canvas, options) {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const { removedShare, background } = removeBackground(imageData, options);
  context.putImageData(imageData, 0, 0);
  let output = canvas;
  if (options.trim && removedShare > 0) {
    const { bounds } = findContentBounds(imageData);
    if (bounds) output = cropCanvas(canvas, bounds);
  }
  return { canvas: output, removedShare, background };
}

export function RangeField({ label, value, min, max, unit = '%', onChange, disabled }) {
  return <label className="range-control">
    <span><strong>{label}</strong><output>{value}{unit}</output></span>
    <input type="range" min={min} max={max} value={value} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} />
  </label>;
}

export default function BackgroundPanel({ items = [], onApply, onClose, onBusy, onPreview }) {
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
        for (const item of items) {
          const result = process(await canvasFromUrl(item.url, PREVIEW_SIDE), options);
          if (cancelled) return;
          const url = result.canvas.toDataURL('image/png');
          thumbnails[item.id] = url;
          first ??= { url, ...result };
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
      let skipped = 0;
      for (const item of items) {
        const result = process(await canvasFromUrl(item.url), options);
        // Nothing removed means no uniform background touching the edges: leave the image untouched.
        if (result.removedShare === 0) { skipped += 1; continue; }
        results.push({ item, blob: await canvasToBlob(result.canvas, 'image/png') });
      }
      if (!results.length) {
        setError(items.length === 1
          ? 'No se encontró un fondo uniforme en los bordes. Sube la tolerancia o activa «Quitar también zonas interiores».'
          : 'Ninguna imagen tiene un fondo uniforme en los bordes. Sube la tolerancia o activa «Quitar también zonas interiores».');
        return;
      }
      onApply?.(results);
      if (skipped) setNotice(`Fondo quitado en ${results.length} ${results.length === 1 ? 'imagen' : 'imágenes'}. ${skipped} sin fondo uniforme quedaron igual.`);
      else onClose?.();
    } catch (cause) {
      setError(cause?.message || 'No se pudo quitar el fondo.');
    } finally {
      setBusy(false); onBusy?.(false);
    }
  };

  const swatch = preview && !preview.background.transparent ? `rgb(${preview.background.color.join(',')})` : null;

  return <section className="background-panel" aria-busy={busy}>
    <div className="batch-heading"><div><span className="panel-kicker"><Eraser size={14} /> Fondo</span><h2>Quitar fondo</h2></div><button className="icon-button" type="button" onClick={onClose} disabled={busy} aria-label="Cerrar"><X /></button></div>
    <p className="batch-hint">Vuelve transparente el fondo de color uniforme que toca los bordes: logotipos, dibujos escaneados, capturas o fotos de producto. Todo se procesa en tu dispositivo y el resultado se guarda en PNG.</p>
    {preview && <figure className="background-preview">
      <img className="transparency-grid" src={preview.url} alt="Vista previa sin fondo" />
      <figcaption>
        {preview.background.transparent ? 'La imagen ya tiene el fondo transparente.' : <>Fondo detectado <span className="background-swatch" style={{ background: swatch }} aria-hidden="true" /> · {Math.round(preview.removedShare * 100)}% eliminado</>}
      </figcaption>
    </figure>}
    <fieldset className="batch-fields" disabled={busy}>
      <RangeField label="Tolerancia" value={options.tolerance} min={1} max={60} onChange={(value) => setOption('tolerance', value)} />
      <RangeField label="Suavizado del borde" value={options.softness} min={0} max={30} onChange={(value) => setOption('softness', value)} />
      <label className="welcome-preference"><input type="checkbox" checked={options.interior} onChange={(event) => setOption('interior', event.target.checked)} /> Quitar también zonas interiores del mismo color</label>
      <label className="welcome-preference"><input type="checkbox" checked={options.trim} onChange={(event) => setOption('trim', event.target.checked)} /> Recortar después al contenido</label>
    </fieldset>
    <p className="batch-hint">Para fotos con fondos complejos sube la tolerancia poco a poco y revisa la vista previa.</p>
    {notice && <p className="batch-hint" role="status">{notice}</p>}
    {error && <p className="error-message" role="alert">{error}</p>}
    <div className="batch-footer"><span role="status">{busy ? 'Procesando…' : `${items.length} ${items.length === 1 ? 'imagen' : 'imágenes'}`}</span><button className="toolbar-button" type="button" onClick={onClose} disabled={busy}>Cancelar</button><button className="primary-button" type="button" onClick={apply} disabled={busy || !items.length}>{busy ? 'Procesando…' : 'Quitar fondo'}</button></div>
  </section>;
}
