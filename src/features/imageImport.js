import { t } from '../i18n/index.js';
// Only some browsers decode these (Safari reads HEIC/TIFF); others get a practical explanation instead of a generic error.
export const BROWSER_DEPENDENT_TYPES = { heic: 'image/heic', heif: 'image/heif', tif: 'image/tiff', tiff: 'image/tiff' };
export const IMAGE_ACCEPT = 'image/*,.heic,.heif,.tif,.tiff';
export const extensionOf = (name) => (name.includes('.') ? name.split('.').pop().toLowerCase() : '');
export const importType = (file) => file.type || BROWSER_DEPENDENT_TYPES[extensionOf(file.name)] || '';
export const undecodableMessage = (type) => type === 'image/heic' || type === 'image/heif'
  ? t('No se pudo abrir la foto HEIC. Si se repite, en el iPhone elige Ajustes → Cámara → Formatos → «Más compatible» para hacer fotos en JPG.')
  : type === 'image/tiff' ? t('Este navegador no puede abrir TIFF. Ábrelo en Safari o guárdalo como PNG o JPG.') : null;

