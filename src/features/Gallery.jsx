import React, { useMemo, useState } from 'react';
import { ArrowDownToLine, CheckSquare2, FlipHorizontal2, Pencil, Plus, Redo2, RotateCcw, Trash2, Undo2, Upload, X, ZoomIn, ZoomOut } from 'lucide-react';
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
import { t } from '../i18n/index.js';

export default function Gallery({ notice, onDismissNotice, items, selectedIds, setSelectedIds, onPickFiles, onBatchEdit, onEditItem, onCompareItem, onRemove, onClear, batchAction, onBatchClose, onBatchApply, batchBusy, onBatchBusy, onUndo, onRedo, canUndo, canRedo, onRestore, onRename, projectControls }) {
  const [previewZoom, setPreviewZoom] = useState(100);
  const [previews, setPreviews] = useState({});
  const selectedItems = useMemo(() => items.filter((item) => selectedIds.includes(item.id)), [items, selectedIds]);
  const allSelected = items.length > 0 && selectedIds.length === items.length;

  const toggleItem = (id) => {
    setSelectedIds((current) => current.includes(id) ? current.filter((itemId) => itemId !== id) : [...current, id]);
  };

  return (
    <div className="gallery-shell">
      <header className="site-header">
        <BrandMark />
        <div className="gallery-header-actions">
          {projectControls}
          <div className="header-action-group">
            <button className="toolbar-button" disabled={batchBusy || !canUndo} onClick={onUndo} title={t('Deshacer (Ctrl+Z)')} aria-label={t('Deshacer global')}><Undo2 /></button>
            <button className="toolbar-button" disabled={batchBusy || !canRedo} onClick={onRedo} title={t('Rehacer (Ctrl+Y)')} aria-label={t('Rehacer global')}><Redo2 /></button>
            <button className="toolbar-button" disabled={batchBusy || !selectedIds.length} onClick={onRestore} title={t('Restaurar originales seleccionados')} aria-label={t('Restaurar originales seleccionados')}><RotateCcw /></button>
            <button className="toolbar-button" disabled={batchBusy} onClick={() => onPickFiles()} title={t('Añadir imágenes (Ctrl+O)')} aria-label={t('Añadir imágenes')}><Plus aria-hidden="true" /></button>
            <button className="toolbar-button" disabled={batchBusy} onClick={onClear} title={t('Cerrar todas las imágenes')} aria-label={t('Cerrar todas las imágenes')}><Trash2 aria-hidden="true" /></button>
            <button className="toolbar-button" disabled={batchBusy || !selectedIds.length} onClick={() => onBatchEdit('export')} title={t('Descargar selección')} aria-label={t('Descargar selección')}><ArrowDownToLine aria-hidden="true" /></button>
          </div>
        </div>
      </header>
      <main className="gallery-workspace">
        {notice && <p className="error-message gallery-notice" role="alert">{notice} <button type="button" className="icon-button" onClick={onDismissNotice} aria-label={t('Cerrar aviso')}><X aria-hidden="true" /></button></p>}
        <div className="gallery-toolbar">
          <div className="preview-zoom" role="group" aria-label={t('Tamaño de las previsualizaciones')}>
            <button type="button" disabled={previewZoom <= 50} onClick={() => setPreviewZoom((value) => value - 10)} aria-label={t('Reducir previsualizaciones')} title={t('Reducir previsualizaciones')}><ZoomOut aria-hidden="true" /></button>
            <button type="button" disabled={previewZoom >= 200} onClick={() => setPreviewZoom((value) => value + 10)} aria-label={t('Ampliar previsualizaciones')} title={t('Ampliar previsualizaciones')}><ZoomIn aria-hidden="true" /></button>
          </div>
        </div>
        <div className="gallery-content-layout">
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
      <div className="selection-toolbar-dock" role="toolbar" aria-label={t('Acciones para {length} imágenes seleccionadas', { length: selectedIds.length })}>
        <span className="selection-toolbar-count" role="status" aria-live="polite"><span>{t('Seleccionadas')}</span><strong>{selectedIds.length}/{items.length}</strong></span>
        <div className="selection-toolbar-actions">
          <button className="selection-action-button" onClick={() => setSelectedIds(items.map((item) => item.id))} disabled={batchBusy || allSelected} title={t('Seleccionar todas (Ctrl+A)')} aria-label={t('Seleccionar todas')}><CheckSquare2 aria-hidden="true" /><span aria-hidden="true">{t('Todas')}</span></button>
          <button className="selection-action-button" onClick={() => setSelectedIds([])} disabled={batchBusy || !selectedIds.length} title={t('Quitar selección (Esc)')} aria-label={t('Quitar selección')}><X aria-hidden="true" /><span aria-hidden="true">{t('Ninguna')}</span></button>
          <span className="selection-toolbar-divider" aria-hidden="true" />
          {batchTools.map(({ id, short, label, icon: Icon }) => <button key={id} className={`selection-action-button ${batchAction?.toolId === id ? 'active' : ''}`} aria-pressed={batchAction?.toolId === id} onClick={() => onBatchEdit(id)} disabled={batchBusy || !selectedIds.length} title={label} aria-label={label}><Icon aria-hidden="true" /><span aria-hidden="true">{short}</span></button>)}
          <span className="selection-toolbar-divider" aria-hidden="true" />
          <button className="selection-action-button selection-action-button-danger" onClick={onRemove} disabled={batchBusy || !selectedIds.length} title={t('Eliminar imágenes seleccionadas (Supr)')} aria-label={t('Eliminar imágenes seleccionadas')}><Trash2 aria-hidden="true" /><span aria-hidden="true">{t('Eliminar')}</span></button>
        </div>
      </div>
    </div>
  );
}
