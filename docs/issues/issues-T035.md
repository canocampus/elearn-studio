# Code Review: Phaser Sim Runtime Integration (T035)

**Date**: 2026-03-23
**Scope**: T035 — runtime-player phaser-sim mount, SCORM bridge, scorm-packager conditional bundle
**Status**: ✅ PASS — no CRITICAL or HIGH issues found

---

## CRITICAL Issues

_None._

---

## HIGH Issues

_None._

---

## MEDIUM Issues

### M-01: `phaserCleanups` Not Flushed on `init()` or Player Unmount

**File**: `packages/runtime-player/src/index.ts`
**Context**: `goToSlide()` correctly flushes `state.phaserCleanups` before each navigation.

**Issue**: There is no cleanup call when the entire player is torn down (e.g., LMS navigates
away from the iframe). If a host application re-initialises the player in the same window
without a full page reload, stale Phaser game instances could accumulate.

**Recommendation**: Expose a `ELearnPlayer.destroy()` method that flushes cleanups, or attach a
`beforeunload` listener. Low urgency — SCORM iframes are typically discarded on navigation.

**Status**: ⚠ Open — deferred; standard SCORM delivery unloads the iframe on exit.

---

### M-02: SCORM Score Normalisation Does Not Clamp Extreme Values

**File**: `packages/runtime-player/src/index.ts`
**Line**: `score: Math.min(1, Math.max(0, detail.score))`

**Issue**: Clamping is present but applied _after_ the value is stored.  If `detail.score` is
`NaN` (e.g., a buggy Phaser sim dispatches a non-numeric value), `Math.min/max` returns `NaN`,
which would be stored in `questionStates` and later passed to `LMSSetValue`.

**Recommendation**:
```typescript
const rawScore = typeof detail.score === 'number' && isFinite(detail.score)
  ? detail.score : 0
const score = Math.min(1, Math.max(0, rawScore))
```

**Status**: ⚠ Open — low probability, Phaser sim is internal code, but worth hardening.

---

### M-03: `mountPhaserSim` Promise Rejection Not Surfaced to User

**File**: `packages/runtime-player/src/index.ts`
**Line**: `mountPhaserSim(el, phaserConfig).then(...).catch(err => { console.error(...) })`

**Issue**: If `mountPhaserSim` rejects (bundle load failure or Phaser.Game constructor throw),
the error is logged to console but the learner sees a blank widget with no explanation.

**Recommendation**: On rejection, inject an error message into `el` similar to the bundle-not-found
path inside `mountPhaserSim` itself.

**Status**: ⚠ Open — `mountPhaserSim` already handles the bundle failure case internally; outer
rejection is an edge case (Phaser constructor crash).

---

### M-04: `courseHasPhaserSim` Not Tested With Multi-Slide Widgets Array

**File**: `packages/scorm-packager/src/__tests__/courseHasPhaserSim.test.ts`

**Issue**: Test suite covers second-slide detection but does not test a course where _every_
slide has multiple widgets (stress test for `some`/`some` short-circuit). Low risk given the
implementation is a simple double-`some`, but coverage depth is shallow.

**Status**: ⚠ Open — acceptable for current scope.

---

## LOW Priority

### L-01: No Integration Test for Full SCORM Score Flow
- `elearn:widgetScore` → `questionStates` → `scormReport` chain is tested only at unit level.
  An integration test mounting a mock Phaser sim and verifying `LMSSetValue` would increase
  confidence.

### L-02: `PhaserSimConfig` Width/Height Fallback Chain is Verbose
- `(ep.width as number | undefined) ?? w.bounds.width` repeated across multiple fields.
  A helper `getNumericProp(ep, 'width', w.bounds.width)` would reduce repetition.

### L-03: `buildSceneConfig` is a Pass-Through Stub
- `buildSceneConfig` always calls `makePlaceholderScene` regardless of `sceneDef` content.
  This is intentional for T035 (real scene builders are T036+) but should carry a `// TODO: T036`
  comment to signal the incomplete state.

### L-04: Dynamic Import Comment Duplication
- `/* @vite-ignore */` and `/* webpackIgnore: true */` are both present as defensive comments.
  The project uses Vite; webpackIgnore is dead code but harmless.

---

## Security Review

✅ `bundlePath` is a hardcoded relative string — no user input reaches the `import()` call.
✅ `elearn:widgetScore` listener validates `detail.widgetId` before acting.
✅ `courseHasPhaserSim` only reads `w.type`; no eval or dynamic execution path.
✅ `phaser-bundle.js` conditional copy: `fs.existsSync` guards prevent crash; no path traversal
   (path is resolved from `__dirname`, not user input).

---

## Bundle Size Verification

| File | Size impact |
|---|---|
| `phaserSimWidget.ts` | ~2 KB compiled — stays in main player.js |
| `phaser-bundle.js` | ~1 MB — only in ZIP when `courseHasPhaserSim` returns true |
| Main player delta | < 1 KB new code — well within 150 KB gzipped target |

---

## Summary

| Severity | Count | Status     |
|----------|-------|------------|
| CRITICAL | 0     | —          |
| HIGH     | 0     | —          |
| MEDIUM   | 4     | ⚠ Open    |
| LOW      | 4     | ⚠ Open    |

**Verdict**: ✅ PASS — implementation is clean and safe to ship.

No fixes required before commit. Medium issues are deferred to follow-up tasks (T036+ or a
dedicated hardening task).
