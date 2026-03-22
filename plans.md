# eLearn Studio — Development Plans

## Vision

Recreate and surpass ToolBook 11.5 as a fully open-source, web-based authoring platform.
The platform must produce SCORM/AICC packages that run in Moodle, with first-class
screenshot simulations (ToolBook parity), Phaser.js advanced simulations (new capability),
and a no-code visual programming interface (Actions Editor).

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                       AUTHORING UI                               │
│                                                                  │
│  GrapesJS (slide canvas + drag & drop editor)                    │
│  ├── Custom Storage Manager → Course/Slide/Widget JSON           │
│  ├── Custom Blocks per widget type (MC, Button, SimStep…)        │
│  ├── Asset Manager → Garage (via backend API)                    │
│  └── Layer Manager, Style Manager, Block Manager                 │
│                                                                  │
│  Konva.js (embedded inside Simulation Editor widget)             │
│  └── Hotspot drawing tool over Playwright screenshots            │
│                                                                  │
│  Phaser.js Builder (embedded inside Phaser Sim widget)           │
│  └── Node/edge editor, interactive diagram builder               │
│                                                                  │
│  Actions Editor (custom React component, outside GrapesJS canvas)│
│  └── Event → Action sequence visual builder                      │
└───────────────────────────┬──────────────────────────────────────┘
                            │  REST API  (Course JSON)
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                    BACKEND API (Node.js)                          │
│  MongoDB (course JSON) | Garage (assets) | Playwright (recording) │
└───────────────────────────┬──────────────────────────────────────┘
                            │  scorm-packager
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                    SCORM / AICC ZIP                               │
│  imsmanifest.xml | runtime-player.js | assets/ | phaser-bundle.js│
└───────────────────────────┬──────────────────────────────────────┘
                            │  Upload to Moodle
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                RUNTIME PLAYER (Vanilla JS)                        │
│  < 150KB gzipped (excluding Phaser)                              │
│  ├── Renders all widget types from course JSON                   │
│  ├── Executes Actions Engine (navigate, show/hide, score…)       │
│  ├── Screenshot Sim player (3 modes)                             │
│  ├── Phaser Sim player (lazy import, ~1MB, cached)               │
│  └── SCORM 1.2 bridge → LMS score reporting                      │
└──────────────────────────────────────────────────────────────────┘
```

---

## Phase 0 — Foundation (Weeks 1–2)

**Goal:** Docker stack running, monorepo bootstrapped, basic API operational.

### Monorepo structure (pnpm workspaces)

```
elearn-studio/
├── packages/
│   ├── authoring-ui/           # React 18 + Vite + GrapesJS
│   ├── simulation-engine/      # Node.js + Playwright
│   ├── question-engine/        # Pure TypeScript (no DOM)
│   ├── actions-editor/         # React component
│   ├── scorm-packager/         # Node.js CLI + library
│   ├── runtime-player/         # Vanilla JS (Rollup bundle)
│   └── phaser-simulations/     # Phaser.js 3 sim library
├── backend/
│   ├── api/                    # Express 5 + TypeScript
│   ├── models/                 # Mongoose schemas
│   └── storage/                # Garage S3 client (@aws-sdk/client-s3)
└── docker/
```

### Docker Compose (Phase 0)

```yaml
services:
  api:
    build: ./backend/api
    ports: ["3001:3001"]
    environment:
      - MONGO_URI=mongodb://mongo:27017/elearn
      - GARAGE_ENDPOINT=garage
      - GARAGE_PORT=3900
    depends_on:
      garage-init:
        condition: service_completed_successfully

  authoring-ui:
    build: ./packages/authoring-ui
    ports: ["3000:3000"]

  mongo:
    image: mongo:7
    volumes: [mongo_data:/data/db]
    ports: ["27017:27017"]

  garage:
    image: dxflrs/garage:v1.0.0
    volumes:
      - ./garage.toml:/etc/garage.toml:ro
      - garage_meta:/var/lib/garage/meta
      - garage_data:/var/lib/garage/data
    ports: ["3900:3900", "3903:3903"]

  garage-init:
    image: alpine:3.19
    command: /scripts/garage-init.sh
    depends_on:
      garage:
        condition: service_healthy
    restart: "no"

  moodle:
    image: bitnamilegacy/moodle:latest
    ports: ["8081:8080"]
    depends_on: [moodle-db]

  moodle-db:
    image: postgres:16
    environment:
      POSTGRES_DB: moodle
      POSTGRES_USER: moodle
      POSTGRES_PASSWORD: moodle_pass
    volumes: [moodle_data:/var/lib/postgresql/data]

volumes:
  mongo_data:
  garage_meta:
  garage_data:
  moodle_data:
```

---

## Phase 1 — Core Editor with GrapesJS (Weeks 3–8)

**Goal:** Author a simple linear course using GrapesJS. Publish as SCORM 1.2. Run in Moodle.

### GrapesJS setup

Install packages:
```bash
pnpm add grapesjs @grapesjs/react
```

Initialize editor with custom configuration for fixed-size slides:
```typescript
// packages/authoring-ui/src/editor/EditorInit.ts
import grapesjs from 'grapesjs'

export function initEditor(container: HTMLElement, courseId: string, slideId: string) {
  const editor = grapesjs.init({
    container,
    fromElement: false,
    storageManager: {
      type: 'elearn-api',           // custom storage (see CLAUDE.md)
      options: { courseId, slideId }
    },
    deviceManager: {
      devices: [{
        id: 'slide',
        name: 'Slide 1024×768',
        width: '1024px',
      }]
    },
    panels: { defaults: [] },       // we build custom panels in React
    blockManager: {
      appendTo: '#block-manager-container'
    },
    layerManager: {
      appendTo: '#layer-manager-container'
    },
    styleManager: {
      appendTo: '#style-manager-container'
    },
    canvas: {
      styles: ['body { margin: 0; background: white; overflow: hidden; }']
    }
  })

  registerBlocks(editor)            // register all widget types as GrapesJS blocks
  registerComponents(editor)        // register all widget types as GrapesJS components
  registerStorageManager(editor)    // register custom elearn-api storage
  registerAssetManager(editor)      // connect to Garage via backend API

  return editor
}
```

### Custom Storage Manager implementation
This is the most critical Phase 1 piece. The bidirectional conversion:
- **GrapesJS → our schema:** Extract component tree from GrapesJS, map each
  component type to a Widget, preserve bounds/layer/properties
- **Our schema → GrapesJS:** Build GrapesJS component JSON from our Widget array

```typescript
// packages/authoring-ui/src/grapesjs/converters.ts

export function widgetsFromGrapesjs(components: GjsComponent[]): Widget[] {
  return components.map(c => ({
    id: c.getId(),
    type: c.get('type'),
    bounds: {
      x: parseInt(c.getStyle()['left'] ?? '0'),
      y: parseInt(c.getStyle()['top'] ?? '0'),
      width: parseInt(c.getStyle()['width'] ?? '100'),
      height: parseInt(c.getStyle()['height'] ?? '50'),
    },
    layer: c.get('layer') ?? 0,
    visible: c.get('visible') ?? true,
    properties: c.get('properties') ?? {},
    actions: c.get('actions') ?? [],
    extendedProperties: c.get('extendedProperties') ?? {}
  }))
}

export function grapesjsFromWidgets(widgets: Widget[]): GjsComponentDef[] {
  return widgets.map(w => ({
    type: w.type,
    style: {
      position: 'absolute',
      left: `${w.bounds.x}px`,
      top: `${w.bounds.y}px`,
      width: `${w.bounds.width}px`,
      height: `${w.bounds.height}px`,
    },
    attributes: { id: w.id },
    layer: w.layer,
    visible: w.visible,
    properties: w.properties,
    actions: w.actions,
    extendedProperties: w.extendedProperties
  }))
}
```

### SCORM 1.2 Packager (Phase 1 minimal)

Required SCORM 1.2 API calls for minimal compliance:
```javascript
// On load:
LMSInitialize("")
LMSGetValue("cmi.core.student_name")
LMSGetValue("cmi.core.lesson_status")

