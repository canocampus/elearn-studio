# eLearn Studio — Developer Guide

This guide covers setting up the development environment, understanding the monorepo structure, extending widget types, adding Phaser simulation types, and running tests.

---

## Prerequisites

- **Docker Desktop** (Engine ≥ 24) — for MongoDB, Garage S3, observability stack
- **Node.js** ≥ 20 LTS — JavaScript/TypeScript runtime
- **pnpm** ≥ 9 — monorepo package manager
- **Git** — version control

Install pnpm globally:

```bash
npm install -g pnpm
```

---

## Monorepo Structure

```
elearn-studio/
├── packages/
│   ├── authoring-ui/          # React 18 + Vite + GrapesJS
│   │   ├── src/
│   │   │   ├── components/    # React components
│   │   │   ├── grapesjs/      # GrapesJS blocks, storage manager, plugins
│   │   │   ├── lib/           # Utilities, API client
│   │   │   └── App.tsx
│   │   └── vite.config.ts
│   ├── runtime-player/        # Vanilla JS + HTML5
│   │   ├── src/
│   │   │   ├── widgets/       # Widget runtime classes
│   │   │   ├── player.ts      # Main entry point
│   │   │   └── index.html
│   │   └── tsconfig.json
│   ├── question-engine/       # Pure TypeScript library
│   │   ├── src/
│   │   │   ├── scoring.ts     # Score calculation
│   │   │   ├── evaluation.ts  # Answer evaluation
│   │   │   └── types.ts
│   │   └── package.json
│   ├── actions-editor/        # React component library
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── types.ts
│   │   │   └── index.ts
│   │   └── package.json
│   ├── scorm-packager/        # SCORM ZIP generation
│   │   ├── src/
│   │   │   ├── scorm12.ts
│   │   │   ├── scorm2004.ts
│   │   │   └── manifest.ts
│   │   └── package.json
│   ├── simulation-engine/     # Playwright + screenshot playback
│   │   ├── src/
│   │   │   ├── recorder.ts
│   │   │   ├── player.ts
│   │   │   └── types.ts
│   │   └── package.json
│   └── phaser-simulations/    # Phaser.js scene classes
│       ├── src/
│       │   ├── scenes/        # Scene implementations
│       │   ├── types.ts       # SceneDef interfaces
│       │   └── index.ts
│       └── package.json
├── backend/
│   ├── api/                   # Express REST API
│   │   ├── src/
│   │   │   ├── routes/        # Endpoint handlers
│   │   │   ├── models/        # Mongoose schemas
│   │   │   ├── middleware/    # Auth, logging, error handling
│   │   │   ├── lib/           # Utilities
│   │   │   ├── storage/       # S3 client (Garage)
│   │   │   └── index.ts
│   │   └── tsconfig.json
│   └── ... (other services)
├── docker/
│   ├── docker-compose.yml     # Production services
│   └── docker-compose.dev.yml # Dev services (MongoDB, Garage, observability)
└── docs/
    ├── authoring-guide.md
    ├── api-reference.md
    ├── developer-guide.md     # This file
    ├── ... (other guides)
```

---

## Setup and Installation

### 1. Clone and Install

```bash
git clone https://github.com/canocampus/elearn-studio.git
cd elearn-studio
pnpm install
```

### 2. Start Docker Services

Start MongoDB, Garage S3, and observability stack:

```bash
docker compose -f docker/docker-compose.dev.yml up -d
```

Verify services are healthy:

```bash
docker compose -f docker/docker-compose.dev.yml ps
docker compose -f docker/docker-compose.dev.yml logs mongo
```

### 3. Configure Environment

Copy the example environment file to create your local config:

```bash
cp docker/.env.example .env
```

**Reference:** See `docker/.env.example` for all available environment variables with documentation.

**Required variables** (must set before running):
```env
# API & Runtime
NODE_ENV=development
API_PORT=3001

# Database
MONGO_URL=mongodb://localhost:27017/elearn-studio
MONGO_SEED=true

# Storage (Garage S3)
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=elearn-studio
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin

# Authentication
JWT_SECRET=dev-secret-change-in-production
ALLOW_REGISTRATION=true
```

**Optional variables** (sensible defaults provided):
```env
# Assets
MAX_ASSET_SIZE_MB=50                                    # Default: 50 MB
ALLOWED_MIME_TYPES=image/jpeg,image/png,image/webp     # Default: common media types

# Observability
GRAFANA_PORT=3001                                       # Default: 3001
PROMETHEUS_PORT=9090                                    # Default: 9090
```

