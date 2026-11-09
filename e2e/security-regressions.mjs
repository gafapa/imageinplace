import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import JSZip from 'jszip';

const url = process.env.TEST_URL || 'http://127.0.0.1:4180';
const output = 'artifacts/browser/security';
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
  const blocked = await browser.newPage();
  const startupErrors = [];
  blocked.on('pageerror', (error) => startupErrors.push(error.message));
  await blocked.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('Blocked', 'SecurityError'); } });
  });
  await blocked.goto(url);
  await blocked.locator('.home-shell').waitFor();
  assert.deepEqual(startupErrors, [], 'Blocked storage must not prevent application startup');
  await blocked.close();

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    try {
      localStorage.setItem('imageinplace-welcome-dismissed', 'true');
      localStorage.setItem('imageinplace-locale', 'es');
      localStorage.setItem('imageinplace-workflows-v1', JSON.stringify({ 'Keep me': { version: 1, steps: [] } }));
    } catch { /* storage may be blocked */ }
  });
  await page.goto(url);
  const fixture = (name) => ({ name, mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="80"><rect width="100" height="80" fill="#428abd"/></svg>') });
  await page.locator('input[type=file]').setInputFiles([fixture('Photo.svg'), fixture('photo.svg')]);
  await page.locator('.image-card-edit').first().waitFor();
  await page.getByRole('button', { name: 'Exportar imágenes seleccionadas', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('.gallery-side-panel').getByRole('button', { name: 'Descargar', exact: true }).click();
  const download = await downloadPromise;
  const archive = await JSZip.loadAsync(await readFile(await download.path()));
  const files = Object.keys(archive.files);
  assert.equal(files.length, 2);
  assert.equal(new Set(files.map((name) => name.toLowerCase())).size, 2, 'ZIP entries must remain unique on case-insensitive filesystems');
  assert.ok(files.every((name) => !/[\\/]/.test(name)));

  await page.getByRole('button', { name: 'Más acciones', exact: true }).click();
  await page.getByRole('button', { name: 'Flujos reutilizables', exact: true }).click();
  await page.getByRole('combobox', { name: 'Cargar flujo guardado', exact: true }).selectOption('Keep me');
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'imageinplace-workflows-v1') throw new DOMException('Blocked', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await page.getByRole('button', { name: 'Borrar flujo', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'No se pudo guardar en este navegador.' }).waitFor();
  assert.equal(await page.getByRole('combobox', { name: 'Cargar flujo guardado', exact: true }).inputValue(), 'Keep me');
  assert.ok(await page.evaluate(() => JSON.parse(localStorage.getItem('imageinplace-workflows-v1'))['Keep me']));

  assert.deepEqual(errors, []);
  console.log('Security regressions passed: blocked-storage startup, safe ZIP names, durable workflow deletion.');
} finally { await browser.close(); }