// On completion:
LMSSetValue("cmi.core.score.raw", score)
LMSSetValue("cmi.core.score.min", "0")
LMSSetValue("cmi.core.score.max", "100")
LMSSetValue("cmi.core.lesson_status", score >= passingScore ? "passed" : "failed")
LMSCommit("")
LMSFinish("")
```

---

## Phase 2 — Interactivity + Screenshot Simulations (Weeks 9–16)

**Goal:** Full Actions Editor. Screenshot sims. AICC support. Suspend/resume.

### Actions Editor architecture

The Actions Editor opens as a right panel in the authoring UI when clicking
the "Actions" button on any selected object (GrapesJS fires an event we intercept).

```
ActionsEditorPanel (React, outside GrapesJS canvas)
├── EventSelector — dropdown (context-aware per widget type)
├── ActionSequenceList
│   ├── ActionItem (draggable, inline-editable params as hotspot links)
│   │   └── ChildrenList (indented, for if/else and loops)
│   └── AddActionButton
├── ActionsPalette (categorized: Navigation, Object, Media, Scoring, Flow)
└── VariablesPanel (local + global variable definitions)
```

ActionSequence JSON format — stored in Widget.actions[]:
```json
{
  "event": "onClick",
  "actions": [
    {
      "id": "a1",
      "type": "condition",
      "params": { "expression": "var.score >= 70" },
      "children": [
        { "id": "a2", "type": "navigate", "params": { "target": "slide_pass" } }
      ],
      "elseChildren": [
        { "id": "a3", "type": "navigate", "params": { "target": "slide_fail" } }
      ]
    }
  ]
}
```

### Screenshot Simulation — Playwright recorder

```
SimulationRecorder service (packages/simulation-engine)
├── POST /recorder/start        → launch Chromium, open target URL
├── POST /recorder/capture      → screenshot + current DOM events
├── POST /recorder/stop         → finalize, save session JSON + images to Garage
└── GET  /recorder/sessions/:id → retrieve session for import
```

Recording session format:
```json
{
  "id": "rec_001",
  "targetUrl": "https://app.example.com",
  "steps": [
    {
      "index": 0,
      "screenshotUrl": "/assets/sims/rec_001/step_000.png",
      "event": null,
      "description": "Initial state"
    },
    {
      "index": 1,
      "screenshotUrl": "/assets/sims/rec_001/step_001.png",
      "event": {
        "type": "click",
        "button": "left",
        "target": { "selector": "#btn-save", "text": "Save", "rect": {"x":450,"y":120,"w":80,"h":32} },
        "coordinates": { "x": 490, "y": 136 }
      }
    }
  ]
}
```

### Simulation Editor (Konva.js for hotspot drawing)

The Simulation Editor uses Konva.js embedded in a widget panel (not in GrapesJS canvas):
- Renders the step screenshot as Konva `Image`
- Overlays a draggable/resizable `Rect` as the target hotspot
- Rect coordinates saved as `step.expectedAction.targetRect`
- Konva chosen here (not GrapesJS) because we need pixel-precise canvas
  control over screenshot images, not HTML layout management

---

## Phase 3 — Phaser.js Advanced Simulations (Weeks 17–24)

**Goal:** Process Flow + Interactive Diagram simulations working end-to-end in Moodle.

### Why Phaser.js for this

GrapesJS and Konva.js are excellent for their roles but don't cover:
- **Animated state machines** (process flows with animated transitions)
- **Physics-based interactions** (Matter.js built into Phaser)
- **Game mechanics** (timers, lives, score combos for gamification)
- **High-performance sprite rendering** (WebGL with Canvas fallback)
- **Scene management** (multiple states/screens within one simulation)

Phaser 3 (MIT, 36K GitHub stars, active since 2018) is the leading HTML5
2D game framework and covers all of these naturally.

### Phaser simulation package structure

```
packages/phaser-simulations/
├── src/
│   ├── index.ts               # exports PhaserSimWidget + all scene types
│   ├── PhaserSimWidget.ts     # lifecycle: init/mount/destroy + SCORM bridge
│   ├── scenes/
│   │   ├── ProcessFlowScene.ts
│   │   ├── InteractiveDiagramScene.ts
│   │   ├── GamifiedQuizScene.ts
│   │   ├── PhysicsDemoScene.ts
│   │   └── ConceptAnimatorScene.ts
│   ├── builders/
│   │   ├── ProcessFlowBuilder.ts  # authoring-side scene definition builder
│   │   └── DiagramBuilder.ts
│   └── shared/
│       ├── ScoreTracker.ts    # accumulates score, dispatches elearn:widgetScore
│       └── ModeController.ts  # demo/practice/assessment mode logic
├── dist/
│   └── phaser-bundle.js       # Rollup output: Phaser + our scenes, ~1.1MB
└── package.json
```

### Process Flow Scene — authoring JSON format

```json
{
  "simType": "process-flow",
  "title": "Proceso de resolución de incidencias",
  "mode": "practice",
  "passingScore": 70,
  "nodes": [
    { "id": "n1", "x": 100, "y": 200, "label": "Ticket recibido", "type": "start", "color": "#4CAF50" },
    { "id": "n2", "x": 300, "y": 200, "label": "Clasificar prioridad", "type": "decision", "color": "#2196F3" },
    { "id": "n3", "x": 500, "y": 100, "label": "Urgente → L2", "type": "step", "color": "#FF9800" },
    { "id": "n4", "x": 500, "y": 300, "label": "Normal → L1", "type": "step", "color": "#9C27B0" },
    { "id": "n5", "x": 700, "y": 200, "label": "Resolver", "type": "end", "color": "#F44336" }
  ],
  "edges": [
    { "from": "n1", "to": "n2" },
    { "from": "n2", "to": "n3", "label": "Prioridad alta" },
    { "from": "n2", "to": "n4", "label": "Prioridad normal" },
    { "from": "n3", "to": "n5" },
    { "from": "n4", "to": "n5" }
  ],
  "steps": [
    {
      "nodeId": "n2",
      "instruction": "¿Qué nodo representa la decisión de prioridad?",
      "expectedAction": "click",
      "hintText": "Busca el nodo con forma de rombo",
      "feedbackCorrect": "¡Correcto! Los nodos de decisión tienen forma de rombo.",
      "feedbackIncorrect": "Incorrecto. Los nodos de acción son rectangulares."
    }
  ]
}
```

### Phaser bundle lazy loading in runtime-player

```javascript
// packages/runtime-player/src/player.js
const phaserModuleCache = null

