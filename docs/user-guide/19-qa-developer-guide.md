# 19 — QA & Developer Guide

> **This chapter is for QA engineers and developers contributing to eLearn Studio.** End users should skip it — every previous chapter is written for authors, this one is written for technical contributors and uses technical terminology (CLI, CI, paths, file names, fixtures).

---

## Repository layout — what runs where

| Layer | Where | Runner | Scope |
|---|---|---|---|
| Unit tests — authoring UI | `packages/authoring-ui/src/__tests__/` | vitest (`pnpm -C packages/authoring-ui test`) | Components, hooks, converters, store, editor utilities |
| Unit tests — runtime player | `packages/runtime-player/src/__tests__/` | vitest (`pnpm -C packages/runtime-player test`) | Actions engine, renderer, animations, SCORM helpers |
| Integration tests — backend | `backend/api/src/__tests__/` | vitest + supertest (`pnpm -C backend/api test`) | Express routes, Mongoose models, auth, SCORM export pipeline |
| Integration tests — other packages | `packages/{scorm-packager,phaser-simulations,question-engine,simulation-engine}/src/__tests__/` | vitest (`pnpm -C packages/<name> test`) | Package-local logic |
| **E2E tests** | `e2e/tests/*.spec.ts` | Playwright (`pnpm -C e2e test`) | Critical user flows against running authoring-ui + backend |

Total at v0.5.62: **~1,290 unit + integration tests**, **163 E2E tests** (161 active + 2 skipped).

---

## E2E suite — `e2e/`

### Layout

```
e2e/
├── .auth/                        # Persisted auth state (git-ignored)
│   └── state.json                # Populated by globalSetup
├── fixtures/
│   ├── auth.ts                   # `editorPage` + `loginPage` fixtures
│   ├── images/                   # Test fixtures (PNGs for upload tests)
│   └── index.ts
├── pages/                        # Page Object Models
│   ├── EditorPage.ts
│   ├── ActionsEditorPage.ts
│   └── LoginPage.ts
├── tests/                        # Every .spec.ts is a test suite
├── global-setup.ts               # Runs once before all tests
├── global-teardown.ts
├── playwright.config.ts
└── package.json
```

### Fixture model — isolation

Every test in `tests/*.spec.ts` receives a fresh course via the `editorPage` fixture in `fixtures/auth.ts`:

1. **Setup**: `POST /courses` creates an isolated course with a test title.
2. Test navigates via `?courseId=<id>` so parallel workers never share course state.
3. Test waits for `[data-editor-ready="true"]` in `EditorCanvas.tsx` before doing anything.
4. **Teardown**: `DELETE /courses/<id>` (tolerates 404 if the test already deleted it).

This per-test isolation replaced the shared seed course that caused `FLAKE-03` before T642.

### Global setup

`global-setup.ts`:

1. Registers a test user via `POST /auth/register` (idempotent — 409 is acceptable).
2. Logs in via `POST /auth/login` to obtain the refresh cookie.
3. Injects the refresh cookie into a Chromium context (bypasses the UI login flow).
4. Saves browser `storageState` to `e2e/.auth/state.json` for every subsequent test to reuse.
5. Falls back to UI login if cookie injection is blocked (diagnostic screenshots written on failure).

### Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `E2E_BASE_URL` | `http://localhost:3000` | authoring-ui origin |
| `E2E_API_URL` | `http://localhost:3001` | backend API origin |
| `E2E_TEST_USER_EMAIL` | `e2e-test@elearn.test` | Seeded test user email |
| `E2E_TEST_USER_PASSWORD` | `e2e-password-secure-123` | Seeded test user password |
| `CI` | — | When set, enables retries (2) and single worker |

---

## Running tests locally

```bash
# 1. Start dev infra (one terminal)
pnpm -r --parallel run dev          # authoring-ui on :3000, backend on :3001
                                    # + Garage S3 if configured

# 2. Run the full E2E suite (another terminal)
pnpm -C e2e test

# Run a single spec
pnpm -C e2e test button-widget
pnpm -C e2e test tests/button-widget.spec.ts

# Run a single test by title (regex)
pnpm -C e2e test --grep "T611.10"

# Headed mode (visible browser)
pnpm -C e2e test:headed

# Playwright UI (interactive debugger)
pnpm -C e2e test:ui

# Open the last HTML report
pnpm -C e2e report
```

### Project selection

```bash
# Just the Chromium project (default for most specs)
pnpm -C e2e test --project=chromium

# Just the setup project (auth.spec.ts — runs unauthenticated)
pnpm -C e2e test --project=setup
```

The `setup` project in `playwright.config.ts` intentionally matches only `auth.spec.ts`, runs without a pre-baked `storageState`, and tests the login page itself.

---

## Captured artifacts on failure

Configured in `playwright.config.ts`:

| Artifact | When | Location |
|---|---|---|
| Screenshot | On failure (`screenshot: 'only-on-failure'`) | `test-results/e2e/<test>/test-failed-*.png` |
| Video | On first retry (`video: 'on-first-retry'`) | `test-results/e2e/<test>/video.webm` |
| Trace | On first retry (`trace: 'on-first-retry'`) | `test-results/e2e/<test>/trace.zip` |
| HTML report | Always | `test-results/e2e-report/` (open via `pnpm -C e2e report`) |

