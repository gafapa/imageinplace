import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
await context.addInitScript(() => { localStorage.setItem('imageinplace-welcome-dismissed', 'true'); localStorage.setItem('imageinplace-locale', 'es'); });
const page = await context.newPage();
const image = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#44aaff"/><circle cx="160" cy="90" r="55" fill="#ffcc33"/></svg>');
const report = {};
try {
  await page.goto('http://127.0.0.1:4180/', { waitUntil: 'networkidle' });
  await page.locator('input[type=file]').first().setInputFiles({ name: 'sample.svg', mimeType: 'image/svg+xml', buffer: image });
  await page.locator('.image-card-edit').first().click();
  await page.locator('button[aria-label="Anotar"]').click();
  const canvas = page.locator('canvas').first(); await canvas.waitFor();
  const before = await canvas.evaluate((node) => node.toDataURL());
  await page.getByRole('button', { name: /^Texto$/ }).click(); await canvas.click({ position: { x: 150, y: 80 } });
  const after = await canvas.evaluate((node) => node.toDataURL()); assert.notEqual(after, before, 'annotation changed no pixels'); report.annotationPixels = true;
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click(); await page.waitForTimeout(100); await page.getByRole('button', { name: 'Deshacer', exact: true }).click(); await page.waitForTimeout(100); assert.equal(await canvas.evaluate((node) => node.toDataURL()), before, 'annotation undo failed');
  await page.getByRole('button', { name: 'Rehacer', exact: true }).click(); await page.waitForTimeout(100); await page.getByRole('button', { name: 'Rehacer', exact: true }).click(); await page.waitForTimeout(100); assert.equal(await canvas.evaluate((node) => node.toDataURL()), after, 'annotation redo failed'); report.annotationUndoRedo = true;
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await page.locator('.individual-editor').waitFor({ state: 'detached' });
  await page.locator('.image-card-compare').click(); await page.waitForTimeout(500);
  const slider = page.locator('.before-after-slider input[type=range]'); assert.equal(await slider.count(), 1, 'comparison slider missing'); await slider.press('Home'); await slider.press('End'); report.compareKeyboard = true;
  assert.match(await page.locator('.before-after-meta').innerText(), /Original:.*×.*Actual \(PNG\):/s); report.compareDimensions = true;
  await page.screenshot({ path: '.impeccable/review/features/compare-mobile.png', fullPage: true }); await page.setViewportSize({ width: 1440, height: 900 }); await page.screenshot({ path: '.impeccable/review/features/compare-desktop.png', fullPage: true }); await page.setViewportSize({ width: 390, height: 844 }); report.screenshots = true;
  await page.getByRole('button', { name: 'Cerrar comparador' }).click(); assert.equal(await page.locator('.image-card-select').count(), 1, 'comparison must not change gallery items');
  const globalUndo = page.locator('button[aria-label="Deshacer global"]'); const globalRedo = page.locator('button[aria-label="Rehacer global"]'); assert.equal(await globalUndo.isEnabled(), true, 'global undo unavailable'); await globalUndo.click(); await page.waitForTimeout(100); assert.equal(await globalRedo.isEnabled(), true, 'global redo unavailable'); await globalRedo.click(); report.globalHistory = true;
  const widths = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth })); assert.ok(widths.scroll <= widths.client + 1, `horizontal overflow ${widths.scroll}/${widths.client}`); report.mobileOverflow = true;
  console.log(JSON.stringify({ ok: true, report }));
} catch (error) { console.error(JSON.stringify({ ok: false, report, failure: error.message })); process.exitCode = 1; } finally { await browser.close(); }
