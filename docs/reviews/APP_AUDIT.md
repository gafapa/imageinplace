> Historical report. Original dates, paths, and validation claims are preserved. Referenced raw screenshots and temporary reproductions were removed during repository cleanup; maintained regressions live in `scripts/`. This report does not describe fresh production verification.

# Application audit — 2026-10-11

## Scope and integrity verdict

The implementation expresses a coherent, private image workbench. Preserve its local processing, explicit project files, bounded history, staged editing, and task-oriented gallery.

Reviewed the public site at https://imageinplace.com and the current local production build. The working tree contains 24 modified files beyond commit dab1506; findings against local code must not be assumed identical to the deployed version. This audit does not modify application code or publish changes.

No blocking failure was observed in the sampled import, gallery, project menu, and language workflows. This is not a claim of complete browser or accessibility certification.

## Health score

These scores are review judgments, not an automated compliance certificate.

| Dimension | Score | Main observation |
| --- | ---: | --- |
| Accessibility | 3/4 | Native dialogs, named controls and keyboard support; some small controls remain |
| Performance | 3/4 | Workers and lazy assets; large on-demand caches need resilient storage handling |
| Responsive design | 3/4 | No page overflow at 390 px; several touch targets miss the product's 44 px target |
| Theming | 2/4 | Repeated literal values and stale design documentation |
| Implementation integrity | 3/4 | Consistent product structure, but asynchronous persistence and detection need stronger ownership |
| Total | 14/20 | Good, with targeted reliability work needed |

Seven actionable findings: two P1 and five P2. No P0 identified within the sampled scope.

## Findings

### 1. P1 — Disabling session recovery can still retain an image

Location: src/App.jsx:201-214; src/features/sessionStore.js:44.

Reproduced with a synthetic document in an isolated browser profile. Delay SHA-256 preparation, enable recovery, wait for preparation to begin, then disable recovery. After completion, localStorage reports false while IndexedDB still contains a one-image project (13,745 bytes).

The cleanup only changes an active flag used after storage. It does not prevent the already-running saveProject from subsequently calling storeSession. A delayed older write can also overtake a newer snapshot.

Impact: the promise to remove stored images when opting out can fail, particularly on shared devices.

Recommendation: serialize persistence with a generation or ownership check before writing; make opt-out deletion the final operation after pending writes settle. Add adversarial tests for opt-out during encoding, stale writes, and clearing during encoding.

Suggested command: $impeccable harden.

### 2. P1 — Cache storage failure turns a successful network response into a tool failure

Location: scripts/offline-build.mjs:70-75.

Verified by code inspection, not by a full-storage device reproduction. The on-demand fetch handler awaits cache.put before returning the already-successful response. If opening or writing Cache Storage throws, respondWith rejects even when the model or decoder was downloaded successfully.

Impact: OCR, HEIC import or AI processing can fail on a low-storage device while Internet access is working.

Recommendation: treat caching as optional. Return the successful network response even when storage fails; surface offline availability separately. Test Cache Storage open/put failures and cache quota exhaustion.

Suggested command: $impeccable harden.

### 3. P2 — Detection results lack a draft revision check

Location: src/features/Editor.jsx:347,354-395.

Verified by code inspection; the exact inference/edit race was not reproduced. Detection captures the rendered canvas, while tool switching, transforms and undo remain available independently of detection.status. Completion adds boxes or OCR lines without checking that the draft still matches that canvas. Cancellation occurs on unmount, not on every relevant draft change.

Impact: late results can place privacy zones on coordinates from an earlier image layout; the existing review warning does not prevent this mismatch.

Recommendation: tag each request and OCR review with a draft revision. Abort or discard results when the source or coordinate system changes. Keep editing available when safe, but require a new detection after changes invalidate boxes.

Suggested command: $impeccable harden.

### 4. P2 — Recovery uses one shared slot across tabs

Location: src/features/sessionStore.js:10,44; src/App.jsx:183-214.

