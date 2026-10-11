import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownToLine, CheckSquare2, Ellipsis, FlipHorizontal2, Pencil, Plus, Redo2, RotateCcw, Trash2, Undo2, Upload, X, ZoomIn, ZoomOut } from 'lucide-react';
import BrandMark from './BrandMark';
import BatchPanel from './BatchPanel';
import ImageMetadata from './ImageMetadata';
import CompressionPanel from './CompressionPanel';
import RenamePanel from './RenamePanel';
import CanvasPanel from './CanvasPanel';
import PrintSheetPanel from './PrintSheetPanel';
import WorkflowPanel from './WorkflowPanel';
import BackgroundPanel from './BackgroundPanel';
import TrimPanel from './TrimPanel';
import { formatBytes } from './imageEngine';
import { batchTools } from './tools';
import { t, tn } from '../i18n/index.js';

const MENU_WIDTH = 280;

/** Overflow menu for the less frequent actions; fixed-positioned so the scrolling toolbar never clips it. */
function MoreMenu({ active, disabled, children }) {
  const [position, setPosition] = useState(null);
  const rootRef = useRef(null);
  const open = Boolean(position);
  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => { if (!rootRef.current?.contains(event.target)) setPosition(null); };
    // Capture phase, so Escape closes the menu before the gallery shortcut clears the selection.
    const closeOnEscape = (event) => { if (event.key === 'Escape') { event.stopPropagation(); setPosition(null); } };
    const closeOnResize = () => setPosition(null);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', closeOnEscape, true);
    window.addEventListener('resize', closeOnResize);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', closeOnEscape, true);
      window.removeEventListener('resize', closeOnResize);
    };
  }, [open]);
  const toggle = (event) => {
    if (open) { setPosition(null); return; }
    const bounds = event.currentTarget.getBoundingClientRect();
    setPosition({ top: bounds.bottom + 6, left: Math.max(8, Math.min(bounds.left, window.innerWidth - MENU_WIDTH - 8)) });
  };
  return <div className="more-menu" ref={rootRef}>
    <button type="button" className={`selection-action-button ${active ? 'active' : ''}`} aria-expanded={open} aria-haspopup="true" disabled={disabled} onClick={toggle} aria-label={t('Más acciones')} title={t('Más acciones')}><Ellipsis aria-hidden="true" /><span aria-hidden="true">{t('Más')}</span></button>
    {open && <div className="more-menu-list" style={{ top: position.top, left: position.left, width: MENU_WIDTH }} onClick={(event) => { if (event.target.closest('button')) setPosition(null); }}>{children}</div>}
  </div>;
}

