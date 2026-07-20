# eLearn Studio — Claude Code Instructions

> **READ AGENTS.md FIRST.**
> This file contains only Claude Code–specific commands and overrides.
> All workflow rules, test policies, investigation protocol, architectural rules,
> project overview, data model, and key commands live in **AGENTS.md**.

---

## Claude Code–Specific Commands

### Context compaction (Rule 1, Step 3 of AGENTS.md)
When approaching 70% of the context window, use:
```
/compact
```
After compact: re-read `AGENTS.md`, `CLAUDE.md`  and `WORKING_CONTEXT.md` in that order  before continuing any subtask

---

### Block closure (Section 6 of AGENTS.md — Step 2)

Run: 
```
/task-complete
```

This encapsulates full-suite testing, changelog updates, and the WORKING_CONTEXT.md sync.

### Audit
New! Run to verify architecture against Graphify data:
```
/audit-structural
```
---

## 🛠️ Specialized Skills & Hooks

### E2E test skill
Before writing any Playwright E2E test, read:
```
.claude/skills/elearn-e2e-qa/SKILL.md
```

### Design system skill (Slate Cobalt — deferred phase)
When the UI redesign phase begins, read:
```
.claude/skills/elearn-design-system/SKILL.md
```
This phase is deferred. Do NOT apply design tokens until explicitly instructed.

### GrapesJS & React Architecture
- **When to use**: Modifying `packages/authoring-ui`, GrapesJS widgets, canvas, or property panels.
- **Protocol**: You MUST read and adhere to `.claude/skills/grapejs-react-lifecycle/SKILL.md`.

### Hooks
- **pre-edit**: Before each write (`write_file`) to `packages/authoring-ui/src`, run `node .claude/hooks/pre-edit-cleanup-check.js {{file_path}}` and analyze the warnings before proposing the final code.
- **pre-investigation**: run `node .claude/hooks/pre-investigation.js` Automatically triggered before starting any TXX.N "Investigate" task to ensure the architecture graph is updated.

---

## Phaser.js — Runtime Widget Reference

```typescript
// packages/runtime-player/src/widgets/phaser-sim-widget.ts
class PhaserSimWidget {
  private game: Phaser.Game | null = null

  async mount(container: HTMLElement, config: PhaserSimConfig) {
    const Phaser = await import('../phaser-bundle.js')
    this.game = new Phaser.Game({
      parent: container,
      width: config.width ?? 800,
      height: config.height ?? 500,
      physics: config.usePhysics ? { default: 'matter' } : false,
      scene: buildScene(config.sceneDef)
    })
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
- Phaser 3 minified: ~1MB — too large to include in every course
- The SCORM packager only copies `phaser-bundle.js` if the course contains at least
  one `phaser-sim` widget
- In the runtime player: dynamic `import()` — cached after first load within session

---

## ToolBook → eLearn Studio Mapping

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
