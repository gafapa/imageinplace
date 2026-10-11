import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { detectLocale, loadLocale, t, tn } from './index.js';
import { extractKeys, placeholders } from './keys.js';
import gl from './gl.json';
import ca from './ca.json';
import eu from './eu.json';
import en from './en.json';

const sourceKeys = () => {
  const keys = new Set();
  const walk = (directory) => {
    for (const name of readdirSync(directory)) {
      const path = join(directory, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(jsx?|mjs)$/.test(name) && !/\.test\./.test(name)) extractKeys(readFileSync(path, 'utf8')).forEach((key) => keys.add(key));
    }
  };
  walk('src');
  return keys;
};

describe('dictionaries', () => {
  const keys = sourceKeys();
  it('finds the interface texts', () => {
    expect(keys.size).toBeGreaterThan(500);
  });
  for (const [language, dictionary] of Object.entries({ gl, ca, eu, en })) {
    it(`${language} translates every text with the same placeholders`, () => {
      const missing = [...keys].filter((key) => !dictionary[key]);
      expect(missing).toEqual([]);
      const broken = [...keys].filter((key) => placeholders(dictionary[key]).join() !== placeholders(key).join());
      expect(broken).toEqual([]);
      const unused = Object.keys(dictionary).filter((key) => !keys.has(key));
      expect(unused).toEqual([]);
    });
  }
});

describe('t and tn', () => {
  afterAll(() => loadLocale('es'));
  it('falls back to the Spanish source and fills placeholders', async () => {
    await loadLocale('es');
    expect(t('Procesando {done}/{total}…', { done: 2, total: 5 })).toBe('Procesando 2/5…');
    expect(tn(1, '{n} imagen', '{n} imágenes')).toBe('1 imagen');
    expect(tn(3, '{n} imagen', '{n} imágenes')).toBe('3 imágenes');
    expect(t('Texto sin traducir')).toBe('Texto sin traducir');
  });
  it('switches dictionaries', async () => {
    await loadLocale('gl');
    expect(t('Añadir imágenes')).toBe('Engadir imaxes');
    await loadLocale('en');
    expect(tn(2, '{n} imagen', '{n} imágenes')).toBe('2 images');
  });
});

describe('detectLocale', () => {
  const storage = (value) => ({ getItem: () => value });
  it('prefers the stored choice, then the browser languages, then Spanish', () => {
    expect(detectLocale(storage('eu'), ['en-US'])).toBe('eu');
    expect(detectLocale(storage(null), ['fr-FR', 'ca-ES'])).toBe('ca');
    expect(detectLocale(storage('xx'), ['gl'])).toBe('gl');
    expect(detectLocale(storage(null), ['fr', 'de'])).toBe('es');
  });
});
