import React, { useEffect, useState } from 'react';
import { canvasFromUrl, canvasToBlob } from './background.js';
import { analyzePixels } from './restoration.js';
import { runPixelWorker } from './pixelTask.js';
import { validateDimensions } from './imageLimits.js';
import { RangeField } from './BackgroundPanel.jsx';
import useBatchTask, { checkCancelled } from './useBatchTask.js';
import { t } from '../i18n/index.js';
import './BackgroundPanel.css';

const DEFAULTS = { dust: 0, noise: 0, sharpen: 0, faded: 0, exposure: 0, color: 0 };

async function enhance(url, options, scale, signal, preview = false) {
  const canvas = await canvasFromUrl(url, preview ? 480 : Infinity);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (scale > 1) {
    const width = canvas.width * scale; const height = canvas.height * scale;
    validateDimensions(width, height);
    const enlarged = document.createElement('canvas'); enlarged.width = width; enlarged.height = height;
    const output = enlarged.getContext('2d');
    output.imageSmoothingEnabled = true; output.imageSmoothingQuality = 'high';
    output.drawImage(canvas, 0, 0, width, height);
    canvas.width = width; canvas.height = height;
    context.drawImage(enlarged, 0, 0);
  }
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const result = await runPixelWorker(pixels, 'restore', options, signal);
  signal?.throwIfAborted();
  context.putImageData(new ImageData(new Uint8ClampedArray(result.data), canvas.width, canvas.height), 0, 0);
  const blob = await canvasToBlob(canvas, 'image/png');
  signal?.throwIfAborted();
  return blob;
}

export default function EnhancementPanel({ mode = 'restore', items = [], onApply, onClose, onBusy, onPreview }) {
  const [options, setOptions] = useState(DEFAULTS);
  const [scale, setScale] = useState(2);
  const [preview, setPreview] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const task = useBatchTask();
  useEffect(() => () => { onBusy?.(false); onPreview?.({}); }, [onBusy, onPreview]);
  useEffect(() => {
    const controller = new AbortController();
    let url;
    const timer = setTimeout(async () => {
      if (!items[0]) return;
      try {
        const source = await canvasFromUrl(items[0].url, 480);
        const measured = analyzePixels(source.getContext('2d').getImageData(0, 0, source.width, source.height));
        const blob = await enhance(items[0].url, mode === 'intelligence' ? measured.suggestions : options, mode === 'upscale' ? scale : 1, controller.signal, true);
        if (controller.signal.aborted) return;
        url = URL.createObjectURL(blob); setPreview(url); setAnalysis(measured); setError('');
      } catch (cause) { if (!controller.signal.aborted) setError(cause.message); }
    }, 180);
    return () => { clearTimeout(timer); controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [items, options, mode, scale]);
  const apply = async () => {
    setBusy(true); onBusy?.(true); setError('');
    const signal = task.start();
    try {
      const results = [];
      for (const item of items) {
        await checkCancelled(signal);
        let selected = options;
        if (mode === 'intelligence') {
          const sample = await canvasFromUrl(item.url, 480);
          selected = analyzePixels(sample.getContext('2d').getImageData(0, 0, sample.width, sample.height)).suggestions;
        }
        const blob = await enhance(item.url, selected, mode === 'upscale' ? scale : 1, signal);
        results.push({ item, blob }); task.advance(results.length);
      }
      await checkCancelled(signal); await onApply(results, signal); onClose?.();
    } catch (cause) { setError(cause.name === 'AbortError' ? t('Operación cancelada. No se han aplicado cambios.') : cause.message); }
    finally { setBusy(false); onBusy?.(false); }
  };
  return <section className="background-panel" aria-busy={busy}>
    <h2>{mode === 'upscale' ? t('Ampliar 2× / 4×') : mode === 'intelligence' ? t('Sugerencias locales') : t('Reparar imagen')}</h2>
    <p className="batch-hint">{t('Procesamiento local. Revisa el resultado: la reparación puede suavizar detalles y no recupera información perdida.')}</p>
    {preview && <figure className="background-preview"><img src={preview} alt={t('Vista previa de la imagen')} /><figcaption>{t('Vista previa de la primera imagen')}</figcaption></figure>}
    <fieldset disabled={busy} className="batch-fields">
      {mode === 'upscale' && <><label className="select-field"><span>{t('Escala')}</span><select aria-label={t('Escala')} value={scale} onChange={(event) => setScale(Number(event.target.value))}><option value={2}>2×</option><option value={4}>4×</option></select></label><p className="batch-hint">{t('Interpolación de alta calidad, sin IA generativa. Límite: 40 megapíxeles y 10 000 píxeles por lado.')}</p></>}
      {mode !== 'intelligence' && <>
        {mode === 'restore' && <><RangeField label={t('Polvo y puntos aislados')} value={options.dust} min={0} max={100} onChange={(dust) => setOptions({ ...options, dust })} /><RangeField label={t('Reducir ruido')} value={options.noise} min={0} max={100} onChange={(noise) => setOptions({ ...options, noise })} /><RangeField label={t('Recuperar tonos desvaídos')} value={options.faded} min={0} max={100} onChange={(faded) => setOptions({ ...options, faded })} /></>}
        <RangeField label={t('Nitidez')} value={options.sharpen} min={0} max={100} onChange={(sharpen) => setOptions({ ...options, sharpen })} />
        {mode === 'restore' && <><RangeField label={t('Exposición')} value={options.exposure} min={-50} max={50} onChange={(exposure) => setOptions({ ...options, exposure })} /><RangeField label={t('Color')} value={options.color} min={0} max={100} onChange={(color) => setOptions({ ...options, color })} /></>}
      </>}
      {analysis && <><p className="batch-hint">{t('Luminosidad: {mean}/255. Rango tonal: {low}–{high}.', analysis)}</p>{mode === 'intelligence' ? <p className="batch-hint">{t('Exposición {exposure}; recuperación tonal {faded}%; color {color}%; nitidez {sharpen}%.', analysis.suggestions)}</p> : <button className="toolbar-button" type="button" onClick={() => setOptions(analysis.suggestions)}>{t('Previsualizar sugerencias')}</button>}</>}
      {mode === 'intelligence' && <p className="batch-hint">{t('Al aplicar, cada imagen recibe sus propios ajustes de exposición, contraste, color y nitidez según su análisis. Son recomendaciones heurísticas, no un diagnóstico.')}</p>}
    </fieldset>
    {error && <p role="alert" className="error-message">{error}</p>}
    <footer className="batch-footer"><span role="status">{busy ? t('Procesando {done}/{total}…', { done: task.progress, total: items.length }) : ''}</span><button className="toolbar-button" onClick={busy ? task.cancel : onClose}>{t('Cancelar')}</button><button className="primary-button" disabled={busy || !items.length} onClick={apply}>{t('Aplicar')}</button></footer>
  </section>;
}
