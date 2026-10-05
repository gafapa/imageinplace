import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Editor from './features/Editor';
import useImageHistory from './features/useImageHistory';
import CompressionPanel from './features/CompressionPanel';
import RenamePanel from './features/RenamePanel';
import CanvasPanel from './features/CanvasPanel';
import PrintSheetPanel from './features/PrintSheetPanel';
import WorkflowPanel from './features/WorkflowPanel';
import CompareDialog from './features/CompareDialog';
import BackgroundPanel from './features/BackgroundPanel';
import TrimPanel from './features/TrimPanel';
import { flattenForFormat } from './features/background';
import { initialSettings, formatBytes, loadImage, getCrop, renderImage, saveFormatFor, nameForType, SAVE_QUALITY } from './features/imageEngine';
import {
  ArrowDownToLine,
  BadgeCheck,
  BookOpen,
  CheckSquare2,
  ChevronDown,
  Crop,
  Eraser,
  FlipHorizontal2,
  Gauge,
  Image as ImageIcon,
  Lock,
  Maximize2,
  Pencil,
  Plus,
  Redo2,
  RotateCcw,
  RotateCw,
  Scan,
  ScanFace,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Stamp,
  Trash2,
  Undo2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

const MAX_FILE_SIZE = 40 * 1024 * 1024;
const WELCOME_KEY = 'imageinplace-welcome-dismissed';
const UNSUPPORTED_TYPES = new Set(['image/heic', 'image/heif', 'image/tiff']);

// Storage can throw in private windows or when site data is blocked.
const readWelcomeDismissed = () => { try { return localStorage.getItem(WELCOME_KEY) === 'true'; } catch { return false; } };
const writeWelcomeDismissed = () => { try { localStorage.setItem(WELCOME_KEY, 'true'); } catch { /* preference is optional */ } };

const tools = [
  { id: 'adjust', label: 'Mejorar', description: 'Luz, color y nitidez', icon: SlidersHorizontal },
  { id: 'resize', label: 'Tamaño', description: 'Medidas exactas', icon: Maximize2 },
  { id: 'crop', label: 'Recortar', description: 'Encuadre y proporción', icon: Crop },
  { id: 'trim', label: 'Recortar al contenido', description: 'Quita bordes vacíos', icon: Scan },
  { id: 'background', label: 'Quitar fondo', description: 'Fondo transparente', icon: Eraser },
  { id: 'rotate', label: 'Girar', description: 'Gira o refleja', icon: RotateCw },
  { id: 'privacy', label: 'Ocultar', description: 'Protege datos y caras', icon: ScanFace },
  { id: 'watermark', label: 'Marca', description: 'Añade autoría', icon: Stamp },
  { id: 'annotate', label: 'Anotar', description: 'Texto, flechas y figuras', icon: Pencil },
  { id: 'compress', label: 'Comprimir', description: 'Peso objetivo', icon: Gauge },
  { id: 'rename', label: 'Renombrar', description: 'Nombre del archivo', icon: Pencil },
  { id: 'canvas', label: 'Lienzo', description: 'Márgenes y fondo', icon: ImageIcon },
  { id: 'workflow', label: 'Flujo', description: 'Acciones guardadas', icon: Sparkles },
  { id: 'export', label: 'Exportar', description: 'Formato y peso', icon: ArrowDownToLine },
];


function BrandMark() {
  return (
    <div className="brand-mark" aria-label="Image in Place">
      <span className="brand-icon"><ImageIcon aria-hidden="true" /></span>
      <span className="brand-copy"><strong>Image in Place</strong><small>Tus imágenes, en tu dispositivo</small></span>
    </div>
  );
}

function UploadZone({ onFiles, compact = false }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length) onFiles(files);
  };

  return (
    <div
      className={`upload-zone ${dragging ? 'is-dragging' : ''} ${compact ? 'is-compact' : ''}`}
      onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }}
      onDrop={(event) => { event.preventDefault(); event.stopPropagation(); setDragging(false); handleFiles(event.dataTransfer.files); }}
    >
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept="image/*"
        multiple
        onChange={(event) => handleFiles(event.target.files)}
      />
      <div className="upload-icon" aria-hidden="true"><Upload size={25} /></div>
      <div>
        <p className="upload-title">Arrastra y suelta imágenes aquí</p>
        <p className="upload-copy">O pégalas desde el portapapeles</p>
      </div>
      <button className="primary-button" onClick={() => inputRef.current?.click()}>
        Elegir imágenes
      </button>
      {!compact && <p className="format-note">JPG, PNG, WebP, GIF o SVG · hasta 40 MB</p>}
    </div>
  );
}

function Home({ onFiles, error, onUndo, canUndo, onRedo, canRedo }) {
  return (
    <div className="home-shell">
      <header className="site-header">
        <BrandMark />
        <div className="home-actions">
          <button className="toolbar-button" disabled={!canUndo} onClick={onUndo} aria-label="Deshacer global"><Undo2 /></button>
          <button className="toolbar-button" disabled={!canRedo} onClick={onRedo} aria-label="Rehacer global"><Redo2 /></button>
          <span className="privacy-label"><ShieldCheck size={17} aria-hidden="true" /> Procesado local</span>
          <button className="toolbar-button" onClick={() => document.querySelector('.upload-zone button')?.click()}><Upload aria-hidden="true" /> Añadir imágenes</button>
        </div>
      </header>
      <main className="empty-workspace">
        <section className="workspace-dropzone" aria-labelledby="workspace-title">
          <UploadZone onFiles={onFiles} />
          <h1 id="workspace-title" className="sr-only">Añadir imágenes</h1>
          {error && <p className="error-message" role="alert">{error}</p>}
        </section>
      </main>
    </div>
  );
}

