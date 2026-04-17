# eLearn Studio — Working Context

> **This file is the first thing to read at the start of every Claude Code session.**
> It is updated by Claude Code after every completed task block.
> Last updated: 2026-04-17 — T646 ✅ done (Phase 10: dragstart leak fixed, autosaveTimer cleared in cleanup, ghost rAF guarded by isUnmounted; 712 unit tests pass)

---

## Current State

| Field | Value |
|---|---|
| **Latest release** | v0.0.1-beta (2026-03-31) |
| **Current version** | v0.5.50 |
| **Active phase** | Phase 10 — React/GrapesJS Architectural Refactor |
| **Active block** | T647 — Fix EditorCanvas pre-navigation store(): add UI state update |
| **E2E test count** | 162 tests (160 passing, 2 skipped — T611.10 resolved) |

---

## What Was Last Done

- **T646 — Fix initEditor leaks: dragstart listener + autosaveTimer guard ✅ (T646 CLOSED)** — Phase 10 third task. Three accumulated resource leaks fixed in `initEditor.ts`. T646.3: `dragstart` listener extracted as named `dragstartHandler` const — registered once on `blockContainer`, removed by exact same reference in `cleanup()`. Prior to fix, each `initEditor()` call added a new handler without removing the previous; after 3–4 course changes, multiple handlers mutated the drag ghost simultaneously. T646.4: replaced `try/catch` DOM removal with `ghost.isConnected` guard; added `isUnmounted` flag (set to `true` in `cleanup()`) that blocks the `requestAnimationFrame` callback from touching `document.body` after `editor.destroy()`. T646.1/T646.2: `cleanup()` function composes all teardown — `isUnmounted = true` → `clearTimeout(autosaveTimer)` → `removeEventListener('dragstart', dragstartHandler)` → `unsubscribeCacheInvalidate()`. Called by `EditorCanvas` Effect 1 before `editor.destroy()`. T646.5: `_isEditorLoading` module-level flag kept; decision documented in `decisions/2026-04-17-editor-loading-flag.md` (GrapesJS fires `component:add` synchronously during `loadData()` — no React state update can propagate in time). T646.6: 4 new unit tests using `vi.useFakeTimers()` — clearTimeout guard, no-accumulation across 3 cycles, isUnmounted blocks removeChild in rAF; key afterEach pattern: `querySelectorSpy.mockRestore()` NOT `vi.restoreAllMocks()` (restoreAllMocks resets all vi.fn() module mocks). T646.8: task-ref comments removed from dragstart block; tsc clean. Code review: APPROVED (0 issues). `docs/issues/issues-T646.md` generated. 712/712 tests pass. Commits: `00dce16`, `e843512`.

- **T645 — Fix storageManager singletons: StorageContextProvider DI ✅ (T645 CLOSED)** — Phase 10 second task. Eliminated three module-level singletons (`storageContext`, `updateStorageContext`/`getStorageContext`, `invalidateCourseCache`) that bypassed React's lifecycle. Replacement: `StorageContextProvider` interface (T645.3.1) with `getContext()` (reads Zustand `getState()` synchronously at call time — T645.3.4) and `onCacheInvalidate(cb)` (Zustand plain `subscribe` on `cacheVersion` — T645.4). `storageManager.ts` has no Zustand import — DI only. New `registerStorageManager(editor, provider): () => void` replaces old init pattern. `bumpCacheVersion()` Zustand action replaces `invalidateCourseCache()`. `courseCache` lifecycle strictly private to module, reset only via provider callbacks (T645.3.5). Callers updated: `EditorCanvas.tsx`, `TopToolbar.tsx`, `SlideList.tsx` (T645.5). `initEditor` return type changed to `{ editor, cleanup }` — cleanup wraps `unsubscribeCacheInvalidate()` and is designed for T646 extensibility (T645.7). `storageManager.test.ts` rewritten with `makeProvider()` helper; 708/708 tests pass. Old API grep: 0 live calls remain. Code review: APPROVED (0 issues). `docs/issues/issues-T645.md` generated. Commits: `505de96`, `6752076`.

- **T644 — Fix PhaserSimPropertiesPanel: align with panel pattern ✅ (T644 CLOSED)** — Phase 10 first task. `PhaserSimPropertiesPanel` was the only panel that bypassed the established `useComponentProperty` pattern. T644.1: replaced direct `getExtendedProps(selected)` read with `useComponentProperty<PhaserSimExtendedProps>` subscription — undo/redo now re-renders the panel correctly. T644.2: removed `editor.store()` call from `update()` — saves route through `comp.set()` → `component:update` → debounced autosave in `initEditor.ts`. T644.3: replaced `onBlur` sync with `useEffect([ep.sceneDef])` so the textarea reflects any external Backbone mutation (undo/redo, remote). T644.7 refinements: `PhaserSimSceneDefEditor` converted to pure controlled component (no internal state); `GjsComponent` type exported from `useComponentProperty.ts`; optimistic `setValue()` added to `useExtendedProperty.update()` (parity with `useComponentProperty`); `Handler` → `ChangeHandler` rename + `ComponentMock` interface in hook test. 16 panel regression tests + all 712 suite tests green. Code review: APPROVED (0 issues). `docs/issues/issues-T644.md` generated. Commits: `9fcaf6d`, `df52fdf`, `b5e2a20`.

- **T643 — Fix forEach crashes: GrapesJS loadData + validateSequence ✅ (T643 CLOSED)** — Two independent bugs sharing the same `TypeError: Cannot read properties of undefined (reading 'forEach')` symptom. T643.1: `phaser-sim` and `screenshot-sim` were absent from `GENERATED_CONTENT_TYPES` in `converters.ts`; on reload `grapesjsFromWidgets()` set `def.content` to the saved `PLACEHOLDER_HTML` string, GrapesJS parsed it into auto-generated child defs without `actions: []` → crash. Also added guard: `text`/`button` widgets skip setting `def.content` when the stored value is HTML markup (detected via leading `<`). T643.2: three `.forEach()` calls in `validateSequence.ts` (lines 90, 102, 129) had no optional-chaining guard; old MongoDB documents saved before field types were required could have `condition.then`, `loop.body`, or `sequence.actions` absent at runtime → crash when user selected a widget (ActionsPanel render → validateAllSequences). Fixed with `?.forEach()`. 7 converter regression tests + 3 validateSequence regression tests added. 696 unit tests green. CI ✅ (run 24311195340).

