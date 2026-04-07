# Issues — T635: Add SCORM format selector to PublishDialog

## Status: RESOLVED

All subtasks completed. No CRITICAL or HIGH issues found during review.

---

## Summary

T635 added an export format selector (radio group) to the PublishDialog component,
allowing authors to choose between SCORM 1.2, SCORM 2004, and AICC before packaging.

---

## Issues Found

None. Code review verdict: APPROVE.

| Severity | Count |
|----------|-------|
| CRITICAL | 0     |
| HIGH     | 0     |
| MEDIUM   | 0     |
| LOW      | 0     |

---

## Implementation Notes

- `ExportFormat = 'scorm12' | 'scorm2004' | 'aicc'` exported from `PublishDialog.tsx`
- SCORM 1.2 is the default; existing E2E tests unaffected (locator still finds "Publish SCORM 1.2")
- Backend routes `/courses/:id/export/scorm2004` and `/courses/:id/export/aicc` added with same
  pattern as existing scorm12 route (rate-limited, asset rewriting, cleanup)
- `triggerZipDownload` helper in `courseApi.ts` eliminates the previous per-format duplication

---

## Test Results

| Suite | Tests | Result |
|-------|-------|--------|
| authoring-ui unit | 663 | ✓ passed |
| api unit | 131 | ✓ passed |
| scorm-packager unit | 156 | ✓ passed |
| runtime-player unit | 256 | ✓ passed |
| E2E scorm-export | 15 (10 existing + 5 new @regression T635) | ✓ passed |
| CI | — | ✓ green |
