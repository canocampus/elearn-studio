# eLearn Studio — Working Context

> **This file is the first thing to read at the start of every Claude Code session.**
> It is updated by Claude Code after every completed task block.
> Last updated: 2026-04-04 — Phase 2.8: Authoring UI Hardening (v0.5.35)

---

## Current State

| Field | Value |
|---|---|
| **Latest release** | v0.0.1-beta (2026-03-31) |
| **Current version** | v0.5.35 |
| **Active phase** | Phase 2.8 — Authoring UI Hardening (COMPLETO) |
| **Active block** | — (todos completados) |
| **E2E test count** | 131 tests (128 passing, 3 skipped incl. T611.10) |

---

## What Was Last Done

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
| TipTap inside GrapesJS canvas iframe | No React context inside iframe | Native GrapesJS `contenteditable` |
| `minio/minio` Docker image | Discontinued | `dxflrs/garage:v1.0.0` |
| `@opentelemetry/auto-instrumentations-node` full bundle | Unused instrumentations, slow startup | Selective packages only |
| JWT in localStorage | LMS iframe blocks it | Memory-only via Zustand |
| `pressSequentially` for Moodle login | Characters dropped under CPU load | `page.fill()` |
| GrapesJS Studio SDK | Paid product | Open-source `grapesjs` npm only |

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

---

## Visual Verification Status

| Component | Status | Notes |
|---|---|---|
| Text widget | ✅ Working | No issues |
| Image widget | ✅ Working | AM thumbnail and filename fixed (T601); placeholder hint + dblclick AM (T605) |
| Button | ✅ Working | Caption + background image editable (T603) |
| Done button | ✅ Working | Positioning (T600) + caption + background image (T603) |
| Nav buttons | ✅ Working | Individual prev/next captions editable (T603) |
| Multiple Choice | ✅ Working | Text, options, correct answer, feedback all editable (T602) |
| True/False | ✅ Working | Positioning (T600) + correct answer selection (T602) fixed |
| Fill in Blank | ✅ Working | Positioning (T600) + accepted answer editable (T602) |
| Media Player | ✅ Working | Positioning (T600) + Media Source/Type/Playback props panel (T604) |
| Audio Narration | ✅ Working | Block + canvas preview + Props panel (T607); runtime `<audio>` rendering |
| Progress Bar | ✅ Working | Block + Props panel (T608); runtime `visitedSlides` progress tracking |
| Volume Control | ✅ Working | Block + Props panel (T609); runtime global volume/mute with `applyVolumeToSlide()` |

---

## Architecture Reminders

- **GrapesJS canvas = iframe** — use `editorPage.canvasComponent()` / `canvasFrame()`, never `page.locator()` on canvas elements directly
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