import { inspectImage, releaseItems, validateWorkspace, MAX_FILE_BYTES, MAX_WORKSPACE_BYTES, MAX_WORKSPACE_ITEMS } from './imageLimits.js';
import { t } from '../i18n/index.js';

const LEGACY_MAGIC = 'IIPROJ01';
const MAGIC = 'IIPROJ02';
const TRAILER_BYTES = 32;
const MAX_HEADER_BYTES = 256 * 1024;
const MAX_PROJECT_BYTES = MAX_WORKSPACE_BYTES * 2 + MAX_HEADER_BYTES + 12 + TRAILER_BYTES;
const validName = (name) => typeof name === 'string' && name.trim() && name.length <= 255
  && !/[\\/]/.test(name) && [...name].every((character) => character.charCodeAt(0) >= 32);
const supportedType = (type) => typeof type === 'string' && /^image\/[a-z0-9.+-]{1,80}$/i.test(type);

export async function sha256(blob) {
  if (!globalThis.crypto?.subtle) throw new Error(t('La verificación de integridad requiere HTTPS o localhost.'));
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** A bounded manifest followed by raw blobs avoids archive decompression and base64 copies. */
export async function saveProject(items) {
  validateWorkspace(items);
  const blobs = [];
  const entries = [];
  let offset = 0;
  for (const item of items) {
    const current = await (await fetch(item.url)).blob();
    const original = item.file || await (await fetch(item.originalUrl || item.url)).blob();
    const currentEntry = { offset, length: current.size, type: current.type || item.type, sha256: await sha256(current) };
    blobs.push(current); offset += current.size;
    const originalEntry = item.url === item.originalUrl ? currentEntry : { offset, length: original.size, type: original.type || item.originalType, sha256: await sha256(original) };
    if (originalEntry !== currentEntry) { blobs.push(original); offset += original.size; }
    entries.push({ name: item.name, originalName: item.originalName || item.name, lastModified: item.lastModified || 0, current: currentEntry, original: originalEntry });
  }
  const header = new TextEncoder().encode(JSON.stringify({ version: 2, items: entries }));
  if (header.length > MAX_HEADER_BYTES || offset + header.length + 12 + TRAILER_BYTES > MAX_PROJECT_BYTES) throw new Error(t('El proyecto supera el tamaño permitido.'));
  const prefix = new Uint8Array(12);
  prefix.set(new TextEncoder().encode(MAGIC));
  new DataView(prefix.buffer).setUint32(8, header.length, true);
  const headerHash = await sha256(new Blob([prefix, header]));
  const trailer = Uint8Array.from(headerHash.match(/../g), (value) => parseInt(value, 16));
  return new Blob([prefix, header, ...blobs, trailer], { type: 'application/octet-stream' });
}

export function validateProjectManifest(manifest, payloadBytes) {
  if (![1, 2].includes(manifest?.version) || !Array.isArray(manifest.items) || !manifest.items.length || manifest.items.length > MAX_WORKSPACE_ITEMS) throw new Error(t('Proyecto incompatible.'));
  const ranges = new Map();
  for (const entry of manifest.items) {
    if (!entry || !validName(entry.name) || !validName(entry.originalName)
      || !Number.isSafeInteger(entry.lastModified) || entry.lastModified < 0) throw new Error(t('Datos del proyecto no válidos.'));
    for (const part of [entry.current, entry.original]) {
      if (!part || !Number.isSafeInteger(part.offset) || !Number.isSafeInteger(part.length) || part.offset < 0 || part.length < 1
        || part.length > MAX_WORKSPACE_BYTES || part.offset + part.length > payloadBytes || !supportedType(part.type)
        || manifest.version === 2 && (typeof part.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(part.sha256))) throw new Error(t('Imagen del proyecto no válida.'));
      const existing = ranges.get(part.offset);
      if (existing && (existing.length !== part.length || existing.type !== part.type || existing.sha256 !== part.sha256)) throw new Error(t('Contenido del proyecto incoherente.'));
      ranges.set(part.offset, part);
    }
    if (entry.original.length > MAX_FILE_BYTES) throw new Error(t('El original supera los 40 MB.'));
  }
  let end = 0;
  for (const part of [...ranges.values()].sort((a, b) => a.offset - b.offset)) {
    if (part.offset !== end) throw new Error(t('Contenido del proyecto incompleto o solapado.'));
    end += part.length;
  }
  if (end !== payloadBytes) throw new Error(t('El proyecto contiene datos inesperados.'));
}

export async function openProject(file) {
  if (file.size > MAX_PROJECT_BYTES || file.size < 12) throw new Error(t('Tamaño de proyecto no válido.'));
  const prefix = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const magic = new TextDecoder().decode(prefix.slice(0, 8));
  if (![MAGIC, LEGACY_MAGIC].includes(magic)) throw new Error(t('Este archivo no es un proyecto de Image in Place.'));
  const length = new DataView(prefix.buffer).getUint32(8, true);
  if (!length || length > MAX_HEADER_BYTES || length + 12 > file.size) throw new Error(t('Cabecera de proyecto no válida.'));
  let manifest;
  try { manifest = JSON.parse(await file.slice(12, 12 + length).text()); }
  catch { throw new Error(t('El contenido del proyecto no es válido.')); }
  const verified = magic === MAGIC;
  if (manifest?.version !== (verified ? 2 : 1)) throw new Error(t('Versión de proyecto incoherente.'));
  const start = 12 + length;
  const payloadEnd = file.size - (verified ? TRAILER_BYTES : 0);
  if (payloadEnd < start) throw new Error(t('Proyecto incompleto.'));
  validateProjectManifest(manifest, payloadEnd - start);
  if (verified) {
    const trailer = new Uint8Array(await file.slice(payloadEnd).arrayBuffer());
    const expected = [...trailer].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    if (await sha256(file.slice(0, start)) !== expected) throw new Error(t('La integridad del proyecto no coincide: la cabecera está dañada.'));
    const checked = new Set();
    for (const entry of manifest.items) for (const part of [entry.current, entry.original]) {
      if (checked.has(part.offset)) continue;
      if (await sha256(file.slice(start + part.offset, start + part.offset + part.length)) !== part.sha256) throw new Error(t('La integridad del proyecto no coincide: una imagen está dañada.'));
      checked.add(part.offset);
    }
  }
  const items = [];
  try {
    for (const entry of manifest.items) {
      const read = (part) => file.slice(start + part.offset, start + part.offset + part.length, part.type);
      const current = read(entry.current);
      const original = read(entry.original);
      const info = await inspectImage(current);
      const originalInfo = entry.current.offset !== entry.original.offset ? await inspectImage(original) : info;
      const url = URL.createObjectURL(current);
      const thumbnailUrl = URL.createObjectURL(info.thumbnail);
      items.push({ id: crypto.randomUUID(), name: entry.name, type: current.type, size: current.size, url,
        originalUrl: entry.current.offset === entry.original.offset ? url : URL.createObjectURL(original),
        originalName: entry.originalName, originalType: original.type, originalSize: original.size,
        file: new File([original], entry.originalName, { type: original.type, lastModified: entry.lastModified }),
        lastModified: entry.lastModified, width: info.width, height: info.height, originalWidth: originalInfo.width, originalHeight: originalInfo.height, thumbnailUrl, thumbnailSize: info.thumbnail.size, originalThumbnailSize: originalInfo.thumbnail.size, originalThumbnailUrl: entry.current.offset === entry.original.offset ? thumbnailUrl : URL.createObjectURL(originalInfo.thumbnail) });
      validateWorkspace(items);
    }
    return { items, integrityVerified: verified };
  } catch (cause) { releaseItems(items); throw cause; }
}
