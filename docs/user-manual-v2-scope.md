# User Manual v2 — Scope & Research Notes

> **Status:** Draft scope — v1 (`docs/user-manual-v1.md`) was too shallow.
> **Version target:** v0.5.61
> **Written:** 2026-04-18
> **Blocker:** Bug #4 (Actions Editor Name) should be fixed BEFORE writing §3 so the
> manual documents correct UX and not a workaround.

---

## 1. What v1 missed (deficiencies)

- No per-block walkthroughs (just a "drag and edit" one-liner per block).
- No full list of Props fields, defaults, ranges for any block.
- Actions Editor mentioned in one paragraph — no trigger list, no action list,
  no recipes, no DSL reference.
- No end-to-end worked example.
- No troubleshooting section.
- No glossary.
- Phaser section described UI but did not provide real JSON scene examples.
- Reader can't actually build anything after reading v1.

---

## 2. Scope for v2 (agreed with user)

### §1 — Welcome
- What a course is (slides + content blocks + logic).
- Screen tour (4 main areas + 5 right-sidebar tabs).
- Save model (auto-save 2s debounce, sync indicator).
- **NEW**: terminology (course / slide / block / element, not "widget").

### §2 — Authoring walkthroughs (MUCH deeper)
For **every** block type: purpose, full Props list with defaults & ranges,
step-by-step flow, 1 mini-example end-to-end, "Tips / Gotchas" callout.

Blocks to cover (grouped as in the Block Manager):

- **Basic**: Text, Image, Button, Rectangle
- **Navigation**: Nav Buttons, Done Button, Progress Bar
- **Media**: Media Player, Audio Narration, Volume Control
- **Assessment**: Quiz Score, Score Field
- **Questions**: Multiple Choice, True / False, Fill in the Blank
- **Simulations**: Software Walkthrough, Interactive Scenario (own chapter)

For each: include a verified field table (source: `registerBlocks.ts`,
`registerQuestionBlocks.ts`, type files in `types/questions.ts`, etc.).

### §3 — Actions Editor (deep dive — NEW top-level chapter)

**Framing** (for non-programmers): "When X happens → do Y".

#### 3.1 Triggers (events that fire actions)
From `WIDGET_EVENTS` + `SLIDE_EVENTS` in `@elearn-studio/shared-types`:

- **Widget events** (mapped to DOM in `dispatcher.ts:130-138`):
  `click`, `doubleClick`, `mouseEnter`, `mouseLeave`
- **Widget-custom events** (fired by widgets, not DOM):
  `questionAnswered`, `questionCorrect`, `questionIncorrect`,
  `mediaEnded`, `simComplete` (+ any others in WIDGET_EVENTS — verify at write time)
- **Slide events**: `enterSlide`, `exitSlide`

#### 3.2 Actions (what gets executed) — 15 items from `ACTION_PALETTE`
| Action | Category | Description | Params |
|---|---|---|---|
| Navigate | Navigation | Go to a slide | target (next/prev/first/last/by-name/by-number), slideName?, slideNumber? |
| Show | Object | Make a widget visible | widgetId |
| Hide | Object | Hide a widget | widgetId |
| Bring to Front | Object | Max z-index | widgetId |
| Display Message | Object | Modal message | message, title? |
| Play Media | Media | Play audio/video | widgetId |
| Stop Media | Media | Stop audio/video | widgetId |
| Score Question | Scoring | Evaluate one question | widgetId |
| Score Quiz | Scoring | Aggregate quiz score | — |
| Send to LMS | Scoring | Report to SCORM | — |
| Suspend Lesson | Scoring | Save + exit | — |
| Set Variable | Variables | Create/update | name, value, valueType (literal/expression) |
| Play Animation | Object | Path animation | widgetId, animationName? |
| If / Else | Flow | Branch on condition | expression |
| Loop | Flow | Repeat N / while | mode (count/while), count?, condition? |
| Call Sequence | Macros | Run shared seq | sequenceName |