function WelcomeDialog({ onClose }) {
  const dialogRef = useRef(null);
  const [doNotShowAgain, setDoNotShowAgain] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog?.open) dialog?.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);

  const dismiss = () => {
    if (doNotShowAgain) writeWelcomeDismissed();
    onClose();
  };

  const features = [
    { icon: SlidersHorizontal, text: 'Mejora color, luz y nitidez sin complicaciones' },
    { icon: Crop, text: 'Recorta, redimensiona, gira y convierte formatos' },
    { icon: ScanFace, text: 'Oculta caras, nombres y datos antes de compartir' },
    { icon: ShieldCheck, text: 'Privado por diseño: todo se procesa localmente' },
    { icon: BookOpen, text: 'Prepara imágenes para fichas, Moodle y presentaciones' },
  ];

  return (
    <dialog ref={dialogRef} className="welcome-dialog" onCancel={dismiss}>
      <div className="welcome-heading"><span className="brand-icon"><ImageIcon /></span><h2>Bienvenido a Image in Place</h2></div>
      <p>Edita, adapta y protege imágenes directamente en tu navegador. Tus archivos nunca salen de tu equipo.</p>
      <div className="welcome-features">
        {features.map(({ icon: Icon, text }) => <div key={text}><Icon aria-hidden="true" /><strong>{text}</strong></div>)}
      </div>
      <label className="welcome-preference"><input type="checkbox" checked={doNotShowAgain} onChange={(event) => setDoNotShowAgain(event.target.checked)} /> <span>No mostrar esta página la próxima vez</span></label>
      <div className="welcome-actions"><button className="primary-button" onClick={dismiss}>Empezar</button></div>
    </dialog>
  );
}

const METADATA_VALUE_LIMIT = 160;
function formatMetadataValue(value) {
  if (value instanceof Date) return value.toLocaleString('es-ES');
  if (ArrayBuffer.isView(value)) return `Datos binarios (${value.byteLength.toLocaleString('es-ES')} bytes)`;
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return text.length > METADATA_VALUE_LIMIT ? `${text.slice(0, METADATA_VALUE_LIMIT)}…` : text;
}

function ImageMetadata({ item, selectionCount }) {
  // Async results remember which item they describe, so a new selection shows "Leyendo…" until its own data arrives.
  const [embeddedState, setEmbeddedState] = useState({ file: null, data: null });
  const [dimensionsState, setDimensionsState] = useState({ url: null, data: null });
  const file = item?.file ?? null;
  const url = item?.url ?? null;
  const embedded = !file ? {} : embeddedState.file === file ? embeddedState.data : null;
  const dimensions = dimensionsState.url === url ? dimensionsState.data : null;

  useEffect(() => {
    if (!file) return undefined;
    let active = true;
    import('exifr').then(({ default: exifr }) => exifr.parse(file, true))
      .then((data) => { if (active) setEmbeddedState({ file, data: data || {} }); })
      .catch(() => { if (active) setEmbeddedState({ file, data: {} }); });
    return () => { active = false; };
  }, [file]);

  useEffect(() => {
    if (!url) return undefined;
    let active = true;
    loadImage(url)
      .then((image) => { if (active) setDimensionsState({ url, data: { width: image.naturalWidth, height: image.naturalHeight } }); })
      .catch(() => { if (active) setDimensionsState({ url, data: null }); });
    return () => { active = false; };
  }, [url]);

  const hasGps = Boolean(embedded && (Number.isFinite(embedded.latitude) || embedded.GPSLatitude != null));
  if (!item) return <div className="batch-panel-empty">Selecciona una imagen para ver sus datos.</div>;
  const formatLabels = { 'image/jpeg': 'JPG', 'image/png': 'PNG', 'image/webp': 'WEBP', 'image/gif': 'GIF', 'image/svg+xml': 'SVG' };
  const extension = formatLabels[item.type] || (item.name.includes('.') ? item.name.split('.').pop().toUpperCase() : 'IMAGEN');
  return <div className="metadata-panel">
    <div className="panel-kicker">Información</div>
    <h2>{item.name}</h2>
    <dl>
      <div><dt>Dimensiones</dt><dd>{dimensions ? `${dimensions.width} × ${dimensions.height} px` : 'Leyendo…'}</dd></div>
      <div><dt>Tamaño</dt><dd>{formatBytes(item.size)}</dd></div>
      <div><dt>Formato</dt><dd>{extension}</dd></div>
      <div><dt>Tipo MIME</dt><dd>{item.type || 'No disponible'}</dd></div>
      <div><dt>Bytes exactos</dt><dd>{item.size.toLocaleString('es-ES')}</dd></div>
      <div><dt>Modificado (archivo original)</dt><dd>{item.lastModified ? new Date(item.lastModified).toLocaleString('es-ES') : 'No disponible'}</dd></div>
      {dimensions && <><div><dt>Megapíxeles</dt><dd>{(dimensions.width * dimensions.height / 1e6).toFixed(2)} MP</dd></div><div><dt>Relación ancho/alto</dt><dd>{(dimensions.width / dimensions.height).toFixed(4)}</dd></div><div><dt>Orientación visual</dt><dd>{dimensions.width === dimensions.height ? 'Cuadrada' : dimensions.width > dimensions.height ? 'Horizontal' : 'Vertical'}</dd></div></>}
      <div><dt>Selección</dt><dd>{selectionCount} {selectionCount === 1 ? 'imagen' : 'imágenes'}</dd></div>
    </dl>
    {hasGps && <p className="batch-hint" role="note"><ShieldCheck size={14} aria-hidden="true" /> El original contiene ubicación GPS. Las descargas de Image in Place se recodifican y no la incluyen.</p>}
    <details><summary>Metadatos incrustados del original</summary><p className="batch-hint">Datos presentes en el archivo importado; pueden no conservarse al exportar.</p>{embedded === null ? <p>Leyendo…</p> : !Object.keys(embedded).length ? <p>No se encontraron metadatos compatibles.</p> : <dl>{Object.entries(embedded).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{formatMetadataValue(value)}</dd></div>)}</dl>}</details>
  </div>;
}

