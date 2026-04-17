# Code Review — T650: beforeunload dirty-state warning

**Reviewer:** self-review (post-implementation)
**Date:** 2026-04-17
**Status:** APPROVED — pending CI confirmation
**Commit:** `04e6121`

---

## What the feature does

The autosave path in `initEditor.ts` debounces `editor.store()` by 2 seconds after the last
`component:update` / `component:add` / `component:remove` event. Within that window the
user's latest edits exist only in the GrapesJS in-memory model — they have not reached the
backend yet. If the user closes the tab, force-reloads, or navigates away from the domain
during that window, the edits are silently lost.

T650 closes that window by surfacing a native browser warning when unsaved changes exist,
giving the user a chance to cancel the navigation and let the autosave complete.

---

## Why the "Dirty State Warning" pattern (and not a forced save)

The obvious-looking alternative — "just flush `editor.store()` synchronously on unload" —
is not viable in any modern browser. Specifically:

| Option considered | Why it was rejected |
|---|---|
| `await editor.store()` inside `beforeunload` | `beforeunload` handlers cannot `await`. The browser does not pause unload for promise resolution; in-flight `fetch()` / `XHR` are aborted the moment the page starts unloading. |
| Synchronous `XMLHttpRequest` in `beforeunload` | Deprecated. Chrome already ignores `async:false` XHR during unload on many platforms; Firefox emits a console warning and may drop the request. Even where it works, it blocks the UI thread and violates the modern "no sync network on unload" contract. |
| `navigator.sendBeacon(url, blob)` | Technically runs during unload, BUT it has a **~64 KB per-beacon limit** and no response handling. Slide JSON routinely exceeds 64 KB once a course has images, `phaser-sim` scene definitions, or long question banks. A silent partial save is worse than the current loss — it corrupts server state without the user knowing. |
| Web Locks / `navigator.locks` | Does not bridge tab-close. Only useful for coordinating between tabs of the same origin. |
| Service worker queued sync | Requires SW registration, offline-first architecture, and conflict resolution against any subsequent legitimate save. Massive scope for a 2-second race. |

