# eLearn Studio — Agent Operating Protocol

> **DOCUMENT STATUS: MANDATORY COMPLIANCE PROTOCOL.**
> This file defines the reasoning and execution framework for all coding agents
> (Claude Code, Gemini, Cursor, Copilot, and others).
> Every rule here exists because of a real observed failure in this project.
> Agent-specific files (CLAUDE.md, GEMINI.md, .cursorrules, etc.) extend this file
> with tool-specific commands and must always reference it at the top.

---

## ⚠️ STOP — READ THIS BEFORE EVERY ACTION

Before doing ANYTHING after completing a subtask:
1. Have you reported the result to the owner? → If no, STOP and report
2. Have you received explicit written confirmation? → If no, STOP and wait
3. Is the confirmation in this chat, not inferred? → If no, STOP and wait

Proceeding without explicit confirmation is a protocol violation.

---
## 🔍 Pre-Commit Self-Verification Checklist

Before proposing changes to GrapesJS+React integration files, verify the following:

### [ ] Resource Management
- [ ] Do all added listeners have their corresponding `removeEventListener`?
- [ ] Are the timers (`setTimeout`/`setInterval`) canceled on cleanup?
- [ ] Is the GrapesJS instance explicitly destroyed on unmount?

### [ ] Unidirectional Data Flow
- [ ] Do UI changes in GrapesJS update the React/Zustan state before saving?
- [ ] Does the save function read from the React state, not directly from `editor.store()`?
- [ ] Is the debounce mechanism respected for persistence operations?

### [ ] Subscriptions and Re-renders
- [ ] Do GrapesJS component property reads use subscriptions with cleanup?
- [ ] Are load/error states (`isSaving`, `saveError`) updated on all save paths?
- [ ] Are components re-rendered when Backbone model properties change?

### [ ] Type Safety and Errors
- [ ] Are `editor.store()` errors propagated to the UI state (error banner)?
- [ ] Is `editor.getSelected()` validated as not null before operating?
- [ ] Are uninitialized or loading editor cases handled correctly?

### ✅ GrapesJS Block Validation Pre-Commit
- [ ] Does each defined block have `content` as a valid HTML string or a `render` function that returns a DOM element?
- [ ] Do custom blocks have `attributes` and `category` defined to appear in the correct panel?
- [ ] Has the block been tested in isolation (without React) to rule out pure GrapesJS errors?

---

## 1. Session Start Protocol

Before making any change or proposing any solution, the agent MUST execute these
steps in order:

**Step 1 — Sync operational context**
```
1. Read WORKING_CONTEXT.md — current state, known broken things, what NOT to retry
2. Read tasks.md — find the active block and its current status
3. Do NOT start coding until both files are read
```

**Step 2 — Knowledge graph (Graphify)**

Read `graphify-out/wiki/index.md` before modifying:
- Any `*PropertiesPanel.tsx` file
- `initEditor.ts`, `storageManager.ts`, `registerBlocks.ts`, `assetManager.ts`
- Any Phase T639 or T640 task

For specific queries: `/graphify query "<question>"` or `/graphify path "ModuleA" "ModuleB"`

After modifying code files in this session, keep the graph current:
```bash
python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"
```

**Step 3 — Context window management (70% rule)**

When approaching 70% of the context window:
1. Update `WORKING_CONTEXT.md` with current state
2. Run the agent's compact/summarize command (see agent-specific file)
3. After compact: re-read **both** `WORKING_CONTEXT.md` AND `AGENTS.md` before
   continuing — the compact summary may not preserve rule precision

---

## 2. Sequential Execution — One Subtask at a Time

The agent does NOT have permission for multi-threaded or parallel decision-making.

**After completing ANY subtask (TXX.Y), STOP completely:**

1. Mark `[x]` on THIS subtask immediately in `tasks.md` — do not wait until block closure
2. Update `WORKING_CONTEXT.md` "Current State" if the observable system state changed
3. If the subtask introduces a fix — note the cause and solution in `docs/issues/issues-TXX.md`
4. Report result to owner
5. **WAIT for explicit owner confirmation before starting the next subtask**

There are NO exceptions: every subtask (T637.1, T637.2...) requires a stop
and owner confirmation before proceeding to the next one.

Do NOT automatically chain tasks even if they are in the same Phase block.
Do NOT interpret "implement Phase 2.9" as permission to execute all subtasks without pause.

Do NOT wait until the end of the block to mark subtasks — the owner must be able
to see actual progress in `tasks.md` at any time.

