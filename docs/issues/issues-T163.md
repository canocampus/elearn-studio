# Issues — T163: Client Error Reporter

## Summary

T163 implements a client-side error capture system that throttles unhandled JS errors and promise rejections (max 10 events per 60s window) and forwards them to a protected backend endpoint for logging. The implementation is largely sound with good test coverage, but several issues around error handling, validation, and documentation should be addressed before production deployment.

## Issues

### [HIGH] HI-001 — Missing validation of context parameter ✅ RESOLVED
**File:** `packages/authoring-ui/src/lib/errorReporter.ts:86`

**Description:**
The `captureError()` function accepts an optional `context` parameter of type `Record<string, unknown>` without any validation. This allows arbitrarily large or deeply nested objects to be captured and sent to the backend. An attacker or bug could cause a large context object (e.g., serialized DOM trees, large data structures) to be included, inflating the payload size.

**Resolution:** Added `sanitizeContext()` helper that caps context at 1 KB (serialized). Context exceeding the limit is replaced with `{ _truncated: true, _originalSize: N }`. Circular references are caught and replaced with `{ _serializationError: true }`. Applied in `captureError()`.

---

### [HIGH] HI-002 — Incomplete error handling in send() function ✅ RESOLVED
**File:** `packages/authoring-ui/src/lib/errorReporter.ts:67-76`

**Description:**
The `send()` function catches all errors and only logs to `console.error()`. HTTP 4xx/5xx responses from `apiFetch` (which returns a `Response`, never throws for HTTP errors) were silently swallowed.

**Resolution:** Added `res.ok` check after `apiFetch`: non-OK responses are now logged as `[errorReporter] Server rejected error report: HTTP <status>`. Network errors (thrown by `apiFetch`) continue to be caught and logged. Retry logic intentionally omitted per module design (fire-and-forget).

---

### [MEDIUM] ME-001 — No backend rate limiting per user ✅ RESOLVED
**File:** `backend/api/src/routes/telemetry.ts:28-43`

**Description:**
The endpoint validates and logs errors but applies no per-user rate limiting. The client enforces throttling (max 10 events per 60s), but a malicious client or bug in the throttle logic could bypass this and flood the backend. A single user repeatedly hitting the endpoint could degrade service for other users.

**Fix applied:** Added `clientErrorLimiter` using `express-rate-limit` with
`keyGenerator: (req) => req.user?.sub ?? req.ip ?? 'anonymous'` and a limit
of 30 requests per minute per user. Applied as middleware on the
`POST /client-errors` route. Returns 429 when exceeded.

---

### [MEDIUM] ME-002 — Missing max payload size validation ✅ RESOLVED
**File:** `backend/api/src/routes/telemetry.ts:25`

**Description:**
The Zod schema validated individual field sizes but left `context` unbounded.

**Resolution:** Added `.refine()` on the `context` field: `JSON.stringify(ctx).length <= 1024`. Returns 400 "context must not exceed 1 KB when serialized" for oversized payloads.

---

### [MEDIUM] ME-003 — No documentation of auth requirement ✅ RESOLVED
**File:** `backend/api/src/routes/telemetry.ts:1-9`

**Description:**
The JSDoc comment stated "Requires JWT auth" without clarifying the mechanism.

**Resolution:** Updated file header JSDoc to state: "Requires Bearer token in Authorization header (enforced by the global requireAuth middleware mounted in app.ts before this router)."

---

### [MEDIUM] ME-004 — Missing context size validation on client ✅ RESOLVED
**File:** `packages/authoring-ui/src/lib/errorReporter.ts:84-106`

**Description:**
Fixed as part of HI-001 resolution. `sanitizeContext()` caps context at 1 KB before it is included in any payload.

---

### [LOW] LO-001 — buildVersion mutation in _resetForTesting() ✅ RESOLVED
**File:** `packages/authoring-ui/src/lib/errorReporter.ts`

**Description:**
`_resetForTesting()` re-read `VITE_BUILD_VERSION` without explanation.

**Resolution:** Added inline comments explaining the abort call removes all signal-bound listeners and the env var re-read allows tests that stub `VITE_BUILD_VERSION` to see updated values.

---

### [LOW] LO-002 — No telemetry endpoint for debugging
**File:** `backend/api/src/routes/telemetry.ts`

**Description:**
No GET endpoint for integration testing / developer verification. Deferred — out of scope for T163.

**Disposition:** Tracked as T170.10 — dev-only `GET /telemetry/ping` (gated by `NODE_ENV !== 'production'`), to be implemented when the observability stack is set up.

---

### [NITPICK] NI-001 — Missing JSDoc for public captureError function ✅ RESOLVED
**File:** `packages/authoring-ui/src/lib/errorReporter.ts`

**Description:**
Exported `captureError()` had minimal JSDoc without context param documentation.

**Resolution:** Expanded JSDoc with `@param error` and `@param context` tags documenting the 1 KB cap and truncation behaviour.

---

## Review Summary

| Severity | Count | Resolved | Deferred |
|----------|-------|----------|---------|
| CRITICAL | 0     | —        | —       |
| HIGH     | 2     | 2        | 0       |
| MEDIUM   | 4     | 3        | 1 (ME-001 → T166) |
| LOW      | 2     | 1        | 1 (LO-002 — out of scope) |
| NITPICK  | 1     | 1        | 0       |

Verdict: PASS — All actionable issues resolved. LO-002 (debug GET endpoint) out of scope.

---

## Passing Checks

- Auth middleware is correctly applied (global requireAuth before telemetry router mounting)
- Payload validation schema is comprehensive (required fields, length limits, type checks)
- Throttling logic is sound (10 events per 60s sliding window with correct window pruning)
- Test coverage is good (captureError, throttle, initErrorReporter, auth, validation, logging)
- Error boundary integration is correct (componentDidCatch → captureError)
- No hardcoded secrets or credentials found
- No SQL injection or XSS vulnerabilities
- Proper use of async/await and Promise handling with fire-and-forget pattern
