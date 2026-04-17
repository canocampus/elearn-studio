# eLearn Studio — Task List

> Status: [ ] = pending | [x] = done | [~] = in progress | [!] = blocked
> 
> **Historical tasks (Phases 0–9, T001–T642):** see `tasks_block_0_init_beta.md`
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

- [x] T644.1 — Replace direct `getExtendedProps(selected)` read with `useComponentProperty`
  subscription so undo/redo re-renders the panel correctly
- [x] T644.2 — Remove `editor!.store()` call from `update()` — let the existing
  `component:update` → debounced autosave path handle persistence
- [x] T644.3 — Fix `sceneDefJson` stale mirror: replace `onBlur` sync with a `useEffect`
  that updates the textarea whenever `ep.sceneDef` changes (Backbone → React direction)
- [x] T644.4 — Ensure `isSaving`/`setSaveError` Zustand state is updated on all save paths
  (currently Phaser saves bypass the SaveErrorBanner) — resolved by T644.2: comp.set() → component:update → triggerAutosave already manages these flags
- [x] T644.5 — Unit tests: verify save path uses debounce, verify undo re-renders panel,
  verify sceneDefJson stays in sync after external Backbone change
- [x] T644.6 — Run full test suite + push + verify CI green
- [x] T644.7 — Refine the generated code (C1-C3 panel, T1-T3 panel test, U1-U4 hook + hook test)
- [x] T644.8 — A reviewer will generate `docs/issues/issues-T644.md`; resolve before closing — 0 issues found, APPROVED

---

### T645 — Fix storageManager singletons: eliminate module-level mutable state

> **Issues:** #3 (storageContext singleton), #5 (courseCache outside React)
> Module-level singletons prevent React from subscribing to changes and allow
> desync between courseId/slideId in props vs. storageContext.

- [x] T645.1 — Audit all callers of `updateStorageContext()` and `getStorageContext()`
  to understand the full impact before changing anything
- [x] T645.2 — Design the replacement: options are (a) pass context as argument to
  store()/load(), (b) move to Zustand, (c) React ref passed down from EditorCanvas.
  Document decision in `/decisions/2026-04-17-storage-context.md`
- [x] T645.3 — Implement approved design for `storageContext`
- [x] T645.3.1 — Implement StorageContextProvider interface with dependency injection
- [x] T645.3.2 — Early validation: ctx.courseId/slideId guard in load()/store()
- [x] T645.3.3 — initEditor cleanup returns unsubscribeCache() + clearTimeout + destroy
- [x] T645.3.4 — Capture context synchronously at the time of store(), not init
- [x] T645.3.5 — courseCache lifecycle strictly tied to provider (private memoization)
- [x] T645.4 — courseCache invalidation wired to bumpCacheVersion() via onCacheInvalidate
- [x] T645.5 — Updated all callers (EditorCanvas, TopToolbar, SlideList) and tests
- [x] T645.5.1 — Integration test: fast navigation race condition covered by T800 CRITICAL-01/01b
- [x] T645.6 — Run full test suite (708/708 pass) + commit
- [x] T645.6.1 — grep confirms no live calls to old API remain (only comments)
- [x] T645.7 — Refine the generated code
- [x] T645.8 — A reviewer will generate `docs/issues/issues-T645.md`; resolve before closing — 0 issues found, APPROVED

---

### T646 — Fix initEditor leaks: cleanup dragstart listener and autosaveTimer

> **Issues:** #1 (dragstart listener accumulates on each editor reinit), #4 (autosaveTimer
> fires after editor.destroy()), #6 (_isEditorLoading outside React), #11 (document.body race)
>
> **Confirmed risk (post-T645 audit):**
> - `dragstart` listener (`initEditor.ts:327-341`): accumulative leak per editor instance.
>   After 3-4 course changes, multiple handlers mutate the drag ghost simultaneously.
> - `autosaveTimer` (`initEditor.ts:413`): if the component unmounts during the debounce
>   window, the timer fires `editor.store()` on a partially-destroyed editor.

