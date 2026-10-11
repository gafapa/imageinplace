import React from 'react';
import { Languages } from 'lucide-react';
import { LOCALES, t } from '../i18n/index.js';

export default function LanguageSelect({ value, onChange, disabled }) {
  return <label className="language-select" title={t('Idioma')}>
    <Languages aria-hidden="true" />
    <span className="sr-only">{t('Idioma')}</span>
    <select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
      {LOCALES.map(({ id, label }) => <option key={id} value={id} lang={id}>{label}</option>)}
    </select>
  </label>;
}
