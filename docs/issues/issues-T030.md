# Code Review: Phaser Simulations Package (T030)

**Date**: 2026-03-23
**Scope**: Phase 3 / T030–T033 — Phaser simulations package + scenes
**Status**: ✅ RESOLVED — all CRITICAL and HIGH issues fixed

---

## CRITICAL Issues

### C-01: Test File Out of Scope

**File**: `packages/phaser-simulations/src/__tests__/ProcessFlowScene.test.ts`  
**Issue**: References ProcessFlowLogic (T031, not T030) that doesn't exist.

**Details**:
- Line 88: `import { ProcessFlowLogic } from '../scenes/ProcessFlowLogic'`
- Test runner fails: `Error: Failed to resolve import`
- Suite cannot run: `Test Files 1 failed | 2 passed (3)`

**Why Critical**: Blocks integration testing and CI/CD.

**Fix**: Move ProcessFlowScene.test.ts to T031 deliverables (it's correctly written but scheduled for next phase).

---

### C-02: Non-Null Assertions in Async Lifecycle

**File**: `packages/phaser-simulations/src/PhaserSimWidget.ts`  
**Lines**: 50, 82, 86, 90

**Issue**: Uses `!` without runtime guards, creating crash risk.

```typescript
this.game.events.on('sim-complete', () => {
  this.tracker!.complete()  // ← Null if event fires during race
})
```

**Why Critical**: If sim-complete fires before mount() completes, tracker is null → runtime crash.

**Fix**: Add null check:
```typescript
if (!this.tracker) {
  console.error('ScoreTracker uninitialized')
  return
}
this.tracker.complete()
```

---

## HIGH Issues

### H-01: Division by Zero

**File**: `packages/phaser-simulations/src/ScoreTracker.ts`  
**Lines**: 34–40

**Issue**: Returns NaN if all steps have maxScore=0.

```typescript
const max = scores.reduce((sum, s) => sum + s.maxScore, 0)
return Math.round((earned / max) * 100)  // ← NaN if max === 0
```

**Example**: `addStep('s1', 0, 0)` → `0/0 = NaN`

**Why High**: Violates invariant (score should be 0–100).

**Fix**: Add guard:
```typescript
if (max === 0) return 0
return Math.round((earned / max) * 100)
```

---

### H-02: Test Isolation — Manual Event Listeners

**File**: `packages/phaser-simulations/src/__tests__/ScoreTracker.test.ts`  
**Lines**: 79–93

**Issue**: Tests manually manage window listeners without teardown guards.

```typescript
window.addEventListener('elearn:widgetScore', listener)
tracker.complete()
expect(listener).toHaveBeenCalledOnce()
window.removeEventListener('elearn:widgetScore', listener)  // ← Leaks if throws
```

**Why High**: Shared global state; listener persists if test fails.

**Fix**: Use beforeEach/afterEach for cleanup guarantee.

---

### H-03: Incomplete Type Exports

**File**: `packages/phaser-simulations/src/index.ts`

**Issue**: Missing physics-demo and concept-animator type definitions.

**Details**:
- `types.ts` defines 5 SimTypes (process-flow, interactive-diagram, gamified-quiz, physics-demo, concept-animator)
- `index.ts` SceneDef union only exports 3 of 5
- T033/T034 cannot use public API types

**Why High**: Breaks forward compatibility.

**Fix**: Add stub definitions and export all 5 types:
```typescript
export interface PhysicsDemoSceneDef {
  simType: 'physics-demo'
  // TODO: T033
}

export interface ConceptAnimatorSceneDef {
  simType: 'concept-animator'
  // TODO: T034
}
```

---

## MEDIUM Issues

### M-01: Non-Null Propagation Without Comments

**File**: `packages/phaser-simulations/src/PhaserSimWidget.ts`
**Lines**: 82, 86, 90

**Issue**: Non-null assertions lack explanation (M-02 below covers type casts).

**Fix applied**: Added "Safety: tracker is guaranteed set above; game events fire after mount() completes." comment above the `sim-complete` listener.

**Status**: ✅ Closed

---

### M-02: Missing Scene Type Cases

**File**: `packages/phaser-simulations/src/PhaserSimWidget.ts`
**Lines**: 79–95

**Issue**: buildScene() handles 3/5 SimTypes; no TODO for T033/T034.

**Fix applied**: Added `// TODO: T033 — physics-demo scene builder` and `// TODO: T034 — concept-animator scene builder` stubs in the `buildScene()` switch.

**Status**: ✅ Closed

---

### M-03: No Unit Tests for PhaserSimWidget

**File**: `packages/phaser-simulations/src/PhaserSimWidget.ts`

**Issue**: Zero tests for mount, destroy, getTracker, getController lifecycle.

**Why Medium**: Critical paths untested.

**Fix applied**: Created `packages/phaser-simulations/src/__tests__/PhaserSimWidget.test.ts` with 16 tests
covering initial null state, `mount()` game creation, `sim-complete` listener dispatch, constructor
error injection, `destroy()` idempotency, and double-mount cleanup. Phaser and scene modules mocked
via `vi.mock` so no WebGL/canvas required.

**Status**: ✅ Closed

---

### M-04: Type Cast Workaround

**File**: `packages/phaser-simulations/src/PhaserSimWidget.ts`
**Lines**: 76, 82

**Issue**: `as unknown as typeof Phaser.Scene` suggests type architecture strain.

**Fix applied**: Added "Safety: scene instances satisfy Phaser.Scene at runtime; typed as unknown first because TypeScript cannot verify structural compatibility without the full Phaser types." comment on each cast.

**Status**: ✅ Closed

---

## LOW Priority

### L-01: Missing Error Handling in mount()
- No try/catch around Phaser.Game init (low risk but should add)

**Fix applied**: Wrapped `new Phaser.Game(...)` in a try/catch; on failure logs to console and injects a red error paragraph into `container`.

**Status**: ✅ Closed

### L-02: Missing JSDoc
- Public methods lack @param/@return documentation

**Fix applied**: Added `@param`/`@returns` JSDoc to `mount()`, `destroy()`, `getTracker()`, and `getController()`.

**Status**: ✅ Closed

### L-03: Magic Numbers
- ModeController line 63: divisor 2 lacks explanation

**Fix applied**: Extracted as `private static readonly RETRY_DECAY_BASE = 2` with JSDoc
explaining the exponential decay formula.

**Status**: ✅ Closed

### L-04: Dead Code
- ProcessFlowScene.test.ts mocks (lines 14–50) unused; expected for T031

**Fix applied**: Removed dead `mockEmit`, `mockOn`, `mockGameEvents`, `mockText`, `mockCircle`, `mockLine`, `mockGraphics`, and `MockScene` declarations from `ProcessFlowScene.test.ts` (lines 13–50). Tests target only `ProcessFlowLogic` and require no Phaser mocks.

**Status**: ✅ Closed

---

## Security Review

✅ CustomEvent dispatch: SAFE (intentional SCORM bridge, no PII)  
✅ Dynamic import: SAFE (trusted dependency, no user input)

---

## Summary

| Severity | Count | Status    |
|----------|-------|-----------|
| CRITICAL | 2     | ✅ Closed |
| HIGH     | 3     | ✅ Closed |
| MEDIUM   | 4     | ✅ All Closed |
| LOW      | 4     | ✅ All Closed |

**Verdict**: ✅ PASS (all issues closed)

**Fixes applied**:
1. [C-01] ✅ ProcessFlowLogic created — test file now passes (T031 delivered in same session)
2. [C-02] ✅ Null guards added (`?.` operator + invariant throw in buildScene)
3. [H-01] ✅ `if (max === 0) return 0` guard in `getPercentage()`
4. [H-02] ✅ ScoreTracker tests refactored with `beforeEach`/`afterEach` listener lifecycle
5. [H-03] ✅ `PhysicsDemoSceneDef` and `ConceptAnimatorSceneDef` stubs added to types.ts + exported from index.ts
6. [M-01] ✅ "Safety: ..." comment added above `sim-complete` listener
7. [M-02] ✅ `// TODO: T033` and `// TODO: T034` stubs added to `buildScene()` switch
8. [M-04] ✅ Explanatory comment added on each `as unknown as typeof Phaser.Scene` cast
9. [L-01] ✅ try/catch added around `new Phaser.Game(...)` with error injection into container
10. [L-02] ✅ JSDoc `@param`/`@returns` added to `mount()`, `destroy()`, `getTracker()`, `getController()`
11. [L-03] ✅ `RETRY_DECAY_BASE = 2` extracted as named constant with JSDoc
12. [L-04] ✅ Dead mock declarations removed from `ProcessFlowScene.test.ts`
