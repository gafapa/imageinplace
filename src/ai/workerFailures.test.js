import { afterEach, describe, expect, it, vi } from 'vitest';
import { detectFaces } from './onDevice.js';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); vi.restoreAllMocks(); });

const pixels = () => ({ width: 1, height: 1, data: new Uint8ClampedArray([20, 30, 40, 255]) });
const canvas = () => ({ width: 1, height: 1, getContext: () => ({ getImageData: pixels }) });

describe('worker startup and transfer failures', () => {
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