Verified by code inspection, not by a two-tab overwrite test. Every workspace writes the same current record. There is no tab identifier, revision conflict check or cross-tab preference synchronization.

Impact: a second tab can replace the first tab's recoverable workspace. Disabling recovery in one tab cannot stop another open tab's writer.

Recommendation: choose an explicit policy: separate recoverable sessions with timestamps and summaries, or one writer with a visible conflict notice. Synchronize opt-out across tabs and preserve transactional ownership.

Suggested command: $impeccable harden.

### 5. P2 — Offline readiness is broader than actual tool readiness

Location: src/features/OfflineStatus.jsx:20; scripts/offline-build.mjs:43-47,68-77.

The menu reports readiness when the application worker is active, while AI models, OCR languages, HEIC decoder and WASM files are cached only after first use. This separation is intentional and documented, but the visible status does not distinguish it.

Impact: users preparing for an offline classroom may expect an unused tool to work.

Recommendation: distinguish core offline availability from optional tools. Offer a named preparation action, download size/progress and removal for optional cached assets. Keep model downloads explicit rather than adding them to startup.

Suggested command: $impeccable clarify.

### 6. P2 — Some touch targets miss the product's minimum

Location: src/styles.css:55,684; src/features/LanguageSelect.jsx.

Measured in the local build at 390 × 844: several header controls are 38 × 44 px, preview zoom buttons 36 × 44 px, and the language select 42 × 42 px.

Impact: adjacent controls require more accurate taps than the documented 44 × 44 px product target. This finding does not imply that all these controls violate WCAG's smaller minimum target requirement.

Recommendation: give controls 44 × 44 px hit areas without enlarging icons. Preserve toolbar scrolling and header fit.

Closed-details children and the hidden file input were excluded as measurement false positives. Open project actions measure 332 × 44 px and are acceptable.

Suggested command: $impeccable adapt.

### 7. P2 — Offline status stays in the previous language

Location: src/features/OfflineStatus.jsx:8-31.

Reproduced: prepare offline mode in Spanish, change the interface to English, and inspect the project menu. It still says “Preparado para usar sin conexión.”

Impact: an otherwise translated interface presents mixed-language status information. Status strings translated when stored in state do not automatically change when the dictionary changes.

Recommendation: store status identifiers and parameters, then translate during rendering. Audit other persistent notices for the same pattern; test switching language without triggering a new status event.

Suggested command: $impeccable clarify.

## Design detector interpretation

The detector returned 135 findings: 134 advisory observations and one font declaration mismatch between src/styles.css and DESIGN.md. The current Atkinson font is intentional in the working tree; the mismatch is documentation drift, not proof of a broken UI. Several radius/type findings match legitimate compact controls or image content colors. Avoid bulk mechanical replacements.

Update design documentation after the current visual changes settle, and gradually consolidate repeated UI tokens. Dark mode is a possible later feature, not a release blocker or a demonstrated broken theme.

## Validation and evidence

- npm run check passed: lint, 69 unit tests in eight files, and production build.
- Isolated Chromium profiles reviewed public/local desktop and 390 px mobile surfaces.
- Synthetic image import and gallery rendering succeeded without page errors.
- No document-level horizontal overflow in the sampled mobile gallery.
- Runtime evidence: audit-runtime.json.
- Reproduction scripts: audit-runtime.mjs and audit-confirm.mjs.
- Screenshots: audit-public-*.png, audit-local-*.png and audit-project-mobile.png.
- Existing full end-to-end suite was not rerun during this audit. Safari/WebKit, Firefox, real low-memory devices, screen reader use, full contrast coverage and production/local asset identity were not qualified here.

## Recommended order

1. $impeccable harden: recovery ownership and deletion, optional caching, detection revision checks.
2. $impeccable clarify: offline tool readiness and language-aware status.
3. $impeccable adapt: mobile hit areas.
4. $impeccable polish: final bounded verification after the fixes.

These steps can be applied together or individually. Re-run $impeccable audit after implementation.
