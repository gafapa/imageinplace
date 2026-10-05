# Image in Place

Image in Place is a privacy-first image toolbox designed for teachers and useful for everyone. Images are processed entirely in the browser with the Canvas API; there is no backend and files are never uploaded.

## Current tools

- Brightness, contrast, saturation, grayscale, sepia, and blur adjustments
- Exact resize with optional aspect-ratio locking and useful presets
- Crop controls and presets for slides, square images, and A4 worksheets
- Background removal: makes a uniform background that touches the edges transparent (logos, scanned drawings, screenshots, product photos), with tolerance, soft de-haloed edges, optional removal of enclosed areas, and PNG output; works individually or in batches
- Trim to content: crops transparent or uniform-colour margins around the content, with tolerance and optional padding, individually or in batches
- Rotation and horizontal reflection
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
- Viewport-fitted home, gallery, and editor surfaces with scrolling contained inside work areas
- Global undo/redo (20 retained changes), including deletion, and restore selected originals
- Target-size JPEG/WebP compression with measured results and an explicit unattainable-target report
- Batch filename patterns with counters, safe names, MIME-aware extensions, and collision handling
- Exact canvas dimensions, proportional contain fit, padding, nine alignments, background, and exportable border
- Individual text, arrows, rectangles, ellipses, and numbered annotations included in saved pixels
- A compare button beside each image's edit button opens a read-only original/current split viewer, with keyboard controls and previous/next navigation; it never saves or changes the selection
- The individual editor also offers target compression, renaming, margins/canvas, saved workflows, and restore original; actions use the current draft and only reach the gallery on Save or navigation, while Cancel discards them
- Local multipage A4 PDF sheets with configurable grid, margins, gaps, title, and filename captions
- Named reusable workflows stored locally: resize, crop, rotate, watermark, output format, and rename

## Development

```bash
npm install
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

Requires Node 20.19+ (Vite 8).

## Deployment

The site is published at [imageinplace.com](https://imageinplace.com) on the shared `static-sites` Nginx service of the gallego.top server, behind Traefik. Publishing follows the hub runbook `D:\gallego.top\runbooks\static-site-content.md`:

1. `npm run check` (lint, unit tests, production build).
2. Copy `dist/` into `static-sites/sites/imageinplace.com/` in the management workspace.
3. Run `D:\gallego.top\scripts\publish_static_site.ps1 -Domain imageinplace.com` for a new domain, or the content synchronization workflow for updates.

Security response headers (CSP with `frame-ancestors`, HSTS, `nosniff`, Referrer-Policy, Permissions-Policy) come from the `imageinplace-security` Traefik middleware; the CSP `<meta>` tag injected at build time keeps the same policy for any other host.

## Privacy

All file decoding, editing, previewing, and export happen locally in the user's browser. Image URLs remain available while referenced by the bounded undo history and are released when no retained state needs them or the app unmounts. Images and edit history are not persisted across a page reload. Only named workflow configurations and the welcome preference use localStorage; the app keeps working when storage is blocked. Production builds ship a Content-Security-Policy that only allows connections to the app's own origin, so the browser itself enforces that images are not sent anywhere. Edited JPEG/WebP images are saved in their original format; every download is re-encoded through a canvas, so EXIF data such as GPS location is not included.

## Verification

The expansion plan and acceptance criteria are in [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md). Build first and serve the production output on port 4180 for stable feature checks:

```bash
npm run build
npm run preview -- --host 127.0.0.1 --port 4180
npm run test:e2e
```

The existing `node scripts/capture.mjs` regression suite uses the development server on port 4173. Browser screenshots and PDF test artifacts are written below `.impeccable/review`.
