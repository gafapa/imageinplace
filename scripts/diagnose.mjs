import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('console', (message) => console.log(`console:${message.type()}: ${message.text()}`));
page.on('pageerror', (error) => console.log(`pageerror: ${error.stack}`));
page.on('requestfailed', (request) => console.log(`requestfailed: ${request.url()} ${request.failure()?.errorText}`));
await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' });
console.log(`body: ${(await page.locator('body').innerText()).slice(0, 500)}`);
await browser.close();
