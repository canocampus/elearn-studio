# Self-Review — TD-007: Unify course meta-operations save path

**Status:** RESOLVED
**Date:** 2026-04-18
**Version:** v0.5.59
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

## Design decisions

1. **Layer separation mirrors T651.** Layer 1 (`lib/courseMutation.ts`) is pure — no Zustand, no React. Layer 2 (closure in `initEditor.ts`) wires Zustand setters. Layer 3 (`editorStore.requestCourseMutation` field + setter) exposes the closure. Symmetric with T651's `performSave` / `requestSave` split.
2. **`setCourse(updated)` stays at the caller, NOT inside the helper.** Forgetting `setCourse` produces an immediately-visible bug (UI stale after mutation) — code review or manual test catches it instantly. Forgetting `bumpCacheVersion` was invisible until a cache hit (the bug D-02 just fixed) — hence THAT one lives inside the helper. Asymmetric by design, matching the observability asymmetry.
3. **`return result | undefined` instead of `throw`.** Callers use `if (!updated) { toast.error(...); return }` which is strictly more readable than `try/catch` and eliminates forgotten error paths. Re-throwing would invite the same drift TD-007 is eliminating.
4. **Toast remains caller-owned** even though the unified surface is tempting. Each operation has its own message (`"Failed to add slide"` vs `"Failed to rename slide"`). Pushing toast into the helper would require operation labels at call sites, which is the same shape of boilerplate with none of the flexibility (e.g., suppressing toast for background retries).
5. **`bumpCache: true` as default invariant.** The escape hatch exists only to future-proof — no current site uses `bumpCache: false`. Documented at the option site.

## Test coverage

| File | Scope | Tests |
|---|---|---|
| `src/__tests__/lib/courseMutation.test.ts` (new) | Layer 1 pure primitive | 8 |
| `src/__tests__/initEditor.test.ts` (new describe) | Layer 2 closure | 3 |
| `src/__tests__/SlideList.test.tsx` (test helper) | Migrated SlideList sites | 23 (unchanged, now via rcm mock) |
| `src/__tests__/sidebar/SidebarPanels.test.tsx` (test helper) | T607 SlideList integration | 24 (unchanged, now via rcm mock) |

Total authoring-ui suite: 733 → **744/744 pass**.

Deliberate non-additions:
- No separate cache-invalidation test for D-02 — the `bumpCache: true` default is covered by TD-007.1 and any future consumer omitting it trips the closure assertions.
- No TopToolbar.test.tsx helper rewrite — the file doesn't exercise the mutation handlers; its existing tests stayed green.

## Verification

| Check | Result |
|---|---|
| `grep -rn "isAdding\|isProcessing"` | 0 matches |
| `grep -rn "bumpCacheVersion"` | Only in `store/editorStore.ts` (definition), `editor/initEditor.ts` (Layer 2 closure), test mocks, and comments in callers |
| `npx tsc --noEmit` | EXIT=0 |
| `pnpm --filter @elearn-studio/authoring-ui test` | 744/744 pass (31 files) |
| `pnpm -r lint` | 0 errors, 2 info-warnings (TD-004 historical, unchanged) |

## Out of scope (deliberate)

- **Course meta-operations outside TopToolbar/SlideList** — no other package consumer exists today. If a future `PublishDialog` or admin panel adds a course-meta call, it must go through `requestCourseMutation` per the guidance that will be added to `08-persistence-flow.md`.
- **Post-success side effects** (`setCurrentSlideIndex`, `setEditingId(null)`, `dragIndex`/`dropIndex` reset) remain per-operation. They are genuine operation-specific business logic; forcing them into a shared registry is the wrong shape of abstraction.
- **Batching / retry / telemetry on `performCourseMutation`** — the seam exists (hooks), no caller needs it today.

## No open issues

CRITICAL: 0 · HIGH: 0 · MEDIUM: 0 · LOW: 0

Block closed.
