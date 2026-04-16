# eLearn Studio — Task List

> Status: [ ] = pending | [x] = done | [~] = in progress | [!] = blocked
> 
> **Historical tasks (Phases 0–9, T001–T642):** see `docs/tasks_phase0-9.md`
> 
> Active from: Phase 10 — React/GrapesJS Architectural Refactor

---

## PHASE 10 — React/GrapesJS Architectural Refactor

> **Context:** Audit (April 2026) identified 12 architectural issues across 4 files
> causing memory leaks, stale state, and persistent UI bugs (Nav Buttons overlap,
> widget rescale, background loss). Root cause: fragmented React/GrapesJS integration
> with no single source of truth. Full diagnosis in `docs/issues/issues-T644-audit.md`.
>
> **Before modifying any file in this phase:** read `GRAPESJS_REACT_PATTERNS.md`
> and run the pre-commit checklist in `AGENTS.md`.

---

### T644 — Fix PhaserSimPropertiesPanel: align with panel pattern

> **Issues:** #2 (direct editor.store()), #7 (no Backbone subscription), #9 (stale sceneDefJson)
> PhaserSimPropertiesPanel is the only panel that bypasses the established
> useComponentProperty pattern used by all other panels.

- [ ] T644.1 — Replace direct `getExtendedProps(selected)` read with `useComponentProperty`
  subscription so undo/redo re-renders the panel correctly
- [ ] T644.2 — Remove `editor!.store()` call from `update()` — let the existing
  `component:update` → debounced autosave path handle persistence
- [ ] T644.3 — Fix `sceneDefJson` stale mirror: replace `onBlur` sync with a `useEffect`
  that updates the textarea whenever `ep.sceneDef` changes (Backbone → React direction)
- [ ] T644.4 — Ensure `isSaving`/`setSaveError` Zustand state is updated on all save paths
  (currently Phaser saves bypass the SaveErrorBanner)
- [ ] T644.5 — Unit tests: verify save path uses debounce, verify undo re-renders panel,
  verify sceneDefJson stays in sync after external Backbone change
- [ ] T644.6 — Run full test suite + push + verify CI green
- [ ] T644.7 — Refine the generated code
- [ ] T644.8 — A reviewer will generate `docs/issues/issues-T644.md`; resolve before closing

---

### T645 — Fix storageManager singletons: eliminate module-level mutable state

> **Issues:** #3 (storageContext singleton), #5 (courseCache outside React)
> Module-level singletons prevent React from subscribing to changes and allow
> desync between courseId/slideId in props vs. storageContext.

- [ ] T645.1 — Audit all callers of `updateStorageContext()` and `getStorageContext()`
  to understand the full impact before changing anything
- [ ] T645.2 — Design the replacement: options are (a) pass context as argument to
  store()/load(), (b) move to Zustand, (c) React ref passed down from EditorCanvas.
  Document decision in `/decisions/YYYY-MM-DD-storage-context.md`
- [ ] T645.3 — Implement approved design for `storageContext`
- [ ] T645.4 — Implement approved design for `courseCache` — ensure React can react
  to cache invalidation (currently silent)
- [ ] T645.5 — Update all callers and tests
- [ ] T645.6 — Run full test suite + push + verify CI green
- [ ] T645.7 — Refine the generated code
- [ ] T645.8 — A reviewer will generate `docs/issues/issues-T645.md`; resolve before closing

---

### T646 — Fix initEditor leaks: cleanup dragstart listener and autosaveTimer

> **Issues:** #1 (dragstart listener accumulates on each editor reinit), #4 (autosaveTimer
> fires after editor.destroy()), #6 (_isEditorLoading outside React), #11 (document.body race)

- [ ] T646.1 — Export `cancelAutosave()` from `initEditor.ts` that calls
  `clearTimeout(autosaveTimer)` — allows EditorCanvas cleanup to cancel pending saves
- [ ] T646.2 — Call `cancelAutosave()` in EditorCanvas `useEffect` cleanup (Effect 1)
  before `editor.destroy()`
- [ ] T646.3 — Fix dragstart listener leak: store the handler reference and call
  `removeEventListener` in the cleanup path or when `initEditor` is called again
- [ ] T646.4 — Fix `document.body.removeChild(ghost)` race: use `ghost.isConnected`
  check instead of try/catch to safely remove the drag ghost
