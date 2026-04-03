# T611 Code Review — Issues Report

**Reviewed:** 2026-04-04
**Scope:** T611 — Mandatory question gating in linear-strict navigation mode
**Commit:** 2e0e476
**Files reviewed:** `packages/authoring-ui/src/types/questions.ts`, `packages/authoring-ui/src/components/sidebar/QuestionPropertiesPanel.tsx`, `packages/runtime-player/src/index.ts`

---

## CRITICAL (0)

No CRITICAL issues detected.

---

## HIGH (2)

### H-01 — `slideIsComplete()` does not guard against invalid widget.extendedProperties

**File:** `packages/runtime-player/src/index.ts` lines 646–658
**Issue:** The function assumes `widget.extendedProperties` exists and can be safely cast to `{ mandatory?: boolean } | undefined`. If a widget has `extendedProperties: null` or missing `scoring`, the unsafe property access can fail.

```typescript
// Current code (line 651):
const scoring = (widget.extendedProperties.scoring as { mandatory?: boolean } | undefined)

// Problem: If extendedProperties is null, this throws TypeError
```

**Risk:** Slides with malformed question widgets (migrated from older schema) will crash `slideIsComplete()`, breaking navigation entirely.

**Fix:** Guard the access with optional chaining:
```typescript
const scoring = (widget.extendedProperties?.scoring as { mandatory?: boolean } | undefined)
```

---

### H-02 — `updateNavButtons()` silently succeeds when no nav buttons exist on the slide

**File:** `packages/runtime-player/src/index.ts` lines 661–668
**Issue:** If a slide has no navigation widget, the query for `[data-nav-next]` returns an empty NodeList and forEach runs 0 times. No error, no warning. This silently defeats mandatory question gating.

```typescript
// Current code (lines 663–667):
state.container.querySelectorAll<HTMLButtonElement>('[data-nav-next]').forEach(btn => {
  btn.disabled = !complete
  btn.style.opacity = complete ? '' : '0.4'
  btn.style.cursor = complete ? 'pointer' : 'not-allowed'
})
// If query finds 0 buttons, no op silently executed
```

**Risk:** If nav button is missing, mandatory questions are never enforced. Learner can bypass gating. This is a silent failure that violates T611 requirements.

**Impact:** Critical to T611 feature, even though slides without nav widgets are rare.

**Fix:** Add warning or enforce nav button presence:
```typescript
function updateNavButtons(state: PlayerState): void {
  const complete = slideIsComplete(state, state.currentSlide)
  const buttons = state.container.querySelectorAll<HTMLButtonElement>('[data-nav-next]')
  if (buttons.length === 0) {
    console.warn('[ELearnPlayer] No nav-next buttons found — mandatory question gating disabled.')
  }
  buttons.forEach(btn => {
    btn.disabled = !complete
    btn.style.opacity = complete ? '' : '0.4'
    btn.style.cursor = complete ? 'pointer' : 'not-allowed'
  })
}
```

---

## MEDIUM (3)

### M-01 — `slideIsComplete()` edge case: slide with mandatory questions but empty questionStates

**File:** `packages/runtime-player/src/index.ts` lines 646–658
**Issue:** When a learner hasn't submitted any answers yet, `questionStates` is empty. The logic correctly returns false:

```typescript
const qs = state.questionStates.get(widget.id)
if (!qs?.answered) return false  // Correct: missing entry = unanswered
```

However, this relies on Map absence semantics, not explicit false. Future maintainers might accidentally change this incorrectly.

**Risk:** Low — logic is correct, but fragile to refactoring.

**Fix:** Add clarifying comment:
```typescript
const qs = state.questionStates.get(widget.id)
// Missing entry means unanswered; answered must be explicitly true
if (!qs?.answered) return false
```

---

### M-02 — Inconsistent type casts for scoring across the file

**File:** `packages/runtime-player/src/index.ts`
**Issue:** Three different patterns cast scoring to different shapes:

- Line 651: `as { mandatory?: boolean } | undefined`
- Line 779: `as { weight?: number; attempts?: number }`
- Line 856: `as number | undefined` (for passingScore, not scoring)

This inconsistency makes code harder to read and increases risk of casting errors.

**Risk:** Minimal — code works. But different developers may assume different casts.

**Fix:** Define a shared type at the top:
```typescript
type QuestionScoringInfo = { weight?: number; attempts?: number; mandatory?: boolean }
```

Then use consistently across the file.

---

### M-03 — `mandatory` field not initialized in default question configs

**File:** `packages/authoring-ui/src/types/questions.ts` lines 48, 68, 93
**Issue:** Default configs don't include `mandatory: false` in scoring:

```typescript
// Current:
scoring: { weight: 100, attempts: -1 },

// Should be:
scoring: { weight: 100, attempts: -1, mandatory: false },
```

This works because the UI defaults to unchecked, but creates inconsistency in the saved JSON schema.

**Risk:** Low — optional field works fine. But future code that does `if (scoring.mandatory === true)` (strict equality) instead of `if (scoring.mandatory)` will behave differently for new vs. edited questions.

**Fix:** Add `mandatory: false` to all three defaults for schema consistency.

---

## LOW (2)

### L-01 — Defensive redundancy in `goNext()`

**File:** `packages/runtime-player/src/index.ts` line 671
**Issue:** The function checks `slideIsComplete()` even though `updateNavButtons()` already disabled the button. This is unreachable code (in normal flow), but it's defensive and safe to keep.

**Assessment:** Keep the check. It's good defense-in-depth practice. Add a comment to clarify:
```typescript
// Defensive check: also enforced in updateNavButtons() but re-verify at action time
if (!slideIsComplete(state, state.currentSlide)) return
```

---

### L-02 — Missing documentation: mandatory field persistence

**File:** `packages/runtime-player/src/index.ts` docstring (line 642)
**Issue:** The mandatory field is stored in MongoDB via extendedProperties. This should be documented:

```typescript
/** Returns true if the learner may leave the given slide.
 *  In 'linear-strict' mode, all questions with scoring.mandatory === true must be answered.
 *  The mandatory flag is persisted in widget.extendedProperties.scoring in MongoDB.
 *  In 'free' mode (or when no navigationMode is set), always returns true.
 */
```

**Assessment:** Minor improvement for clarity.

---

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0     | pass   |
| HIGH     | 2     | warn   |
| MEDIUM   | 3     | info   |
| LOW      | 2     | note   |

**Verdict:** WARNING — 2 HIGH issues must be resolved before merge:

1. **H-01** — Add optional chaining to guard `widget.extendedProperties?.scoring` (prevents crash)
2. **H-02** — Add console warning when no nav buttons found (prevents silent T611 bypass)

MEDIUM issues (M-01–M-03) are code quality improvements for follow-up review. LOW issues are documentation/style enhancements.

### Recommendation

**Do not merge** until H-01 and H-02 are fixed. H-01 can crash; H-02 can silently disable mandatory question gating.
