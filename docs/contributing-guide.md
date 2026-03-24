# eLearn Studio — Contributing Guide

## Overview

This guide covers the development workflow for contributing to eLearn Studio:
setting up the environment, running tests, using debug tools, regenerating the
OpenAPI client, and the CI requirements that must pass before merging.

---

## Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| Node.js | 20.x | Backend and build tooling |
| pnpm | 9.x | Monorepo package manager |
| Docker + Compose | v2 | Local infrastructure (MongoDB, Garage, Moodle) |
| TypeScript | via `pnpm` | No global install needed |

```bash
# Verify
node -v   # 20.x
pnpm -v   # 9.x
docker compose version
```

---

## First-Time Setup

```bash
# 1. Clone and install
git clone <repo-url> elearn-studio
cd elearn-studio
pnpm install

# 2. Copy environment template
cp docker/.env.example docker/.env

# 3. Start local infrastructure (MongoDB + Garage + observability stack)
docker compose -f docker/docker-compose.dev.yml up -d

# 4. Start all packages in watch mode
pnpm dev
```

The authoring UI is at **http://localhost:5173** and the API at **http://localhost:3001**.

---

## Running Tests

### Unit + integration tests

```bash
# All packages
pnpm test

# Backend only (Jest + Supertest against a real MongoDB test database)
pnpm --filter api test

# Authoring UI only (Vitest + React Testing Library)
pnpm --filter authoring-ui test

# With coverage report
pnpm --filter authoring-ui test -- --coverage
pnpm --filter api test -- --coverage
```

Minimum coverage target: **80%** across statements, branches, functions, and lines.

### E2E tests (Playwright)

```bash
# Install Playwright browsers (once, or after upgrading Playwright)
pnpm --filter @elearn-studio/e2e exec playwright install --with-deps

# Run E2E tests (requires the dev stack to be running)
pnpm --filter @elearn-studio/e2e run test

# Run with UI (interactive mode)
pnpm --filter @elearn-studio/e2e run test:ui

# Run a single spec
pnpm --filter @elearn-studio/e2e exec playwright test editor.spec.ts
```

E2E tests require Docker dev stack running (`docker compose ... up -d`).

---

## Documentation Screenshots

Screenshots for the user guide and README are captured automatically using a
standalone Playwright script. The output PNGs live in `docs/assets/screenshots/`
and are committed to the repository so docs render on GitHub without re-running
the capture.

### Running the capture script

```bash
# Prerequisites: full dev stack must be running
docker compose -f docker/docker-compose.dev.yml up -d
pnpm dev  # authoring-ui on :3000, api on :3001

# Install docs package deps (once)
pnpm install

# Run capture (19 screenshots → docs/assets/screenshots/)
pnpm --filter @elearn-studio/docs run capture
```

The script reuses `e2e/.auth/state.json` if present (created by the E2E setup
run). If the file is missing it authenticates from scratch using the test user
`e2e-test@elearn.test`.

### Environment variables

| Variable | Default | Override |
|---|---|---|
| `DOCS_API_URL` | `http://localhost:3001` | Backend URL |
| `DOCS_BASE_URL` | `http://localhost:3000` | Authoring UI URL |
| `DOCS_GRAFANA_URL` | `http://localhost:3010` | Grafana URL |
| `E2E_TEST_USER_EMAIL` | `e2e-test@elearn.test` | Test user email |
| `E2E_TEST_USER_PASSWORD` | `e2e-password-secure-123` | Test user password |

### When to re-run

Re-run the capture script when:
- UI layout or feature set changes significantly
- New widgets, panels, or dialogs are added
- Preparing a release (ensures screenshots match the released version)

Commit the updated PNGs along with the code change that triggered them.

---

## CI Requirements

All of the following must pass before a PR can merge:

| Check | Command | Notes |
|---|---|---|
| TypeScript build | `pnpm build` | Zero type errors across all packages |
| Unit tests | `pnpm test` | All suites pass, no skipped tests |
| Coverage gate | `pnpm test -- --coverage` | ≥ 80% statements/branches |
| Lint | `pnpm lint` | ESLint + Prettier; zero errors |
| E2E smoke tests | Playwright in CI | Headless, against ephemeral Docker |
| API client drift | `pnpm --filter authoring-ui run gen:api-client` | Must produce no diff vs committed files |

The CI pipeline runs on every PR push. Failing checks block merge.

### Fixing a coverage gap

```bash
# Find uncovered lines
pnpm --filter api test -- --coverage --coverageReporters=text
# Look for lines marked 'U' in the output, then add tests for them
```

---

## OpenAPI Client Regeneration

