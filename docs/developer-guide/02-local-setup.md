# Local Setup

Covers cloning, installing, starting the dev stack, running tests, and hot reload.

---

## Prerequisites

| Tool | Minimum version | Install |
|---|---|---|
| Node.js | 20 LTS | https://nodejs.org |
| pnpm | 9 | `npm install -g pnpm@9` |
| Docker Desktop | 4.x | https://docs.docker.com/get-docker/ |
| Git | 2.x | https://git-scm.com |

---

## Installation

```bash
# 1. Clone the repository
git clone https://github.com/your-org/elearn-studio.git
cd elearn-studio

# 2. Install all workspace dependencies
pnpm install

# 3. Copy the environment template
cp docker/.env.example docker/.env
```

Edit `docker/.env` and set at minimum:

| Variable | Default | Description |
|---|---|---|
| `MONGO_URL` | `mongodb://mongo:27017/elearn` | MongoDB connection string |
| `GARAGE_ENDPOINT` | `http://garage:3900` | Garage S3 endpoint |
| `GARAGE_ACCESS_KEY` | `root-key` | Garage root access key |
| `GARAGE_SECRET_KEY` | `root-secret` | Garage root secret |
| `JWT_SECRET` | — | **Required.** Set a random 64-char string |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated allowed origins |
| `LOG_LEVEL` | `info` | `debug` \| `info` \| `warn` \| `error` |

---

## Start the dev stack

```bash
# Start infrastructure services (MongoDB, Garage, Grafana stack)
docker compose -f docker/docker-compose.dev.yml up -d

# Start all packages in dev mode (hot reload)
pnpm dev
```

### Verify services are running

```bash
docker compose -f docker/docker-compose.dev.yml ps
# NAME         STATUS    PORTS
# mongo        running   27017/tcp
# garage       running   0.0.0.0:3900->3900/tcp, 0.0.0.0:3903->3903/tcp
# grafana      running   0.0.0.0:3010->3000/tcp
# loki         running   3100/tcp
# tempo        running   3200/tcp
# prometheus   running   0.0.0.0:9090->9090/tcp
```

### Service URLs

| Service | URL | Credentials |
|---|---|---|
| Authoring UI | http://localhost:3000 | — |
| Backend API | http://localhost:3001 | Bearer token |
| API Health | http://localhost:3001/health | Public |
| Swagger UI | http://localhost:3001/docs | Public |
| Garage S3 API | http://localhost:3900 | AWS SDK |
| Garage Admin API | http://localhost:3903 | Admin key |
| Grafana | http://localhost:3010 | admin / admin |
| Prometheus | http://localhost:9090 | — |
| Moodle | http://localhost:8081 | admin / admin (first run ~5 min) |

---

## Running tests

```bash
# All packages — unit tests
pnpm test

# Single package
pnpm --filter question-engine test
pnpm --filter authoring-ui test
pnpm --filter @elearn-studio/api test

# Watch mode (single package)
pnpm --filter question-engine test -- --watch

# E2E tests (requires full dev stack running)
pnpm --filter @elearn-studio/e2e test

# Run a specific spec file
pnpm --filter @elearn-studio/e2e test -- grapesjs-integration

# Open Playwright UI (interactive test runner)
pnpm --filter @elearn-studio/e2e test:ui
```

### E2E spec files

| Spec file | What it covers |
|---|---|
| `auth.spec.ts` | Login flow, JWT issuance (runs unauthenticated — `setup` project) |
| `grapesjs-integration.spec.ts` | Widget drag/drop coordinates, resize handles, property persistence (FM-05), in-canvas repositioning (FM-02) |
| `persistence.spec.ts` | Widget survival on reload (GAP-03), autosave race condition (GAP-06), session restore after F5 (GAP-05) |
| `question-widget.spec.ts` | Block panel visibility, drag-to-canvas, default content, Props panel edit reflected in canvas (GAP-07) |
| `action-sequence.spec.ts` | Actions tab visibility, panel accessibility with widget selected (GAP-02) |
| `image-upload.spec.ts` | Asset upload flow, presigned URL display in canvas (FM-04) |
| `authoring-ui-layer.spec.ts` | Slide add/delete/reorder/rename |
| `course-crud.spec.ts` | Course create/update/delete via UI |
| `scorm-export.spec.ts` | SCORM export ZIP download |
| `moodle-scorm.spec.ts` | Moodle SCORM upload + player verification — opt-in via `E2E_MOODLE=1` (requires Moodle Docker service) |

### Playwright projects — why 86 vs 90 tests

