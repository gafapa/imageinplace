import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { chromium } from 'playwright';

const root = resolve('dist');
const originalWorker = await readFile(resolve(root, 'sw.js'), 'utf8');
let variant = 'original';
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  const filename = resolve(root, `.${url.pathname === '/' ? '/index.html' : url.pathname}`);
  if (!filename.startsWith(root + sep)) { response.writeHead(403); response.end(); return; }
  try {
    let bytes = await readFile(filename);
    if (url.pathname === '/sw.js') {
      let source = originalWorker;
      if (variant !== 'original') source = source.replace("const CACHE = CACHE_PREFIX + '", `const CACHE = CACHE_PREFIX + '${variant}-`);
      if (variant === 'failed') source = source.replace('const ASSETS = [', 'const ASSETS = ["/missing-asset.js",');
      bytes = Buffer.from(source);
    }
    const type = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' }[extname(filename)] || 'text/plain';
    response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }); response.end(bytes);
  } catch { response.writeHead(404); response.end('Missing asset'); }
});
await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
try {
  const context = await browser.newContext();
  await context.addInitScript(() => localStorage.setItem('imageinplace-welcome-dismissed', 'true'));
  const page = await context.newPage(); await page.goto(origin);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.evaluate(() => caches.open('unrelated-cache'));
  const other = await context.newPage(); await other.goto(origin);
  const fixture = { name: 'fixture.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="60" height="40"><rect width="60" height="40" fill="red"/></svg>') };
  await page.locator('input[type=file]').first().setInputFiles(fixture);
  await page.locator('.image-card-select').first().waitFor();
  variant = 'update';
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
  await page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration()).waiting);
  await page.getByLabel('Proyecto local', { exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Actualización preparada' }).waitFor();
  assert.equal(await page.locator('.image-card-select').count(), 1, 'Preparing an update must not reload or discard an open workspace');
  const waitingCaches = await page.evaluate(() => caches.keys());
  assert.equal(waitingCaches.filter((key) => key.startsWith('imageinplace-shell-')).length, 2);
  await page.close(); await other.close();
  const current = await context.newPage(); await current.goto(origin);
  await current.waitForFunction(async () => {
    const keys = (await caches.keys()).filter((key) => key.startsWith('imageinplace-shell-'));
    return !!navigator.serviceWorker.controller && keys.length === 1 && keys[0].includes('update-');
  });
  assert.ok((await current.evaluate(() => caches.keys())).includes('unrelated-cache'));
  // An incomplete next build must fail without deleting the active offline cache.
  variant = 'failed';
  await current.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    await registration.update();
    const worker = registration.installing;
    if (worker && worker.state !== 'redundant') await new Promise((resolveState) => worker.addEventListener('statechange', () => { if (worker.state === 'redundant') resolveState(); }));
  });
  const keys = await current.evaluate(() => caches.keys());
  assert.equal(keys.some((key) => key.includes('failed-')), false);
  assert.equal(keys.filter((key) => key.startsWith('imageinplace-shell-')).length, 1);
  await context.setOffline(true); await current.reload();
  await current.locator('input[type=file]').first().setInputFiles(fixture);
  await current.locator('.image-card-select').first().waitFor();
  assert.equal(await current.locator('.image-card-select').count(), 1);
  console.log('Offline lifecycle passed: updates wait for open tabs, preserve work, activate safely, retain unrelated caches, and roll back incomplete installs.');
} finally { await browser.close(); await new Promise((resolveClose) => server.close(resolveClose)); }
