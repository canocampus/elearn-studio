# T640 — Cache update fix: Store success path updates instead of invalidates

**Investigation:** T640.1–T640.4 (cache update logic + persistence flow docs)
**Code review:** T640.7 (RESOLVED — all issues fixed in T640.11)
**Date:** 2026-04-11

---

## Summary

T640.1 fixes a performance regression in storageManager.ts where every slide save was followed
by an unnecessary GET /courses/:id on the next slide load. Previously, store() success path
did courseCache = null, forcing a re-fetch. T640.1 changes the success path to update the
cached slide widgets in-place via immutable spread, preserving the cache for reuse.

T640.2 adds explicit inline comments to initEditor.ts on the autoload:false and autosave:false
settings, documenting the double-load race and undo-flood root causes respectively.

T640.3 adds regression tests covering the multi-slide edit sequence and cache freshness.

T640.4/T640.6 introduces comprehensive persistence flow documentation.

---

## Issues Found

### HIGH

| ID | File | Description | Status |
|---|---|---|---|
| H-01 | storageManager.ts lines 172-176 | Race condition risk: concurrent load during cache assignment could observe inconsistent state. JS single-threaded so safe, but assumption undocumented. | RESOLVED (T640.11) |
| H-02 | storageManager.ts lines 172-176 | No null-safety on courseCache.doc.slides before map. If schema validation fails and slides is undefined, throws TypeError. | RESOLVED (T640.11) |

### MEDIUM

| ID | File | Description | Status |
|---|---|---|---|
| M-01 | initEditor.ts lines 62-66 | Comment on autoload race lacks detail: autoload fires on init before context set, races EditorCanvas.load, blank canvas results. Explain mechanism. | RESOLVED (T640.11) |
| M-02 | storageManager.ts line 176 | No defensive check on courseCache.doc before spread. If doc is null (low probability), spread fails. Optional chaining recommended. | RESOLVED (T640.11) |
| M-03 | storageManager.test.ts | Manual invalidateCourseCache in test bodies, not beforeEach fixture. Test isolation fragile if test throws partway. | RESOLVED (T640.11) |

### LOW

| ID | File | Description | Status |
|---|---|---|---|
| L-01 | storageManager.ts lines 26-28 | Comment "failed store clears cache" is ambiguous: validation failure vs network error. Clarify "failed PATCH request". | RESOLVED (T640.11) |
| L-02 | initEditor.ts line 72 | Comment "every undo/redo step" imprecise. autosave with stepsBeforeSave:1 fires every command including keystrokes. | RESOLVED (T640.11) |

### INFORMATIONAL

| ID | File | Description |
|---|---|---|
| I-01 | storageManager.test.ts | T640.1 regression test (lines 329-356) correctly verifies cache update and getCourse called once. Good coverage. |
| I-02 | storageManager.test.ts | T640.3 regression test (lines 385-432) correctly verifies multi-slide sequence and cache freshness. Excellent coverage. |
| I-03 | 08-persistence-flow.md | Documentation comprehensive and accurate after T640.6 corrections. Sequence diagram helpful. |

---

## High-Issue Detail

### H-01 — Race condition risk in cache update

Lines 172-176 in storageManager.ts show a potential race condition. When store() updates
the cache, if a concurrent load() reads courseCache during the assignment, it could observe
an inconsistent intermediate state. However, JavaScript is single-threaded, so operations at
the event-loop level are atomic.

**Why document it:** If this code is ported to a multi-threaded runtime (Node Worker Threads),
it becomes unsafe. The structure suggests concurrency was not considered.

**Recommendation:** Add comment documenting the single-threaded assumption, or refactor to use
a closure-local reference to prevent re-reading courseCache mid-operation.

### H-02 — No null-safety on slides array

Line 173 assumes courseCache.doc.slides is an array without checking:

```typescript
const updatedSlides = courseCache.doc.slides.map(...)
```

If slides is undefined (schema mismatch, rare), this throws TypeError and store() caller crashes.

**Probability:** Low (Mongoose validates upstream)
**Impact:** High (PATCH succeeds but caller gets exception; UI state inconsistent)

