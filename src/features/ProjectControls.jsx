import React from 'react';
import OfflineStatus from './OfflineStatus';
import { FolderOpen, Save } from 'lucide-react';
import { t } from '../i18n/index.js';

export default function ProjectControls({ busy, hasItems, onOpen, onSave, recoveryEnabled, onToggleRecovery }) {
  const chooseFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.iip';
    input.onchange = () => { if (input.files?.[0]) onOpen(input.files[0]); };
    input.click();
  };
  return <details className="project-menu">
    <summary className="toolbar-button" aria-label={t('Proyecto local')} title={t('Proyecto local')}><FolderOpen aria-hidden="true" /></summary>
    <div className="project-menu-actions">
      <button className="toolbar-button" type="button" disabled={busy} onClick={chooseFile}><FolderOpen aria-hidden="true" />{' '}{t('Abrir proyecto')}</button>
      <button className="toolbar-button" type="button" disabled={busy || !hasItems} onClick={onSave}><Save aria-hidden="true" />{' '}{t('Guardar proyecto')}</button>
      <p>{t('Incluye originales y sus metadatos. Guarda la edición antes de descargar. Al abrirlo, se añade a la galería.')}</p>
      <label className="recovery-toggle"><input type="checkbox" checked={!!recoveryEnabled} onChange={(event) => onToggleRecovery?.(event.target.checked)} /> <span><strong>{t('Recordar mis imágenes en este dispositivo')}</strong><small>{t('Si cierras o recargas la pestaña, podrás recuperarlas. Se guardan solo en este navegador; desactívalo en equipos compartidos.')}</small></span></label>
      <OfflineStatus />
    </div>
  </details>;
}
