import React, { useEffect, useState } from 'react';
import { canvasFromUrl } from '../image/background.js';
import { encodeCanvas } from '../image/encode.js';
import { runPixelWorker } from '../image/pixelTask.js';
import { RangeField } from './BackgroundPanel.jsx';
import useBatchTask, { checkCancelled } from '../app/useBatchTask.js';
import { t } from '../i18n/index.js';
import './BackgroundPanel.css';

const DEFAULTS = { dust: 0, noise: 0, sharpen: 0, faded: 0, exposure: 0, color: 0 };

async function enhance(url, options, signal, preview = false) {
  const canvas = await canvasFromUrl(url, preview ? 480 : Infinity);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const result = await runPixelWorker(pixels, 'restore', options, signal);
  signal?.throwIfAborted();
  context.putImageData(new ImageData(new Uint8ClampedArray(result.data), canvas.width, canvas.height), 0, 0);
  const blob = await encodeCanvas(canvas, 'image/png');
  signal?.throwIfAborted();
  return blob;
}

/** "Repair image": dust, noise, sharpening, faded tones, exposure and color, previewed on the first image. */
export default function RestorePanel({ items = [], onApply, onClose, onBusy, onPreview }) {
  const [options, setOptions] = useState(DEFAULTS);
  const [preview, setPreview] = useState('');
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
        const blob = await enhance(items[0].url, options, controller.signal, true);
        if (controller.signal.aborted) return;
        url = URL.createObjectURL(blob); setPreview(url); setError('');
      } catch (cause) { if (!controller.signal.aborted) setError(cause.message); }
    }, 180);
    return () => { clearTimeout(timer); controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [items, options]);
  const apply = async () => {
    setBusy(true); onBusy?.(true); setError('');
    const signal = task.start();
    try {
      const results = [];
      for (const item of items) {
        await checkCancelled(signal);
        results.push({ item, blob: await enhance(item.url, options, signal) }); task.advance(results.length);
      }
      await checkCancelled(signal); await onApply(results, signal); onClose?.();
    } catch (cause) { setError(cause.name === 'AbortError' ? t('Operación cancelada. No se han aplicado cambios.') : cause.message); }
    finally { setBusy(false); onBusy?.(false); }
  };
  const range = (key, label, min = 0, max = 100) => <RangeField label={label} value={options[key]} min={min} max={max} onChange={(value) => setOptions({ ...options, [key]: value })} />;
  return <section className="background-panel" aria-busy={busy}>
    <h2>{t('Reparar imagen')}</h2>
    <p className="batch-hint">{t('Procesamiento local. Revisa el resultado: la reparación puede suavizar detalles y no recupera información perdida.')}</p>
    {preview && <figure className="background-preview"><img src={preview} alt={t('Vista previa de la imagen')} /><figcaption>{t('Vista previa de la primera imagen')}</figcaption></figure>}
    <fieldset disabled={busy} className="batch-fields">
      {range('dust', t('Polvo y puntos aislados'))}
      {range('noise', t('Reducir ruido'))}
      {range('faded', t('Recuperar tonos desvaídos'))}
      {range('sharpen', t('Nitidez'))}
      {range('exposure', t('Exposición'), -50, 50)}
      {range('color', t('Color'))}
    </fieldset>
    {error && <p role="alert" className="error-message">{error}</p>}
    <footer className="batch-footer"><span role="status">{busy ? t('Procesando {done}/{total}…', { done: task.progress, total: items.length }) : ''}</span><button className="toolbar-button" onClick={busy ? task.cancel : onClose}>{t('Cancelar')}</button><button className="primary-button" disabled={busy || !items.length} onClick={apply}>{t('Aplicar')}</button></footer>
  </section>;
}
