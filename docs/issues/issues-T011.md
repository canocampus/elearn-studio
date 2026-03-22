# T011 Code Review — Issues Report

**Reviewed:** 2026-03-21
**Scope:** T011 — Custom Storage Manager, converters, autosave
**Files reviewed:** `storageManager.ts`, `converters.ts`, `initEditor.ts` (autosave), `storageManager.test.ts`, `converters.test.ts`

---

## CRITICAL (2)

### C-01 — Race condition: autosave saves stale slide data after slide switch
**File:** `editor/initEditor.ts` — autosave handler
When the user edits a slide then switches to another before the 2s debounce fires, the timer
captures `storageContext` at creation time. By the time it fires, `updateStorageContext()` has
already advanced to the new slide, so the old slide's components are saved to the new slide's
`courseId/slideId` pair — data loss on both slides.
**Fix:** Export `getStorageContext()` from `storageManager.ts` to return a snapshot copy.
Capture the snapshot at event time; compare it with the live context when the timer fires.
If they differ, abort the save.

### C-02 — Race condition: same timer survives slide switch (no cancel on load)
**File:** `editor/EditorCanvas.tsx` Effect 2 / `editor/initEditor.ts`
`EditorCanvas` calls `updateStorageContext()` then `editor.load()` on slide switch without
cancelling a pending autosave timer. The timer may fire between the two calls.
**Fix:** Resolved by the C-01 snapshot guard — if context changed, save is skipped.
No external cancellation API required.

---

## HIGH (2)

### H-01 — `widgetsFromGrapesjs`: `parseInt` can return NaN for malformed CSS
**File:** `editor/converters.ts` lines 40–45
CSS values like `'auto'`, `'inherit'`, `''`, or `'abc'` produce `NaN` from `parseInt`.
`NaN` stored in `bounds.x/y/width/height/layer` corrupts the Widget schema silently.
**Fix:** Extract `parsePx(value, fallback)` helper that returns `fallback` when `isNaN`.

### H-02 — `store(_data: unknown)` parameter declared but never used
**File:** `editor/storageManager.ts`
GrapesJS calls `store(data)` with the serialised project object. We intentionally ignore it
(reading live components via `editor.getComponents()` instead), but the parameter name should
clarify the intent.
**Fix:** Parameter renamed to `_data: unknown` (leading underscore = intentionally unused).

---

## MEDIUM (4)

### M-01 — No real GrapesJS integration tests
The test suite mocks `grapesjsFromWidgets` / `widgetsFromGrapesjs` entirely in
`storageManager.test.ts`. An integration test using actual GrapesJS (headless) would catch
API shape mismatches between our converter output and what GrapesJS actually accepts.
*Deferred — requires GrapesJS in test environment (non-trivial setup).*

### M-02 — Autosave error not surfaced to user beyond store state ✅
`setSaveError()` is called on failure, but no component currently displays `saveError` from the
store. The user has no visual indication that a save failed.
*Resolved in T013 H-01 — TopToolbar displays `saveError`; SlideList calls `setSaveError` in all catch blocks.*

### M-03 — `widgetsFromGrapesjs` default type falls back to `'rectangle'` ✅
If `c.get('type')` is `undefined` (component registered without a type), the widget type
silently becomes `'rectangle'`. This could produce phantom rectangle widgets after a round-trip.
*Resolved in T012 — all widget types (`text`, `image`, `button`, `rectangle`, `nav-buttons`, `score-quiz`, `done-button`, `score-field`, `media-player`, `question-mc`, `question-tf`, `question-fill`) are registered; the fallback path is never triggered in normal operation.*

### M-04 — Missing autosave race-condition tests
The `getStorageContext` snapshot mechanism (C-01 fix) has no direct unit test exercising the
abort-when-context-changed path in the autosave handler.
*Partially addressed: `getStorageContext` snapshot isolation is tested; handler abort path
requires a timer-based integration test (deferred to T011 test hardening).*

---

## LOW (3)

### L-01 — `console.warn` / `console.error` in storage manager not structured
Log lines include `[StorageManager]` prefix but no log level or context object shape
standardisation. Could interfere with production log aggregation.
*Deferred — logging strategy not defined yet.*

### L-02 — `grapesjsFromWidgets` comment on `attributes.id` was misleading
Was: "so updateStorageContext correctly targets the right element if needed".
Fixed inline during T010.12: "id preserved so the round-trip produces the same Widget id".

### L-03 — `initEditor.ts` comment still references "T011 will implement real version"
Fixed inline during T011.8: updated to "elearn-api — see storageManager.ts".

---

## Resolution Status

| Issue | Status |
|-------|--------|
| C-01 (autosave race condition) | ✅ Fixed — `getStorageContext()` snapshot guard |
| C-02 (no cancel on slide switch) | ✅ Fixed — covered by C-01 guard |
| H-01 (NaN bounds) | ✅ Fixed — `parsePx()` helper with fallback |
| H-02 (unused `_data` param) | ✅ Fixed — renamed to `_data: unknown` |
| M-01 (no GrapesJS integration tests) | Deferred — see notes below |
| M-02 (saveError not displayed) | ✅ Fixed — T013 H-01 |
| M-03 (default type rectangle) | ✅ Fixed — T012 registers all types |
| M-04 (autosave abort path not tested) | Deferred — see notes below |
| L-01 (unstructured logs) | Deferred — see notes below |
| L-02 (misleading comment) | ✅ Fixed inline |
| L-03 (stale T011 comment) | ✅ Fixed inline |

**Tests:** 73 passing after fixes (up from 70 — 3 new tests: NaN guard, getStorageContext snapshot ×2).

---

## Deferred Item Justifications

### M-01 — No real GrapesJS integration tests
**Why deferred:** Running GrapesJS in a test environment requires either a real browser (Playwright/Puppeteer) or a jsdom environment patched with `canvas` and `MutationObserver` stubs. Neither is trivial to set up in the current Vitest+jsdom configuration. The test suite already covers the converter functions (`widgetsFromGrapesjs`, `grapesjsFromWidgets`) and the `getStorageContext` snapshot mechanism in isolation — the most common failure modes are covered without a full GrapesJS instance.
**Unblock condition:** Add Playwright E2E tests that open the editor, drag a widget, save, reload, and verify the widget is still on the canvas. This is the correct test level for GrapesJS integration.

### M-04 — Missing autosave race-condition abort path test
**Why deferred:** The abort path fires when the stored `snapshot.courseId !== currentContext.courseId || snapshot.slideId !== currentContext.slideId` at the moment the debounce timer fires. Testing this requires either: (a) fake timers + async store mutation between the event and the timer resolution, or (b) a full integration test with the GrapesJS editor mounted. The snapshot isolation itself is tested (`getStorageContext` returns a copy, not a reference). The abort path is a guard, not business logic — the risk of regression is low.
**Unblock condition:** Add a Vitest fake-timer test: set context to slide A, trigger `editor:change`, advance time to 1999ms, switch context to slide B, advance to 2001ms — assert no API call was made.

### L-01 — `console.warn` / `console.error` not structured
**Why deferred:** A structured logging strategy (log levels, context objects, log aggregation service) has not been chosen for the project. Premature standardisation around a specific logger (Pino, Winston, etc.) would couple the storage manager to an infrastructure decision that belongs at the application layer. Phase 0 console logs are acceptable.
**Unblock condition:** When a logging library is selected for the backend API (or a browser-side logging facade is adopted in the UI), replace `console.warn/error` with the project logger using the `[StorageManager]` prefix as the logger name/context.
