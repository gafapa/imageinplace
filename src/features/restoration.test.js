import { describe, expect, it } from 'vitest';
import { analyzePixels, restorePixels } from './restoration.js';
import { encodeWebImage, hasTransparency } from './webExport.js';

const image = (values, width = values.length) => ({ width, height: values.length / width, data: new Uint8ClampedArray(values.flatMap((value) => [value, value, value, 255])) });
describe('local restoration and suggestions', () => {
  it('removes isolated dust without changing alpha', () => {
    const pixels = image([100,100,100,100,255,100,100,100,100], 3);
    restorePixels(pixels, { dust: 100 });
    expect(pixels.data[16]).toBe(100);
    expect([...pixels.data].filter((_, index) => index % 4 === 3)).toEqual(Array(9).fill(255));
  });
  it('reduces small noise and preserves a strong edge', () => {
    const pixels = image([30,30,220,30,40,220,30,30,220], 3);
    restorePixels(pixels, { noise: 100 });
    expect(pixels.data[16]).toBeLessThan(40);
    expect(pixels.data[20]).toBeGreaterThan(210);
  });
  it('expands faded tonal ranges, but keeps flat images stable', () => {
    const pixels = image([80,100,120,140,160]);
    restorePixels(pixels, { faded: 100 });
    expect(pixels.data[0]).toBe(0); expect(pixels.data[16]).toBe(255);
    const flat = image([120,120]); restorePixels(flat, { faded: 100 }); expect(flat.data[0]).toBe(120);
  });
  it('increases local edge contrast when sharpening mild blur', () => {
    const pixels = image([50,50,150,150]);
    restorePixels(pixels, { sharpen: 100 });
    expect(pixels.data[4]).toBeLessThan(50);
    expect(pixels.data[8]).toBeGreaterThan(150);
  });
  it('ignores hidden pixels, suggests brightening dark captures, and handles empty alpha', () => {
    const pixels = image([30,40,50]); pixels.data[3] = 0;
    const report = analyzePixels(pixels);
    expect(report.count).toBe(2); expect(report.low).toBe(40); expect(report.suggestions.exposure).toBeGreaterThan(0);
    pixels.data.fill(0); expect(analyzePixels(pixels).suggestions.exposure).toBe(0);
  });
  it('leaves bytes unchanged at zero strength and detects partial alpha for export', () => {
    const pixels = image([20,80,160]); const before = pixels.data.slice();
    restorePixels(pixels, {}); expect(pixels.data).toEqual(before); expect(hasTransparency(pixels)).toBe(false);
    pixels.data[7] = 254; expect(hasTransparency(pixels)).toBe(true);
  });
  it('rejects cancelled exports before starting a codec', async () => {
    const controller = new AbortController(); controller.abort();
    await expect(encodeWebImage({ width: 10, height: 10 }, 'auto', 0.8, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });
});
