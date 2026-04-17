# Decision: Keep _isEditorLoading as module-level flag

**Date:** 2026-04-17  
**Task:** T646.5  
**Status:** Approved — do not move to React/Zustand

## Context

`packages/authoring-ui/src/editor/initEditor.ts` exposes a module-level boolean flag:

```typescript
let _isEditorLoading = false
export function setEditorLoading(loading: boolean): void { _isEditorLoading = loading }
export function getEditorLoading(): boolean { return _isEditorLoading }
```

`EditorCanvas.tsx` calls `setEditorLoading(true)` before `editor.load()` and
`setEditorLoading(false)` in the `storage:end:load` event listener. Inside `initEditor.ts`,
the `triggerAutosave` function reads `getEditorLoading()` at the start of every
`component:update` / `component:add` / `component:remove` handler and returns early
(suppressing the debounce timer) while loading is in progress.

During Phase 10 audit this flag was flagged as Issue #6: module-level state outside React.

## Why it cannot move to React state or Zustand

### GAP-06b — GrapesJS fires component:add synchronously during loadData

GrapesJS calls `loadData()` **synchronously** inside the `editor.load()` promise resolution.
`loadData()` reconstructs every component in the slide by calling
`this.Components.load(data.components)` which triggers `component:add` for each widget
before returning. All of this happens within a single JavaScript call stack.

React state updates (via `setState` or Zustand `set()`) are **asynchronous** — they are
batched and flushed on the next render cycle, not immediately. If `_isEditorLoading` were
stored in Zustand, the sequence would be:

```
setEditorLoading(true)  →  Zustand schedules state update (not yet committed)
editor.load()           →  GrapesJS calls loadData() synchronously
loadData()              →  fires component:add × N
triggerAutosave()       →  reads Zustand state → still false (update not flushed yet)
                            → starts autosave timer incorrectly
... later ...
React re-renders        →  Zustand state finally updated to true (too late)
```

The module-level flag is written and read **synchronously within the same call stack**,
which is the only way to guarantee the gate is in place before the first `component:add`
fires.

### GAP-06c — storage events fire too late to use as a gate

An alternative is to gate on GrapesJS native storage events (`storage:start:load` /
`storage:end:load`) instead of a manual flag. This fails for the same reason:
GrapesJS calls `loadData()` **after** `storage:end:load` fires (confirmed in
`grapesjs.min.js` `em.prototype.load`). Using `storage:end:load` as the off-signal
would suppress autosave for zero of the spurious `component:add` events because they
arrive after the gate has already been lifted.

### Why Zustand's `getState()` does not justify a migration

Zustand's `setState()` outside React *is* synchronous and would technically work for
this semaphore. However, migrating a plain boolean flag used exclusively inside a
non-React module (`initEditor.ts`) to a global state store introduces unnecessary
coupling, increases test setup complexity, and violates YAGNI. The module-level flag
is zero-overhead, fully encapsulated behind typed accessors, and already correctly owned
by the React lifecycle (`EditorCanvas`). No functional benefit justifies the
architectural cost.

## Decision

Keep `_isEditorLoading` as a module-level flag behind the
`setEditorLoading` / `getEditorLoading` accessor pair.

**Guardrails:**
- The flag is only written by `EditorCanvas.tsx` (the React lifecycle owner).
- It is only read by `triggerAutosave` inside `initEditor.ts`.
- No other module may read or write this flag directly.

**Test cleanup (mandatory):** Because the flag is module-level it persists across tests
in the same process. Every test file that imports `initEditor.ts` MUST reset it in
`afterEach`:

```typescript
import { setEditorLoading } from '../editor/initEditor'
afterEach(() => setEditorLoading(false))
```

## Future path (TD-006)

If GrapesJS ever guarantees that `storage:start:load` fires before `loadData()` begins
reconstructing components (i.e., before any `component:add`), this flag could be
eliminated and replaced with a `storage:start:load` / `storage:end:load` listener pair
entirely within `initEditor.ts`. Until that is verified, the module-level flag stays.
See TD-006 in `tasks.md`.
