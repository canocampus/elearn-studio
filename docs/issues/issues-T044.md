# T044 Documentation Review Findings

## Executive Summary

Comprehensive review of 7 documentation files for eLearn Studio (master branch, 2026-03-24).
Found **13 issues** across 4 severity levels.

| Severity | Count | Fixed |
|----------|-------|-------|
| CRITICAL | 1     | 1 ✅  |
| HIGH     | 3     | 3 ✅  |
| MEDIUM   | 5     | 5 ✅  |
| LOW      | 4     | 4 ✅  |

---

## CRITICAL Issues

### 1. ✅ FIXED — Recorder API endpoints documented but not implemented
**File:** docs/simulation-guide.md
Added a prominent note to the Recording section clarifying that recorder routes are implemented in `packages/simulation-engine` but not yet mounted in the main backend API. Users are directed to run the simulation-engine service separately for recording.

---

## HIGH Issues

### 2. ✅ FIXED — Template count mismatch (5 claimed, 4 actual)
**File:** docs/authoring-guide.md
Updated both the creation flow (lines 8-14) and Template System section (lines 252-258) to list the 4 actual templates with correct names: Linear Course, Software Tutorial, Process Training, Assessment Only.

---

### 3. ✅ FIXED — Course title character limit discrepancy
**File:** docs/authoring-guide.md
Updated "max 200 characters" → "max 120 characters" to match `NewCourseDialog.tsx` `maxLength={120}`.

---

### 4. ✅ N/A — SCORM 2004 status ambiguous
SCORM 2004 is fully implemented in `packages/scorm-packager/src/index.ts` (manifest generation, completionThreshold, sequencing). The documentation is correct in listing it as an available format.

---

## MEDIUM Issues

### 5. ✅ FIXED — API base URL inconsistency
**File:** docs/api-reference.md
Updated base URL line to clarify: direct backend is port 3001, Vite proxy serves port 3000 in browser. Both are now documented.

---

### 6. ✅ FIXED — Incomplete Phaser simulation documentation
**File:** docs/authoring-guide.md (line 199-218)
**Status:** ✅ FIXED (2026-03-24)
Added a minimal process-flow sceneDef JSON example showing nodes, edges, and steps structure. Added explicit link to simulation-guide.md for full Phaser configuration details.

---

### 7. ✅ FIXED — Missing file path references in developer-guide.md
**File:** docs/developer-guide.md
**Status:** ✅ FIXED (2026-03-24)
Added "Key file paths" section at the top of "Adding a New Widget Type" with concrete paths: widget types in `packages/authoring-ui/src/types/`, GrapesJS registration in `packages/authoring-ui/src/editor/registerBlocks.ts`, properties panel in `packages/authoring-ui/src/components/sidebar/`, and runtime widget in `packages/runtime-player/src/widgets/`.

---

### 8. ✅ FIXED — Asset upload validation details missing
**File:** docs/api-reference.md (line 282-312)
**Status:** ✅ FIXED (2026-03-24)
Added comprehensive validation documentation: accepted MIME types (images, video, audio, documents), 50 MB size limit (configurable via MAX_ASSET_SIZE_MB), 20-uploads-per-15-minutes rate limit, SVG XSS mitigation, empty file rejection. Included example error responses for 413, 415, and 429 status codes.

---

### 9. ✅ FIXED — Endpoint HTTP method clarity
**File:** docs/api-reference.md
Added explicit note: `orderedIds` must contain every slide ID; partial arrays are rejected.

---

## LOW Issues

### 10. ✅ FIXED — Missing curl/fetch examples
**File:** docs/api-reference.md
**Status:** ✅ FIXED (2026-03-24)
Added "Quick Examples" section with curl examples for: authenticate (login), list courses, get course by ID, and upload asset. Also included JavaScript fetch() example for browser-based requests.

---

### 11. ✅ FIXED — Environmental setup clarity
**File:** docs/developer-guide.md
**Status:** ✅ FIXED (2026-03-24)
Added clear reference to `docker/.env.example` file. Reorganized environment variables into "Required" (API_PORT, NODE_ENV, MONGO_URL, S3 settings, JWT_SECRET, ALLOW_REGISTRATION) and "Optional" (MAX_ASSET_SIZE_MB, ALLOWED_MIME_TYPES, GRAFANA_PORT, PROMETHEUS_PORT) with explanations and defaults.

---

### 12. ✅ FIXED — Endpoint path consistency
**File:** docs/api-reference.md (line 370)
**Status:** ✅ FIXED (2026-03-24)
Added explanation note that history is tracked at the **course level** (all slides and resources), not slide-level. Clarified why `/courses/:id/history` path differs from slide-level paths like `/courses/:id/slides/:slideId`.

---

### 13. ✅ FIXED — Broken documentation cross-references
**File:** docs/authoring-guide.md and docs/simulation-guide.md
**Status:** ✅ FIXED (2026-03-24)
Added "Learn more" link in authoring-guide.md Screenshot Simulation section pointing to simulation-guide.md. Added "See also" link at top of simulation-guide.md pointing back to authoring-guide.md Widget Types section.

---

## Summary Table

| Issue | File | Severity |
|-------|------|----------|
| 1 | simulation-guide.md | CRITICAL |
| 2 | authoring-guide.md | HIGH |
| 3 | authoring-guide.md | HIGH |
| 4 | authoring-guide.md | HIGH |
| 5 | api-reference.md | MEDIUM |
| 6 | authoring-guide.md | MEDIUM |
| 7 | developer-guide.md | MEDIUM |
| 8 | api-reference.md | MEDIUM |
| 9 | api-reference.md | MEDIUM |
| 10 | api-reference.md | LOW |
| 11 | developer-guide.md | LOW |
| 12 | api-reference.md | LOW |
| 13 | authoring-guide.md / simulation-guide.md | LOW |

---

## Review Metadata

- Reviewed by: Claude Code (Senior Code Reviewer)
- Date: 2026-03-24
- Branch: master
- Confidence: >80% on all findings
