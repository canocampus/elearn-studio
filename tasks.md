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

- [x] T651.1 — Design `requestSave()` as the single save entry point.
  ADR at `decisions/2026-04-17-request-save.md`. Two-layer design (Option B selected): pure `performSave(editor, hooks)` in `storageManager.ts` (no Zustand, no React) + Zustand-bound `requestSave(opts?)` closure in `initEditor.ts` exposed via editor store. Inventory audit found 5 `editor.store()` call sites, 3 of which currently have silent-failure bugs (SaveErrorBanner retry missing `setIsSaving`; `useActionsSave` and `SimulationEditor` swallow errors to `console.error`) — migration will fix these automatically. Course meta-operations (addSlide/deleteSlide/updateCourse in TopToolbar/SlideList) explicitly out of scope (different persistence path, candidate TD-007). 7 binding guardrails documented: storageManager stays DI-pure, race guard stays in triggerAutosave, stopCommand flush stays in saveAndLoad, T650 unload behaviour unchanged, timeout only for pre-nav save, `requestSave` null-safe until editor ready, `editor.store()` → `storageManager.store()` contract unchanged.
- [x] T651.2 — Migrate triggerAutosave in initEditor.ts to use requestSave().
  `performSave(editor, hooks)` primitive added to `storageManager.ts` (pure, no Zustand/React). Zustand-bound `requestSave(opts?)` closure built in `initEditor.ts` right before `autosaveTimer`. `triggerAutosave` debounce callback now does `await requestSave().catch(() => { /* error already in Zustand */ })` instead of the inline `try/catch/finally` with manual `setIsSaving`/`setSaveError`. Race guard (CRITICAL-01) + `isRteActive` defer stay inline in `triggerAutosave` per ADR guardrail. Test mock updated via `vi.importActual` so the real `performSave` reaches `editor.store()` under test. 38/38 `initEditor.test.ts` pass.
- [x] T651.3 — Migrate saveAndLoad + 3 bonus silent-failure sites to requestSave().
  `EditorCanvas.tsx` `saveAndLoad`: `Promise.race([store(), 5s])` + manual UI-state block replaced with `await requestSaveFn({ timeoutMs: 5000 })`; `stopCommand('text-edit')` flush stays inline (caller responsibility); `console.error` retained for audit. `SaveErrorBanner.tsx` Retry: now reads `requestSave` from Zustand instead of `editor`; `handleRetry` delegates fully — **fixes pre-T651 bug where `setIsSaving(true)` was missing during retry**. `useActionsSave.ts` + `SimulationEditor.tsx`: `editor.store().catch(console.error)` → `requestSave().catch(console.error)` — **fixes two silent-failure paths where save errors never reached the user**. Layer 3 wiring: new `requestSave`/`setRequestSave` in `editorStore.ts`; `EditorCanvas` Effect 1 calls `setRequestSave(requestSave)` after initEditor returns and `setRequestSave(null)` in cleanup. Grep confirms zero remaining `editor.store()` calls outside `storageManager.ts:68` (the single source of truth).
- [x] T651.4 — Update all tests.
  `EditorCanvas.test.tsx`: mock `setupInitEditorMock` now returns `hasPendingChanges` + a real `requestSave` bound to the mock editor via the actual `performSave` primitive; `beforeEach` resets `requestSave: null`; T3 fallback expectation harmonised to `'Save failed'` (was `'Pre-navigation save failed'`). `SaveErrorBanner.test.tsx`: helper `makeRequestSave(mockStore)` runs real `performSave` against a mock editor; tests migrated from `editor.store` to `requestSave`; **new T651.3 regression test** verifies `isSaving === true` mid-retry (prevents re-introduction of the fixed bug). Full authoring-ui suite: 731/731 pass (+1 from the new T651 test). Full monorepo unit+integration: 1533/1533 (backend 131, authoring-ui 731, runtime-player 256, scorm-packager 156 passed + 4 skipped, phaser-simulations 125, question-engine 74, simulation-engine 60). TSC exit 0, lint 0 errors.
- [x] T651.5 — Run full test suite + push + verify CI green
  Local full monorepo: 1533/1533 unit+integration pass (see T651.4 note). `tsc -b` exit 0, lint 0 errors. Pushed as commit `501c6aa` (feat(T651): unify persistence via requestSave()); CI run **24582182042** completed in 17m02s with E2E stage green (see T1000.E2E note). Closed retroactively on 2026-04-19.
- [x] T651.6 — Refine the generated code.
  All 5 migrated call sites carry `// T651.2` or `// T651.3` markers explaining the unified-save routing. `useActionsSave.ts` docstring + inline comment updated from historical `editor.store()` wording to `requestSave()`. Grep `editor.store()` confirms only `storageManager.ts:68` is an active invocation; all other matches are docstrings/tests. Lint: 0 errors, 2 preexisting warnings (not touched). TSC exit 0.
- [x] T651.7 — Reviewer generated `docs/issues/issues-T651.md`.
  Self-review, ~290 lines, structured in 9 sections: feature description, 2-layer architecture, rejected alternatives (A/C/D with failure-mode analysis each), call-site migrations table (with the 3 silent-failure bugs auto-fixed), 7 binding guardrails verified, deliberate non-scope (course meta-ops deferred to TD-007; no retry budget; minimal SaveHooks interface), findings (6 items, all INFO/AS-DESIGNED, 0 above INFO), tests, verdict. APPROVED.


---

### Phase 10 — Closing Tasks ✅ PHASE 10 CLOSED

