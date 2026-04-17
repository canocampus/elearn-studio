# Approved Patterns: GrapesJS + React in elearn-studio

> Last updated: Phase 10 complete (T651, 2026-04-17). All patterns below are
> battle-tested and shipped.
> Before modifying any file that touches GrapesJS, widgets, canvas, or property panels,
> read this file in full.

---

## Pattern 1: Editor Wrapper with Full Cleanup

Canonical implementation: `packages/authoring-ui/src/components/editor/EditorCanvas.tsx`

```typescript
export function EditorCanvas({ courseId, slideId }: Props) {
  const editorRef = useRef<Editor | null>(null)

  useEffect(() => {
    // T650/T651: initEditor now returns a four-tuple.
    const { editor, cleanup, hasPendingChanges, requestSave } = initEditor({
      container: containerRef.current!,
      courseId,
      slideId,
      blockManagerContainer: '#block-manager',
      layerManagerContainer: '#layer-manager',
      styleManagerContainer: '#style-manager',
    })
    editorRef.current = editor

    // T651.3: expose the unified save closure via Zustand so SaveErrorBanner,
    // useActionsSave, SimulationEditor, and saveAndLoad all share one entry point.
    useEditorStore.getState().setRequestSave(requestSave)

    // T650.2: dirty-state warning on tab close mid-debounce (uses hasPendingChanges).
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasPendingChanges()) { e.preventDefault(); e.returnValue = '' }
    }
    window.addEventListener('beforeunload', onBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      cleanup()             // clears autosaveTimer, removes dragstart listener, unsubscribes cache
      editor.destroy()
      editorRef.current = null
      useEditorStore.getState().setRequestSave(null)
    }
  }, [courseId, slideId])   // explicit deps — remounts on slide/course change

  return <div ref={containerRef} />
}
```

Rules:
- `useEffect` deps MUST be `[courseId, slideId]` — never `[]`
- cleanup MUST run before `editor.destroy()` — order matters
- `initEditor` returns `{ editor, cleanup, hasPendingChanges, requestSave }`
- `cleanup()` handles `clearTimeout(autosaveTimer)`,
  `blockContainer.removeEventListener('dragstart', ...)`, and `unsubscribeCache()`
- `hasPendingChanges` (T650) is a closure over `autosaveTimer`; read at event time, no parallel flag
- `requestSave` (T651) must be published to Zustand AND cleared on unmount

---

## Pattern 2: useComponentProperty — the canonical hook (T644/T648)

Canonical file: `packages/authoring-ui/src/hooks/useComponentProperty.ts`

```typescript
// Actual shipped signature — DO NOT use the old editor: Editor | null variant
export function useComponentProperty<T>(
  component: Component | null,   // null-safe (T648)
  key: string,
  defaultValue: T,
): [value: T, update: (value: T) => void, getLatest: () => T]
```

**Full implementation (reference — do not inline):**

```typescript
export function useComponentProperty<T>(
  component: Component | null,
  key: string,
  defaultValue: T,
): UsePropertyReturn<T> {
  const [value, setValue] = useState<T>(() => {
    if (!component) return defaultValue
    const comp = component as GjsComponent
    const raw = comp.get(key)
    return (raw !== undefined && raw !== null ? raw : defaultValue) as T
  })

  const latestRef = useRef(value)
  latestRef.current = value

  useEffect(() => {
    if (!component) return                        // no listener registered when null
    const comp = component as GjsComponent

    const raw = comp.get(key)
    setValue((raw !== undefined && raw !== null ? raw : defaultValue) as T)

    function onChange() {
      const updated = comp.get(key)
      setValue((updated !== undefined && updated !== null ? updated : defaultValue) as T)
    }

    comp.on(`change:${key}`, onChange)
    return () => { comp.off(`change:${key}`, onChange) }  // ✅ always present
  }, [component, key])

  function update(newValue: T) {
    if (!component) return                        // no-op, no side effects
    const comp = component as GjsComponent
    setValue(newValue)                            // optimistic update (T639.1)
    comp.set(key, newValue)
  }

  return [value, update, () => latestRef.current]
}
```

**Key invariants (enforced by tests — 38 passing):**
- `null` component → returns `defaultValue`, registers no listener, `update()` is a pure no-op
- Rapid A→B→A selection → value always matches the currently mounted component
- `comp.set()` externally (Undo/Redo) → React re-renders via `onChange` handler
- `getLatest()` returns the ref-backed value — safe to call inside stale closures (T639.1)
- Two consecutive `update()` calls within the same `act()` / event cycle → second call sees
  the first call's value via `getLatest()` — no silent clobber (T649)

> ⚠️ **Implementation Note**: `latestRef.current` is updated **synchronously** within `update()` (not just on render). This ensures that `getLatest()` reflects the most recent value even if called from another callback in the same event cycle. This pattern is essential to avoid stale closures in batched operations.

---

## Pattern 3: Panel Shell — Zustand gate + Backbone double-check

Canonical implementation: `packages/authoring-ui/src/components/sidebar/PhaserSimPropertiesPanel.tsx`