- **T641.1 — Preview popup + T611.10 pass ✅ (T641 CLOSED)** — Root bug: `EditorPage.closeCourseSettings()` matched the Cancel button via regex `/close|cancel/i`, so the `navigationMode` selected in the Course Settings dialog was never saved to the backend. `course.settings.navigationMode` in the Zustand store remained `'free'`, causing `slideIsComplete()` in the runtime player to return `true` immediately (no gating), and the Next button stayed enabled. Fix: added `saveCourseSettings()` to `EditorPage.ts` that explicitly clicks `data-testid="course-settings-save"` and waits for the dialog to close. Updated T611.10 in `question-widget.spec.ts`: (1) calls `saveCourseSettings()` instead of `closeCourseSettings()` after setting linear-strict mode, (2) waits for the PATCH response via `waitForResponse()`, (3) removed all DIAGNOSTIC console.log / evaluate blocks from Step 4. Prior-session fix also contributed: `renderMCQuestion` / `evalMC` in `runtime-player/src/index.ts` now handle `MCOption[]` objects (`{ id, text, isCorrect }`) in addition to plain strings. **T611.10 passes (30.4s). 30/30 question-widget E2E tests green (was 29/30 + 1 skipped). SKIP-01 resolved.**

- **T640.11 — Code-review issue resolution ✅ (T640 CLOSED)** — All 7 issues from T640.7 reviewer report resolved: (H-01) Added inline comment to `storageManager.ts` cache-update block documenting JS single-threaded guarantee and Worker Threads caveat; (H-02) Added `Array.isArray(courseCache.doc.slides)` guard before `.map()` — sets `courseCache = null` on corrupt data instead of throwing TypeError; (M-01) Expanded `autoload: false` comment in `initEditor.ts` with full 6-step race sequence (init fires load before context set → blank canvas → EditorCanvas load → correct widgets → race → blank overwrites); (M-02) Added clarifying comment that `courseCache.doc` is non-null by outer if-guard and TypeScript type declaration; (M-03) Moved `invalidateCourseCache()` to outer `beforeEach` fixture in `storageManager.test.ts` for consistent test isolation; (L-01) Applied in previous session — "failed PATCH request (network error or 4xx/5xx)"; (L-02) `autosave:false` comment now says "every command including every keystroke in text widgets and every component add/remove." Verdict updated to APPROVED. **686 unit tests green.**

- **T640.6 — Persistence flow doc corrections ✅** — Manual read of `storageManager.ts`, `initEditor.ts`, and `docs/developer-guide/08-persistence-flow.md` identified 5 inaccuracies vs. actual code. All corrected: (1) Step 4 snippet now shows `editor.getComponents().toArray()` — the `store()` callback is a closure capturing `editor`, not reading `gjsData.components`; (2) New Step 5 documents thumbnail generation (`generateThumbnail(editor)`) with isolated try-catch, and PATCH payload corrected to `{ widgets, thumbnail }`; (3) Load pseudo-code now includes the required `{ pages: [{ id, component: { actions: [], components } }], styles: [] }` GrapesJS wrapper; (4) Key Files table: `widgetConverters.ts` → `converters.ts` (actual import); (5) Source-of-truth rule nuanced — `SaveErrorBanner` retry is an intentional exception to "never call `editor.store()` from React". Steps renumbered (old 5→6→7→8 to accommodate new thumbnail step). Sequence diagram updated. `storageManager.ts` and `initEditor.ts` needed no changes.

- **T640.4 — Persistence flow documentation ✅** — Created `docs/developer-guide/08-persistence-flow.md` covering the full edit→save→cache→load pipeline. Includes: source-of-truth boundary table, detailed step-by-step walk-through, `autoload:false`/`autosave:false` rationale, cache lifecycle table, ASCII sequence diagram, failure modes table, and a key files reference. Linked from `docs/developer-guide/index.md`.

- **T640.1–T640.3 — StorageManager: cache update on successful store() ✅** — `store()` success path no longer invalidates `courseCache = null`. Instead it updates the cached slide's widget list in-place via immutable spread. `courseCache = null` kept only in the `catch` block (failure path). Result: `load()` after a successful save hits the in-memory cache; no redundant `GET /courses/:id` round-trip. Two new unit tests: (1) `getCourse` called only once across load → store → load sequence; (2) `grapesjsFromWidgets` is called with the fresh saved widgets (not stale pre-store data) — regression guard against BUG-T640. 20/20 storageManager unit tests green.

- **T639 — Stale-closure fix: `useComponentProperty` / `getLatest()` (T639.1–T639.11) ✅ CLOSED** — Root cause: `useExtendedProperties.update(patch)` spread over `ep` from the React closure (value at last render). Rapid consecutive updates caused silent data loss. Fix: `useComponentProperty` exposes third return element `getLatest()` (reads `latestRef.current`, always fresh). T639.2: `QuestionPropertiesPanel` update() uses `getLatest()`. T639.4: `AnimationPropertiesPanel` save() uses `getLatestEp()`. T639.5: rule in CLAUDE.md + SKILL.md. T639.6: developer guide updated. T639.7: 6 unit tests added (680 green). T639.8: GrapesJS destroy/load race fixed in `initEditor.ts` (`em.loadData` monkey-patch checks `em.destroyed`); E2E regression test passes 11.1s. T639.9: CI green. T639.10: scoring sub-patch callbacks in all three question forms use `getLatest().scoring`. T639.11 (code review): 13 issues resolved — `UsePropertyReturn<T>` shared labeled tuple type (HIGH-01); `useExtendedProperty` now also returns `getLatest()` (HIGH-02); `AnimationExtendedProps` typed interface replaces `Record<string, unknown>` (MEDIUM-01); block scoping around `em.loadData` removed (MEDIUM-02); 4 new `useExtendedProperty — getLatest()` unit tests (MEDIUM-03); `ep.scoring` defaults comment (MEDIUM-04); plus LOW-01–LOW-06 (comments, `try/catch` on `removeChild`, ESLint annotations). **684 unit tests + 162 E2E tests green. APPROVED.**

- **T638 — Fix typography changes not affecting Score Widgets / v0.5.43** — Style Manager `font-size`/`color` changes had no visual effect on `quiz-score` and `score-field` canvas previews because `onRender()` injected hardcoded inline styles with higher CSS specificity than the GrapesJS CSS rule. Initial fix (d22fb16): `change:style` Backbone listener + `model.getStyle()` re-render — worked in dev but failed in CI production build (minified Backbone event not firing). Final fix (7bae6ec): removed inline `font-size`/`color` from `onRender()` entirely; GrapesJS applies `setStyle()` to `el` via CSS rule, inner elements inherit automatically. Also added `quizTitle`/`scorePrefix` editable traits. 5 `@regression` E2E tests in `score-widgets.spec.ts` (T638.5a–5e) — all pass in CI. 673 unit tests pass. Code review: APPROVED. `docs/issues/issues-T638.md` generated.

