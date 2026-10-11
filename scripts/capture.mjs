import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const testUrl = process.env.TEST_URL || 'http://127.0.0.1:4173';
const outputDirectory = '.impeccable/review';
await mkdir(outputDirectory, { recursive: true });

async function assertNoGlobalScroll(page, label) {
  const overflow = await page.evaluate(() => ({
    horizontal: document.documentElement.scrollWidth > window.innerWidth,
    vertical: document.documentElement.scrollHeight > window.innerHeight,
  }));

  if (overflow.horizontal || overflow.vertical) {
    throw new Error(`${label} has global overflow: ${JSON.stringify(overflow)}`);
  }
}

const browser = await chromium.launch();
const page = await browser.newPage({ locale: 'es-ES', viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
page.on('dialog', (dialog) => dialog.accept());
await page.goto(testUrl, { waitUntil: 'networkidle' });
await page.screenshot({ path: `${outputDirectory}/welcome-desktop.png`, fullPage: true });
await page.getByRole('button', { name: 'Empezar' }).click();
await assertNoGlobalScroll(page, 'Desktop home');
await page.screenshot({ path: `${outputDirectory}/desktop.png`, fullPage: true });

const sampleSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
  <rect width="1200" height="800" fill="#e9dfc8"/>
  <rect x="70" y="70" width="1060" height="660" fill="#f8f4e9"/>
  <circle cx="370" cy="390" r="190" fill="#176b5b"/>
  <rect x="610" y="235" width="390" height="55" fill="#17201d"/>
  <rect x="610" y="330" width="290" height="28" fill="#e66a49"/>
  <rect x="610" y="390" width="350" height="18" fill="#8b948e"/>
  <rect x="610" y="430" width="315" height="18" fill="#8b948e"/>
  <rect x="610" y="470" width="330" height="18" fill="#8b948e"/>
</svg>`;

await page.locator('.workspace-dropzone .upload-zone').evaluate((target, svg) => {
  const transfer = new DataTransfer();
  transfer.items.add(new File([svg], 'sample-classroom-image.svg', { type: 'image/svg+xml' }));
  transfer.items.add(new File([svg.replace('#176b5b', '#2563eb').replace('width="1200" height="800"', 'width="800" height="1200"')], 'second-classroom-image.svg', { type: 'image/svg+xml' }));
  target.dispatchEvent(new DragEvent('dragenter', { bubbles: true, dataTransfer: transfer }));
  target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer }));
  target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
}, sampleSvg);
await page.locator('.image-card-select[aria-pressed="true"]').nth(1).waitFor();
if (await page.locator('.image-card-select').count() !== 2) throw new Error('Initial drop imported duplicate images');
const batchToolbar = page.getByRole('toolbar', { name: 'Acciones para 2 imágenes seleccionadas' });
await batchToolbar.getByRole('button', { name: 'Cambiar tamaño de imágenes seleccionadas' }).waitFor();
await batchToolbar.getByRole('button', { name: 'Exportar imágenes seleccionadas' }).waitFor();
await assertNoGlobalScroll(page, 'Desktop gallery');
await page.screenshot({ path: `${outputDirectory}/gallery-desktop.png`, fullPage: true });
if (await page.getByRole('heading', { name: 'Tus imágenes', exact: true }).count()) throw new Error('Obsolete gallery heading remains');
await page.locator('.metadata-panel').waitFor();
const originalPreview = await page.locator('.image-thumb img').first().getAttribute('src');
await page.getByRole('button', { name: 'Mejorar imágenes seleccionadas' }).click();
await page.locator('.batch-panel').getByRole('button', { name: 'B/N', exact: true }).click();
await page.waitForFunction((original) => document.querySelector('.image-thumb img')?.getAttribute('src') !== original, originalPreview);
await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
await page.waitForFunction((original) => document.querySelector('.image-thumb img')?.getAttribute('src') === original, originalPreview);
await page.getByRole('button', { name: 'Cambiar tamaño de imágenes seleccionadas' }).click();
await page.getByLabel('Lado más largo (px)').fill('600');
await page.screenshot({ path: `${outputDirectory}/batch-desktop.png`, fullPage: true });
await page.getByRole('button', { name: 'Aplicar', exact: true }).click();
await page.locator('.batch-panel').waitFor({ state: 'detached' });
await page.waitForFunction(async () => {
  const images = await Promise.all([...document.querySelectorAll('.image-thumb img')].map((thumbnail) => new Promise((resolve) => {
    const image = new Image(); image.onload = () => resolve([image.naturalWidth, image.naturalHeight]); image.src = thumbnail.dataset.sourceUrl;
  })));
  return images[0]?.[0] === 600 && images[0]?.[1] === 400 && images[1]?.[0] === 400 && images[1]?.[1] === 600;
});
await page.getByRole('button', { name: 'Recortar imágenes seleccionadas', exact: true }).click();
await page.locator('.batch-panel').getByRole('button', { name: 'Cuadrado', exact: true }).click();
await page.getByRole('button', { name: 'Aplicar', exact: true }).click();
await page.locator('.batch-panel').waitFor({ state: 'detached' });
await page.waitForFunction(() => [...document.querySelectorAll('.image-thumb img')].every((img) => img.naturalWidth === 400 && img.naturalHeight === 400));
await page.getByRole('button', { name: 'Exportar imágenes seleccionadas' }).click();

const batchDownloadPromise = page.waitForEvent('download');
await page.locator('.batch-panel').getByRole('button', { name: 'Descargar', exact: true }).click();
const batchDownload = await batchDownloadPromise;
if (batchDownload.suggestedFilename() !== 'imageinplace-2-imagenes.zip') throw new Error('Unexpected batch download filename');
await page.getByRole('button', { name: 'Editar sample-classroom-image.png' }).click();
await page.locator('.canvas-wrap canvas').waitFor({ state: 'visible' });
await page.getByRole('button', { name: 'Recortar', exact: true }).click();
await page.getByRole('button', { name: 'Diapositiva', exact: true }).click();
await page.waitForFunction(() => { const canvas = document.querySelector('.canvas-wrap canvas'); return canvas.width === 400 && canvas.height === 225; });
await page.getByRole('button', { name: 'Imagen siguiente', exact: true }).click();
await page.waitForFunction(() => document.querySelector('#individual-title')?.textContent === 'second-classroom-image.png');
await page.screenshot({ path: `${outputDirectory}/editor-desktop.png`, fullPage: true });
await page.getByRole('button', { name: 'Cancelar edición', exact: true }).click();
if (await page.locator('.image-card-select[aria-pressed="true"]').count() !== 2) throw new Error('Individual editor changed gallery selection');

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(testUrl, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Empezar' }).click();
await assertNoGlobalScroll(page, 'Mobile home');
await page.screenshot({ path: `${outputDirectory}/mobile.png`, fullPage: true });

await page.locator('input[type="file"]').first().setInputFiles({
  name: 'sample-classroom-image.svg',
  mimeType: 'image/svg+xml',
  buffer: Buffer.from(sampleSvg),
});
await page.locator('.image-card-select[aria-pressed="true"]').waitFor();
if (await page.locator('.image-card-select').count() !== 1) throw new Error('File picker imported duplicate images');
await assertNoGlobalScroll(page, 'Mobile gallery');
await page.screenshot({ path: `${outputDirectory}/gallery-mobile.png`, fullPage: true });
await page.getByRole('button', { name: 'Girar imágenes seleccionadas' }).click();
await page.getByRole('button', { name: 'Derecha', exact: true }).click();
await assertNoGlobalScroll(page, 'Mobile batch panel');
await page.screenshot({ path: `${outputDirectory}/batch-mobile.png`, fullPage: true });
await page.getByRole('button', { name: 'Aplicar', exact: true }).click();
await page.locator('.batch-panel').waitFor({ state: 'detached' });
await page.waitForFunction(async () => { const image = new Image(); const loaded = new Promise((resolve) => { image.onload = () => resolve(image.naturalWidth === 800); }); image.src = document.querySelector('.image-thumb img').dataset.sourceUrl; return loaded; });
await page.getByRole('button', { name: 'Editar sample-classroom-image.png' }).click();
await page.locator('.canvas-wrap canvas').waitFor({ state: 'visible' });
await assertNoGlobalScroll(page, 'Mobile editor');
await page.getByRole('button', { name: 'Ocultar', exact: true }).click();
const canvasBounds = await page.locator('.canvas-wrap canvas').boundingBox();
if (!canvasBounds) throw new Error('Canvas bounds are unavailable');
await page.mouse.move(canvasBounds.x + canvasBounds.width * 0.12, canvasBounds.y + canvasBounds.height * 0.12);
await page.mouse.down();
await page.mouse.move(canvasBounds.x + canvasBounds.width * 0.34, canvasBounds.y + canvasBounds.height * 0.34);
await page.mouse.up();
await page.getByText('1 zona oculta').waitFor();
await page.screenshot({ path: `${outputDirectory}/editor-mobile.png`, fullPage: true });

const previousUrl = await page.locator('.image-thumb img').getAttribute('src');
await page.getByRole('button', { name: 'Guardar edición', exact: true }).click();
await page.locator('.individual-editor').waitFor({ state: 'detached' });
if (await page.locator('.image-thumb img').getAttribute('src') === previousUrl) throw new Error('Save did not update gallery image');

await browser.close();
