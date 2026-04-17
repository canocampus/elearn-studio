# Issues — T645 Code Review

> Reviewer: code-reviewer agent (claude-sonnet-4-6)
> Date: 2026-04-17
> Scope: storageManager.ts, initEditor.ts, storageManager.test.ts, initEditor.test.ts,
>        EditorCanvas.tsx, TopToolbar.tsx, SlideList.tsx
> Commits: 505de96 · 6752076

## Summary

T645 correctly eliminates the three module-level singletons (`storageContext`, `getStorageContext`, `updateStorageContext`, `invalidateCourseCache`) that bypassed React's lifecycle and prevented Zustand from being the single source of truth for persistence context. The replacement — a `StorageContextProvider` interface with dependency injection — follows Dependency Inversion correctly: `storageManager.ts` has no Zustand import; the concrete provider in `initEditor.ts` reads from Zustand's `getState()` at invocation time (correct — captures the live value, not a stale closure). The cache-invalidation subscription replaces the imperative `invalidateCourseCache()` call with a reactive push model. All 708 unit tests pass. No live calls to the old API remain — only comment references.

## No issues found

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH     | 0 |
| MEDIUM   | 0 |
| LOW      | 0 |

**Verdict: APPROVED**

## Areas checked and found clean

- **Dependency Inversion** — `storageManager.ts` defines `StorageContextProvider` as a pure interface with no Zustand import. The concrete implementation lives in `initEditor.ts`. This satisfies the design goal in `decisions/2026-04-17-storage-context.md`.
- **Synchronous context capture (T645.3.4)** — `provider.getContext()` is called inside `load()` and `store()` at invocation time, not at registration time. The Zustand `getState()` call in the provider implementation always returns the latest slice. This preserves the race-condition guard for fast navigation (described in T800 CRITICAL-01/01b).
- **Early validation guard** — Both `load()` and `store()` check `!courseId || !slideId` immediately after `provider.getContext()` and return/abort safely with a `console.warn`. This is correct defensive behavior at the system boundary.
- **Cache lifecycle (T645.3.5)** — `courseCache` remains module-level but is now exclusively managed by `registerStorageManager`. The only paths that write `courseCache` are: (a) `load()` on cache miss, (b) `store()` on success (in-place update per T640.1), (c) `onCacheInvalidate` callback (sets to null), and (d) `store()` catch block (sets to null). No external caller can touch it.
- **Cache invalidation subscription** — `provider.onCacheInvalidate` returns an unsubscribe function that is stored in `unsubscribeCacheInvalidate` and returned from `registerStorageManager`. `initEditor.ts` captures this in the `cleanup()` function. The subscription uses Zustand's plain `subscribe` comparing `cacheVersion` before and after each state update — correct and efficient.
- **`cleanup()` extensibility (T645.7)** — The cleanup wrapper in `initEditor.ts` is explicitly designed to be extended by T646 (autosaveTimer + dragstart listener removal). Comment on the function documents this intent. The wrapper itself has no logic risk.
- **Caller updates (T645.5)** — `EditorCanvas.tsx`, `TopToolbar.tsx`, `SlideList.tsx` updated to call `bumpCacheVersion()` instead of `invalidateCourseCache()`. `registerStorageManager(editor, provider)` called in place of old `updateStorageContext`/`initStorageManager` pattern. `initEditor` return type updated from `Editor` to `{ editor, cleanup }`.
- **`store(_data: unknown)` parameter** — `_data` is intentionally unused; the function reads live canvas state via `editor.getComponents().toArray()` (correct per T011.2 design — GrapesJS passes a snapshot but we always want the live tree). The underscore prefix signals intentional non-use and the T011.2 JSDoc comment at the top of `storageManager.ts` explains the design.
- **Test isolation (T645.6)** — `makeProvider()` helper returns `{ provider, setContext, triggerInvalidate }`. Each test that needs a specific context calls `setContext()`. The `beforeEach` in the main describe block uses an immediate-callback provider (`onCacheInvalidate: (cb) => { cb(); return () => {} }`) to reset `courseCache` to null before every test — prevents cross-test cache contamination.
- **Old API removal** — `grep` confirmed 0 live calls to `updateStorageContext`, `getStorageContext`, `invalidateCourseCache`. Only 5 comment references remain (in JSDoc deprecation notes and the ADR document), which is appropriate.
- **No production console.log** — `console.warn` and `console.error` calls in `storageManager.ts` are storage-critical diagnostics, consistent with the existing pattern established in T640 and reviewed/approved there.
