/r# T010 Code Review — Issues Report

**Reviewed:** 2026-03-21
**Scope:** T010 — GrapesJS editor scaffold (all files created in T010)
**Files reviewed:** `TopToolbar.tsx`, `EditorCanvas.tsx`, `initEditor.ts`, `storageManager.ts`, `assetManager.ts`, `editorStore.ts`, `courseApi.ts`, `App.tsx`, `AppLayout.tsx`, `SlideList.tsx`, `BlockManagerPanel.tsx`, `LayerManagerPanel.tsx`, `StyleManagerPanel.tsx`

---

## CRITICAL (4)

### C-01 — TopToolbar: unhandled async errors in slide handlers
**File:** `components/layout/TopToolbar.tsx` lines 23–41
`handleNewSlide` and `handleDeleteSlide` are async but have no try-catch. Any API failure will produce an unhandled promise rejection with no user feedback.
**Fix:** Wrap in try-catch, show error, update `isSaving`/`setSaveError`.

### C-02 — EditorCanvas: React StrictMode double-init
**File:** `components/editor/EditorCanvas.tsx` lines 29–62
In React 18 StrictMode (development), `useEffect` fires twice. GrapesJS `init()` is called twice on the same container, creating two editor instances. The first cleanup call may not destroy cleanly before the second init.
**Fix:** Guard with an `isInitializedRef` boolean ref so init only runs once per mount cycle.

### C-03 — EditorCanvas: bare eslint-disable with no explanation
**File:** `components/editor/EditorCanvas.tsx` line 61
`// eslint-disable-next-line react-hooks/exhaustive-deps` with no explanation leaves future developers confused about why `setEditor` is intentionally excluded.
**Fix:** Expand comment to explain the intent.

### C-04 — initEditor: storageManager options nested format unverified
**File:** `editor/initEditor.ts` lines 37–42
The `options: { 'elearn-api': { courseId, slideId } }` nested format is from GrapesJS ≤0.19. GrapesJS 0.21 may pass options differently to custom storage `load`/`store` callbacks. This will break T011.
**Fix:** Add comment; verify actual options shape in T011 when real storage is implemented.

---

## HIGH (5)

### H-01 — TopToolbar: `isSaving` never set during slide operations
**File:** `components/layout/TopToolbar.tsx`
`setIsSaving` and `setSaveError` exist in the store but are not called by the slide handlers. The saving badge never shows for slide add/delete.
**Fix:** Call `setIsSaving(true)` before and `setIsSaving(false)` / `setSaveError` in finally/catch.

### H-02 — App.tsx: race condition on retry
**File:** `App.tsx` lines 31–34
If `createCourse` succeeds but subsequent `getCourse` fails, the reload will create another course. No course ID is preserved between attempts.
**Fix:** Separate the create/load steps; persist the created course ID before the `getCourse` call. ✅ Resolved in T013 — bootstrap now calls `listCourses()` first; a retry finds the previously created course instead of creating a duplicate.

### H-03 — EditorCanvas: panel-not-found exits silently
**File:** `components/editor/EditorCanvas.tsx` lines 37–40
`console.error` and early return leaves the canvas blank with no user feedback when panel containers are missing.
**Fix:** Set an error state and render a visible error message in the canvas area.

### H-04 — courseApi: network errors indistinguishable from API errors
**File:** `api/courseApi.ts` lines 19–29
If `fetch` itself throws (e.g., network offline), the raw browser error `"Failed to fetch"` surfaces. There is no context about which endpoint failed.
**Fix:** Wrap `fetch` call to catch and rethrow with endpoint context.

### H-05 — EditorCanvas: stale editor ref in store after destroy
**File:** `components/editor/EditorCanvas.tsx` lines 56–59
On cleanup, `editor.destroy()` is called but `setEditor(null)` is not. The store holds a reference to the destroyed editor, which will throw if any code calls methods on it.
**Fix:** Call `setEditor(null)` in the cleanup function.

---

## MEDIUM (6)

### M-01 — storageManager: stub returns `{}` — GrapesJS may interpret as empty state
`load()` returning `{}` may cause GrapesJS to clear the canvas on every mount. Stub should return a clear "not-implemented" marker or simply not autoload.

