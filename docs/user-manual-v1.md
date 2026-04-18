# eLearn Studio — User Manual (v1)

> **Version covered:** v0.5.61 (2026-04-18)
> **Audience:** Trainers, instructional designers, educators
> **Companion documents:** `docs/user-guide/` (per-topic pages)

---

## Table of contents

1. [Welcome and overview](#1-welcome-and-overview)
2. [Creating and editing a course (authoring)](#2-creating-and-editing-a-course-authoring)
3. [Interactive Scenarios (Phaser simulations)](#3-interactive-scenarios-phaser-simulations)
4. [Preview and publish](#4-preview-and-publish)
5. [QA and developer testing guide](#5-qa-and-developer-testing-guide)
6. [Known limits in this version](#6-known-limits-in-this-version)

---

## 1. Welcome and overview

eLearn Studio is an authoring tool for creating interactive e-learning courses. You build courses slide by slide, add content blocks and questions, optionally record software walkthroughs, and publish a SCORM package you can upload to your Learning Management System (LMS).

### What a course looks like

A course is a list of **slides**. Each slide has a fixed canvas of **1024 × 768**, and you place **content blocks** (text, images, buttons, questions, players, simulations) freely on it. You can also add **course logic** — what happens when a learner clicks a button, finishes a video, or answers a question.

### The four main areas of the screen

1. **Top toolbar** — Save status, Preview, Publish SCORM, Add slide.
2. **Left sidebar** — Two tabs: **Slides** (reorder and add slides) and **Blocks** (drag new content onto the canvas).
3. **Center canvas** — The slide you are editing.
4. **Right sidebar** — Five tabs: **Layers** (all blocks on the current slide), **Styles**, **Props** (settings of the selected block), **Actions** (course logic), **Anim**.

> 💡 **Tip:** Every change auto-saves about two seconds after you stop editing. The save indicator in the top toolbar tells you when it is synced.

---

## 2. Creating and editing a course (authoring)

### Create a new course

1. Sign in with your email and password.
2. In the top toolbar, open the course menu and choose **New Course**.
3. Give the course a title. An empty first slide appears.

### Add a slide

1. In the left sidebar, open the **Slides** tab.
2. Click **Add slide** in the top toolbar.
   The new slide is added at the end and becomes the active slide.
3. Double-click the slide name in the list to rename it.

> 💡 **Tip:** Drag slides up or down in the Slides list to reorder them. Auto-save captures the new order.

### Add content to a slide

1. Open the **Blocks** tab in the left sidebar.
2. Drag a block (for example, **Text**) onto the canvas. Release the mouse where you want it.
3. Click the block once to select it. The right sidebar shows its **Props**.
4. Edit the Props (label, source, etc.). Changes appear on the canvas immediately.
5. Drag the corners of the block to resize it, or drag it to reposition.

Available block categories:

| Category | Blocks |
|---|---|
| **Basic** | Text, Image, Button, Rectangle |
| **Navigation** | Nav Buttons (Prev / Next), Done Button, Progress Bar |
| **Media** | Media Player (video or audio), Audio Narration, Volume Control |
| **Assessment** | Quiz Score, Score Field |
| **Questions** | Multiple Choice, True / False, Fill in the Blank |
| **Simulations** | Software Walkthrough (Screenshot Sim), Interactive Scenario (Phaser Sim) |

### Edit a Text block

1. Drag a **Text** block onto the canvas.
2. Double-click the block to enter edit mode. Type your text.
3. Click outside the block to confirm. The text is saved automatically.

### Add an Image

1. Drag an **Image** block onto the canvas.
2. Double-click the image. The **Asset Library** opens.
3. Choose an existing image or upload a new one. Click to confirm.
4. In the Props tab, set **Alt text** for accessibility.

### Add a Button with course logic

1. Drag a **Button** onto the canvas.
2. In the Props tab, set the **Label**.
3. Open the **Actions** tab. Click **Add action**.
4. Choose a trigger (for example, **On click**) and an action (for example, **Go to slide** or **Show element**).
5. Configure the action target. Save — the logic is stored with the block.

### Add a question

1. Drag **Multiple Choice**, **True / False**, or **Fill in the Blank** onto the slide.
2. Select the question. Open the **Props** tab.
3. Fill in:
   - **Question text**
   - **Options / Answers** (Add, Remove, mark one or more as correct)
   - **Weight** (how many points this question is worth)
   - **Attempts** (how many tries a learner gets; −1 means unlimited)
   - **Feedback** for correct and incorrect answers
4. The canvas preview updates as you type.

> ⚠️ **Important:** Add a **Done Button** to any slide that contains questions. Scoring is reported to the LMS only when the learner presses Done.

### Undo, Redo, and manual Save

- **Ctrl+Z** / **Ctrl+Y** — Undo and Redo work for every content change.
- The editor auto-saves after two seconds of inactivity. The Save indicator in the top toolbar shows sync status.
- Changes are kept safe even if you refresh the page — the last saved version is loaded on next open.

---

## 3. Interactive Scenarios (Phaser simulations)

Interactive Scenarios are animated, game-like activities you add to a slide. They are powered by the Phaser game engine under the hood, but you author them visually from the right-sidebar Properties panel.

### Five scenario types

| Type | Use it for |
|---|---|
| **Process Flow** | Teach a step-by-step procedure with clickable nodes (ticket triage, safety checklist) |
| **Interactive Diagram** | Label or explore a diagram with hotspots (anatomy, machine parts) |
| **Gamified Quiz** | Time-pressured multiple choice with lives and combos |
| **Physics Demo** | Physics-based visual demonstrations |
| **Concept Animator** | Animate a concept sequence |

### Create → Edit → Save → Preview → Use

1. **Create.** Open the **Blocks** tab. Drag **Phaser Sim** (category **Simulations**) onto the slide.
2. **Edit.** Select the block. In the **Props** tab, choose:
   - **Sim Type** (Process Flow, Interactive Diagram, etc.)
   - **Mode** — Demo (auto-plays), Practice (retry on error), Assessment (scored)
   - **Passing Score** — 0 to 100
   - **Canvas** — Width and height
3. **Build the scene.** Below the basic settings, a structured editor appears for the sim type you picked:
   - **Process Flow** — add Nodes (id, label, position, type), Edges (from → to), and Steps (instruction per node).
   - **Interactive Diagram** — set a background image and place Hotspots (x, y, radius, label, description).
   - **Gamified Quiz** — set Timer, Lives, Combo multiplier, and Questions.
   - A raw **Scene Definition** JSON editor is also available for advanced use.
4. **Save.** Changes are auto-saved with the rest of the slide.
5. **Preview.** Double-click the scenario on the canvas, or click the **Preview** button in the Props panel. A full-screen modal opens with the config summary.
   > ℹ️ **Note:** Inside the authoring app, the preview modal shows the sim type, mode, and scene definition. The **live playable scenario** appears when you publish and test the course in an LMS or the Preview window. See the note in [Known limits](#6-known-limits-in-this-version).
6. **Use.** Publish the course as SCORM (see [section 4](#4-preview-and-publish)). Learners get the fully playable scenario in their LMS.

> 💡 **Tip:** Start with **Demo** mode while you are designing. It auto-completes so you can test your course flow without solving the scenario yourself.

---

## 4. Preview and publish

### Preview a course before publishing

1. In the top toolbar, click **Preview**.
2. A new browser window opens and plays the course from the current slide, using the live content you are editing.
3. Click through the course as a learner would. Close the window when done.

> ℹ️ **Note:** Previews open in a popup. If your browser blocks popups, allow them for this site.

### Publish as SCORM

1. In the top toolbar, click **Publish SCORM**.
2. Choose a format:
   - **SCORM 1.2** — Works with almost every LMS. Choose this if you are not sure.
   - **SCORM 2004** — Choose this if your LMS administrator recommends it.
   - **AICC** — Choose this only if your LMS specifically requires AICC.
3. Click **Publish**. A status box reports progress.
4. When publishing finishes, a ZIP file is downloaded. The filename includes your course title and the date.
5. Upload the ZIP file to your LMS following your LMS's SCORM import steps.

> ⚠️ **Important:** Every course should have a **Done Button** on its final scored slide. The LMS records completion and final score only after the learner presses Done.

---

## 5. QA and developer testing guide

This section is intended for developers and QA engineers who want to run or extend the automated test suite. It uses technical terminology.

### Test layout

| Layer | Location | Runner |
|---|---|---|
| Unit tests (authoring UI) | `packages/authoring-ui/src/__tests__/` | `pnpm -C packages/authoring-ui test` (vitest) |
| Unit tests (runtime player) | `packages/runtime-player/src/__tests__/` | `pnpm -C packages/runtime-player test` |
| Backend integration | `backend/api/src/__tests__/` | `pnpm -C backend/api test` |
| **End-to-end (Playwright)** | `e2e/tests/*.spec.ts` | `pnpm -C e2e test` |

E2E specs at v0.5.61:

```
e2e/tests/
  action-sequence.spec.ts        course-crud.spec.ts
  audio-narration-widget.spec.ts grapesjs-integration.spec.ts
  auth.spec.ts                   image-upload.spec.ts
  authoring-ui-layer.spec.ts     image-widget-placeholder.spec.ts
  button-widget.spec.ts          media-player-widget.spec.ts
  copy-paste-widget.spec.ts      moodle-scorm.spec.ts
                                 nav-buttons-widget.spec.ts
                                 persistence.spec.ts
                                 preview-handshake.spec.ts
                                 progress-bar-widget.spec.ts
                                 question-widget.spec.ts
                                 runtime-player-actions.spec.ts
                                 score-widgets.spec.ts
                                 scorm-export.spec.ts
                                 text-widget-rte.spec.ts
                                 volume-control-widget.spec.ts
```

### One-time setup

1. Start backend API on port 3001 and authoring UI on port 3000:
   ```
   pnpm -r --parallel run dev
   ```
2. In a separate terminal, run the E2E suite:
   ```
   pnpm -C e2e test
   ```
3. Environment variables:
   - `E2E_BASE_URL` — default `http://localhost:3000`
   - `E2E_API_URL` — default `http://localhost:3001`
   - `E2E_TEST_USER_EMAIL` / `E2E_TEST_USER_PASSWORD` — override the seeded test user

### What `globalSetup` does

Defined in `e2e/global-setup.ts`:

1. Registers a test user via `POST /auth/register` (idempotent; 409 is accepted).
2. Logs in and obtains a refresh cookie.
3. Injects the cookie into a Chromium context so every test starts authenticated.
4. Saves the cookie snapshot to `e2e/.auth/state.json` via Playwright `storageState`.

### Test isolation (T642.1 / T642.2)

Every test receives its own course, created by the `editorPage` fixture in `e2e/fixtures/auth.ts`:

- Before the test: `POST /courses` → navigate `?courseId=<id>` → wait for `[data-editor-ready="true"]`.
- After the test: `DELETE /courses/<id>` (teardown tolerates 404).

This replaced the pre-T642 shared seed course that caused FLAKE-03 under parallel workers.

### Command reference

| Task | Command |
|---|---|
| Run all E2E specs | `pnpm -C e2e test` |
| Run one spec | `pnpm -C e2e test button-widget` |
| Headed (debug visually) | `pnpm -C e2e test:headed` |
| Playwright UI | `pnpm -C e2e test:ui` |
| Open last HTML report | `pnpm -C e2e report` |

### Captured artifacts (on failure)

Configured in `e2e/playwright.config.ts`:

- `test-results/e2e/` — per-test output directory with **screenshot** (on failure) and **video** (on first retry).
- `test-results/e2e-report/` — HTML report (do not open automatically; use `pnpm -C e2e report`).
- `trace: 'on-first-retry'` — full Playwright trace available via `npx playwright show-trace <path>`.
- CI retries: `2` (single worker on CI for stability).

### Full pre-push checklist

```
pnpm -r lint
pnpm -r run build
pnpm -r test
pnpm -C e2e test
```

---

## 6. Known limits in this version

These are the behaviours you should be aware of when using v0.5.61. Each item lists its impact and — for small issues — a developer fix size estimate.

### Interactive Scenarios (Phaser) — runtime preview in the authoring app is a placeholder

- **What you see today:** When you open the Phaser preview modal inside the authoring app (double-click on a Phaser Sim block), the modal shows the sim type label, the config summary, and the scene definition as JSON. It does **not** play the scenario.
- **What learners see:** When you publish the course to SCORM and open it in an LMS, the scenario plays as a full Phaser canvas — with one caveat (next item).
- **Why:** The Phaser runtime bundle is loaded only inside the published player bundle; the authoring app intentionally does not load it to keep the editor fast.
- **Workaround:** Use the **Preview** button in the top toolbar to open the full course in a popup window. That popup uses the runtime player and plays the scenario for real.

### Interactive Scenarios — all sim types use a placeholder scene at runtime

- **What you see today:** Even in the published SCORM player, the runtime shows a placeholder scene (sim type label on a dark canvas) regardless of the Scene Definition you authored. In **Demo** mode the scene auto-completes after two seconds with a score of 100.
- **Why:** The per-type scene builders (ProcessFlowScene, InteractiveDiagramScene, GamifiedQuizScene) are planned for a later release (tracked internally as T036). The authoring UI for Nodes / Edges / Hotspots / Quiz Questions is fully functional and the JSON is persisted correctly — it is only the runtime rendering that is pending.
- **What to do:** You can still author complete scene definitions today. They are saved with the course and will light up automatically when the runtime scene builders ship.

### Demo mode auto-completes; Practice and Assessment do not emit a score from the placeholder

- **What you see today:** In the placeholder runtime, only **Demo** mode fires a completion event. **Practice** and **Assessment** modes display the placeholder label but never report a score.
- **Priority:** Low — resolved automatically when the real scene builders ship.

### Phaser preview modal does not track window resizes

- **What you see today:** If you open the Phaser preview modal and then resize the browser window, the modal does not re-layout. Close and reopen it to fix the layout.
- **Priority:** Low (cosmetic). Estimated fix: under 20 lines of code.

### Data shape inconsistency between some Media blocks

- **What you see today:** Nothing visible. Internally, the **Audio Narration**, **Progress Bar**, and **Volume Control** blocks declare their properties as an empty array while every other block uses an empty object. This is latent only.
- **Priority:** Low. Estimated fix: under 10 lines of code in `packages/authoring-ui/src/editor/registerBlocks.ts`.

### Preview popup requires popups to be allowed

- **What you see today:** The **Preview** button opens a new browser window. If your browser blocks popups for this site, nothing appears to happen.
- **What to do:** Allow popups for the site and click **Preview** again.

### Auto-save is fast but not instant

- **What you see today:** Auto-save runs about two seconds after your last edit. If you close the browser tab within that window, the very last change may not be persisted.
- **What to do:** Wait until the Save indicator in the top toolbar shows synced before closing the tab.

---

**End of user manual v1.**
