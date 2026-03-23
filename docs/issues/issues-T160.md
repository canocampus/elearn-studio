# issues-T160 — Toast / Notification System

**Reviewed:** 2026-03-23
**Reviewer:** code-reviewer agent
**Status:** All CRITICAL issues resolved

---

## CRITICAL (resolved)

### T160-C1 — Module-level mutable `_idCounter` causes test pollution

**File:** `packages/authoring-ui/src/components/ui/Toast.tsx`
**Issue:** `let _idCounter = 0` is a module-level mutable variable. Because Vitest
isolates modules per test file, the counter is reset per file—but within a single file
running multiple tests the counter increments. Any future test asserting on specific
toast IDs would be sensitive to test execution order and fail non-deterministically.

**Fix applied:** Replaced the counter with `crypto.randomUUID()` which generates
collision-free IDs without any module-level mutable state.

---

### T160-C2 — Context value object recreated on every render (unstable reference)

**File:** `packages/authoring-ui/src/components/ui/Toast.tsx` (ToastProvider)
**Issue:** The `value` object literal was constructed inline on every render:

```typescript
const value: ToastContextValue = {
  success: (msg) => show('success', msg),
  // ...
}
```

Even though `show` was stable (via `useCallback`), the object literal created a new
reference on every render, causing all `useToast()` consumers to re-render even when
toast state changed for unrelated reasons.

**Fix applied:** Wrapped `value` with `useMemo(() => ({ ... }), [show])`.

---

## HIGH (acknowledged, no action required)

### T160-H1 — `onDismiss` in `ToastItem` useEffect dependency array

**File:** `packages/authoring-ui/src/components/ui/Toast.tsx` (ToastItem)
**Issue:** `onDismiss` is listed in the `useEffect` dependency array. Because the
upstream `dismiss` callback is stable (`useCallback(…, [])`), this is never a runtime
problem. If `onDismiss` were ever to become unstable the timer would restart on each
render.

**Decision:** Kept `onDismiss` in deps. React's exhaustive-deps rule requires it, and
the stability is guaranteed by the `useCallback(…, [])` upstream. Removing it would
suppress a lint rule without fixing any real bug.

---

## MEDIUM / LOW — None detected
