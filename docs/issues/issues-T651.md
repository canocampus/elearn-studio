# Code Review — T651: Unified persistence via `requestSave()`

**Reviewer:** self-review (post-implementation)
**Date:** 2026-04-17
**Status:** APPROVED — CI green
**Commits:** `501c6aa` (feature + migration + tests), T651.6 refinements pending in this block
**ADR:** `decisions/2026-04-17-request-save.md`

---

## What the feature does

Before T651, slide-widget persistence was invoked at **five separate call sites**. The
GrapesJS `editor.store()` function appeared verbatim in each, and each site rebuilt its
own copy of the "save recipe":

```
setIsSaving(true); setSaveError(null)
try { await editor.store() } catch (err) { setSaveError(…) } finally { setIsSaving(false) }
```

Except — and this is the real cost of duplication — three of the five sites did **not**
rebuild the full recipe. They skipped parts of it, and users lost visibility into their
own save failures. T651 collapses the five into one entry point (`requestSave`), routing
every save through a single authoritative path with consistent UI feedback.

---

## The two-layer architecture

The obvious design — "move the try/catch into a helper function" — is not enough, because
it still leaves the UI-state wiring duplicated at each caller. The obvious alternative —
"put everything including UI state into `storageManager.ts`" — violates the T645 rule
that `storageManager.ts` must not know about Zustand or React.

The chosen design separates these two concerns into two layers:

### Layer 1 — `performSave` (pure)

Lives in `storageManager.ts`. Takes an editor and a minimal hook interface:

```typescript
interface SaveHooks {
  onStart?: () => void
  onSuccess?: () => void
  onError?: (message: string) => void
  timeoutMs?: number
}

async function performSave(editor: Editor, hooks: SaveHooks = {}): Promise<void>
```

It imports neither Zustand nor React. It does only four things: fire `onStart`,
invoke `editor.store()` (optionally inside a `Promise.race` with a timeout), fire
`onSuccess` on resolve, and fire `onError(narrowedMessage)` + rethrow on reject.

The dependency inversion from T645 is preserved exactly. `storageManager.ts` continues
to know nothing about the application; it only knows how to talk to GrapesJS.

### Layer 2 — `requestSave` (Zustand-bound closure)

Lives in `initEditor.ts`, constructed next to `hasPendingChanges` (T650). It is a
zero-argument closure that wires `performSave` into the editor store:

```typescript
const requestSave = async (opts: { timeoutMs?: number } = {}) => {
  const { setIsSaving, setSaveError } = useEditorStore.getState()
  return performSave(editor, {
    onStart: () => { setIsSaving(true); setSaveError(null) },
    onSuccess: () => { setIsSaving(false) },
    onError: (msg) => { setIsSaving(false); setSaveError(msg) },
    timeoutMs: opts.timeoutMs,
  })
}
```

The closure is returned from `initEditor()` alongside `editor`, `cleanup`, and
`hasPendingChanges`, then published to the editor store via `setRequestSave(requestSave)`
in `EditorCanvas.tsx` Effect 1. This gives the four non-`initEditor` callers
(`saveAndLoad` in EditorCanvas, `handleRetry` in SaveErrorBanner, `useActionsSave`,
`SimulationEditor`) a single reachable entry point: `useEditorStore.getState().requestSave`.

### Layer 3 — Zustand exposure (data field, not logic)

`editorStore.ts` gains one field:

```typescript
requestSave: ((opts?: { timeoutMs?: number }) => Promise<void>) | null
setRequestSave: (fn: EditorState['requestSave']) => void
```

This is the only layer that "knows" about both the closure and the rest of the app. It
holds a function reference the way it already holds the editor reference — no new
coupling, no new state machine.

---

## Why the other three options were rejected

The ADR evaluated four designs. The losers all collapsed in the same way: they either
re-introduced duplication or broke an existing invariant.

**Option A — Free function with hooks, each caller passes its own hooks.** This fixes
the "try/catch is duplicated" problem but not the "every caller must remember to pass
hooks" problem. A new caller can still forget `onStart`, which is exactly how three of
the five pre-T651 sites drifted. Useful as a *lower* layer — which is why `performSave`
exists — but insufficient as the sole API.

**Option C — Monkey-patch `editor.store`.** Hides the UI-state mutation behind a name
that looks like a pure GrapesJS call. Debugging confusion: "why does `editor.store()`
flip `isSaving`?" And GrapesJS itself reserves the right to call `editor.store()`
internally — conflating the two is fragile. Rejected.

