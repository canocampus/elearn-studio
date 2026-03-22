# Code Review: T022 Implementation Additions to runtime-player

Date: 2026-03-22
Reviewer: Claude Code
Scope: T022 additions for advanced question types

## CRITICAL Issues

### [CRITICAL-001] Undeclared Variable Reference (Line 513)

File: src/index.ts:513
Issue: Variable `container` used without declaration; should be `state.container`

Impact: Runtime error. ReferenceError when user presses arrow keys during keyboard navigation. Hard blocker for player functionality.

Fix: Change line 513 from `container.addEventListener` to `state.container.addEventListener`

**Status**: ✅ FIXED (2026-03-22) — Changed to `state.container.addEventListener`

---

## HIGH Issues

### [HIGH-001] XSS Vulnerability via Unescaped HTML (Line 163)

File: src/index.ts:163
Issue: Widget HTML content rendered without sanitization

Attack Vector: w.properties.html can contain event handlers like `<img src=x onerror="attack()">`

Fix: Use DOMPurify.sanitize() or document that HTML is always from trusted backend

**Status**: ✅ FIXED (2026-03-22) — All text content routed through `escHtml()` before insertion

---

### [HIGH-002] Hotspot Canvas Scaling Bug (Lines 266-270)

File: src/questions/handlers.ts
Issue: Canvas scaling uses img.offsetWidth which may be 0 if image fails to load

Problem: scaleX = 0 / canvas.offsetWidth causes all hotspot clicks to map to (0,0)

Fix: Add guards: if (canvas.width === 0) return before processing click

**Status**: ✅ FIXED (2026-03-22) — Canvas synced to natural image dimensions; devicePixelRatio scaling applied

---

### [HIGH-003] Dead Code in Drag Evaluation (Line 50)

File: src/questions/handlers.ts:50
Issue: Unused `zone` variable wastes DOM query

Fix: Delete line 50

**Status**: ✅ FIXED (2026-03-22) — Dead code removed

---

### [HIGH-004] Missing Unit Test Coverage

Files: All handler/renderer pairs
Issue: Zero unit tests for match, drag, drop, arrange, order-text, hotspot

Requirement: Per rules/testing.md, 80% test coverage minimum

Fix: Create src/__tests__/questions.test.ts with comprehensive tests

**Status**: ✅ FIXED (2026-03-22) — `src/__tests__/questions.test.ts` created with 30+ tests covering all 6 eval functions (all correct/partial/wrong/empty cases) and all 6 renderers (HTML structure, data attributes, XSS escaping)

---

## MEDIUM Issues

### [MEDIUM-001] Arrange Button Index Race Condition (Lines 105-112)
Issue: data-idx becomes stale after reordering
Fix: Remove unused data-idx, rely on DOM position queries

**Status**: ✅ FIXED (2026-03-22) — `data-idx` removed; DOM position used for ordering

### [MEDIUM-002] Partial Credit Scoring Undocumented (Line 470)
Issue: QuestionState.score stores 0.0-1.0 but contract not documented
Fix: Add JSDoc clarifying scoring range

**Status**: ✅ FIXED (2026-03-22) — `QuestionState.score` has JSDoc: `/** Partial credit score in range [0.0, 1.0]. Multiplied by weight for final scoring. */`

### [MEDIUM-003] Remediation Loop Prevention Missing (Line 383)
Issue: Student can loop indefinitely on remediation slide
Fix: Document intended behavior and add loop safeguards

**Status**: ✅ FIXED (2026-03-22) — `remediationVisited: boolean` added to `PlayerState`; guard prevents re-entry

### [MEDIUM-004] No Validation for Invalid Hotspot Coords (Line 187)
Issue: regionFromPoint assumes coords valid; malformed configs cause missed hits
Fix: Validate coordinate counts in evalHotspot

**Status**: ✅ FIXED (2026-03-22) — `regionFromPoint` in `handlers.ts` skips malformed regions: `rect` requires ≥4 coords, `circle` ≥3, `polygon` ≥6

---

## LOW Issues

### [LOW-001] Missing JSDoc (Lines 30-167)
Missing documentation for public renderer functions

**Status**: ✅ FIXED (2026-03-22) — JSDoc added to all 6 public renderer functions (`renderMatchItems`, `renderDragObjects`, `renderDropTarget`, `renderArrangeObjects`, `renderOrderText`, `renderHotspot`)

### [LOW-002] Naive Shuffle (Line 129)
Simple .reverse() is not random; use Fisher-Yates

**Status**: ✅ FIXED (2026-03-22) — Fisher-Yates implemented in `renderOrderText`

### [LOW-003] Inconsistent Feedback (Multiple)
Inline feedback strings have inconsistent formatting

**Status:** ✅ ACCEPTED — cosmetic only; no functional impact. Standardise as part of a future i18n/copy-editing pass.

---

## Summary

| Severity | Count | Fixed | Accepted |
|----------|-------|-------|----------|
| CRITICAL | 1     | 1 ✅  | 0        |
| HIGH     | 4     | 4 ✅  | 0        |
| MEDIUM   | 4     | 4 ✅  | 0        |
| LOW      | 3     | 2 ✅  | 1        |

## Post-review fix (2026-03-22)

| ID | Severity | Location | Issue | Status |
|----|----------|----------|-------|--------|
| T022-POST-01 | MEDIUM | `src/questions/handlers.ts:52,87` | **`NodeListOf<HTMLElement>` not iterable with `for...of`** (TS2488): `tsconfig.json` was missing `"DOM.Iterable"` in the `lib` array, so TypeScript did not recognise the `Symbol.iterator` protocol on `NodeListOf`. | **FIXED** — Added `"DOM.Iterable"` to `packages/runtime-player/tsconfig.json` `lib` array. |

## VERDICT: CLOSED (2026-03-22)

**Fixed:** CRITICAL-001, HIGH-001, HIGH-002, HIGH-003, HIGH-004, MEDIUM-001, MEDIUM-002, MEDIUM-003, MEDIUM-004, LOW-001, LOW-002, T022-POST-01

**Accepted:**
- LOW-003 — Inconsistent inline feedback strings (cosmetic; deferred to i18n pass)
