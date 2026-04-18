# Self-Review — TD-006: Replace `_isEditorLoading` with GrapesJS native storage events

**Status:** RESOLVED — Closed as **"Native events timing insufficient"** (Scenario B per the original ticket text)
**Date:** 2026-04-18
**Version:** v0.5.61
**ADR:** [`decisions/2026-04-18-editor-loading-flag.md`](../../decisions/2026-04-18-editor-loading-flag.md) (extends [`2026-04-17-editor-loading-flag.md`](../../decisions/2026-04-17-editor-loading-flag.md))
**Audit test:** [`packages/authoring-ui/src/__tests__/editor/grapesEventOrder.test.ts`](../../packages/authoring-ui/src/__tests__/editor/grapesEventOrder.test.ts)

---

## Summary

TD-006 asked whether GrapesJS's native `storage:start:load` / `storage:end:load` events could replace the `_isEditorLoading` module flag in `initEditor.ts`. The audit (static source inspection + permanent regression test) confirms they cannot, against the currently-installed `grapesjs@0.21.13`. **Production code unchanged.**

## Audit method

Two complementary signals chosen because a live `grapesjs.init()` test hangs in vitest's jsdom (grapesjs uses iframe-based canvases / DOM measurement APIs jsdom does not implement):

1. **Static inspection** of `node_modules/.pnpm/grapesjs@0.21.13/node_modules/grapesjs/dist/grapes.mjs` to read `EditorModel.prototype.load` and `StorageManager.prototype.onEnd`.
2. **Permanent vitest regression test** that reads the bundled `grapes.mjs` from disk and asserts the structural ordering of calls. Runs in <20 ms; gives a loud failure if grapesjs ever changes the order.

The compiled bundle IS the runtime behaviour — reading it is empirically equivalent to running the editor for the question "does Storage.load yield before loadData runs?".

## Evidence

`EditorModel.prototype.load` (line 61352 of `grapes.mjs`):

```js
case 0: return [4 /*yield*/, this.Storage.load(options)];   // ← (a) await Storage.load
case 1:
    result = _a.sent();
    this.loadData(result);                                  // ← (b) loadData (synchronous,
                                                            //     fires component:add × N)
```

`StorageManager.prototype.onEnd` (line 42110):

```js
StorageManager.prototype.onEnd = function (type, data, response) {
    var em = this.em;
    if (em) {
        var ev = type === 'load' ? storage_manager_types.endLoad : storage_manager_types.endStore;
        em.trigger(storage_manager_types.end, type, data, response);
        em.trigger(ev, data, response);   // ← storage:end:load fires HERE,
                                          //   inside Storage.load() before await resolves
    }
};
```

Resulting timeline of one `editor.load()` call:

| # | Event |
|---|---|
| 1 | `EditorModel.load` enters generator |
| 2 | `Storage.load(options)` called → fires `storage:start:load` |
| 3 | (custom storage's `load()` resolves) |
| 4 | `StorageManager.onEnd` fires → fires `storage:end:load` |
| 5 | `EditorModel.load` awakens → calls `this.loadData(result)` |
| 6 | `loadData` reconstructs slide → fires `component:add × N` |

`storage:end:load` arrives at step 4; the cascade of `component:add` arrives at step 6. Using `storage:end:load` to clear the gate would lift it at step 4 — three steps before the spurious `component:add` events fire — and `triggerAutosave` would start the debounce timer incorrectly, defeating the gate entirely.

## Why React/Zustand state was also rejected (recap of the 2026-04-17 ADR)

Even with a correct off-signal, a React/Zustand boolean would still fail the same way:

- `setState` and Zustand `set()` are **asynchronous** — they batch and flush on the next render cycle.
- `editor.load()` returns a promise whose `.then()` runs `loadData()` **synchronously** within a single JavaScript call stack.
- A Zustand-backed flag set to `true` immediately before `editor.load()` would not have committed before `triggerAutosave` reads it for the first `component:add` event.

The module-level flag is the only mechanism that is both written and read **synchronously within the same call stack** — which is the requirement.

(Note: Zustand's `setState()` outside React IS technically synchronous, so a `useEditorStore.getState().setEditorLoading(true)` followed by `useEditorStore.getState().getEditorLoading()` in the same call stack would actually work. But replacing a private module-scoped boolean with a global state field for a flag used by exactly one writer (`EditorCanvas`) and one reader (`triggerAutosave`) violates encapsulation and YAGNI without a benefit. See `2026-04-17-editor-loading-flag.md` § "Why Zustand's getState() does not justify a migration".)

## What was implemented

**No production-code change.** Only added:

1. `decisions/2026-04-18-editor-loading-flag.md` — this audit's ADR.
2. `packages/authoring-ui/src/__tests__/editor/grapesEventOrder.test.ts` — 5 structural assertions:
   - source loads (sanity)
   - `Storage.load(options)` appears textually before `loadData(result)` in `EditorModel.prototype.load`
   - `StorageManager.onEnd` references the `endLoad` event for type `'load'`
   - `StorageEvents.endLoad === 'storage:end:load'` (event name pinned)
   - regression-guard regex `yield.*?Storage\.load[\s\S]*?loadData\(result\)` matches the function body — will break loudly if a future grapesjs inverts the order.

## What this does NOT do

- Does **not** change `_isEditorLoading` or any of its accessors.
- Does **not** change `EditorCanvas`'s set/clear sites around `editor.load()`.
- Does **not** change `triggerAutosave`'s read of `getEditorLoading()`.
- Does **not** change the `setEditorLoading(false)` test-cleanup contract from the 2026-04-17 ADR.

## Verification

| Check | Result |
|---|---|
| `npx tsc -b` (production build path) | EXIT=0 |
| `grapesEventOrder.test.ts` | **5/5 pass** in 17 ms |
| Full authoring-ui suite | 750 → **755/755 pass** (32 → 33 files) |
| `pnpm -r lint` | 0 errors (2 historical TD-004 warnings unchanged) |
| `_isEditorLoading` references | **5 files unchanged** (initEditor.ts definition, EditorCanvas.tsx callers, 2 test files, this audit doc) |

## Reopen criteria

The structural regression test (`grapesEventOrder.test.ts`) fails. That happens iff a future `grapesjs` release inverts the call order, in which case TD-006 is automatically reopened and the maintainer must either:
1. Implement TD-006 for real and remove the flag, or
2. Update the ADR to record why the new ordering still does not justify removing the flag.

## Open issues

CRITICAL: 0 · HIGH: 0 · MEDIUM: 0 · LOW: 0

Block closed.
