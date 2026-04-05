# eLearn Studio — Claude Code Instructions

## Session Protocol — Read This First Every Session

> These rules exist because without them: documentation gets skipped, context is
> lost between sessions, tests break silently, and the same bugs get reintroduced.
> Every rule here exists because of a real observed failure in this project.

---

### Rule 1 — Start of session

```
1. Read WORKING_CONTEXT.md — current state, known broken things, what NOT to retry
2. Read docs/tasks.md — find the active block and its current status
3. Do NOT start coding until both files are read
```

---

### Rule 2 — After every code change: run tests immediately

**Every time a file is edited**, before moving to the next subtask:

```bash
# Run tests for the affected package
pnpm --filter <package> test -- --reporter=verbose

# If the change touches multiple packages
pnpm test
```

**If any test fails:**
- If the failure is caused by the current change → fix it before continuing
- If the failure appears pre-existing → **it is NOT acceptable to ignore it**
  - Investigate the failure
  - If it is genuinely pre-existing: document it in `docs/issues/issues-TXX.md`
    under a new entry and add to `WORKING_CONTEXT.md` "Known Issues"
  - Never mark a task `[x]` while tests are red, regardless of cause

**Test warnings (non-breaking) must NOT be ignored:**
- Warnings indicate deficiencies in the test or in the production code
- Each warning must be either fixed or explicitly documented as a known issue
- A warning that is silently ignored will become a bug in a future session

---

### Rule 3 — When editing a component: update its tests

**Every time a file is edited**, search for ALL related tests:

```bash
# Find all test files that reference the changed module
grep -r "ComponentName\|functionName\|'module-name'" \
  --include="*.test.*" --include="*.spec.*" -l
```

Run every test found. If any fail due to the change:
- **Update the test** to reflect the new correct behaviour
- **Never comment out or delete a test** unless the functionality it covers
  has been explicitly removed
- **Never mark the task done** until all related tests pass

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

### Rule 4 — End of every task block: full suite + push + verify CI

After completing any task block (TXX), in this exact order:

**Step 1 — Full test suite**
```bash
pnpm test
```
All tests must be green. No exceptions. No "pre-existing failures" left unresolved.

**Step 2 — Run /task-complete**
Follow every step in `.claude/commands/task-complete.md`:
1. Update `docs/tasks.md` — mark completed subtasks `[x]`
2. Update `docs/issues/issues-TXX.md` — CRITICAL and HIGH resolved
3. Update `CHANGELOG.md` — version bump + entry
4. Update `WORKING_CONTEXT.md` — all 5 sections
5. Run relevant E2E spec — confirm passing
6. Commit with conventional format

**Step 3 — Push and verify CI (mandatory every block)**
```bash
git push origin <branch>
```
Then verify GitHub Actions:
- Check the Actions tab for the workflow triggered by the push
- Wait for it to complete
- **If CI fails: fix before starting the next task block**
- **Do NOT start the next block with a failing CI**
- This is mandatory after every task block, not occasional

---

### Rule 5 — Visual verification for UI tasks

Any task that touches GrapesJS, widgets, slides, the canvas iframe, or the runtime
player requires Playwright verification before it can be marked done:

```bash
pnpm --filter e2e playwright test <spec-name>
pnpm --filter e2e playwright test   # full suite
```

If the spec fails → fix the regression, do not mark done.
If the task adds new UI behaviour → add a new E2E test.
Read `.claude/skills/elearn-e2e-qa/SKILL.md` before writing any test.

---

### Rule 6 — Never repeat failed approaches

Before starting any implementation, check `WORKING_CONTEXT.md` section
"What Was Attempted and Failed". Do not retry any listed approach
without an explicit instruction to do so.

---

### Rule 7 — Context window management

When approaching 70% of the context window:
1. Update `WORKING_CONTEXT.md` with current state
2. Run `/compact`
3. After compact: re-read `WORKING_CONTEXT.md` to restore context .

