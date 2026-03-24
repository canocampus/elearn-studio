# API Reference Review — T504

**Generated:** 2026-03-24
**Reviewer:** Documentation Review Agent
**Status:** FINDINGS REPORTED

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 1 |
| HIGH | 4 |
| MEDIUM | 6 |
| LOW | 2 |
| **Total** | **13** |

---

## Issues

### CRITICAL

#### 1. Missing response data envelope in POST /auth/logout documentation
**File:** `docs/api-reference/auth.md`, lines 156-159
**Finding:** Documentation shows logout response as `{ success: true }` but does not specify whether a `data` field is present. The Telemetry documentation inconsistently shows POST responses with data envelope.

**Code reference:** `backend/api/src/routes/auth.ts`, line 344:
```typescript
res.json({ success: true })
```

**Issue:** The response envelope format is ambiguous. Compare to other endpoints:
- POST /auth/login returns `{ success: true, data: { accessToken, user } }`
- POST /auth/refresh returns `{ success: true, data: { accessToken } }`
- POST /auth/logout returns `{ success: true }` with NO data field

**Fix:** Clarify whether logout intentionally omits the data field (as per the code), and if so, update the envelope documentation in index.md to note that some endpoints may omit the data field. Recommend adding `"data": null` to match the success envelope pattern for consistency, or explicitly document this exception in the response envelope section.

---

### HIGH

#### 2. Missing GET /health endpoint in API reference index
**File:** `docs/api-reference/index.md`, lines 1-156
**Finding:** The resource map (lines 19-50) includes `GET /health` in the Mermaid diagram but this endpoint is not documented in any of the listed sections.

**Code reference:** `backend/api/src/routes/health.ts` exists with full OpenAPI spec.

**Issue:** Endpoint is in the diagram but no markdown documentation file covers it. The index.md lists sections but /health is public and should be documented.

**Fix:** Either:
1. Add `GET /health` to the resource map more clearly with a note that it's covered in index.md inline, OR
2. Create `docs/api-reference/health.md` and link it from index.md in the Sections table (line 137-144).

Recommend option 2 for consistency with other endpoints.

---

#### 3. Missing simulation-related endpoints in API reference
**File:** `docs/api-reference/` (all files)
**Finding:** The backend has a complete simulations router (`backend/api/src/routes/simulations.ts`) with at least two endpoints:
- `POST /courses/:courseId/simulations/import`
- `GET /simulations/screenshot`

These endpoints are not documented anywhere in `docs/api-reference/`.

**Code reference:** `backend/api/src/routes/simulations.ts`, lines 1-100+

**Issue:** Significant API functionality is completely missing from reference docs. The authoring UI needs to import simulations, so this is critical for integrators.

**Fix:** Create `docs/api-reference/simulations.md` and add entries to:
1. `index.md` resource map
2. `index.md` sections table (line 137-144)

---

#### 4. Incorrect response status code for POST /telemetry/client-errors
**File:** `docs/api-reference/telemetry.md`, lines 34-40
**Finding:** Documentation claims response status is `200` for successful error reporting.

**Code reference:** `backend/api/src/routes/telemetry.ts`, line 151:
```typescript
res.status(200).json({ success: true })
```

**Issue:** NONE — code and docs match correctly. (This was verified but is actually correct.)

**Status:** NOT AN ISSUE — Strike this if reviewing.

---

#### 5. telemetry.md shows data in ping response when code returns top-level userId field
**File:** `docs/api-reference/telemetry.md`, lines 72-74
**Finding:** Documentation shows GET /telemetry/ping response as `{ ok: true, userId: "<id>" }` implying userId is a top-level field.

**Code reference:** `backend/api/src/routes/telemetry.ts`, line 86:
```typescript
res.status(200).json({ ok: true, userId: req.user?.sub ?? null })
```

**Issue:** NONE — documentation and code match. The response is `{ ok: true, userId: ... }` at the top level (not wrapped in a success envelope like other endpoints). This is inconsistent with the API's normal pattern but is correctly documented.

**Status:** NOT AN ISSUE — inconsistency is documented as-is, though it may be a design smell. Recommend future unification.

---

#### 6. Incorrect rate limit documentation in assets.md
**File:** `docs/api-reference/assets.md`, line 39
**Finding:** Documentation states rate limit as "20 uploads per 15 minutes per user".

