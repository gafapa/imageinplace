import React, { useState } from 'react';
import { BadgeCheck, ChevronDown, Crop, FlipHorizontal2, LoaderCircle, Lock, RotateCcw, RotateCw, ScanFace, ScanText, Trash2 } from 'lucide-react';
import { formatBytes, getCrop } from './imageEngine';
import { t, tn } from '../i18n/index.js';

function RangeControl({ label, value, min, max, unit = '%', onChange }) {
  return (
    <label className="range-control">
      <span><strong>{label}</strong><output>{value}{unit}</output></span>
      <input type="range" aria-label={label} min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function NumberField({ label, value, onChange, min = 1, suffix }) {
  // Keep what the user types while editing, so clearing the field does not snap it to the minimum.
  const [draft, setDraft] = useState(null);
  return (
    <label className="number-field">
      <span>{label}</span>
      <div><input type="number" inputMode="numeric" min={min} value={draft ?? value} onChange={(event) => {
        const text = event.target.value;
        setDraft(text);
        const number = Number(text);
        if (text !== '' && Number.isFinite(number) && number >= min) onChange(Math.round(number));
      }} onBlur={() => setDraft(null)} />{suffix && <span>{suffix}</span>}</div>
    </label>
  );
}

export default function ToolPanel({ onVisualCrop, activeTool, settings, setSetting, outputSize, setOutputSize, aspectLocked, setAspectLocked, source, privacyAreas, selectedArea, setSelectedArea, addPrivacyArea, updatePrivacyArea, deletePrivacyArea, estimatedSize, detection }) {
  const cropPresets = [
    { label: t('Libre'), value: null },
    { label: t('Cuadrado'), value: 1 },
    { label: t('Diapositiva'), value: 16 / 9 },
    { label: t('Ficha A4'), value: 210 / 297 },
    { label: t('Foto 3:2'), value: 3 / 2 },
    { label: t('Foto 4:3'), value: 4 / 3 },
    { label: t('Retrato 4:5'), value: 4 / 5 },
    { label: t('Vertical 9:16'), value: 9 / 16 },
  ];

  const applyCropPreset = (ratio) => {
    setSetting('cropRatio', ratio || 0);
    ['cropTop', 'cropRight', 'cropBottom', 'cropLeft'].forEach((key) => setSetting(key, 0));
  };

  if (activeTool === 'adjust') return (
    <>
      <PanelHeader title={t('Mejorar imagen')} description={t('Ajusta la apariencia sin alterar el archivo original.')} />
      <RangeControl label={t('Brillo')} value={settings.brightness} min={0} max={200} onChange={(value) => setSetting('brightness', value)} />
      <RangeControl label={t('Contraste')} value={settings.contrast} min={0} max={200} onChange={(value) => setSetting('contrast', value)} />
      <RangeControl label={t('Color')} value={settings.saturation} min={0} max={200} onChange={(value) => setSetting('saturation', value)} />
      <RangeControl label={t('Desenfoque')} value={settings.blur} min={0} max={12} unit=" px" onChange={(value) => setSetting('blur', value)} />
      <div className="preset-grid">
        <button type="button" className={settings.grayscale === 100 ? 'active' : ''} onClick={() => setSetting('grayscale', settings.grayscale === 100 ? 0 : 100)}>{t('B/N')}</button>
        <button type="button" className={settings.sepia === 100 ? 'active' : ''} onClick={() => setSetting('sepia', settings.sepia === 100 ? 0 : 100)}>{t('Cálido')}</button>
      </div>
    </>
  );

  if (activeTool === 'resize') return (
    <>
      <PanelHeader title={t('Cambiar tamaño')} description={t('Adapta la imagen a una medida exacta.')} />
      <div className="dimension-row">
        <NumberField label={t('Ancho')} value={outputSize.width} suffix="px" onChange={(value) => {
          const width = Math.max(1, value);
          if (!source) return;
          const crop = getCrop(settings, source.naturalWidth, source.naturalHeight);
          setOutputSize({ width, height: aspectLocked ? Math.max(1, Math.round(width / (crop.sw / crop.sh))) : outputSize.height });
        }} />
        <button className={`lock-button ${aspectLocked ? 'active' : ''}`} onClick={() => setAspectLocked(!aspectLocked)} aria-label={aspectLocked ? t('Desbloquear proporción') : t('Bloquear proporción')}><Lock size={17} /></button>
        <NumberField label={t('Alto')} value={outputSize.height} suffix="px" onChange={(value) => {
          const height = Math.max(1, value);
          if (!source) return;
          const crop = getCrop(settings, source.naturalWidth, source.naturalHeight);
          setOutputSize({ height, width: aspectLocked ? Math.max(1, Math.round(height * (crop.sw / crop.sh))) : outputSize.width });
        }} />
      </div>
      <div className="quick-size-list">
        {[25, 50, 100, 150, 200].map((percent) => <button type="button" key={percent} disabled={!source} onClick={() => { const crop = getCrop(settings, source.naturalWidth, source.naturalHeight); setOutputSize({ width: Math.round(crop.sw * percent / 100), height: Math.round(crop.sh * percent / 100) }); }}><strong>{percent}{t('% del tamaño recortado')}</strong></button>)}
        <button type="button" onClick={() => setOutputSize({ width: 1920, height: 1080 })}><strong>{t('Cabe en una diapositiva')}</strong><span>1920 × 1080</span></button>
        <button type="button" onClick={() => setOutputSize({ width: 1200, height: 630 })}><strong>{t('Cabe en una imagen web')}</strong><span>1200 × 630</span></button>
        <button type="button" onClick={() => setOutputSize({ width: 1080, height: 1080 })}><strong>{t('Cabe en un cuadrado')}</strong><span>1080 × 1080</span></button>
      </div>
      <p className="batch-hint">{t('La imagen se ajusta dentro de esas medidas sin deformarse. Para obtener la medida exacta con márgenes, usa «Lienzo»; para llenarla recortando, usa «Recortar».')}</p>
    </>
  );

  if (activeTool === 'crop') return (
    <>
      <PanelHeader title={t('Recortar')} description={t('Recorte centrado por proporción o por porcentaje de cada borde. Sin deformación.')} />
      {onVisualCrop && <button type="button" className="new-area-button visual-crop-button" onClick={onVisualCrop}><Crop size={16} aria-hidden="true" />{' '}{t('Recorte visual: arrastrar el marco')}</button>}
      <div className="ratio-grid">
        {cropPresets.map((preset) => <button type="button" aria-pressed={settings.cropRatio === (preset.value || 0)} key={preset.label} onClick={() => applyCropPreset(preset.value)}>{preset.label}</button>)}
      </div>
      {[[t('Arriba'), 'cropTop', 'cropBottom'], [t('Derecha'), 'cropRight', 'cropLeft'], [t('Abajo'), 'cropBottom', 'cropTop'], [t('Izquierda'), 'cropLeft', 'cropRight']].map(([label, key, opposite]) => <RangeControl key={key} label={label} value={settings[key]} min={0} max={99 - settings[opposite]} onChange={(value) => { setSetting('cropRatio', 0); setSetting(key, value); }} />)}
      <button type="button" className="reset-button" onClick={() => applyCropPreset(null)}>{t('Restablecer recorte')}</button>
    </>
  );

  if (activeTool === 'rotate') return (
    <>
      <PanelHeader title={t('Girar y reflejar')} description={t('Corrige la orientación con un toque.')} />
      <div className="large-action-grid">
        <button type="button" onClick={() => setSetting('rotation', (settings.rotation - 90) % 360)}><RotateCcw /><span>{t('Izquierda')}</span></button>
        <button type="button" onClick={() => setSetting('rotation', (settings.rotation + 90) % 360)}><RotateCw /><span>{t('Derecha')}</span></button>
        <button type="button" className={settings.flipX ? 'active' : ''} onClick={() => setSetting('flipX', !settings.flipX)}><FlipHorizontal2 /><span>{t('Reflejar')}</span></button>
      </div>
    </>
  );

  if (activeTool === 'privacy') return (
    <>
      <PanelHeader title={t('Ocultar información')} description={t('Arrastra sobre la imagen o crea una zona con el teclado para pixelar datos sensibles.')} />
      <div className="privacy-help"><ScanFace /><p><strong>{t('Dibuja encima de la imagen')}</strong><span>{t('También puedes usar “Nueva zona” y ajustar sus medidas con el teclado.')}</span></p></div>
      {detection && <div className="detect-panel">
        <div className="preset-grid">
          <button type="button" disabled={detection.status === 'running'} onClick={detection.detectFaces}><ScanFace size={16} aria-hidden="true" />{' '}{t('Detectar caras')}</button>
          <button type="button" disabled={detection.status === 'running'} onClick={detection.detectText}><ScanText size={16} aria-hidden="true" />{' '}{t('Detectar texto')}</button>
        </div>
        {detection.status === 'running' && <p className="detect-status" role="status"><LoaderCircle className="spin" size={15} aria-hidden="true" /> {detection.message} <button type="button" className="link-button" onClick={detection.cancel}>{t('Cancelar')}</button></p>}
        {detection.status === 'idle' && detection.message && <p className="batch-hint" role="status">{detection.message}</p>}
        {detection.status === 'review' && <fieldset className="ocr-lines">
          <legend>{t('Texto encontrado: marca lo que quieras tapar')}</legend>
          <p className="batch-hint">{t('Se marcan solas las líneas que parecen datos personales (DNI, correo, teléfono, fechas). Revisa los nombres.')}</p>
          <div className="ocr-line-list">{detection.lines.map((line, index) => <label key={index} className={line.sensitive ? 'sensitive' : ''}><input type="checkbox" checked={line.checked} onChange={() => detection.toggleLine(index)} /> <span>{line.text}</span></label>)}</div>
          <div className="ocr-line-actions">
            <button type="button" className="link-button" onClick={() => detection.setAllLines(!detection.lines.every((line) => line.checked))}>{detection.lines.every((line) => line.checked) ? t('Desmarcar todo') : t('Marcar todo')}</button>
            <button type="button" className="link-button" onClick={detection.cancel}>{t('Descartar')}</button>
            <button type="button" className="primary-button" disabled={!detection.lines.some((line) => line.checked)} onClick={detection.coverLines}>{t('Tapar {count}', { count: detection.lines.filter((line) => line.checked).length })}</button>
          </div>
        </fieldset>}
        <p className="batch-hint">{t('La detección funciona en tu dispositivo y puede fallar: revisa siempre la imagen antes de compartirla.')}</p>
      </div>}
      <button className="new-area-button" onClick={addPrivacyArea}>{t('Nueva zona centrada')}</button>
      {privacyAreas.length > 0 && <>
        <div className="privacy-area-tabs" aria-label={t('Zonas ocultas')}>
          {privacyAreas.map((_, index) => <button key={index} className={selectedArea === index ? 'active' : ''} onClick={() => setSelectedArea(index)}>{t('Zona {number}', { number: index + 1 })}</button>)}
        </div>
        <div className="preset-grid" role="group" aria-label={t('Modo de la zona {v0}', { v0: selectedArea + 1 })}>
          <button type="button" aria-pressed={privacyAreas[selectedArea]?.mode !== 'fill'} className={privacyAreas[selectedArea]?.mode !== 'fill' ? 'active' : ''} onClick={() => updatePrivacyArea('mode', 'pixelate')}>{t('Pixelar')}</button>
          <button type="button" aria-pressed={privacyAreas[selectedArea]?.mode === 'fill'} className={privacyAreas[selectedArea]?.mode === 'fill' ? 'active' : ''} onClick={() => updatePrivacyArea('mode', 'fill')}>{t('Tapar')}</button>
        </div>
        <p className="batch-hint">{t('Para texto sensible (nombres, DNI, notas) usa «Tapar»: el pixelado de texto puede llegar a reconstruirse.')}</p>
        <fieldset className="area-controls">
          <legend>{t('Posición y tamaño de la zona {number}', { number: selectedArea + 1 })}</legend>
          <RangeControl label={t('Horizontal')} value={Math.round((privacyAreas[selectedArea]?.x || 0) * 100)} min={0} max={95} onChange={(value) => updatePrivacyArea('x', value / 100)} />
          <RangeControl label={t('Vertical')} value={Math.round((privacyAreas[selectedArea]?.y || 0) * 100)} min={0} max={95} onChange={(value) => updatePrivacyArea('y', value / 100)} />
          <RangeControl label={t('Ancho')} value={Math.round((privacyAreas[selectedArea]?.width || 0.2) * 100)} min={5} max={100} onChange={(value) => updatePrivacyArea('width', value / 100)} />
          <RangeControl label={t('Alto')} value={Math.round((privacyAreas[selectedArea]?.height || 0.2) * 100)} min={5} max={100} onChange={(value) => updatePrivacyArea('height', value / 100)} />
        </fieldset>
      </>}
      <div className="area-count"><span>{tn(privacyAreas.length, '{n} zona oculta', '{n} zonas ocultas')}</span><button disabled={!privacyAreas.length} onClick={deletePrivacyArea}><Trash2 size={16} />{' '}{t('Borrar zona')}</button></div>
    </>
  );

  if (activeTool === 'watermark') return (
    <>
      <PanelHeader title={t('Añadir marca')} description={t('Firma material propio antes de compartirlo.')} />
      <label className="text-field"><span>{t('Texto')}</span><input value={settings.watermarkText} maxLength={80} placeholder={t('Tu nombre o centro')} onChange={(event) => setSetting('watermarkText', event.target.value)} /></label>
      <label className="select-field"><span>{t('Posición')}</span><select value={settings.watermarkPosition} onChange={(event) => setSetting('watermarkPosition', event.target.value)}><option value="top-left">{t('Arriba izquierda')}</option><option value="top-right">{t('Arriba derecha')}</option><option value="center">{t('Centro')}</option><option value="bottom-left">{t('Abajo izquierda')}</option><option value="bottom-right">{t('Abajo derecha')}</option></select><ChevronDown aria-hidden="true" /></label>
      <RangeControl label={t('Tamaño')} value={settings.watermarkSize} min={2} max={15} onChange={(value) => setSetting('watermarkSize', value)} />
      <RangeControl label={t('Opacidad')} value={settings.watermarkOpacity} min={10} max={100} onChange={(value) => setSetting('watermarkOpacity', value)} />
    </>
  );

  return (
    <>
      <PanelHeader title={t('Exportar imagen')} description={t('Elige el equilibrio entre calidad y peso.')} />
      <fieldset className="format-options"><legend>{t('Formato')}</legend>{[
        ['image/jpeg', 'JPG', t('Fotos y archivos ligeros')],
        ['image/png', 'PNG', t('Texto y transparencias')],
        ['image/webp', 'WebP', t('Web moderna y menos peso')],
      ].map(([value, title, copy]) => <label key={value} className={settings.format === value ? 'active' : ''}><input type="radio" name="format" value={value} checked={settings.format === value} onChange={() => setSetting('format', value)} /><span><strong>{title}</strong><small>{copy}</small></span><BadgeCheck /></label>)}</fieldset>
      {settings.format !== 'image/png' && <RangeControl label={t('Calidad')} value={settings.quality} min={20} max={100} onChange={(value) => setSetting('quality', value)} />}
      <div className="estimated-size"><span>{t('Peso aproximado')}</span><strong>{estimatedSize ? formatBytes(estimatedSize) : t('Calculando…')}</strong></div>
    </>
  );
}

function PanelHeader({ title, description }) {
  return <div className="panel-header"><h2>{title}</h2><p>{description}</p></div>;
}
