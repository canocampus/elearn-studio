# User Manual v2 — Scope & Research Notes

> **Status:** Draft scope — v1 (`docs/user-manual-v1.md`) was too shallow.
> **Version target:** v0.5.62 (TD-008 closed; Actions Editor now shows widget names — docs reflect correct UX, no workarounds).
> **Written:** 2026-04-18 · **Updated:** 2026-04-18 (post TD-008)

---

## 1. What v1 missed (deficiencies)

- No per-block walkthroughs (just a "drag and edit" one-liner per block).
- No full list of Props fields, defaults, ranges for any block.
- Actions Editor mentioned in one paragraph — no trigger list, no action list, no recipes, no DSL reference.
- No end-to-end worked example.
- No troubleshooting section.
- No glossary.
- No screenshots anywhere.
- Phaser section described UI but did not provide real JSON scene examples.
- Single monolithic file — hard to navigate, impossible to link to specific topics.
- Reader cannot actually build anything after reading v1.

---

## 2. Structural decision — replace `docs/user-guide/` with a richer, multi-file manual

The existing `docs/user-guide/` already uses per-topic files. **Keep that layout idea, but replace every file** with a much deeper version. The current files can be deleted in the same PR that lands the first v2 chapter (no cross-linking from the rest of the repo depends on their exact filenames).

### Target layout

```
docs/user-guide/
  index.md                              — landing page + ToC + quick-start card
  01-welcome.md                         — terminology, screen tour, save model
  02-getting-started.md                 — sign-in, create first course, 5-minute path
  03-slides.md                          — add/rename/reorder, delete, duplicate
  04-blocks-basic.md                    — Text, Image, Button, Rectangle
  05-blocks-navigation.md               — Nav Buttons, Done Button, Progress Bar
  06-blocks-media.md                    — Media Player, Audio Narration, Volume Control
  07-blocks-assessment.md               — Quiz Score, Score Field
  08-blocks-questions.md                — Multiple Choice, True/False, Fill in the Blank
  09-actions-editor.md                  — Overview, "When X → do Y" model, naming widgets
  10-actions-triggers-reference.md      — Every trigger + every action (reference tables)
  11-actions-expressions-recipes.md     — DSL, 5 non-programmer recipes, shared sequences (macros)
  12-simulations-overview.md            — Software Walkthrough vs Interactive Scenario
  13-software-walkthrough.md            — Screenshot Sim editor, recording, modes
  14-interactive-scenario.md            — All 5 Phaser sim types + complete JSON examples
  15-preview.md                         — Preview popup
  16-publish-scorm.md                   — SCORM 1.2 / 2004 / AICC decision guide + LMS upload
  17-worked-example.md                  — 5-slide end-to-end course built step by step
  18-troubleshooting.md                 — 10 symptoms → cause → fix
  19-qa-developer-guide.md              — Technical section (QA + dev): E2E suite, commands
  20-glossary.md                        — ~30 terms, cross-referenced
  assets/
    screenshots/                        — PNG/WebP screenshots referenced from chapters
```

### Migration plan

1. Write the new files (all 20 + index) into `docs/user-guide/` alongside the old ones.
2. Once the new set is drafted and cross-links verified, **delete** the old files in a single cleanup commit:
   - `01-getting-started.md`, `02-editor-overview.md`, `03-working-with-slides.md`, `04-widgets.md`, `05-questions.md`, `06-actions-editor.md`, `07-screenshot-simulations.md`, `08-phaser-simulations.md`, `09-publishing.md`, `10-course-history.md`.
   - Replace the old `index.md` with the new one.
3. Search the repo for any link into the old filenames (`grep -r "user-guide/04-widgets"` etc.) and update references before the cleanup commit.

---

## 3. Mandatory illustration policy

**Every Props table MUST be accompanied by a screenshot of that widget's Props panel.**

### Rules

