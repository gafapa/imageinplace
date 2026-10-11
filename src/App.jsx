import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownToLine, BookOpen, Crop, Eraser, Gauge, History, Image as ImageIcon, Maximize2, PenLine, Redo2, ScanFace, ShieldCheck, SlidersHorizontal, Undo2, Upload } from 'lucide-react';
import Editor from './features/Editor';
import Gallery from './features/Gallery';
import BrandMark from './features/BrandMark';
import ProjectControls from './features/ProjectControls';
import LanguageSelect from './features/LanguageSelect';
import CompareDialog from './features/CompareDialog';
import { openProject, saveProject } from './features/project';
import { inspectImage, releaseItems, validateWorkspace, MAX_FILE_BYTES } from './features/imageLimits';
import useImageHistory from './features/useImageHistory';
import { nameForType } from './features/imageEngine';
import { IMAGE_ACCEPT, importType, undecodableMessage } from './features/imageImport';
import { convertHeicToJpeg, isHeicType } from './features/heic';
import { isTextEntry, shortcutFor } from './features/shortcuts';
import { clearSession, loadSession, readRecoveryPreference, storeSession, writeRecoveryPreference } from './features/sessionStore';
import { t, tn, intlLocale, currentLocale, loadLocale } from './i18n/index.js';

const MAX_FILE_SIZE = MAX_FILE_BYTES;
const WELCOME_KEY = 'imageinplace-welcome-dismissed';
// Storage can throw in private windows or when site data is blocked.
const readWelcomeDismissed = () => { try { return localStorage.getItem(WELCOME_KEY) === 'true'; } catch { return false; } };
const writeWelcomeDismissed = () => { try { localStorage.setItem(WELCOME_KEY, 'true'); } catch { /* preference is optional */ } };

function UploadZone({ onFiles, onPickFiles, compact = false }) {
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
      <div className="upload-icon" aria-hidden="true"><Upload size={25} /></div>
      <div>
        <p className="upload-title">{t('Arrastra y suelta imágenes aquí')}</p>
        <p className="upload-copy">{t('O pégalas desde el portapapeles')}</p>
      </div>
      <button className="primary-button" onClick={onPickFiles}>{t('Elegir imágenes')}</button>
      {!compact && <p className="format-note">{t('JPG, PNG, WebP, GIF, SVG o HEIC del iPhone · hasta 40 MB')}</p>}
    </div>
  );
}

const homeTasks = () => [
  { id: 'compress', mode: 'batch', icon: Gauge, title: t('Reducir el peso'), copy: t('Para Moodle, el correo o la web') },
  { id: 'resize', mode: 'batch', icon: Maximize2, title: t('Cambiar el tamaño'), copy: t('Medidas exactas o porcentaje') },
  { id: 'privacy', mode: 'editor', icon: ScanFace, title: t('Ocultar caras o nombres'), copy: t('Antes de compartir') },
  { id: 'annotate', mode: 'editor', icon: PenLine, title: t('Señalar y explicar'), copy: t('Flechas, texto y números') },
  { id: 'background', mode: 'batch', icon: Eraser, title: t('Quitar el fondo'), copy: t('Logos, dibujos y capturas') },
  { id: 'print', mode: 'batch', icon: BookOpen, title: t('Hacer láminas A4'), copy: t('Varias imágenes en un PDF') },
  { id: 'crop', mode: 'editor', icon: Crop, title: t('Recortar'), copy: t('Diapositiva, cuadrado o A4') },
  { id: 'export', mode: 'batch', icon: ArrowDownToLine, title: t('Convertir formato'), copy: t('JPG, PNG o WebP') },
];

function SessionBanner({ session, onRecover, onDiscard, busy }) {
  if (!session) return null;
  const when = new Date(session.savedAt).toLocaleString(intlLocale(), { dateStyle: 'medium', timeStyle: 'short' });
  return <div className="session-banner" role="region" aria-label={t('Sesión anterior')}>
    <History aria-hidden="true" />
    <p><strong>{tn(session.count, 'Tienes {n} imagen de tu última sesión', 'Tienes {n} imágenes de tu última sesión')}</strong><span>{t('Guardada en este dispositivo el {when}. Si añades otras imágenes, se sustituirá.', { when })}</span></p>
    <div><button type="button" className="toolbar-button" disabled={busy} onClick={onDiscard}>{t('Descartar')}</button><button type="button" className="primary-button" disabled={busy} onClick={onRecover}>{t('Recuperar')}</button></div>
  </div>;
}