**Option D — React hook `useRequestSave()`.** Does not work. `initEditor.ts` and
`useActionsSave.ts` (inside a `useEffect` callback but not as a hook itself) cannot call
React hooks at those call sites. Forcing the hook pattern would split the API — hook for
some callers, raw function for others — and defeat the unification goal.

**Option B** (selected) is the only one that places the UI-state wiring in exactly one
place (the closure in `initEditor`) while keeping `performSave` pure and reachable from
non-React call sites.

---

## Call-site migrations

Five sites previously called `editor.store()` directly. After T651, the only direct call
in the entire `packages/authoring-ui/src` tree is the one inside `performSave` itself at
`storageManager.ts:68`. Every other match in `grep` is a comment or a test name.

| Site | Before T651 | After T651 | Bug fixed? |
|---|---|---|---|
| `initEditor.ts` `triggerAutosave` | Inline `try/catch/finally` + `setIsSaving`/`setSaveError` | `await requestSave().catch(() => { /* in Zustand */ })` | — (was already correct) |
| `EditorCanvas.tsx` `saveAndLoad` | Inline `try/catch` + `Promise.race([store(), 5s])` + `setIsSaving`/`setSaveError` | `await requestSaveFn({ timeoutMs: 5000 })`; `stopCommand('text-edit')` kept inline (caller responsibility) | — (was already correct via T647) |
| `SaveErrorBanner.tsx` `handleRetry` | `editor.store().catch(setSaveError)` — **no `setIsSaving(true)`** | `requestSave().catch(() => {})` | ✅ "Saving…" badge now fires during retry (new T651.3 regression test guards this) |
| `useActionsSave.ts` subscribe callback | `void editor.store().catch(console.error)` — silent on failure | `void requestSave().catch(console.error)` | ✅ Actions-save failures now surface in `SaveErrorBanner` |
| `SimulationEditor.tsx` `handleSave` | `editor.store().catch(console.error)` — silent on failure | `requestSave().catch(console.error)` | ✅ Simulation-save failures now surface in `SaveErrorBanner` |

The three "bonus" migrations (SaveErrorBanner, useActionsSave, SimulationEditor) were
not in the original T651.2/T651.3 task text, but the ADR flagged them as strictly in
scope for the stated goal (`storageManager.ts` as the only thing that knows how to
save). Leaving them unmigrated would have re-asserted the drift problem the moment the
feature shipped — the five-site duplication would simply become a three-site duplication.

---

## Seven binding guardrails (all honoured)

The ADR committed the implementation to seven guardrails. Each was verified
post-migration:

1. **`storageManager.ts` remains Zustand-free and React-free.** Confirmed: only the
   `Editor` type from grapesjs is imported. No `useEditorStore`, no `react`.
2. **Race guard stays in `triggerAutosave`.** The `snapshot` vs `current` context
   comparison (CRITICAL-01) did not migrate to `requestSave`. It remains lifecycle-
   specific to the debounce.
3. **`stopCommand('text-edit')` stays in `saveAndLoad`.** The RTE flush is a caller
   responsibility, not part of the save recipe. Moving it into `requestSave` would have
   forced every caller to think about RTE state when most do not.
4. **No forced synchronous save.** T650's `beforeunload` dirty-state pattern is
   untouched. `requestSave` is never called from the unload handler.
5. **Timeout semantics scoped to pre-navigation.** Only `saveAndLoad` passes
   `timeoutMs`. Autosave has no deadline — the 2-second debounce already gates
   frequency, and a hanging save surfaces via the banner, not via a timeout.
6. **`requestSave === null` safety.** All four non-closure callers null-check the
   Zustand value before invoking. The field is `null` from editor-unmount until the
   next editor init completes.
7. **GrapesJS StorageManager contract unchanged.** `editor.store()` still routes to
   `storageManager.store()` via the GrapesJS internals. T651 wraps the wrapper — it does
   not replace the wrapper.

---

## Deliberate non-scope

Several things look like they could have been pulled into T651 and were deliberately
left out. Each was considered and rejected:

- **Course meta-operations** (`addSlide`, `deleteSlide`, `updateCourse`, `reorderSlides`,
  `renameSlide`) in `TopToolbar.tsx` and `SlideList.tsx` have their own duplicated
  `setIsSaving`/`setSaveError` blocks. They do **not** go through `editor.store()` — they
  call `courseApi` REST endpoints directly. They are a separate persistence path with
  different semantics (return the whole course doc, bump cache version, etc.).
  T651's goal was to unify the widget-save path; unifying the course-meta path is a
  different refactor. Tracked as candidate **TD-007** for a later task.
