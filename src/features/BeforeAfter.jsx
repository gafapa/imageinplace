import React, { useEffect, useState } from 'react';
import { loadImage } from './imageEngine';
import { t, intlLocale } from '../i18n/index.js';

export default function BeforeAfter({ originalUrl, currentUrl, originalSize, currentSize, originalDimensions, currentDimensions, currentFormat = 'PNG' }) {
  const [position, setPosition] = useState(50);
  // The load result is tagged with the URL pair it belongs to, so stale results never show.
  const pairKey = `${originalUrl}|${currentUrl}`;
  const [loaded, setLoaded] = useState({ key: null, dimensions: null, error: '' });
  const current = loaded.key === pairKey ? loaded : { dimensions: null, error: '' };
  const ready = Boolean(current.dimensions);
  const error = current.error;
  const loadedDimensions = current.dimensions || { original: '', current: '' };
  useEffect(() => {
    let active = true;
    Promise.all([loadImage(originalUrl), loadImage(currentUrl)])
      .then(([original, processed]) => { if (active) setLoaded({ key: `${originalUrl}|${currentUrl}`, error: '', dimensions: { original: `${original.naturalWidth} × ${original.naturalHeight} px`, current: `${processed.naturalWidth} × ${processed.naturalHeight} px` } }); })
      .catch(() => { if (active) setLoaded({ key: `${originalUrl}|${currentUrl}`, dimensions: null, error: t('No se pudo cargar la comparación.') }); });
    return () => { active = false; };
  }, [originalUrl, currentUrl]);
  const handleKeyDown = (event) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') { event.preventDefault(); setPosition((value) => Math.max(0, value - 1)); }
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') { event.preventDefault(); setPosition((value) => Math.min(100, value + 1)); }
    if (event.key === 'Home') { event.preventDefault(); setPosition(0); }
    if (event.key === 'End') { event.preventDefault(); setPosition(100); }
  };
  return <section className="before-after" aria-label={t('Comparar antes y después')}>
    <div className="before-after-labels"><strong>{t('Antes')}</strong><strong>{t('Después')}</strong></div>
    <div className="before-after-stage" style={{ background: '#ffffff', position: 'relative', minHeight: 240, overflow: 'hidden', border: '1px solid #dfe3e1' }}>
      {ready && <img className="before-after-image" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} src={originalUrl} alt={t('Imagen original')} />}
      {ready && <img className="before-after-image" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', background: '#ffffff', clipPath: `inset(0 0 0 ${position}%)` }} src={currentUrl} alt={t('Imagen procesada')} />}
      <div className="before-after-divider" style={{ position: 'absolute', top: 0, bottom: 0, left: `${position}%`, width: 2, background: '#111111' }} aria-hidden="true" />
    </div>
    <label className="before-after-slider"><span className="sr-only">{t('Posición de comparación')}</span><input type="range" min="0" max="100" value={position} onChange={(event) => setPosition(Number(event.target.value))} onKeyDown={handleKeyDown} aria-label={t('Deslizador Antes y Después')} /><output>{position}%</output></label>
    <p className="before-after-meta">{t('Original:')}{' '}{loadedDimensions.original || originalDimensions || '—'} · {Number.isFinite(originalSize) ? `${originalSize.toLocaleString(intlLocale())} B` : '—'}<br />{t('Actual (')}{currentFormat}): {loadedDimensions.current || currentDimensions || '—'} · {Number.isFinite(currentSize) ? `${currentSize.toLocaleString(intlLocale())} B` : '—'}</p>
    {error && <p className="workspace-error" role="alert">{error}</p>}
  </section>;
}