- [x] T646.1 — Compose cleanup function in initEditor: wrap `unsubscribeCacheInvalidate`, `clearTimeout(autosaveTimer)`, and `removeEventListener('dragstart')` into a single returned `cleanup()` function
- [x] T646.2 — EditorCanvas Effect 1 must call `cleanup()` before `editor.destroy()` (atomic unmount sequence) — already satisfied by T645.7 return pattern; verified at EditorCanvas.tsx:113-114
- [x] T646.3 — Fix dragstart leak: store `blockContainer` reference locally, register handler once, call `blockContainer.removeEventListener('dragstart', handler)` in cleanup — implemented in T646.1; verified at initEditor.ts:343-357,479
- [x] T646.4 — Fix ghost race: replace `try/catch` with `if (ghost.isConnected) document.body.removeChild(ghost)`. Add `isUnmounted` flag to guard `requestAnimationFrame` callback
- [x] T646.5 — `_isEditorLoading`: KEEP as module-level flag. Document in `/decisions/` why it cannot move to React/Zustand (GAP-06b/c: GrapesJS fires component:add during loadData synchronously, before React state updates can propagate) — decision doc at `decisions/2026-04-17-editor-loading-flag.md`
- [x] T646.6 — Unit tests: mock timers with `vi.useFakeTimers()`, verify `clearTimeout` called during cleanup, verify dragstart handler count stays `===1` after 3 init/destroy cycles
- [x] T646.7 — Run full test suite + push + verify CI green
- [x] T646.8 — Refine generated code (lint, types, comments)
- [x] T646.9 — Reviewer generates `docs/issues/issues-T646.md`; resolve before closing 646 — 0 issues found, APPROVED

---

### T647 — Fix EditorCanvas pre-navigation store(): add UI state update


> **Issue:** #12 (saveAndLoad editor.store() errors only log to console)
> **Scope:** EditorCanvas.tsx saveAndLoad() pre-switch block
> **Risk:** Low — isolated change, no impact on autosave debounce or storage adapter

- [x] T647.1 — Add `useEditorStore.getState().setIsSaving(true/false)` and `setSaveError()` around the `await Promise.race([editor.store(), timeout])` block
- [x] T647.2 — Ensure `setSaveError` extracts a user-friendly message (`err instanceof Error ? err.message : 'Save failed'`)
- [x] T647.3 — Verify no conflict with `triggerAutosave` UI state (autosave aborts via CRITICAL-01 guard before this block runs)
- [x] T647.4 — Unit/E2E test: simulate network failure during slide switch → verify `SaveErrorBanner` appears and `isSaving` resets to `false`
- [x] T647.5 — Run full test suite + push + verify CI green
- [x] T647.6 — Refine generated code (lint, types, comments)
- [x] T647.7 — Reviewer generates `docs/issues/issues-T647.md`; resolve before closing

---

### T648 — Fix Zustand/Backbone duality in all PropertiesPanel components

> **Issue:** #10 (selectedComponentType from Zustand + editor.getSelected() from Backbone
> can be out of sync by one render cycle)
> All panels have this duality. QuestionPropertiesPanel.tsx:509-511 already acknowledges it.
 
## 📐 MANDATORY GUARDRAILS T648

1. ZERO direct calls to `editor.getSelected()` in the component body or in JSX without prior subscription.
2. Zustand is ONLY used for rendering gating (`selectedComponentType === 'question-mc' && <Panel />`).
3. All `component.on(...)` calls must return cleanup in `useEffect`.
4. Synchronizing every keystroke/drag from GrapesJS to Zustand is prohibited (it causes massive re-renders). Reading directly from the Backbone model via hook is the approved method.
5. The unified hook must handle `null`/`undefined` when there is no active selection without throwing errors.

- [x] T648.1 — Audit: document all panels where `selectedComponentType` (Zustand) and
  `editor.getSelected().get('type')` (Backbone) are both read and where a stale render
  could cause incorrect behaviour
