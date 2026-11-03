import { afterEach, describe, expect, it, vi } from 'vitest';
import { encodeWebImage } from './webExport.js';
import { detectFaces } from './ai/onDevice.js';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); vi.restoreAllMocks(); });

const pixels = () => ({ width: 1, height: 1, data: new Uint8ClampedArray([20, 30, 40, 255]) });
const canvas = () => ({ width: 1, height: 1, getContext: () => ({ getImageData: pixels }) });

describe('worker startup and transfer failures', () => {
  it('terminates an AVIF worker and removes its abort listener and timeout after a failed transfer', async () => {
    vi.useFakeTimers();
    const terminate = vi.fn();
    vi.stubGlobal('Worker', class { terminate = terminate; postMessage() { throw new DOMException('Cannot clone', 'DataCloneError'); } });
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, 'removeEventListener');
    await expect(encodeWebImage(canvas(), 'image/avif', 0.8, controller.signal)).rejects.toMatchObject({ name: 'DataCloneError' });
    expect(terminate).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects and releases an AVIF worker after a deserialization error', async () => {
    const terminate = vi.fn();
    vi.stubGlobal('Worker', class { terminate = terminate; postMessage() { queueMicrotask(() => this.onmessageerror()); } });
    await expect(encodeWebImage(canvas(), 'image/avif')).rejects.toThrow('Invalid AVIF worker response');
    expect(terminate).toHaveBeenCalledOnce();
  });

  it('removes pending AI requests when construction fails and permits a retry', async () => {
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => ({ drawImage() {}, getImageData: pixels }) }) });
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, 'removeEventListener');
    vi.stubGlobal('Worker', class { constructor() { throw new Error('Worker blocked'); } });
    await expect(detectFaces(canvas(), { signal: controller.signal })).rejects.toThrow('Worker blocked');
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));

    const terminate = vi.fn();
    vi.stubGlobal('Worker', class { terminate = terminate; postMessage() { throw new Error('Transfer failed'); } });
    await expect(detectFaces(canvas())).rejects.toThrow('Transfer failed');
    expect(terminate).toHaveBeenCalledOnce();
  });
});
