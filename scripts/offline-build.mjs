import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';

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
      const assets = [];
      for (const file of files) {
        const path = `/${relative(outputDirectory, file).split(sep).join('/')}`;
        assets.push(path); hash.update(path); hash.update(await readFile(file));
      }
      const version = hash.digest('hex').slice(0, 24);
      const source = `// Generated from the complete production build, including lazy chunks and workers.
const CACHE_PREFIX = 'imageinplace-shell-';
const CACHE = CACHE_PREFIX + '${version}';
const ASSETS = ${JSON.stringify(assets)};
const ALLOWED = new Set(ASSETS);
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    try { await cache.addAll(ASSETS.map((path) => new Request(path, { cache: 'reload' }))); }
    catch (cause) { await caches.delete(CACHE); throw cause; }
  })());
});
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith(CACHE_PREFIX) && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  const navigation = request.mode === 'navigate' && (url.pathname === '/' || url.pathname === '/index.html');
  if (!navigation && (!ALLOWED.has(url.pathname) || url.search)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    return await cache.match(navigation ? '/index.html' : url.pathname) || fetch(request);
  })());
});
`;
      await writeFile(resolve(outputDirectory, 'sw.js'), source, 'utf8');
    },
  };
}
