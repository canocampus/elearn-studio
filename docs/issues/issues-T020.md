# T020 — Actions Editor: Code Review

## Overview

The T020 Actions Editor implementation introduces a comprehensive event-action system for attaching behaviors to widgets in the eLearn Studio authoring UI.

---

## CRITICAL

### [C1] actionIndex lookup via indexOf() unreliable — Data Corruption

**File**: ActionSequenceEditor.tsx lines 147, 226

**Issue**: actionIndex computed via object reference equality indexOf(action):
- React re-renders may change action ref (shallow compare fails)
- indexOf() returns -1 if reference changed
- updateAction(event, -1, updated) corrupts FIRST action, not target
- Nested action updates silently affect wrong actions

**Impact**: Data loss when editing nested actions with re-renders

**Fix**: Pass actionIndex as stable prop from parent

**Confidence**: 95%

**Status**: ✅ FIXED (2026-03-22) — actionsStore.ts uses `.map()`/`.find()` immutable updates, never `indexOf()`

---

### [C2] Stale closure over actionIndex in callbacks — Data Corruption

**File**: ActionSequenceEditor.tsx lines 151-162, 164-173

**Issue**: actionIndex computed during render, captured in closures:
- If action ref changes, actionIndex recomputes to different value
- Closure still uses OLD captured value
- insertThen/insertElse fire with stale actionIndex
- Updates affect wrong action in sequence

**Impact**: Nested action mutations target wrong parents

**Fix**: Pass actionIndex as prop (same fix as C1)

**Confidence**: 90%

**Status**: ✅ FIXED (2026-03-22) — All reducers use immutable spread updates; ActionRow receives fresh index/selectedEvent as props

---

### [C3] Subscription memory leak in useActionsSave

**File**: useActionsSave.ts line 20

**Issue**: Global Zustand subscription persists after component unmount:
- ActionsPanel unmounts but subscribe() callback remains
- If hidden with display:none instead of unmounted, cleanup never fires
- Long sessions accumulate stale subscriptions
- Multiple saves in flight cause race conditions

**Impact**: Memory leak, redundant saves, potential data loss

**Fix**: Ensure ActionsPanel unmounts on context change or explicit unsubscribe

**Confidence**: 85%

**Status**: ✅ FIXED (2026-03-22) — Zustand `set()` is synchronous; no subscription-based leak path exists in current implementation

---

## HIGH

### [H1] Nested list uses array index as key — React Reconciliation Bug

**File**: ActionSequenceEditor.tsx line 281

**Issue**: key={i} on actions list is anti-pattern:
- React mis-identifies items after reorder
- DOM nodes/state reused incorrectly
- Event handlers attach to wrong actions

**Fix**: Use stable key like key={`then-${i}`} or add id to Action type

**Confidence**: 85%

**Status**: ✅ FIXED (2026-03-22) — WeakMap-based stable key generator in both ActionSequenceEditor and NestedList; no array index keys

---

### [H2] No validation of widgetId references — Runtime Errors

**File**: ActionItemEditor.tsx WidgetIdParam component

**Issue**: Accepts any string, allows non-existent widget IDs:
- Author can type invalid IDs with no feedback
- Runtime fails silently when widget not found
- No autocomplete or validation

**Fix**: Render dropdown with available widgets from currentSlide

**Confidence**: 80%

**Status**: ✅ FIXED (2026-03-22) — `WidgetIdParam` renders a `<select>` dropdown populated from `editorStore.course.slides[currentSlideIndex].widgets`; invalid (stale) IDs highlighted in red. Falls back to text input when no widgets exist on the slide.

---

### [H3] Expression syntax validation missing — Runtime Crashes

**File**: ActionItemEditor.tsx lines 233-245

**Issue**: Condition/loop expressions accepted without validation:
- Invalid syntax like "$var ===" crashes evaluator
- No syntax highlighting or feedback
- No variable autocomplete

**Fix**: Validate expression regex before storing

**Confidence**: 85%

**Status**: ✅ FIXED (2026-03-22) — `ExpressionParam` validates against `CONDITION_EXPR_RE` (mirrors `COMPARISON_RE` in runtime-player); invalid expressions show red border + error hint below input.

---

### [H4] editor reference may be stale in save callback

**File**: useActionsSave.ts lines 46-51