- **Location:** All images in `docs/user-guide/assets/screenshots/`.
- **Filename convention:** `NN-<block-name>-props.png` (e.g. `08-question-mc-props.png`). Additional screenshots for the canvas preview, dialogs, etc. use `NN-<block-name>-<aspect>.png` (e.g. `14-process-flow-builder.png`).
- **Alt text:** every image needs descriptive alt text for accessibility (`![Multiple Choice Props panel showing question text, options, scoring](assets/screenshots/08-question-mc-props.png)`).
- **Caption:** italic one-line caption immediately below each image: *The Multiple Choice Props panel. Enter the question, add options, and mark the correct one.*
- **Annotations:** for screenshots that show multiple UI elements the reader needs to distinguish, annotate with numbered callouts; explain the numbers in the caption: *(1) Question text; (2) Options list with radio = correct; (3) Scoring section.*
- **Resolution:** real screenshots at 1× (no retina upscaling); keep under 300 KB each (use WebP if PNG exceeds).
- **Consistency:** all Props screenshots taken with the same sample content and the same theme (the built-in dark theme). Where possible, the widget on the canvas should also be visible in the shot.

### Where screenshots are mandatory

- Every chapter that documents a block (§4-§8): one Props screenshot + one canvas screenshot per block (per variant if the Props panel changes shape — MC vs TF vs Fill each gets its own).
- Actions Editor chapters (§9-§11): screenshot of the Actions tab with at least one sequence, the trigger selector, and an action row with its params.
- Simulations chapters (§13, §14): screenshot of the structured builder (nodes/edges/hotspots/quiz), plus the preview modal.
- Publishing (§16): screenshot of the Publish dialog with format radios.
- Worked example (§17): screenshots of each slide of the completed sample course.

### Where screenshots are optional but encouraged

- §1 Welcome — annotated full-screen shot with numbered callouts for the four main areas.
- §2 Getting Started — a single progress shot after the first slide is added.
- §18 Troubleshooting — screenshots of error banners / failure states alongside the matching symptom.

### Capture workflow (for whoever takes the screenshots)

1. Seed a course with one instance of each widget placed on its own slide, with realistic content.
2. For each block, select it, make sure the Props tab is open, take the shot of the **right sidebar only** (crop to the panel).
3. For canvas screenshots, take the **center canvas + right sidebar** so readers see the widget and its props together.
4. Save to `docs/user-guide/assets/screenshots/` with the agreed filename.
5. If a screenshot needs numbered callouts, add them in any image editor (or use a consistent SVG overlay pattern — TBD). Keep the raw file alongside the annotated one for future re-renders.

> **Temporary policy while screenshots are being produced:** chapters may be drafted with a placeholder `<!-- screenshot: NN-xxx-props.png — pending capture -->` line where the image will go. The chapter is NOT considered done until every placeholder is replaced by a real image with alt + caption.

---

## 4. Per-chapter scope (deepened)

### index.md — landing
- 1-paragraph welcome.
- ToC with a one-line hook per chapter.
- Quick-start card: four bullet points covering "create course, add slide, add content, publish".

### 01-welcome.md
- What a course is (slides + content blocks + logic).
- Screen tour with one annotated full-screen screenshot (numbered callouts for the 4 areas + 5 right-sidebar tabs).
- Save model (auto-save 2 s debounce, sync indicator).
- Terminology: course / slide / block / element / props / action / trigger. (All forbidden words from the `elearn-docs-user` skill avoided.)

### 02-getting-started.md
- Sign-in (screenshot of login page).
- Create a new course.
- First slide appears — what happens automatically.
- 5-minute path: add a text block + an image + a button + publish preview.

### 03-slides.md
- Add, rename (double-click), reorder (drag), duplicate, delete.
- Screenshot of the Slides tab.
- Tip callout: what auto-save does with each action.

### 04-blocks-basic.md — Text, Image, Button, Rectangle
For **each** of the 4 blocks:
- Purpose (1-2 sentences).
- Props table (every field from `registerBlocks.ts` + default + range).
- **Props screenshot (mandatory).**
- Step-by-step flow (3-8 numbered steps).
- Mini-example: "Add a heading text block reading 'Welcome'".
- Tips / gotchas callout (double-click to edit, RTE cursor behaviour, etc.).

### 05-blocks-navigation.md — Nav Buttons, Done Button, Progress Bar
- As above. Special care: the Done Button's role in SCORM completion must be explained in plain language. Progress Bar's Props include color, height, showPercent — all screenshotted.

