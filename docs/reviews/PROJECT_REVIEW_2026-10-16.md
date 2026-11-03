> Historical report. Original dates, paths, and validation claims are preserved. Referenced raw screenshots and temporary reproductions were removed during repository cleanup; maintained regressions live in `scripts/`. This report does not describe fresh production verification.

# Project review — 2026-10-16

## Scope

Reviewed clean commit 0bd91537f622994850fe45822e91ecd1ba173877 in D:/Proyectos/imagenes. No application files were changed and no deployment was performed. Reproduction scripts and evidence are stored in the ignored .impeccable/review directory.

## Findings

### P1 — Existing privacy zones do not follow subsequent transforms

Locations: src/features/imageEngine.js:111,132; src/features/Editor.jsx:172.

The image is rotated or cropped first, and privacy zones are then applied using their unchanged normalized output coordinates. Changing rotation, reflection or crop does not transform existing zones or bake them into the image first. This differs from the previously fixed stale-detection problem: the zones already exist before the transform.

Reproduced in Chromium using the actual renderImage module and a synthetic 160 by 100 image. A red rectangle covered with a solid black zone returns [0,0,0,255] at its center before a 90-degree rotation. After rotation, the same subject point returns [255,0,0,255], exposing the original content.

Impact: a later edit can reveal content the user intentionally hid, including in the final render used by export.

Recommendation: preserve source-space geometry for masks and transform it with the image, or bake privacy edits before coordinate-changing operations while keeping undo transactional. Add regressions for both rotation directions, reflection, cropping, resize, undo and export. Never silently drop zones as a fix.

### P2 — HEIC dimensions are validated after pixel allocation

Locations: src/features/heicWorker.js:25-28; src/features/heic.js:23.

The worker allocates width * height * 4 bytes and renders decoded pixels before the parent validates dimensions. The native-decoder fallback also catches a dimension-limit error and attempts the worker path.

Replayed the actual worker with a synthetic decoder reporting 10000 by 10000 dimensions and intercepted allocation without consuming that memory. It requests 400,000,000 bytes before any 40-megapixel rejection. This is a controlled boundary test, not a real oversized HEIC file or a measured device crash.

Impact: a compressed oversized file can cause unnecessary memory pressure or terminate the worker/tab before the advertised limit takes effect.

Recommendation: validate dimensions and checked byte arithmetic in the worker immediately after reading metadata, before allocation/display. Reject native dimension-limit errors instead of retrying decoding. Include oversize, invalid dimensions and allocation failures in tests.

### P2 — Reused OCR worker retains the first request's progress callback

Locations: src/features/ai/ocr.js:17,28.

getWorker returns a cached worker for the same languages. Its logger still closes over the onProgress callback passed when the worker was created.

Replayed the real module using a deterministic OCR substitute. Two consecutive recognition calls produce callback counts first=2, second=0. The editor rejects progress updates belonging to the old request, so subsequent runs do not receive progress updates through their own callback. Final recognition results can still succeed.

Recommendation: route progress through the currently active request, resetting the callback in finally and after cancellation. Verify consecutive recognition, cancellation/retry and language changes.

## Validation

- npm run check passed: ESLint, 73 unit tests across nine files and production build.
- node scripts/audit-fixes.mjs passed against the local production preview: opt-out during encoding, exclusive recovery ownership, cross-tab deletion, translated offline status, stale detection and mobile target sizes.
- npm audit --omit=dev reported zero known vulnerabilities in the audited production dependency tree. This does not prove the absence of application vulnerabilities.
- Repository remains clean.

Evidence files:

- review-20261016.mjs: actual browser renderer and controlled HEIC allocation test.
- review-ocr-20261016.mjs: controlled OCR callback reuse test.
- review-20261016-evidence.json: recorded results.
- dependency-audit-20261016.json: npm audit output.

## Limits

The complete end-to-end suite was not rerun in this review. The new renderer reproduction uses Chromium; these specific failure cases were not separately qualified in Firefox/WebKit or on real low-memory devices. No current production asset comparison or deployment verification was performed. The earlier 2026-10-12 publication results are historical context, not fresh production evidence.

Prioritize the privacy transform fix before the next release, then enforce worker-side HEIC limits and correct OCR progress ownership.
