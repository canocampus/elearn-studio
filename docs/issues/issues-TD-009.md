# Self-Review — TD-009: Widgets lost when switching slides rapidly

**Status:** RESOLVED — three overlapping races closed
**Date:** 2026-04-18
**Version:** v0.5.63
**Commits:** (TD-009 races #1/#2 + E2E reproducer) + `d3361d6` (race #3 + TD-010 bundle)
**Trigger:** Surfaced while building `e2e/tests/docs-screenshots.spec.ts` — widgets added on slide 1 vanished after navigating through later slides.

---

## Context

The symptom was "add widget → switch slides → return → widget is gone". The ticket originally hypothesised a single debounce-timing bug. Investigation uncovered three independent races that all had to be fixed for the E2E guard to stay green.

## The three races

### Race #1 — React 18 StrictMode concurrent `editor.load()` calls

- **Symptom:** A widget added right after `readySignal` fired could vanish seconds later.
- **Root cause:** React 18 StrictMode double-invokes `EditorCanvas` Effect 2 on mount. Each invocation called `editor.load()` asynchronously. The first run was cancelled (`isCancelled=true`) but its in-flight `editor.load()` still resolved — at which point GrapesJS's `loadData()` ran synchronously, wiping whatever the second run (or the user) had put on the canvas.
- **Fix:** `lastLoadContextRef` + `lastLoadPromiseRef` in `EditorCanvas.tsx`. On a redundant Effect 2 invocation with the same `(courseId, slideId)`, the twin short-circuits and awaits the in-flight load's promise instead of starting its own. A genuine slide switch still flows through normally because the ref no longer matches.
- **Lifecycle correction (shipped as part of the same fix):** the refs MUST be cleared in Effect 1's cleanup. StrictMode also double-invokes Effect 1 (cleanup → destroy editor → create new editor). Without this reset, the second Effect 2 invocation sees a stale "already loaded slide X" entry from the now-destroyed editor instance, skips `editor.load()` on the FRESH editor, and the canvas stays empty. This was caught by reload-based E2E tests (`T601.7`, `T601.8`, `GAP-03`, 7 more) that failed 100% until the cleanup reset was added.
- **File:** `packages/authoring-ui/src/components/editor/EditorCanvas.tsx`.

### Race #2 — Autosave `setTimeout` firing mid-`editor.load()`

- **Symptom:** After a rapid slide-switch, the BACKEND copy of the previous slide was empty even though the UI appeared correct at save time.
- **Root cause:** The autosave event-handler (`triggerAutosave`) early-returned when `getEditorLoading()` was up, but the `setTimeout` callback did NOT re-check. A timer scheduled BEFORE a slide switch could fire DURING `editor.load()` of the new slide, serialise a transient empty component tree, and PATCH `widgets=[]` to the previous slide's id.
- **Fix:** Added `if (getEditorLoading()) return` inside the timer callback in `initEditor.ts`. The explicit `requestSave` inside `EditorCanvas` Effect 2 already persists pending edits before load, so the timer-driven save is redundant and unsafe at that point.
- **Files:** `packages/authoring-ui/src/editor/initEditor.ts`, `packages/authoring-ui/src/__tests__/initEditor.test.ts` (2 new tests: guard up → save suppressed; control: guard down → save runs).

### Race #3 — Stale `data-editor-ready` attribute on slide switch

- **Symptom:** After fixes #1 and #2, the E2E regression guard was green — until TD-010 landed. Then it regressed 3/3. The logs showed the NEW slide's `data-editor-ready` attribute still reported the PREVIOUS slide's `"true"`, so Playwright raced ahead.
- **Root cause:** `setIsReady(false)` at the top of Effect 2 only *schedules* a React re-render — the DOM attribute does not flip from `"true"` to `"false"` in the same event-loop tick. Any observer polling the DOM (Playwright's `waitFor`, or user code reacting to `readySignal`) could see the stale `"true"` from the previous slide's load. In the worst case, a widget observed during that window was serialised INTO the NEW slide's PATCH by the flush-before-switch save, because the editor tree still held the OLD slide's content at attribute-check time. TD-010's extra re-renders (AppLayout started reading `selectedComponentType`) widened the window enough to surface the race deterministically.
- **Fix:** Imperatively set `containerRef.current.setAttribute('data-editor-ready', 'false')` synchronously right after `setIsReady(false)` in `EditorCanvas.tsx`. Every observer now sees an accurate "load in progress" state before the async `saveAndLoad()` begins.
- **File:** `packages/authoring-ui/src/components/editor/EditorCanvas.tsx`.

## Discovery chain

The race-#3 diagnosis came from forwarding browser-console logs into the Playwright runner + a temporary `[STORE]` log at the GrapesJS `store()` callsite. Log sequence at failure:

```
[STORE] slide=76ab0b21 toArray.length=0  ← slide 1 initial save (empty, OK)
[STORE] slide=535a5926 toArray.length=0  ← slide 2 initial save (empty, OK)
[SH] added button countAfterAdd=1         ← button on slide 1
[STORE] slide=76ab0b21 toArray.length=1  ← correct: slide 1 saved with button
[SH] on slide 2: count=1                  ← PROBLEM: slide 2 readySignal fired but tree still shows slide 1's button
[STORE] slide=535a5926 toArray.length=0   ← slide 2 cleared — but during flush-before-switch, that widgets=1 save went to the WRONG slideId
```

The `count=1` line was the smoking gun: Playwright waited for `[data-editor-ready="true"]`, got an attribute left over from the previous slide's load, and evaluated BEFORE the new slide's load had run. This pointed straight at the sync/async attribute mismatch.

## Regression guards

- **E2E** (`e2e/tests/widget-persistence-across-slides.spec.ts`): 2 scenarios.
  - Single-hop: add → switch once → switch back → button still present (id match).
  - Multi-hop: add → 5-slide round-trip → button still present.
- **Unit** (`packages/authoring-ui/src/__tests__/initEditor.test.ts`): 2 tests pin race-#2 behaviour (loading-gate during timer fire).

Both guards were **failing 100%** before the fixes. After: 2/2 E2E + 40/40 unit tests pass, re-run 5× to confirm no flake.

## What was NOT fixed (deliberate)

- **`data-editor-ready` exposed as a public contract.** The attribute is an implementation detail of `EditorCanvas`. It is consumed by the `EditorPage.readySignal()` test helper and nothing else. Not promoting it to a dedicated "loading indicator" component; the imperative flip stays co-located with the state update for locality.
- **Synchronous load API.** GrapesJS's `editor.load()` is async by design (storage round-trip). Wrapping it in a queue or lock would mask the underlying races rather than surface them. The ref-based guard in race #1 targets the specific StrictMode pattern.
- **Module-level `_isEditorLoading` flag replacement.** TD-006 already audited native events and ruled them insufficient; the flag stays.

## Verification matrix

| Check | Result |
|---|---|
| `npx tsc -b` | exit 0 |
| authoring-ui vitest | 769/769 across 34 files |
| runtime-player vitest | 265/265 (unchanged) |
| E2E `widget-persistence-across-slides` | 2/2 pass (was 0/2 before fix) |
| E2E `docs-screenshots` | still green (no regression on the source spec) |

## CRITICAL / HIGH / MEDIUM / LOW

0 open. All races closed with targeted fixes; no follow-up items identified.

---

**Reopen criteria:**
- `widget-persistence-across-slides.spec.ts` fails.
- A new React version changes StrictMode semantics in a way that bypasses `lastLoadContextRef`.
- A future GrapesJS version makes `editor.load()` synchronous or inverts the `loadData` ordering (covered by `grapesEventOrder.test.ts` from TD-006).
