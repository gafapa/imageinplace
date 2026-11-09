# Deployment

The site is the static `dist/` folder, served at [imageinplace.com](https://imageinplace.com) by the shared `static-sites` Nginx service of the gallego.top server behind Traefik. Publishing follows the hub runbook `D:\gallego.top\runbooks\static-sites.md`; release archives, manifests, backups and rollback notes are kept under `D:\gallego.top\ops\sites\imageinplace\`.

## Release steps

1. `npm ci && npm run check`, then the browser regressions (see [TESTING.md](TESTING.md)).
2. Package exactly `dist/`, keep a per-file SHA-256 manifest and scan it with the hub's `Test-StaticSiteContent`.
3. With explicit credential authorisation, upload with the hub's pinned helpers, take a checksum-verified backup and run the static-site content synchronisation. Do not touch shared configuration or other containers.
4. Verify HTTPS, every public file hash and live browser behaviour (`TEST_URL=https://imageinplace.com node e2e/run.mjs …`).

## Response headers

The `imageinplace-security` Traefik middleware must send: the same CSP as the build's `<meta>` tag plus a `frame-ancestors` directive, HSTS, `X-Content-Type-Options: nosniff`, a Referrer-Policy and a Permissions-Policy. A `<meta>` CSP cannot express `frame-ancestors`, so the header is required.

## Routing

The domain uses only the shared `static-sites` router, so every path gets the editor policy. The analyzer's dedicated Traefik file was removed with the 2026-11-09 release (`a6555b3`).