async function initPhaserWidget(container, config) {
  if (!phaserModuleCache) {
    // Dynamic import — Phaser (~1MB) only loads when needed
    // After first load, browser caches it for the session
    phaserModuleCache = await import('./phaser-bundle.js')
  }
  const widget = new phaserModuleCache.PhaserSimWidget()
  widget.mount(container, config)

  // Listen for completion score
  window.addEventListener('elearn:widgetScore', (e) => {
    if (e.detail.widgetId === config.widgetId) {
      scoreEngine.registerWidgetScore(config.widgetId, e.detail.score)
    }
  })
  return widget
}
```

### SCORM package with Phaser sim

The `scorm-packager` detects Phaser sims and conditionally includes the bundle:

```typescript
// packages/scorm-packager/src/index.ts
export async function packSCORM12(course: Course, outputDir: string) {
  const hasPhaserSim = course.slides.some(s =>
    s.widgets.some(w => w.type === 'phaser-sim')
  )

  await generateManifest(course, outputDir)
  await copyRuntimePlayer(outputDir)
  await copyAssets(course, outputDir)

  if (hasPhaserSim) {
    await copyPhaserBundle(outputDir)   // adds ~1.1MB to package
  }

  await createZip(outputDir)
}
```

---

## Phase 4 — Polish & Production (Weeks 25–32)

**Goal:** Accessible, performance-tested, fully documented, production-ready.

### Performance targets
- Runtime player main bundle: < 150KB gzipped
- Phaser bundle: ~1.1MB (loaded only when needed, browser-cached)
- Player first paint (simple course): < 2s on 3G
- Authoring UI initial load: < 4s
- GrapesJS editor slide switch: < 200ms

### Accessibility targets
- WCAG 2.1 AA for the runtime player
- All question types keyboard-operable
- ARIA live regions for question feedback
- Screen reader compatibility (test with NVDA + Firefox)

### Production Docker additions
- Nginx reverse proxy with SSL termination
- Rate limiting on API endpoints
- Asset upload validation (type + size checks)
- MongoDB backup to Garage nightly

---

## Technology Decision Log

| Decision | Chosen | Rejected | Reason |
|---|---|---|---|
| **Slide editor** | **GrapesJS** | Konva.js DIY | Saves ~2 months; drag & drop, layers, undo/redo built-in |
| **Advanced sims** | **Phaser.js 3** | Three.js, PixiJS, DIY Canvas | Game scene management + physics + MIT license + 36K stars |
| **Hotspot editor** | Konva.js | GrapesJS canvas | Need pixel-precise canvas control over screenshots; GrapesJS is DOM/HTML based |
| **Runtime player** | Vanilla JS | React | Size + LMS iframe compatibility; no framework conflicts |
| **Phaser loading** | Dynamic import | Bundle with player | Phaser is 1MB; shouldn't load for text-only courses |
| **DB** | MongoDB | PostgreSQL | Deeply nested JSON course structure; document model fits naturally |
| **Object storage** | **Garage** | garage | garage OSS discontinued for self-hosted use (AGPL removed from latest releases); Garage is AGPL, Rust, actively maintained, true S3-compatible single-node |
| **Storage SDK** | `@aws-sdk/client-s3` | `garage` npm package | Standard AWS SDK works with any S3-compatible backend; `forcePathStyle: true` for Garage |
| **Recording** | Playwright | Puppeteer | Better CDP support, TypeScript-first, actively maintained |
| **SCORM wrapper** | pipwerks + scorm-again | Custom | Battle-tested for SCORM 1.2 + 2004 |
| **Monorepo** | pnpm workspaces | Nx, Turborepo | Simpler; sufficient for this project size |

---

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| GrapesJS canvas iframe creates component isolation issues | High | Medium | Use GrapesJS native component system; React only outside canvas |
| Phaser bundle size causes LMS timeout on SCORM load | Medium | Low | Lazy load; only include in SCORM package when needed |
| Playwright recorder blocked by CSP on target site | High | Medium | Provide manual sim building as fallback (F07.17+) |
| GrapesJS↔Course JSON conversion loses data | High | Medium | Comprehensive unit tests; versioned schema |
| SCORM 1.2 suspend_data 4096 char limit exceeded | Medium | Medium | LZ-string compress state before writing |
| Phaser 3 → 4 breaking changes during project | Low | Medium | Abstract Phaser behind PhaserSimWidget interface |
| Moodle AICC support deprecated | Low | Low | SCORM 1.2 is primary; AICC is P1 |