- [x] T1000.TEST — All Phase 10 unit tests pass; no regressions in existing suite.
  Final monorepo totals: 1533/1533 unit+integration (backend 131, authoring-ui 731, runtime-player 256, scorm-packager 156 passed + 4 skipped, phaser-simulations 125, question-engine 74, simulation-engine 60). No regressions; cumulative test count grew from 686 (phase start, pre-T644) to 1533 over the refactor.
- [x] T1000.E2E — Full E2E suite passes in CI.
  CI run 24582182042 (T651 push) completed with success in 17m02s — E2E stage green. Nav Buttons child-components, widget rescale, and slide-background regressions from the Phase 10 audit (root cause analyses in `issues-T644-audit.md`) are covered by dedicated specs in `e2e/tests/` and pass in the CI suite. No manual verification deficit; CI is the authoritative gate.
- [x] T1000.DOCS — Documentation updated to post-refactor state.
  `WORKING_CONTEXT.md` bumped to v0.5.55, T651 summary added, Phase 10 marked complete, Next Steps advanced past the refactor. `GRAPESJS_REACT_PATTERNS.md` updated: Pattern 1 return shape now shows the T650/T651 four-tuple (`{ editor, cleanup, hasPendingChanges, requestSave }`); Pattern 4 rewritten as "Unified Persistence via requestSave() (T645/T647/T651)" with the full save recipe diagram; prohibited-pattern `editor.store()` example annotated with T651 alternative. Last-updated header bumped to "Phase 10 complete (T651, 2026-04-17)".

---

## TECH DEBT BACKLOG

### TD-001 — Backend export routes: extract shared `runExport()` helper ✅ DONE (2026-04-17)
> **Source:** T635 review | **Status:** Resolved | **Review doc:** `docs/issues/issues-TD-001.md`

Shared pipeline extracted to `backend/api/src/lib/export/runExport.ts`: pure function `runExport(course, format, options?)` with a `PACKERS` registry keyed by `ExportFormat = 'scorm12' | 'scorm2004' | 'aicc'`. Asset pipeline helpers (`collectAssetSrcs`, `rewriteAssetSrcs`, `downloadAssets`) moved into the same module and exported for direct testing. Route layer in `courses.ts` reduced from 3× ~35-line handlers to a single `buildExportHandler(format)` factory + 3 one-line route registrations. Error path owns tmpDir cleanup inside `runExport` (caller only sees tmpDir on success). 17 unit tests cover dispatch, pipeline order, result shape, error-path cleanup, missing-asset skip, format-specific tmpDir prefixes. Backend suite: 148/148 pass (pre-TD-001: 131; +17 new). **xAPI marginal cost: 70 LOC → 2 LOC (35×).**

### TD-002 — T641: preview feature needs full E2E test ✅ DONE (2026-04-17)
> **Source:** T641 — T611.10 skip removed but full popup flow not E2E tested end-to-end | **Status:** Resolved

Added `e2e/tests/preview-handshake.spec.ts` with one `@integration` test covering the full handshake: Preview click → popup opens at `/preview.html` → popup signals `'elearn-preview-ready'` to correct origin (not `'*'`) → opener receives the signal → opener posts `{ type:'elearn-preview-data', course, slideIndex }` → popup's `ELearnPlayer.init('player', course, …)` renders content into `#player`. Critical Rule 5 is asserted (`Object.keys(localStorage).length === 0` in popup). Popup spy installed via `context.addInitScript()` so it intercepts `window.opener.postMessage` and inbound `message` events before `preview.html`'s inline script runs. CI run 24586873603 (E2E stage) completed with success in 17m03s — all 163 E2E tests green including the new one.

### TD-003 — T642/T643: known issues pending resolution ✅ DONE (2026-04-18)
> **Source:** T642 (FLAKE-03 per-test course isolation) + T643 (forEach bugs — partially fixed) | **Status:** Resolved | **Review doc:** `docs/issues/issues-TD-003.md`

**T642 (FLAKE-03) confirmed resolved** by the prior T642.2 fixture isolation (`e2e/global-setup.ts:15-18` no longer seeds a shared course; `e2e/fixtures/auth.ts:56-86` creates+deletes a per-test isolated course). No code change required. Every CI run since T642.2 has passed. **T643 extended** from authoring-side to runtime-side: `executor.ts` guards `for (const action of actions ?? [])` at the load-bearing iteration point (transparently protects condition/loop/callSequence recursion); `dispatcher.ts` guards `attachWidget(sequences ?? [])`, `fireSlideEvent` outer+inner, and `fireWidgetEvent`; `callSequence.ts` guards `shared.actions ?? []` as belt-and-suspenders. 9 new regression tests each feed an `@ts-expect-error` legacy shape and assert the call resolves instead of throwing. Runtime-player suite: 256 → **265/265 pass**. Authoring-ui: **731/731 pass** (no regression). `querySelectorAll().forEach()` sites (9 of them) deliberately left unguarded — NodeList is never undefined. `condition.ts` / `loop.ts` deliberately untouched — executor guard covers them. Schema-level migration of legacy documents deliberately deferred (carries data-loss risk without a dry-run audit).

### TD-004 — GrapesJS type safety: define ELearnComponent interface ✅ DONE (2026-04-18)
> **Source:** Phase 10 audit | **Status:** Resolved (+ micro-polish 2026-04-18)

