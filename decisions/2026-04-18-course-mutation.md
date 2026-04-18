# Decision: Unify course meta-operations behind a single `requestCourseMutation()` entry point

**Date:** 2026-04-18
**Task:** TD-007
**Status:** Accepted (delivered v0.5.59 — commits `769a12a` refactor + `4cd6bb8` null-window fix)
**Author:** self (Phase 10 tech-debt)
**Supersedes/Extends:** [`2026-04-17-request-save.md`](./2026-04-17-request-save.md) (T651)

---

## Context

`T651` unified the **slide-widget persistence** path (`editor.store()` → GrapesJS ↔ `PATCH /courses/:id/slides/:slideId`) behind one `requestSave()` entry point and explicitly scoped out **course meta-operations** — the REST-level calls that return the whole course document (add/delete slide, update settings, rename, reorder, duplicate).

That scoping created the drift TD-007 now attacks.

### Current call-site inventory (8 sites; audited 2026-04-18)

| # | File | Handler | API | Local flag | Global `setIsSaving` | `bumpCacheVersion` | `setSaveError` | Toast |
|---|---|---|---|---|---|---|---|---|
| 1 | `TopToolbar.tsx` | `handleNewSlide` | `addSlide` | — | ✅ | ✅ | ✅ | `error` |
| 2 | `TopToolbar.tsx` | `handleDeleteSlide` | `deleteSlide` | — | ✅ | ✅ | ✅ | `error` |
| 3 | `TopToolbar.tsx` | `handleSaveSettings` | `updateCourse` | — | ✅ | ✅ | ✅ | `error` |
| 4 | `SlideList.tsx` | `handleAddSlide` | `addSlide` | `isAdding` | ❌ | ✅ | ✅ | `error` |
| 5 | `SlideList.tsx` | `handleDuplicate` | `duplicateSlide` | `isProcessing` | ❌ | ✅ | ✅ | `warning` |
| 6 | `SlideList.tsx` | `handleDelete` | `deleteSlide` | `isProcessing` | ❌ | ✅ | ✅ | `warning` |
| 7 | `SlideList.tsx` | `commitRename` | `updateSlide` | `isProcessing` | ❌ | **❌ bug** | ✅ | `warning` |
| 8 | `SlideList.tsx` | `handleDrop` | `reorderSlides` | — | ❌ | **❌ bug** | ✅ | `warning` |

### Observed drift — not just duplication, real inconsistencies