### 06-blocks-media.md — Media Player, Audio Narration, Volume Control
- As above. Note the 3 blocks' Media URL + Asset Library flow + mediaType routing.

### 07-blocks-assessment.md — Quiz Score, Score Field
- As above. Explain what these show at runtime (placeholders vs live values).

### 08-blocks-questions.md — Multiple Choice, True/False, Fill in the Blank
- For **each** of the 3 variants:
  - Props table (question text, options/answer, scoring.weight, scoring.attempts, scoring.mandatory, feedback).
  - **Props screenshot (mandatory, one per variant).**
  - **Canvas preview screenshot (mandatory, one per variant).**
  - Mini-example with numbers: "Weight 50, 2 attempts, feedback on correct and wrong".
- Explain mandatory questions and navigation gating.

### 09-actions-editor.md — overview
- What the Actions Editor is: "When X happens → do Y".
- How to name a widget (Props → Name) — **now shows correctly in the target dropdown** (TD-008 closed).
- Screenshot of the Actions tab with one sequence configured.
- Pointer to §10 (reference) and §11 (recipes).

### 10-actions-triggers-reference.md — exhaustive reference
- **Triggers of widget** (from `WIDGET_EVENTS`): `click`, `doubleClick`, `mouseEnter`, `mouseLeave`, `questionAnswered`, `questionCorrect`, `questionIncorrect`, `mediaEnded`, `simComplete`, others discovered at write time.
- **Triggers of slide**: `enterSlide`, `exitSlide`.
- **Actions table — 15 items** from `ACTION_PALETTE`:
  | Action | Category | Params | 1-line description |
  |---|---|---|---|
  | Navigate | Navigation | target, slideName?, slideNumber? | Go to another slide |
  | Show / Hide / Bring to Front | Object | widgetId | Change a block's visibility / stacking |
  | Display Message | Object | message, title? | Open a modal with text |
  | Play Media / Stop Media | Media | widgetId | Control an audio/video block |
  | Score Question / Score Quiz / Send to LMS / Suspend Lesson | Scoring | (varies) | Scoring + LMS reporting |
  | Set Variable | Variables | name, value, valueType (literal/expression) | Create or update a course variable |
  | Play Animation | Object | widgetId, animationName? | Play a path animation |
  | If / Else | Flow | expression | Branch on a condition |
  | Loop | Flow | mode (count/while), count?, condition? | Repeat N times or while condition |
  | Call Sequence | Macros | sequenceName | Run a shared sequence |
- Each row expanded below the table with a small example + screenshot of the param row in the editor.

### 11-actions-expressions-recipes.md — DSL + recipes + shared sequences
- **DSL grammar** (from the regex at `ActionItemEditor.tsx:13`):
  ```
  (!?)  (operand)  (op)?  (operand)?
  ```
  Operands: `$variable`, `"literal"`, `'literal'`, number, `true`, `false`. Operators: `==`, `!=`, `>=`, `<=`, `>`, `<`. Negation: `!`. Examples of valid/invalid expressions.
- **5 ready-to-use recipes** (copy-paste patterns):
  1. Attempt counter — increment `$attempts` on wrong answer; lock retry at `$attempts >= 3`.
  2. Decision tree by score — `Score Quiz` → `If $score > 80` → congrats slide; else review slide.
  3. Progressive hint reveal — 3 hints hidden at enterSlide; click "Hint" increments `$hintCount` and shows hint[n].
  4. Gated navigation — Next button hidden until all questions answered (track `$answered`).
  5. Branching lesson — slide 3 navigates to 4 or 7 depending on earlier answer.
- Each recipe gets a screenshot of the configured sequence.
- **Shared sequences (macros)** — how to define in `SharedSequenceLibrary` and call via `Call Sequence` action. Screenshot of the library panel.

### 12-simulations-overview.md
- Comparison of Software Walkthrough (Screenshot Sim) vs Interactive Scenario (Phaser).
- Decision table: "Use Software Walkthrough if ... use Interactive Scenario if ...".
- Screenshot of both block icons in the Block Manager.

### 13-software-walkthrough.md
- Full Simulation Editor walkthrough.
- Recording a sequence.
- Mode selector (Demo / Practice / Assessment), Passing Score.
- Step list, hotspot canvas.
- Screenshots: editor overlay, step form, canvas with hotspot.

