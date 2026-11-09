import { describe, expect, it } from 'vitest';
import { cropBounds, defaultCorners, perspectiveSize, projectPoint, rotationSize, squareToQuad, validateCorners, warpPerspective } from './geometry.js';

describe('document geometry', () => {
  it('expands a fine rotation without clipping the source and preserves zero-angle dimensions', () => {
    expect(rotationSize(600, 400, 0)).toEqual({ width: 600, height: 400 });
    expect(rotationSize(600, 400, 10)).toEqual({ width: 661, height: 499 });
    expect(() => rotationSize(600, 400, NaN)).toThrow();
    expect(() => rotationSize(10000, 4000, 15)).toThrow();
  });
  it('maps normalized crop edges into exact pixel boundaries', () => {
    expect(cropBounds(600, 400, { x: 0.1, y: 0.1, width: 0.8, height: 0.8 })).toEqual({ x: 60, y: 40, width: 480, height: 320 });
    expect(() => cropBounds(600, 400, { x: 0.5, y: 0, width: 0.8, height: 1 })).toThrow();
    expect(() => cropBounds(10, 10, { x: 0, y: 0, width: 0.001, height: 1 })).toThrow();
  });
  it('maps all four destination corners to the selected source quadrilateral', () => {
    const points = [{ x: 0.2, y: 0.1 }, { x: 0.9, y: 0.15 }, { x: 0.85, y: 0.9 }, { x: 0.05, y: 0.8 }];
    const matrix = squareToQuad(points);
    defaultCorners().forEach((point, index) => {
      const output = projectPoint(matrix, point.x, point.y);
      expect(output.x).toBeCloseTo(points[index].x, 9);
      expect(output.y).toBeCloseTo(points[index].y, 9);
    });
    expect(perspectiveSize(600, 400, defaultCorners())).toEqual({ width: 600, height: 400 });
  });
  it('rejects crossed, reversed, collapsed, concave and out-of-image corners', () => {
    for (const points of [
      [defaultCorners()[0], defaultCorners()[2], defaultCorners()[1], defaultCorners()[3]],
      defaultCorners().reverse(),
      Array(4).fill({ x: 0.5, y: 0.5 }),
      [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.2, y: 0.2 }, { x: 0, y: 1 }],
      [{ x: -0.1, y: 0 }, ...defaultCorners().slice(1)],
    ]) expect(() => validateCorners(points)).toThrow();
  });
  it('preserves every pixel through the identity transform', () => {
    const data = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 128, 0, 0, 255, 255, 255, 255, 0, 255]);
    expect(warpPerspective({ width: 2, height: 2, data }, defaultCorners(), { width: 2, height: 2 })).toEqual(data);
  });
  it('resamples a rectangle to its exact inner pixels without distortion', () => {
    const data = new Uint8ClampedArray(4 * 4 * 4);
    for (let i = 0; i < 16; i += 1) data.set([i * 10, i, 0, 255], i * 4);
    const points = [{ x: 0.25, y: 0.25 }, { x: 0.75, y: 0.25 }, { x: 0.75, y: 0.75 }, { x: 0.25, y: 0.75 }];
    expect([...warpPerspective({ width: 4, height: 4, data }, points, { width: 2, height: 2 })]).toEqual([50, 5, 0, 255, 60, 6, 0, 255, 90, 9, 0, 255, 100, 10, 0, 255]);
  });
  it('blends transparency without contaminating visible colors', () => {
    const output = warpPerspective({ width: 2, height: 1, data: new Uint8ClampedArray([255, 0, 0, 0, 0, 0, 255, 255]) }, defaultCorners(), { width: 1, height: 1 });
    expect([...output]).toEqual([0, 0, 255, 128]);
  });
  it('rectifies a trapezoid with non-linear vertical sampling', () => {
    const data = new Uint8ClampedArray(10 * 10 * 4);
    for (let y = 0; y < 10; y += 1) for (let x = 0; x < 10; x += 1) data.set([x * 10, y * 10, 0, 255], (y * 10 + x) * 4);
    const points = [{ x: 0.2, y: 0.1 }, { x: 0.8, y: 0.1 }, { x: 1, y: 0.9 }, { x: 0, y: 0.9 }];
    // Independent coordinates: top samples at (1/3, 7/30), bottom at (2/7, 43/70).
    expect([...warpPerspective({ width: 10, height: 10, data }, points, { width: 2, height: 2 })]).toEqual([28, 18, 0, 255, 62, 18, 0, 255, 24, 56, 0, 255, 66, 56, 0, 255]);
  });
});
