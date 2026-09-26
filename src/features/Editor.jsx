import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, FileImage, Redo2, RotateCcw, Undo2, Upload, X } from 'lucide-react';
import { initialSettings, clamp, loadImage, renderImage, saveFormatFor, SAVE_QUALITY } from './imageEngine';
import AnnotationsPanel from './AnnotationsPanel';
import { renderAnnotations } from './annotations';
import CompressionPanel from './CompressionPanel';
import RenamePanel from './RenamePanel';
import CanvasPanel from './CanvasPanel';
import WorkflowPanel from './WorkflowPanel';

const HISTORY_LIMIT = 30;
// Consecutive changes to the same control within this window collapse into one undo step.
const HISTORY_GROUP_MS = 800;

const settingsChanged = (value) => Object.keys(initialSettings).filter((key) => key !== 'format' && key !== 'quality').some((key) => !Object.is(value[key], initialSettings[key]));

export default function Editor({ items, setItems, setSelectedIds, activeIndex, setActiveIndex, onAddFiles, onBack, onSave, ToolPanel, tools, initialTool = 'adjust' }) {
  const item = items[activeIndex];
  const [draftItem, setDraftItem] = useState(null);
  const [draftBlob, setDraftBlob] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionItems, setActionItems] = useState([]);
  const ownedUrlsRef = useRef(new Set());
  const workingItem = draftItem || item;
  useEffect(() => () => {
    ownedUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);
  const [source, setSource] = useState(null);
  const [activeTool, setActiveTool] = useState(initialTool);
  const [settings, setSettings] = useState(initialSettings);
  const [outputSize, setOutputSize] = useState({ width: 1, height: 1 });
  const [aspectLocked, setAspectLocked] = useState(true);
  const [privacyAreas, setPrivacyAreas] = useState([]);
  const [annotations, setAnnotations] = useState([]);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState(null);
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const [estimatedSize, setEstimatedSize] = useState(0);
  const [drawing, setDrawing] = useState(null);
  const [selectedArea, setSelectedArea] = useState(0);
  const [exportStatus, setExportStatus] = useState('loading');
  const [loadError, setLoadError] = useState('');
  const [previewDimensions, setPreviewDimensions] = useState({ width: 0, height: 0 });
  const [saving, setSaving] = useState(false);
  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog.open) dialog.showModal();
    return () => { if (dialog.open) dialog.close(); };
  }, []);
  const canvasRef = useRef(null);
  const addInputRef = useRef(null);
  const customSizeRef = useRef(false);
  const lastHistoryRef = useRef({ group: null, time: 0 });

  useEffect(() => {
    let active = true;
    // Reset the preview while a new draft URL decodes; the canvas is an external resource this effect syncs to.
    /* eslint-disable react-hooks/set-state-in-effect */
    setLoadError('');
    setSource(null);
    setExportStatus('loading');
    /* eslint-enable react-hooks/set-state-in-effect */
    loadImage(workingItem.url)
      .then((loaded) => {
        if (!active) return;
        setSource(loaded);
        if (!customSizeRef.current) setOutputSize({ width: loaded.naturalWidth, height: loaded.naturalHeight });
        setExportStatus('ready');
      })
      .catch(() => {
        if (!active) return;
        setSource(null);
        setLoadError('No podemos leer esta imagen. Ciérrala y prueba con un archivo JPG, PNG o WebP válido.');
        setExportStatus('error');
      });
    return () => { active = false; };
  }, [workingItem.url]);

  useEffect(() => {
    // Draw into the canvas, then mirror its resulting size and a fresh status into React state.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (source) setExportStatus('ready');
    renderImage(source, canvasRef.current, settings, customSizeRef.current ? outputSize : { width: 0, height: 0 }, privacyAreas);
    if (canvasRef.current) renderAnnotations(canvasRef.current.getContext('2d'), annotations, canvasRef.current.width, canvasRef.current.height);
    if (source && canvasRef.current) setPreviewDimensions({ width: canvasRef.current.width, height: canvasRef.current.height });
    /* eslint-enable react-hooks/set-state-in-effect */
    const timer = window.setTimeout(() => {
      canvasRef.current?.toBlob((blob) => setEstimatedSize(blob?.size || 0), settings.format, settings.quality / 100);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [activeTool, source, settings, outputSize, privacyAreas, annotations]);

  const takeSnapshot = () => ({ settings, outputSize, privacyAreas, annotations, customSize: customSizeRef.current, draftItem, draftBlob });
  const recordHistory = (group = null) => {
    // Only called from event handlers, never during render.
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now();
    const last = lastHistoryRef.current;
    lastHistoryRef.current = { group, time: now };
    setFuture([]);
    if (group && last.group === group && now - last.time < HISTORY_GROUP_MS) return;
    setHistory((current) => [...current.slice(-(HISTORY_LIMIT - 1)), takeSnapshot()]);
  };
  const ownUrl = (blob) => {
    const url = URL.createObjectURL(blob);
    ownedUrlsRef.current.add(url);
    return url;
  };
  const hasPixelChanges = settingsChanged(settings) || annotations.length > 0 || privacyAreas.length > 0 || customSizeRef.current;

  const currentBlob = async () => {
    if (!hasPixelChanges) return draftBlob || await (await fetch(workingItem.url)).blob();
    const canvas = document.createElement('canvas');
    renderImage(source, canvas, settings, customSizeRef.current ? outputSize : { width: 0, height: 0 }, privacyAreas);
    renderAnnotations(canvas.getContext('2d'), annotations, canvas.width, canvas.height);
    // Keep JPEG/WebP photos lossy so a small edit does not turn them into much larger PNGs.
    const format = saveFormatFor(workingItem.type);
    return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('No se pudo preparar la imagen.')), format, SAVE_QUALITY));
  };

  const chooseTool = async (toolId) => {
    if (actionBusy || saving || !source) return;
    if (!['compress', 'rename', 'canvas', 'workflow'].includes(toolId)) { setActiveTool(toolId); return; }
    setActionBusy(true); setLoadError('');
    try {
      const blob = await currentBlob();
      setActionItems([{ ...workingItem, url: ownUrl(blob), size: blob.size, type: blob.type }]);
      setActiveTool(toolId);
    } catch (error) { setLoadError(error.message); }
    finally { setActionBusy(false); }
  };

  const setSetting = (key, value) => {
    recordHistory(`setting:${key}`);
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const applyIndividualResults = (results) => {
    const result = results?.[0];
    if (!result?.blob) return;
    recordHistory();
    const extension = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }[result.blob.type];
    const name = result.name || (extension ? workingItem.name.replace(/\.[^.]+$/, '') + extension : workingItem.name);
    setDraftItem({ ...workingItem, name, url: ownUrl(result.blob), type: result.blob.type, size: result.blob.size });
    setDraftBlob(result.blob);
    setSettings(initialSettings); setPrivacyAreas([]); setAnnotations([]);
    setSelectedAnnotationId(null); setSelectedArea(0); customSizeRef.current = false;
    setActionItems([]); setActiveTool('adjust');
  };

  const applyIndividualRename = (names) => {
    const next = names?.[0];
    if (!next) return;
    recordHistory();
    setDraftItem({ ...workingItem, name: next.name });
    setActionItems([]); setActiveTool('adjust');
  };

  const restoreDraftOriginal = () => {
    if (!item.originalUrl) return;
    recordHistory();
    setDraftItem({ ...item, name: item.originalName || item.file?.name || item.name, type: item.originalType || item.file?.type || item.type, size: item.originalSize ?? item.file?.size ?? item.size, url: item.originalUrl });
    setDraftBlob(null); setSettings(initialSettings); setPrivacyAreas([]); setAnnotations([]);
    customSizeRef.current = false; setActionItems([]); setActiveTool('adjust');
  };

  const restoreSnapshot = (snapshot) => {
    lastHistoryRef.current = { group: null, time: 0 };
    setDraftItem(snapshot.draftItem ?? null);
    setDraftBlob(snapshot.draftBlob ?? null);
    setSettings(snapshot.settings);
    setOutputSize(snapshot.outputSize);
    setPrivacyAreas(snapshot.privacyAreas);
    setAnnotations(snapshot.annotations || []);
    customSizeRef.current = snapshot.customSize ?? customSizeRef.current;
  };

  const undo = () => {
    if (!history.length) return;
    const previous = history[history.length - 1];
    setFuture((current) => [takeSnapshot(), ...current]);
    setHistory((current) => current.slice(0, -1));
    restoreSnapshot(previous);
  };

  const redo = () => {
    if (!future.length) return;
    const next = future[0];
    setHistory((current) => [...current, takeSnapshot()]);
    setFuture((current) => current.slice(1));
    restoreSnapshot(next);
  };

  const updateOutputSize = (nextSize) => {
    recordHistory('output-size');
    setDraftBlob(null);
    customSizeRef.current = true;
    setOutputSize(nextSize);
  };

  const createProcessedBlob = async (targetItem) => {
    const targetSource = await loadImage(targetItem.url);
    const targetCanvas = document.createElement('canvas');
    const targetSize = customSizeRef.current ? outputSize : { width: 0, height: 0 };
    renderImage(targetSource, targetCanvas, settings, targetSize, privacyAreas);
    renderAnnotations(targetCanvas.getContext('2d'), annotations, targetCanvas.width, targetCanvas.height);
    return new Promise((resolve, reject) => {
      targetCanvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Export failed')), settings.format, settings.quality / 100);
    });
  };

  const exportImage = async () => {
    if (!canvasRef.current || !source) {
      setExportStatus('error');
      return;
    }
    setExportStatus('processing');
    try {
      const extension = settings.format.split('/')[1].replace('jpeg', 'jpg');
      const blob = await createProcessedBlob(workingItem);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${workingItem.name.replace(/\.[^.]+$/, '')}-editada.${extension}`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      setExportStatus('success');
    } catch {
      setExportStatus('error');
    }
  };

  const pointerPosition = (event) => {
    const bounds = canvasRef.current.getBoundingClientRect();
    return {
      x: clamp((event.clientX - bounds.left) / bounds.width, 0, 1),
      y: clamp((event.clientY - bounds.top) / bounds.height, 0, 1),
    };
  };

  const beginPrivacyArea = (event) => {
    if (activeTool === 'annotate' && selectedAnnotationId) {
      const position = pointerPosition(event);
      updateAnnotations(annotations.map((annotation) => annotation.id === selectedAnnotationId ? { ...annotation, x: position.x, y: position.y } : annotation));
      return;
    }
    if (activeTool !== 'privacy') return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const start = pointerPosition(event);
    setDrawing({ start, end: start });
  };

  const updatePrivacyArea = (event) => {
    if (!drawing) return;
    setDrawing((current) => ({ ...current, end: pointerPosition(event) }));
  };

  const finishPrivacyArea = () => {
    if (!drawing) return;
    const area = {
      x: Math.min(drawing.start.x, drawing.end.x),
      y: Math.min(drawing.start.y, drawing.end.y),
      width: Math.abs(drawing.start.x - drawing.end.x),
      height: Math.abs(drawing.start.y - drawing.end.y),
    };
    if (area.width > 0.01 && area.height > 0.01) {
      recordHistory();
      setPrivacyAreas((current) => [...current, { ...area, mode: 'pixelate' }]);
      setSelectedArea(privacyAreas.length);
    }
    setDrawing(null);
  };

  const drawingStyle = drawing ? {
    left: `${Math.min(drawing.start.x, drawing.end.x) * 100}%`,
    top: `${Math.min(drawing.start.y, drawing.end.y) * 100}%`,
    width: `${Math.abs(drawing.start.x - drawing.end.x) * 100}%`,
    height: `${Math.abs(drawing.start.y - drawing.end.y) * 100}%`,
  } : null;

  const addPrivacyArea = () => {
    const area = { x: 0.35, y: 0.35, width: 0.3, height: 0.3, mode: 'pixelate' };
    recordHistory();
    setPrivacyAreas((current) => [...current, area]);
    setSelectedArea(privacyAreas.length);
  };

  const updateSelectedPrivacyArea = (key, value) => {
    recordHistory(`area:${selectedArea}:${key}`);
    setPrivacyAreas((current) => current.map((area, index) => {
      if (index !== selectedArea) return area;
      const next = { ...area, [key]: value };
      next.width = clamp(next.width, 0.05, 1 - next.x);
      next.height = clamp(next.height, 0.05, 1 - next.y);
      next.x = clamp(next.x, 0, 1 - next.width);
      next.y = clamp(next.y, 0, 1 - next.height);
      return next;
    }));
  };

  const deletePrivacyArea = () => {
    if (!privacyAreas.length) return;
    recordHistory();
    setPrivacyAreas((current) => current.filter((_, index) => index !== selectedArea));
    setSelectedArea((current) => Math.max(0, Math.min(current, privacyAreas.length - 2)));
  };

  const updateAnnotations = (next, group = null) => {
    recordHistory(group);
    setDraftBlob(null);
    setAnnotations(next);
  };

  const addAnnotation = (annotation) => { updateAnnotations([...annotations, annotation]); setSelectedAnnotationId(annotation.id); };
  const deleteAnnotation = (id) => {
    updateAnnotations(annotations.filter((annotation) => annotation.id !== id));
    if (selectedAnnotationId === id) setSelectedAnnotationId(null);
  };

  const removeItem = (index) => {
    const next = items.filter((_, itemIndex) => itemIndex !== index);
    if (!next.length) { setItems([]); setSelectedIds([]); onBack(); return; }
    setItems(next);
    setSelectedIds((current) => {
      const remainingSelection = current.filter((id) => id !== items[index].id);
      return remainingSelection.length ? remainingSelection : [next[0].id];
    });
    setActiveIndex(Math.min(activeIndex, next.length - 1));
  };

  const saveEdits = async (nextIndex) => {
    if (!source || saving || actionBusy) return;
    const leave = () => { if (typeof nextIndex === 'number') setActiveIndex(nextIndex); else onBack(); };
    // Untouched images keep their gallery entry: no copy and no empty undo step.
    if (!draftItem && !hasPixelChanges) { leave(); return; }
    setSaving(true);
    try {
      const blob = await currentBlob();
      onSave([{ item: workingItem, blob, name: workingItem.name }]);
      leave();
    } catch {
      setLoadError('No se pudo guardar la imagen. Prueba con un tamaño menor.');
      setSaving(false);
    }
  };

  return (
    <dialog ref={dialogRef} className="editor-shell individual-editor" aria-labelledby="individual-title" onCancel={(event) => { event.preventDefault(); if (!saving && !actionBusy) onBack(); }}>
      <header className="editor-header">
        <h2 id="individual-title" title={workingItem.name}>{workingItem.name}</h2>
        <div className="header-action-group editor-navigation" role="group" aria-label="Navegación entre imágenes">
          <button className="icon-button" onClick={() => saveEdits(activeIndex - 1)} disabled={activeIndex === 0 || saving || actionBusy || !source} aria-label="Imagen anterior" title="Guardar y pasar a la imagen anterior"><ChevronLeft /></button>
          <span>{activeIndex + 1}/{items.length}</span>
          <button className="icon-button" onClick={() => saveEdits(activeIndex + 1)} disabled={activeIndex === items.length - 1 || saving || actionBusy || !source} aria-label="Imagen siguiente" title="Guardar y pasar a la imagen siguiente"><ChevronRight /></button>
        </div>
        <div className="header-action-group editor-completion">
          <button className="icon-button" onClick={onBack} disabled={saving || actionBusy} aria-label="Cancelar edición" title="Cancelar edición"><X /></button>
          <button className="primary-button save-image-button" onClick={() => saveEdits()} disabled={saving || actionBusy || !source} aria-label="Guardar edición" title="Guardar edición"><Check /></button>
        </div>
      </header>

      <main className="editor-layout">
        <nav className="tool-rail" aria-label="Herramientas de edición">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return <button key={tool.id} title={tool.label} aria-label={tool.label} className={activeTool === tool.id ? 'active' : ''} disabled={actionBusy || saving || !source} onClick={() => chooseTool(tool.id)} aria-current={activeTool === tool.id ? 'page' : undefined}><Icon /></button>;
          })}
          <button onClick={undo} disabled={!history.length || saving || actionBusy} aria-label="Deshacer" title="Deshacer"><Undo2 /></button>
          <button onClick={redo} disabled={!future.length || saving || actionBusy} aria-label="Rehacer" title="Rehacer"><Redo2 /></button>
        </nav>

        <section className="canvas-workspace" aria-label="Vista previa de la imagen">
          <div className="workspace-meta">
            <span><FileImage size={16} /> {workingItem.name}</span>
            <span>{previewDimensions.width} × {previewDimensions.height} px</span>
          </div>
          <div className="process-trail" aria-label="Estado del proceso">
            <span><small>Origen</small><strong>Imagen abierta</strong></span>
            <i aria-hidden="true">→</i>
            <span><small>Transformación</small><strong>{tools.find((tool) => tool.id === activeTool)?.label}</strong></span>
            <i aria-hidden="true">→</i>
            <span className={`status-${exportStatus}`}><small>Resultado</small><strong>{exportStatus === 'loading' ? 'Abriendo…' : exportStatus === 'processing' ? 'Procesando…' : exportStatus === 'success' ? 'Descargado' : exportStatus === 'error' ? 'Revisar error' : 'Listo para descargar'}</strong></span>
          </div>
          <div className={`canvas-stage ${activeTool === 'privacy' ? 'privacy-active' : ''}`}>
            <div className="canvas-wrap" onPointerDown={beginPrivacyArea} onPointerMove={updatePrivacyArea} onPointerUp={finishPrivacyArea}>
              <canvas ref={canvasRef} tabIndex={activeTool === 'privacy' ? 0 : -1} aria-label={activeTool === 'privacy' ? 'Imagen editable. Usa el panel Ocultar para crear y ajustar zonas con el teclado.' : 'Imagen editable'} />
              {drawingStyle && <span className="drawing-area" style={drawingStyle} />}
            </div>
          </div>
          {loadError && <p className="workspace-error" role="alert">{loadError}</p>}
          <div className="file-strip" aria-label="Imágenes abiertas">
            {items.map((file, index) => <div key={file.id} className={index === activeIndex ? 'active' : ''}><button onClick={() => { if (index !== activeIndex) saveEdits(index); }} disabled={saving || actionBusy || !source} title={index === activeIndex ? file.name : `Guardar y abrir ${file.name}`}><img src={file.url} alt="" /><span>{file.name}</span></button><button className="remove-file" onClick={() => removeItem(index)} aria-label={`Cerrar ${file.name}`}><X /></button></div>)}
            <input ref={addInputRef} className="sr-only" type="file" accept="image/*" multiple onChange={(event) => onAddFiles(Array.from(event.target.files || []))} />
            <button className="add-file" onClick={() => addInputRef.current?.click()}><Upload size={18} /> Añadir</button>
          </div>
        </section>

        <aside className="settings-panel">
          <div key={activeTool} className="panel-content">
            {activeTool === 'annotate' ? <AnnotationsPanel annotations={annotations} selectedId={selectedAnnotationId} onSelect={setSelectedAnnotationId} onChange={updateAnnotations} onAdd={addAnnotation} onDelete={deleteAnnotation} /> : activeTool === 'compress' ? <CompressionPanel items={actionItems} onApply={applyIndividualResults} onClose={() => setActiveTool('adjust')} onBusy={setActionBusy} /> : activeTool === 'rename' ? <RenamePanel items={actionItems} allItems={items} onRename={applyIndividualRename} onClose={() => setActiveTool('adjust')} /> : activeTool === 'canvas' ? <CanvasPanel items={actionItems} onApply={applyIndividualResults} onClose={() => setActiveTool('adjust')} onBusy={setActionBusy} /> : activeTool === 'workflow' ? <WorkflowPanel allItems={items} items={actionItems} onApply={applyIndividualResults} onClose={() => setActiveTool('adjust')} onBusy={setActionBusy} /> : <ToolPanel {...{ activeTool, settings, setSetting, outputSize, setOutputSize: updateOutputSize, aspectLocked, setAspectLocked, source, privacyAreas, selectedArea, setSelectedArea, addPrivacyArea, updatePrivacyArea: updateSelectedPrivacyArea, deletePrivacyArea, estimatedSize }} />}
          </div>
          {activeTool === 'export' && <button className="primary-button" onClick={exportImage} disabled={!source || saving}>Descargar</button>}
          <button className="reset-button" disabled={!source || actionBusy || saving} onClick={() => { recordHistory(); setSettings(initialSettings); customSizeRef.current = false; setOutputSize({ width: source.naturalWidth, height: source.naturalHeight }); setPrivacyAreas([]); setAnnotations([]); setSelectedAnnotationId(null); setSelectedArea(0); }}><RotateCcw size={16} /> Restablecer ajustes</button>
          {item.originalUrl && <button className="reset-button" disabled={!source || actionBusy || saving} onClick={restoreDraftOriginal}><RotateCcw size={16} /> Restaurar original</button>}
        </aside>
      </main>
      <div className="export-feedback" role={exportStatus === 'error' ? 'alert' : 'status'} aria-live="polite">
        {exportStatus === 'success' && <><Check size={18} /> Imagen descargada. El original sigue intacto.</>}
        {exportStatus === 'error' && !loadError && <>No se pudo crear la descarga. Prueba otro formato o reduce el tamaño.</>}
      </div>
    </dialog>
  );
}
