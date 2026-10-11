import { describe, expect, it } from 'vitest';
import { decodeFaces, expandBox, looksSensitive, refineAlpha, salientInput, suppress } from './models.js';
import { ocrLanguagesFor } from './ocr.js';

describe('salientInput', () => {
  it('produces 3 × size² values with the red plane first', () => {
    const size = 2;
    const pixels = new Uint8ClampedArray(size * size * 4).fill(255);
    const input = salientInput(pixels, size);
    expect(input).toHaveLength(12);
    expect(input[0]).toBeCloseTo((1 - 0.485) / 0.229, 5);
    expect(input[4]).toBeCloseTo((1 - 0.456) / 0.224, 5);
    expect(input[8]).toBeCloseTo((1 - 0.406) / 0.225, 5);
  });
});

describe('decodeFaces', () => {
  it('keeps confident boxes, clamps them and removes overlapping duplicates', () => {
    const scores = new Float32Array([0.1, 0.9, 0.2, 0.8, 0.7, 0.3, 0.05, 0.95]);
    const boxes = new Float32Array([
      0.1, 0.1, 0.3, 0.3, // strong face
      0.11, 0.11, 0.31, 0.31, // duplicate of the first
      0.5, 0.5, 0.6, 0.6, // low score
      0.7, -0.1, 1.2, 0.2, // clamped to the image
    ]);
    const faces = decodeFaces(scores, boxes, 0.6);
    expect(faces).toHaveLength(2);
    expect(faces[0].score).toBeCloseTo(0.95);
    expect(faces[0].x).toBeCloseTo(0.7);
    expect(faces[0].y).toBe(0);
    expect(faces[0].width).toBeCloseTo(0.3);
  });
  it('suppress keeps separate boxes', () => {
    const kept = suppress([{ x: 0, y: 0, width: 0.1, height: 0.1, score: 0.7 }, { x: 0.5, y: 0.5, width: 0.1, height: 0.1, score: 0.8 }]);
    expect(kept).toHaveLength(2);
  });
});

describe('expandBox and refineAlpha', () => {
  it('grows a box within the image', () => {
    const box = expandBox({ x: 0, y: 0.5, width: 0.2, height: 0.2 }, 0.25);
    expect(box.x).toBe(0);
    expect(box.y).toBeCloseTo(0.45);
    expect(box.width).toBeCloseTo(0.25);
    expect(box.height).toBeCloseTo(0.3);
  });
  it('removes faint halo values and keeps the subject opaque', () => {
    expect(refineAlpha(10)).toBe(0);
    expect(refineAlpha(250)).toBe(255);
    expect(refineAlpha(128)).toBeGreaterThan(100);
    expect(refineAlpha(128)).toBeLessThan(160);
  });
});

describe('looksSensitive', () => {
  it('flags common personal data', () => {
    expect(looksSensitive('DNI: 12345678Z')).toBe(true);
    expect(looksSensitive('NIE X1234567L')).toBe(true);
    expect(looksSensitive('ana.lopez@colegio.es')).toBe(true);
    expect(looksSensitive('Tel. 612 345 678')).toBe(true);
    expect(looksSensitive('Nacimiento 03/05/2012')).toBe(true);
    expect(looksSensitive('DNI: 123456787')).toBe(true);
    expect(looksSensitive('Teléfono de contacto')).toBe(true);
  });
  it('leaves ordinary text alone', () => {
    expect(looksSensitive('Ficha de matemáticas: fracciones')).toBe(false);
    expect(looksSensitive('Ejercicio 3')).toBe(false);
  });
});

describe('ocrLanguagesFor', () => {
  it('always reads Spanish and English and adds the interface language', () => {
    expect(ocrLanguagesFor('es')).toBe('spa+eng');
    expect(ocrLanguagesFor('gl')).toBe('spa+eng+glg');
    expect(ocrLanguagesFor('eu')).toBe('spa+eng+eus');
    expect(ocrLanguagesFor('xx')).toBe('spa+eng');
  });
});
