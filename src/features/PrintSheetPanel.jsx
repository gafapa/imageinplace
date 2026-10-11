import React, { useMemo, useState } from 'react';
import { Download, X } from 'lucide-react';
import { generatePrintableSheets, printableLayout } from './printableSheets';
import './PrintSheetPanel.css';
import useBatchTask from './useBatchTask';
import { t } from '../i18n/index.js';

export default function PrintSheetPanel({ items, onClose, onBusy }) {
  const task = useBatchTask();
  const [orientation, setOrientation] = useState('portrait'); const [rows, setRows] = useState('3'); const [columns, setColumns] = useState('2');
  const [margin, setMargin] = useState('12'); const [gap, setGap] = useState('4'); const [captions, setCaptions] = useState(true); const [title, setTitle] = useState('');
  const [requestedPage, setPage] = useState(0); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const layout = useMemo(() => { try { return printableLayout({ orientation, rows, columns, margin, gap, title }); } catch { return null; } }, [orientation, rows, columns, margin, gap, title]);
  const pageCount = layout ? Math.max(1, Math.ceil(items.length / layout.perPage)) : 1;
  const page = Math.min(requestedPage, pageCount - 1);
  const update = (setter) => (event) => { setter(event.target.value); setError(''); };
  const download = async () => {
    setBusy(true); setError(''); onBusy?.(true);
    const signal = task.start();
    try { const blob = await generatePrintableSheets(items, { orientation, rows, columns, margin, gap, captions, title, signal, onProgress: task.advance }); signal.throwIfAborted(); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'imageinplace-laminas.pdf'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    catch (cause) { setError(cause.name === 'AbortError' ? t('Operación cancelada.') : cause?.message || t('No se pudo generar el PDF.')); }
    finally { setBusy(false); onBusy?.(false); }
  };
  const pageItems = layout ? items.slice(page * layout.perPage, (page + 1) * layout.perPage) : [];
  return <section className="print-sheet-panel" aria-busy={busy}>
    <div className="batch-heading"><div><span className="panel-kicker">{t('Impresión')}</span><h2>{t('Láminas A4')}</h2></div><button className="icon-button" onClick={onClose} disabled={busy} aria-label={t('Cerrar')}><X /></button></div>
    <div className="print-preview" aria-label={t('Vista previa de la página {v0}', { v0: page + 1 })}><div className={`print-page ${orientation}`}>{title && <strong style={{ left: `${((layout?.marginPt || 0) / (layout?.width || 1)) * 100}%`, top: `${((layout?.marginPt || 0) / (layout?.height || 1)) * 100}%`, width: `${(((layout?.width || 1) - (layout?.marginPt || 0) * 2) / (layout?.width || 1)) * 100}%` }}>{title}</strong>}{pageItems.map((item, index) => { const row = Math.floor(index / (layout?.columns || 1)); const column = index % (layout?.columns || 1); const left = (layout.marginPt + column * (layout.cellWidth + layout.gapPt)) / layout.width * 100; const top = (layout.marginPt + layout.titleHeight + row * (layout.cellHeight + layout.gapPt)) / layout.height * 100; return <div key={item.id} className="print-thumb" style={{ left: `${left}%`, top: `${top}%`, width: `${layout.cellWidth / layout.width * 100}%`, height: `${layout.cellHeight / layout.height * 100}%` }}><img src={item.thumbnailUrl || item.url} alt="" />{captions && <small>{item.name}</small>}</div>; })}</div></div>
    <div className="print-pagination"><button className="toolbar-button" onClick={() => setPage(Math.max(0, page - 1))} disabled={busy || page === 0}>{t('Anterior')}</button><span>{t('Página {page} de {total}', { page: page + 1, total: pageCount })}</span><button className="toolbar-button" onClick={() => setPage(Math.min(pageCount - 1, page + 1))} disabled={busy || page >= pageCount - 1}>{t('Siguiente')}</button></div>
    <div className="print-controls"><label className="select-field"><span>{t('Orientación')}</span><select value={orientation} onChange={update(setOrientation)} disabled={busy}><option value="portrait">{t('Vertical')}</option><option value="landscape">{t('Horizontal')}</option></select></label><div className="print-number-grid"><label className="text-field"><span>{t('Filas')}</span><input type="number" min="1" max="12" value={rows} onChange={update(setRows)} disabled={busy} /></label><label className="text-field"><span>{t('Columnas')}</span><input type="number" min="1" max="12" value={columns} onChange={update(setColumns)} disabled={busy} /></label><label className="text-field"><span>{t('Margen (mm)')}</span><input type="number" min="0" max="40" value={margin} onChange={update(setMargin)} disabled={busy} /></label><label className="text-field"><span>{t('Separación (mm)')}</span><input type="number" min="0" max="20" value={gap} onChange={update(setGap)} disabled={busy} /></label></div><label className="print-check"><input type="checkbox" checked={captions} onChange={(event) => setCaptions(event.target.checked)} disabled={busy} /><span>{t('Mostrar nombres')}</span></label><label className="text-field"><span>{t('Título opcional')}</span><input value={title} onChange={update(setTitle)} disabled={busy} /></label></div>
    {error && <p className="error-message" role="alert">{error}</p>}<div className="batch-footer">{busy && <><span role="status">{t('Procesando {done}/{total}…', { done: task.progress, total: items.length })}</span><button className="toolbar-button" onClick={task.cancel}>{t('Cancelar')}</button></>}<button className="primary-button" onClick={download} disabled={busy || !items.length}><Download size={15} />{busy ? t('Generando…') : t('Descargar PDF')}</button></div>
  </section>;
}
