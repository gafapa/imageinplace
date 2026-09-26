---
name: "Image in Place"
description: "A private, viewport-fitted image workbench aligned with the PDF in Place product family."
colors:
  document-red: "#dc2635"
  document-red-deep: "#bd1726"
  selection-blue: "#2563eb"
  selection-blue-deep: "#1d4ed8"
  selection-blue-soft: "#eff6ff"
  selection-blue-ring: "#bfdbfe"
  workspace-mist: "#eef1f4"
  paper-white: "#ffffff"
  utility-surface: "#f7f8fa"
  slate-ink: "#20242c"
  slate-muted: "#596273"
  slate-line: "#dce1e8"
  slate-line-strong: "#c8d0da"
typography:
  display:
    fontFamily: "Segoe UI Variable, Aptos, Segoe UI, ui-sans-serif, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 740
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Segoe UI Variable, Aptos, Segoe UI, ui-sans-serif, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 740
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Segoe UI Variable, Aptos, Segoe UI, ui-sans-serif, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 740
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Segoe UI Variable, Aptos, Segoe UI, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Segoe UI Variable, Aptos, Segoe UI, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 700
rounded:
  thumbnail: "8px"
  control: "10px"
  card: "12px"
  panel: "14px"
  workspace: "16px"
  dialog: "18px"
  pill: "999px"
spacing:
  micro: "6px"
  compact: "8px"
  control: "10px"
  gutter: "12px"
  base: "16px"
  roomy: "24px"
  workspace: "32px"
components:
  button-primary:
    backgroundColor: "{colors.document-red}"
    textColor: "{colors.paper-white}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 22px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.document-red-deep}"
    textColor: "{colors.paper-white}"
  button-secondary:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.slate-muted}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "42px"
  button-tool-active:
    backgroundColor: "#dbeafe"
    textColor: "{colors.selection-blue-deep}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    height: "68px"
  field:
    backgroundColor: "{colors.utility-surface}"
    textColor: "{colors.slate-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "48px"
  selection-toolbar-count:
    backgroundColor: "{colors.selection-blue-soft}"
    textColor: "{colors.selection-blue-deep}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 11px"
    height: "34px"
---

# Design System: Image in Place

## Overview

**Creative North Star: "PDF in Place Workbench"**

Image in Place is a private document-style workbench translated for images. It opens directly onto the task, using paper-white controls on a cool workspace mist so imported images, selection state, and the current editing outcome remain immediately legible. The atmosphere is calm, compact, familiar, and deliberately closer to a dependable desktop utility than a promotional website.

The experience moves through three viewport-fitted states: a dominant import workspace, a selectable image gallery, and a shared editor. Document red identifies the product and irreversible forward outcomes; selection blue identifies focus, chosen items, active tools, and in-canvas editing. Soft slate structure, controlled internal scrolling, compact radii, and restrained ambient shadows keep complex work approachable.

**Key Characteristics:**

- Viewport-fitted home, gallery, and editor shells with overflow contained inside work areas.
- Paper-white tools and panels floating lightly over cool workspace mist.
- Document red for brand and primary outcomes; selection blue for edit state and focus.
- Compact system sans typography with a dense but readable 10–24px hierarchy.
- Rounded 10–18px workbench geometry, with 8px image wells and pill selection indicators.
- Selectable gallery cards, paired per-image edit and compare actions, and a floating batch dock that make individual and multi-image work explicit.

## Colors

The palette is a cool slate utility system sharpened by two non-interchangeable accents.

### Primary

- **Document Red:** Product mark, import and export actions, and decisive forward outcomes.
- **Deep Document Red:** Hover and destructive emphasis where the primary red needs greater weight.

### Secondary

- **Selection Blue:** Keyboard focus, selected imagery, active editing tools, ranges, and privacy overlays.
- **Deep Selection Blue:** Selected labels, ready states, and compact high-contrast blue text.
- **Soft Selection Blue:** Selected-card, active-control, and contextual-help surfaces.
- **Selection Ring:** Inner borders and halos that reinforce selection without increasing fill density.

### Neutral

- **Workspace Mist:** The full-viewport application ground surrounding white preview surfaces.
- **Paper White:** Headers, panels, cards, buttons, and dialog surfaces.
- **Utility Surface:** Quiet hover fills, field fills, status bands, and grouped feature cells.
- **Slate Ink:** Primary text and high-confidence labels.
- **Slate Muted:** Supporting text, metadata, inactive tools, and secondary actions.
- **Slate Line:** Default borders and structural dividers.
- **Strong Slate Line:** Hovered borders and the dashed import boundary.

**The Two-Accent Rule.** Red means product or forward outcome; blue means selection, focus, or editing state. Never swap their roles or use both as competing decoration.

## Typography

