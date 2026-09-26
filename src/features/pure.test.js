import { describe, expect, it } from 'vitest';
import { createRenames, sanitizeFilename } from './rename.js';
import { validateCanvasSize } from './canvasLayout.js';
import { printableLayout } from './printableSheets.js';
import { readWorkflows, writeWorkflows, WORKFLOW_STORAGE_KEY } from './workflow.js';
import { getCrop, nameForType, saveFormatFor } from './imageEngine.js';

const memoryStorage = (initial = {}) => {
  const data = { ...initial };
  return { getItem: (key) => data[key] ?? null, setItem: (key, value) => { data[key] = String(value); }, data };
};

describe('sanitizeFilename', () => {
  it('replaces characters that are invalid on Windows', () => {
    expect(sanitizeFilename('a<b>:c"d/e\\f|g?h*i')).toBe('a-b--c-d-e-f-g-h-i');
  });
  it('protects reserved device names and trailing dots', () => {
    expect(sanitizeFilename('CON')).toBe('_CON');
    expect(sanitizeFilename('nombre. . ')).toBe('nombre');
  });
  it('falls back when nothing usable remains', () => {
    expect(sanitizeFilename('   ')).toBe('imagen');
  });
});

describe('createRenames', () => {
  const items = [
    { id: 'a', name: 'foto.jpg', type: 'image/jpeg' },
    { id: 'b', name: 'foto.png', type: 'image/png' },
  ];
  it('applies the pattern, counter padding and MIME extension', () => {
    expect(createRenames(items, { pattern: 'clase-{n}', start: 1, padding: 3 }).map((entry) => entry.name))
      .toEqual(['clase-001.jpg', 'clase-002.png']);
  });
  it('avoids collisions with unselected gallery items', () => {
    const all = [...items, { id: 'c', name: 'x.jpg', type: 'image/jpeg' }];
    expect(createRenames([items[0]], { pattern: 'x', padding: 1 }, all)[0].name).toBe('x (2).jpg');
  });
});

describe('validateCanvasSize', () => {
  it('accepts reasonable sizes and rejects huge or invalid ones', () => {
    expect(() => validateCanvasSize(1600, 1200)).not.toThrow();
    expect(() => validateCanvasSize(0, 10)).toThrow();
    expect(() => validateCanvasSize(12001, 10)).toThrow();
    expect(() => validateCanvasSize(1.5, 10)).toThrow();
  });
});

describe('printableLayout', () => {
  it('reserves title space only when a title is given', () => {
    expect(printableLayout({ rows: 3, columns: 2 }).titleHeight).toBe(0);
    expect(printableLayout({ rows: 3, columns: 2, title: 'Tema 1' }).titleHeight).toBe(18);
  });
  it('clamps the grid and rejects cells that are too small', () => {
    expect(printableLayout({ rows: 99, columns: 1 }).rows).toBe(12);
    expect(() => printableLayout({ rows: 12, columns: 12, margin: 40, gap: 20 })).toThrow();
  });
});

describe('workflow storage', () => {
  it('round-trips valid workflows', () => {
    const storage = memoryStorage();
    const workflows = { Fichas: { version: 1, steps: [{ type: 'resize', params: { maxEdge: 1600 } }] } };
    expect(writeWorkflows(workflows, storage)).toBe(true);
    expect(readWorkflows(storage)).toEqual(workflows);
  });
  it('drops malformed or unknown entries and survives invalid JSON', () => {
    const storage = memoryStorage({ [WORKFLOW_STORAGE_KEY]: JSON.stringify({ ok: { version: 1, steps: [] }, bad: { version: 1, steps: [{ type: 'eval', params: {} }] }, old: { version: 0, steps: [] } }) });
    expect(Object.keys(readWorkflows(storage))).toEqual(['ok']);
    expect(readWorkflows(memoryStorage({ [WORKFLOW_STORAGE_KEY]: '{' }))).toEqual({});
  });
  it('reports failure when storage throws', () => {
    const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(readWorkflows(blocked)).toEqual({});
    expect(writeWorkflows({}, blocked)).toBe(false);
  });
});

describe('image engine helpers', () => {
  it('keeps lossy formats when saving edits', () => {
    expect(saveFormatFor('image/jpeg')).toBe('image/jpeg');
    expect(saveFormatFor('image/webp')).toBe('image/webp');
    expect(saveFormatFor('image/gif')).toBe('image/png');
    expect(saveFormatFor('image/svg+xml')).toBe('image/png');
  });
  it('aligns the filename extension with the MIME type', () => {
    expect(nameForType('foto.jpg', 'image/png')).toBe('foto.png');
    expect(nameForType('foto.v2.jpeg', 'image/webp')).toBe('foto.v2.webp');
    expect(nameForType('sin-extension', 'image/jpeg')).toBe('sin-extension.jpg');
    expect(nameForType('foto.jpg', 'application/octet-stream')).toBe('foto.jpg');
  });
  it('crops centered by ratio without distortion', () => {
    const crop = getCrop({ cropRatio: 1, cropTop: 0, cropRight: 0, cropBottom: 0, cropLeft: 0 }, 400, 200);
    expect(crop).toEqual({ sx: 100, sy: 0, sw: 200, sh: 200 });
  });
});
