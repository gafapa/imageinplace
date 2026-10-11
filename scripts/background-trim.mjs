import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';

// End-to-end checks for "Quitar fondo" and "Recortar al contenido" in the gallery and the editor.
const output = '.impeccable/review/features';
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const problems = [];
page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
page.on('console', (message) => { if (message.type() === 'error') problems.push(`console: ${message.text()}`); });
await page.addInitScript(() => { localStorage.setItem('imageinplace-welcome-dismissed', 'true'); localStorage.setItem('imageinplace-locale', 'es'); });
await page.goto(process.env.TEST_URL || 'http://127.0.0.1:4180');

// A JPEG logo: a red disc on white with 100 px margins left/right and 60 px top/bottom.
const makeJpeg = (name) => page.evaluate((fileName) => {
  const canvas = document.createElement('canvas'); canvas.width = 400; canvas.height = 320;
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff'; context.fillRect(0, 0, 400, 320);
  context.fillStyle = '#d02030'; context.beginPath(); context.arc(200, 160, 100, 0, Math.PI * 2); context.fill();
  return { name: fileName, data: canvas.toDataURL('image/jpeg', 0.95).split(',')[1] };
}, name);
const files = await Promise.all(['logo.jpg', 'sello.jpg'].map(makeJpeg));
await page.locator('input[type=file]').first().setInputFiles(files.map(({ name, data }) => ({ name, mimeType: 'image/jpeg', buffer: Buffer.from(data, 'base64') })));
await page.locator('.image-card-select').nth(1).waitFor();

const action = async (name) => {
  const button = page.getByRole('button', { name, exact: true });
  if (!(await button.isVisible())) await page.getByRole('button', { name: 'Más acciones', exact: true }).click();
  await button.click();
};
const sidebar = page.locator('.gallery-side-panel');
const thumbInfo = (index) => page.locator('.image-thumb img').nth(index).evaluate(async (image) => {
  const blob = await (await fetch(image.dataset.sourceUrl || image.src)).blob();
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
  const context = canvas.getContext('2d'); context.drawImage(bitmap, 0, 0);
  const pixel = (x, y) => Array.from(context.getImageData(x, y, 1, 1).data);
  return { type: blob.type, width: bitmap.width, height: bitmap.height, corner: pixel(0, 0), center: pixel(bitmap.width / 2, bitmap.height / 2) };
});

// Batch: remove the background of both images.
await action('Quitar fondo');
await sidebar.locator('.background-preview figcaption').filter({ hasText: 'eliminado' }).waitFor();
await page.screenshot({ path: `${output}/background-batch.png` });
await sidebar.getByRole('button', { name: 'Quitar fondo', exact: true }).click();
await page.waitForFunction(() => !document.querySelector('.background-panel'));
const removed = await thumbInfo(0);
assert.equal(removed.type, 'image/png', 'Transparent result must be PNG');
assert.equal(removed.corner[3], 0, 'Background must become transparent');
assert.equal(removed.center[3], 255, 'Subject must stay opaque');
assert.match(await page.locator('.image-card-select').first().innerText(), /logo\.png/, 'Extension follows the new format');

// Batch: trim both to their content (the disc is 200 x 200).
await action('Recortar al contenido');
await sidebar.locator('.background-preview figcaption').filter({ hasText: '→' }).waitFor();
await sidebar.getByRole('button', { name: 'Recortar', exact: true }).click();
await page.waitForFunction(() => !document.querySelector('.background-panel'));
const trimmed = await thumbInfo(0);
assert.ok(Math.abs(trimmed.width - 200) <= 2 && Math.abs(trimmed.height - 200) <= 2, `Trim must fit the disc, got ${trimmed.width}x${trimmed.height}`);
assert.equal(trimmed.type, 'image/png');

// Exporting a transparent image as JPEG paints the background white, not black.
await page.getByRole('button', { name: 'Exportar imágenes seleccionadas', exact: true }).click();
// Transparent PNGs default to PNG export; choose JPEG explicitly.
assert.equal(await sidebar.locator('input[name="format"]:checked').inputValue(), 'image/png', 'PNG images must default to PNG export');
await sidebar.locator('input[name="format"][value="image/jpeg"]').check();
const download = page.waitForEvent('download');
await sidebar.getByRole('button', { name: 'Descargar', exact: true }).click();
const zipPath = await (await download).path();
const { default: JSZip } = await import('jszip');
const zip = await JSZip.loadAsync(await readFile(zipPath));
const jpegBase64 = await zip.file(Object.keys(zip.files)[0]).async('base64');
const exportedCorner = await page.evaluate(async (data) => {
  // The app's CSP blocks fetch() of data: URLs, so decode through an <img> instead.
  const bitmap = await new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = `data:image/jpeg;base64,${data}`; });
  const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
  const context = canvas.getContext('2d'); context.drawImage(bitmap, 0, 0);
  return Array.from(context.getImageData(0, 0, 1, 1).data);
}, jpegBase64);
assert.ok(exportedCorner.slice(0, 3).every((value) => value > 240), `JPEG export corner must be white, got ${exportedCorner}`);

// Editor: undo to the original JPEG, then remove the background from the individual editor.
await action('Restaurar originales seleccionados');
await page.locator('.image-card-edit').first().click();
await page.locator('.tool-rail').getByRole('button', { name: 'Quitar fondo', exact: true }).click();
await page.locator('.settings-panel .background-preview figcaption').filter({ hasText: 'eliminado' }).waitFor();
await page.locator('.settings-panel').getByRole('button', { name: 'Quitar fondo', exact: true }).click();
await page.waitForFunction(() => !document.querySelector('.settings-panel .background-panel'));
await page.locator('.tool-rail').getByRole('button', { name: 'Recortar al contenido', exact: true }).click();
await page.locator('.settings-panel .background-preview figcaption').filter({ hasText: '→' }).waitFor();
await page.screenshot({ path: `${output}/trim-editor.png` });
await page.locator('.settings-panel').getByRole('button', { name: 'Recortar', exact: true }).click();
await page.waitForFunction(() => !document.querySelector('.settings-panel .background-panel'));
await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
await page.waitForFunction(() => !document.querySelector('.editor-shell'));
const edited = await thumbInfo(0);
assert.equal(edited.type, 'image/png');
assert.equal(edited.corner[3], 0);
assert.ok(Math.abs(edited.width - 200) <= 2, `Editor trim width ${edited.width}`);

assert.deepEqual(problems, [], 'No page errors or CSP violations');
await browser.close();
console.log('Background/trim checks passed: batch removal, batch trim, white JPEG export, editor removal + trim + save.');
