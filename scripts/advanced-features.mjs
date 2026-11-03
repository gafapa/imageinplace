import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import JSZip from 'jszip';

const output = 'artifacts/browser/advanced';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => { try { localStorage.setItem('imageinplace-welcome-dismissed', 'true'); localStorage.setItem('imageinplace-locale', 'es'); } catch { /* The audit sandbox intentionally has no storage access. */ } });
  await page.goto(process.env.TEST_URL || 'http://127.0.0.1:4180');
  const fixture = (name, transparent) => ({ name, mimeType: 'image/svg+xml', buffer: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="48">${transparent ? '' : '<rect width="64" height="48" fill="#888"/>'}<rect x="16" y="12" width="32" height="24" fill="#468abd"/></svg>`) });
  await page.locator('input[type=file]').setInputFiles([fixture('opaque.svg', false), fixture('transparent.svg', true)]);
  await page.locator('.image-card-edit').first().waitFor();
  console.log('Imported synthetic images.');
  const action = async (name) => {
    const button = page.getByRole('button', { name, exact: true });
    if (!(await button.isVisible())) await page.getByRole('button', { name: 'Más acciones', exact: true }).click();
    await button.click();
  };
  const sidebar = page.locator('.gallery-side-panel');
  await action('Reparar imagen');
  await sidebar.locator('figure img').waitFor();
  await sidebar.getByRole('slider', { name: /Polvo y puntos aislados/ }).fill('50');
  await sidebar.getByRole('slider', { name: /Reducir ruido/ }).fill('25');
  await sidebar.getByRole('slider', { name: /Nitidez/ }).fill('30');
  await page.screenshot({ path: `${output}/restore-desktop.png` });
  await sidebar.getByRole('button', { name: 'Aplicar', exact: true }).click();
  await sidebar.locator('.background-panel').waitFor({ state: 'detached' });
  console.log('Restoration applied.');
  await action('Deshacer global');
  await action('Ampliar 2× / 4×');
  await sidebar.getByLabel('Escala', { exact: true }).selectOption('4');
  await sidebar.getByRole('button', { name: 'Aplicar', exact: true }).click();
  await sidebar.locator('.background-panel').waitFor({ state: 'detached' });
  const sizes = await page.locator('.image-thumb img').evaluateAll(async (images) => Promise.all(images.map(async (image) => {
    const bitmap = await createImageBitmap(await (await fetch(image.dataset.sourceUrl)).blob());
    const size = [bitmap.width, bitmap.height]; bitmap.close(); return size;
  })));
  assert.deepEqual(sizes, [[256,192],[256,192]]);
  console.log('4x upscale dimensions verified.');
  await action('Deshacer global');
  await page.locator('.image-card-edit').first().click();
  await action('Sugerencias locales');
  await page.locator('.settings-panel figure img').waitFor();
  await action('Aplicar');
  await action('Deshacer');
  await action('Exportar');
  await page.getByRole('radio', { name: 'AVIF', exact: false }).check();
  let pending = page.waitForEvent('download');
  await action('Descargar');
  const avif = await pending; assert.match(avif.suggestedFilename(), /\.avif$/);
  const avifBytes = await readFile(await avif.path());
  assert.equal(avifBytes.subarray(4, 8).toString(), 'ftyp');
  const dimensions = await page.evaluate(async (bytes) => {
    const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/avif' }));
    const size = [bitmap.width, bitmap.height]; bitmap.close(); return size;
  }, [...avifBytes]);
  assert.deepEqual(dimensions, [64,48]);
  console.log('AVIF bytes decoded.');
  await action('Descartar');
  await action('Exportar imágenes seleccionadas');
  await sidebar.getByRole('radio', { name: 'Menor archivo', exact: false }).check();
  pending = page.waitForEvent('download');
  await sidebar.getByRole('button', { name: 'Descargar', exact: true }).click();
  const download = await pending;
  const zip = await JSZip.loadAsync(await readFile(await download.path()));
  const entries = Object.values(zip.files).filter((file) => !file.dir);
  assert.equal(entries.length, 2);
  const transparent = entries.find((entry) => entry.name.startsWith('transparent'));
  assert.ok(!transparent.name.endsWith('.jpg'), 'Automatic export must preserve transparency');
  const alpha = await page.evaluate(async (bytes) => {
    const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)]));
    const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
    const context = canvas.getContext('2d'); context.drawImage(bitmap, 0, 0); bitmap.close();
    return context.getImageData(0, 0, 1, 1).data[3];
  }, [...await transparent.async('uint8array')]);
  assert.equal(alpha, 0);
  const automaticSizes = new Map(await Promise.all(entries.map(async (entry) => [entry.name.split('-editada')[0], (await entry.async('uint8array')).length])));
  const measured = new Map([['opaque', []], ['transparent', []]]);
  for (const format of ['AVIF', 'WebP', 'JPG', 'PNG']) {
    await action('Exportar imágenes seleccionadas');
    await sidebar.getByRole('radio', { name: new RegExp(`^${format}\\b`) }).check();
    pending = page.waitForEvent('download');
    await sidebar.getByRole('button', { name: 'Descargar', exact: true }).click();
    const candidate = await pending;
    const archive = await JSZip.loadAsync(await readFile(await candidate.path()));
    for (const entry of Object.values(archive.files).filter((file) => !file.dir)) {
      const name = entry.name.split('-editada')[0];
      if (!(name === 'transparent' && format === 'JPG')) measured.get(name).push((await entry.async('uint8array')).length);
    }
  }
  for (const [name, sizes] of measured) assert.equal(automaticSizes.get(name), Math.min(...sizes), `Automatic export must select the smallest measured ${name} candidate`);
  console.log('All four output formats compared; smallest candidates and alpha verified.');
  // Public-page audit uses fictitious resources and never executes supplied markup.
  const requests = [];
  const auditPng = Buffer.from(await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 1; canvas.height = 1;
    return canvas.toDataURL('image/png').split(',')[1];
  }), 'base64');
  await page.route('https://audit.example.org/**', async (route) => {
    const url = route.request().url(); requests.push(url);
    assert.equal(route.request().headers().cookie, undefined);
    if (url.endsWith('/page')) await route.fulfill({ contentType: 'text/html', headers: { 'Access-Control-Allow-Origin': '*' }, body: '<script>parent.document.body.textContent="UNSAFE"</script><img src="/one.png"><img src="/one.png"><img src="http://localhost/private.png"><img src="/two.png" alt="Decorative" loading="lazy">' });
    else await route.fulfill({ contentType: 'image/png', headers: { 'Access-Control-Allow-Origin': '*' }, body: auditPng });
  });
  await action('Analizar página web');
  const audit = page.frameLocator('iframe');
  await audit.locator('#page-url').fill('https://audit.example.org/page');
  await audit.getByRole('button', { name: 'Analizar', exact: true }).click();
  await audit.locator('#status').filter({ hasText: '2/2' }).waitFor();
  assert.equal(await audit.locator('tbody tr').count(), 2);
  assert.equal(requests.length, 3, 'Repeated and unsafe image URLs must not be fetched');
  assert.match(await audit.locator('tbody tr').first().innerText(), /Sin texto alternativo/);
  assert.match(await audit.locator('tbody tr').first().innerText(), /1 × 1/, 'Audit must decode actual raster dimensions');
  assert.equal(await page.locator('.gallery-shell').count(), 1, 'Page HTML must remain inert');
  assert.equal(await audit.locator('body').evaluate(() => { try { return !!parent.document.body; } catch { return false; } }), false, 'Sandbox must block access to editor data');
  await audit.locator('#html-file').setInputFiles({ name: 'saved.html', mimeType: 'text/html', buffer: Buffer.from('<img src="/one.png" alt=""><script>parent.document.body.remove()</script>') });
  await audit.locator('#status').filter({ hasText: '1/1' }).waitFor();
  assert.equal(await audit.locator('tbody tr').count(), 1, 'Saved HTML fallback must resolve relative image URLs');
  assert.ok(!(await audit.locator('tbody tr').innerText()).includes('Sin texto alternativo'), 'Decorative empty alt is valid');
  await page.screenshot({ path: `${output}/audit-desktop.png` });
  await page.route('https://audit.example.org/slow', async (route) => { await new Promise((resolve) => setTimeout(resolve, 1000)); await route.fulfill({ contentType: 'text/html', headers: { 'Access-Control-Allow-Origin': '*' }, body: '<img src="/one.png">' }).catch(() => {}); });
  await audit.locator('#page-url').fill('https://audit.example.org/slow');
  await audit.locator('#analyze').click();
  await audit.locator('#cancel').click();
  await audit.locator('#status').filter({ hasText: 'Cancelado' }).waitFor();
  await page.locator('.page-audit-dialog').getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${output}/gallery-mobile.png` });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No document overflow on mobile');
  await page.locator('.image-card-edit').first().click();
  await action('Reparar imagen');
  await page.locator('.settings-panel figure img').waitFor();
  await page.screenshot({ path: `${output}/restore-mobile.png` });
  assert.deepEqual(errors, []);
  console.log('Advanced features passed: restoration, upscale, suggestions, AVIF, automatic ZIP alpha, sandboxed URL analysis, mobile layout.');
} finally { await browser.close(); }