Detailed descriptions of each variable are in `docker/.env.example`.

### 4. Start Development Servers

```bash
# Start all packages in dev mode (hot-reload)
pnpm dev

# Or start individual packages
pnpm --filter authoring-ui dev
pnpm --filter runtime-player build --watch
pnpm --filter api dev
```

Open:

- Authoring UI: http://localhost:5173
- API: http://localhost:3000
- Grafana: http://localhost:3001

---

## Adding a New Widget Type

Widgets are the building blocks of courses. Follow this checklist to add a new widget type.

**Key file paths:**
- Widget type definition: `packages/authoring-ui/src/types/`
- GrapesJS block registration: `packages/authoring-ui/src/editor/registerBlocks.ts`
- Properties panel component: `packages/authoring-ui/src/components/sidebar/`
- Runtime widget class: `packages/runtime-player/src/widgets/`

### 1. Define Types (question-engine or shared types)

Add TypeScript interface in `packages/question-engine/src/types.ts` or create a new file:

```typescript
// packages/question-engine/src/widgets/my-widget.ts

export interface MyWidgetProperties {
  widgetId: string
  type: 'my-widget'
  title: string
  description: string
  config: {
    interactive: boolean
    showFeedback: boolean
  }
}

export interface MyWidgetState {
  completed: boolean
  userInput: string
  score: number
}
```

### 2. Create GrapesJS Block and Component

In `packages/authoring-ui/src/grapesjs/blocks/`:

```typescript
// packages/authoring-ui/src/grapesjs/blocks/my-widget-block.ts

export function registerMyWidgetBlock(editor: grapesjs.Editor) {
  // Register block in Block Manager
  editor.BlockManager.add('my-widget', {
    label: 'My Widget',
    category: 'Custom',
    media: '<svg>...</svg>', // Icon
    content: { type: 'my-widget' },
  })

  // Register component type
  editor.Components.addType('my-widget', {
    model: {
      defaults: {
        tagName: 'div',
        attributes: {
          'data-widget': 'my-widget',
        },
        title: 'My Widget',
        description: '',
        config: {
          interactive: true,
          showFeedback: true,
        },
      },
    },
    view: {
      onRender() {
        this.renderPreview()
      },
      renderPreview() {
        const el = this.el
        el.innerHTML = '<div class="widget-preview">My Widget</div>'
      },
    },
  })
}
```

Register in `packages/authoring-ui/src/grapesjs/index.ts`:

```typescript
import { registerMyWidgetBlock } from './blocks/my-widget-block'

export function initializeGrapesJS(editor: grapesjs.Editor) {
  registerMyWidgetBlock(editor)
  // ... register other blocks
}
```

### 3. Create Properties Panel Component

In `packages/authoring-ui/src/components/properties/`:

```typescript
// packages/authoring-ui/src/components/properties/MyWidgetProperties.tsx

import React from 'react'
import { MyWidgetProperties as MyWidgetProps } from '@elearn-studio/question-engine'

export function MyWidgetProperties({ widget }: { widget: MyWidgetProps }) {
  return (
    <div className="properties-panel">
      <div className="property-group">
        <label>Title</label>
        <input type="text" value={widget.title} onChange={(e) => {
          // Update widget and trigger GrapesJS save
        }} />
      </div>
      <div className="property-group">
        <label>Interactive</label>
        <input type="checkbox" checked={widget.config.interactive} />
      </div>
    </div>
  )
}
```

### 4. Create Runtime Widget Class

In `packages/runtime-player/src/widgets/`:

```typescript
// packages/runtime-player/src/widgets/my-widget.ts

export class MyWidget {
  private container: HTMLElement
  private config: MyWidgetProperties

  constructor(container: HTMLElement, config: MyWidgetProperties) {
    this.container = container
    this.config = config
  }

  mount() {
    this.container.innerHTML = `
      <div class="my-widget">
        <h3>${this.config.title}</h3>
        <p>${this.config.description}</p>
      </div>
    `
  }

  destroy() {
    this.container.innerHTML = ''
  }

  getScore(): number {
    // Return learner's score for this widget
    return 0
  }
}
```

Register in `packages/runtime-player/src/index.ts`:

