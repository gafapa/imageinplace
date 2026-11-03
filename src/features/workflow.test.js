import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyWorkflow } from './workflow.js';

afterEach(() => vi.unstubAllGlobals());

function mockCanvas() {
  vi.stubGlobal('Image', class {
    naturalWidth = 100;
    naturalHeight = 80;
    set src(value) { this.url = value; queueMicrotask(() => this.onload()); }
  });
  vi.stubGlobal('document', { createElement: () => ({ getContext: () => ({ drawImage() {}, translate() {}, rotate() {} }), toBlob(callback) { callback(new Blob(['pixels'], { type: 'image/png' })); } }) });
}

describe('workflow rotation dimensions', () => {
  it.each([[90, 80, 100], [180, 100, 80], [270, 80, 100], [-90, 80, 100], [360, 100, 80]])('keeps exact dimensions at %s degrees', async (degrees, width, height) => {
    mockCanvas();
    const result = await applyWorkflow({ url: 'blob:test', name: 'image.png', type: 'image/png' }, { steps: [{ type: 'rotate', params: { degrees } }] });
    expect({ width: result.width, height: result.height }).toEqual({ width, height });
  });

  it('rejects non-finite rotation output before allocating a canvas', async () => {
    mockCanvas();
    await expect(applyWorkflow({ url: 'blob:test' }, { steps: [{ type: 'rotate', params: { degrees: Infinity } }] })).rejects.toThrow();
  });
});