**Display Font:** Segoe UI Variable (with Aptos, Segoe UI, ui-sans-serif, system-ui, and sans-serif fallbacks)  
**Body Font:** Segoe UI Variable (with the same system fallback stack)

**Character:** A single Windows-native sans family keeps the experience fast, familiar, and tool-like. Hierarchy comes from compact size changes, strong weights, tabular numerals, and slight negative tracking rather than from a contrasting display face.

### Hierarchy

- **Display** (740, 24px, 1.25): Gallery and welcome-dialog headings.
- **Headline** (740, 22px, 1.25): Settings-panel task titles.
- **Title** (740, 18px): Product name and compact high-emphasis labels.
- **Body** (400, 14px, 1.55): Dialog explanations and supporting guidance; longer dialog copy stays within 48ch.
- **Label** (700, 12px): Buttons, fields, metadata, card names, and status values; 10–11px is reserved for secondary metadata and rail labels.

**The Compact Native Rule.** Use the shared system stack everywhere and create hierarchy through weight and spacing; do not introduce an editorial or decorative display font.

## Layout

All primary shells occupy the full width and 100dvh, and the document itself never scrolls. The 64–66px header stays fixed in the shell while each surface owns its overflow. The first view devotes the remaining viewport to one dashed import workspace with 32px desktop padding and 12px mobile padding.

The gallery uses a compact header over an internally scrolling, auto-filling grid with 180px minimum columns, 14px gaps, and an add-image card in the same rhythm. A floating selection dock remains centered at the bottom and exposes every batch tool without displacing the gallery. At 780px the grid becomes two columns with 10px gaps, card metadata stacks, and the dock becomes a full-width, horizontally scrollable control strip.

The editor is a three-column workbench with an 88px tool rail, a fluid canvas workspace, and a 330px settings panel, separated by 12px gutters. At 1050px the fixed columns narrow. At 780px the editor becomes one internally scrolling column: the tool rail turns into a sticky horizontal strip, followed by the canvas and settings panel. Essential mobile actions and dismiss controls use 44px targets.

**The Contained Workspace Rule.** Fit every primary surface to the viewport and place scrolling on the gallery grid, rails, panels, strips, or mobile editor—not on the document body.

## Elevation & Depth

Depth is ambient and restrained. Thin slate borders and white-on-mist tonal separation do most structural work; shadows confirm only headers, raised primary actions, selected or hovered cards, the canvas artifact, the brand tile, dialog, and transient feedback.

### Shadow Vocabulary

- **Workbench Ambient** (`0 24px 60px -24px rgb(15 23 42 / 0.32), 0 8px 20px -12px rgb(15 23 42 / 0.18)`): Welcome dialog and transient feedback.
- **Header Hairline** (`0 1px 2px rgb(15 23 42 / 0.06), 0 2px 6px rgb(15 23 42 / 0.03)`): Fixed application headers.
- **Primary Outcome** (`0 8px 18px -10px rgba(220, 38, 53, 0.9)`): Resting primary actions; intensifies slightly on hover.
- **Card Lift** (`0 2px 8px -5px rgb(15 23 42 / 0.15)`): Gallery cards at rest, becoming broader only on hover or selection.
- **Image Artifact** (`0 6px 18px -8px rgb(15 23 42 / 0.28), 0 2px 5px rgb(15 23 42 / 0.08)`): Separates the canvas image from the checkerboard stage.

**The Ambient-Only Rule.** Shadows clarify stacking and interaction; they never become dramatic decoration or replace the border system.

## Shapes

The workbench uses a compact, nested radius scale. Image wells begin at 8px, controls at 10px, cards and content stages at 12px, editor panels at 14px, major workspaces at 16px, and the welcome dialog at 18px. Pills are reserved for selection counts, local-processing status, and numbered selection markers. One-pixel slate borders maintain definition across every white surface.

**The Nested Radius Rule.** Smaller objects inside larger containers step down in radius; do not give every layer the same silhouette.

## Components

### Buttons

- **Shape:** Compact rounded rectangles (10px) with 42–48px minimum heights; icon-only mobile actions become 44px squares.
- **Primary:** Document-red fill, white text, 22px horizontal padding for import and 16px for compact header actions.
- **Hover / Focus:** Deepen the red, translate upward by 1px, and strengthen the red ambient shadow. Keyboard focus uses a 3px selection-blue outline with 3px offset.
- **Secondary / Ghost:** Paper-white or transparent, slate-muted text, one-pixel slate border, and a quiet utility-surface hover.

### Chips

- **Style:** The batch dock count uses a soft-blue compact rectangle, deep-blue text, and blue border; local-processing status uses a neutral pill with slate text and border.
- **State:** Chips communicate count or trust status only and never substitute for buttons.

### Cards / Containers