- [ ] T646.5 — Evaluate `_isEditorLoading` module flag: document why it cannot be
  moved to React/Zustand (timing constraints during loadData) or migrate it if feasible
- [ ] T646.6 — Unit tests: verify timer is cancelled on destroy, verify no duplicate
  dragstart handlers after multiple init/destroy cycles
- [ ] T646.7 — Run full test suite + push + verify CI green
- [ ] T646.8 — Refine the generated code
- [ ] T646.9 — A reviewer will generate `docs/issues/issues-T646.md`; resolve before closing

---

### T647 — Fix EditorCanvas pre-navigation store(): add UI state update

> **Issue:** #8 (editor.store() in saveAndLoad() does not update isSaving/setSaveError)
> Errors during pre-navigation save are silently swallowed — user sees no feedback.

- [ ] T647.1 — Add `setIsSaving(true)` / `setSaveError()` calls around the
  `editor.store()` call in `saveAndLoad()` — consistent with the autosave path
- [ ] T647.2 — Unit test: verify SaveErrorBanner state is set when pre-navigation
  store() fails
- [ ] T647.3 — Run full test suite + push + verify CI green
- [ ] T647.4 — Refine the generated code
- [ ] T647.5 — A reviewer will generate `docs/issues/issues-T647.md`; resolve before closing

---

### T648 — Fix Zustand/Backbone duality in all PropertiesPanel components

> **Issue:** #10 (selectedComponentType from Zustand + editor.getSelected() from Backbone
> can be out of sync by one render cycle)
> All panels have this duality. QuestionPropertiesPanel.tsx:509-511 already acknowledges it.

- [ ] T648.1 — Audit: document all panels where `selectedComponentType` (Zustand) and
  `editor.getSelected().get('type')` (Backbone) are both read and where a stale render
  could cause incorrect behaviour
- [ ] T648.2 — Define canonical approach: should panels use Zustand type for conditional
  rendering and Backbone for live data, or should Zustand be the single source? Document
  in `/decisions/YYYY-MM-DD-panel-selection-source.md`
- [ ] T648.3 — Implement approved approach consistently across all panels
- [ ] T648.4 — Unit tests: verify panels do not render stale data after rapid selection changes
- [ ] T648.5 — Run full test suite + push + verify CI green
- [ ] T648.6 — Refine the generated code
- [ ] T648.7 — A reviewer will generate `docs/issues/issues-T648.md`; resolve before closing

---

### T649 — Fix stale closure in QuestionPropertiesPanel updateOption

> **Issue:** #12 (ep.options from closure render — two rapid updateOption calls can
> lose one update)

- [ ] T649.1 — Replace `ep.options.map(...)` in `updateOption` with
  `getLatest().options.map(...)` — same fix applied in T639 for the parent patch
- [ ] T649.2 — Unit test: two rapid `updateOption` calls before next render →
  both changes present in final state (reproduces the race described in audit)
- [ ] T649.3 — Run full test suite + push + verify CI green
- [ ] T649.4 — Refine the generated code
- [ ] T649.5 — A reviewer will generate `docs/issues/issues-T649.md`; resolve before closing

---

### Phase 10 — Closing Tasks

- [ ] T1000.TEST — All Phase 10 unit tests pass; no regressions in existing suite
- [ ] T1000.E2E — Full E2E suite passes; Nav Buttons, widget rescale, and background
  bugs verified fixed manually (T290.TEST checklist items)
- [ ] T1000.DOCS — `WORKING_CONTEXT.md` updated; `GRAPESJS_REACT_PATTERNS.md` updated
  to reflect post-refactor state (remove all pre-TXX notes)

---

## TECH DEBT BACKLOG

### TD-001 — Backend export routes: extract shared `runExport()` helper
> **Source:** T635 review | **Priority:** Low — address when xAPI format support is implemented

The three POST routes `/courses/:id/export/scorm12`, `/export/scorm2004`, and `/export/aicc`
each duplicate ~70 LOC of identical logic. Extract a shared `runExport()` helper.
Adding a 4th format (xAPI) without this refactor would add another ~70 LOC of duplication.

### TD-002 — T641: preview feature needs full E2E test
> **Source:** T641 — T611.10 skip removed but full popup flow not E2E tested end-to-end

### TD-003 — T642/T643: known issues pending resolution
> **Source:** T642 (FLAKE-03 per-test course isolation) + T643 (forEach bugs — partially fixed)
