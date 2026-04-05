# Issues — T630: Fix drag-and-drop positioning using actual drop coordinates

## Summary

T630 fixed the root cause of the (100,100) positioning bug where all widgets dropped onto
the GrapesJS canvas always appeared at coordinates (100, 100) regardless of where the user
released the mouse.

---

## CRITICAL

### T630-C1 — Block content styles overrode GrapesJS dragMode coordinates **[RESOLVED]**

**Root cause:** Every block definition in `registerBlocks.ts`, `registerQuestionBlocks.ts`,
`registerSimBlock.ts`, and `registerPhaserSimBlock.ts` included `left: '100px', top: '100px'`
in the block's `content.style`. When a block is dropped, GrapesJS merges these styles into
the new component — and since they were explicit, they won the specificity war over anything
GrapesJS's `AbsoluteModel`/`SorterAbsolute` attempted to set from the drop event.

`dragMode: 'absolute'` was configured in `initEditor.ts` but had no effect because it was
overridden at creation time by block content styles.

**Fix:**
1. Removed `left/top` from all 16 block content style definitions across 4 files.
2. Added `block:drag:start` / `block:drag:stop` handlers in `initEditor.ts` that track
   the last `MouseEvent` during block drags via `document.addEventListener('mousemove')`.
   On `block:drag:stop`, `editor.Canvas.getMouseRelativePos(lastMouseEvent)` is called
   to convert viewport coordinates to canvas-space (accounts for zoom, scroll, iframe
   offsets, and the ~50% display scale of the 1024×768 canvas). The canvas-space
   coordinates are then applied via `comp.addStyle({ left, top })`.

**Files changed:**
- `packages/authoring-ui/src/editor/initEditor.ts` (lines 215–246)
- `packages/authoring-ui/src/editor/registerBlocks.ts` (12 blocks)
- `packages/authoring-ui/src/editor/registerQuestionBlocks.ts` (3 blocks)
- `packages/authoring-ui/src/editor/registerSimBlock.ts` (1 block)
- `packages/authoring-ui/src/editor/registerPhaserSimBlock.ts` (1 block)

**Commit:** `a3a9970`

---

## HIGH

### T630-H1 — progress-bar `width: '100%'` caused full-canvas-width drop **[RESOLVED]**

The progress-bar block had `width: '100%'` in its content style, causing it to span the
full 1024px canvas width on drop. Changed to `width: '80%'` (819px) which is still
appropriately wide without being confusing.

**Fixed in:** `registerBlocks.ts` — progress-bar block content style.

---

## MEDIUM

### T630-M1 — Fallback coordinates (200, 200) apply when drag is cancelled mid-way

If a drag starts but `block:drag:stop` fires with `component = undefined` (user released
outside the canvas), the listener is cleaned up and no component is created — correct.

However, `lastDropX/lastDropY` reset to `200` only at module init. If the user drags onto
the canvas immediately without moving the mouse (e.g., clicks the block directly), the
component will land at (200, 200) instead of the block's position. This is acceptable
behaviour (200, 200 is a sensible default away from the origin) and does not impact normal
drag-to-canvas workflows.

**Status:** Accepted. Not a regression. Previous behaviour was stuck at (100, 100).

---

## LOW / NOTES

### T630-N1 — `addStyle` triggers `component:update` → autosave debounce

When `block:drag:stop` calls `comp.addStyle({ left, top })`, this fires `component:update`
which starts the 2-second autosave debounce. This is the correct and desired behaviour —
a newly dropped widget should be persisted.

### T630-N2 — Prior "fix" attempts masked the bug

Previous sessions had removed `left/top` from `model.defaults.style` but NOT from
`content.style`. Since `content.style` is applied at component creation time (overrides
defaults), the bug persisted. T630 fixed both: removed from `content.style` and added
the `block:drag:stop` handler for correct runtime coordinates.

---

## Test coverage

- `e2e/tests/grapesjs-integration.spec.ts`:
  - `"dropped widgets land at the correct coordinates (X, Y)"` — ±50px precision test
  - `"widgets do not jump to (20, 20) on drop"` — regression guard
  - T600/BETA-06 suite: done-button, question-tf, question-fill, media-player not at origin
- Unit tests: 649 passing (all authoring-ui tests green)
- CI: passed on commit `9982339`