- **T637 — Text Widget Editing: RTE Cursor Loss / v0.5.43** — 5 cursor-loss root causes identified and fixed. (1) `Commands.isActive('text-edit')` always false → replaced with `isRteActive` closure flag (T637.2); (2) `elearn:paste` fires via keymap contenteditable gap → `if (isRteActive) return` guard (T637.1); (3) `elearn:copy` overwrites native clipboard → same guard (T637.1); (4) `component:update` on every keystroke → covered by isRteActive autosave guard; (5) `fromMove:true` suppresses `rte:disable` → documented, not fixed (low impact edge case). T637.3+T637.4: explicit `richTextEditor: { actions: ['bold','italic','underline','strikethrough','link'] }` in `grapesjs.init()`. T637.5: 4 regression E2E tests in `text-widget-rte.spec.ts` (cursor, paste suppression, toolbar, autosave) — all pass (20.7s). T637.6: full suite 154 pass, 3 skipped (FLAKE-02 pre-existing). T637.7: removed T637.1 diagnostic console.debug block + deleted `t637-diagnostic.spec.ts`. T637.8: code review APPROVED (0 issues), `docs/issues/issues-T637.md` updated. 673 unit tests pass. Commits: see git log.

- **T636 — Cross-slide copy/paste / v0.5.42** — Module-level clipboard in `clipboard.ts` (`let _clipboard`) survives GrapesJS `editor.load()` calls during slide navigation (editor is NOT recreated). `elearn:copy` command captures selected component's `style + definition`; `elearn:paste` command adds the definition to the new slide's canvas and restores `left/top/width/height` via `addStyle()`. Keymaps: `ctrl+c` / `ctrl+v`. 3 `@regression` E2E tests in `copy-paste-widget.spec.ts` use `runCommand` directly (bypasses DOM focus issues after `slidesTab.click()`). Unit tests: 672 pass. Full E2E suite: 153 pass (150+3 skipped). Code review: APPROVE (0 issues). Commits: `209805c` (implementation) + `cba6d28` (wrap-up).

- **T611/T612/T634 issues closure / v0.5.41** — Final two code fixes applied to `runtime-player/src/index.ts`: T611 M-01 garbled JSDoc in `slideIsComplete()` cleaned up + inline comment at Map-absence check site (`// Missing entry means unanswered`); T611 M-02 inconsistent type cast in `handleSubmit()` replaced with `ep?.scoring as QuestionScoringInfo | undefined`. All items in `issues-T611.md` (7 items), `issues-T612.md` (6 items), and `issues-T634.md` (M-01, L-01, L-02) marked RESOLVED. 256 runtime-player tests pass. Commit: `7313cc7`.

- **T635 — SCORM format selector / v0.5.40 / 6b6a9da** — `ExportFormat = 'scorm12' | 'scorm2004' | 'aicc'` exported from `PublishDialog.tsx`. Radio group with per-format descriptions added to publish dialog (SCORM 1.2 selected by default; confirm button label updates dynamically). `onConfirm` signature updated to `(format: ExportFormat) => void`. `triggerZipDownload` helper refactors shared blob download logic; `exportSCORM2004` + `exportAICC` added to `courseApi.ts`. Backend: `POST /courses/:id/export/scorm2004` + `/aicc` routes added (same rate-limit/asset-rewriting pattern as scorm12). 5 `@regression T635` E2E tests. All 1266 unit tests + 15 SCORM E2E tests pass. Code review: APPROVE (0 issues). CI run: ✅ green.

- **T631.3 waitForCanvas hang fix / 0db0248** — `waitForCanvas()` Phase 1 used `page.waitForFunction()` with a 500ms timeout to detect the `data-editor-ready="false"` transition. When the browser JS thread was busy post-load (GrapesJS component reconstruction), Playwright's CDP queue backed up — the 500ms timeout never fired, causing ~59s hangs in all 14 `beforeEach` hooks of `question-widget.spec.ts`. Fix: replaced `waitForFunction()` with `waitForTimeout(300)` — a pure Node.js timer. Phase 2 still gates on `data-editor-ready="true"`. All diagnostic TEMP DIAG T631.3 code removed from EditorPage.ts, question-widget.spec.ts, EditorCanvas.tsx. 142/145 E2E pass (3 pre-existing skips). T635 now unblocked.

- **T634 — Fix nav-buttons "missing child buttons" error / v0.5.39** — Root cause: `onRender()` HTML injection meant `component.components().at(0/1)` returned `undefined` in `NavButtonsPropertiesForm`, showing the "corrupted" error. Fix: replaced `onRender()` with `defaults.components` — two proper GrapesJS child button objects with `actions: []` (prevents loadData forEach crash). `widgetsFromGrapesjs` saves child labels as `prevLabel`/`nextLabel`; `grapesjsFromWidgets` restores them as child `content` on load with fallback defaults for backward compat. 6 unit tests + 3 E2E tests. Code review: APPROVE (0 CRITICAL/HIGH, 1 MEDIUM: loose type on `GrapesJsComponentDef.components`). Commit: `c7d123f`.

- **T633 — Fix button background image / v0.5.38** — `openBackgroundImagePicker` in `ButtonPropertiesPanel.tsx` switched from `component.setStyle()` (replace) to `component.addStyle()` (merge) so `left/top/width/height` are preserved on background assignment. Added `background-size: cover`, `background-repeat: no-repeat`, `background-position: center`. "Remove Image" clears all 4 background properties. `@regression T633.4` E2E test in `button-widget.spec.ts`. Commits: `d4a6055`.

- **T632 — Fix asset picker type for media/audio widgets / v0.5.37** — `detectAssetType(filename)` helper added to `assetManager.ts`: maps file extension to `'video'`, `'audio'`, or `'image'` — all uploads now tagged with correct GrapesJS type. `MediaPlayerPropertiesPanel` reads `mediaType` from component model and opens AM with `['audio','image']` or `['video','image']`. `AudioNarrationPropertiesPanel` changed from `['image']` to `['audio','image']`. Commit: `ece0142`. T632.4 regression test added to `media-player-widget.spec.ts`: smoke-level test verifies "Choose from Asset Library…" button opens GrapesJS AM modal; all 7 media-player tests pass. T632.5: CI run 24007832902 ✅ PASSED. T632 fully closed.

