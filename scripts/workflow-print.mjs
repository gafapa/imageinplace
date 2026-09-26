import assert from 'node:assert/strict';
import { createRenames } from '../src/features/rename.js';
import { printableLayout } from '../src/features/printableSheets.js';
import { readWorkflows } from '../src/features/workflow.js';

const portrait = printableLayout({ orientation: 'portrait', rows: 2, columns: 2, margin: 0, gap: 0, title: 'Fichas 日本語 😀' });
assert.equal(Math.round(portrait.width), 595);
assert.equal(Math.round(portrait.height), 842);
assert.equal(portrait.perPage, 4);
assert.equal(portrait.titleHeight, 18);

const names = createRenames(
  [{ id: 1, name: 'one.svg', type: 'image/png' }, { id: 2, name: 'two.jpg', type: 'image/png' }],
  { pattern: 'Ficha-{n}', start: 1, padding: 2 },
  [{ id: 1, name: 'one.svg' }, { id: 2, name: 'two.jpg' }, { id: 3, name: 'Ficha-01.png' }],
);
assert.deepEqual(names.map(({ name }) => name), ['Ficha-01 (2).png', 'Ficha-02.png']);

const storage = { value: JSON.stringify({ good: { version: 1, steps: [] }, bad: null, malformed: { version: 2, steps: [] }, array: [] }), getItem() { return this.value; } };
assert.deepEqual(Object.keys(readWorkflows(storage)), ['good']);
console.log('workflow-print regression checks passed');
