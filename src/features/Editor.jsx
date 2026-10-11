import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Columns2, Redo2, RotateCcw, Undo2, X, ZoomIn, ZoomOut } from 'lucide-react';
import { initialSettings, clamp, formatBytes, loadImage, renderImage, saveFormatFor, settingsFor, SAVE_QUALITY } from './imageEngine';
import GeometryEditor from './GeometryEditor';
import AnnotationsPanel from './AnnotationsPanel';
import { renderAnnotations } from './annotations';
import CompressionPanel from './CompressionPanel';
import RenamePanel from './RenamePanel';
import CanvasPanel from './CanvasPanel';
import WorkflowPanel from './WorkflowPanel';
import BackgroundPanel from './BackgroundPanel';
import TrimPanel from './TrimPanel';
import { validateDimensions } from './imageLimits';
import { flattenForFormat } from './background';
import ToolPanel from './ToolPanel';
import { toolGroups, tools } from './tools';
import { isTextEntry, shortcutFor } from './shortcuts';
import { detectFaces } from './ai/onDevice';
import { recognizeLines } from './ai/ocr';
import { t, tn } from '../i18n/index.js';

const HISTORY_LIMIT = 30;
const HISTORY_BYTES = 128 * 1024 * 1024;
// Tools that work on the current draft as a file and hand back a new one.
const GEOMETRY_TOOLS = ['deskew', 'visualcrop', 'perspective'];
const PANEL_TOOLS = [...GEOMETRY_TOOLS, 'compress', 'rename', 'canvas', 'workflow', 'background', 'trim'];
// Consecutive changes to the same control within this window collapse into one undo step.
const HISTORY_GROUP_MS = 800;
// Preview zoom steps; 'fit' shows the whole image in the stage.
const ZOOM_STEPS = [0.25, 0.5, 1, 2, 4];
// Panels that stage the current draft as a file (actionItems) and hand back a result.
const ACTION_PANELS = { compress: CompressionPanel, canvas: CanvasPanel, background: BackgroundPanel, trim: TrimPanel, workflow: WorkflowPanel };

const settingsChanged = (value) => Object.keys(initialSettings).filter((key) => key !== 'format' && key !== 'quality').some((key) => !Object.is(value[key], initialSettings[key]));

