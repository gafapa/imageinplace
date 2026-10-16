import { describe, expect, it, vi } from 'vitest';
import { decodeHeicPixels } from './heicDecode.js';

function fixture(width, height, failure = false) {
  const image = {
    get_width: () => width, get_height: () => height,
    display: vi.fn((output, done) => done(failure ? null : output)), free: vi.fn(),
  };
  const decoder = { decode: vi.fn(() => [image]), free: vi.fn() };
  return { image, decoder, library: { HeifDecoder: class { constructor() { return decoder; } } } };
}
describe('HEIC worker limits', () => {
  for (const [width, height] of [[10000, 10000], [10001, 1], [0, 1], [-1, 1], [Infinity, 1], [1.5, 1]]) {
    it('rejects ' + width + ' by ' + height + ' before rendering pixels and frees resources', async () => {
      const { image, decoder, library } = fixture(width, height);
      await expect(decodeHeicPixels(library, new ArrayBuffer(1))).rejects.toThrow();
      expect(image.display).not.toHaveBeenCalled();
      expect(image.free).toHaveBeenCalledOnce();
      expect(decoder.free).toHaveBeenCalledOnce();
    });
  }
  it('returns validated pixels and frees the decoder', async () => {
    const { image, library } = fixture(2, 3);
    const result = await decodeHeicPixels(library, new ArrayBuffer(1));
    expect(result.pixels.length).toBe(24);
    expect(image.free).toHaveBeenCalledOnce();
  });
  it('frees decoder resources after display fails', async () => {
    const { image, decoder, library } = fixture(2, 3, true);
    await expect(decodeHeicPixels(library, new ArrayBuffer(1))).rejects.toThrow();
    expect(image.free).toHaveBeenCalledOnce();
    expect(decoder.free).toHaveBeenCalledOnce();
  });
});
