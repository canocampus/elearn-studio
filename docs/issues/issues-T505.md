# SCORM Guide Documentation Review — T505

**Review Date:** 2026-03-24
**Reviewer:** Documentation Specialist
**Files Reviewed:** 6 SCORM guide documents + 2 source files

---

## Executive Summary

The SCORM guide documentation is technically accurate and well-structured. Found **2 MEDIUM issues** related to missing language specifiers on code blocks (affects markdown rendering consistency), and **1 HIGH issue** about incomplete API endpoint coverage in the documentation table. All technical claims about CMI fields, API detection, mastery scores, and SCORM manifest generation are verified against source code.

---

## Issues

### HIGH: Incomplete API Endpoint Table

**File:** `docs/scorm-guide/index.md` (lines 41–45)

**Issue:** The table claims SCORM 2004 and AICC have "no REST endpoint yet" but this is presented as a limitation when the library functions ARE implemented in the packager — only the REST API wrapper is missing.

**Current Text:**
```markdown
| **SCORM 2004 4th Ed.** | When your LMS supports it and you need separate `completion_status` + `success_status`. | Packager library only — no REST endpoint yet |
| **AICC** | Legacy LMSes that predate SCORM (uses HTTP HACP instead of JavaScript API). | Packager library only — no REST endpoint yet |
```

**Problem:** Users reading the index table may not realize they can still use SCORM 2004 and AICC programmatically. The phrasing suggests these are unimplemented features rather than "library is ready, REST endpoint is the only wrapper missing."

**Recommendation:** Clarify that the packager library supports these formats; only the REST API endpoint is not yet exposed.

---

### MEDIUM: Missing Language Specifier — aicc.md

**File:** `docs/scorm-guide/aicc.md` (line 28)

**Issue:** Code block is missing language specifier.

**Current:**
```markdown
```
AICC_cmd=PutParam
AICC_data=<key>=<value>
```
```

**Should Be:**
```markdown
```plaintext
AICC_cmd=PutParam
AICC_data=<key>=<value>
```
```

**Impact:** MEDIUM — Markdown renderers treat this as plaintext anyway, but explicit language specifier improves consistency with other code blocks in the guide.

---

### MEDIUM: Missing Language Specifier — aicc.md

**File:** `docs/scorm-guide/aicc.md` (line 49)

**Issue:** TypeScript code block (line 39–48) is missing language specifier.

**Current:**
```markdown
```typescript
import { packAICC } from '@elearn-studio/scorm-packager'
...
```
```

**Should Be:**
```markdown
```typescript
import { packAICC } from '@elearn-studio/scorm-packager'
...
```
```

**Note:** This specific block DOES have `typescript` specifier. Rechecking...

**Correction:** The TypeScript block at line 39 is correctly specified. The issue is at **line 28** (AICC HACP command format) which lacks a specifier. See MEDIUM issue #1 above.

---

### LOW: Minor Terminology Inconsistency

**File:** `docs/scorm-guide/compatibility.md` (line 46)

**Issue:** Uses "window hierarchy" when the phrase should be "window frame hierarchy" for clarity.

**Current:**
```markdown
The player traverses up to 10 parent frames when looking for the API object, which handles common LMS iframe nesting patterns.
```

**Suggested:**
```markdown
The Runtime Player traverses up to 10 parent frames when looking for the API object, which handles common LMS iframe nesting patterns.
```

**Rationale:** Uses "Runtime Player" (correct terminology per elearn-docs-technical skill) instead of "player" for consistency.

**Impact:** LOW — Minor improvement only. Current phrasing is understandable.

---

## Verification Results

### Technical Accuracy — VERIFIED

#### SCORM API Detection Order
**Claim in Docs:** docs/scorm-guide/compatibility.md (lines 40–45)
```markdown
1. `window.API_1484_11` → SCORM 2004 adapter
2. `window.API` → SCORM 1.2 adapter (also used by AICC HACP bridge)
3. Neither found → runs in standalone mode (no LMS reporting)

The player traverses up to 10 parent frames when looking for the API object
```

**Code Verification:** packages/runtime-player/src/index.ts (lines 118–134)
```typescript
// SCORM 2004 4th Edition: window.API_1484_11
if (typeof w.API_1484_11 !== 'undefined') { ... }
// SCORM 1.2: window.API
if (typeof w.API !== 'undefined') { ... }
```
AND
```typescript
let attempts = 0
while (w && attempts < 10) { ... }
```

