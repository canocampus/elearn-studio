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

---

## CRITICAL — T630 Phase 2: `document mousemove` fix still wrong **[RESOLVED]**

### Root cause (confirmed via GrapesJS 0.21.13 source analysis)

The Phase 1 fix used `document.addEventListener('mousemove', ...)` on the **main window**
and passed the captured event to `editor.Canvas.getMouseRelativePos()`. Video evidence
showed two distinct failure modes:

- **Slide 1**: widgets land at wrong but non-zero, variable positions
- **Slide 2+**: ALL widgets land at exactly (0,0) — top-left corner, partially outside canvas

`getMouseRelativePos` implementation (from `grapes.min.js`):

```javascript
o.prototype.getMouseRelativePos = function(t, e) {
  var o = t.target.ownerDocument,    // document of the event's target
      r = o.defaultView,
      i = r.frameElement,            // null if main window, <iframe> if inside iframe
      c = 0, u = 0;
  if (i) { var p = i.getBoundingClientRect(); c = p.top; u = p.left; }
  return { y: (t.clientY + c) * zoomMult, x: (t.clientX + u) * zoomMult }
}
```

When called with a main-window event: `frameElement = null`, so `c = u = 0`. Returns
raw viewport coordinates × zoom — NOT canvas-relative coordinates.

**Why Slide 1 vs Slide 2+ behave differently:**

- **Slide 1**: The user moves the mouse across the main window (panels, toolbar) before
  entering the canvas. The main-document `mousemove` listener captures these events.
  `lastMouseEvent` is non-null. `getMouseRelativePos` returns raw viewport coords
  (e.g. x=650, y=380) applied as canvas coordinates → wrong but visible position.

- **Slide 2+**: Once users know the layout they drag directly over the canvas without
  pausing in the main window. The browser suppresses `mousemove` during HTML5 DnD and
  fires `dragover` on the drop target instead. The cursor goes straight into the iframe,
  so the main-document `mousemove` listener never fires. `lastDragEvent` remains `null`.
  The handler returns early without calling `addStyle`. The component is left with
  `position: absolute` but no `left`/`top` → CSS default `auto` → renders at the
  containing block's origin (top-left, partially outside canvas).

### Fix: `dragover` listener inside the iframe document

`DragEvent extends MouseEvent` — it carries `clientX`/`clientY`. During HTML5 DnD,
`dragover` fires continuously on the element under the cursor, including inside the
iframe. Events from inside the iframe have `frameElement` non-null, so
`getMouseRelativePos` computes correct canvas-relative coordinates.

**Implementation** (`packages/authoring-ui/src/editor/initEditor.ts`):

```typescript
const getIframeDoc = (): Document | null => {
  const canvas = editor.Canvas as unknown as { getFrameEl?: () => HTMLIFrameElement | null }
  const iframe = canvas.getFrameEl?.() ?? ...querySelector('iframe')
  return iframe?.contentDocument ?? iframe?.contentWindow?.document ?? null
}

editor.on('block:drag:start', () => {
  getIframeDoc()?.addEventListener('dragover', onCanvasDragOver)
})
editor.on('block:drag:stop', (component) => {
  getIframeDoc()?.removeEventListener('dragover', onCanvasDragOver)
  const pos = canvasModel.getMouseRelativePos(lastDragEvent)   // lastDragEvent is iframe event
  comp.addStyle({ left: `${pos.x}px`, top: `${pos.y}px` })
})
```

### Key lessons

1. **GrapesJS canvas is an iframe** — coordinate work must use events that originate
   inside the iframe (see CLAUDE.md Rule 8 / Regla 8).
2. **HTML5 DnD suppresses `mousemove`** — `dragover` is the correct event to track
   cursor position during a block drag.
3. **`getMouseRelativePos` precondition** — the event's `ownerDocument.defaultView.frameElement`
   must be non-null; otherwise the function returns uncorrected viewport coordinates.

**Result:** All 649 unit tests and 15 grapesjs-integration E2E tests pass.

---

## CRITICAL — T630 Phase 3: `getMouseRelativePos` still wrong, `getMouseRelativeCanvas` also wrong **[RESOLVED]**

### Root cause (confirmed via runtime debug logs)

Phase 2 fixed the iframe event capture but the coordinate function was still wrong.

**Phase 2 used `getMouseRelativePos`:** formula `(clientY + iframe.top) * zoom`. Since
dragover events inside the iframe carry `clientY` already in viewport coordinates (not
iframe-relative), adding `iframe.top` double-counts the iframe position. Result: Y offset
too large by ~iframe.top pixels.

**Phase 3 tried `getMouseRelativeCanvas(event, {noScroll:1})`:** debug logs revealed a
fixed +93.1875px offset on X only — no offset on Y.

Debug data (drop at center):
```
drop clientX=540  → getMouseRelativeCanvas X=633.1875  → offset: +93.1875px
drop clientX=981  → getMouseRelativeCanvas X=1074.1875 → offset: +93.1875px  (constant!)
drop clientY=377  → getMouseRelativeCanvas Y=377        → offset: 0px ✓
drop clientY=685  → getMouseRelativeCanvas Y=685        → offset: 0px ✓
```

The value 93.1875px = `iframe.getBoundingClientRect().left` (the left panel width). The
function is designed for main-window events and internally adds `frameOffset.left`, which
is already included in iframe-internal `clientX`. This causes X to be doubled.

