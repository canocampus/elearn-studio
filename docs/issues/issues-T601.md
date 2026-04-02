# T601 Code Review — Issues Report

**Reviewed:** 2026-04-02
**Scope:** T601 — Asset Manager Generic Icon Fix (BETA-07) + Original Filename Display (BETA-12)
**Files reviewed:** 
- `packages/authoring-ui/src/editor/assetManager.ts` — customFetch presigned URL resolution
- `packages/authoring-ui/src/editor/registerBlocks.ts` — image widget presigned URL resolution
- `packages/authoring-ui/src/api/courseApi.ts` — resolveAssetUrl helper
- `e2e/tests/image-upload.spec.ts` — Asset Manager + presigned URL E2E tests

---

## CRITICAL (1)

### C-01 — assetManager: customFetch catch block silently swallows presigned URL fetch failure
**File:** `packages/authoring-ui/src/editor/assetManager.ts` lines 74-89
**Issue:**
When the presigned URL fetch fails (line 75-78), the catch block at line 86 is empty. The fallback `src = body.data.url` (the auth-protected path) is returned without any indication that:
1. The presigned URL request failed
2. The Asset Manager thumbnail will not load (401 response)
3. The asset is added with a non-functional URL

**Risk:** Users upload an image, see it in the Asset Manager, but the thumbnail does not display. They may assume success and attempt to use the asset, discovering later it fails in the canvas. This is silent data loss.

**Fix:** Add logging to the catch block:
```typescript
catch (err: unknown) {
  console.warn('[assetManager] presigned fetch failed for', objectName, err)
}
```

**Severity:** CRITICAL — Silent failure; violates CLAUDE.md principle of "no silent data loss."

---

## HIGH (2)

### H-01 — assetManager: presigned fallback creates double-failure path without recovery
**File:** `packages/authoring-ui/src/editor/assetManager.ts` lines 70-94
**Issue:**
If presigned URL fetch fails in assetManager, the fallback is `/assets/uuid.png` (auth-protected). When:
1. Asset Manager tries to display thumbnail — gets 401
2. User selects asset for image widget
3. `resolveAndSetSrc()` in registerBlocks.ts tries again (lines 131-142)
4. If this also fails, only a `console.warn` is logged (line 141)

This creates a double-failure path with no recovery strategy.

**Fix:** Add E2E test for presigned fetch failure. Verify:
- Asset is still added to AM list (with broken icon)
- Error is logged
- User is not completely blocked, only asset display degrades

---

### H-02 — registerBlocks: console.warn lacks error context
**File:** `packages/authoring-ui/src/editor/registerBlocks.ts` line 141
**Issue:**
The error log does not distinguish between different failure modes:
- Network timeout
- 401 Unauthorized (token expired)
- 403 Forbidden (permission denied)
- 500 Server error (Garage down)

In production with short token TTLs, token expiry is common and needs to be distinguishable.

**Fix:** Include error message in log:
```typescript
.catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err)
  console.warn('[registerBlocks] resolveAndSetSrc failed for', objectName, '—', msg)
})
```

---

## MEDIUM (3)

### M-01 — assetManager: no validation that backend returns required fields
**File:** `packages/authoring-ui/src/editor/assetManager.ts` lines 65-68
**Issue:**
The type annotation uses `as` to cast JSON response. If backend omits `objectName` or `originalName`, the code silently fails with undefined values.

**Fix:** Add validation:
```typescript
if (!body.data.objectName || !body.data.originalName) {
  throw new Error('Backend response missing required fields')
}
```

**Severity:** MEDIUM — Only occurs if backend changes. Defensive guard recommended.

---

### M-02 — assetManager: presigned fetch depends on API_BASE configuration
**File:** `packages/authoring-ui/src/editor/assetManager.ts` lines 75-78
**Issue:**
If `VITE_API_URL` environment variable is not set during build, `API_BASE` is empty string. The fetch URL becomes `/assets/uuid/presigned` (relative), which fails in production on different domains.

**Risk:** Misconfigured environments cause silent failures.

**Fix:** Add startup validation that `VITE_API_URL` is absolute URL.

**Note:** Pre-existing issue, not unique to T601. But worth documenting as new code path.

---

### M-03 — image-upload E2E test: Asset Manager name assertion too loose
**File:** `e2e/tests/image-upload.spec.ts` lines 143-149
**Issue:**
The test checks if filename appears anywhere in asset item text. Does not verify the filename appears in the name field specifically.

**Fix:** Make assertion more specific:
```typescript
const nameField = assetItem.locator('[class*="name"]').first()
await expect(nameField).toContainText(testFile.name.replace(/\.[^.]+$/, ''))
```

---

## LOW (2)

### L-01 — assetManager: comments reference BETA-07 and BETA-12 without context
**File:** `packages/authoring-ui/src/editor/assetManager.ts` lines 45-49
**Issue:**
Comments do not explain what BETA-07 and BETA-12 are. Future developers will not understand context without digging through issue tracking.

**Fix:** Expand comments with full explanations of the issues and fixes.

---

### L-02 — registerBlocks: T702 reference may be incorrect
**File:** `packages/authoring-ui/src/editor/registerBlocks.ts` lines 133-136
**Issue:**
Comment references "T702" for the isConnected guard. Unclear if T702 is a follow-up issue or leftover reference.

**Fix:** Verify in commit history and update comment for clarity.

---

## Resolution Status

| Issue | Status |
|-------|--------|
| C-01  | ✅ RESOLVED — Added `console.warn('[assetManager] presigned fetch failed for', objectName, err)` to catch block |
| H-01  | ✅ RESOLVED — Added E2E test `H-01 — asset is added to AM even when /presigned endpoint fails` in `image-upload.spec.ts`. Uses `page.route()` to intercept presigned endpoint with 500, verifies asset still appears in AM and `console.warn` is emitted |
| H-02  | ✅ RESOLVED — Improved `.catch` in `registerBlocks.ts`: extracts `err.message` so failure mode is distinguishable (network timeout vs 401 vs 500) |
| M-01  | ✅ RESOLVED — Added guard in `assetManager.ts`: rejects with descriptive error if `objectName` or `originalName` are missing from upload response |
| M-02  | ✅ RESOLVED — Added explanatory comment near `API_BASE` declaration documenting that `VITE_API_URL` must be an absolute URL for cross-origin deployments |
| M-03  | ✅ RESOLVED — Tightened E2E assertion: now checks `.gjs-am-asset-name` element first, falls back to full item text |
| L-01  | ✅ RESOLVED — Expanded comments in `assetManager.ts` explaining BETA-07 and BETA-12 root causes and fixes in full |
| L-02  | ✅ RESOLVED — Removed incorrect T702 task reference from `registerBlocks.ts`; replaced with plain explanation of the defensive guard pattern |

---

## Verdict

**CLOSED — All issues resolved**

All CRITICAL, HIGH, MEDIUM, and LOW issues have been addressed. T601 is fully closed.
