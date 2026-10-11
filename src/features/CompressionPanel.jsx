import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Gauge, X } from 'lucide-react';
import { compressToTarget } from './compression';
import './CompressionPanel.css';
import useBatchTask, { checkCancelled } from './useBatchTask';

const formatBytes = (bytes) => (Number.isFinite(bytes) ? `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB` : '—');

export default function CompressionPanel({ items, onApply, onClose, onBusy }) {
  const task = useBatchTask();
  const [targetKb, setTargetKb] = useState('500');
  const [format, setFormat] = useState('image/jpeg');
  const [allowResize, setAllowResize] = useState(true);
  const [status, setStatus] = useState('idle');
  const [report, setReport] = useState([]);
  const [error, setError] = useState('');
  const [applied, setApplied] = useState(false);
  const selectionSignature = useMemo(() => items.map((item) => `${item.id}:${item.url}`).join('|'), [items]);
  const previousSignature = useRef(selectionSignature);
  const targetBytes = useMemo(() => Math.round(Number(targetKb) * 1024), [targetKb]);

  useEffect(() => () => onBusy?.(false), [onBusy]);
  useEffect(() => {
    if (previousSignature.current !== selectionSignature && !applied) { setReport([]); setError(''); setApplied(false); }
    previousSignature.current = selectionSignature;
  }, [selectionSignature, applied]);

  const process = async () => {
    if (!items.length || !Number.isFinite(targetBytes) || targetBytes < 1024) { setError('Indica un tamaño objetivo de al menos 1 KB.'); return; }
    setStatus('processing'); setError(''); setReport([]); setApplied(false); onBusy?.(true);
    const staged = [];
    const signal = task.start();
    for (const item of items) {
      try {
        await checkCancelled(signal);
        const result = await compressToTarget(item.url, { targetBytes, format, allowResize, minDimension: 320, minQuality: 0.25, maxQuality: 0.95, signal });
        staged.push({ item, ...result, error: '' });
      } catch (cause) {
        if (cause.name === 'AbortError') { setReport([]); setError('Operación cancelada. No se han aplicado cambios.'); setStatus('idle'); onBusy?.(false); return; }
        staged.push({ item, error: cause?.message || 'No se pudo procesar.' });
      }
      task.advance(staged.length);
      setReport([...staged]);
    }
    setStatus('ready'); onBusy?.(false);
  };

  const successful = report.length === items.length && report.every((entry) => !entry.error && entry.blob);
  const apply = async () => {
    if (!successful || applied) return;
    // Re-check the captured selection and source URLs before committing staged output.
    const currentById = new Map(items.map((item) => [item.id, item]));
    const stale = report.length !== items.length || report.some(({ item }) => currentById.get(item.id)?.url !== item.url);
    if (stale) { setError('La selección o las imágenes han cambiado. Vuelve a comprimir antes de aplicar.'); setReport([]); return; }
    setStatus('processing'); onBusy?.(true);
    const signal = task.start();
    try { await onApply(report.map(({ item, blob }) => ({ item: currentById.get(item.id), blob })), signal); setApplied(true); }
    catch (cause) { setError(cause.message); }
    finally { setStatus('ready'); onBusy?.(false); }
  };

  return <section className="compression-panel" aria-busy={status === 'processing'}>
    <div className="batch-heading"><div><span className="panel-kicker"><Gauge size={14} /> Compresión</span><h2>Reducir peso</h2></div><button className="icon-button" type="button" onClick={onClose} disabled={status === 'processing'} aria-label="Cerrar"><X /></button></div>
    <p className="batch-hint">Procesa las imágenes en tu dispositivo y conserva un informe de cada resultado.</p>
    <label className="text-field"><span>Tamaño máximo por imagen (KB)</span><input type="number" min="1" step="1" value={targetKb} onChange={(event) => { setTargetKb(event.target.value); setReport([]); setApplied(false); }} disabled={status === 'processing'} /></label>
    <label className="select-field"><span>Formato de salida</span><select value={format} onChange={(event) => { setFormat(event.target.value); setReport([]); setApplied(false); }} disabled={status === 'processing'}><option value="image/jpeg">JPEG</option><option value="image/webp">WebP</option></select></label>
    <label className="compression-check"><input type="checkbox" checked={allowResize} onChange={(event) => { setAllowResize(event.target.checked); setReport([]); setApplied(false); }} disabled={status === 'processing'} /><span>Reducir dimensiones si es necesario</span></label>
    <p className="compression-selection">{items.length} {items.length === 1 ? 'imagen seleccionada' : 'imágenes seleccionadas'}</p>
    <div className="batch-footer"><button className="primary-button" type="button" onClick={process} disabled={status === 'processing' || !items.length}>{status === 'processing' ? 'Comprimiendo…' : 'Comprimir selección'}</button>{successful && <button className="toolbar-button" type="button" onClick={apply} disabled={applied || status === 'processing'}>{applied ? 'Aplicado' : 'Aplicar resultados'}</button>}</div>
    {status === 'processing' && <div className="batch-footer"><span role="status">Procesando {task.progress}/{items.length}…</span><button type="button" className="toolbar-button" onClick={task.cancel}>Cancelar</button></div>}
    {error && <p className="error-message" role="alert">{error}</p>}
    {report.length > 0 && <div className="compression-report" aria-live="polite"><h3>Informe</h3>{report.map((entry) => <div className="compression-result" key={entry.item.id}><div><strong>{entry.item.name}</strong>{entry.error ? <small className="compression-fail">{entry.error}</small> : <small>{formatBytes(entry.item.size)} → {formatBytes(entry.blob.size)} · {entry.width} × {entry.height} px</small>}</div>{entry.error ? <span className="compression-fail">Error</span> : entry.metTarget ? <span className="compression-ok"><Check size={14} /> Objetivo</span> : <span className="compression-fail">No alcanzado</span>}</div>)}</div>}
  </section>;
}
