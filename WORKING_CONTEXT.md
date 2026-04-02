# eLearn Studio — Working Context

> **This file is the first thing to read at the start of every Claude Code session.**
> It is updated by Claude Code after every completed task block.
> Last updated: 2026-04-02 — after T603

---

## Current State

| Field | Value |
|---|---|
| **Latest release** | v0.0.1-beta (2026-03-31) |
| **Current version** | v0.5.14 |
| **Active phase** | Phase 2.6 — Beta Review Fixes (Round 1) |
| **Active block** | T604 — Fix Media Player properties panel |
| **E2E test count** | 97 tests |

---

## What Was Last Done

- **T603 / v0.5.14** — Fixed BETA-04/05/11: new `ButtonPropertiesPanel` component for `button`, `done-button`, `nav-buttons`. Caption editable via `component.get/set('content')`; background image via Asset Manager + `component.setStyle()`. Nav buttons: separate prev/next caption fields writing to child components. Props tab auto-opens on widget select. 2 new E2E tests; all 15 grapesjs-integration tests pass.
- **T602 / v0.5.13** — Fixed BETA-01/02/03/08/09/13: all question property forms (MC, TF, Fill) now correctly persist text edits, correct-answer selections, and feedback fields. Root cause: forms read `extendedProperties` as a plain variable with no `useState` — React never re-rendered. Fix: `useExtendedProperties<T>` hook (useState + GrapesJS model subscription + isLocalRef loop prevention). All 23 question-widget E2E tests pass.
- **T601 / v0.5.12** — Fixed BETA-07 (AM thumbnail: generic icon → presigned URL) and BETA-12 (AM filename: UUID → original filename). `customFetch` in `assetManager.ts` now resolves presigned URL post-upload and passes `{ src, name: originalName, type: 'image' }` to GrapesJS. Added T601 E2E regression test; all 4 image-upload tests pass.
- **T600 / v0.5.11** — Fixed BETA-06: `done-button`, `question-tf`, `question-fill`, `media-player` now land at the correct position on drag (not at canvas origin 0,0). Added 4 E2E regression tests; all 13 grapesjs-integration tests pass.
- **Beta Review Round 1** — Full manual authoring test by project owner. 15 bugs found, 3 missing features identified. Full details: `docs/issues/issues-BETA-R1.md`
- **v0.5.10** — Defensive guards for missing `w.bounds` in `grapesjsFromWidgets`
- **v0.5.9** — E2E suite expanded 73 → 90 tests; Moodle SCORM integration tests
- **v0.5.8** — Four persistence race condition fixes (BUG-T800-01 through BUG-T800-04)

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
| BETA-10 | Media Player: no properties panel, cannot assign media | T604 |
| ~~BETA-11~~ | ~~Nav buttons: individual captions not changeable~~ | ✅ Fixed in T603 |

### 🟡 MEDIUM

| ID | Description | Task |
|---|---|---|
| ~~BETA-12~~ | ~~Asset Manager: UUID shown instead of original filename~~ | ✅ Fixed in T601 |
| ~~BETA-13~~ | ~~MC props panel doesn't refresh when options added/removed~~ | ✅ Fixed in T602 |
| BETA-14 | No loading feedback during SCORM export | T606 |
| BETA-15 | Image widget: no placeholder hint | T605 |

### 🔵 MISSING FEATURES

| ID | Description | Task |
|---|---|---|
| MISSING-01 | Audio narration component | T607 |
| MISSING-02 | Global volume control | T609 |
| MISSING-03 | Course progress bar | T608 |

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

1. ~~**T600** — Fix positioning bug (4 widgets)~~ ✅ Done
2. ~~**T601** — Fix Asset Manager preview + filename~~ ✅ Done
3. ~~**T602** — Fix question properties panel (all 3 types)~~ ✅ Done
4. ~~**T603** — Fix button caption + background image~~ ✅ Done
5. **T604** — Fix Media Player properties panel
6. **T605** — Image widget placeholder hint
7. **T606** — SCORM export loading feedback
8. **T607** — New: Audio narration widget
9. **T608** — New: Course progress bar
10. **T609** — New: Volume control widget

---

## Visual Verification Status

| Component | Status | Notes |
|---|---|---|
| Text widget | ✅ Working | No issues |
| Image widget | ✅ Working | AM thumbnail and filename fixed (T601) |
| Button | ✅ Working | Caption + background image editable (T603) |
| Done button | ✅ Working | Positioning (T600) + caption + background image (T603) |
| Nav buttons | ✅ Working | Individual prev/next captions editable (T603) |
| Multiple Choice | ✅ Working | Text, options, correct answer, feedback all editable (T602) |
| True/False | ✅ Working | Positioning (T600) + correct answer selection (T602) fixed |
| Fill in Blank | ✅ Working | Positioning (T600) + accepted answer editable (T602) |
| Media Player | ⚠️ Partial | Positioning fixed (T600); no props panel (BETA-10) |

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
| Task list | `docs/tasks.md` |
| Beta review issues | `docs/issues/issues-BETA-R1.md` |
| Per-task issues | `docs/issues/issues-TXX.md` |
| Change history | `CHANGELOG.md` |
| E2E tests | `e2e/tests/*.spec.ts` |
| Block definitions | `packages/authoring-ui/src/editor/registerBlocks.ts` |
| Question props forms | `packages/authoring-ui/src/components/panels/` |
| GrapesJS init | `packages/authoring-ui/src/editor/initEditor.ts` |
| Storage converter | `packages/authoring-ui/src/editor/converters.ts` |
| E2E QA skill | `.claude/skills/elearn-e2e-qa/SKILL.md` |
