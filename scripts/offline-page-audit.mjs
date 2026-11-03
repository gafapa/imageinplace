import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch();
try {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    try { localStorage.setItem('imageinplace-welcome-dismissed', 'true'); localStorage.setItem('imageinplace-locale', 'en'); } catch { /* The audit frame has no storage access. */ }
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(process.env.TEST_URL || 'http://127.0.0.1:4180');
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true);
  await page.waitForFunction(() => navigator.onLine === false);
  await page.getByRole('button', { name: /web page/i }).click();
  await page.getByRole('status').filter({ hasText: 'Connect to open the web analyzer.' }).waitFor();
  assert.equal(await page.locator('.page-audit-dialog').evaluate((dialog) => dialog.open), false, 'Offline users must receive an explanation instead of an empty iframe');
  assert.equal(await page.locator('.page-audit-dialog iframe').count(), 0);
  await context.setOffline(false);
  await page.waitForFunction(() => navigator.onLine === true);
  await page.getByRole('button', { name: /web page/i }).click();
  const audit = page.frameLocator('.page-audit-dialog iframe');
  await audit.locator('#help').filter({ hasText: 'Reads public HTTPS URLs' }).waitFor();
  assert.equal(await audit.locator('html').getAttribute('lang'), 'en');
  assert.deepEqual(errors, []);
  console.log('Offline page audit passed: clear offline notice, preserved app shell, and analyzer recovery after reconnecting.');
} finally { await browser.close(); }
