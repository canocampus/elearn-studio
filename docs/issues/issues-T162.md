# issues-T162 — Structured Logging (Pino + OpenTelemetry)

**Reviewed:** 2026-03-23
**Reviewer:** code-reviewer agent
**Status:** All HIGH issues resolved; MEDIUM/LOW tracked below

---

## CRITICAL — None

---

## HIGH (resolved)

### T162-H1 — Sensitive headers logged in plaintext by pino-http

**File:** `backend/api/src/app.ts`
**Issue:** pino-http 11 logs full request headers by default, including
`authorization`, `x-api-key`, and `cookie`. API keys and Bearer tokens
were being written to stdout/log files in plaintext.

**Fix applied:** Added custom `req` serializer to `pinoHttp()` that deletes
`authorization`, `x-api-key`, and `cookie` before logging. Uses
`pinoHttp.stdSerializers.req` as the base so all other standard fields
are preserved.

---

### T162-H2 — OTel SDK not shut down on SIGTERM/SIGINT

**File:** `backend/api/src/index.ts`
**Issue:** `startTracing()` was called at startup but `stopTracing()` was
never called on process termination. Pending spans were dropped on shutdown,
causing observability data loss and potential pod restart timeouts in
Kubernetes (containers waiting for the process to exit cleanly).

**Fix applied:** `server.close()` callback now calls `await stopTracing()`
and `await mongoose.disconnect()` before `process.exit(0)`. Registered on
both `SIGTERM` (Docker/Kubernetes) and `SIGINT` (Ctrl-C in dev).

---

### T162-H3 — Test env var contamination between test files

**File:** `backend/api/src/__tests__/logging.test.ts`
**Issue:** `process.env.LOG_LEVEL = originalLevel` where `originalLevel`
is `undefined` converts to the string `"undefined"` in Node.js. With
`singleFork: true`, all test files share one process but get isolated module
registries, so each file re-evaluates `logger.ts`. Subsequent files would
create a pino instance with `level: "undefined"` and crash.

**Fix applied (prior to this review):**
- `isDev` in `logger.ts` now excludes `NODE_ENV === 'test'` so pino-pretty
  transport is never loaded in tests.
- Cleanup in the `LOG_LEVEL` test now uses `delete process.env.LOG_LEVEL`
  instead of assigning `undefined`.

---

## MEDIUM (resolved)

### T162-M1 — LOG_LEVEL not validated at startup

**File:** `backend/api/src/config.ts`
**Issue:** `LOG_LEVEL` was passed directly to pino without validation.
Typos like `LOG_LEVEL=debu` silently used pino's default level.

**Fix applied:** `validateEnv()` now checks `LOG_LEVEL` against pino's
supported levels (`trace`, `debug`, `info`, `warn`, `error`, `fatal`,
`silent`) and calls `process.exit(1)` with a clear message if invalid.

---

## MEDIUM (acknowledged, not fixed)

### T162-M2 — OTel exporter has no timeout ✅ RESOLVED

**File:** `backend/api/src/lib/tracing.ts`
**Issue:** `OTLPTraceExporter` is created without `timeoutMillis`. If the
collector is unreachable, trace export could hang the event loop.

**Fix applied:** Added `timeoutMillis: 5_000` to the `OTLPTraceExporter`
constructor so export calls time out after 5 seconds, capping the maximum
delay to the event loop in the event the OTel Collector is unreachable.

---

### T162-M3 — Missing HTTP context in global error handler ✅ RESOLVED

**File:** `backend/api/src/app.ts`
**Issue:** Error handler logs `err` and `traceId` but not `method` or `path`,
making it harder to correlate with pino-http request logs.

**Fix applied:** Added `method: req.method, path: req.path` to the
`logger.error()` call in the global error handler so error log entries
include the request context needed for correlation.

---

## LOW (acknowledged)

### T162-L1 — `startTracing()` is synchronous (fire-and-forget)
Deferred. OTel SDK init is fast in practice and the current void return
matches the existing pattern. Will revisit if instrumentation gaps appear.

### T162-L2 — pino-http doesn't assign custom log levels per status code
Deferred to T170. Default `info` for all requests is acceptable for now.

### T162-L3 — auth.ts TODO comment lacks issue reference ✅ CLOSED
T171 (JWT auth) replaced the stub middleware entirely. The TODO no longer exists in `auth.ts`.
