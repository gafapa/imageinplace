# Verified publication — 2026-11-03

The application build from commit [`45c8d909a0fb44e7345f53157a346ee182490e3c`](https://github.com/gafapa/imageinplace/commit/45c8d909a0fb44e7345f53157a346ee182490e3c) is published at [imageinplace.com](https://imageinplace.com).

## Release evidence

- 45 production files, each fetched from the public HTTPS origin and matched against its local SHA-256 digest.
- Release archive SHA-256: `70ced6a05bbe4d60f1b46b0e990ef585f5eb4e2689e6508119abc93a953d6356`.
- Authenticated server backup verified against every file in the previous 40-file site. Backup archive and configuration checksums were checked again after publication.
- The installed synchronization workflow replaced only the domain content. Static-sites and Traefik container identities stayed unchanged; Nginx configuration validation passed.
- Shared routing and the domain's Nginx configuration remained byte-identical. A separate Traefik file configures only the analyzer HTML and its two public assets.
- Editor CSP, framing policy, and same-origin resource policy remained unchanged. Analyzer HTML permits same-origin framing and public HTTPS reads inside an opaque sandbox; its script/style resources have the resource policy needed by that sandbox.

## Live checks

The advanced and security browser suites passed against the actual HTTPS site, including restoration, 4× enlargement, AVIF decoding, smallest-format/transparency checks, saved-HTML analysis, sandbox isolation, blocked-storage startup, ZIP filename collisions, workflow storage errors, rejection of local URLs, desktop/mobile layout, visible close controls, and offline notice/reconnection behavior. These checks used synthetic fixtures.

HTTPS returned 200 with certificate verification successful. HTTPS `www` returned 301 to the canonical origin. The server-local HTTP endpoint returned 308 to HTTPS; the external validation client's port-80 connection timed out, so external HTTP redirection was not confirmed from that client.

## Operations and rollback

The server hub retains the release archive, per-file manifest, applied routing source, publication evidence, and backup/rollback instructions under `D:\gallego.top\ops\imageinplace\`. The dated canonical inventory evidence is `D:\gallego.top\inventory\imageinplace-deployment-20261103.json`. Temporary upload files were removed after verification. No DNS, application data, database, model, or container-image change was needed.

The follow-up documentation and HTTPS test-routing change do not alter application assets. The published application build remains the exact commit and file hashes identified above.
