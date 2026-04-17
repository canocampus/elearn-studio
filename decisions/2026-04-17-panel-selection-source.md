# Decision: Zustand for render gating, Backbone for live data in all PropertiesPanel components

**Date:** 2026-04-17  
**Task:** T648  
**Status:** Approved

## Context

The Phase 10 audit identified that all `*PropertiesPanel.tsx` components read component
type/properties from two sources simultaneously:

- **Zustand** (`selectedComponentType`) — updated asynchronously by the
  `component:selected` GrapesJS event via `useEditorStore`. Subject to a ~5–20 ms
  batching delay relative to the live GrapesJS Backbone model.
- **Backbone** (`editor.getSelected().get('type')`) — the authoritative, synchronous
  source of truth inside GrapesJS.

The duality creates two concrete failure modes:

1. **Render with wrong sub-form** — `ButtonPropertiesPanel:292` and
   `QuestionPropertiesPanel:511` compute `type = selected.get('type') || selectedComponentType`.
   If `selected.get('type')` returns falsy for any reason (race during rapid selection
   change), `selectedComponentType` from the prior render cycle wins, and the panel
   renders the wrong form (e.g. `nav-buttons` form for a `button` widget).

2. **Stale data after Undo/Redo** — panels that read properties directly from
   `selected.get('prop')` in the render body do not re-render when `UndoManager.undo()`
   restores a prior value. Only a Backbone subscription (`component.on('change:prop')`)
   guarantees re-render.

`PhaserSimPropertiesPanel` (fixed in T644) is the reference implementation that avoids
both failure modes.

## Options Evaluated

### A — Zustand as single source (subscribe every property to Zustand)

Sync GrapesJS component state into Zustand on every `component:update` event and read
everything from Zustand.

**Rejected.** GrapesJS fires `component:update` on every keystroke and drag tick.
Syncing all properties to Zustand would trigger global re-renders across all subscribers
on every event (Guardrail 4 violation). Zustand is not designed as a GrapesJS mirror.

### B — Backbone as single source (remove Zustand from panels entirely)

Panels subscribe directly to Backbone without any Zustand involvement.

**Rejected.** The sidebar routing (which panel to show) depends on knowing the selected
component type at the AppLayout/sidebar level without passing the GrapesJS editor
instance deeply into layout components. Zustand solves this cross-cutting visibility
concern correctly and efficiently — it changes at most once per selection event.

### C (Adopted) — Zustand for render gating only; Backbone for all data reads

- Zustand `selectedComponentType` is used ONLY for the `if (type !== 'X') return null`
  guard at the top of each panel. This gate is allowed to lag by one render cycle
  because the worst outcome is briefly showing a "nothing selected" state.
- All component properties are read via `useComponentProperty(component, propPath, fallback)`,
  which subscribes to `change:${propPath}` on the Backbone model with cleanup.
- Within-panel routing (choosing between sub-forms like `button` vs `nav-buttons`) uses
  only `selected.get('type')` from the live Backbone model — never `|| selectedComponentType`.

## Decision

**Option C is adopted.**

### Canonical hook: `useComponentProperty<T>` (T644, adjusted for null-safety)

```typescript
// packages/authoring-ui/src/hooks/useComponentProperty.ts
export function useComponentProperty<T>(
  component: Component | null,   // null-safe (T648 adjustment from T644)
  key: string,
  defaultValue: T,
): UsePropertyReturn<T>           // [value, update, getLatest] — tuple kept
```

The `component: Component | null` signature with an early return in `useEffect` prevents
TypeError when called from an outer shell that passes a component that may transiently
be null. The tuple `[value, update, getLatest]` is kept — `getLatest()` is required by
the stale-closure fix (T639/T649).

The `editor: Editor | null` signature from the T648.3 spec is **not adopted**:
internalizing `editor.getSelected()` inside the hook would hide the selection read,
make unit testing harder, and require passing the full editor reference to every hook
call. The caller-provides-component pattern (as in PhaserSimPropertiesPanel) is
more testable and explicit.

### Prohibited patterns (enforced as code-review blockers)

```typescript
// PROHIBITED — fallback to Zustand for within-panel type routing
const type = selected.get('type') || selectedComponentType

// PROHIBITED — direct property read in render body without subscription
const props = selected.get('extendedProperties')  // stale after Undo/Redo

// PROHIBITED — syncing GrapesJS events to Zustand for data (not gating)
editor.on('component:update', () => setZustandState(selected.get('props')))
```

```typescript
// CORRECT — Zustand for render gate only
if (selectedComponentType !== 'button') return null

// CORRECT — Backbone double-check for within-panel routing
const selected = editor.getSelected()
if (!selected || selected.get('type') !== 'button') return null

// CORRECT — live data via subscription hook
const [ep, updateEp, getLatest] = useComponentProperty(selected, 'extendedProperties', DEFAULT)

// CORRECT — within-panel sub-form routing from live Backbone only
const type = selected.get('type') as string
```

## Rationale

- **Zustand lag is acceptable at the gate** — a briefly blank sidebar is invisible to
  the user during the ~20ms Backbone→Zustand propagation window.
- **Zustand lag is NOT acceptable for data** — a stale property value after Undo/Redo
  is a visible, reproducible bug (the panel shows the old value).
- **Backbone is always fresh** — `comp.get()` reads the current in-memory model value
  synchronously and is authoritative by definition.
- **`getLatest()` prevents stale closures** — `update(patch)` must read the current
  committed value, not the closure value from the last render (T639 lesson).

## Consequences

- All panels migrated in T648.3.
- `ButtonPropertiesPanel:292` and `QuestionPropertiesPanel:511` — remove `|| selectedComponentType` fallback.
- Panels with direct `selected.get('prop')` reads in render body — replace with `useComponentProperty`.
- `useComponentProperty` hook updated: `component: Component | null` (null-safe early return).
- `PhaserSimPropertiesPanel` — no change required (already compliant; serves as reference).