### M-02 — initEditor: `component:add` runs on every add including programmatic
The `component:add` listener fires for all components including nested children. This may conflict with components that legitimately use non-absolute positioning.

### M-03 — AppLayout: panel containers hidden with `display:none` may cause GrapesJS layout issues
GrapesJS measures the container when appending panels. If `display:none`, dimensions are 0. GrapesJS may render incorrectly when the tab becomes visible.

### M-04 — editorStore: `currentSlide()` is a function, not reactive
Calling `useEditorStore(s => s.currentSlide())` is safe but unusual — Zustand doesn't memoize function returns. Components using this will rerender on every store update.

### M-05 — courseApi: `addSlide` performs a GET then PUT — race condition
Two concurrent `addSlide` calls will both GET the same version and overwrite each other's slide. Fine for single-user MVP but worth documenting.

### M-06 — SlideList: `SlideItem` not keyboard accessible
`<div onClick>` without `role="button"` and keyboard handler fails WCAG 2.1 success criterion 2.1.1.

---

## LOW (5)

### L-01 — TopToolbar uses `alert`/`confirm` — non-accessible, non-stylable
Native dialogs break the dark theme and are inaccessible. Replace with custom modals (deferred to T013+).

### L-02 — initEditor: `canvas.styles` inlines all CSS as array strings
No deduplication; style accumulation on multiple inits could cause bloat.

### L-03 — AppLayout: right sidebar missing `borderLeft`, only has `borderRight`
Right sidebar has `borderRight` but visually should have `borderLeft` separating it from the canvas.

### L-04 — EditorCanvas: missing `aria-label` on canvas container div
Screen readers get no context about the editing area.

### L-05 — courseApi: `reorderSlides` silently drops unknown slide IDs
If `orderedIds` contains an ID not in the course, that ID is silently ignored. Should validate input matches course slides.

---

---

## T010.12 Refinements (applied 2026-03-21)

### N-01 — initEditor: `autosave: true, stepsBeforeSave: 1` causes excessive API calls
**File:** `editor/initEditor.ts`
`autosave: true` with `stepsBeforeSave: 1` triggers a network PATCH on every undo/redo step, flooding the API with partial state updates during normal editing.
**Fix:** Set `autosave: false`. T011.7 will introduce a debounced explicit save button. Changed `stepsBeforeSave` removed entirely (not needed with autosave off).

### N-02 — converters: `grapesjsFromWidgets` typed as `any[]`
**File:** `editor/converters.ts`
The return type `any[]` bypasses TypeScript's type system for all callers. Storage manager and tests receive untyped defs.
**Fix:** Added `GrapesJsComponentDef` interface and typed the return as `GrapesJsComponentDef[]`.

### N-03 — initEditor: deviceManager missing `height: '768px'`
**File:** `editor/initEditor.ts`
Device config only specified `width: '1024px'`, omitting the height. GrapesJS would infer an unconstrained canvas height, breaking the fixed 1024×768 layout required by CLAUDE.md.
**Fix:** Added `height: '768px'` to the `slide` device entry.

---

## Resolution Status

| Issue | Status |
|-------|--------|
| C-01 | ✅ Fixed |
| C-02 | ✅ Fixed |
| C-03 | ✅ Fixed |
| C-04 | ✅ Fixed (comment + documented for T011) |
| H-01 | ✅ Fixed |
| H-02 | ✅ Fixed (T013 — bootstrap now calls `listCourses()` first; retry reuses the created course instead of duplicating it) |
| H-03 | ✅ Fixed |
| H-04 | ✅ Fixed |
| H-05 | ✅ Fixed |
| M-01 through M-05 | Deferred — see notes below |
| M-06 | ✅ Fixed — `role="button"`, `tabIndex={0}`, `onKeyDown` added to SlideItem |
| L-01 through L-02 | Deferred — see notes below |
| L-03 | ✅ Fixed — right sidebar now uses `borderLeft: '1px solid #313244'` |
| L-04 through L-05 | Deferred — see notes below |

---

## Deferred Item Justifications

