import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';

// Regression checks for the review fixes: CSP-clean console, format preservation on save,
// solid privacy fill, rejected-file notice and a titled A4 PDF.
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const problems = [];
page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
page.on('console', (message) => { if (message.type() === 'error') problems.push(`console: ${message.text()}`); });
await page.addInitScript(() => { localStorage.setItem('imageinplace-welcome-dismissed', 'true'); localStorage.setItem('imageinplace-locale', 'es'); });
await page.goto(process.env.TEST_URL || 'http://127.0.0.1:4180');

const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
assert.match(csp, /connect-src 'self' blob:/, 'Production build must ship the CSP');

const jpegBase64 = await page.evaluate(() => {
  const canvas = document.createElement('canvas'); canvas.width = 800; canvas.height = 600;
  const context = canvas.getContext('2d');
  for (let x = 0; x < 800; x += 40) { context.fillStyle = `hsl(${x / 2}, 70%, 50%)`; context.fillRect(x, 0, 40, 600); }
  return canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
});
const jpeg = { name: 'foto.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(jpegBase64, 'base64') };
const heic = { name: 'movil.heic', mimeType: 'image/heic', buffer: Buffer.from('not really heic') };
await page.locator('input[type=file]').setInputFiles([jpeg, heic]);
await page.locator('.image-card-select').first().waitFor();
assert.equal(await page.locator('.image-card-select').count(), 1);
assert.match(await page.locator('.gallery-notice').innerText(), /movil\.heic/, 'Rejected files must be reported');

// Batch adjust keeps JPEG and the .jpg name.
await page.getByRole('button', { name: 'Mejorar imágenes seleccionadas', exact: true }).click();
await page.locator('.gallery-side-panel input[type=range]').first().fill('140');
await page.getByRole('button', { name: 'Aplicar', exact: true }).click();
await page.waitForFunction(() => !document.querySelector('.batch-panel'));
const cardText = await page.locator('.image-card-select').first().innerText();
assert.match(cardText, /foto\.jpg/);
const savedType = await page.locator('.image-thumb img').first().evaluate(async (image) => (await (await fetch(image.dataset.sourceUrl || image.src)).blob()).type);
assert.equal(savedType, 'image/jpeg', 'Batch apply must keep JPEG');

// Editor: solid fill hides the area completely and saving keeps JPEG.
await page.locator('.image-card-edit').first().click();
await page.getByRole('button', { name: 'Ocultar', exact: true }).click();
await page.getByRole('button', { name: 'Nueva zona centrada', exact: true }).click();
await page.getByRole('button', { name: 'Tapar', exact: true }).click();
const center = await page.locator('.editor-shell canvas').evaluate((canvas) => Array.from(canvas.getContext('2d').getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data));
assert.deepEqual(center, [0, 0, 0, 255], 'Fill mode must paint the area solid');
await page.getByRole('button', { name: 'Guardar edición', exact: true }).click();
await page.waitForFunction(() => !document.querySelector('.editor-shell'));
const editedType = await page.locator('.image-thumb img').first().evaluate(async (image) => (await (await fetch(image.dataset.sourceUrl || image.src)).blob()).type);
assert.equal(editedType, 'image/jpeg', 'Editor save must keep JPEG');

// Titled A4 PDF is generated with pdf-lib loaded on demand.
await page.getByRole('button', { name: 'Crear láminas A4', exact: true }).click();
await page.getByLabel('Título opcional', { exact: true }).fill('Unidad 3 — Ecosistemas');
const download = page.waitForEvent('download');
await page.getByRole('button', { name: /Descargar PDF/ }).click();
const pdfPath = await (await download).path();
const { readFile } = await import('node:fs/promises');
const pdf = await PDFDocument.load(await readFile(pdfPath));
assert.equal(pdf.getPageCount(), 1);

assert.deepEqual(problems.filter((line) => !/favicon/.test(line)), [], 'No page errors or CSP violations');
await browser.close();
console.log('Review fix checks passed: CSP, rejected-file notice, JPEG preservation (batch + editor), solid privacy fill, titled PDF.');
