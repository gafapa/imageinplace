import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

await mkdir('.impeccable/reference', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
await page.goto('http://127.0.0.1:4174', { waitUntil: 'networkidle' });
await page.screenshot({ path: '.impeccable/reference/pdfinplace-desktop.png', fullPage: true });
await page.getByRole('button', { name: 'Empezar' }).click();
await page.screenshot({ path: '.impeccable/reference/pdfinplace-workspace-desktop.png', fullPage: true });
await page.setViewportSize({ width: 390, height: 844 });
await page.goto('http://127.0.0.1:4174', { waitUntil: 'networkidle' });
await page.screenshot({ path: '.impeccable/reference/pdfinplace-workspace-mobile.png', fullPage: true });
await browser.close();
