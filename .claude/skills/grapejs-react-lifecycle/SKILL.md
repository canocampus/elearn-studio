# Skill: GrapesJS + React Lifecycle & State Integration

## 🧩 Mandatory Rules: React + GrapesJS Integration

### Editor Lifecycle
- ✅ The GrapesJS instance MUST be initialized within a `useEffect` with explicit dependencies `[courseId, slideId]`
- ✅ The `useEffect` MUST return a cleanup function that executes:
1. `editor.destroy()`
2. `clearTimeout(autosaveTimer)` if it exists
3. `removeEventListener` for any listeners added to the DOM/document
- ❌ NEVER initialize the editor outside of `useEffect` or in the component body

### Event and State Management
- ✅ All changes in GrapesJS must be propagated to React via: `component.set()` → `component:update` event → `setState`/Zustand
- ✅ React's `Zustand` state is the ONLY source of truth for persistence.
- ❌ NEVER call `editor.store()` directly from a UI handler (input onChange, button click).
- ✅ Use the existing debounce mechanism in `initEditor.ts` for all save operations.

### Backbone Subscriptions — use the canonical hook, never inline

**NEVER** read `component.get('prop')` in the render body. It is a snapshot — stale after Undo/Redo.
**ALWAYS** use `useComponentProperty` from `src/hooks/useComponentProperty.ts`:

```typescript
// ✅ CORRECT — subscribes to change:extendedProperties, re-renders on Undo/Redo
const [ep, updateEp, getLatest] = useComponentProperty(
  selected,                    // Component | null — null-safe (T648)
  'extendedProperties',
  DEFAULT_EXTENDED_PROPS,
)

// ✅ CORRECT — patch-merge using getLatest() to avoid stale closure (T639.1)
function update(patch: Partial<ExtendedProps>) {
  updateEp({ ...getLatest(), ...patch })
}
```

Before modifying any file that touches GrapesJS, widgets, canvas, or property panels, read:
`GRAPESJS_REACT_PATTERNS.md`

Note: In EditorCanvas.tsx, the editor is already initialized in useEffect.
This rule applies to any new component that needs to create an editor instance.

## GrapesJS + React Hook Rules

### Zustand vs Backbone — source of truth (T648)

| Data | Use | Reason |
|---|---|---|
| Which panel to render | Zustand `selectedComponentType` | Sidebar routing — cross-cutting, OK to lag 1 render |
| Within-panel sub-form routing | `selected.get('type')` (Backbone) | Must be synchronous; Zustand can lag 5–20ms |
| All component property values | `useComponentProperty` (Backbone subscription) | Authoritative; Zustand mirror causes keystroke-level global re-renders |

```typescript
// ✅ CORRECT pattern for every PropertiesPanel
export function ButtonPropertiesPanel() {
  const selectedComponentType = useEditorStore(s => s.selectedComponentType)
  const editor = useEditorStore(s => s.editor)

  if (!editor || !selectedComponentType || !isButtonWidgetType(selectedComponentType)) return null

  const selected = editor.getSelected()
  if (!selected || selected.get('type') !== 'button') return null  // Backbone double-check

  // All data via hook — never selected.get('prop') in render body
  const [content, updateContent] = useComponentProperty(selected, 'content', '')
  const type = selected.get('type') as string  // within-panel routing from Backbone ONLY
  // NOT: selected.get('type') || selectedComponentType  ← PROHIBITED (T648)
}
```

### extendedProperties patch-merge rule (T639)

**RULE:** Always read the latest committed value via `getLatest()` before merging a partial patch.

```typescript
// ❌ WRONG — ep from closure may be stale if two updates fire in the same render cycle
function update(patch: Partial<T>) {
  updateEp({ ...ep, ...patch })
}

// ✅ CORRECT — getLatest() reads latestRef.current, always the most-recent committed value
function update(patch: Partial<T>) {
  updateEp({ ...getLatest(), ...patch })
}
```

### ✅ CSS Verification for Drag-and-Drop
- The GrapesJS editor container must have an explicit `z-index` and be greater than that of overlapping elements.
- Use DevTools to inspect `getComputedStyle(canvas).zIndex` during drop debugging.
- Avoid `position: relative/absolute` in parent elements that might intercept pointer events.

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
