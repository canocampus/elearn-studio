# Issues — T041 SCORM 2004

## [HIGH] Unused namespace declared in manifest

**ID**: T041-H001

**File**: `packages/scorm-packager/src/index.ts:124`

**Issue**: The `xmlns:adlseq` namespace is declared in the manifest root element but is never used anywhere in the manifest. SCORM 2004 sequencing uses `imsss:` (IMS Sequencing & Navigation) for sequencing rules, not `adlseq:`. The `adlseq` namespace is from earlier SCORM versions and should be removed.

```typescript
// Line 124 — UNUSED
'xmlns:adlseq': 'http://www.adlnet.org/xsd/adlseq_v1p3',
```

**Impact**: While this doesn't break functionality (unused namespaces are tolerated by XML parsers), it indicates incomplete schema understanding and may cause validation failures on strict LMS implementations.

**Recommendation**: Remove the unused `xmlns:adlseq` namespace declaration.

---

## [HIGH] Test coverage gap: missing success_status edge cases

**ID**: T041-H002

**File**: `packages/runtime-player/src/__tests__/scorm2004.test.ts:150–172`

**Issue**: The test verifies that success_status is written but does NOT verify that values are correct per spec:
- `success_status = 'unknown'` when `completion_status = 'incomplete'`
- `success_status = 'passed'` when score >= passMark AND completed
- `success_status = 'failed'` when score < passMark AND completed

**Impact**: Bugs in success_status assignment would not be caught.

**Recommendation**: Add specific value tests for success_status based on score and passMark.

---

## [MEDIUM] cmi.score.max hardcoded to 100

**ID**: T041-M001

**File**: `packages/runtime-player/src/index.ts:428`

**Issue**: Runtime always writes `cmi.score.max = '100'`, which is correct per SCORM spec, but the lack of comments makes it unclear if this is intentional or a bug. The manifest declares completionThreshold in 0.0-1.0 range while scores are 0-100 in runtime.

**Impact**: Low risk. However, maintainers may "fix" this incorrectly.

**Recommendation**: Add clarifying comment explaining that cmi.score.max is always 100 per SCORM 2004 spec, and the actual mastery threshold is set via adlcp:completionThreshold in the manifest.

---

## [MEDIUM] Test gap: completionThreshold fallback case not tested

**ID**: T041-M002

**File**: `packages/scorm-packager/src/__tests__/scorm2004.test.ts:166–180`

**Issue**: Parametrized test covers [100, 75, 50, 0] but does NOT test the fallback case when both metadata.masteryScore and settings.passingScore are undefined. The code defaults to 80.

**Impact**: Fallback behavior won't be verified if refactored.

**Recommendation**: Add test case for undefined masteryScore and passingScore to verify 0.80 completionThreshold is generated.

---

## [MEDIUM] No validation that identifier contains only valid XML NCName characters

**ID**: T041-M003

**File**: `packages/scorm-packager/src/index.ts:112–120`

**Issue**: Manifest identifier is used directly in XML attributes without validation. If a user provides an identifier with invalid XML NCName characters (spaces, special chars), the generated XML becomes malformed.

**Impact**: LMS systems may reject or ignore the manifest silently.

**Recommendation**: Validate or sanitize identifiers to follow XML NCName rules before use in manifest attributes.

---

## [MEDIUM] Packager test doesn't verify index.html contents

**ID**: T041-M004

**File**: `packages/scorm-packager/src/__tests__/scorm2004.test.ts:92–104`

**Issue**: ZIP contents test verifies index.html exists but does NOT verify its contents (course JSON, special char escaping, player.js reference).

**Impact**: Regressions in index.html generation would not be caught.

**Recommendation**: Extend test to verify index.html contains escaped course JSON, ELearnPlayer.init call, and player.js script tag.

---

## [LOW] Unused namespace redundancy in schema location

**ID**: T041-L001

**File**: `packages/scorm-packager/src/index.ts:127–130`

**Issue**: The xsi:schemaLocation references XSD for unused adlseq namespace (if it exists).

**Impact**: None. Extra schema references are ignored by validators.

**Recommendation**: Once unused adlseq namespace is removed, ensure no adlseq XSD reference remains.

---

## [LOW] Missing documentation on manifest identifier requirements

**ID**: T041-L002

**File**: `packages/scorm-packager/src/index.ts:111–115`

**Issue**: Comments don't explain that identifiers must be unique within LMS and follow XML NCName rules.

**Impact**: Documentation gap. May lead to downstream bugs.

**Recommendation**: Add JSDoc comment explaining identifier requirements and uniqueness constraints.

---

## [LOW] Test descriptions could be more specific about CMI field semantics

**ID**: T041-L003

**File**: `packages/runtime-player/src/__tests__/scorm2004.test.ts:119–219`

**Issue**: Test names describe what fields are written but not why or semantic differences between similar fields.

**Impact**: Documentation gap. Future maintainers may not understand field purposes.

**Recommendation**: Enhance test descriptions with comments explaining SCORM 2004 CMI field semantics and differences from SCORM 1.2.

---

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0     | pass   |
| HIGH     | 2     | warn   |
| MEDIUM   | 4     | warn   |
| LOW      | 3     | note   |

**Verdict**: WARNING — 2 HIGH + 4 MEDIUM issues should be addressed before production use.

### Priority Fix Order

1. **T041-H001** (Remove unused adlseq namespace) — Quick fix, improves spec compliance
2. **T041-H002** (Add success_status tests) — Critical gap, verifies core SCORM logic
3. **T041-M003** (Validate identifier as NCName) — Prevents malformed XML in production
4. **T041-M001** (Document cmi.score.max behavior) — Prevents future misunderstandings

