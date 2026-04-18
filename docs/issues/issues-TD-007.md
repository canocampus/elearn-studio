# Self-Review — TD-007: Unify course meta-operations save path

**Status:** RESOLVED (CI green, both commits merged)
**Date:** 2026-04-18
**Version:** v0.5.59
**Commits:** `769a12a` (refactor + 8-site migration) + `4cd6bb8` (null-window fix after CI E2E regression)
**CI:** run `24602663078` — 17m 08s, all 27 steps green
**ADR:** [`decisions/2026-04-18-course-mutation.md`](../../decisions/2026-04-18-course-mutation.md)
**Extends:** T651 (slide-widget save unification)

---

## Summary

T651 unified the **slide-widget** persistence path (`editor.store()` → backend) behind one `requestSave()` entry point. TD-007 does the parallel unification for **course meta-operations** (`addSlide`, `deleteSlide`, `updateCourse`, `duplicateSlide`, `reorderSlides`, `updateSlide`) via a new `requestCourseMutation()` closure.

Scope: 8 call sites across `TopToolbar.tsx` (3) and `SlideList.tsx` (5). Every site previously duplicated a `setIsSaving`/`setSaveError`/`bumpCacheVersion`/`try-catch`/`setCourse` recipe with 4 documented drift variants.

## Findings (all resolved)

### [RESOLVED] D-01 Asymmetric `isSaving` surface

**Problem.** `TopToolbar` sites flipped the global `isSaving` Zustand flag; `SlideList` sites did not. `SaveErrorBanner` and the "Saving…" badge surfaced feedback for toolbar operations but NOT for sidebar drag-reorder, rename, or duplicate.

**Resolution.** Both layers now route through `requestCourseMutation`, whose Layer 2 closure always flips `setIsSaving(true)` on start and `setIsSaving(false)` on success/error. `SaveErrorBanner` is now the single source of truth for every course-meta save failure.

**Regression coverage.** `initEditor.test.ts` → TD-007.1 / TD-007.3 verify `setIsSaving` transitions on success and error paths.

### [RESOLVED] D-02 Cache invalidation bug in rename + reorder

