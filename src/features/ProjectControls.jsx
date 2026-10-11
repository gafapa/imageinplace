import React from 'react';
import OfflineStatus from './OfflineStatus';
import { FolderOpen, Save } from 'lucide-react';

export default function ProjectControls({ busy, hasItems, onOpen, onSave }) {
  const chooseFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.iip';
    input.onchange = () => { if (input.files?.[0]) onOpen(input.files[0]); };
    input.click();
  };
  return <details className="project-menu">
    <summary className="toolbar-button" aria-label="Proyecto local" title="Proyecto local"><FolderOpen aria-hidden="true" /></summary>
    <div className="project-menu-actions">
      <button className="toolbar-button" type="button" disabled={busy} onClick={chooseFile}><FolderOpen aria-hidden="true" /> Abrir proyecto</button>
      <button className="toolbar-button" type="button" disabled={busy || !hasItems} onClick={onSave}><Save aria-hidden="true" /> Guardar proyecto</button>
      <p>Incluye originales y sus metadatos. Guarda la edición antes de descargar. Al abrirlo, se añade a la galería.</p>
      <OfflineStatus />
    </div>
  </details>;
}
