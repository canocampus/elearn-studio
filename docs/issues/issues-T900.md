# E2E Suite Hardening Review — T900

**Date:** 2026-03-31
**Scope:** E2E test suite expansion (73 → 90 tests) + Moodle SCORM integration hardening
**Files analysed:**
- `e2e/tests/moodle-scorm.spec.ts`
- `e2e/playwright.config.ts`
- `e2e/pages/EditorPage.ts`
- `e2e/tests/persistence.spec.ts`
- `e2e/tests/grapesjs-integration.spec.ts`
- `e2e/tests/question-widget.spec.ts`
- `e2e/tests/authoring-ui-layer.spec.ts`
- `e2e/tests/action-sequence.spec.ts`
- `e2e/tests/scorm-export.spec.ts`
- `e2e/tests/course-crud.spec.ts`
- `e2e/tests/auth.spec.ts`
- `e2e/tests/image-upload.spec.ts`

---

## Executive Summary

The E2E suite expanded from 73 tests to 90 across two coverage phases. Two Moodle-specific reliability
bugs were found and fixed during the full-suite run. All 90 tests pass.

**Bugs fixed:** 2
**Coverage gaps closed:** All GAP-01 through GAP-08 from the `elearn-e2e-qa` skill
**Final pass rate:** 90/90 (86 chromium + 4 setup)

---

## Architecture: Two Playwright Projects

### Why `--project=chromium` shows 86 and the full suite shows 90

`e2e/playwright.config.ts` defines two projects:

| Project | Files matched | storageState | Count |
|---|---|---|---|
| `setup` | `auth.spec.ts` only (`testMatch`) | none — unauthenticated | 4 |
| `chromium` | everything except `auth.spec.ts` (`testIgnore`) | `.auth/state.json` | 86 |

Auth tests must start **unauthenticated** because they test the login page itself. All
other tests use a pre-baked session via `storageState` to avoid repeating the login
flow in every test. The `setup` project runs first in CI; its output session file is
consumed by the `chromium` project.

This is a deliberate split, not a loss. No tests were removed during this phase.

---

## Issues Found and Fixed

### BUG-T900-01 — `modedit.php` ERR_ABORTED in full suite (HIGH — FIXED)

**File:** `e2e/tests/moodle-scorm.spec.ts:288`

**Symptom:** `page.goto()` to Moodle's `modedit.php?add=scorm...` threw `net::ERR_ABORTED`
when running after all 84 other chromium tests. The same navigation succeeded when running
the Moodle tests in isolation.

**Root cause:** After clicking the edit-mode toggle, Moodle's JavaScript remains in-flight.
Under CPU load (all 84 preceding tests still holding open browser contexts), Playwright's
navigation was issued while the Moodle page still had XHR/fetch requests active. Chrome
aborted the new navigation to prevent tearing the in-flight requests.

The `waitUntil: 'domcontentloaded'` option (added in a prior fix) was not sufficient when
the system was under load.

**Fix:**
```typescript
// Wait for Moodle edit-mode JS to settle before navigating — prevents ERR_ABORTED
// when running in full suite context (CPU/resource contention after 84 other tests).
await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {})

const modeditUrl = `${MOODLE_URL}/course/modedit.php?add=scorm&...`
// ERR_ABORTED is intermittent under load — catch and retry once after a brief pause
await page.goto(modeditUrl, { waitUntil: 'domcontentloaded' }).catch(async () => {
  await page.waitForTimeout(2_000)
  await page.goto(modeditUrl, { waitUntil: 'domcontentloaded' })
})
await expect(page.locator('#id_name')).toBeVisible({ timeout: 15_000 })
```

**Verification:** Full 86-test suite run: 86/86 pass with `E2E_MOODLE=1`.

---

### BUG-T900-02 — Moodle login unreliable under CPU load (HIGH — FIXED)

**File:** `e2e/tests/moodle-scorm.spec.ts:220-228`

**Symptom:** After 84 preceding tests, Moodle's login page received an incomplete or
empty password, returning "Invalid login, please try again". The credentials were confirmed
valid via `curl` against `/login/token.php` (REST API). The bug only appeared in the full
suite, not in isolation.

**Root cause:** `pressSequentially` types credentials one character at a time using keyboard
events. Under CPU saturation, some keystrokes were dropped or delayed. The submitted password
was a truncated version (e.g., `Admin123` instead of `Admin1234!`).

**Fix:**
```typescript
// BEFORE (unreliable under load):
await page.locator('#username').pressSequentially(MOODLE_ADMIN)
await page.locator('#password').pressSequentially(MOODLE_PASSWORD)

// AFTER (atomic — immune to CPU contention):
await page.fill('#username', MOODLE_ADMIN)
await page.fill('#password', MOODLE_PASSWORD)
// Verify values were set before submitting
await expect(page.locator('#username')).toHaveValue(MOODLE_ADMIN)
await page.click('#loginbtn')
await page.waitForURL(url => !url.pathname.includes('/login/'), { timeout: 30_000 })
```

