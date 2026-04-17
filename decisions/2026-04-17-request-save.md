# Decision: Unify slide-widget persistence behind a single `requestSave()` entry point

**Date:** 2026-04-17
**Task:** T651
**Status:** Approved
**Author:** self (Phase 10 refactor)

---

## Context

Slide-widget persistence (the `editor.store()` path that converts the GrapesJS
component tree into the `Widget[]` schema and PATCHes `/courses/:id/slides/:slideId`)
is invoked from **five separate call sites** across the authoring-ui package, and
only some of them manage the Zustand `isSaving` / `saveError` state that
`SaveErrorBanner` and the TopToolbar "Saving…" / "Save failed" badges rely on.

### Inventory of current `editor.store()` call sites

| # | File | Function | Sets `isSaving` | Sets `saveError` | Timeout | Notes |
|---|---|---|---|---|---|---|
| 1 | `editor/initEditor.ts:453` | `triggerAutosave` debounce callback | ✅ | ✅ | — | Wraps in try/catch/finally. Has its own context-snapshot race guard (CRITICAL-01) and RTE-active defer (T637.2). |
| 2 | `components/editor/EditorCanvas.tsx:196` | `saveAndLoad` pre-navigation | ✅ | ✅ | 5 s | Uses `Promise.race([store(), 5s timeout])`. Also calls `editor.stopCommand('text-edit')` before store to flush RTE buffers. |
| 3 | `components/ui/SaveErrorBanner.tsx:26` | `handleRetry` | ❌ | ✅ | — | **Bug**: does not set `isSaving(true)` — the user sees the retry begin with no feedback until it fails or the banner disappears. |
| 4 | `hooks/useActionsSave.ts:97` | store subscriber callback | ❌ | ❌ | — | **Silent failure path**: wraps in `void store().catch(console.error)`. If the actions-save fails, the user sees no UI indication. |
| 5 | `components/simulation/SimulationEditor.tsx:32` | Konva save side-effect | ❌ | ❌ | — | Same silent-failure pattern as #4. |

### Duplication problems

1. **Drift risk.** Five copies of "the save recipe". When T647 added
   `setIsSaving`/`setSaveError` to the pre-navigation path, three of the five
   call sites were missed and continue to fail silently. Every future change
   to the save path (metrics, telemetry, error narrowing, retry-budget, etc.)
   has to be made in five places and *will* be made in four.

2. **Silent data loss.** `useActionsSave` and `SimulationEditor` swallow errors
   into `console.error`. A real 500 from the backend produces no user-facing
   signal. The SaveErrorBanner that the T622 design explicitly made
   non-dismissible to prevent data-loss-without-feedback is bypassed.

3. **Asymmetric feedback.** The `isSaving` badge appears for autosave and
   slide-switch save but NOT for retry, actions-save, or simulation-save.
   Users cannot tell whether the system is working.

4. **Testability.** Each call site has its own test setup that mocks
   `useEditorStore.getState` to intercept `setIsSaving`/`setSaveError`.
   Shared coverage via a single entry point would eliminate four redundant
   mock harnesses.

### Out of scope

**Course meta-operations** (add slide / delete slide / update course settings /
reorder slides / rename slide) go through the REST client (`courseApi.ts`)
directly, NOT through `editor.store()`. They are a separate persistence path
with different semantics (they return the whole course doc, bump the cache
version, etc.). T651 does **not** touch them. Their duplicated
`setIsSaving`/`setSaveError` handling in `TopToolbar.tsx` (3 sites) and
`SlideList.tsx` (5 sites) is left for a future task (candidate: TD-007).

---

## Options Evaluated

### A — Free function on `storageManager.ts` that takes UI callbacks

```typescript
// storageManager.ts
export async function performSave(editor: Editor, hooks: {
  onStart?: () => void
  onSuccess?: () => void
  onError?: (msg: string) => void
  timeoutMs?: number
}): Promise<void> { /* ... */ }
```

Each caller wires its own Zustand actions into `hooks`.

**Rejected as sole solution.** Keeps five call sites — the *boilerplate* moves
from "try/catch around store()" to "build hooks object". The drift risk is
unchanged; a new caller can still forget to pass `onStart`. Useful as a
**lower layer** (see Option B).

### B — Pure `performSave` layer + Zustand-bound `requestSave` in initEditor ✅ Selected

Two-layer design:

**Layer 1 — `storageManager.ts`** exports a pure function that takes an editor
and a minimal hook interface. No Zustand import. No React dependency.
Handles the mechanics: `editor.store()` invocation, optional timeout race,
error narrowing. See ADR sketch below.