---
### Regla 8 — GrapesJS canvas es un iframe: listeners y sistema de coordenadas

El canvas de GrapesJS vive dentro de un `<iframe>`. Esto tiene DOS consecuencias
críticas que causaron 5 fases de bug en T630. Lee todo esto antes de tocar cualquier
lógica de eventos o coordenadas relacionada con el canvas.

#### 8a — Los eventos del iframe NO se propagan al main document

INCORRECTO — nunca hagas esto:
  document.addEventListener('mousemove', handler)   // no recibe eventos del iframe
  window.addEventListener('dragover', handler)       // no recibe eventos del iframe

CORRECTO — siempre así:
  const iframeDoc = editor.Canvas.getFrameEl()?.contentDocument
  iframeDoc?.addEventListener('dragover', handler)   // recibe eventos del iframe

Afecta a: mousemove, dragover, drop, click, dblclick, keydown, keyup,
mousedown, mouseup, pointermove — cualquier evento sobre el canvas.

Nota drag-and-drop: HTML5 DnD SUPRIME `mousemove`. Solo dispara `dragover`
en el elemento bajo el cursor. Para rastrear posición durante un drag,
escucha `dragover` en iframeDoc — no `mousemove`.

#### 8b — clientX/Y de eventos iframeDoc ya están en coordenadas del canvas

Los eventos capturados vía `iframeDoc.addEventListener()` llevan `clientX/Y`
en el sistema de coordenadas del iframe (relativo a su top-left = relativo al
canvas). NO son coordenadas del viewport del main window.

TABLA DE COORDENADAS — obligatoria antes de cualquier cálculo de posición:

  | Origen del evento       | clientX/Y space         | Cómo obtener canvas coords     |
  |-------------------------|-------------------------|-------------------------------|
  | document (main window)  | Viewport main window    | clientX - iframeRect.left, /zoom |
  | iframeDoc               | Canvas (iframe-relative)| Solo /zoom. NO restar iframeRect |
  | → getMouseRelativePos() | Requiere evento del main | NUNCA pasar eventos del iframe  |
  | → getMouseRelativeCanvas()| Requiere evento del main | NUNCA pasar eventos del iframe|

Fórmula correcta para eventos de iframeDoc (cualquier zoom):
  ```typescript
  const zoom = (editor.Canvas as any).getZoomDecimal?.() ?? 1
  const canvasX = event.clientX / zoom   // NO restar iframeRect.left
  const canvasY = event.clientY / zoom   // NO restar iframeRect.top
  ```

Por qué getMouseRelativePos/Canvas ESTÁN MAL con eventos iframe:
  Ambas funciones añaden internamente frameOffset.left/top. Si el evento ya
  viene del iframe (clientX ya es canvas-relativo), añadir frameOffset lo
  cuenta DOS VECES → offset = +iframeRect.left (93px en este proyecto).

Historial de bugs T630 (no repetir):
  Fase 1: listeners en main document → (0,0) en slides 2+
  Fase 2: getMouseRelativePos con eventos iframe → Y offset = +iframeRect.top
  Fase 3: getMouseRelativeCanvas con eventos iframe → X offset = +93.1875px
  Fase 4: restar iframeRect.left a clientX del iframe → X offset = -93.1875px
  Fase 5 ✅: clientX/zoom, sin operaciones de offset — CORRECTO
---
## Project Overview

**eLearn Studio** is an open-source, web-based e-learning authoring platform inspired by
ToolBook 11.5 (SumTotal Systems, 2012). The goal is to replicate and modernize ToolBook's
core capabilities: software simulations, rich question/quiz engine, visual action programming,
advanced simulation via game engine, and SCORM/AICC/xAPI packaging for LMS delivery.


---

