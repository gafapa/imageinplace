/**
 * Minimal runtime translation. Spanish source text is the key; other languages are lazily loaded
 * dictionaries mapping that text to a translation, falling back to Spanish for anything missing.
 * `t` reads module state, so the whole tree must re-render after `loadLocale` (App owns that state).
 */
export const LOCALES = [
  { id: 'es', label: 'Español', intl: 'es-ES' },
  { id: 'gl', label: 'Galego', intl: 'gl-ES' },
  { id: 'ca', label: 'Català', intl: 'ca-ES' },
  { id: 'eu', label: 'Euskara', intl: 'eu-ES' },
  { id: 'en', label: 'English', intl: 'en-GB' },
];

const loaders = {
  gl: () => import('./gl.json'),
  ca: () => import('./ca.json'),
  eu: () => import('./eu.json'),
  en: () => import('./en.json'),
};

const STORAGE_KEY = 'imageinplace-locale';
let locale = 'es';
let dictionary = null;

const interpolate = (text, params) => (params
  ? text.replace(/\{(\w+)\}/g, (match, name) => (Object.hasOwn(params, name) ? String(params[name]) : match))
  : text);

/** Translate Spanish source text, replacing `{name}` placeholders from params. */
export function t(text, params) {
  return interpolate(dictionary?.[text] || text, params);
}

/** Singular/plural pair (all supported languages use one/other); `{n}` is the count. */
export function tn(count, one, other, params = {}) {
  return t(count === 1 ? one : other, { n: count, ...params });
}

export const currentLocale = () => locale;
export const intlLocale = () => LOCALES.find((entry) => entry.id === locale)?.intl || 'es-ES';

export function detectLocale(storage = globalThis.localStorage, languages = globalThis.navigator?.languages || []) {
  let stored = null;
  try { stored = storage?.getItem(STORAGE_KEY); } catch { /* storage blocked */ }
  if (LOCALES.some((entry) => entry.id === stored)) return stored;
  for (const language of languages) {
    const id = String(language).toLowerCase().split('-')[0];
    if (LOCALES.some((entry) => entry.id === id)) return id;
  }
  return 'es';
}

export async function loadLocale(id, { remember = false } = {}) {
  const next = LOCALES.some((entry) => entry.id === id) ? id : 'es';
  dictionary = next === 'es' ? null : (await loaders[next]()).default;
  locale = next;
  if (globalThis.document) document.documentElement.lang = next;
  if (remember) { try { localStorage.setItem(STORAGE_KEY, next); } catch { /* preference is optional */ } }
  return next;
}
