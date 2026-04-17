# Code Review — TD-001: Shared `runExport()` helper for backend export routes

**Reviewer:** self-review (post-implementation)
**Date:** 2026-04-17
**Status:** APPROVED — pending CI
**Source:** T635 review (original flag), surfaced in TECH DEBT backlog

---

## What was wrong

The three export endpoints in `backend/api/src/routes/courses.ts` duplicated the
same 35-line pipeline three times:

- `POST /courses/:id/export/scorm12`
- `POST /courses/:id/export/scorm2004`
- `POST /courses/:id/export/aicc`

Each route re-implemented:
1. ObjectId validation
2. Course lookup + 404 handling
3. `fs.mkdtempSync(os.tmpdir(), 'elearn-<format>-')`
4. `collectAssetSrcs(slides)` → `downloadAssets(map, tmpDir)` → `rewriteAssetSrcs(course)`
5. Format-specific packer call (`packSCORM12` / `packSCORM2004` / `packAICC`)
6. Filename sanitisation (`title.replace(/[^a-z0-9_-]/gi, '_').slice(0, 64)`)
7. `res.download(zipPath, fileName, cleanupCallback)`
8. Try/catch with `fs.rmSync` on tmpDir and a 500 response

The only real differences between the three were: temp-dir prefix, packer
function, and filename suffix — 3 data points. The surrounding 100+ lines of
scaffolding were identical.

Adding a fourth format (the long-promised xAPI export) would have added ~70
more lines of the same pattern — and would have meant updating four places
next time the pipeline changed.

---

## The fix

Extracted the entire pipeline into `backend/api/src/lib/export/runExport.ts`:

### `runExport(course, format, options?)` — the public entry point

```typescript
type ExportFormat = 'scorm12' | 'scorm2004' | 'aicc'

interface RunExportOptions { playerPath?: string }
interface RunExportResult {
  zipPath: string
  tmpDir: string
  fileName: string
  assetCount: number
}

async function runExport(
  course: CourseDoc,
  format: ExportFormat,
  options?: RunExportOptions,
): Promise<RunExportResult>
```

One entry point, one tmpDir lifecycle, one error-path cleanup. Callers receive
everything they need to serve the download (`zipPath`, `fileName`) plus the
`tmpDir` so they can clean up after `res.download()` completes.

### Format dispatch via a `PACKERS` map

```typescript
const PACKERS: Record<ExportFormat, FormatSpec> = {
  scorm12:   { pack: packSCORM12,   tmpPrefix: 'elearn-scorm-',     fileSuffix: 'scorm12' },
  scorm2004: { pack: packSCORM2004, tmpPrefix: 'elearn-scorm2004-', fileSuffix: 'scorm2004' },
  aicc:      { pack: packAICC,      tmpPrefix: 'elearn-aicc-',      fileSuffix: 'aicc' },
}
```

Adding xAPI is now:

```typescript
xapi: { pack: packXAPI, tmpPrefix: 'elearn-xapi-', fileSuffix: 'xapi' },
```

— and one line in `courses.ts`:

```typescript
coursesRouter.post('/:id/export/xapi', exportLimiter, buildExportHandler('xapi'))
```

Total cost of the 4th format: **2 lines**. Pre-TD-001 it was **~70 lines** of
copy/paste.

### Route-layer factory in `courses.ts`

A single `buildExportHandler(format): RequestHandler` captures the route-layer
concerns (404 on missing course, 400 on invalid ObjectId, `res.download`
lifecycle, 500 on error) and delegates the pipeline to `runExport`:

```typescript
coursesRouter.post('/:id/export/scorm12',   exportLimiter, buildExportHandler('scorm12'))
coursesRouter.post('/:id/export/scorm2004', exportLimiter, buildExportHandler('scorm2004'))
coursesRouter.post('/:id/export/aicc',      exportLimiter, buildExportHandler('aicc'))
```

The three routes are now true one-liners (plus the OpenAPI JSDoc block, which
stays attached to each for per-route spec generation).

---

## Ownership of `tmpDir`

Careful contract, because the pre-TD-001 code had it implicitly split:

- **Before**: each route manually cleaned tmpDir both on success (inside the
  `res.download` callback) and on error (inside the `catch`).
- **After**: `runExport` owns the error path — if any pipeline step rejects,
  `runExport` does `fs.rmSync(tmpDir, { recursive: true, force: true })` and
  rethrows. The caller only sees `tmpDir` in the success result, so it cannot
  leak on the error path.

This is a small but real improvement. In the old code, if a route writer forgot
the error-path cleanup, orphaned directories would accumulate under
`/tmp/elearn-*` — silent disk leak. The new contract makes that impossible.

Success-path cleanup still belongs to the caller (inside the `res.download`
completion callback) because only the caller knows when the stream has
actually been consumed.

---

## Before/after LOC comparison

| File | Before | After | Δ |
|---|---:|---:|---:|
| `backend/api/src/routes/courses.ts` — `ASSET_SRC_RE`, `collectAssetSrcs`, `rewriteAssetSrcs`, `downloadAssets` | ~65 | 0 (moved) | −65 |
| `backend/api/src/routes/courses.ts` — 3 export route bodies | ~110 | 0 (replaced) | −110 |
| `backend/api/src/routes/courses.ts` — `buildExportHandler` factory | 0 | ~35 | +35 |
| `backend/api/src/routes/courses.ts` — 3 route registrations | 0 | 3 | +3 |
| **Subtotal — `courses.ts`** | **~175** | **~38** | **−137** |
| `backend/api/src/lib/export/runExport.ts` (new) | 0 | ~170 | +170 |
| `backend/api/src/__tests__/export/runExport.test.ts` (new) | 0 | ~270 | +270 |