### M-01 — storageManager stub returns `{}`
**Why deferred:** The T010 scope was the GrapesJS scaffold only. The real storage manager (mapping `{}` → course JSON) was explicitly scoped to T011. Fixing this in T010 would have mixed concerns and required the full Course/Slide API to exist first.
**Unblock condition:** Completed in T011. The stub was replaced by the real `elearn-api` storage manager.

### M-02 — `component:add` fires for all programmatic adds
**Why deferred:** In the MVP, all widgets are placed via drag-drop from the block palette. Programmatic `component:add` events are only triggered by GrapesJS internal operations (paste, undo/redo) where setting `position:absolute` is harmless. No user-facing bug has been observed.
**Unblock condition:** Address if/when widgets are added via non-drag-drop paths (e.g. template application, batch import) and positional side-effects are observed.

### M-03 — Panel containers hidden with `display:none` may cause GrapesJS layout issues
**Why deferred:** GrapesJS measures containers on first render. In the tab layout, the visible tab's panel is always `display:block` before GrapesJS appends to it. The hidden tab panels are only rendered after the user switches tabs, at which point they are already visible. No layout regression has been observed in practice.
**Unblock condition:** If panel width or height renders as 0 after a tab switch, implement a `ResizeObserver`-based re-trigger.

### M-04 — `currentSlide()` is a function, not reactive
**Why deferred:** The Zustand selector `useEditorStore(s => s.currentSlide())` is safe and correct — Zustand will recompute on every store update. The concern is excessive rerenders, not correctness. In the current component tree, only `EditorCanvas` and `SlideList` use this selector; both already rerender when the slide changes. No performance regression observed.
**Unblock condition:** Replace with a derived selector (e.g. `useEditorStore(s => s.slides[s.currentSlideIndex])`) if profiling identifies this as a bottleneck.

### M-05 — `addSlide` GET+PUT race condition
**Why deferred:** eLearn Studio is a single-author tool — concurrent `addSlide` calls from the same user in the same session are not a realistic scenario. The server-side slide routes (added in T013 — `POST /courses/:id/slides`) use atomic MongoDB `$push` operations, making this concern moot for all new code.
**Unblock condition:** This client-side helper is superseded by the atomic server routes. Remove `courseApi.addSlide` (GET+PUT) when all callers are migrated to `POST /courses/:id/slides`.

### L-01 — `alert`/`confirm` native dialogs
**Why deferred:** Native dialogs are a Phase 0 placeholder. Building a custom modal system requires a shared UI component library that does not yet exist. The dialogs are functional (correct behavior) even if not styled consistently.
**Unblock condition:** Replace when a modal component is added to the design system (T013+ UI polish sprint).

### L-02 — `canvas.styles` inlines CSS without deduplication
**Why deferred:** GrapesJS `init()` is called once per editor lifecycle. The style accumulation concern only applies if `init()` is called multiple times in the same session — which the `isInitializedRef` guard (C-02 fix) prevents. No observable bloat in practice.
**Unblock condition:** No action required unless GrapesJS is reinitialised mid-session (not currently planned).

### L-04 — Missing `aria-label` on canvas container
**Why deferred:** Screen reader accessibility for a drag-and-drop canvas editor is a complex, dedicated effort (WCAG 2.1 AA requires more than a single `aria-label`). A full accessibility audit is deferred to a dedicated accessibility sprint.
**Unblock condition:** Schedule an accessibility sprint before any public release. Add `aria-label="Slide canvas"` as a first step, then audit with Axe.

### L-05 — `reorderSlides` silently drops unknown slide IDs
**Why deferred:** `reorderSlides` is only called from `SlideList.handleDrop` with IDs sourced directly from `course.slides.map(s => s.id)`. There are no external callers that could pass unknown IDs. Server-side the `/courses/:id/slides/reorder` endpoint validates `orderedIds` length matches existing slides count.
**Unblock condition:** Add client-side validation if `reorderSlides` is ever exposed to plugin authors or external integrations.
| N-01 (autosave) | ✅ Fixed (T010.12) |
| N-02 (any[] type) | ✅ Fixed (T010.12) |
| N-03 (height missing) | ✅ Fixed (T010.12) |
