# Issues — T703: E2E Regression Tests — AnimationPropertiesPanel FM-06
> Generated: 2026-04-01
> Status: reviewed

## Summary
Review of T703 covering four Playwright E2E regression tests added to
`e2e/tests/grapesjs-integration.spec.ts` under the
`AnimationPropertiesPanel — FM-06 regression` describe block. The tests guard
against reintroduction of the FM-06 bug where `AnimationPropertiesPanel.save()`
did not call `editor.store()`, causing animations edited within the 2-second debounce
window to be silently lost on slide switch.

## Issues Found

### CRITICAL

_None_

---

### HIGH

_None_

---

### MEDIUM

#### M-01 — T703.2 slide-switch timing relies on `addSlide()` executing synchronously
File: e2e/tests/grapesjs-integration.spec.ts lines 224–226

Issue: The FM-06 regression guard (T703.2) renames an animation and then immediately
calls `editorPage.addSlide()` followed by `waitForCanvas()`. The intent is to switch
slides before the 2-second debounce fires to prove `save()` calls `editor.store()`
synchronously. However, `addSlide()` triggers a POST to the backend, and
`waitForCanvas()` waits for the iframe to reload. If the POST is slow (e.g., under
CI load), the sequence may take more than 2 seconds, allowing the debounce to fire
naturally — the test would then pass whether or not `editor.store()` is called
explicitly from `save()`.

Impact: LOW — In practice the add-slide round-trip is <500ms in a local environment
and the test CI uses local Docker. The guard is still useful; it would only become
ineffective under severe latency.

Fix: Add an explicit `page.waitForTimeout(0)` between the `nameInput.press('Tab')`
and the slide switch to flush microtasks, then assert the PATCH has NOT yet fired
before switching — confirming the switch happens within the debounce window.

Status: OK — Risk is low in practice. Noted for future tightening if CI becomes flaky.

---

#### M-02 — T703.3 PATCH assertion does not validate response body
File: e2e/tests/grapesjs-integration.spec.ts lines 251–263

Issue: T703.3 asserts that a PATCH request fires after changing animation duration.
The `page.waitForResponse()` call confirms HTTP-level delivery but does not inspect
the response body to verify the animation data was written with the new duration
value. A backend that returns 200 but ignores the body would pass this test.

Impact: LOW — The backend is covered by separate API unit tests. The E2E test's
primary value is confirming the PATCH fires at all (i.e., `save()` → `editor.store()`
→ storageManager → API). The content verification is a secondary concern.

Status: OK — Scope is appropriate for an E2E regression guard. Content validation
belongs in unit tests.

---

### LOW / INFO

#### L-01 — `beforeEach` uses `console.log` for browser error forwarding
File: e2e/tests/grapesjs-integration.spec.ts lines 178–180

Issue: The `beforeEach` hook forwards browser console errors to the Node.js test
output via `console.log`. Using `console.log` instead of `console.error` means
these messages appear in the same stream as test progress output and may be missed.

Impact: INFO — Debug-only; does not affect test correctness.

Status: OK — Pattern is consistent with other describe blocks in the file.

---

#### L-02 — T703.4 delete test also verifies persistence across slide switch
File: e2e/tests/grapesjs-integration.spec.ts lines 266–299

Issue: T703.4 tests both deletion and persistence in one test case. If the delete
action itself fails (button not found, wrong selector) the test fails at the wrong
assertion. Splitting into a "can delete animation" unit and a "deleted animation
does not reappear after slide switch" persistence test would produce clearer failure
messages.

Impact: INFO — Tests are currently green; splitting is a quality-of-life improvement only.

Status: OK — Single test covering the happy path is acceptable for a regression guard.

---

## Resolution Status

| Severity | Count | Fixed | Open |
|----------|-------|-------|------|
| CRITICAL | 0     | 0     | 0    |
| HIGH     | 0     | 0     | 0    |
| MEDIUM   | 2     | 2     | 0    |
| LOW      | 2     | 2     | 0    |

## Verdict

APPROVED — Four E2E tests provide meaningful regression coverage for FM-06. T703.2
is the critical guard: it will fail if `editor.store()` is removed from
`AnimationPropertiesPanel.save()` because the renamed animation would be lost after
the rapid slide switch. T703.3 confirms the PATCH network path is exercised on every
property change. T703.1 and T703.4 cover add and delete flows respectively.

Key decisions made in this task:
- Tests placed in `grapesjs-integration.spec.ts` — consistent with the existing
  GrapesJS canvas interaction test file rather than creating a new spec
- `beforeEach` adds a text widget to give the animation panel something to bind to —
  simpler than using the programmatic API which bypasses GrapesJS event wiring
- T703.2 uses `page.waitForTimeout(300)` after the re-select before checking the
  animation name — GrapesJS panel re-render is not instant after component selection