```typescript
import { MyWidget } from './widgets/my-widget'

export const WIDGET_REGISTRY = {
  'my-widget': MyWidget,
  // ... other widgets
}
```

### 5. Storage Manager Mapping

Update the custom GrapesJS Storage Manager to convert to/from your widget schema:

```typescript
// packages/authoring-ui/src/grapesjs/storage-manager.ts

function widgetsFromGrapesjs(components: any[]): Widget[] {
  return components.map((comp) => {
    if (comp.type === 'my-widget') {
      return {
        widgetId: comp.attributes['data-id'],
        type: 'my-widget',
        title: comp.title,
        description: comp.description,
        config: comp.config,
      }
    }
    // ... handle other widget types
  })
}
```

### 6. Add Tests

Unit tests in `packages/question-engine/src/__tests__/my-widget.test.ts`:

```typescript
import { MyWidget } from '../widgets/my-widget'

describe('MyWidget', () => {
  it('should render with title', () => {
    const container = document.createElement('div')
    const widget = new MyWidget(container, { title: 'Test' })
    widget.mount()
    expect(container.textContent).toContain('Test')
  })
})
```

---

## Adding a New Phaser Simulation Type

Phaser simulations are advanced interactive simulations. Add a new type following this checklist:

### 1. Define SceneDef Interface

In `packages/phaser-simulations/src/types.ts`:

```typescript
export interface MySimSceneDef {
  simType: 'my-sim'
  // Add simulation-specific fields
  elements: Array<{
    id: string
    x: number
    y: number
    type: string
  }>
}

// Add to union type
export type SceneDef =
  | ProcessFlowSceneDef
  | InteractiveDiagramSceneDef
  | GamifiedQuizSceneDef
  | MySimSceneDef  // <- Add here
  // ...
```

### 2. Create Scene Class

In `packages/phaser-simulations/src/scenes/`:

```typescript
// packages/phaser-simulations/src/scenes/MySim.ts

import Phaser from 'phaser'
import { MySimSceneDef } from '../types'

export class MySimScene extends Phaser.Scene {
  private sceneDef: MySimSceneDef
  private score: number = 0

  constructor(sceneDef: MySimSceneDef) {
    super({ key: 'MySim' })
    this.sceneDef = sceneDef
  }

  create() {
    // Initialize scene
    this.sceneDef.elements.forEach((el) => {
      const sprite = this.add.sprite(el.x, el.y, el.type)
      sprite.setInteractive()
      sprite.on('pointerdown', () => this.onElementClick(el.id))
    })
  }

  onElementClick(elementId: string) {
    // Handle interaction
    this.score += 10
  }

  getScore(): number {
    return this.score
  }
}
```

### 3. Register Scene Builder

In `packages/phaser-simulations/src/index.ts`:

```typescript
import { MySimScene } from './scenes/MySim'

export function buildScene(sceneDef: SceneDef): Phaser.Scene {
  if (sceneDef.simType === 'my-sim') {
    return new MySimScene(sceneDef)
  }
  // ... handle other types
}
```

### 4. Update Widget Handler (runtime-player)

In `packages/runtime-player/src/widgets/phaser-sim-widget.ts`:

```typescript
async mount(container: HTMLElement, config: PhaserSimConfig) {
  const Phaser = await import('../phaser-bundle.js')
  const { buildScene } = await import('@elearn-studio/phaser-simulations')

  this.game = new Phaser.Game({
    parent: container,
    width: config.width ?? 800,
    height: config.height ?? 500,
    physics: false,
    scene: buildScene(config.sceneDef),
  })

  // Dispatch score event
  const scene = this.game.scene.getActive()
  this.game.events.on('update', () => {
    const score = scene.getScore()
    window.dispatchEvent(new CustomEvent('elearn:widgetScore', {
      detail: { widgetId: config.widgetId, score, passed: score >= config.passingScore },
    }))
  })
}
```

### 5. Test

In `packages/phaser-simulations/src/__tests__/my-sim.test.ts`:

```typescript
import Phaser from 'phaser'
import { MySimScene } from '../scenes/MySim'

describe('MySimScene', () => {
  it('should initialize with elements', () => {
    const game = new Phaser.Game({
      type: Phaser.HEADLESS,
      scene: new MySimScene({ simType: 'my-sim', elements: [] }),
    })
    expect(game).toBeDefined()
    game.destroy()
  })
})
```

---

## Running Tests

