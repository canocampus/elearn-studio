# eLearn Studio — Claude Code Instructions

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
