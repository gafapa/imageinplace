import React, { useEffect, useMemo, useRef, useState } from 'react';
import { defaultCorners, defaultCrop, geometrySize, renderGeometryCanvas } from './geometry.js';
import { applyGeometry } from './geometryTask.js';
import { loadImage } from './imageEngine.js';
import useBatchTask from './useBatchTask.js';
import './GeometryEditor.css';

const labels = ['Superior izquierda', 'Superior derecha', 'Inferior derecha', 'Inferior izquierda'];
const titles = { deskew: 'Enderezar', visualcrop: 'Recorte visual', perspective: 'Corregir perspectiva' };
const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));
const cropPoints = (crop) => [{ x: crop.x, y: crop.y }, { x: crop.x + crop.width, y: crop.y },
  { x: crop.x + crop.width, y: crop.y + crop.height }, { x: crop.x, y: crop.y + crop.height }];

export default function GeometryEditor({ item, tool, onApply, onClose, onBusy }) {
  const [source, setSource] = useState(null);
  const [angle, setAngle] = useState(0);
  const [background, setBackground] = useState('white');
  const [crop, setCrop] = useState(defaultCrop);
  const [points, setPoints] = useState(defaultCorners);
  const [selectedCorner, setSelectedCorner] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const canvasRef = useRef(null);
  const resultRef = useRef(null);
  const dragRef = useRef(null);
  const task = useBatchTask();
  const options = useMemo(() => ({ angle, background, crop, points }), [angle, background, crop, points]);
  const size = useMemo(() => {
    if (!source) return {};
    try { return geometrySize(source.naturalWidth, source.naturalHeight, tool, options); }
    catch (cause) { return { error: cause.message }; }
  }, [source, tool, options]);

  useEffect(() => {
    let active = true;
    loadImage(item.url).then((image) => { if (active) setSource(image); }).catch(() => { if (active) setError('No se pudo abrir la imagen.'); });
    return () => { active = false; };
  }, [item.url]);
  useEffect(() => () => onBusy?.(false), [onBusy]);

  useEffect(() => {
    if (!source || !canvasRef.current) return;
    const scale = Math.min(1, 800 / Math.max(source.naturalWidth, source.naturalHeight));
    const preview = document.createElement('canvas');
    preview.width = Math.max(1, Math.round(source.naturalWidth * scale)); preview.height = Math.max(1, Math.round(source.naturalHeight * scale));
    preview.getContext('2d').drawImage(source, 0, 0, preview.width, preview.height);
    const canvas = canvasRef.current;
    const rendered = tool === 'deskew' ? renderGeometryCanvas(preview, tool, options) : preview;
    canvas.width = rendered.width; canvas.height = rendered.height;
    canvas.getContext('2d').drawImage(rendered, 0, 0);
    // Keep the output preview small; full-resolution perspective resampling runs in a worker.
    if (tool !== 'deskew' && resultRef.current && !size.error) {
      const ratio = Math.min(1, 320 / Math.max(preview.width, preview.height));
      const small = document.createElement('canvas'); small.width = Math.max(1, Math.round(preview.width * ratio)); small.height = Math.max(1, Math.round(preview.height * ratio));
      small.getContext('2d').drawImage(preview, 0, 0, small.width, small.height);
      try {
        const result = renderGeometryCanvas(small, tool, options);
        resultRef.current.width = result.width; resultRef.current.height = result.height;
        resultRef.current.getContext('2d').drawImage(result, 0, 0);
      } catch { resultRef.current.width = 1; resultRef.current.height = 1; }
    }
  }, [source, tool, options, size.error]);

  const position = (event) => {
    const box = canvasRef.current.getBoundingClientRect();
    return { x: clamp((event.clientX - box.left) / box.width), y: clamp((event.clientY - box.top) / box.height) };
  };
  const changeCorner = (index, point, initialCrop = crop) => {
    setError('');
    if (tool === 'perspective') setPoints((current) => current.map((entry, i) => i === index ? { x: clamp(point.x), y: clamp(point.y) } : entry));
    else {
      const opposite = cropPoints(initialCrop)[(index + 2) % 4];
      const left = index === 0 || index === 3;
      const top = index === 0 || index === 1;
      const x = left ? clamp(point.x, 0, opposite.x - 0.01) : clamp(point.x, opposite.x + 0.01, 1);
      const y = top ? clamp(point.y, 0, opposite.y - 0.01) : clamp(point.y, opposite.y + 0.01, 1);
      setCrop({ x: Math.min(x, opposite.x), y: Math.min(y, opposite.y), width: Math.abs(opposite.x - x), height: Math.abs(opposite.y - y) });
    }
  };
  const beginDrag = (event, handle) => {
    if (busy) return;
    event.preventDefault(); event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { handle, start: position(event), crop };
    if (typeof handle === 'number') setSelectedCorner(handle);
  };
  const moveDrag = (event) => {
    const drag = dragRef.current;
    if (!drag || busy) return;
    const point = position(event);
    if (drag.handle === 'move') setCrop({ ...drag.crop, x: clamp(drag.crop.x + point.x - drag.start.x, 0, 1 - drag.crop.width), y: clamp(drag.crop.y + point.y - drag.start.y, 0, 1 - drag.crop.height) });
    else if (drag.handle === 'new') {
      const width = Math.abs(point.x - drag.start.x); const height = Math.abs(point.y - drag.start.y);
      if (width >= 0.01 && height >= 0.01) setCrop({ x: Math.min(point.x, drag.start.x), y: Math.min(point.y, drag.start.y), width, height });
    } else changeCorner(drag.handle, point, drag.crop);
  };
  const keys = (event, index) => {
    const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (!directions[event.key] || busy) return;
    event.preventDefault(); event.stopPropagation();
    const step = event.shiftKey ? 0.02 : 0.005;
    const [dx, dy] = directions[event.key];
    if (index === 'move') setCrop({ ...crop, x: clamp(crop.x + dx * step, 0, 1 - crop.width), y: clamp(crop.y + dy * step, 0, 1 - crop.height) });
    else { const point = (tool === 'perspective' ? points : cropPoints(crop))[index]; changeCorner(index, { x: point.x + dx * step, y: point.y + dy * step }); }
  };
  const apply = async () => {
    if (!source || busy || size.error) return;
    setBusy(true); setError(''); onBusy?.(true);
    const signal = task.start();
    try { const blob = await applyGeometry(item, tool, options, signal); signal.throwIfAborted(); await onApply([{ item, blob }]); }
    catch (cause) { setError(cause.name === 'AbortError' ? 'Operación cancelada. El borrador sigue intacto.' : cause.message); }
    finally { setBusy(false); onBusy?.(false); }
  };
  const handles = tool === 'perspective' ? points : cropPoints(crop);
  return <>
    <section className="canvas-workspace geometry-workspace" aria-label={`Vista previa: ${titles[tool]}`}>
      <div className="workspace-meta"><span>{item.name}</span><span>{source ? `${source.naturalWidth} × ${source.naturalHeight} px` : 'Abriendo…'}</span></div>
      <div className="geometry-stage">
        <div className={`geometry-wrap ${tool === 'deskew' ? 'geometry-grid' : ''}`} onPointerDown={(event) => { if (tool === 'visualcrop' && event.target === canvasRef.current) beginDrag(event, 'new'); }} onPointerMove={moveDrag} onPointerUp={() => { dragRef.current = null; }} onPointerCancel={() => { dragRef.current = null; }}>
          <canvas ref={canvasRef} className="geometry-source" aria-label="Imagen para ajustar" />
          {source && tool !== 'deskew' && <>
            {tool === 'perspective' ? <svg className="geometry-outline" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polygon points={points.map((p) => `${p.x * 100},${p.y * 100}`).join(' ')} /></svg> : <>
              <div className="geometry-crop-frame" style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.width * 100}%`, height: `${crop.height * 100}%` }} />
              <button type="button" className="geometry-move" disabled={busy} style={{ left: `${(crop.x + crop.width / 2) * 100}%`, top: `${(crop.y + crop.height / 2) * 100}%` }} aria-label="Mover recorte" title="Arrastra para mover el recorte" onPointerDown={(event) => beginDrag(event, 'move')} onKeyDown={(event) => keys(event, 'move')}>↔</button>
            </>}
            {handles.map((point, index) => <button key={index} type="button" className={`geometry-handle ${selectedCorner === index ? 'selected' : ''}`} disabled={busy} style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }} aria-label={`Esquina ${labels[index].toLowerCase()}`} title={`${labels[index]}: arrastra o usa las flechas`} onFocus={() => setSelectedCorner(index)} onPointerDown={(event) => beginDrag(event, index)} onKeyDown={(event) => keys(event, index)}>{index + 1}</button>)}
          </>}
        </div>
      </div>
      <p className="geometry-instructions">{tool === 'deskew' ? 'Ajusta el ángulo usando las líneas de la cuadrícula.' : 'Arrastra las esquinas o usa las flechas del teclado. Mayús permite pasos mayores.'}</p>
    </section>
    <aside className="settings-panel geometry-controls" aria-busy={busy}>
      <h2>{titles[tool]}</h2>
      <p className="batch-hint">Se aplicará al borrador actual. Guarda la edición para actualizar la galería.</p>
      <fieldset disabled={busy || !source}>
        {tool === 'deskew' ? <>
          <label className="range-control"><span><strong>Ángulo</strong><output>{angle.toFixed(1)}°</output></span><input aria-label="Ángulo de enderezado" type="range" min="-15" max="15" step="0.1" value={angle} onChange={(event) => setAngle(Number(event.target.value))} /></label>
          <label className="text-field"><span>Ángulo exacto (°)</span><input type="number" min="-15" max="15" step="0.1" value={angle} onChange={(event) => { const value = Number(event.target.value); if (Number.isFinite(value)) setAngle(clamp(value, -15, 15)); }} /></label>
          <label className="select-field"><span>Fondo de las esquinas</span><select value={background} onChange={(event) => setBackground(event.target.value)}><option value="white">Blanco</option><option value="transparent">Transparente (PNG)</option></select></label>
        </> : tool === 'visualcrop' ? <div className="geometry-fields">
          {['x', 'y', 'width', 'height'].map((key, index) => <label className="text-field" key={key}><span>{['Izquierda (%)', 'Arriba (%)', 'Ancho (%)', 'Alto (%)'][index]}</span><input type="number" min="0" max="100" step="0.5" value={Number((crop[key] * 100).toFixed(2))} onChange={(event) => {
            const value = Number(event.target.value) / 100;
            setCrop((current) => ({ ...current, [key]: key === 'x' ? clamp(value, 0, 1 - current.width) : key === 'y' ? clamp(value, 0, 1 - current.height) : key === 'width' ? clamp(value, 0.01, 1 - current.x) : clamp(value, 0.01, 1 - current.y) }));
          }} /></label>)}
        </div> : <>
          <label className="select-field"><span id="geometry-corner-label">Esquina</span><select aria-labelledby="geometry-corner-label" value={selectedCorner} onChange={(event) => setSelectedCorner(Number(event.target.value))}>{labels.map((label, index) => <option value={index} key={label}>{label}</option>)}</select></label>
          <div className="geometry-fields">{['x', 'y'].map((axis) => <label className="text-field" key={axis}><span>{axis === 'x' ? 'Horizontal (%)' : 'Vertical (%)'}</span><input type="number" min="0" max="100" step="0.5" value={Number((points[selectedCorner][axis] * 100).toFixed(2))} onChange={(event) => changeCorner(selectedCorner, { ...points[selectedCorner], [axis]: Number(event.target.value) / 100 })} /></label>)}</div>
        </>}
        <button className="toolbar-button" type="button" onClick={() => { setCrop(defaultCrop()); setPoints(defaultCorners()); setAngle(0); setError(''); }}>Restablecer selección</button>
      </fieldset>
      {tool !== 'deskew' && <figure className="geometry-result"><canvas ref={resultRef} hidden={!!size.error} aria-label="Vista previa del resultado" /><figcaption>{size.error ? 'Selección no válida' : 'Resultado'}</figcaption></figure>}
      {size.width && !size.error && <p role="status">Resultado: {size.width} × {size.height} px</p>}
      {(error || size.error) && <p className="error-message" role="alert">{error || size.error}</p>}
      <div className="batch-footer"><button className="toolbar-button" type="button" onClick={busy ? task.cancel : onClose}>{busy ? 'Cancelar operación' : 'Cancelar ajuste'}</button><button className="primary-button" type="button" disabled={busy || !source || !!size.error} onClick={apply}>{busy ? 'Procesando…' : tool === 'deskew' ? 'Aplicar enderezado' : tool === 'visualcrop' ? 'Aplicar recorte' : 'Corregir perspectiva'}</button></div>
    </aside>
  </>;
}
