# Issues — T646 Code Review

> Reviewer: code-reviewer agent (claude-haiku-4-5)
> Date: 2026-04-17
> Scope: initEditor.ts (lines 337–360, 475–481), initEditor.test.ts (lines 749–888),
>        decisions/2026-04-17-editor-loading-flag.md
> Commits: 00dce16 · e843512

## Summary

T646 correctly fixes three resource leaks in the GrapesJS editor initialization lifecycle:

1. **Dragstart listener accumulation** — Each editor reinit previously added a new anonymous handler without removing the old one. Fixed by extracting a named `dragstartHandler` and calling `blockContainer.removeEventListener('dragstart', dragstartHandler)` in cleanup().

2. **Autosave timer fires after destroy** — Debounce timer could fire `editor.store()` on a partially-destroyed editor. Fixed by `if (autosaveTimer !== null) clearTimeout(autosaveTimer)` in cleanup() with explicit null guard.

3. **Ghost DOM element race in requestAnimationFrame** — rAF callback could call `document.body.removeChild(ghost)` after editor destroy. Fixed by `isUnmounted` flag (set first in cleanup before everything else) combined with `ghost.isConnected` check.

The cleanup order is correct: `isUnmounted = true` is set before timer cancellation and listener removal. This ensures rAF callbacks and any pending work cannot interfere with DOM mutations. The `_isEditorLoading` module-level flag decision is documented in `decisions/2026-04-17-editor-loading-flag.md` and justified (synchronous access required; storage events fire too late).

All 35 tests pass including 4 dedicated T646.6 tests covering cleanup lifecycle. No production console.log statements remain.

## No issues found

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH     | 0 |
| MEDIUM   | 0 |
| LOW      | 0 |

**Verdict: APPROVED**

## Areas checked and found clean

- **Cleanup order (T646.3)** — `isUnmounted = true` executes first (guards rAF callbacks), then `clearTimeout(autosaveTimer)` (cancels pending store), then `removeEventListener` (removes handler), then `unsubscribeCacheInvalidate()` (Zustand subscription cleanup). Order is correct and prevents cross-contamination between cleanup phases.

- **Type safety — DragEvent cast** — Line 344 casts `Event` to `DragEvent` with `const de = e as DragEvent`. This is safe because: the handler is registered exclusively on `dragstart` events (GrapesJS block drag), `dragstart` events are always `DragEvent` instances (DOM standard), and the guard `if (!de.dataTransfer) return` prevents null-pointer access.

- **Type safety — autosaveTimer** — Line 429 declares `let autosaveTimer: ReturnType<typeof setTimeout> | null = null`. The return type is correct (matches `clearTimeout` expectations at line 478). Reassignment at line 435 (`autosaveTimer = null`) maintains the invariant. Guard at line 478 (`if (autosaveTimer !== null)`) prevents `clearTimeout(undefined)`.

- **Dragstart handler isolation** — The named `dragstartHandler` (line 343) is bound to the closure scope and captured in the `addEventListener` call (line 357). The same reference is passed to `removeEventListener` (line 479), ensuring removal succeeds. Test T646.6.3 verifies no accumulation after 3 reinit/destroy cycles.

- **isUnmounted guard correctness** — Flag is set at line 477 before any other cleanup work. The rAF callback checks `if (isUnmounted) return` at line 353 before touching `document.body`. This prevents `removeChild(ghost)` after editor destroy. Combined with `ghost.isConnected` check at line 354, the guard is redundant-but-safe. Test T646.6.4 verifies the guard prevents DOM mutation after cleanup.

- **Cleanup callback scope** — The closure captures `autosaveTimer`, `blockContainer`, `dragstartHandler`, `isUnmounted`, and `unsubscribeCacheInvalidate` from `initEditor` scope. All captures are stable and correct. `blockContainer` may be null, so `?.removeEventListener()` optional-chain operator is used correctly at line 479.

- **Test isolation — querySelectorSpy** — The T646.6 describe block spies on `document.querySelector` in beforeEach (line 802–804) and explicitly restores it in afterEach (line 815 `querySelectorSpy.mockRestore()`). The spy is test-scoped, not leaked. Mock state is reset between tests via `vi.clearAllMocks()` at line 795.

- **Test isolation — removeChildSpy** — The T646.6.4 test creates a local spy `vi.spyOn(document.body, 'removeChild')` at line 878 without explicit restoration in afterEach. This is acceptable because: vitest's `vi.clearAllMocks()` at the start of each test (beforeEach, line 795) clears all mock state, and the spy is garbage-collected after the test. The pattern is pragmatic and vitest-idiomatic. No test pollution observed (all tests pass).

- **Autosave timer debounce snapshot** — Lines 433–440 snapshot the context at event time via `provider.getContext()` and compare against the current context when the timer fires. This race-condition guard prevents saving stale data if the user switched slides during the debounce window.

- **RTE active guard** — Lines 425–427 register `rte:enable` / `rte:disable` listeners to maintain `isRteActive` flag. Line 445 checks this flag and returns early if RTE is active, preventing autosave during text-edit. This is necessary because GrapesJS does not expose a `'text-edit'` command that `Commands.isActive()` can query.

- **Decision document (2026-04-17-editor-loading-flag.md)** — The decision to keep `_isEditorLoading` as a module-level flag is well-justified: GAP-06b explains why Zustand `setState()` is insufficient (GrapesJS calls `loadData()` synchronously while Zustand batches asynchronously), GAP-06c explains why storage events are insufficient (`storage:end:load` fires before `loadData()` completes), and the rationale clarifies that no functional benefit justifies coupling to Zustand for a plain boolean semaphore already correctly owned by React lifecycle. Guardrails are documented (flag written only by `EditorCanvas.tsx`, read only by `triggerAutosave`), test cleanup is mandated, and future path (TD-006) is noted.

- **No task references in comments** — The dragstart block comments (lines 337–340) explain why the ghost element and isUnmounted guard exist, not what task is being solved. The refactor commit e843512 removed task-ref comments. No task numbers appear in the actual code comments.

- **No production console.log statements** — No `console.log` calls in initEditor.ts or tests. Existing `console.warn` and `console.error` calls in storageManager.ts (from T645) are diagnostic and appropriate for storage lifecycle.

- **Test coverage — 4 dedicated cleanup tests** — T646.6.1 verifies exact listener removal, T646.6.2 verifies timer cancellation blocks pending save, T646.6.3 verifies no listener accumulation across 3 reinit/destroy cycles, T646.6.4 verifies isUnmounted guard prevents DOM mutation in rAF. Coverage is thorough.

- **Return type consistency** — `initEditor()` returns `{ editor: Editor; cleanup: () => void }`. The cleanup function is a `() => void` lambda, consistent with the React cleanup function pattern. Callers invoke it as `result.cleanup()` (EditorCanvas.tsx pattern). Type is correct.