**Layer 2 — `initEditor.ts`** constructs a zero-argument `requestSave()` closure
that wires `performSave` into `useEditorStore.getState().setIsSaving` and
`setSaveError`. The closure is returned from `initEditor()` alongside
`hasPendingChanges` (same pattern as T650.1) and stored in the Zustand editor
store as `requestSave`, so React components can read it via
`useEditorStore(s => s.requestSave)`.

**Callers:**

```typescript
// triggerAutosave (inside initEditor.ts — keeps its race guard + RTE defer):
autosaveTimer = setTimeout(async () => {
  autosaveTimer = null
  const current = provider.getContext()
  if (current.courseId !== snapshot.courseId || current.slideId !== snapshot.slideId) return
  if (isRteActive) return
  await requestSave()                              // ← was: try/catch+setIsSaving+setSaveError+store()
}, AUTOSAVE_DEBOUNCE_MS)

// EditorCanvas saveAndLoad (timeout preserved via option):
if (editor.Commands.isActive('text-edit')) editor.stopCommand('text-edit')
await useEditorStore.getState().requestSave({ timeoutMs: 5000 })

// SaveErrorBanner retry (fixes the missing-isSaving bug automatically):
useEditorStore.getState().requestSave().catch(() => { /* already in state */ })

// useActionsSave (no longer silent):
void useEditorStore.getState().requestSave()

// SimulationEditor (no longer silent):
void useEditorStore.getState().requestSave()
```

**Selected.** Rationale:

1. **Single source of truth for the save recipe.** Future additions (retry
   budget, telemetry, rate-limit) happen in one place.
2. **Automatic fix for the 3 silent-failure sites** (#3, #4, #5 in the
   inventory). Migrating them to `requestSave()` gives them UI state
   management for free.
3. **Zustand DI pattern preserved.** `storageManager.ts` imports neither
   Zustand nor React — it only receives hooks. The Zustand binding lives in
   `initEditor.ts`, next to the existing `StorageContextProvider`
   binding from T645.
4. **Parallel to T650's `hasPendingChanges`.** Both are closures over the
   editor + Zustand, exposed via `initEditor()`'s return and/or the editor
   store. Consistent mental model.
5. **Per-call options (timeout, label) stay typed and minimal.**

### C — Method on the GrapesJS editor itself via monkey-patch

Monkey-patch `editor.store` to include the UI state updates.

**Rejected.** Hides the UI-state side effect behind what callers think is a
pure GrapesJS API call. Debugging confused: "why does `editor.store()` also
flip `isSaving`?". Also: GrapesJS's own internals call `editor.store()`
(autoload/autosave disabled — but future upgrades might re-introduce internal
calls). Conflating the two is fragile.

### D — Custom hook `useRequestSave()`

```typescript
function useRequestSave() {
  const editor = useEditorStore(s => s.editor)
  const setIsSaving = useEditorStore(s => s.setIsSaving)
  const setSaveError = useEditorStore(s => s.setSaveError)
  return useCallback(async (opts) => { /* ... */ }, [editor, setIsSaving, setSaveError])
}
```