## Architecture

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
└── CLAUDE.md                  # This file
```

---

## Tech Stack

| Layer | Technology | Role |
|---|---|---|
| **Slide Editor** | **GrapesJS** + `@grapesjs/react` | Drag & drop authoring, layer manager, properties panel, asset manager |
| **Simulation Hotspot Editor** | Konva.js | Pixel-precise hotspot drawing over screenshots |
| **Advanced Simulations** | **Phaser.js 3** | Process flows, physics sims, gamification, animated concepts |
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

## ToolBook → eLearn Studio mapping

| ToolBook Concept | eLearn Studio Equivalent | Technology |
|---|---|---|
| Book | Course (MongoDB document) | — |
| Page | Slide (array in Course) | — |
| Background (shared) | SlideTemplate layer | GrapesJS frame |
| Object / Catalog item | Widget (GrapesJS Block + Component) | GrapesJS |
| Book Explorer | Slide list + GrapesJS Layer Manager | GrapesJS |
| Actions Editor | ActionsEditor React component | Custom React |
| OpenScript | ActionSequence JSON DSL | Custom |
| Sim AutoBuilder | SimulationRecorder | Playwright + CDP |
| Simulation Editor | SimulationEditor Konva canvas | Konva.js |
| **Advanced Simulation** | **PhaserSimWidget** | **Phaser.js 3** |
| Question Objects | QuestionWidget (typed) | question-engine |
| Scoring & Tracking | ScoringEngine + LMS bridge | scorm-again |
| Publish to Web | PackageCourse → ZIP | scorm-packager |

---

## GrapesJS Integration — Critical Details

GrapesJS is the foundation of the slide editor. It replaces ~2 months of custom
drag & drop, layer management, undo/redo, and asset management work.

### What GrapesJS provides out of the box
- Drag & drop block placement onto canvas ✅
- Resize / move handles per object ✅
- Layer Manager panel (z-order) ✅
- Undo/redo stack ✅
- Asset Manager (connected to Garage via backend API) ✅
- Style Manager (properties panel) ✅
- Responsive device preview ✅
- Block Manager (our widget catalog) ✅
- Plugin ecosystem ✅

### Custom Storage Manager (MANDATORY — do not skip)
GrapesJS saves raw HTML/CSS by default. We MUST override this with a custom
Storage Manager that converts to/from our Course JSON schema:

```typescript
// packages/authoring-ui/src/grapesjs/storage-manager.ts
const elearnStorageManager = {
  type: 'elearn-api',

  async load(options: { courseId: string; slideId: string }) {
    // Always handle load failure — GrapesJS will display blank canvas on error
    try {
      const course = await api.getCourse(options.courseId)
      // Convert our Course schema → GrapesJS component tree
      return grapesjsFromSlide(course.slides.find(s => s.id === options.slideId))
    } catch (err) {
      console.error('GrapesJS storage load failed:', err)
      throw err  // let GrapesJS handle the error (shows notification)
    }
  },

  async store(gjsData: GrapesJsData, options: { courseId: string; slideId: string }) {
    // Always handle store failure — do NOT silently swallow; data loss risk
    try {
      // Convert GrapesJS component tree → our Widget schema
      const widgets = widgetsFromGrapesjs(gjsData.components)
      await api.updateSlide(options.courseId, options.slideId, { widgets })
    } catch (err) {
      console.error('GrapesJS storage save failed:', err)
      throw err  // let GrapesJS show "Save failed" notification to user
    }
  }
}
```

### Custom Block registration (one per widget type)
Each ToolBook object type = one GrapesJS Block + Component pair:

```typescript
// Example: Multiple Choice Question block
editor.BlockManager.add('question-mc', {
  label: 'Multiple Choice',
  category: 'Questions',
  media: '<svg>...</svg>',
  content: { type: 'question-mc' }
})