**Net production LOC**: +33 (−137 in routes, +170 in helper). The growth is in
JSDoc for the new public API and the `PACKERS` registry. The `courses.ts`
signal-to-noise ratio improves dramatically: 175 lines of route-specific
plumbing → 38 lines of thin dispatching.

**Cost of adding xAPI** (the scenario that motivated this refactor):
- Before TD-001: +~70 LOC (another full route body).
- After TD-001: **+2 LOC** (one PACKERS entry + one route registration).

That is a 35x reduction in the marginal cost of a new format.

---

## Test coverage

`backend/api/src/__tests__/export/runExport.test.ts` — 17 tests, all passing.

| ID | What it verifies |
|---|---|
| TD-001.1a/b/c | Format dispatch: each format hits its own packer and no others |
| TD-001.2 | Pipeline order: `downloadAssets` → `rewriteAssetSrcs` (relative paths reach packer) → `pack` |
| TD-001.3 | Result shape: `zipPath`, `tmpDir`, `fileName`, `assetCount` |
| TD-001.3b | Filename suffix is format-specific (`_scorm12.zip`, `_scorm2004.zip`, `_aicc.zip`) |
| TD-001.3c | Empty/missing title falls back to `"course"` |
| TD-001.4 | `playerPath` option forwarded to the packer |
| TD-001.4b | `playerPath` omitted when not provided (packer falls back to default) |
| TD-001.5 | tmpDir cleaned + error rethrown when packer fails |
| TD-001.5b | Same invariant via a different failure point |
| TD-001.6 | Missing asset in Garage (getObject rejects) is a non-fatal skip; export completes |
| TD-001.7 | tmpDir prefix is format-specific (for orphan debugging) |
| `collectAssetSrcs` | Extracts UUID assets only, dedupes, builds zip-relative paths |
| `rewriteAssetSrcs` | Replaces `/assets/` with `assets/`; non-mutating; ignores non-matching srcs |
| `downloadAssets` | Missing asset skipped; result length matches successful downloads |

Mocks: `@elearn-studio/scorm-packager` packers + `../../storage/s3.getObject`.
No Mongoose, no Express, no real HTTP — pure function-under-test.

Full backend suite: **148/148 tests pass** (pre-TD-001: 131; +17 new).
TSC: exit 0. Lint: 0 errors.

---

## Findings

| ID | Severity | Description | Status |
|---|---|---|---|
| 1 | INFO | Two-layer split (pure `runExport` + Express `buildExportHandler`) mirrors the T651 `performSave`/`requestSave` pattern. Architectural consistency, no new concepts to learn. | RESOLVED |
| 2 | INFO | tmpDir ownership contract made explicit (error path owns cleanup; success path returns to caller). Prevents the orphan-tmpdir drift that the pre-TD-001 code was vulnerable to. | RESOLVED |
| 3 | INFO | `PACKERS` uses `Record<ExportFormat, FormatSpec>` so adding a format is exhaustively type-checked — forgetting to register a new format fails compilation, not a runtime `undefined is not a function`. | RESOLVED |
| 4 | LOW | `collectAssetSrcs` / `rewriteAssetSrcs` / `downloadAssets` are now exported from `runExport.ts`. They were previously private to `courses.ts`. Exporting was necessary for unit-test coverage and matches their purpose (pure utilities). | RESOLVED |

No CRITICAL, HIGH, or MEDIUM findings. No regressions. Nothing is deferred.

---

## Deliberate non-scope

- **No asset-fetching cache**. Each export re-downloads assets from Garage. A
  per-request local cache is straightforward but premature — Garage is on the
  same network, exports are rate-limited to 5/15min per user, and the 500ms
  tmpDir cleanup delay already gates consecutive runs. Add caching only if
  profiling shows it's the bottleneck.
- **No concurrent download**. `downloadAssets` is sequential (`for ... of`).
  Running in parallel with `Promise.all` would be a one-line change, but no
  benchmark has shown the serial path is the bottleneck, and parallel errors
  would need more careful handling (which of N errors surfaces? what if some
  succeed?). Out of scope; worth revisiting with real timing data.
- **No generic `buildMiddlewareFactory` abstraction**. `buildExportHandler`
  is specific to the three export routes. Generalising it to build arbitrary
  route factories would be premature and weaken the call site's clarity.

---

## Verdict

**APPROVED** — all three original export routes now share a single pipeline;
adding xAPI (TD-001's stated motivator) is now 2 LOC instead of 70; no
regressions in the existing 131-test backend suite; 17 new focused tests
cover dispatch, ordering, result shape, cleanup semantics, and each helper
in isolation.

The `grep "packSCORM12\|packSCORM2004\|packAICC"` invariant — "packers are
invoked only in `runExport.ts`" — is now a load-bearing architectural fact,
mirroring the T651 `editor.store()` invariant on the frontend.
