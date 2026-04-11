# T641 — Preview popup: runtime player wired + T611.10 pass

**Task:** T641.1 — Implement Preview button popup wired to current course/slide state  
**Outcome:** T611.10 passes. 30/30 question-widget E2E tests green. SKIP-01 resolved.  
**Version:** v0.5.46  
**Date:** 2026-04-11

---

## Root Cause Analysis

### Bug 1 — `closeCourseSettings()` clicked Cancel, not Save

**File:** `e2e/pages/EditorPage.ts` (original `closeCourseSettings()`)

The method matched dialog buttons using regex `/close|cancel/i`. The Course Settings dialog
has a "Cancel" button — the regex matched it and clicked it, discarding the `navigationMode`
change. The backend never received a PATCH, so `course.settings.navigationMode` stayed
`'free'` in the Zustand store.

**Effect:** When `handlePreview()` built the preview course JSON and sent it via postMessage,
`settings.navigationMode` was `'free'`. The runtime player's `slideIsComplete()` returns
`true` immediately when `navigationMode !== 'linear-strict'`, so the Next button was never
disabled regardless of whether the MC question was answered.

**Fix:** Added `saveCourseSettings()` to `EditorPage.ts` that explicitly clicks
`data-testid="course-settings-save"` (the Save button) and waits for the dialog to hide.

```typescript
/** Save and close the Course Settings dialog (clicks the Save button). */
async saveCourseSettings() {
  const dialog = this.page.getByRole('dialog').filter({ hasText: 'Course Settings' })
  await this.page.getByTestId('course-settings-save').click()
  await dialog.waitFor({ state: 'hidden', timeout: 5_000 })
}
```

T611.10 updated to:
1. Call `saveCourseSettings()` after `setNavigationMode('linear-strict')`
2. Await the PATCH response via `waitForResponse()` before opening the preview

### Bug 2 — `MCOption[]` objects treated as `string[]` in runtime player

**File:** `packages/runtime-player/src/index.ts`

`renderMCQuestion()` and `evalMC()` assumed `options` was `string[]` and called `.replace()`
directly on each option. The authoring-ui stores MC options as `MCOption[]` objects:
`{ id: string; text: string; isCorrect: boolean }`. This caused `s.replace is not a function`
at runtime.

**Fix:** Both functions now extract `.text` from each option and check `.isCorrect`:

```typescript
// renderMCQuestion — before
options.map(opt => `<div>...</div>`)

// renderMCQuestion — after
options.map(opt => {
  const text = typeof opt === 'string' ? opt : (opt as MCOption).text
  return `<div>...${text}...</div>`
})

// evalMC — after
const correctIndex = options.findIndex(o =>
  typeof o === 'string' ? false : (o as MCOption).isCorrect
)
```

---

## Test Result

```
question-widget.spec.ts — 30 tests, 0 failed (2.0 min)
  ✓ T611.10 Preview: Next disabled until mandatory MC answered (linear-strict) [30.4s]
```

---

## Files Changed

| File | Change |
|---|---|
| `e2e/pages/EditorPage.ts` | Added `saveCourseSettings()` method |
| `e2e/tests/question-widget.spec.ts` | T611.10: uses `saveCourseSettings()` + `waitForResponse(PATCH)`, removed all DIAGNOSTIC blocks |
| `packages/runtime-player/src/index.ts` | `renderMCQuestion` / `evalMC` handle `MCOption[]` |

---

## Verdict: CLOSED ✅

T641.1 complete. T611.10 passes. SKIP-01 resolved. Ready for T642.
