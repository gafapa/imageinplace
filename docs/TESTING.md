# Testing

## Local checks

Install locked dependencies with `npm ci`. Run `npm run check` for ESLint, unit tests, and the production build. Unit tests cover processing helpers, geometry and privacy transforms, project integrity, HEIC limits, OCR ownership, translations, and generated offline behavior.

## Browser regressions

Install the required Playwright Chromium and WebKit browsers with `npx playwright install chromium webkit`. In one terminal run:

```sh
npm run build
npm run preview -- --host 127.0.0.1 --port 4180
```

In another terminal run `npm run test:e2e` and `npm run test:advanced`. `npm run test:security` runs the security regression subset on its own. Most suites default to port 4180 and accept `TEST_URL`. The standalone `node scripts/capture.mjs` suite defaults to port 4173; set `TEST_URL=http://127.0.0.1:4180` to use the production preview. Tests that exercise service workers require a production build.

| Scripts | Coverage |
| --- | --- |
| `features`, `history-editor`, `individual-actions` | Gallery/history, draft isolation, comparison, compression, rename, canvas, annotations |
| `workflow-print` | Saved workflows, malformed preferences, printable layout and names |
| `review-fixes`, `background-trim` | Export and editing regressions, uniform background removal and trimming |
| `project-safety` | Project round trips, corruption, limits, legacy compatibility |
| `geometry-offline`, `offline-lifecycle` | Geometry, offline reload/export, waiting updates, cache isolation and failed installs |
| `usability` | Keyboard, language, mobile layout, recovery, zoom, source-format export, Chromium/WebKit filters |
| `on-device-ai` | HEIC, face detection, background removal, OCR and on-demand offline assets |
| `audit-fixes` | Recovery ownership/deletion, detection revisions, translated offline status, touch targets |
| `privacy-transforms` | Privacy masks through transforms, undo, saved drafts and export in Chromium/WebKit |
| `advanced-features` | Restoration, local suggestions, enlargement, AVIF, automatic transparent exports and page-audit isolation |
| `security-regressions` | Blocked-storage startup, case-insensitive ZIP filenames, workflow deletion failure, named audit dialog, local URLs and mobile containment |
| `offline-page-audit` | Explicit offline notice without an empty iframe, preserved app shell, and successful analyzer opening after reconnecting |
| `capture` | Standalone desktop/mobile import, gallery, batch and individual-editor regressions |

Names in the table refer to `.mjs` files in `scripts/`. Browser output is disposable and written under `artifacts/browser/`; no user images are needed. The AI suite downloads verified third-party sample files to `node_modules/.cache` on first use. Keep production model binaries and their license/checksum notices in `public/ai/`.

## Evidence limits

A build or unit-test pass does not establish full browser coverage, low-memory-device behavior, accessibility certification, or production deployment. Record which browser suites actually ran. Historical findings and follow-up reports are retained in [reviews/](reviews/); their old reproduction paths are historical references.