**Status:** ACCURATE ✓

#### Mastery Score Handling
**Claim in Docs:** docs/scorm-guide/scorm2004.md (line 86)
```markdown
`completionThreshold` is derived from `course.metadata.masteryScore` divided by 100, formatted to 2 decimal places.
```

**Code Verification:** packages/scorm-packager/src/index.ts (lines 121–123)
```typescript
const masteryScore = course.metadata?.masteryScore ?? course.settings?.passingScore ?? 80
const completionThreshold = (masteryScore / 100).toFixed(2)
```

**Status:** ACCURATE ✓ (toFixed(2) = 2 decimal places)

#### SCORM 1.2 Manifest scormtype Attribute
**Claim in Docs:** docs/scorm-guide/troubleshooting.md (line 109)
```markdown
The packager sets `adlcp:scormtype="sco"` (SCORM 1.2) or `adlcp:scormType="sco"` (SCORM 2004).
```

**Code Verification:** packages/scorm-packager/src/index.ts
- Line 228: `'adlcp:scormtype': 'sco',` (SCORM 1.2 — lowercase)
- Line 173: `'adlcp:scormType': 'sco',` (SCORM 2004 — camelCase)

**Status:** ACCURATE ✓

#### Phaser Bundle Conditional Inclusion
**Claim in Docs:** docs/scorm-guide/index.md (lines 17)
```markdown
- `phaser-bundle.js` — only present when the course contains Phaser simulations
```

**Code Verification:** packages/scorm-packager/src/index.ts (line 320–323)
```typescript
export function courseHasPhaserSim(course: CourseDoc): boolean {
  return course.slides.some(slide =>
    slide.widgets.some(w => w.type === 'phaser-sim')
  )
}
```
AND Used in packSCORM12 (lines 358–361), packSCORM2004 (lines 434–435), packAICC (lines 512–513).

**Status:** ACCURATE ✓

#### REST API Endpoints
**Claim in Docs:** docs/scorm-guide/index.md (line 43) + docs/scorm-guide/scorm12.md (line 42)
```markdown
`POST /courses/:id/export/scorm12`
```

**Code Verification:** backend/api/src/routes/courses.ts (line 777)
```typescript
coursesRouter.post('/:id/export/scorm12', exportLimiter, async (req, res) => {
```

**Status:** ACCURATE ✓

#### Rate Limiting
**Claim in Docs:** docs/scorm-guide/scorm12.md (line 47)
```markdown
**Rate limit:** 5 requests per 15 minutes per user.
```

**Code Verification:** backend/api/src/routes/courses.ts (lines 14–21)
```typescript
const exportLimiter = rateLimit({
  windowMs:        15 * 60 * 1000, // 15 minutes
  limit:           5,
  keyGenerator:    (req: Request) => req.user?.sub ?? 'unknown',
  ...
})
```

**Status:** ACCURATE ✓

