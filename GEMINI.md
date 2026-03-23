# eLearn Studio — Gemini Instructions

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
    const course = await api.getCourse(options.courseId)
    // Convert our Course schema → GrapesJS component tree
    return grapesjsFromSlide(course.slides.find(s => s.id === options.slideId))
  },

  async store(gjsData: GrapesJsData, options: { courseId: string; slideId: string }) {
    // Convert GrapesJS component tree → our Widget schema
    const widgets = widgetsFromGrapesjs(gjsData.components)
    await api.updateSlide(options.courseId, options.slideId, { widgets })
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

## Observability Stack — Critical Details

The observability stack is a **mandatory first-class development tool**, not an
optional production-monitoring add-on. It runs in `docker-compose.dev.yml` alongside
the authoring stack and is used actively during feature development to:

- **Explore distributed traces** — see the full request path (Express → Mongoose →
  Garage) broken down by span in Grafana Tempo
- **Detect API bottlenecks** — identify slow spans before they reach production by
  inspecting P95 latency per endpoint during local development
- **Correlate logs ↔ traces** — every Pino log line carries a `traceId`; clicking it
  in Grafana Loki jumps directly to the matching Tempo trace

### Stack components

| Service | Image | Role |
|---|---|---|
| **OTel Collector** | `otel/opentelemetry-collector-contrib` | Single ingestion point; fans out traces to Tempo, metrics to Prometheus |
| **Tempo** | `grafana/tempo` | Distributed trace storage; queryable via TraceQL in Grafana Explore |
| **Prometheus** | `prom/prometheus` | Scrapes OTel Collector (app metrics), cAdvisor (container), docker-exporter |
| **Loki** | `grafana/loki` | Log aggregation from all containers via Promtail |
| **Promtail** | `grafana/promtail` | Scrapes Docker container stdout/stderr → forwards to Loki |
| **Grafana** | `grafana/grafana` | Dashboards + Explore UI; port 3001 |

### Instrumentation in the API

The backend API (`backend/api`) uses `@opentelemetry/sdk-node` with auto-instrumentation:
- HTTP spans: every Express request gets a span with method, route, status code
- MongoDB spans: every Mongoose query is a child span showing collection + operation
- Garage spans: S3 client calls appear as child spans with bucket + key
- All spans carry `traceId` injected by the OTel SDK; Pino picks it up via
  `@opentelemetry/api` so every log line includes the same `traceId`

### Development workflow

```bash
# Start the full dev stack including observability
docker compose -f docker/docker-compose.dev.yml up -d

# Open Grafana
open http://localhost:3001   # admin / admin

# Explore traces: Grafana → Explore → Tempo
# Explore logs:   Grafana → Explore → Loki → {job="api"}
# Dashboards:     elearn-overview (latency/errors), elearn-containers (resources)

# Verify OTel pipeline is healthy
curl http://localhost:13133/   # OTel Collector health endpoint
```

### Trace exploration example

After calling `POST /api/courses`, open Grafana Explore → Tempo and search for
`{ .http.route = "/api/courses" }`. The resulting trace shows:
- Total handler time
- Mongoose `insertOne` span (child)
- Any Garage calls for default assets (grandchild spans)

Wide spans indicate bottlenecks. Clicking the `traceId` in Loki log view jumps
directly to the matching Tempo trace.

### Configuration files

```
docker/observability/
├── otel-collector-config.yaml   # Receivers: OTLP 4317/4318; exporters: Tempo, Prometheus
├── prometheus.yml               # Scrape targets + metric_relabel_configs
├── tempo.yaml                   # Storage backend, retention (24h dev default)
├── promtail-config.yaml         # Docker log scraping pipeline
└── grafana/
    ├── datasources/             # Auto-provisioned: Prometheus, Loki, Tempo
    ├── dashboards/              # elearn-overview.json, elearn-containers.json
    └── alerting/                # alert-rules.yaml (visualization-only in dev)
```

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
