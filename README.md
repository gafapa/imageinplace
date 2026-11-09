# Image in Place

A private image toolbox for teachers that works for everyone. Every image is decoded, edited and exported in the browser; there is no backend, no account and no upload. Published at [imageinplace.com](https://imageinplace.com).

## What it does

Open JPG, PNG, WebP, GIF, SVG or iPhone HEIC photos (paste, drag or pick), select them in the gallery and apply an action to all of them, or open one in the editor.

| Task | Gallery (batch) | Editor (one image) |
| --- | :---: | :---: |
| Brightness, contrast, color, blur; resize; crop; rotate/flip | ✓ | ✓ |
| Straighten, visual crop, four-corner perspective | | ✓ |
| Remove a uniform background, or a busy one with on-device AI | ✓ | ✓ |
| Trim empty margins; canvas/margins; repair dust, noise and faded tones | ✓ | ✓ |
| Hide faces (AI detection) and text such as names or ID numbers (OCR), pixelated or solid | | ✓ |
| **Remove hidden data**: GPS location, date, phone model, author and comments | ✓ | |
| Watermark, annotations (text, arrows, shapes, numbers) | watermark | ✓ |
| Compress to a target size, rename, saved workflows | ✓ | ✓ |
| Convert/download as JPG, PNG or WebP (ZIP for several); A4 PDF sheets | ✓ | ✓ |

Also: global undo/redo, an original/current comparison, local project files (`.iip`), optional session recovery, offline use after the first visit, keyboard shortcuts, and an interface in Spanish, Galician, Catalan, Basque and English.

## Privacy

- Images never leave the device. The production Content-Security-Policy only allows connections to the app's own origin, so the browser enforces it. AI models, the OCR engine and their data are served from that origin and run in workers.
- **Downloads** are re-encoded from a canvas, so they never carry EXIF/GPS.
- **Remove hidden data** (gallery › *Sin datos*) strips EXIF, GPS, XMP, IPTC, comments, text chunks, embedded thumbnails and data appended after the image (for example motion-photo videos) **without re-encoding**: JPEG, PNG and WebP keep their exact compressed pixels, the colour profile and the orientation. Other formats are redrawn as PNG. It cleans the original kept for *Restore original* too, so project files and session recovery stop carrying the data; it can also replace file names with `imagen-1`, `imagen-2`… It does not touch visible content — use *Hide* in the editor for faces and names.
- **Project files** contain the originals. Unless you clean them first they include whatever metadata the photos had: treat them like the photos themselves.
- Only workflow presets and preferences use `localStorage`. Session recovery is off by default; when enabled the gallery is mirrored to this browser's IndexedDB and deleted when the option is turned off.
- Face and text detection can miss things. The interface always asks the user to review the image before sharing it.

## Development

Requires Node 20.19+.

```bash
npm ci
npm run dev          # development server
npm run check        # lint + unit tests + production build
```

Browser regressions run against the production preview:

```bash
npx playwright install chromium webkit   # once
npm run build && npm run preview         # serves on 127.0.0.1:4180
npm run test:e2e                         # all suites; or: node e2e/run.mjs metadata
```

## Layout

```
src/
  App.jsx       workspace state: import, gallery, editor, projects, recovery
  ui/           React components, panels and their styles
  image/        pixel and file logic: rendering, geometry, filters, encoding, metadata, HEIC, workers
  ai/           on-device face detection, background removal and OCR
  app/          project files, session store, undo history, batch tasks, shortcuts, downloads
  i18n/         Spanish source text and four dictionaries (checked by unit tests)
scripts/        Vite plugins: AI/OCR asset copying and the offline service worker
e2e/            Playwright browser regressions and their runner
public/         icons, manifest and the bundled ONNX models (licences in public/ai/)
docs/           architecture, testing and deployment
```

Tests live next to the code they cover (`*.test.js`).

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — limits, project format, workers, offline cache, AI assets.
- [docs/TESTING.md](docs/TESTING.md) — what each suite covers.
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — publishing and response headers.
- [SECURITY.md](SECURITY.md) — data boundaries and dependency checks.
- [PRODUCT.md](PRODUCT.md) and [DESIGN.md](DESIGN.md) — product constraints and visual conventions.