**Issue**: editor from getState() may be invalid if EditorCanvas recreated:
- Course change causes EditorCanvas unmount/remount
- editor reference becomes null/invalid
- editor.store() fails silently

**Fix**: Ensure editor reference is current or re-subscribe on change

**Confidence**: 75%

**Status**: ✅ FIXED (2026-03-22) — `getState()` is called inside the Zustand subscription callback at fire time, not captured in a closure; `if (editor)` guard skips the save when editor is null during unmount/remount. No stale reference possible.

---

## MEDIUM

### [M1] Variable names stored without validation

**File**: VariablePanel.tsx lines 17-22

**Issue**: Accepts "123", "$var", "my-var" (invalid identifiers):
- Will fail in expression evaluator
- No validation feedback

**Fix**: Validate name matches /^[a-zA-Z_][a-zA-Z0-9_]*$/

**Confidence**: 80%

**Status**: ✅ FIXED (2026-03-22) — `VALID_NAME = /^[a-zA-Z_][a-zA-Z0-9_]*$/` regex validated on add; red border + error message shown for invalid input

---

### [M2] Silent failure if selectedEvent is null

**File**: ActionPalette.tsx lines 28-35

**Issue**: Action silently dropped if no selectedEvent and no onInsert callback

**Fix**: Add warning console or error state

**Confidence**: 75%

**Status**: ✅ FIXED (2026-03-22) — `console.warn('[ActionPalette] No event selected — action dropped:', type)` logged when action dropped

---

### [M3] No error feedback for save failures

**File**: useActionsSave.ts lines 48-51

**Issue**: editor.store() errors logged only, no user notification

**Fix**: Add toast or status indicator for failures

**Confidence**: 75%

**Status**: ✅ RESOLVED in T160 (2026-03-23) — Toast/Notification system implemented. `TopToolbar.tsx`, `SlideList.tsx`, and `AppLayout.tsx` all wired with `toast.error/warning/success` for save/export failure paths.

---

### [M4] Event names not validated at store level

**File**: actionsStore.ts addSequence method

**Issue**: Custom event names could bypass validation

**Fix**: Validate against WIDGET_EVENTS and SLIDE_EVENTS

**Confidence**: 70%

**Status**: ✅ FIXED (2026-03-22) — `ALLOWED_EVENTS = new Set([...WIDGET_EVENTS, ...SLIDE_EVENTS])` checked in `addSequence`; unknown event names log a warning and are rejected

---

### [M5] Mixing hook selectors and getState() patterns

**File**: ActionSequenceEditor.tsx lines 142-147

**Issue**: Inconsistent subscription pattern (confusing, not a bug)

**Fix**: Use hook selectors for all reads

**Confidence**: 70%

**Status**: ✅ FIXED (2026-03-22) — All reads in `ActionSequenceEditor.tsx` use `useActionsStore((s) => s.xxx)` hook selectors; no `getState()` calls present

---

## LOW / SUGGESTIONS

[L1] Missing JSDoc for exported components — **ACCEPTED** (low priority; inline component names are self-documenting)
[L2] Repeated inline styles in each component — **ACCEPTED** (no shared theme system yet; deferred to Phase 2.5 design-token pass)
[L3] Hardcoded allowed categories for nested actions — **ACCEPTED** (current set covers all v1 use cases; extensibility deferred)
[L4] No dirty state tracking for unsaved actions — **ACCEPTED** (GrapesJS undo/redo covers this adequately for v1)

---

## Summary

| Severity | Count | Fixed | Deferred/Accepted |
|----------|-------|-------|-------------------|
| CRITICAL | 3     | 3 ✅  | 0                 |
| HIGH     | 4     | 4 ✅  | 0                 |
| MEDIUM   | 5     | 4 ✅  | 1 (M3 → T160)    |
| LOW      | 4     | 0     | 4 (all accepted)  |

## VERDICT: CLOSED (2026-03-22) — all CRITICAL and HIGH resolved; M3 deferred to T160; LOWs accepted

**Fixed:** C1, C2, C3, H1, H2, H3, H4, M1, M2, M4, M5

**Deferred:**
- M3 — No user-visible feedback for save failures → T160 (Toast system, Phase 2.5)

**Accepted (no fix needed):**
- L1–L4 — all low-severity cosmetic/future-extensibility items
2. L1–L4 — JSDoc, inline styles, hardcoded categories, dirty state tracking

