import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { offlineBuild } from './scripts/offline-build.mjs';

// Enforced by the browser: the page may not send data anywhere except its own origin.
// Only added to production builds because the dev server injects inline scripts for HMR.
// The server adds the same policy as a response header, plus frame-ancestors and HSTS (see README).
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

const contentSecurityPolicy = () => ({
  name: 'content-security-policy',
  apply: 'build',
  transformIndexHtml: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY }, injectTo: 'head-prepend' }],
});

export default defineConfig({
  plugins: [react(), contentSecurityPolicy(), offlineBuild()],
});