- **T631 — MC correct-answer regression test / v0.5.36** — Confirmed T621 fix (reads `comp.get('extendedProperties')` in `useExtendedProperties.update`) already covers MC/TF/Fill stale-closure issue. Added `@regression T631.6` E2E test in `e2e/tests/question-widget.spec.ts`: marks Option B correct, waits for autosave PATCH, reloads page, navigates back, asserts Option B is still the correct answer via `window.__elearn_editor`. Commit: `7d08f9c`.

- **Phase 2.8 Authoring UI Hardening / v0.5.35** — Four CRÍTICO fixes from Gemini code audit. T620: `useComponentProperty.ts` applies optimistic `setValue(newValue)` before `comp.set()` so controlled inputs never freeze; `latestRef = useRef(value)` tracks latest value to prevent stale closures. T621: `useExtendedProperties` wrapper reads `comp.get('extendedProperties')` directly (always current via Backbone.set) rather than stale closure `ep` — eliminates cascade-edit data loss. T622: `SaveErrorBanner.tsx` persistent red banner below TopToolbar; reads `saveError` from Zustand; Retry calls `editor.store()`, clears optimistically on success, updates message on failure; non-dismissible by design; SlideList navigation blocked when `saveError !== null`; TopToolbar "Save failed" badge added. T623: `extendFnView: ['initialize']` added to image widget view — removes `Object.getPrototypeOf(Object.getPrototypeOf(this))` prototype chain hack. 649 unit tests pass. Commit: `64a2ed9`.

- **C-03 SCORM export asset bundling / v0.5.34** — Verified the full 4-step asset pipeline in `backend/api/src/routes/courses.ts` was already implemented: `collectAssetSrcs()` extracts `/assets/<uuid>.ext` srcs from all slide widgets, `downloadAssets()` streams each object from Garage S3 to a tmpdir, `rewriteAssetSrcs()` deep-clones the course replacing `/assets/` with `assets/` (relative), `packSCORM12(rewrittenCourse, tmpDir, { assetPaths })` bundles assets into the ZIP. Added E2E gate tests to `packages/scorm-packager/src/__tests__/index.test.ts`: C-03a verifies asset file appears in ZIP at `assets/<uuid>.png`; C-03b verifies `index.html` contains relative `assets/<uuid>.png` and NOT `/assets/<uuid>.png`. 46 scorm-packager tests pass. Commit: included in v0.5.34.

- **C-02 sharedSequences end-to-end / v0.5.33** — Three-layer fix: (1) `packages/shared-types/src/course.ts` — `sharedSequences?: SharedActionSequence[]` added to `CourseDoc` (part of D-01 v0.5.31); (2) `packages/runtime-player/src/index.ts` — `course.sharedSequences ?? []` passed into actions context; (3) `backend/api/src/models/Course.ts` — `SharedActionSequenceSchema` + `sharedSequences` field added to Mongoose schema, PUT allowlist updated. Regression test in `courses.test.ts`. `call-sequence` action verified end-to-end via C-01.3 E2E test. Commit: `5c59d6d`.

- **C-01 actions engine E2E gate / v0.5.32** — Wired actions engine to runtime player with full E2E verification. Root bug: `renderWidget()` in `packages/runtime-player/src/index.ts` was returning `''` for `visible: false` widgets, making `show` actions impossible (no DOM element to operate on). Fix: render invisible widgets with `style="display:none"` + `data-hidden="true"` so `executeShow()` can find and reveal them. `slideRenderer.test.ts` updated to assert new behavior. New E2E spec `e2e/tests/runtime-player-actions.spec.ts` with 3 tests (C-01.1 hide, C-01.2 show, C-01.3 call-sequence) — all green at 259–481ms. Commit: `df7af97`.

- **D-01 shared-types refactor / v0.5.31** — Introduced `packages/shared-types/` as single source of truth for all widget/course/action/question types across the monorepo. Migrated `WidgetType`, `BaseWidget`, `Bounds`, `CourseDoc`, `Slide`, `SlideTemplate`, `Resource`, `CourseSettings`, `SCORMMetadata`, `NavigationMode`, `ActionSequence`, `SharedActionSequence`, and all question types out of `authoring-ui/src/types/` into `@elearn-studio/shared-types`. Added dual CJS + ESM build (`dist/index.js` + `dist/esm/index.js`) so Vite/Rollup consumers (authoring-ui) can statically analyse named exports and Node.js consumers (backend, scorm-packager) get CJS. Made `CourseDoc.templates?`, `resources?`, `sharedSequences?`, `deletedAt?`, `createdAt?`, `updatedAt?` optional and `passingScore?`/`masteryScore?` optional to match real fixtures and allow intentional fallback tests. Fixed `courseHasPhaserSim.test.ts` `makeWidget(type: WidgetType)` narrowing issue. 24 files changed, 790 insertions, 850 deletions. All 1444 tests across 8 packages pass. Commit: `f73576e`.