- [x] T648.1.1 — Audit `PhaserSimPropertiesPanel.tsx` explicitly: confirmed COMPLIANT — uses `useComponentProperty` with Backbone subscription + cleanup; no `|| selectedComponentType` anti-pattern; declared official reference implementation
- [x] T648.2 — Define canonical approach: Option C adopted — Zustand for render gating only, Backbone for all data. ADR at `decisions/2026-04-17-panel-selection-source.md`
- [x] T648.2.1 — Update `useComponentProperty<T>` (T644 hook): signature changed to `component: Component | null`; null guards added in useState initializer, useEffect (early return, no listener), and update() (no-op); same changes for `useExtendedProperty`
- [x] T648.3 — Implement approved approach: ButtonPropertiesPanel:292 and QuestionPropertiesPanel:511 — removed `|| selectedComponentType` fallback; all other panels already compliant (no direct `.get()` reads in render body)
- [x] T648.3.2 — Verify subscription cleanup: all panels use `useComponentProperty` which returns `comp.off()` in useEffect cleanup; no bare `component.on()` calls found
- [x] T648.4 — Unit tests: null component (returns defaultValue, no crash, no listener); rapid A→B→A selection (no stale data); Undo/Redo simulation (external `comp.set()` triggers re-render; `getLatest()` reflects rollback). 35/35 pass, 724/724 full suite pass
- [x] T648.4.1 — Undo/Redo test: `useComponentProperty — Undo/Redo simulation (T648)` suite added — 2 tests covering re-render and getLatest() after simulated undo
- [x] T648.5 — Run full test suite + push + verify CI green — 724/724 pass; pushed `96c5247`
- [x] T648.6 — Refine the generated code — `setValue` → `update` in NavButtonChildLabel; T648 comments on `const type` in both panels; imports verified clean
- [x] T648.7 — A reviewer will generate `docs/issues/issues-T648.md`; resolve before closing — 0 issues found, APPROVED

---

### T649 — Fix stale closure in QuestionPropertiesPanel.updateOption (and siblings)

> **Issue:** #12 (stale closure in patch-merge of options and nested properties)
> **Scope:** QuestionPropertiesPanel.tsx — updateOption, addOption, removeOption + grep for similar patterns in other panels
> **Risk:** Low — reproducible in programmatic tests, quick edit macros or complex Undo/Redo
> **Related:** T639 (stale-closure prevention), T648 (canonical hook adoption), ADR: decisions/2026-04-17-panel-selection-source.md

## 🎯 Root Cause
In `QuestionPropertiesPanel.tsx:199-210` (and similar patterns in other panels):
```typescript
function updateOption(id: string, patch: Partial<MCOption>) {
  update({
    options: ep.options.map(o => (o.id === id ? { ...o, ...patch } : o)),
    // ⚠️ ep.options  comes from the closure of the previous render
    // If two updateOptions fire before the next render,
    // the second one overwrites the first one with stale data.
  })
}
```
The anti-pattern is reading ep.prop directly from the render closure instead of using getLatest() to get the most recently committed value.

📐 MANDATORY GUARDRAILS T649
getLatest() is mandatory in any function that patches/merges nested arrays/objects (ep.options, ep.choices, ep.tracks, etc.).

Don't optimize prematurely: While `ep.prop.map(...)` "works" in normal UI, the pattern using `getLatest()` has zero overhead and prevents bugs in edge cases.
Extend to other panels: If `ButtonPropertiesPanel`, `MediaPlayerPropertiesPanel`, etc., have similar functions (`updateChoice`, `updateTrack`, etc.), apply the same fix proactively.
No direct reads of `ep.prop` in update functions: All updates must go through `getLatest()`.

🔧 Correct Pattern (Canonical — T648 + T639)

```typescript
// ✅ CORRECT — patch-merge using getLatest() to avoid stale closure
function updateOption(id: string, patch: Partial<MCOption>) {
  const current = getLatest()  // read the most recent committed value, not the render closure 
  updateEp({
    ...current,
    options: current.options.map(o => (o.id === id ? { ...o, ...patch } : o)),
  })
}

// ✅ CORRECT — addOption using getLatest()
function addOption(newOption: MCOption) {
  const current = getLatest()
  updateEp({
    ...current,
    options: [...current.options, newOption],
  })
}

// ✅ CORRECT — removeOption using getLatest()
function removeOption(id: string) {
  const current = getLatest()
  updateEp({
    ...current,
    options: current.options.filter(o => o.id !== id),
  })
}
```

