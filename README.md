# Image in Place

Image in Place is a privacy-first image toolbox designed for teachers and useful for everyone. Images are processed entirely in the browser with Canvas and WebAssembly; there is no backend and files are never uploaded. The separate public-page analyzer makes credential-free requests to the page and image URLs supplied by the user; it cannot access editor files.

## Current tools

- Brightness, contrast, saturation, grayscale, sepia, and blur adjustments; browsers whose canvas ignores `context.filter` (Safari/WebKit) get an equivalent pixel implementation, detected at runtime
- Exact resize with optional aspect-ratio locking and useful presets
- Crop controls and presets for slides, square images, and A4 worksheets
- Background removal: makes a uniform background that touches the edges transparent (logos, scanned drawings, screenshots, product photos), with tolerance, soft de-haloed edges, optional removal of enclosed areas, and PNG output; works individually or in batches
- Trim to content: crops transparent or uniform-colour margins around the content, with tolerance and optional padding, individually or in batches
- Rotation and horizontal reflection
- Fine document straightening (−15° to +15°) with an alignment grid and expanded output bounds; white or transparent corner fill
- Visual crop with draggable corner handles, frame movement, drag-to-select, keyboard arrows, and precise percentage inputs
- Four-corner perspective correction with convex-selection validation, a live result preview, bilinear alpha-aware resampling, and a cancellable full-resolution worker
- Privacy zones for faces, names, and other sensitive information: adaptive pixelation (at most ~8 blocks on the short side) or a solid fill, recommended for text
- Text watermarks with position, size, and opacity controls
- JPEG, PNG, and WebP export with adjustable quality and estimated file size
- Compact selectable gallery with a dedicated edit button on every image
- PDFing-style floating zoom buttons on the right and compact grouped header actions
- Full-screen individual editor with a left icon rail, previous/next navigation, Cancel and Save; saving updates the gallery, and navigation saves the current image before opening the next
- Always-visible batch action dock for adjusting color, resizing, rotating, watermarking, converting, or deleting selected images
- Batch actions collect shared parameters in the right sidebar, preview changes on selected thumbnails, and update gallery images on Apply; conversion downloads one image or a ZIP
- When no batch action is active, the sidebar displays metadata for the selected image
- Crop without distortion using centered aspect ratios or per-edge percentages, individually or in batches
- Batch resize by width, height, longest edge, or percentage, with optional enlargement
- File metadata includes MIME type, bytes, original modification time, decoded dimensions, aspect ratio, megapixels, and available embedded original metadata parsed locally with exifr
- Privacy masking belongs to the individual editor opened from each image's pencil button
- Batch processing with shared settings and client-side ZIP download
- Multiple open images, clipboard paste, full-workspace drag and drop, undo, and redo
- Home screen tasks in plain language (reduce weight, resize, hide faces, annotate, remove background, A4 sheets, crop, convert) that open the matching tool right after choosing images
- Labelled, grouped tool rail in the editor (Adjust / Frame / Protect and add / Save) and labelled batch action dock
- Keyboard shortcuts: Ctrl/Cmd+Z undo, Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z redo, Ctrl/Cmd+A select all, Delete removes the selection, Esc closes the action panel or clears the selection, Ctrl/Cmd+O adds images, Ctrl/Cmd+S saves the project (gallery) or the edit (editor), PageUp/PageDown move between images in the editor; shortcuts never fire while typing in a field
- Export proposes the image's own format (PNG stays PNG, keeping transparency and sharp text)
- iPhone HEIC/HEIF photos open in every browser: Safari decodes them natively, other browsers use libheif (WebAssembly) in a worker; they are converted to JPEG on import. TIFF opens where the browser supports it (Safari)
- On-device AI background removal (U²-Netp, 4.6 MB) for photos with busy backgrounds; the panel suggests it when the image borders are not a uniform colour, and the exact uniform-colour method otherwise
- Privacy helpers in the editor: **Detect faces** (UltraFace RFB-640) adds pixelated zones; **Detect text** (Tesseract OCR) lists the recognised lines, preselects those that look like personal data (ID numbers, e-mail, phone, dates, labelled fields) and covers the chosen ones with solid fills
- Interface in Spanish, Galician, Catalan, Basque and English: detected from the browser, changeable from the header and remembered; all dictionaries are checked for completeness and placeholders by the unit tests
- Interface set in Atkinson Hyperlegible Next (SIL Open Font License, bundled from `@fontsource-variable/atkinson-hyperlegible-next` and served from the app's own origin), with a single red accent; the editor has zoom steps and an "Antes / después" view of the image before the current edit
- Optional session recovery (Project menu, off by default)
- Validated imports with per-image and workspace memory limits, corrupt-file reports, GIF flattening notice, and lightweight gallery thumbnails
- Local `.iip` project files with SHA-256 integrity checks containing current images, original files, filenames, and modification times; opening adds the project to the gallery atomically
- Offline app-shell caching of all production assets, including lazy PDF/ZIP/EXIF chunks and workers, with readiness shown in the Project menu
- Browser unload protection for work not included in the most recently prepared project download and for open editor drafts
- Background removal and content-bound detection run in a local Web Worker; processing panels expose progress and cancellation before atomic application
- Viewport-fitted home, gallery, and editor surfaces with scrolling contained inside work areas
- Global undo/redo (up to 20 retained changes, also bounded by a 256 MiB retained-resource budget), including deletion, and restore selected originals
- Target-size JPEG/WebP compression with measured results and an explicit unattainable-target report
- Batch filename patterns with counters, safe names, MIME-aware extensions, and collision handling
- Exact canvas dimensions, proportional contain fit, padding, nine alignments, background, and exportable border
- Individual text, arrows, rectangles, ellipses, and numbered annotations included in saved pixels
- A compare button beside each image's edit button opens a read-only original/current split viewer, with keyboard controls and previous/next navigation; it never saves or changes the selection
- The individual editor also offers target compression, renaming, margins/canvas, saved workflows, and restore original; actions use the current draft and only reach the gallery on Save or navigation, while Cancel discards them
- Local multipage A4 PDF sheets with configurable grid, margins, gaps, title, and filename captions
- Named reusable workflows stored locally: resize, crop, rotate, watermark, output format, and rename

## Restoration, analysis, and web export

- **Repair image** is available in the individual editor and in the gallery's **More** menu. It offers isolated-dust removal with a 3×3 median, edge-aware noise smoothing, thresholded sharpening, percentile-based faded-tone recovery, exposure, and color controls. A reduced preview shows the first selected image. Full-resolution processing runs in a cancellable local worker; batch results are committed together. These filters can soften or alter real detail. Sharpening improves apparent clarity but cannot reconstruct lost detail or reliably reverse motion blur.
- **Local suggestions** analyzes visible pixels for luminance, the 1st–99th percentile tonal range, color spread, and adjacent-pixel differences. It previews suggested exposure, tonal recovery, color, and sharpening settings. Applying a batch analyzes each image separately. This is deterministic image analysis, not a generative model or a diagnostic guarantee.
- **Upscale 2× / 4×** uses high-quality browser interpolation with optional sharpening. It does not synthesize missing details with AI. Output must remain within 40 megapixels and 10,000 pixels per side. Individual drafts and gallery changes retain their existing Cancel, Save, and undo behavior.
- **AVIF** export uses the bundled, single-threaded `@jsquash/avif` WebAssembly encoder in a dedicated worker. No CDN or remote encoder is used. Its WASM binary is cached on first use, following the existing offline asset policy.
- **Smallest file** encodes AVIF, supported WebP, JPEG, and PNG at the selected quality, then chooses the smallest actual blob. JPEG is excluded when any pixel is not fully opaque. Unsupported native WebP encoding is excluded instead of accepting the browser's PNG fallback. AVIF errors are reported rather than silently omitting that candidate. Quality percentages across codecs are not perceptually equivalent; inspect the exported result. Automatic batches may contain different formats, with filenames matching the actual bytes. AVIF and automatic sizes are measured on export to avoid repeated expensive encoding during editing.
- **Analyze web page** opens a separate opaque-origin sandbox. It requests only the user-provided public HTTPS page and up to 100 unique image URLs from `src`, `data-src`, and `srcset`, including picture sources. It reports formats, downloaded bytes, decoded raster dimensions, missing `alt` attributes, potential lazy-loading opportunities, and JPEG/PNG candidates for modern formats. An empty `alt` attribute is valid decorative markup and is not flagged as missing. HTML stays inert; page scripts and styles never run. CSS backgrounds and images produced by JavaScript are outside this static analysis.

### Public URL access and deployment

The web-page audit is the only tool that intentionally contacts external sites. The destination receives normal requests for its page and images. Requests omit credentials and referrers, reject redirects, and accept only public-looking HTTPS hostnames. Numeric hosts, IPv6 literals, local names, credentials, and nonstandard ports are rejected; a browser-only tool cannot prove that a public-looking DNS name never resolves to a private address. No editor images, project files, or recovery storage are accessible to the sandbox, and no proxy is used. The analyzer does not send image contents to any service.

Opening the analyzer requires a connection: its opaque sandbox cannot use the parent app’s offline cache. When offline, an explicit notice keeps the editor available. Cross-origin reads require the destination to allow CORS, including the sandbox's opaque origin. When a page denies CORS, open a locally saved HTML file and supply its original page URL to resolve relative paths. Image metadata may still be unavailable if those images also deny CORS. The analyzer does not bypass authentication or browser access controls. Limits are 2 MiB HTML, 40 MiB per fetched image, 80 MiB downloaded per run, 100 images, and a two-minute request deadline; cancellation or closing the dialog stops its requests. Image decoding already in progress may finish first.

The editor retains its original same-origin-only CSP. `public/page-audit.html` has its own restricted policy permitting HTTPS reads and is embedded with `sandbox="allow-scripts"`, without `allow-same-origin`. A production host that applies an additional global `connect-src 'self'` response header must give **only `/page-audit.html`** a matching audit policy (`default-src 'none'; script-src 'self'; style-src 'self'; connect-src https:; img-src blob:; base-uri 'none'; form-action 'none'; frame-ancestors 'self'; sandbox allow-scripts`). Keep the editor's strict response header unchanged. Multiple CSP headers are intersected, so adding a second, permissive policy cannot override an existing restrictive one. The response policy must permit same-origin framing, and its sandbox directive also protects direct navigation. Remove any conflicting `X-Frame-Options: DENY` header for this path only. If the host uses `Cross-Origin-Resource-Policy: same-origin`, give only `/page-audit.js` and `/page-audit.css` a `cross-origin` resource policy so the opaque frame can load its public assets. Without the path-specific header configuration, the host may block the iframe, its assets, or its public page/image reads. Once framing is permitted, local HTML inventory works even when network reads remain blocked. Source changes alone do not configure response headers; the verified production configuration is recorded in [docs/PUBLICATION.md](docs/PUBLICATION.md).

Run `npm run test:advanced` against the development server on port 4180, or set `TEST_URL` to a production preview, to verify restoration, enlargement, local suggestions, real AVIF decoding, automatic ZIP transparency, the audit sandbox, and mobile layout using synthetic fixtures.

## Development

```bash
npm ci
npm run dev
```

Create a production build with:

```bash
npm run build
```

Lint, unit tests and build in one step:

```bash
npm run check
```

Requires Node 20.19+ (Vite 8). Use `npm ci` to install the locked dependency versions.

## Project structure

- `src/`: application, image-processing workers, translations, and unit tests.
- `public/`: shipped icons, local AI models, third-party notices, and the isolated page analyzer.
- `scripts/`: build plugins and maintained browser regressions.
- `docs/`: testing guidance, repository maintenance, and historical review reports.
- [PRODUCT.md](PRODUCT.md): product constraints and intended users.
- [DESIGN.md](DESIGN.md): current visual and interaction conventions.
- `artifacts/`, `dist/`, and `node_modules/`: ignored, reproducible local output.

See [docs/MAINTENANCE.md](docs/MAINTENANCE.md) for cleanup boundaries.
See [SECURITY.md](SECURITY.md) for data boundaries, hosting requirements, and dependency/security checks.

## Deployment

The site is published at [imageinplace.com](https://imageinplace.com) on the shared `static-sites` Nginx service of the gallego.top server, behind Traefik. The 2026-11-03 release and live verification are recorded in [docs/PUBLICATION.md](docs/PUBLICATION.md). Publishing follows the hub runbook `D:\gallego.top\runbooks\static-site-content.md`:

1. `npm run check` (lint, unit tests, production build).
2. Package exactly `dist/`, retain a per-file SHA-256 manifest, and scan the output with the hub's `Test-StaticSiteContent`. The current canonical release and analyzer routing are retained under `D:\gallego.top\ops\imageinplace\`; the former management checkout is absent.
3. With explicit credential authorization, use the hub's pinned SSH/upload helpers, checksum-verified backups, and the installed static-site content synchronization workflow. Apply only the separate analyzer routing fragment; preserve shared configuration and existing containers. Verify HTTPS, public file hashes, and live browser behavior after publishing.

Security response headers (CSP with `frame-ancestors`, HSTS, `nosniff`, Referrer-Policy, Permissions-Policy) come from the `imageinplace-security` Traefik middleware; the CSP `<meta>` tag injected at build time keeps the same policy for any other host.

## Privacy

All file decoding, editing, previewing, and export happen locally in the user's browser. Image URLs remain available while referenced by the bounded undo history and are released when no retained state needs them or the app unmounts. Images and edit history are not automatically persisted across a page reload. Use **Project → Save project** to download a local `.iip` file and **Open project** to add its images back to the gallery. Project files include original bytes and metadata, including any original GPS data; treat them like the original images. They do not contain the undo history, unsaved editor drafts, or browser workflow preferences. The browser cannot confirm that a prepared download was actually saved to disk. The offline cache contains only application assets; it never stores image blobs, project files, or editing state. Only named workflow configurations, the welcome preference, and the session-recovery preference use localStorage; the app keeps working when storage is blocked. When **Project → Remember my images on this device** is switched on, the gallery (not editor drafts or undo history) is mirrored to this browser's IndexedDB as a regular project blob about 1.5 s after each change, offered for recovery on the next visit, and deleted when the option is switched off or the gallery is emptied; it never leaves the device, but anyone using the same browser profile can recover it. Production builds ship a Content-Security-Policy that only allows connections to the app's own origin, so the browser itself enforces that images are not sent anywhere. The policy includes `'wasm-unsafe-eval'` so the OCR, AI and HEIC tools can compile WebAssembly; JavaScript `eval` remains blocked. The AI models, OCR engine and language data are served from this same origin and run in workers on the device. Edited JPEG/WebP images are saved in their original format; image and PDF exports are re-encoded through a canvas, so EXIF data such as GPS location is not included in those exports.

## Memory and cancellation

Imports are decoded sequentially and validated before entering the gallery. Each original file may be at most 40 MiB, each image at most 40 megapixels and 10,000 pixels per side. A workspace admits at most 100 images, 120 megapixels (counting the larger of current and original dimensions), and 250 MiB of retained original/current image bytes. Thumbnails have a maximum side of 480 pixels. Undo snapshots share image URLs; old snapshots are evicted when their retained-resource budget is exceeded. The individual editor also limits its draft undo history to 30 snapshots and a 128 MiB encoded-draft budget, releasing draft URLs when no retained state references them. These bounds do not measure the browser's total process memory: decoding and canvas/worker buffers also consume memory.

Project files use a versioned, size-bounded manifest followed by raw image bytes, without archive decompression. New version-two projects include a SHA-256 digest for each original/current payload and a 32-byte trailer protecting the prefix and JSON manifest. Opening verifies every digest before decoding any image, then validates metadata, payload ranges, image decoding, and combined workspace limits before one history commit. Version-one projects still open with a visible notice that integrity hashes are absent; saving them produces version two. These checks detect accidental damage; they do not authenticate the author or prevent deliberate replacement of both bytes and hashes. Hash verification requires Web Crypto in a secure context. A failed open leaves existing images untouched. Original bytes remain available for restoration.

Background removal and full-size content-bound detection transfer pixel buffers to module workers. Cancel terminates an active pixel worker. Other tools check cancellation between images and encoding passes; browser canvas encoding or ZIP/PDF assembly already in flight may need to finish, but cancelled output is not applied or downloaded. Image batches are staged and applied in one commit only after successful processing and thumbnail validation. All processing remains local.

## Document geometry

Open an individual image and choose **Straighten**, **Visual crop**, or **Perspective** in the tool rail. Each tool uses a locally staged rendering of the current draft, including earlier unsaved adjustments and annotations. Apply or cancel the active geometry adjustment before using Save or image navigation. Applying a tool adds one undoable draft change; the gallery changes only on Save or image navigation. Cancel adjustment discards its selection, and Cancel editing discards all unapplied gallery changes. Corner controls support pointer/touch input, arrow keys, Shift for larger keyboard steps, and percentage inputs. Crops use exact pixel-edge rounding. Fine rotations expand the canvas to retain the entire source. Perspective output dimensions use the average lengths of opposing selected edges; they cannot infer the physical aspect ratio of the photographed document.

## On-device AI, OCR and HEIC

Runtimes and models load only when a tool needs them and run locally:

| Tool | Component | Download on first use |
| --- | --- | --- |
| Remove background › Automatic (AI) | ONNX Runtime Web (single-threaded WASM) + `u2netp.onnx` | ≈ 19 MB |
| Hide › Detect faces | ONNX Runtime Web + `ultraface-rfb-640.onnx` | ≈ 16 MB (runtime shared with the above) |
| Hide › Detect text | Tesseract.js 7 core + `spa`, `eng` and the interface language (`best_int` data) | ≈ 6–9 MB |
| HEIC import (non-Safari) | libheif-js bundle | ≈ 2 MB |

Models live in `public/ai/models/`; the runtimes and language data are copied from `node_modules` into `/ai/vendor/` by the `scripts/ai-assets.mjs` Vite plugin (served directly in development). Licences and checksums are listed in `public/ai/THIRD_PARTY_NOTICES.txt`. Detection can miss faces or text, so the interface always asks the user to review the image before sharing it.

## Offline operation

Production builds generate `sw.js` with an explicit asset list and a content-derived cache version. Large on-demand files (`/ai/…`, `.wasm`, `.onnx`, OCR data) are not precached: they are cached the first time a tool uses them, in a separate cache keyed by their own content hash, so app updates keep them while they are unchanged. On the first online visit, the app prepares all shipped HTML, CSS, JavaScript, workers, icons, and lazy chunks; **Project** shows when preparation is complete. Subsequent root-page visits and image editing/export can work without a network connection. Images and projects remain session-only unless explicitly downloaded. Browser cache eviction or cleared site storage can remove offline availability; revisit online to prepare it again.

Service workers require HTTPS (localhost is allowed for development). Development builds do not register a worker. A failed cache install removes only its new cache; active caches remain available. Updates wait while existing app tabs are open, and the menu asks the user to save work and close those tabs. No update reloads a workspace automatically. Activation removes old caches belonging to this application only. Fetch handling is restricted to the build asset list and root navigation; there is no runtime caching of imported files or unrelated URLs.

## Verification

The supported regression suites and their coverage are listed in [docs/TESTING.md](docs/TESTING.md). Build first and serve the production output on port 4180 for stable feature checks:

```bash
npm run build
npm run preview -- --host 127.0.0.1 --port 4180
npm run test:e2e
```

The existing `node scripts/capture.mjs` regression suite uses the development server on port 4173 by default (`TEST_URL` can override it). `scripts/usability.mjs` runs the colour adjustments in WebKit and Chromium and compares the pixels, and covers keyboard shortcuts, home tasks, session recovery, source-format export, editor number fields, mobile fit, language switching and the editor zoom and before/after view. `scripts/on-device-ai.mjs` checks HEIC import, AI background removal and face detection in Chromium and WebKit, OCR covering of personal data and the on-demand offline cache; it downloads two verified third-party sample files into `node_modules/.cache` on first run. The geometry/offline suite disables the network after installation and verifies reload, local perspective processing, lazily loaded PDF and ZIP exports, and hashed project export. Offline lifecycle checks cover waiting updates, preserved work, safe activation, unrelated caches, and rollback after incomplete installation. Project safety checks cover payload corruption and legacy-format compatibility. Browser screenshots and PDF test artifacts are written below `artifacts/browser`.

### Recovery and offline reliability

Recovery has one writer per browser origin, protected by a Web Lock. A second open tab cannot overwrite the recoverable workspace and displays an explicit warning. Close the writer tab and toggle recovery again to transfer ownership. Browsers without Web Locks can still save local project files; automatic recovery is disabled. Turning recovery off synchronizes the preference across tabs and deletes the stored project. Pending encodes recheck their generation and preference before writing; local writes and deletion are serialized. A deletion error asks the user to clear site storage.

The offline indicator covers the application shell, editing and export. AI, OCR and HEIC resources must be used online once before offline use; they are downloaded only when needed. Cache Storage errors do not discard successful network downloads. Privacy detection results are invalidated when the draft source, image settings or output dimensions change.

### Privacy transforms and decoder limits

Editable privacy rectangles are stored in normalized source-image coordinates. Rotation, reflection, crop and resize project them into the current output; cropping does not discard zones outside the view. Pointer input, keyboard controls and face/OCR suggestions are mapped back into source coordinates. Undo/redo retains these source rectangles, and applying a rendered geometry operation bakes the protected pixels into the staged draft.

The HEIC worker validates dimensions before allocating its RGBA buffer and frees decoder resources on success or failure. Native images rejected by the dimension limit do not retry with a second decoder. OCR progress belongs to the current request; worker reuse, cancellation and language changes cannot send progress to a previous request or let a cancelled initialization replace the current worker.

The privacy-transform browser regression checks rotated/reflected/cropped masks, undo/redo, masks created after a transform, exported pixels and saved drafts in Chromium and WebKit. Decoder-boundary and OCR ownership regressions use controlled substitutes without real personal information or large memory allocations.