- **GrapesJS-React refactor / v0.5.30** — Fully eliminated the `isLocalRef` / `useRef(false)` anti-pattern from all 6 property panels. `AnimationPropertiesPanel` split into outer (null checks) + inner (`AnimationPanelContent`, receives guaranteed non-null `Component`) to fix null-safety crash from `component as never` cast. `QuestionPropertiesPanel` local `useExtendedProperties<T>` hook (49 lines with `isLocalRef`) replaced with a 7-line thin wrapper delegating to `useComponentProperty`. All panels now use shared `useComponentProperty<T>` / `useExtendedProperty<T>` from `hooks/useComponentProperty.ts`. 644 unit tests pass. Pending: commit.
- **Audit consolidado closure / v0.5.29** — Closed all remaining open ALTO and DEUDA TÉCNICA issues. A-06: replaced misleading "atomic single write" comment with accurate race-condition note in `PATCH /slides/reorder`. D-03: deleted 9 debug/test files from repo root (PHP, JS — untracked, already in .gitignore). D-05: deleted 4 `rollup.config-*.mjs` temp files from `packages/runtime-player/` (untracked, already in .gitignore). Confirmed A-01, A-05, A-07 already fixed in T600-T608. Confirmed D-04 untracked and in .gitignore. 131/131 backend API tests pass.
- **Phase 2.7 closure / v0.5.28** — Resolved all open MEDIUM and LOW issues from T611 and T612, and completed T270.DOCS. Code fixes: `QuestionScoringInfo` interface replaces ad-hoc casts; `mandatory: false` added to all three question default scoring configs; `goNext()` clarifying comment; `slideIsComplete()` JSDoc expanded; `finishCourse()` wraps navigation in try-catch; `restoreSuspendData()` warns when out-of-bounds visited indices are dropped; module-level `_noNavNextWarned` flag prevents repeated console.warn per session. Docs updated: `09-publishing.md` (Navigation Mode section), `scorm2004.md` (Sequencing per mode section), `05-questions.md` (Mandatory questions section). T613.6 marked deferred (Moodle E2E, opt-in via `E2E_MOODLE=1`). All 256 runtime-player + 628 authoring-ui tests pass.
- **T613 / v0.5.27** — SCORM 2004 conditional sequencing based on `navigationMode`. `buildManifest2004()` in `scorm-packager/src/index.ts` now branches on `course.settings?.navigationMode`: `'free'`/undefined → `choice="true" flow="true"` (unchanged); `'linear-strict'` → `choice="false" choiceExit="false" flow="true"` (LMS TOC navigation blocked). Single-SCO architecture: SCORM preConditionRule/objectiveProgressStatus sequencing rules are not applicable. 3 new unit tests; 27 scorm2004 tests pass. Reviewer: 0 issues. T613.6 (Moodle integration) deferred/opt-in. Commit: `5c9b8d8`.
- **TA608.6 fix / v0.5.26** — Fixed pre-existing GrapesJS Style Manager forEach crash for GENERATED_CONTENT_TYPES (progress-bar, audio-narration, volume-control). `model.defaults.properties` changed from `{}` to `[]` in `registerBlocks.ts`. GrapesJS's PropertyComposite calls `.forEach()` on `this.get('properties')`; `{}` is truthy so `|| []` doesn't activate, but `{}.forEach` is undefined → crash. Empty array `[]` fixes it. Also: T612.9 E2E uses `waitForReady()` (not `waitForReloadComplete()`) since no canvas exists without a slide; cleanup unchecks `requireAllSlides` BEFORE switching mode to 'free' since the checkbox is conditionally rendered only under `linear-strict`. T611.10 skipped (Preview button not yet implemented — shows "coming soon" toast). Commit: `cd82dbe`.
- **T612 / v0.5.25** — Phase 2.7 SCORM Navigation: `finishCourse()` now checks `requireAllSlides` and navigates to the first unvisited slide instead of completing (T612.6). Legacy `lesson_location` fallback seeds `visitedSlides` with `[0..restoredSlide]` (T612.7). T612.8: 2 unit tests for requireAllSlides gate. T612.9: E2E regression test for courseSettings persistence across reload. H-01 (optional chaining on `extendedProperties?.scoring`) and H-02 (`console.warn` for missing nav-next buttons) fixed. 256 unit tests + 128 E2E tests. Commit: `a65b01e`.
- **T610 + T611 / v0.5.24** — Phase 2.7 SCORM Navigation: T610 added `navigationMode`/`requireAllSlides` fields across all 4 packages and the Course Settings UI. T611 implemented mandatory question gating: `mandatory?: boolean` in `QuestionScoring`, mandatory checkbox in `QuestionPropertiesPanel`, `slideIsComplete()` + `updateNavButtons()` in runtime player, `data-nav-next` attribute on Next button. E2E regression test T611.10 added. Commit: `f85b27a`.
- **TA608 refinements / v0.5.22** — CRITICAL fix: `visitedSlides` was reset to empty `Set` on every player resume, causing progress bar to show 0% after returning to a course. Fixed by extending `suspend_data` schema from v:1 to v:2 to persist `visitedSlides` as a number array. `SuspendableState` interface extended with `visitedSlides: Set<number>`. `restoreSuspendData()` reconstructs the set with bounds checking; v:1 payloads seeded with `[currentSlide]` for backward compat. Also fixed: `updateProgressBars` percent scoping (now uses `.closest('.el-progress-bar')`); height input clamping in ProgressBarPropertiesPanel. Added TA608.6 persistence E2E test. All suspend unit tests updated + 2 new tests. `docs/issues/issues-TA608.md` generated by reviewer.
- **T601.8 fix / v0.5.21** — Fixed CI failure: `tests/question-widget.spec.ts:339:7 — T601.8 MC user-edited question text survives page reload`. Root cause: GrapesJS Backbone `component.set('extendedProperties', next)` (called by `useExtendedProperties` hook) places extendedProperties in the Backbone attributes hash; `c.getAttributes()` returns it; it was not excluded by `INTERNAL_GJS_ATTRS`; it leaked into `widget.properties`; on reload `grapesjsFromWidgets` placed it in the GrapesJS component def `attributes` sub-object; `loadData()` crashed with `TypeError: Cannot read properties of undefined (reading 'forEach')`. Fix: extended both `INTERNAL_GJS_ATTRS` and the `grapesjsFromWidgets` skip list to exclude `extendedProperties`, `elearnActions`, `actions`, `properties`.
- **T609 / v0.5.20** — Implemented MISSING-02: Global Volume Control widget. New `volume-control` GrapesJS block (Media category). `VolumeControlPropertiesPanel` with volume range/number input and showMute checkbox. Runtime player: module-level `_globalVolume`/`_globalMuted`, `applyVolumeToSlide()`, mute button SVG icon swap. 5 new E2E tests.
- **T608 / v0.5.19** — Implemented MISSING-03: Course Progress Bar widget. New `progress-bar` GrapesJS block (Navigation category). `ProgressBarPropertiesPanel` with color picker, height input, showPercent checkbox. Runtime player: `visitedSlides: Set<number>` in PlayerState, `updateProgressBars()` updates fill width and percent text on every slide nav. 5 new E2E tests.
- **T607 / v0.5.18** — Implemented MISSING-01: Audio narration widget. New `audio-narration` GrapesJS block + component with speaker-wave canvas preview. `AudioNarrationPropertiesPanel` with Audio Source URL (+ AM picker) and Playback Options (controls/autoplay checkboxes). Runtime player renders `<audio>` element. Fixed converter bug (WIDGETS_WITH_SRC_TRAIT whitelist) that caused `media-player` and `audio-narration` to lose `src` on reload. Fixed backend Widget.ts missing `audio-narration` from WIDGET_TYPES enum (caused 500 on PATCH). Added AM audio extension validation. 6 new E2E tests; 115 tests pass.
- **T606 / v0.5.17** — Fixed BETA-14: SCORM export loading feedback. `PublishDialog` now shows a status section (spinner → "Generating SCORM package…" → "Download ready" / error message inline). Error state shows in dialog with `role="alert"`. Cancel relabels to "Close" after export. 3 new E2E tests; 10 SCORM tests pass.
- **T605 / v0.5.16** — Fixed BETA-15: image widget placeholder via SVG data URI on `img.gjs-plh-image` (camera icon + "Click to choose image" text). Changed `click` → `dblclick` for Asset Manager open; tooltip `title="Double-click to open image selector"` set in `onRender()`. 4 new E2E tests; full 106-test suite passes.
- **T604 / v0.5.15** — Fixed BETA-10: new `MediaPlayerPropertiesPanel` with Media Source URL (+ AM picker), Media Type selector, and Playback Options (autoplay/controls/loop checkboxes). `useTrait` and `useExtendedBool` hooks with `isLocalRef` loop prevention. Props tab auto-opens on widget select. 6 new E2E tests; full 102-test suite passes.
- **T603 / v0.5.14** — Fixed BETA-04/05/11: new `ButtonPropertiesPanel` component for `button`, `done-button`, `nav-buttons`. Caption editable via `component.get/set('content')`; background image via Asset Manager + `component.setStyle()`. Nav buttons: separate prev/next caption fields writing to child components. Props tab auto-opens on widget select. 2 new E2E tests; all 15 grapesjs-integration tests pass.
- **T602 / v0.5.13** — Fixed BETA-01/02/03/08/09/13: all question property forms (MC, TF, Fill) now correctly persist text edits, correct-answer selections, and feedback fields. Root cause: forms read `extendedProperties` as a plain variable with no `useState` — React never re-rendered. Fix: `useExtendedProperties<T>` hook (useState + GrapesJS model subscription + isLocalRef loop prevention). All 23 question-widget E2E tests pass.
- **T601 / v0.5.12** — Fixed BETA-07 (AM thumbnail: generic icon → presigned URL) and BETA-12 (AM filename: UUID → original filename). `customFetch` in `assetManager.ts` now resolves presigned URL post-upload and passes `{ src, name: originalName, type: 'image' }` to GrapesJS. Added T601 E2E regression test; all 4 image-upload tests pass.
- **T600 / v0.5.11** — Fixed BETA-06: `done-button`, `question-tf`, `question-fill`, `media-player` now land at the correct position on drag (not at canvas origin 0,0). Added 4 E2E regression tests; all 13 grapesjs-integration tests pass.
- **Beta Review Round 1** — Full manual authoring test by project owner. 15 bugs found, 3 missing features identified. Full details: `docs/issues/issues-BETA-R1.md`
- **v0.5.10** — Defensive guards for missing `w.bounds` in `grapesjsFromWidgets`
- **v0.5.9** — E2E suite expanded 73 → 90 tests; Moodle SCORM integration tests
- **v0.5.8** — Four persistence race condition fixes (BUG-T800-01 through BUG-T800-04)
- **Audit consolidado** — 4 auditorías integradas en `docs/issues/audit-consolidado.md`;
  todos los issues ALTO y DEUDA TÉCNICA cerrados (v0.5.29).
  bugs sistémicos: C-01 ✅ v0.5.32, C-02 ✅ v0.5.33, C-03 ✅ v0.5.34. C-04 (question form React state — **already fixed** en T602), C-05/NAV-01 a NAV-04 (navegación — **already fixed** en T610-T613).
  D-01 shared-types refactor — **completed** en v0.5.31. **Audit consolidado 100% resuelto.**

