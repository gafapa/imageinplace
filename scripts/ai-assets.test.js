import { describe, expect, it, vi } from 'vitest';
import { aiAssets } from './ai-assets.mjs';

function middleware() {
  const plugin = aiAssets();
  plugin.configResolved({ root: '/missing-test-workspace' });
  let handler;
  plugin.configureServer({ middlewares: { use(value) { handler = value; } } });
  return handler;
}

describe('development asset routing', () => {
  it.each(['/constructor', '/toString', '/__proto__', '/ai/vendor/../secret'])('passes unknown and inherited paths to the next handler: %s', async (url) => {
    const next = vi.fn();
    await middleware()({ url }, {}, next);
    expect(next).toHaveBeenCalledExactlyOnceWith();
  });

  it('returns a controlled response for invalid percent encoding', async () => {
    const response = { end: vi.fn() };
    const next = vi.fn();
    await middleware()({ url: '/ai/%E0%A4%A' }, response, next);
    expect(response.statusCode).toBe(400);
    expect(response.end).toHaveBeenCalledWith('Invalid URL');
    expect(next).not.toHaveBeenCalled();
  });

  it('passes missing asset errors to Connect instead of leaving a rejected promise', async () => {
    const next = vi.fn();
    await middleware()({ url: '/ai/vendor/tesseract/worker.min.js' }, {}, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'ENOENT' }));
  });
});
