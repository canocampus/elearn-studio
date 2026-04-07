# T612 Code Review — requireAllSlides Gate & Resume Navigation

**Date:** 2026-04-04  
**Status:** PENDING REVIEW  
**Scope:**
- packages/runtime-player/src/index.ts — finishCourse() gate, legacy lesson_location fallback, H-01/H-02 fixes
- packages/runtime-player/src/__tests__/scorm2004.test.ts — 2 unit tests (T612.8)
- e2e/tests/persistence.spec.ts — 1 E2E regression test (T612.9)

---

## Summary

T612 implements navigation gating for courses with requireAllSlides: true. The main implementation (finishCourse guard) is logically sound, but the test suite has incomplete coverage that masks potential edge cases. The legacy fallback for lesson_location correctly seeds visitedSlides with a range, but the range boundaries create a subtle ordering assumption not documented.

---

## Findings

### CRITICAL

None found.

---

### HIGH

#### HIGH-01: finishCourse() loop logic correct but test coverage incomplete

**File:** packages/runtime-player/src/__tests__/scorm2004.test.ts:328-361

**Issue:** First T612 regression test does not verify that the player navigated to slide 1. Test checks cmi.completion_status remains incomplete, which is correct. However, if finishCourse() silently did nothing instead of calling goToSlide(state, i), the test would still pass.

**Fix:** Add assertion verifying navigation occurred:
- Check SCORM location: expect(store['cmi.location']).toBe('1') for SCORM 2004
- OR verify slide content changed

**Severity:** HIGH — Gate logic implemented but test does not prove redirect path executes.

---

#### HIGH-02: Legacy lesson_location fallback assumes slides visited in order

**File:** packages/runtime-player/src/index.ts:995-999

**Code:**
```javascript
for (let i = 0; i <= idx; i++) {
  state.visitedSlides.add(i)
}
```

**Issue:** Assumes learner visited every slide from 0 to restored index. For navigationMode='free', this is false. Example:
1. Course: navigationMode='free', requireAllSlides=false
2. Learner: slides 0 → skip to 5 → exit
3. SCORM 1.2 stores: lesson_location = 5
4. Resume code seeds visitedSlides = {0,1,2,3,4,5} [FALSE]

When course updated to require all slides, gate allows finish immediately even though slides 1-4 never visited.

**Fix:** Document limitation OR conditionally seed by navigationMode:
```javascript
if (navigationMode === 'linear' || navigationMode === 'linear-strict') {
  for (let i = 0; i <= idx; i++) {
    state.visitedSlides.add(i)
  }
} else {
  state.visitedSlides.add(idx)  // free nav: only mark restored slide
}
```

**Severity:** HIGH — Silent data inconsistency; learners bypass requireAllSlides if resuming from old free-nav sessions.

---

### MEDIUM

#### MEDIUM-01: finishCourse() error not caught if goToSlide throws

**File:** packages/runtime-player/src/index.ts:687-698

**Issue:** If goToSlide(state, i) throws, error bubbles up before SCORM reporting. Session left incomplete, cmi.completion_status not set.

**Fix:** Wrap in try-catch:
```javascript
try {
  goToSlide(state, i)
} catch (err) {
  console.error('goToSlide failed:', err)
}
return
```

**Severity:** MEDIUM — Unlikely but leaves session undefined.

---

#### MEDIUM-02: restoreSuspendData() silently filters out-of-bounds indices

**File:** packages/runtime-player/src/suspend.ts:170-174

**Issue:** If payload contains visited=[0,1,999] and slideCount=3, filter removes 999 silently. No warning, so authoring system unaware of course edits.

**Fix:** Log warning:
```javascript
const filtered = Array.isArray(payload.visited)
  ? payload.visited.filter(...)
  : [payload.slide]

if (filtered.length < (payload.visited?.length ?? 0)) {
  console.warn('[ELearnPlayer] Dropped out-of-bounds visited slides.')
}

state.visitedSlides = new Set(filtered)
```

**Severity:** MEDIUM — Silent data loss during edits.

---

### LOW

#### LOW-01: finishCourse() comment could be clearer

**File:** packages/runtime-player/src/index.ts:691-697

