import React, { useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import { createRenames } from './rename';
import './RenamePanel.css';
import { t } from '../i18n/index.js';

export default function RenamePanel({ items, allItems = items, onRename, onClose }) {
  const [pattern, setPattern] = useState('{name}-{n}');
  const [start, setStart] = useState('1');
  const [padding, setPadding] = useState('2');
  const [applied, setApplied] = useState(false);
  const names = useMemo(() => createRenames(items, { pattern, start, padding }, allItems), [items, allItems, pattern, start, padding]);
  const apply = () => { if (!names.length || applied) return; onRename(names); setApplied(true); };
  return <section className="rename-panel">
    <div className="batch-heading"><div><span className="panel-kicker">{t('Nombres')}</span><h2>{t('Renombrar selección')}</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label={t('Cerrar')}><X /></button></div>
    <p className="batch-hint">{t('Usa')}{' '}<code>{'{name}'}</code>{' '}{t('para el nombre original y')}{' '}<code>{'{n}'}</code>{' '}{t('para el contador.')}</p>
    <label className="text-field"><span>{t('Patrón')}</span><input value={pattern} onChange={(event) => { setPattern(event.target.value); setApplied(false); }} /></label>
    <div className="rename-number-fields"><label className="text-field"><span>{t('Comenzar en')}</span><input type="number" min="0" value={start} onChange={(event) => { setStart(event.target.value); setApplied(false); }} /></label><label className="text-field"><span>{t('Cifras')}</span><input type="number" min="1" max="8" value={padding} onChange={(event) => { setPadding(event.target.value); setApplied(false); }} /></label></div>
    <div className="rename-preview"><h3>{t('Vista previa ({count})', { count: names.length })}</h3>{names.map((entry, index) => <div key={entry.id}><span>{items[index]?.name}</span><b>→</b><strong>{entry.name}</strong></div>)}</div>
    <div className="batch-footer"><button className="primary-button" type="button" onClick={apply} disabled={!names.length || applied}>{applied ? <><Check size={15} />{' '}{t('Aplicado')}</> : t('Aplicar nombres')}</button></div>
  </section>;
}
