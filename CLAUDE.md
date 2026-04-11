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
After completing a task block, run:
```
/task-complete
```
This command automates the documentation checklist defined in AGENTS.md §6.
Follow every step in `.claude/commands/task-complete.md`.

---

### E2E test skill
Before writing any Playwright E2E test, read:
```
.claude/skills/elearn-e2e-qa/SKILL.md
```

---

### Design system skill (Slate Cobalt — deferred phase)
When the UI redesign phase begins, read:
```
.claude/skills/elearn-design-system/SKILL.md
```
This phase is deferred. Do NOT apply design tokens until explicitly instructed.

---

## GrapesJS + React Hook Rules

### extendedProperties patch-merge rule (T639)

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

## Preview Feature — postMessage Handshake (T641)

The Preview button opens `preview.html` in a new popup window and delivers the full
course JSON via `postMessage`. **Never use `localStorage` for this** (Critical Rule 5 —
runtime player must be self-contained; localStorage leaks state across tabs).

### Handshake sequence

```
opener (AppLayout.tsx)                popup (preview.html)
─────────────────────────────────────────────────────────
window.addEventListener('message', onReady)   ← registered BEFORE window.open()
window.open('/preview.html', '_blank')        → popup loads
                                              window.opener.postMessage('elearn-preview-ready', origin)
onReady fires: e.source===popup ✓
popup.postMessage({ type:'elearn-preview-data', course, slideIndex }, origin)
                                              onMessage: data.type==='elearn-preview-data'
                                              window.removeEventListener('message', onMessage)
                                              ELearnPlayer.init(data.course, data.slideIndex)
```

### Key implementation notes

- The listener is registered BEFORE `window.open()` — JS is single-threaded, the popup
  cannot fire its `'elearn-preview-ready'` message until this call stack unwinds, by which
  time the listener is already active (no race).
- The opener injects the **live GrapesJS component tree** for the current slide (via
  `widgetsFromGrapesjs(editor.getComponents().toArray())`) because the Zustand store's
  `course.slides[i].widgets` is stale — GrapesJS edits go through `storageManager →
  backend` but do NOT update the store.
- The popup origin-checks both messages; the opener checks `e.source !== popup`.

### Files
- `packages/authoring-ui/src/components/layout/AppLayout.tsx` — `handlePreview()`
- `packages/authoring-ui/public/preview.html` — postMessage receiver + `ELearnPlayer.init()`
- `packages/runtime-player/src/index.ts` — `ELearnPlayer.init(course, slideIndex)`

---

## GrapesJS Integration — Code Reference

### Custom Storage Manager
```typescript
// packages/authoring-ui/src/grapesjs/storage-manager.ts
const elearnStorageManager = {
  type: 'elearn-api',

  async load(options: { courseId: string; slideId: string }) {
    try {
      const course = await api.getCourse(options.courseId)
      return grapesjsFromSlide(course.slides.find(s => s.id === options.slideId))
    } catch (err) {
      console.error('GrapesJS storage load failed:', err)
      throw err
    }
  },

  async store(gjsData: GrapesJsData, options: { courseId: string; slideId: string }) {
    try {
      const widgets = widgetsFromGrapesjs(gjsData.components)
      await api.updateSlide(options.courseId, options.slideId, { widgets })
    } catch (err) {
      console.error('GrapesJS storage save failed:', err)
      throw err
    }
  }
}
```

### Custom Block registration (one per widget type)
```typescript
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
    onRender() { this.renderQuestionPreview() }
  }
})
```

### Slide canvas size configuration
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