#### 3.3 Expression DSL (apéndice técnico)
Regex (source: `ActionItemEditor.tsx:13` and `expression.ts`):
```
(!?)  (operand)  (op)?  (operand)?
```
- Operand types: `$variable`, `"literal"`, `'literal'`, number, `true`, `false`
- Operators: `==`, `!=`, `>=`, `<=`, `>`, `<`
- Negation: `!`
- Valid: `$score > 80`, `$answered == true`, `!$done`
- Invalid: `$score + 1 > 80` (no arithmetic), `$a && $b` (no boolean ops)

#### 3.4 Recipes (non-programmers)
Ready-to-copy patterns:

1. **Attempt counter** — increment `$attempts` on each wrong answer,
   lock retry when `$attempts >= 3`.
2. **Decision tree by score** — after Score Quiz, if `$score > 80` show
   congrats slide, else show review slide.
3. **Progressive hint reveal** — 3 hint blocks hidden at enterSlide; click
   "Hint" button increments `$hintCount` and shows hint[n].
4. **Gated navigation** — Next button hidden until all questions answered
   (track `$answered` counter in questionAnswered event).
5. **Branching lesson** — slide 3 navigates to slide 4 or 7 depending on
   user's earlier answer (stored in variable).

#### 3.5 Widget referencing (document the limitation until Bug #4 is fixed)

**Current state (pre-fix)**: dropdown shows cryptic GrapesJS IDs like `c32kq3`.
**Workaround**: select a widget on the canvas → right sidebar → Layers tab →
the selected layer's ID matches the dropdown option.

**After Bug #4 fix**: dropdown shows the Name trait (editable in Props tab),
falling back to ID when blank.

### §4 — Interactive Scenarios (Phaser) — with real JSON

Keep the 5 sim types + structured builders overview from v1 but add:

- **Complete Process Flow JSON example** (3 nodes + 2 edges + 2 steps).
- **Complete Interactive Diagram JSON** (background URL + 4 hotspots, one correct).
- **Complete Gamified Quiz JSON** (3 questions, timer 60s, 3 lives, combo 1.5).
- **Honest limitations** (same as v1 §6 — runtime uses placeholder until T036).

### §5 — Preview & Publish
Keep v1 content; add:

- **Troubleshooting publish** — common LMS import errors + meaning.
- **Choosing a format** expanded with a 3-question decision chart.

### §6 — QA / Developer testing (technical section)
Keep v1; add:

- How to run a single test with `--grep` or path filter.
- How to interpret a trace file (`npx playwright show-trace <path>`).
- How to add a new spec (fixture pattern, `editorPage` usage).

### §7 — Troubleshooting (NEW top-level chapter)
Symptom → cause → fix. Target 10 entries:

1. "Save indicator stuck on 'Saving…'"
2. "Image block shows a broken icon" (asset URL expired / not uploaded)
3. "Preview popup doesn't open" (popup blocker)
4. "LMS does not record my score" (no Done Button / Send to LMS missing)
5. "Actions Editor dropdown shows IDs I don't recognise" (Bug #4 workaround)
6. "Phaser scenario shows only a label in the LMS" (runtime placeholder T036)
7. "Undo/Redo doesn't revert a property change"
8. "Dragging block onto canvas does nothing" (z-index / pointer-events)
9. "Published ZIP is huge" (unused Phaser bundle / large images)
10. "Course won't load for a specific slide" (corrupt component tree, recover via Layers)

### §8 — End-to-end worked example (NEW)
A 5-slide course built step-by-step:

1. **Intro slide** — Title text + Start button with `Navigate: next`.
2. **Theory slide** — Image + text + Nav Buttons + Progress Bar.
3. **Question slide** — Multiple Choice (weight 50, 2 attempts, feedback).
4. **Branching slide** — `If/Else` on enterSlide: score > 60 → slide 5; else show encouragement message + hide Next.
5. **Final slide** — Quiz Score widget + Done Button + `Send to LMS` on click.

### §9 — Glossary (NEW)
~30 terms, user-language definitions, cross-referenced to chapters.
Course, Slide, Content block, Element, Props, Action, Trigger,
Shared Sequence, SCORM package, LMS, Simulation (+ its 2 flavours),
Scene Definition, Hotspot, Asset Library, Layers, Variable, Expression,
Done Button, Passing Score, Attempts, Weight, Feedback, Auto-save,
Preview, Publish, Undo/Redo history, Layer, Template.

---

## 3. Bugs detected during audit

| # | Bug | Prio | LOC | Where |
|---|---|---|---|---|
| 1 | Phaser preview modal doesn't resize with window | LOW | <20 | `components/simulation/PhaserSimPreviewModal.tsx` |
| 2 | `properties: []` vs `{}` inconsistency | LOW | <10 | `editor/registerBlocks.ts` (audio-narration, progress-bar, volume-control) |
| 3 | Placeholder only emits sim-complete in demo mode | LOW | — | `packages/runtime-player/src/widgets/phaserSimWidget.ts` (auto-resolves with T036) |
| 4 | **Actions Editor doesn't use Name trait — cryptic IDs** | **HIGH** | <10 | `editor/converters.ts` (propagate name) + `components/actions/ActionItemEditor.tsx:192-195` (label fallback) |

Bug #4 is a **documentation blocker** — write §3 AFTER the fix so the manual
describes correct UX, not a workaround.

---

## 4. Research notes (so we don't re-audit)

### Actions Editor — how widget resolution works

- Runtime: `ctx.getWidget(widgetId)` returns `{ id, type, el, extendedProperties }`
  from a widgetId → WidgetRef map set up by the player when mounting a slide.
- The `el` is found via `[data-widget-id="<id>"]` selector in the DOM
  (used in `executeBringToFront` — `visibility.ts:34`).
- `widgetId` = GrapesJS component `id` (auto-generated). Persisted as
  `widget.id` in `course.slides[i].widgets[j]`.
- The `name` trait is editable per widget (Props → Name) but not persisted to
  `widget.name` by `converters.ts` (0 matches for `name` in that file).
- `ActionItemEditor.tsx:184-197`: `<select>` options are `<option value={w.id}>{w.id}</option>` —
  label and value both are the ID.

### Event model

- `dispatcher.ts:130-138` — DOM-mapped widget events: `click, doubleClick,
  mouseEnter, mouseLeave`.
- `fireWidgetEvent(widgetId, eventName, sequences)` — widget-fired custom
  events (questionAnswered, simComplete, mediaEnded).
- `fireSlideEvent('enterSlide'|'exitSlide', allWidgetSequences)` — slide lifecycle.
- TD-003 guards: every `sequences ?? []` is defensive against legacy Mongo
  docs missing `actions` on widget.

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

- Authoring UI: **complete** (5 sim types, 3 structured builders: ProcessFlow,
  Diagram, GamifiedQuiz + raw JSON editor).
- `extendedProperties.sceneDef` **is persisted** correctly end-to-end.
- Runtime: `buildSceneConfig()` always delegates to `makePlaceholderScene()`
  (`phaserSimWidget.ts:102-108`) — TODO T036.
- Only `mode === 'demo'` auto-completes via
  `this.time.delayedCall(2000, () => this.events.emit('sim-complete', 100))`.

### Block Manager categories (verified)

- Basic, Navigation, Media, Assessment, Questions, Simulations.
- 15 blocks total registered in `registerBlocks.ts::registerBlocks()`.

### Data shape inconsistency (Bug #2)

`registerBlocks.ts` — `audio-narration`, `progress-bar`, `volume-control`
use `properties: []` (array). All others use `properties: {}` (object).
`converters.ts` accepts both but this is latent debt.

---

## 5. Writing order (when we start v2)

1. **Fix Bug #4 first.** Then §3 can document correct UX.
2. Write §2 (authoring walkthroughs) — mechanical, low risk.
3. Write §3 (Actions Editor) — core differentiator; include recipes.
4. Write §8 (end-to-end example) in parallel with §3 so they cross-reference.
5. §4 (Phaser), §5 (publish), §6 (QA), §7 (troubleshooting), §9 (glossary).
6. Final pass: hyperlink all cross-references, verify every Props table
   against source, spell-check, voice consistency check.

Target length: 3–4× v1 (≈ 15–25 KB markdown).
