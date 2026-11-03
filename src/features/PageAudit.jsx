import React, { useEffect, useId, useRef, useState } from 'react';
import { Globe, X } from 'lucide-react';
import { currentLocale, t } from '../i18n/index.js';
import './PageAudit.css';

/** The opaque sandbox cannot access editor images, storage, cookies, or the parent DOM. */
export default function PageAudit() {
  const dialog = useRef(null);
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [offlineNotice, setOfflineNotice] = useState(false);
  useEffect(() => {
    const clearNotice = () => setOfflineNotice(false);
    window.addEventListener('online', clearNotice);
    return () => window.removeEventListener('online', clearNotice);
  }, []);
  const openAudit = () => {
    // An opaque sandbox cannot use the parent app's service-worker cache.
    if (navigator.onLine === false) { setOfflineNotice(true); return; }
    setOfflineNotice(false); setOpen(true); dialog.current.showModal();
  };
  return <><button type="button" className="toolbar-button" aria-label={t('Analizar página web')} title={t('Analizar página web')} onClick={openAudit}><Globe aria-hidden="true" /><span className="button-label">{t('Analizar página web')}</span></button>{offlineNotice && <p className="workspace-status" role="status">{t('Conéctate para abrir el analizador web. La edición de imágenes sigue disponible sin conexión.')}</p>}<dialog ref={dialog} className="page-audit-dialog" aria-labelledby={titleId} onClose={() => setOpen(false)} onClick={(event) => { if (event.target === dialog.current) dialog.current.close(); }}>
    <header><h2 id={titleId}>{t('Analizar página web')}</h2><button type="button" className="toolbar-button" aria-label={t('Cerrar')} onClick={() => dialog.current.close()}><X aria-hidden="true" /><span className="button-label">{t('Cerrar')}</span></button></header>
    {open && <iframe title={t('Analizar página web')} src={`/page-audit.html?lang=${currentLocale()}`} sandbox="allow-scripts" referrerPolicy="no-referrer" />}
  </dialog></>;
}
