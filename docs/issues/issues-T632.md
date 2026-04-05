# Issues — T632: Fix asset picker type for Media Player and Audio Narration

**Task:** T632 — Fix asset picker type for Media Player and Audio Narration
**Version:** v0.5.37
**Date:** 2026-04-05
**Status:** CLOSED

---

## Summary

Both `MediaPlayerPropertiesPanel` and `AudioNarrationPropertiesPanel` opened the GrapesJS Asset Manager with `types: ['image']`, even when the user needed to select a video or audio file. Additionally, `assetManager.ts` tagged all uploaded assets as `type: 'image'` regardless of actual file type, making AM type filtering useless. Both root causes fixed.

---

## Root Cause

`assetManager.ts` line 104 (before fix):
```typescript
data: [{ src, name: originalName, type: 'image' }],
```

All uploads were tagged as `'image'`. GrapesJS AM's `types` filter works by matching the `type` attribute on stored assets. Filtering by `'video'` or `'audio'` would show nothing since no assets had those types.

---

## Issues Found During Review

### CRITICAL

_None._

### HIGH

_None._

### MEDIUM

#### M-01 — `detectAssetType` doesn't handle query strings or fragments in filenames

**File:** `packages/authoring-ui/src/editor/assetManager.ts`

**Issue:** `originalName` from the backend is always a clean filename (e.g. `video.mp4`) without query strings, so this is low risk. However, if the upstream `originalName` ever includes query params (`video.mp4?v=1`), the extension detection would fail.

**Resolution:** Acceptable for current backend contract. The backend's `multer` middleware produces clean original filenames. **Accepted as-is.**

#### M-02 — Existing assets in Garage still have `type: 'image'` — retroactive fix not implemented

**Issue:** Assets uploaded before this fix are stored in GrapesJS AM memory with `type: 'image'`. The fix only applies to new uploads. Existing assets won't appear when filtering by `['video']` or `['audio']`.

**Resolution:** Acceptable. The AM is populated fresh on each page load from the backend (no local persistence of asset metadata). Once the fix is deployed, all newly uploaded assets will be tagged correctly. The `'image'` fallback in both `types` arrays (`['audio', 'image']`, `['video', 'image']`) means existing assets remain visible. **Accepted as-is.**

### LOW

#### L-01 — `VIDEO_EXTENSIONS` and `AUDIO_EXTENSIONS` sets are module-level constants

**File:** `packages/authoring-ui/src/editor/assetManager.ts`

**Issue:** Minor style note — could be `const` inside the function body to reduce module-level surface area. No functional impact.

**Resolution:** Module-level constants are idiomatic for lookup tables. **Accepted as-is.**

---

## Changes Made

### `packages/authoring-ui/src/editor/assetManager.ts`
- Added `detectAssetType(filename)` helper mapping file extensions to `'video' | 'audio' | 'image'`
- Changed upload response from `type: 'image'` to `type: detectAssetType(originalName)`

### `packages/authoring-ui/src/components/sidebar/MediaPlayerPropertiesPanel.tsx`
- `openMediaPicker()` now accepts a `types: string[]` parameter
- `MediaSourceSection` reads `mediaType` from the component model and filters `['audio','image']` or `['video','image']` based on current media type selection

### `packages/authoring-ui/src/components/sidebar/AudioNarrationPropertiesPanel.tsx`
- Changed `types: ['image']` to `types: ['audio', 'image']` in `openAudioPicker()`
- Updated stale comment that incorrectly stated GrapesJS always uses `'image'` type

---

## T632.4 — E2E Test Decision

Full E2E test (drag media-player → open picker → confirm video assets visible) requires pre-seeded video/audio assets in Garage and is non-trivial to automate reliably. Deferred. Existing T604/T607 E2E tests cover the props panel rendering. A future comprehensive image-upload spec could cover multi-type asset uploads.

---

## CI Status

- Commit: `ece0142` — `fix(T632): detect asset type on upload; use correct AM types in media/audio pickers`
- All 657 authoring-ui unit tests pass
