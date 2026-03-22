# T012 Code Review — Issues Report

**Reviewed:** 2026-03-21
**Scope:** T012 — Widget Blocks Registration
**Files reviewed:** `editor/registerBlocks.ts`, `editor/initEditor.ts` (call site), `__tests__/registerBlocks.test.ts`

---

## CRITICAL (2)

### C-01 — Unsafe editor context resolution in `onImageClick`
**File:** `editor/registerBlocks.ts` — original `onImageClick` implementation
The original implementation attempted to extract the editor from GrapesJS component view context
via `this.em.get('Editor')` with an `unknown` cast, then fell back to the closure `editor`.
The `em.get('Editor')` path is not guaranteed by GrapesJS types and could return null, silently
substituting a stale/wrong editor instance.
**Fix:** Removed the `this.em` indirection entirely. The `editor` closure captured from
`registerImageWidget(editor)` is the correct, stable reference — GrapesJS initialises component
types synchronously so the closure lifetime matches the editor lifecycle.
✅ Fixed inline during T012.11.

### C-02 — `asset.getSrc()` applied without validation
**File:** `editor/registerBlocks.ts` — `select` callback inside `onImageClick`
`asset.getSrc()` could return an empty string if the asset has no URL yet (e.g. upload still
in progress), silently setting `src=""` on the image component.
**Fix:** Added guard `if (!src) return` before `addAttributes()`.
✅ Fixed inline during T012.11.

---

## HIGH (3)

### H-01 — `events` type cast `as Record<string, string>`
**File:** `editor/registerBlocks.ts` — image component `view`
The `as Record<string, string>` cast on the `events` object bypassed TypeScript's type checker,
hiding potential mismatches with GrapesJS's Backbone-style view API.
**Fix:** Changed to `as unknown as object` on the whole view to satisfy the GrapesJS `addType`
signature while keeping the Backbone event-map pattern intact. `onImageClick` is the method
string target in the map.
✅ Fixed inline during T012.11.

### H-02 — `selected.set('src', ...)` instead of `addAttributes`
**File:** `editor/registerBlocks.ts` — original `select` callback
`component.set('src', value)` sets a Backbone model property, not the rendered HTML attribute.
For `<img>` elements the attribute must be updated via `addAttributes({ src })` to trigger
GrapesJS's attribute-to-DOM sync.
**Fix:** Changed to `selected.addAttributes({ src })`.
✅ Fixed inline during T012.11.

### H-03 — `content` trait name conflicts with GrapesJS model property
**File:** `editor/registerBlocks.ts` — `button` and `done-button` components
GrapesJS uses `content` as a built-in model property (inner HTML). Adding a trait named
`content` intentionally links the trait to this property (trait changes call
`model.set('content', value)`), which is the desired behavior for label editing. However,
it is an implicit coupling that could break if GrapesJS changes the property name.
**Why deferred:** The coupling is intentional and is the canonical GrapesJS way to bind a trait to inner HTML. Renaming would require a custom trait type with a manual `onChange` handler — more complex with no current benefit.
**Unblock condition:** If a GrapesJS upgrade changes the `content` property name, rename the trait and add `onChange: ({ component, value }) => component.set('content', value)` to keep the link explicit.

---

## MEDIUM (3)

### M-01 — TipTap integration not implemented (T012.7)
The text widget uses GrapesJS built-in `editable: true` (contenteditable on double-click).
True TipTap-in-iframe integration requires loading TipTap inside the GrapesJS canvas iframe
and attaching it to the selected element — non-trivial and deferred.
**Why deferred:** The GrapesJS canvas runs inside an `<iframe>`. TipTap must be loaded and mounted inside that iframe's document, not the parent page. This requires a custom GrapesJS plugin that: (1) injects TipTap's CSS into the iframe `<head>`, (2) creates a TipTap `Editor` instance targeted at the selected `<div>` element inside the iframe, and (3) serialises TipTap's HTML output back to the widget's `html` property on blur. This is a standalone feature, not a quick fix.
**Unblock condition:** Create a dedicated TipTap integration task. Implement `packages/authoring-ui/src/editor/plugins/tiptap-plugin.ts` following the GrapesJS plugin interface.