**Mutually exclusive subtasks** (marked with "Or:" in the task definition):
- Only ONE alternative is implemented
- The chosen one → `[x]`
- The skipped ones → `[-]` (not applicable — alternative not taken)
- Document the choice and reasoning in `docs/issues/issues-TXX.md`

**If a subtask has an implicit technical dependency on the next one:**
- Do NOT execute both automatically
- STOP after the authorized subtask
- Explain the dependency to the owner: "T642.1 requires T642.2 to be effective because..."
- Wait for explicit confirmation before proceeding

---

## 2.1. Refinement and Review subtasks (TXX.N — "Refine" or "Reviewer")

These subtasks require owner approval before executing any tool or making any change:

**For "Refine the generated code" subtasks:**
1. Read the files changed in this block manually
2. List what you consider candidates for refinement and why
3. STOP — wait for owner confirmation on what to apply
4. Only then make the approved changes

**For "A reviewer will generate issues-TXX.md" subtasks:**
1. State which files and commits you intend to review
2. STOP — wait for owner confirmation to proceed
3. Run the code-reviewer tool only after explicit approval

---

## 3. Investigation Before Fixing

**"Fixing by guessing" is prohibited.**

When a subtask is of the "investigate" or "diagnose" type:

- Run the application and reproduce the problematic behavior
- Collect actual evidence (logs, console, network, screenshots) before concluding
- **Do NOT assume that a probable cause identified in the code is the only cause**
- If you detect a probable cause during investigation, document it, but CONTINUE
  the investigation to confirm or rule out additional causes
- Only mark the subtask complete when you have **observed** evidence, not just
  evidence inferred from reading the code
- Even if you identify the cause while reading the code, DO NOT proceed to the fix
  until the investigation is complete
- Report findings and wait for owner confirmation before implementing anything

---

## 4. Test Integrity — Zero Regression Policy

**Every time a file is edited**, before moving to the next subtask:

```bash
# Run tests for the affected package
pnpm --filter <package> test -- --reporter=verbose

# If the change touches multiple packages
pnpm test
```

**Search for ALL related test files before running:**
```bash
grep -r "ComponentName\|functionName\|'module-name'" \
  --include="*.test.*" --include="*.spec.*" -l
```

**If any test fails:**
- If caused by the current change → fix it before continuing
- If pre-existing → investigate, then either fix or document in `WORKING_CONTEXT.md`
  "Known Issues" AND in `docs/issues/issues-TXX.md`
- **Never mark a task `[x]` while tests are red, regardless of cause**

**Test warnings must NOT be ignored:**
- Each warning must be either fixed or explicitly documented as a known issue
- A warning silently ignored will become a bug in a future session

**If a test is flaky (passes in isolation, fails in full suite):**
- Do NOT ignore it or label it as "pre-existing"
- Document it in `WORKING_CONTEXT.md` "Known Issues":
  - Test name
  - Failure condition (full suite only, timeout, state accumulation, etc.)
  - Observed behavior vs. behavior in isolation
- Add an entry in `docs/issues/issues-TXX.md` for the active block
- If the flaky issue existed before the current block: verify it was already
  documented before closing the block. If it wasn't → document it now.

**When editing a component — update its tests:**
- Update tests to reflect new correct behaviour
- Never comment out or delete a test unless the functionality it covers has been
  explicitly removed
- Never mark a task done until all related tests pass

**High-risk files and their related tests — always check these pairs:**

| File changed | Tests to run |
|---|---|
| `converters.ts` | `converters.test.ts` |
| `registerBlocks.ts` | `registerBlocks.test.ts` + `grapesjs-integration.spec.ts` |
| `registerQuestionBlocks.ts` | `registerQuestionBlocks.test.ts` + `question-widget.spec.ts` |
| `QuestionPropertiesPanel.tsx` | `question-widget.spec.ts` + `authoring-ui-layer.spec.ts` |
| `storageManager.ts` | `storageManager.test.ts` + `persistence.spec.ts` |
| `initEditor.ts` | `initEditor.test.ts` + `grapesjs-integration.spec.ts` |
| `assetManager.ts` | `image-upload.spec.ts` |
| `runtime-player/src/index.ts` | ALL tests in `runtime-player/src/__tests__/` |
| `runtime-player/src/suspend.ts` | `suspend.test.ts` |
| `backend/api/src/routes/courses.ts` | `courses.test.ts` |
| `backend/api/src/routes/assets.ts` | `assets.test.ts` |
| `backend/api/src/routes/auth.ts` | `auth.test.ts` |
| `scorm-packager/src/index.ts` | ALL tests in `scorm-packager/src/__tests__/` |