**Problem.** `SlideList.commitRename` (#7) and `SlideList.handleDrop` (#8) mutated the course via `updateSlide` / `reorderSlides` but never invoked `bumpCacheVersion()`. `storageManager.courseCache` (keyed by course ID) held the pre-mutation slide list. A subsequent `editor.load()` triggered by a slide switch would reconstruct the canvas from stale cache → the user sees the old title or old order. No integration test covered the path.

**Resolution.** `requestCourseMutation` invokes `bumpCacheVersion()` by default (`opts.bumpCache !== false`). Both #7 and #8 now route through the closure with default options → cache bump is guaranteed.

**Design**. The `{ bumpCache: false }` escape hatch is kept for future callers that may mutate metadata the cache does not mirror — no current site uses it.

**Regression coverage.** `initEditor.test.ts` → TD-007.1 asserts `bumpCacheVersion` is called on success; TD-007.2 asserts `{ bumpCache: false }` correctly skips the bump.

### [RESOLVED] D-03 Inconsistent toast severity

**Problem.** Identical failure conditions (course-meta REST error) produced `toast.error` in TopToolbar and `toast.warning` in SlideList. User perception of severity was arbitrary by component of origin.

**Resolution.** All 5 SlideList sites upgraded from `warning` to `error`, matching TopToolbar and matching the global `SaveErrorBanner` which has no "warning" variant.

### [RESOLVED] D-04 Three local-flag variants for in-flight state

**Problem.** `SlideList.tsx` used `isAdding` (#4 only), `isProcessing` (#5/#6/#7 shared), or no local flag (#8). Three variants of "operation in flight" — each gating different interactions. No test could tell which flag was canonical.

**Resolution.** All local flags removed. The global `useEditorStore(s => s.isSaving)` selector replaces them at every UI consumer (Add Slide button, per-row action buttons via `isBusy` prop). Child `SlideItem` prop renamed `isProcessing` → `isBusy` for clarity.

**Grep check.** `grep -rn "isAdding\|isProcessing" packages/authoring-ui/src/` returns 0 matches.

## Post-mortem — null-window regression caught by CI E2E (`769a12a` → `4cd6bb8`)

### What happened

The first push (`769a12a`) placed the Layer 2 closure inside `initEditor.ts`, registered it in the store via `setRequestCourseMutation(requestCourseMutation)` inside `EditorCanvas` Effect 1, and nulled it on cleanup. Pattern mirrored T651's `requestSave` exactly.

CI run `24601830271` **cancelled at 27 min** (vs 17 min historical baseline). Lint, unit/integration, build, coverage, Playwright install, servers-up: all green. The failure was concentrated in the E2E step: dozens of tests timed out at 30 s × 3 retries each, cascading until GitHub Actions killed the step.

### Root cause

The 8 call sites in `TopToolbar.tsx` / `SlideList.tsx` carried an `if (!rcm) return` defensive guard because the store field was typed `((apiCall, opts?) => Promise<R | undefined>) | null`. Between app mount and `EditorCanvas` Effect 1 running, the field was `null` — a **null window** during which any button click silently no-op'd.

The E2E fixture `editorPage.addSlide()` in `T608.2.beforeEach` (and similar patterns across the spec suite) clicked the Add Slide button immediately on page load — inside that null window. The handler returned without calling `addSlide()`. The test then waited 30 s for a new slide to appear, retried twice, and reported three failures per test. Snowball across specs → 27 min → GH Actions timeout.

### Fix (commit `4cd6bb8`)

Move `requestCourseMutation` from an editor-scoped closure to a **plain always-available store action**:

- Layer 2 now lives directly inside `editorStore.ts`'s `create<EditorState>()({ ... })` as a regular action body. It references `get()` for the setters (`setIsSaving`, `setSaveError`, `bumpCacheVersion`) — none of which require the editor.
- Store field type is non-nullable: `requestCourseMutation: <R>(apiCall, opts?) => Promise<R | undefined>`. No `setRequestCourseMutation` setter, no EditorCanvas wiring, no cleanup on unmount.
- `initEditor.ts` no longer imports `performCourseMutation` and no longer returns `requestCourseMutation`.
- All 8 call sites drop the `if (!rcm) return` guard. One call reduces from 4 lines of setup to 1: `const updated = await useEditorStore.getState().requestCourseMutation(() => courseApi.xxx(...))`.

### Why the mirror-T651 heuristic was wrong

T651's Layer 2 (`requestSave`) must live in `initEditor.ts` because `performSave(editor, …)` needs the GrapesJS editor. TD-007's Layer 2 (`requestCourseMutation`) does NOT need the editor — only Zustand setters. **Placement should follow the Layer 1 primitive's dependencies, not symmetric file layout.**

The ADR's original draft treated "mirror T651" as a design goal rather than a consequence; the mistake was using layout-similarity as a heuristic without re-checking the dependency graph.

### Regression-proofing

`store/requestCourseMutation.test.ts` now includes this explicit guard:

```typescript
it('is always available immediately (no null window)', () => {
  // Regression guard: the original TD-007 design had a null window between
  // app mount and EditorCanvas Effect 1 registering the closure. That caused
  // silent no-ops in TopToolbar / SlideList click handlers. The store action
  // fixes this by being plain state, not a lifecycle-bound closure.
  const rcm = useEditorStore.getState().requestCourseMutation
  expect(typeof rcm).toBe('function')
})
```

A future refactor that re-introduces nullability will fail this test at development time, before it reaches CI E2E.

## Design decisions

1. **Layer separation adapted from T651 — not mirrored.** Layer 1 (`lib/courseMutation.ts`) is pure — no Zustand, no React. Layer 2 lives in `editorStore.ts` directly (not in `initEditor.ts`) because it has no editor dependency. Layer 3 is a non-nullable store action field. The adapter-not-mirror choice is documented in the post-mortem above; mirror-by-shape caused the E2E regression.
2. **`setCourse(updated)` stays at the caller, NOT inside the helper.** Forgetting `setCourse` produces an immediately-visible bug (UI stale after mutation) — code review or manual test catches it instantly. Forgetting `bumpCacheVersion` was invisible until a cache hit (the bug D-02 just fixed) — hence THAT one lives inside the helper. Asymmetric by design, matching the observability asymmetry.
3. **`return result | undefined` instead of `throw`.** Callers use `if (!updated) { toast.error(...); return }` which is strictly more readable than `try/catch` and eliminates forgotten error paths. Re-throwing would invite the same drift TD-007 is eliminating.
4. **Toast remains caller-owned** even though the unified surface is tempting. Each operation has its own message (`"Failed to add slide"` vs `"Failed to rename slide"`). Pushing toast into the helper would require operation labels at call sites, which is the same shape of boilerplate with none of the flexibility (e.g., suppressing toast for background retries).
5. **`bumpCache: true` as default invariant.** The escape hatch exists only to future-proof — no current site uses `bumpCache: false`. Documented at the option site.

## Test coverage

| File | Scope | Tests |
|---|---|---|
| `src/__tests__/lib/courseMutation.test.ts` (new) | Layer 1 pure primitive | 8 |
| `src/__tests__/store/requestCourseMutation.test.ts` (new, post-fix) | Layer 2 store action — success / `bumpCache:false` / error / null-window guard / non-Error narrowing | 5 |
| `src/__tests__/SlideList.test.tsx` | Migrated SlideList sites — no mock closure needed (live store action) | 23 (unchanged) |
| `src/__tests__/sidebar/SidebarPanels.test.tsx` | T607 SlideList integration — no mock closure needed | 24 (unchanged) |

Total authoring-ui suite: 733 → **746/746 pass** (32 files).

CI artefact: run `24602663078` completed in 17m 08s with all 27 steps green, confirming the fix in production-like environment (full E2E on chromium).

Deliberate non-additions:
- No separate cache-invalidation test for D-02 — the `bumpCache: true` default is covered by TD-007.1 and any future consumer omitting it trips the closure assertions.
- No TopToolbar.test.tsx helper rewrite — the file doesn't exercise the mutation handlers; its existing tests stayed green.

## Verification

| Check | Result |
|---|---|
| `grep -rn "isAdding\|isProcessing"` | 0 matches |
| `grep -rn "bumpCacheVersion"` | Only in `store/editorStore.ts` (definition + Layer 2 action body), test files, and comments in callers — zero direct call-site invocations |
| `npx tsc --noEmit` | EXIT=0 |
| `pnpm --filter @elearn-studio/authoring-ui test` | **746/746 pass (32 files)** |
| `pnpm -r lint` | 0 errors, 2 info-warnings (TD-004 historical, unchanged) |
| CI run `24602663078` | **success** in 17m 08s, all 27 steps green (including full E2E) |

## Out of scope (deliberate)

- **Course meta-operations outside TopToolbar/SlideList** — no other package consumer exists today. If a future `PublishDialog` or admin panel adds a course-meta call, it must go through `requestCourseMutation` per the guidance that will be added to `08-persistence-flow.md`.
- **Post-success side effects** (`setCurrentSlideIndex`, `setEditingId(null)`, `dragIndex`/`dropIndex` reset) remain per-operation. They are genuine operation-specific business logic; forcing them into a shared registry is the wrong shape of abstraction.
- **Batching / retry / telemetry on `performCourseMutation`** — the seam exists (hooks), no caller needs it today.

## No open issues

CRITICAL: 0 · HIGH: 0 · MEDIUM: 0 · LOW: 0

Block closed.
