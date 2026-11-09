import React, { useEffect, useState } from 'react';
import { Download, EyeOff, X } from 'lucide-react';
import { canvasFromUrl } from '../image/background.js';
import { encodeCanvas } from '../image/encode.js';
import { cleanImageBlob, sensitiveFields } from '../image/metadata.js';
import { createRenames } from '../image/rename.js';
import { downloadFiles } from '../app/download.js';
import { nameForType } from '../image/imageEngine.js';
import useBatchTask, { checkCancelled } from '../app/useBatchTask.js';
import { t, tn } from '../i18n/index.js';

const FIELD_LABELS = () => ({
  location: t('Ubicación GPS'),
  date: t('Fecha y hora'),
  device: t('Cámara o móvil'),
  author: t('Autor'),
  text: t('Textos o comentarios'),
  software: t('Programa'),
});

const blobOf = async (url) => (await fetch(url)).blob();

/** Formats without a lossless cleaner are redrawn into a PNG, which has no metadata. */
async function redrawAsPng(blob) {
  const url = URL.createObjectURL(blob);
  try { return await encodeCanvas(await canvasFromUrl(url), 'image/png'); }
  finally { URL.revokeObjectURL(url); }
}

/** What exifr recognises in the original file: that is the copy kept in projects and session recovery. */
function useFindings(items) {
  const [findings, setFindings] = useState({});
  useEffect(() => {
    let active = true;
    import('exifr').then(async ({ default: exifr }) => {
      for (const item of items) {
        let fields = null;
        try { fields = sensitiveFields(await exifr.parse(item.file || await blobOf(item.originalUrl || item.url), true) || {}); } catch { fields = sensitiveFields({}); }
        if (!active) return;
        setFindings((current) => ({ ...current, [item.id]: fields }));
      }
    });
    return () => { active = false; };
  }, [items]);
  return findings;
}

export default function MetadataPanel({ items, allItems = items, onClean, onClose, onBusy }) {
  const task = useBatchTask();
  const findings = useFindings(items);
  const [renameFiles, setRenameFiles] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const labels = FIELD_LABELS();
  const found = Object.values(findings).filter((fields) => Object.values(fields).some(Boolean)).length;

  const clean = async (signal) => {
    const names = renameFiles ? createRenames(items, { pattern: 'imagen-{n}', padding: 1 }, allItems) : [];
    const results = [];
    for (const [index, item] of items.entries()) {
      await checkCancelled(signal);
      const current = await cleanImageBlob(await blobOf(item.url), redrawAsPng);
      const original = item.originalUrl && item.originalUrl !== item.url ? await cleanImageBlob(item.file || await blobOf(item.originalUrl), redrawAsPng) : null;
      const name = nameForType(names[index]?.name || item.name, current.blob.type);
      results.push({ item, blob: current.blob, original: original?.blob, name, originalName: renameFiles ? nameForType(name, (original || current).blob.type) : undefined });
      task.advance(results.length);
    }
    return results;
  };

  const run = async (download) => {
    setBusy(true); onBusy?.(true); setError('');
    const signal = task.start();
    try {
      const results = await clean(signal);
      await checkCancelled(signal);
      if (download) await downloadFiles(results.map(({ blob, name }) => ({ blob, name })), `imageinplace-${results.length}-imagenes-limpias.zip`, signal);
      else { await onClean(results, signal); onClose(); }
    } catch (cause) { setError(cause.name === 'AbortError' ? t('Operación cancelada. No se han aplicado cambios.') : t('No se pudieron limpiar las imágenes: {v0}.', { v0: cause.message })); }
    finally { setBusy(false); onBusy?.(false); }
  };

  return <section className="batch-panel" aria-labelledby="metadata-title" aria-busy={busy}>
    <header className="batch-heading"><div><h2 id="metadata-title">{t('Quitar datos ocultos')}</h2><p>{tn(items.length, 'Se aplicará a {n} imagen seleccionada.', 'Se aplicará a {n} imágenes seleccionadas.')}</p></div><button type="button" className="icon-button" aria-label={t('Cerrar parámetros')} disabled={busy} onClick={onClose}><X /></button></header>
    <p className="batch-hint">{t('Las fotos guardan datos que no se ven: dónde y cuándo se hicieron, con qué móvil, el autor o comentarios. Esta acción los borra sin tocar los píxeles, también del original que se guarda en los proyectos.')}</p>
    <p className="batch-hint metadata-summary" role="status">{Object.keys(findings).length < items.length ? t('Leyendo…') : found ? tn(found, '{n} imagen contiene datos personales reconocibles.', '{n} imágenes contienen datos personales reconocibles.') : t('No se encontraron datos personales reconocibles. Se borrarán igualmente los datos ocultos que haya.')}</p>
    <ul className="metadata-findings">
      {items.map((item) => {
        const fields = findings[item.id];
        const present = fields ? Object.keys(labels).filter((key) => fields[key]) : [];
        return <li key={item.id}><strong title={item.name}>{item.name}</strong><span>{!fields ? t('Leyendo…') : present.length ? present.map((key) => labels[key]).join(' · ') : t('Nada reconocible')}</span></li>;
      })}
    </ul>
    <fieldset className="batch-fields" disabled={busy}>
      <label className="welcome-preference"><input type="checkbox" checked={renameFiles} onChange={(event) => setRenameFiles(event.target.checked)} />{t('Cambiar también los nombres de archivo por «imagen-1», «imagen-2»…')}</label>
    </fieldset>
    <p className="batch-hint">{t('No borra lo que se ve en la imagen: para caras, nombres o matrículas usa Editar › Ocultar.')}</p>
    {error && <p role="alert" className="error-message">{error}</p>}
    <footer className="batch-footer">
      <span role="status">{busy ? t('Procesando {done}/{total}…', { done: task.progress, total: items.length }) : ''}</span>
      <button type="button" className="toolbar-button" onClick={busy ? task.cancel : onClose}>{t('Cancelar')}</button>
      <button type="button" className="toolbar-button" disabled={busy || !items.length} onClick={() => run(true)}><Download size={16} aria-hidden="true" />{t('Descargar limpias')}</button>
      <button type="button" className="primary-button" disabled={busy || !items.length} onClick={() => run(false)}><EyeOff size={16} aria-hidden="true" />{t('Limpiar')}</button>
    </footer>
  </section>;
}
