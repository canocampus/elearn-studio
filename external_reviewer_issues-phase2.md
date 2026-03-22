# External Reviewer Issues — Phase 2

**Reviewer:** Gemini CLI (Interactive Assistant)
**Date:** 2026-03-22
**Focus:** Phase 2 (Actions, Advanced Questions, Simulations, SCORM/AICC, Animations)

---

## 🚀 Suggested Improvements

### [IMP-01] Recursive Loop Detection in Shared Sequences ✅ WILL IMPLEMENT — T201 (Phase 2.5)
**Component:** `authoring-ui/src/utils/validateSequence.ts`
**Issue:** Current validation checks for unknown shared sequences but does NOT detect circular references (e.g., Sequence A calls Sequence B, which calls Sequence A).
**Suggestion:** Add a cycle detection pass in `validateAllSequences` using a Depth-First Search (DFS) over the `call-sequence` dependencies to warn authors of potential infinite recursion before they publish.

### [IMP-02] Expression Evaluator Complexity ⏭️ DEFERRED — Phase 3
**Component:** `runtime-player/src/actions/expression.ts`
**Issue:** The current regex-based evaluator is robust but limited to single-operator comparisons (e.g., `$a == 1`). It does not support nested logic like `($score > 70 && $attempts < 3)`.
**Suggestion:** Consider migrating from `COMPARISON_RE` to a lightweight expression parser (e.g., `jsep` or a small recursive descent parser). This would allow more complex branching without introducing the security risks of `eval()`.
**Decision:** Architectural scope — migrating the expression format affects stored authored content, validation, and the actions editor UI. Not a bug fix; deferred until the full expression language is revisited in Phase 3.

### [IMP-03] Simulation Interaction Types ✅ WILL IMPLEMENT — T202 (Phase 2.5)
**Component:** `simulation-engine` / `authoring-ui`
**Issue:** The current recorder/editor is heavily focused on `click` events.
**Suggestion:** Extend the `SimStep` model and `CAPTURE_SCRIPT` to explicitly handle `hover` (mouseEnter/Leave) and `typing` (input) events as primary interaction requirements. For software walkthroughs, a "Type into field" step is often as critical as a "Click button" step.

### [IMP-04] Z-Index and Visibility Synchronization ✅ WILL IMPLEMENT — T203 (Phase 2.5)
**Component:** `runtime-player/src/index.ts`
**Issue:** `Show` and `Hide` actions manipulate CSS `display` or `visibility`.
**Suggestion:** Ensure that showing a hidden widget correctly restores its original Z-index relative to other widgets on the slide. If multiple widgets are shown/hidden dynamically, they might overlap in ways the author didn't preview. A `bring-to-front` action could be a valuable addition.

### [IMP-05] SCORM 1.2 Suspend Data Limit Monitoring ✅ WILL IMPLEMENT — T204 (Phase 2.5)
**Component:** `runtime-player/src/suspend.ts`
**Issue:** SCORM 1.2 has a 4096-character limit for `suspend_data`. While LZString is used, very large courses with hundreds of questions might still hit this limit.
**Suggestion:** Add a "Usage Indicator" in the Authoring UI's "Publish" panel that estimates the percentage of the SCORM 1.2 `suspend_data` limit used based on the current course structure.

---

## 🧪 Suggested Test Cases

### [TEST-01] Stress Test: Extreme Question Count (SCORM) ✅ WILL IMPLEMENT — T205.1 (Phase 2.5)
**Scenario:** Create a course with 100+ Multiple Choice questions, each with its own state.
**Verification:** Ensure `serializeSuspend` still produces a payload < 4096 characters, or fails gracefully (logs warning) instead of corrupting the LMS communication.

### [TEST-02] Concurrency Stress Test (Simulation Engine) ⏭️ DEFERRED — Phase 3
**Scenario:** Trigger 5 simultaneous `POST /recorder/start` requests.
**Verification:** Ensure the `simulation-engine` handles multiple Chromium instances without port conflicts or session ID collisions, and that it properly honors `config.recorder.maxConcurrentSessions` (if implemented).
**Decision:** Requires live infrastructure and a `maxConcurrentSessions` config that does not yet exist. Deferred to Phase 3 integration testing.

### [TEST-03] Validation: Deeply Nested Actions ✅ WILL IMPLEMENT — T205.2 (Phase 2.5)
**Scenario:** Create an `If` condition nested 5 levels deep, with a `Loop` inside the 5th level.
**Verification:** Ensure `validateAllSequences` correctly reports warnings (like an unknown widget ID) even at the deepest nesting level.

### [TEST-04] Animation Interruptions ✅ WILL IMPLEMENT — T205.3 (Phase 2.5)
**Scenario:** Trigger a `play-animation` action on Widget A, then trigger a second `play-animation` on the *same* Widget A while the first is still running.
**Verification:** Verify how the runtime player handles the second WAAPI call. Does it cancel the first? Does it layer them? (Ideally, it should smoothly restart or finish the first one).

### [TEST-05] AICC Cross-Origin POST Mock ✅ WILL IMPLEMENT — T205.4 (Phase 2.5)
**Scenario:** Configure the AICC bridge with an `AICC_URL` that has a different origin.
**Verification:** Confirm that the `hacp-bridge.ts` same-origin check (H-01) blocks the request and logs the security warning, preventing data exfiltration.

---

## 📎 Documentation
This file serves as a reference for Phase 2.5 and Phase 3 development to ensure the system evolves with high robustness and security standards.