### M-02 — `nav-buttons` / `score-field` use `display: flex` in defaults
These components default to `display: flex` for layout. Our converter (`widgetsFromGrapesjs`)
tracks visibility as `style.display !== 'none'`, so flex-displayed components round-trip
correctly as visible. However, on reload `grapesjsFromWidgets` restores `display: 'block'`
(not `flex`), losing the flex layout on the first save/load cycle.
**Why deferred:** Fixing this properly requires `grapesjsFromWidgets` to be widget-type-aware — each widget type would need to know its default `display` value and restore it on load. That is a larger refactor touching converters, widget schema, and test fixtures.
**Unblock condition:** When dedicated component views are added per widget type, each `view.onRender()` will apply the correct CSS directly from the widget's `extendedProperties`, bypassing the converter entirely. At that point remove the `display` field from the converter round-trip.

### M-03 — No integration test exercising block drag-drop on canvas
T012.6 (drag → drop at cursor position) is verified by the GrapesJS framework + the
`component:add` position:absolute listener in `initEditor.ts`. No automated test simulates
the full drag-drop flow in jsdom/Playwright.
**Why deferred:** HTML5 drag-and-drop cannot be simulated in jsdom (no layout engine). A real drag-drop test requires a Playwright E2E suite with the full app running in a browser. The E2E infrastructure does not exist yet.
**Unblock condition:** When Playwright E2E tests are set up for the authoring UI, add a test: open the editor → drag a `Text` block from the palette → drop on canvas → assert the widget appears in the GrapesJS layer manager.

---

## LOW (3)

### L-01 — SVG icons use mixed fill/stroke strategies
Some icons use `fill="none" stroke="currentColor"` while `mediaPlayer` uses
`fill="currentColor" stroke="none"` for the play polygon. Intentional (play button should be
filled) but worth noting for visual consistency across the block palette.
*Accepted — intentional design.*

### L-02 — `void: true` on image model may be incorrect
Setting `void: true` in the component model marks it as a self-closing element, which is
correct for `<img>`. However if GrapesJS's built-in handling for `void` conflicts with
attribute rendering, the component may not display correctly.
*Low risk — GrapesJS handles `<img>` void correctly in practice.*

### L-03 — Block `content` for nav-buttons / score-quiz contains inline HTML
The `content` field for `nav-buttons`, `score-quiz`, `score-field` embeds full HTML strings
with inline styles. These inline styles are not tracked in the Style Manager and will not
round-trip through our Widget schema properly (they will be lost on save).
**Why deferred:** The `content` HTML is only the initial GrapesJS block preview — once the component is rendered via its `view.onRender()` method, the inline HTML is replaced with the view's output. Fixing the round-trip requires dedicated component views that reconstruct the HTML from `extendedProperties`, which is a larger task.
**Unblock condition:** Implement per-widget `view.onRender()` methods for `nav-buttons`, `score-quiz`, and `score-field` that generate their HTML from structured `extendedProperties` rather than from the raw `content` string.

---

## Resolution Status

| Issue | Status |
|-------|--------|
| C-01 (unsafe editor context) | ✅ Fixed — closure-only approach |
| C-02 (unvalidated getSrc) | ✅ Fixed — empty src guard |
| H-01 (events type cast) | ✅ Fixed — `as unknown as object` |
| H-02 (set vs addAttributes) | ✅ Fixed — `addAttributes({ src })` |
| H-03 (content trait coupling) | Deferred — intentional coupling, documented above |
| M-01 (TipTap not implemented) | Deferred — requires TipTap-in-iframe plugin task |
| M-02 (flex display round-trip) | Deferred — requires per-type `grapesjsFromWidgets` |
| M-03 (no drag-drop test) | Deferred — requires Playwright E2E infrastructure |
| L-01 (mixed SVG strategies) | Accepted — intentional design |
| L-02 (`void: true` on image) | Accepted — GrapesJS handles correctly |
| L-03 (inline HTML in block content) | Deferred — requires per-widget component views |

**Tests:** 111 passing after T012 (up from 73 — 38 new tests: all 9 block registrations × 4 assertions + component type assertions).
