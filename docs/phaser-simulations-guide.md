# Phaser Simulations Guide

**Last Updated:** 2026-03-23
**Tasks Covered:** T030–T035

eLearn Studio's Phaser simulation system lets authors embed advanced interactive simulations — process flows, physics demos, gamified quizzes, concept animations, and interactive diagrams — directly into course slides. The system is built on Phaser.js 3 (MIT licence) and is designed for zero bundle impact on courses that don't use it.

---

## Architecture Overview

```
┌───────────────────────────────────────────────────────────────────┐
│ Authoring UI (authoring-ui)                                        │
│                                                                    │
│  GrapesJS Block: phaser-sim                                        │
│  ┌──────────────────────────────────────────────────────────┐     │
│  │ registerPhaserSimBlock.ts                                 │     │
│  │  • Registers block in "Simulations" category             │     │
│  │  • Canvas placeholder (dark div, game-controller icon)   │     │
│  │  • dblclick → PhaserSimPreviewModal                      │     │
│  └──────────────────────────────────────────────────────────┘     │
│                                                                    │
│  Right Sidebar → Props tab                                         │
│  ┌──────────────────────────────────────────────────────────┐     │
│  │ PhaserSimPropertiesPanel.tsx                              │     │
│  │  • simType, mode, passingScore, width, height            │     │
│  │  • sceneDef JSON editor with validation                  │     │
│  │  • Preview button → PhaserSimPreviewModal                │     │
│  └──────────────────────────────────────────────────────────┘     │
│                                                                    │
│  PhaserSimPreviewModal.tsx (T034 — config summary)                 │
│  phaserSimStore.ts (Zustand — modal open/close state)              │
│  types/phaserSim.ts (local types, no Phaser bundle import)         │
└───────────────────────────────────────────────────────────────────┘
                            │ course JSON (extendedProperties)
                            ▼
┌───────────────────────────────────────────────────────────────────┐
│ SCORM Packager (scorm-packager)                                     │
│                                                                    │
│  courseHasPhaserSim(course)                                        │
│  → If true: copy phaser-bundle.js into ZIP alongside player.js     │
│  → If false: no Phaser bundle included (saves ~1 MB)               │
└───────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────────────┐
│ Runtime Player (runtime-player, Vanilla JS)                        │
│                                                                    │
│  renderPhaserSim(widget)                                           │
│  → Renders container div (no Phaser yet)                           │
│                                                                    │
│  mountPhaserSim(container, config) — widgets/phaserSimWidget.ts    │
│  → Dynamic import('./phaser-bundle.js')  ← lazy, ~1 MB            │
│  → new Phaser.Game({ parent: container, ... })                     │
│  → game.events.on('sim-complete', score => dispatchCustomEvent)    │
│  → Returns cleanup() — called on slide navigation                  │
│                                                                    │
│  window 'elearn:widgetScore' listener (SCORM bridge)               │
│  → Receives { widgetId, score: 0–1 } from Phaser sim               │
│  → Updates questionStates, calls scormReport → LMSSetValue         │
└───────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────────────┐
│ Phaser Simulations Package (phaser-simulations)                    │
│                                                                    │
│  PhaserSimWidget.ts — game lifecycle (mount/destroy)               │
│  ScoreTracker.ts — step scoring, 0–100 percentage                  │
│  ModeController.ts — demo / practice / assessment modes            │
│  Scenes:                                                           │
│    ProcessFlowScene.ts + ProcessFlowLogic.ts (T031)                │
│    InteractiveDiagramScene.ts + InteractiveDiagramLogic.ts (T032)  │
│    GamifiedQuizScene.ts + GamifiedQuizLogic.ts (T033)              │
│    (PhysicsDemoScene, ConceptAnimatorScene — future)               │
└───────────────────────────────────────────────────────────────────┘
```

---

## Two Simulation Types

| Type | Technology | Use Case |
|---|---|---|
| **Screenshot Sim** | Playwright + Konva.js player | Software UI walkthrough (click-path replay) |
| **Phaser Sim** | Phaser.js 3 | Process flows, physics, gamified quizzes, concept animation |

---

## Phaser Simulation Subtypes

| `simType` | Description | Example |
|---|---|---|
| `process-flow` | Animated node/arrow diagrams | IT incident flow, HR onboarding |
| `interactive-diagram` | Labelled sprites with hotspots | Anatomy, machinery |
| `gamified-quiz` | Quiz with game mechanics (timer, lives, combos) | Any topic |
| `physics-demo` | Matter.js physics simulations | Science, mechanical |
| `concept-animator` | Step-by-step algorithm visualisation | Sorting, protocols |

---

## Authoring a Phaser Sim Widget

1. Open the **Blocks** tab in the left sidebar.
2. Drag **Phaser Sim** (under "Simulations") onto the canvas.
3. Select the widget. The **Props** tab in the right sidebar shows the Phaser Simulation panel.
4. Configure:
   - **Sim Type**: Choose the simulation subtype.
   - **Mode**: `demo` (auto-plays), `practice` (interactive, no penalty), `assessment` (scored).
   - **Passing Score**: Score threshold (0–100) used for SCORM mastery.
   - **Width / Height**: Canvas dimensions in pixels.
   - **Scene Definition**: JSON object describing the simulation content (nodes, edges, steps, etc.).
