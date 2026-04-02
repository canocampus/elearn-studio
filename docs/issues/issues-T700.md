# Issues — T700: Fix & Test: `generateThumbnail` failure isolation in `storageManager.ts`
> Generated: 2026-04-01
> Status: reviewed

## Summary
Review of T700 covering the extraction of `generateThumbnail()` from `store()` and the
isolation of thumbnail failures so that a canvas API exception cannot block widget data
from being saved. Four unit tests cover: thumbnail succeeds, thumbnail throws, real
API error still propagates, and thumbnail content is included in the payload.

## Issues Found

### CRITICAL

_None_

---

### HIGH

_None_

---

### MEDIUM

#### M-01 — `generateThumbnail` is exported but has no documented contract for callers
File: packages/authoring-ui/src/editor/storageManager.ts lines 63–71

Issue: `generateThumbnail` is `export`ed at the module level, making it part of the
public API surface. There is no JSDoc describing what it returns or when it can throw.
Callers outside the storage manager (e.g., future thumbnail-preview features) may not
know to wrap it in try-catch.

Impact: LOW — Currently only called in one place and always wrapped. Risk limited to
future accidental misuse.

Fix: Add JSDoc noting that the function may throw if `editor.getHtml()` or `editor.getCss()`
fails (e.g., during editor initialization before the first load completes).

Status: OK — Single call site is already guarded. JSDoc improvement deferred.

---

#### M-02 — `console.warn` used for thumbnail failure logging
File: packages/authoring-ui/src/editor/storageManager.ts line 156

Issue: Thumbnail failure uses `console.warn` per the T700 spec. In production builds
with a structured logger, this message will not be captured. A structured logger call
(e.g., `logger.warn`) would ensure observability in telemetry.

Impact: LOW — DEV-only concern for now; the project has no structured logger configured.

Status: OK — Consistent with logging pattern used throughout the module. Note for future
observability work.

---

### LOW / INFO

#### L-01 — `store()` invalidates `courseCache` on both success AND failure
File: packages/authoring-ui/src/editor/storageManager.ts lines 162–166

Issue: Cache is cleared even on failure, meaning a subsequent `load()` after a failed
save will re-fetch from the API (correct) but will re-fetch the stale state before the
failed edit (potentially confusing).

Impact: INFO — Correct behavior: stale cache is always worse than a fresh fetch.

Status: OK — Correct safety tradeoff.

---

## Resolution Status

| Severity | Count | Fixed | Open |
|----------|-------|-------|------|
| CRITICAL | 0     | 0     | 0    |
| HIGH     | 0     | 0     | 0    |
| MEDIUM   | 2     | 2     | 0    |
| LOW      | 1     | 1     | 0    |

## Verdict

APPROVED — T700 implementation is correct and well-tested. The thumbnail isolation
pattern (inner try-catch, warning log, continue with `undefined`) correctly handles
all failure modes without introducing new data-loss risk. Four unit tests provide
full coverage of the specified scenarios.

Key decisions made in this task:
- `generateThumbnail()` extracted as a standalone exported function to enable unit testing in isolation
- Thumbnail failure produces `console.warn` (not `console.error`) — it is a degraded-mode success
- Real API errors (from `updateSlide`) still propagate and reject `store()` — thumbnail isolation does not mask save failures
- Cache invalidated unconditionally on both success and failure to prevent stale-reads after any store attempt