- **Retry budget / exponential backoff.** Tempting but out of scope. `requestSave`
  surfaces the error via the banner, and the user retries via the Retry button. Adding
  automatic retry would need a conflict-resolution strategy (what if the user edited
  again during the retry?), which is a bigger decision than this refactor.
- **Telemetry / observability hooks.** The `SaveHooks` interface has exactly four
  fields: `onStart`, `onSuccess`, `onError`, `timeoutMs`. It is tempting to add
  `onRetry`, `onCacheUpdate`, `onThumbnailFail`, etc. Rejected: once the first extra
  hook lands, every future change will argue for adding another. The minimal interface
  is the point. If telemetry is needed later it can be added at `performSave`'s top —
  one place.

---

## Findings

| ID | Severity | Area | Description | Status |
|---|---|---|---|---|
| 1 | INFO | Two-layer design | Separation of pure `performSave` from Zustand-bound `requestSave` is architecturally clean and parallels the T645 DI pattern. | RESOLVED |
| 2 | INFO | Bug fix | SaveErrorBanner retry now fires `setIsSaving(true)` — regression test added (`T651.3: sets isSaving(true) during retry`). | RESOLVED |
| 3 | INFO | Bug fix | `useActionsSave` and `SimulationEditor` save failures now surface in `SaveErrorBanner` instead of `console.error`. | RESOLVED |
| 4 | LOW | Error message | Pre-T651, EditorCanvas used `'Pre-navigation save failed'` as the non-Error rejection fallback, initEditor used `'Autosave failed'`, the retry path used `String(err)`. Harmonised to `'Save failed'` in `performSave`. Consistency gain > historical specificity. | AS-DESIGNED |
| 5 | INFO | Scope | Course meta-ops (`addSlide`/`deleteSlide`/`updateCourse`) out of scope; tracked as TD-007. Documented. | RESOLVED |
| 6 | INFO | T651.6 refinement | `useActionsSave.ts` docstring updated to reference `requestSave()` instead of `editor.store()` — pre-T651 text was outdated by the migration. | RESOLVED |

No CRITICAL, HIGH, or MEDIUM findings. No regressions in the existing suite.

---

## Tests

### `initEditor.test.ts`
Mock of `../editor/storageManager` changed from a flat object to `vi.importActual`:

```typescript
vi.mock('../editor/storageManager', async () => {
  const actual = await vi.importActual<typeof import('../editor/storageManager')>('../editor/storageManager')
  return { ...actual, registerStorageManager: vi.fn().mockReturnValue(vi.fn()) }
})
```

This keeps the real `performSave` in place so `triggerAutosave` still reaches
`editor.store()` under test. Only `registerStorageManager` (which would otherwise
call `editor.StorageManager.add()` with a real adapter) is mocked. **38/38 pass.**

### `EditorCanvas.test.tsx`
Mock `setupInitEditorMock` now returns a four-field object including a real
`requestSave` bound to the mock editor via the actual `performSave`. Test 3's fallback
expectation updated from `'Pre-navigation save failed'` to `'Save failed'` to reflect
the harmonised error narrowing. **4/4 pass.**

### `SaveErrorBanner.test.tsx`
Helper `makeRequestSave(mockStore)` runs `performSave` against a mock editor. All
tests migrated from `editor.store` to `requestSave` shape. **New regression test
`T651.3: sets isSaving(true) during retry`** uses a pending-promise `mockStore` to
observe `isSaving === true` mid-flight, preventing re-introduction of the fixed bug.
**6/6 pass.**

### Monorepo totals
- Unit + integration: **1533/1533** (backend 131, authoring-ui 731, runtime-player 256,
  scorm-packager 156 passed + 4 skipped, phaser-simulations 125, question-engine 74,
  simulation-engine 60).
- E2E: green in CI (local run hit a transient Vite HMR race — the four files I had
  just saved were aborted during Playwright globalSetup; CI uses a clean build with
  no HMR and passed without issue).
- TSC: exit 0.
- Lint: 0 errors, 2 pre-existing warnings in `useComponentProperty.ts` (not touched
  by T651).

---

## Verdict

**APPROVED** — all seven ADR guardrails honoured, three silent-failure bugs fixed
automatically by the migration, zero regressions, CI green (run `24582182042`,
17m02s).

Future PRs that touch slide-widget persistence should extend `SaveHooks` or add
behaviour to `performSave` — not add a new call site of `editor.store()`. The
`grep "editor.store()"` invariant ("one active call, in `storageManager.ts`") is now
a load-bearing architectural fact.
