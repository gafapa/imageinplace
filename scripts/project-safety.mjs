import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';

await mkdir('.impeccable/review/features', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
const requests = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('request', (request) => requests.push({ url: request.url(), method: request.method() }));
await page.addInitScript(() => {
  localStorage.setItem('imageinplace-welcome-dismissed', 'true');
  localStorage.setItem('imageinplace-locale', 'es');
  const NativeWorker = window.Worker;
  window.workerStarts = 0;
  window.workerStops = 0;
  // Delay worker dispatch to exercise cancellation deterministically without a huge fixture.
  window.Worker = class extends NativeWorker {
    postMessage(...args) {
      window.workerStarts += 1;
      this.dispatchTimer = setTimeout(() => super.postMessage(...args), 400);
    }
    terminate() { clearTimeout(this.dispatchTimer); window.workerStops += 1; super.terminate(); }
  };
});
const images = page.locator('.image-card-select');
const sources = () => page.locator('.image-thumb img').evaluateAll((values) => values.map((image) => image.dataset.sourceUrl));
const wouldWarn = () => page.evaluate(() => !window.dispatchEvent(new Event('beforeunload', { cancelable: true })));
try {
  await page.goto('http://127.0.0.1:4180');
  const fixture = await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 800;
    const context = canvas.getContext('2d'); context.fillStyle = '#fff'; context.fillRect(0, 0, 1200, 800);
    context.fillStyle = '#d02030'; context.fillRect(200, 150, 800, 500);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  const original = Buffer.from(fixture, 'base64');
  await page.locator('input[type=file]').first().setInputFiles([
    { name: 'photo.png', mimeType: 'image/png', buffer: original },
    { name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('invalid') },
    { name: 'huge.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="11000" height="10"/>') },
  ]);
  await images.first().waitFor();
  await page.getByRole('status').filter({ hasText: '1 imagen abierta.' }).waitFor();
  assert.equal(await images.count(), 1);
  assert.match(await page.locator('.gallery-notice').innerText(), /broken.png.*huge.svg/);
  assert.equal(await wouldWarn(), true);
  const size = await page.locator('.image-thumb img').first().evaluate((image) => [image.naturalWidth, image.naturalHeight]);
  assert.deepEqual(size, [480, 320]);
  const before = await sources();
  await page.getByRole('button', { name: 'Quitar fondo', exact: true }).click();
  const panel = page.locator('.gallery-side-panel');
  await panel.getByRole('button', { name: 'Quitar fondo', exact: true }).click();
  await panel.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await panel.getByRole('alert').filter({ hasText: 'Operación cancelada' }).waitFor();
  assert.deepEqual(await sources(), before);
  assert.equal(await page.evaluate(() => window.workerStarts > 0 && window.workerStops > 0), true);
  await panel.getByRole('button', { name: 'Quitar fondo', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('.background-panel'));
  assert.notDeepEqual(await sources(), before);
  await page.getByLabel('Proyecto local', { exact: true }).click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Guardar proyecto', exact: true }).click();
  const download = await downloaded;
  const path = '.impeccable/review/features/roundtrip.iip';
  await download.saveAs(path);
  await page.getByRole('status').filter({ hasText: 'Proyecto preparado' }).waitFor();
  assert.equal(await wouldWarn(), false);
  const bytes = await readFile(path);
  assert.equal(bytes.subarray(0, 8).toString(), 'IIPROJ02');
  const length = bytes.readUInt32LE(8);
  const manifest = JSON.parse(bytes.subarray(12, 12 + length).toString());
  const entry = manifest.items[0];
  assert.deepEqual(bytes.subarray(12 + length + entry.original.offset, 12 + length + entry.original.offset + entry.original.length), original);
  assert.equal(entry.original.sha256, createHash('sha256').update(original).digest('hex'));
  const unchanged = await sources();
  const damaged = Buffer.from(bytes); damaged[12 + length + entry.original.offset] ^= 1;
  const damagedChooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Abrir proyecto', exact: true }).click();
  await (await damagedChooser).setFiles({ name: 'damaged.iip', mimeType: 'application/octet-stream', buffer: damaged });
  await page.locator('.gallery-notice').filter({ hasText: 'La integridad del proyecto no coincide' }).waitFor();
  assert.deepEqual(await sources(), unchanged, 'Damaged payloads must not change the gallery');
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Abrir proyecto', exact: true }).click();
  await (await chooserPromise).setFiles(path);
  await page.getByRole('status').filter({ hasText: 'Proyecto abierto.' }).waitFor();
  assert.equal(await images.count(), 2);
  assert.equal(await wouldWarn(), true);
  const restored = await page.locator('.image-thumb img').nth(1).evaluate(async (image) => {
    const blob = await (await fetch(image.dataset.sourceUrl)).blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
    const context = canvas.getContext('2d'); context.drawImage(bitmap, 0, 0); bitmap.close();
    return Array.from(context.getImageData(0, 0, 1, 1).data);
  });
  assert.equal(restored[3], 0);
  await page.getByRole('button', { name: 'Más acciones', exact: true }).click(); await page.getByRole('button', { name: 'Restaurar originales seleccionados', exact: true }).click();
  const restoredBytes = await page.locator('.image-thumb img').nth(1).evaluate(async (image) => Array.from(new Uint8Array(await (await fetch(image.dataset.sourceUrl)).arrayBuffer())));
  assert.deepEqual(Buffer.from(restoredBytes), original);
  // Version-one projects still open, with an explicit warning that hashes are absent.
  const legacyManifest = structuredClone(manifest); legacyManifest.version = 1;
  for (const item of legacyManifest.items) { delete item.current.sha256; delete item.original.sha256; }
  const legacyHeader = Buffer.from(JSON.stringify(legacyManifest)); const legacyPrefix = Buffer.alloc(12);
  legacyPrefix.write('IIPROJ01'); legacyPrefix.writeUInt32LE(legacyHeader.length, 8);
  const legacyChooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Abrir proyecto', exact: true }).click();
  await (await legacyChooser).setFiles({ name: 'legacy.iip', mimeType: 'application/octet-stream', buffer: Buffer.concat([legacyPrefix, legacyHeader, bytes.subarray(12 + length, bytes.length - 32)]) });
  await page.locator('.gallery-notice').filter({ hasText: 'Proyecto antiguo abierto sin hashes' }).waitFor();
  assert.equal(await images.count(), 3);
  const previous = await sources();
  const invalidChooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Abrir proyecto', exact: true }).click();
  await (await invalidChooser).setFiles({ name: 'broken.iip', mimeType: 'application/octet-stream', buffer: Buffer.from('broken') });
  await page.locator('.gallery-notice').filter({ hasText: 'Tamaño de proyecto no válido' }).waitFor();
  assert.deepEqual(await sources(), previous);
  await page.getByLabel('Proyecto local', { exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.getByLabel('Proyecto local', { exact: true }).click();
  assert.notEqual(await page.getByRole('button', { name: 'Abrir proyecto', exact: true }).evaluate((button) => getComputedStyle(button).fontSize), '0px', 'Mobile project actions must have visible text');
  assert.ok((await page.getByRole('button', { name: 'Abrir proyecto', exact: true }).boundingBox()).width >= 200, 'Mobile menu actions must use the available menu width');
  const menuBounds = await page.locator('.project-menu-actions').boundingBox();
  assert.ok(menuBounds.x >= 0 && menuBounds.x + menuBounds.width <= 390, 'Project menu must remain inside the mobile viewport');
  await page.screenshot({ path: '.impeccable/review/features/project-mobile.png' });
  // Cancel after the first image completes: no part of a two-image batch may commit.
  await page.getByLabel('Proyecto local', { exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: 'Quitar selección', exact: true }).click();
  await page.locator('input[type=file]').first().setInputFiles(['first.png', 'second.png'].map((name) => ({ name, mimeType: 'image/png', buffer: original })));
  await page.getByRole('status').filter({ hasText: '2 imágenes abiertas.' }).waitFor();
  const batchBefore = await sources();
  await page.getByRole('button', { name: 'Quitar fondo', exact: true }).click();
  await panel.getByRole('button', { name: 'Quitar fondo', exact: true }).click();
  await panel.getByRole('status').filter({ hasText: 'Procesando 1/2' }).waitFor();
  await panel.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await panel.getByRole('alert').filter({ hasText: 'Operación cancelada' }).waitFor();
  assert.deepEqual(await sources(), batchBefore, 'Cancellation after one staged result must leave the whole batch unchanged');
  assert.equal(requests.some(({ url, method }) => method !== 'GET' || /^https?:/.test(url) && !url.startsWith('http://127.0.0.1:4180/')), false);
  assert.deepEqual(errors, []);
  console.log('Project roundtrip, original bytes, import rejection, memory limits, worker cancellation, unload protection, mobile and local requests passed.');
} finally { await browser.close(); }
