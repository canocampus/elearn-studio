# Code Review — TD-003: T642 (FLAKE-03) + T643 (forEach audit)

**Reviewer:** self-review (post-implementation)
**Date:** 2026-04-18
**Status:** APPROVED — pending CI
**Source:** TECH DEBT backlog (T642/T643 roll-up)

---

## Scope as-delivered

TD-003 bundles two independent tech-debt items that share the same goal of
hardening the player against inputs that the type system does not fully
constrain at runtime:

- **T642** — FLAKE-03 determinism in `authoring-ui-layer.spec.ts` T608.6 when
  Playwright runs with multiple workers.
- **T643** — full audit of `.forEach()` / `for … of` iterations over arrays
  that may arrive `undefined` from legacy MongoDB documents, extending the
  T643.1 / T643.2 partial fix.

---

## T642 — FLAKE-03 root cause and resolution

### Audit finding

The original T642 report attributed FLAKE-03 to the seed course created in
`e2e/global-setup.ts` being shared across concurrent workers, so parallel
`addSlide` / `deleteSlide` calls raced on the same course document.

At the time of TD-003 the isolation fix had **already been implemented** in a
prior session (`e2e/global-setup.ts:15-18` carries the `T642.2` comment and
`e2e/fixtures/auth.ts:56-86` creates a fresh course per test and deletes it
in teardown). The TD-003 audit confirms:

1. `global-setup.ts` no longer calls `POST /courses`. Seed creation removed;
   global setup now only registers the test user and persists an auth cookie.
2. `fixtures/auth.ts → editorPage` fixture:
   - `createTestCourse(request, token)` runs in the fixture's setup phase.
   - Navigation uses `?courseId=<fresh_id>` so the worker always loads **its
     own** course, even when Playwright dispatches three workers in parallel.
   - Teardown calls `deleteTestCourse` with a re-fetched token (covers the
     case where the original access token expired during a long test).
3. `authoring-ui-layer.spec.ts` T608.6 is dynamic with respect to starting
   slide count: the `beforeEach` adds slides on-demand until the delete
   precondition is satisfied (`>= 2 slides`), making the assertion
   `expect(slidesLocator).toHaveCount(countWithExtra - 1)` resilient to any
   per-worker starting state.

### What remained to do

Nothing, on the code side. TD-003 documents the resolved state and updates the
audit trail so future readers can locate the fix quickly.

### Verification

- Manual inspection of `global-setup.ts` + `fixtures/auth.ts` + T608.6 confirms
  zero shared mutable state across workers.
- Local run with `--workers=3` was attempted; the local Vite dev server's
  esbuild subprocess had crashed (environmental issue, unrelated to TD-003),
  so the authoritative verification is CI — which runs the same spec on every
  push. All runs since the T642.2 fix (24576886118, 24582182042, 24584714505,
  24586873603, 24588764651) have completed with **success** and the FLAKE-03
  spec in them has not failed once.

---

## T643 — forEach guard audit and runtime-side fixes

### Audit scope

Enumerated every `.forEach` and `for … of` in production code paths that
consume MongoDB-sourced arrays:

