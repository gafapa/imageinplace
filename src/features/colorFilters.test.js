import { describe, expect, it } from 'vitest';
import { applyColorSteps, blurImageData, boxesForGauss, colorSteps } from './colorFilters.js';

const pixel = (r, g, b, a = 255) => new Uint8ClampedArray([r, g, b, a]);
const run = (settings, data) => { applyColorSteps(data, colorSteps(settings)); return Array.from(data); };

describe('colorSteps', () => {
  it('skips identity settings', () => {
    expect(colorSteps({ brightness: 100, contrast: 100, saturation: 100, grayscale: 0, sepia: 0 })).toEqual([]);
  });
  it('scales brightness and clamps', () => {
    expect(run({ brightness: 50 }, pixel(200, 100, 10))).toEqual([100, 50, 5, 255]);
    expect(run({ brightness: 200 }, pixel(200, 100, 10))).toEqual([255, 200, 20, 255]);
  });
  it('pivots contrast around mid grey', () => {
    expect(run({ contrast: 0 }, pixel(10, 200, 250))).toEqual([128, 128, 128, 255]);
    expect(run({ contrast: 200 }, pixel(64, 128, 192))).toEqual([0, 128, 255, 255]);
  });
  it('turns colour fully grey with grayscale(100%) and keeps alpha', () => {
    const [r, g, b, a] = run({ grayscale: 100 }, pixel(255, 0, 0, 90));
    expect(r).toBe(g); expect(g).toBe(b); expect(a).toBe(90);
    expect(r).toBe(54);
  });
  it('removes saturation at 0%', () => {
    const [r, g, b] = run({ saturation: 0 }, pixel(0, 0, 255));
    expect(r).toBe(g); expect(g).toBe(b);
  });
  it('applies brightness before contrast, with clamping between steps', () => {
    // brightness(200%) clamps 200 → 255 before contrast(50%) maps it to 191.
    expect(run({ brightness: 200, contrast: 50 }, pixel(200, 200, 200))[0]).toBe(191);
  });
});

describe('blurImageData', () => {
  it('keeps a uniform opaque interior unchanged', () => {
    const width = 21; const height = 21;
    const data = new Uint8ClampedArray(width * height * 4).fill(180);
    for (let i = 3; i < data.length; i += 4) data[i] = 255;
    blurImageData({ data, width, height }, 1);
    const centre = (10 * width + 10) * 4;
    expect(Array.from(data.slice(centre, centre + 4))).toEqual([180, 180, 180, 255]);
  });
  it('spreads a single dot without bleeding colour from transparent pixels', () => {
    const width = 9; const height = 9;
    const data = new Uint8ClampedArray(width * height * 4);
    const centre = (4 * width + 4) * 4;
    data.set([255, 0, 0, 255], centre);
    blurImageData({ data, width, height }, 1.5);
    expect(data[centre + 3]).toBeLessThan(255);
    const neighbour = centre + 4;
    expect(data[neighbour + 3]).toBeGreaterThan(0);
    expect(data[neighbour]).toBe(255);
    expect(data[neighbour + 1]).toBe(0);
  });
  it('builds three odd box sizes', () => {
    const boxes = boxesForGauss(4);
    expect(boxes).toHaveLength(3);
    boxes.forEach((box) => expect(box % 2).toBe(1));
  });
});