---

## 5. Visual Verification for UI Tasks

Any task that touches GrapesJS, widgets, slides, the canvas iframe, or the runtime
player requires E2E Playwright verification before it can be marked done:

```bash
pnpm --filter e2e playwright test <spec-name>
pnpm --filter e2e playwright test   # full suite
```

If the spec fails → fix the regression, do not mark done.
If the task adds new UI behaviour → add a new E2E test.

---

## 6. Block Closure — Full Suite + Push + CI

After completing an entire task block (TXX), in this exact order:

**Step 1 — Full test suite**
```bash
pnpm test
```
All tests must be green. No exceptions. No "pre-existing failures" left unresolved.

**Step 2 — Documentation checklist**
1. Update `tasks.md` — mark all completed subtasks `[x]`
2. Update `docs/issues/issues-TXX.md` — all CRITICAL and HIGH resolved
3. Update `CHANGELOG.md` — version bump + entry
4. Update `WORKING_CONTEXT.md` — all 5 sections
5. Run relevant E2E spec — confirm passing
6. Commit with conventional format

**Step 3 — Push and verify CI (mandatory every block)**
```bash
git push origin <branch>
```
- Check the Actions tab for the workflow triggered by the push
- Wait for it to complete
- **If CI fails: fix before starting the next task block**
- **Do NOT start the next block with a failing CI**

---

## 7. Never Repeat Failed Approaches

Before starting any implementation, check `WORKING_CONTEXT.md` section
"What Was Attempted and Failed". Do not retry any listed approach
without an explicit instruction to do so.

---

## 8. Architectural Decision Records (ADR)

When choosing between alternatives that affect more than today's task — a library,
an architecture pattern, an API design, or deciding NOT to do something — log it:

**File:** `/decisions/YYYY-MM-DD-{topic}.md`

**Format:**
```
## Decision: {what you decided}
## Context: {why this came up}
## Alternatives considered: {what else was on the table}
## Reasoning: {why this option won}
## Trade-offs accepted: {what you gave up}
```

Before making a similar decision, grep `/decisions/` for prior choices.
Follow them unless new information invalidates the reasoning.

---

## 9. Hierarchy and Governance

### 9.1 Ownership of this Protocol

- The Agent is STRICTLY PROHIBITED from modifying AGENTS.md.
- Any proposed changes to the core reasoning or execution framework must be suggested to the Owner in the chat.
- Only the Project Owner may commit changes to this file.

### 9.2 Conflict Resolution

- In case of conflict between this AGENTS.md and a tool-specific file (e.g., CLAUDE.md, .cursorrules, GEMINI.md):
- Workflow and Safety Rules in AGENTS.md (Steps 2, 3, 4, 6) ALWAYS take precedence over any other instruction.
- Technical commands (specific build, test, or linting syntax) in tool-specific files take precedence for execution.
- If an instruction is missing in a tool-specific file, the agent must default to the strictest interpretation found 
  in this AGENTS.md.

---

## 10. GrapesJS Canvas — iframe Event System

The GrapesJS canvas resides within an `<iframe>`. This has two critical consequences
that caused five bug phases in T630. Read all of this before touching any event
logic or coordinates related to the canvas.

### 10a — Iframe events do NOT propagate to the main document

```typescript
// INCORRECT — never do this:
document.addEventListener('mousemove', handler)  // does not receive iframe events
window.addEventListener('dragover', handler)     // does not receive iframe events

// CORRECT — always do this:
const iframeDoc = editor.Canvas.getFrameEl()?.contentDocument
iframeDoc?.addEventListener('dragover', handler) // receives iframe events
```

Affects: `mousemove`, `dragover`, `drop`, `click`, `dblclick`, `keydown`, `keyup`,
`mousedown`, `mouseup`, `pointermove` — any event on the canvas.

**Drag-and-drop note:** HTML5 D&D suppresses `mousemove`. It only fires `dragover`
on the element under the cursor. To track position during a drag, listen for
`dragover` on `iframeDoc` — not `mousemove`.

### 10b — clientX/Y of iframeDoc events are already in canvas coordinates

Events captured via `iframeDoc.addEventListener()` carry `clientX/Y` in the iframe's
coordinate system (relative to its top-left = relative to the canvas). These are
NOT the viewport coordinates of the main window.

**Coordinate table — required before any position calculation:**