The only pattern the platform still reliably supports for "don't lose work on unload" is
the **dirty-state warning**: the page signals `beforeunload` that it has unsaved changes,
the browser shows its native confirmation dialog ("Leave site? Changes you made may not be
saved"), and the user decides. If they cancel → the autosave debounce completes normally.
If they confirm leave → we accept the loss, same as before. We do not attempt heroics.

The key design constraint is: **every decision happens before unload starts**. The handler
does two things and exits:

```typescript
if (hasPendingChanges()) {
  e.preventDefault()       // signal "I have unsaved state"
  e.returnValue = ''       // legacy Chrome/Safari requirement
}
```

No async work, no network, no DOM writes. The browser owns the UI from here.

---

## Architecture

Two pieces, each isolated to its existing module:

### 1. `hasPendingChanges()` in `initEditor.ts`

```typescript
const hasPendingChanges = () => autosaveTimer !== null
```

The autosave debounce already tracked its own state in a closure variable `autosaveTimer`
(a `setTimeout` handle). `null` means "no debounce pending" — either because nothing has
been edited yet or because the last `store()` just completed. Non-null means "a debounce
is in flight; the user has typed something since the last save".

Critically, this is a **read-only closure accessor**, not a new state machine. Every
existing code path that set or cleared `autosaveTimer` continues to do so unchanged; we
simply expose the invariant to callers. There are four call sites that mutate it:

- `triggerAutosave()` sets it (line 434)
- The debounce callback clears it (line 435, first line inside `setTimeout`)
- `cleanup()` clears it during editor teardown (line 481)
- The `clearTimeout` at the start of `triggerAutosave` (line 432) is benign — it just
  replaces one in-flight timer with another; `hasPendingChanges()` still returns `true`
  throughout.

No new flag, no redundant boolean to keep in sync, no risk of drift between the real
timer state and what `hasPendingChanges()` reports.

### 2. `beforeunload` listener in `EditorCanvas.tsx`

Registered in Effect 1 (the same effect that calls `initEditor`) rather than Effect 2.
Rationale: the listener's lifetime matches the editor's lifetime, which is controlled by
Effect 1 (`[courseId]` dependency). Putting it in Effect 2 would churn the listener on
every slide switch for zero benefit, and would need an extra `useRef` to ship
`hasPendingChanges` from Effect 1 into Effect 2's closure. Effect 1 already has
`hasPendingChanges` in scope from the `initEditor` destructure — clean and direct.

Cleanup removes the listener in Effect 1's return function, before `editor.destroy()`,
so the `hasPendingChanges` closure cannot fire against a torn-down editor.

---

## Test coverage (3 states)

`initEditor.test.ts` adds one `describe` block (`T650.3`) with three tests that exercise
the full timer lifecycle:

| # | State | Trigger | Expected |
|---|---|---|---|
| T650.3.1 | `null` (idle, no edits) | Fresh `initEditor()` call | `hasPendingChanges() === false` |
| T650.3.2 | Active (debounce in flight) | Fire `component:update` handler | `hasPendingChanges() === true` |
| T650.3.3 | `null` (post-save) | Fire update, then `vi.advanceTimersByTimeAsync(2001)` | `hasPendingChanges() === false` AND `editor.store()` called exactly once |

The tests use `vi.useFakeTimers()` so the 2-second debounce is deterministic. They do
**not** simulate the `beforeunload` DOM event itself — that would be testing the browser's
behaviour, not ours. The `onBeforeUnload` handler is a three-line wrapper around
`hasPendingChanges()`; the decision is what matters, and the decision is what's tested.

Full suite after these tests: 38/38 green in `initEditor.test.ts`, 730/730 green in the
authoring-ui package, 1532/1532 green across the whole monorepo.

---

## Findings

| ID | Severity | Area | Description | Status |
|---|---|---|---|---|
| 1 | INFO | initEditor return type | Expanded from `{editor, cleanup}` to `{editor, cleanup, hasPendingChanges}`. All existing callers destructure explicitly; no breakage. | RESOLVED |
| 2 | INFO | beforeunload placement | Registered in Effect 1 (not Effect 2). Matches editor lifetime; avoids per-slide-switch listener churn. | RESOLVED |
| 3 | INFO | No `Co-Authored-By` in commit | Disabled globally per user's settings. | AS-DESIGNED |
| 4 | LOW | T650.4 test merged into T650.3 | Original T650.4 text said "verify store() called" inside the beforeunload handler, which contradicts the T650 design constraint. Real intent was "verify warning fires when dirty"; that reduces to the three timer-state tests already in T650.3. Rationale documented in tasks.md. | RESOLVED |

No CRITICAL, HIGH, or MEDIUM findings. No regressions in the existing suite.

---

## What T650 deliberately does NOT do

- Does not try to save on unload. See the rejection table above.
- Does not remove or replace the existing autosave debounce. T650 is purely additive.
- Does not re-run the autosave if the user cancels the navigation. Cancelling returns
  control to the page; the existing 2-second timer is still running and will save normally.
- Does not change the visible save indicator (`isSaving` / `SaveErrorBanner`). Those are
  driven by the debounce callback's `try/finally`, unchanged.
- Does not introduce new Zustand state for the dirty flag. The GrapesJS autosave timer
  already is the dirty flag; duplicating it in Zustand would risk drift.

---

## Environment repair (tangential to the feature)

During T650.5 verification two pre-existing corrupted packages in the local pnpm store
surfaced and had to be repaired before tests could run:

1. `es-abstract@1.24.1` — missing its year subdirectories (`2015/`…`2024/`). Blocked ESLint
   because `eslint-plugin-react` → `object.fromentries` requires
   `es-abstract/2024/AddEntriesFromIterable`.
2. `@rollup/rollup-win32-x64-msvc@4.60.1` — missing its `package.json` (only the `.node`
   binary was extracted). Blocked `phaser-simulations` tests because Node could not resolve
   the directory as a module.

Both were extraction failures in the pnpm content-addressable store, unrelated to any
change in this repository. The fix:

```
powershell Stop-Process -Id <esbuild.exe PID> -Force   # release the file lock
pnpm store prune
rm -rf node_modules/.pnpm/@rollup+rollup-win32-x64-msvc*
pnpm install
```

No source files, no lockfile, no `package.json` were modified. The commit message
explicitly flags this as `env repair` so that future readers understand why the
commit includes no dependency changes despite mentioning rollup and es-abstract.

This section is documented here **because it affected the T650.5 validation path**, not
because it is part of the feature. A future environment repair of the same kind would
not warrant a new issues file.

---

## Verdict

**APPROVED** — pending CI confirmation.

The feature is minimal (one accessor + one listener + three tests), architecturally
correct (closure invariant, not a parallel flag), platform-appropriate (dirty-state
warning, not unsupported sync-network heroics), and free of side effects on the existing
autosave path.

The environment repair is documented for traceability but is not part of the behavioural
change. CI runs in a clean container and will not encounter the pnpm-store corruption
seen locally; the repair is for local developer ergonomics only.
