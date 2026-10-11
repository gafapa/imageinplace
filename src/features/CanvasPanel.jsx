import React, { useEffect, useMemo, useState } from 'react';
import { Check, Grid3X3, X } from 'lucide-react';
import useBatchTask, { checkCancelled } from './useBatchTask';
import { loadImage } from './imageEngine';
import { CANVAS_ALIGNMENTS, renderCanvasLayout, validateCanvasSize } from './canvasLayout';

const DEFAULTS = { width: 1600, height: 1200, padding: 40, alignment: 'center', background: 'white', backgroundColor: '#ffffff', borderColor: '#111111', borderWidth: 0 };
const MAX_PREVIEW = 320;

const readNumber = (value) => Number.isFinite(Number(value)) ? Math.round(Number(value)) : 0;

export default function CanvasPanel({ items = [], onApply, onClose, onBusy, onPreview }) {
  const task = useBatchTask();
  const [options, setOptions] = useState(DEFAULTS);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [applied, setApplied] = useState(false);
  const [preview, setPreview] = useState(null);
  const dimensions = useMemo(() => `${options.width} × ${options.height} px`, [options.width, options.height]);

  useEffect(() => () => { onBusy?.(false); onPreview?.({}); }, [onBusy, onPreview]);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        validateCanvasSize(options.width, options.height);
        if ((options.padding + options.borderWidth) * 2 >= Math.min(options.width, options.height)) throw new Error('El relleno y el borde dejan un área insuficiente.');
        const scale = Math.min(1, MAX_PREVIEW / Math.max(options.width, options.height));
        const thumbnails = {};
        for (const item of items) {
          const source = await loadImage(item.url);
          if (cancelled) return;
          const canvas = renderCanvasLayout(source, { ...options, width: Math.max(1, Math.round(options.width * scale)), height: Math.max(1, Math.round(options.height * scale)), padding: options.padding * scale, borderWidth: options.borderWidth * scale });
          thumbnails[item.id] = canvas.toDataURL('image/png');
        }
        if (!cancelled) { onPreview?.(thumbnails); setError(''); }
      } catch (cause) { if (!cancelled) { onPreview?.({}); setError(cause.message); } }
    }, 180);
    return () => { cancelled = true; clearTimeout(timer); onPreview?.({}); };
  }, [items, options, onPreview]);

  const setOption = (key, value) => { setOptions((current) => ({ ...current, [key]: value })); setApplied(false); };
  const close = () => { onPreview?.({}); setPreview(null); onClose?.(); };

  const process = async () => {
    const width = readNumber(options.width);
    const height = readNumber(options.height);
    if (!items.length || width < 1 || height < 1) { setError('Indica un ancho y un alto positivos.'); return; }
    setStatus('processing'); setError(''); setApplied(false); onBusy?.(true);
    const results = [];
    const signal = task.start();
    try {
      for (const item of items) {
        await checkCancelled(signal);
        const source = await loadImage(item.url);
        const canvas = renderCanvasLayout(source, { ...options, width, height });
        const blob = await new Promise((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('No se pudo crear el PNG.')), 'image/png'));
        signal.throwIfAborted();
        results.push({ item, blob });
        task.advance(results.length);
        if (onPreview) {
          const ratio = Math.min(MAX_PREVIEW / canvas.width, MAX_PREVIEW / canvas.height, 1);
          const thumb = document.createElement('canvas'); thumb.width = Math.max(1, Math.round(canvas.width * ratio)); thumb.height = Math.max(1, Math.round(canvas.height * ratio));
          thumb.getContext('2d').drawImage(canvas, 0, 0, thumb.width, thumb.height);
          onPreview({ [item.id]: thumb.toDataURL('image/png') }); setPreview({ id: item.id, url: thumb.toDataURL('image/png') });
        }
      }
      await checkCancelled(signal); await onApply?.(results, signal); onBusy?.(false); setStatus('ready'); setApplied(true); close();
    } catch (cause) {
      onBusy?.(false); onPreview?.({}); setPreview(null); setStatus('error'); setError(cause.name === 'AbortError' ? 'Operación cancelada. No se han aplicado cambios.' : cause?.message || 'No se pudo preparar el lienzo.');
    }
  };

  return <section className="canvas-panel" aria-busy={status === 'processing'}>
    <div className="batch-heading"><div><span className="panel-kicker"><Grid3X3 size={14} /> Lienzo</span><h2>Crear lienzo</h2></div><button className="icon-button" type="button" onClick={close} disabled={status === 'processing'} aria-label="Cerrar"><X /></button></div>
    <p className="batch-hint">Amplía el espacio sin deformar ni recortar la imagen. El resultado se exporta en PNG.</p>
    <div className="canvas-fields"><label className="text-field"><span>Ancho del lienzo (px)</span><input type="number" min="1" max="12000" value={options.width} onChange={(event) => setOption('width', readNumber(event.target.value))} /></label><label className="text-field"><span>Alto del lienzo (px)</span><input type="number" min="1" max="12000" value={options.height} onChange={(event) => setOption('height', readNumber(event.target.value))} /></label><label className="text-field"><span>Relleno alrededor (px)</span><input type="number" min="0" max="12000" value={options.padding} onChange={(event) => setOption('padding', readNumber(event.target.value))} /></label></div>
    <fieldset><legend>Alineación</legend><div className="canvas-alignment-grid">{CANVAS_ALIGNMENTS.map(([value, label]) => <button key={value} type="button" className={options.alignment === value ? 'active' : ''} onClick={() => setOption('alignment', value)} aria-label={value}>{label}</button>)}</div></fieldset>
    <fieldset><legend>Fondo</legend><div className="canvas-background-options"><label><input type="radio" checked={options.background === 'white'} onChange={() => setOption('background', 'white')} /> Blanco</label><label><input type="radio" checked={options.background === 'transparent'} onChange={() => setOption('background', 'transparent')} /> Transparente</label><label><input type="radio" checked={options.background === 'custom'} onChange={() => setOption('background', 'custom')} /> Personalizado</label>{options.background === 'custom' && <input type="color" value={options.backgroundColor} onChange={(event) => setOption('backgroundColor', event.target.value)} aria-label="Color de fondo" />}</div></fieldset>
    <fieldset><legend>Borde exportable</legend><div className="canvas-fields"><label className="text-field"><span>Ancho (px)</span><input type="number" min="0" max="1000" value={options.borderWidth} onChange={(event) => setOption('borderWidth', readNumber(event.target.value))} /></label><label className="text-field"><span>Color</span><input type="color" value={options.borderColor} onChange={(event) => setOption('borderColor', event.target.value)} /></label></div></fieldset>
    <p className="batch-hint">Salida: {dimensions} · {items.length} {items.length === 1 ? 'imagen' : 'imágenes'}</p>
    {preview && <img src={preview.url} alt="Vista previa del lienzo" style={{ maxWidth: '100%', maxHeight: 180, objectFit: 'contain' }} />}
    <div className="batch-footer"><button className="primary-button" type="button" onClick={process} disabled={status === 'processing' || applied}>{status === 'processing' ? 'Creando…' : applied ? 'Aplicado' : 'Crear lienzo'}</button>{applied && <span role="status"><Check size={15} /> Aplicado</span>}</div>
    {status === 'processing' && <div className="batch-footer"><span role="status">Procesando {task.progress}/{items.length}…</span><button className="toolbar-button" onClick={task.cancel}>Cancelar</button></div>}{error && <p className="error-message" role="alert">{error}</p>}
  </section>;
}