**Why `page.fill()` is better here:** `fill()` sets the DOM value property atomically —
it does not simulate keystrokes, so it is immune to CPU-induced event dropping. The downside
(some JS form handlers listen to `keydown`/`keyup` and can ignore programmatic `input` events)
does not apply to Moodle 4.x Bitnami, which uses standard HTML form submission.

---

## Coverage Gaps Closed

All 8 gaps from the `elearn-e2e-qa` skill are now covered:

| Gap | Description | Spec file | Status |
|---|---|---|---|
| GAP-01 | FM-05 — widget properties persist across slide navigation | `grapesjs-integration.spec.ts` | ✅ COVERED |
| GAP-02 | Action sequence save and survive reload | `action-sequence.spec.ts` | ✅ COVERED |
| GAP-03 | Widget state survives full page reload | `persistence.spec.ts` | ✅ COVERED |
| GAP-04 | SCORM ZIP content verification (imsmanifest.xml) | `scorm-export.spec.ts` | ✅ COVERED |
| GAP-05 | Auth token refresh on page reload | `persistence.spec.ts` | ✅ COVERED |
| GAP-06 | Autosave race condition — fast slide switch | `persistence.spec.ts` | ✅ COVERED |
| GAP-07 | Question property editing via Props panel | `question-widget.spec.ts` | ✅ COVERED |
| GAP-08 | Widget draggable within canvas (FM-02 complete) | `grapesjs-integration.spec.ts` | ✅ COVERED |

---

## Test Count Reference

```
spec file                    tests   project
─────────────────────────────────────────────
auth.spec.ts                     4   setup (unauthenticated)
authoring-ui-layer.spec.ts      21   chromium
question-widget.spec.ts         23   chromium
persistence.spec.ts             10   chromium
grapesjs-integration.spec.ts     9   chromium
scorm-export.spec.ts             7   chromium
action-sequence.spec.ts          6   chromium
course-crud.spec.ts              5   chromium
image-upload.spec.ts             3   chromium
moodle-scorm.spec.ts             2   chromium (opt-in: E2E_MOODLE=1)
─────────────────────────────────────────────
TOTAL                           90
```

---

### BUG-T900-03 — `w.bounds` unguarded access in `grapesjsFromWidgets` (HIGH — FIXED)

**File:** `packages/authoring-ui/src/editor/converters.ts` (function `grapesjsFromWidgets`)

**Symptom:** Loading a course slide that contains a widget created by an older API version
(before `bounds` was added to the Mongoose schema as `required: true`) caused the GrapesJS
canvas to crash with:

```
TypeError: Cannot read properties of undefined (reading 'x')
  at grapesjsFromWidgets (converters.ts)
```

The canvas went blank and `editor.loadProjectData()` did not complete.

**Root cause:** `grapesjsFromWidgets` accessed `w.bounds.x`, `w.bounds.y`, `w.bounds.width`,
and `w.bounds.height` directly without optional chaining. Although the Mongoose schema has
`bounds: { type: BoundsSchema, required: true }`, the `required` constraint only applies at
**write time** (Mongoose validation before save). It does NOT backfill the field when
hydrating existing documents from MongoDB. Any widget document written before `bounds` was
added to the schema — or any document that bypassed Mongoose validation — returns
`bounds: undefined` from the API. The direct property access then throws.

This is the same class of bug as the pre-existing `actions` guard: GrapesJS's `loadData`
calls `.forEach` on `componentDef.actions` — if `undefined`, it crashes. That was fixed by
hardcoding `actions: []`; the `bounds` issue required optional chaining + fallback defaults.

**Fix:**
```typescript
// BEFORE (throws TypeError if w.bounds is undefined):
left: `${w.bounds.x}px`,
top: `${w.bounds.y}px`,
width: `${w.bounds.width}px`,
height: `${w.bounds.height}px`,

// AFTER (safe for old/corrupt documents):
left: `${w.bounds?.x ?? 0}px`,
top: `${w.bounds?.y ?? 0}px`,
width: `${w.bounds?.width ?? 100}px`,
height: `${w.bounds?.height ?? 50}px`,
```

Fallback values (`x=0, y=0, width=100, height=50`) match the defaults used by `widgetsFromGrapesjs`
when parsing CSS, so a round-trip through load→edit→save produces a valid widget geometry.

**Verification:** Unit test in `packages/authoring-ui/src/__tests__/converters.test.ts` —
`grapesjsFromWidgets` called with a widget where `bounds` is `undefined`; confirmed no crash
and fallback geometry applied. Commit: `6964d9d`.

---

## Recommendations for Future Sessions

1. **Always run with `E2E_MOODLE=1` before closing a Moodle-related task** — the Moodle tests are opt-in and easy to forget.
2. **Prefer `page.fill()` over `pressSequentially` for credential input** — `pressSequentially` is character-by-character and drops keystrokes under load; `fill()` is atomic.
3. **Use `waitForLoadState('networkidle')` + retry for Moodle navigation** — Moodle's JS stays in-flight after UI interactions; a single `goto()` without quiescence can abort.
4. **When the test count appears to drop (e.g., 90 → 86)**, check whether you switched from running all projects to `--project=chromium` only — auth.spec.ts is intentionally excluded from the chromium project.