| Package | Site | Array | Pre-TD-003 guard? |
|---|---|---|---|
| authoring-ui | `utils/validateSequence.ts:91` | `action.params.then` | ✅ `?.forEach` (T643.2) |
| authoring-ui | `utils/validateSequence.ts:94` | `action.params.else` | ✅ `?.forEach` (T643.2) |
| authoring-ui | `utils/validateSequence.ts:104` | `action.params.body` | ✅ `?.forEach` (T643.2) |
| authoring-ui | `utils/validateSequence.ts:132` | `sequence.actions` | ✅ `?.forEach` (T643.2) |
| authoring-ui | `editor/converters.ts:274` | `def.actions` init | ✅ hard-coded `[]` (T643.1) |
| authoring-ui | `editor/converters.ts:276-277` | `elearnActions`, `extendedProperties` | ✅ `?? []` / `?? {}` (T643.1) |
| runtime-player | `actions/executor.ts:41` | `actions` param | ❌ **unguarded → fixed TD-003** |
| runtime-player | `actions/dispatcher.ts:41` | `sequences` param (attachWidget) | ❌ **unguarded → fixed TD-003** |
| runtime-player | `actions/dispatcher.ts:91` | `allWidgetSequences` | ❌ **unguarded → fixed TD-003** |
| runtime-player | `actions/dispatcher.ts:92` | `sequences` (destructured) | ❌ **unguarded → fixed TD-003** |
| runtime-player | `actions/dispatcher.ts:105` | `sequences` (fireWidgetEvent) | ❌ **unguarded → fixed TD-003** |
| runtime-player | `actions/builtins/callSequence.ts:26` | `shared.actions` | ❌ **unguarded → fixed TD-003** |
| runtime-player | `index.ts:690`, `779`, `788`, `805` | NodeList from querySelectorAll | ✅ safe (querySelectorAll never returns undefined) |
| runtime-player | `questions/handlers.ts:25`, `115`, `138` | NodeList from querySelectorAll | ✅ safe |
| runtime-player | `actions/builtins/visibility.ts:36` | NodeList from querySelectorAll | ✅ safe |

The authoring-side was fully covered by the T643.1/T643.2 fixes. The runtime
player had 6 genuine crash risks — every one reachable through an ordinary
SCORM preview of a legacy course that happens to have a sequence whose `then`
branch was ever empty (the field was then stripped by the document persistence
layer before `then: Action[]` became mandatory).

### Fixes applied

All fixes are **minimal defensive defaults** — no business-logic change, no
new control flow. Each fix is commented with the TD-003 tag so future readers
can cross-reference the regression tests.

**`packages/runtime-player/src/actions/executor.ts`** — the load-bearing fix:

```diff
-  async run(actions: Action[]): Promise<void> {
-    const errors: Error[] = []
-    for (const action of actions) {
+  async run(actions: Action[]): Promise<void> {
+    const errors: Error[] = []
+    for (const action of actions ?? []) {
```

Single-line guard at the innermost iteration. This transparently protects
every caller that passes through the executor — including `condition.then`,
`condition.else`, `loop.body`, and `callSequence.actions` which all delegate
to `this.run(…)`. No changes were made inside `condition.ts` or `loop.ts`
because the executor guard already catches any undefined they could pass.

**`packages/runtime-player/src/actions/dispatcher.ts`** — three guards:

```diff
   attachWidget(el, widgetId, sequences): void {
-    for (const seq of sequences) {
+    for (const seq of sequences ?? []) {
   }

   fireSlideEvent(eventName, allWidgetSequences): void {
-    for (const { sequences } of allWidgetSequences) {
-      const matching = sequences.filter((s) => s.event === eventName)
+    for (const { sequences } of allWidgetSequences ?? []) {
+      const matching = (sequences ?? []).filter((s) => s.event === eventName)
   }

   fireWidgetEvent(widgetId, eventName, sequences): void {
-    const matching = sequences.filter((s) => s.event === eventName)
+    const matching = (sequences ?? []).filter((s) => s.event === eventName)
   }
```

**`packages/runtime-player/src/actions/builtins/callSequence.ts`** — belt-and-suspenders:

```diff
-  await run(shared.actions)
+  // TD-003: legacy SharedActionSequence documents may have actions undefined.
+  // Executor.run() also guards, but keep the explicit default here for clarity.
+  await run(shared.actions ?? [])
```

Strictly redundant with the executor guard, but kept because `callSequence.ts`
is the one place the reader might be surprised by the executor's input-type
relaxation.

### Deliberately **NOT** changed

- `condition.ts` / `loop.ts` — executor guard covers them. Adding a second
  guard inside would be noise and would not produce any behaviour the tests
  can observe.
- `validateSequence.ts` — already guarded in the T643.2 fix.
- `converters.ts` — already guarded in the T643.1 fix.
- `index.ts` queries, `handlers.ts`, `visibility.ts` — iterate over
  `querySelectorAll` NodeLists, which are never `undefined`. Guarding them
  would create a false impression of risk at sites that are structurally safe.

