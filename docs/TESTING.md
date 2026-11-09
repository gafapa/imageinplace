# Testing

## Unit tests

`npm run check` runs ESLint, Vitest and the production build. Unit tests sit next to their modules (`src/**/*.test.js`, `scripts/*.test.js`) and cover rendering helpers, geometry and privacy-zone transforms, hidden-data removal, project integrity, HEIC limits, OCR request ownership, the offline build and dictionary completeness (every `t()` text translated, same placeholders, no unused keys).

## Browser regressions

```sh
npx playwright install chromium webkit   # once
npm run build && npm run preview         # 127.0.0.1:4180
npm run test:e2e                         # every suite, stops at the first failure
node e2e/run.mjs metadata usability      # selected suites
```

Set `TEST_URL` to run against another origin (for example the live site). Service-worker suites need a production build. Fixtures are synthetic or verified public samples; `on-device-ai` downloads two of them into `node_modules/.cache` on first run. Screenshots and downloads go to the ignored `artifacts/browser/`.

| Suite (`e2e/*.mjs`) | Covers |
| --- | --- |
| `features`, `history-editor`, `individual-actions` | gallery, global history, editor drafts, comparison, compression, rename, canvas, annotations |
| `workflow-print` | saved workflows, malformed presets, A4 PDF layout and captions |
| `export-regressions`, `background-trim` | export regressions, uniform background removal, trimming |
| `project-safety` | project round trips, corruption, limits, version-1 files |
| `geometry-offline`, `offline-lifecycle` | straighten/crop/perspective, offline reload and export, waiting updates, failed installs |
| `usability` | keyboard, languages, mobile layout, recovery, zoom, Chromium/WebKit colour parity |
| `on-device-ai` | HEIC, face detection, AI background removal, OCR covering, on-demand offline assets |
| `recovery-detection` | recovery ownership and deletion, detection invalidation, touch targets |
| `privacy-transforms` | privacy zones through rotate/flip/crop, undo, saved drafts, exported pixels |
| `metadata` | lossless JPEG cleaning, kept orientation, generic names, clean project file |
| `restoration` | batch and editor repair, mobile layout |
| `security-regressions` | startup with blocked storage, case-insensitive ZIP names, workflow storage errors |

A passing run is evidence for the browsers it ran in, not for low-memory devices, assistive technology or production headers. Record which suites ran.
