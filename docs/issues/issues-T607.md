# Issues — T607: Audio Narration Widget (MISSING-01)

**Reviewer:** code-reviewer agent
**Date:** 2026-04-02
**Block:** T607 — New widget: Audio Narration component
**Status:** APPROVED — all issues resolved (including deferred M-01 and L-02)

---

## Summary

| Severity | Count | Resolved |
|---|---|---|
| CRITICAL | 2 | ✅ |
| HIGH | 1 | ✅ |
| MEDIUM | 1 | ✅ |
| LOW | 2 | ✅ |

---

## CRITICAL Issues

### C-01 — `converters.ts`: Broad `src` restoration could break text widget assertions ✅ RESOLVED

**File:** `packages/authoring-ui/src/editor/converters.ts` (line 228-234)
**Problem:** Initial fix removed the `w.type === 'image'` type guard entirely when restoring `src` as a GrapesJS model attribute. This meant text widgets, button widgets, and any other type that stores a `src` in `properties` would also have `def.src` set — potentially triggering unintended `change:src` listeners and breaking tests that assert text/button components do not have a root-level `src`.
**Fix applied:** Replaced broad removal with a whitelist:
```typescript
const WIDGETS_WITH_SRC_TRAIT = new Set(['image', 'media-player', 'audio-narration'])
if (WIDGETS_WITH_SRC_TRAIT.has(w.type) && typeof props?.src === 'string' && props.src) {
  def.src = props.src
}
```
Only widget types that declare `src` as a GrapesJS model-level trait receive root-level `src` restoration.

---

## HIGH Issues

### H-01 — `runtime-player/src/index.ts`: `extendedProperties` no null guard ✅ RESOLVED

**File:** `packages/runtime-player/src/index.ts`
**Problem:** Initial implementation cast `w.extendedProperties` directly to `{ autoplay?: boolean; controls?: boolean }` with no null check. Old/migrated documents can have `extendedProperties: null` (as guarded elsewhere in the codebase via the T900 `w.bounds` fix).
**Fix applied:**
```typescript
const ep = (w.extendedProperties as Record<string, unknown> | null) ?? {}
```
Also changed `ep.autoplay ? ' autoplay' : ''` to `ep.autoplay === true ? ' autoplay' : ''` for strict boolean equality (prevents truthy values like `"true"` string from enabling autoplay).

---

## CRITICAL Issues (continued)

### C-02 — `backend/api/src/models/Widget.ts`: `audio-narration` missing from `WIDGET_TYPES` enum ✅ RESOLVED

**File:** `backend/api/src/models/Widget.ts`
**Problem:** `WIDGET_TYPES` array did not include `'audio-narration'`. The Mongoose schema uses this array as an `enum` validator on `WidgetSchema.type`. When the storage manager tried to PATCH a slide containing an `audio-narration` widget, Mongoose rejected it with a validation error surfaced as HTTP 500. This meant `src` was never persisted.
**Fix applied:** Added `'audio-narration'` to the `WIDGET_TYPES` array. Confirmed by T607.6 round-trip test.

---

## MEDIUM Issues

### M-01 — `AudioNarrationPropertiesPanel.tsx`: AM picker not filtered to `audio/*` ✅ RESOLVED

**File:** `packages/authoring-ui/src/components/sidebar/AudioNarrationPropertiesPanel.tsx`
**Problem:** The "Choose from Asset Library…" button opens the GrapesJS Asset Manager but does not filter it to audio MIME types only. Authors could accidentally select images or video files.
**Fix applied:** Added `AUDIO_EXTENSIONS` Set + `isAudioUrl()` function. The `openAudioPicker` callback now validates the selected asset's URL path extension and shows an `alert()` if a non-audio file is selected, preventing assignment of invalid URLs. GrapesJS AM cannot filter by MIME type natively (all assets stored as `type:'image'`), so extension-based post-selection validation is the practical approach.

---

## LOW Issues

### L-01 — Canvas preview SVG inline in `registerBlocks.ts` ✅ RESOLVED

**File:** `packages/authoring-ui/src/editor/registerBlocks.ts`
**Problem:** The canvas preview HTML (inside `content`) contains an inline SVG. While safe (no user input interpolated), it makes the `defaults.content` string harder to read.
**Resolution:** Accepted as-is — consistent with the pattern used by `media-player` and other widget types. A separate refactor (not blocking) could extract canvas preview HTML into named constants.

### L-02 — `audio-narration-widget.spec.ts`: Test T607.4 updates model but doesn't reload ✅ RESOLVED

**File:** `e2e/tests/audio-narration-widget.spec.ts`
**Problem:** T607.4 verifies `src` is set in the GrapesJS model after typing a URL, but does not perform a save-reload cycle to verify the `WIDGETS_WITH_SRC_TRAIT` whitelist fix (C-01) actually persists `src` through the store→load round-trip.
**Fix applied:** Added T607.6 — a full persistence round-trip test: set `src` via editor API → wait for autosave PATCH → switch slides → return → assert `src` on component model. This test also uncovered C-02 (missing `audio-narration` from `WIDGET_TYPES` enum) which caused the PATCH to 500 and lose data.

---

## E2E Verification

All 6 T607 E2E tests pass:

| Test | Description | Status |
|---|---|---|
| T607.1 | Audio Narration block visible in Blocks panel | ✅ PASS |
| T607.2 | Selecting audio-narration widget auto-switches to Props tab | ✅ PASS |
| T607.3 | Props panel sections (Audio Source, Playback Options) visible | ✅ PASS |
| T607.4 | URL typed into src field updates GrapesJS component model | ✅ PASS |
| T607.5 | Checkboxes (Show controls, Autoplay) are interactive | ✅ PASS |
| T607.6 | `src` persists through slide-switch round-trip (BUG-T607-01 + C-02 regression) | ✅ PASS |