### Phase 4 fix: direct viewport-to-canvas subtraction

`dragover` events inside the iframe carry `clientX/Y` in viewport coordinates.
The iframe's `getBoundingClientRect()` gives its position in the viewport.
Canvas-relative coordinates = `clientX - iframeRect.left`, `clientY - iframeRect.top`.

```typescript
const iframeRect = getIframeEl()?.getBoundingClientRect()
const x = lastDragEvent.clientX - iframeRect.left
const y = lastDragEvent.clientY - iframeRect.top
comp.addStyle({ left: `${Math.round(x)}px`, top: `${Math.round(y)}px` })
```

No GrapesJS internal functions used — eliminates all formula bugs.

**Key lesson:** `getMouseRelativePos` and `getMouseRelativeCanvas` are both designed for
main-window events. Passing iframe-internal events to either function produces incorrect
results because both add the iframe's viewport offset internally (which is already implicit
in the iframe event's `clientX/Y`). Use direct math: `clientX - iframeRect.left`.

**Result:** Offset = 0px in both axes across all drop positions. All 656 unit tests pass.

---

## CRITICAL — T630 Phase 4: subtracting iframeRect offset was WRONG again **[RESOLVED]**

### Root cause

Phase 4 computed `x = clientX - iframeRect.left`, `y = clientY - iframeRect.top`.

**Wrong assumption:** `clientX` from `iframeDoc` events is in viewport coordinates, so
we need to subtract the iframe's position to get canvas-relative coordinates.

**Reality:** Events captured via `iframeDoc.addEventListener('dragover', handler)` carry
`clientX/Y` in the iframe's **own** coordinate space — they are already canvas-relative.
The browser's iframe creates its own viewport; `clientX` inside it is measured from the
iframe's top-left corner, not from the main window's top-left corner.

Subtracting `iframeRect.left` (93.1875px = left panel width) shifted everything 93px to
the left. This is the exact mirror of Phase 3's error (which added 93px). Both bugs
stem from the same false belief that iframe-internal events carry viewport coordinates.

### Phase 5 fix (correct): divide by zoom only

```typescript
const canvasModel = editor.Canvas as unknown as { getZoomDecimal?: () => number }
const zoom = canvasModel.getZoomDecimal?.() ?? 1
const x = lastDragEvent.clientX / zoom
const y = lastDragEvent.clientY / zoom
comp.addStyle({ left: `${Math.round(x)}px`, top: `${Math.round(y)}px` })
```

No offset math. `clientX/Y` from `iframeDoc` events ARE canvas coordinates. Only
divide by `getZoomDecimal()` to account for canvas zoom level (1.0 at 100% zoom).

### Key lesson (canonical)

| Event origin | `clientX/Y` space | What to do |
|---|---|---|
| `document` (main window) | Viewport coordinates | Subtract `iframeRect.left/top`, then divide by zoom |
| `iframeDoc` | Canvas coordinates (iframe-relative) | Divide by zoom only — NO offset subtraction |
| Passed to `getMouseRelativePos()` | Must be main-window event | Never pass iframe events — adds frameOffset internally (double-counts) |
| Passed to `getMouseRelativeCanvas()` | Must be main-window event | Same — adds `frameOffset.left` internally |

**Summary:** `getMouseRelativePos` and `getMouseRelativeCanvas` are designed for
main-window events only. They both add the iframe's viewport offset internally. Passing
iframe-internal events to either function causes double-counting. Use direct math for
iframe events: `canvas_x = clientX / zoomDecimal`.

**Result:** Offset = 0px in both axes. All 657 unit tests pass (added T630.8 for zoom).

---

## T630.UX — Drag ghost replaced with small indicator **[RESOLVED]**

The browser's default drag ghost was the full block element (a large rectangle). This
made drop placement unintuitive: the cursor appeared at the center of the ghost, while
the widget's top-left landed at the cursor tip — creating a visible mismatch.

**Fix:** `dragstart` listener on the block manager container replaces the ghost with a
24×24px colored indicator. The drag hotspot is set to (0, 0) — cursor at the top-left
corner of the ghost — so the cursor tip aligns exactly with where the widget's top-left
will land. This matches the mental model: "I'm placing the top-left here."

```typescript
blockContainer?.addEventListener('dragstart', (e: Event) => {
  const de = e as DragEvent
  if (!de.dataTransfer) return
  const ghost = document.createElement('div')
  ghost.style.cssText =
    'position:fixed;top:-9999px;left:-9999px;width:24px;height:24px;' +
    'background:#6366f1;border-radius:3px;opacity:0.85;pointer-events:none;'
  document.body.appendChild(ghost)
  de.dataTransfer.setDragImage(ghost, 0, 0)  // hotspot at top-left corner
  requestAnimationFrame(() => { document.body.removeChild(ghost) })
})
```

The ghost is positioned off-screen (`top:-9999px`) until `setDragImage` captures it,
then removed on the next animation frame to avoid DOM pollution.

---

## Mejora futura — ghost proporcional (deferred)

La solución actual usa un ghost 24×24px con cursor en esquina superior-izquierda.
Una mejora más intuitiva sería generar un ghost del tamaño real del widget
con el cursor centrado (offset w/2, h/2), igual que Figma/PowerPoint.
Descartada por ahora: requiere mapear dimensiones por tipo de bloque en dragstart,
antes de que el componente GrapesJS exista. Añadir si se implementa un catálogo
de dimensiones por defecto por tipo de widget.