export default function Editor({ items, activeIndex, setActiveIndex, onBack, onSave, initialTool = 'adjust' }) {
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
  const [settings, setSettings] = useState(() => settingsFor(item.type));
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
  const [zoom, setZoom] = useState('fit');
  const [showOriginal, setShowOriginal] = useState(false);
  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog.open) dialog.showModal();
    return () => { if (dialog.open) dialog.close(); };
  }, []);
  const canvasRef = useRef(null);
  const customSizeRef = useRef(false);
  const lastHistoryRef = useRef({ group: null, time: 0 });

  useEffect(() => {
    const retained = new Set([draftItem?.url, ...actionItems.map((entry) => entry.url),
      ...history.map((snapshot) => snapshot.draftItem?.url), ...future.map((snapshot) => snapshot.draftItem?.url)]);
    ownedUrlsRef.current.forEach((url) => {
      if (!retained.has(url)) { URL.revokeObjectURL(url); ownedUrlsRef.current.delete(url); }
    });
  }, [draftItem, actionItems, history, future]);

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
        setLoadError(t('No podemos leer esta imagen. Ciérrala y prueba con un archivo JPG, PNG o WebP válido.'));
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
      if (canvasRef.current) flattenForFormat(canvasRef.current, settings.format).toBlob((blob) => setEstimatedSize(blob?.size || 0), settings.format, settings.quality / 100);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [activeTool, source, settings, outputSize, privacyAreas, annotations]);

  const takeSnapshot = () => ({ settings, outputSize, privacyAreas, annotations, customSize: customSizeRef.current, draftItem, draftBlob });
  const recordHistory = (group = null, nextDraft = draftItem) => {
    // Only called from event handlers, never during render.
    const now = Date.now();
    const last = lastHistoryRef.current;
    lastHistoryRef.current = { group, time: now };
    setFuture([]);
    if (group && last.group === group && now - last.time < HISTORY_GROUP_MS) return;
    setHistory((current) => {
      const snapshots = [...current.slice(-(HISTORY_LIMIT - 1)), takeSnapshot()];
      const bytes = () => {
        const sizes = new Map();
        for (const entry of [nextDraft, ...snapshots.map((snapshot) => snapshot.draftItem)]) {
          if (entry && ownedUrlsRef.current.has(entry.url)) sizes.set(entry.url, entry.size || 0);
        }
        return [...sizes.values()].reduce((sum, size) => sum + size, 0);
      };
      while (snapshots.length && bytes() > HISTORY_BYTES) snapshots.shift();
      return snapshots;
    });
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
    if (!PANEL_TOOLS.includes(toolId)) { setActiveTool(toolId); return; }
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
    const extension = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }[result.blob.type];
    const name = result.name || (extension ? workingItem.name.replace(/\.[^.]+$/, '') + extension : workingItem.name);
    const nextDraft = { ...workingItem, name, url: ownUrl(result.blob), type: result.blob.type, size: result.blob.size };
    recordHistory(null, nextDraft);
    setDraftItem(nextDraft);
    setDraftBlob(result.blob);
    setSettings(settingsFor(result.blob.type)); setPrivacyAreas([]); setAnnotations([]);
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
    setDraftBlob(null); setSettings(settingsFor(item.originalType || item.file?.type || item.type)); setPrivacyAreas([]); setAnnotations([]);
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
    if (GEOMETRY_TOOLS.includes(activeTool)) { setActiveTool('adjust'); setActionItems([]); }
    if (!history.length) return;
    const previous = history[history.length - 1];
    setFuture((current) => [takeSnapshot(), ...current]);
    setHistory((current) => current.slice(0, -1));
    restoreSnapshot(previous);
  };

  const redo = () => {
    if (GEOMETRY_TOOLS.includes(activeTool)) { setActiveTool('adjust'); setActionItems([]); }
    if (!future.length) return;
    const next = future[0];
    setHistory((current) => [...current, takeSnapshot()]);
    setFuture((current) => current.slice(1));
    restoreSnapshot(next);
  };

  const updateOutputSize = (nextSize) => {
    try { validateDimensions(nextSize.width, nextSize.height); } catch (cause) { setLoadError(cause.message); return; }
    setLoadError('');
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
      flattenForFormat(targetCanvas, settings.format).toBlob((blob) => blob ? resolve(blob) : reject(new Error('Export failed')), settings.format, settings.quality / 100);
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

  // Automatic privacy suggestions: faces become pixelated zones, chosen text lines solid fills.
  const [detection, setDetection] = useState({ status: 'idle', message: '', lines: [] });
  const detectionAbortRef = useRef(null);
  const detectionRevision = JSON.stringify([workingItem.url, settings, outputSize]);
  const detectionRevisionRef = useRef(detectionRevision);
  // Invalidate in a layout effect before input or worker callbacks can use the new draft.
  useLayoutEffect(() => {
    if (detectionRevisionRef.current === detectionRevision) return;
    detectionRevisionRef.current = detectionRevision;
    detectionAbortRef.current?.abort();
    detectionAbortRef.current = null;
    // React state mirrors invalidation of the external worker and its review results.
    setDetection({ status: 'idle', message: '', lines: [] });
  }, [detectionRevision]);
  useEffect(() => () => detectionAbortRef.current?.abort(), []);
  const detectionCanvas = () => {
    // Same geometry as the preview, without existing zones so already hidden content is still found.
    const canvas = document.createElement('canvas');
    renderImage(source, canvas, settings, customSizeRef.current ? outputSize : { width: 0, height: 0 }, []);
    return canvas;
  };
  const startDetection = (message) => {
    detectionAbortRef.current?.abort();
    const controller = new AbortController();
    detectionAbortRef.current = controller;
    setDetection({ status: 'running', message, lines: [] });
    controller.revision = detectionRevisionRef.current;
    return controller;
  };
  const detectionFailed = (cause) => setDetection({ status: 'idle', lines: [], message: cause?.name === 'AbortError' ? t('Detección cancelada.') : t('No se pudo completar la detección: {v0}.', { v0: cause?.message || 'error desconocido' }) });
  const addDetectedAreas = (boxes, mode) => {
    recordHistory();
    setDraftBlob(null);
    setPrivacyAreas((current) => [...current, ...boxes.map((box) => ({ ...box, mode }))]);
    setSelectedArea(privacyAreas.length);
  };
  const detectionActions = {
    ...detection,
    detectFaces: async () => {
      if (!source) return;
      const request = startDetection(t('Buscando caras… (la primera vez se descarga el modelo)'));
      const { signal } = request;
      try {
        const boxes = await detectFaces(detectionCanvas(), { signal });
        if (signal.aborted || request !== detectionAbortRef.current || request.revision !== detectionRevisionRef.current) return;
        if (boxes.length) addDetectedAreas(boxes, 'pixelate');
        setDetection({ status: 'idle', lines: [], message: boxes.length ? tn(boxes.length, '{n} cara ocultada. Revisa la imagen: puede haber caras de perfil, pequeñas o tapadas que no se detecten.', '{n} caras ocultadas. Revisa la imagen: puede haber caras de perfil, pequeñas o tapadas que no se detecten.') : t('No se encontraron caras. Puedes dibujar las zonas a mano.') });
      } catch (cause) { if (request === detectionAbortRef.current && !signal.aborted) detectionFailed(cause); }
    },
    detectText: async () => {
      if (!source) return;
      const request = startDetection(t('Leyendo el texto… (la primera vez se descargan los idiomas)'));
      const { signal } = request;
      try {
        const lines = await recognizeLines(detectionCanvas(), { signal, locale: document.documentElement.lang || 'es',
          onProgress: ({ status, progress }) => { if (request === detectionAbortRef.current && !signal.aborted && status === 'recognizing text') setDetection((current) => (current.status === 'running' ? { ...current, message: t('Leyendo el texto… {v0}%', { v0: Math.round(progress * 100) }) } : current)); } });
        if (signal.aborted || request !== detectionAbortRef.current || request.revision !== detectionRevisionRef.current) return;
        setDetection(lines.length
          ? { status: 'review', message: '', lines: lines.map((line) => ({ ...line, checked: line.sensitive })) }
          : { status: 'idle', lines: [], message: t('No se encontró texto legible.') });
      } catch (cause) { if (request === detectionAbortRef.current && !signal.aborted) detectionFailed(cause); }
    },
    cancel: () => { detectionAbortRef.current?.abort(); detectionAbortRef.current = null; setDetection({ status: 'idle', message: '', lines: [] }); },
    toggleLine: (index) => setDetection((current) => ({ ...current, lines: current.lines.map((line, lineIndex) => (lineIndex === index ? { ...line, checked: !line.checked } : line)) })),
    setAllLines: (checked) => setDetection((current) => ({ ...current, lines: current.lines.map((line) => ({ ...line, checked })) })),
    coverLines: () => {
      const chosen = detection.lines.filter((line) => line.checked);
      if (chosen.length) addDetectedAreas(chosen.map((line) => line.box), 'fill');
      setDetection({ status: 'idle', lines: [], message: chosen.length ? tn(chosen.length, '{n} línea tapada.', '{n} líneas tapadas.') : '' });
    },
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

  const saveEdits = async (nextIndex) => {
    if (!source || saving || actionBusy) return;
    const leave = () => { if (typeof nextIndex === 'number') setActiveIndex(nextIndex); else onBack(); };
    // Untouched images keep their gallery entry: no copy and no empty undo step.
    if (!draftItem && !hasPixelChanges) { leave(); return; }
    setSaving(true);
    try {
      const blob = await currentBlob();
      await onSave([{ item: workingItem, blob, name: workingItem.name }]);
      leave();
    } catch {
      setLoadError(t('No se pudo guardar la imagen. Prueba con un tamaño menor.'));
      setSaving(false);
    }
  };

  const geometryActive = GEOMETRY_TOOLS.includes(activeTool) && actionItems.length > 0;
  const closePanel = () => setActiveTool('adjust');
  const ActionPanel = ACTION_PANELS[activeTool];
  const settingsPanel = activeTool === 'annotate'
    ? <AnnotationsPanel annotations={annotations} selectedId={selectedAnnotationId} onSelect={setSelectedAnnotationId} onChange={updateAnnotations} onAdd={addAnnotation} onDelete={deleteAnnotation} />
    : activeTool === 'rename'
      ? <RenamePanel items={actionItems} allItems={items} onRename={applyIndividualRename} onClose={closePanel} />
      : ActionPanel
        ? <ActionPanel items={actionItems} allItems={items} onApply={applyIndividualResults} onClose={closePanel} onBusy={setActionBusy} />
        : <ToolPanel onVisualCrop={() => chooseTool('visualcrop')} {...{ activeTool, settings, setSetting, outputSize, setOutputSize: updateOutputSize, aspectLocked, setAspectLocked, source, privacyAreas, selectedArea, setSelectedArea, addPrivacyArea, updatePrivacyArea: updateSelectedPrivacyArea, deletePrivacyArea, estimatedSize, detection: detectionActions }} />;
  const zoomBy = (direction) => setZoom((current) => {
    if (current === 'fit') return direction > 0 ? 1 : 0.5;
    return ZOOM_STEPS[ZOOM_STEPS.indexOf(current) + direction] ?? current;
  });
  const zoomed = zoom !== 'fit' && previewDimensions.width > 0;
  const canvasStyle = zoomed ? { width: `${previewDimensions.width * zoom}px` } : undefined;
  const formatName = (workingItem.type || '').split('/')[1]?.replace('jpeg', 'jpg').replace('svg+xml', 'svg').toUpperCase();
  const handleKeyDown = (event) => {
    if (event.defaultPrevented || isTextEntry(event.target)) return;
    const blocked = saving || actionBusy || !source;
    const canMove = !blocked && !geometryActive;
    const command = shortcutFor(event);
    // Sliders use PageUp/PageDown for large steps.
    if ((command === 'previous' || command === 'next') && event.target.type === 'range') return;
    const run = {
      undo: () => !blocked && history.length > 0 && undo(),
      redo: () => !blocked && future.length > 0 && redo(),
      save: () => canMove && saveEdits(),
      previous: () => canMove && activeIndex > 0 && saveEdits(activeIndex - 1),
      next: () => canMove && activeIndex < items.length - 1 && saveEdits(activeIndex + 1),
    }[command];
    if (!run) return;
    event.preventDefault();
    run();
  };  // Listen on the window: focus can fall back to <body> when the focused control disappears.
  const keyHandlerRef = useRef(handleKeyDown);
  useEffect(() => { keyHandlerRef.current = handleKeyDown; });
  useEffect(() => {
    const listener = (event) => keyHandlerRef.current(event);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  return (
    <dialog ref={dialogRef} className="editor-shell individual-editor" aria-labelledby="individual-title" onCancel={(event) => { event.preventDefault(); if (!saving && !actionBusy) onBack(); }}>
      <header className="editor-header">
        <div className="editor-title">
          <h2 id="individual-title" title={workingItem.name}>{workingItem.name}</h2>
          <small>{previewDimensions.width} × {previewDimensions.height} {t('px')}{formatName ? ` · ${formatName}` : ''} · {formatBytes(workingItem.size)}</small>
        </div>
        <div className="header-action-group editor-navigation" role="group" aria-label={t('Navegación entre imágenes')}>
          <button className="icon-button" onClick={() => saveEdits(activeIndex - 1)} disabled={activeIndex === 0 || saving || actionBusy || geometryActive || !source} aria-label={t('Imagen anterior')} title={t('Guardar y pasar a la imagen anterior (RePág)')}><ChevronLeft /></button>
          <span>{t('{current} de {total}', { current: activeIndex + 1, total: items.length })}</span>
          <button className="icon-button" onClick={() => saveEdits(activeIndex + 1)} disabled={activeIndex === items.length - 1 || saving || actionBusy || geometryActive || !source} aria-label={t('Imagen siguiente')} title={t('Guardar y pasar a la imagen siguiente (AvPág)')}><ChevronRight /></button>
        </div>
        <div className="editor-completion">
          <button className="icon-button ghost-button" onClick={undo} disabled={!history.length || saving || actionBusy} aria-label={t('Deshacer')} title={t('Deshacer (Ctrl+Z)')}><Undo2 aria-hidden="true" /></button>
          <button className="icon-button ghost-button" onClick={redo} disabled={!future.length || saving || actionBusy} aria-label={t('Rehacer')} title={t('Rehacer (Ctrl+Y)')}><Redo2 aria-hidden="true" /></button>
          <button className="toolbar-button" onClick={onBack} disabled={saving || actionBusy} title={t('Cancelar edición (Esc)')}><X aria-hidden="true" /><span className="button-label">{t('Descartar')}</span></button>
          <button className="primary-button save-image-button" onClick={() => saveEdits()} disabled={saving || actionBusy || geometryActive || !source} title={geometryActive ? t('Aplica o cancela el ajuste antes de guardar') : t('Guardar edición (Ctrl+S)')}><Check aria-hidden="true" /><span className="button-label">{t('Guardar cambios')}</span></button>
        </div>
      </header>

      <main className="editor-layout">
        <nav className="tool-rail" aria-label={t('Herramientas de edición')}>
          {toolGroups.map((group) => <div key={group.id} className="tool-rail-group" role="group" aria-label={group.label}>
            <span className="tool-rail-heading" aria-hidden="true">{group.label}</span>
            {tools.filter((tool) => tool.group === group.id && !tool.hidden).map((tool) => {
              const Icon = tool.icon;
              const active = activeTool === tool.id || (tool.id === 'crop' && activeTool === 'visualcrop');
              return <button key={tool.id} title={`${tool.label}: ${tool.description}`} aria-label={tool.label} className={active ? 'active' : ''} disabled={actionBusy || saving || !source} onClick={() => chooseTool(tool.id)} aria-current={active ? 'page' : undefined}><Icon aria-hidden="true" /><span aria-hidden="true">{tool.short}</span></button>;
            })}
          </div>)}
        </nav>

        {geometryActive ? <GeometryEditor key={activeTool} item={actionItems[0]} tool={activeTool} onApply={applyIndividualResults} onClose={() => { setActionItems([]); setActiveTool('adjust'); }} onBusy={setActionBusy} /> : <>
        <section className="canvas-workspace" aria-label={t('Vista previa de la imagen')}>
          <div className={`canvas-stage ${activeTool === 'privacy' ? 'privacy-active' : ''} ${zoomed ? 'is-zoomed' : ''}`}>
            <div className="canvas-wrap" onPointerDown={beginPrivacyArea} onPointerMove={updatePrivacyArea} onPointerUp={finishPrivacyArea}>
              <canvas ref={canvasRef} style={canvasStyle} tabIndex={activeTool === 'privacy' ? 0 : -1} aria-label={activeTool === 'privacy' ? t('Imagen editable. Usa el panel Ocultar para crear y ajustar zonas con el teclado.') : t('Imagen editable')} />
              {drawingStyle && <span className="drawing-area" style={drawingStyle} />}
              {showOriginal && <img className="canvas-original" src={item.url} alt={t('Imagen antes de los cambios')} />}
            </div>
          </div>
          {loadError && <p className="workspace-error" role="alert">{loadError}</p>}
          <div className="canvas-bar" role="group" aria-label={t('Vista')}>
            <button type="button" onClick={() => zoomBy(-1)} disabled={!source || zoom === ZOOM_STEPS[0]} aria-label={t('Alejar')} title={t('Alejar')}><ZoomOut aria-hidden="true" /></button>
            <button type="button" className="canvas-bar-zoom" onClick={() => setZoom('fit')} disabled={!source} title={t('Ajustar a la ventana')}>{zoom === 'fit' ? t('Ajustar') : `${Math.round(zoom * 100)} %`}</button>
            <button type="button" onClick={() => zoomBy(1)} disabled={!source || zoom === ZOOM_STEPS[ZOOM_STEPS.length - 1]} aria-label={t('Acercar')} title={t('Acercar')}><ZoomIn aria-hidden="true" /></button>
            <span className="canvas-bar-divider" aria-hidden="true" />
            <button type="button" className="canvas-bar-compare" aria-pressed={showOriginal} onClick={() => setShowOriginal((value) => !value)} disabled={!source}><Columns2 aria-hidden="true" /><span className="canvas-bar-label">{t('Antes / después')}</span></button>
          </div>
        </section>

        <aside className="settings-panel">
          <div key={activeTool} className="panel-content">
            {settingsPanel}
          </div>
          {activeTool === 'export' && <button className="primary-button" onClick={exportImage} disabled={!source || saving}>{t('Descargar')}</button>}
          <div className="settings-footer">
            <button className="reset-button" disabled={!source || actionBusy || saving} onClick={() => { recordHistory(); setSettings((current) => ({ ...initialSettings, format: current.format, quality: current.quality })); customSizeRef.current = false; setOutputSize({ width: source.naturalWidth, height: source.naturalHeight }); setPrivacyAreas([]); setAnnotations([]); setSelectedAnnotationId(null); setSelectedArea(0); }} title={t('Quita los ajustes, zonas y anotaciones de esta edición')}><RotateCcw aria-hidden="true" />{t('Restablecer')}</button>
            {history.length > 0 && <span className="settings-footer-note">{tn(history.length, '{n} cambio sin guardar', '{n} cambios sin guardar')}</span>}
            {item.originalUrl && item.url !== item.originalUrl && <button className="link-button" disabled={!source || actionBusy || saving} onClick={restoreDraftOriginal}>{t('Volver al original')}</button>}
          </div>
        </aside>
        </>}
      </main>
      <div className="export-feedback" role={exportStatus === 'error' ? 'alert' : 'status'} aria-live="polite">
        {exportStatus === 'success' && <><Check size={18} />{' '}{t('Imagen descargada. El original sigue intacto.')}</>}
        {exportStatus === 'error' && !loadError && <>{t('No se pudo crear la descarga. Prueba otro formato o reduce el tamaño.')}</>}
      </div>
    </dialog>
  );
}