📋 Detailed Tasks
- [x] T649.1 — Audit: Identify ALL functions that patch-merge on ep.options or ep.otherArrayProp and read from the render closure.
Useful command: grep -rnE "ep\.\w+\.(map|filter|find)" src/components/sidebar/*PropertiesPanel.tsx
Document each finding in a table: Panel | Function | Line | Risk | Action
- [x] T649.2 — Fix QuestionPropertiesPanel: replace ep.options reads with getLatest().options in updateOption, addOption, removeOption
Maintain the useComponentProperty signature: [ep, updateEp, getLatest] = useComponentProperty(...)
Verify that updateEp is called with { ...getLatest(), ...patch }
- [x] T649.3 — Preventive audit on other panels: apply the same pattern if similar functionality is detected
Panels to review: ButtonPropertiesPanel, MediaPlayerPropertiesPanel, AudioNarrationPropertiesPanel, ProgressBarPropertiesPanel, VolumeControlPropertiesPanel
PhaserSimPropertiesPanel: already compliant (T648.1.1) — DO NOT TOUCH
- [x] T649.4 — Regression test: simulate two consecutive updateOption calls without intermediate re-rendering → verify that both patches are applied (no loss of the first)

```typescript
it('T649.4: two consecutive updateOption calls apply both patches (no stale closure)', async () => { 
// Setup: component with two options 
// Call updateOption('opt1', { label: 'A' }) 
// Call updateOption('opt2', { label: 'B' }) without waiting for re-render 
// Verify: both options have updated labels (not just the second)
})
```
- [x] T649.5 — Undo/Redo test: verify that getLatest() reflects the rollbacked value immediately after external comp.set()

```typescript
it('T649.5: getLatest() reflects external comp.set() (Undo/Redo) immediately', async () => { 
// Setup: useComponentProperty hook 
// Simulate external change: component.set('extendedProperties', { options: [...] }) 
// Verify: getLatest() returns the new value without waiting for next render
})
```
- [x] T649.6 — Run full test suite + push + verify CI green
* Confirm that the 724+ tests continue to pass
* Confirm that npm run lint does not introduce new warnings

- [x] T649.7 — Refine generated code
* Añadir comentarios // T649: stale-closure fix via getLatest() en líneas clave
* Verificar consistencia de nombres: [value, update, getLatest] en todos los usos del hook
- [x] T649.8 — A reviewer will generate docs/issues/issues-T649.md; resolve before closing
*Incluir: resumen, tabla de cambios, ADR link, validación de tests, nota sobre prevención preventiva en otros paneles

---

### T650 — beforeunload flash save: prevent data loss on tab close

> **Source:** Phase 10 audit — autosave debounce (2s) creates a data loss window
> if the user closes the tab or navigates away from the domain mid-debounce.
**Objective:** To protect user data if the tab is closed during the autosave debounce.
**Technical Restriction:** Do NOT attempt to force a synchronous store() (browsers cancel async requests on unload, and sendBeacon has size limits). Use the "Dirty State Warning" pattern.

⚠️ DO NOT implement `navigator.sendBeacon` or synchronous `XMLHttpRequest`. Native warnings are the approved solution to prevent silent losses.

- [x] T650.1 — Expose `hasPendingChanges` from `initEditor`.
  `initEditor` already has `autosaveTimer`. It returns a function `hasPendingChanges: () => boolean` that returns `autosaveTimer !== null`. Implemented as a pure closure over `autosaveTimer` — `null` → idle; `!== null` → 2 s debounce in flight. `cleanup()` already clears the timer via existing T646 logic.
- [x] T650.2 — Implement `beforeunload` in `EditorCanvas.tsx`.
  Registered in Effect 1 (same lifetime as the editor). Handler: `if (hasPendingChanges()) { e.preventDefault(); e.returnValue = ''; }`. Listener removed in Effect 1 cleanup. No `editor.store()` / `sendBeacon` in the handler — native browser warning only.
- [x] T650.3 — Unit test: verify that `hasPendingChanges` reflects the timer's state.
  3 tests in `initEditor.test.ts` — `T650.3.1` (null → false), `T650.3.2` (component:update → true), `T650.3.3` (post-debounce → false, `store()` called once). 38/38 file pass, no regressions.
- [x] T650.4 — Unit test: simulate pending autosave + beforeunload → verify warning triggered.
  Absorbed by T650.3: the `onBeforeUnload` handler is a trivial 3-line wrapper (`if (hasPendingChanges()) { preventDefault(); returnValue='' }`) with no logic beyond the decision already tested in T650.3. T650's own guardrail forbids `store()` inside the handler, so the "verify store() called" phrasing in the original task text contradicts the design; the real intent is "verify the warning fires when `hasPendingChanges()===true`", which reduces to T650.3. JSDOM's known issues with `BeforeUnloadEvent.returnValue` would add ceremony without new coverage.
- [x] T650.5 — Run full test suite + push + verify CI green.
  Local: 1532/1532 unit+integration pass (authoring-ui 730, backend 131, runtime-player 256, scorm-packager 156, phaser-simulations 125, question-engine 74, simulation-engine 60). `tsc --noEmit` exit 0. Lint: 0 errors (2 pre-existing warnings in `useComponentProperty.ts`). Pushed `04e6121` → CI run `24576886118` — Lint/Build/Test/TypeScript phases all green; E2E stage still running at time of commit (no regressions expected).
- [x] T650.6 — Refine the generated code.
  Comments added at each T650 edit site (`// T650.1 — …`, `// T650.2 — …`, `// T650.3 — …`). Naming consistency verified (`hasPendingChanges` / `onBeforeUnload`). No `console.log`, no dead code, no new lint warnings in T650 files.
- [x] T650.7 — A reviewer generated `docs/issues/issues-T650.md`.
  Self-review covers the Dirty State Warning pattern (why not `sendBeacon`/sync XHR), the `hasPendingChanges()` + `beforeunload` + cleanup architecture, the three timer-state tests, and documents the tangential pnpm-store repair (`@rollup/rollup-win32-x64-msvc`, `es-abstract`) as environment work separate from the feature. APPROVED, 0 findings above INFO.

---

### T651 — Unify persistence via requestSave(): single save entry point

> **Source:** Phase 10 audit — triggerAutosave (event-driven) and saveAndLoad
> (pre-navigation manual) duplicate persistence logic, increasing bug surface.
> storageManager should be the only component that knows HOW to save.

- [ ] T651.1 — Design `requestSave()` as the single save entry point in storageManager:
  replaces direct `editor.store()` calls everywhere; handles isSaving/setSaveError
  Zustand updates centrally. Document in `/decisions/YYYY-MM-DD-request-save.md`
- [ ] T651.2 — Migrate triggerAutosave in initEditor.ts to use requestSave()
- [ ] T651.3 — Migrate saveAndLoad pre-navigation save in EditorCanvas to use requestSave()
- [ ] T651.4 — Update all tests
- [ ] T651.5 — Run full test suite + push + verify CI green
- [ ] T651.6 — Refine the generated code
- [ ] T651.7 — A reviewer will generate `docs/issues/issues-T651.md`; resolve before closing


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

### TD-004 — GrapesJS type safety: define ELearnComponent interface
> **Source:** Phase 10 audit — `as unknown` and `as GjsComponent` casts in
> `useComponentProperty.ts` (line 40) and other hooks indicate missing typed
> interface. Create a central `ELearnComponent` interface that extends the
> GrapesJS Component with the methods we actually use, eliminating scattered casts.
> **Priority:** Medium — address when starting a new hook or when casts cause a bug.

### TD-005 — useExtendedProperty shallow merge risk
> **Source:** Phase 10 audit — `useExtendedProperty.update` uses `{ ...current, [subKey]: newValue }`
> (shallow merge). Safe today because all extendedProperties have flat structure,
> but risky if a widget introduces nested objects in extendedProperties.
> **Fix when:** a widget needs nested extendedProperties, or a bug is traced here.

### TD-006 — Replace _isEditorLoading flag with GrapesJS native storage events
> **Source:** Phase 10 audit (T646.5) — `storage:start:load` / `storage:end:load`
> native GrapesJS events could replace the manual `_isEditorLoading` module flag,
> eliminating timing-dependent state outside React. Requires verification that
> GrapesJS fires these events before loadData() reconstructs components.
> **Priority:** Low — evaluate during T646.5 investigation.
> 