The E2E suite uses two Playwright projects configured in `e2e/playwright.config.ts`:

| Project | `testMatch` / `testIgnore` | storageState | Tests |
|---|---|---|---|
| `setup` | only `auth.spec.ts` | none (unauthenticated) | 4 |
| `chromium` | ignores `auth.spec.ts` | `.auth/state.json` (pre-logged-in) | 86 |

Running `npx playwright test --project=chromium` reports **86 tests**.
Running `npx playwright test` (both projects) reports **90 tests**.

Auth tests are in the `setup` project because they test the login page itself — they must start unauthenticated. All other tests use a pre-baked session via `storageState` so each test starts already logged in without repeating the login flow.

```bash
# Run only the chromium project (86 tests, skips auth spec)
npx playwright test --project=chromium

# Run all projects including auth tests (90 tests total)
npx playwright test

# Run Moodle SCORM integration tests (requires Moodle Docker service)
E2E_MOODLE=1 npx playwright test --project=chromium
```

### Coverage report

```bash
pnpm --filter question-engine test -- --coverage
# Coverage report: packages/question-engine/coverage/index.html
```

---

## Hot reload

`pnpm dev` starts Vite's dev server for `authoring-ui` and `ts-node-dev` (or `tsx --watch`) for `backend/api`. File saves in either package reload immediately.

For `runtime-player` and `phaser-simulations` changes, rebuild the bundle:

```bash
pnpm --filter runtime-player run build
pnpm --filter phaser-simulations run build
```

---

## Build all packages

```bash
# Build all packages in dependency order
pnpm build

# Build a specific package
pnpm --filter scorm-packager run build
```

---

## Troubleshooting

**`pnpm install` fails with peer dependency errors**

Run with `--no-strict-peer-dependencies`:
```bash
pnpm install --no-strict-peer-dependencies
```

**Garage bucket not created on first run**

The `garage-init` container creates the `elearn-assets` bucket automatically. If it fails, run it manually:
```bash
docker compose -f docker/docker-compose.dev.yml run --rm garage-init
```

**MongoDB connection refused**

Confirm MongoDB started:
```bash
docker compose -f docker/docker-compose.dev.yml logs mongo
```

**`GET /health` returns `garage: false`**

Check Garage logs. The most common cause is the access key not matching `docker/.env`:
```bash
docker compose -f docker/docker-compose.dev.yml logs garage
```

**Port conflict on 3000 or 3001**

Find and kill the conflicting process, or override the port in `.env`:
```bash
VITE_PORT=3030 pnpm --filter authoring-ui run dev
API_PORT=3031 pnpm --filter @elearn-studio/api run dev
```

---

## SCORM Testing

eLearn Studio supports both SCORM 1.2 and SCORM 2004 4th Edition standards for LMS delivery. This section covers the differences, testing strategies, and common pitfalls.

### SCORM 1.2 vs SCORM 2004 — key differences

| Aspect | SCORM 1.2 | SCORM 2004 4th Ed |
|---|---|---|
| **API object** | `window.API` | `window.API_1484_11` |
| **Init/Finish** | `LMSInitialize()`, `LMSFinish()` | `Initialize()`, `Terminate()` |
| **Get/Set** | `LMSGetValue()`, `LMSSetValue()` | `GetValue()`, `SetValue()` |
| **Score fields** | `cmi.core.score.raw`, `.min`, `.max` | `cmi.score.raw`, `.min`, `.max`, `.scaled` |
| **Completion field** | `cmi.core.lesson_status` (single) | `cmi.completion_status` + `cmi.success_status` (two fields) |
| **Location field** | `cmi.core.lesson_location` | `cmi.location` |
| **Suspend data limit** | 4096 bytes | 64KB |
| **Mastery score format** | Integer (0–100) | Normalized (0.0–1.0) |
| **LMS support** | Widest (legacy systems) | Modern LMS preferred |

**Why SCORM 1.2 is the primary target:** Despite being older (2001), SCORM 1.2 is supported by nearly every LMS, including legacy Moodle instances and enterprise systems. SCORM 2004 support is secondary but equally tested.

#### API version auto-detection

The runtime player detects the LMS version at runtime. In `packages/runtime-player/src/index.ts`, the `createScormAdapter()` function walks the window hierarchy:

```typescript
function createScormAdapter(win: Window): ScormAdapter | null {
  let w: Window | null = win
  let attempts = 0
  while (w && attempts < 10) {
    // Check SCORM 2004 first
    if (typeof w.API_1484_11 !== 'undefined') {
      return { version: '2004', /* ... */ }
    }
    // Fall back to SCORM 1.2
    if (typeof w.API !== 'undefined') {
      return { version: '1.2', /* ... */ }
    }
    // Traverse parent windows (LMS may attach API in parent frame)
    w = w.parent === w ? null : w.parent
  }
  return null
}
```

