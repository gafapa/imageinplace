import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const output = 'artifacts/browser/restoration';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => { try { localStorage.setItem('imageinplace-welcome-dismissed', 'true'); localStorage.setItem('imageinplace-locale', 'es'); } catch { /* storage may be blocked */ } });
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
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${output}/gallery-mobile.png` });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No document overflow on mobile');
  await page.locator('.image-card-edit').first().click();
  await action('Reparar imagen');
  await page.locator('.settings-panel figure img').waitFor();
  await page.screenshot({ path: `${output}/restore-mobile.png` });
  assert.deepEqual(errors, []);
  console.log('Restoration passed: batch repair, editor panel and mobile layout.');
} finally { await browser.close(); }
