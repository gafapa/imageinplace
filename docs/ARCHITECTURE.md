# Architecture

A static React + Vite single-page app. All state lives in the tab; heavy pixel work runs in module workers.

## Data flow

1. **Import** (`App.jsx`, `image/imageImport.js`, `image/imageLimits.js`): files are decoded one by one and validated before entering the gallery. HEIC is converted to JPEG (Safari natively, elsewhere with libheif in `image/heicWorker.js`). Each gallery item keeps the current image, the original bytes (`file`, `originalUrl`) and a ≤480 px thumbnail, all as object URLs.
2. **Gallery history** (`app/useImageHistory.js`): every change replaces items immutably; up to 20 snapshots / 256 MiB of retained URLs are kept for undo, and URLs are revoked when no snapshot references them.
3. **Batch actions** (`ui/*Panel.jsx`): a panel previews on thumbnails, processes every selected image with cancellation between images (`app/useBatchTask.js`) and commits all results at once, or none.
4. **Editor** (`ui/Editor.jsx`): edits a draft. Slider settings, privacy zones and annotations are re-rendered from the source on every change (`image/imageEngine.js`); tools that produce a new file (geometry, background, compression…) replace the draft. *Save* or previous/next commits the draft to the gallery; *Discard* drops it. The draft has its own 30-step / 128 MiB undo history.
5. **Output**: every download goes through `image/encode.js` (canvas → blob, JPEG flattened onto white) and `app/download.js` (single file or ZIP). The only lossless path is `image/metadata.js`, which copies JPEG/PNG/WebP bytes while dropping metadata segments.

## Limits

Per file 40 MiB; per image 40 megapixels and 10,000 px per side; per workspace 100 images, 120 megapixels and 250 MiB of retained bytes. These bound what the app keeps, not the browser's total memory (decoders and canvases need more).

## Privacy zones

Zones are stored in normalised source-image coordinates (`image/privacyGeometry.js`), so rotation, reflection, crop and resize project them instead of losing them. Face detection (UltraFace) adds pixelated zones; OCR (Tesseract) lists recognised lines, preselects the ones that look like personal data and covers the chosen ones with solid fills. Detection results are invalidated when the draft changes.

## Hidden data removal

`image/metadata.js` walks the container instead of decoding pixels:

- **JPEG**: keeps SOF/DQT/DHT/SOS and scan data, APP2 ICC profile and APP14 Adobe; drops APP0/APP1 (EXIF, XMP)/APP13 (IPTC)/other APPn and COM; stops at EOI, discarding appended data. A non-default EXIF orientation is rewritten as a minimal 26-byte TIFF.
- **PNG**: keeps only chunks that affect rendering or animation (IHDR, PLTE, IDAT, tRNS, colour chunks, pHYs, APNG); drops text, time, eXIf and vendor chunks; re-adds orientation as a minimal `eXIf`.
- **WebP**: drops EXIF and XMP chunks, clears their VP8X flags and fixes the RIFF size.
- Anything else is redrawn into a PNG.

The gallery action replaces both the current and the original bytes, and resets the stored modification time.

## Project files (`app/project.js`)

A versioned, size-bounded JSON manifest followed by raw image bytes (no archive decompression). Version 2 stores a SHA-256 digest per payload and a trailer protecting the header; opening verifies every digest before decoding anything and adds the images in one history commit. Version-1 files open with a notice. Hashes detect damage, they do not authenticate the author.

## Session recovery (`app/sessionStore.js`)

Opt-in. About 1.5 s after the gallery changes, it is written to IndexedDB as a project blob. A Web Lock makes one tab the only writer; other tabs show a warning. Turning the option off deletes the stored blob in every tab.

## Workers

| Worker | Job |
| --- | --- |
| `image/pixelWorker.js` | background removal, content bounds, restoration filters |
| `image/geometryWorker.js` | perspective resampling at full resolution |
| `image/heicWorker.js` | HEIC decoding (validates dimensions before allocating) |
| `ai/aiWorker.js` | ONNX Runtime: U²-Netp background removal, UltraFace faces |

Cancelling terminates the worker; results are never applied after cancellation.

## On-device AI and OCR

Runtimes and models load on first use only: ONNX Runtime Web (single-threaded WASM, ≈15 MB) with `u2netp.onnx` (4.6 MB) or `ultraface-rfb-640.onnx`; Tesseract.js 7 with `spa`, `eng` and the interface language (≈6–9 MB); libheif (≈2 MB). Models live in `public/ai/models/`; `scripts/ai-assets.mjs` copies runtimes and language data from `node_modules` into `/ai/vendor/`. Licences and checksums: `public/ai/THIRD_PARTY_NOTICES.txt`.

## Offline

`scripts/offline-build.mjs` generates `sw.js` with the exact build asset list and a content-derived cache name. The app shell is precached on the first online visit; AI/OCR/WASM files are cached the first time a tool uses them, in a separate cache keyed by their own hash. Updates wait until other tabs close and never reload a workspace. Only the asset list and the root navigation are handled; imported images are never cached. Development builds register no worker.

## Content-Security-Policy

`vite.config.js` injects a `<meta>` CSP into production builds: `default-src 'self'`, `connect-src 'self' blob:`, `'wasm-unsafe-eval'` for the WASM tools (JavaScript `eval` stays blocked). The production server sends the same policy as a header, plus `frame-ancestors`, HSTS and the other headers listed in [DEPLOYMENT.md](DEPLOYMENT.md).
