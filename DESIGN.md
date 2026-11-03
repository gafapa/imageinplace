# Design System: Image in Place

## Direction

A compact private workbench in the PDF in Place product family: paper-white controls over a cool gray workspace, restrained borders and shadows, a task-oriented home screen, a selectable gallery, and an individual editor. Keep image content and the current operation visually dominant.

## Implementation sources

`src/styles.css` defines the shared font, palette, layout, and controls. Feature styles live beside their components. This document records conventions; actual dimensions and breakpoints belong to those stylesheets. Do not restore obsolete generated design JSON or sibling-product screenshots as application assets.

## Typography and palette

Use the bundled Atkinson Hyperlegible Next Variable family, with Segoe UI Variable, Segoe UI, system sans fallbacks. `src/main.jsx` imports the font package. Keep compact headings, readable body copy, bold labels, and tabular values where useful.

| Role | CSS variable | Value |
| --- | --- | --- |
| Workspace | `--paper` | `#f2f3f5` |
| Surface | `--paper-bright` | `#ffffff` |
| Text | `--ink` | `#15171c` |
| Secondary text | `--muted` | `#5b6270` |
| Primary action | `--accent` | `#d42a3b` |
| Primary hover | `--accent-dark` | `#b3202f` |
| Quiet accent | `--accent-soft` | `#fdecee` |
| Accent border | `--accent-line` | `#f3b7be` |
| Divider | `--line` | `#e1e4e9` |
| Control border | `--control-line` | `#d8dce2` |
| Keyboard focus | `--focus` | `#1d4ed8` |

Red identifies brand and primary actions. Blue remains available for focus and image-editing overlays; it is not a competing decorative theme. Legacy `--green` and `--coral` names alias the red accent in CSS.

## Layout and interaction

- Home, gallery, and editor fit the viewport. Grids, panels, tool rails, and dialogs own their scrolling.
- Gallery cards expose distinct Edit and Compare actions. Card selection controls batch operations.
- The batch dock opens shared parameters in the right sidebar and previews changes before Apply. Selected-image metadata occupies the sidebar when no batch action is active.
- Individual tools operate on a draft. Save and previous/next navigation commit it; Cancel discards it. Geometry adjustments must be applied or cancelled before saving or navigating.
- The gallery comparator is read-only and must not save or change batch selection. The editor also provides a draft before/after preview.
- Keep desktop controls compact and mobile controls reachable. Use rounded controls, subtle slate borders, and restrained elevation.
- Privacy, detection, restoration, and export must explain limitations in plain language. Interpolation must not be presented as AI detail reconstruction.

## Accessibility and language

Use semantic controls, visible keyboard focus, descriptive accessible names, non-color selection indicators, reduced-motion support, and a 44 by 44 pixel touch-target goal. Keep controls usable when translated and while typing numeric values. Spanish is the source interface language; Galician, Catalan, Basque, and English dictionaries must remain complete. Code, comments, and project documentation are written in English.

## Review

Use the browser regressions in [docs/TESTING.md](docs/TESTING.md) for desktop/mobile containment, keyboard controls, and saved-state behavior. Historical audit findings in `docs/reviews/` are dated evidence, not a current accessibility or production certificate.