View a trace:

```bash
npx playwright show-trace test-results/e2e/<test>/trace.zip
```

---

## Writing a new spec

### 1. Import the fixture

```typescript
// e2e/tests/my-feature.spec.ts
import { test, expect } from '../fixtures/auth'

test.describe('@regression My Feature', () => {
  test('does something', async ({ editorPage, page }) => {
    // editorPage is already logged in + isolated course + editor ready
  })
})
```

### 2. Tag classification

Tag tests in the `describe` or `test` title:

| Tag | Purpose |
|---|---|
| `@regression` | Per-task regression coverage. Runs in every CI job. |
| `@integration` | Cross-system integration (e.g. preview postMessage handshake). Runs in every CI job. |
| `@smoke` | Reserved for fast smoke suites. Not currently used in nightly runs. |
| No tag | Same as `@regression` for runner purposes; add a tag on new specs for consistency. |

### 3. Use the Page Object Models

`pages/EditorPage.ts` exposes:

- `editorPage.addSlide()` — clicks Add Slide and waits for the slide list to update.
- `editorPage.addComponentViaEditor(type)` — programmatically creates a block via `window.__elearn_editor` (DEV builds only).
- `editorPage.canvasFrame()` — returns the GrapesJS `iframe.gjs-frame` frame locator.
- `editorPage.readySignal()` — returns the `[data-editor-ready="true"]` locator.
- `editorPage.publishScormButton`, `editorPage.previewButton`, `editorPage.slidesTab`, etc.

Prefer these to ad-hoc selectors — they keep test intent readable.

### 4. Do not mock the backend

E2E specs hit the real backend. Mocking at this layer defeats the purpose. Unit tests (in `packages/*/src/__tests__/`) are where mocked-backend tests live.

---

## CI integration — GitHub Actions

The workflow `Lint · Test · Build` runs on every push to `master` and on pull requests. Steps, in order, all must succeed:

1. **Set up job** — checkout, setup pnpm, setup Node.js, install dependencies.
2. **Lint** — `pnpm lint` (ESLint across the monorepo).
3. **Build shared-types** — required before any other package compiles.
4. **Test (unit + integration, all packages)** — `pnpm -r test`.
5. **Check OpenAPI spec is up-to-date** — fails if `openapi.yaml` is out of sync with annotations.
6. **Generate API types (authoring-ui)** — produces `authoring-ui/src/api/generated.ts`.
7. **Build (all packages)** — `pnpm -r run build`.
8. **Upload coverage reports**.
9. **Install Playwright browsers**.
10. **Start test infrastructure** — Garage S3 container, etc.
11. **Start API server (background)** + **Start authoring-ui (background)**.
12. **Wait for services to be ready** — `wait-on` polls health endpoints.
13. **Run E2E tests** — `pnpm -C e2e test`.
14. **Upload E2E test results** — HTML report, screenshots, videos, traces.
15. **Stop test infrastructure**.

A typical run takes **15–20 minutes** end to end. Retries are **2** on CI, **0** locally.

---

## Pre-push checklist

Before pushing to `master` or opening a PR:

```bash
pnpm -r lint                        # 0 errors expected
pnpm -r run build                   # required — CI will fail if build breaks
pnpm -r test                        # all unit + integration green
pnpm -C e2e test                    # full E2E suite green (needs dev infra running)
```

When a build fails, read the first error from the top. Build errors cascade — fixing the top one usually fixes the rest.

### TypeScript build vs `--noEmit`

The production build path (`tsc -b`) includes types that `tsc --noEmit` omits — specifically, `@types/node` is picked up by unit test tsconfigs but **not** by the production `tsc -b` pipeline. Examples we've hit:

- `process.env.NODE_ENV` compiles under `tsc --noEmit` (test config has `@types/node`) but fails under `tsc -b` (production doesn't). Use `import.meta.env.DEV` instead.

**Rule of thumb**: validate locally with `tsc -b` before pushing, not with `tsc --noEmit`. The TD-005 lesson commit documents why.

---

## Related ADRs

Architecture decisions that affect how tests are structured:

- `decisions/2026-04-17-request-save.md` — T651 unified persistence via `requestSave()`.
- `decisions/2026-04-17-editor-loading-flag.md` — `_isEditorLoading` module flag (T646.5).
- `decisions/2026-04-18-course-mutation.md` — TD-007 unified course-meta path via `requestCourseMutation`.
- `decisions/2026-04-18-editor-loading-flag.md` — TD-006 audit (closes T646.5 "future path" disclaimer).

When adding a test that touches persistence, cache, or editor lifecycle, read the matching ADR first.

---

## Reporting test failures

When a CI job goes red:

1. Download the artifacts from the failed workflow run.
2. Open `test-results/e2e-report/index.html` for a full HTML summary.
3. Use `npx playwright show-trace <path/to/trace.zip>` for step-by-step playback of the failed test.
4. Reproduce locally with `pnpm -C e2e test --grep "<test name>"` before diagnosing. An intermittent CI failure is often a missing wait or selector race — the test is the bug until proven otherwise.

For open infrastructure-level flakes, check `WORKING_CONTEXT.md` under "Known Issues Right Now" — pre-existing flakes are recorded there with reproduction steps and owner.
