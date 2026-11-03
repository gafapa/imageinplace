import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../public/page-audit.js', import.meta.url), 'utf8');
const node = () => ({ append() {}, addEventListener() {} });
const context = { URL, URLSearchParams, location: { hash: '', search: '?lang=en' }, document: { documentElement: {}, getElementById: node, createElement: node } };
runInNewContext(`${source}\nglobalThis.checkUrl = publicUrl;`, context);

describe('public audit URL restrictions', () => {
  it.each(['https://printer.local.', 'https://device.internal.', 'https://service.localhost.', 'https://host.localdomain.', 'https://router.home.arpa', 'https://router.home.arpa.', 'https://home.arpa', 'https://127.0.0.1', 'https://2130706433', 'https://[::1]', 'https://public.example.org:8443', 'https://user:secret@public.example.org', 'http://public.example.org'])('rejects private, ambiguous or credentialed URL %s', (url) => {
    expect(() => context.checkUrl(url)).toThrow();
  });
  it('accepts public HTTPS resources and resolves relative image paths', () => {
    expect(context.checkUrl('/image.png#fragment', 'https://public.example.org/page')).toBe('https://public.example.org/image.png');
  });
});
