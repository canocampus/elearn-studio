# Code Review — TA608 Course Progress Bar Widget Implementation

**Reviewer:** Claude Code (Haiku 4.5)
**Date:** 2026-04-03
**Focus:** Correctness, edge cases, real-world impact

---

## Review Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 1     | fail   |
| HIGH     | 2     | warn   |
| MEDIUM   | 1     | info   |
| LOW      | 0     | pass   |

**Verdict:** CRITICAL + HIGH issues must be resolved before merge.

---

## Issues Found

### CRITICAL

#### [CRITICAL] visitedSlides reset on resume; progress regresses after closing course

**File:** `packages/runtime-player/src/index.ts` lines 921–965; `packages/runtime-player/src/suspend.ts` lines 143–172

**Issue:**
When a player resumes from suspend_data, the visitedSlides Set is initialized as empty (line 931) instead of being restored from the suspend data. The suspend_data format only stores currentSlide and questionStates—it does NOT store visitedSlides.

**Scenario:**
1. User navigates all 4 slides (visited 0, 1, 2, 3). Progress bar shows 100%.
2. User closes course. suspend_data saves: {slide: 3, scores: {...}}
3. User resumes. Player restores currentSlide=3 but visitedSlides={} (empty)
4. Player calls goToSlide(3), adding only slide 3: visitedSlides={3}
5. Progress = Math.round((1/4)*100) = 25% instead of 100%
6. **Progress regresses on resume** — critical data loss

**Root cause:** saveSuspendData() and restoreSuspendData() do not serialize/deserialize visitedSlides.

**Fix:** Extend suspend data format to include visitedSlides array. In restoreSuspendData(), populate state.visitedSlides from the saved array.

**Impact:** Users lose progress tracking after closing and resuming a course.

---

### HIGH

#### [HIGH] Height input validation anti-pattern; typed values disappear on blur

**File:** `packages/authoring-ui/src/components/sidebar/ProgressBarPropertiesPanel.tsx` lines 228–230

**Issue:**
```typescript
onChange={e => {
  const n = parseInt(e.target.value, 10)
  if (!isNaN(n) && n >= 4 && n <= 40) setHeight(n)
}}
```

HTML min/max attributes only constrain spinner buttons, not keyboard input. If user types "50", the input shows "50" but React state remains at the old value (e.g., 12). When user clicks away, the field reverts to 12. This is a **controlled input anti-pattern** causing confusing UX.

**Fix:** Clamp the value:
```typescript
onChange={e => {
  const n = parseInt(e.target.value, 10)
  const clamped = isNaN(n) ? height : Math.max(4, Math.min(40, n))
  setHeight(clamped)
}}
```

**Impact:** Confusing UX where typed values disappear.

---

#### [HIGH] No verification that autosave succeeded; E2E test lacks response status check

**File:** `e2e/tests/progress-bar-widget.spec.ts` lines 142–145

**Issue:**
Test waits for PATCH response but doesn't verify it succeeded:
```typescript
await page.waitForResponse(
  resp => resp.url().includes('/courses') && resp.request().method() === 'PATCH',
  { timeout: 10_000 },
)
```

If backend returns 500 Internal Server Error, test still passes. The 10s timeout is also tight under slow CI networks.

**Fix:** Check response status:
```typescript
const response = await page.waitForResponse(
  resp => resp.url().includes('/courses') && resp.request().method() === 'PATCH',
  { timeout: 10_000 },
)
expect(response.status()).toBeLessThan(400)
await page.waitForTimeout(500)
```

**Impact:** Flaky E2E test; false positive on backend failures.

---

### MEDIUM

#### [MEDIUM] Progress bar percentage text element not cleaned up if showPercent changes

**File:** `packages/runtime-player/src/index.ts` lines 335–337, 715–717

**Issue:**
When showPercent is true, the percentage text element is rendered with class "el-progress-percent". If an author later sets showPercent=false on the same widget, the old DOM element remains in the page. When updateProgressBars() runs, it queries all .el-progress-percent elements and updates them, even though they shouldn't exist.

This is mitigated because slide re-renders replace innerHTML (line 554), so the stale element is removed on navigation. However, if multiple widgets are on the same slide and only one has showPercent changed, the other's old element could persist.

**Fix:** Add a guard when updating:
```typescript
state.container.querySelectorAll<HTMLElement>('.el-progress-percent').forEach(el => {
  if (el.closest('.el-progress-bar')) {  // Only update within progress bars
    el.textContent = `${pct}%`
  }
})
```

Or better, scope the query to progress bar containers:
```typescript
state.container.querySelectorAll<HTMLElement>('.el-progress-bar-fill').forEach(fill => {
  fill.style.width = `${pct}%`
  const percent = fill.closest('.el-progress-bar')?.querySelector('.el-progress-percent')
  if (percent) percent.textContent = `${pct}%`
})
```

**Impact:** Low risk due to innerHTML re-render on navigation, but design is fragile.

---

## Non-Issues / Design Confirmations

### Properties Panel Hooks (Not an Issue)
The custom useExtendedString/useExtendedNum/useExtendedBool hooks duplicate code from QuestionPropertiesPanel. This is acceptable for readability and simplicity. No issue.

### Block Defaults Match Runtime (Not an Issue)
Verified that block registration defaults match runtime fallback defaults. No mismatch.

### isLocalRef Loop Prevention (Correct)
The pattern to prevent Backbone→React→GrapesJS event loops is valid and correctly implemented.

---

## Summary of Fixes Required

1. **CRITICAL** — Extend suspend_data to include and restore visitedSlides
   - Effort: Medium
   - Files: suspend.ts, index.ts
   - Impact: Prevents progress regression on resume

2. **HIGH** — Fix height input validation to clamp out-of-range values
   - Effort: Low (1 line change)
   - File: ProgressBarPropertiesPanel.tsx
   - Impact: UX improvement

3. **HIGH** — Add response status check to E2E test
   - Effort: Low (1 line change)
   - File: progress-bar-widget.spec.ts
   - Impact: Prevents false positives on backend failures

4. **MEDIUM** — Scope progress-percent updates to avoid stale elements
   - Effort: Low
   - File: index.ts updateProgressBars()
   - Impact: Hardens DOM update logic

---

## Files Reviewed

- packages/authoring-ui/src/editor/registerBlocks.ts (449–488)
- packages/authoring-ui/src/components/sidebar/ProgressBarPropertiesPanel.tsx (all)
- packages/runtime-player/src/index.ts (329–343, 545–637, 708–718, 920–965)
- packages/runtime-player/src/suspend.ts (143–172)
- e2e/tests/progress-bar-widget.spec.ts (all)