1. **`SaveErrorBanner` never reflects SlideList operations.** `isSaving` is global Zustand state; TopToolbar updates it, SlideList does not. The user gets spinner feedback for add/delete from the toolbar but not for drag-reorder, rename, or duplicate from the sidebar. Same underlying save, asymmetric UI — unified surface is the whole point of `SaveErrorBanner`.
2. **Cache invalidation bug (latent).** `commitRename` (#7) and `handleDrop` (#8) mutate the course but never call `bumpCacheVersion()`. `storageManager`'s `courseCache` keyed by course ID holds the pre-mutation slide list. A subsequent `editor.load()` (triggered by a slide switch) could reconstruct canvas from stale cache → user sees the old title or old order. No test covers this path because it requires a navigation between the mutation and a load that hits the cache — exactly the kind of interaction integration tests miss.
3. **Toast severity inconsistent.** Same failure class → `toast.error` in TopToolbar but `toast.warning` in SlideList. The user perceives "it failed" vs "probably fine" for identical error conditions.
4. **Three local flag variants.** `isAdding` (SlideList #4), `isProcessing` (SlideList #5/6/7), none (SlideList #8). No test can tell which of these is the canonical "operation in flight" signal.

### Out of scope (deliberately)

- **Post-success side effects** (`setCourse`, `setCurrentSlideIndex`, `setEditingId(null)`, clearing `dragIndex`/`dropIndex`) stay per-operation. These are genuine business logic — `commitRename` doesn't touch `currentSlideIndex`, `handleAddSlide` jumps to the new last slide, `handleDelete` clamps to `min(index, slides.length - 1)`, `handleDrop` uses `adjustedDropIndex`. Forcing these into a shared helper would either require callbacks (drift moves from UI state to post-success logic) or encode operation-specific rules in a central registry (over-abstraction). Keep them local.
- **`courseApi.ts`.** Pure REST client — unchanged.
- **Tests for items #7/#8 cache bug independent of this refactor.** The new helper bumps cache by default; the bug gets fixed for free, no separate test needed beyond the existing cache-invalidation unit tests in `storageManager.test.ts`. If a future consumer opts out of `bumpCache`, we document *why* at the call site.

---

## Options Evaluated

### A — Per-operation wrappers: `requestAddSlide`, `requestDeleteSlide`, `requestUpdateSettings`, `requestRenameSlide`, `requestReorderSlides`, `requestDuplicateSlide`

Each wrapper takes the specific API arguments, internally calls `courseApi.X`, and handles UI state + cache + setCourse + any operation-specific side effect.

```typescript
// Exported from a new module
export async function requestAddSlide(courseId: string, title: string): Promise<CourseDoc | undefined> {
  const { setIsSaving, setSaveError, setCourse, bumpCacheVersion } = useEditorStore.getState()
  setIsSaving(true); setSaveError(null)
  try {
    const updated = await addSlide(courseId, title)
    bumpCacheVersion()
    setCourse(updated)
    return updated
  } catch (err) {
    setSaveError(err instanceof Error ? err.message : String(err))
    return undefined
  } finally {
    setIsSaving(false)
  }
}
```

**Pros**
- Call sites shrink to 2–3 lines: `const updated = await requestAddSlide(id, title); if (updated) setCurrentSlideIndex(...)`.
- Each wrapper is easy to test in isolation.
- Impossible to forget `bumpCacheVersion()` — baked into the wrapper.

**Cons**
- 6 wrappers. Every new course-meta operation requires another wrapper (minor, but a new line of drift surface).
- Encodes `setCourse(updated)` inside the wrapper, which some callers may want to skip (`handleDrop` succeeds mid-drag and needs `setCurrentSlideIndex(adjustedDropIndex)` AFTER `setCourse` — currently no site needs this, but it's a design constraint).
- Slight inconsistency with T651's design: T651 has ONE `requestSave` (not per-callsite wrappers). A parallel "one generic helper" design would be more predictable.

### B — Two-layer mirror of T651: pure `performCourseMutation` + Zustand-bound `requestCourseMutation<R>(apiCall)` ✅ Selected

Exact parallel to T651:

**Layer 1** — pure function in a new module (`lib/courseMutation.ts`), no Zustand/React dependency:

```typescript
export interface CourseMutationHooks {
  onStart?: () => void
  onSuccess?: () => void
  onError?: (message: string) => void
}

export async function performCourseMutation<R>(
  apiCall: () => Promise<R>,
  hooks: CourseMutationHooks = {},
): Promise<R | undefined> {
  hooks.onStart?.()
  try {
    const result = await apiCall()
    hooks.onSuccess?.()
    return result
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    hooks.onError?.(msg)
    return undefined
  }
}
```

**Layer 2** — Zustand-bound closure constructed once in `initEditor.ts` (or a parallel module that initialises course-meta plumbing — details in the design section), stored in the editor store:

```typescript
interface RequestCourseMutationOptions {
  bumpCache?: boolean  // default true
}

const requestCourseMutation = async <R>(
  apiCall: () => Promise<R>,
  opts: RequestCourseMutationOptions = {},
): Promise<R | undefined> => {
  const { setIsSaving, setSaveError, bumpCacheVersion } = useEditorStore.getState()
  return performCourseMutation(apiCall, {
    onStart: () => { setIsSaving(true); setSaveError(null) },
    onSuccess: () => {
      if (opts.bumpCache !== false) bumpCacheVersion()
      setIsSaving(false)
    },
    onError: (msg) => { setIsSaving(false); setSaveError(msg) },
  })
}
```

Callers receive the API result and stay in control of the post-success side effects:

```typescript
// TopToolbar.handleNewSlide — was 14 lines, now 5
async function handleNewSlide() {
  if (!course) return
  const requestCourseMutation = useEditorStore.getState().requestCourseMutation
  const updated = await requestCourseMutation(() => addSlide(course._id, nextSlideTitle(course.slides)))
  if (updated) setCurrentSlideIndex(updated.slides.length - 1)
}

// SlideList.handleDrop — was 20 lines, now ~14 (keeps dragIndex clearing logic)
async function handleDrop(e: React.DragEvent) {
  /* … drag index maths unchanged … */
  const requestCourseMutation = useEditorStore.getState().requestCourseMutation
  const updated = await requestCourseMutation(() => reorderSlides(course!._id, ids))
  if (updated) setCurrentSlideIndex(adjustedDropIndex)
}

// SlideList.commitRename — cache bug fixed for free
async function commitRename(slide: Slide) {
  /* … trim + early return unchanged … */
  const requestCourseMutation = useEditorStore.getState().requestCourseMutation
  await requestCourseMutation(() => updateSlide(course!._id, slide.id, { title: trimmed }))
  // setCourse already handled inside; no explicit bumpCacheVersion needed
}
```

Wait — this sketch calls `setCourse(result)` implicitly via the hooks. It doesn't. Let me be precise.

**Selected variant: caller still calls `setCourse(updated)`** explicitly. Rationale: keeping `setCourse` on the caller means the helper is one layer simpler (it doesn't need the Zustand setter for course state, only for `isSaving`/`saveError`/`cacheVersion`) and the caller's control flow is more explicit (no hidden state mutation). Yes, this reintroduces one line per call site — but all 8 callers share this same one line; no drift risk because forgetting `setCourse(updated)` produces an immediately visible bug (stale UI), whereas forgetting `bumpCacheVersion` is invisible until a cache hit (the bug in #7/#8).

```typescript
// TopToolbar.handleNewSlide — final form
async function handleNewSlide() {
  if (!course) return
  const updated = await useEditorStore.getState().requestCourseMutation(
    () => addSlide(course._id, nextSlideTitle(course.slides))
  )
  if (updated) {
    setCourse(updated)
    setCurrentSlideIndex(updated.slides.length - 1)
  }
}
```

**Pros**
- Mirrors T651's design exactly → one mental model for "save" (slide widget) and "mutation" (course REST).
- One generic helper handles all 8 current + any future course-meta operation.
- `bumpCache: false` escape hatch documented in the signature for the hypothetical future case (today none, and the bug fix for #7/#8 falls out automatically).
- Callers receive the typed `R | undefined` — post-success logic stays local, type-narrowed.
- Pure `performCourseMutation` testable without Zustand or React — identical to how `performSave` is tested.

**Cons**
- Callers still write `const rcm = useEditorStore.getState().requestCourseMutation` — three-word lookup per handler. Acceptable boilerplate; matches `requestSave` access pattern.
- `setCourse(updated)` remains at every call site (one line). Tradeoff chosen above — see rationale.

### C — Lightweight HOF `withSaveState(fn)` that only wraps UI state around any promise

```typescript
export async function withSaveState<R>(fn: () => Promise<R>): Promise<R | undefined> {
  const { setIsSaving, setSaveError } = useEditorStore.getState()
  setIsSaving(true); setSaveError(null)
  try {
    return await fn()
  } catch (err) {
    setSaveError(err instanceof Error ? err.message : String(err))
    return undefined
  } finally {
    setIsSaving(false)
  }
}
```

**Rejected.** Minimal abstraction but:
- Does NOT handle `bumpCacheVersion` → the cache bug in #7/#8 stays latent (caller must remember).
- No natural seam for telemetry / retry / rate-limit hooks if we ever need them.
- Divergent design from T651 — split mental model for identical problem class.

### D — Zustand middleware (e.g., computed `isSaving` from an array of in-flight operation IDs)

Rejected. Overengineered for 8 sites; introduces runtime dependencies that the current 100-line `editorStore.ts` does not need. Revisit only if we ever have >50 operations or need per-operation progress indicators.

---

## Selected Design — Option B

### File layout (as delivered)

```
packages/authoring-ui/src/
├── lib/
│   └── courseMutation.ts         # NEW — Layer 1: pure performCourseMutation
├── store/
│   └── editorStore.ts            # MODIFIED — Layer 2 closure lives here as a plain store action
├── components/
│   ├── layout/TopToolbar.tsx     # MODIFIED — migrate 3 sites
│   └── sidebar/SlideList.tsx     # MODIFIED — migrate 5 sites, remove local isAdding/isProcessing flags
└── __tests__/
    ├── lib/courseMutation.test.ts            # NEW — 8 tests for Layer 1 primitive
    ├── store/requestCourseMutation.test.ts   # NEW — 5 tests for the store action
    └── components/...                        # existing tests continue to pass
```

**Post-delivery correction (v0.5.59, commit `4cd6bb8`):** The original draft placed Layer 2 inside `initEditor.ts` (mirroring T651 exactly, with a nullable store field + `setRequestCourseMutation` setter + EditorCanvas Effect 1 registration). That mirror proved incorrect because `requestCourseMutation` has **no editor dependency** — it only uses Zustand setters (`setIsSaving` / `setSaveError` / `bumpCacheVersion`). Coupling it to the editor lifecycle created a null window between app mount and Effect 1 run, during which the 8 caller sites (with their `if (!rcm) return` guard) would silently no-op. The CI E2E fixture `editorPage.addSlide()` clicks the Add Slide button immediately after page load — inside that null window — and timed out waiting for the new slide to appear. Run `24601830271` was cancelled at 27 min after dozens of tests failed at 30 s × 3 retries each.

**Correction:** move the Layer 2 closure into `editorStore.ts` as a plain always-available store action. `requestCourseMutation` is now non-nullable and available from the first render. The 8 caller guards (`if (!rcm) return`) are removed, `EditorCanvas Effect 1` wiring is removed, `initEditor.ts` no longer returns `requestCourseMutation`. Layer 1 (`lib/courseMutation.ts`) and ADR design otherwise unchanged.

**Guardrail learned:** mirroring T651's file layout was the wrong heuristic. T651's Layer 2 belongs in `initEditor.ts` because `performSave(editor, …)` requires the editor. Layer-2 placement should be driven by the Layer 1 primitive's dependencies, not by symmetric appearance.

### Layer 1 — `lib/courseMutation.ts`

```typescript
/**
 * Generic course-meta mutation primitive (TD-007).
 *
 * Calls the given REST operation, narrowing any thrown error to a message
 * string and funnelling UI state via caller-supplied hooks. Returns the API
 * result on success, `undefined` on failure (so the caller can `if (updated) { ... }`
 * without needing try/catch at every call site). Re-throwing is deliberately
 * NOT done — TD-007 call sites do not observe the raw error, only the message.
 *
 * Mirrors the pure-primitive layer of T651's `performSave`. No Zustand/React
 * dependency — testable in isolation.
 */
export interface CourseMutationHooks {
  onStart?: () => void
  onSuccess?: () => void
  onError?: (message: string) => void
}

export async function performCourseMutation<R>(
  apiCall: () => Promise<R>,
  hooks: CourseMutationHooks = {},
): Promise<R | undefined> {
  hooks.onStart?.()
  try {
    const result = await apiCall()
    hooks.onSuccess?.()
    return result
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    hooks.onError?.(msg)
    return undefined
  }
}
```

### Layer 2 — plain store action in `editorStore.ts` (final form)

Defined inline in the Zustand store as a regular action (not a closure returned from `initEditor`, not a nullable field). Always available from the first render.

```typescript
// In editorStore.ts — always-available, never null
requestCourseMutation: async <R>(
  apiCall: () => Promise<R>,
  opts: { bumpCache?: boolean } = {},
): Promise<R | undefined> => {
  const { setIsSaving, setSaveError, bumpCacheVersion } = get()
  return performCourseMutation(apiCall, {
    onStart: () => { setIsSaving(true); setSaveError(null) },
    onSuccess: () => {
      if (opts.bumpCache !== false) bumpCacheVersion()
      setIsSaving(false)
    },
    onError: (msg) => { setIsSaving(false); setSaveError(msg) },
  })
},
```

Default `bumpCache: true` — the invariant. Only opt out via `{ bumpCache: false }` at the rare call site that mutates course metadata which the storage cache does NOT mirror (today: zero such sites — escape hatch kept for future-proofing).

### Layer 3 — Zustand store type (final form)

```typescript
// Non-nullable in the state interface because the action is always present.
requestCourseMutation:
  <R>(apiCall: () => Promise<R>, opts?: { bumpCache?: boolean }) => Promise<R | undefined>
```

No `setRequestCourseMutation` setter, no EditorCanvas wiring, no cleanup on unmount — the action is plain state defined once in `create<EditorState>()({ ... })`.

### Call-site migration pattern (final form)

Every migrated handler follows this shape (proven over all 8 sites after the null-window fix):

```typescript
async function handleX() {
  if (!course) return  // unchanged precondition check

  const updated = await useEditorStore.getState().requestCourseMutation(
    () => courseApi.xxx(course._id, args),
  )
  if (!updated) {
    toast.error(`Failed to X: ${useEditorStore.getState().saveError ?? 'unknown error'}`)
    return
  }

  // Operation-specific post-success side effects:
  setCourse(updated)
  setCurrentSlideIndex(...)       // only where applicable
  /* any other per-op state reset */
}
```

No `if (!rcm) return` guard — the action is always callable. One inline lookup via `useEditorStore.getState().requestCourseMutation(...)`.

Toast remains at each call site because the message ("Failed to add slide" vs "Failed to rename slide") is operation-specific. Toast level is **standardised to `error`** — #5/#6/#7/#8 upgraded from `warning` to `error` to match TopToolbar and match the severity `SaveErrorBanner` already surfaces globally.

### Removal of local flags

- `isAdding` (SlideList) → removed; `useEditorStore(s => s.isSaving)` replaces all uses in render (button disabled state).
- `isProcessing` (SlideList) → removed; same replacement. Per-row action buttons (`⧉`/`✕` in `SlideItem`) receive `disabled={isSaving}`.
- Toolbar spinner / disabled logic already uses global `isSaving` — no change.

### `bumpCacheVersion` bug resolution

Call sites #7 (`commitRename`) and #8 (`handleDrop`) get the cache-version bump automatically from the default `bumpCache: true`. The latent bug closes as a side effect of the refactor; a regression test is added to `courseMutation.test.ts` verifying `bumpCacheVersion` is invoked on success when `bumpCache` is not set to false.

---

## Guardrails (mirroring T651)

1. **Zustand DI purity**: `lib/courseMutation.ts` imports nothing from `store/` or `react`.
2. **No observable semantics change for `courseApi.ts`** — unchanged file.
3. **No change to `SaveErrorBanner`** — it already reads `saveError` from the store; it simply now receives course-meta errors it was missing before.
4. **`isSaving` becomes truly global**: any in-flight operation (autosave OR course-meta) sets it. If autosave and `handleAddSlide` overlap in time, both flip `isSaving(true)` → the last one to resolve flips it off. Acceptable: both are "the course is being mutated remotely", banner shows the same UI state.
5. **Future consumer checklist** added to `08-persistence-flow.md` documenting when to use `requestSave` vs `requestCourseMutation`.

## Tests to add

1. `lib/courseMutation.test.ts` (new, ~8 tests):
   - `performCourseMutation` resolves and calls `onStart` + `onSuccess` on success
   - `performCourseMutation` returns the API result on success
   - `performCourseMutation` returns `undefined` on failure (no throw)
   - `performCourseMutation` narrows non-Error throws to `String(err)`
   - `performCourseMutation` calls `onError` with the narrowed message
   - `performCourseMutation` works with no hooks object (all optional)
   - Order guarantee: `onStart` fires BEFORE `apiCall` is awaited
   - Order guarantee: `onSuccess` / `onError` fires AFTER `apiCall` settles
2. `store/requestCourseMutation.test.ts` (new, 5 tests against the live store):
   - success path transitions `isSaving: false → true → false` and bumps `cacheVersion`
   - `{ bumpCache: false }` success path leaves `cacheVersion` unchanged
   - error path populates `saveError`, leaves `cacheVersion` unchanged, returns `undefined`
   - **regression guard**: `requestCourseMutation` is always a function (never null) — this is the test that would have caught the null-window bug had it existed before the refactor
   - non-Error throws are narrowed via `String(err)`
3. `SlideList.test.tsx` / `sidebar/SidebarPanels.test.tsx` — no mock-closure installation needed; tests exercise the live store action against mocked `courseApi`.

## Risks & rollback

- **Risk**: a third place (e.g., a future PublishDialog save path) starts duplicating the pattern anyway. **Mitigation**: `08-persistence-flow.md` guidance + "new course-meta operation? use `requestCourseMutation`" checklist.
- **Risk**: the `bumpCache: false` escape hatch gets used as a shortcut and re-introduces the bug it just fixed. **Mitigation**: ESLint comment at the option's definition saying "If you need `bumpCache: false`, document why at the call site" — enforceable via code review, not tooling.
- **Rollback**: pure additive change (new module + new store field + migrations). If a regression lands, revert the 3 commits; local flags and duplicated `setIsSaving`/`setSaveError` blocks come back.
