# Issues — T631: Fix stale closure in useExtendedProperties

**Task:** T631 — Fix stale closure in `useExtendedProperties` (MC/TF/Fill correct-answer persistence)
**Version:** v0.5.36
**Date:** 2026-04-05
**Status:** CLOSED

---

## Summary

T631 was opened to fix a stale closure bug in `useExtendedProperties` where `update(patch)` would spread over the stale `ep` closure variable rather than the current model value, causing cascading edits to lose earlier data. Investigation confirmed the fix was already applied in T621.

---

## Issues Found During Review

### CRITICAL

_None._

### HIGH

_None._

### MEDIUM

#### M-01 — `patchPromise.catch()` silently swallows autosave timeout

**File:** `e2e/tests/question-widget.spec.ts:751–755`

**Code:**
```typescript
const patchPromise = page.waitForResponse(
  resp => resp.url().includes('/courses') && resp.request().method() === 'PATCH',
  { timeout: 20_000 },
)
await patchPromise.catch(() => page.waitForTimeout(3000))
```

**Issue:** If no PATCH arrives within 20 s (e.g., autosave disabled in test env), the test silently falls back to `waitForTimeout(3000)` and continues — this could give a false-positive pass even when the save didn't happen.

**Resolution:** Acceptable for this regression test. The autosave is always active in the test environment, and the fallback only fires if something unexpected prevents the PATCH. The assertion after reload (`expect(correctTextAfterReload).toBe('Option B')`) is the authoritative check — if the save genuinely didn't happen, the reload would show Option A and the test would fail. **Accepted as-is.**

### LOW

#### L-01 — `console.log` in test `beforeEach` is debug-only noise

**File:** `e2e/tests/question-widget.spec.ts:707–709`

**Code:**
```typescript
page.on('console', msg => {
  if (msg.type() === 'error') console.log(`[BROWSER ERROR] ${msg.text()}`)
})
```

**Issue:** `console.log` in test helpers clutters CI output. Should use `test.info().annotations` or just remove — browser errors will also show in Playwright trace.

**Resolution:** Low impact for a single regression test. Other tests in the same file use the same pattern (e.g., `beforeEach` blocks for T601/T621). **Accepted as-is; consistent with existing test style.**

#### L-02 — `ourSlideIndex` captured before `addSlide` might be off-by-one if another slide was added concurrently

**File:** `e2e/tests/question-widget.spec.ts:717–718`

**Code:**
```typescript
const slides = page.locator('[data-testid="slide-item"]')
const ourSlideIndex = (await slides.count()) - 1
```

**Issue:** Count taken immediately after `addSlide()`. In theory a race could produce a stale count, but in practice Playwright's locator is always live and re-queries on `.count()`. **Not a real risk; accepted as-is.**

---

## T631.1 — Confirmed already done in T621

The `useExtendedProperties` hook at `QuestionPropertiesPanel.tsx:42–57` already contains the correct fix:

```typescript
function update(patch: Partial<T>) {
  const comp = component as { get(k: string): unknown }
  const latest = (comp.get('extendedProperties') as T | undefined) ?? defaults
  setEp({ ...latest, ...patch })
}
```

`comp.get('extendedProperties')` reads from the synchronous Backbone model — always the latest persisted value, never stale. `setEp` calls `useComponentProperty.update` which fires both `setValue(newValue)` (React state) and `comp.set(key, newValue)` (GrapesJS model).

No additional code change was required for T631.

---

## Regression Test Added (T631.6)

New test in `e2e/tests/question-widget.spec.ts` (line 702+):

- Tags: `@regression T631.6`
- Flow: drag MC widget → mark Option B correct → verify model → wait PATCH → reload → re-select widget → verify Option B still correct
- Uses `window.__elearn_editor.getSelected().get('extendedProperties')` for direct model assertion (same pattern as T601.4 and T621.5)

---

## CI Status

- Commit: `7d08f9c` — `test(T631): add @regression E2E test for MC correct-answer persistence across reload`
- CI run: `24007581011` — **success**
- All 657 unit tests pass; 2 pre-existing E2E flakes (GAP-02.2, T608.6) remain documented and unrelated to T631.