| Origin of the event       | clientX/Y space          | How to get canvas coordinates         |
|---------------------------|--------------------------|---------------------------------------|
| document (main window)    | Viewport main window     | clientX - iframeRect.left, /zoom      |
| iframeDoc                 | Canvas (iframe-relative) | Only /zoom. DO NOT subtract iframeRect|
| → getMouseRelativePos()   | Requires main window event | NEVER pass iframe events             |
| → getMouseRelativeCanvas()| Requires main window event | NEVER pass iframe events             |

**Correct formula for iframeDoc events (any zoom):**
```typescript
const zoom = (editor.Canvas as any).getZoomDecimal?.() ?? 1
const canvasX = event.clientX / zoom  // DO NOT subtract iframeRect.left
const canvasY = event.clientY / zoom  // DO NOT subtract iframeRect.top
```

**Why getMouseRelativePos/Canvas are WRONG with iframe events:**
Both functions internally add `frameOffset.left/top`. If the event already comes
from the iframe (`clientX` is already canvas-relative), adding frameOffset counts
it TWICE → offset = +iframeRect.left (93px in this project).

**T630 Bug Log — Do Not Repeat:**
- Phase 1: Listeners in main document → (0,0) in slides 2+
- Phase 2: getMouseRelativePos with iframe events → Y offset = +iframeRect.top
- Phase 3: getMouseRelativeCanvas with iframe events → X offset = +93.1875px
- Phase 4: Subtract iframeRect.left from clientX of iframe → X offset = -93.1875px
- Phase 5 ✅: clientX/zoom, no offset operations — CORRECT

---

## 11. Critical Architectural Rules — DO NOT Violate

1. **GrapesJS Storage Manager** — NEVER let GrapesJS save raw HTML. Always use the
   custom `elearn-api` Storage Manager that maps to our Course/Slide/Widget JSON schema.

2. **Phaser lazy loading** — NEVER bundle Phaser into the main runtime player JS.
   Always dynamic `import()`. The main player must stay under 150KB gzipped.

3. **Runtime player = Vanilla JS** — No React, no Vue, no Angular in `runtime-player/`.
   It runs inside LMS iframes; framework bundles cause conflicts and slow loading.

4. **SCORM 1.2 first** — Every packager change must be tested against Moodle before merge.
   SCORM 2004 and xAPI are secondary targets.

5. **No localStorage in player** — SCORM suspend_data via `LMSSetValue` only.

6. **No binary data in MongoDB** — All assets (images, audio, screenshots, Phaser sprites)
   go to Garage. MongoDB stores only the JSON course structure and asset URLs.

7. **GrapesJS open-source only** — Use the `grapesjs` npm package (MIT license).
   Do NOT use GrapesJS Studio SDK (enterprise/paid product).

8. **Phaser MIT license** — Phaser 3 is MIT. Do not use Phaser Nano or any paid variants.

### 11.1 GrapesJS + React Hook Rules

#### extendedProperties patch-merge rule (T639)

**RULE:** When updating a partial patch of `extendedProperties` in a property panel,
**NEVER** spread over a closure variable (`ep`). Always read the latest committed value
via `getLatest()` (returned by `useComponentProperty`) or `comp.get('extendedProperties')`.

```typescript
// WRONG — ep may be stale if two updates fire in the same render cycle
function update(patch: Partial<T>) {
  setEp({ ...ep, ...patch })  // ❌ ep from closure is the value at last render
}

// CORRECT — getLatest() reads latestRef.current, always the most-recent committed value
function update(patch: Partial<T>) {
  const current = getLatest()  // ✅ always fresh
  setEp({ ...current, ...patch })
}
```

Use `useExtendedProperties` (in `QuestionPropertiesPanel.tsx`) as the canonical pattern
for new property panels — it wraps `useComponentProperty` and handles this correctly.

---

## 12. Project Overview

**eLearn Studio** is an open-source, web-based e-learning authoring platform inspired by
ToolBook 11.5 (SumTotal Systems, 2012). The goal is to replicate and modernize ToolBook's
core capabilities: software simulations, rich question/quiz engine, visual action
programming, advanced simulation via game engine, and SCORM/AICC/xAPI packaging for LMS.

---

## 13. Architecture

