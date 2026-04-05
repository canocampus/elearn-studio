# Code Review: T633 — Button background image fix

**Reviewer:** code-reviewer agent  
**Date:** 2026-04-05  
**Task:** T633 — Fix button background image: missing cover/no-repeat + setStyle wipes position

---

## CRITICAL

None.

## HIGH

### H-01: Stale JSDoc comment (file header) — **RESOLVED**

**File:** `ButtonPropertiesPanel.tsx` line 13  
**Issue:** File-level JSDoc still said `component.setStyle(...)` after the fix switched to `addStyle()`.  
**Resolution:** Updated to `component.addStyle(...)` with a note about merge semantics.

---

## MEDIUM

### M-01: Missing regression test for "Remove Image" button

**File:** `e2e/tests/button-widget.spec.ts`  
**Issue:** T633.4 tests the add-background path, but the Remove Image button (which calls `setStyle(remaining)`) is untested. The destructure-based approach correctly strips all 4 background properties, but there is no automated check that position styles survive removal.  
**Decision:** Accepted. The `setStyle(remaining)` pattern is straightforward and visually verified. A dedicated test would be added as T633.5 if the task block is reopened.

### M-02: No guard in AssetManager `select()` callback for detached component

**File:** `ButtonPropertiesPanel.tsx` lines 88–105  
**Issue:** If the component is deleted or deselected while the asset picker is open, `addStyle()` runs on a detached/dead component. GrapesJS silently discards the mutation, so there is no crash, but it is unclean.  
**Decision:** Accepted. The Properties Panel unmounts when the component is deselected (the panel shows "No component selected"), which closes the picker in practice. The edge case requires deliberate multi-step user action within a narrow timing window and has no data-loss consequence.

---

## LOW

### L-01: Verbose `window.__elearn_editor` type assertion repeated twice in test

**File:** `e2e/tests/button-widget.spec.ts`  
**Issue:** The type cast for `__elearn_editor` is duplicated in `initialStyle` and `afterStyle` evaluations. Could be extracted to a helper.  
**Decision:** Accepted. The repetition is contained to this one test and is consistent with the pattern used in other spec files (`question-widget.spec.ts`). Extracting to a shared helper would require changes across the test suite and is out of scope for T633.
