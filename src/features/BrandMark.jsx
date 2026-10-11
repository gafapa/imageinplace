import React from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { t } from '../i18n/index.js';

export default function BrandMark() {
  return (
    <div className="brand-mark" aria-label={t('Image in Place')}>
      <span className="brand-icon"><ImageIcon aria-hidden="true" /></span>
      <span className="brand-copy"><strong>{t('Image in Place')}</strong><small>{t('Tus imágenes, en tu dispositivo')}</small></span>
    </div>
  );
}
