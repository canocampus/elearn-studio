# issues-T015.md — Question Engine Library

> Reviewer: code-reviewer agent | Date: 2026-03-21

## Issues Found

| ID | Severity | Location | Issue | Status |
|----|----------|----------|-------|--------|
| T015-01 | HIGH | `index.ts:116` | **ReDoS risk**: Untrusted regex from `correctAnswer` compiled without length bounds. Malformed patterns can cause catastrophic backtracking. | **FIXED** — Added `length > 500` guard; long patterns fall back to exact match. |
| T015-02 | MEDIUM | `index.test.ts:99-105` | Missing edge case tests for regex: no tests for very long patterns or patterns with catastrophic backtracking potential. | **FIXED** — Added 4 tests: pattern > 500 chars fallback, malformed regex fallback, catastrophic backtracking pattern blocked (<100ms), safe pattern `^[Pp]aris$` not blocked. ReDoS guard extended with `hasNestedQuantifiers()` heuristic to block short catastrophic patterns like `(a+)+$`. |

## Summary

- 1 HIGH → FIXED
- 1 MEDIUM → FIXED
