import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Enforced by the browser: the page may not send data anywhere except its own origin.
// Only added to production builds because the dev server injects inline scripts for HMR.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "connect-src 'self' blob:",
  "font-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

// Response headers for static hosts that read a `_headers` file (Netlify, Cloudflare Pages).
// Headers can express what a <meta> CSP cannot: frame-ancestors, HSTS and the like.
const SECURITY_HEADERS = {
  'Content-Security-Policy': `${CONTENT_SECURITY_POLICY}; frame-ancestors 'none'; upgrade-insecure-requests`,
  'Strict-Transport-Security': 'max-age=31536000',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

const headersFile = () => [
  '/*',
  ...Object.entries(SECURITY_HEADERS).map(([name, value]) => `  ${name}: ${value}`),
  '',
  '/assets/*',
  '  Cache-Control: public, max-age=31536000, immutable',
  '',
].join('\n');

const contentSecurityPolicy = () => ({
  name: 'content-security-policy',
  apply: 'build',
  transformIndexHtml: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY }, injectTo: 'head-prepend' }],
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: '_headers', source: headersFile() });
  },
});

export default defineConfig({
  plugins: [react(), contentSecurityPolicy()],
});