editor.Components.addType('question-mc', {
  model: {
    defaults: {
      tagName: 'div',
      attributes: { 'data-widget': 'question-mc' },
      questionText: 'Enter question text',
      options: [],
      correctIndex: 0,
      scoring: { weight: 100, attempts: -1 }
    }
  },
  view: {
    // Renders a live preview inside the GrapesJS canvas iframe
    onRender() { this.renderQuestionPreview() }
  }
})
```

### GrapesJS canvas is an iframe — implications
- The GrapesJS canvas renders HTML inside an `<iframe>`, not directly in the React DOM
- React components cannot run natively inside the canvas (no React context)
- Use GrapesJS's native component system for canvas rendering (not React)
- React is used only for panels OUTSIDE the canvas (sidebar, properties, toolbar)
- For Phaser sims: a placeholder div renders in the GrapesJS canvas; Phaser
  initializes in a separate panel/preview mode outside the canvas

### Slide canvas size configuration
ToolBook used a fixed page size (default 1024×768). Configure GrapesJS:

```typescript
editor = grapesjs.init({
  container: '#gjs',
  deviceManager: {
    devices: [{
      id: 'slide',
      name: 'Slide (1024×768)',
      width: '1024px',
      height: '768px',
    }]
  },
  canvas: {
    styles: ['body { margin: 0; overflow: hidden; }']
  }
})
```

---

## Phaser.js Integration — Critical Details

Phaser.js handles **advanced simulations** that go beyond Playwright screenshot replay.
It lives in `packages/phaser-simulations/` and is loaded lazily in the runtime player.

### Two distinct simulation types in eLearn Studio

| Type | Technology | ToolBook Equivalent | Use Case |
|---|---|---|---|
| **Screenshot Sim** | Playwright + Konva.js player | Sim AutoBuilder | Software UI walkthrough |
| **Phaser Sim** | Phaser.js 3 | No equivalent (extension) | Process flows, physics, gamification |

### Phaser simulation subtypes

| Subtype | Description | Example |
|---|---|---|
| `process-flow` | Animated node/arrow diagrams with steps | IT incident flow, HR onboarding process |
| `physics-demo` | Matter.js physics: collisions, springs, gravity | Science experiments, mechanical simulations |
| `gamified-quiz` | Quiz wrapped in game mechanics (timer, lives, combos) | Any topic with engagement boost |
| `concept-animator` | Step-by-step algorithm/data structure visualization | Sorting algorithms, network protocols |
| `interactive-diagram` | Labeled diagram with Phaser sprite hotspots | Anatomy, machinery, architecture |

### Phaser widget lifecycle in the runtime player

```typescript
// packages/runtime-player/src/widgets/phaser-sim-widget.ts
class PhaserSimWidget {
  private game: Phaser.Game | null = null

  async mount(container: HTMLElement, config: PhaserSimConfig) {
    // Phaser bundle loaded lazily (only when this widget is needed)
    const Phaser = await import('../phaser-bundle.js')
    this.game = new Phaser.Game({
      parent: container,
      width: config.width ?? 800,
      height: config.height ?? 500,
      physics: config.usePhysics ? { default: 'matter' } : false,
      scene: buildScene(config.sceneDef)
    })
    // Bridge: when sim completes, dispatch event for SCORM scoring
    this.game.events.on('sim-complete', (score: number) => {
      window.dispatchEvent(new CustomEvent('elearn:widgetScore', {
        detail: { widgetId: config.widgetId, score }
      }))
    })
  }

  destroy() {
    this.game?.destroy(true)
    this.game = null
  }
}
```

### Phaser Scene Definition format (JSON — authoring output)

```json
{
  "simType": "process-flow",
  "nodes": [
    { "id": "start", "x": 100, "y": 200, "label": "Ticket creado", "type": "start" },
    { "id": "triage", "x": 300, "y": 200, "label": "Triage L1", "type": "step" },
    { "id": "resolve", "x": 500, "y": 200, "label": "Resolver", "type": "decision" }
  ],
  "edges": [
    { "from": "start", "to": "triage" },
    { "from": "triage", "to": "resolve", "label": "urgente" }
  ],
  "interactionMode": "practice",
  "steps": [
    { "nodeId": "triage", "instruction": "¿Qué haces primero?", "correctAction": "click" }
  ]
}
```

### Bundle size strategy
- Phaser 3 minified: ~1MB. Too large to include in every course.
- Solution: the SCORM packager only copies `phaser-bundle.js` if the course
  contains at least one `phaser-sim` widget.
- In the runtime player: dynamic `import()` — cached after first load within session.

---

## Data Model

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

## Key Commands

```bash
# Install all dependencies
pnpm install