Full history: `CHANGELOG.md`

---

## Known Issues Right Now

> Full details in `docs/issues/issues-BETA-R1.md`. Fix order: T600 → T601 → T602 → T603 → T604 → T605 → T606 → T607 → T608 → T609

### 🟡 E2E FLAKES (pre-existing, not caused by Phase 2.8)

| ID | Test | Symptom | Passes in isolation |
|---|---|---|---|
| FLAKE-01 | `action-sequence.spec.ts` GAP-02.3 | `[data-testid="action-item"]` not visible after reload in full suite | ✅ Yes — passes alone |
| FLAKE-02 | `question-widget.spec.ts` T601.6 | `slide-item.nth(97)` timeout in full suite — slide panel takes >30s to render at index 97 | ✅ Yes — passes alone |

Root cause FLAKE-01: parallel-suite cross-slide-index contamination — GrapesJS `loadData()` fails silently when another worker's PATCH races with the reload. The Navigate action is saved correctly; the failure is in the re-selection step under load. Not a product bug.

Root cause FLAKE-02: slide accumulation across the full E2E suite — `question-widget.spec.ts` adds one slide per test in `beforeEach`. By the time T601.6 runs (~test 98 in the suite), 97 slides exist and the slide list rendering exceeds the 30s `waitFor` timeout. Not a product bug.

| FLAKE-03 | `authoring-ui-layer.spec.ts` T608.6 | Slide delete count assertion non-deterministic in full suite (3 workers) | ✅ Yes — passes alone |

Root cause FLAKE-03: `global-setup.ts` creates a single shared seed course; all parallel workers navigate to the same course in `fixtures/auth.ts`. The T608.6 `beforeEach` reads slide count then asserts it decreased by 1, but concurrent workers mutate the shared course between read and assertion. Fix tracked in **T642** (per-test course isolation).

### ℹ️ INTENTIONAL ESLINT DISABLES (not bugs — do not flag)

| File | Line | Rule disabled | Reason |
|------|------|---------------|--------|
| `packages/authoring-ui/src/hooks/useComponentProperty.ts` | ~72 | `react-hooks/exhaustive-deps` | `defaultValue` omitted from `useComponentProperty` deps — stable for a panel's lifetime; including it causes redundant re-subscriptions. Justification comment present on the next line. |
| `packages/authoring-ui/src/hooks/useComponentProperty.ts` | ~136 | `react-hooks/exhaustive-deps` | `readValue`/`defaultValue` omitted from `useExtendedProperty` deps — same rationale. Justification comment present on the next line. |

CI reports these as lint annotations on every push. They are correct, intentional, and documented in the source. Do not raise them as issues. (T640 verified 2026-04-11)

### 🟡 SKIPPED TESTS (feature not yet implemented)

| ID | Test | Reason | Task |
|---|---|---|---|
| SKIP-01 | `question-widget.spec.ts` T611.10 | Preview button opens "coming soon" toast — runtime player popup not implemented | **T641** |

### 🔴 CRITICAL

| ID | Description | Task |
|---|---|---|
| ~~BETA-01~~ | ~~MC question: no way to mark correct answer~~ | ✅ Fixed in T602 |
| ~~BETA-02~~ | ~~All questions: question text + option text not editable~~ | ✅ Fixed in T602 |
| ~~BETA-03~~ | ~~All questions: feedback text not editable~~ | ✅ Fixed in T602 |

### 🟠 HIGH

