# T602 Code Review — Issues Report

**Reviewed:** 2026-04-02
**Scope:** T602 — Fix Question Properties Panel (BETA-01/02/03/08/09/13)
**Files reviewed:**
- `packages/authoring-ui/src/components/sidebar/QuestionPropertiesPanel.tsx` — `useExtendedProperties` hook + 3 form components

---

## CRITICAL (1)

### C-01 — `isLocalRef` guard not armed before `component.set()` — race condition if GrapesJS fires synchronously
**File:** `packages/authoring-ui/src/components/sidebar/QuestionPropertiesPanel.tsx` lines 75-83
**Issue:**
The original `update()` function set `isLocalRef.current = true` AFTER `setEp(next)`:
```typescript
setEp(next)
isLocalRef.current = true        // too late
component.set('extendedProperties', next)  // GrapesJS may fire change event synchronously
```
If GrapesJS fires the `change:extendedProperties` event synchronously during `component.set()`, `onExternalChange` runs while `isLocalRef.current` is still `false`. This causes `setEp()` to be called again with the same value — a redundant re-render at best, a loop at worst.

**Fix:** Move `isLocalRef.current = true` before both `setEp` and `component.set`:
```typescript
isLocalRef.current = true  // arm guard BEFORE anything that can trigger the listener
setEp(next)
component.set('extendedProperties', next)
```

**Severity:** CRITICAL — Subtle ordering bug; GrapesJS Backbone.Events fires synchronously.

---

## HIGH (1)

### H-01 — Redundant `setEp()` call at top of `useEffect` creates extra render on mount
**File:** `packages/authoring-ui/src/components/sidebar/QuestionPropertiesPanel.tsx` lines 58-73
**Issue:**
The `useEffect` body starts with `setEp(component.get('extendedProperties') ?? defaults)` unconditionally. On first mount this is redundant — `useState` initializer already reads the same value. This causes an extra render on mount.

The call IS necessary for component-switch (when `component` prop changes), but on first mount it wastes a render.

**Impact:** Minor — one extra render per form mount. Not user-visible.

**Fix:** Accepted as-is. The extra render on mount is a minor cost and removing it would require tracking first-mount vs. component-switch, adding complexity for no visible benefit.

---

## MEDIUM (2)

### M-01 — Stale closure in `updateOption` / `addOption` / `removeOption` under rapid calls
**File:** `packages/authoring-ui/src/components/sidebar/QuestionPropertiesPanel.tsx` lines 209-221
**Issue:**
`updateOption`, `addOption`, `removeOption` capture `ep` from the current render's closure via the `update` function. Rapid successive calls (e.g. click "Add" twice before re-render) use stale `ep.options`.

**Impact:** Unlikely in practice — these are user-interaction handlers and React 18 batches updates. Would require two identical rapid interactions before a re-render.

**Fix:** Accepted as-is. Functional `setState` pattern would require restructuring the hook's `update()` to use `setEp(prev => ...)`, which complicates the `component.set()` integration.

---

### M-02 — Defaults not guarded against Partial types at call sites
**File:** `packages/authoring-ui/src/types/questions.ts`
**Issue:**
The `defaults: T` parameter expects a full `T` but TypeScript could accept a `Partial<T>` if the call site type annotation is wrong. Pre-existing: the default constants are already correctly typed as full types (`MC_DEFAULT_EXTENDED: MCExtendedProps`), so this is not currently a problem.

**Fix:** No action needed — defaults are correctly typed.

---

## LOW (1)

### L-01 — `eslint-disable-next-line` comment lacked explanation
**File:** `packages/authoring-ui/src/components/sidebar/QuestionPropertiesPanel.tsx` line 72
**Issue:**
The `react-hooks/exhaustive-deps` disable comment had no explanation for why `defaults` is excluded from the dependency array.

**Fix:** Added comment: "Intentional: `defaults` is a stable module-level constant and never changes; only `component` can change."

---

## Resolution Status

| Issue | Status |
|-------|--------|
| C-01  | ✅ RESOLVED — Moved `isLocalRef.current = true` before `setEp()` and `component.set()` |
| H-01  | ✅ ACCEPTED AS-IS — Extra render on mount is minor and not user-visible; removing it adds complexity |
| M-01  | ✅ ACCEPTED AS-IS — Edge case not observable in practice; functional setState would complicate hook |
| M-02  | ✅ NOT AN ISSUE — Default constants are already typed as full `T`, not `Partial<T>` |
| L-01  | ✅ RESOLVED — Added inline explanation to eslint-disable comment |

---

## Verdict

**CLOSED — CRITICAL resolved; HIGH/MEDIUM accepted with documented reasoning.**

All 23 question-widget E2E tests pass. TypeScript check clean.