**Fix:**

```typescript
if (!Array.isArray(courseCache.doc.slides)) {
  console.error('[StorageManager] Corrupt cache: slides not array, skipping cache update')
  return
}
const updatedSlides = courseCache.doc.slides.map(...)
```

---

## Medium-Issue Detail

### M-01 — Insufficient detail on double-load race

The comment on lines 62-66 mentions "clearing components added between the two calls" but does
not explain the mechanism clearly. A reviewer unfamiliar with the codebase cannot understand
what causes the blank canvas symptom.

**Better explanation should cover:**

1. grapesjs.init() with autoload:true fires load() BEFORE context is set
2. storageManager.load() returns blank canvas (courseId/slideId empty)
3. GrapesJS renders blank slate via loadData(blank)
4. Meanwhile EditorCanvas.Effect2 calls updateStorageContext() + editor.load()
5. storageManager.load() now returns correct widgets
6. loadData(widgets) executes, but loadData calls are not sequenced
7. loadData(blank) may execute after loadData(widgets)
8. Result: blank canvas overwrites loaded widgets

### M-02 — No spread guard on courseCache.doc

Line 176 spreads courseCache.doc without checking if it exists:

```typescript
courseCache = { courseId, doc: { ...courseCache.doc, slides: updatedSlides } }
```

If courseCache.doc is null, the spread fails.

**Recommendation:** Guard before spread

```typescript
if (courseCache?.doc) {
  courseCache = { courseId, doc: { ...courseCache.doc, slides: updatedSlides } }
}
```

### M-03 — Test isolation issue with invalidateCourseCache

Tests call invalidateCourseCache() manually in test bodies instead of using a beforeEach fixture.
If a test throws mid-execution after clearing the cache, the next test inherits the cleared state.

**Impact:** Low (all guards check courseId match), but fragile.

**Fix:** Use beforeEach fixture

```typescript
beforeEach(() => {
  invalidateCourseCache()
})
```

---

## Low-Issue Detail

### L-01 — Comment ambiguity on "failed store"

Lines 26-28 say: "On a failed store(), the cache is cleared so stale data is never served."

This is ambiguous: does "failed" mean validation failure (doesn't clear) or network error (does clear)?

**Better:** "If the PATCH /courses/:id/slides/:slideId request fails (network error or 4xx/5xx),
the cache is cleared to prevent serving stale data on next load."

### L-02 — Comment imprecision on "undo/redo step"

Line 72 says: "...fire a PATCH on every single undo/redo step."

This suggests GrapesJS autosave fires on explicit undo/redo actions. In reality, GrapesJS
CommandManager tracks all commands. stepsBeforeSave:1 means fire after 1 command, so every
keystroke counts as a command.

**Better:** "...fire a PATCH on every command executed, including every keystroke in text
widgets and every component add/remove. This creates unbounded API traffic."

---

## Testing Coverage

All 686 authoring-ui tests pass:

- T640.1 regression (lines 329-356): getCourse called once, cache updated after store()
- T640.1 fresh widgets (lines 358-383): cache holds saved widgets after store
- T640.3 multi-slide (lines 385-432): getCourse called exactly once across load/store/switch sequence

No test failures to report.

---

## Verdict

**APPROVED** — All 7 reviewer issues resolved in T640.11. T640 is closed.

| Item | Resolution |
|---|---|
| H-01 | Added inline comment documenting JS single-threaded guarantee and Worker Threads caveat |
| H-02 | Added `Array.isArray(courseCache.doc.slides)` guard before `.map()`; sets `courseCache = null` on corrupt data |
| M-01 | Expanded `autoload: false` comment with full 6-step race sequence and blank-canvas symptom |
| M-02 | Added clarifying comment: `courseCache.doc` is non-null by outer if-guard and TypeScript type |
| M-03 | Moved `invalidateCourseCache()` to outer `beforeEach` fixture in `storageManager.test.ts` |
| L-01 | Applied in previous session — comment now says "PATCH request fails (network error or 4xx/5xx)" |
| L-02 | Updated `autosave: false` comment: "every command including every keystroke in text widgets" |