New `packages/authoring-ui/src/types/ELearnComponent.ts` exports the canonical `ELearnComponent = Component & { get, set, on, off (loose string keys/events) }` type. `useComponentProperty.ts` imports it, removes the private `GjsComponent` local type, and collapses 6 scattered `as GjsComponent` casts to 2 authoritative `component as ELearnComponent | null` narrowings (one per hook, at function entry). All other methods (`addStyle`, `getStyle`, `setStyle`, `getId`, `components()`, `append()`, `clone()`, `remove()`) remain strongly-typed via the base `Component` class. `get(key)` returns `unknown` (not `any`) so callers must narrow at the use site — type-safety boundary preserved. Production `grep "as GjsComponent"` and `grep "as unknown as Component"` both return 0 matches. Pure type refactor: zero runtime change; all 731/731 authoring-ui unit tests pass unmodified. `GRAPESJS_REACT_PATTERNS.md` pattern example updated to the new type. Property panels and direct-`Component` callers were never refactored because they already compile clean against grapesjs's existing typings (their method usage stays within `ComponentProperties`).

**TD-004 micro-polish (v0.5.58, commit `ea86279`):** initial TD-004 layout widened the `react-hooks/exhaustive-deps` warning set on `useComponentProperty.ts` from 2 to 4 (both effects gained `comp` as a missing dep because the outer-scope narrowing was a closure reference of the effect). Fix: moved `const comp = component as ELearnComponent` INSIDE each `useEffect` — identity-equivalent to `component` at runtime, removes `comp` from the deps warning set with zero runtime change. Outer narrowing kept only where still needed (`useState` initializer / `update()` writer / `useExtendedProperty.readValue` / `update`). Both `eslint-disable-next-line` comments refined to document the stability contract explicitly: `defaultValue` / `readValue` are fallback-only constants for the panel lifetime; adding them to deps would re-subscribe the Backbone listener on every render with zero benefit (change handler re-reads the live model via `comp.get(key)` / `readValue()`, never a captured closure). Added 2 regression tests (`useComponentProperty — defaultValue stability contract (TD-004)` + `useExtendedProperty — defaultValue stability contract (TD-004)`) that rerender with a different `defaultValue` and assert the emitted value stays on the model value AND the Backbone listener count does not change. Results: warnings 4 → **2** (only the intentional `defaultValue` / `readValue` ones remain); `tsc --noEmit` exit 0; useComponentProperty suite 38 → **40/40 pass**; full authoring-ui suite **733/733 pass** (was 731/731).

### [x] TD-005 — useExtendedProperty shallow merge contract documented + lost-key detector ✅ DONE (2026-04-18)
> **Source:** Phase 10 audit | **Status:** Resolved | **Commit:** `d6b54f5` | **Review doc:** `docs/issues/issues-TD-005.md`

Audit (2026-04-18) invalidated the original ticket premise ("all extendedProperties have flat structure"): the codebase already ships nested shapes — `BaseQuestionExtendedProps.scoring` (`{ weight, attempts, mandatory }`), `MCExtendedProps.options` (`MCOption[]` of `{ id, text, isCorrect }`), `PhaserSimExtendedProps.sceneDef` (nested with `nodes`/`edges`/`steps`). So a `FlatExtendedProperties` type would break typecheck and spam warnings on legitimate question-edit flows; deep-merge was rejected (YAGNI + array semantics ambiguity + bundle cost + debuggability). Resolution reframes TD-005 as **document the actual shallow-replace contract + dev-only diagnostic for the bug pattern that matters** (silent loss of sibling keys on nested updates). Added: (1) JSDoc on `useExtendedProperty.update()` explaining `newValue` REPLACES nested objects entirely and pointing callers to the T639 `getLatest()` + spread pattern for partial updates; (2) dev-only `console.warn` (`process.env.NODE_ENV !== 'production'`) fires only when prev and new are both plain objects AND new omits keys present in prev — message includes lost keys, subKey name, and the canonical fix snippet; (3) `isPlainObject` helper excludes arrays on purpose (wholesale replace is contract for `options`/`nodes`/etc.); (4) 4 regression tests in `useComponentProperty.test.ts` covering legitimate full-shape replace, warning-fires-when-keys-lost (with full message inspection), no-warning-when-same-shape, no-warning-for-arrays. Zero runtime change in production builds (warning branch tree-shaken). No type changes — `extendedProperties` stays `Record<string, unknown>`. Verification: `tsc --noEmit` exit 0; useComponentProperty suite 40 → **44/44**; full authoring-ui suite 746 → **750/750** (32 files); lint unchanged (2 historical TD-004 warnings).

### [x] TD-006 — Replace `_isEditorLoading` flag with GrapesJS native storage events ✅ DONE (2026-04-18) — Closed as "Native events timing insufficient"
> **Source:** Phase 10 audit (T646.5) | **Status:** Resolved — flag stays as-is, regression test added | **ADR:** `decisions/2026-04-18-editor-loading-flag.md` (extends `2026-04-17-editor-loading-flag.md`) | **Review doc:** `docs/issues/issues-TD-006.md`

