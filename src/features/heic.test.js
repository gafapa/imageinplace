import { afterEach, describe, expect, it, vi } from 'vitest';
import { convertHeicToJpeg } from './heic.js';
afterEach(() => vi.unstubAllGlobals());
describe('native HEIC dimension rejection', () => {
  it('does not fall back to a worker after native decoding exceeds the pixel limit', async () => {
    vi.stubGlobal('Image', class {
      naturalWidth = 10000; naturalHeight = 10000;
      set src(value) { void value; queueMicrotask(() => this.onload()); }
    });
    const worker = vi.fn();
    vi.stubGlobal('Worker', worker);
    await expect(convertHeicToJpeg(new File(['synthetic'], 'large.heic', { type: 'image/heic' }))).rejects.toThrow('40');
    expect(worker).not.toHaveBeenCalled();
  });
});
