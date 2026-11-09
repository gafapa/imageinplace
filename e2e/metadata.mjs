// "Remove hidden data": a phone-like JPEG with GPS, orientation 6 and a comment is cleaned losslessly,
// keeps its rotation, and neither the download nor a saved project contains the hidden data afterwards.
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const url = process.env.TEST_URL || 'http://127.0.0.1:4180';
const output = 'artifacts/browser/metadata';
await mkdir(output, { recursive: true });

const u16 = (value) => [value & 255, value >> 8];
const u32 = (value) => [value & 255, (value >> 8) & 255, (value >> 16) & 255, value >>> 24];
// Little-endian TIFF: IFD0 (orientation 6, GPS pointer) → GPS IFD (N 42° 52′) → rationals.
const tiff = [0x49, 0x49, 0x2a, 0, ...u32(8),
  ...u16(2), ...u16(0x0112), ...u16(3), ...u32(1), ...u16(6), 0, 0, ...u16(0x8825), ...u16(4), ...u32(1), ...u32(38), ...u32(0),
  ...u16(2), ...u16(1), ...u16(2), ...u32(2), 0x4e, 0, 0, 0, ...u16(2), ...u16(5), ...u32(3), ...u32(68), ...u32(0),
  ...u32(42), ...u32(1), ...u32(52), ...u32(1), ...u32(0), ...u32(1)];
const segment = (marker, payload) => [0xff, marker, ...[(payload.length + 2) >> 8, (payload.length + 2) & 255], ...payload];
const text = (value) => [...Buffer.from(value, 'latin1')];
const SECRET = 'Alumna Lucia 3B';

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => { localStorage.setItem('imageinplace-welcome-dismissed', 'true'); localStorage.setItem('imageinplace-locale', 'es'); });
  await page.goto(url);
  const plain = Buffer.from(await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 48;
    const context = canvas.getContext('2d'); context.fillStyle = '#c33'; context.fillRect(0, 0, 64, 48); context.fillStyle = '#36c'; context.fillRect(0, 0, 16, 48);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    return [...new Uint8Array(await blob.arrayBuffer())];
  }));
  const photo = Buffer.from([0xff, 0xd8, ...segment(0xe1, [...text('Exif\0\0'), ...tiff]), ...segment(0xfe, text(SECRET)), ...plain.subarray(2)]);
  await page.locator('input[type=file]').setInputFiles({ name: 'IMG_Lucia.jpg', mimeType: 'image/jpeg', buffer: photo });
  await page.locator('.image-card-edit').first().waitFor();
  await page.getByRole('note').filter({ hasText: 'ubicación GPS' }).waitFor();

  await page.getByRole('button', { name: 'Quitar datos ocultos', exact: true }).click();
  const sidebar = page.locator('.gallery-side-panel');
  await sidebar.locator('.metadata-findings').filter({ hasText: 'Ubicación GPS' }).waitFor();
  await page.screenshot({ path: `${output}/panel-desktop.png` });

  // Lossless download: same scan bytes, no GPS or comment, orientation kept.
  let pending = page.waitForEvent('download');
  await sidebar.getByRole('button', { name: 'Descargar limpias', exact: true }).click();
  const clean = await readFile(await (await pending).path());
  assert.equal(clean.includes(Buffer.from(SECRET, 'latin1')), false, 'The comment must be removed');
  assert.equal(clean.includes(Buffer.from([0x25, 0x88])), false, 'The GPS pointer must be removed');
  assert.ok(clean.includes(plain.subarray(plain.indexOf(Buffer.from([0xff, 0xda])))), 'Compressed image data must be copied unchanged');
  const size = await page.evaluate(async (bytes) => { const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' })); return [bitmap.width, bitmap.height]; }, [...clean]);
  assert.deepEqual(size, [48, 64], 'Orientation 6 must still rotate the photo');

  // Cleaning in the gallery with generic names also cleans the original kept in projects.
  await sidebar.getByRole('checkbox').check();
  await sidebar.getByRole('button', { name: 'Limpiar', exact: true }).click();
  await page.locator('.image-card-meta strong').filter({ hasText: 'imagen-1.jpg' }).waitFor();
  assert.equal(await page.getByRole('note').filter({ hasText: 'ubicación GPS' }).count(), 0);
  await page.locator('summary[aria-label="Proyecto local"]').click();
  pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Guardar proyecto', exact: true }).click();
  const project = await readFile(await (await pending).path());
  for (const secret of [Buffer.from(SECRET, 'latin1'), Buffer.from('IMG_Lucia'), Buffer.from([0x25, 0x88, 4, 0])]) assert.equal(project.includes(secret), false, `Project must not contain ${secret}`);
  await page.screenshot({ path: `${output}/gallery-after.png` });

  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow on mobile');
  assert.deepEqual(errors, []);
  console.log('Metadata removal passed: lossless JPEG cleaning, kept orientation, generic names and clean project file.');
} finally { await browser.close(); }