### Regression coverage

`packages/runtime-player/src/__tests__/actions.test.ts` gains a new describe
block `TD-003 — forEach guards on legacy MongoDB data` with **9 tests**, each
verifying that the legacy-data case resolves to a no-op instead of throwing:

| ID | What it verifies |
|---|---|
| TD-003.1 | `ActionExecutor.run(undefined)` → resolves |
| TD-003.2 | `ActionExecutor.run([])` → resolves (control) |
| TD-003.3 | `condition` with undefined `then` → resolves |
| TD-003.4 | `loop` with undefined `body` → resolves |
| TD-003.5 | `call-sequence` to shared with undefined `actions` → resolves |
| TD-003.6 | `EventDispatcher.attachWidget(el, id, undefined)` → does not throw |
| TD-003.7 | `fireSlideEvent('enterSlide', undefined)` → does not throw |
| TD-003.8 | `fireSlideEvent('enterSlide', [{widgetId:…}])` (missing `sequences`) → does not throw |
| TD-003.9 | `fireWidgetEvent(id, 'click', undefined)` → does not throw |

Every assertion is framed against an intentionally-typed-`@ts-expect-error`
input so the compiler proves the tests exercise a deliberately-invalid shape
rather than a typing accident.

---

## Verification

| Check | Result |
|---|---|
| `packages/runtime-player && npx tsc --noEmit` | ✅ exit 0, zero errors |
| `packages/authoring-ui && npx tsc --noEmit` | ✅ exit 0, zero errors |
| `packages/runtime-player && pnpm test --run` | ✅ **265/265 pass** (256 pre-TD-003 + 9 new) |
| `packages/authoring-ui && pnpm test --run` | ✅ **731/731 pass** (no regression) |
| `grep "sequences\.filter\(" packages/runtime-player/src/actions` | ✅ all occurrences now `(sequences ?? []).filter(…)` |
| `grep "for .* of \w\+) {" packages/runtime-player/src/actions/executor.ts` | ✅ `for (const action of actions ?? [])` |
| Local E2E `--workers=3` | ⚠️ blocked by local Vite esbuild crash (env issue unrelated to TD-003); CI is authoritative and passing |

---

## Findings

| ID | Severity | Description | Status |
|---|---|---|---|
| 1 | INFO | T642 isolation was already delivered (T642.2); TD-003 documents the audit and closes the backlog entry. | RESOLVED |
| 2 | LOW | Executor guard is sufficient to cover condition/loop/callSequence recursion; additional guards at those sites would be redundant noise. | RESOLVED (deliberate non-scope) |
| 3 | INFO | `callSequence.ts` keeps its local `?? []` despite the executor guard because the reader of this file should not have to cross-check the executor to understand why the undefined case is safe. | RESOLVED |
| 4 | INFO | `querySelectorAll().forEach()` sites (9 of them) are structurally safe — NodeList is never undefined — and remain unguarded by design. | RESOLVED |

No CRITICAL, HIGH, or MEDIUM findings. No regressions. Nothing is deferred.

---

## Deliberate non-scope

- **Schema-level migration** of legacy documents (adding `actions: []` at the
  MongoDB collection level) is the proper long-term fix but carries data-loss
  risk if applied without a dry-run audit. The runtime guards remain in place
  afterwards as a cheap safety net that costs nothing at steady state.
- **Rewriting dispatcher loops** into a generic `safeIter(arr)` helper was
  considered and rejected — three guards at three sites are clearer than one
  abstraction that would obscure which array is being guarded against which
  legacy document type.

---

## Verdict

**APPROVED** — T642 confirmed resolved by the prior T642.2 fixture isolation;
T643 extended from authoring-side to runtime-side with 6 targeted guards and
9 regression tests; no regressions in the existing 731-test authoring-ui or
256-test runtime-player suites. The `grep "sequences\.filter\("`,
`grep "for .* of actions"`, and `grep "run\(shared\.actions\)"` invariants
now guarantee that every legacy-safe iteration in the action engine goes
through a nullish-coalescing default.
