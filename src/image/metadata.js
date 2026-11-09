/**
 * Lossless removal of hidden data (EXIF/GPS, XMP, IPTC, comments, embedded thumbnails, text chunks and
 * data appended after the image) from JPEG, PNG and WebP bytes. Pixels are copied byte for byte; only the
 * colour profile and, when it is not the default, the orientation tag are kept so the image looks the same.
 */

const TEXT = new TextDecoder('latin1');
const ascii = (bytes, start, length) => TEXT.decode(bytes.subarray(start, start + length));

/** Read the EXIF orientation (1–8) from a TIFF structure, or 1 when absent or malformed. */
export function readOrientation(tiff) {
  if (tiff.length < 8) return 1;
  const order = ascii(tiff, 0, 2);
  if (order !== 'II' && order !== 'MM') return 1;
  const view = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
  const little = order === 'II';
  const ifd = view.getUint32(4, little);
  if (ifd + 2 > tiff.length) return 1;
  const count = view.getUint16(ifd, little);
  for (let index = 0; index < count; index++) {
    const entry = ifd + 2 + index * 12;
    if (entry + 12 > tiff.length) return 1;
    if (view.getUint16(entry, little) === 0x0112) {
      const value = view.getUint16(entry + 8, little);
      return value >= 1 && value <= 8 ? value : 1;
    }
  }
  return 1;
}

/** A TIFF structure containing only the orientation tag. */
export function orientationTiff(orientation) {
  return new Uint8Array([0x4d, 0x4d, 0, 0x2a, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, orientation, 0, 0, 0, 0, 0, 0]);
}

const concat = (parts) => {
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { output.set(part, offset); offset += part.length; }
  return output;
};

const EXIF_HEADER = [0x45, 0x78, 0x69, 0x66, 0, 0];

export function stripJpeg(bytes) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('Not a JPEG file');
  const parts = [bytes.subarray(0, 2)];
  const removed = new Set();
  let orientation = 1;
  let position = 2;
  let ended = false;
  while (position < bytes.length - 1) {
    if (bytes[position] !== 0xff) throw new Error('Damaged JPEG file');
    const marker = bytes[position + 1];
    if (marker === 0xff) { position++; continue; }
    if (marker === 0xd9) { parts.push(bytes.subarray(position, position + 2)); position += 2; ended = true; break; }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { parts.push(bytes.subarray(position, position + 2)); position += 2; continue; }
    const length = (bytes[position + 2] << 8) | bytes[position + 3];
    const end = position + 2 + length;
    if (length < 2 || end > bytes.length) throw new Error('Damaged JPEG file');
    const payload = bytes.subarray(position + 4, end);
    const isApp = marker >= 0xe0 && marker <= 0xef;
    const keep = !isApp && marker !== 0xfe
      || (marker === 0xe2 && ascii(payload, 0, 12) === 'ICC_PROFILE\0')
      || (marker === 0xee && ascii(payload, 0, 5) === 'Adobe');
    if (keep) parts.push(bytes.subarray(position, end));
    else {
      if (marker === 0xe1 && ascii(payload, 0, 6) === 'Exif\0\0') { orientation = readOrientation(payload.subarray(6)); removed.add('exif'); }
      else if (marker === 0xe1) removed.add('xmp');
      else if (marker === 0xed) removed.add('iptc');
      else if (marker === 0xfe) removed.add('comment');
      else if (marker !== 0xe0) removed.add('other');
    }
    position = end;
    if (marker === 0xda) {
      // Entropy-coded scan data runs until the next marker that is neither byte stuffing nor a restart.
      let scan = position;
      while (scan < bytes.length - 1 && !(bytes[scan] === 0xff && bytes[scan + 1] !== 0 && !(bytes[scan + 1] >= 0xd0 && bytes[scan + 1] <= 0xd7))) scan++;
      parts.push(bytes.subarray(position, scan));
      position = scan;
    }
  }
  if (!ended) throw new Error('Damaged JPEG file');
  // Motion photos and some phones append whole videos or extra images after the end marker.
  if (position < bytes.length) removed.add('trailer');
  if (orientation !== 1) {
    const tiff = orientationTiff(orientation);
    const length = 2 + EXIF_HEADER.length + tiff.length;
    parts.splice(1, 0, new Uint8Array([0xff, 0xe1, length >> 8, length & 0xff, ...EXIF_HEADER]), tiff);
  }
  return { bytes: concat(parts), removed: [...removed] };
}

