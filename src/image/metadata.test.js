import { crc32 } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { orientationTiff, readOrientation, sensitiveFields, stripJpeg, stripMetadata, stripPng, stripWebp } from './metadata.js';

const bytes = (...parts) => new Uint8Array(parts.flatMap((part) => (typeof part === 'string' ? [...part].map((char) => char.charCodeAt(0)) : [...part])));
const segment = (marker, ...payload) => {
  const body = bytes(...payload);
  return [0xff, marker, (body.length + 2) >> 8, (body.length + 2) & 0xff, ...body];
};
const includes = (haystack, needle) => {
  const target = bytes(needle);
  return haystack.some((_, index) => target.every((byte, offset) => haystack[index + offset] === byte));
};

// A little-endian TIFF with orientation 6 and a fake GPS pointer, like a phone photo.
const phoneTiff = [0x49, 0x49, 0x2a, 0, 8, 0, 0, 0, 2, 0, 0x12, 0x01, 3, 0, 1, 0, 0, 0, 6, 0, 0, 0, 0x25, 0x88, 4, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

describe('JPEG', () => {
  const scan = [0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56];
  const jpeg = bytes([0xff, 0xd8], segment(0xe0, 'JFIF\0', [1, 1, 0, 0, 1, 0, 1, 0, 0]), segment(0xe1, 'Exif\0\0', phoneTiff),
    segment(0xe1, 'http://ns.adobe.com/xap/1.0/\0<x:xmpmeta>Lucía</x:xmpmeta>'), segment(0xe2, 'ICC_PROFILE\0', [1, 1, 9]),
    segment(0xed, 'Photoshop 3.0\0IPTC'), segment(0xfe, 'Alumno: Pedro'), segment(0xdb, [0, 1, 2]), segment(0xda, [1, 2, 3]),
    scan, [0xff, 0xd9], 'MOTION-PHOTO-VIDEO');

  it('removes EXIF, XMP, IPTC, comments and appended data but keeps the profile and the scan bytes', () => {
    const { bytes: clean, removed } = stripJpeg(jpeg);
    expect(removed.sort()).toEqual(['comment', 'exif', 'iptc', 'trailer', 'xmp']);
    for (const secret of ['Lucía', 'Pedro', 'IPTC', 'MOTION', 'JFIF']) expect(includes(clean, secret)).toBe(false);
    expect(includes(clean, 'ICC_PROFILE')).toBe(true);
    expect(includes(clean, bytes(segment(0xda, [1, 2, 3]), scan, [0xff, 0xd9]))).toBe(true);
    expect([...clean.subarray(-2)]).toEqual([0xff, 0xd9]);
  });

  it('keeps only the orientation so the photo is not shown sideways', () => {
    const { bytes: clean } = stripJpeg(jpeg);
    expect([...clean.subarray(0, 4)]).toEqual([0xff, 0xd8, 0xff, 0xe1]);
    expect(readOrientation(clean.subarray(12, 12 + 26))).toBe(6);
    expect(includes(clean, bytes([0x25, 0x88]))).toBe(false);
  });

  it('adds no EXIF when the orientation is the default one', () => {
    const plain = bytes([0xff, 0xd8], segment(0xfe, 'x'), segment(0xda, [1]), [7], [0xff, 0xd9]);
    expect([...stripJpeg(plain).bytes]).toEqual([0xff, 0xd8, ...segment(0xda, [1]), 7, 0xff, 0xd9]);
  });

  it('rejects damaged files instead of guessing', () => {
    expect(() => stripJpeg(bytes([0xff, 0xd8, 0xff, 0xe1, 0, 40]))).toThrow('Damaged');
    expect(() => stripJpeg(bytes([0xff, 0xd8], segment(0xda, [1]), [1, 2]))).toThrow('Damaged');
  });
});

describe('PNG', () => {
  const chunk = (type, ...data) => {
    const body = bytes(...data);
    return [body.length >>> 24, (body.length >> 16) & 255, (body.length >> 8) & 255, body.length & 255, ...bytes(type), ...body, 0, 0, 0, 0];
  };
  const png = bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], chunk('IHDR', [0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]),
    chunk('tEXt', 'Author\0Ana'), chunk('eXIf', [...orientationTiff(3)]), chunk('tIME', [7, 234, 1, 1, 0, 0, 0]), chunk('iCCP', 'p\0\0x'),
    chunk('IDAT', [1, 2, 3]), chunk('IEND'));

  it('drops text, time and EXIF chunks and re-adds only the orientation before the image data', () => {
    const { bytes: clean, removed } = stripPng(png);
    expect(removed.sort()).toEqual(['date', 'exif', 'text']);
    expect(includes(clean, 'Ana')).toBe(false);
    expect(includes(clean, 'tIME')).toBe(false);
    const exif = clean.findIndex((_, index) => includes(clean.subarray(index, index + 4), 'eXIf'));
    expect(exif).toBeLessThan(clean.findIndex((_, index) => includes(clean.subarray(index, index + 4), 'IDAT')));
    expect(readOrientation(clean.subarray(exif + 4, exif + 30))).toBe(3);
    const crc = new DataView(clean.buffer).getUint32(exif + 30);
    expect(crc).toBe(crc32(clean.subarray(exif, exif + 30)));
  });
});

describe('WebP', () => {
  const chunk = (type, ...data) => { const body = bytes(...data); const size = body.length; return [...bytes(type), size & 255, (size >> 8) & 255, 0, 0, ...body, ...(size & 1 ? [0] : [])]; };
  const body = bytes('WEBP', chunk('VP8X', [0x2c, 0, 0, 0, 0, 0, 0, 0, 0, 0]), chunk('VP8 ', [1, 2, 3]), chunk('EXIF', phoneTiff), chunk('XMP ', '<x>Ana</x>'));
  const webp = bytes('RIFF', [body.length & 255, body.length >> 8, 0, 0], body);

  it('removes EXIF and XMP chunks, clears their flags and fixes the RIFF size', () => {
    const { bytes: clean, removed } = stripWebp(webp);
    expect(removed.sort()).toEqual(['exif', 'xmp']);
    expect(includes(clean, 'Ana')).toBe(false);
    expect(clean[20]).toBe(0x20);
    expect(new DataView(clean.buffer).getUint32(4, true)).toBe(clean.length - 8);
  });
});

describe('formats and fields', () => {
  it('returns null for formats that are not cleaned losslessly', () => {
    expect(stripMetadata(bytes('GIF89a'), 'image/gif')).toBeNull();
  });
  it('groups the metadata a user would recognise', () => {
    expect(sensitiveFields({ latitude: 42.1, Model: 'Pixel', DateTimeOriginal: new Date(), Artist: '' })).toEqual({ location: true, date: true, device: true, author: false, text: false, software: false });
  });
});