# Start all services in dev mode
pnpm dev

# Start backend infrastructure only
docker compose -f docker/docker-compose.dev.yml up -d

# Run all tests
pnpm test

# Build Phaser sim bundle (output: packages/phaser-simulations/dist/phaser-bundle.js)
pnpm --filter phaser-simulations run build

# Build SCORM package from CLI
pnpm --filter scorm-packager run build -- --courseId <id> --format scorm12

# Lint all packages
pnpm lint
```

---

## Critical Rules — DO NOT violate

1. **GrapesJS Storage Manager** — NEVER let GrapesJS save raw HTML. Always use the custom
   `elearn-api` Storage Manager that maps to our Course/Slide/Widget JSON schema.

2. **Phaser lazy loading** — NEVER bundle Phaser into the main runtime player JS.
   Always dynamic `import()`. The main player must stay under 150KB gzipped.

3. **Runtime player = Vanilla JS** — No React, no Vue, no Angular in `runtime-player/`.
   It runs inside LMS iframes; framework bundles cause conflicts and slow down loading.

4. **SCORM 1.2 first** — Every packager change must be tested against Moodle before merge.
   SCORM 2004 and xAPI are secondary targets.

5. **No localStorage in player** — SCORM suspend_data via `LMSSetValue` only.

6. **No binary data in MongoDB** — All assets (images, audio, screenshots, Phaser sprites)
   go to Garage. MongoDB stores only the JSON course structure and asset URLs.

7. **GrapesJS open-source only** — Use the `grapesjs` npm package (MIT license).
   Do NOT use GrapesJS Studio SDK (enterprise/paid product).

8. **Phaser MIT license** — Phaser 3 is MIT. Do not use Phaser Nano or any paid variants.

9. **Decisions** - When choosing between alternatives that affect more than today's task — a library, an architecture pattern, an API design, or deciding NOT to do something — log it:

    File: /decisions/YYYY-MM-DD-{topic}.md
    
    Format:
 
      ***## Decision: {what you decided}***

      ***## Context: {why this came up}***
 
      ***## Alternatives considered: {what else was on the table}***

      ***## Reasoning: {why this option won}***

      ***## Trade-offs accepted: {what you gave up}***
    
When about to make a similar decision, grep /decisions/ for prior choices. Follow them unless new information invalidates the reasoning.

---

## Licensing Notes

### Garage (AGPL-3.0)
Garage is licensed under AGPL-3.0. Key implications:

- **Self-hosted (Docker Compose) — no obligation:** When you run Garage as a separate
  service (as we do), the AGPL "network use = distribution" clause does NOT apply to
  eLearn Studio's own code. Our API communicates with Garage over HTTP; this does not
  create a combined work.
- **If you embed or statically link Garage** — you would need to open-source the combined
  work under AGPL. We do not do this.
- **Distributing the Docker image** — if you publish a Docker image that includes Garage,
  you must make Garage's source available (Garage already satisfies this itself).
- **eLearn Studio's own license is independent** — Garage being AGPL does not force
  eLearn Studio to be AGPL.

**Summary for development:** Using Garage as a Docker service carries no licensing
obligations for eLearn Studio code. This is the same model used by projects that run
PostgreSQL or Redis alongside their application.

### GrapesJS (MIT) and Phaser (MIT)
No restrictions. Use freely.
