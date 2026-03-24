# T042 Code Review — Performance Optimizations

**Date:** 2026-03-24
**Reviewer:** Claude Code
**Files Reviewed:**
- packages/runtime-player/src/index.ts (T042.3, T042.4)
- packages/runtime-player/src/sim/simPlayer.ts (T042.4)
- packages/authoring-ui/src/editor/storageManager.ts (T042.5)

---

## Summary

Three performance optimizations were implemented:

1. **T042.3**: Slide asset prefetching in runtime player
2. **T042.4**: Screenshot-sim next-step prefetching in simPlayer.ts
3. **T042.5**: In-memory course cache in authoring UI storage manager

All three changes are **well-intentioned**. All MEDIUM and LOW issues have been resolved.

---

## Issues Found

### [MEDIUM — RESOLVED] T042.3: Potential XSS via untrusted asset URLs

**File:** packages/runtime-player/src/index.ts:401-412

**Issue:**
The prefetchSlideAssets() function blindly prefetches any URL without validation. It could receive data: URIs or javascript: URIs from malicious course JSON.

**Risk:**
- **data: URIs**: Browser renders HTML/scripts if src is data:text/html,<script>
- **javascript: URIs**: Modern browsers block img.src, but request still made
- **Malicious domains**: Could exfiltrate tokens via custom headers

**Confidence:** 90%

**Fix:**
Validate URLs before prefetching. Allow only https?:// protocols and reject data:, javascript:, etc.

---

### [MEDIUM — RESOLVED] T042.4: Prefetching fails silently; no error handling

**File:** packages/runtime-player/src/sim/simPlayer.ts:195-200

**Issue:**
Image load failures (404, CORS, timeout) silently ignored. No onerror handler or logging.

**Risk:**
- On unreliable networks, prefetch fails and learner's actual navigation suffers delay
- Debugging failures is difficult without error tracking

**Confidence:** 85%

**Fix:**
Add onerror handler to log prefetch failures for diagnostics.

---

### [MEDIUM — RESOLVED] T042.5: Cache invalidation assumes success; doesn't clear on error

**File:** packages/authoring-ui/src/editor/storageManager.ts:107-135

**Issue:**
In store() method, courseCache is only cleared if updateSlide() succeeds. If it fails, cache is stale (holds pre-update data).

**Risk:**
- User switches slides, comes back to failed slide
- load() hits stale cache, shows pre-save edits
- User unaware update didn't persist = **silent data loss**

**Confidence:** 90%

**Fix:**
Use finally block to clear cache on all paths (success or error):

```typescript
finally {
  courseCache = null
}
```

---

### [MEDIUM — RESOLVED] T042.3/T042.4: Memory leak risk — Image objects not tracked

**File:** packages/runtime-player/src/index.ts:401-412 and simPlayer.ts:195-200

**Issue:**
new Image() objects created but never stored. Browsers should GC them, but unbounded cache growth is possible on long sessions with many slides.

**Confidence:** 70%

**Fix:**
Cap prefetch count to safe number (e.g., 3 slides max).

---

### [LOW — RESOLVED] T042.5: Cache invalidation exported but not wired

**File:** packages/authoring-ui/src/editor/storageManager.ts:52-54

**Issue:**
invalidateCourseCache() exported but not called when course structure changes (slides added/deleted). Cache stays stale.

**Confidence:** 75%

**Fix:**
Wire invalidateCourseCache() into slide add/delete operations.

---

### [LOW — RESOLVED] T042.3: Loop clarity

**File:** packages/runtime-player/src/index.ts:402

**Issue:**
Double-condition loop (i <= fromIndex + count && i < slides.length) needs comment for clarity.

**Confidence:** 100%

**Fix:**
Add comment explaining boundary checks.

---

## Review Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0     | pass   |
| HIGH     | 0     | pass   |
| MEDIUM   | 4     | resolved ✅ |
| LOW      | 2     | resolved ✅ |

---

## Verdict

**PASS** — All issues resolved:

1. ✅ T042.5 cache invalidation uses `finally` block — clears cache on both success and error paths
2. ✅ T042.3 `isSafeUrl()` helper allows only `https?://` URLs — rejects data: and javascript:
3. ✅ `invalidateCourseCache()` wired into SlideList and TopToolbar add/delete/duplicate handlers
4. ✅ T042.4 `onerror` handler logs prefetch failures with step index for diagnostics
5. ✅ Prefetch count capped at `min(count, 3)` to bound memory usage