function Gallery({ notice, onDismissNotice, items, selectedIds, setSelectedIds, onAddFiles, onBatchEdit, onEditItem, onCompareItem, onRemove, onClear, batchAction, onBatchClose, onBatchApply, batchBusy, onBatchBusy, onUndo, onRedo, canUndo, canRedo, onRestore, onRename }) {
  const addInputRef = useRef(null);
  const [previewZoom, setPreviewZoom] = useState(100);
  const [previews, setPreviews] = useState({});
  const selectedItems = useMemo(() => items.filter((item) => selectedIds.includes(item.id)), [items, selectedIds]);
  const allSelected = items.length > 0 && selectedIds.length === items.length;

  const batchTools = [
    { id: 'adjust', label: 'Mejorar imágenes seleccionadas', icon: SlidersHorizontal },
    { id: 'resize', label: 'Cambiar tamaño de imágenes seleccionadas', icon: Maximize2 },
    { id: 'crop', label: 'Recortar imágenes seleccionadas', icon: Crop },
    { id: 'trim', label: 'Recortar al contenido', icon: Scan },
    { id: 'background', label: 'Quitar fondo', icon: Eraser },
    { id: 'rotate', label: 'Girar imágenes seleccionadas', icon: RotateCw },
    { id: 'watermark', label: 'Añadir marca a imágenes seleccionadas', icon: Stamp },
    { id: 'compress', label: 'Comprimir a un peso objetivo', icon: Gauge },
    { id: 'rename', label: 'Renombrar selección', icon: Pencil },
    { id: 'canvas', label: 'Márgenes y lienzo', icon: ImageIcon },
    { id: 'print', label: 'Crear láminas A4', icon: BookOpen },
    { id: 'workflow', label: 'Flujos reutilizables', icon: Sparkles },
    { id: 'export', label: 'Exportar imágenes seleccionadas', icon: ArrowDownToLine },
  ];

  const toggleItem = (id) => {
    setSelectedIds((current) => current.includes(id) ? current.filter((itemId) => itemId !== id) : [...current, id]);
  };

  return (
    <div className="gallery-shell">
      <header className="site-header">
        <BrandMark />
        <div className="gallery-header-actions">
          <input ref={addInputRef} className="sr-only" type="file" accept="image/*" multiple onChange={(event) => onAddFiles(Array.from(event.target.files || []))} />
          <div className="header-action-group">
            <button className="toolbar-button" disabled={batchBusy || !canUndo} onClick={onUndo} title="Deshacer global" aria-label="Deshacer global"><Undo2 /></button>
            <button className="toolbar-button" disabled={batchBusy || !canRedo} onClick={onRedo} title="Rehacer global" aria-label="Rehacer global"><Redo2 /></button>
            <button className="toolbar-button" disabled={batchBusy || !selectedIds.length} onClick={onRestore} title="Restaurar originales seleccionados" aria-label="Restaurar originales seleccionados"><RotateCcw /></button>
            <button className="toolbar-button" disabled={batchBusy} onClick={() => addInputRef.current?.click()} title="Añadir imágenes" aria-label="Añadir imágenes"><Plus aria-hidden="true" /></button>
            <button className="toolbar-button" disabled={batchBusy} onClick={onClear} title="Cerrar todas las imágenes" aria-label="Cerrar todas las imágenes"><Trash2 aria-hidden="true" /></button>
            <button className="toolbar-button" disabled={batchBusy || !selectedIds.length} onClick={() => onBatchEdit('export')} title="Descargar selección" aria-label="Descargar selección"><ArrowDownToLine aria-hidden="true" /></button>
          </div>
        </div>
      </header>
      <main className="gallery-workspace">
        {notice && <p className="error-message gallery-notice" role="alert">{notice} <button type="button" className="icon-button" onClick={onDismissNotice} aria-label="Cerrar aviso"><X aria-hidden="true" /></button></p>}
        <div className="gallery-toolbar">
          <div className="preview-zoom" role="group" aria-label="Tamaño de las previsualizaciones">
            <button type="button" disabled={previewZoom <= 50} onClick={() => setPreviewZoom((value) => value - 10)} aria-label="Reducir previsualizaciones" title="Reducir previsualizaciones"><ZoomOut aria-hidden="true" /></button>
            <button type="button" disabled={previewZoom >= 200} onClick={() => setPreviewZoom((value) => value + 10)} aria-label="Ampliar previsualizaciones" title="Ampliar previsualizaciones"><ZoomIn aria-hidden="true" /></button>
          </div>
        </div>
        <div className="gallery-content-layout">
          <section className="image-grid" style={{ '--preview-scale': previewZoom / 100 }} aria-label="Imágenes importadas">
            {items.map((item) => {
              const selected = selectedIds.includes(item.id);
              const selectionOrder = selectedIds.indexOf(item.id) + 1;
              return (
                <article key={item.id} className={`image-card ${selected ? 'selected' : ''}`}>
                  <button className="image-card-select" disabled={batchBusy} aria-pressed={selected} aria-label={`${selected ? 'Quitar de la selección' : 'Seleccionar'} ${item.name}`} onClick={() => toggleItem(item.id)}>
                    <span className="image-thumb"><img src={previews[item.id] || item.url} alt="" /></span>
                    <span className="selection-order" aria-hidden="true">{selected ? selectionOrder : ''}</span>
                    <span className="image-card-meta"><strong>{item.name}</strong><small>{formatBytes(item.size)}</small></span>
                  </button>
                  <div className="image-card-actions">
                    <button className="image-card-edit image-card-action" disabled={batchBusy} onClick={() => onEditItem(item.id)} title={`Editar ${item.name}`} aria-label={`Editar ${item.name}`}><Pencil aria-hidden="true" /></button>
                    <button className="image-card-compare image-card-action" disabled={batchBusy} onClick={() => onCompareItem(item.id)} title={`Comparar ${item.name}`} aria-label={`Comparar ${item.name}`}><FlipHorizontal2 aria-hidden="true" /></button>
                  </div>
                </article>
              );
            })}
            <button className="image-card add-image-card" disabled={batchBusy} onClick={() => addInputRef.current?.click()}><Upload /><strong>Añadir imágenes</strong><small>JPG, PNG, WebP, GIF o SVG</small></button>
          </section>
          <aside className="gallery-side-panel" aria-label="Opciones de la acción en bloque">
            {batchAction && selectedItems.length ? (() => {
              const panelProps = { items: selectedItems, onPreview: setPreviews, onApply: onBatchApply, onClose: onBatchClose, onBusy: onBatchBusy };
              if (batchAction.toolId === 'compress') return <CompressionPanel {...panelProps} />;
              if (batchAction.toolId === 'rename') return <RenamePanel {...panelProps} allItems={items} onRename={onRename} />;
              if (batchAction.toolId === 'canvas') return <CanvasPanel {...panelProps} />;
              if (batchAction.toolId === 'background') return <BackgroundPanel {...panelProps} />;
              if (batchAction.toolId === 'trim') return <TrimPanel {...panelProps} />;
              if (batchAction.toolId === 'print') return <PrintSheetPanel {...panelProps} />;
              if (batchAction.toolId === 'workflow') return <WorkflowPanel {...panelProps} allItems={items} />;
              return <BatchPanel key={batchAction.toolId} action={batchAction.toolId} {...panelProps} />;
            })() : <ImageMetadata item={items.find((item) => item.id === selectedIds[selectedIds.length - 1])} selectionCount={selectedIds.length} />}
          </aside>
        </div>
      </main>
      <div className="selection-toolbar-dock" role="toolbar" aria-label={`Acciones para ${selectedIds.length} imágenes seleccionadas`}>
        <span className="selection-toolbar-count" role="status" aria-live="polite"><span>Seleccionadas</span><strong>{selectedIds.length}/{items.length}</strong></span>
        <div className="selection-toolbar-actions">
          <button className="selection-action-button" onClick={() => setSelectedIds(items.map((item) => item.id))} disabled={batchBusy || allSelected} title="Seleccionar todas" aria-label="Seleccionar todas"><CheckSquare2 aria-hidden="true" /></button>
          <button className="selection-action-button" onClick={() => setSelectedIds([])} disabled={batchBusy || !selectedIds.length} title="Quitar selección" aria-label="Quitar selección"><X aria-hidden="true" /></button>
          {batchTools.map(({ id, label, icon: Icon }) => <button key={id} className="selection-action-button" onClick={() => onBatchEdit(id)} disabled={batchBusy || !selectedIds.length} title={label} aria-label={label}><Icon aria-hidden="true" /></button>)}
          <button className="selection-action-button selection-action-button-danger" onClick={onRemove} disabled={batchBusy || !selectedIds.length} title="Eliminar imágenes seleccionadas" aria-label="Eliminar imágenes seleccionadas"><Trash2 aria-hidden="true" /></button>
        </div>
      </div>
    </div>
  );
}

