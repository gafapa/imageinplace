import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { offlineBuild } from './offline-build.mjs';

const directories = [];
afterEach(async () => { await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true }))); });

async function workerWithFailure(operation) {
  const root = await mkdtemp(join(tmpdir(), 'imageinplace-cache-test-'));
  directories.push(root);
  await mkdir(join(root, 'dist/ai'), { recursive: true });
  await writeFile(join(root, 'dist/index.html'), '<html>Test</html>');
  await writeFile(join(root, 'dist/ai/model.onnx'), 'synthetic model');
  const plugin = offlineBuild();
  plugin.configResolved({ root, build: { outDir: 'dist' } });
  await plugin.closeBundle();
  const listeners = new Map();
  runInNewContext(await readFile(join(root, 'dist/sw.js'), 'utf8'), {
    self: { location: { origin: 'https://example.test' }, addEventListener: (name, listener) => listeners.set(name, listener) },
    URL, Request,
    caches: { open: async () => {
      if (operation === 'open') throw new Error('Storage blocked');
      return {
        match: async () => { if (operation === 'match') throw new Error('Storage blocked'); },
        put: async () => { if (operation === 'put') throw new Error('Quota exceeded'); },
      };
    } },
    fetch: async () => new Response('network content', { status: 200 }),
  });
  return async (path) => {
    let response;
    listeners.get('fetch')({ request: new Request('https://example.test' + path), respondWith: (promise) => { response = promise; } });
    return await response;
  };
}

describe('optional offline storage', () => {
  for (const operation of ['open', 'match', 'put']) {
    it('returns downloaded optional assets when cache ' + operation + ' fails', async () => {
      const request = await workerWithFailure(operation);
      const response = await request('/ai/model.onnx');
      expect(response.status).toBe(200);
      expect(await response.text()).toBe('network content');
    });
  }
  it('keeps the online shell usable when cache storage is blocked', async () => {
    const request = await workerWithFailure('open');
    expect(await (await request('/index.html')).text()).toBe('network content');
  });
});