5. Click **Preview** to open the preview modal (shows config summary; full runtime preview requires T035 deployed).
6. Double-click the canvas placeholder to also open the preview modal.

---

## Scene Definition Format

The `sceneDef` JSON field describes the simulation content. Each `simType` has its own schema:

### `process-flow`
```json
{
  "simType": "process-flow",
  "nodes": [
    { "id": "start", "x": 100, "y": 200, "label": "Ticket Created", "type": "start" },
    { "id": "triage", "x": 300, "y": 200, "label": "L1 Triage", "type": "step" },
    { "id": "resolve", "x": 500, "y": 200, "label": "Resolve", "type": "decision" }
  ],
  "edges": [
    { "from": "start", "to": "triage" },
    { "from": "triage", "to": "resolve", "label": "urgent" }
  ],
  "steps": [
    { "nodeId": "triage", "instruction": "What do you do first?", "correctAction": "click" }
  ]
}
```

### `interactive-diagram`
```json
{
  "simType": "interactive-diagram",
  "backgroundImage": "assets/engine-diagram.png",
  "hotspots": [
    { "id": "hs-1", "x": 240, "y": 180, "label": "Cylinder Head", "tooltip": "Contains valves and combustion chamber" }
  ]
}
```

### `gamified-quiz`
```json
{
  "simType": "gamified-quiz",
  "questions": [
    {
      "id": "q1",
      "text": "What does HTTP stand for?",
      "options": ["HyperText Transfer Protocol", "High Transfer Text Protocol"],
      "correctIndex": 0,
      "points": 10
    }
  ],
  "timeLimit": 60,
  "lives": 3
}
```

---

## Bundle Size Strategy

Phaser 3 minified is approximately **1 MB**. Including it in the main player bundle would break the 150 KB gzipped target.

The solution:

1. **Authoring UI**: `types/phaserSim.ts` defines local type mirrors. The `phaser-simulations` package is NOT a dependency of `authoring-ui`.

2. **Runtime Player**: `widgets/phaserSimWidget.ts` uses a dynamic `import()` inside `mountPhaserSim()`. The import only runs when a phaser-sim widget is encountered on a slide.

3. **SCORM Packager**: `courseHasPhaserSim(course)` inspects the course JSON. If any widget has `type: 'phaser-sim'`, `phaser-bundle.js` is copied into the ZIP. Courses without phaser sims do not include the bundle.

---

## SCORM Scoring Bridge

Phaser sims communicate scores back to the SCORM layer via a DOM `CustomEvent`:

```typescript
// Dispatched by the Phaser game when a simulation completes
window.dispatchEvent(new CustomEvent('elearn:widgetScore', {
  detail: { widgetId: 'w-abc123', score: 0.85 }  // score in [0, 1]
}))
```

The runtime player's `attachEvents()` listens for this event and:
1. Records the score in `state.questionStates` (normalised to `[0, 1]`).
2. Calls `scormReport()` which writes `cmi.core.score.raw` and `cmi.core.lesson_status` via `LMSSetValue`.

---

## Key Files

| File | Package | Purpose |
|---|---|---|
| `src/types/phaserSim.ts` | authoring-ui | Local type definitions (no Phaser bundle import) |
| `src/store/phaserSimStore.ts` | authoring-ui | Zustand store for preview modal state |
| `src/editor/registerPhaserSimBlock.ts` | authoring-ui | GrapesJS block + component registration |
| `src/components/sidebar/PhaserSimPropertiesPanel.tsx` | authoring-ui | Right sidebar properties panel |
| `src/components/simulation/PhaserSimPreviewModal.tsx` | authoring-ui | Preview overlay modal |
| `src/widgets/phaserSimWidget.ts` | runtime-player | Dynamic Phaser bundle load + game mount |
| `src/index.ts` | runtime-player | renderPhaserSim, goToSlide wiring, SCORM bridge |
| `src/index.ts` | scorm-packager | courseHasPhaserSim, conditional phaser-bundle.js copy |
| `src/PhaserSimWidget.ts` | phaser-simulations | Game lifecycle (mount/destroy/tracker/controller) |
| `src/ScoreTracker.ts` | phaser-simulations | Step-by-step scoring, 0–100 percentage |
| `src/ModeController.ts` | phaser-simulations | Demo / practice / assessment mode logic |

---

## Build Commands

```bash
# Build the Phaser simulation bundle
pnpm --filter @elearn-studio/phaser-simulations run build
# Output: packages/phaser-simulations/dist/phaser-bundle.js

# Build the runtime player
pnpm --filter @elearn-studio/runtime-player run build

# Build and run all tests
pnpm test
```

---

## Adding a New Simulation Subtype

1. Create `packages/phaser-simulations/src/scenes/<SimType>Scene.ts` and `<SimType>Logic.ts`.
2. Add the simType to `PhaserSimType` union in `phaser-simulations/src/types.ts` and `authoring-ui/src/types/phaserSim.ts`.
3. Add a corresponding scene definition interface in `phaser-simulations/src/types.ts`.
4. Register the scene builder in `PhaserSimWidget.buildScene()`.
5. Add an entry to `PHASER_SIM_TYPES` in `authoring-ui/src/types/phaserSim.ts` (for the dropdown).
6. Add tests for the new Logic class (at least: init, step, complete, getScore).
