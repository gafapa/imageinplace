import React, { useEffect, useState } from 'react';
import { t } from '../i18n/index.js';

const messages = {
  development: () => t('Sin conexión disponible en la versión publicada.'),
  unsupported: () => t('El uso sin conexión requiere HTTPS y un navegador compatible.'),
  preparing: () => t('Preparando el uso sin conexión…'),
  update: () => t('Actualización preparada. Guarda el proyecto y cierra las pestañas de la aplicación para usarla.'),
  ready: () => t('Preparado para usar sin conexión.'),
  error: () => t('No se pudo preparar el uso sin conexión. Vuelve a abrir la aplicación con Internet.'),
};

let registrationPromise;
const register = () => registrationPromise ||= navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });

export default function OfflineStatus() {
  const [status, setStatus] = useState(() => !import.meta.env.PROD ? 'development'
    : !('serviceWorker' in navigator) || !window.isSecureContext ? 'unsupported'
      : 'preparing');
  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator) || !window.isSecureContext) return;
    let active = true;
    const disposers = [];
    register().then((registration) => {
      if (!active) return;
      const update = () => {
        if (!active) return;
        if (registration.waiting) setStatus('update');
        else if (registration.active) setStatus('ready');
        else if (registration.installing?.state === 'redundant') setStatus('error');
      };
      const watch = () => {
        const worker = registration.installing;
        if (worker) { worker.addEventListener('statechange', update); disposers.push(() => worker.removeEventListener('statechange', update)); }
        update();
      };
      registration.addEventListener('updatefound', watch); disposers.push(() => registration.removeEventListener('updatefound', watch));
      navigator.serviceWorker.addEventListener('controllerchange', update); disposers.push(() => navigator.serviceWorker.removeEventListener('controllerchange', update));
      watch();
    }).catch(() => { registrationPromise = undefined; if (active) setStatus('error'); });
    return () => { active = false; disposers.forEach((dispose) => dispose()); };
  }, []);
  return <div className="offline-information"><p role="status" className="offline-status">{messages[status]()}</p><p>{t('La edición y la exportación están disponibles sin conexión cuando la preparación termina. IA, OCR y HEIC necesitan descargar sus archivos la primera vez; úsalos con Internet antes de necesitarlos sin conexión.')}</p></div>;
}
