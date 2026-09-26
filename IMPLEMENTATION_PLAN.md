# Image Toolbox Expansion

The eight priority improvements are implemented in isolated Luna-agent assignments, then integrated and verified in the shared application. The PDFing-style layout, Spanish UI, English code/documentation, local processing, and viewport containment remain constraints.

| Feature | Integration | Acceptance checks |
| --- | --- | --- |
| Global history | Gallery undo/redo and restore selected originals; bounded snapshots own image URLs | Apply, undo, redo, delete, restore original without broken previews |
| Target-size compression | Sidebar; staged selected-image results and measured byte report | Target reached or honestly marked unattainable; batch failure does not partially commit |
| Batch rename | Sidebar pattern, counter and preview | Invalid names prevented, duplicates resolved, original bytes unchanged |
| Margins and canvas | Sidebar exact canvas, contain fit, background and alignment | Exact output dimensions, no distortion or unintended crop, transparent/colored margins |
| Annotations | Individual editor text, arrows, shapes and numbered markers | Canvas preview and saved pixels agree; keyboard editing and deletion available |
| Printable A4 sheets | Sidebar layout, captions and PDF download | Multipage A4 output, no clipping, correct image proportions and ordering |
| Reusable workflows | Locally saved named sequences with explicit Apply | Reload persistence, parameter validation, previewable recipe and atomic batch application |
| Before/after comparison | Individual editor split view and output metrics | Accessible comparison control; original and processed dimensions/bytes identified |

Phase two (not included in these eight): deskew, perspective correction, OCR, and background removal.

Verification combines pure helper tests, browser-driven task tests, production build, and desktop/mobile visual review. Integration remains owned by the primary agent to avoid shared-file conflicts.

## Delivery status

All eight features are integrated. Separate Luna assignments implemented each feature; the primary agent reviewed integration, corrected cross-feature issues, and ran final verification.

Verified on 2026-09-13:

- Production build succeeds (Vite reports a non-blocking bundle-size warning).
- `scripts/features.mjs`: first-import count, exact canvas pixels/proportions, global undo/redo/removal/restoration, safe renaming, target compression, annotation save, two-page Unicode-title A4 PDF, and persisted resize/format/rename workflows.
- `scripts/history-editor.mjs`: changed annotation pixels, local undo/redo, keyboard comparison, original/current dimensions, save and global history, mobile overflow assertion, and comparison screenshots.
- `scripts/workflow-print.mjs`: layout dimensions/title reservation, filename collision handling, and malformed workflow storage.
- `scripts/capture.mjs`: existing desktop/mobile import, batch preview/cancel, resize, crop, export, individual save/navigation, privacy, and viewport-containment regression checks.

Images and history are session-only. Saved workflow configurations survive reload in the same browser; images are never saved to localStorage or sent to a server.

## Individual-tool follow-up

- Expose compression, rename, canvas, workflows, and original restoration in the existing individual editor.
- Stage operations against the fully rendered current draft, including unsaved rotations, crops, and annotations. Store the draft source and encoded blob in local undo snapshots.
- Commit only on Save or image navigation; Cancel leaves gallery images unchanged. Preserve compressed bytes when there are no subsequent pixel edits, and preserve original bytes for rename-only saves.
- Move comparison out of the editing tool rail into a dedicated 44px card button paired with Edit. Its read-only dialog navigates without saving or changing selection.
- Verified by `scripts/individual-actions.mjs`: comparison isolation, rotation followed by canvas, draft undo/redo, applied-action cancellation, rename bytes, JPEG target preservation, workflow naming, and isolation from other selected images.