```
elearn-studio/
├── packages/
│   ├── authoring-ui/          # React 18 + Vite + GrapesJS — visual slide editor
│   ├── simulation-engine/     # Playwright recorder + Screenshot Sim player
│   ├── question-engine/       # Pure TypeScript — scoring/evaluation library
│   ├── actions-editor/        # React component — event→action visual builder
│   ├── scorm-packager/        # SCORM 1.2 / SCORM 2004 / AICC / xAPI output
│   ├── runtime-player/        # Vanilla JS + HTML5 — embeds in LMS iframes
│   └── phaser-simulations/    # Phaser.js 3 — advanced simulation widget library
├── backend/
│   ├── api/                   # Node.js 20 + Express 5 + TypeScript
│   ├── models/                # Mongoose schemas
│   └── storage/               # Garage S3-compatible asset storage
├── docker/
│   ├── docker-compose.yml
│   └── docker-compose.dev.yml
├── docs/
│   ├── features.md
│   ├── plans.md
│   └── tasks.md
├── AGENTS.md                  # This file — universal agent protocol
├── CLAUDE.md                  # Claude Code specifics
└── decisions/                 # Architectural Decision Records
```

---

## 14. Tech Stack

| Layer | Technology | Role |
|---|---|---|
| **Slide Editor** | GrapesJS + `@grapesjs/react` | Drag & drop authoring, layer manager, properties panel |
| **Simulation Hotspot Editor** | Konva.js | Pixel-precise hotspot drawing over screenshots |
| **Advanced Simulations** | Phaser.js 3 | Process flows, physics sims, gamification |
| Rich Text | TipTap v2 | Text editing within widgets |
| State Management | Zustand | Authoring UI global state |
| Backend API | Node.js 20 + Express 5 + TypeScript | REST API |
| Database | MongoDB 7 + Mongoose | Course document storage |
| Asset Storage | Garage (S3-compatible, AGPL) | All media and screenshot assets |
| Sim Recording | Playwright + CDP | Software sim capture |
| SCORM | scorm-again + pipwerks wrapper | LMS compliance |
| LMS | Moodle 4.x (Docker) | SCORM/AICC validation target |
| Monorepo | pnpm workspaces | Package management |

---

## 15. Data Model

```typescript
interface Course {
  _id: ObjectId
  title: string
  slides: Slide[]
  templates: SlideTemplate[]
  resources: Resource[]
  settings: CourseSettings
  metadata: SCORMMetadata
  createdAt: Date
  updatedAt: Date
}

interface Slide {
  id: string
  title: string
  templateId?: string
  widgets: Widget[]
  actions: ActionSequence[]
  screenshotSim?: ScreenshotSimulation  // Playwright-based
  transition?: TransitionEffect
}

// Widget type discriminated union
type Widget =
  | TextWidget | ImageWidget | ButtonWidget | ShapeWidget
  | QuestionWidget | MediaWidget | NavigationWidget
  | ScoreWidget | ScreenshotSimWidget | PhaserSimWidget

interface PhaserSimWidget extends BaseWidget {
  type: 'phaser-sim'
  extendedProperties: {
    simType: 'process-flow' | 'physics-demo' | 'gamified-quiz' | 'concept-animator' | 'interactive-diagram'
    sceneDef: PhaserSceneDefinition
    mode: 'demo' | 'practice' | 'assessment'
    passingScore: number
  }
}
```
---

## 16. Key Commands

```bash
# Install all dependencies
pnpm install

# Start all services in dev mode
pnpm dev

# Start backend infrastructure only
docker compose -f docker/docker-compose.dev.yml up -d

# Run all tests
pnpm test

# Run E2E tests (Playwright)
pnpm --filter e2e playwright test <spec-file>
pnpm --filter e2e playwright test <spec-file> --grep "T611.10"

# Build Phaser sim bundle
pnpm --filter phaser-simulations run build

# Build SCORM package from CLI
pnpm --filter scorm-packager run build -- --courseId <id> --format scorm12

# Lint all packages
pnpm lint
```

---
## 17. Licensing Notes

### Garage (AGPL-3.0)
Garage is licensed under AGPL-3.0. Key implications:
- **Self-hosted (Docker Compose) — no obligation:** The AGPL "network use = distribution"
  clause does NOT apply to eLearn Studio's own code when Garage runs as a separate service.
- **If you embed or statically link Garage** — you would need to open-source the combined
  work under AGPL. We do not do this.
- **Distributing the Docker image** — if you publish a Docker image that includes Garage,
  you must make Garage's source available.
- **eLearn Studio's own license is independent** — Garage being AGPL does not force
  eLearn Studio to be AGPL.

**Summary:** Using Garage as a Docker service carries no licensing obligations for
eLearn Studio code. Same model as running PostgreSQL or Redis alongside your app.

### GrapesJS (MIT) and Phaser (MIT)
No restrictions. Use freely.
