# Project review and fixes — 2026-11-03

## Scope and integrity verdict

Reviewed the local working tree, including pending restoration, AVIF, page-audit, and repository-maintenance work. Existing work was preserved. The implementation retains a coherent private image workbench: local processing, isolated external-page reads, transactional project import, bounded history, optional recovery with one writer, and staged batch/editor changes. No deployment or production-header mutation was performed.

## Findings addressed

| Priority | Finding | Result |
| --- | --- | --- |
| P1 | Reading the `localStorage` property in a default argument can throw before startup error handling | Language detection reads the property inside its guarded block; blocked storage no longer prevents first render |
| P1 | Trailing DNS dots bypass the audit's local-host suffix check | Host validation removes the root dot and rejects local suffixes, localdomain, and home.arpa before any network request |
| P1 | Installed development dependencies include published Vite/Vitest advisories | Updated the maintained release lines and regenerated the lockfile; final package-audit counts are recorded below |
| P2 | Old asynchronous dictionary loads can replace a newer language choice | Only the latest request can publish its dictionary and preference |
| P2 | AVIF and AI worker startup/transfer failures leave resources or pending requests | Failure paths remove abort listeners, clear AVIF timeouts, terminate workers, and reject pending requests; message decoding errors are handled |
| P2 | Custom development middleware accepts inherited object keys and has unhandled URL/file errors | Asset routing uses own-property checks, malformed encodings return 400, and file/stream failures reach Connect's error handler |
| P2 | Workflow quarter turns add a pixel because of floating-point rounding | Rotation bounds remove the small rounding error, and canvas sizes must be finite integers |
| P2 | A failed workflow deletion appears successful in memory | The stored workflow and visible selection remain intact and an error is shown |
| P2 | Batch ZIP names can collide on case-insensitive systems | Export uses the shared filename sanitizer, actual MIME extensions, and case-insensitive collision handling |
| P2 | Audit dialog has no programmatic title | Dialog now references its heading through `aria-labelledby` |
| P2 | Mobile toolbar styles hide the analyzer's text-only close button | A visible close icon and explicit accessible name remain available when compact labels are hidden |
| P2 | The analyzer opens an empty iframe when the browser is offline | An explicit notice explains that opening the isolated analyzer needs a connection; image editing stays available and the analyzer opens after reconnecting |

## UI quality review

These are scoped engineering judgments, not WCAG certification or a complete visual redesign.

| Dimension | Score | Evidence |
| --- | --- | --- |
| Accessibility | 3/4 | Native controls, keyboard affordances and a named audit dialog; full screen-reader/contrast coverage remains outside this review |
| Performance | 3/4 | Local workers and on-demand models; browser buffers and model downloads still need device-specific qualification |
| Responsive design | 3/4 | Viewport-contained app, maintained desktop/mobile regressions |
| Theming | 3/4 | Current documented font/palette; some feature styles retain literal values |
| Implementation integrity | 4/4 | Shared filename rules, explicit data boundaries and regression coverage; detector reported no findings on changed UI targets |
| Total | 16/20 | Good within the reviewed scope |

## Dependency policy

React/React DOM, Lucide, ONNX Runtime Web, the Vite React plugin, ESLint, globals, Playwright, Vite, and Vitest were updated within their existing major versions. `minimatch` is overridden to the fixed 11.x line; ESLint must pass against that override. Tesseract's installed 7.x line is retained rather than downgraded to a lower registry dist-tag.

Relevant primary advisories: [Vitest Windows path traversal](https://github.com/vitest-dev/vitest/security/advisories/GHSA-xp26-3454-mjgp), [minimatch pattern amplification](https://github.com/isaacs/minimatch/security/advisories/GHSA-g3hv-75wg-m249). The initial npm audit reported 10 dependency entries: two high and eight moderate. These are dependency-entry counts, not ten independently exploitable production defects.

## Validation

Initial baseline: ESLint, 109 unit tests across 14 files, and production build passed. New focused regressions: 54 tests across six files passed. The mechanical UI detector returned no findings for PageAudit, WorkflowPanel and BatchPanel.

Final validation:

- `npm run check`: ESLint, 141 tests across 18 files, and Vite 8.3.5 production build passed.
- `npm audit` and `npm audit --omit=dev`: zero known vulnerabilities. JSON results are in ignored `artifacts/security/dependencies-all.json` and `dependencies-production.json`.
- Core browser regressions passed: import, history, draft save/cancel, comparison, compression, filename handling, annotations, PDF/workflows, background removal/trim, project integrity/limits, geometry, offline reload/export, update lifecycle, keyboard/language/mobile workflows, recovery races, detection revisions, and privacy transforms.
- Real decoder/model regressions passed: HEIC import; background removal and 52 detected faces in Chromium and WebKit; OCR-assisted solid text coverage and on-demand offline caching. These use verified public/synthetic fixtures, not student data.
- `npm run test:advanced`: restoration, enlargement, local suggestions, real AVIF decoding, smallest-format selection/transparency, sandboxed page analysis, and mobile layout passed.
- `npm run test:security`: blocked-storage startup, safe/case-insensitive ZIP names, durable workflow deletion failure, named dialog, visible mobile close control, rejection of local hosts before network access, explicit offline notice and successful reopening after reconnection passed.
- Standalone `scripts/capture.mjs` passed against the production preview.
- Desktop/mobile screenshots were inspected. `git diff --check` and active documentation links passed.

The core sequence ran on the first updated build. The final analyzer-only changes were subsequently rebuilt and checked by the final security/offline and advanced suites. The complete unrelated image-processing sequence was not repeated after those analyzer changes.

Installed versions include React/React DOM 19.3.1, Lucide 1.66.0, ONNX Runtime Web 1.31.1, Vite React plugin 6.2.1, ESLint 10.14.0, globals 17.14.0, Playwright 1.64.1, Vite 8.3.5, Vitest 5.1.0, minimatch 11.0.4, and Zod 4.6.7.

## Limits

No authenticated production review, deployment, real student data, legal certification, full assistive-technology audit, or real low-memory-device qualification. Hostname filtering cannot prove DNS resolution is public. Browser caches and recovery remain local to the browser profile. Historical reports and previous cleanup blockers remain separate from this review.