**Issue:** Code correct (iterates 0→1→2, returns on first unvisited). Comment could say "lowest index":
```javascript
// Find the first unvisited slide (lowest index) and navigate
for (let i = 0; i < totalSlides; i++) {
```

**Severity:** LOW — Code correct, documentation improvement only.

---

#### LOW-02: updateNavButtons() console.warn fires repeatedly

**File:** packages/runtime-player/src/index.ts:664-665

**Issue:** Warning fires every updateNavButtons() call if buttons.length === 0. Floods console if slide lacks nav-next buttons.

**Fix:** Module-level flag to warn once per session.

**Severity:** LOW — Diagnostic noise only.

---

## Test Coverage Analysis

### Unit Tests (scorm2004.test.ts:328-391)

Test 1 (lines 328-361):
- Verifies: 3-slide course, requireAllSlides=true → finish → cmi.completion_status NOT 'completed'
- Missing: Assertion that player navigated to slide 1

Test 2 (lines 363-391):
- Verifies: 1-slide course, requireAllSlides=true → finish → cmi.completion_status === 'completed'
- Missing: Multi-slide "all visited" test

**Verdict:** Covers happy path and single-slide edge case. Needs verification of navigation side effects and multi-slide all-visited case.

### E2E Test (persistence.spec.ts:412-463)

**Coverage:** Settings round-trip (linear-strict + requireAllSlides survive reload)
- Excellent for authoring persistence
- Missing: Runtime player gate test (requires SCORM mock in test)

---

## Edge Cases Not Covered

1. **Empty course (0 slides):** Loop runs 0 times → SCORM report (correct). visitedSlides empty, progress 0%.

2. **Single slide:** Covered but test name misleading.

3. **Mixed mode change:** Resume SCORM 1.2 free-nav, course updated to linear-strict + requireAllSlides. Legacy fallback overcounts visited (HIGH-02).

4. **Visited array gaps:** suspend_data v:2 with visited=[0,2,4]. Handled correctly but not tested.

---

## Code Quality

**Immutability:** Good — visitedSlides is Set (correct), no course mutations

**Error handling:** Gap — finishCourse no try-catch around goToSlide (MEDIUM-01)

**Naming:** Good — clear function names, could clarify loop comment

**Dependencies:** Good — no hardcoded values, no console.log in prod paths

---

## Verdict

**Status:** WARNING — Address HIGH issues before merge

### Must Fix
1. HIGH-01: Test must verify navigation to slide 1 occurred
2. HIGH-02: Document or gate lesson_location fallback by navigationMode

### Should Fix Soon
1. MEDIUM-01: Try-catch around goToSlide
2. MEDIUM-02: Warn when visited indices filtered

### Nice-to-Have
1. LOW-01: Clarify comment
2. LOW-02: Rate-limit warning

---

## Files Affected

- packages/runtime-player/src/index.ts (661-698, 995-999)
- packages/runtime-player/src/suspend.ts (170-174)
- packages/runtime-player/src/__tests__/scorm2004.test.ts (328-391)
- e2e/tests/persistence.spec.ts (412-463)



---

## Review Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0     | pass   |
| HIGH     | 2     | RESOLVED |
| MEDIUM   | 2     | RESOLVED |
| LOW      | 2     | RESOLVED |

**Verdict: APPROVED** — all issues resolved.

### Resolution Log

- **HIGH-01** — RESOLVED: `expect(store['cmi.location']).toBe('1')` assertion added to T612 regression test (scorm2004.test.ts:360)
- **HIGH-02** — RESOLVED: legacy `lesson_location` fallback now gates `visitedSlides` seeding by `navigationMode` — linear-strict seeds [0..idx], free-nav seeds only [idx] (index.ts:1066–1072)
- **MEDIUM-01** — RESOLVED: try-catch around `goToSlide()` added to `finishCourse()` (index.ts:705–710)
- **MEDIUM-02** — RESOLVED: `restoreSuspendData()` now warns when out-of-bounds visited indices are dropped (suspend.ts:172–176)
- **LOW-01** — RESOLVED: `finishCourse()` loop comment clarified to "Find the first unvisited slide (lowest index)" (index.ts:704)
- **LOW-02** — RESOLVED: `_noNavNextWarned` module-level flag rate-limits the nav-buttons warning to once per session (index.ts:159, 673–676)

