import { describe, expect, it } from 'vitest';
import { isTextEntry, shortcutFor } from './shortcuts.js';

const key = (value, modifiers = {}) => ({ key: value, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...modifiers });
const element = (tagName, type) => ({ tagName, getAttribute: (name) => (name === 'type' ? type ?? null : null) });

describe('shortcutFor', () => {
  it('maps undo and both redo forms, with Ctrl or Cmd', () => {
    expect(shortcutFor(key('z', { ctrlKey: true }))).toBe('undo');
    expect(shortcutFor(key('Z', { metaKey: true, shiftKey: true }))).toBe('redo');
    expect(shortcutFor(key('y', { ctrlKey: true }))).toBe('redo');
  });
  it('maps selection, saving and navigation', () => {
    expect(shortcutFor(key('a', { ctrlKey: true }))).toBe('selectAll');
    expect(shortcutFor(key('s', { metaKey: true }))).toBe('save');
    expect(shortcutFor(key('Delete'))).toBe('delete');
    expect(shortcutFor(key('PageDown'))).toBe('next');
  });
  it('ignores unrelated or modified keys', () => {
    expect(shortcutFor(key('z'))).toBeNull();
    expect(shortcutFor(key('Delete', { shiftKey: true }))).toBeNull();
    expect(shortcutFor(key('z', { ctrlKey: true, altKey: true }))).toBeNull();
  });
});

describe('isTextEntry', () => {
  it('protects text fields but not sliders, checkboxes or buttons', () => {
    expect(isTextEntry(element('INPUT', 'text'))).toBe(true);
    expect(isTextEntry(element('INPUT'))).toBe(true);
    expect(isTextEntry(element('INPUT', 'number'))).toBe(true);
    expect(isTextEntry(element('TEXTAREA'))).toBe(true);
    expect(isTextEntry(element('INPUT', 'range'))).toBe(false);
    expect(isTextEntry(element('INPUT', 'checkbox'))).toBe(false);
    expect(isTextEntry(element('BUTTON'))).toBe(false);
  });
});
