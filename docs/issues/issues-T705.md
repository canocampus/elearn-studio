# T705 Code Review — Issues Report

**Reviewed:** 2026-03-29
**Scope:** T705 — GrapesJS API contract tests (`packages/authoring-ui/src/__tests__/grapesjs-contracts.test.ts`)
**Files reviewed:** `grapesjs-contracts.test.ts`, `converters.ts`, `registerBlocks.ts`, `storageManager.ts`

---

## CRITICAL (0)

No critical issues found.

---

## HIGH (1)

### H-01 — Contract tests use pure mocks — do not test real GrapesJS behaviour
**File:** `src/__tests__/grapesjs-contracts.test.ts` (all tests)
The five contract tests verify the *call signature* of the mocked APIs but do not import
or instantiate a real GrapesJS editor. This means a breaking change in GrapesJS
(e.g. `toArray()` renamed to `components()`) will **not** be caught by these tests until
someone runs the actual authoring UI against the new GrapesJS version.

**Impact:** The primary protection mechanism is the running application, not the tests. The
contract tests only verify that `converters.ts`/`registerBlocks.ts` *call the right method
name* — they cannot verify that GrapesJS *provides* that method.

**Recommendation:** Add a lightweight smoke test that imports `grapesjs` and confirms the
five methods exist on a real (headless) editor instance. This can live as a separate
`grapesjs-live-contracts.test.ts` with `environment: 'jsdom'`.

**Priority:** HIGH — the tests pass even if GrapesJS removes the method, defeating their
upgrade-sentinel purpose.

---

## MEDIUM (2)

### M-01 — T705.2 fallback path is tested but the production fallback is not implemented
**File:** `grapesjs-contracts.test.ts` lines 91–102; `converters.ts`
The test for `getInnerHTML()` verifies a `?.()` fallback to `component.get('content')`.
However `converters.ts` does not implement this fallback — if `getInnerHTML` is absent
in a future GrapesJS build, `converters.ts` will return `undefined` for widget text,
silently corrupting slide data.

**Fix:** Ensure `converters.ts` has the same fallback:
```typescript
const html = typeof component.getInnerHTML === 'function'
  ? component.getInnerHTML()
  : component.get('content') as string ?? ''
```

### M-02 — No contract test for `editor.Commands.isActive()` — used in `initEditor.ts`
**File:** `initEditor.ts` — `editor.Commands.isActive('sw-visibility')` is called
in the toolbar but has no corresponding contract test. This is also a Backbone-derived
API surface that could change.

**Fix:** Add T705.6 contract test for `editor.Commands.isActive(commandName)`.

---

## LOW (2)

### L-01 — JSDoc `@grapesjs-contract` annotation is not enforced by any lint rule
**File:** `grapesjs-contracts.test.ts` file header
The intent is that all tests in this file are tagged, but there is no ESLint rule or
CI check that enforces the annotation. A future contributor could add a test without
the tag and it would not be flagged during `git push`.

**Recommendation:** Add a comment at the top of the file clearly stating the tagging
requirement, or add a custom ESLint rule for the `/src/__tests__/grapesjs-contracts.test.ts`
path.

### L-02 — Test descriptions use ticket IDs (T705.1–T705.5) that will become stale
**File:** `grapesjs-contracts.test.ts`
When additional contract tests are added in future sprints, the numbering (T705.1 through
T705.5) will no longer reflect what each test covers, and the `describe` block will feel
out of place.

**Recommendation:** Keep the ticket reference in the file header; use descriptive `describe`
names like `"component.toArray() API contract"` rather than `"T705.1 — ..."`.

---

## Summary

| Severity | Count | Status |
|---|---|---|
| CRITICAL | 0 | — |
| HIGH | 1 | Unresolved — add live contract smoke test |
| MEDIUM | 2 | Unresolved — fallback gap in converters.ts, missing Commands contract test |
| LOW | 2 | Accepted technical debt |

**Verdict:** Safe to merge. H-01 should be addressed before the next GrapesJS version
bump. M-01 is a latent data-corruption risk that should be fixed in the next sprint.