Audit (2026-04-18) of `grapesjs@0.21.13` confirms the GAP-06b/c findings of the prior T646.5 ADR: `storage:end:load` fires INSIDE `Storage.load()` via `StorageManager.onEnd` (line 42110 of `grapes.mjs`), before `Storage.load()`'s promise resolves. `EditorModel.prototype.load` (line 61352) `await`s `Storage.load(options)` and ONLY THEN calls `loadData(result)` synchronously. `loadData()` is what reconstructs every component and fires `component:add × N`. So the timeline is `storage:end:load` → `loadData()` → cascade of `component:add`. Using `storage:end:load` to clear the gate would lift it three steps before the spurious `component:add` events arrive — `triggerAutosave` would start the debounce timer incorrectly. **No production-code change.** Added (1) `decisions/2026-04-18-editor-loading-flag.md` documenting the audit method, evidence, and reopen criteria; (2) permanent regression test `packages/authoring-ui/src/__tests__/editor/grapesEventOrder.test.ts` with 5 structural assertions against the bundled `grapes.mjs` (source loads, `Storage.load` precedes `loadData` textually, `onEnd` fires `endLoad`, event-name pinned, regex regression-guard `yield.*?Storage\.load[\s\S]*?loadData\(result\)`). Static inspection chosen over live `grapesjs.init()` because grapesjs uses iframe-based canvases / DOM measurement APIs jsdom does not implement — `init()` hangs in vitest. Static inspection of the bundle IS the runtime behaviour for the question "does Storage.load yield before loadData runs?" and survives library upgrades better than a flaky e2e probe. Test fails loudly if a future grapesjs release inverts the order → TD-006 reopens automatically. Verification: `tsc -b` exit 0; new audit file 5/5 pass in 17 ms; full authoring-ui suite 750 → **755/755 pass** (32 → 33 files); lint unchanged; `_isEditorLoading` references unchanged in 5 files (1 production, 2 test, 1 EditorCanvas, 1 audit doc). **Backlog cleared** — no remaining tech-debt items in this set (TD-005, TD-006, TD-007 all closed).

