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

**Fix applied**: Added `beforeunload` listener in `init()` that flushes `simCleanup` and all
`phaserCleanups` on page unload, guarding against stale instances in same-window re-init scenarios.

**Status**: ✅ Closed

---

### M-02: SCORM Score Normalisation Does Not Clamp Extreme Values

**File**: `packages/runtime-player/src/index.ts`
**Line**: `score: Math.min(1, Math.max(0, detail.score))`

**Issue**: Clamping is present but applied _after_ the value is stored.  If `detail.score` is
`NaN` (e.g., a buggy Phaser sim dispatches a non-numeric value), `Math.min/max` returns `NaN`,
which would be stored in `questionStates` and later passed to `LMSSetValue`.

**Fix applied**:
```typescript
const rawScore = typeof detail.score === 'number' && isFinite(detail.score)
  ? detail.score : 0
score: Math.min(1, Math.max(0, rawScore))
```

**Status**: ✅ Closed

---

### M-03: `mountPhaserSim` Promise Rejection Not Surfaced to User

**File**: `packages/runtime-player/src/widgets/phaserSimWidget.ts`
**Line**: after bundle load, `new Phaser.Game(...)` call

**Issue**: If `mountPhaserSim` rejects (bundle load failure or Phaser.Game constructor throw),
the error is logged to console but the learner sees a blank widget with no explanation.

**Fix applied**: Wrapped `new Phaser.Game(...)` in a try/catch; on failure logs to console
and injects `<p style="color:red;...">Simulation failed to initialize.</p>` into `container`,
matching the bundle-not-found error display pattern already in place.

**Status**: ✅ Closed

---

### M-04: `courseHasPhaserSim` Not Tested With Multi-Slide Widgets Array

**File**: `packages/scorm-packager/src/__tests__/courseHasPhaserSim.test.ts`

**Issue**: Test suite covers second-slide detection but does not test a course where _every_
slide has multiple widgets (stress test for `some`/`some` short-circuit).

**Fix applied**: Added two new tests — one that places `phaser-sim` in one of five slides each
having multiple widgets (returns true), and one with five multi-widget slides but no `phaser-sim`
(returns false). Both exercise the `some`/`some` short-circuit fully.

**Status**: ✅ Closed

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

**Fix applied**: Replaced informal comment with `// TODO: T036 — delegate to per-simType scene builders`.

**Status**: ✅ Closed

### L-04: Dynamic Import Comment Duplication
- `/* @vite-ignore */` and `/* webpackIgnore: true */` are both present as defensive comments.
  The project uses Vite; webpackIgnore is dead code but harmless.

**Fix applied**: Removed `/* webpackIgnore: true */` — project uses Vite exclusively.

**Status**: ✅ Closed

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
| MEDIUM   | 4     | ✅ All Closed |
| LOW      | 4     | 2 ✅ Closed / 2 ⚠ Open |

**Verdict**: ✅ PASS — implementation is clean and safe to ship.

**Post-commit hardening (2026-03-23)**:
- [M-01] ✅ `beforeunload` listener added to `init()` — flushes `phaserCleanups` on player teardown
- [M-02] ✅ NaN/Infinity guard added before SCORM score clamping
- [M-03] ✅ try/catch around `new Phaser.Game(...)` — injects error UI into container on constructor crash
- [M-04] ✅ Multi-slide multi-widget stress tests added to `courseHasPhaserSim.test.ts`
- [L-03] ✅ `// TODO: T036` comment added to `buildSceneConfig` stub
- [L-04] ✅ Dead `/* webpackIgnore: true */` comment removed
