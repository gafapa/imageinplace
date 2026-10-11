import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';

/** Runtimes and models fetched only when an on-device tool is used. */
const isOnDemand = (path) => path.startsWith('/ai/') || /\.(wasm|onnx|traineddata\.gz)$/.test(path);

/** Precache only build artifacts; imported images and project files never enter this cache. */
export function offlineBuild() {
  let outputDirectory;
  return {
    name: 'offline-app-shell',
    apply: 'build',
    configResolved(config) { outputDirectory = resolve(config.root, config.build.outDir); },
    async closeBundle() {
      const files = [];
      const visit = async (directory) => {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
          const path = resolve(directory, entry.name);
          if (entry.isDirectory()) await visit(path);
          else if (entry.name !== 'sw.js') files.push(path);
        }
      };
      await visit(outputDirectory);
      files.sort();
      const hash = createHash('sha256');
      hash.update(offlineBuild.toString());
      const onDemandHash = createHash('sha256');
      const assets = [];
      const onDemand = [];
      for (const file of files) {
        const path = `/${relative(outputDirectory, file).split(sep).join('/')}`;
        const content = await readFile(file);
        if (isOnDemand(path)) { onDemand.push(path); onDemandHash.update(path); onDemandHash.update(content); continue; }
        assets.push(path); hash.update(path); hash.update(content);
      }
      const onDemandVersion = onDemandHash.digest('hex').slice(0, 24);
      hash.update(onDemandVersion);
      const version = hash.digest('hex').slice(0, 24);
      const source = `// Generated from the complete production build, including lazy chunks and workers.
const CACHE_PREFIX = 'imageinplace-shell-';
const CACHE = CACHE_PREFIX + '${version}';
const ASSETS = ${JSON.stringify(assets)};
const ALLOWED = new Set(ASSETS);
// Large AI/OCR/HEIC files: cached on first use, not at install, and kept across app updates while unchanged.
const ON_DEMAND_PREFIX = 'imageinplace-ondemand-';
const ON_DEMAND_CACHE = ON_DEMAND_PREFIX + '${onDemandVersion}';
const ON_DEMAND = new Set(${JSON.stringify(onDemand)});
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    try { await cache.addAll(ASSETS.map((path) => new Request(path, { cache: 'reload' }))); }
    catch (cause) { await caches.delete(CACHE); throw cause; }
  })());
});
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if ((key.startsWith(CACHE_PREFIX) && key !== CACHE) || (key.startsWith(ON_DEMAND_PREFIX) && key !== ON_DEMAND_CACHE)) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (ON_DEMAND.has(url.pathname) && !url.search) {
    event.respondWith((async () => {
      let cache;
      let cached;
      try { cache = await caches.open(ON_DEMAND_CACHE); cached = await cache.match(url.pathname); }
      catch { /* Storage is optional; online tools must still work. */ }
      if (cached) return cached;
      const response = await fetch(request);
      if (cache && response.ok && response.status === 200) {
        try { await cache.put(url.pathname, response.clone()); }
        catch { /* A full cache must not discard a successful download. */ }
      }
      return response;
    })());
    return;
  }
  const navigation = request.mode === 'navigate' && (url.pathname === '/' || url.pathname === '/index.html');
  if (!navigation && (!ALLOWED.has(url.pathname) || url.search)) return;
  event.respondWith((async () => {
    try {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(navigation ? '/index.html' : url.pathname);
      if (cached) return cached;
    } catch { /* Fall back to the network when browser storage is unavailable. */ }
    return fetch(request);
  })());
});
`;
      await writeFile(resolve(outputDirectory, 'sw.js'), source, 'utf8');
    },
  };
}
