import React, { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import BeforeAfter from './BeforeAfter';
import { t } from '../i18n/index.js';

/** Read-only gallery comparison: navigating never saves or changes selection. */
export default function CompareDialog({ items, itemId, onNavigate, onClose }) {
  const dialogRef = useRef(null);
  const index = items.findIndex((item) => item.id === itemId);
  const item = items[index];
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => { if (dialog.open) dialog.close(); };
  }, []);
  if (!item) return null;
  const format = item.type?.split('/')[1]?.replace('jpeg', 'jpg').toUpperCase() || 'actual';
  return <dialog ref={dialogRef} className="comparison-dialog" aria-labelledby="comparison-title" onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <header className="comparison-header">
      <h2 id="comparison-title">{t('Comparar: {name}', { name: item.name })}</h2>
      <div className="header-action-group" role="group" aria-label={t('Navegación del comparador')}>
        <button className="icon-button" disabled={index <= 0} onClick={() => onNavigate(items[index - 1].id)} aria-label={t('Comparar imagen anterior')}><ChevronLeft aria-hidden="true" /></button>
        <span>{index + 1}/{items.length}</span>
        <button className="icon-button" disabled={index >= items.length - 1} onClick={() => onNavigate(items[index + 1].id)} aria-label={t('Comparar imagen siguiente')}><ChevronRight aria-hidden="true" /></button>
      </div>
      <button className="icon-button" onClick={onClose} aria-label={t('Cerrar comparador')} autoFocus><X aria-hidden="true" /></button>
    </header>
    <div className="comparison-content">
      <BeforeAfter key={item.id} originalUrl={item.originalUrl || item.url} currentUrl={item.url} originalSize={item.originalSize ?? item.file?.size ?? item.size} currentSize={item.size} currentFormat={format} />
    </div>
  </dialog>;
}