function getBatchSize(source, { action, settings, resizeMode, maxEdge, allowEnlarge }, preview = false) {
  const crop = getCrop(settings, source.naturalWidth, source.naturalHeight);
  let scale = action === 'resize' ? resizeMode === 'percent' ? maxEdge / 100 : maxEdge / (resizeMode === 'width' ? crop.sw : resizeMode === 'height' ? crop.sh : Math.max(crop.sw, crop.sh)) : 1;
  if (!allowEnlarge) scale = Math.min(1, scale);
  if (preview) scale = Math.min(scale, 480 / Math.max(crop.sw, crop.sh));
  return { width: Math.max(1, Math.round(crop.sw * scale)), height: Math.max(1, Math.round(crop.sh * scale)) };
}

function BatchPanel({ action, items, onApply, onClose, onBusy, onPreview }) {
  const [settings, setSettings] = useState({ ...initialSettings });
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
  const titles = { adjust: 'Ajustar color y luz', resize: 'Cambiar tamaño', crop: 'Recortar imágenes', rotate: 'Girar y reflejar', watermark: 'Añadir marca de agua', export: 'Convertir y descargar' };

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        const nextPreviews = {};
        for (const item of items) {
          if (!active) return;
          const source = await loadSource(item.url);
          const canvas = document.createElement('canvas');
          const size = getBatchSize(source, { action, settings, resizeMode, maxEdge, allowEnlarge }, true);
          renderImage(source, canvas, { ...settings, blur: settings.blur * size.width / source.naturalWidth }, size, []);
          nextPreviews[item.id] = canvas.toDataURL(action === 'export' ? settings.format : 'image/png', settings.quality / 100);
        }
        if (active) onPreview(nextPreviews);
      } catch { if (active) onPreview({}); }
    }, 180);
    return () => { active = false; window.clearTimeout(timer); onPreview({}); };
  }, [action, items, settings, maxEdge, onPreview, resizeMode, allowEnlarge]);

  const apply = async () => {
    if (action === 'resize' && (!Number.isInteger(maxEdge) || maxEdge < 1 || maxEdge > 8192)) {
      setError('Introduce un lado máximo entero entre 1 y 8192 píxeles.');
      return;
    }
    setBusy(true);
    onBusy?.(true);
    setError('');
    const results = [];
    try {
      for (const item of items) {
        const source = await loadSource(item.url);
        const canvas = document.createElement('canvas');
        const size = getBatchSize(source, { action, settings, resizeMode, maxEdge, allowEnlarge });
        if (size.width > 16384 || size.height > 16384 || size.width * size.height > 64000000) throw new Error('Output too large');
        renderImage(source, canvas, settings, size, []);
        const format = action === 'export' ? settings.format : saveFormatFor(item.type);
        const quality = action === 'export' ? settings.quality / 100 : SAVE_QUALITY;
        const blob = await new Promise((resolve, reject) => flattenForFormat(canvas, format).toBlob((value) => value ? resolve(value) : reject(new Error('Encoding failed')), format, quality));
        results.push({ item, blob });
        setProgress(results.length);
      }
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
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = entries.length === 1 ? entries[0].name : `imageinplace-${entries.length}-imagenes.zip`;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      } else {
        onApply(results);
      }
      onBusy?.(false);
      onClose();
    } catch {
      setError('No se pudo completar la operación. No se han aplicado cambios. Prueba con menos imágenes o un tamaño menor.');
      setBusy(false);
      onBusy?.(false);
    }
  };

  return <section className="batch-panel" aria-labelledby="batch-title">
      <header className="batch-heading"><div><h2 id="batch-title">{titles[action]}</h2><p>Se aplicará a {items.length} {items.length === 1 ? 'imagen seleccionada' : 'imágenes seleccionadas'}.</p></div><button type="button" className="icon-button" aria-label="Cerrar parámetros" disabled={busy} onClick={onClose}><X /></button></header>
      <fieldset className="batch-fields" disabled={busy}>
        {action === 'resize' && <><label className="select-field"><span>Medida de referencia</span><select value={resizeMode} onChange={(event) => { setResizeMode(event.target.value); setMaxEdge(event.target.value === 'percent' ? 100 : 1600); }}><option value="longest">Lado más largo</option><option value="width">Ancho</option><option value="height">Alto</option><option value="percent">Porcentaje</option></select></label><label className="welcome-preference"><input type="checkbox" checked={allowEnlarge} onChange={(event) => setAllowEnlarge(event.target.checked)} />Permitir ampliar imágenes</label></>}
        {action === 'rotate' && <p className="batch-hint" role="status">Giro: {((settings.rotation % 360) + 360) % 360}°. Reflejo horizontal: {settings.flipX ? 'sí' : 'no'}.</p>}
        {action === 'resize' ? <><label className="text-field"><span>{resizeMode === 'percent' ? 'Escala (%)' : resizeMode === 'width' ? 'Ancho (px)' : resizeMode === 'height' ? 'Alto (px)' : 'Lado más largo (px)'}</span><input type="number" min="1" max="8192" required value={maxEdge} onChange={(event) => setMaxEdge(Number(event.target.value))} /></label><p className="batch-hint">Cada imagen conserva sus proporciones.{!allowEnlarge && ' Las imágenes más pequeñas no se amplían.'}</p></> : <ToolPanel activeTool={action} settings={settings} setSetting={(key, value) => setSettings((current) => ({ ...current, [key]: value }))} />}
      </fieldset>
      <p className="batch-hint">Vista previa en las imágenes seleccionadas. Los cambios se guardan al aplicar.</p>
      {error && <p role="alert">{error}</p>}
      <footer className="batch-footer"><span role="status">{busy ? `Procesando ${progress}/${items.length}…` : action === 'export' ? 'Varias imágenes se descargan en un ZIP.' : 'El resultado aparecerá en la galería.'}</span><button type="button" className="toolbar-button" disabled={busy} onClick={onClose}>Cancelar</button><button type="button" className="primary-button" onClick={apply} disabled={busy || (action === 'watermark' && !settings.watermarkText.trim())}>{busy ? 'Procesando…' : action === 'export' ? 'Descargar' : 'Aplicar'}</button></footer>
  </section>;
}