### Run All Tests

```bash
pnpm test
```

### Run Tests for a Package

```bash
pnpm --filter question-engine test
pnpm --filter authoring-ui test
pnpm --filter runtime-player test
```

### Watch Mode

```bash
pnpm test -- --watch
```

### Test Coverage

```bash
pnpm test -- --coverage
```

Target: **80%+ coverage** across all packages.

---

## Building

### Build All Packages

```bash
pnpm build
```

### Build Specific Package

```bash
pnpm --filter runtime-player build
pnpm --filter scorm-packager build
```

### Build Phaser Bundle

The Phaser bundle is built and included in the packager:

```bash
pnpm --filter phaser-simulations build
# Output: packages/phaser-simulations/dist/phaser-bundle.js (~1MB minified)
```

---

## Debugging

### Browser DevTools

1. Open http://localhost:5173 (authoring UI)
2. Press F12 to open DevTools
3. Console logs from GrapesJS and React appear here
4. Use the Redux DevTools extension (if installed) to inspect Zustand state

### Backend Logs

```bash
# View Docker logs
docker compose -f docker/docker-compose.dev.yml logs api

# Follow logs
docker compose -f docker/docker-compose.dev.yml logs -f api
```

### Database

Access MongoDB directly:

```bash
docker exec -it elearn-mongo mongosh elearn-studio
db.courses.find()
```

### S3 Storage (Garage)

Garage admin dashboard: http://localhost:3902

- Bucket: `elearn-studio`
- Access key: `minioadmin`
- Secret key: `minioadmin`

---

## Environment Variables

**Development defaults** (in `.env.example`):

- `API_PORT=3000`
- `NODE_ENV=development`
- `MONGO_URL=mongodb://localhost:27017/elearn-studio`
- `S3_ENDPOINT=http://localhost:9000`
- `S3_BUCKET=elearn-studio`
- `JWT_SECRET=dev-secret-change-in-production`
- `ALLOW_REGISTRATION=true`
- `MAX_ASSET_SIZE_MB=50`

**Important for Docker**: If running inside Docker, use service names:

```env
MONGO_URL=mongodb://mongo:27017/elearn-studio
S3_ENDPOINT=http://garage:9000
```

---

## Docker Compose Services (Dev)

| Service | Port | Purpose |
|---------|------|---------|
| mongo | 27017 | MongoDB database |
| garage | 9000 | S3-compatible object storage |
| garage-init | — | One-time bucket setup |
| prometheus | 9090 | Metrics collection |
| grafana | 3001 | Observability dashboard |
| jaeger | 16686 | Distributed tracing |

---

## Common Tasks

### Reset Database

```bash
docker compose -f docker/docker-compose.dev.yml down -v
docker compose -f docker/docker-compose.dev.yml up -d
pnpm dev
```

### Clear Node Modules and Reinstall

```bash
rm -rf node_modules
pnpm install
```

### Check TypeScript Errors

```bash
pnpm type-check
```

### Lint All Code

```bash
pnpm lint
```

### Format Code

```bash
pnpm format
```

---

## Contributing

Follow these steps before committing:

1. Run tests: `pnpm test`
2. Check types: `pnpm type-check`
3. Lint code: `pnpm lint`
4. Format code: `pnpm format`
5. Create descriptive commit message (conventional commits)

See [contributing-guide.md](contributing-guide.md) for detailed guidelines.

---

## Troubleshooting

### Port Already in Use

If port 3000 is in use:

```bash
lsof -i :3000
kill -9 <PID>
```

Or change API port in `.env`:

```env
API_PORT=3001
```

### MongoDB Connection Error

```bash
docker compose -f docker/docker-compose.dev.yml logs mongo
docker compose -f docker/docker-compose.dev.yml restart mongo
```

### S3 (Garage) Connection Error

```bash
docker compose -f docker/docker-compose.dev.yml logs garage
# Ensure S3_ENDPOINT is http://garage:9000 inside Docker, http://localhost:9000 locally
```

### Hot-reload Not Working

Restart the dev server:

```bash
pnpm dev
```

---

## Resources

- [CLAUDE.md](../CLAUDE.md) — Architecture overview and critical rules
- [API Reference](api-reference.md) — REST API documentation
- [Authoring Guide](authoring-guide.md) — User-facing course authoring
- [Simulation Guide](simulation-guide.md) — Simulation types and sceneDef formats
