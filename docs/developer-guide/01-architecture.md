# Architecture

Covers the monorepo package structure, data model, and runtime widget rendering pipeline.

---

## Package Dependency Graph

```mermaid
graph LR
  classDef frontend fill:#3B82F6,color:#fff
  classDef backend fill:#10B981,color:#fff
  classDef storage fill:#F59E0B,color:#fff
  classDef shared fill:#8B5CF6,color:#fff

  AUI[authoring-ui]:::frontend
  AE[actions-editor]:::frontend
  SE[simulation-engine]:::frontend
  PS[phaser-simulations]:::shared
  QE[question-engine]:::shared
  SP[scorm-packager]:::shared
  RP[runtime-player]:::shared
  API[backend/api]:::backend

  AUI -->|imports| AE
  AUI -->|imports| QE
  AUI -->|REST| API
  SE -->|REST| API
  API -->|imports| SP
  RP -->|lazy import| PS
  RP -->|imports| QE
```

**Package responsibilities:**

| Package | Build output | Key dependency |
|---|---|---|
| `authoring-ui` | Vite SPA bundle | GrapesJS, Zustand, TipTap |
| `actions-editor` | React component library | Zustand |
| `simulation-engine` | Express sub-router + Playwright runner | CDP, Playwright |
| `question-engine` | TypeScript ESM library | — |
| `scorm-packager` | TypeScript ESM library | archiver, scorm-again |
| `runtime-player` | Vanilla JS IIFE bundle | scorm-again, pipwerks |
| `phaser-simulations` | IIFE bundle (`phaser-bundle.js`) | Phaser.js 3 |
| `backend/api` | Node.js app | Express 5, Mongoose, AWS SDK |

---

## Data Model (ER)

```mermaid
erDiagram
  Course {
    ObjectId _id PK
    string title
    CourseSettings settings
    SCORMMetadata metadata
    Date createdAt
    Date updatedAt
  }
  Slide {
    string id PK
    string title
    string templateId FK
    TransitionEffect transition
  }
  Widget {
    string id PK
    string type
    Bounds bounds
    number layer
    boolean visible
    object extendedProperties
  }
  ActionSequence {
    string id PK
    string trigger
    ActionStep[] steps
  }
  SlideTemplate {
    string id PK
    string name
    Widget[] widgets
  }
  Resource {
    string id PK
    string url
    string mimeType
  }

  Course ||--o{ Slide : "slides[]"
  Course ||--o{ SlideTemplate : "templates[]"
  Course ||--o{ Resource : "resources[]"
  Slide ||--o{ Widget : "widgets[]"
  Slide ||--o{ ActionSequence : "actions[]"
  Widget ||--o{ ActionSequence : "actions[]"
```

**Widget type discriminated union** (key types):

```typescript
type Widget =
  | TextWidget
  | ImageWidget
  | ButtonWidget          // type: 'button' | 'done-button'
  | ShapeWidget
  | QuestionWidget        // type: 'question-mc' | 'question-tf' | 'question-fill' | ...
  | MediaWidget           // type: 'media-player'
  | AudioNarrationWidget  // type: 'audio-narration'
  | ProgressBarWidget     // type: 'progress-bar'
  | VolumeControlWidget   // type: 'volume-control'
  | NavigationWidget      // type: 'nav-buttons'
  | ScoreWidget
  | ScreenshotSimWidget   // type: 'screenshot-sim'
  | PhaserSimWidget       // type: 'phaser-sim'

interface BaseWidget {
  id: string
  type: string
  bounds: { x: number; y: number; width: number; height: number }
  layer: number
  visible: boolean
  actions: ActionSequence[]
  extendedProperties: Record<string, unknown>
}
```

**ActionSequence DSL:**

```typescript
interface ActionSequence {
  id: string
  trigger: 'click' | 'load' | 'complete' | 'score-pass' | 'score-fail' | string
  steps: ActionStep[]
}

type ActionStep =
  | { action: 'navigate'; target: 'next' | 'prev' | 'first' | 'last' | string }
  | { action: 'show'; widgetId: string }
  | { action: 'hide'; widgetId: string }
  | { action: 'set-variable'; name: string; value: unknown }
  | { action: 'branch-if'; condition: Condition; then: ActionStep[]; else?: ActionStep[] }
  | { action: 'submit-score'; score: number }
```

---

## Runtime Player Widget Rendering Pipeline

How a saved Course JSON becomes interactive HTML in the LMS iframe:

```mermaid
flowchart TD
  LMS[LMS loads iframe] --> INIT[runtime-player init]
  INIT --> SCORM[SCORM handshake\nLMSInitialize]
  SCORM --> LOAD[fetch Course JSON\nGET /courses/:id]
  LOAD --> RESUME[restore suspend_data\nLMSGetValue]
  RESUME --> RENDER[render current slide\nrenderSlide]
  RENDER --> WIDGET{widget type?}
  WIDGET -->|text/image/button| DOM[DOM renderer]
  WIDGET -->|question-*| QE[question-engine\nevaluator]
  WIDGET -->|screenshot-sim| SIM[sim player\nKonva canvas]
  WIDGET -->|phaser-sim| PH[lazy import\nphaser-bundle.js]
  DOM --> EVENTS[bind ActionSequences]
  QE --> EVENTS
  SIM --> EVENTS
  PH --> EVENTS
  EVENTS --> SCORE[aggregate score\nLMSSetValue]
```

**Key files in `packages/runtime-player/src/`:**

| File | Responsibility |
|---|---|
| `index.ts` | Entry point — SCORM init, slide navigation, `updateProgressBars()`, `applyVolumeToSlide()` |
| `widgets/phaserSimWidget.ts` | Mounts/unmounts `phaser-bundle.js` lazily per slide |
| `sim/` | Screenshot simulation player (Konva-based) |
| `questions/` | Delegates evaluation to `question-engine` |
| `actions/` | Executes Action Sequence DSL steps |
| `suspend.ts` | Serialises/deserialises progress (schema v:2 — includes `visitedSlides`) to SCORM suspend_data |

**GrapesJS Storage Manager flow (authoring side):**

```mermaid
flowchart LR
  GJS[GrapesJS canvas] -->|store event| SM[elearn-api\nStorageManager]
  SM -->|widgetsFromGrapesjs| CONV[JSON converter]
  CONV -->|PUT /courses/:id| API[backend/api]
  API -->|Mongoose| DB[(MongoDB)]
```

The Storage Manager in `packages/authoring-ui/src/editor/storageManager.ts` intercepts every GrapesJS save and converts the component tree to the Widget schema before sending to the API. Raw HTML is never persisted.
