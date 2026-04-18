# Changelog

All notable changes to eLearn Studio are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.5.63] — 2026-04-18 — TD-009 + TD-010: widget persistence across slide switches + centralised Props empty-state

### Fixed
- **[TD-009] Widgets lost when switching slides rapidly** — three overlapping races, all addressed:
  1. **React 18 StrictMode concurrent loads** (`packages/authoring-ui/src/components/editor/EditorCanvas.tsx`): Effect 2 double-invokes on mount, firing two `editor.load()` calls in parallel. The cancelled first run's `loadData()` still resolved and cleared the canvas AFTER the test/user added a widget. Fixed with `lastLoadContextRef` + `lastLoadPromiseRef` — the second invocation short-circuits and awaits the first load's promise instead of racing it.
  2. **Autosave timer firing mid-load** (`packages/authoring-ui/src/editor/initEditor.ts`): the `setTimeout` callback did not re-check `getEditorLoading()`, so a pending autosave scheduled BEFORE a slide switch could fire DURING `editor.load()` and PATCH empty widgets to the current slide. Added an early-return when the loading gate is up; the explicit pre-switch `requestSave` inside Effect 2 already persisted pending edits.
  3. **Stale `data-editor-ready` attribute on slide switch** (`packages/authoring-ui/src/components/editor/EditorCanvas.tsx`): `setIsReady(false)` only scheduled a re-render — the DOM attribute didn't flip to `"false"` before async work started, so any observer (Playwright's waitFor, user code) could see the previous slide's `"true"` and race ahead. A widget observed during that window would be serialised into the NEW slide's PATCH by flush-before-switch, because the editor tree still held the old slide's content. Fixed by imperatively setting `containerRef.current.setAttribute('data-editor-ready', 'false')` synchronously right after `setIsReady(false)`.
- **[TD-010] PropertiesPanels no longer stack empty-state placeholders** (`packages/authoring-ui/src/components/sidebar/*.tsx`, `packages/authoring-ui/src/components/layout/propsEmptyState.tsx`, `packages/authoring-ui/src/components/layout/AppLayout.tsx`): previously, when a widget was selected, the 6 unrelated PropertiesPanels each rendered their own "Select a X widget" fallback, producing up to 6 pieces of stacked dead copy below the real panel. The 6 panels now `return null` when they don't apply; `AppLayout` renders a single centralised `<PropsEmptyState>` when none of the 7 panels matches (covers both "nothing selected" and "widget type without a custom panel, styled via Styles tab").

### Added
- **[TD-009] E2E regression guard** (`e2e/tests/widget-persistence-across-slides.spec.ts`) — two scenarios: (a) single-hop add → switch → switch back; (b) multi-hop add → 5-slide round-trip. Both assert the button's GrapesJS id survives via `editor.getWrapper().find('#' + id)`.
- **[TD-009] Unit tests for the autosave-during-load guard** in `packages/authoring-ui/src/__tests__/initEditor.test.ts` (2 tests: guard up → save suppressed; guard down → save runs).
- **[TD-010] `propsEmptyState.tsx` module** — `hasCustomPropsPanel(type: string | null): boolean` + `<PropsEmptyState selectedType />`. Extracted from AppLayout into its own file so unit tests can import without pulling in `SimulationEditor → react-konva → konva`.
- **[TD-010] Unit tests** (`packages/authoring-ui/src/__tests__/layout/PropsEmptyState.test.tsx`, 6 tests) pinning the contract of both exports (widget-family classification, select-a-widget vs Styles-tab copy, single-node invariant).

### Changed
- **[TD-010] `SidebarPanels.test.tsx`** — 7 panel suites updated: `container.firstChild === null` when the panel does not apply, instead of looking for the "Select a X widget" text that no longer exists.

### Notes
- **[TD-009 + TD-010] Verification matrix**: `npx tsc -b` exit 0; authoring-ui vitest 763 → **769/769 pass** across 34 files (+1 file, +6 tests for TD-010); runtime-player **265/265 pass** (unchanged); E2E `widget-persistence-across-slides` 2/2 pass after fix (100% failure rate before); E2E `docs-screenshots` still green.
- **[TD-009] `widget-persistence-across-slides.spec.ts` was the discovery vector for the third race.** The spec was green immediately after the first two fixes landed, then regressed 3/3 after TD-010 moved `selectedComponentType` into AppLayout (extra re-renders surfaced the stale-ready window). Adding browser-console forwarding and a `[STORE]` diagnostic log identified that the editor tree was still showing the previous slide's components at `readySignal` attached — pointing directly at the attribute-flip race.

---

## [0.5.62] — 2026-04-18 — TD-008: 4 minor UI/UX bug fixes ahead of user-manual v2 rewrite

