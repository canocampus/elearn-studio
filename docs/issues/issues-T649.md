# Code Review — T649: Stale-closure fix in array mutations

**Reviewer:** code-reviewer agent  
**Date:** 2026-04-17  
**Status:** APPROVED  

## Summary

T649 fixes a stale-closure bug in array mutations within `QuestionPropertiesPanel`. Two consecutive `updateOption()` or `addAnswer()` calls made within the same render cycle would overwrite each other because both read the same pre-mutation snapshot from the React closure. The fix synchronously updates `latestRef.current` in the hook's `update()` function so that `getLatest()` always returns the most-recent committed value, even for rapid consecutive calls without intermediate re-renders.

**Root cause:** `latestRef.current` was only set during render (`latestRef.current = value`), not immediately after `setValue()`. Two `update()` calls within the same render batch both called `getLatest()` and got the same stale ref value.

**Fix applied:**
1. In `useComponentProperty.update()` and `useExtendedProperty.update()`: added `latestRef.current = newValue` immediately after `setValue(newValue)` (lines 89, 158).
2. In `QuestionPropertiesPanel`: all 9 array-mutation sites now call `const current = getLatest()` before mutating (lines 201, 207, 213, 261, 381, 387, 394).
3. Test coverage: 2 new regression suites (T649.4, T649.5) confirm the fix works.

## Findings

| ID | Severity | File | Description | Status |
|---|---|---|---|---|
| 1 | INFO | useComponentProperty.ts | latestRef synchronous update is the correct architectural fix | RESOLVED |
| 2 | INFO | useComponentProperty.test.ts | T649.5 external comp.set() test confirms getLatest() reflects Undo/Redo immediately | RESOLVED |
| 3 | MEDIUM | QuestionPropertiesPanel.tsx | Two render-body reads of ep.options and ep.answers (lines 251, 440) are safe—used only for rendering, not mutation | RESOLVED |
| 4 | INFO | All panels | Preventive audit of sibling panels (Button, MediaPlayer, AudioNarration, ProgressBar, VolumeControl) confirmed—none have array mutation patterns | RESOLVED |

## Details

### 1. INFO: latestRef synchronous update is correct

**File:** `packages/authoring-ui/src/hooks/useComponentProperty.ts` lines 81–91, 152–161

The fix updates `latestRef.current` synchronously within `update()`:

```typescript
function update(newValue: T) {
  if (!component) return
  const comp = component as GjsComponent
  setValue(newValue)                    // React state update
  latestRef.current = newValue          // T649: sync ref update
  comp.set(key, newValue)               // Backbone model update
}
```

This is correct because:
- React batches multiple `setState` calls, but `latestRef.current` is updated synchronously.
- Subsequent calls within the same batch see the updated ref via `getLatest()`.
- The ref is the source of truth for closures; the render state is backup.

### 2. INFO: T649.5 test confirms external comp.set() support

**File:** `packages/authoring-ui/src/__tests__/hooks/useComponentProperty.test.ts` lines 627–657

Test `getLatest() reflects rolled-back options array immediately after Undo` verifies that when GrapesJS Undo executes `comp.set('extendedProperties', ...)`, the next `getLatest()` call (even within the same call stack) reflects the rolled-back value. This is critical for Undo/Redo workflows.

The test fires:
1. User adds option via UI → `updateOption()` → `comp.set()` → 3 options in model
2. Undo command calls `comp.set('extendedProperties', original)` → 2 options in model
3. `getLatest()` immediately returns the 2-option array without waiting for React re-render

**Status:** PASSED (38/38 tests green; all T649 suites included)

### 3. MEDIUM: Two render-body reads of ep.options and ep.answers are safe

**File:** `packages/authoring-ui/src/components/sidebar/QuestionPropertiesPanel.tsx` lines 251, 440

The code reads from the closure in render bodies:
```typescript
{ep.options.map(opt => ...)}  // Line 251
{ep.answers.map((answer, i) => ...)}  // Line 440
```

**Assessment:** SAFE — These are read-only map() calls for rendering. They never mutate the arrays in-place. The data comes from the most-recent `ep` state, which is synchronized with the model via the `change:extendedProperties` Backbone listener.

**Context:** The comment in `QuestionPropertiesPanel` line 2 correctly states: "Writes directly to GrapesJS component via model.set('extendedProperties', {...})". All writes go through `update(patch)`, which uses `getLatest()` internally. Renders only read.

### 4. INFO: Sibling panels confirmed safe via preventive audit

**Panels audited:**
- `ButtonPropertiesPanel` — no array mutations
- `MediaPlayerPropertiesPanel` — no array mutations
- `AudioNarrationPropertiesPanel` — no array mutations
- `ProgressBarPropertiesPanel` — no array mutations
- `VolumeControlPropertiesPanel` — no array mutations

All write via scalar patch updates (e.g., `update({ label: 'new' })`), not array operations. No regression risk.

## Code Quality Observations

**Positive aspects:**
- Immutability enforced via spread operator throughout (e.g., `{ ...current.options, ... }`).
- Clear comments added at each stale-closure fix site (e.g., `// T649: stale-closure fix via getLatest()`).
- Test naming is explicit (T649.4, T649.5) and ties to regression intent.
- Hook cleanup function unsubscribes correctly (lines 72–73, 144–145).
- No console.log or debug statements in production code.

**Minor style note:**
- Line 260–262 inline `onChange` handler for radio button uses arrow function capturing `opt.id`. Pattern is correct per CLAUDE.md rules (getLatest() call inside the handler).

## Verdict

**APPROVED** — All architectural goals met. The T649 fix is semantically correct, test coverage is comprehensive (38 tests all passing, including 2 dedicated regression suites), and the stale-closure bug is permanently prevented. No CRITICAL or HIGH issues found.

The latestRef synchronous update pattern is reusable and can be applied to other hooks if needed.