function Home({ onFiles, onPickFiles, onTask, error, onUndo, canUndo, onRedo, canRedo, projectControls, session, onRecover, onDiscard, busy }) {
  return (
    <div className="home-shell">
      <header className="site-header">
        <BrandMark />
        <div className="home-actions">
          {projectControls}
          <button className="toolbar-button" disabled={!canUndo} onClick={onUndo} aria-label={t('Deshacer global')} title={t('Deshacer (Ctrl+Z)')}><Undo2 /></button>
          <button className="toolbar-button" disabled={!canRedo} onClick={onRedo} aria-label={t('Rehacer global')} title={t('Rehacer (Ctrl+Y)')}><Redo2 /></button>
          <span className="privacy-label"><ShieldCheck size={17} aria-hidden="true" />{' '}{t('Procesado local')}</span>
          <button className="toolbar-button" onClick={onPickFiles} title={t('Añadir imágenes (Ctrl+O)')}><Upload aria-hidden="true" />{' '}{t('Añadir imágenes')}</button>
        </div>
      </header>
      <main className="empty-workspace">
        <SessionBanner session={session} onRecover={onRecover} onDiscard={onDiscard} busy={busy} />
        <section className="workspace-dropzone" aria-labelledby="workspace-title">
          <UploadZone onFiles={onFiles} onPickFiles={onPickFiles} />
          <h1 id="workspace-title" className="sr-only">{t('Añadir imágenes')}</h1>
          {error && <p className="error-message" role="alert">{error}</p>}
        </section>
        <section className="home-tasks" aria-labelledby="home-tasks-title">
          <h2 id="home-tasks-title">{t('¿Qué quieres hacer?')}</h2>
          <div className="home-task-grid">
            {homeTasks().map(({ id, icon: Icon, title, copy }) => <button key={id} type="button" className="home-task" onClick={() => onTask(id)}><Icon aria-hidden="true" /><span><strong>{title}</strong><small>{copy}</small></span></button>)}
          </div>
          <p className="home-tasks-note"><ShieldCheck size={15} aria-hidden="true" />{' '}{t('Las imágenes se procesan en tu navegador y nunca se suben a ningún servidor.')}</p>
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
    { icon: SlidersHorizontal, text: t('Mejora color, luz y nitidez sin complicaciones') },
    { icon: Crop, text: t('Recorta, redimensiona, gira y convierte formatos') },
    { icon: ScanFace, text: t('Oculta caras, nombres y datos antes de compartir') },
    { icon: ShieldCheck, text: t('Privado por diseño: todo se procesa localmente') },
    { icon: BookOpen, text: t('Prepara imágenes para fichas, Moodle y presentaciones') },
  ];

  return (
    <dialog ref={dialogRef} className="welcome-dialog" onCancel={dismiss}>
      <div className="welcome-heading"><span className="brand-icon"><ImageIcon /></span><h2>{t('Bienvenido a Image in Place')}</h2></div>
      <p>{t('Edita, adapta y protege imágenes directamente en tu navegador. Tus archivos nunca salen de tu equipo.')}</p>
      <div className="welcome-features">
        {features.map(({ icon: Icon, text }) => <div key={text}><Icon aria-hidden="true" /><strong>{text}</strong></div>)}
      </div>
      <label className="welcome-preference"><input type="checkbox" checked={doNotShowAgain} onChange={(event) => setDoNotShowAgain(event.target.checked)} /> <span>{t('No mostrar esta página la próxima vez')}</span></label>
      <div className="welcome-actions"><button className="primary-button" onClick={dismiss}>{t('Empezar')}</button></div>
    </dialog>
  );
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

  const fileInputRef = useRef(null);
  const pendingTask = useRef(null);
  const pickFiles = () => { pendingTask.current = null; fileInputRef.current?.click(); };
  const startTask = (id) => { pendingTask.current = homeTasks().find((task) => task.id === id) || null; fileInputRef.current?.click(); };
  const [ioBusy, setIoBusy] = useState(false);
  const [ioStatus, setIoStatus] = useState('');
  useEffect(() => {
    if (ioBusy || !ioStatus) return;
    const timer = setTimeout(() => setIoStatus(''), 6000);
    return () => clearTimeout(timer);
  }, [ioBusy, ioStatus]);
  const ioLock = useRef(false);
  const savedItems = useRef('');
  const workspaceSignature = JSON.stringify(items.map(({ id, url, name }) => [id, url, name]));

  // Opt-in session recovery: the gallery is mirrored to IndexedDB as a project blob after changes settle.
  const [recoveryEnabled, setRecoveryEnabled] = useState(readRecoveryPreference);
  const [storedSession, setStoredSession] = useState(null);
  const sessionSaved = useRef('');
  const sessionTouched = useRef(false);
  useEffect(() => {
    if (!recoveryEnabled) return undefined;
    let active = true;
    loadSession().then((session) => { if (active && session && !sessionTouched.current) setStoredSession(session); });
    return () => { active = false; };
  }, [recoveryEnabled]);
  useEffect(() => {
    if (items.length) sessionTouched.current = true;
    // Until the user adds or recovers images, keep the previous session available for recovery.
    if (!recoveryEnabled || !sessionTouched.current || workspaceSignature === sessionSaved.current) return undefined;
    const snapshot = items;
    const signature = workspaceSignature;
    let active = true;
    const timer = setTimeout(async () => {
      try {
        if (!snapshot.length) await clearSession();
        else await storeSession(await saveProject(snapshot), snapshot.length);
        if (active) sessionSaved.current = signature;
      } catch { if (active) setIoStatus(t('No se pudo recordar la sesión en este dispositivo (¿falta espacio?).')); }
    }, 1500);
    return () => { active = false; clearTimeout(timer); };
  }, [items, recoveryEnabled, workspaceSignature]);
  const toggleRecovery = (enabled) => {
    writeRecoveryPreference(enabled);
    setRecoveryEnabled(enabled);
    sessionSaved.current = '';
    if (!enabled) { setStoredSession(null); clearSession(); }
  };
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);

  useEffect(() => {
    const handleUnload = (event) => {
      if (ioLock.current || (items.length && workspaceSignature !== savedItems.current && workspaceSignature !== sessionSaved.current) || workspaceMode === 'editor') {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [items, workspaceMode, workspaceSignature]);

  const addFiles = useCallback(async (files) => {
    if (batchBusy || ioLock.current) return;
    ioLock.current = true; setIoBusy(true); setError('');
    const additions = [];
    const rejected = [];
    const notices = [];
    try {
      for (const [index, file] of files.entries()) {
        setIoStatus(t('Abriendo {done}/{total}…', { done: index + 1, total: files.length }));
        try {
          let source = file;
          let type = importType(file);
          if (!type.startsWith('image/')) throw new Error(t('No es un archivo de imagen.'));
          if (file.size > MAX_FILE_SIZE) throw new Error(t('Supera el máximo de 40 MB.'));
          if (isHeicType(type)) {
            setIoStatus(t('Convirtiendo foto HEIC {v0}/{length}…', { v0: index + 1, length: files.length }));
            try { source = await convertHeicToJpeg(file); } catch (cause) { throw new Error(`${undecodableMessage(type)} (${cause.message})`, { cause }); }
            type = source.type;
            notices.push(t('Las fotos HEIC se convierten a JPG al abrirlas.'));
          }
          let info;
          try { info = await inspectImage(source); } catch (cause) { throw undecodableMessage(type) ? new Error(undecodableMessage(type), { cause }) : cause; }
          const candidate = { size: source.size, originalSize: source.size, width: info.width, height: info.height };
          validateWorkspace([...itemsRef.current, ...additions, candidate]);
          const url = URL.createObjectURL(source);
          const thumbnailUrl = URL.createObjectURL(info.thumbnail);
          additions.push({ id: crypto.randomUUID(), name: source.name, type, size: source.size, file: source, lastModified: source.lastModified,
            url, originalUrl: url, originalName: source.name, originalType: type, originalSize: source.size,
            width: info.width, height: info.height, originalWidth: info.width, originalHeight: info.height, thumbnailUrl, thumbnailSize: info.thumbnail.size, originalThumbnailSize: info.thumbnail.size, originalThumbnailUrl: thumbnailUrl });
          if (file.type === 'image/gif') notices.push(t('Al editar un GIF, el resultado será una imagen estática.'));
        } catch (cause) { rejected.push(`${file.name}: ${cause.message}`); }
      }
      const task = pendingTask.current;
      pendingTask.current = null;
      if (additions.length) {
        setItems((current) => [...current, ...additions]);
        setSelectedIds((current) => (task ? additions.map((item) => item.id) : [...current, ...additions.map((item) => item.id)]));
        if (workspaceMode !== 'editor') setWorkspaceMode('gallery');
        if (!itemsRef.current.length) setActiveIndex(0);
        // A task chosen on the home screen continues straight into its tool.
        if (task?.mode === 'batch') setBatchAction({ toolId: task.id });
        if (task?.mode === 'editor') { setBatchAction(null); setActiveIndex(itemsRef.current.length); setEditorStartTool(task.id); setWorkspaceMode('editor'); }
      }
      setError([...rejected.slice(0, 3), ...(rejected.length > 3 ? [tn(rejected.length - 3, 'Otro archivo omitido.', 'Otros {n} archivos omitidos.')] : []), ...new Set(notices)].join(' '));
      setIoStatus(additions.length ? tn(additions.length, '{n} imagen abierta.', '{n} imágenes abiertas.') : t('No se añadieron imágenes.'));
    } finally { ioLock.current = false; setIoBusy(false); }
  }, [batchBusy, setItems, workspaceMode]);

  const handleOpenProject = async (file, { recovering = false } = {}) => {
    if (batchBusy || ioLock.current) return;
    ioLock.current = true; setIoBusy(true); setIoStatus(recovering ? t('Recuperando sesión…') : t('Abriendo proyecto…')); setError('');
    let additions = [];
    try {
      const project = await openProject(file);
      additions = project.items;
      validateWorkspace([...itemsRef.current, ...additions]);
      setItems((current) => [...current, ...additions]);
      setSelectedIds(additions.map((item) => item.id));
      setWorkspaceMode('gallery'); setIoStatus(recovering ? t('Sesión recuperada.') : t('Proyecto abierto.'));
      if (recovering) setStoredSession(null);
      if (!project.integrityVerified) setError(t('Proyecto antiguo abierto sin hashes de integridad. Guarda una nueva copia para añadir la verificación.'));
    } catch (cause) { releaseItems(additions); setError(cause.message); setIoStatus(t('No se pudo abrir el proyecto.')); }
    finally { ioLock.current = false; setIoBusy(false); }
  };

  const handleSaveProject = async () => {
    if (batchBusy || ioLock.current || !items.length) return;
    ioLock.current = true; setIoBusy(true); setIoStatus(t('Preparando proyecto…')); setError('');
    const snapshot = items;
    try {
      const blob = await saveProject(snapshot);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = 'imageinplace-proyecto.iip'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      savedItems.current = JSON.stringify(snapshot.map(({ id, url, name }) => [id, url, name]));
      setIoStatus(t('Proyecto preparado para descargar. Conserva el archivo en tu equipo.'));
    } catch (cause) { setError(cause.message); setIoStatus(t('No se pudo guardar el proyecto.')); }
    finally { ioLock.current = false; setIoBusy(false); }
  };
  // Re-rendering App re-renders every component, so t() picks up the new dictionary everywhere.
  const [locale, setLocale] = useState(currentLocale);
  const changeLocale = async (id) => { try { setLocale(await loadLocale(id, { remember: true })); } catch { setError(t('No se pudo cargar el idioma. Comprueba la conexión.')); } };
  const projectControls = <><LanguageSelect value={locale} onChange={changeLocale} disabled={batchBusy || ioBusy} /><ProjectControls busy={batchBusy || ioBusy} hasItems={!!items.length} onOpen={handleOpenProject} onSave={handleSaveProject} recoveryEnabled={recoveryEnabled} onToggleRecovery={toggleRecovery} /></>;
  const recoverSession = () => { if (storedSession) handleOpenProject(storedSession.blob, { recovering: true }); };
  const discardSession = () => { setStoredSession(null); clearSession(); };

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

  const applyBatchResults = async (results, signal) => {
    const staged = [];
    try {
      for (const { item, blob, name } of results) {
        signal?.throwIfAborted();
        const info = await inspectImage(blob);
        staged.push({ ...item, name: nameForType(name || item.name, blob.type), type: blob.type || item.type,
          url: URL.createObjectURL(blob), size: blob.size, width: info.width, height: info.height, thumbnailSize: info.thumbnail.size, thumbnailUrl: URL.createObjectURL(info.thumbnail) });
      }
      signal?.throwIfAborted();
      const replacements = new Map(staged.map((item) => [item.id, item]));
      validateWorkspace(itemsRef.current.map((item) => replacements.get(item.id) || item));
      setItems((current) => current.map((item) => replacements.get(item.id) || item));
    } catch (cause) {
      // The originals still belong to the existing gallery/history.
      staged.forEach((item) => { URL.revokeObjectURL(item.url); URL.revokeObjectURL(item.thumbnailUrl); });
      throw cause;
    }
  };

  const openItemEditor = (itemId) => {
    setBatchAction(null);
    const itemIndex = items.findIndex((item) => item.id === itemId);
    if (itemIndex < 0) return;
    setActiveIndex(itemIndex);
    setEditorStartTool('adjust');
    setWorkspaceMode('editor');
  };

  const onUndo = () => { if (ioLock.current) return; setBatchAction(null); undo(); };
  const onRedo = () => { if (ioLock.current) return; setBatchAction(null); redo(); };

  const shortcutState = { items, selectedIds, batchAction, canUndo, canRedo, onUndo, onRedo, removeSelected, handleSaveProject, pickFiles,
    blocked: batchBusy || ioBusy || workspaceMode === 'editor' || Boolean(comparisonId) || showWelcome };
  const shortcutRef = useRef(shortcutState);
  useEffect(() => { shortcutRef.current = shortcutState; });
  useEffect(() => {
    const handleKeyDown = (event) => {
      const state = shortcutRef.current;
      if (state.blocked || event.defaultPrevented || isTextEntry(event.target) || document.querySelector('dialog[open]')) return;
      const command = shortcutFor(event);
      const run = {
        undo: () => state.canUndo && state.onUndo(),
        redo: () => state.canRedo && state.onRedo(),
        selectAll: () => state.items.length && setSelectedIds(state.items.map((item) => item.id)),
        save: () => state.items.length && state.handleSaveProject(),
        open: () => state.pickFiles(),
        delete: () => state.selectedIds.length && state.removeSelected(),
        escape: () => { if (state.batchAction) setBatchAction(null); else if (state.selectedIds.length) setSelectedIds([]); else return false; return true; },
      }[command];
      if (run && run() !== false) event.preventDefault();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  const onRename = (renames) => {
    const names = new Map(renames.map(({ id, name }) => [id, name]));
    setItems((current) => current.map((item) => names.has(item.id) ? { ...item, name: names.get(item.id) } : item));
  };

  return <>
    {!items.length && <Home {...{onFiles: addFiles, onPickFiles: pickFiles, onTask: startTask, session: storedSession, onRecover: recoverSession, onDiscard: discardSession, busy: ioBusy, error, onUndo, onRedo, canUndo, canRedo, projectControls}} />}
    {items.length > 0 && <Gallery {...{ notice: error, onDismissNotice: () => setError(''), items, selectedIds, setSelectedIds, onPickFiles: pickFiles, onBatchEdit: openBatchEditor, onEditItem: openItemEditor, onCompareItem: setComparisonId, onRemove: removeSelected, onClear: clearAll, batchAction, onBatchClose: () => setBatchAction(null), onBatchApply: applyBatchResults, batchBusy: batchBusy || ioBusy, onBatchBusy: setBatchBusy, onUndo, onRedo, canUndo, canRedo, onRestore: () => { setBatchAction(null); restoreOriginals(selectedIds); }, onRename, projectControls }} />}
    {comparisonId && items.some((item) => item.id === comparisonId) && <CompareDialog items={items} itemId={comparisonId} onNavigate={setComparisonId} onClose={() => setComparisonId(null)} />}
    {items.length > 0 && workspaceMode === 'editor' && <Editor key={items[activeIndex].id} {...{ items, setItems, setSelectedIds, activeIndex, setActiveIndex, onAddFiles: addFiles, onBack: () => setWorkspaceMode('gallery'), onSave: applyBatchResults, initialTool: editorStartTool }} />}
    <input ref={fileInputRef} className="sr-only" type="file" accept={IMAGE_ACCEPT} multiple tabIndex={-1} aria-hidden="true" onCancel={() => { pendingTask.current = null; }} onChange={(event) => { addFiles(Array.from(event.target.files || [])); event.target.value = ''; }} />
    {ioStatus && <div className="workspace-status" role="status" aria-live="polite">{ioStatus}</div>}
    {showWelcome && <WelcomeDialog onClose={() => setShowWelcome(false)} />}
  </>;
}
