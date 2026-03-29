# T611 — GrapesJS Component `defaults` Missing Custom Persistence Fields

**Date:** 2026-03-29
**Severity:** HIGH
**Status:** Fixed
**Files:** `packages/authoring-ui/src/editor/registerBlocks.ts`, `registerQuestionBlocks.ts`, `registerSimBlock.ts`, `registerPhaserSimBlock.ts`
**Tests:** `src/__tests__/registerBlocks.test.ts` — T012.11 (42 new tests)

---

## Root Cause

All GrapesJS component types registered in eLearn Studio use three custom model fields
to store per-widget data:

| Field | Purpose |
|---|---|
| `properties` | Widget-specific properties (text content, src URL, decorative CSS, etc.) |
| `elearnActions` | ActionSequence[] — the visual action programming sequences |
| `extendedProperties` | Question config (MC options, scoring), sim config (Phaser scene def, screenshot sim steps) |

These fields were **absent from the Backbone.Model `defaults`** for most component types.

Backbone.Model stores any attribute passed to `set()` regardless of `defaults`, but GrapesJS's
component initialization pipeline merges the component definition with `defaults` when creating
model instances from `loadProjectData`. Without `defaults` declaring these fields, GrapesJS
could silently drop them during component construction, meaning every course reload would lose:

- Widget text content, image URLs, decorative CSS saved in `properties`
- All action sequences in `elearnActions`
- Extended question config or simulation config in `extendedProperties`

### Which types were affected

| File | Component types | Missing fields |
|---|---|---|
| `registerBlocks.ts` | `text`, `image`, `button`, `rectangle`, `nav-buttons`, `done-button`, `score-quiz`, `score-field`, `media-player` | `properties`, `elearnActions`, `extendedProperties` |
| `registerQuestionBlocks.ts` | `question-mc`, `question-tf`, `question-fill` | `properties`, `elearnActions` (had `extendedProperties`) |
| `registerSimBlock.ts` | `screenshot-sim` | `properties`, `elearnActions` (had `extendedProperties`) |
| `registerPhaserSimBlock.ts` | `phaser-sim` | `properties`, `elearnActions` (had `extendedProperties`) |

---

## Fix

Added `properties: {}`, `elearnActions: []`, `extendedProperties: {}` to the `defaults` object
of every affected component type registration. For types that already declared `extendedProperties`
(question types, sim types), only `properties` and `elearnActions` were added.

This guarantees:
1. GrapesJS Backbone.Model always initialises these keys on every component instance.
2. `loadProjectData` restores the saved values by merging the component definition into
   the model's initial state — the keys are now known to the model before merging begins.
3. `widgetsFromGrapesjs` (`converters.ts`) can always rely on `c.get('properties')`,
   `c.get('elearnActions')`, and `c.get('extendedProperties')` returning the correct values
   (or safe empty defaults) rather than `undefined`.

---

## Bugs Recorded

### BUG-T611-01 — Widget properties lost on course reload (HIGH)

**Component types affected:** All 14 registered types
**Symptom:** Navigating away from a course and back (or reloading the page) would cause all
widget-specific data stored in `properties` to be absent from the GrapesJS component model,
reverting widgets to their registration defaults.
**Root cause:** `properties` absent from component `defaults`.
**Fix:** Added `properties: {}` to all 14 component type `defaults`.
**Status:** Fixed

---

### BUG-T611-02 — Action sequences lost on course reload (HIGH)

**Component types affected:** All 14 registered types
**Symptom:** Any action sequences (navigation, scoring, conditional logic) attached to a widget
would disappear after page reload — the widget would render correctly but all interactions
would be non-functional.
**Root cause:** `elearnActions` absent from component `defaults`.
**Fix:** Added `elearnActions: []` to all 14 component type `defaults`.
**Status:** Fixed

---

### BUG-T611-03 — Extended question/sim config reverts to defaults on reload (HIGH)

**Component types affected:** `text`, `image`, `button`, `rectangle`, `nav-buttons`,
`done-button`, `score-quiz`, `score-field`, `media-player` (the 9 basic types)
**Symptom:** Although basic widget types are unlikely to use `extendedProperties` currently,
the absence of this field created an inconsistency in the model contract and a latent data-loss
risk for any future feature that adds extended config to these types.
**Root cause:** `extendedProperties` absent from basic widget component `defaults`.
**Fix:** Added `extendedProperties: {}` to all 9 basic widget type `defaults`.
**Status:** Fixed

---

## Test Coverage Added

**File:** `packages/authoring-ui/src/__tests__/registerBlocks.test.ts`
**Suite:** `T012.11 — All component defaults declare custom persistence fields`
**Tests:** 42 (14 component types × 3 fields)

Each test asserts:
- `defaults.properties` exists and equals `{}`
- `defaults.elearnActions` exists and equals `[]`
- `defaults.extendedProperties` exists and is an object

These tests will **fail immediately** if any field is accidentally removed from any component
type `defaults`, providing a permanent regression guard.

---

---

### BUG-T611-04 — GrapesJS Trait attributes not persisted (HIGH)