The adapter's `version` field determines which CMI keys are set by `scormReport()`.

### suspend_data schema — serialization and persistence

The runtime player serializes player state (current slide, visited slides, question scores) into a compressed JSON payload stored in `cmi.suspend_data`. This allows learners to resume where they left off.

#### suspend_data schema (v:2)

```typescript
// packages/runtime-player/src/suspend.ts
interface SuspendPayload {
  v: 1 | 2                               // version (v:1 payloads auto-upgraded)
  slide: number                           // current slide index
  visited?: number[]                      // slide indices visited (v:2 only)
  scores: Array<[widgetId, {             // question scores
    s: number                             // score (0.0–1.0)
    w: number                             // weight (100 default)
    a: boolean                            // answered flag
  }]>
}
```

When compressed with LZString and stored in `cmi.suspend_data`, the payload must fit within the SCORM 1.2 limit of **4096 bytes**.

#### visitedSlides tracking

The `visited` field tracks slide indices visited during the session. This drives the progress bar widget (on slide 0, progress = 1/N; after visiting slides 0,1,3 of a 5-slide course, progress = 3/5). This is displayed via the `progress-bar` widget's `el-progress-bar-fill` element.

**TA608 regression fix (v0.5.22):** visitedSlides was incorrectly reset on resume. Now, when resuming from suspend_data with v:2 payload, the visited set is restored directly. For v:1 payloads (pre-upgrade), visited defaults to `[currentSlide]` to prevent 0% progress display on resume.

#### Backward compatibility

When a v:1 payload is restored (no `visited` field), the runtime detects the missing field and auto-upgrades:

```typescript
state.visitedSlides = new Set(
  Array.isArray(payload.visited)
    ? payload.visited.filter(n => typeof n === 'number' && n >= 0 && n < slideCount)
    : [payload.slide],  // v:1: seed with current slide only
)
```

### How to test SCORM features

#### Unit test mock pattern

The test helpers in `packages/runtime-player/src/__tests__/scorm2004.test.ts` show the mocking pattern:

```typescript
/** Minimal SCORM 1.2 API mock (window.API) */
function makeScorm12Api(store: Record<string, string> = {}) {
  return {
    LMSInitialize: vi.fn(() => 'true'),
    LMSFinish: vi.fn(() => 'true'),
    LMSGetValue: vi.fn((key: string) => store[key] ?? ''),
    LMSSetValue: vi.fn((key: string, value: string) => { store[key] = value; return 'true' }),
    LMSCommit: vi.fn(() => 'true'),
    LMSGetLastError: vi.fn(() => '0'),
  }
}

/** Minimal SCORM 2004 API mock (window.API_1484_11) */
function makeScorm2004Api(store: Record<string, string> = {}) {
  return {
    Initialize: vi.fn(() => 'true'),
    Terminate: vi.fn(() => 'true'),
    GetValue: vi.fn((key: string) => store[key] ?? ''),
    SetValue: vi.fn((key: string, value: string) => { store[key] = value; return 'true' }),
    Commit: vi.fn(() => 'true'),
    GetLastError: vi.fn(() => '0'),
  }
}
```

To inject the mock for testing:

```typescript
test('player correctly sets SCORM 2004 CMI fields', async () => {
  const store: Record<string, string> = {}
  const api = makeScorm2004Api(store)
  // @ts-expect-error injecting LMS mock
  window.API_1484_11 = api

  // ... init player, navigate slides, finish ...

  expect(store['cmi.completion_status']).toBe('completed')
  expect(store['cmi.success_status']).toBe('passed')
  expect(store['cmi.score.scaled']).toBe('0.85')  // 85/100
})
```

#### Testing suspend_data persistence

See `packages/runtime-player/src/__tests__/suspend.test.ts` for comprehensive suspend/resume tests:

```typescript
it('restores slide index, visitedSlides, and question states from suspend_data', () => {
  const state = makeState(2, [['w1', { score: 1, weight: 100, answered: true }]], [0, 1, 2])
  const store: Record<string, string> = {}
  const api = makeApi(store)
  
  // Save state
  saveSuspendData(state, api)

  // Simulate resume: restore to fresh state
  const restored = makeState()
  const ok = restoreSuspendData(restored, api, 10)

  expect(ok).toBe(true)
  expect(restored.currentSlide).toBe(2)
  expect(restored.visitedSlides).toEqual(new Set([0, 1, 2]))
  expect(restored.questionStates.size).toBe(1)
})
```

