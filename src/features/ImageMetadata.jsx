import React, { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { formatBytes, loadImage } from './imageEngine';
import { t, tn, intlLocale } from '../i18n/index.js';

const METADATA_VALUE_LIMIT = 160;
function formatMetadataValue(value) {
  if (value instanceof Date) return value.toLocaleString(intlLocale());
  if (ArrayBuffer.isView(value)) return t('Datos binarios ({v0} bytes)', { v0: value.byteLength.toLocaleString(intlLocale()) });
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return text.length > METADATA_VALUE_LIMIT ? `${text.slice(0, METADATA_VALUE_LIMIT)}…` : text;
}

export default function ImageMetadata({ item, selectionCount }) {
  // Async results remember which item they describe, so a new selection shows "Leyendo…" until its own data arrives.
  const [embeddedState, setEmbeddedState] = useState({ file: null, data: null });
  const [dimensionsState, setDimensionsState] = useState({ url: null, data: null });
  const file = item?.file ?? null;
  const url = item?.url ?? null;
  const embedded = !file ? {} : embeddedState.file === file ? embeddedState.data : null;
  const dimensions = dimensionsState.url === url ? dimensionsState.data : null;

  useEffect(() => {
    if (!file) return undefined;
    let active = true;
    import('exifr').then(({ default: exifr }) => exifr.parse(file, true))
      .then((data) => { if (active) setEmbeddedState({ file, data: data || {} }); })
      .catch(() => { if (active) setEmbeddedState({ file, data: {} }); });
    return () => { active = false; };
  }, [file]);

  useEffect(() => {
    if (!url) return undefined;
    let active = true;
    loadImage(url)
      .then((image) => { if (active) setDimensionsState({ url, data: { width: image.naturalWidth, height: image.naturalHeight } }); })
      .catch(() => { if (active) setDimensionsState({ url, data: null }); });
    return () => { active = false; };
  }, [url]);

  const hasGps = Boolean(embedded && (Number.isFinite(embedded.latitude) || embedded.GPSLatitude != null));
  if (!item) return <div className="batch-panel-empty">{t('Selecciona una imagen para ver sus datos.')}</div>;
  const formatLabels = { 'image/jpeg': 'JPG', 'image/png': 'PNG', 'image/webp': 'WEBP', 'image/gif': 'GIF', 'image/svg+xml': 'SVG' };
  const extension = formatLabels[item.type] || (item.name.includes('.') ? item.name.split('.').pop().toUpperCase() : 'IMAGEN');
  return <div className="metadata-panel">
    <div className="panel-kicker">{t('Información')}</div>
    <h2>{item.name}</h2>
    <dl>
      <div><dt>{t('Dimensiones')}</dt><dd>{dimensions ? `${dimensions.width} × ${dimensions.height} px` : t('Leyendo…')}</dd></div>
      <div><dt>{t('Tamaño')}</dt><dd>{formatBytes(item.size)}</dd></div>
      <div><dt>{t('Formato')}</dt><dd>{extension}</dd></div>
      <div><dt>{t('Tipo MIME')}</dt><dd>{item.type || t('No disponible')}</dd></div>
      <div><dt>{t('Bytes exactos')}</dt><dd>{item.size.toLocaleString(intlLocale())}</dd></div>
      <div><dt>{t('Modificado (archivo original)')}</dt><dd>{item.lastModified ? new Date(item.lastModified).toLocaleString(intlLocale()) : t('No disponible')}</dd></div>
      {dimensions && <><div><dt>{t('Megapíxeles')}</dt><dd>{(dimensions.width * dimensions.height / 1e6).toFixed(2)}{' '}{t('MP')}</dd></div><div><dt>{t('Relación ancho/alto')}</dt><dd>{(dimensions.width / dimensions.height).toFixed(4)}</dd></div><div><dt>{t('Orientación visual')}</dt><dd>{dimensions.width === dimensions.height ? t('Cuadrada') : dimensions.width > dimensions.height ? t('Horizontal') : t('Vertical')}</dd></div></>}
      <div><dt>{t('Selección')}</dt><dd>{tn(selectionCount, '{n} imagen', '{n} imágenes')}</dd></div>
    </dl>
    {hasGps && <p className="batch-hint" role="note"><ShieldCheck size={14} aria-hidden="true" />{' '}{t('El original contiene ubicación GPS. Las descargas de Image in Place se recodifican y no la incluyen.')}</p>}
    <details><summary>{t('Metadatos incrustados del original')}</summary><p className="batch-hint">{t('Datos presentes en el archivo importado; pueden no conservarse al exportar.')}</p>{embedded === null ? <p>{t('Leyendo…')}</p> : !Object.keys(embedded).length ? <p>{t('No se encontraron metadatos compatibles.')}</p> : <dl>{Object.entries(embedded).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{formatMetadataValue(value)}</dd></div>)}</dl>}</details>
  </div>;
}
