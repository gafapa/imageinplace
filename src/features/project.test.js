import { describe, expect, it } from 'vitest';
import { openProject, saveProject, sha256, validateProjectManifest } from './project';
import { validateDimensions, validateWorkspace, MAX_WORKSPACE_BYTES } from './imageLimits';
import { retainedBytes } from './useImageHistory';

const manifest = () => ({ version: 1, items: [{ name: 'photo.png', originalName: 'photo.png', lastModified: 0,
  current: { offset: 0, length: 10, type: 'image/png' }, original: { offset: 0, length: 10, type: 'image/png' } }] });

describe('local project validation', () => {
  it('accepts a shared original/current payload without duplicating its range', () => {
    expect(() => validateProjectManifest(manifest(), 10)).not.toThrow();
  });
  it('rejects overlapping, out-of-range, conflicting and unexpected data', () => {
    for (const original of [
      { offset: 5, length: 5, type: 'image/png' },
      { offset: 10, length: 10, type: 'image/png' },
      { offset: 0, length: 10, type: 'text/html' },
      { offset: 0, length: 9, type: 'image/png' },
    ]) {
      const value = manifest(); value.items[0].original = original;
      expect(() => validateProjectManifest(value, 10)).toThrow();
    }
    expect(() => validateProjectManifest(manifest(), 11)).toThrow();
  });
  it('rejects wrong versions and invalid item metadata', () => {
    const value = manifest(); value.version = 99;
    expect(() => validateProjectManifest(value, 10)).toThrow();
    value.version = 1; value.items[0].name = null;
    expect(() => validateProjectManifest(value, 10)).toThrow();
  });
  it('requires valid and consistent hashes in version two', () => {
    const value = manifest(); value.version = 2;
    expect(() => validateProjectManifest(value, 10)).toThrow();
    value.items[0].current.sha256 = 'a'.repeat(64); value.items[0].original.sha256 = 'a'.repeat(64);
    expect(() => validateProjectManifest(value, 10)).not.toThrow();
    value.items[0].original.sha256 = 'b'.repeat(64);
    expect(() => validateProjectManifest(value, 10)).toThrow();
  });
  it('matches the standard SHA-256 vector', async () => {
    expect(await sha256(new Blob(['abc']))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
  it('rejects damaged payloads and metadata before attempting to decode images', async () => {
    const image = new Blob(['abc'], { type: 'image/png' }); const url = URL.createObjectURL(image);
    try {
      const saved = await saveProject([{ id: 'fixture', url, originalUrl: url, name: 'photo.png', originalName: 'photo.png', type: image.type, size: 3, width: 1, height: 1, file: image }]);
      const bytes = new Uint8Array(await saved.arrayBuffer());
      const headerLength = new DataView(bytes.buffer).getUint32(8, true);
      bytes[12 + headerLength] ^= 1;
      await expect(openProject(new Blob([bytes]))).rejects.toThrow(/integridad/);
      const headerBytes = new Uint8Array(await saved.arrayBuffer());
      const text = new TextDecoder().decode(headerBytes.slice(12, 12 + headerLength));
      const changed = text.replace('photo.png', 'other.png');
      headerBytes.set(new TextEncoder().encode(changed), 12);
      await expect(openProject(new Blob([headerBytes]))).rejects.toThrow(/integridad/);
    } finally { URL.revokeObjectURL(url); }
  });
});

describe('memory bounds', () => {
  it('rejects huge dimensions even when a compressed file is tiny', () => {
    expect(() => validateDimensions(10000, 10000)).toThrow();
    expect(() => validateDimensions(4000, 10000)).not.toThrow();
    expect(() => validateDimensions(Infinity, 2)).toThrow();
  });
  it('counts originals after resizing and independent encoded copies', () => {
    const item = { width: 100, height: 100, originalWidth: 10000, originalHeight: 4000, size: 1 };
    expect(() => validateWorkspace(Array(4).fill(item))).toThrow();
    expect(() => validateWorkspace([{ url: 'a', originalUrl: 'b', size: MAX_WORKSPACE_BYTES / 2 + 1, originalSize: MAX_WORKSPACE_BYTES / 2 }])).toThrow();
  });
  it('counts history resources once across snapshots', () => {
    const item = { url: 'edited', size: 10, originalUrl: 'original', originalSize: 20 };
    expect(retainedBytes([[item], [item], [{ ...item, url: 'other', size: 30 }]])).toBe(60);
  });
});