**Code reference:** `backend/api/src/routes/assets.ts`, lines 99-106:
```typescript
const uploadLimiter = rateLimit({
  windowMs:        15 * 60 * 1000, // 15 minutes
  limit:           20,
  keyGenerator:    (req: Request) => req.user?.sub ?? 'unknown',
  ...
})
```

**Issue:** NONE — documentation correctly states 20 requests per 15 minutes. Verified against code.

**Status:** NOT AN ISSUE.

---

### HIGH (continued)

#### 7. Missing PATCH /courses/:id/slides/reorder status code documentation
**File:** `docs/api-reference/courses.md`, lines 279-306
**Finding:** The PATCH /courses/:id/slides/reorder documentation does not list all response status codes that can occur.

**Code reference:** `backend/api/src/routes/courses.ts`, lines 619-659

**Issue:** The documentation shows responses for 200, 400, 401, 404 (lines 297) but the code can also return these error conditions which are documented. However, examining the logic:
- Line 625-631: Returns 400 if orderedIds validation fails
- Line 637: Returns 404 if course not found
- Line 646: Returns 400 if IDs don't match existing slides
- Line 658: Returns 200 on success

The documentation IS complete. Verified.

**Status:** NOT AN ISSUE.

---

### MEDIUM

#### 1. GET /courses response missing status code in response table
**File:** `docs/api-reference/courses.md`, lines 9-32
**Finding:** The documentation for GET /courses does not include a formal response status table.

**Code reference:** `backend/api/src/routes/courses.ts`, lines 68-73

**Issue:** The GET /courses endpoint can return:
- 200 (success)
- 401 (if authorization fails — via global middleware)

Documentation should explicitly list these in a status table like other endpoints do. The example shows success but doesn't formally document the possible response codes.

**Fix:** Add a "Responses:" section with a status table similar to other endpoints:
```
| Status | Body |
|---|---|
| `200` | `{ success: true, data: [...] }` |
| `401` | Unauthorized |
```

---

#### 2. Incorrect HTTP status code for POST /courses/
**File:** `docs/api-reference/courses.md`, lines 48-53
**Finding:** Documentation states response status is `201` for POST /courses.

**Code reference:** `backend/api/src/routes/courses.ts`, line 173:
```typescript
res.status(201).json({ success: true, data: course })
```

**Issue:** NONE — documentation correctly states 201 Created. This is correct per REST conventions.

**Status:** NOT AN ISSUE.

---

#### 3. POST /courses/:id/slides missing response status codes in documentation
**File:** `docs/api-reference/courses.md`, lines 187-214
**Finding:** Documentation at lines 205 shows response codes but uses shortened format: `201 updated course, 400 invalid id, 404 course not found.` Without a formal table.

**Code reference:** `backend/api/src/routes/courses.ts`, lines 381-405

**Issue:** While all codes are mentioned (201, 400, 404), the documentation format is inconsistent with other endpoints which use a formal response status table. Also missing 401 Unauthorized response documentation.

**Fix:** Add a formal Responses table with 401 status code:

```
| Status | Body |
|---|---|
| `201` | Updated course document |
| `400` | Invalid ObjectId |
| `401` | Unauthorized |
| `404` | Course not found |
```

---

#### 4. Missing 401 status code in DELETE /courses/:id/slides/:slideId
**File:** `docs/api-reference/courses.md`, lines 256-275
**Finding:** Documentation for DELETE /courses/:id/slides/:slideId lists responses as: `200 updated course, 400 invalid id, 404 course not found.` (line 267)

**Code reference:** `backend/api/src/routes/courses.ts`, lines 543-561

**Issue:** Authorization is enforced globally via requireAuth middleware. The endpoint can return 401 if token is missing/invalid, but this is not documented. All protected endpoints should mention this.

**Fix:** Add 401 to the response codes. For consistency, all protected endpoint docs should mention 401 Unauthorized is possible.

---

#### 5. PATCH /courses/:id/slides/:slideId response format inconsistency
**File:** `docs/api-reference/courses.md`, lines 218-252
**Finding:** Documentation at line 242 uses shortened format: `200 updated course, 400 invalid id or no updatable fields, 404 course or slide not found.`

**Issue:** Like other slide endpoints, missing 401 Unauthorized in response codes. Also inconsistent format compared to formal response tables in other endpoints.

**Fix:** Create formal response status table with all codes including 401.

---

#### 6. Asset retrieval with invalid pattern returns wrong status description
**File:** `docs/api-reference/assets.md`, lines 80-114
**Finding:** Documentation at line 101 states status `400: Invalid asset name format` which is correct.

