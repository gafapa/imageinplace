import { describe, expect, it } from 'vitest';
import { restorePixels } from './restoration.js';

const image = (values, width = values.length) => ({ width, height: values.length / width, data: new Uint8ClampedArray(values.flatMap((value) => [value, value, value, 255])) });
describe('local restoration', () => {
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
  it('ignores hidden pixels when measuring the tonal range', () => {
    const pixels = image([0,100,200]); pixels.data[3] = 0;
    restorePixels(pixels, { faded: 100 });
    expect(pixels.data[4]).toBe(0); expect(pixels.data[8]).toBe(255);
  });
  it('leaves bytes unchanged at zero strength', () => {
    const pixels = image([20,80,160]); const before = pixels.data.slice();
    restorePixels(pixels, {}); expect(pixels.data).toEqual(before);
  });
});