Run these tests:

```bash
pnpm --filter runtime-player test -- suspend.test.ts
pnpm --filter runtime-player test -- scorm2004.test.ts
```

#### SCORM compliance in scormReport()

When `scormReport(state, status)` is called (on slide navigation, course finish, etc.), it dispatches to the correct CMI keys based on API version. In `packages/runtime-player/src/index.ts`:

```typescript
function scormReport(state: PlayerState, status: 'passed' | 'failed' | 'incomplete'): void {
  const api = state.scormApi
  if (!api) return
  const score = /* calculate weighted score from questionStates */
  const passMark = course.metadata?.masteryScore ?? course.settings?.passingScore ?? 80

  if (api.version === '2004') {
    // SCORM 2004: separate completion_status and success_status
    const completionStatus = status === 'incomplete' ? 'incomplete' : 'completed'
    const successStatus = status === 'incomplete' ? 'unknown' : (score >= passMark ? 'passed' : 'failed')
    api.setValue('cmi.score.raw', String(score))
    api.setValue('cmi.score.scaled', (score / 100).toFixed(7))
    api.setValue('cmi.completion_status', completionStatus)
    api.setValue('cmi.success_status', successStatus)
    api.setValue('cmi.location', String(slideIndex))
  } else {
    // SCORM 1.2: single lesson_status field
    const lessonStatus = status === 'incomplete' ? 'incomplete' : (score >= passMark ? 'passed' : 'failed')
    api.setValue('cmi.core.score.raw', String(score))
    api.setValue('cmi.core.lesson_status', lessonStatus)
    api.setValue('cmi.core.lesson_location', String(slideIndex))
  }
  api.commit()
}
```

### Moodle test environment

#### Launching Moodle

The dev stack includes Moodle 4.x (optional, on port 8081). To enable it:

```bash
docker compose --profile moodle -f docker/docker-compose.dev.yml up -d
```

On first run, wait 5 minutes for Moodle initialization. Access it at:
- URL: `http://localhost:8081`
- Admin: `admin` / `Admin1234!`

#### Importing a SCORM package

1. **Export from eLearn Studio:** In the authoring UI, click "Export SCORM" → choose "SCORM 1.2" → download ZIP.

2. **Upload to Moodle:**
   - Log in as `admin`
   - Create a new course
   - Add activity → SCORM package
   - Upload the ZIP file
   - Open the activity and navigate through slides

3. **Verify in Moodle:**
   - Completion status updates as you progress
   - Scores are recorded after finishing
   - Resume functionality restores your position (if suspend_data is saved)

#### E2E test with Moodle

The spec `e2e/tests/moodle-scorm.spec.ts` automates this workflow. Run it with:

```bash
# Moodle is required; the test will skip if disabled
E2E_MOODLE=1 pnpm --filter @elearn-studio/e2e test -- moodle-scorm
```

This test:
1. Creates a 3-slide course via the eLearn API
2. Exports it as SCORM 1.2
3. Uploads the ZIP to Moodle
4. Verifies each slide renders inside Moodle's SCORM player iframe

### Common SCORM bugs and detection

| Bug | Symptom | Detection |
|---|---|---|
| **suspend_data overflow** | "Save failed" in player | Check `suspend.test.ts` line 51; estimate with `estimateSuspendSize(questionIds)` in authoring UI before export |
| **visitedSlides reset on resume** | Progress bar shows 0% after resuming (TA608) | Unit test: `it('restores slide index, visitedSlides...')` in suspend.test.ts line 209 |
| **localStorage fallback** | Player tries to save to localStorage instead of LMSSetValue | grep `-r "localStorage" packages/runtime-player/src/` — should be empty except in comments |
| **CMI field mismatch** | SCORM 2004 player sets `cmi.core.lesson_status` instead of `cmi.completion_status` | Test in scorm2004.test.ts line 150; mock both API versions and verify field names |
| **Out-of-bounds slide on resume** | Restored slide index >= slideCount; player shows blank or crashes | Test in suspend.test.ts line 260; restore with invalid slide index triggers failure |
| **Score/weight clamping** | NaN propagates; score shows as undefined in LMS | Test in suspend.test.ts line 287; invalid values are clamped: score ∈ [0,1], weight > 0 |

**Regression test strategy:** When a bug is fixed, add a test in `suspend.test.ts` or `scorm2004.test.ts` covering the exact scenario. Run it to verify the bug is fixed. This prevents re-introduction in future changes.
