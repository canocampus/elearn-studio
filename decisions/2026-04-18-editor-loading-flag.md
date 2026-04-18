# Decision: TD-006 audit confirms `_isEditorLoading` module flag must remain

**Date:** 2026-04-18
**Task:** TD-006
**Status:** Approved — keep `_isEditorLoading` as-is; close TD-006 as "Native events timing insufficient"
**Supersedes / Extends:** [`2026-04-17-editor-loading-flag.md`](./2026-04-17-editor-loading-flag.md) (T646.5 ADR)
**Audit test (regression guard):** [`packages/authoring-ui/src/__tests__/editor/grapesEventOrder.test.ts`](../packages/authoring-ui/src/__tests__/editor/grapesEventOrder.test.ts)

---

## Context

T646.5 introduced the `_isEditorLoading` module flag to suppress autosave during `editor.load()` reconstruction. The 2026-04-17 ADR rejected migrating it to React/Zustand state on two grounds (GAP-06b: React state is async vs the synchronous `loadData()` call stack; GAP-06c: GrapesJS's native `storage:start:load` / `storage:end:load` events fire in the wrong order to be used as gates). That ADR closed with a "Future path (TD-006)" note saying the flag could go away **if** grapesjs ever guarantees `storage:end:load` fires after `loadData()` completes.

TD-006 is the audit asked for by that note. This ADR records the audit result against the **currently-installed** version (`grapesjs@0.21.13`) and converts the "future path" disclaimer into an explicit, evidence-backed close.

## Audit method

Two complementary signals:

1. **Static inspection** of the compiled `node_modules/.../grapesjs/dist/grapes.mjs` to read `EditorModel.prototype.load` and `StorageManager.prototype.onEnd`.
2. **Permanent regression test** (`packages/authoring-ui/src/__tests__/editor/grapesEventOrder.test.ts`, 5 assertions) that asserts the structural ordering against the bundled source on every CI run. If grapesjs changes the order in a future minor/patch release, the test fails and TD-006 is reopened automatically.

Live `grapesjs.init()` in vitest's jsdom env was tried first but hangs — grapesjs uses iframe-based canvases and DOM measurement APIs jsdom does not implement. Static inspection of the bundle is equivalent for this question (the bundle IS the runtime behaviour) and stable across CI runs.

## Findings — `grapesjs@0.21.13`

### `EditorModel.prototype.load` (line 61352 of `grapes.mjs`)

```js
EditorModel.prototype.load = function (options_1) {
    return Editor_awaiter(this, arguments, void 0, function (options, loadOptions) {
        var result;
        if (loadOptions === void 0) { loadOptions = {}; }
        return Editor_generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, this.Storage.load(options)];   // ← (a) await Storage.load
                case 1:
                    result = _a.sent();
                    this.loadData(result);                                  // ← (b) loadData (synchronous,
                                                                            //     fires component:add × N)
                    // Wait in order to properly update the dirty counter (#5385)
                    return [4 /*yield*/, (0,mixins.wait)()];
```

### `StorageManager.prototype.onEnd` (line 42110)

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

### Resulting timeline of one `editor.load()` call

```
1. EditorModel.load              → enters generator
2. Storage.load(options) called  → fires storage:start:load
3. (custom storage's load() resolves)
4. StorageManager.onEnd fires    → fires storage:end:load     ← (X)
5. EditorModel.load awakens      → calls this.loadData(result) ← (Y)
6. loadData reconstructs slide   → fires component:add × N    ← (Z)
```

Critical ordering: **(X) → (Y) → (Z)**. `storage:end:load` arrives at step 4; the cascade of `component:add` arrives at step 6. If we used `storage:end:load` to clear the gate, the gate would be open by the time the spurious `component:add` events fire — and `triggerAutosave` would start the debounce timer incorrectly, defeating the entire purpose of the gate.

## Decision

**Keep `_isEditorLoading` as a module-level flag.** No production-code change.

The 2026-04-17 ADR's GAP-06b (React state is async) + GAP-06c (storage events fire too early) findings are confirmed against `grapesjs@0.21.13` by both static source inspection and a permanent regression test.

## Test coverage added (no production change)

`packages/authoring-ui/src/__tests__/editor/grapesEventOrder.test.ts` — 5 assertions:

1. `grapes.mjs source loads` (sanity check; >10 KB).
2. `EditorModel.prototype.load awaits Storage.load() BEFORE calling loadData()` — locates the function body, confirms `this.Storage.load(options)` appears textually before `this.loadData(result)`.
3. `StorageManager.onEnd triggers storage:end:load` — confirms the event is fired inside `onEnd`, which is called inside `StorageManager.load()` before its promise resolves.
4. `StorageEvents.endLoad === 'storage:end:load'` — pins the public event-name string so renames break the test.
5. `REGRESSION GUARD — gating on storage:end:load would lift the gate too early` — the keystone assertion, matches the regex `yield.*?Storage\.load[\s\S]*?loadData\(result\)` to fail loud if a future grapesjs inverts the order.

The test runs in <20 ms because it reads bytes from `grapes.mjs`, no editor init.

## When to revisit TD-006

The regression test fails. Until then, TD-006 is **closed** with rationale: "Native events timing insufficient — `storage:end:load` fires before `loadData()` reconstructs components in `grapesjs@0.21.13`."

If a future grapesjs release inverts the order, that test fails on the next CI run and the maintainer is forced to either (a) implement TD-006 for real and remove the flag, or (b) update the ADR to record why the new ordering still does not justify removing the flag.

## What this audit does NOT change

- `_isEditorLoading` flag: unchanged.
- `EditorCanvas.tsx` set/clear sites: unchanged.
- `triggerAutosave` reading `getEditorLoading()`: unchanged.
- `setEditorLoading` test cleanup contract from the 2026-04-17 ADR: unchanged.
- All 750 existing authoring-ui tests: 0 regressions (the new audit file adds 5 → 755 total).
