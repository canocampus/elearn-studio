# Phase 1.5 Backend Storage & Assets Review — T154

Review of S3 storage client, asset routes, and health check endpoints.

---

## Issues Found

### T154-001 — No access control on asset download endpoint
**Severity:** HIGH
**File:** backend/api/src/routes/assets.ts:100-138
**Description:**
The GET /assets/:objectName endpoint uses UUID + extension validation (C-01) to prevent path traversal, but does not require API key authentication. Any client can download any asset by guessing the UUID. The endpoint is publicly readable. While the UUID is 128-bit (resistant to brute force), this violates the principle of least privilege.

**Fix:**
- Apply apiKeyAuth middleware to GET /assets/:objectName route
- Alternatively, implement course-based authorization
- Document asset visibility model in design docs
- Consider adding optional signed URLs for time-limited public access

**Status:** ✅ FIXED (2026-03-22) — `apiKeyAuth` middleware applied to `GET /assets/:objectName`; requests without a valid `x-api-key` header receive 401. Dev mode (no `API_KEY` env var set) remains open for local development.

---

### T154-002 — POST /assets lacks file size pre-validation
**Severity:** MEDIUM
**File:** backend/api/src/routes/assets.ts:45-47
**Description:**
Multer is configured with fileSize: 100 MB limit, but this is only enforced after the entire request body is buffered in memory (memoryStorage). A malicious client can send a 500 MB file, causing memory exhaustion DoS.

**Fix:**
- Move to disk-based storage with streaming limits (diskStorage)
- Or: Configure express body limit to match multer fileSize
- Or: Add explicit Content-Length header check before multer processes request
- Alternatively: Use streaming/chunked upload API instead of multipart

**Status:** OPEN

---

### T154-003 — Object name generation is predictable after first upload
**Severity:** MEDIUM
**File:** backend/api/src/routes/assets.ts:76
**Description:**
Object names use randomUUID (cryptographically secure), but the full filename (UUID + extension) is returned in response. An attacker can brute-force the extension space and predict sibling files by incrementing the UUID.

**Fix:**
- Do NOT return the full objectName in response; return only a reference ID or file path prefix
- Store the mapping (reference ID to objectName) in MongoDB, not in the client
- Alternatively, use Garage bucket prefixes to organize and isolate assets

**Status:** OPEN

---

### T154-004 — SVG files served as attachment but not sanitized on upload
**Severity:** MEDIUM
**File:** backend/api/src/routes/assets.ts:25-26 (download) + upload logic
**Description:**
SVG files are correctly served as Content-Disposition: attachment to prevent stored XSS. However, the upload endpoint does NOT sanitize SVG content. An attacker can upload SVG with malicious JavaScript.

**Fix:**
- Sanitize SVG files on upload using dompurify or svg-sanitizer
- Alternatively, re-encode SVG to remove scripts via sharp/imagemagick
- Or: Use a separate subdomain for asset downloads (domain isolation)
- Test that uploaded SVG with scripts cannot execute when served

**Status:** OPEN

---

### T154-005 — No rate limiting on asset uploads
**Severity:** MEDIUM
**File:** backend/api/src/routes/assets.ts:69 (POST handler) + app.ts:21-27
**Description:**
Global rate limiting (200 requests per 15 minutes) is not granular enough for file uploads. A single request can upload 100 MB. An attacker can exhaust storage by uploading 20 GB per 15 min. Rate limiter does not track disk usage, only request count.

**Fix:**
- Add per-user/per-API-key rate limiting for asset uploads (e.g., 50 uploads per day)
- Implement storage quota per course/user (e.g., max 1 GB per course)
- Monitor Garage disk usage and reject uploads if nearing capacity
- Return 507 (Insufficient Storage) when quota exceeded

**Status:** OPEN

---

### T154-006 — Health check calls initStorage() on every request
**Severity:** MEDIUM
**File:** backend/api/src/routes/health.ts:11-16
**Description:**
The /health endpoint calls initStorage (HeadBucketCommand) on every request. This is expensive (network round-trip to Garage). High-frequency health checks will overwhelm Garage with unnecessary requests.

**Fix:**
- Cache the storage health status for N seconds (e.g., 10-30s)
- Use a background task (setInterval) to update cache periodically
- Or: Move storage check to separate /health/readiness endpoint
- Add timeout to HeadBucketCommand

**Status:** OPEN

---

### T154-007 — GARAGE_ACCESS_KEY and GARAGE_SECRET_KEY logged at startup
**Severity:** MEDIUM
**File:** backend/api/src/storage/s3.ts:96
**Description:**
Line 96 logs the bucket name and endpoint. This log is printed to stdout and stored in container logs. While this log does not include credentials, if credentials are later added for debugging, they will be captured.

**Fix:**
- Explicitly log only safe information (bucket, endpoint, region)
- Add comment/lint rule preventing credentials from being logged
- Use structured logging (winston, pino) with sensitive field masking
- Rotate credentials if they have been logged in past deployments

**Status:** OPEN

---

### T154-008 — s3Client credentials are not validated until first request
**Severity:** LOW
**File:** backend/api/src/storage/s3.ts:22-28
**Description:**
Code validates that keys are non-empty at module load time, but does not validate their format. If an invalid key format is passed, the error will only appear when the first S3 request is made, not at startup.

**Fix:**
- Add format validation for access key and secret key at startup
- Validate: accessKeyId matches Garage key format, secretAccessKey is hex/base64
- Throw error at startup if format is invalid

**Status:** OPEN

---

### T154-009 — No Content-Type validation on download
**Severity:** MEDIUM
**File:** backend/api/src/routes/assets.ts:110-115
**Description:**
When serving a downloaded file, the code uses the stored Content-Type from Garage without re-validation. If Garage metadata was corrupted, a JPEG could have Content-Type: application/pdf.

**Fix:**
- Re-validate Content-Type against file extension
- Extract extension from objectName and verify it matches the MIME type
- If mismatch, serve as attachment with application/octet-stream

**Status:** OPEN

---

### T154-010 — initStorage called during server startup, not in response handler
**Severity:** LOW
**File:** backend/api/src/storage/s3.ts:93-97 (function definition) + app.ts (no startup call)
**Description:**
The initStorage function is NOT called during Express app startup in app.ts or index.ts. The API server can start successfully even if Garage is completely unreachable. The first asset upload/download will fail.

**Fix:**
- Call await initStorage() in the app startup sequence (before listening on port 3001)
- Add explicit error logging if init fails
- Document that the API server requires Garage to be healthy at startup

**Status:** OPEN

---

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0     | -      |
| HIGH     | 1     | 1 ✅   |
| MEDIUM   | 7     | OPEN   |
| LOW      | 2     | OPEN   |

**Fixed (2026-03-22):** T154-001 — apiKeyAuth applied to GET /assets/:objectName

**Still open:**
- T154-002 — POST /assets memory-based size limit (MEDIUM — defer to streaming upload refactor)
- T154-003 — objectName returned in response (MEDIUM)
- T154-004 — SVG not sanitized on upload (MEDIUM)
- T154-005 — No per-key upload rate limiting (MEDIUM)
- T154-006 — Health check calls initStorage every request (MEDIUM)
- T154-007 — Startup log policy (MEDIUM)
- T154-008 — Key format not validated at startup (LOW)
- T154-009 — Content-Type not re-validated on download (MEDIUM)
- T154-010 — initStorage not called at startup (LOW)

**Verdict:** PARTIAL — HIGH issue resolved. MEDIUM/LOW issues remain; acceptable for Phase 1.5 with API_KEY configured in production.