**Component types affected:** `image`, `media-player`, and any type using GrapesJS Traits
**Symptom:** Setting `alt` text on an image widget, or configuring `mediaType` on a
media-player widget via the sidebar Traits panel, would revert to defaults after a page
reload or slide switch. Any attribute stored by GrapesJS in `model.attributes` via the
Trait system was silently dropped.
**Root cause:** `widgetsFromGrapesjs` only captured `style`, `content`, and `src`. The
`c.getAttributes()` call — which returns all model attributes including those set via Traits
— was never invoked, so Trait values never reached the `properties` field saved to MongoDB.
**Fix:**
- Added `INTERNAL_GJS_ATTRS = new Set(['id', 'class', 'style', 'src'])` in `converters.ts`.
- `widgetsFromGrapesjs` now iterates `c.getAttributes()` and copies every non-internal
  attribute into `mergedProps`, then stores in `properties`.
- `grapesjsFromWidgets` now reconstructs `attributes` from `properties` on load,
  restoring all Trait values to the GrapesJS model before the canvas renders.
**File:** `packages/authoring-ui/src/editor/converters.ts`
**Status:** Fixed

---

### BUG-T611-05 — Text widget content captured before DOM flush (HIGH)

**Component types affected:** `text`, `button`
**Symptom:** After editing the text of a widget (especially when adding formatted HTML such
as bold or links via TipTap), the content appeared empty or reverted to the pre-edit value
("Double-click to edit text") after switching slides. The issue was most reproducible when
the autosave debounce fired while the text cursor was still inside the widget.
**Root cause:** GrapesJS renders text edits inside a live DOM editable region. The Backbone
model attribute `content` is only updated when the `text-edit` command exits (on blur or
Escape). If `editor.store()` was called while the command was still active, `c.get('content')`
returned stale data. Additionally, `c.get('content')` does not capture child component HTML
(e.g., formatted spans generated by TipTap).
**Fix:**
- `widgetsFromGrapesjs` now calls `c.getInnerHTML()` for `text` and `button` types, which
  reads directly from the rendered child component tree and captures all formatted HTML.
  Falls back to `c.get('content')` in test environments where `getInnerHTML()` is unavailable.
- `initEditor.ts` now executes `editor.stopCommand('text-edit')` immediately before every
  `editor.store()` call, forcing GrapesJS to flush the active text edit from the DOM to the
  Backbone model before serialisation.
**Files:** `packages/authoring-ui/src/editor/converters.ts`, `initEditor.ts`
**Status:** Fixed

---

### BUG-T611-06 — Newly dropped widgets not triggering autosave (MEDIUM)

**Component types affected:** All widget types
**Symptom:** A widget dragged from the Block Manager onto the canvas would sometimes
disappear after a page reload if the user did not interact with it (move/resize) after
placing it. The widget existed in the GrapesJS model in memory but had never been
persisted to the backend.
**Root cause:** The autosave debounce was wired exclusively to the `component:update`
event. Dragging a block onto the canvas fires `component:add`, not `component:update`.
A freshly placed widget would only enter the persistence pipeline on the next
`component:update` event (triggered by a move, resize, or style change).
**Fix:** Added event listeners for `component:add`, `component:remove`, and
`component:update:content` in `initEditor.ts`, all invoking the same debounced
`triggerAutosave` handler as `component:update`.
**File:** `packages/authoring-ui/src/editor/initEditor.ts`
**Status:** Fixed

---

### BUG-T611-07 — React sidebar panel extendedProperties changes lost on fast slide switch (HIGH)

**Component types affected:** `question-mc`, `question-tf`, `question-fill`, `phaser-sim`, `screenshot-sim`
**Symptom:** Editing question text, answer options, scoring settings, or simulation
configuration in the sidebar and immediately switching slides (within ~2 seconds) caused
the changes to be silently discarded. On returning to the slide, the widget showed the
previous configuration.
**Root cause:** All three React sidebar panels (`QuestionPropertiesPanel.tsx`,
`PhaserSimPropertiesPanel.tsx`, `SimulationEditor.tsx`) called `component.set('extendedProperties', ...)`
and relied on the 2-second autosave debounce timer to persist the mutation. If the user
triggered a slide switch before the timer fired, the debounce callback executed after the
slide context had changed, and the serialised state no longer included the edited widget.
**Fix:** All three panels now call `editor.store()` synchronously and immediately after every
significant `extendedProperties` mutation, bypassing the debounce timer for sidebar-driven
changes. The 2-second debounce remains active for canvas interactions.
- `MCPropertiesForm`, `TFPropertiesForm`, `FillPropertiesForm` — immediate `editor.store()` after `component.set('extendedProperties', ...)`
- `PhaserSimPropertiesPanel` — immediate `editor.store()` after `setExtendedProps()`
- `SimulationEditor` — immediate `editor.store()` after `component.set('extendedProperties', ...)`
**Files:** `packages/authoring-ui/src/components/sidebar/QuestionPropertiesPanel.tsx`,
`PhaserSimPropertiesPanel.tsx`, `packages/authoring-ui/src/components/simulation/SimulationEditor.tsx`
**Status:** Fixed

---

## Related

- `issues-T507.md` — storageManager unit tests
- `external_issues_save.md` — external reviewer analysis documenting BUG-T611-04 through BUG-T611-07
- `CHANGELOG.md` — [0.5.6] entry (component defaults fix), [0.5.7] entry (Trait capture, getInnerHTML, autosave reliability)
- `converters.ts` — `widgetsFromGrapesjs` reads these fields; relies on them being non-undefined
