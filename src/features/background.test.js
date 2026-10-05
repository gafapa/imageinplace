import { describe, expect, it } from 'vitest';
import { estimateBackground, findContentBounds, removeBackground } from './background.js';

/** Build an RGBA image filled with `background`, then paint rectangles over it. */
function image(width, height, background, rects = []) {
  const data = new Uint8ClampedArray(width * height * 4);
  const paint = (x0, y0, w, h, [r, g, b, a = 255]) => {
    for (let y = y0; y < y0 + h; y += 1) for (let x = x0; x < x0 + w; x += 1) {
      const o = (y * width + x) * 4; data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = a;
    }
  };
  paint(0, 0, width, height, background);
  rects.forEach(([x, y, w, h, color]) => paint(x, y, w, h, color));
  return { data, width, height };
}
const alphaAt = ({ data, width }, x, y) => data[(y * width + x) * 4 + 3];

describe('estimateBackground', () => {
  it('finds the dominant border colour', () => {
    const result = estimateBackground(image(20, 20, [250, 250, 250], [[0, 0, 3, 3, [10, 10, 10]]]));
    expect(result.transparent).toBe(false);
    expect(result.color).toEqual([250, 250, 250]);
  });
  it('recognises an already transparent border', () => {
    expect(estimateBackground(image(10, 10, [0, 0, 0, 0])).transparent).toBe(true);
  });
});

describe('removeBackground', () => {
  it('clears the edge-connected background and keeps the subject', () => {
    const img = image(30, 30, [255, 255, 255], [[10, 10, 10, 10, [200, 30, 40]]]);
    const { removedShare } = removeBackground(img, { tolerance: 10, softness: 0 });
    expect(alphaAt(img, 0, 0)).toBe(0);
    expect(alphaAt(img, 15, 15)).toBe(255);
    expect(removedShare).toBeCloseTo(800 / 900, 5);
  });
  it('keeps enclosed areas of the background colour unless interior is enabled', () => {
    // A red ring with a white hole in the middle, like the inside of a letter "o".
    const build = () => image(30, 30, [255, 255, 255], [[5, 5, 20, 20, [200, 30, 40]], [12, 12, 6, 6, [255, 255, 255]]]);
    const edgeOnly = build();
    removeBackground(edgeOnly, { tolerance: 10, softness: 0 });
    expect(alphaAt(edgeOnly, 15, 15)).toBe(255);
    const everywhere = build();
    removeBackground(everywhere, { tolerance: 10, softness: 0, interior: true });
    expect(alphaAt(everywhere, 15, 15)).toBe(0);
  });
  it('fades near-background edge pixels and unmixes the background colour', () => {
    const img = image(20, 20, [255, 255, 255], [[5, 5, 10, 10, [0, 0, 0]], [4, 5, 1, 10, [230, 230, 230]]]);
    removeBackground(img, { tolerance: 5, softness: 10 });
    const alpha = alphaAt(img, 4, 8);
    expect(alpha).toBeGreaterThan(0);
    expect(alpha).toBeLessThan(255);
    const o = (8 * 20 + 4) * 4;
    expect(img.data[o]).toBeLessThan(230);
  });
  it('does nothing on an image that is already transparent', () => {
    const img = image(10, 10, [0, 0, 0, 0], [[3, 3, 4, 4, [0, 0, 255]]]);
    expect(removeBackground(img).removedShare).toBe(0);
    expect(alphaAt(img, 4, 4)).toBe(255);
  });
});

describe('findContentBounds', () => {
  it('finds the box around content on a solid border', () => {
    const { bounds } = findContentBounds(image(40, 30, [255, 255, 255], [[7, 4, 10, 12, [0, 0, 0]], [25, 20, 2, 3, [0, 0, 200]]]));
    expect(bounds).toEqual({ x: 7, y: 4, width: 20, height: 19 });
  });
  it('uses transparency when the border is transparent', () => {
    const { bounds, background } = findContentBounds(image(20, 20, [0, 0, 0, 0], [[2, 3, 5, 6, [255, 255, 255]]]));
    expect(background.transparent).toBe(true);
    expect(bounds).toEqual({ x: 2, y: 3, width: 5, height: 6 });
  });
  it('ignores faint noise within the tolerance and reports empty images', () => {
    expect(findContentBounds(image(20, 20, [255, 255, 255], [[5, 5, 2, 2, [250, 250, 250]]]), { tolerance: 8 }).bounds).toBeNull();
  });
});