### 14-interactive-scenario.md
- Per-sim-type sections (one per simType):
  - **Process Flow** — Nodes/Edges/Steps builder walkthrough + **complete JSON example** (3 nodes, 2 edges, 2 steps) + screenshot of the builder and the preview modal.
  - **Interactive Diagram** — background image + hotspots + JSON example (4 hotspots, one correct) + builder screenshot.
  - **Gamified Quiz** — timer, lives, combo, question list + JSON example (3 questions, 60 s, 3 lives, combo 1.5) + builder screenshot.
  - **Physics Demo** + **Concept Animator** — UI-only for now (placeholder runtime, see "Known limits" note).
- **Known limit callout**: the runtime in v0.5.62 uses a placeholder scene for every sim type; scenarios auto-complete 2 s after mount regardless of user interaction (score 100 for demo/practice, `passingScore` for assessment). Real per-simType scene rendering is planned (T036).

### 15-preview.md
- Preview button in the top toolbar.
- Popup behaviour (allow popups for the site).
- What is rendered: the full course played from the current slide, using live (unsaved) content.

### 16-publish-scorm.md
- Publish dialog walkthrough (screenshot).
- **Format decision guide (3 questions)**:
  - Does your LMS administrator recommend 2004 or AICC? → follow their recommendation.
  - Are you publishing to a general-purpose LMS? → SCORM 1.2.
  - Is this for a specific regulated environment that requires AICC? → AICC.
- Upload to LMS — step-by-step using a representative LMS (screenshots placeholder).
- Done Button importance recap.

### 17-worked-example.md — 5-slide course, step by step
Each slide gets:
- What it teaches.
- Which blocks to place.
- Which actions to configure.
- Screenshot of the finished slide.

Slides:
1. **Intro** — title Text + Start Button with `Navigate: next`.
2. **Theory** — Image + Text + Nav Buttons + Progress Bar.
3. **Question** — Multiple Choice (weight 50, 2 attempts, feedback).
4. **Branching** — `If/Else` on enterSlide: `$score > 60` → slide 5; else encouragement message + hide Next.
5. **Final** — Quiz Score + Done Button + `Send to LMS` on click.

### 18-troubleshooting.md — 10 symptoms
- Save indicator stuck on "Saving…".
- Image block shows a broken icon (asset URL expired / not uploaded).
- Preview popup doesn't open (popup blocker).
- LMS does not record my score (no Done Button / Send to LMS missing).
- Phaser scenario shows only a label in the LMS (runtime placeholder until T036 — known limit, not a bug).
- Undo/Redo doesn't revert a property change.
- Dragging block onto canvas does nothing (z-index / pointer-events).
- Published ZIP is huge (unused Phaser bundle / large images).
- Course won't load for a specific slide (corrupt component tree, recover via Layers).
- Dropdown in Actions Editor shows IDs I don't recognise (set a Name in Props → Name — now reflected live after TD-008).

Each entry: symptom → cause → numbered fix steps → optional screenshot.

### 19-qa-developer-guide.md — technical
- E2E layout (`e2e/tests/*.spec.ts`), runner commands (`pnpm -C e2e test [name]`).
- Environment variables, `globalSetup`, `editorPage` fixture isolation.
- Captured artefacts (screenshots, videos, traces).
- Pre-push checklist (lint / build / test / e2e).
- How to add a new spec.

### 20-glossary.md — ~30 terms
Course · Slide · Content block · Element · Props · Action · Trigger · Shared sequence · Macro · SCORM package · LMS · Simulation · Software Walkthrough · Interactive Scenario · Scene definition · Node · Edge · Hotspot · Asset library · Layer · Variable · Expression · Done Button · Passing score · Attempts · Weight · Feedback · Auto-save · Preview · Publish · Undo/Redo history.

---

## 5. Research notes (so we don't re-audit)

### Actions Editor — how widget resolution works (post TD-008)