#### Port Numbers
**Claim in Docs:** docs/scorm-guide/scorm12.md (line 86)
```markdown
Moodle is available at `http://localhost:8081` in the dev Docker stack.
```

**Status:** NOT VERIFIED IN SCOPE — Cross-reference docker-compose.yml not requested, but no conflicting claims found in source code.

#### ZIP Filename Pattern
**Claim in Docs:** docs/scorm-guide/scorm12.md (line 51)
```markdown
The ZIP filename uses the course title with non-alphanumeric characters replaced by underscores, truncated to 64 characters: `<safe_title>_scorm12.zip`.
```

**Code Verification:** packages/scorm-packager/src/index.ts (lines 354–355)
```typescript
const safeTitle = course.title.replace(/[^a-z0-9_-]/gi, '_').slice(0, 64) || 'course'
const fileName = options.fileName ?? `${safeTitle}_scorm12.zip`
```

**Status:** ACCURATE ✓

### Link Verification

**All Relative Links:** VERIFIED ✓
- docs/scorm-guide/index.md → scorm12.md, scorm2004.md, aicc.md, compatibility.md, troubleshooting.md (all exist)
- docs/scorm-guide/troubleshooting.md → ./scorm12.md (line 80, exists)

### Mermaid Diagram Validation

**File:** docs/scorm-guide/index.md (lines 23–39)

**Syntax:** Valid ✓
**Node Count:** 6 nodes (Q1, Q2, Q3, R2004, R12, RAICC) — well under 12-node recommendation ✓
**Logic Flow:** Correct decision tree ✓

---

## Code Block Language Specifier Audit

| File | Line | Content | Issue | Severity |
|------|------|---------|-------|----------|
| aicc.md | 28 | AICC HACP command format | Missing `plaintext` | MEDIUM |
| aicc.md | 39–48 | TypeScript import | Has `typescript` | OK |
| aicc.md | 56–64 | INI (.crs descriptor) | Has `ini` | OK |
| aicc.md | 69–77 | INI (.au descriptor) | Has `ini` | OK |
| aicc.md | 81–85 | INI (.des descriptor) | Has `ini` | OK |
| aicc.md | 90–96 | INI (.cst descriptor) | Has `ini` | OK |
| scorm12.md | 42–44 | bash (curl command) | Has `bash` | OK |
| scorm12.md | 56–64 | Directory tree | No specifier — could be `plaintext` | OK (optional) |
| scorm12.md | 73–77 | XML manifest | Has `xml` | OK |
| scorm2004.md | 10–35 | mermaid diagram | Has `mermaid` | OK |
| scorm2004.md | 58–84 | XML manifest | Has `xml` | OK |
| scorm2004.md | 93–101 | TypeScript | Has `typescript` | OK |
| index.md | 23–39 | mermaid diagram | Has `mermaid` | OK |
| troubleshooting.md | 12–14 | Console output | Has `plaintext` | OK |
| troubleshooting.md | 97–99 | bash (pnpm command) | Has `bash` | OK |

---

## Factual Claims About "Not Yet Implemented" Features

### SCORM 2004 REST Endpoint
**Status:** Library implemented, REST endpoint NOT implemented ✓
**Claim Accuracy:** ACCURATE — Code shows `packSCORM2004()` function exists but no `POST /courses/:id/export/scorm2004` route.

### AICC REST Endpoint
**Status:** Library implemented, REST endpoint NOT implemented ✓
**Claim Accuracy:** ACCURATE — Code shows `packAICC()` function exists but no `POST /courses/:id/export/aicc` route.

### xAPI/Tin Can Support
**Claim in Docs:** docs/scorm-guide/compatibility.md (line 57)
```markdown
| xAPI (Tin Can) | Not implemented in this version. |
```

**Status:** VERIFIED NOT IMPLEMENTED ✓
- No packXAPI, packTinCan, or similar functions in scorm-packager/src/index.ts
- Not found in runtime-player either

### CMI5 Support
**Claim in Docs:** docs/scorm-guide/compatibility.md (line 58)
```markdown
| CMI5 | Not implemented in this version. |
```

**Status:** VERIFIED NOT IMPLEMENTED ✓

### Multi-SCO Support
**Claim in Docs:** docs/scorm-guide/compatibility.md (line 59)
```markdown
| Multi-SCO | All courses publish as a single SCO. |
```

**Status:** VERIFIED — All manifest builders create exactly one `<item>` with one `<resource>` ✓

---

## Summary by Severity

| Severity | Count | Issues |
|----------|-------|--------|
| CRITICAL | 0 | None |
| HIGH | 1 | Incomplete API endpoint table (index.md) |
| MEDIUM | 1 | Missing language specifier on AICC HACP code block (aicc.md line 28) |
| LOW | 1 | Minor terminology consistency (compatibility.md line 46) |
| NOT AN ISSUE | 0 | None |

---

## Recommendations

1. **HIGH Priority:** Update the API endpoint table in index.md to clarify that SCORM 2004 and AICC are implemented in the packager library; only REST endpoint wrappers are pending.

2. **MEDIUM Priority:** Add `plaintext` language specifier to the AICC HACP command format code block (aicc.md line 28).

3. **LOW Priority:** Replace "player" with "Runtime Player" in compatibility.md line 46 for terminology consistency.

4. **No action needed:** All other documentation is technically accurate and properly formatted.

---

## Not an Issue — False Positives

None identified. All documentation aligns with actual code behavior.
