import { processPixels } from './pixelTask';
import useBatchTask, { checkCancelled } from './useBatchTask';
import React, { useEffect, useRef, useState } from 'react';
import { Eraser, X } from 'lucide-react';
import { canvasFromUrl, canvasToBlob, cropCanvas, estimateBackground, findContentBounds, removeBackground } from './background';
import { removeBackgroundWithAI } from './ai/onDevice';
import './BackgroundPanel.css';
import { t, tn } from '../i18n/index.js';

const PREVIEW_SIDE = 320;
const DEFAULTS = { tolerance: 15, softness: 8, interior: false, trim: false };
const UNIFORM_BORDER = 0.85;
/** Uniform (or transparent) borders suit the exact colour method; busy borders need the AI cut-out. */
async function suggestMethod(items) {
  for (const item of items.slice(0, 3)) {
    const canvas = await canvasFromUrl(item.url, 160);
    const background = estimateBackground(canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height));
    if (!background.transparent && background.coverage < UNIFORM_BORDER) return 'auto';
  }
  return 'color';
}

/** AI cut-out of one image as a PNG blob, or null when the model found no clear subject. */
async function cutOutWithAI(item, trim, signal) {
  const { canvas, removedShare } = await removeBackgroundWithAI(item.url, signal);
  if (removedShare < 0.01 || removedShare > 0.99) return null;
  let output = canvas;
  if (trim) {
    const imageData = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height);
    const { bounds } = findContentBounds(imageData);
    if (bounds) output = cropCanvas(canvas, bounds);
  }
  return canvasToBlob(output, 'image/png');
}

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
  const task = useBatchTask();
  const [options, setOptions] = useState(DEFAULTS);
  // null while the borders are analysed; a choice made by the user is never overridden.
  const [method, setMethodState] = useState(null);
  const userChoseMethod = useRef(false);
  const setMethod = (value) => { userChoseMethod.current = true; setMethodState(value); };
  useEffect(() => {
    let active = true;
    suggestMethod(items).catch(() => 'color').then((suggested) => { if (active && !userChoseMethod.current) setMethodState(suggested); });
    return () => { active = false; };
  }, [items]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [preview, setPreview] = useState(null);

  useEffect(() => () => { onBusy?.(false); onPreview?.({}); }, [onBusy, onPreview]);

  useEffect(() => {
    if (method !== 'color') { onPreview?.({}); return undefined; }
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
  }, [items, options, onPreview, method]);

  const setOption = (key, value) => { setOptions((current) => ({ ...current, [key]: value })); setError(''); setNotice(''); };

  const apply = async () => {
    setBusy(true); setError(''); setNotice(''); onBusy?.(true);
    const signal = task.start();
    try {
      const results = [];
      let skipped = 0;
      let taskIndex = 1;
      for (const item of items) {
        await checkCancelled(signal);
        if (method === 'auto') {
          const blob = await cutOutWithAI(item, options.trim, signal);
          task.advance(taskIndex++);
          if (!blob) { skipped += 1; continue; }
          results.push({ item, blob });
          continue;
        }
        const result = await processPixels(item.url, 'background', options, 'image/png', undefined, signal);
        task.advance(taskIndex++);
        // Nothing removed means no uniform background touching the edges: leave the image untouched.
        if (result.removedShare === 0) { skipped += 1; continue; }
        results.push({ item, blob: result.blob });
      }
      if (!results.length && method === 'auto') {
        setError(t('No se distinguió un objeto principal. Prueba el método «Fondo de un color».'));
        return;
      }
      if (!results.length) {
        setError(items.length === 1
          ? t('No se encontró un fondo uniforme en los bordes. Sube la tolerancia o activa «Quitar también zonas interiores».')
          : t('Ninguna imagen tiene un fondo uniforme en los bordes. Sube la tolerancia o activa «Quitar también zonas interiores».'));
        return;
      }
      await checkCancelled(signal);
      await onApply?.(results, signal);
      if (skipped) setNotice(`${tn(results.length, 'Fondo quitado en {n} imagen.', 'Fondo quitado en {n} imágenes.')} ${method === 'auto' ? tn(skipped, '{n} sin un objeto principal claro quedó igual.', '{n} sin un objeto principal claro quedaron igual.') : tn(skipped, '{n} sin fondo uniforme quedó igual.', '{n} sin fondo uniforme quedaron igual.')}`);
      else onClose?.();
    } catch (cause) {
      setError(cause?.name === 'AbortError' ? t('Operación cancelada. No se han aplicado cambios.') : cause?.message || t('No se pudo quitar el fondo.'));
    } finally {
      setBusy(false); onBusy?.(false);
    }
  };

  const swatch = preview && !preview.background.transparent ? `rgb(${preview.background.color.join(',')})` : null;

  return <section className="background-panel" aria-busy={busy}>
    <div className="batch-heading"><div><span className="panel-kicker"><Eraser size={14} />{' '}{t('Fondo')}</span><h2>{t('Quitar fondo')}</h2></div><button className="icon-button" type="button" onClick={onClose} disabled={busy} aria-label={t('Cerrar')}><X /></button></div>
    <div className="preset-grid" role="radiogroup" aria-label={t('Método')}>
      <button type="button" role="radio" aria-checked={method === 'auto'} className={method === 'auto' ? 'active' : ''} disabled={busy} onClick={() => { setMethod('auto'); setError(''); setNotice(''); }}>{t('Automático (IA)')}</button>
      <button type="button" role="radio" aria-checked={method === 'color'} className={method === 'color' ? 'active' : ''} disabled={busy} onClick={() => { setMethod('color'); setError(''); setNotice(''); }}>{t('Fondo de un color')}</button>
    </div>
    {method === 'auto' ? <>
      <p className="batch-hint">{t('Detecta el objeto o la persona principal y quita todo lo demás, también en fotos con fondos variados. El modelo de IA funciona en tu dispositivo: la primera vez se descargan unos 19 MB de esta web y quedan guardados para usarlos sin conexión. El resultado se guarda en PNG; puedes deshacerlo.')}</p>
      <fieldset className="batch-fields" disabled={busy}>
        <label className="welcome-preference"><input type="checkbox" checked={options.trim} onChange={(event) => setOption('trim', event.target.checked)} />{' '}{t('Recortar después al contenido')}</label>
      </fieldset>
    </> : <>
      <p className="batch-hint">{t('Vuelve transparente el fondo de color uniforme que toca los bordes: logotipos, dibujos escaneados, capturas o fotos de producto. Todo se procesa en tu dispositivo y el resultado se guarda en PNG.')}</p>
      {preview && <figure className="background-preview">
        <img className="transparency-grid" src={preview.url} alt={t('Vista previa sin fondo')} />
        <figcaption>
          {preview.background.transparent ? t('La imagen ya tiene el fondo transparente.') : <>{t('Fondo detectado')}{' '}<span className="background-swatch" style={{ background: swatch }} aria-hidden="true" /> · {Math.round(preview.removedShare * 100)}{t('% eliminado')}</>}
        </figcaption>
      </figure>}
      <fieldset className="batch-fields" disabled={busy}>
        <RangeField label={t('Tolerancia')} value={options.tolerance} min={1} max={60} onChange={(value) => setOption('tolerance', value)} />
        <RangeField label={t('Suavizado del borde')} value={options.softness} min={0} max={30} onChange={(value) => setOption('softness', value)} />
        <label className="welcome-preference"><input type="checkbox" checked={options.interior} onChange={(event) => setOption('interior', event.target.checked)} />{' '}{t('Quitar también zonas interiores del mismo color')}</label>
        <label className="welcome-preference"><input type="checkbox" checked={options.trim} onChange={(event) => setOption('trim', event.target.checked)} />{' '}{t('Recortar después al contenido')}</label>
      </fieldset>
      <p className="batch-hint">{t('Para fotos con fondos complejos usa «Automático (IA)».')}</p>
    </>}
    {notice && <p className="batch-hint" role="status">{notice}</p>}
    {error && <p className="error-message" role="alert">{error}</p>}
    <div className="batch-footer"><span role="status">{busy ? t('Procesando {done}/{total}…', { done: task.progress, total: items.length }) : tn(items.length, '{n} imagen', '{n} imágenes')}</span><button className="toolbar-button" type="button" onClick={busy ? task.cancel : onClose}>{t('Cancelar')}</button><button className="primary-button" type="button" onClick={apply} disabled={busy || !items.length || !method}>{busy ? t('Procesando…') : t('Quitar fondo')}</button></div>
  </section>;
}
