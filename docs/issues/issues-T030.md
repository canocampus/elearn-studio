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

**Fix**: Add comment: "Safety: tracker and controller guaranteed set by mount()."

---

### M-02: Missing Scene Type Cases

**File**: `packages/phaser-simulations/src/PhaserSimWidget.ts`  
**Lines**: 79–95

**Issue**: buildScene() handles 3/5 SimTypes; no TODO for T033/T034.

**Fix**: Add TODO comments.

---

### M-03: No Unit Tests for PhaserSimWidget

**File**: `packages/phaser-simulations/src/PhaserSimWidget.ts`

**Issue**: Zero tests for mount, destroy, getTracker, getController lifecycle.

**Why Medium**: Critical paths untested.

---

### M-04: Type Cast Workaround

**File**: `packages/phaser-simulations/src/PhaserSimWidget.ts`  
**Lines**: 76, 82

**Issue**: `as unknown as typeof Phaser.Scene` suggests type architecture strain.

---

## LOW Priority

### L-01: Missing Error Handling in mount()
- No try/catch around Phaser.Game init (low risk but should add)

### L-02: Missing JSDoc
- Public methods lack @param/@return documentation

### L-03: Magic Numbers
- ModeController line 63: divisor 2 lacks explanation

### L-04: Dead Code
- ProcessFlowScene.test.ts mocks (lines 14–50) unused; expected for T031

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
| MEDIUM   | 4     | ⚠ Open    |
| LOW      | 4     | ⚠ Open    |

**Verdict**: ✅ PASS (CRITICALs and HIGHs resolved)

**Fixes applied**:
1. [C-01] ✅ ProcessFlowLogic created — test file now passes (T031 delivered in same session)
2. [C-02] ✅ Null guards added (`?.` operator + invariant throw in buildScene)
3. [H-01] ✅ `if (max === 0) return 0` guard in `getPercentage()`
4. [H-02] ✅ ScoreTracker tests refactored with `beforeEach`/`afterEach` listener lifecycle
5. [H-03] ✅ `PhysicsDemoSceneDef` and `ConceptAnimatorSceneDef` stubs added to types.ts + exported from index.ts