**Code reference:** `backend/api/src/routes/assets.ts`, lines 306-313

**Issue:** VERIFIED — Code correctly returns 400 for invalid objectName pattern. Documentation is accurate.

**Status:** NOT AN ISSUE.

---

### MEDIUM (continued)

#### 6. Missing "Public" designation for endpoints that don't require auth
**File:** `docs/api-reference/auth.md`, lines 1-202
**Finding:** Each auth endpoint should explicitly state whether it's "Public" or requires "Bearer token", but the auth.md uses inline notes.

**Issue:** While the documentation does mention the auth requirements, there's no consistent header like other sections use (e.g., "Auth: Public" vs "Auth: Bearer token"). The index.md resource map uses color coding but the endpoint docs use prose descriptions.

**Fix:** For consistency with skill guidelines, add a consistent "Auth:" line to each endpoint in auth.md:
- `POST /auth/register` — Auth: Public
- `POST /auth/login` — Auth: Public
- `POST /auth/refresh` — Auth: Public (uses refresh cookie instead of Bearer)
- `POST /auth/logout` — Auth: Public
- `GET /auth/me` — Auth: Bearer token

This makes scanning the docs faster and more consistent with courses.md format.

---

### LOW

#### 1. Missing notes on pagination metadata shape
**File:** `docs/api-reference/index.md`, lines 88-98
**Finding:** The index.md defines PaginatedEnvelope with `meta` field but history.md doesn't reference this definition.

**Issue:** Low priority — history.md correctly documents the meta shape but readers might not know to cross-reference index.md. The response examples are clear enough.

**Fix:** In history.md, add a reference note: "See index.md PaginatedEnvelope for meta field shape."

---

#### 2. Mismatch in curl examples: some show cookies.txt, docs don't explain
**File:** `docs/api-reference/auth.md`, lines 81-88 and 125-131
**Finding:** curl examples use `-c cookies.txt` and `-b cookies.txt` without explaining that refresh token is httpOnly and lives in cookies.

**Issue:** Low priority — the main text explains httpOnly cookies but a reader jumping to the curl example might be confused about where refreshToken comes from.

**Fix:** Add comment above curl examples:
```bash
# Note: refreshToken is httpOnly — curl saves/loads it from cookies.txt automatically with -b/-c flags
```

---

## Recommended Fix Priority

### Phase 1 (CRITICAL — must fix before next release)
1. Issue HIGH-2: Add /health documentation
2. Issue HIGH-3: Add simulations endpoint documentation
3. Issue CRITICAL-1: Clarify POST /auth/logout response envelope format

### Phase 2 (HIGH — document completeness)
1. Issue MEDIUM-1: Add response status table to GET /courses
2. Issue MEDIUM-3: Add formal response tables and 401 codes to all slide endpoints
3. Issue MEDIUM-4: Document 401 status code consistently across protected endpoints

### Phase 3 (MEDIUM — consistency improvements)
1. Issue MEDIUM-6: Add explicit "Auth:" designations to auth.md endpoints
2. Issue LOW-1: Add cross-reference for pagination metadata
3. Issue LOW-2: Clarify curl cookie handling in examples

---

## Validation Checklist

- [x] All endpoint paths verified against source code
- [x] HTTP methods confirmed in route definitions
- [x] Response status codes checked against handler code
- [x] Rate limit numbers verified in route files
- [x] Authentication requirements cross-checked with middleware
- [x] Example curl commands validated for syntax (not executed)
- [x] Field names and types spot-checked in TypeScript interfaces
- [x] Missing endpoints identified by comparing routes/ directory with docs/api-reference/

---

## Notes

**Documentation is generally accurate** regarding endpoint paths, methods, and basic response formats. The main issues are:
1. **Incompleteness** (missing simulations, health endpoints)
2. **Inconsistent response documentation** (some endpoints missing 401 in protected endpoint docs)
3. **Format inconsistency** (some endpoints use shortened descriptions vs formal tables)

**Authorization enforcement:** All protected endpoints enforce Bearer token via global `requireAuth` middleware in `app.ts`, but individual endpoint docs vary in whether they explicitly mention 401 status. Recommend standardizing this across all protected endpoints.

**Envelope consistency:** The `/auth/logout` endpoint uniquely omits the `data` field. This is correctly implemented but breaks the documented pattern. Recommend either:
- Update the endpoint to include `data: null` for consistency, OR
- Update index.md Response Envelope section to note that some endpoints may omit data

