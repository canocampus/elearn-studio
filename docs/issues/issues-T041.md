# Issues — T041 SCORM 2004

**Date:** 2026-03-24
**Reviewer:** Claude Code
**Files Reviewed:**
- packages/scorm-packager/src/index.ts
- packages/runtime-player/src/index.ts (ScormAdapter)
- packages/runtime-player/src/__tests__/scorm2004.test.ts
- packages/scorm-packager/src/__tests__/scorm2004.test.ts

---

## Summary

SCORM 2004 support was implemented in two packages:
- **scorm-packager**: generates `imsmanifest.xml` with correct SCORM 2004 namespaces, `adlcp:completionThreshold`, linear sequencing, and NCName-safe identifiers
- **runtime-player**: `ScormAdapter` normalises SCORM 1.2 and 2004 API surface (Initialize/Terminate, cmi.core.* → cmi.*)

All HIGH, MEDIUM and LOW issues have been resolved.

---

## Issues Found

### [HIGH — RESOLVED] T041-H001: Unused `xmlns:adlseq` namespace

**File:** packages/scorm-packager/src/index.ts

**Issue:** `xmlns:adlseq` declared but never used; SCORM 2004 uses `imsss:` for sequencing.

**Fix:** Removed `xmlns:adlseq` and associated schema location entry from manifest root.

---

### [HIGH — RESOLVED] T041-H002: Missing `success_status` edge-case tests

**File:** packages/runtime-player/src/__tests__/scorm2004.test.ts

**Issue:** Tests verified the field was written but not its semantic values per spec.

**Fix:** Added three targeted tests:
- `success_status = 'unknown'` when `completion_status = 'incomplete'`
- `success_status = 'passed'` when completed AND score >= passMark
- `success_status = 'failed'` when completed AND score < passMark

---

### [MEDIUM — RESOLVED] T041-M001: `cmi.score.max` hardcoded without explanation

**File:** packages/runtime-player/src/index.ts:458

**Issue:** Always writes `cmi.score.max = '100'` with no clarifying comment; maintainers might "fix" it incorrectly.

**Fix:** Added inline comment: `// always 100 per SCORM 2004 spec; mastery threshold is set via adlcp:completionThreshold in the manifest`

---

### [MEDIUM — RESOLVED] T041-M002: `completionThreshold` fallback not tested

**File:** packages/scorm-packager/src/__tests__/scorm2004.test.ts

**Issue:** Parametrised test covered [100, 75, 50, 0] but not the undefined → 0.80 fallback.

**Fix:** Added test: `'defaults completionThreshold to 0.80 when masteryScore and passingScore are both undefined'`

---

### [MEDIUM — RESOLVED] T041-M003: Identifier not sanitized to XML NCName

**File:** packages/scorm-packager/src/index.ts

**Issue:** Course identifier used directly in XML attributes without validation; invalid NCName characters could produce malformed XML.

**Fix:** Added `toNCName()` helper that replaces invalid characters with `_` and ensures the string starts with a letter or `_`. Applied to all manifest `identifier` attributes.

---

### [MEDIUM — RESOLVED] T041-M004: `index.html` contents not verified in packager tests

**File:** packages/scorm-packager/src/__tests__/scorm2004.test.ts

**Issue:** Test only verified `index.html` exists in ZIP; did not check course JSON embedding or `player.js` reference.

**Fix:** Added test verifying `index.html` contains escaped course JSON, `ELearnPlayer.init` call, and `player.js` script tag.

---

### [LOW — RESOLVED] T041-L001: Stale adlseq schema location reference

**File:** packages/scorm-packager/src/index.ts

**Issue:** `xsi:schemaLocation` referenced adlseq XSD alongside the removed namespace.

**Fix:** Removed adlseq XSD entry from `xsi:schemaLocation` when `xmlns:adlseq` was removed (T041-H001 fix).

---

### [LOW — RESOLVED] T041-L002: Missing identifier requirements documentation

**File:** packages/scorm-packager/src/index.ts

**Issue:** No comment explaining XML NCName rules or LMS uniqueness requirements for identifiers.

**Fix:** Added JSDoc on `toNCName()` explaining NCName rules and uniqueness constraint.

---

### [LOW — RESOLVED] T041-L003: Test descriptions lack CMI field semantics

**File:** packages/runtime-player/src/__tests__/scorm2004.test.ts

**Issue:** Test names described what fields are written but not semantic differences vs SCORM 1.2.

**Fix:** Added inline comments in test blocks explaining SCORM 2004 CMI field semantics and differences from SCORM 1.2.

---

## Review Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0     | pass   |
| HIGH     | 2     | resolved ✅ |
| MEDIUM   | 4     | resolved ✅ |
| LOW      | 3     | resolved ✅ |

---

## Verdict

**PASS** — All issues resolved:

1. ✅ `xmlns:adlseq` unused namespace removed; schema location cleaned up
2. ✅ `success_status` edge-case tests added (unknown / passed / failed)
3. ✅ `toNCName()` sanitizes identifiers to valid XML NCName characters
4. ✅ `completionThreshold` fallback (undefined → 0.80) covered by test
5. ✅ `index.html` contents verified in packager test (JSON embedding + player.js ref)
6. ✅ `cmi.score.max = '100'` documented with clarifying comment
