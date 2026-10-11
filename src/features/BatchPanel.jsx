import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import useBatchTask, { checkCancelled } from './useBatchTask';
import ToolPanel from './ToolPanel';
import { flattenForFormat } from './background';
import { batchFormatFor, initialSettings, loadImage, getCrop, renderImage, saveFormatFor, SAVE_QUALITY } from './imageEngine';
import { t, tn } from '../i18n/index.js';

function getBatchSize(source, { action, settings, resizeMode, maxEdge, allowEnlarge }, preview = false) {
  const crop = getCrop(settings, source.naturalWidth, source.naturalHeight);
  let scale = action === 'resize' ? resizeMode === 'percent' ? maxEdge / 100 : maxEdge / (resizeMode === 'width' ? crop.sw : resizeMode === 'height' ? crop.sh : Math.max(crop.sw, crop.sh)) : 1;
  if (!allowEnlarge) scale = Math.min(1, scale);
  if (preview) scale = Math.min(scale, 480 / Math.max(crop.sw, crop.sh));
  return { width: Math.max(1, Math.round(crop.sw * scale)), height: Math.max(1, Math.round(crop.sh * scale)) };
}

export default function BatchPanel({ action, items, onApply, onClose, onBusy, onPreview }) {
  const task = useBatchTask();
  const [settings, setSettings] = useState(() => ({ ...initialSettings, format: batchFormatFor(items.map((item) => item.type)) }));
  const [maxEdge, setMaxEdge] = useState(1600);
  const [resizeMode, setResizeMode] = useState('longest');
  const [allowEnlarge, setAllowEnlarge] = useState(false);
  // Decoded sources keyed by URL, so moving a slider does not re-decode every selected image.
  const sourcesRef = useRef(new Map());
  const loadSource = (url) => {
    if (!sourcesRef.current.has(url)) sourcesRef.current.set(url, loadImage(url).catch((cause) => { sourcesRef.current.delete(url); throw cause; }));
    return sourcesRef.current.get(url);
  };
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const titles = { adjust: t('Ajustar color y luz'), resize: t('Cambiar tamaño'), crop: t('Recortar imágenes'), rotate: t('Girar y reflejar'), watermark: t('Añadir marca de agua'), export: t('Convertir y descargar') };

  useEffect(() => {
    let active = true;
    // Object URLs instead of data URLs: encoding happens off the main thread and the loop yields between
    // images, so a newer slider value can supersede an unfinished pass over a large selection.
    let created = [];
    const timer = window.setTimeout(async () => {
      try {
        const nextPreviews = {};
        for (const item of items) {
          if (!active) return;
          const source = await loadSource(item.thumbnailUrl || item.url);
          if (!active) return;
          const canvas = document.createElement('canvas');
          const size = getBatchSize(source, { action, settings, resizeMode, maxEdge, allowEnlarge }, true);
          renderImage(source, canvas, { ...settings, blur: settings.blur * size.width / (item.width || source.naturalWidth) }, size, []);
          const blob = await new Promise((resolve) => canvas.toBlob(resolve, action === 'export' ? settings.format : 'image/png', settings.quality / 100));
          if (!blob) throw new Error('Preview failed');
          const url = URL.createObjectURL(blob);
          created.push(url);
          nextPreviews[item.id] = url;
        }
        if (active) onPreview(nextPreviews);
      } catch { if (active) onPreview({}); }
    }, 180);
    return () => {
      active = false;
      window.clearTimeout(timer);
      onPreview({});
      const urls = created;
      created = [];
      // Revoke after the gallery has re-rendered without them.
      window.setTimeout(() => urls.forEach((url) => URL.revokeObjectURL(url)), 0);
    };
  }, [action, items, settings, maxEdge, onPreview, resizeMode, allowEnlarge]);

  const apply = async () => {
    if (action === 'resize' && (!Number.isInteger(maxEdge) || maxEdge < 1 || maxEdge > 8192)) {
      setError(t('Introduce un lado máximo entero entre 1 y 8192 píxeles.'));
      return;
    }
    setBusy(true);
    onBusy?.(true);
    setError('');
    const results = [];
    const signal = task.start();
    setProgress(0);
    try {
      for (const item of items) {
        await checkCancelled(signal);
        const source = await loadImage(item.url);
        const canvas = document.createElement('canvas');
        const size = getBatchSize(source, { action, settings, resizeMode, maxEdge, allowEnlarge });
        if (size.width > 16384 || size.height > 16384 || size.width * size.height > 64000000) throw new Error('Output too large');
        renderImage(source, canvas, settings, size, []);
        const format = action === 'export' ? settings.format : saveFormatFor(item.type);
        const quality = action === 'export' ? settings.quality / 100 : SAVE_QUALITY;
        const blob = await new Promise((resolve, reject) => flattenForFormat(canvas, format).toBlob((value) => value ? resolve(value) : reject(new Error('Encoding failed')), format, quality));
        signal.throwIfAborted();
        results.push({ item, blob });
        setProgress(results.length);
      }
      await checkCancelled(signal);
      if (action === 'export') {
        const extension = settings.format.split('/')[1].replace('jpeg', 'jpg');
        const names = new Set();
        const entries = results.map(({ item, blob }) => {
          const base = item.name.replace(/\.[^.]+$/, '');
          let name = `${base}-editada.${extension}`;
          let suffix = 2;
          while (names.has(name)) name = `${base}-editada-${suffix++}.${extension}`;
          names.add(name);
          return { name, blob };
        });
        let blob = entries[0].blob;
        if (entries.length > 1) {
          const { default: JSZip } = await import('jszip');
          const zip = new JSZip();
          entries.forEach((entry) => zip.file(entry.name, entry.blob));
          blob = await zip.generateAsync({ type: 'blob' });
        }
        signal.throwIfAborted();
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = entries.length === 1 ? entries[0].name : `imageinplace-${entries.length}-imagenes.zip`;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      } else {
        await onApply(results, signal);
      }
      onBusy?.(false);
      onClose();
    } catch (cause) {
      setError(cause.name === 'AbortError' ? t('Operación cancelada. No se han aplicado cambios.') : t('No se pudo completar la operación. No se han aplicado cambios. Prueba con menos imágenes o un tamaño menor.'));
      setBusy(false);
      onBusy?.(false);
    }
  };

  return <section className="batch-panel" aria-labelledby="batch-title">
      <header className="batch-heading"><div><h2 id="batch-title">{titles[action]}</h2><p>{tn(items.length, 'Se aplicará a {n} imagen seleccionada.', 'Se aplicará a {n} imágenes seleccionadas.')}</p></div><button type="button" className="icon-button" aria-label={t('Cerrar parámetros')} disabled={busy} onClick={onClose}><X /></button></header>
      <fieldset className="batch-fields" disabled={busy}>
        {action === 'resize' && <><label className="select-field"><span>{t('Medida de referencia')}</span><select value={resizeMode} onChange={(event) => { setResizeMode(event.target.value); setMaxEdge(event.target.value === 'percent' ? 100 : 1600); }}><option value="longest">{t('Lado más largo')}</option><option value="width">{t('Ancho')}</option><option value="height">{t('Alto')}</option><option value="percent">{t('Porcentaje')}</option></select></label><label className="welcome-preference"><input type="checkbox" checked={allowEnlarge} onChange={(event) => setAllowEnlarge(event.target.checked)} />{t('Permitir ampliar imágenes')}</label></>}
        {action === 'rotate' && <p className="batch-hint" role="status">{t('Giro: {degrees}°. Reflejo horizontal: {flip}.', { degrees: ((settings.rotation % 360) + 360) % 360, flip: settings.flipX ? t('sí') : t('no') })}</p>}
        {action === 'resize' ? <><label className="text-field"><span>{resizeMode === 'percent' ? t('Escala (%)') : resizeMode === 'width' ? t('Ancho (px)') : resizeMode === 'height' ? t('Alto (px)') : t('Lado más largo (px)')}</span><input type="number" min="1" max="8192" required value={maxEdge} onChange={(event) => setMaxEdge(Number(event.target.value))} /></label><p className="batch-hint">{t('Cada imagen conserva sus proporciones.')}{!allowEnlarge && t(' Las imágenes más pequeñas no se amplían.')}</p></> : <ToolPanel activeTool={action} settings={settings} setSetting={(key, value) => setSettings((current) => ({ ...current, [key]: value }))} />}
      </fieldset>
      <p className="batch-hint">{t('Vista previa en las imágenes seleccionadas. Los cambios se guardan al aplicar.')}</p>
      {error && <p role="alert">{error}</p>}
      <footer className="batch-footer"><span role="status">{busy ? t('Procesando {done}/{total}…', { done: progress, total: items.length }) : action === 'export' ? t('Varias imágenes se descargan en un ZIP.') : t('El resultado aparecerá en la galería.')}</span><button type="button" className="toolbar-button" onClick={busy ? task.cancel : onClose}>{t('Cancelar')}</button><button type="button" className="primary-button" onClick={apply} disabled={busy || (action === 'watermark' && !settings.watermarkText.trim())}>{busy ? t('Procesando…') : action === 'export' ? t('Descargar') : t('Aplicar')}</button></footer>
  </section>;
}
