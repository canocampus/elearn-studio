# Issues — T152: Storage Client (S3)
> Generated: 2026-03-22
> Status: reviewed

## Summary
Review of backend/api/src/storage/s3.ts and assets routes for correct AWS SDK usage with Garage, S3Client configuration, asset upload/download handling, MIME type validation, and path traversal prevention.

## Issues Found

### CRITICAL

#### C-01 — assets route: extension validation too permissive
**File:** backend/api/src/routes/assets.ts lines 39-40

The OBJECT_NAME_RE regex allows extensions 1-10 chars: `\.[a-z0-9]{1,10}`. This is too permissive. Extensions like `.phtml`, `.shtml`, `.php3` are valid. While Garage won't execute these, serving with wrong Content-Type could allow browser execution.

**Fix:** Whitelist allowed extensions instead of character range.

**Status**: ✅ FIXED (2026-03-22) — Extension validated against `ALLOWED_MIME_TYPES` allowlist; unrecognized extensions rejected with 400

---

#### C-02 — s3.ts: secret key hardcoded as fallback default
**File:** backend/api/src/storage/s3.ts lines 20-22

Credentials fallback to `'garagegarage'` if env vars not set. This embeds the secret in source code. In git history and docker image layers. Visible to anyone reading the code.

**Impact:** CRITICAL (exposed secret)

**Fix:** Do NOT provide defaults. Fail loudly at startup if env vars not set.

**Status**: ✅ FIXED (2026-03-22) — No default fallback; process exits with clear error if `GARAGE_ACCESS_KEY_ID` or `GARAGE_SECRET_ACCESS_KEY` are unset

---

#### C-03 — s3.ts: no validation that endpoint is actually Garage
**File:** backend/api/src/storage/s3.ts lines 76-79

initStorage() calls HeadBucketCommand but doesn't validate the response or that it's actually Garage. If wrong endpoint provided, health check passes but operations fail mysteriously.

**Impact:** CRITICAL (silent misconfiguration)

**Fix:** Validate endpoint is reachable and functional. Log bucket metadata on successful check.

**Status**: ✅ FIXED (2026-03-22) — HeadBucketCommand result validated; bucket name logged on success; misconfigured endpoints now throw with descriptive error

---

### HIGH

#### H-01 — s3.ts: putObject does not validate ContentLength matches buffer size
**File:** backend/api/src/storage/s3.ts lines 32-45

Function accepts contentLength but doesn't validate it matches body.length. Mismatch could corrupt upload. Attacker could pass fake contentLength.

**Impact:** HIGH (data integrity)

**Fix:** Validate body.length === contentLength.

**Status**: ✅ FIXED (2026-03-22) — `body.length` asserted equal to `contentLength`; throws `RangeError` on mismatch before upload

---

#### H-02 — s3.ts: getObject defaults ContentLength to 0 if missing
**File:** backend/api/src/storage/s3.ts lines 54-55

If ContentLength missing, defaults to 0. Browser shows "0 bytes downloaded" even though stream has data.

**Impact:** HIGH (user experience)

**Fix:** Don't set Content-Length if missing, or use -1 to signal unknown.

**Status**: ✅ FIXED (2026-03-22) — `Content-Length` header omitted when S3 response does not include it; no misleading 0-byte value sent to client

---

#### H-03 — assets POST route: putObject errors not caught
**File:** backend/api/src/routes/assets.ts lines 75

If putObject throws (network error, Garage down), error bubbles up to Express. No graceful error handling.

**Impact:** HIGH (error handling)

**Fix:** Add try-catch, return 503 on failure.

**Status**: ✅ FIXED (2026-03-22) — `try/catch` around `putObject`; S3 errors return `503 Service Unavailable` with JSON error body

---

#### H-04 — assets GET route: all errors treated as 404
**File:** backend/api/src/routes/assets.ts lines 110-111

All errors treated as "Asset not found". But could be 403 (permission), 503 (service error), etc.

**Impact:** HIGH (error clarity)

**Fix:** Differentiate error types, return appropriate status codes.

**Status**: ✅ FIXED (2026-03-22) — S3 `NoSuchKey` → 404; `AccessDenied` → 403; other S3/network errors → 503

---

#### H-05 — s3.ts: endpoint building doesn't validate URL format
**File:** backend/api/src/storage/s3.ts lines 10-15

Host is directly interpolated into URL without validation. Could be malformed or SSRF.

**Impact:** HIGH (SSRF risk)

**Fix:** Validate host is valid hostname or IP.

**Status**: ✅ FIXED (2026-03-22) — `GARAGE_HOST` validated against allowlist of allowed hosts at startup; rejects unknown or malformed values

---

### MEDIUM

#### M-01 — assets route: SVG served inline but contains XSS vectors
**File:** backend/api/src/routes/assets.ts line 30

SVG marked safe to serve inline. But SVG can contain JavaScript (script tags, event handlers). Attacker uploads malicious SVG, JavaScript executes in browser.

**Impact:** MEDIUM (XSS)

**Fix:** Remove SVG from INLINE_MIME_TYPES, always serve as attachment. Or sanitize SVG at upload time.

**Status**: ✅ FIXED (2026-03-22) — SVG removed from `INLINE_MIME_TYPES`; served with `Content-Disposition: attachment` to prevent browser execution

---

#### M-02 — assets route: ALLOWED_MIME_TYPES is hardcoded
**File:** backend/api/src/routes/assets.ts lines 9-22

New media types require code changes. Not configurable.

**Impact:** MEDIUM (maintainability)

**Fix:** Load from env var or config file.

---

#### M-03 — health.ts: initStorage called on every health check
**File:** backend/api/src/routes/health.ts lines 11-16

HeadBucketCommand sent on every health check. Creates unnecessary load on Garage (60 req/min per instance).

**Impact:** MEDIUM (performance)

**Fix:** Cache storage status for 10 seconds.

**Status**: ✅ FIXED (2026-03-22) — Storage status cached with 10-second TTL; health check reuses cached result within window

---

#### M-04 — s3.ts: no retry logic for transient failures
**File:** backend/api/src/storage/s3.ts

If Garage temporarily unavailable, SDK fails immediately. No retry with exponential backoff.

**Impact:** MEDIUM (reliability)

**Fix:** Configure RetryStrategy in S3Client.

---

### LOW / INFO

#### L-01 — s3.ts: no logging for successful operations
Missing debug-level logging for file operations.

---

#### L-02 — assets route: randomUUID with no namespace
Hard to group or delete assets by upload batch later.

---

#### L-03 — No built-in retry logic for transient Garage failures
Consider S3Client RetryStrategy configuration.

---

## Resolution Status

| Severity | Count | Fixed | Open |
|----------|-------|-------|------|
| CRITICAL | 3     | 3 ✅  | 0    |
| HIGH     | 5     | 5 ✅  | 0    |
| MEDIUM   | 4     | 2 ✅  | 2    |
| LOW      | 3     | 0     | 3    |

**Fixed (2026-03-22):** C-01, C-02, C-03, H-01, H-02, H-03, H-04, H-05, M-01, M-03

**Still open:**
- M-02 — ALLOWED_MIME_TYPES not configurable (acceptable; code change required for new types)
- M-04 — No S3 retry strategy (defer to T160 reliability hardening)
- L-01, L-02, L-03 — Low priority enhancements

**Verdict:** ✅ PRODUCTION READY for Phase 1.5 — all CRITICAL and HIGH issues resolved.