**Rejected.** `initEditor.ts` and `useActionsSave.ts` are outside the React
render tree (they're non-component modules or effect callbacks). A hook
cannot be used in those call sites. Forcing the hook pattern would split the
API: hook for components, raw function for non-components — defeating the
unification goal.

---

## Selected Design — Option B

### Layer 1: `storageManager.ts` (new export)

```typescript
export interface SaveHooks {
  /** Called synchronously before editor.store() is invoked. */
  onStart?: () => void
  /** Called after editor.store() resolves successfully. */
  onSuccess?: () => void
  /** Called after editor.store() rejects, with a narrowed message string.
   *  The error is also re-thrown so the caller can observe it if needed. */
  onError?: (message: string) => void
  /** Optional timeout in milliseconds. If exceeded, editor.store() is
   *  abandoned and a timeout Error is thrown. */
  timeoutMs?: number
}

export async function performSave(editor: Editor, hooks: SaveHooks = {}): Promise<void> {
  hooks.onStart?.()
  try {
    const promise = editor.store() as Promise<unknown>
    if (hooks.timeoutMs !== undefined) {
      await Promise.race([
        promise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`[storageManager] store() timed out after ${hooks.timeoutMs}ms`)), hooks.timeoutMs)
        ),
      ])
    } else {
      await promise
    }
    hooks.onSuccess?.()
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Save failed'
    hooks.onError?.(msg)
    throw err
  }
}
```

Pure function. No Zustand, no React. Testable with a mock `editor.store`.

### Layer 2: `initEditor.ts` (new closure)

```typescript
interface RequestSaveOptions {
  timeoutMs?: number
}

const requestSave = async (opts: RequestSaveOptions = {}): Promise<void> => {
  const { setIsSaving, setSaveError } = useEditorStore.getState()
  return performSave(editor, {
    onStart: () => { setIsSaving(true); setSaveError(null) },
    onSuccess: () => { setIsSaving(false) },
    onError: (msg) => { setIsSaving(false); setSaveError(msg) },
    timeoutMs: opts.timeoutMs,
  })
}
```

Returned from `initEditor()` → `{ editor, cleanup, hasPendingChanges, requestSave }`.

### Layer 3: Zustand editor store (new field)

```typescript
interface EditorState {
  // ... existing fields
  requestSave: ((opts?: { timeoutMs?: number }) => Promise<void>) | null
  setRequestSave: (fn: EditorState['requestSave']) => void
}
```

Set in `EditorCanvas.onReady` alongside `setEditor(ed)`. Cleared in Effect 1
cleanup via `setRequestSave(null)`.

### Migration plan (subtasks)

| Sub | File | Change |
|---|---|---|
| T651.2 | `initEditor.ts` | `triggerAutosave` callback calls `requestSave()` instead of the inline try/catch/finally block. Race guard + RTE defer stay in place. |
| T651.3 | `EditorCanvas.tsx` | `saveAndLoad` calls `useEditorStore.getState().requestSave({ timeoutMs: 5000 })`. `stopCommand('text-edit')` stays inline (it's pre-save flush, not part of the save recipe). |
| (bonus) | `SaveErrorBanner.tsx` | Replace direct `editor.store()` call with `useEditorStore.getState().requestSave()` — fixes the missing `setIsSaving` bug. |
| (bonus) | `useActionsSave.ts` | Replace `void editor.store().catch(...)` with `void useEditorStore.getState().requestSave()` — fixes silent failure. |
| (bonus) | `SimulationEditor.tsx` | Same migration as `useActionsSave.ts`. |
| T651.4 | tests | Update the four mock-UI-state test harnesses; add new tests for `performSave` (unit, no editor) and `requestSave` (wiring + timeout). |

The three "bonus" sites are not in the T651.x list but are strictly in scope
for the goal "`storageManager` should be the only component that knows HOW to
save" — they are migrated in T651.2/T651.3's same PR to avoid the drift
problem re-asserting itself the moment the feature lands.

---

## Guardrails (all binding)

1. **`storageManager.ts` remains Zustand-free and React-free.** Only the
   `performSave` primitive lives there. All Zustand wiring is in
   `initEditor.ts`.

2. **Race guard stays in `triggerAutosave`.** The snapshot-vs-current context
   comparison and the `isRteActive` defer are specific to the debounce
   lifecycle, not to save mechanics. They must NOT migrate into
   `performSave` or `requestSave`.

3. **`stopCommand('text-edit')` stays in `saveAndLoad`.** Flushing the RTE
   buffer before a save is a caller responsibility, not part of the save
   recipe. It is called unconditionally before the pre-nav save; autosave
   handles this implicitly via `isRteActive` defer.

4. **No forced synchronous save.** T650's constraints are unchanged.
   `requestSave` is async; `beforeunload` continues to use the dirty-state
   warning pattern, not `requestSave`.

5. **Timeout semantics.** Only the pre-navigation call passes `timeoutMs`.
   Autosave continues without a timeout (it has no deadline — the debounce
   already gates frequency, and a hanging save is caught by the banner).

6. **`requestSave === null` safety.** Components read `requestSave` from
   Zustand; it is `null` until the editor is ready. Call sites must
   null-check (or the store method must be a no-op when null). The latter is
   chosen: if `requestSave` is null the call resolves immediately — this
   matches the current behaviour of `editor?.store()` being skipped.

7. **The `editor.store()` → `storageManager.store()` path is unchanged.**
   T651 is a *wrapping* refactor: the GrapesJS StorageManager contract and
   the `performSave(editor)` internals still call `editor.store()`.

---

## Consequences

### Benefits

- One authoritative save entry point. Future additions (metrics, retry
  budget, etc.) land in one file.
- Three silent-failure sites (SaveErrorBanner retry, useActionsSave,
  SimulationEditor) automatically gain `isSaving` / `saveError` feedback —
  fixing a regression that has shipped undetected since v0.5.20.
- Test surface reduced: four redundant UI-state mock harnesses collapse to
  one.
- Dependency-inversion invariants from T645 preserved.

### Costs

- One new Zustand field (`requestSave`). Marginal.
- Callers must read `requestSave` from the store instead of calling
  `editor.store()` directly. Grep for `editor.store(` must go to zero
  outside `storageManager.ts` and `initEditor.ts`.
- `requestSave` is nullable until the editor is ready — null-safe at
  all call sites.

### Reversibility

High. `performSave` is a pure function with a stable signature; if a future
task needs to remove the Zustand binding, it lifts cleanly. Call sites can
re-inline `editor.store()` if the unification ever becomes a liability (not
expected).
