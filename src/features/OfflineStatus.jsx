import React, { useEffect, useState } from 'react';

let registrationPromise;
const register = () => registrationPromise ||= navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });

export default function OfflineStatus() {
  const [status, setStatus] = useState(() => !import.meta.env.PROD ? 'Sin conexión disponible en la versión publicada.'
    : !('serviceWorker' in navigator) || !window.isSecureContext ? 'El uso sin conexión requiere HTTPS y un navegador compatible.'
      : 'Preparando el uso sin conexión…');
  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator) || !window.isSecureContext) return;
    let active = true;
    const disposers = [];
    register().then((registration) => {
      if (!active) return;
      const update = () => {
        if (!active) return;
        if (registration.waiting) setStatus('Actualización preparada. Guarda el proyecto y cierra las pestañas de la aplicación para usarla.');
        else if (registration.active) setStatus('Preparado para usar sin conexión.');
        else if (registration.installing?.state === 'redundant') setStatus('No se pudo preparar el uso sin conexión. Vuelve a abrir la aplicación con Internet.');
      };
      const watch = () => {
        const worker = registration.installing;
        if (worker) { worker.addEventListener('statechange', update); disposers.push(() => worker.removeEventListener('statechange', update)); }
        update();
      };
      registration.addEventListener('updatefound', watch); disposers.push(() => registration.removeEventListener('updatefound', watch));
      navigator.serviceWorker.addEventListener('controllerchange', update); disposers.push(() => navigator.serviceWorker.removeEventListener('controllerchange', update));
      watch();
    }).catch(() => { registrationPromise = undefined; if (active) setStatus('No se pudo preparar el uso sin conexión. Vuelve a abrir la aplicación con Internet.'); });
    return () => { active = false; disposers.forEach((dispose) => dispose()); };
  }, []);
  return <p role="status" className="offline-status">{status}</p>;
}