function RangeControl({ label, value, min, max, unit = '%', onChange }) {
  return (
    <label className="range-control">
      <span><strong>{label}</strong><output>{value}{unit}</output></span>
      <input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function NumberField({ label, value, onChange, min = 1, suffix }) {
  return (
    <label className="number-field">
      <span>{label}</span>
      <div><input type="number" min={min} value={value} onChange={(event) => onChange(Number(event.target.value))} />{suffix && <span>{suffix}</span>}</div>
    </label>
  );
}

function ToolPanel({ activeTool, settings, setSetting, outputSize, setOutputSize, aspectLocked, setAspectLocked, source, privacyAreas, selectedArea, setSelectedArea, addPrivacyArea, updatePrivacyArea, deletePrivacyArea, estimatedSize }) {
  const cropPresets = [
    { label: 'Libre', value: null },
    { label: 'Cuadrado', value: 1 },
    { label: 'Diapositiva', value: 16 / 9 },
    { label: 'Ficha A4', value: 210 / 297 },
    { label: 'Foto 3:2', value: 3 / 2 },
    { label: 'Foto 4:3', value: 4 / 3 },
    { label: 'Retrato 4:5', value: 4 / 5 },
    { label: 'Vertical 9:16', value: 9 / 16 },
  ];

  const applyCropPreset = (ratio) => {
    setSetting('cropRatio', ratio || 0);
    ['cropTop', 'cropRight', 'cropBottom', 'cropLeft'].forEach((key) => setSetting(key, 0));
  };

  if (activeTool === 'adjust') return (
    <>
      <PanelHeader title="Mejorar imagen" description="Ajusta la apariencia sin alterar el archivo original." />
      <RangeControl label="Brillo" value={settings.brightness} min={0} max={200} onChange={(value) => setSetting('brightness', value)} />
      <RangeControl label="Contraste" value={settings.contrast} min={0} max={200} onChange={(value) => setSetting('contrast', value)} />
      <RangeControl label="Color" value={settings.saturation} min={0} max={200} onChange={(value) => setSetting('saturation', value)} />
      <RangeControl label="Desenfoque" value={settings.blur} min={0} max={12} unit=" px" onChange={(value) => setSetting('blur', value)} />
      <div className="preset-grid">
        <button type="button" className={settings.grayscale === 100 ? 'active' : ''} onClick={() => setSetting('grayscale', settings.grayscale === 100 ? 0 : 100)}>B/N</button>
        <button type="button" className={settings.sepia === 100 ? 'active' : ''} onClick={() => setSetting('sepia', settings.sepia === 100 ? 0 : 100)}>Cálido</button>
      </div>
    </>
  );

  if (activeTool === 'resize') return (
    <>
      <PanelHeader title="Cambiar tamaño" description="Adapta la imagen a una medida exacta." />
      <div className="dimension-row">
        <NumberField label="Ancho" value={outputSize.width} suffix="px" onChange={(value) => {
          const width = Math.max(1, value);
          if (!source) return;
          const crop = getCrop(settings, source.naturalWidth, source.naturalHeight);
          setOutputSize((current) => ({ width, height: aspectLocked ? Math.max(1, Math.round(width / (crop.sw / crop.sh))) : current.height }));
        }} />
        <button className={`lock-button ${aspectLocked ? 'active' : ''}`} onClick={() => setAspectLocked(!aspectLocked)} aria-label={aspectLocked ? 'Desbloquear proporción' : 'Bloquear proporción'}><Lock size={17} /></button>
        <NumberField label="Alto" value={outputSize.height} suffix="px" onChange={(value) => {
          const height = Math.max(1, value);
          if (!source) return;
          const crop = getCrop(settings, source.naturalWidth, source.naturalHeight);
          setOutputSize((current) => ({ height, width: aspectLocked ? Math.max(1, Math.round(height * (crop.sw / crop.sh))) : current.width }));
        }} />
      </div>
      <div className="quick-size-list">
        {[25, 50, 100, 150, 200].map((percent) => <button type="button" key={percent} disabled={!source} onClick={() => { const crop = getCrop(settings, source.naturalWidth, source.naturalHeight); setOutputSize({ width: Math.round(crop.sw * percent / 100), height: Math.round(crop.sh * percent / 100) }); }}><strong>{percent}% del tamaño recortado</strong></button>)}
        <button onClick={() => setOutputSize({ width: 1920, height: 1080 })}><strong>Presentación 16:9</strong><span>1920 × 1080</span></button>
        <button onClick={() => setOutputSize({ width: 1200, height: 630 })}><strong>Imagen web</strong><span>1200 × 630</span></button>
        <button onClick={() => setOutputSize({ width: 1080, height: 1080 })}><strong>Cuadrada</strong><span>1080 × 1080</span></button>
      </div>
    </>
  );

  if (activeTool === 'crop') return (
    <>
      <PanelHeader title="Recortar" description="Recorte centrado por proporción o por porcentaje de cada borde. Sin deformación." />
      <div className="ratio-grid">
        {cropPresets.map((preset) => <button type="button" aria-pressed={settings.cropRatio === (preset.value || 0)} key={preset.label} onClick={() => applyCropPreset(preset.value)}>{preset.label}</button>)}
      </div>
      {[['Arriba', 'cropTop', 'cropBottom'], ['Derecha', 'cropRight', 'cropLeft'], ['Abajo', 'cropBottom', 'cropTop'], ['Izquierda', 'cropLeft', 'cropRight']].map(([label, key, opposite]) => <RangeControl key={key} label={label} value={settings[key]} min={0} max={99 - settings[opposite]} onChange={(value) => { setSetting('cropRatio', 0); setSetting(key, value); }} />)}
      <button type="button" className="reset-button" onClick={() => applyCropPreset(null)}>Restablecer recorte</button>
    </>
  );

  if (activeTool === 'rotate') return (
    <>
      <PanelHeader title="Girar y reflejar" description="Corrige la orientación con un toque." />
      <div className="large-action-grid">
        <button type="button" onClick={() => setSetting('rotation', (settings.rotation - 90) % 360)}><RotateCcw /><span>Izquierda</span></button>
        <button type="button" onClick={() => setSetting('rotation', (settings.rotation + 90) % 360)}><RotateCw /><span>Derecha</span></button>
        <button type="button" className={settings.flipX ? 'active' : ''} onClick={() => setSetting('flipX', !settings.flipX)}><FlipHorizontal2 /><span>Reflejar</span></button>
      </div>
    </>
  );

  if (activeTool === 'privacy') return (
    <>
      <PanelHeader title="Ocultar información" description="Arrastra sobre la imagen o crea una zona con el teclado para pixelar datos sensibles." />
      <div className="privacy-help"><ScanFace /><p><strong>Dibuja encima de la imagen</strong><span>También puedes usar “Nueva zona” y ajustar sus medidas con el teclado.</span></p></div>
      <button className="new-area-button" onClick={addPrivacyArea}>Nueva zona centrada</button>
      {privacyAreas.length > 0 && <>
        <div className="privacy-area-tabs" aria-label="Zonas ocultas">
          {privacyAreas.map((_, index) => <button key={index} className={selectedArea === index ? 'active' : ''} onClick={() => setSelectedArea(index)}>Zona {index + 1}</button>)}
        </div>
        <div className="preset-grid" role="group" aria-label={`Modo de la zona ${selectedArea + 1}`}>
          <button type="button" aria-pressed={privacyAreas[selectedArea]?.mode !== 'fill'} className={privacyAreas[selectedArea]?.mode !== 'fill' ? 'active' : ''} onClick={() => updatePrivacyArea('mode', 'pixelate')}>Pixelar</button>
          <button type="button" aria-pressed={privacyAreas[selectedArea]?.mode === 'fill'} className={privacyAreas[selectedArea]?.mode === 'fill' ? 'active' : ''} onClick={() => updatePrivacyArea('mode', 'fill')}>Tapar</button>
        </div>
        <p className="batch-hint">Para texto sensible (nombres, DNI, notas) usa «Tapar»: el pixelado de texto puede llegar a reconstruirse.</p>
        <fieldset className="area-controls">
          <legend>Posición y tamaño de la zona {selectedArea + 1}</legend>
          <RangeControl label="Horizontal" value={Math.round((privacyAreas[selectedArea]?.x || 0) * 100)} min={0} max={95} onChange={(value) => updatePrivacyArea('x', value / 100)} />
          <RangeControl label="Vertical" value={Math.round((privacyAreas[selectedArea]?.y || 0) * 100)} min={0} max={95} onChange={(value) => updatePrivacyArea('y', value / 100)} />
          <RangeControl label="Ancho" value={Math.round((privacyAreas[selectedArea]?.width || 0.2) * 100)} min={5} max={100} onChange={(value) => updatePrivacyArea('width', value / 100)} />
          <RangeControl label="Alto" value={Math.round((privacyAreas[selectedArea]?.height || 0.2) * 100)} min={5} max={100} onChange={(value) => updatePrivacyArea('height', value / 100)} />
        </fieldset>
      </>}
      <div className="area-count"><span>{privacyAreas.length} {privacyAreas.length === 1 ? 'zona oculta' : 'zonas ocultas'}</span><button disabled={!privacyAreas.length} onClick={deletePrivacyArea}><Trash2 size={16} /> Borrar zona</button></div>
    </>
  );

  if (activeTool === 'watermark') return (
    <>
      <PanelHeader title="Añadir marca" description="Firma material propio antes de compartirlo." />
      <label className="text-field"><span>Texto</span><input value={settings.watermarkText} maxLength={80} placeholder="Tu nombre o centro" onChange={(event) => setSetting('watermarkText', event.target.value)} /></label>
      <label className="select-field"><span>Posición</span><select value={settings.watermarkPosition} onChange={(event) => setSetting('watermarkPosition', event.target.value)}><option value="top-left">Arriba izquierda</option><option value="top-right">Arriba derecha</option><option value="center">Centro</option><option value="bottom-left">Abajo izquierda</option><option value="bottom-right">Abajo derecha</option></select><ChevronDown aria-hidden="true" /></label>
      <RangeControl label="Tamaño" value={settings.watermarkSize} min={2} max={15} onChange={(value) => setSetting('watermarkSize', value)} />
      <RangeControl label="Opacidad" value={settings.watermarkOpacity} min={10} max={100} onChange={(value) => setSetting('watermarkOpacity', value)} />
    </>
  );

  return (
    <>
      <PanelHeader title="Exportar imagen" description="Elige el equilibrio entre calidad y peso." />
      <fieldset className="format-options"><legend>Formato</legend>{[
        ['image/jpeg', 'JPG', 'Fotos y archivos ligeros'],
        ['image/png', 'PNG', 'Texto y transparencias'],
        ['image/webp', 'WebP', 'Web moderna y menos peso'],
      ].map(([value, title, copy]) => <label key={value} className={settings.format === value ? 'active' : ''}><input type="radio" name="format" value={value} checked={settings.format === value} onChange={() => setSetting('format', value)} /><span><strong>{title}</strong><small>{copy}</small></span><BadgeCheck /></label>)}</fieldset>
      {settings.format !== 'image/png' && <RangeControl label="Calidad" value={settings.quality} min={20} max={100} onChange={(value) => setSetting('quality', value)} />}
      <div className="estimated-size"><span>Peso aproximado</span><strong>{estimatedSize ? formatBytes(estimatedSize) : 'Calculando…'}</strong></div>
    </>
  );
}

function PanelHeader({ title, description }) {
  return <div className="panel-header"><h2>{title}</h2><p>{description}</p></div>;
}


export default function App() {
  const { items, setItems, undo, redo, canUndo, canRedo, restoreOriginals } = useImageHistory();
  const [rawSelectedIds, setSelectedIds] = useState([]);
  const [rawActiveIndex, setActiveIndex] = useState(0);
  // Items can disappear through delete/undo; only ids that still exist count as selected.
  const selectedIds = useMemo(() => {
    const existing = new Set(items.map((item) => item.id));
    return rawSelectedIds.filter((id) => existing.has(id));
  }, [items, rawSelectedIds]);
  const activeIndex = Math.min(rawActiveIndex, Math.max(0, items.length - 1));
  const [workspaceMode, setWorkspaceMode] = useState('gallery');
  const [editorStartTool, setEditorStartTool] = useState('adjust');
  const [batchAction, setBatchAction] = useState(null);
  const [batchBusy, setBatchBusy] = useState(false);
  const [comparisonId, setComparisonId] = useState(null);
  const [error, setError] = useState('');
  const [showWelcome, setShowWelcome] = useState(() => !readWelcomeDismissed());

  const addFiles = useCallback((files) => {
    if (batchBusy) return;
    const isSupported = (file) => file.type.startsWith('image/') && !UNSUPPORTED_TYPES.has(file.type);
    const validFiles = files.filter((file) => isSupported(file) && file.size <= MAX_FILE_SIZE);
    const rejected = files.filter((file) => !validFiles.includes(file));
    if (!validFiles.length) {
      setError('No hemos podido abrir ese archivo. Prueba con una imagen JPG, PNG, WebP, GIF o SVG de hasta 40 MB.');
      return;
    }
    if (rejected.length) {
      const names = rejected.slice(0, 3).map((file) => file.name).join(', ');
      setError(`${rejected.length === 1 ? 'Se ha omitido 1 archivo' : `Se han omitido ${rejected.length} archivos`} (formato no compatible o más de 40 MB): ${names}${rejected.length > 3 ? '…' : ''}`);
    } else setError('');
    const additions = validFiles.map((file) => {
      const url = URL.createObjectURL(file);
      return { id: crypto.randomUUID(), name: file.name, type: file.type, size: file.size, file, lastModified: file.lastModified, url, originalUrl: url, originalName: file.name, originalType: file.type, originalSize: file.size };
    });
    setItems((current) => [...current, ...additions]);
    setSelectedIds((current) => [...current, ...additions.map((item) => item.id)]);
    setWorkspaceMode('gallery');
    if (!items.length) setActiveIndex(0);
  }, [items.length, batchBusy, setItems]);

  useEffect(() => {
    const handlePaste = (event) => {
      const files = Array.from(event.clipboardData?.files || []);
      if (files.length) addFiles(files);
    };
    const handleDragOver = (event) => {
      if (items.length && Array.from(event.dataTransfer?.items || []).some((item) => item.kind === 'file')) event.preventDefault();
    };
    const handleDrop = (event) => {
      if (event.defaultPrevented) return;
      if (!items.length) return;
      const files = Array.from(event.dataTransfer?.files || []);
      if (!files.length) return;
      event.preventDefault();
      addFiles(files);
    };
    window.addEventListener('paste', handlePaste);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);
    return () => {
      window.removeEventListener('paste', handlePaste);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, [addFiles, items.length]);

  const clearAll = () => {
    setBatchAction(null);
    setItems([]);
    setSelectedIds([]);
    setActiveIndex(0);
    setWorkspaceMode('gallery');
  };

  const removeSelected = () => {
    setBatchAction(null);
    const remaining = items.filter((item) => !selectedIds.includes(item.id));
    setItems(remaining);
    setSelectedIds([]);
    setActiveIndex(0);
    if (!remaining.length) setWorkspaceMode('gallery');
  };

  const openBatchEditor = (toolId = 'adjust') => {
    if (selectedIds.length) setBatchAction({ toolId, items: items.filter((item) => selectedIds.includes(item.id)) });
  };

  const applyBatchResults = (results) => {
    const replacements = new Map(results.map(({ item, blob, name }) => [item.id, { ...item, name: nameForType(name || item.name, blob.type), type: blob.type || item.type, url: URL.createObjectURL(blob), size: blob.size }]));
    setItems((current) => current.map((item) => replacements.get(item.id) || item));
  };

  const openItemEditor = (itemId) => {
    setBatchAction(null);
    const itemIndex = items.findIndex((item) => item.id === itemId);
    if (itemIndex < 0) return;
    setActiveIndex(itemIndex);
    setEditorStartTool('adjust');
    setWorkspaceMode('editor');
  };

  const onUndo = () => { setBatchAction(null); undo(); };
  const onRedo = () => { setBatchAction(null); redo(); };
  const onRename = (renames) => {
    const names = new Map(renames.map(({ id, name }) => [id, name]));
    setItems((current) => current.map((item) => names.has(item.id) ? { ...item, name: names.get(item.id) } : item));
  };

  return <>
    {!items.length && <Home {...{onFiles: addFiles, error, onUndo, onRedo, canUndo, canRedo}} />}
    {items.length > 0 && <Gallery {...{ notice: error, onDismissNotice: () => setError(''), items, selectedIds, setSelectedIds, onAddFiles: addFiles, onBatchEdit: openBatchEditor, onEditItem: openItemEditor, onCompareItem: setComparisonId, onRemove: removeSelected, onClear: clearAll, batchAction, onBatchClose: () => setBatchAction(null), onBatchApply: applyBatchResults, batchBusy, onBatchBusy: setBatchBusy, onUndo, onRedo, canUndo, canRedo, onRestore: () => { setBatchAction(null); restoreOriginals(selectedIds); }, onRename }} />}
    {comparisonId && items.some((item) => item.id === comparisonId) && <CompareDialog items={items} itemId={comparisonId} onNavigate={setComparisonId} onClose={() => setComparisonId(null)} />}
    {items.length > 0 && workspaceMode === 'editor' && <Editor key={items[activeIndex].id} {...{ items, setItems, setSelectedIds, activeIndex, setActiveIndex, onAddFiles: addFiles, onBack: () => setWorkspaceMode('gallery'), onSave: applyBatchResults, ToolPanel, tools, initialTool: editorStartTool }} />}
    {showWelcome && <WelcomeDialog onClose={() => setShowWelcome(false)} />}
  </>;
}