| ID | Description | Task |
|---|---|---|
| ~~BETA-04~~ | ~~Button caption cannot be changed~~ | ✅ Fixed in T603 |
| ~~BETA-05~~ | ~~Button background image cannot be assigned~~ | ✅ Fixed in T603 |
| ~~BETA-06~~ | ~~Positioning bug on initial drag: done-button, question-tf, question-fill, media-player~~ | ✅ Fixed in T600 |
| ~~BETA-07~~ | ~~Asset Manager: generic icon instead of image thumbnail~~ | ✅ Fixed in T601 |
| ~~BETA-08~~ | ~~TF: correct answer selection broken~~ | ✅ Fixed in T602 |
| ~~BETA-09~~ | ~~Fill: accepted answer not editable~~ | ✅ Fixed in T602 |
| ~~BETA-10~~ | ~~Media Player: no properties panel, cannot assign media~~ | ✅ Fixed in T604 |
| ~~BETA-11~~ | ~~Nav buttons: individual captions not changeable~~ | ✅ Fixed in T603 |

### 🟡 MEDIUM

| ID | Description | Task |
|---|---|---|
| ~~BETA-12~~ | ~~Asset Manager: UUID shown instead of original filename~~ | ✅ Fixed in T601 |
| ~~BETA-13~~ | ~~MC props panel doesn't refresh when options added/removed~~ | ✅ Fixed in T602 |
| ~~BETA-14~~ | ~~No loading feedback during SCORM export~~ | ✅ Fixed in T606 |
| ~~BETA-15~~ | ~~Image widget: no placeholder hint~~ | ✅ Fixed in T605 |

### 🔵 MISSING FEATURES

| ID | Description | Task |
|---|---|---|
| ~~MISSING-01~~ | ~~Audio narration component~~ | ✅ Fixed in T607 |
| ~~MISSING-02~~ | ~~Global volume control~~ | ✅ Fixed in T609 |
| ~~MISSING-03~~ | ~~Course progress bar~~ | ✅ Fixed in T608 |

---

## Root Cause Summary for Phase 2.6

### BETA-06 (positioning on 4 widgets)
`done-button`, `question-tf`, `question-fill`, `media-player` block `content`
definitions are missing `style: { position: 'absolute', left, top, width, height }`.
Working widgets (rectangle, question-mc) have it. Fix in `registerBlocks.ts`.

### ~~BETA-01/02/03/08/09 (question props not persisting)~~ — ✅ Fixed in T602
Root cause was missing `useState` in all 3 forms. Forms read `extendedProperties` as a
plain variable — React never re-rendered, stale closure reverted every edit. Fixed with
`useExtendedProperties<T>` hook in `QuestionPropertiesPanel.tsx`.

### BETA-07/12 (Asset Manager preview)
`src` passed to GrapesJS AM after upload is raw Garage path, not presigned URL.
Original filename not stored — only UUID key returned from backend.

### BETA-04/05/11 (button caption + background)
Button components lack a `label` trait wired to content, and background image
assignment is not calling `component.setStyle()` correctly.

---

## What Was Attempted and Failed — DO NOT RETRY

| Approach | Why it failed | Alternative |
|---|---|---|
| `component:update` for immediate save | Infinite save loop in GrapesJS | 2s debounced autosave in `initEditor.ts` |
| `listenTo(model, 'change:style', onRender)` in score widgets (T638) | Fires in dev but not reliably in production minified build (Backbone event registration order / tree-shaking in Vite rollup) | Remove inline styles from `onRender()` and rely on CSS inheritance from `el` — GrapesJS applies `setStyle()` to `el` via CSS rule, children inherit automatically |
| TipTap inside GrapesJS canvas iframe | No React context inside iframe | Native GrapesJS `contenteditable` |
| `minio/minio` Docker image | Discontinued | `dxflrs/garage:v1.0.0` |
| `@opentelemetry/auto-instrumentations-node` full bundle | Unused instrumentations, slow startup | Selective packages only |
| JWT in localStorage | LMS iframe blocks it | Memory-only via Zustand |
| `pressSequentially` for Moodle login | Characters dropped under CPU load | `page.fill()` |
| GrapesJS Studio SDK | Paid product | Open-source `grapesjs` npm only |

FAILED (T630 — 5 fases de bug, no repetir ninguna):
- Fase 1: document.addEventListener('mousemove') en main window → (0,0) en slides 2+
  REASON: El iframe no propaga eventos al main document.
- Fase 2: getMouseRelativePos() con evento iframe → Y offset = +iframeRect.top
  REASON: La función añade frameOffset internamente; con evento iframe lo cuenta dos veces.
- Fase 3: getMouseRelativeCanvas() con evento iframe → X offset = +93.1875px constante
  REASON: Misma causa; frameOffset.left = 93.1875px = ancho del panel izquierdo.
- Fase 4: clientX - iframeRect.left → X offset = -93.1875px (espejo de Fase 3)
  REASON: clientX de iframeDoc ya es canvas-relativo; restar iframeRect.left es doble resta.
CORRECT (Fase 5): clientX/zoom, clientY/zoom. Sin ninguna operación de offset.
  Los eventos de iframeDoc llevan clientX/Y en coordenadas del canvas (iframe-relative).
  Solo dividir por getZoomDecimal() para normalizar zoom.
  Commits: a3417e2 (Phase 5), de16eff (UX ghost fix)


---

## Next Steps (Ordered)

### Phase 2.6 — COMPLETE ✅
1–10. All beta review fixes and missing features done (T600–T609).

### Phase 2.7 — SCORM Navigation Integration
- ~~**T610** — Add `navigationMode`/`requireAllSlides` to CourseSettings~~ ✅ Done
- ~~**T611** — Block Next button until required questions answered~~ ✅ Done
- ~~**T612** — Resume: track visitedSlides, gate `finishCourse()` on `requireAllSlides`~~ ✅ Done
- ~~**T613** — SCORM 2004 conditional sequencing XML based on `navigationMode`~~ ✅ Done

### Audit Consolidado — Bugs Sistémicos (next up)
- ~~**D-01** — `@elearn-studio/shared-types` as monorepo type authority~~ ✅ Done (v0.5.31)
- ~~**C-01** — Wire actions engine to runtime-player~~ ✅ Done (v0.5.32)
- ~~**C-02** — `sharedSequences` Mongoose model support~~ ✅ Done (v0.5.33)
- ~~**C-03** — SCORM export asset bundling~~ ✅ Done (v0.5.34)