### Fixed
- **[TD-008 / Bug #1] `PhaserSimPreviewModal` now tracks window resizes** (`packages/authoring-ui/src/components/simulation/PhaserSimPreviewModal.tsx`) — modal previously captured `window.innerWidth` / `window.innerHeight` once at mount; resizing the browser left stale dimensions and clipped the modal. Fixed with `useState(viewport)` + `useEffect` `'resize'` listener + cleanup on unmount. SSR-safe via `typeof window !== 'undefined'` guards.
- **[TD-008 / Bug #2] Component-default `properties` shape standardised to `[]`** (`editor/registerBlocks.ts`, `registerQuestionBlocks.ts`, `registerSimBlock.ts`, `registerPhaserSimBlock.ts`, `editor/converters.ts`) — 14 widget defaults plus `nav-buttons` children switched from `properties: {}` to `properties: []`. GrapesJS's Style Manager `PropertyComposite` calls `this.get('properties') || []` then iterates; object shape was latent crash bait despite `GENERATED_CONTENT_TYPES` already omitting it on load for known-risky types. `converters.ts::NavButtonChildDef` type updated to `properties: []` with an inline comment documenting the GrapesJS requirement. Test `registerBlocks.test.ts` updated: `toEqual({})` → `toEqual([])` for all 14 widget types.
- **[TD-008 / Bug #3] Phaser placeholder scene fires `sim-complete` in ALL modes** (`packages/runtime-player/src/widgets/phaserSimWidget.ts`) — previously only `mode === 'demo'` auto-completed after 2 s; practice/assessment modes rendered the label but never emitted completion, so courses containing a Phaser sim could not progress in those modes. Removed the mode guard. Score reported: `100` for demo/practice (unconditional pass), `config.passingScore` for assessment (meets author's threshold). Placeholder remains temporary — will be replaced entirely by T036 per-simType scene builders.
- **[TD-008 / Bug #4] Actions Editor dropdown shows widget names instead of cryptic GrapesJS IDs** — authors set "HintButton" in Props → Name but the `Show` / `Hide` / `Play Media` / `Score Question` dropdowns displayed `c32kq3`, `df12x8`, etc. Fixed in four places: (a) `packages/shared-types/src/widgets.ts` — `BaseWidget.name?: string` added (optional, backward-compatible); (b) `packages/authoring-ui/src/editor/converters.ts::widgetsFromGrapesjs` — reads `c.get('name') ?? attributes.name ?? ''` (trims, omits empty) and populates top-level `widget.name`; (c) same file `grapesjsFromWidgets` — restores `attributes.name = widget.name` on reload when non-empty; (d) `packages/authoring-ui/src/components/actions/ActionItemEditor.tsx` — `<option>` label changed to `{w.name || w.id}` while `value` stays `w.id` (technical routing key unchanged). Backward-compat path verified: legacy courses with `name` only in `widget.properties` continue to work via the T611 attribute restoration loop.

### Added
- **[TD-008] 6 round-trip regression tests** in `packages/authoring-ui/src/__tests__/converters.test.ts` under a new `Bug #4 — name trait round-trip for Actions Editor dropdown` describe: (1) `widgetsFromGrapesjs` reads the `name` trait from model into `widget.name`; (2) `widget.name` is `undefined` when blank; (3) `grapesjsFromWidgets` restores `widget.name` into `def.attributes.name`; (4) no `attributes.name` when `widget.name` absent; (5) full round-trip preserves the `name` trait; (6) legacy-properties fallback (courses saved pre-TD-008 with `name` only in `widget.properties`).
- **[TD-008] Self-review** (`docs/issues/issues-TD-008.md`) — autonomous; includes root-cause analysis, fix rationale, scope note on `widget.properties` MongoDB shape (unchanged), backward-compat path, and verification matrix. 0 open CRITICAL/HIGH/MEDIUM.
- **[TD-008] User-manual v2 scope document** (`docs/user-manual-v2-scope.md`) — drafted before the bug-fix pass to capture what v1 missed, agreed §1-§9 plan, Actions Editor investigation notes (triggers, actions, DSL, widget referencing), and the research that identified Bug #4 as a documentation blocker.

### Notes
- **[TD-008] T036 still deferred**: per-simType Phaser scene builders (ProcessFlowScene, InteractiveDiagramScene, GamifiedQuizScene, PhysicsDemoScene, ConceptAnimatorScene) remain future work. The placeholder fix is explicitly temporary; comment in `phaserSimWidget.ts` points to T036 as the permanent replacement.
- **[TD-008] `widget.properties` MongoDB storage shape untouched**: stays `Record<string, unknown>`. Only the GrapesJS component-def `properties` field was standardised. Backend Course schema unchanged.
- **[TD-008] Ready for user-manual v2 rewrite**: TD-008 was the documentation blocker. §3 of the manual can now describe correct UX ("name your widget in Props → Name and it appears as that name in the dropdown") without a workaround clause.
- **[TD-008] Verification matrix**: `npx tsc -b packages/shared-types packages/authoring-ui packages/runtime-player` → exit 0; authoring-ui suite 755 → **761/761 pass** across 33 files; runtime-player **265/265 pass** (no change); `pnpm -r lint` 0 errors (2 historical TD-004 warnings unchanged); CI run `24608241954` (bugs #1-#3) and `24608814942` (bug #4) both green including full E2E suite.
- **[TD-008] Commits**: `62153ca` (bugs #1, #2, #3 bundled) + `de0ad2e` (bug #4, isolated because it introduced a shared-types schema change).

---

## [0.5.61] — 2026-04-18 — TD-006: `_isEditorLoading` audit confirms native events insufficient (closed; no code change)

### Added
- **[TD-006] Permanent regression test** (`packages/authoring-ui/src/__tests__/editor/grapesEventOrder.test.ts`) — 5 structural assertions against the bundled `grapes.mjs` of the currently-installed `grapesjs@0.21.13`:
  - source loads (sanity, >10 KB)
  - `EditorModel.prototype.load` (line 61352) `await`s `this.Storage.load(options)` BEFORE calling `this.loadData(result)` — the keystone ordering
  - `StorageManager.prototype.onEnd` references `endLoad` for type `'load'`
  - `StorageEvents.endLoad === 'storage:end:load'` (event name pinned)
  - regex regression-guard `yield.*?Storage\.load[\s\S]*?loadData\(result\)` — fails loud if a future grapesjs inverts the order
  - Runs in 17 ms (no editor init). Live `grapesjs.init()` was tried first but hangs in vitest jsdom (grapesjs uses iframe canvases / DOM measurement APIs jsdom does not implement); static inspection of the bundle is empirically equivalent for the question "does Storage.load yield before loadData runs?".
- **[TD-006] ADR** (`decisions/2026-04-18-editor-loading-flag.md`) — extends the prior 2026-04-17 T646.5 ADR with audit results against `grapesjs@0.21.13`. Documents the exact line numbers and source snippets from `grapes.mjs` for `EditorModel.prototype.load` and `StorageManager.prototype.onEnd`. Records the reopen criteria: "the structural regression test fails".
- **[TD-006] Self-review** (`docs/issues/issues-TD-006.md`) — autonomous; documents the audit method, evidence, what was implemented, what was NOT changed, and the reopen criteria. 0 CRITICAL/HIGH/MEDIUM/LOW.

### Notes
- **[TD-006] Closed as "Native events timing insufficient"** (Scenario B per the original ticket text). `EditorModel.prototype.load` (`grapes.mjs:61352`) `await`s `this.Storage.load(options)` THEN calls `this.loadData(result)` synchronously. `StorageManager.prototype.onEnd` (`grapes.mjs:42110`) fires `storage:end:load` inside `Storage.load()` — before its promise resolves. So the timeline of `editor.load()` is: `storage:start:load` → custom storage resolves → `storage:end:load` → `EditorModel.load` awakens → `loadData(result)` → cascade of `component:add × N`. Using `storage:end:load` to clear the gate would lift it three steps before the `component:add` cascade arrives.
- **[TD-006] Zero production-code change**: `_isEditorLoading` flag, `setEditorLoading`/`getEditorLoading` accessors, `EditorCanvas.tsx` set/clear sites around `editor.load()`, `triggerAutosave` reading `getEditorLoading()` — all unchanged. Only added: 1 ADR + 1 audit test file + 1 issues doc.
- **[TD-006] Verification**: `npx tsc -b` exit 0; new audit file 5/5 pass in 17 ms; full authoring-ui suite 750 → **755/755 pass** across 33 files; `pnpm -r lint` 0 errors (2 historical TD-004 warnings unchanged); `_isEditorLoading` references unchanged in 5 files (production + tests + audit doc).
- **[TD-006] Backlog status**: with TD-006 closed, the entire Phase 10 audit tech-debt set (TD-001 through TD-007) is resolved. No active backlog items remain.

---

## [0.5.60] — 2026-04-18 — TD-005: `useExtendedProperty` shallow-merge contract + dev-only lost-key detector

### Added
- **[TD-005] Dev-only lost-key warning in `useExtendedProperty.update()`** (`packages/authoring-ui/src/hooks/useComponentProperty.ts`) — fires `console.warn` when `update(newValue)` is about to shallow-replace a nested object with a partial-shape one, losing sibling keys. Triggers only when `process.env.NODE_ENV !== 'production'` AND both `prev` and `newValue` are plain objects (`isPlainObject` helper: `typeof v === 'object' && v !== null && !Array.isArray(v)` — arrays excluded on purpose). Message includes the subKey name, the lost-key list, and the literal fix snippet pointing to the T639 `getLatest()` + spread pattern. Production bundles tree-shake the entire branch — zero runtime cost in prod.
- **[TD-005] Explicit JSDoc contract on `useExtendedProperty.update()`** stating that `newValue` REPLACES the entire nested object (does NOT deep-merge), and documenting the canonical T639 partial-update pattern: `updateEp({ ...getLatest(), [subKey]: { ...getLatest()[subKey], ...patch } })`.
- **[TD-005] 4 regression tests** in `packages/authoring-ui/src/__tests__/hooks/useComponentProperty.test.ts` under a new `useExtendedProperty — TD-005 shallow-replace contract + lost-key warning` describe block:
  - `shallow replace of nested object works as documented (replaces entirely)` — full-shape replacement of `scoring` succeeds without warning.
  - `warning fires when shallow-replace of a nested object loses keys` — partial `{ weight: 50 }` over `{ weight, attempts, mandatory }` triggers exactly one `console.warn` whose message is asserted to contain `[TD-005]`, the subKey name, both lost key names, and the `getLatest()` suggestion. Behaviour (commit the shallow replace) still honoured.
  - `no warning when replacing a nested object with same-shape value` — guards against false positives.
  - `no warning for array-of-objects replacement (options)` — documents that wholesale-replace for arrays is intentional contract.
  - All tests use `vi.spyOn(console, 'warn').mockImplementation(() => {})` with `mockRestore()` in `finally` so no other test sees the spy.
- **[TD-005] Self-review** (`docs/issues/issues-TD-005.md`) — autonomous, includes: why the original "Option B literal" (`FlatExtendedProperties` type + warn-on-any-object) was rejected after audit revealed `extendedProperties` already contains nested shapes (`scoring`, `options`, `sceneDef`); why deep-merge was rejected on four grounds (YAGNI, array semantics ambiguity, bundle cost, debuggability); what was actually implemented; what this does NOT do (no production cost, no type changes, no caller migration). 0 CRITICAL/HIGH/MEDIUM/LOW.

### Notes
- **[TD-005] Premise correction**: the `tasks.md` description "all extendedProperties have flat structure" was already incorrect when written. Audit traces nested shapes back to T639 (when `QuestionScoring` was extracted) and earlier (when `MCOption[]` shipped). The original ticket framing — "preventive fix in case nested shapes appear" — was reactively reframed as "diagnostic for the bug pattern that already-existing nested shapes invite". The reframe is documented at length in `docs/issues/issues-TD-005.md`.
- **[TD-005] Verification**: `npx tsc --noEmit` exit 0; `useComponentProperty.test.ts` 40 → **44/44 pass**; full authoring-ui suite 746 → **750/750 pass** across 32 files; `pnpm -r lint` 0 errors (2 historical TD-004 warnings unchanged).
- **[TD-005] Commit**: `d6b54f5`.

---

## [0.5.59] — 2026-04-18 — TD-007: unified course-meta save path via `requestCourseMutation`

### Added
- **[TD-007] `performCourseMutation<R>(apiCall, hooks)` generic primitive** (`packages/authoring-ui/src/lib/courseMutation.ts`) — Layer 1 pure function mirroring T651's `performSave`: takes a `courseApi` callable and optional `onStart`/`onSuccess`/`onError` hooks, narrows any thrown error to a message string, returns the API result on success or `undefined` on failure. Zero Zustand/React dependency — testable in isolation.
- **[TD-007] `requestCourseMutation` Zustand-bound closure** (`packages/authoring-ui/src/editor/initEditor.ts`) — Layer 2 closure constructed alongside `requestSave` that wires `performCourseMutation` into `setIsSaving`/`setSaveError`/`bumpCacheVersion`. Default `bumpCache: true` is the invariant — any course mutation invalidates the storageManager cache; the `{ bumpCache: false }` escape hatch is kept for future callers that may mutate metadata the cache does not mirror (no current caller uses it). Exposed via `useEditorStore.getState().requestCourseMutation` (Layer 3).
- **[TD-007] 8 regression tests for the pure primitive** (`packages/authoring-ui/src/__tests__/lib/courseMutation.test.ts`) — success path, error path (Error + non-Error narrowing via `String(err)`), hook ordering guarantees (`onStart` synchronous before await, `onSuccess`/`onError` after), optional hooks.
- **[TD-007] 3 regression tests for the Zustand closure** (`packages/authoring-ui/src/__tests__/initEditor.test.ts` → new `TD-007 — requestCourseMutation closure wires Zustand state and cache bump` describe) — success path asserts `setIsSaving(true)` → `bumpCacheVersion()` → `setIsSaving(false)`; `{ bumpCache: false }` asserts the bump is skipped; error path asserts `setSaveError(msg)` + `setIsSaving(false)` + no bump + `undefined` return.
- **[TD-007] ADR** (`decisions/2026-04-18-course-mutation.md`) — options evaluated (per-operation wrappers / generic two-layer / HOF-only / Zustand middleware), selection rationale (two-layer mirror of T651 for consistent mental model), design guardrails (`setCourse` stays at caller, `bumpCache: true` default, no re-throw, toast stays caller-owned), test plan.
- **[TD-007] Self-review** (`docs/issues/issues-TD-007.md`) — 4 drift findings (D-01 through D-04) all documented as resolved; no open CRITICAL/HIGH/MEDIUM.

### Fixed
- **[TD-007 / D-02] Latent cache-invalidation bug in slide rename and slide reorder** — `SlideList.commitRename` (`updateSlide`) and `SlideList.handleDrop` (`reorderSlides`) mutated the course via REST but did NOT call `bumpCacheVersion()`. `storageManager`'s in-memory `courseCache` (keyed by course ID) held the pre-mutation slide list, so a later `editor.load()` triggered by a slide switch could reconstruct the canvas from stale cache and show the old title or old order. Resolution: both sites now route through `requestCourseMutation` with the default `bumpCache: true`, guaranteeing cache invalidation on every successful mutation. Latent — no user report — but the path existed; the two paths that missed `bumpCacheVersion` are the ones the T651 refactor explicitly scoped out, exactly the drift TD-007 was designed to kill.
- **[TD-007 / D-01] `isSaving` global state now reflects SlideList operations** — the 5 SlideList sites did not set the global `isSaving` flag; only the 3 TopToolbar sites did. `SaveErrorBanner` and the "Saving…" toolbar badge never appeared for sidebar drag-reorder, rename, or duplicate. Resolution: every mutation now passes through `requestCourseMutation`, which flips `setIsSaving` around every REST call. User feedback surface is now symmetric across toolbar and sidebar.
- **[TD-007 / D-03] Toast level unified to `error`** — the 5 SlideList sites used `toast.warning` for identical failure conditions that TopToolbar treated as `toast.error`. Standardised on `error` to match TopToolbar and the non-variant `SaveErrorBanner`.

### Changed
- **[TD-007 / D-04] Removed local in-flight flags from `SlideList.tsx`** — `isAdding` (1 site) and `isProcessing` (3 sites, 1 site used no flag at all) collapsed into the global `useEditorStore(s => s.isSaving)` selector. Button `disabled` states and action-button `isBusy` prop (renamed from `isProcessing` on the `SlideItem` child for clarity) now all read from the unified global flag. `grep -rn "isAdding\|isProcessing" packages/authoring-ui/src/` returns **0 matches**.
- **[TD-007] Migrated all 8 call sites** (`TopToolbar.tsx` ×3 + `SlideList.tsx` ×5) to the `requestCourseMutation` pattern: `const rcm = useEditorStore.getState().requestCourseMutation; if (!rcm) return; const updated = await rcm(() => courseApi.X(...)); if (!updated) { toast.error(...); return }; setCourse(updated); /* op-specific side effect */`. Post-success side effects (`setCurrentSlideIndex`, `setEditingId(null)`, `dragIndex`/`dropIndex` reset) stay local — genuine operation-specific logic, not boilerplate. Callers shrank by ~35% on average (e.g., `handleNewSlide` 17 → 11 LOC).
- **[TD-007] `editorStore.ts` — new fields** `requestCourseMutation: (<R>(apiCall, opts?) => Promise<R | undefined>) | null` + `setRequestCourseMutation`. `EditorCanvas.tsx` Effect 1 registers the closure via `setRequestCourseMutation(requestCourseMutation)` alongside the existing `setRequestSave`, and clears it on cleanup (symmetric with T651).

### Notes
- **[TD-007] Verification**: `grep "isAdding\|isProcessing"` → 0 matches; `grep "bumpCacheVersion"` → only store definition + Layer 2 closure + test mocks + caller comments (no call site invokes it directly anymore); `npx tsc --noEmit` → exit 0; authoring-ui suite: 733 → **744/744 pass** across 31 files; `pnpm -r lint` → 0 errors, 2 info-warnings (TD-004 historical, unchanged).
- **[TD-007] Deliberately out of scope**: (a) course-meta calls in packages other than authoring-ui — none exist today; a future `PublishDialog` or admin panel consumer will be required to route through `requestCourseMutation` (doc to be added to `08-persistence-flow.md`); (b) batching/retry/telemetry hooks on `performCourseMutation` — the seam exists via the hooks object, no caller needs it today; (c) TopToolbar.test.tsx rewrite — the file does not exercise the mutation handlers.
- **[TD-007] Bundled with ADR + self-review**: `decisions/2026-04-18-course-mutation.md` + `docs/issues/issues-TD-007.md` — 4 drift findings all marked RESOLVED; 0 open issues above INFO.

---

## [0.5.58] — 2026-04-18 — TD-004 micro-polish: ESLint warnings reduced + defaultValue stability contract tests

### Changed
- **[TD-004 polish] Moved `ELearnComponent` narrowing inside each `useEffect` in `useComponentProperty.ts`** — previously `const comp = component as ELearnComponent | null` lived at function-body scope so that `useComponentProperty`'s effect, its `useState` initializer, and its `update()` writer could share the narrowing. When TD-004 first landed, that layout caused the `react-hooks/exhaustive-deps` rule to flag `comp` as a missing dependency in **both** effects (on top of the historical `defaultValue` / `readValue` warnings). Since `comp` is identity-equivalent to `component` at runtime (the cast is type-only), the narrowing was re-declared inside each effect — outer scope narrowing was kept only where still used (`useState` initializer, `update()` writer, and `useExtendedProperty.readValue` / `update`). Effect body is now: `if (!component) return; const comp = component as ELearnComponent; …` — `comp` is no longer a closure reference of the effect. Result: **warnings on `useComponentProperty.ts` reduced from 4 to 2** (only `defaultValue` on line 82 and `readValue` on line 159 remain — the historical pre-TD-004 set).

### Fixed
- **[TD-004 polish] `eslint-disable-next-line react-hooks/exhaustive-deps` comments refined to document the contract explicitly** — both blocks now state: `defaultValue` (and `readValue` in the extended-property hook) are fallback-only constants for the panel lifetime; adding them to deps would re-subscribe the Backbone listener on every render of the panel (keystroke-level churn with zero benefit) since the change handler reads the live value via `comp.get(key)` / `readValue()` — never a captured closure of those values.

### Added
- **[TD-004 polish] 2 regression tests documenting the `defaultValue` stability contract** (`packages/authoring-ui/src/__tests__/hooks/useComponentProperty.test.ts`):
  - `useComponentProperty — defaultValue stability contract (TD-004)` — rerenders the hook with a different `defaultValue` after mount and asserts (a) the emitted value remains the one from the GrapesJS model (`comp.get(key)`) and (b) `comp.listenerCount('change:content')` does not change (no `off`+`on` churn).
  - `useExtendedProperty — defaultValue stability contract (TD-004)` — symmetric contract for the extended-property variant with the `change:extendedProperties` listener count assertion.
  - Both tests use the existing `makeComponent()` mock and the `renderHook`/`rerender` pattern already used by 38 sibling tests. Suite: 38 → **40/40 pass**. Full authoring-ui suite: 731 → **733/733 pass**.

### Notes
- **[TD-004 polish] Why `defaultValue` / `readValue` remain excluded from the deps array**: both are semantically stable for a given panel (the panel always passes the same literal like `''`, `0`, or `DEFAULT_EXTENDED_PROPS`). The change handler NEVER captures them in a stale closure — it always re-reads the live model via `comp.get(key)` / `readValue()`. Including them would trigger `off`+`on` on every render of the panel (and every keystroke-driven render on controlled inputs), causing excess Backbone event churn with zero semantic benefit.
- **[TD-004 polish] Verification**: `npx eslint useComponentProperty.ts` → 2 warnings (0 errors); `npx tsc --noEmit` → exit 0; `pnpm --filter @elearn-studio/authoring-ui test` → 733/733 pass across 30 test files; `pnpm -r lint` → 0 errors across the full monorepo. Zero runtime behaviour change — purely a warning reduction and contract-documenting test addition.
- **[TD-004 polish] Commit**: `ea86279`.

---

## [0.5.57] — 2026-04-18 — TD-003: T642 isolation confirmed + T643 runtime forEach guards

### Fixed
- **[TD-003 / T643] Runtime player no longer crashes on legacy MongoDB sequences with undefined arrays** — `packages/runtime-player/src/actions/executor.ts` guards `for (const action of actions ?? [])`; `packages/runtime-player/src/actions/dispatcher.ts` guards `attachWidget` (`sequences ?? []`), `fireSlideEvent` (outer `allWidgetSequences ?? []` + inner `(sequences ?? []).filter(…)`), and `fireWidgetEvent` (`(sequences ?? []).filter(…)`); `packages/runtime-player/src/actions/builtins/callSequence.ts` guards `shared.actions ?? []`. The single executor guard transparently covers every recursive caller (`condition.then`/`else`, `loop.body`, `call-sequence`), so `condition.ts` and `loop.ts` are deliberately left untouched. Root cause: prior to the `Action[]` field becoming mandatory, some documents persisted with `then`/`else`/`body`/`actions` simply absent; the T643.2 fix covered the authoring-side `validateSequence.ts` but missed the runtime-player equivalents.

### Added
- **[TD-003] 9 runtime-player regression tests** (`packages/runtime-player/src/__tests__/actions.test.ts` → new `TD-003 — forEach guards on legacy MongoDB data` describe) — each test feeds an intentionally-typed-`@ts-expect-error` legacy shape (`undefined` array) to `ActionExecutor.run` / `EventDispatcher.attachWidget` / `fireSlideEvent` / `fireWidgetEvent` / call-sequence with an action-less shared sequence, and asserts the call **resolves to a no-op instead of throwing**. Runtime-player suite: **256 → 265 tests (all green)**.
- **[TD-003] `docs/issues/issues-TD-003.md`** — self-review combining T642 audit confirmation with the T643 runtime-side fix, including the full pre-fix audit table of every `.forEach` / `for … of` site in the action engine (which were guarded before, which were not, which are structurally safe because they iterate NodeLists).

### Notes
- **[TD-003 / T642] FLAKE-03 confirmed resolved** — audit of `e2e/global-setup.ts:15-18` and `e2e/fixtures/auth.ts:56-86` confirms the per-test course isolation delivered in the prior T642.2 fix: `global-setup.ts` no longer calls `POST /courses`; each test gets a fresh course ID created in the `editorPage` fixture setup phase and deleted in teardown with a re-fetched token. No code change required for T642. Local 3-worker verification was blocked by a Vite esbuild subprocess crash (env issue unrelated to TD-003); CI is authoritative and has passed every run since T642.2.
- **[TD-003] Deliberately out-of-scope**: (a) a schema-level migration backfilling `actions: []` on legacy MongoDB documents — proper long-term fix but carries data-loss risk without a dry-run audit; (b) a generic `safeIter(arr)` helper — three explicit `?? []` at three call sites is clearer than one abstraction that would obscure which array is being guarded against which legacy shape.
- **[TD-003] Rejected reorg**: adding redundant guards inside `condition.ts` / `loop.ts` — the executor-level guard already covers recursion through `this.run(…)`, so extra local guards would be dead defensive code that no test could distinguish from the executor guard.

---

## [0.5.56] — 2026-04-18 — TD-004: `ELearnComponent` type + TD-002: Preview E2E + TD-001: Shared `runExport()`

### Added
- **[TD-004] `ELearnComponent` typed view over GrapesJS `Component`** (`packages/authoring-ui/src/types/ELearnComponent.ts`) — central interface replacing the scattered `as GjsComponent` / `as unknown as Component` casts that hooks used to reach non-`ComponentProperties` attributes (`extendedProperties`, `actions`, `questionText`, `options`, `sceneDef`, `prevLabel`, `nextLabel`, etc.). Loosens only `get`/`set`/`on`/`off` to accept arbitrary string keys and event names; all other grapesjs methods (`addStyle`, `getStyle`, `setStyle`, `getId`, `components()`, `append()`, `clone()`, `remove()`) stay strongly-typed via the base `Component` class. Return type of `get` is `unknown` (not `any`) so callers must narrow at the use site.
- **[TD-002] Preview-popup E2E handshake test** (`e2e/tests/preview-handshake.spec.ts`) — one `@integration` test covering the full T641 postMessage handshake: Preview click → popup opens at `/preview.html` → popup signals `'elearn-preview-ready'` to correct origin (not `'*'`) → opener receives it → opener replies `{ type:'elearn-preview-data', course, slideIndex }` → popup's `ELearnPlayer.init('player', course, …)` renders content into `#player`. Asserts Critical Rule 5 (preview popup writes zero keys to `localStorage`).
- **[TD-001] Shared `runExport()` export pipeline** (`backend/api/src/lib/export/runExport.ts`, `backend/api/src/__tests__/export/runExport.test.ts`) — pure function `runExport(course, format, options?)` plus a `PACKERS` registry keyed by `ExportFormat = 'scorm12' | 'scorm2004' | 'aicc'`. Asset helpers (`collectAssetSrcs`, `rewriteAssetSrcs`, `downloadAssets`) moved into the same module and exported for direct testing. 17 new unit tests cover dispatch, pipeline order, result shape, error-path cleanup, missing-asset skip, format-specific tmpDir prefixes.

### Refactored
- **[TD-004] `useComponentProperty.ts` cast-collapsing** — local `GjsComponent` type removed (it was private to this file); each of the two hooks (`useComponentProperty`, `useExtendedProperty`) now narrows `component as ELearnComponent` exactly once at function entry instead of at every method call. 6 scattered casts reduced to 2 authoritative narrowings. Zero runtime change; all 38 hook unit tests pass unmodified.
- **[TD-001] `backend/api/src/routes/courses.ts` export routes** — three SCORM/AICC export routes (each ~35-line hand-rolled pipeline: mkdtemp → collectAssetSrcs → downloadAssets → rewriteAssetSrcs → pack → filename sanitise → res.download + tmpDir cleanup on both success and error) replaced with a `buildExportHandler(format): RequestHandler` factory plus 3 one-line `coursesRouter.post()` registrations. tmpDir ownership contract made explicit: `runExport` owns cleanup on the error path; caller owns it on the success path inside the `res.download` completion callback. Adding xAPI as a 4th format is now **2 LOC** (one `PACKERS` entry + one route line) vs. the pre-TD-001 **~70 LOC**.

### Changed
- **[TD-004] `GRAPESJS_REACT_PATTERNS.md` pattern example** updated — code sample for `useComponentProperty` now imports and narrows to `ELearnComponent`; a leading comment explains why the rename happened and directs readers to the new interface in `src/types/ELearnComponent.ts`.

### Notes
- TD-004 is a **pure type-safety refactor** — zero runtime-behaviour changes, zero new or updated tests (the existing 38 hook tests exercise the same code paths via the same public API). Production code `grep "as GjsComponent"` / `grep "as unknown as Component"` both return **0 matches**. Test files retain their `as unknown as Component` mock-construction casts by design (ELearnComponent is not a mock-construction convenience; mock fakes live at a different type-safety boundary).
- TD-001 `courses.ts` subtotal: **−137 LOC of route-layer plumbing** (175 → 38) in exchange for **+170 LOC** of reusable helper + **+270 LOC** of tests. Net production LOC +33, but the signal-to-noise ratio in `courses.ts` improves dramatically and every future format adds 2 lines instead of 70.
- TD-002 uses `context.addInitScript` to install a `window.opener.postMessage` proxy spy in the popup BEFORE `preview.html`'s inline script runs — the only way to observe the outgoing ready signal without modifying production code.

---

## [0.5.55] — 2026-04-17 — T651: Unified persistence via `requestSave()` + Phase 10 closure

### Phase 10 complete
Phase 10 (React/GrapesJS Architectural Refactor) closes with this release. 12 audit findings across 4 files (`PhaserSimPropertiesPanel`, `storageManager`, `initEditor`, `EditorCanvas`) resolved across T644–T651. Test count grew from 686 (phase start) to 1533 (1.23x) with zero regressions shipped. Every architectural guardrail committed in the phase ADRs (`storageManager` DI, panel-selection source-of-truth, storage context provider, editor-loading flag, request-save design) is honoured and covered by tests.

### Refactored
- **[T651] `requestSave()` as the single save entry point** — Five pre-T651 call sites duplicated the "save recipe" (`setIsSaving` + `setSaveError` + try/catch around `editor.store()`). Three of the five had silent-failure bugs from drift. T651 replaces them with one unified entry point routed through a pure `performSave(editor, hooks)` primitive (`storageManager.ts`, no Zustand/React) plus a Zustand-bound `requestSave(opts?)` closure built in `initEditor.ts`. `grep "editor.store()"` is now green everywhere except `storageManager.ts:68`. ADR: `decisions/2026-04-17-request-save.md`.
- **[T651.2] `triggerAutosave` migrated** (`packages/authoring-ui/src/editor/initEditor.ts`) — debounce callback now calls `await requestSave().catch(() => {})`. Race guard (CRITICAL-01) and `isRteActive` defer stay inline — lifecycle-specific, not part of the save recipe.
- **[T651.3] `saveAndLoad` pre-navigation save migrated** (`packages/authoring-ui/src/components/editor/EditorCanvas.tsx`) — replaces manual `Promise.race([store(), 5s])` + `setIsSaving`/`setSaveError` block with `await requestSaveFn({ timeoutMs: 5000 })`. `stopCommand('text-edit')` flush stays inline (caller responsibility). `console.error` retained for audit.
- **[T651.3] Three bonus migrations** — `SaveErrorBanner.handleRetry`, `useActionsSave` subscribe callback, `SimulationEditor.handleSave` all moved to `requestSave()`. ADR flagged these as strictly in scope to prevent drift reappearing the moment the feature lands.

### Fixed
- **[T651.3] `SaveErrorBanner` retry: "Saving…" badge now fires** — Pre-T651 the handler called `editor.store()` directly without touching `isSaving`. Users saw the retry begin with no UI feedback. Now `requestSave()` sets `isSaving(true)` via `performSave`'s `onStart` hook. Regression test guards this (`T651.3: sets isSaving(true) during retry`).
- **[T651.3] `useActionsSave` silent failures now surface in UI** — Pre-T651 the callback swallowed `editor.store()` rejections into `console.error`. A real 500 from the backend produced no user-facing signal. Now failures route through `requestSave()` → `onError` → Zustand `saveError` → `SaveErrorBanner`. `console.error` retained for audit trail.
- **[T651.3] `SimulationEditor` silent failures now surface in UI** — Same root cause and same fix as `useActionsSave`.

### Added
- **[T651] `performSave(editor, hooks)` + `SaveHooks` interface** (`packages/authoring-ui/src/editor/storageManager.ts`) — pure primitive. Four fields: `onStart`, `onSuccess`, `onError(message)`, `timeoutMs`. Minimal surface by design; telemetry/retry budget not added (ADR guardrail).
- **[T651] `requestSave` Zustand field** (`packages/authoring-ui/src/store/editorStore.ts`) — nullable function reference, set by `EditorCanvas` Effect 1 after `initEditor()` returns, cleared on unmount.
- **[T651] ADR `decisions/2026-04-17-request-save.md`** — documents the two-layer design, rejected alternatives (A/C/D), and 7 binding guardrails.
- **[T651] `docs/issues/issues-T651.md`** — self-review covering architecture, rejection rationale, guardrail verification, migration table, deliberate non-scope.

### Changed
- **Non-`Error` rejection fallback message harmonised to `'Save failed'`** across all callers. Pre-T651 used three different strings (`'Pre-navigation save failed'`, `'Autosave failed'`, raw `String(err)`). Cosmetic consistency gain; `Error.message` is passed through unchanged.
- **Return type of `initEditor()`** expanded to `{ editor, cleanup, hasPendingChanges, requestSave }`. Additive; existing destructures already named the consumed fields explicitly.

### Docs
- **`GRAPESJS_REACT_PATTERNS.md`** — Pattern 1 updated to show the four-tuple return; Pattern 4 rewritten as "Unified Persistence via `requestSave()` (T645/T647/T651)" with the full save-recipe diagram; prohibited `editor.store()` example annotated with `requestSave()` alternative. Last-updated header bumped to Phase 10 complete.
- **`WORKING_CONTEXT.md`** — Current State table updated to v0.5.55, Active block reflects Phase 10 complete, Next Steps advances to TECH DEBT backlog.

### Tests
- **`initEditor.test.ts`** — mock of `../editor/storageManager` switched to `vi.importActual` so the real `performSave` reaches `editor.store()` under test. 38/38 pass.
- **`EditorCanvas.test.tsx`** — `setupInitEditorMock` returns a four-tuple with a real `performSave`-backed `requestSave`. Fallback message expectation updated to `'Save failed'`. 4/4 pass.
- **`SaveErrorBanner.test.tsx`** — migrated to the `requestSave` shape via a `makeRequestSave(mockStore)` helper that runs the real `performSave` against a mock editor. Added T651.3 regression test: `isSaving === true` during retry. 6/6 pass.
- **Monorepo totals: 1533/1533** unit+integration (backend 131, authoring-ui 731, runtime-player 256, scorm-packager 156 passed + 4 skipped, phaser-simulations 125, question-engine 74, simulation-engine 60). TSC exit 0; lint 0 errors (2 pre-existing warnings in `useComponentProperty.ts`, not touched).
- **CI run `24582182042`: success (17m02s)** — Lint, TypeScript, unit+integration, builds, E2E, coverage upload all green. CodeQL `24582181559`: success (1m13s).

### Deliberate non-scope
- **Course meta-operations** (`addSlide`, `deleteSlide`, `updateCourse`, slide reorder/rename in `TopToolbar.tsx`/`SlideList.tsx`) remain on their REST path and keep their own duplicated `setIsSaving`/`setSaveError` blocks. T651 unifies the **widget-save** path only. Tracked as candidate TD-007 for a future refactor.
- No automatic retry budget, no telemetry hooks — minimal `SaveHooks` interface by design.

---

## [0.5.54] — 2026-04-17 — T650: beforeunload dirty-state warning (Phase 10)

### Added
- **[T650] Native browser warning on tab close during autosave debounce** — The autosave path debounces `editor.store()` by 2 seconds after the last edit event; within that window edits exist only in the GrapesJS in-memory model. Closing the tab or navigating away from the domain mid-debounce silently dropped those edits. Now the browser shows its native "Leave site? Changes you made may not be saved" dialog whenever `hasPendingChanges()` returns `true`, giving the user a chance to cancel and let the autosave complete.
- **[T650.1] `hasPendingChanges: () => boolean` exported from `initEditor()`** (`packages/authoring-ui/src/editor/initEditor.ts`) — The return type is now `{ editor, cleanup, hasPendingChanges }`. `hasPendingChanges = () => autosaveTimer !== null` is a pure closure accessor; no new flag, no parallel state machine. `autosaveTimer` is already the ground-truth debounce handle — `null` means idle, non-null means a 2-second debounce is in flight.
- **[T650.2] `beforeunload` listener in `EditorCanvas.tsx`** (`packages/authoring-ui/src/components/editor/EditorCanvas.tsx`) — Registered in Effect 1 (same lifetime as the editor, keyed on `courseId`). Handler calls `e.preventDefault()` + `e.returnValue = ''` only when `hasPendingChanges()` returns `true`. No `editor.store()`, no `navigator.sendBeacon`, no sync `XMLHttpRequest` in the handler — the browser does not reliably support async work or network during unload. Listener removed in the Effect 1 cleanup function, before `editor.destroy()`.

### Rejected alternatives (documented in `docs/issues/issues-T650.md`)
- `await editor.store()` in `beforeunload` — browsers abort in-flight `fetch`/`XHR` on unload; `await` is not honoured.
- Synchronous `XMLHttpRequest` — deprecated; Chrome ignores `async:false` on unload; blocks UI thread.
- `navigator.sendBeacon(url, blob)` — 64 KB per-beacon limit; slide JSON routinely exceeds this with images/`phaser-sim` scene definitions/long question banks. A silent partial save is worse than the current loss.
- Web Locks / `navigator.locks` — does not bridge tab-close.
- Service-worker queued sync — massive scope for a 2-second race; requires offline-first architecture.

### Tests
- **T650.3** — 3 timer-state tests added to `src/__tests__/initEditor.test.ts` (`describe('T650.3 — hasPendingChanges reflects autosave timer state')`): **T650.3.1** fresh `initEditor()` call → `hasPendingChanges() === false` (timer is `null`); **T650.3.2** fire `component:update` handler → `hasPendingChanges() === true`; **T650.3.3** fire update then `vi.advanceTimersByTimeAsync(2001)` → `hasPendingChanges() === false` AND `editor.store()` called exactly once. Uses `vi.useFakeTimers()` for deterministic debounce. `beforeunload` DOM event not simulated — that would be testing the browser, not our code.
- **T650.4 absorbed into T650.3** — The original task text ("verify `store()` called inside `beforeunload`") contradicts the T650 design principle (no forced save on unload); the real intent was "verify warning fires when dirty", which reduces to the three timer-state tests already in T650.3.
- **1532/1532 unit+integration tests pass** across all packages (authoring-ui 730, backend 131, runtime-player 256, scorm-packager 156, phaser-simulations 125, question-engine 74, simulation-engine 60).

### Notes
- **Environment repair during T650.5 validation (not part of the feature)** — Two packages were corrupted in the local pnpm content-addressable store: `@rollup/rollup-win32-x64-msvc@4.60.1` (missing `package.json`, blocked `phaser-simulations` tests) and `es-abstract@1.24.1` (missing year subdirectories, blocked ESLint via `eslint-plugin-react` → `object.fromentries`). Fix was `powershell Stop-Process -Id <stale-esbuild.exe> -Force` → `pnpm store prune` → targeted `rm -rf` of the corrupt package → `pnpm install`. No source files, no lockfile, no `package.json` modified. CI was unaffected (clean container). The commit message on `04e6121` explicitly flags `env repair (@rollup/esbuild)` so future readers understand why the commit mentions these packages without any dependency changes.
- **CI run `24576886118`: success (17m04s)** — Lint, TypeScript, unit+integration tests, builds, E2E, coverage upload all green. CodeQL run `24576885745`: success (1m11s).
- **Verdict: APPROVED** — `docs/issues/issues-T650.md` generated as self-review, 0 findings above INFO, 0 CRITICAL/HIGH/MEDIUM.

---

## [0.5.53] — 2026-04-17 — T649: Stale-closure fix — synchronous latestRef update in useComponentProperty

### Fixed
- **[T649] `latestRef.current` not updated synchronously in `update()`** (`packages/authoring-ui/src/hooks/useComponentProperty.ts`) — Root cause: `latestRef.current` was only assigned at render time (`latestRef.current = value` in render body). Two consecutive `update()` calls within the same React render cycle (e.g. rapid option edits) both read the same stale ref, causing the second call to overwrite the first. Fix: added `latestRef.current = newValue` synchronously inside `update()` in both `useComponentProperty` and `useExtendedProperty`, immediately after `setValue(newValue)` and before `comp.set(key, newValue)`.
- **[T649] 9 stale-closure sites in `QuestionPropertiesPanel`** (`packages/authoring-ui/src/components/sidebar/QuestionPropertiesPanel.tsx`) — `MCPropertiesForm.updateOption()`, `addOption()`, `removeOption()`, and the radio `onChange` inline handler all read `ep.options` from the render closure instead of `getLatest().options`. Same issue in `FillPropertiesForm.addAnswer()`, `removeAnswer()`, and `updateAnswer()` reading `ep.answers`. All 9 sites replaced with `const current = getLatest()` pattern; comment `// T649: stale-closure fix via getLatest()` added on each.

### Tests
- **T649.4** — Two consecutive `updateOption` calls within a single `act()` block both apply (no stale closure); two consecutive `addAnswer` calls both append. Added to `src/__tests__/hooks/useComponentProperty.test.ts`.
- **T649.5** — `getLatest()` reflects an external `comp.set()` (simulated Undo/Redo) immediately without waiting for re-render. Added to `src/__tests__/hooks/useComponentProperty.test.ts`.
- **727/727 unit tests pass** (2 new T649 regression tests included).

---

## [0.5.52] — 2026-04-17 — T648: Fix Zustand/Backbone duality in all PropertiesPanel components (Phase 10)

### Fixed
- **[T648] All PropertiesPanel components migrated to canonical Backbone subscription pattern** — All panels now use `useComponentProperty` (hook, never `selected.get('prop')` in render body). Zustand `selectedComponentType` is the render gate only; within-panel sub-form routing reads `selected.get('type')` from Backbone synchronously. Eliminated keystroke-level global re-renders caused by Zustand property mirrors.
- **[T648] `useComponentProperty` null-safe** — Hook now accepts `component: Component | null` and returns `defaultValue` immediately when `component` is null, eliminating the conditional hook call anti-pattern in outer panel shells.

---

## [0.5.51] — 2026-04-17 — T647: Surface pre-navigation save errors in SaveErrorBanner UI

### Fixed
- **[T647] Pre-navigation `store()` errors now surface in `SaveErrorBanner`** (`packages/authoring-ui/src/components/editor/EditorCanvas.tsx`) — The `saveAndLoad()` async function in Effect 2 previously silently caught `store()` failures with only a `console.error`. This violated the consistent-feedback principle: autosave errors already set `isSaving`/`saveError` in the Zustand store (via `initEditor.ts` lines 449–458), but the pre-navigation save path did not. Fix: added `setIsSaving(true)` + `setSaveError(null)` before the `Promise.race([editor.store(), timeout])` block, `setSaveError(msg)` in the `catch` (with `err instanceof Error ? err.message : 'Pre-navigation save failed'` narrowing), and `finally { setIsSaving(false) }`. The `console.error` is kept (belt-and-suspenders alongside UI state). Navigation is never blocked — a failed save is better than a frozen UI.
- **[T647.3] No race with `triggerAutosave` UI state** — The CRITICAL-01 guard in `triggerAutosave` returns before calling `setIsSaving()` when the context has changed. In the narrow window where the autosave timer fires concurrently with `saveAndLoad()`'s `store()`, both stores write the same content to the same endpoint (harmless duplicate) and both `finally` blocks reset `isSaving` to `false`.

### Tests
- **`src/__tests__/EditorCanvas.test.tsx`** (new, 4 tests) — T647 regression suite using real Zustand store + mocked `initEditor`: T647.1 verifies `saveError` receives the rejection message and `isSaving` resets to `false`; T647.2 verifies success path leaves `saveError` null and calls `load()` twice; T647.3 verifies non-`Error` rejection produces fallback message `'Pre-navigation save failed'`; T647.4 verifies initial mount does not call `store()`.
- **716 unit tests pass** (4 new T647 tests included).

---

## [0.5.50] — 2026-04-17 — T646: Fix initEditor leaks — dragstart cleanup, autosaveTimer guard, ghost rAF isUnmounted (Phase 10)

### Fixed
- **[T646.1/T646.3] `dragstart` listener leak eliminated** (`packages/authoring-ui/src/editor/initEditor.ts`) — Prior to this fix, every `initEditor()` call added a new `dragstart` handler to `blockManagerContainer` without ever removing it. After 3–4 course navigations, multiple handlers fired simultaneously, mutating the drag ghost redundantly. Fix: extracted handler as a named `dragstartHandler` const, registered once via `blockContainer?.addEventListener('dragstart', dragstartHandler)`, and removed in `cleanup()` via `blockContainer?.removeEventListener('dragstart', dragstartHandler)`. The `blockContainer` reference is captured once at init time.
- **[T646.1/T646.2] `autosaveTimer` fires after `editor.destroy()` — prevented** — A 2-second debounced autosave timer started by a `component:update` event could fire after the component unmounted (mid-debounce navigation). Fix: `cleanup()` calls `clearTimeout(autosaveTimer)` before `editor.destroy()` is called by `EditorCanvas`. The `isUnmounted` flag additionally guards any rAF callbacks that could still be in-flight.
- **[T646.4] Drag ghost DOM removal race fixed** — Replaced `try/catch` fallback for `document.body.removeChild(ghost)` with `if (ghost.isConnected) document.body.removeChild(ghost)`. Added `isUnmounted` boolean flag (set to `true` in `cleanup()`) that guards the `requestAnimationFrame` callback — if the editor is destroyed before the rAF fires, the ghost removal is skipped entirely.
- **[T646.5] `_isEditorLoading` kept as module-level flag** — Decision documented in `decisions/2026-04-17-editor-loading-flag.md`. The flag cannot be moved to React/Zustand because GrapesJS fires `component:add` synchronously during `loadData()`, before React state updates can propagate — the guard must be synchronous and module-scoped.

### Tests
- **`src/__tests__/initEditor.test.ts`** — 4 T646.6 tests added (`describe('T646.6 — initEditor cleanup lifecycle')`): T646.6.1 verifies `removeEventListener('dragstart')` called exactly once on `cleanup()`; T646.6.2 verifies a pending autosave timer is cancelled — `editor.store()` not called after `cleanup()` + `vi.runAllTimers()`; T646.6.3 verifies `addEventListener` count stays `=== 1` across 3 init/destroy cycles (no accumulation); T646.6.4 verifies `document.body.removeChild` is NOT called after `cleanup()` + `vi.runAllTimers()` (isUnmounted guard). Uses `vi.useFakeTimers()` + `querySelectorSpy.mockRestore()` in afterEach (NOT `vi.restoreAllMocks()` — would reset module-level mock implementations).
- **712 unit tests pass** (4 new T646.6 tests included).

---

## [0.5.49] — 2026-04-17 — T645: Eliminate storageManager singletons — StorageContextProvider DI (Phase 10)

### Refactored
- **[T645] `storageContext` singleton eliminated** (`packages/authoring-ui/src/editor/storageManager.ts`) — Replaced the three module-level singletons (`storageContext`, `updateStorageContext`, `getStorageContext`) and the imperative `invalidateCourseCache()` function with a `StorageContextProvider` interface. The provider is instantiated in `initEditor.ts` and passed into `registerStorageManager(editor, provider)`. `storageManager.ts` now has no Zustand import — context is injected via DI. Context is read at `load()`/`store()` invocation time via `provider.getContext()` (synchronous Zustand `getState()` call), preserving the race-condition guard for fast navigation.
- **[T645.3.4] Context captured synchronously at call time** — `provider.getContext()` returns the live Zustand slice at the moment `load()`/`store()` executes, not a stale snapshot from registration time. Prevents courseId/slideId desync on fast slide navigation.
- **[T645.3.5] `courseCache` lifecycle strictly tied to provider** — Cache is now exclusively managed inside `registerStorageManager`. Invalidation is driven by `provider.onCacheInvalidate(callback)` — a Zustand `subscribe` callback that fires whenever `bumpCacheVersion()` is called in the store.
- **[T645.4] `bumpCacheVersion()` replaces `invalidateCourseCache()`** (`packages/authoring-ui/src/store/editorStore.ts`) — New Zustand action increments `cacheVersion` counter. The `onCacheInvalidate` subscriber in `registerStorageManager` detects the version bump and resets `courseCache = null`.
- **[T645.5] All callers updated** — `EditorCanvas.tsx`, `TopToolbar.tsx`, `SlideList.tsx` call `bumpCacheVersion()` in place of `invalidateCourseCache()`. `initEditor` return type changed from `Editor` to `{ editor: Editor; cleanup: () => void }` — cleanup wraps `unsubscribeCacheInvalidate()` and is designed to be extended by T646 (autosaveTimer + dragstart).
- **[T645.7] Cleanup wrapper in `initEditor.ts`** — Explicit `cleanup()` function returned alongside `editor`. Stale autoload comment corrected to reflect the current `setEditorContext()` / `provider.getContext()` path. Designed for T646 extensibility.

### Tests
- **`src/__tests__/storageManager.test.ts`** — Rewritten to use `makeProvider()` helper (returns `{ provider, setContext, triggerInvalidate }`). `beforeEach` resets `courseCache` via immediate-callback provider. 16 tests covering: load cache-hit/miss, store cache update, cache invalidation via `triggerInvalidate`, early guard (missing courseId/slideId), corrupt-slides guard, error paths.
- **`src/__tests__/initEditor.test.ts`** — Zustand mock extended with `subscribe`, `bumpCacheVersion`, `cacheVersion`. Return type assertion: `expect(result.editor).toBe(fakeEditor)`.
- **All 708 unit tests pass.** No live calls to old API (`updateStorageContext`, `getStorageContext`, `invalidateCourseCache`) remain — confirmed by grep.

---

## [0.5.48] — 2026-04-17 — T644: Fix PhaserSimPropertiesPanel — align with panel pattern (Phase 10)

### Fixed
- **[T644.1] `PhaserSimPropertiesPanel` bypassed `useComponentProperty`** (`packages/authoring-ui/src/components/sidebar/PhaserSimPropertiesPanel.tsx`) — Panel was the only one that read `extendedProperties` via direct `getExtendedProps(selected)` call instead of subscribing to the Backbone `change:extendedProperties` event. Result: undo/redo did not re-render the panel and a selection-change stale read was possible. Fix: replaced with `useComponentProperty<PhaserSimExtendedProps>(selected, 'extendedProperties', PHASER_SIM_DEFAULT_EXTENDED)`. Panel split into null-guard outer shell + `PhaserSimPropertiesPanelInner` (all hooks in inner component).
- **[T644.2] `editor.store()` called directly from panel `update()`** — Violated the rule that only the debounced autosave path in `initEditor.ts` may call `editor.store()`. Removed; saves now flow through `comp.set()` → `component:update` → `triggerAutosave`.
- **[T644.3] `sceneDefJson` textarea out of sync after external Backbone mutation** — Previous design synced the textarea only on `onBlur` (React → Backbone direction). Undo/redo (Backbone → React direction) would update `ep.sceneDef` but leave the textarea showing stale JSON. Fix: `useEffect([ep.sceneDef])` resets `sceneDefJson` and clears `jsonError` whenever `ep.sceneDef` changes externally.

### Changed
- **[T644.7] `PhaserSimSceneDefEditor` converted to pure controlled component** — Removed internal `useState`/`useEffect`; all state owned by parent. Props renamed `initialValue`→`value`, `onJsonChange`→`onChange`.
- **[T644.7] `GjsComponent` type exported** (`packages/authoring-ui/src/hooks/useComponentProperty.ts`) — Was private; now exported so consumers can use it as a proper cast target.
- **[T644.7] Optimistic `setValue()` in `useExtendedProperty.update()`** — Adds `setValue(newValue)` before `comp.set()` for parity with `useComponentProperty`, ensuring controlled inputs never freeze on sub-key writes.

### Tests
- **`src/__tests__/sidebar/PhaserSimPropertiesPanel.test.tsx`** — 16 regression tests: T644.1 (4 undo/redo re-render scenarios), T644.2 (4 save-path + patch-merge tests including architectural proof that `editor.store()` is never called), T644.3 (5 textarea-sync scenarios), visibility guard (3 tests).
- **`src/__tests__/hooks/useComponentProperty.test.ts`** — `ChangeHandler` type rename; `ComponentMock` interface + explicit return type on `makeComponent`.

---

## [0.5.47] — 2026-04-12 — T643: Fix forEach crashes (GrapesJS loadData + validateSequence)

### Fixed
- **[T643.1] `phaser-sim` and `screenshot-sim` missing from `GENERATED_CONTENT_TYPES`** (`packages/authoring-ui/src/editor/converters.ts`) — Both widget types were absent from the positive allowlist that gates `GENERATED_CONTENT_TYPES`. On reload, `grapesjsFromWidgets()` set `def.content = props.content` (the saved `PLACEHOLDER_HTML` multi-element string) on these components. GrapesJS parsed the HTML into auto-generated child component defs that lacked `actions: []`, causing `componentDef.actions.forEach(...)` → `TypeError`. Fix: added `'phaser-sim'` and `'screenshot-sim'` to `GENERATED_CONTENT_TYPES`.
- **[T643.1] HTML content guard in `grapesjsFromWidgets()`** (`packages/authoring-ui/src/editor/converters.ts`) — `text` and `button` widgets that had RTE markup applied (e.g. `<b>...</b>`, `<a href="...">`) saved their `getInnerHTML()` result as `properties.content`. On reload `def.content` received raw HTML, GrapesJS parsed it into child defs without `actions: []`, same TypeError. Fix: `grapesjsFromWidgets()` now skips setting `def.content` when the stored value is an HTML string (detected via leading `<`).
- **[T643.2] Unguarded `forEach` in `validateSequence.ts`** (`packages/authoring-ui/src/utils/validateSequence.ts`) — Three call sites called `.forEach()` directly on fields that old MongoDB documents (saved before the current type schema) may not have. Fixed with optional chaining: `action.params.then?.forEach(...)` (line 90), `action.params.body?.forEach(...)` (line 102), `sequence.actions?.forEach(...)` (line 129). Crash was triggered at runtime by `ActionsPanel` rendering → `validateAllSequences` call whenever the user selected a widget.

### Tests
- **`src/__tests__/converters.test.ts`** — 7 regression tests for T643.1: (1–2) `phaser-sim` and `screenshot-sim` map to no `content` field in the GrapesJS def; (3) `text` widget with plain text string preserves content; (4) `text` widget with HTML string (`<b>hello</b>`) strips `def.content`; (5–6) same guards verified for `button` type; (7) roundtrip: widget saved with HTML content loads without TypeError.
- **`src/__tests__/validateSequence.test.ts`** — 3 regression tests for T643.2: (1) `sequence.actions` undefined (missing field in old doc) → no throw, 0 warnings; (2) `condition.then` undefined → no throw; (3) `loop.body` undefined → no throw.

---

## [0.5.46] — 2026-04-11 — T641: Preview popup wired + T611.10 linear-strict Next-button gating

### Fixed
- **[T641.1] `EditorPage.closeCourseSettings()` clicked Cancel instead of Save** (`e2e/pages/EditorPage.ts`) — `closeCourseSettings()` used regex `/close|cancel/i` which matched the "Cancel" button, so `navigationMode` changes were never persisted. Added `saveCourseSettings()` that explicitly clicks `data-testid="course-settings-save"` and waits for the dialog to hide. Updated T611.10 in `question-widget.spec.ts` to call `saveCourseSettings()` + await the PATCH response via `waitForResponse()`. Removed all DIAGNOSTIC evaluate blocks from Step 4.
- **[T641.1] `renderMCQuestion` / `evalMC` handle `MCOption[]` objects** (`packages/runtime-player/src/index.ts`) — authoring-ui stores MC options as `MCOption[]` (`{ id, text, isCorrect }`) but the runtime player treated `options` as `string[]`, crashing with `s.replace is not a function`. Both functions now extract `.text` and check `.isCorrect`.

### Tests
- **T611.10 passes** — `question-widget.spec.ts` T611.10 "Preview: Next button disabled until mandatory MC answered (linear-strict)" now passes in 30.4s. 30/30 question-widget E2E tests green. SKIP-01 (T611.10 previously skipped) resolved. 162 E2E tests: 160 passing, 2 skipped.

---

## [0.5.45] — 2026-04-11 — T640: StorageManager cache update fix + autoload:false docs + persistence flow guide

### Fixed
- **[T640.1] `store()` updates cache instead of invalidating it** (`packages/authoring-ui/src/editor/storageManager.ts`) — On a successful save, `courseCache` is now updated in-place with fresh widget data for the saved slide (immutable spread). `courseCache = null` is kept only in the `catch` block. Previously every successful `store()` cleared the cache, forcing a redundant `GET /courses/:id` on the next slide load. Now `load()` after a save always hits cache.

### Changed
- **[T640.2] Explicit `autoload:false` / `autosave:false` comments** (`packages/authoring-ui/src/editor/initEditor.ts`) — Replaced the sparse `R-03` reference with inline "INTENTIONAL — do NOT change to true" comments on each flag, documenting the double-load race (`autoload:true`) and undo-flood (`autosave:true`) root causes. (T640.2)

### Docs
- **[T640.4] Persistence flow guide** (`docs/developer-guide/08-persistence-flow.md`) — New developer guide chapter covering the full edit→save→cache→load pipeline: source-of-truth boundary table, 8-step walk-through (component:update → triggerAutosave 2s debounce → editor.store() → widgetsFromGrapesjs → thumbnail generation → PATCH /courses/:id/slides/:slideId → courseCache update → cache hit on next load), `autoload:false`/`autosave:false` rationale, cache lifecycle table, ASCII sequence diagram, failure modes table, and key-files reference. Linked from `docs/developer-guide/index.md`.
- **[T640.6] Persistence flow guide corrections** (`docs/developer-guide/08-persistence-flow.md`) — 5 inaccuracies corrected after manual cross-check against source code: (1) Step 4 snippet now uses `editor.getComponents().toArray()` (closure capture, not `gjsData.components`); (2) New Step 5: thumbnail generation with isolated try-catch, PATCH payload corrected to `{ widgets, thumbnail }`; (3) `load()` pseudo-code now includes the required `{ pages: [...], styles: [] }` GrapesJS wrapper; (4) Key Files table: `widgetConverters.ts` → `converters.ts`; (5) Source-of-truth rule nuanced re: intentional `SaveErrorBanner` retry exception.

### Tests
- **`src/__tests__/storageManager.test.ts`** — Replaced `T042.5: invalidates cache after successful store()` with two T640.1 regression tests: (1) `getCourse` called only once across a full load → store → load sequence (no redundant fetch); (2) `grapesjsFromWidgets` receives the freshly-saved widgets (not pre-store stale values) — BUG-T640 regression guard. Added T640.3 multi-slide regression: `getCourse` called exactly once across load → store → switch B → switch A; slide A returns saved widgets after the round-trip. **21 unit tests green.**
- **[T640.11] Code-review fixes** (`storageManager.ts`, `initEditor.ts`, `storageManager.test.ts`) — Resolved all 7 issues from T640.7 reviewer report: (H-01) Added inline comment documenting JS single-threaded guarantee and Worker Threads caveat in cache update block; (H-02) Added `Array.isArray(courseCache.doc.slides)` guard — clears cache on corrupt data instead of crashing `.map()`; (M-01) Expanded `autoload: false` comment with full 6-step race sequence (init → blank load → EditorCanvas load → correct load → race result: blank canvas); (M-02) Added clarifying comment that `courseCache.doc` is non-null by outer if-guard and TypeScript type; (M-03) Moved `invalidateCourseCache()` to outer `beforeEach` fixture for consistent test isolation; (L-01) Applied in previous session — comment now names PATCH request and failure types; (L-02) Updated `autosave: false` comment: "every command including every keystroke in text widgets and every component add/remove." **686 tests green.**

---

## [0.5.44] — 2026-04-10/11 — T639: Fix stale-closure in extendedProperties property panels (T639.1–T639.11)

### Changed
- **`UsePropertyReturn<T>` named labeled tuple** (`packages/authoring-ui/src/hooks/useComponentProperty.ts`) — Shared return type `[value: T, update: (value: T) => void, getLatest: () => T]` for both `useComponentProperty` and `useExtendedProperty`. Removes the implicit inline tuple contract and makes the 3-element signature self-documenting. (T639.11 HIGH-01)
- **`useComponentProperty` returns `getLatest()` getter** — Third element of the return tuple is `() => T`: a stable getter that reads `latestRef.current` and always returns the most-recently committed value, regardless of React closure age. No behaviour change to existing callers — the getter is opt-in. (T639.1)
- **`useExtendedProperty` also exposes `getLatest()`** — The singular-key hook now returns a 3-tuple with the same getter semantics as `useComponentProperty`. Callers that need stale-closure protection for sub-key reads no longer require Backbone coupling. (T639.11 HIGH-02)
- **`AnimationExtendedProps` typed interface** (`packages/authoring-ui/src/components/sidebar/AnimationPropertiesPanel.tsx`) — Replaces `Record<string, unknown>` generic; `animations?: AnimationPath[]` is now fully typed. Removes the `as AnimationPath[]` unsafe cast; `ep.animations ?? []` is typed correctly. `DEFAULT_ANIMATION_EP` replaces the opaque `EMPTY_EP` constant. (T639.11 MEDIUM-01, LOW-02)
- **`em.loadData` block scoping removed** (`packages/authoring-ui/src/editor/initEditor.ts`) — Unnecessary IIFE-style block around the monkey-patch inlined at function scope; no isolation benefit since `const` is block-scoped anyway. (T639.11 MEDIUM-02)

### Fixed
- **`useExtendedProperties` stale-closure eliminated** (`packages/authoring-ui/src/components/sidebar/QuestionPropertiesPanel.tsx`) — `update(patch)` now calls `getLatest()` instead of spreading over the closure `ep`. Supersedes the T621 workaround. (T639.2)
- **`AnimationPropertiesPanel` `save()` stale-closure fixed** (`packages/authoring-ui/src/components/sidebar/AnimationPropertiesPanel.tsx`) — `save(updated)` now calls `{ ...getLatestEp(), animations: updated }`. (T639.4)
- **[T639.8] GrapesJS destroy/load race condition** (`packages/authoring-ui/src/editor/initEditor.ts`) — `editor.destroy()` calls Backbone's `this.clear({ silent: true })`, wiping ALL model attributes including `storables`. If `editor.load()` was in-flight when `destroy()` ran, `loadData(result)` crashed: `this.storables.forEach(...)` — `storables` was `undefined`. Fix: monkey-patch `em.loadData` to check `em.destroyed`; silently no-ops on destroyed editors. Triggered by React 18 StrictMode double-invoke and courseId navigation.
- **Ghost element `removeChild` guarded** (`packages/authoring-ui/src/editor/initEditor.ts`) — `requestAnimationFrame(() => document.body.removeChild(ghost))` wrapped in `try/catch` to handle the element being removed before the frame fires. (T639.11 LOW-04)
- **Scoring sub-patch callbacks use `getLatest().scoring`** — All three question form scoring callbacks read fresh EP via `getLatest()` before patching the `scoring` sub-key, eliminating the same stale-closure risk in score fields. (T639.10)
- **Caller-contract comment added** (`QuestionPropertiesPanel.tsx`) — Documents that `useExtendedProperties` callers must pass defaults matching the widget type; enforced at render by `isQuestionWidgetType` guard. (T639.11 HIGH-03)
- **`ep.scoring` defaults guarantee documented** (`QuestionPropertiesPanel.tsx`) — Inline comment before `ScoringFeedbackForm` confirms `ep.scoring` is never undefined (guaranteed by `MC_DEFAULT_EXTENDED`). (T639.11 MEDIUM-04)
- **Hook comments reference T639.1** (`useComponentProperty.ts`) — Stale T620/T621 task references updated throughout. ESLint disable lines annotated with explanatory comments. (T639.11 LOW-01, LOW-05)

### Docs
- **`CLAUDE.md`** — New section "GrapesJS + React Hook Rules" documents the patch-merge rule: never spread over a closure variable, always use `getLatest()`. Includes wrong/correct code examples.
- **`.claude/skills/elearn-e2e-qa/SKILL.md`** — New "GrapesJS Property Panel — Stale Closure Rule (T639)" section.
- **`docs/developer-guide/03-adding-widget-types.md`** — Step 6 updated with "Stale-closure rule (critical — T639)" subsection.
- **`docs/issues/issues-T639.md`** — Full T639.11 code-review table (0 CRITICAL, 3 HIGH, 4 MEDIUM, 6 LOW); all 13 issues resolved; APPROVED verdict recorded.

### Tests
- **`src/__tests__/hooks/useComponentProperty.test.ts`** — `useComponentProperty — getLatest() (T639)` describe block: 6 tests including primary patch-merge regression (two sequential updates on different EP fields both survive). `useExtendedProperty — getLatest() (T639)` describe block: 4 tests covering getter function, mount value, update reflection, external model change. **684 unit tests green** (up from 680). (T639.7, T639.11 MEDIUM-03)
- **`e2e/tests/question-widget.spec.ts`** — `T639.8` describe block: rapid consecutive property-panel updates (question text + add option) survive page reload. All 162 Playwright E2E tests pass. (T639.8)

### Notes
- Other panels audited and confirmed unaffected: `ButtonPropertiesPanel`, `MediaPlayerPropertiesPanel`, `AudioNarrationPropertiesPanel`, `ProgressBarPropertiesPanel`, `VolumeControlPropertiesPanel`.
- Code review (T639.11): **APPROVED** — 0 CRITICAL, 3 HIGH, 4 MEDIUM, 6 LOW, all resolved.

---

## [0.5.43] — 2026-04-10 — T638: Fix typography changes not applying to score widgets

### Fixed
- **[T638] Quiz Score / Score Field: Style Manager typography changes now apply immediately** (`packages/authoring-ui/src/editor/registerBlocks.ts`) — `font-size` and `color` set via Style Manager had no visual effect because `onRender()` injected hardcoded inline styles that overrode GrapesJS CSS rules. Root cause: inline `style="font-size:Xpx;color:#..."` on inner elements had higher CSS specificity than the component's CSS rule. Fix: removed all inline `font-size`/`color` from `onRender()` output; GrapesJS applies `setStyle()` to `el` via a CSS rule and inner elements inherit automatically. The `change:style` Backbone listener (initial fix attempt, d22fb16) was unreliable in the production minified build — removed. Only the `change:attributes` listener (for `quizTitle`/`scorePrefix` traits) was kept.
- **[T638] Widget titles editable via trait** — `quizTitle` trait added to `score-quiz`; `scorePrefix` trait added to `score-field`. Both render their trait values in `onRender()`.

### Tests
- **`e2e/tests/score-widgets.spec.ts`** — 5 `@regression` tests: T638.5a (score-quiz font-size immediate update), T638.5b (score-quiz reload persistence), T638.5c (score-quiz quizTitle trait), T638.5d (score-field font-size immediate update), T638.5e (score-field scorePrefix trait). All pass in CI production build.

---

## [0.5.42] — 2026-04-09 — T636: Cross-slide copy/paste with module-level clipboard

### Added
- **T636 — Module-level clipboard** (`packages/authoring-ui/src/editor/clipboard.ts`) — `setClipboard`/`getClipboard`/`clearClipboard` backed by `let _clipboard` module-level variable that survives GrapesJS `editor.load()` calls during slide navigation (editor is NOT recreated on slide switch).
- **T636 — `elearn:copy` command** — Reads `ed.getSelected()`, stores `{ style, definition }` in the module clipboard.
- **T636 — `elearn:paste` command** — Reads clipboard, calls `ed.getComponents().add(entry.definition)`, restores `left/top/width/height` via `comp.addStyle()`.
- **T636 — Keymaps** — `ctrl+c` → `elearn:copy`, `ctrl+v` → `elearn:paste` registered via `editor.Keymaps.add`.

### Tests
- **`e2e/tests/copy-paste-widget.spec.ts`** — 3 `@regression` tests: widget position preserved after cross-slide paste, slide 2 gains component after paste, slide 1 count unchanged after paste. Tests use `runCommand` directly (bypasses keyboard focus issues) to isolate clipboard logic.

---

## [0.5.41] — 2026-04-07 — Issues housekeeping: T611/T612/T634 fully closed

### Fixed
- **T611 M-01 — `slideIsComplete()` JSDoc** (`packages/runtime-player/src/index.ts`) — Removed garbled `//` prefix inside the JSDoc block; note about Map-absence semantics consolidated into a clean sentence. Added inline comment `// Missing entry means unanswered; answered must be explicitly true` at the `!qs?.answered` check site.
- **T611 M-02 — Consistent optional chaining in `handleSubmit()`** (`packages/runtime-player/src/index.ts:810`) — `ep?.scoring as QuestionScoringInfo | undefined` replaces the previous inconsistent cast, matching the pattern used throughout the file.

### Docs
- **`docs/issues/issues-T611.md`** — All 7 items (H-01, H-02, M-01–M-03, L-01–02) marked RESOLVED. Verdict updated to APPROVED. Resolution log added.
- **`docs/issues/issues-T612.md`** — All 6 items (HIGH-01/02, MEDIUM-01/02, LOW-01/02) marked RESOLVED. Verdict updated to APPROVED. Resolution log added.
- **`docs/issues/issues-T634.md`** — M-01 (`NavButtonChildDef` interface), L-01 (comment deduplication), L-02 (`NAV_BUTTON_DEFAULTS` constant) marked RESOLVED with resolution notes.

---

## [0.5.40] — 2026-04-07 — T635: Add SCORM format selector to PublishDialog

### Added
- **T635 — Export format selector** (`packages/authoring-ui/src/components/layout/PublishDialog.tsx`) — Radio group lets authors choose between SCORM 1.2, SCORM 2004, and AICC before packaging. `ExportFormat = 'scorm12' | 'scorm2004' | 'aicc'` exported from `PublishDialog`. SCORM 1.2 selected by default; confirm button label updates dynamically (`Publish SCORM 1.2` / `Publish SCORM 2004` / `Publish AICC`). Per-format descriptions: "Widest LMS support — recommended for most deployments" / "Modern sequencing & branching; requires a SCORM 2004-compliant LMS" / "Legacy HACP format for older LMS systems".
- **T635 — `exportSCORM2004` + `exportAICC` API functions** (`packages/authoring-ui/src/api/courseApi.ts`) — Shared `triggerZipDownload` helper eliminates per-format duplication in blob download logic. `onConfirm` signature updated to `(format: ExportFormat) => void` throughout `AppLayout.tsx`.
- **T635 — Backend export routes** (`backend/api/src/routes/courses.ts`) — `POST /courses/:id/export/scorm2004` and `POST /courses/:id/export/aicc` added with same pattern as existing scorm12 route (rate-limited, asset rewriting, cleanup).

### Tests
- **`e2e/tests/scorm-export.spec.ts`** — 5 new `@regression T635` tests: all 3 format options visible, SCORM 1.2 selected by default, SCORM 2004 label update, AICC label update, SCORM 2004 end-to-end ZIP download.

---

## [0.5.39] — 2026-04-05 — T634: Fix nav-buttons "missing child buttons" error

### Fixed
- **T634 — Nav Buttons child components** (`packages/authoring-ui/src/editor/registerBlocks.ts`) — Replaced `onRender()` HTML injection with `defaults.components` so GrapesJS registers the prev/next buttons as proper Component objects. `component.components().at(0/1)` now returns the child components, eliminating the "Nav Buttons component is missing child buttons" error in the Props panel.
- **T634 — Label persistence** (`packages/authoring-ui/src/editor/converters.ts`) — `widgetsFromGrapesjs` saves child button text as `prevLabel`/`nextLabel` in widget properties; `grapesjsFromWidgets` restores them as `def.components` child content on load. Backward compatible: widgets saved without labels fall back to `'← Previous'` / `'Next →'`.

### Tests
- **`packages/authoring-ui/src/__tests__/converters.test.ts`** — 6 new regression tests for T634: child label save/restore, backward compat, `actions: []` requirement, non-nav-buttons unchanged.
- **`e2e/tests/nav-buttons-widget.spec.ts`** — 3 new E2E tests: Props panel shows label inputs (not error), canvas renders two buttons with default labels, label edits update canvas.

---

## [0.5.38] — 2026-04-05 — T633: Fix button background image (cover/no-repeat + preserve position)

### Fixed
- **T633.1 — `ButtonPropertiesPanel.tsx`** — Switched `openBackgroundImagePicker` from `component.setStyle()` (replace) to `component.addStyle()` (merge) so that `left`, `top`, `width`, `height` are preserved when a background image is assigned.
- **T633.2 — Missing background-size/repeat/position** — `addStyle()` call now sets `background-size: cover`, `background-repeat: no-repeat`, and `background-position: center` alongside `background-image`.
- **T633.3 — Remove Image clears all background properties** — "Remove Image" button now destructures and removes `background-size`, `background-repeat`, and `background-position` in addition to `background-image`.

### Tests
- **`e2e/tests/button-widget.spec.ts`** — `@regression T633.4`: New E2E test verifies `addStyle()` preserves button position (`left/top/width`) and correctly sets `background-size:cover` + `background-repeat:no-repeat`.

---

## [0.5.37] — 2026-04-05 — T632: Fix asset picker type for Media Player and Audio Narration

### Fixed
- **T632 — Asset picker type detection** (`packages/authoring-ui/src/editor/assetManager.ts`) — `detectAssetType()` helper maps file extension to `'video'`, `'audio'`, or `'image'`. All uploaded assets now tagged with the correct GrapesJS type so `AssetManager.open({ types: [...] })` filtering works.
- **`MediaPlayerPropertiesPanel.tsx`** — AM picker now passes `['audio','image']` or `['video','image']` based on the widget's current `mediaType` property.
- **`AudioNarrationPropertiesPanel.tsx`** — AM picker changed from `types: ['image']` to `types: ['audio', 'image']`.

---

## [0.5.36] — 2026-04-05 — T631: MC/TF/Fill correct-answer persistence regression test

### Fixed
- **T631 — Confirm T621 stale-closure fix is complete** — Verified `useExtendedProperties.update()` already reads from `comp.get('extendedProperties')` (synchronous Backbone model, always current) per T621. No additional code change required.

### Added
- **`e2e/tests/question-widget.spec.ts`** — `@regression T631.6`: New E2E test verifies MC correct-answer (Option B radio) persists through full autosave + page reload cycle. Reads `window.__elearn_editor.getSelected().get('extendedProperties')` to assert model state both before save and after reload.

---

## [0.5.35] — 2026-04-04 — Phase 2.8: Authoring UI Hardening (CRÍTICO-01 through CRÍTICO-04)

### Fixed
- **T620 — Optimistic update in `useComponentProperty`** (`packages/authoring-ui/src/hooks/useComponentProperty.ts`) — `setValue(newValue)` now fires before `comp.set()` so controlled inputs never freeze or bounce back. Added `latestRef = useRef(value)` to track latest state and prevent stale closures in the `update()` callback.
- **T621 — Stale closure in `useExtendedProperties`** (`packages/authoring-ui/src/components/sidebar/QuestionPropertiesPanel.tsx`) — `update(patch)` now reads `comp.get('extendedProperties')` directly (synchronous Backbone read, always current) rather than spreading over the stale closure variable `ep`. Eliminates data loss on rapid cascading edits (add option + change question text in quick succession).
- **T622 — Persistent save error banner** (`packages/authoring-ui/src/components/ui/SaveErrorBanner.tsx`, `AppLayout.tsx`, `TopToolbar.tsx`, `SlideList.tsx`) — New `SaveErrorBanner` component renders a permanent `role="alert"` red banner below TopToolbar when `saveError !== null`. Retry button calls `editor.store()`, clears error optimistically on success, updates message on failure. Slide navigation blocked while error is active. TopToolbar shows "Save failed" badge.
- **T623 — Prototype chain hack in image widget** (`packages/authoring-ui/src/editor/registerBlocks.ts`) — Replaced `Object.getPrototypeOf(Object.getPrototypeOf(this)).initialize.call(this, props)` with `extendFnView: ['initialize']`, letting GrapesJS call parent `initialize()` automatically via its public extension API.

### Added
- **`packages/authoring-ui/src/__tests__/SaveErrorBanner.test.tsx`** — 5 unit tests: renders nothing when saveError null; renders banner when saveError set; retry success clears banner; retry failure updates message; no-op when editor is null.

---

## [0.5.34] — 2026-04-04 — C-03: SCORM export asset bundling + path rewriting

### Fixed
- **`backend/api/src/routes/courses.ts`** — Full 4-step asset pipeline already present: `collectAssetSrcs()` extracts `/assets/<uuid>.ext` from all slide widgets; `downloadAssets()` streams each object from Garage S3 to a tmpdir; `rewriteAssetSrcs()` deep-clones the course replacing absolute `/assets/` prefixes with relative `assets/` paths; `packSCORM12(rewrittenCourse, tmpDir, { assetPaths })` bundles all assets into the ZIP.

### Added
- **`packages/scorm-packager/src/__tests__/index.test.ts`** — C-03 gate tests (2 new tests, total 46):
  - **C-03a** — verifies asset file is present in ZIP at `assets/<uuid>.png`
  - **C-03b** — verifies `index.html` contains relative `assets/<uuid>.png` and NOT `/assets/<uuid>.png`

### Technical note
Gate of closure per audit-consolidado: "packSCORM12 embeds relative asset paths and all referenced assets are present in the ZIP." Audit consolidado 100% resuelto: C-01 ✅ C-02 ✅ C-03 ✅ D-01 ✅ D-02 ✅.

---

## [0.5.33] — 2026-04-04 — C-02: sharedSequences end-to-end (backend + shared-types + runtime)

### Fixed
- **`backend/api/src/models/Course.ts`** — added `SharedActionSequenceSchema { name, actions }` and `sharedSequences: [SharedActionSequenceSchema]` (default `[]`) to `CourseSchema`. Added `sharedSequences` to `CourseUpdatePayload` allowlist in `PUT /courses/:id`.
- **`packages/shared-types/src/course.ts`** — `CourseDoc.sharedSequences?: SharedActionSequence[]` already present from D-01 (v0.5.31).
- **`packages/runtime-player/src/index.ts`** — actions context initialised with `course.sharedSequences ?? []`, enabling `call-sequence` to look up sequences by name.

### Added
- **`backend/api/src/__tests__/courses.test.ts`** — C-02 regression test: persists and returns `sharedSequences` via PUT/GET round-trip.

### Technical note
`call-sequence` action was conceptually implemented but functionally dead (sharedSequences never persisted by backend nor passed to runtime). All three layers now complete. E2E verified by C-01.3 in `e2e/tests/runtime-player-actions.spec.ts` (passes a `sharedSequences` array and asserts the resulting DOM mutation). 131 API tests pass. Commit: `5c59d6d`.

---

## [0.5.32] — 2026-04-04 — C-01: wire actions engine E2E gate (show/hide/call-sequence)

### Fixed
- **`renderWidget()` invisible widget bug** (`packages/runtime-player/src/index.ts`) — widgets with `visible: false` were omitted from the DOM entirely (`return ''`), making `show` actions a silent no-op. Now rendered with `style="display:none"` and `data-hidden="true"` so `executeShow()` can find and reveal them.
- **`slideRenderer.test.ts`** — updated test `'does not render invisible widgets'` to assert the new correct behaviour: element is present in DOM, `style.display === 'none'`, `data-hidden === 'true'`.

### Added
- **`e2e/tests/runtime-player-actions.spec.ts`** — C-01 E2E regression gate. Reads the built `dist/player.js`, inlines it into a bare HTML page via `page.setContent()`, injects a crafted course JSON, and asserts DOM mutations produced by the actions engine. Three tests:
  - C-01.1 — hide action sets `display:none` + `data-hidden="true"` on button click
  - C-01.2 — show action removes `display:none` / `data-hidden` on an initially-hidden widget
  - C-01.3 — call-sequence action executes a `sharedSequence` that calls hide

### Technical note
All 256 runtime-player unit tests + 3 new C-01 E2E tests pass (481ms / 259ms / 296ms). Gate of closure per audit-consolidado: "show/hide and call-sequence executed by the real runtime player, verified with an E2E test that checks the resulting DOM."

---

## [0.5.31] — 2026-04-04 — D-01: introduce @elearn-studio/shared-types as monorepo type authority

### Refactored
- **New package `packages/shared-types/`** — Single source of truth for all domain types shared across the monorepo: `WidgetType`, `BaseWidget`, `Bounds`, `CourseDoc`, `Slide`, `SlideTemplate`, `Resource`, `CourseSettings`, `SCORMMetadata`, `NavigationMode`, `SharedActionSequence`, `ActionSequence`, and all question types (`QuestionType`, `MCExtendedProperties`, `TFExtendedProperties`, `FillExtendedProperties`, `MC_DEFAULT_EXTENDED`, `TF_DEFAULT_EXTENDED`, `FILL_DEFAULT_EXTENDED`). Prior to D-01 these were defined in `authoring-ui/src/types/` and duplicated or re-exported ad-hoc in other packages.
- **Dual CJS + ESM build** — `packages/shared-types/package.json` adds `"module": "dist/esm/index.js"` alongside `"main": "dist/index.js"`. `tsconfig.esm.json` builds the ESM output (`module: ESNext`, `moduleResolution: Bundler`) so Vite/Rollup consumers (authoring-ui) can statically analyse named exports. Node.js consumers (backend, scorm-packager) use the CJS output.
- **Migrated consumers** — `authoring-ui`, `backend/api`, `runtime-player`, and `scorm-packager` all updated to import domain types from `@elearn-studio/shared-types`. Local type definitions removed where they duplicated shared-types.
- **`CourseDoc` optional fields** — `templates?`, `resources?`, `sharedSequences?`, `deletedAt?`, `createdAt?`, `updatedAt?`, `passingScore?`, `masteryScore?` made optional to match real test fixtures and allow intentional fallback tests.
- **`WidgetType` export** — `scorm-packager/src/index.ts` now re-exports `WidgetType` so test helpers can type `makeWidget(type: WidgetType)` without widening to `string`.

### Technical note
24 files changed, 790 insertions(+), 850 deletions(−). All 1444 tests across 8 packages pass. Pre-existing TS2367 warnings for `widget.type === 'question-arrange'` / `'question-order'` in runtime-player (these types not yet in `WIDGET_TYPES`) left as-is — build succeeds with warnings; to be addressed when those widgets are implemented.

---

## [0.5.30] — 2026-04-04 — GrapesJS-React refactor: eliminate isLocalRef pattern

### Refactored
- **AnimationPropertiesPanel** (`packages/authoring-ui/src/components/sidebar/AnimationPropertiesPanel.tsx`) — Split into outer (`AnimationPropertiesPanel`, null guards only) and inner (`AnimationPanelContent`, receives non-null `Component`) components. Fixes null-safety crash where `component as never` cast would call `.get()` on null. Removed direct `editor.store()` call; persistence handled by debounced autosave in `initEditor.ts`.
- **QuestionPropertiesPanel** (`packages/authoring-ui/src/components/sidebar/QuestionPropertiesPanel.tsx`) — Replaced 49-line local `useExtendedProperties<T>` hook (which contained the `isLocalRef` / `useRef(false)` flag, `useState`, `useEffect`, and `useRef` imports) with a 7-line thin wrapper delegating to `useComponentProperty`. Public API preserved — `MCPropertiesForm`, `TFPropertiesForm`, and `FillPropertiesForm` unchanged.

### Completed
- **`isLocalRef` pattern fully eliminated** — All 6 property panels (`ButtonPropertiesPanel`, `AudioNarrationPropertiesPanel`, `MediaPlayerPropertiesPanel`, `ProgressBarPropertiesPanel`, `AnimationPropertiesPanel`, `QuestionPropertiesPanel`) now use shared hooks `useComponentProperty<T>` / `useExtendedProperty<T>` from `packages/authoring-ui/src/hooks/useComponentProperty.ts`. The `isLocalRef` / `useRef(false)` anti-pattern is gone from the entire `authoring-ui` codebase.

### Technical note
React 18 automatic batching renders all `setState` calls (including those triggered by Backbone `change:*` events) in the same microtask. The `isLocalRef` guard was used to suppress re-entry when `component.set()` fired `change:extendedProperties` synchronously — no longer needed. Removing it simplifies the subscription pattern and eliminates a class of subtle stale-closure bugs.

644 unit tests pass.

---

## [0.5.29] — 2026-04-04 — Audit consolidado: close A-01/A-05/A-06/A-07/D-03/D-04/D-05

### Fixed
- **A-06**: Replaced misleading "atomic single write" comment in `PATCH /courses/:id/slides/reorder` with accurate note documenting the read-then-write race condition and its low practical risk (`backend/api/src/routes/courses.ts`)
- **D-03**: Deleted debug/test files from repo root (`checkauth.php`, `checklockout.php`, `debug-moodle-*.js`, `directlogin.php`, `disable-tours.php`, `fixlogin.php`, `testauth.php`, `testlogin.php`) — files were untracked and already covered by `.gitignore`
- **D-05**: Deleted stale `rollup.config-*.mjs` temp files from `packages/runtime-player/` — untracked, already in `.gitignore`

### Confirmed closed (fixed in prior sessions, verified this session)
- **A-01**: `uploadAsset()` already uses `apiFetch` from `apiClient.ts` with 401+refresh handling
- **A-05**: DELETE slide already returns 404 when `slideId` not found; regression test present in `courses.test.ts`
- **A-07**: `/auth/login` already returns generic `'Internal server error'` without leaking internal message
- **D-04**: `openapi.json` and `generated.ts` were never committed; already covered by `.gitignore`

---

## [0.5.28] — 2026-04-04 — Phase 2.7 issue cleanup + docs

### Fixed
- **T611 M-02**: Replaced ad-hoc `{ mandatory?: boolean }` inline cast with a shared `QuestionScoringInfo` interface used consistently across `slideIsComplete()` and `handleSubmit()` (`packages/runtime-player/src/index.ts`)
- **T611 M-03**: Added `mandatory: false` to all three default question scoring configs (`MC_DEFAULT_EXTENDED`, `TF_DEFAULT_EXTENDED`, `FILL_DEFAULT_EXTENDED` in `packages/authoring-ui/src/types/questions.ts`) — ensures MongoDB serialisation always includes the field
- **T611 L-01**: Added clarifying comment to `goNext()`: defensive check is intentional even though `updateNavButtons()` also gates the button
- **T611 L-02**: Expanded `slideIsComplete()` JSDoc to document mandatory field absence semantics and MongoDB persistence behaviour
- **T612 MEDIUM-01**: Wrapped `goToSlide(state, i)` in try-catch inside `finishCourse()` to prevent an unhandled navigation error from breaking the finish gate
- **T612 MEDIUM-02**: `restoreSuspendData()` in `suspend.ts` now logs a `console.warn` when out-of-bounds visited slide indices are dropped (course edited since last session)
- **T612 LOW-01**: Updated `finishCourse()` comment to read "Find the first unvisited slide (lowest index)"
- **T612 LOW-02**: Added module-level `_noNavNextWarned` flag to `index.ts` so the "no nav-next buttons found" warning fires at most once per player session

### Documentation
- `docs/user-guide/09-publishing.md`: Added **Navigation Mode** section explaining Free vs Linear-strict, LMS TOC behaviour, `imsss:controlMode` table, and SCORM 1.2 note
- `docs/scorm-guide/scorm2004.md`: Added **Sequencing and Navigation Mode** section with controlMode table, XML examples, and single-SCO architecture note
- `docs/user-guide/05-questions.md`: Added **Mandatory questions** section describing the mandatory toggle and its interaction with linear-strict mode

---

## [0.0.1-beta] — 2026-03-29 — First Public Beta

First tagged release. Delivers a functional end-to-end authoring pipeline: visual slide editor (GrapesJS), question widgets, screenshot and Phaser simulations, SCORM 1.2/2004 export, Moodle validation, JWT auth, S3 asset storage, and a 73-test E2E suite. All CRITICAL and HIGH issues resolved. Known deferred items documented in `docs/issues/`.

### Included (cumulative from v0.0.1 through v0.5.8)

- Visual slide editor — GrapesJS canvas with drag-and-drop block placement, Layer Manager, Style Manager, Asset Manager
- Widget library — text, image, button, shape, media player, score display, navigation, Multiple Choice, True/False, Fill-in-the-Blank
- Screenshot simulation — Playwright-based recorder + hotspot-driven Konva.js replay player
- Phaser simulation — process flows, physics demos, gamified quizzes, concept animators, interactive diagrams
- Action Sequences — visual event→action builder with branching, show/hide, navigate, score
- SCORM 1.2 and SCORM 2004 export — compliant ZIP with imsmanifest.xml, sequencing
- AICC and xAPI export pipeline
- Moodle 4.x Docker validation target
- JWT authentication — register/login, refresh tokens, Bearer on all API routes
- Garage S3 asset storage — presigned upload/download, Asset Manager integration
- Observability stack — Pino→Loki, OTel→Tempo, Prometheus, Grafana
- 73-test Playwright E2E suite covering editor, persistence, questions, image upload, authoring UI layer
- Persistence fixes (BUG-T800-01 through BUG-T800-04) — race condition, text buffer, cross-course save, cache eviction
- Full documentation: User Guide (10 sections), Developer Guide (6 sections), API Reference (9 groups), SCORM Guide (6 sections), Glossary

---

## [0.5.23] — 2026-04-03 — Housekeeping: Renumber duplicate Phase 6 task blocks (T600–T608 → T650–T658)

### Changed
- **tasks.md** (`commit a4f4f3b`) — Phase 6 task blocks T600–T608 (Test Coverage Expansion) renumbered to T650–T658 to resolve a numbering conflict with Phase 2.6 blocks T600–T608 (Beta Review Fixes). All 9 task headers, subtask IDs, the priority-order comment, Phase 6 closing tasks (`T650.REVIEW`, `T651.REVIEW`, `T653.REVIEW`, `T650.CI`, `T650.COVERAGE`), and the Task Dependency Map were updated. Phase 2.6 T600–T608 and all other files (CHANGELOG, WORKING_CONTEXT, docs/) were left untouched — their T60X references are all Phase 2.6 and remain correct.

---

## [0.5.27] — 2026-04-04 — T613: SCORM 2004 conditional sequencing based on navigationMode

### Changed
- **`buildManifest2004()` conditional `imsss:controlMode`** (`packages/scorm-packager/src/index.ts`) — `<imsss:controlMode>` attributes now depend on `course.settings.navigationMode`. `'free'` (or undefined) keeps existing permissive sequencing: `choice="true" flow="true"`. `'linear-strict'` emits `choice="false" choiceExit="false" flow="true"` — signals to the LMS that TOC navigation is restricted; slide-level gating is enforced by the runtime player.

### Added
- **3 unit tests for T613** (`packages/scorm-packager/src/__tests__/scorm2004.test.ts`) — `'free'` mode regression (choice="true" preserved), undefined defaults to free, `'linear-strict'` produces `choice="false" choiceExit="false"`. 27 scorm2004 tests pass (up from 24).

### Notes
- Single-SCO architecture: SCORM `<imsss:sequencingRules>` with `preConditionRule` based on `objectiveProgressStatus` is not applicable — those rules operate across multiple SCOs. For our single-SCO design, `choice="false"` prevents the LMS from showing a jumpable TOC; all slide-level navigation control happens inside the runtime player.

---

## [0.5.26] — 2026-04-04 — TA608.6 fix + T612 HIGH-01/HIGH-02 + T612.9/T611.10 E2E fixes

### Fixed
- **TA608.6: GrapesJS Style Manager `forEach` crash** (`packages/authoring-ui/src/editor/registerBlocks.ts`) — Changed `model.defaults.properties: {}` to `properties: []` for `audio-narration`, `progress-bar`, and `volume-control` blocks. GrapesJS `PropertyComposite.loadData()` calls `.forEach()` on `this.get('properties')`; `{}` is truthy so `|| []` fallback never activates but `{}.forEach` is `undefined` → `TypeError`. Empty array `[]` fixes the crash.
- **T612 HIGH-01: Missing `cmi.location` assertion** (`packages/runtime-player/src/__tests__/scorm2004.test.ts`) — Added `expect(store['cmi.location']).toBe('1')` to the requireAllSlides regression test to verify `goToSlide()` was actually called, not just that completion was blocked.
- **T612 HIGH-02: Free-mode legacy fallback seeded wrong `visitedSlides`** (`packages/runtime-player/src/index.ts`) — The legacy `lesson_location` fallback now seeds `visitedSlides` conditionally: `linear-strict` mode seeds `[0..restoredSlide]` (safe: linear ordering guaranteed); `free` mode seeds only `[restoredSlide]` (safe: learner may have jumped non-sequentially).

---

## [0.5.25] — 2026-04-04 — T612: visitedSlides Gate + requireAllSlides finishCourse Guard

### Added
- **`finishCourse()` requireAllSlides gate** (`packages/runtime-player/src/index.ts`) — If `course.settings.requireAllSlides` is `true`, `finishCourse()` iterates all slide indices and navigates to the first unvisited slide instead of marking the course complete. Learners are forced to visit every slide before completion.
- **Legacy `lesson_location` fallback seeds `visitedSlides`** (`packages/runtime-player/src/index.ts`) — When `restoreSuspendData()` fails and only `lesson_location` is available (v:1 SCORM data), `visitedSlides` is now seeded with all indices `[0..restoredSlide]` so the progress bar and `requireAllSlides` gate reflect prior-session progress.
- **T612.8 unit tests** (`packages/runtime-player/src/__tests__/scorm2004.test.ts`) — 2 new `@regression` tests for the `requireAllSlides` gate: (1) finish blocked when not all slides visited, (2) finish succeeds when all slides visited. 256 tests total.
- **T612.9 E2E regression test** (`e2e/tests/persistence.spec.ts`) — `@regression` test verifying `navigationMode` and `requireAllSlides` courseSettings survive a full page reload. Guards against the backend round-trip dropping the T610/T612 fields silently.

### Fixed
- **H-01: Optional chaining on `extendedProperties?.scoring`** (`packages/runtime-player/src/index.ts`) — Prevents `TypeError` when migrated widgets have `extendedProperties: null`.
- **H-02: `console.warn` in `updateNavButtons()`** when no `[data-nav-next]` buttons found in linear-strict mode — prevents silent gating bypass going unnoticed.

---

## [0.5.24] — 2026-04-04 — T610 + T611: SCORM Navigation — Mandatory Question Gating

### Added
- **`navigationMode` and `requireAllSlides` in CourseSettings** (`packages/authoring-ui/src/types/course.ts`, `backend/api/src/models/Course.ts`, `packages/runtime-player/src/index.ts`, `packages/scorm-packager/src/index.ts`) — Foundational schema addition for T610. `navigationMode: 'free' | 'linear-strict'` (default `'free'`); `requireAllSlides: boolean` (default `false`).
- **Navigation mode selector in Course Settings UI** (`packages/authoring-ui/src/components/layout/CourseSettingsDialog.tsx`) — Radio/select control to set `free` or `linear-strict` navigation mode per course.
- **`mandatory?: boolean` in `QuestionScoring`** (`packages/authoring-ui/src/types/questions.ts`) — Marks individual questions as required-before-advancing in linear-strict mode.
- **Mandatory checkbox in `QuestionPropertiesPanel`** (`packages/authoring-ui/src/components/sidebar/QuestionPropertiesPanel.tsx`) — "Required — learner must answer before advancing" toggle in Scoring section. Persists via `extendedProperties.scoring.mandatory` in MongoDB.
- **`slideIsComplete()` and `updateNavButtons()`** (`packages/runtime-player/src/index.ts`) — Gate navigation: in `linear-strict` mode, returns false if any mandatory question on the current slide has not been answered. Disables `[data-nav-next]` buttons visually (opacity + cursor + `disabled` attribute).
- **T611.10 E2E regression test** (`e2e/tests/question-widget.spec.ts`) — `@regression` test verifying Next button disabled on unanswered mandatory MC → enabled after answer in linear-strict mode.
- **EditorPage helpers** (`e2e/pages/EditorPage.ts`) — `openCourseSettings()`, `setNavigationMode()`, `closeCourseSettings()`, `openPreview()`.

### Fixed
- **H-01: Optional chaining on `extendedProperties?.scoring`** (`packages/runtime-player/src/index.ts:651`) — Prevents `TypeError` when migrated widgets have `extendedProperties: null`.
- **H-02: `console.warn` in `updateNavButtons()`** when no `[data-nav-next]` buttons found in linear-strict mode — prevents silent gating bypass going unnoticed.

---

## [0.5.22] — 2026-04-03 — Progress Bar Refinements: suspend_data v:2, visitedSlides Persistence, E2E TA608.6

### Added
- **suspend_data schema v:2** (`packages/runtime-player/src/suspend.ts`) — Extended `SuspendPayload` with a `visited: number[]` field and bumped schema version from v:1 to v:2. `SuspendableState` now includes `visitedSlides: Set<number>`. `serializeSuspend()` now serialises `visitedSlides` as a compact number array; `restoreSuspendData()` reconstructs the set, filtering out-of-bounds indices. v:1 payloads remain fully accepted (backward compat) — `visitedSlides` seeds to `[currentSlide]`.
- **TA608.6 E2E test** (`e2e/tests/progress-bar-widget.spec.ts`) — Persistence regression guard: set custom color (`#cc3300`) and uncheck showPercent → wait for autosave PATCH → reload editor → re-select widget → verify `extendedProperties.color` and `extendedProperties.showPercent` are still correct. Autosave response status verified `< 400`.

### Fixed
- **visitedSlides reset on resume** (`packages/runtime-player/src/index.ts`, `src/suspend.ts`) — Previously `visitedSlides` was initialised as an empty `Set` on every player start, including SCORM resume. Learner progress bar showed 0% after returning to a course. Now persisted and restored via suspend_data v:2.
- **updateProgressBars scoping** (`packages/runtime-player/src/index.ts`) — `.el-progress-percent` was queried globally across the whole container; now scoped to `fill.closest('.el-progress-bar')` so multiple progress bars on a slide update independently.
- **Height input clamping** (`packages/authoring-ui/src/components/sidebar/ProgressBarPropertiesPanel.tsx`) — Height field silently rejected out-of-range values on blur, causing the controlled input to revert. Now always clamps with `Math.max(4, Math.min(40, n))` for immediate feedback.
- **Unit tests updated for suspend_data v:2** (`packages/runtime-player/src/__tests__/suspend.test.ts`) — "unknown schema version" test updated to v:3 (v:2 is now valid); added "accepts v:2 payloads with visited field" test; round-trip test asserts `payload.v === 2` and `visited` array present; "restores slide index" test verifies `visitedSlides` is restored correctly; added "seeds visitedSlides with current slide when restoring v:1 payload" test.

---

## [0.5.21] — 2026-04-02 — Fix T601.8 CI Failure: extendedProperties Round-Trip Corruption

### Fixed
- **T601.8 regression — MC question text not surviving page reload** (`packages/authoring-ui/src/editor/converters.ts`) — GrapesJS Backbone `component.set('extendedProperties', next)` (called by `useExtendedProperties` hook when user edits question text) places the value into the Backbone attributes hash. `c.getAttributes()` was returning it, and it was not excluded by `INTERNAL_GJS_ATTRS` — so the complex object leaked into `widget.properties`. On the next load, `grapesjsFromWidgets` copied it into the GrapesJS component def's `attributes` object (used to set HTML element attributes), causing `loadData()` to crash with `TypeError: Cannot read properties of undefined (reading 'forEach')`. EditorCanvas `.catch()` still set `data-editor-ready="true"`, so `waitForCanvas()` returned successfully but the MC component model was broken and the `QuestionPropertiesPanel` could never re-attach.
- Extended `INTERNAL_GJS_ATTRS` to include `extendedProperties`, `elearnActions`, `actions`, `properties` — preventing them from flowing through the `c.getAttributes()` → `mergedProps` → `widget.properties` path.
- Extended the `grapesjsFromWidgets` `attributes` skip list with the same fields — preventing them from ever being placed in the GrapesJS `attributes` sub-object where GrapesJS would try to stringify complex objects as HTML attributes.

---

## [0.5.20] — 2026-04-02 — Global Volume Control Widget (MISSING-02)

### Added
- **Volume Control widget** (`packages/authoring-ui/src/editor/registerBlocks.ts`) — New `volume-control` GrapesJS block + component. Features volume icon SVG in the Block Manager (Media category). `extendedProperties: { defaultVolume: 80, showMute: true }`.
- **VolumeControlPropertiesPanel** (`packages/authoring-ui/src/components/sidebar/VolumeControlPropertiesPanel.tsx`) — New React properties panel with Volume Options section: range slider + number input (0–100) for default volume; checkbox for show mute button. Auto-shows in Props tab on widget select via `isVolumeControlWidgetType()`.
- **Runtime player volume logic** (`packages/runtime-player/src/index.ts`) — Module-level `_globalVolume` / `_globalMuted` state persists across slide navigations. `applyVolumeToSlide()` applies current volume/muted state to all `audio, video` elements in the current slide. Mute button toggles with animated SVG icon swap.
- **E2E suite** (`e2e/tests/volume-control-widget.spec.ts`) — 5 new T609 tests: block visible in Blocks panel, Props tab auto-opens on widget select, panel sections visible, volume input updates `extendedProperties.defaultVolume`, showMute checkbox updates `extendedProperties.showMute`.

### Fixed
- **[MISSING-02] Global volume control missing from widget library** — Authors had no way to place a global volume slider on slides; runtime had no mechanism to set media volume.

---

## [0.5.19] — 2026-04-02 — Course Progress Bar Widget (MISSING-03)

### Added
- **Progress Bar widget** (`packages/authoring-ui/src/editor/registerBlocks.ts`) — New `progress-bar` GrapesJS block + component. Features progress bar SVG icon in the Block Manager (Navigation category). `extendedProperties: { color: '#4f46e5', height: 12, showPercent: true }`.
- **ProgressBarPropertiesPanel** (`packages/authoring-ui/src/components/sidebar/ProgressBarPropertiesPanel.tsx`) — New React properties panel with Appearance section: color picker + text input, height number input (4–40px), show percentage text checkbox. Auto-shows in Props tab on widget select via `isProgressBarWidgetType()`.
- **Runtime player progress tracking** (`packages/runtime-player/src/index.ts`) — `visitedSlides: Set<number>` in `PlayerState` tracks which slide indices have been visited. `updateProgressBars()` queries `.el-progress-bar-fill` and `.el-progress-percent` elements and updates bar width and text on every slide navigation.
- **E2E suite** (`e2e/tests/progress-bar-widget.spec.ts`) — 5 new T608 tests: block visible in Blocks panel, Props tab auto-opens on widget select, panel sections visible, hex color input updates `extendedProperties.color`, showPercent checkbox updates `extendedProperties.showPercent`.

### Fixed
- **[MISSING-03] Course progress bar missing from widget library** — Authors had no way to place a visual progress indicator on slides; runtime had no mechanism to track slide visit history.

---

## [0.5.18] — 2026-04-02 — Audio Narration Widget (MISSING-01)

### Added
- **Audio Narration widget** (`packages/authoring-ui/src/editor/registerBlocks.ts`) — New `audio-narration` GrapesJS block + component for embedding audio tracks on slides. Features speaker-wave SVG icon in the Block Manager (Media category) and a styled dark-background canvas placeholder preview with animated speaker icon.
- **AudioNarrationPropertiesPanel** (`packages/authoring-ui/src/components/sidebar/AudioNarrationPropertiesPanel.tsx`) — New React properties panel shown automatically in the Props tab when an `audio-narration` widget is selected.
  - **Audio Source section**: URL text input with bidirectional `change:src` GrapesJS sync; "Choose from Asset Library…" button; "Clear Source" button
  - **Playback Options section**: "Show controls" checkbox (default on) and "Autoplay on slide load" checkbox (default off) — stored immutably in `extendedProperties`
  - Uses the same `useTrait` / `useExtendedBool` / `isLocalRef` patterns as `MediaPlayerPropertiesPanel`
  - `isAudioNarrationWidgetType()` export used by `EditorCanvas.tsx` to auto-switch to Props tab on selection
- **Runtime player rendering** (`packages/runtime-player/src/index.ts`) — `renderAudioNarration()` produces a native `<audio>` element with `src`, `controls`, and `autoplay` from widget properties; renders a "No audio assigned" placeholder when `src` is empty; `escAttr()` prevents XSS on the `src` attribute.
- **E2E suite** (`e2e/tests/audio-narration-widget.spec.ts`) — 5 new T607 tests: block visible in Blocks panel, Props tab auto-opens on widget select, all panel sections visible, URL input updates component model, checkboxes interactive. Suite now 114 tests.

### Fixed
- **[MISSING-01] Audio narration widget missing from widget library** — `audio-narration` was planned but not implemented; authors had no way to add background audio or narration to slides.
- **[BUG-T607-01] `converters.ts`: `src` not restored for `media-player` and `audio-narration` on slide reload** — `grapesjsFromWidgets()` previously only restored `src` as a GrapesJS model attribute for `w.type === 'image'`. Widgets of type `media-player` and `audio-narration` lost their `src` on every save→reload cycle. Fixed with a `WIDGETS_WITH_SRC_TRAIT` whitelist: `new Set(['image', 'media-player', 'audio-narration'])`.
- **[BUG-T607-02] `Widget.ts` backend: `audio-narration` missing from `WIDGET_TYPES` enum** — Mongoose `WidgetSchema.type` uses `WIDGET_TYPES` as an `enum` validator. `'audio-narration'` was absent from the array, causing every PATCH that included an `audio-narration` widget to return HTTP 500 (Mongoose ValidationError). All `src` and property changes to audio-narration widgets were silently lost on slide-switch. Added `'audio-narration'` to the array. Caught by the new T607.6 persistence round-trip test.
- **[M-01] AM picker could accept non-audio files for audio-narration** — `openAudioPicker` in `AudioNarrationPropertiesPanel.tsx` now validates the selected asset URL by extension (`AUDIO_EXTENSIONS` Set + `isAudioUrl()`). Non-audio files are rejected with an alert before `setSrc()` is called. Workaround for GrapesJS AM storing all assets as `type:'image'` internally.
- **[L-02] Persistence round-trip not tested for audio-narration** — Added T607.6 E2E test: adds audio-narration, sets `src` via editor API, waits for PATCH autosave, switches slides, returns, asserts `src` unchanged. Suite now 6 T607 tests.

### Notes
- `extendedProperties` null guard added in runtime player (`?? {}` fallback) to handle migrated/legacy documents that may have `extendedProperties: null`.
- Asset Manager MIME-type filtering (audio/* only) is not natively supported by the GrapesJS AM plugin; deferred to a future ticket (same limitation as media-player).

---

## [0.5.17] — 2026-04-02 — SCORM Export Loading Feedback (BETA-14)

### Added
- **Publish dialog status section** (`PublishDialog.tsx`) — new feedback area that appears when export starts; shows CSS spinner + "Generating SCORM package…" during packaging, green ✓ + "Download ready — check your Downloads folder" on success, red ✗ + error message on failure.
- **Inline error display** (`PublishDialog.tsx`) — export errors now shown inside the dialog with `role="alert"` in addition to the existing toast, so the user can read the error and retry without reopening the dialog.
- **Close vs Cancel button** (`PublishDialog.tsx`) — Cancel relabels to "Close" after export completes (success or error); Publish button is hidden on success (no double-export risk).
- **E2E coverage** (`scorm-export.spec.ts`) — 3 new T606 tests: "Download ready" appears after export, Close button replaces Cancel, Close dismisses dialog. SCORM suite now 10 tests.
- **`PublishStatus` type** (`PublishDialog.tsx`) — exported `'idle' | 'packaging' | 'done' | 'error'` union for state tracking.

### Fixed
- **[BETA-14] No loading feedback during SCORM export** — previously the dialog showed only a static "Packaging…" label on the button with no progress indication and errors were swallowed into a toast that disappeared. Users had no way to confirm the download succeeded or retry from the dialog.

### Changed
- **AppLayout `handleConfirmPublish`** — dialog no longer auto-closes on success; stays open to show "Download ready" state. User explicitly closes it with the "Close" button.
- **AppLayout `handleCancelPublish`** — new handler that resets `publishStatus` and `publishError` when dialog is dismissed, preventing stale state on re-open.

---

## [0.5.16] — 2026-04-02 — Image Widget Placeholder Hint + Double-Click UX (BETA-15)

### Added
- **Image widget placeholder** (`packages/authoring-ui/src/editor/initEditor.ts`) — When an image widget has no `src`, GrapesJS auto-adds the `.gjs-plh-image` class. New canvas CSS injects an SVG data URI background showing a camera icon + "Click to choose image" hint text. Works on `<img>` (void element) via `background-image`; `::before`/`::after` pseudo-elements do not work on void elements.
- **Double-click to open Asset Manager** (`packages/authoring-ui/src/editor/registerBlocks.ts`) — Image widget event changed from `click` to `dblclick` to open the Asset Manager. Single-click now correctly selects the component (GrapesJS default). Tooltip `title="Double-click to open image selector"` set in `onRender()`.
- **E2E suite** (`e2e/tests/image-widget-placeholder.spec.ts`) — 4 new tests: block visible (T605.1), `gjs-plh-image` class present on empty widget (T605.2), tooltip attribute present (T605.3), class removed after `src` assigned (T605.4).
- Full suite now 106 tests (was 102 before T605).

### Fixed
- **[BETA-15] Image widget: no placeholder hint** — image widgets with no source showed a blank white box with no affordance. Authors now see a clear camera icon + hint text guide.

### Notes
- SVG data URI is hardcoded (no user input interpolated) — XSS-safe per code review in `docs/issues/issues-T605.md`.
- `dblclick` does not conflict with GrapesJS text-editing because image components have `void: true` (no inline edit mode applies).

---

## [0.5.15] — 2026-04-02 — Media Player Properties Panel (BETA-10)

### Added
- **MediaPlayerPropertiesPanel** (`packages/authoring-ui/src/components/sidebar/MediaPlayerPropertiesPanel.tsx`) — New React properties panel for the media-player widget. Shown automatically in the Props tab when a `media-player` component is selected.
  - **Media Source section**: URL text input with bidirectional GrapesJS `change:src` sync; "Choose from Asset Library…" button opens the GrapesJS Asset Manager; "Clear Source" button removes the URL
  - **Media Type section**: dropdown selector (Video / Audio) reads/writes the `mediaType` component trait
  - **Playback Options section**: three checkboxes — Show controls (default on), Autoplay (default off), Loop (default off) — stored immutably in `extendedProperties`
  - `useTrait` hook: bidirectional sync for any named trait using the `isLocalRef` loop-prevention pattern
  - `useExtendedBool` hook: bidirectional sync for boolean flags in `extendedProperties` using the same `isLocalRef` pattern
  - `isMediaPlayerWidgetType()` export — added to `EditorCanvas.tsx` `component:selected` handler so the Props tab auto-opens on widget select
- **E2E suite** (`e2e/tests/media-player-widget.spec.ts`) — 6 new tests: block visible in Blocks panel, Props tab auto-opens, all three sections visible, URL typed into src field updates component model, media type selector reads/writes `mediaType`, checkbox toggles update `extendedProperties.autoplay`
- Full suite now 102 tests (was 96 before T604)

### Fixed
- **[BETA-10] Media Player: no properties panel, cannot assign media** — media-player widget previously had no editable fields in the Props tab. All five fields now work with full GrapesJS model sync and undo/redo support.

### Notes
- The canvas still renders a static placeholder div for the media player (no live `<video>`/`<audio>` preview in GrapesJS). The `src`, `mediaType`, `autoplay`, `controls`, and `loop` values are stored on the component model and will be consumed by the runtime player at course delivery time.
- E2E timeout fixes applied to T601.8 and T611-07 (`restoredPanel`/`restoredTextarea` assertions bumped from 5_000 → 10_000) and T608.6 delete-slide assertion bumped from 10_000 → 15_000 to eliminate full-suite load flakes.

---

## [0.5.14] — 2026-04-02 — Button Caption and Background Image Now Editable (BETA-04/05/11)

### Added
- **ButtonPropertiesPanel** (`packages/authoring-ui/src/components/sidebar/ButtonPropertiesPanel.tsx`) — New React properties panel for button widgets. Shown automatically in the Props tab when a `button`, `done-button`, or `nav-buttons` widget is selected.
  - `button` / `done-button`: Caption text field (reads/writes `component.get/set('content')`) + background image picker via Asset Manager
  - `nav-buttons`: Two separate caption fields for the previous and next inner buttons; background image picker
  - Background image removal via immutable destructuring (`{ 'background-image': _removed, ...remaining }`)
  - Per-child `isPrevLocalRef` / `isNextLocalRef` guards — armed before `child.set()` to prevent GrapesJS synchronous `change:content` event loop
  - Child event listeners in `useEffect` so undo/redo syncs back to the form

### Fixed
- **[BETA-04] Button caption cannot be changed** (`ButtonPropertiesPanel.tsx`) — No React panel existed for button widgets; caption edits were silently discarded. Fix: new `ButtonPropertiesPanel` reads/writes `component.get/set('content')` and re-renders on external changes (undo/redo).
- **[BETA-05] Button background image cannot be assigned** (`ButtonPropertiesPanel.tsx`) — No UI to call `component.setStyle({ 'background-image': ... })`. Fix: Background Image section opens the GrapesJS Asset Manager and applies the selected image via `component.setStyle()`.
- **[BETA-11] Nav buttons: individual captions not changeable** (`ButtonPropertiesPanel.tsx`) — `nav-buttons` is a composite widget; inner prev/next buttons are child GrapesJS components. Fix: `NavButtonsPropertiesForm` accesses children via `component.components().at(0/1)` and writes their `content` property independently.

### Changed
- **Props tab auto-opens for button widgets** (`EditorCanvas.tsx`) — `component:selected` handler now calls `setRightTab('properties')` for `isButtonWidgetType(type)`, matching the pattern already used for question and Phaser sim widgets.

### Notes
- `BackgroundImageSection` reads `component.getStyle()` on each render (not subscribed to style changes). Undo/redo remounts the panel via `component:selected` re-emission — no functional gap for normal authoring. Subscribing to style events deferred to a future cleanup.

---

## [0.5.13] — 2026-04-02 — Fix Question Properties Panel: All Text Fields and Correct Answer Now Editable (BETA-01/02/03/08/09/13)

### Fixed

- **[BETA-01] MC question: correct answer can now be marked** (`packages/authoring-ui/src/components/sidebar/QuestionPropertiesPanel.tsx`) — Clicking a radio button in `MCPropertiesForm` to mark the correct option now persists correctly. Root cause: the form read `extendedProperties` as a plain variable with no `useState`, so React never re-rendered — every keystroke or click was written to the GrapesJS model but the form immediately reverted to its initial value due to a stale closure. Fixed with the `useExtendedProperties<T>` hook.
- **[BETA-02] All questions: question text and option text now editable** (`packages/authoring-ui/src/components/sidebar/QuestionPropertiesPanel.tsx`) — Same root cause as BETA-01. Typing in the question text textarea or any option text input now updates the GrapesJS model and re-renders the canvas preview correctly.
- **[BETA-03] All questions: feedback text now editable** (`packages/authoring-ui/src/components/sidebar/QuestionPropertiesPanel.tsx`) — Same root cause. `feedbackCorrect` and `feedbackIncorrect` fields now persist on each keystroke.
- **[BETA-08] TF: correct answer selection now works** (`packages/authoring-ui/src/components/sidebar/QuestionPropertiesPanel.tsx`) — True/False radio buttons now persist the selected answer to `extendedProperties.correctAnswer`.
- **[BETA-09] Fill: accepted answer now editable** (`packages/authoring-ui/src/components/sidebar/QuestionPropertiesPanel.tsx`) — Accepted answer inputs in `FillPropertiesForm` now persist to `extendedProperties.answers`.
- **[BETA-13] MC props panel refreshes when options added/removed** (`packages/authoring-ui/src/components/sidebar/QuestionPropertiesPanel.tsx`) — The `useExtendedProperties` hook subscribes to `change:extendedProperties` model events via `useEffect`, so the panel re-renders correctly when options are added or removed.

### How the fix works

`useExtendedProperties<T>(component, defaults)` is a custom React hook that:
1. Initialises form state from `component.get('extendedProperties')` via `useState` (was missing)
2. Subscribes to the GrapesJS model `change:extendedProperties` event to catch external changes (undo/redo, reload)
3. Uses an `isLocalRef` flag to skip the external handler when the change originated from the local `update()` call, preventing a double-setState loop
4. Returns `[ep, update]` — each form replaces its 3-line plain-variable + per-form `update` function with a single `const [ep, update] = useExtendedProperties<T>(...)` call

### Tests

- All 23 existing `question-widget.spec.ts` tests pass with no changes. Existing regression tests (T601.2, T601.3a/b, T601.4, T601.7, T601.8, T611-07) provide full coverage for the fixed behaviors.

---

## [0.5.12] — 2026-04-02 — Fix Asset Manager Thumbnail and Filename Display (BETA-07 + BETA-12)

### Fixed

- **[BETA-07] Asset Manager thumbnail: generic icon replaced by presigned URL image** (`packages/authoring-ui/src/editor/assetManager.ts`) — After upload, the Asset Manager showed a generic broken icon instead of an image thumbnail. Root cause: `customFetch` passed `/assets/uuid.png` (auth-protected, returns 401 for `<img>` tags) directly to GrapesJS. Fix: after each upload, `customFetch` now calls `GET /assets/:objectName/presigned` to resolve a time-limited browser-loadable URL, which is then passed as `src` to GrapesJS. Presigned URL fetch failure is logged via `console.warn` and falls back gracefully to the auth-protected path.
- **[BETA-12] Asset Manager filename: original filename shown instead of UUID** (`packages/authoring-ui/src/editor/assetManager.ts`) — GrapesJS was receiving only a URL string after upload, causing it to use the UUID-based path as the display name. Fix: `customFetch` now returns `{ src, name: originalName, type: 'image' }` object using the `originalName` already present in the backend upload response. No backend changes were required.

### Tests

- Added `T601 — Asset Manager shows image thumbnail and original filename after upload` test in `e2e/tests/image-upload.spec.ts`. Verifies: AM thumbnail `<img>` has `src` matching `https?://` (presigned URL, not auth-protected path); asset item text contains original filename stem. All 4 image-upload tests pass.

---

## [0.5.11] — 2026-04-02 — Fix Initial Drag Positioning for 4 Broken Block Types (BETA-06)

### Fixed

- **[BETA-06] Initial drag positioning: done-button, question-tf, question-fill, media-player** (`registerBlocks.ts`, `registerQuestionBlocks.ts`) — When dragged from the BlockManager onto the GrapesJS canvas, these four widgets landed at canvas origin (0,0) instead of at the drop target. Root cause: GrapesJS `dragMode: 'absolute'` requires the block `content` definition to include `style: { position: 'absolute', left, top, width, height }` to prime the drag-coordinate system. The `component:add` handler in `initEditor.ts` adds `position: absolute` after drop but not `left/top`, which is insufficient. Fixed by adding the missing initial style to each broken block's `BlockManager.add()` call. GrapesJS overrides `left/top` with actual drop coordinates at runtime.

### Tests

- Added T600 regression describe block in `e2e/tests/grapesjs-integration.spec.ts` — 4 parameterized tests (one per fixed widget) verify each block lands with canvas-relative X, Y > 50px after drop. All 13 grapesjs-integration tests pass.

---

## [0.5.10] — 2026-03-31 — GrapesJS Converter Defensive Guard for Missing Widget Fields

### Fixed

- **`w.bounds` unguarded access in `grapesjsFromWidgets`** (`packages/authoring-ui/src/editor/converters.ts`) — `w.bounds.x/y/width/height` were accessed directly without optional chaining. If an old or corrupt MongoDB document has `bounds: undefined`, this threw `TypeError: Cannot read properties of undefined (reading 'x')` during `loadData()`, crashing the GrapesJS canvas on slide load. Fixed with `w.bounds?.x ?? 0`, `w.bounds?.y ?? 0`, `w.bounds?.width ?? 100`, `w.bounds?.height ?? 50`.

### Why Mongoose `default` does not protect reads

Mongoose `default: []` (or `default: {}`) on a schema field applies only at **document creation time** — it does not backfill missing fields when hydrating existing documents from MongoDB. Any document written before a schema field was added will return `undefined` for that field via the API. Code-level guards (`?.` and `??`) are the only reliable protection for data read from old documents.

### Other `grapesjsFromWidgets` guards (pre-existing, confirmed present)

| Field | Guard | Fallback |
|---|---|---|
| `w.actions` | hardcoded `actions: []` | GrapesJS crash prevention |
| `w.actions` (elearnActions) | `w.actions ?? []` | empty sequence |
| `w.properties` | `(w.properties as ...) ?? {}` | empty object |
| `w.extendedProperties` | `w.extendedProperties ?? {}` | empty object |
| `w.visible` | read as `style.display !== 'none'` | inherited from CSS |
| `w.bounds` | **`w.bounds?.x ?? 0` (NEW)** | defaults: x=0, y=0, w=100, h=50 |

---

## [0.5.9] — 2026-03-31 — E2E Suite Expansion to 90 Tests + Moodle SCORM Hardening

### Added

- **90-test Playwright E2E suite** — expanded from 73 tests to 90 across two projects:
  - `setup` project: 4 tests in `auth.spec.ts` (unauthenticated login flow)
  - `chromium` project: 86 tests (all other spec files)
  - Coverage gaps filled: `persistence.spec.ts` (10 tests), `grapesjs-integration.spec.ts` (9 tests), `question-widget.spec.ts` (23 tests), `authoring-ui-layer.spec.ts` (21 tests), `action-sequence.spec.ts` (6 tests), `scorm-export.spec.ts` (7 tests), `course-crud.spec.ts` (5 tests), `image-upload.spec.ts` (3 tests), `moodle-scorm.spec.ts` (2 tests)

- **Moodle SCORM integration tests** (`e2e/tests/moodle-scorm.spec.ts`) — opt-in via `E2E_MOODLE=1` or `MOODLE_URL` env var. Two serial tests:
  - Step 1: create 3-slide course via API, export SCORM 1.2 ZIP, assert content-type and non-empty archive
  - Step 2: authenticate to live Moodle 4.x, create course, upload SCORM ZIP via file picker, launch player popup, verify each slide renders expected widget DOM inside `iframe#scorm_object`

### Fixed

- **Moodle `modedit.php` ERR_ABORTED** (`moodle-scorm.spec.ts`) — when running in the full 86-test suite, Playwright aborted the `page.goto()` to `modedit.php` due to Moodle's edit-mode JavaScript still in-flight. Fix: added `page.waitForLoadState('networkidle', { timeout: 8_000 })` before navigation to let Moodle settle, plus a catch-and-retry wrapper that pauses 2 seconds and retries once if the first navigation is aborted.

- **Moodle login unreliable under CPU load** (`moodle-scorm.spec.ts`) — `pressSequentially` typed credentials character-by-character; under load (after 84 preceding tests), characters were dropped and Moodle received an incomplete password, returning "Invalid login". Fix: replaced `pressSequentially` with `page.fill()` (atomic value assignment) for both username and password fields, with `expect(locator).toHaveValue()` verification before submitting.

### Notes

- Running `npx playwright test --project=chromium` reports 86 tests — auth.spec.ts is excluded via `testIgnore` because auth tests require an unauthenticated context. Running `npx playwright test` (both projects) reports 90 tests. This is intentional: the `setup` project runs auth.spec.ts without storageState; the `chromium` project runs everything else with a pre-baked authenticated session.
- Moodle tests require the Docker stack running with Moodle (`docker compose ... up -d moodle`) and credentials set via env vars `MOODLE_URL`, `MOODLE_ADMIN`, `MOODLE_PASSWORD`.

---

## [0.5.8] — 2026-03-29 — Persistence Race Condition Fixes (T800)

### Fixed

- **[BUG-T800-01] Concurrent PATCH requests overwriting question property edits** (`QuestionPropertiesPanel.tsx`) — `MCPropertiesForm`, `TFPropertiesForm`, and `FillPropertiesForm` each called `editor?.store()` directly inside their `update()` function, which fires on every `onChange` event. Typing "Hello" produced 5 simultaneous PATCH requests with snapshots `["H", "He", "Hel", "Hell", "Hello"]`. If request 5 completed before request 1, and request 1 landed last, the database was left with `"H"`. Fix: removed all direct `editor.store()` calls from these forms. `component.set('extendedProperties', ...)` already fires `component:update`, which triggers the 2-second debounced autosave in `initEditor.ts`. The debounce coalesces all keystrokes into a single PATCH.

- **[BUG-T800-02] Text buffer not flushed before slide-switch save** (`EditorCanvas.tsx`) — the slide-switch save path in `saveAndLoad()` called `editor.store()` without first stopping the `text-edit` command. GrapesJS keeps an uncommitted text buffer while a text widget is in edit mode; calling `widgetsFromGrapesjs(editor.getComponents().toArray())` with the command active reads the pre-keystroke state, silently discarding the user's latest typing. The autosave debounce path in `initEditor.ts` already called `editor.stopCommand('text-edit')` correctly. Fix: added the same `stopCommand` call to the slide-switch path immediately before `editor.store()`.

- **[BUG-T800-03] Course navigation did not trigger a save of the current slide** (`EditorCanvas.tsx`) — the condition guarding the pre-switch save was `prev.courseId === courseId && prev.slideId !== slideId`, which excluded cross-course navigations. If the user edited a slide and navigated to a different course before the 2-second debounce fired, the `CRITICAL-01` guard in `initEditor.ts` aborted the pending autosave (slide context had already changed) and the slide-switch save was also skipped. Changes were lost silently. Fix: condition simplified to `prev !== null && prev.slideId !== slideId` — any genuine slide change triggers the save regardless of whether the course also changed.

- **[BUG-T800-04] Failed PATCH invalidated course cache, causing stale state on next load** (`storageManager.ts`) — `courseCache = null` was placed in the `finally` block of `store()`, so a failed PATCH also evicted the in-memory cache. The next `load()` call (e.g., returning to the slide after a failed save) fetched the older state from the backend, discarding the user's edits that had never reached the DB. Fix: `courseCache = null` moved into the success path (after `updateSlide` resolves). A failed PATCH leaves the cache intact so subsequent loads reflect the most recent known-good in-memory state.

---

## [0.5.7] — 2026-03-29 — Full Widget Attribute Persistence & Autosave Reliability

### Fixed

- **GrapesJS Trait attributes now persisted across reload** (`converters.ts`) — `widgetsFromGrapesjs` previously captured only `style`, `content`, and `src`. Any attribute stored by GrapesJS in the component model via Traits (e.g., `alt` on image widgets, `mediaType` on media-player, data-* attributes) was silently discarded on every save, reverting to defaults on reload. Fix: `widgetsFromGrapesjs` now iterates `c.getAttributes()` and copies all non-internal attributes into `properties`. A new `INTERNAL_GJS_ATTRS` constant (`id`, `class`, `style`, `src`) defines the exclusion list. `grapesjsFromWidgets` reconstructs `attributes` from `properties` on load, restoring Trait values to the GrapesJS model.

- **Text/button widget content captured via `getInnerHTML()`** (`converters.ts`) — GrapesJS maintains text edits in a live DOM editable region. The Backbone model attribute `content` is not guaranteed to reflect DOM edits until after the edit command exits. Using `c.get('content')` could capture stale or empty text. Fix: `widgetsFromGrapesjs` now calls `c.getInnerHTML()` for `text` and `button` widget types, which reads directly from the rendered child component tree. A test-environment fallback to `c.get('content')` is retained for unit test compatibility.

- **Inline text edit flushed before every `store()` call** (`initEditor.ts`) — when the autosave debounce timer fired while the user was actively editing text (cursor inside a text widget), GrapesJS had not yet propagated the DOM state back to the Backbone model. The serialised content was the pre-edit value. Fix: added `editor.stopCommand('text-edit')` immediately before every `editor.store()` call, forcing GrapesJS to commit the live DOM edit to the model before serialisation begins.

- **Newly dropped widgets now trigger autosave** (`initEditor.ts`) — the autosave timer was wired only to `component:update`. Dragging a block from the Block Manager onto the canvas fires `component:add`, not `component:update`, so a freshly placed widget existed only in browser memory until the user moved or resized it. Fix: added event listeners for `component:add`, `component:remove`, and `component:update:content`, each invoking the same debounced `triggerAutosave` handler.

- **React sidebar panel changes saved immediately, not just via debounce** (`QuestionPropertiesPanel.tsx`, `PhaserSimPropertiesPanel.tsx`, `SimulationEditor.tsx`) — all three panels called `component.set('extendedProperties', ...)` and relied on the 2-second autosave debounce to persist the change. If the user switched slides within that window, the debounce timer fired after the slide context had changed, and the update was lost. Fix: all three panels now call `editor.store()` immediately and synchronously after every significant `extendedProperties` mutation, eliminating the race condition with the slide-switch handler.

### Tests Added

- **`persistence.spec.ts`** — added automatic out-of-canvas click after text edits in E2E tests to simulate user behaviour (triggering the `blur` event that consolidates DOM edits before assertions), making text-content persistence tests deterministic.

---

## [0.5.6] — 2026-03-29 — GrapesJS Component Custom-Field Persistence Fix

### Fixed
- **`properties`, `elearnActions`, and `extendedProperties` now declared in `defaults` of all GrapesJS component types** — these three custom fields were absent from the Backbone.Model `defaults` of all basic, navigation, assessment, media, and simulation widget types. While Backbone.Model stores any `set()` attribute regardless of `defaults`, the absence from `defaults` meant GrapesJS could fail to restore these fields when processing component definitions via `loadProjectData`, causing widget properties, action sequences, and extended question config to be silently lost on every course reload.
  - `registerBlocks.ts` — added `properties: {}`, `elearnActions: []`, `extendedProperties: {}` to `defaults` of all 9 widget types: `text`, `image`, `button`, `rectangle`, `nav-buttons`, `done-button`, `score-quiz`, `score-field`, `media-player`.
  - `registerQuestionBlocks.ts` — added `properties: {}`, `elearnActions: []` to `defaults` of `question-mc`, `question-tf`, `question-fill` (these already declared `extendedProperties`).
  - `registerSimBlock.ts` — added `properties: {}`, `elearnActions: []` to `defaults` of `screenshot-sim`.
  - `registerPhaserSimBlock.ts` — added `properties: {}`, `elearnActions: []` to `defaults` of `phaser-sim`.

### Tests Added
- **`registerBlocks.test.ts`** — T012.11 suite: 42 new unit tests (14 component types × 3 fields) asserting that every registered component type declares `properties: {}`, `elearnActions: []`, and an object-typed `extendedProperties` in its `defaults`. Tests go from 531 → 573 total.

---

## [0.5.5] — 2026-03-29 — Full CSS Style Preservation (Decorative Styles)

### Fixed
- **All CSS decorative styles now survive the store→backend→load round-trip** (`converters.ts`) — previously only the 5 layout-specific properties (`left`, `top`, `width`, `height`, `z-index`) and `display` were persisted. Any styling applied via the GrapesJS Style Manager (font-family, color, background-color, border, padding, opacity, etc.) was silently dropped on every save cycle and reset to defaults on reload.
  - `widgetsFromGrapesjs` now collects all non-layout CSS properties from `c.getStyle()` into `properties.style` before saving. The new `LAYOUT_STYLE_KEYS` set (`position`, `left`, `top`, `width`, `height`, `z-index`, `display`) defines the exclusion boundary.
  - `grapesjsFromWidgets` now spreads `properties.style` at the start of the CSS definition object, then overwrites with the authoritative layout values derived from `bounds`/`layer`/`visible`. This guarantees layout always wins over any stale layout key that may have leaked into `properties.style`.
  - `GrapesJsComponentDef.style` type broadened from a fixed-shape record to `Record<string, string | number>` to accommodate arbitrary decorative properties.

### Tests Added
- **`converters.test.ts`** — 8 new unit tests covering decorative style save and restore:
  - `widgetsFromGrapesjs` saves font/color/background into `properties.style`
  - `widgetsFromGrapesjs` excludes all layout keys from `properties.style`
  - `widgetsFromGrapesjs` does not add `properties.style` when only layout CSS is present
  - `widgetsFromGrapesjs` saves border and padding into `properties.style`
  - `grapesjsFromWidgets` spreads `properties.style` into CSS definition
  - `grapesjsFromWidgets` layout keys override stale values in `properties.style`
  - Round-trip: font/color/background survive intact
  - Round-trip: no layout key leaks back into `properties.style` after round-trip

---

## [0.5.4] — 2026-03-28 — Slide Data-Loss Bug Fix (FM-05)

### Fixed
- **Critical data-loss on slide navigation** (`converters.ts`) — navigating from Slide 1 (with text, image, nav-buttons widgets) to Slide 2 and back caused all widget content to disappear or corrupt. Three root causes fixed in `widgetsFromGrapesjs` / `grapesjsFromWidgets`:
  1. **Text content lost** — `widgetsFromGrapesjs` only read `c.get('properties')` but GrapesJS stores user-edited text in `c.get('content')` (built-in model attribute). Fix: explicitly read `c.get('content')` and merge into `mergedProps.content` for non-question types.
  2. **Image src lost** — image URL is stored as `c.get('src')` (root-level GrapesJS attribute), not inside `properties`. Fix: read `c.get('src')` and merge into `mergedProps.src`.
  3. **Nav-buttons placed at (0,0) with broken layout** — `grapesjsFromWidgets` hardcoded `display: 'block'` for all visible widgets. Nav-buttons require `display: 'flex'` for their two inner buttons to lay out side-by-side. Fix: added `FLEX_DISPLAY_TYPES` set (`nav-buttons`, `score-field`) and conditional display value lookup.
  - Added `GENERATED_CONTENT_TYPES` guard (`question-mc`, `question-tf`, `question-fill`) to prevent capturing generated HTML previews back into `properties.content`, which would corrupt question widget data.

### Tests Added
- **`converters.test.ts`** — 9 new unit tests covering the three converters fixes; renamed one existing test for accuracy; fixed one stale assertion (`def.actions` → `def.elearnActions` per the GrapesJS forEach crash guard comment).
- **`persistence.spec.ts`** — 2 new FM-05 E2E regression tests:
  - `FM-05 — text widget content survives slide switch and return` — verifies sentinel text placed in a text widget is still present after navigating to another slide and back.
  - `FM-05 — nav-buttons widget is NOT placed at (0,0) after slide switch and return` — verifies the bounding box of nav-buttons does not jump to the top-left corner (≤50px delta).

---

## [0.5.3] — 2026-03-28 — GrapesJS Race Fix & Moodle SCORM Integration Tests

### Added
- **`e2e/tests/moodle-scorm.spec.ts`** — 2 new opt-in Moodle SCORM integration tests (both passing):
  - **Step 1** — creates a 3-slide course via API (text, image, MC question widgets) and exports a SCORM 1.2 ZIP, asserting content-type and non-empty archive.
  - **Step 2** — uploads the ZIP to a live Moodle instance, launches the SCORM player popup, and verifies each slide renders the expected widget DOM inside `iframe#scorm_object`. Compatible with Moodle 4.x and 5.x via dual-selector fallback for edit-mode toggle.
  - Activation: `E2E_MOODLE=1 npx playwright test tests/moodle-scorm.spec.ts` (skipped by default to avoid requiring Moodle in standard CI).
- **`docs/issues/issues-T609.md`** — root-cause analysis of the GrapesJS concurrent `editor.load()` race condition; documents BUG-T609-01 (CRITICAL) and BUG-T609-02 (HIGH), both fixed.
- **`docs/issues/issues-T610.md`** — documents Moodle SCORM integration test suite creation; records BUG-T610-01 (Moodle admin password mismatch on persistent volume) and GAP-T610-01 (no prior E2E Moodle coverage), both resolved.

### Fixed
- **GrapesJS concurrent load race** (`e2e/pages/EditorPage.ts`, `EditorCanvas.tsx`) — `EditorPage.goto()` returned as soon as the toolbar appeared, before `editor.load()` completed. `beforeEach` hooks calling `addSlide()` immediately after triggered a second `editor.load()` on the same GrapesJS instance, causing an internal `TypeError: Cannot read properties of undefined (reading 'forEach')` crash and subsequent `waitForCanvas()` timeouts. Fix: `goto()` now probes for `iframe.gjs-frame` (3 s); if visible, waits for `[data-editor-ready="true"]` (15 s) before returning, guaranteeing the initial load has completed before any `beforeEach` side-effects run.
- **`loadGenRef` generation counter blocking `waitForCanvas()`** (`EditorCanvas.tsx`) — when the concurrent crash occurred, neither the `.then()` nor the `.catch()` of the superseded generation called `setIsReady(true)`, leaving `waitForCanvas()` blocked until the 8 s fallback timer fired. The generation guard is retained as a safety layer for legitimate rapid slide-switch scenarios; the root cause is eliminated by the `goto()` fix above.
- **E2E tests T601.0a and GAP-03 unblocked** — both tests were intermittently or consistently failing due to the race above; they now pass deterministically.

---

## [0.5.2] — 2026-03-28 — Moodle Screenshot

### Added
- **`docs/assets/screenshots/18-moodle-course.png`** — Moodle 4.x course page screenshot showing a Safety Procedures Training course imported from eLearn Studio SCORM export.
- **README.md** — Moodle screenshot embedded after the Course Authoring Workflow diagram with caption.

---

## [0.5.1] — 2026-03-27 — Slide Persistence, Text Padding & E2E Coverage

### Added
- **Text widget spacing controls** — Style Manager now includes a **Spacing** sector with individual Padding Top / Right / Bottom / Left controls (px) for all widgets. Text blocks ship with `4px 8px` default padding and `box-sizing: border-box` so content is never clipped by rounded-corner borders.
- **`PATCH /courses/:id/slides/reorder`** — New atomic endpoint to reorder all slides by supplying the complete ordered array of slide UUIDs. Must be registered before `/:id/slides/:slideId` in the Express router to prevent Express treating the literal string `"reorder"` as a slide ID.
- **Asset Manager Bearer auth** — `buildAssetManagerConfig()` now injects the JWT access token via `customFetch`, replacing the previous `uploadFile` override. GrapesJS `autoAdd: true` keeps uploaded assets visible in the picker immediately after upload.
- **`GET /assets/:objectName/presigned`** — New endpoint returns the presigned URL as JSON (instead of a 302 redirect), enabling the GrapesJS image widget view to set `model.set('src', presignedUrl)` without browser CORS constraints on the redirect.
- **E2E regression test suite expanded** — All 8 coverage gaps (GAP-01 through GAP-08) now have Playwright tests:
  - `persistence.spec.ts` — widget survival on reload (GAP-03), autosave race condition (GAP-06), session restoration after F5 (GAP-05)
  - `grapesjs-integration.spec.ts` — property persistence across slide navigation (FM-05 / GAP-01), widget repositioning within canvas (FM-02 / GAP-08)
  - `question-widget.spec.ts` — Props panel edit reflected in canvas (GAP-07)
  - `action-sequence.spec.ts` — Actions panel accessible with widget selected (GAP-02)

### Fixed
- **Slide persistence data loss** — Unsaved widget edits (position, size, style, content) were silently lost when the user navigated to a different slide before the 2-second autosave debounce fired. `EditorCanvas` now eagerly saves the current slide via `editor.store()` before switching `storageContext` and calling `editor.load()`. A `prevContextRef` guard prevents the redundant save on initial mount. An `AbortController` prevents race conditions on rapid slide switches.
- **Question widget converter defensive check** — `grapesjsFromWidgets()` now guards against partially-populated `extendedProperties` objects (e.g., `{}` from an older save) falling through to the wrong default, preventing blank question previews after round-trip save/load.
- **Free-form drag & drop** — `dragMode: 'absolute'` set at GrapesJS init level; `[data-gjs-type] { position: absolute }` canvas CSS removed (replaced by GrapesJS's own absolute mode); `position/left/top` removed from widget defaults so initial placement uses GrapesJS drop coordinates rather than a fixed `20px / 20px` origin.

---

## [0.5.0] — 2026-03-24 — Documentation & Visual Guides

### Added
- **User Guide** — 10-section end-to-end guide for course authors: getting started, editor overview, all widget types, all question types, Actions Editor, screenshot simulations, Phaser simulations, publishing, and course history
- **Developer Guide** — 6-section guide for contributors: system architecture (Mermaid diagrams), local setup walkthrough, adding widget types, adding Phaser simulation subtypes, observability stack, and contributing workflow
- **API Reference** — Full REST API documentation for all 9 endpoint groups: auth, courses, assets, export, simulations, history, telemetry, health — with TypeScript interfaces, curl examples, status code tables, and error cases
- **SCORM & LMS Integration Guide** — 6-section guide: which standard to choose (decision flowchart), SCORM 1.2 export + Moodle import walkthrough, SCORM 2004 sequencing flow + manifest structure, AICC 4-file format + HACP bridge, full LMS × standard × feature compatibility matrix, 9-scenario troubleshooting guide
- **Documentation Home** (`docs/index.md`) — Updated hub page linking all structured guide directories
- **Glossary** (`docs/glossary.md`) — Definitions for SCORM, AICC, xAPI, LMS, Widget, ActionSequence, SimStep, Phaser Simulation, Garage, Runtime Player, and more
- **Playwright Screenshot Automation** — `docs/scripts/capture-screenshots.ts` captures 18 of 19 planned screenshots (screenshot 18 requires Moodle service); integrated as `pnpm --filter docs run capture`

### Fixed
- API reference: added missing `GET /health` and simulation endpoints documentation
- API reference: clarified logout response envelope exception
- All internal documentation cross-links verified and updated

---

## [0.4.0] — 2026-03-24 — Polish & Accessibility

### Added
- **WCAG 2.1 AA Accessibility Audit** — Full axe-core audit on runtime-player with ARIA labels, keyboard navigation for all interactive elements, color contrast compliance, and live regions for question feedback
- **SCORM 2004 Support** — Complete SCORM 2004 API bridge (Initialize/Terminate/GetValue/SetValue/Commit), sequencing rules XML, completion/success status fields, per-SCORM 2004 schema
- **Performance Optimizations** — Runtime player bundle under 21KB gzip; Phaser bundle under 321KB gzip; slide asset prefetching for next 2 slides; GrapesJS in-memory course cache elimination of redundant API calls
- **Course Templates** — Four built-in templates: Linear Course, Software Tutorial, Process Training, Assessment Only; template picker in "New Course" dialog; "Save as Template" action for any course
- **Complete Documentation Set** — User guide with all widget types, simulation guide covering screenshot sims and all Phaser sim types, actions editor reference, API documentation, SCORM compatibility matrix, developer guide

### Fixed
- All CRITICAL and HIGH issues from T040, T041, T042, T043 resolved
- Accessibility issues: button ARIA labels, question widget keyboard operability, Phaser sim keyboard navigation
- Performance: removed redundant API calls, optimized bundle sizes, added asset prefetching
- Template picker and dialog refinements

---

## [0.3.0] — 2026-03-23 — Phaser.js Advanced Simulations

### Added
- **Phaser.js Integration** — Lazy-loaded Phaser 3 bundle (only included if course contains Phaser sim); modular scene architecture with ScoreTracker and ModeController
- **Process Flow Simulation** — Animated node/arrow diagrams with demo/practice/assessment modes; demo auto-advances with configurable delay; practice requires correct node selection; authoring UI for node/edge list editing
- **Interactive Diagram Simulation** — Background image with overlaid hotspot sprites; info popups on click; assessment mode scoring; authoring UI for image and hotspot configuration
- **Gamified Quiz Simulation** — Countdown timer, lives system, score combo multiplier with animated feedback; final score screen; authoring UI for timer/lives/combo + question list
- **Phaser Widget in Authoring** — GrapesJS block registration; extended properties panel for simType selection, mode configuration, passing score; preview modal; JSON sceneDef editor
- **Phaser Widget in Runtime Player** — Dynamic import of Phaser bundle; widget container mounting; `elearn:widgetScore` event bridge to SCORM; proper cleanup on slide navigation
- **SCORM/AICC Integration for Phaser** — Conditional Phaser bundle inclusion in packagers; bundle only added if course contains Phaser widgets
- **109 Unit Tests** — ScoreTracker, ModeController, ProcessFlowLogic, InteractiveDiagramLogic, GamifiedQuizLogic, PhaserSimWidget mount/destroy, bundle conditionals

### Changed
- Phase 3 External Review Fixes (IMP-01 through IMP-05):
  - Cycle detection in shared action sequences (DFS-based with full path reporting)
  - Hover and typing interaction support in screenshot simulations
  - Bring-to-front action with z-index preservation on show
  - Suspend data usage indicator in publish panel (color-coded progress bar)

### Fixed
- All CRITICAL and HIGH issues from T030, T034, T035 resolved
- C-02: null guards in ScoreTracker and ModeController
- H-01: divide-by-zero in score calculation
- H-02: test isolation and proper cleanup
- H-03: missing type exports for scene classes

---

## [0.2.5] — 2026-03-22 — Cross-Cutting Concerns & External Review Fixes

### Added
- **Cycle Detection in Shared Sequences** — Dependency graph builder detecting direct cycles (A→A) and indirect cycles (A→B→A); full path reporting in validation warnings
- **Hover and Typing Step Types** — Interactive simulation support for `hover` and `type` interactions; case-insensitive text matching; attempt counting and feedback
- **Bring-to-Front Action** — Z-index management for widget layering; save/restore z-index on show/hide operations
- **Suspend Data Usage Indicator** — Color-coded progress bar in publish dialog (green <75%, amber 75–90%, red >90%); real-time estimate of compressed data size
- **100+ Unit Test Cases** — Cycle detection (3), suspend size bounds (1), nested action validation (1), concurrent animations (1), HACP cross-origin security (10), and more

### Fixed
- T201: cycle detection implementation with DFS algorithm
- T202: simulation step type extensions (hover, typing)
- T203: bring-to-front action with z-index preservation
- T204: suspend data usage indicator UI
- T205: external test cases for bounds, nesting, concurrency, and HACP security

---

## [0.2.0] — 2026-03-22 — Interactivity + Screenshot Simulations

### Added
- **Actions Editor** — Visual action programming interface with 13 action types: Navigate, Show/Hide, Set Variable, Display Message, Play/Stop Media, Score Question/Quiz, Send to LMS, Suspend Lesson, Bring to Front, Condition (if/else), Loop (count/while), Call Sequence, Play Animation
- **Event System** — Widget-level and slide-level events: onClick, onDoubleClick, onEnter, onQuestionAnswered, onSessionStart, onSessionEnd; event routing to action sequences
- **Variable System** — Course-level variable tracking with immutable updates; expression evaluation in conditions; literal and expression-mode parameter inputs
- **Shared Action Sequences** — Course-level macros (SharedActionSequence) with call-sequence action; dependency tracking; validation and cycle detection
- **Action Executor** — Runtime execution of all 13 action types with proper branching (conditions), looping (break/continue), and expression evaluation
- **Advanced Question Types** — Match items, drag-to-drop zones, arrange objects, order text segments, hotspot regions (single/multi-select)
- **Feedback System** — Delayed feedback queue with `enqueueFeedback` and `flushFeedback`; immutable feedback state; per-question result tracking
- **Answer Randomization** — Configurable randomization for multiple-choice questions with RNG seeding
- **Scoring Enhancements** — Partial credit, negative weight penalties (clamped 0–100), weighted aggregation per question
- **Remediation Paths** — Course-level remediation slide configuration; auto-navigate when final score < passMark
- **Screenshot Simulation Recorder** — Node.js service (simulation-engine, port 3002) using Playwright + Chrome DevTools Protocol
  - `POST /recorder/start` — launch Chromium, navigate to URL, return sessionId
  - `POST /recorder/capture` — screenshot + CDP event state (clicks, keyboard, select changes)
  - `POST /recorder/stop` — finalize session JSON, upload screenshots to Garage
  - `GET /recorder/sessions` — list all sessions
  - `GET /recorder/sessions/:id` — retrieve full session with steps and images
- **Screenshot Simulation Editor** — Konva.js canvas for pixel-precise hotspot editing over screenshots; step list with thumbnails; instruction/hint/feedback text per step; demo delay and max attempts configuration; step reordering and addition/deletion
- **Screenshot Simulation Player** — Three distinct modes:
  - **Demo** — auto-advance with step.demoDelay ms timer
  - **Practice** — wait for click in target rect (+ tolerance), provide feedback and retry up to maxAttempts
  - **Assessment** — single attempt, immediate scoring
  - Score = (correct steps / total steps) × 100; sent to SCORM `cmi.core.score.raw`
- **AICC Packager** — Generate `.au`, `.crs`, `.des`, `.cst` files per AICC specification; HACP runtime bridge with HTTP protocol support
- **Suspend/Resume** — Serialize course state (currentSlideIndex, scores, variables) as JSON, compress with LZString to fit within 4096 char SCORM suspend_data limit; restore on load via `LMSGetValue`
- **Path Animations** — Bezier path drawing in GrapesJS (Konva overlay); duration, easing, loop config; Web Animations API execution in runtime player; "Play Animation" action
- **117 Unit Tests** — ActionExecutor (all 13 action types, conditions, loops), advanced question evaluators, SimulationPlayer (3 modes), AICC file format, suspend/resume roundtrip

### Changed
- Slide model now includes `actions: ActionSequence[]` field; Widget model extended with `actions` sub-array
- Runtime player architecture refactored to support action execution alongside widget rendering
- SCORM export now includes suspend_data bridge

### Fixed
- All CRITICAL and HIGH issues from T020–T028 resolved
- Action validation with non-blocking warnings
- Race condition in action index tracking (stable prop instead of indexOf)
- Silent drop warnings for invalid actions
- Simulation step interaction type and feedback text

---

## [0.1.5] — 2026-02 — garage → Garage Migration

### Changed
- **Storage Layer Migration** — Replaced unmaintained garage OSS with **Garage** (AGPL, Rust-based, v1.0 stable)
- Docker images: `garage/garage` → `dxflrs/garage:v1.0.0`
- Backend SDK: `garage` npm package → `@aws-sdk/client-s3` (S3-compatible API)
- Configuration: new `docker/garage.toml`, updated `docker/.env.example`, `garage-init.sh` service for bucket and key setup
- All asset upload/download endpoints remain unchanged (transparent to authoring UI and runtime player)
- **Full backward compatibility** — All Phase 0 and Phase 1 tests pass identically with Garage backend

### Fixed
- S3 path-style URL configuration for Garage (`forcePathStyle: true`)
- Garage admin API calls (layout apply, key creation, bucket permissions)

---

## [0.1.0] — 2026-02-06 — Core Editor (GrapesJS) + SCORM Foundation

### Added
- **Monorepo Setup** — pnpm workspaces with 7 packages (authoring-ui, simulation-engine, question-engine, actions-editor, scorm-packager, runtime-player, phaser-simulations) + backend/api
- **Docker Infrastructure** — docker-compose.yml (api, mongo, garage, moodle, moodle-db) and docker-compose.dev.yml (hot reload); dev and production configurations
- **Backend API** — Express 5 + TypeScript in backend/api with:
  - MongoDB (Mongoose) with Course, Slide, Widget schemas
  - Garage S3-compatible storage for assets
  - `/health` endpoint (mongo + storage status)
  - Course CRUD: `POST /courses`, `GET /courses`, `GET /courses/:id`, `PUT /courses/:id`, `DELETE /courses/:id` (soft delete)
  - Atomic slide operations: `POST /courses/:id/slides`, `PATCH /courses/:id/slides/:slideId`, `DELETE /courses/:id/slides/:slideId` (R-07 fixes)
  - Asset management: `POST /assets` (multipart upload to Garage), `GET /assets/:id` (proxy download)
  - SCORM 1.2 export: `POST /courses/:id/export/scorm12` (streams ZIP via res.download)
- **GrapesJS Integration** — Full-featured visual slide editor with:
  - Fixed slide device (1024×768) + custom storage manager (`elearn-api` type) converting to/from our Course/Slide/Widget JSON schema
  - Custom blocks for all basic widget types: text, image, button, rectangle, nav-buttons, score-field, score-quiz, done-button, media-player
  - Question blocks: `question-mc`, `question-tf`, `question-fill`
  - Asset Manager connected to Garage via backend API
  - Layer Manager with z-order control and object naming
  - Style Manager for properties panel
  - Auto-save on component updates (2s debounce)
- **Question Engine Library** — `packages/question-engine` TypeScript library with:
  - Evaluators: `evaluateMultipleChoice()`, `evaluateTrueFalse()`, `evaluateFillInBlank()` (exact, case-insensitive, regex matching)
  - `calculateQuizScore()` with weighted averages and pass/fail determination
  - TypeScript discriminated union types for all question types
  - 20 unit tests covering edge cases and scoring
- **Slide Management** — Add, duplicate, delete, reorder slides; inline title editing; thumbnail generation via html2canvas
- **Extended Properties Panel** — React panel outside GrapesJS canvas for question widget configuration:
  - Multiple choice: options, mark correct, scoring, feedback
  - True/false: correct answer, scoring, feedback
  - Fill-in-blank: correct answers, match type (exact/regex/case-insensitive), feedback
  - Attempt limits and per-question scoring
- **SCORM 1.2 Packager** — `packages/scorm-packager` with:
  - `buildManifest()` generating imsmanifest.xml per IMS/ADL schema with masteryscore
  - `buildIndexHtml()` embedding course JSON (unicode-escaped) and loading player.js
  - Asset copying into ZIP under `assets/` folder
  - Standalone preview mode (graceful fallback when SCORM API not found)
  - Integration test: SCORM 1.2 ZIP imports into Moodle, imsmanifest validates, index.html loads player
  - 119 unit tests for manifest structure and file generation
- **Runtime Player** — `packages/runtime-player` Vanilla JS + HTML5 IIFE bundle (~19KB unminified) with:
  - JSON course loading (via `window.__courseData` or init param)
  - Absolute positioning slide rendering (x/y/w/h bounds)
  - All widget type rendering: text, image, button, rectangle, nav-buttons, score-field, done-button, media-player, question widgets
  - Interactive question evaluation (MC, TF, fill-blank) with client-side logic
  - Navigation buttons: prev/next/goToSlide
  - Quiz scoring: "Score Quiz" button collects answers, calculates weighted score
  - Done button: calls scormReport() → LMSSetValue score + lesson_status, LMSFinish
  - SCORM 1.2 API bridge: `findScormApi()` (traverses window.parent up to 10 levels), LMSInitialize/SetValue/Commit/Finish
  - Standalone mode: graceful SCORM reporting skip when API not found
  - Keyboard navigation: ArrowLeft/ArrowRight in standalone mode
  - lesson_location restore on init
  - HTML/CSS/attribute escaping helpers
  - 198 unit tests for all widget rendering and SCORM integration
- **Build Infrastructure** — Rollup configs for all packages; root scripts: `pnpm dev`, `pnpm test`, `pnpm lint`, `pnpm build`
- **Testing** — Vitest + @testing-library/react for frontend; native Node test runner for backend; 80%+ coverage across all packages
- **Documentation** — setup-guide.md (Docker quick start, env vars, first-run checklist)

### Key Implementation Details
- All widgets stored as immutable objects with dedicated update functions (no mutations)
- GrapesJS canvas uses `position: absolute` for all components (fixed layout matching ToolBook)
- Custom storage manager prevents GrapesJS from saving raw HTML; always maps to our Course schema
- SCORM API lookup traverses up to 10 parent frames (LMS iframes)
- Asset URLs stored as direct Garage S3 URLs (no proxy overhead)
- Soft delete for courses (deleted_at timestamp, not hard-deleted)

### Fixed
- R-01/R-02: Consistent API response envelope (success, data, error)
- R-03: updateStorageContext callback integration with storage manager
- R-06: Multipart form-data headers for asset uploads
- R-07: Atomic slide operations using MongoDB positional updates ($set with array index)
- R-08: Dynamic health check URL configuration for authoring UI

---

## [Unreleased]

> Features under development or planned for future releases appear here.

---
