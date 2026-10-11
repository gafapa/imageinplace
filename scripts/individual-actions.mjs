import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

await mkdir('.impeccable/review/features', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(10000);
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
await page.addInitScript(() => { localStorage.setItem('imageinplace-welcome-dismissed', 'true'); localStorage.setItem('imageinplace-locale', 'es'); });
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#1479dd"/></svg>';
const editor = page.locator('.individual-editor');
const tool = (name) => editor.getByRole('button', { name, exact: true }).click();
const open = () => page.locator('.image-card-edit').first().click();
const urls = () => page.locator('.image-thumb img').evaluateAll((images) => images.map((image) => image.dataset.sourceUrl || image.src));
const dimensions = async (width, height) => page.waitForFunction(([w, h]) => {
  const canvas = document.querySelector('.individual-editor canvas');
  return canvas?.width === w && canvas?.height === h;
}, [width, height]);
try {
  await page.goto('http://127.0.0.1:4180');
  await page.locator('input[type=file]').setInputFiles(['a.svg', 'b.svg'].map((name) => ({name, mimeType:'image/svg+xml', buffer:Buffer.from(svg)})));
  await page.locator('.image-card-edit').first().waitFor();
  const originalUrls = await urls();
  assert.equal(originalUrls.length, 2);
  await page.locator('.image-card-compare').first().click();
  await page.getByRole('slider', {name:'Deslizador Antes y Después'}).press('End');
  await page.getByRole('button', {name:'Comparar imagen siguiente'}).click();
  await page.keyboard.press('Escape');
  assert.deepEqual(await urls(), originalUrls);
  assert.equal(await page.locator('.image-card-select[aria-pressed=true]').count(), 2);

  await open();
  await tool('Girar'); await tool('Derecha');
  await dimensions(180, 320);
  await tool('Lienzo');
  await editor.getByLabel('Ancho del lienzo (px)', {exact:true}).fill('400');
  await editor.getByLabel('Alto del lienzo (px)', {exact:true}).fill('400');
  await editor.getByLabel('Relleno alrededor (px)', {exact:true}).fill('20');
  await page.screenshot({path:'.impeccable/review/features/individual-new-tools-desktop.png'});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'.impeccable/review/features/individual-new-tools-mobile.png'});
  await page.setViewportSize({width:1440,height:900});
  await tool('Crear lienzo'); await dimensions(400, 400);
  const pixel = await editor.locator('canvas').evaluate((canvas) => Array.from(canvas.getContext('2d').getImageData(30, 200, 1, 1).data));
  assert.deepEqual(pixel, [255,255,255,255], 'Canvas must receive rotated draft and not rotate again');
  await tool('Deshacer'); await dimensions(180, 320);
  await tool('Rehacer'); await dimensions(400, 400);
  await tool('Cancelar edición');
  assert.deepEqual(await urls(), originalUrls, 'Applied draft must be discarded by Cancel');

  await open(); await tool('Renombrar');
  await editor.getByLabel('Patrón', {exact:true}).fill('Nombre-nuevo');
  await tool('Aplicar nombres');
  await tool('Deshacer'); assert.match(await editor.locator('h2').first().innerText(), /a.svg/);
  await tool('Rehacer'); assert.match(await editor.locator('h2').first().innerText(), /Nombre-nuevo.svg/);
  await tool('Guardar edición'); await editor.waitFor({state:'detached'});
  const renamed = (await urls())[0];
  assert.equal(await page.evaluate(async (url) => (await fetch(url)).text(), renamed), svg, 'Rename must preserve original bytes');
  assert.equal((await urls())[1], originalUrls[1]);

  await open(); await tool('Comprimir');
  await editor.getByLabel('Tamaño máximo por imagen (KB)').fill('20');
  await tool('Comprimir selección'); await tool('Aplicar resultados');
  await tool('Guardar edición'); await editor.waitFor({state:'detached'});
  const compressed = await page.evaluate(async (url) => { const blob = await (await fetch(url)).blob(); return {type:blob.type,size:blob.size}; }, (await urls())[0]);
  assert.equal(compressed.type, 'image/jpeg'); assert.ok(compressed.size <= 20 * 1024);
  assert.equal((await urls())[1], originalUrls[1]);

  await open(); await tool('Flujo');
  await tool('Añadir paso'); await editor.getByLabel('Máximo (px)', {exact:true}).fill('100');
  await editor.getByLabel('Tipo de paso').selectOption('rename'); await tool('Añadir paso');
  await editor.getByLabel('Patrón', {exact:true}).fill('Final-{n}');
  await tool('Aplicar flujo'); await dimensions(100,56);
  await tool('Guardar edición'); await editor.waitFor({state:'detached'});
  assert.equal(await page.locator('.image-card-meta strong').first().innerText(), 'Final-01.jpg');
  assert.equal((await urls())[1], originalUrls[1]);
  assert.deepEqual(errors, []);
  console.log('Individual checks passed: read-only comparison, rotated draft canvas, local undo/redo, cancel isolation, rename bytes, compressed JPEG preservation, workflow naming, selection isolation.');
} finally { await browser.close(); }