### Phase 2.8 — Authoring UI Hardening — COMPLETO ✅
- ~~**T620** — Fix optimistic update in useComponentProperty~~ ✅ Done (64a2ed9 v0.5.35)
- ~~**T621** — Fix stale closure in useExtendedProperties~~ ✅ Done (64a2ed9 v0.5.35)
- ~~**T622** — Save error blocking banner (SaveErrorBanner)~~ ✅ Done (64a2ed9 v0.5.35)
- ~~**T623** — Replace prototype chain hack in image widget~~ ✅ Done (64a2ed9 v0.5.35)

### Audit consolidado — COMPLETO ✅
Todos los items críticos (C-01, C-02, C-03) y deuda técnica (D-01, D-02) cerrados.

### Phase 2.9 — SCORM & Publishing (ACTIVE)
- ~~**T632** — Fix asset picker type for media/audio widgets~~ ✅ Done (ece0142 v0.5.37) — T632.4 E2E added, T632.5 CI green
- ~~**T633** — Fix button background image scale and no-repeat~~ ✅ Done (d4a6055 v0.5.38)
- ~~**T634** — Fix nav-buttons "missing child buttons" error~~ ✅ Done (c7d123f v0.5.39)
- ~~**T635** — Add SCORM format selector to PublishDialog~~ ✅ Done (6b6a9da v0.5.40)
- ~~**T636** — Cross-slide copy/paste~~ ✅ Done (v0.5.42)
- ~~**T637** — Text widget editing: RTE cursor loss investigation + fixes~~ ✅ Done (v0.5.43)
- ~~**T638** — Fix typography changes not affecting Quiz Score and Score Field~~ ✅ Done (v0.5.43)
- ~~**T639** — Stale-closure fix: `getLatest()` in property panels~~ ✅ Done

### Phase 10 — React/GrapesJS Architectural Refactor (ACTIVE)
- ~~**T644** — Fix PhaserSimPropertiesPanel: align with panel pattern~~ ✅ Done (v0.5.48)
- ~~**T645** — Fix storageManager singletons: StorageContextProvider DI~~ ✅ Done (v0.5.49)
- ~~**T646** — Fix initEditor leaks: dragstart listener + autosaveTimer~~ ✅ Done (v0.5.50)
- **T647** — Fix EditorCanvas pre-navigation store(): add UI state update 🔄 NEXT UP
- **T648** — Fix Zustand/Backbone duality in all PropertiesPanel components
- **T649** — Fix stale closure in QuestionPropertiesPanel updateOption
- **T650** — beforeunload flash save: prevent data loss on tab close
- **T651** — Unify persistence via requestSave(): single save entry point

---

## Visual Verification Status

| Component | Status | Notes |
|---|---|---|
| Text widget | ✅ Working | No issues |
| Image widget | ✅ Working | AM thumbnail and filename fixed (T601); placeholder hint + dblclick AM (T605) |
| Button | ✅ Working | Caption + background image editable (T603) |
| Done button | ✅ Working | Positioning (T600) + caption + background image (T603) |
| Nav buttons | ✅ Working | Individual prev/next captions editable (T603); child components via defaults.components — no "missing child" error (T634) |
| Multiple Choice | ✅ Working | Text, options, correct answer, feedback all editable (T602) |
| True/False | ✅ Working | Positioning (T600) + correct answer selection (T602) fixed |
| Fill in Blank | ✅ Working | Positioning (T600) + accepted answer editable (T602) |
| Media Player | ✅ Working | Positioning (T600) + Media Source/Type/Playback props panel (T604) |
| Audio Narration | ✅ Working | Block + canvas preview + Props panel (T607); runtime `<audio>` rendering |
| Progress Bar | ✅ Working | Block + Props panel (T608); runtime `visitedSlides` progress tracking |
| Volume Control | ✅ Working | Block + Props panel (T609); runtime global volume/mute with `applyVolumeToSlide()` |
| SaveErrorBanner | ✅ Working | Persistent red banner on autosave failure (T622); Retry button clears on success; nav blocked when `saveError !== null` |
| useComponentProperty | ✅ Working | Optimistic `setValue` before `comp.set()`; no bounce-back on rapid typing (T620) |
| useExtendedProperties | ✅ Working | Reads `comp.get('extendedProperties')` directly; stale closure eliminated (T621) |
| Image widget initialize | ✅ Working | `extendFnView: ['initialize']` — prototype chain hack removed (T623) |
| Block drag-and-drop positioning | ✅ Working | Widget lands at cursor tip (canvas coords); 24×24px ghost indicator (T630 Phase 5 + UX) |
| Quiz Score widget | ✅ Working | Style Manager font-size/color apply immediately (CSS inheritance, T638); quizTitle trait editable |
| Score Field widget | ✅ Working | Style Manager font-size/color apply immediately (CSS inheritance, T638); scorePrefix trait editable |

---

## Architecture Reminders

- **GrapesJS canvas = iframe** — use `editorPage.canvasComponent()` / `canvasFrame()`, never `page.locator()` on canvas elements directly
- **GrapesJS iframe coordinates** — `clientX/Y` from `iframeDoc` events are ALREADY canvas-relative. Formula: `x = clientX / zoomDecimal`. Never subtract `iframeRect.left/top`. Never pass iframe events to `getMouseRelativePos()` or `getMouseRelativeCanvas()` — both add frameOffset internally (double-counts). See CLAUDE.md Regla 8.
- **Phaser = lazy load only** — never bundle into runtime player; dynamic `import()` only
- **Runtime player = Vanilla JS** — no React/Vue/Angular; runs inside LMS iframes
- **No localStorage in player** — SCORM `suspend_data` via `LMSSetValue` only
- **All assets → Garage** — never MongoDB for binary data
- **Storage Manager is CRITICAL** — never let GrapesJS save raw HTML
- **MinIO does not exist** — Garage only, everywhere
- **`forcePathStyle: true`** — required for all Garage S3 client calls

---

## File Locations Quick Reference

| What | Where |
|---|---|
| Task list | `tasks.md` |
| Beta review issues | `docs/issues/issues-BETA-R1.md` |
| Per-task issues | `docs/issues/issues-TXX.md` |
| Change history | `CHANGELOG.md` |
| E2E tests | `e2e/tests/*.spec.ts` |
| Block definitions | `packages/authoring-ui/src/editor/registerBlocks.ts` |
| Question props forms | `packages/authoring-ui/src/components/panels/` |
| GrapesJS init | `packages/authoring-ui/src/editor/initEditor.ts` |
| Storage converter | `packages/authoring-ui/src/editor/converters.ts` |
| E2E QA skill | `.claude/skills/elearn-e2e-qa/SKILL.md` |
| Audit consolidado (bugs sistémicos) | `docs/issues/audit-consolidado.md` |