let crcTable;
function crc32(bytes) {
  crcTable ||= Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

const pngChunk = (type, data) => {
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  chunk.set([...type].map((char) => char.charCodeAt(0)), 4);
  chunk.set(data, 8);
  view.setUint32(8 + data.length, crc32(chunk.subarray(4, 8 + data.length)));
  return chunk;
};

// Chunks that affect how the pixels look (or animate). Everything else — text, time, EXIF, vendor data — goes.
const PNG_KEEP = new Set(['IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS', 'cHRM', 'gAMA', 'iCCP', 'sBIT', 'sRGB', 'cICP', 'mDCv', 'cLLi', 'bKGD', 'pHYs', 'acTL', 'fcTL', 'fdAT']);
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function stripPng(bytes) {
  if (!PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)) throw new Error('Not a PNG file');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const parts = [bytes.subarray(0, 8)];
  const removed = new Set();
  let orientation = 1;
  let position = 8;
  let ended = false;
  while (position + 12 <= bytes.length) {
    const length = view.getUint32(position);
    const type = ascii(bytes, position + 4, 4);
    const end = position + 12 + length;
    if (end > bytes.length) throw new Error('Damaged PNG file');
    if (PNG_KEEP.has(type)) {
      if (type === 'IDAT' && orientation !== 1) { parts.push(pngChunk('eXIf', orientationTiff(orientation))); orientation = 1; }
      parts.push(bytes.subarray(position, end));
    } else {
      if (type === 'eXIf') { orientation = readOrientation(bytes.subarray(position + 8, position + 8 + length)); removed.add('exif'); }
      else if (['tEXt', 'zTXt', 'iTXt'].includes(type)) removed.add(ascii(bytes, position + 8, 17) === 'XML:com.adobe.xmp' ? 'xmp' : 'text');
      else if (type === 'tIME') removed.add('date');
      else removed.add('other');
    }
    position = end;
    if (type === 'IEND') { ended = true; break; }
  }
  if (!ended) throw new Error('Damaged PNG file');
  if (position < bytes.length) removed.add('trailer');
  return { bytes: concat(parts), removed: [...removed] };
}

export function stripWebp(bytes) {
  if (ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WEBP') throw new Error('Not a WebP file');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const riffEnd = Math.min(bytes.length, 8 + view.getUint32(4, true));
  const parts = [];
  const removed = new Set();
  let position = 12;
  while (position + 8 <= riffEnd) {
    const type = ascii(bytes, position, 4);
    const size = view.getUint32(position + 4, true);
    const end = position + 8 + size + (size & 1);
    if (position + 8 + size > riffEnd) throw new Error('Damaged WebP file');
    if (type === 'EXIF' || type === 'XMP ') removed.add(type === 'EXIF' ? 'exif' : 'xmp');
    else if (type === 'VP8X') {
      const chunk = bytes.slice(position, Math.min(end, riffEnd));
      chunk[8] &= ~0x0c; // Clear the EXIF and XMP presence flags.
      parts.push(chunk);
    } else parts.push(bytes.subarray(position, Math.min(end, riffEnd)));
    position = end;
  }
  if (riffEnd < bytes.length) removed.add('trailer');
  const body = concat(parts);
  const header = new Uint8Array(12);
  header.set(bytes.subarray(0, 12));
  new DataView(header.buffer).setUint32(4, body.length + 4, true);
  return { bytes: concat([header, body]), removed: [...removed] };
}

const STRIPPERS = { 'image/jpeg': stripJpeg, 'image/png': stripPng, 'image/webp': stripWebp };

/** Bytes of the image without hidden data, or null when the format is not handled losslessly. */
export function stripMetadata(bytes, type) {
  return STRIPPERS[type]?.(bytes) ?? null;
}

/**
 * Clean a blob. JPEG, PNG and WebP keep their exact pixels; other formats (GIF, SVG, BMP…) are redrawn
 * into a PNG, which carries no metadata. `redraw` receives the blob and must return a PNG blob.
 */
export async function cleanImageBlob(blob, redraw) {
  const result = stripMetadata(new Uint8Array(await blob.arrayBuffer()), blob.type);
  if (result) return { blob: new Blob([result.bytes], { type: blob.type }), removed: result.removed, converted: false };
  return { blob: await redraw(blob), removed: ['other'], converted: true };
}

/** Group exifr output into the kinds of personal information a teacher would care about. */
export function sensitiveFields(data = {}) {
  const has = (...keys) => keys.some((key) => data[key] != null && data[key] !== '');
  return {
    location: has('latitude', 'longitude', 'GPSLatitude', 'GPSLongitude', 'GPSPosition'),
    date: has('DateTimeOriginal', 'CreateDate', 'ModifyDate', 'DateTime', 'DateCreated', 'GPSDateStamp'),
    device: has('Make', 'Model', 'LensModel', 'SerialNumber', 'BodySerialNumber', 'LensSerialNumber', 'InternalSerialNumber'),
    author: has('Artist', 'Copyright', 'creator', 'rights', 'OwnerName', 'CameraOwnerName', 'Byline', 'By-line', 'XPAuthor'),
    text: has('ImageDescription', 'UserComment', 'XPComment', 'XPTitle', 'XPSubject', 'XPKeywords', 'description', 'title', 'subject', 'Caption', 'Headline', 'Keywords'),
    software: has('Software', 'CreatorTool', 'HostComputer'),
  };
}