```typescript
// OUTER shell — this is ALL that Zustand is used for
export function PhaserSimPropertiesPanel() {
  const selectedComponentType = useEditorStore(s => s.selectedComponentType)
  const editor = useEditorStore(s => s.editor)

  // Zustand gate: acceptable to lag by one render (briefly blank sidebar)
  if (selectedComponentType !== 'phaser-sim') return null

  const selected = editor?.getSelected()

  // Backbone double-check: authoritative, synchronous
  if (!selected || selected.get('type') !== 'phaser-sim') return null

  return <PhaserSimPropertiesPanelInner selected={selected} editor={editor} />
}

// INNER component — receives non-null Component; reads all data via hook
function PhaserSimPropertiesPanelInner({ selected, editor }: InnerProps) {
  const [ep, updateEp, getLatest] = useComponentProperty(
    selected,
    'extendedProperties',
    DEFAULT_EXTENDED_PROPS,
  )

  function update(patch: Partial<ExtendedProps>) {
    const current = getLatest()           // ✅ never stale (T639.1)
    updateEp({ ...current, ...patch })
  }

  // Keep textarea in sync when ep.sceneDef changes externally (Undo/Redo)
  useEffect(() => {
    setSceneDefJson(JSON.stringify(ep.sceneDef, null, 2))
  }, [ep.sceneDef])

  // ...render
}
```

**Why the outer/inner split:** the outer shell receives a possibly-null `editor.getSelected()`
and passes a guaranteed non-null `selected` to the inner component. The inner component can
then call `useComponentProperty(selected, ...)` with full confidence.

---

## Pattern 4: Unified Persistence via `requestSave()` (T645/T647/T651)

Save recipe (post-T651):

```
comp.set()
  → component:update event
  → triggerAutosave() (debounced 2 s, with RTE + race guards)
  → requestSave()                           ← unified entry point, T651
  → performSave(editor, hooks)              ← pure primitive in storageManager
  → editor.store()                          ← ONLY direct call in the codebase
  → backend
```

`requestSave` is a Zustand-bound closure constructed in `initEditor.ts` that wires
`performSave` to `setIsSaving`/`setSaveError`. Every save path in the app routes
through it — `grep "editor.store()"` is green everywhere except
`storageManager.ts:68` (inside `performSave`).

```typescript
// ✅ CORRECT: write via comp.set() — triggers the debounced autosave automatically
const [ep, updateEp] = useComponentProperty(selected, 'extendedProperties', DEFAULT)
updateEp({ ...getLatest(), newField: value })

// ✅ CORRECT: dispatch an immediate save via requestSave from a non-editor context
//             (pre-navigation, retry banner, actions-save subscribe, simulation editor)
const requestSave = useEditorStore.getState().requestSave
if (requestSave) {
  await requestSave({ timeoutMs: 5000 })   // timeoutMs optional; only pre-nav uses it
}

// ❌ PROHIBITED: calling editor.store() directly — bypasses performSave + UI state
function handleClick() {
  editor.store()   // adds a sixth call site; recreates the drift that T651 eliminated
}
```

Pre-navigation save (slide switch) lives in `EditorCanvas.tsx saveAndLoad()` and calls
`requestSave({ timeoutMs: 5000 })`. The `stopCommand('text-edit')` RTE flush stays
inline at this caller — it is a caller responsibility, not part of the save recipe.

Retry/actions-save/simulation-save paths all read the closure from Zustand:
`useEditorStore.getState().requestSave?.()`. Null-safe: the field is `null` until the
editor is ready and after unmount.

---

## Zustand / Backbone Source of Truth Rules (T648 — ADR: decisions/2026-04-17-panel-selection-source.md)

| What | Source | Why |
|---|---|---|
| Which panel to show (sidebar routing) | Zustand `selectedComponentType` | Cross-cutting; changes once per selection |
| Within-panel sub-form routing (`button` vs `nav-buttons`) | Backbone `selected.get('type')` | Must be synchronous; Zustand can lag 5–20ms |
| All component property data | Backbone via `useComponentProperty` | `comp.get()` is always authoritative; Zustand mirror would cause global re-renders on every keystroke |
| Undo/Redo reactivity | Backbone subscription in hook | UndoManager calls `comp.set()` → `change:prop` fires → hook updates React state |

---

## Prohibited Anti-Patterns

```typescript
// ❌ PROHIBITED — Zustand fallback for within-panel routing (T648)
const type = selected.get('type') || selectedComponentType
// If selected.get('type') is falsy during rapid selection, renders wrong sub-form

// ❌ PROHIBITED — direct property read in render body (stale after Undo/Redo)
function MyPanel() {
  const props = selected.get('extendedProperties')  // snapshot, not subscribed
  return <input value={props.title} />
}

// ❌ PROHIBITED — syncing GrapesJS events to Zustand for data (not gating)
editor.on('component:update', () => setZustandProp(selected.get('prop')))
// Fires on every keystroke; causes global re-renders across all Zustand subscribers

// ❌ PROHIBITED — listener without cleanup
useEffect(() => {
  comp.on('change:content', handler)
  // missing: return () => comp.off('change:content', handler)
}, [])

// ❌ PROHIBITED — editor.store() from a click handler (T651)
function handleSave() {
  editor!.store()   // bypasses performSave, isSaving flag never set, no saveError on failure
  // ✅ Use: useEditorStore.getState().requestSave?.()
}

// ❌ PROHIBITED — stale closure patch-merge (T639)
function update(patch: Partial<T>) {
  setEp({ ...ep, ...patch })   // ep from closure, not current committed value
}
```

---

## Correct Patterns (quick reference)

```typescript
// ✅ Zustand for render gate ONLY
if (selectedComponentType !== 'button') return null

// ✅ Backbone double-check for within-panel routing
const selected = editor.getSelected()
if (!selected || selected.get('type') !== 'button') return null

// ✅ Live data via subscription hook
const [ep, updateEp, getLatest] = useComponentProperty(selected, 'extendedProperties', DEFAULT)

// ✅ Patch-merge using getLatest() — prevents stale closure (T639.1)
function update(patch: Partial<ExtendedProps>) {
  updateEp({ ...getLatest(), ...patch })
}

// ✅ Within-panel sub-form routing from Backbone only
const type = selected.get('type') as string
// NOT: selected.get('type') || selectedComponentType
```
