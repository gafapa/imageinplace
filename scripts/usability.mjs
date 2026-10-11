import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';

// Usability checks: colour adjustments in WebKit (whose canvas ignores context.filter), keyboard
// shortcuts, home-screen tasks, opt-in session recovery, source-format export and number fields.
const url = process.env.TEST_URL || 'http://127.0.0.1:4180/';

async function setup(browserType, { viewport = { width: 1440, height: 900 } } = {}) {
  const browser = await browserType.launch();
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (cause) => errors.push(cause.message));
  page.on('dialog', (dialog) => dialog.accept());
  await page.addInitScript(() => { localStorage.setItem('imageinplace-welcome-dismissed', 'true'); localStorage.setItem('imageinplace-locale', 'es'); });
  await page.goto(url);
  return { browser, page, errors };
}

const gradientPng = (page, width = 120, height = 80) => page.evaluate(([w, h]) => {
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const context = canvas.getContext('2d');
  for (let x = 0; x < w; x += 1) { context.fillStyle = `rgb(${Math.round(40 + x)}, ${Math.round(150 - x / 2)}, 60)`; context.fillRect(x, 0, 1, h); }
  return canvas.toDataURL('image/png').split(',')[1];
}, [width, height]).then((base64) => ({ name: 'degradado.png', mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') }));

const firstImagePixels = (page) => page.locator('.image-thumb img').first().evaluate(async (image) => {
  const source = await new Promise((resolve, reject) => { const element = new Image(); element.onload = () => resolve(element); element.onerror = reject; element.src = image.dataset.sourceUrl; });
  const canvas = document.createElement('canvas'); canvas.width = source.naturalWidth; canvas.height = source.naturalHeight;
  const context = canvas.getContext('2d'); context.drawImage(source, 0, 0);
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  const samples = [];
  for (const [x, y] of [[10, 40], [60, 40], [110, 40]]) { const offset = (y * canvas.width + x) * 4; samples.push(Array.from(data.slice(offset, offset + 4))); }
  return samples;
});

async function adjustedPixels(browserType) {
  const { browser, page, errors } = await setup(browserType);
  await page.locator('input[type=file]').setInputFiles(await gradientPng(page));
  await page.locator('.image-card-edit').first().click();
  const editor = page.locator('.individual-editor');
  await editor.locator('.range-control', { hasText: 'Brillo' }).locator('input').fill('140');
  await editor.getByRole('button', { name: 'B/N', exact: true }).click();
  await page.keyboard.press('Control+s');
  await page.waitForFunction(() => !document.querySelector('.individual-editor'));
  const pixels = await firstImagePixels(page);
  await browser.close();
  assert.deepEqual(errors, []);
  return pixels;
}

// 1. Colour adjustments must change pixels in WebKit and agree with Chromium's native filter.
const chromiumPixels = await adjustedPixels(chromium);
const webkitPixels = await adjustedPixels(webkit);
for (const [index, sample] of webkitPixels.entries()) {
  assert.ok(sample[0] === sample[1] && sample[1] === sample[2], `WebKit B/N pixel ${index} must be grey, got ${sample}`);
  sample.slice(0, 3).forEach((value, channel) => assert.ok(Math.abs(value - chromiumPixels[index][channel]) <= 3,
    `WebKit pixel ${index} channel ${channel} ${value} must match Chromium ${chromiumPixels[index][channel]}`));
}

// 2. Gallery keyboard shortcuts.
{
  const { browser, page, errors } = await setup(chromium);
  const png = await gradientPng(page);
  await page.locator('input[type=file]').setInputFiles([png, { ...png, name: 'segunda.png' }]);
  const cards = page.locator('.image-grid .image-card:not(.add-image-card)');
  await assert.doesNotReject(cards.nth(1).waitFor());
  const count = () => page.locator('.selection-toolbar-count strong').textContent();
  assert.equal(await count(), '2/2');
  await page.keyboard.press('Escape');
  assert.equal(await count(), '0/2');
  await page.keyboard.press('Control+a');
  assert.equal(await count(), '2/2');
  await page.keyboard.press('Delete');
  await page.waitForFunction(() => document.querySelector('.home-shell'));
  await page.keyboard.press('Control+z');
  await cards.nth(1).waitFor();
  assert.equal(await cards.count(), 2);
  // Typing in a field never triggers shortcuts.
  await page.keyboard.press('Control+a');
  await page.getByRole('button', { name: 'Renombrar selección', exact: true }).click();
  const field = page.locator('.gallery-side-panel .text-field input').first();
  await field.focus();
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Delete');
  assert.equal(await cards.count(), 2);
  // Number fields keep an empty value while editing instead of snapping to 1.
  await page.locator('.image-card-edit').first().click();
  const editor = page.locator('.individual-editor');
  await editor.getByRole('button', { name: 'Tamaño', exact: true }).click();
  const width = editor.locator('.number-field', { hasText: 'Ancho' }).locator('input');
  const height = editor.locator('.number-field', { hasText: 'Alto' }).locator('input');
  await width.fill('');
  assert.equal(await width.inputValue(), '');
  await width.fill('60');
  assert.equal(await height.inputValue(), '40');
  // Exporting a PNG proposes PNG.
  await editor.getByRole('button', { name: 'Exportar', exact: true }).click();
  assert.equal(await editor.locator('input[name="format"]:checked').inputValue(), 'image/png');
  // Visual crop is reached from the Crop panel.
  await editor.getByRole('button', { name: 'Recortar', exact: true }).click();
  await editor.getByRole('button', { name: 'Recorte visual: arrastrar el marco' }).waitFor();
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.individual-editor'));
  await browser.close();
  assert.deepEqual(errors, []);
}

// 3. Home tasks open the matching tool right after choosing images.
{
  const { browser, page, errors } = await setup(chromium);
  const png = await gradientPng(page);
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /Reducir el peso/ }).click();
  await (await chooser).setFiles(png);
  await page.locator('.gallery-side-panel').getByRole('heading', { name: 'Reducir peso' }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Comprimir a un peso objetivo' }).getAttribute('aria-pressed'), 'true');
  await browser.close();

  const second = await setup(chromium);
  const editorChooser = second.page.waitForEvent('filechooser');
  await second.page.getByRole('button', { name: /Ocultar caras o nombres/ }).click();
  await (await editorChooser).setFiles(png);
  await second.page.locator('.individual-editor').getByRole('heading', { name: 'Ocultar información' }).waitFor();
  await second.browser.close();
  assert.deepEqual([...errors, ...second.errors], []);
}

// 4. Opt-in session recovery survives a reload and is removed when switched off.
{
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (cause) => errors.push(cause.message));
  let unloadPrompts = 0;
  page.on('dialog', (dialog) => { if (dialog.type() === 'beforeunload') unloadPrompts += 1; dialog.accept(); });
  await page.addInitScript(() => { localStorage.setItem('imageinplace-welcome-dismissed', 'true'); localStorage.setItem('imageinplace-locale', 'es'); });
  await page.goto(url);
  assert.equal(await page.locator('.session-banner').count(), 0, 'No banner while recovery is off');
  await page.locator('.project-menu summary').click();
  await page.getByLabel(/Recordar mis imágenes/).check();
  await page.locator('.project-menu summary').click();
  await page.locator('input[type=file]').setInputFiles(await gradientPng(page));
  await page.locator('.image-card-edit').first().waitFor();
  await page.waitForTimeout(3000);
  await page.reload();
  assert.equal(unloadPrompts, 0, 'A remembered session must not trigger the unload warning');
  await page.locator('.session-banner').getByText('Tienes 1 imagen de tu última sesión').waitFor();
  await page.locator('.session-banner').getByRole('button', { name: 'Recuperar' }).click();
  await page.locator('.image-card-edit').first().waitFor();
  assert.equal(await page.locator('.image-grid .image-card:not(.add-image-card)').count(), 1);
  await page.locator('.project-menu summary').click();
  await page.getByLabel(/Recordar mis imágenes/).uncheck();
  const stored = await page.evaluate(() => new Promise((resolve) => {
    const request = indexedDB.open('imageinplace', 1);
    request.onsuccess = () => { const get = request.result.transaction('session').objectStore('session').get('current'); get.onsuccess = () => resolve(Boolean(get.result)); };
  }));
  assert.equal(stored, false, 'Switching recovery off deletes the stored session');
  await browser.close();
  assert.deepEqual(errors, []);
}

// 5. Mobile: labelled rail and dock fit without horizontal page overflow.
{
  const { browser, page, errors } = await setup(chromium, { viewport: { width: 390, height: 844 } });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Home must not overflow on mobile');
  await page.locator('input[type=file]').setInputFiles(await gradientPng(page));
  await page.locator('.image-card-edit').first().click();
  await page.locator('.individual-editor .tool-rail').getByText('Mejorar').waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Editor must not overflow on mobile');
  await browser.close();
  assert.deepEqual(errors, []);
}

// 6. Languages: switching keeps the workspace, persists, and the browser language is detected.
{
  const browser = await chromium.launch();
  const context = await browser.newContext({ locale: 'en-GB', viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (cause) => errors.push(cause.message));
  await page.addInitScript(() => localStorage.setItem('imageinplace-welcome-dismissed', 'true'));
  await page.goto(url);
  await page.getByRole('button', { name: 'Choose images' }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.lang), 'en');
  await page.locator('input[type=file]').setInputFiles(await gradientPng(page));
  await page.locator('.image-card-edit').first().waitFor();
  await page.getByLabel('Language').selectOption('eu');
  await page.getByRole('button', { name: 'Hautatu guztiak' }).waitFor();
  assert.equal(await page.locator('.image-grid .image-card:not(.add-image-card)').count(), 1, 'Switching language keeps the images');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Basque labels fit on mobile');
  await page.locator('.image-card-edit').first().click();
  await page.locator('.individual-editor .tool-rail').getByText('Hobetu').waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Basque editor fits on mobile');
  await page.keyboard.press('Escape');
  await page.reload();
  await page.getByRole('button', { name: 'Aukeratu irudiak' }).waitFor();
  await browser.close();
  assert.deepEqual(errors, []);
}

console.log('Usability checks passed: WebKit colour fallback matches Chromium, keyboard shortcuts, number fields, source-format export, home tasks, session recovery, mobile fit, language switching.');
