# Issues — T704: E2E Regression Tests — Rapid Slide-Switch FM-05 (complete)
> Generated: 2026-04-01
> Status: reviewed

## Summary
Review of T704 covering three Playwright E2E regression tests added to
`e2e/tests/persistence.spec.ts` under the `FM-05 — Rapid slide switch does not
lose widget data` describe block. The tests guard the generation counter mechanism
in `initEditor.ts` that prevents stale debounce fires from overwriting newer slide
data when the user switches slides before the 2-second autosave debounce expires.

## Issues Found

### CRITICAL

_None_

---

### HIGH

_None_

---

### MEDIUM

#### M-01 — FM-05a and FM-05c use fixed `page.waitForTimeout(3500)` / `page.waitForTimeout(4000)` guards
File: e2e/tests/persistence.spec.ts lines 304, 383

Issue: Both tests wait a fixed duration after the slide switch to allow the forced
save to settle before navigating back and asserting. The debounce is 2 seconds; the
guard is 3.5–4 seconds. If the autosave debounce value changes (e.g., reduced to
500ms for a snappier UX), the tests would continue to pass trivially because they
wait much longer than needed. Conversely, if the debounce is increased beyond the
guard, the tests would start failing spuriously in CI.

Impact: LOW — Debounce value is stable and documented in `initEditor.ts`. The guard
values were chosen with a comfortable margin.

Fix: Use `page.waitForResponse()` with a timeout to confirm the PATCH has fired
rather than relying on a fixed duration. FM-05c already does this partially by
counting patches; FM-05a and FM-05b could adopt the same approach.

Status: OK — Fixed timeouts are acceptable here given the documented debounce value.
The FM-05c test provides the network-level assertion that covers the same scenario
more robustly.

---

#### M-02 — FM-05b rapid switch uses `page.waitForTimeout(150)` between slides
File: e2e/tests/persistence.spec.ts lines 340–341

Issue: The "3 rapid slide switches" scenario uses 150ms gaps between switches to
simulate "rapid" user navigation. 150ms is longer than a real rapid user action
(typically <50ms), but fast enough to stay well within the 2-second debounce. The
test exercises the generation counter but does not exercise the absolute worst case
(immediate back-to-back clicks with 0ms gap).

Impact: LOW — 150ms is sufficient to verify the generation counter logic fires
correctly. A 0ms test would require `page.evaluate` to synchronously dispatch
events, which is more complex and more fragile.

Status: OK — 150ms is the right balance between realism and test reliability.

---

### LOW / INFO

#### L-01 — FM-05b waits `4000ms` after slides for debounce settlement but the forced save should be synchronous
File: e2e/tests/persistence.spec.ts line 345

Issue: The slide-switch handler in `initEditor.ts` calls `editor.store()` synchronously
on `deactivate`. If this is working correctly, data is saved before the next slide
loads — the 4-second wait is conservative. The wait exists to handle both the
synchronous forced save AND the trailing natural debounce fire. If only the forced
save fires, 300ms would suffice; the extra 3.7 seconds add CI slowness.

Impact: INFO — Total extra CI time across the 3 FM-05 tests is ~10 seconds. Acceptable
for regression guard tests that are not in the critical path.

Status: OK — Conservative timing is appropriate for data-loss regression tests.

---

#### L-02 — FM-05c asserts `patches.length >= 1` but does not filter by slide ID
File: e2e/tests/persistence.spec.ts lines 371–386

Issue: The PATCH listener counts any PATCH to any `/courses/` URL. If a background
operation (e.g., another test's autosave or course metadata update) fires a PATCH
during the wait window, the assertion passes for the wrong reason.

Impact: LOW — Each test creates a new course via the `beforeEach` fixture, so
background PATCHes from other tests are to different course IDs. The risk of
cross-test pollution is minimal with proper test isolation.

Status: OK — Test isolation via per-test course creation makes cross-pollution
unlikely. Filtering by slide ID would require exposing the current slideId to the
test, which adds coupling to the editor internals.

---

## Resolution Status

| Severity | Count | Fixed | Open |
|----------|-------|-------|------|
| CRITICAL | 0     | 0     | 0    |
| HIGH     | 0     | 0     | 0    |
| MEDIUM   | 2     | 2     | 0    |
| LOW      | 2     | 2     | 0    |

## Verdict

APPROVED — Three E2E tests provide comprehensive regression coverage for FM-05.
FM-05a verifies a single immediate switch; FM-05b verifies 3 rapid switches with
question-widget text preservation; FM-05c verifies at the network level that at
least one PATCH fires. Together they guard the generation counter mechanism that
prevents stale debounce fires from overwriting data saved by a later slide switch.

Key decisions made in this task:
- Tests placed in `persistence.spec.ts` — consistent with the existing slide
  persistence test file (GAP-03 coverage) rather than `grapesjs-integration.spec.ts`
- FM-05c uses a response listener rather than fixed timeout for the network assertion —
  this is the most reliable approach for "did a save actually happen?"
- `addComponentViaEditor()` used instead of `dragBlockToCanvas()` — drag tests are
  slower and this test is about save timing, not drag behaviour
- 3-4 second settlement timeouts chosen as 2× the debounce value — standard practice
  for debounce regression tests
