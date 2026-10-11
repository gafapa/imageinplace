import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// On-device AI/WASM checks against the production preview: HEIC import, AI background removal,
// face detection and OCR-assisted text covering, in Chromium and (for the WebAssembly models) WebKit.
const url = process.env.TEST_URL || 'http://127.0.0.1:4180/';

// Third-party sample files are downloaded once, verified, and kept outside the repository.
const FIXTURES = {
  'example.heic': { url: 'https://github.com/strukturag/libheif/raw/master/examples/example.heic', sha256: '7f8b363e4936c0666a25f64f3a92fda10bd8e5453be4592530b65a55dd98f3f2' },
  'group.jpg': { url: 'https://raw.githubusercontent.com/Linzaer/Ultra-Light-Fast-Generic-Face-Detector-1MB/master/imgs/1.jpg', sha256: '898e120bd162bd879649a9f26cce0feaf7fed5396db4766fac54ea6dd617829b' },
};
async function fixture(name) {
  const directory = resolve('node_modules/.cache/imageinplace-fixtures');
  const path = resolve(directory, name);
  let buffer = await readFile(path).catch(() => null);
  if (!buffer) {
    const response = await fetch(FIXTURES[name].url);
    assert.ok(response.ok, `Could not download fixture ${name}`);
    buffer = Buffer.from(await response.arrayBuffer());
    await mkdir(directory, { recursive: true });
    await writeFile(path, buffer);
  }
  assert.equal(createHash('sha256').update(buffer).digest('hex'), FIXTURES[name].sha256, `Fixture ${name} changed`);
  return buffer;
}

async function setup(browserType) {
  const browser = await browserType.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (cause) => errors.push(cause.message));
  page.on('console', (message) => { if (message.type() === 'error' && /Content Security Policy|Refused/.test(message.text())) errors.push(message.text()); });
  page.on('dialog', (dialog) => dialog.accept());
  await page.addInitScript(() => { localStorage.setItem('imageinplace-welcome-dismissed', 'true'); localStorage.setItem('imageinplace-locale', 'es'); });
  await page.goto(url);
  return { browser, page, errors };
}

const cards = (page) => page.locator('.image-grid .image-card:not(.add-image-card)');

