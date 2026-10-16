import { describe, expect, it } from 'vitest';
import { clipPrivacyArea, privacyAreaToSource, privacyAreaToView } from './privacyGeometry.js';

const crop = { sx: 80, sy: 30, sw: 240, sh: 180 };
const area = { x: .2, y: .3, width: .25, height: .2, mode: 'fill' };
describe('privacy coordinates', () => {
  for (const rotation of [0, 90, 180, 270, -90, -180, -270]) {
    for (const flip of [false, true]) {
      it('preserves source coordinates through crop, turn ' + rotation + ' and flip ' + flip, () => {
        const source = privacyAreaToSource(area, crop, 400, 240, rotation, flip);
        const view = privacyAreaToView(source, crop, 400, 240, rotation, flip);
        for (const key of ['x', 'y', 'width', 'height']) expect(view[key]).toBeCloseTo(area[key], 10);
        expect(view.mode).toBe('fill');
      });
    }
  }
  it('moves an existing source rectangle with a clockwise rotation', () => {
    const view = privacyAreaToView({ x: .2, y: .2, width: .2, height: .2 }, { sx: 0, sy: 0, sw: 160, sh: 100 }, 160, 100, 90, false);
    expect(view.x).toBeCloseTo(.6);
    expect(view.y).toBeCloseTo(.2);
  });
  it('clips a cropped view without losing the hidden source area', () => {
    const source = { x: 0, y: 0, width: .1, height: .1, mode: 'fill' };
    const view = clipPrivacyArea(privacyAreaToView(source, crop, 400, 240, 0, false));
    expect(view.width * view.height).toBe(0);
    const restored = clipPrivacyArea(privacyAreaToView(source, { sx: 0, sy: 0, sw: 400, sh: 240 }, 400, 240, 0, false));
    expect(restored).toEqual(source);
  });
});