- **Corner Style:** Cards use 12px; major work areas use 14–16px.
- **Background:** Paper white over workspace mist, with utility gray inside nested groups.
- **Shadow Strategy:** A minimal rest shadow becomes slightly broader on hover; selected gallery cards add a blue ring.
- **Border:** One-pixel slate by default, blue when selected, dashed for receptive add/import cards.
- **Internal Padding:** 8px on gallery cards, 10–18px on nested controls, and 22–32px around work areas.

### Inputs / Fields

- **Style:** Utility-surface fill, one-pixel slate border, 10px radius, and 46–48px height.
- **Focus:** A visible selection-blue outline sits outside the component; ranges and native inputs use selection blue as their active accent.
- **Error / Disabled:** Errors use dark red text on a pale red field; disabled controls preserve their silhouette at 42% opacity.

### Navigation

The compact editor rail places a 21px icon over a 10px bold label. Hover uses pale blue and deep-blue text; active state adds a soft-blue fill and inset blue line. Individual compression, renaming, and canvas tools live in this rail and operate on the open image draft. Comparison does not appear in the rail because it is a read-only gallery action. On mobile the rail becomes a sticky, horizontally scrollable 70px strip with 66px items.

### Import Workspace

The signature first view is a single paper-white translucent field contained by a 16px rounded dashed boundary. A raised 68px upload icon, concise title, document-red button, and format note form one centered action cluster. Drag state turns the boundary red and warms the surface without adding new content.

### Selectable Image Card

Each gallery card contains a white image well with a thin border around the actual image, an ellipsized filename, file size, a numbered selection marker at the upper left, and a persistent vertical pair of 44px actions at the upper right. The pencil opens that image alone; the adjacent comparison action opens the read-only before/after view. The rest of the card toggles batch selection. Selection uses a blue border and halo. The gallery has no title/count block above the thumbnails. A right sidebar shows the active batch parameters or selected-image metadata, and parameter changes preview in the selected thumbnails before Apply.

### Individual Editing Workflow

The individual editor opens as a viewport-contained dialog and treats edits as a local draft. Standard adjustments, compression, renaming, and canvas changes may update the preview, filename, or draft blob, but do not mutate the gallery item until Save. The check action commits the current draft; previous/next navigation saves before moving. Cancel, the close action, and dialog cancellation discard the draft and return to the gallery.

### Comparison Dialog

Comparison is a read-only viewport-contained dialog launched from each card's comparison button. It shows original and current output through the before/after surface, supports previous and next image navigation, and exposes only navigation and Close—never Save, Apply, or editing controls. Navigating the comparator neither changes batch selection nor writes image state.

### Batch Action Dock

The 14px floating dock mirrors PDF in Place: a compact selected/total count leads a horizontally scrollable row of 44px icon buttons. Select all and clear selection come first, followed by color adjustments, resize, rotate, watermark, export, and destructive delete. Every icon action carries a descriptive title and accessible label. Batch operations open a viewport-contained parameter dialog over the gallery with a selection count, Cancel, Apply, and progress feedback. They never open the visual editor. Cropping and privacy masking are available only in the individual editor.

### First-Run Dialog

The 18px paper-white dialog is capped to the viewport, scrolls internally, and sits over a blurred slate backdrop. It uses compact feature cells, a persistent preference checkbox, and one document-red completion action. On mobile, features stack and the action spans the dialog width.

## Do's and Don'ts

### Do:

- **Do** keep home, gallery, and editor fitted to 100dvh with overflow owned by their internal work areas.
- **Do** use document red only for brand, import/export, and decisive forward outcomes.
- **Do** use selection blue for focus, selected cards, active tools, ranges, and image-editing overlays.
- **Do** preserve compact nested radii and one-pixel slate borders on paper-white surfaces.
- **Do** keep primary mobile controls and icon actions at least 44px in both dimensions.
- **Do** retain the gallery selection order when a batch action depends on it.
- **Do** keep individual editing on the card pencil and multi-image tools in the persistent bottom dock.
- **Do** keep card Edit and Compare as a persistent vertical pair of separate 44px actions.
- **Do** hold individual compression, rename, and canvas changes in the local draft until Save or save-and-navigate.

### Don't:

- **Don't** restore the former mineral-paper, serif-led Light Table language.
- **Don't** make the document body scroll or allow galleries and editor panels to escape the viewport shell.
- **Don't** use red to indicate ordinary selection or blue as the primary import/export color.
- **Don't** turn every surface into a heavily shadowed floating card; borders and tonal layering carry most structure.
- **Don't** add oversized marketing typography, broad decorative gradients, or ornamental imagery to the workbench.
- **Don't** hide selected state behind color alone; preserve borders, halos, labels, or order markers.
- **Don't** place Compare in the individual editor rail or give the read-only comparator a save action.
- **Don't** commit individual draft changes when the user cancels or closes the editor.