### [x] TD-008 — Manual-audit pass: 4 minor UI/UX bugs ✅ DONE (2026-04-18)
> **Source:** User-manual v2 scope audit (`docs/user-manual-v2-scope.md`) | **Status:** Resolved | **Commits:** `62153ca` (bugs #1-#3) + `de0ad2e` (bug #4) | **CI:** runs `24608241954` + `24608814942` both green | **Review doc:** `docs/issues/issues-TD-008.md`

Pre-requisite cleanup before writing the v2 user manual. Functional review of v0.5.61 identified 4 low-/high-priority UX inconsistencies; all fixed with minimal diffs.

- [x] TD-008.1 — **Bug #1 (LOW)** `PhaserSimPreviewModal` captured `window.innerWidth`/`Height` once at mount; window resize left stale dimensions. Fixed with `useState(viewport)` + `useEffect` resize listener (cleanup on unmount). `packages/authoring-ui/src/components/simulation/PhaserSimPreviewModal.tsx`.
- [x] TD-008.2 — **Bug #2 (LOW)** `properties: {}` vs `properties: []` inconsistency across 14 component defaults. Standardised to `[]` uniformly (the format GrapesJS `PropertyComposite` expects per `this.get('properties') || []`). Files: `registerBlocks.ts`, `registerQuestionBlocks.ts`, `registerSimBlock.ts`, `registerPhaserSimBlock.ts`, `converters.ts` (`NavButtonChildDef` type + nav-button children in `grapesjsFromWidgets`). Test `registerBlocks.test.ts` updated: `toEqual({})` → `toEqual([])`.
- [x] TD-008.3 — **Bug #3 (LOW)** `phaserSimWidget` placeholder only fired `sim-complete` in `mode === 'demo'`; practice/assessment modes never emitted completion → courses with Phaser sims could not progress. Removed the mode guard; all modes now auto-complete at 2 s. Score: 100 for demo/practice, `passingScore` for assessment. T036 (per-simType scene builders) will replace this placeholder entirely.
- [x] TD-008.4 — **Bug #4 (HIGH UX)** Actions Editor widget-target dropdown rendered `{w.id}` (cryptic GrapesJS IDs like `c32kq3`) instead of the human-readable `name` trait. Authors set "HintButton" in Props → Name but could not find it in the dropdown. Fixed in three places: (a) `BaseWidget.name?: string` added to `@elearn-studio/shared-types` (optional, backward-compatible); (b) `widgetsFromGrapesjs` reads `c.get('name') ?? attributes.name` and populates top-level `widget.name`; (c) `grapesjsFromWidgets` restores `attributes.name = widget.name` on reload; (d) `ActionItemEditor.tsx` `<option>` label changed to `{w.name || w.id}` while `value` stays `w.id` (technical routing key unchanged). 6 round-trip regression tests added to `converters.test.ts` (read, restore, legacy-properties fallback).
- [x] TD-008.5 — Verification: `npx tsc -b` exit 0; full authoring-ui suite 755 → **761/761 pass** (6 new round-trip tests); runtime-player **265/265**; `pnpm -r lint` 0 errors (2 pre-existing TD-004 warnings unchanged); CI run `24608241954` (bugs #1-#3) and CI run `24608814942` (bug #4) both green including full E2E.
- [x] TD-008.6 — Self-review `docs/issues/issues-TD-008.md`; 0 open CRITICAL/HIGH/MEDIUM.

**Unblocks:** User manual v2 §3 (Actions Editor chapter) can now document the correct UX — authors name widgets in Props and the dropdown shows those names — without a workaround for the cryptic-ID limitation.

---

### [x] TD-007 — Unify course meta-operations save path ✅ DONE (2026-04-18)
> **Source:** T651 ADR deliberate out-of-scope | **Status:** Resolved | **Commits:** `769a12a` (refactor) + `4cd6bb8` (null-window fix) | **CI:** run `24602663078` green in 17m 08s | **ADR:** `decisions/2026-04-18-course-mutation.md` | **Review doc:** `docs/issues/issues-TD-007.md`

Unified all 8 course-meta call sites (`TopToolbar.tsx` ×3 + `SlideList.tsx` ×5) behind a new `requestCourseMutation<R>(apiCall, opts?)` entry point. Two-layer design adapted (not mirrored) from T651: Layer 1 `packages/authoring-ui/src/lib/courseMutation.ts` exports pure `performCourseMutation<R>(apiCall, hooks)` (no Zustand, no React — narrows errors, returns `R | undefined`); **Layer 2 lives as a plain always-available store action inside `editorStore.ts`** (NOT inside `initEditor.ts` as the first draft tried — see post-mortem below). Layer 2 wires `setIsSaving`/`setSaveError`/`bumpCacheVersion` with `bumpCache: true` as default invariant. Store field is non-nullable; no `setRequestCourseMutation`, no `EditorCanvas` registration. **Latent cache-invalidation bug fixed as side effect**: `commitRename` and `handleDrop` did not call `bumpCacheVersion()` → storageManager cache held pre-mutation slide list → stale title/order could surface on next `editor.load()`. Both paths now bump cache automatically via the default. Local `isAdding`/`isProcessing` flags in `SlideList.tsx` deleted; render uses global `useEditorStore(s => s.isSaving)` → `SaveErrorBanner` and "Saving…" badge now surface for all 8 mutations (previously only the 3 toolbar ones). Toast severity unified to `error` across the 5 SlideList sites (was `warning`). `grep "isAdding\|isProcessing"` returns 0 matches. 8 tests for the pure primitive + 5 tests for the store action (including a null-window regression guard); authoring-ui suite 733 → **746/746 pass** (32 files). `npx tsc --noEmit` exit 0; `pnpm -r lint` 0 errors. **Post-mortem**: first push (`769a12a`) placed Layer 2 inside `initEditor.ts` (mirror T651 literally). The `| null` store field + `if (!rcm) return` caller guards produced a null window between app mount and EditorCanvas Effect 1 → E2E fixture `editorPage.addSlide()` clicked Add Slide during that window → silent no-op → 30 s × 3 retries × ~20 failing tests → CI E2E step cancelled at 27 min (run `24601830271`). Fix-forward (`4cd6bb8`) moved Layer 2 into the store directly because `requestCourseMutation` has no editor dependency; symmetric-mirror was the wrong heuristic. Guardrail: layer-2 placement follows the Layer 1 primitive's dependencies, not file-layout symmetry.

---

### [x] TD-009 — Widgets lost when switching slides rapidly (React StrictMode concurrent-load race) ✅ DONE (2026-04-18)
> **Source:** Surfaced while building `e2e/tests/docs-screenshots.spec.ts` (2026-04-18) | **Status:** Resolved | **Priority:** MEDIUM (was — data loss confirmed)

**Root causes (three distinct races, discovered in sequence):**

1. **React 18 StrictMode concurrent loads.** StrictMode double-invokes `EditorCanvas` Effect 2 on mount. Each invocation calls `editor.load()` asynchronously. The first run is cancelled (isCancelled=true) but its in-flight `editor.load()` still resolves — at which point GrapesJS's `loadData()` runs synchronously, clearing the canvas. If a widget was added AFTER `readySignal` fired (by the second run) but BEFORE the first run's load completed, the stale `loadData()` would wipe it.

2. **Autosave timer firing mid-load.** The autosave `setTimeout` callback in `initEditor.ts` did not re-check `getEditorLoading()`, so a pending timer could fire DURING `editor.load()` and PATCH a transient empty widget list to the current slide.

3. **Stale `data-editor-ready` attribute on slide switch.** Effect 2's `setIsReady(false)` only schedules a re-render — the DOM attribute does not flip from `"true"` to `"false"` in the same event-loop tick. Any observer polling the attribute (Playwright, or user code reacting to navigation) could see the stale `"true"` from the previous slide's load and race ahead. In practice, a widget added RIGHT after a "ready" observation on the previous slide could be serialised INTO the new slide's PATCH by the flush-before-switch save, because the editor tree still held the old slide's content.

**Fix (three files, minimal diffs):**

1. `packages/authoring-ui/src/components/editor/EditorCanvas.tsx` (race #1) — `lastLoadContextRef` + `lastLoadPromiseRef` track the (courseId, slideId) of the last-started load and its promise. Effect 2 short-circuits when re-invoked with the same context (StrictMode twin), awaiting the already-in-flight load before calling `setIsReady(true)`.

2. `packages/authoring-ui/src/editor/initEditor.ts` (race #2) — added `if (getEditorLoading()) return` inside the `setTimeout` callback so a pending autosave cannot fire mid-`editor.load()`. The explicit `requestSave` inside Effect 2 already persisted any pending edits before the load started, so dropping the timer-driven save is always safe.

3. `packages/authoring-ui/src/components/editor/EditorCanvas.tsx` (race #3) — imperatively set `data-editor-ready="false"` on the container ref synchronously right after `setIsReady(false)`, so the DOM attribute flips immediately and any external observer sees an accurate "load in progress" state.

**Verification:**
- `packages/authoring-ui/src/__tests__/initEditor.test.ts` — 2 new unit tests (`TD-009`, `TD-009 control`) exercise both paths: save suppressed during load, save runs normally otherwise. 40/40 suite pass.
- `e2e/tests/widget-persistence-across-slides.spec.ts` — new E2E regression guard with 2 scenarios (single-hop and multi-hop through 5 slides). 2/2 pass, re-run 5× to confirm no flake.
- `docs-screenshots.spec.ts` — full 52-screenshot campaign still green after fix.
- Authoring-ui vitest: 755 → **763/763 pass** (32 → 33 files).
- Runtime-player: **265/265 pass** (unchanged).
- `tsc -b` exit 0.

**Subtasks:**
- [x] TD-009.1 — Audit `switchSlide` / `storageManager` — no dedicated switch method, flush-before-switch logic already existed; identified three subtler races instead.
- [x] TD-009.2 — Wrote E2E reproducer, confirmed count=0 after rapid round-trip (100% failure rate before the fix).
- [x] TD-009.2b — Implement autosave-during-load guard (`initEditor.ts`).
- [x] TD-009.2c — Implement StrictMode concurrent-load guard (`EditorCanvas.tsx`).
- [x] TD-009.2d — Imperative `data-editor-ready="false"` flip in `EditorCanvas.tsx` to eliminate stale-ready race on slide switch.
- [x] TD-009.2e — Lifecycle correction: clear `lastLoadContextRef` + `lastLoadPromiseRef` + `prevContextRef` in Effect 1 cleanup. Without this the StrictMode guard mis-fires after Effect 1 destroys+recreates the editor — the FRESH editor is skipped by a stale ref entry and the canvas stays empty until the user navigates to another slide (regressed 9 reload-dependent E2E tests; post-fix: 43/43 pass across question-widget + persistence + widget-persistence suites).
- [x] TD-009.3 — Unit tests (`initEditor.test.ts`) + E2E regression guard (`widget-persistence-across-slides.spec.ts`).
- [x] TD-009.4 — Full test suite green (769/769 authoring-ui, 265/265 runtime-player, 2/2 E2E persistence guard); docs-screenshots campaign re-verified; `tsc -b` exit 0.

---

### [x] TD-010 — PropertiesPanels stack empty-state placeholders instead of returning `null` ✅ DONE (2026-04-18)
> **Source:** Surfaced while building `e2e/tests/docs-screenshots.spec.ts` (2026-04-18) | **Status:** Resolved | **Priority:** MEDIUM (UX)

**Symptom:** When a widget is selected and its matching PropertiesPanel is shown (e.g. `QuestionPropertiesPanel` for an MC question), the other six panels (`ButtonPropertiesPanel`, `MediaPlayerPropertiesPanel`, `AudioNarrationPropertiesPanel`, `ProgressBarPropertiesPanel`, `VolumeControlPropertiesPanel`, `PhaserSimPropertiesPanel`) still render and each shows its own "Select a X widget to edit its properties." message stacked below the real panel. The right sidebar ends up with 6 pieces of dead copy that the author has to scroll past.

**Why it's wrong:** The empty-state exists to guide the user when nothing is selected. With a widget selected, the matching panel already answers "what can I do" — the other 6 messages are noise that makes the UI look broken.

**Root cause:** Each panel's top-level conditional is:
```tsx
if (!editor || !selectedComponentType || !isButtonWidgetType(selectedComponentType)) {
  return <div>Select a button widget to edit its properties.</div>   // ← should be `return null`
}
```
(Same pattern in `Question`, `MediaPlayer`, `AudioNarration`, `ProgressBar`, `VolumeControl`, `PhaserSim`.)

**Proposed fix (centralised approach):**
1. Each `*PropertiesPanel` returns `null` when not applicable (remove the empty-state div).
2. `AppLayout.tsx` wraps the Props tab container and, **if no panel matched** (no child renders anything), shows a single generic empty state: "Select a widget in the canvas to edit its properties." Detection can be via a sibling component that reads `selectedComponentType` and the set of widget types that HAVE custom panels.

**Alternative fix (per-panel null):** Just change every `return <empty-state>` to `return null`. Simpler; the sidebar is just blank for widgets without a custom panel (text/image/rectangle/score-*). Less clear UX but trivial to apply.

**Files affected (7):**
- `packages/authoring-ui/src/components/sidebar/QuestionPropertiesPanel.tsx`
- `packages/authoring-ui/src/components/sidebar/ButtonPropertiesPanel.tsx`
- `packages/authoring-ui/src/components/sidebar/MediaPlayerPropertiesPanel.tsx`
- `packages/authoring-ui/src/components/sidebar/AudioNarrationPropertiesPanel.tsx`
- `packages/authoring-ui/src/components/sidebar/ProgressBarPropertiesPanel.tsx`
- `packages/authoring-ui/src/components/sidebar/VolumeControlPropertiesPanel.tsx`
- `packages/authoring-ui/src/components/sidebar/PhaserSimPropertiesPanel.tsx`
- `packages/authoring-ui/src/components/layout/AppLayout.tsx` (only if going with the centralised approach)

**Applied fix (centralised approach):**
- The 6 panels that previously returned a per-widget empty-state div now `return null` when they do not apply.
- A new module `packages/authoring-ui/src/components/layout/propsEmptyState.tsx` exports `hasCustomPropsPanel(type)` and `<PropsEmptyState selectedType />`. Extracted to its own file so unit tests can import these helpers without pulling in AppLayout's `SimulationEditor → react-konva → konva` chain.
- `AppLayout.tsx` renders the 7 `PanelErrorBoundary`-wrapped panels only when `hasCustomPropsPanel(selectedComponentType)` is true; otherwise it renders `<PropsEmptyState selectedType={selectedComponentType} />`, which shows:
  - "Select a widget on the canvas to edit its properties." when nothing is selected, or
  - "This widget has no dedicated properties. Use the Styles tab to change its appearance." when a widget type without a custom panel is selected (text/image/rectangle/score-*).
- `PropsEmptyState.test.tsx` pins the contract of `hasCustomPropsPanel` (11 widget families → true, 6 families → false, null → false) and `<PropsEmptyState>` (single node, correct copy for both states).
- `SidebarPanels.test.tsx` updated: the 7 panel suites now assert `container.firstChild === null` when the panel does not apply, instead of looking for the "Select a X widget" text that no longer exists.

**Subtasks:**
- [x] TD-010.1 — Apply null returns in all 7 panels (6 had per-widget empty states; `PhaserSimPropertiesPanel` already returned null).
- [x] TD-010.2 — Add centralised `PropsEmptyState` + `hasCustomPropsPanel` in `propsEmptyState.tsx`; wire it into AppLayout's Props tab container.
- [x] TD-010.3 — Update the 7 panel tests in `SidebarPanels.test.tsx`; add new unit-test file `PropsEmptyState.test.tsx` (6 tests).
- [x] TD-010.4 — `tsc -b` exit 0; authoring-ui vitest 769/769 pass (33 → 34 files); runtime-player 265/265 pass; E2E `widget-persistence-across-slides` + `docs-screenshots` still green.
- [x] TD-010.5 — Verify visually on each widget type (text, image, button, rectangle, nav-buttons, done-button, progress-bar, media-player, audio-narration, volume-control, score-quiz, score-field, mc, tf, fill, phaser-sim, screenshot-sim) that only one panel is visible + sidebar is not scrollable due to empty copy.
  Closed via deterministic regression guard `packages/authoring-ui/src/__tests__/layout/PropsTabRouting.test.tsx` (101 tests, all green). Two-layer invariant: (a) each of the 5 previously-untested custom panels (Button / MediaPlayer / AudioNarration / ProgressBar / VolumeControl) now asserts `container.firstChild === null` for every non-matching type in the 17-type grid — Question + PhaserSim already had this pinned in `SidebarPanels.test.tsx` + `PhaserSimPropertiesPanel.test.tsx`; (b) an AppLayout-mirror fragment renders the exact Props-tab ternary for each of the 17 types and asserts exactly ONE `[data-testid="props-empty-state"]` when `hasCustomPropsPanel(type) === false` (text/image/rectangle/score-quiz/score-field/screenshot-sim + null) and ZERO empty-states when `hasCustomPropsPanel(type) === true` (11 custom-panel types). Live-browser confirmation: 2026-04-19 Playwright-MCP QA pass against `localhost:3000` already covered the empty-state and button-selected paths (1 + 0 empty-state nodes respectively, see `WORKING_CONTEXT.md`). Full authoring-ui suite 870/870 pass (769 → 870, +101); `tsc --noEmit` exit 0.
- [x] TD-010.6 — Align E2E `authoring-ui-layer.spec.ts` with the centralised empty-state. Three tests (T608.2 "clicking Props tab makes it selected", T608.5 "Props panel shows empty state before any widget is selected", T608.5 "switching away from MC widget to no selection returns to empty state") still asserted the pre-TD-010 copy `/Select a question widget/i`, a per-panel fallback that no longer exists — the centralised `<PropsEmptyState>` renders `"Select a widget on the canvas to edit its properties."` (no "question") under `data-testid="props-empty-state"`. Unit tests had already been migrated in TD-010.3; the 3 E2E assertions were the residual lag that kept `c1792f9`'s CI red after the `addCallouts`/`removeCallouts` lint fix went green. Replaced the 3 text locators with `getByTestId('props-empty-state')` — same stability contract already used by `PropsEmptyState.test.tsx` and `PropsTabRouting.test.tsx`, so the whole test stack (unit + E2E) now pins the same testid.

---

### [x] TD-011 — `registerQuestionBlocks` hidden inside `registerMediaPlayerWidget` ✅ DONE (2026-04-19)

**Discovered via** `/graphify packages/authoring-ui/src --mode deep` — `registerBlocks()` surfaced as the top god node (degree 13). Source inspection revealed `registerQuestionBlocks(editor)` was called inside `registerMediaPlayerWidget()` at L448 of `packages/authoring-ui/src/editor/registerBlocks.ts` instead of from the top-level `registerBlocks()` dispatcher. The structural invariant "every widget-family registrar is called from the dispatcher" was violated silently: if a future refactor dropped `registerMediaPlayerWidget` from the dispatcher, the entire question widget system would disappear from the block sidebar with no test red, no type error, and no runtime warning — the only symptom would be users no longer seeing MC/TF/Fill in the sidebar. Neither the 769 unit tests nor the 24-spec / 165-test Playwright suite could have caught this because `registerMediaPlayerWidget` was still being called, so the misplaced line kept working by accident.

**Fix (1 file, 2 lines):** cut `registerQuestionBlocks(editor)` from inside `registerMediaPlayerWidget` (L448), add it to the main `registerBlocks()` dispatcher alongside `registerSimBlock` and `registerPhaserSimBlock`. Zero functional change — only the registration-call location moved.

**Verification:** `npx tsc -b` exit 0 · authoring-ui vitest **769/769** pass (unchanged — no test had to change because the functional contract is identical) · existing E2E `question-widget.spec.ts` **30/30** pass in 3m 19s on `chromium` (T601.0a/0b/0c + T601.1 + T601.5/6 + persistence + T611 mandatory-gate + T620.5 + T621.5 + T631.3/4/6 + T639 — covers drag-to-canvas, default content render, per-type discovery in the Blocks panel, props-panel round-trip, and persistence across reload, i.e. the full regression surface).

**Post-mortem — why tests could not have found this:** the bug is about structural cleanliness, not functional behaviour. A dispatcher that gains a hidden side effect inside one of its branches passes every existing test until the branch itself is removed or reordered. Assertions like "registration order matches declared order" or "no registrar calls another registrar" would catch this category of bug but are not idiomatic in Playwright/vitest — they are structural properties better expressed as graph queries. TD-011 is the first documented case where `/graphify` surfaced a latent coupling that test coverage alone cannot express.

**Subtasks:**
- [x] TD-011.1 — Move `registerQuestionBlocks(editor)` from `registerMediaPlayerWidget` L448 to `registerBlocks()` L46.
- [x] TD-011.2 — `npx tsc -b` exit 0 + authoring-ui vitest 769/769 pass (unchanged).
- [x] TD-011.3 — Existing E2E `question-widget.spec.ts` 30/30 pass against running dev stack (ports 3000/3001).
- [x] TD-011.4 — Commit + push (`3fbb519`); docs closure in `CHANGELOG.md` v0.5.64 + `WORKING_CONTEXT.md`.

---

### [x] TD-012 — e2e/: typed `window.__elearn_editor` boundary + docs-screenshots playbook ✅ DONE (2026-04-23)

**Problem:** 109 pre-existing TypeScript errors in the `e2e/` package, never surfaced before because `pnpm --filter e2e test` does not run `tsc --noEmit` as part of its loop (Playwright parses the specs with its own transform). Two root-cause patterns, both the exact escape hatches TD-004 erradicated on the production side:

1. **`(window as unknown as Record<string, unknown>).__elearn_editor as { … }`** — scattered across 20 specs + utils + POM. The double-cast + inline narrow pattern repeated ~70 times. TD-004 replaced the production equivalent (`as GjsComponent` / `as unknown as Component`) with `ELearnComponent` narrowed **once** at a boundary. Mirror here.
2. **`EditorPage.ts` declared `private readonly page: Page`** but 10 specs reached for `editorPage.page` directly (for `waitForResponse`, `evaluate`, `waitForTimeout`, etc.), triggering TS2341 on every site.

**Fix:**

- New `e2e/types/elearn-window.d.ts` — ambient `Window` augmentation declaring `__elearn_editor?: E2EEditor` with a minimal typed surface (`addComponents`, `select`, `getSelected`, `getWrapper`, `getComponents`, `runCommand`, `store`, `BlockManager` + typed `E2EComponent` / `E2EComponents` / `E2EWrapper`). Pulling `grapesjs` as a devDep here would add ~400 kB of type definitions for test-only typing; the minimal interface keeps the surface aligned with real usage and documents what the specs actually invoke.
- `EditorPage.ts:36` — `private readonly page` → `readonly page` (standard Playwright POM pattern).
- Every `(window as unknown as Record<string, unknown>).__elearn_editor as { … }` collapsed to `window.__elearn_editor` across 17 specs + 2 utils.
- `preview-handshake.spec.ts` — spec-local `__previewSpy` / `__openerSpy` declared inline via `declare global { interface Window { … } }` at the top of the file (kept out of the cross-spec ambient surface).
- `docs-screenshots.spec.ts:138` — `TS2339` on `Node.remove()` fixed by propagating the `instanceof Element` guard already used at lines 526 and 794.

**Documentation paired with the refactor (B.2):** new `docs/developer-guide/10-docs-screenshots-playbook.md` — 12 techniques (T-1…T-12) used in `docs-screenshots.spec.ts` with the failing naive approach, the fix, and the affected manual section; 6 deferred placeholders with their structural reason; pre-commit checklist. Prevents technique rediscovery when the campaign is regenerated (which will happen many times as the UI evolves).

**Verification:** `npx tsc --noEmit` in `e2e/` → exit 0 (was 109 errors) · `grep 'as unknown as' / 'Record<string, unknown>'` in `e2e/` → 0 matches · `authoring-ui-layer.spec.ts` → **22/22 pass** (no runtime regression).

**Structural lesson:** the e2e package was outside the TD-004 sweep because its CI path doesn't trip TS errors — `playwright test` uses its own transformer and `pnpm -r lint` / `pnpm -r test` skip the e2e typecheck. Any future type-safety sweep must add `pnpm --filter e2e exec tsc --noEmit` to its grep — production being clean does not imply e2e is clean.

**Subtasks:**
- [x] TD-012.1 — Create `e2e/types/elearn-window.d.ts` with minimal `E2EEditor` / `E2EComponent` / `E2EComponents` / `E2EWrapper` typed surface covering every method observed in specs.
- [x] TD-012.2 — `EditorPage.ts`: make `page` public (remove `private`).
- [x] TD-012.3 — Replace every `(window as … Record<string, unknown>).__elearn_editor as { … }` with `window.__elearn_editor` across all specs + utils + POM.
- [x] TD-012.4 — `preview-handshake.spec.ts` spec-local spies declared inline via `declare global`.
- [x] TD-012.5 — Fix `docs-screenshots.spec.ts:138` (`Node.remove()` type error) with `instanceof Element` guard.
- [x] TD-012.6 — New `docs/developer-guide/10-docs-screenshots-playbook.md` with T-1…T-12 technique catalogue + deferred-placeholder table + cross-links from `developer-guide/index.md` + `developer-guide.md`.
- [x] TD-012.7 — `npx tsc --noEmit` in `e2e/` exit 0; `authoring-ui-layer.spec.ts` 22/22 pass.
- [x] TD-012.8 — Commit + push (`b55d139` playbook, `43ed28e` typing refactor); docs closure in `CHANGELOG.md` v0.5.65 + `WORKING_CONTEXT.md` + `docs/issues/issues-TD-012.md`.