export default function Gallery({ notice, onDismissNotice, items, selectedIds, setSelectedIds, onPickFiles, onBatchEdit, onEditItem, onCompareItem, onRemove, onClear, batchAction, onBatchClose, onBatchApply, batchBusy, onBatchBusy, onUndo, onRedo, canUndo, canRedo, onRestore, onRename, projectControls }) {
  const [previewZoom, setPreviewZoom] = useState(100);
  const [previews, setPreviews] = useState({});
  const selectedItems = useMemo(() => items.filter((item) => selectedIds.includes(item.id)), [items, selectedIds]);
  const allSelected = items.length > 0 && selectedIds.length === items.length;
  const primaryTools = batchTools.filter((tool) => !tool.more);
  const moreTools = batchTools.filter((tool) => tool.more);
  const noSelection = batchBusy || !selectedIds.length;

  const toggleItem = (id) => {
    setSelectedIds((current) => current.includes(id) ? current.filter((itemId) => itemId !== id) : [...current, id]);
  };
  const toolButton = ({ id, short, label, icon: Icon }) => <button key={id} type="button" className={`selection-action-button ${batchAction?.toolId === id ? 'active' : ''}`} aria-pressed={batchAction?.toolId === id} onClick={() => onBatchEdit(id)} disabled={noSelection} title={label} aria-label={label}><Icon aria-hidden="true" /><span aria-hidden="true">{short}</span></button>;

  return (
    <div className="gallery-shell">
      <header className="site-header">
        <BrandMark />
        <span className="gallery-count">{tn(items.length, '{n} imagen', '{n} imágenes')}</span>
        <div className="gallery-header-actions">
          <button className="toolbar-button ghost-button" disabled={batchBusy || !canUndo} onClick={onUndo} title={t('Deshacer (Ctrl+Z)')} aria-label={t('Deshacer global')}><Undo2 aria-hidden="true" /></button>
          <button className="toolbar-button ghost-button" disabled={batchBusy || !canRedo} onClick={onRedo} title={t('Rehacer (Ctrl+Y)')} aria-label={t('Rehacer global')}><Redo2 aria-hidden="true" /></button>
          {projectControls}
          <button className="toolbar-button" disabled={batchBusy} onClick={() => onPickFiles()} title={t('Añadir imágenes (Ctrl+O)')} aria-label={t('Añadir imágenes')}><Plus aria-hidden="true" /><span className="button-label">{t('Añadir')}</span></button>
          <button className="primary-button header-primary" disabled={noSelection} onClick={() => onBatchEdit('export')} title={t('Descargar selección')} aria-label={t('Descargar selección')}><ArrowDownToLine aria-hidden="true" /><span className="button-label">{t('Descargar')}</span></button>
        </div>
      </header>
      <main className="gallery-workspace">
        {notice && <p className="error-message gallery-notice" role="alert">{notice} <button type="button" className="icon-button" onClick={onDismissNotice} aria-label={t('Cerrar aviso')}><X aria-hidden="true" /></button></p>}
        <div className="gallery-content-layout">
          <div className="gallery-main">
            <div className="selection-toolbar" role="toolbar" aria-label={t('Acciones para {length} imágenes seleccionadas', { length: selectedIds.length })}>
              <span className="selection-toolbar-count" role="status" aria-live="polite"><span className="sr-only">{t('Seleccionadas')}</span><strong>{selectedIds.length}/{items.length}</strong></span>
              <button type="button" className="selection-text-button" onClick={() => setSelectedIds(items.map((item) => item.id))} disabled={batchBusy || allSelected} title={t('Seleccionar todas (Ctrl+A)')} aria-label={t('Seleccionar todas')}><CheckSquare2 aria-hidden="true" /><span aria-hidden="true">{t('Todas')}</span></button>
              <button type="button" className="selection-text-button" onClick={() => setSelectedIds([])} disabled={noSelection} title={t('Quitar selección (Esc)')} aria-label={t('Quitar selección')}><X aria-hidden="true" /><span aria-hidden="true">{t('Ninguna')}</span></button>
              {['edit', 'add', 'output'].map((section) => <React.Fragment key={section}><span className="selection-toolbar-divider" aria-hidden="true" />{primaryTools.filter((tool) => tool.section === section).map(toolButton)}</React.Fragment>)}
              <MoreMenu active={moreTools.some((tool) => tool.id === batchAction?.toolId)} disabled={batchBusy}>
                {moreTools.map(({ id, label, icon: Icon }) => <button key={id} type="button" className={batchAction?.toolId === id ? 'active' : ''} aria-pressed={batchAction?.toolId === id} onClick={() => onBatchEdit(id)} disabled={noSelection}><Icon aria-hidden="true" />{label}</button>)}
                <hr />
                <button type="button" onClick={onRestore} disabled={noSelection}><RotateCcw aria-hidden="true" />{t('Restaurar originales seleccionados')}</button>
                <button type="button" onClick={onClear} disabled={batchBusy}><X aria-hidden="true" />{t('Cerrar todas las imágenes')}</button>
              </MoreMenu>
              <button type="button" className="selection-action-button selection-action-button-danger" onClick={onRemove} disabled={noSelection} title={t('Eliminar imágenes seleccionadas (Supr)')} aria-label={t('Eliminar imágenes seleccionadas')}><Trash2 aria-hidden="true" /><span aria-hidden="true">{t('Eliminar')}</span></button>
              <div className="preview-zoom" role="group" aria-label={t('Tamaño de las previsualizaciones')}>
                <button type="button" disabled={previewZoom <= 50} onClick={() => setPreviewZoom((value) => value - 10)} aria-label={t('Reducir previsualizaciones')} title={t('Reducir previsualizaciones')}><ZoomOut aria-hidden="true" /></button>
                <button type="button" disabled={previewZoom >= 200} onClick={() => setPreviewZoom((value) => value + 10)} aria-label={t('Ampliar previsualizaciones')} title={t('Ampliar previsualizaciones')}><ZoomIn aria-hidden="true" /></button>
              </div>
            </div>
            <section className="image-grid" style={{ '--preview-scale': previewZoom / 100 }} aria-label={t('Imágenes importadas')}>
              {items.map((item) => {
                const selected = selectedIds.includes(item.id);
                const selectionOrder = selectedIds.indexOf(item.id) + 1;
                return (
                  <article key={item.id} className={`image-card ${selected ? 'selected' : ''}`}>
                    <button className="image-card-select" disabled={batchBusy} aria-pressed={selected} aria-label={`${selected ? t('Quitar de la selección') : t('Seleccionar')} ${item.name}`} onClick={() => toggleItem(item.id)}>
                      <span className="image-thumb"><img data-source-url={item.url} src={previews[item.id] || item.thumbnailUrl || item.url} loading="lazy" decoding="async" alt="" /></span>
                      <span className="selection-order" aria-hidden="true">{selected ? selectionOrder : ''}</span>
                      <span className="image-card-meta"><strong>{item.name}</strong><small>{formatBytes(item.size)}</small></span>
                    </button>
                    <div className="image-card-actions">
                      <button className="image-card-edit image-card-action" disabled={batchBusy} onClick={() => onEditItem(item.id)} title={t('Editar {name}', { name: item.name })} aria-label={t('Editar {name}', { name: item.name })}><Pencil aria-hidden="true" /></button>
                      <button className="image-card-compare image-card-action" disabled={batchBusy} onClick={() => onCompareItem(item.id)} title={t('Comparar {name}', { name: item.name })} aria-label={t('Comparar {name}', { name: item.name })}><FlipHorizontal2 aria-hidden="true" /></button>
                    </div>
                  </article>
                );
              })}
              <button className="image-card add-image-card" disabled={batchBusy} onClick={() => onPickFiles()}><Upload /><strong>{t('Añadir imágenes')}</strong><small>{t('JPG, PNG, WebP, GIF, SVG o HEIC')}</small></button>
            </section>
          </div>
          <aside className="gallery-side-panel" aria-label={t('Opciones de la acción en bloque')}>
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
    </div>
  );
}