The TypeScript types in `packages/authoring-ui/src/api/generated.ts` are
**auto-generated** from the backend OpenAPI spec. Never edit `generated.ts` by hand.

### When to regenerate

Regenerate whenever you change:
- Any route handler response shape in `backend/api/src/routes/`
- Any Mongoose schema that feeds into a route response
- The OpenAPI spec generator at `backend/api/scripts/gen-openapi.ts`

### How to regenerate

```bash
# From the repo root — runs gen:openapi then openapi-typescript
pnpm --filter authoring-ui run gen:api-client
```

This command:
1. Runs `backend/api/scripts/gen-openapi.ts` → writes `backend/api/openapi.json`
2. Writes a SHA-256 hash to `backend/api/openapi.hash` (CI drift detection)
3. Runs `openapi-typescript` → writes `packages/authoring-ui/src/api/generated.ts`

### Commit the generated files

Both `openapi.json`, `openapi.hash`, and `generated.ts` are committed to git
(they are NOT gitignored). Commit them together with the API change that caused them:

```bash
git add backend/api/openapi.json \
        backend/api/openapi.hash \
        packages/authoring-ui/src/api/generated.ts
git commit -m "chore: regenerate OpenAPI client after <describe change>"
```

### CI drift check

CI runs `gen:api-client` and asserts `git diff --exit-code` is empty. If you
forget to commit the regenerated files, CI will catch it.

---

## Debug Tools

### Structured logs (Pino → Loki → Grafana)

```bash
# Pretty-print logs in your terminal (dev only)
pnpm --filter api dev | pino-pretty

# Or via Docker logs (structured JSON)
docker compose -f docker/docker-compose.dev.yml logs -f api
```

Grafana log explorer: **http://localhost:3001** → Explore → Loki.
See `docs/observability-guide.md` for LogQL examples.

### Distributed traces (OpenTelemetry → Tempo → Grafana)

Every HTTP request generates a trace. Correlate log `traceId` → Tempo span:

1. Find a log entry in Loki
2. Copy the `traceId` value from the JSON
3. In Grafana Explore, switch to Tempo and paste the trace ID

### Telemetry ping endpoint (dev only)

```bash
# Verify the full auth → log → trace pipeline
curl http://localhost:3001/telemetry/ping \
  -H "Authorization: Bearer <access-token>"
# { "ok": true, "userId": "..." }
```

Appears in Grafana within ~5 seconds.

### SCORM packaging debug

```bash
# Generate a SCORM 1.2 ZIP to disk (useful for inspecting the output)
pnpm --filter scorm-packager run build -- --courseId <id> --format scorm12 --out /tmp/test.zip

# Inspect the ZIP
unzip -l /tmp/test.zip
```

Upload the ZIP to Moodle at **http://localhost:8081** to validate LMS compatibility.

---

## Code Style

- **TypeScript** everywhere (no `any` except explicit `// eslint-disable` with justification)
- **Immutability** — create new objects, never mutate in place
- **Small files** — 200–400 lines typical, 800 max; extract when growing
- **Error handling** — never silently swallow; log context server-side, user-friendly message in UI
- **No `localStorage` in `runtime-player`** — SCORM `suspend_data` only

Run auto-fix before committing:

```bash
pnpm lint --fix
```

---

## Adding a New Widget Type

1. Add a TypeScript type to `packages/authoring-ui/src/types/` (discriminated union member)
2. Register a GrapesJS Block + Component in `packages/authoring-ui/src/grapesjs/`
3. Add rendering logic to `packages/runtime-player/src/widgets/`
4. Add scoring/evaluation to `packages/question-engine/src/` if it's a question widget
5. Update SCORM packager output if the widget needs special manifest entries
6. Write tests for each layer; update the OpenAPI spec if a new API field is added

---

## Commit Message Format

```
<type>: <short description>

<optional body — why, not what>
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`

Examples:
```
feat: add process-flow Phaser simulation widget
fix: compound index on AuditLog.courseId for history query performance
docs: add contributing guide with CI requirements
chore: regenerate OpenAPI client after adding Asset.mimeType field
```

---

## Pull Request Checklist

Before opening a PR:

- [ ] `pnpm build` — zero errors
- [ ] `pnpm test` — all tests pass
- [ ] Coverage ≥ 80% (verify with `--coverage`)
- [ ] `pnpm lint` — zero lint errors
- [ ] `gen:api-client` run and files committed if API changed
- [ ] E2E tests pass locally if touching a critical user flow
- [ ] `docs/` updated if adding a major feature
- [ ] No secrets or `.env` files committed