- Runtime: `ctx.getWidget(widgetId)` returns `{ id, type, el, extendedProperties }` from a widgetId → WidgetRef map set up by the player when mounting a slide.
- The `el` is found via `[data-widget-id="<id>"]` selector in the DOM (used in `executeBringToFront` — `visibility.ts:34`).
- `widgetId` = GrapesJS component `id` (auto-generated). Persisted as `widget.id` in `course.slides[i].widgets[j]`.
- **Since v0.5.62 (TD-008):** the `name` trait (Props → Name) is propagated to top-level `widget.name`, and `ActionItemEditor.tsx` renders `<option value={w.id}>{w.name || w.id}</option>` — dropdown shows human-readable names while `value` stays the ID for runtime routing.

### Event model

- `dispatcher.ts:130-138` — DOM-mapped widget events: `click, doubleClick, mouseEnter, mouseLeave`.
- `fireWidgetEvent(widgetId, eventName, sequences)` — widget-fired custom events (`questionAnswered, simComplete, mediaEnded`).
- `fireSlideEvent('enterSlide'|'exitSlide', allWidgetSequences)` — slide lifecycle.
- TD-003 guards: every `sequences ?? []` is defensive against legacy Mongo docs missing `actions` on widget.

### Expression grammar

```js
// ActionItemEditor.tsx:13 — must stay in sync with expression.ts
const CONDITION_EXPR_RE = /^\s*(!?)\s*(\$[a-zA-Z_]\w*|"[^"]*"|'[^']*'|[\d.]+|true|false)\s*(==|!=|>=|<=|>|<)?\s*(\$[a-zA-Z_]\w*|"[^"]*"|'[^']*'|[\d.]+|true|false)?\s*$/
```

### Shared Sequences (macros)

- Course-level named sequences stored in `course.sharedSequences[]`.
- Callable from anywhere via `Call Sequence` action → `sequenceName`.
- Authored in a dedicated library panel (`SharedSequenceLibrary.tsx`).

### Phaser — what's real vs placeholder

- **Authoring UI**: complete — 5 sim types, 3 structured builders (ProcessFlow, Diagram, GamifiedQuiz) + raw JSON editor.
- `extendedProperties.sceneDef` is persisted correctly end-to-end.
- **Runtime**: `buildSceneConfig()` always delegates to `makePlaceholderScene()` (`phaserSimWidget.ts:102-108`) — TODO T036.
- Since TD-008, all modes (demo / practice / assessment) fire `sim-complete` from the placeholder; score = `100` for demo/practice, `config.passingScore` for assessment. Real per-simType rendering is still pending.

### Block Manager categories (verified)

- Basic, Navigation, Media, Assessment, Questions, Simulations.
- 15 blocks total registered in `registerBlocks.ts::registerBlocks()`.

### Component defaults `properties` shape (post TD-008)

All widget component defaults now use `properties: []` uniformly (GrapesJS `PropertyComposite` requires an array). The previous `{}` / `[]` inconsistency was removed; the `registerBlocks.test.ts` test asserts `toEqual([])` for all 14 widget types.

---

## 6. Writing order

1. **§20 (glossary stubs)** first, so every later chapter can link consistently.
2. **§04-§08 (authoring block walkthroughs)** — mechanical, low risk, highest reader-value density. Screenshots captured as each chapter is written.
3. **§09-§11 (Actions Editor)** — now unblocked (TD-008 closed; the dropdown shows names out of the box, so the text and screenshots match).
4. **§17 (worked example)** in parallel with §09-§11 so the example can cross-reference action recipes as they are written.
5. **§12-§14 (Simulations)** — include complete JSON examples; note the runtime-placeholder limitation honestly.
6. **§15-§16 (Preview + Publish)**.
7. **§19 (QA developer guide)** — technical, self-contained.
8. **§18 (troubleshooting)** — drafted last so every symptom can cross-reference the chapter that explains the feature.
9. **§01-§03 (Welcome, Getting Started, Slides)** — written last so they can confidently point to finished chapters.
10. **index.md** assembled from the finished ToC.
11. **Delete** the old `docs/user-guide/0*.md` files and replace `index.md` in one cleanup commit.
12. Final pass: verify every cross-link, check every screenshot has alt + caption, voice consistency check (no forbidden terms per the `elearn-docs-user` skill).

**Target length:** each chapter 400–800 words (split if over). Screenshots count as mandatory content, not decoration.