/** A clear subject (orange disc) over a busy striped background that the uniform-colour method cannot remove. */
const subjectPng = (page) => page.evaluate(() => {
  const canvas = document.createElement('canvas'); canvas.width = 480; canvas.height = 360;
  const context = canvas.getContext('2d');
  for (let x = 0; x < 480; x += 24) { context.fillStyle = x % 48 ? '#9fb8c9' : '#c7d3a4'; context.fillRect(x, 0, 24, 360); }
  context.fillStyle = '#e8590c'; context.beginPath(); context.arc(240, 180, 110, 0, Math.PI * 2); context.fill();
  context.fillStyle = '#ffd8a8'; context.beginPath(); context.arc(205, 150, 22, 0, Math.PI * 2); context.fill();
  return canvas.toDataURL('image/jpeg', 0.92).split(',')[1];
}).then((base64) => ({ name: 'pelota.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(base64, 'base64') }));

const textPng = (page) => page.evaluate(() => {
  const canvas = document.createElement('canvas'); canvas.width = 900; canvas.height = 420;
  const context = canvas.getContext('2d');
  context.fillStyle = 'white'; context.fillRect(0, 0, 900, 420);
  context.fillStyle = 'black'; context.font = '600 40px Arial, sans-serif';
  context.fillText('Ficha de fracciones', 40, 80);
  context.fillText('Alumna: Ana Lopez Garcia', 40, 180);
  context.fillText('DNI: 12345678Z', 40, 280);
  return canvas.toDataURL('image/png').split(',')[1];
}).then((base64) => ({ name: 'ficha.png', mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') }));

const alphaAt = (page, points) => page.locator('.image-thumb img').first().evaluate(async (image, samples) => {
  const source = await new Promise((done, fail) => { const element = new Image(); element.onload = () => done(element); element.onerror = fail; element.src = image.dataset.sourceUrl; });
  const canvas = document.createElement('canvas'); canvas.width = source.naturalWidth; canvas.height = source.naturalHeight;
  const context = canvas.getContext('2d'); context.drawImage(source, 0, 0);
  return samples.map(([x, y]) => context.getImageData(Math.round(x * canvas.width), Math.round(y * canvas.height), 1, 1).data[3]);
}, points);

async function backgroundAndFaces(browserType, label) {
  const { browser, page, errors } = await setup(browserType);
  // AI background removal in the batch panel (JPEG photos default to the AI method).
  await page.locator('input[type=file]').setInputFiles(await subjectPng(page));
  await cards(page).first().waitFor();
  await page.getByRole('button', { name: 'Quitar fondo', exact: true }).click();
  const panel = page.locator('.background-panel');
  // Busy borders (a photo, not a flat-colour logo) make the panel suggest the AI method.
  await panel.getByRole('radio', { name: 'Automático (IA)', checked: true }).waitFor();
  await panel.getByRole('button', { name: 'Quitar fondo', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('.background-panel'), null, { timeout: 120000 });
  const [centre, corner, edge] = await alphaAt(page, [[0.5, 0.5], [0.02, 0.03], [0.97, 0.5]]);
  assert.ok(centre > 240, `${label}: subject must stay opaque, alpha ${centre}`);
  assert.ok(corner < 20 && edge < 20, `${label}: busy background must become transparent, alpha ${corner}/${edge}`);
  assert.match(await cards(page).first().locator('strong').textContent(), /\.png$/);

  // Face detection in the editor.
  await page.locator('input[type=file]').setInputFiles({ name: 'grupo.jpg', mimeType: 'image/jpeg', buffer: await fixture('group.jpg') });
  await cards(page).nth(1).locator('.image-card-edit').click();
  const editor = page.locator('.individual-editor');
  await editor.getByRole('button', { name: 'Ocultar', exact: true }).click();
  await editor.getByRole('button', { name: 'Detectar caras' }).click();
  await editor.getByText(/caras ocultadas/).waitFor({ timeout: 120000 });
  const zones = await editor.locator('.privacy-area-tabs button').count();
  assert.ok(zones >= 30, `${label}: expected most of the ~50 faces in the group photo, got ${zones}`);
  await browser.close();
  assert.deepEqual(errors, [], `${label}: no page or CSP errors`);
  return zones;
}

// 1. HEIC photos open in Chromium (no native HEIC support) and become JPEG.
{
  const { browser, page, errors } = await setup(chromium);
  await page.locator('input[type=file]').setInputFiles({ name: 'IMG_0001.HEIC', mimeType: 'image/heic', buffer: await fixture('example.heic') });
  await cards(page).first().waitFor({ timeout: 60000 });
  assert.equal(await cards(page).first().locator('strong').textContent(), 'IMG_0001.jpg');
  await page.getByText('Las fotos HEIC se convierten a JPG al abrirlas.').waitFor();
  const size = await page.locator('.metadata-panel dd').first().textContent();
  assert.match(size, /^\d+ × \d+ px$/);
  await browser.close();
  assert.deepEqual(errors, []);
}

// 2–3. AI background removal and face detection in Chromium and WebKit.
const chromiumFaces = await backgroundAndFaces(chromium, 'Chromium');
const webkitFaces = await backgroundAndFaces(webkit, 'WebKit');

// 4. OCR suggests personal data and covers the chosen lines with solid zones.
{
  const { browser, page, errors } = await setup(chromium);
  await page.locator('input[type=file]').setInputFiles(await textPng(page));
  await page.locator('.image-card-edit').first().click();
  const editor = page.locator('.individual-editor');
  await editor.getByRole('button', { name: 'Ocultar', exact: true }).click();
  await editor.getByRole('button', { name: 'Detectar texto' }).click();
  const list = editor.locator('.ocr-line-list');
  await list.waitFor({ timeout: 180000 });
  const texts = await list.locator('label span').allTextContents();
  assert.ok(texts.some((text) => /DNI/i.test(text)), `OCR must read the DNI line, got ${JSON.stringify(texts)}`);
  const dni = list.locator('label', { hasText: /DNI/i }).locator('input');
  assert.equal(await dni.isChecked(), true, 'The DNI line is preselected as personal data');
  const title = list.locator('label', { hasText: /fracciones/i }).locator('input');
  assert.equal(await title.isChecked(), false, 'Ordinary text is not preselected');
  await list.locator('label', { hasText: /Alumna/i }).locator('input').check();
  await editor.getByRole('button', { name: /^Tapar 2$/ }).click();
  assert.equal(await editor.locator('.privacy-area-tabs button').count(), 2);
  assert.equal(await editor.getByRole('button', { name: 'Tapar', exact: true }).getAttribute('aria-pressed'), 'true', 'Text zones use a solid fill');
  // The covered DNI region is solid black in the saved image.
  await page.keyboard.press('Control+s');
  await page.waitForFunction(() => !document.querySelector('.individual-editor'));
  const pixel = await page.locator('.image-thumb img').first().evaluate(async (image) => {
    const source = await new Promise((done, fail) => { const element = new Image(); element.onload = () => done(element); element.onerror = fail; element.src = image.dataset.sourceUrl; });
    const canvas = document.createElement('canvas'); canvas.width = source.naturalWidth; canvas.height = source.naturalHeight;
    const context = canvas.getContext('2d'); context.drawImage(source, 0, 0);
    return Array.from(context.getImageData(150, 268, 1, 1).data);
  });
  assert.deepEqual(pixel.slice(0, 3), [0, 0, 0]);
  // The models and runtimes are now cached for offline use, separately from the app shell.
  const cached = await page.evaluate(async () => {
    const names = await caches.keys();
    const name = names.find((key) => key.startsWith('imageinplace-ondemand-'));
    return name ? (await (await caches.open(name)).keys()).map((request) => new URL(request.url).pathname) : [];
  });
  assert.ok(cached.some((path) => path.endsWith('spa.traineddata.gz')), `OCR data cached on demand, got ${cached}`);
  await browser.close();
  assert.deepEqual(errors, []);
}

console.log(`On-device checks passed: HEIC import, AI background removal and face detection (Chromium ${chromiumFaces} faces, WebKit ${webkitFaces}), OCR text covering with personal-data suggestions, on-demand offline cache.`);
