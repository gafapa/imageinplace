import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';

await mkdir('.impeccable/review/features', { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (cause) => errors.push(cause.message));
page.on('dialog', (dialog) => dialog.accept());
await page.addInitScript(() => { localStorage.setItem('imageinplace-welcome-dismissed', 'true'); localStorage.setItem('imageinplace-locale', 'es'); });
const editor = page.locator('.individual-editor');
const open = () => page.locator('.image-card-edit').first().click();
const tool = (name) => editor.getByRole('button', { name, exact: true }).click();
const fullInfo = () => page.locator('.image-thumb img').first().evaluate(async (image) => {
  const blob = await (await fetch(image.dataset.sourceUrl)).blob(); const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
  const context = canvas.getContext('2d'); context.drawImage(bitmap, 0, 0); bitmap.close();
  return { width: canvas.width, height: canvas.height, center: [...context.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data], corner: [...context.getImageData(0, 0, 1, 1).data] };
});
const fileFromCanvas = () => page.evaluate(() => {
  const canvas = document.createElement('canvas'); canvas.width = 600; canvas.height = 400;
  const context = canvas.getContext('2d'); context.fillStyle = '#fff'; context.fillRect(0, 0, 600, 400);
  context.fillStyle = '#d02030'; context.fillRect(60, 40, 480, 320);
  return canvas.toDataURL('image/png').split(',')[1];
});
try {
  await page.goto('http://127.0.0.1:4180');
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.getByLabel('Proyecto local', { exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Preparado para usar sin conexión.' }).waitFor();
  await page.getByLabel('Proyecto local', { exact: true }).click();
  const original = Buffer.from(await fileFromCanvas(), 'base64');
  const fixture = { name: 'document.png', mimeType: 'image/png', buffer: original };
  await page.locator('input[type=file]').first().setInputFiles(fixture);
  await page.locator('.image-card-edit').first().waitFor();
  // Fine rotation expands the bounds, remains staged until save, and supports draft undo/redo.
  await open(); await tool('Enderezar');
  await editor.getByLabel('Ángulo exacto (°)').fill('10');
  await editor.getByRole('status').filter({ hasText: 'Resultado: 661 × 499 px' }).waitFor();
  await page.screenshot({ path: '.impeccable/review/features/deskew-desktop.png' });
  await tool('Aplicar enderezado');
  await page.waitForFunction(() => !document.querySelector('.geometry-controls'));
  await tool('Deshacer');
  await page.waitForFunction(() => document.querySelector('.individual-editor canvas')?.width === 600);
  await tool('Rehacer');
  await page.waitForFunction(() => document.querySelector('.individual-editor canvas')?.width === 661);
  assert.equal((await fullInfo()).width, 600, 'Geometry must remain in the draft until Save');
  await tool('Guardar cambios'); await editor.waitFor({ state: 'detached' });
  assert.equal((await fullInfo()).width, 661);
  await page.getByRole('button', { name: 'Más acciones', exact: true }).click(); await page.getByRole('button', { name: 'Restaurar originales seleccionados', exact: true }).click();
  // A crop starts with exact 10% margins; changing a handle with the keyboard updates the output.
  await open(); await tool('Recortar'); await tool('Recorte visual: arrastrar el marco');
  const handle = editor.getByRole('button', { name: 'Esquina superior izquierda', exact: true });
  await handle.press('ArrowRight');
  assert.equal(await editor.getByLabel('Izquierda (%)').inputValue(), '10.5');
  await editor.getByLabel('Izquierda (%)').fill('10');
  await editor.getByLabel('Ancho (%)').fill('80');
  await page.screenshot({ path: '.impeccable/review/features/crop-desktop.png' });
  await tool('Aplicar recorte'); await page.waitForFunction(() => !document.querySelector('.geometry-controls'));
  await tool('Guardar cambios'); await editor.waitFor({ state: 'detached' });
  assert.deepEqual(await fullInfo(), { width: 480, height: 320, center: [208, 32, 48, 255], corner: [208, 32, 48, 255] });
  await page.getByRole('button', { name: 'Más acciones', exact: true }).click(); await page.getByRole('button', { name: 'Restaurar originales seleccionados', exact: true }).click();
  // Four-corner selection uses a worker and crops an axis-aligned quadrilateral exactly.
  await open(); await tool('Perspectiva');
  await page.waitForFunction(() => document.querySelector('.geometry-controls') || document.querySelector('.workspace-error'));
  const cornerSelect = editor.getByLabel('Esquina', { exact: true });
  assert.equal(await editor.getByRole('button', { name: 'Guardar cambios', exact: true }).isEnabled(), false, 'Pending geometry must be applied or cancelled before Save');
  await editor.getByLabel('Horizontal (%)').fill('100'); await editor.getByLabel('Vertical (%)').fill('100');
  await editor.getByRole('alert').filter({ hasText: 'sin cruces' }).waitFor();
  assert.equal(await editor.getByRole('button', { name: 'Corregir perspectiva', exact: true }).isEnabled(), false);
  assert.equal(await editor.locator('.geometry-result canvas').isVisible(), false);
  await editor.getByRole('button', { name: 'Restablecer selección', exact: true }).click();
  for (const [index, x, y] of [[0, 10, 10], [1, 90, 10], [2, 90, 90], [3, 10, 90]]) {
    await cornerSelect.selectOption(String(index));
    await editor.getByLabel('Horizontal (%)').fill(String(x)); await editor.getByLabel('Vertical (%)').fill(String(y));
  }
  await editor.getByRole('status').filter({ hasText: 'Resultado: 480 × 320 px' }).waitFor();
  await page.screenshot({ path: '.impeccable/review/features/perspective-desktop.png' });
  await tool('Corregir perspectiva'); await page.waitForFunction(() => !document.querySelector('.geometry-controls'));
  await tool('Guardar cambios'); await editor.waitFor({ state: 'detached' });
  assert.deepEqual(await fullInfo(), { width: 480, height: 320, center: [208, 32, 48, 255], corner: [208, 32, 48, 255] });
  // Cancelling the editor after applying a correction leaves the gallery source unchanged.
  const sourceBefore = await page.locator('.image-thumb img').first().getAttribute('data-source-url');
  await open(); await tool('Enderezar'); await editor.getByLabel('Ángulo exacto (°)').fill('-3');
  await tool('Aplicar enderezado'); await page.waitForFunction(() => !document.querySelector('.geometry-controls'));
  await tool('Descartar'); await editor.waitFor({ state: 'detached' });
  assert.equal(await page.locator('.image-thumb img').first().getAttribute('data-source-url'), sourceBefore);
  // Actual pointer input moves the crop frame; touch and mobile keep controls inside the viewport.
  await page.setViewportSize({ width: 390, height: 844 });
  await open(); await tool('Recortar'); await tool('Recorte visual: arrastrar el marco');
  const move = await editor.getByRole('button', { name: 'Mover recorte', exact: true }).boundingBox();
  await page.mouse.move(move.x + move.width / 2, move.y + move.height / 2); await page.mouse.down();
  await page.mouse.move(move.x + move.width / 2 + 10, move.y + move.height / 2 + 5); await page.mouse.up();
  assert.ok(Number(await editor.getByLabel('Izquierda (%)').inputValue()) > 10);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: '.impeccable/review/features/crop-mobile.png' });
  assert.notEqual(await editor.getByRole('button', { name: 'Restablecer selección', exact: true }).evaluate((button) => getComputedStyle(button).fontSize), '0px');
  await tool('Descartar'); await editor.waitFor({ state: 'detached' });
  const cacheEntries = await page.evaluate(async () => {
    const values = [];
    for (const key of await caches.keys()) if (key.startsWith('imageinplace-shell-')) for (const request of await (await caches.open(key)).keys()) values.push(request.url);
    return values;
  });
  assert.ok(cacheEntries.some((url) => /geometryWorker/.test(url)));
  assert.ok(cacheEntries.some((url) => /pixelWorker/.test(url)));
  assert.equal(cacheEntries.some((url) => !url.startsWith('http://127.0.0.1:4180/') || url.endsWith('.iip') || url.startsWith('blob:')), false);
  // Disable the network, then reload and use lazy-loaded tools that were never requested by the UI.
  await context.setOffline(true); await page.reload();
  await page.locator('input[type=file]').first().setInputFiles([fixture, { ...fixture, name: 'second.png' }]); await page.locator('.image-card-edit').first().waitFor();
  await open(); await tool('Perspectiva'); await tool('Corregir perspectiva');
  await page.waitForFunction(() => !document.querySelector('.geometry-controls'));
  await tool('Guardar cambios'); await editor.waitFor({ state: 'detached' });
  await page.getByRole('button', { name: 'Más acciones', exact: true }).click(); await page.getByRole('button', { name: 'Crear láminas A4', exact: true }).click();
  const pdfDownload = page.waitForEvent('download'); await page.getByRole('button', { name: 'Descargar PDF', exact: true }).click();
  const pdfPath = await (await pdfDownload).path();
  assert.equal((await PDFDocument.load(await readFile(pdfPath))).getPageCount(), 1);
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.getByRole('button', { name: 'Exportar imágenes seleccionadas', exact: true }).click();
  const zipDownload = page.waitForEvent('download'); await page.locator('.batch-panel').getByRole('button', { name: 'Descargar', exact: true }).click();
  const zipBytes = await readFile(await (await zipDownload).path()); assert.equal(zipBytes.subarray(0, 2).toString(), 'PK');
  await page.getByLabel('Proyecto local', { exact: true }).click();
  const projectDownload = page.waitForEvent('download'); await page.getByRole('button', { name: 'Guardar proyecto', exact: true }).click();
  const bytes = await readFile(await (await projectDownload).path()); assert.equal(bytes.subarray(0, 8).toString(), 'IIPROJ02');
  assert.deepEqual(errors, []);
  console.log('Geometry checks passed: pixel output, fine rotation, draft history/save/cancel, keyboard, pointer, mobile, offline reload, workers, PDF, ZIP and hashed project export.');
} catch (cause) { await page.screenshot({ path: '.impeccable/review/features/geometry-failure.png' }); console.log('Geometry failure UI:', await page.locator('body').innerText(), errors); throw cause; } finally { await browser.close(); }
