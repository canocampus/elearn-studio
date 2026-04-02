# Issues — Manual Prototype Review (Beta Test Round 1)

**Review date:** 2026-03-31
**Reviewer:** José Antonio (project owner)
**Scope:** Basic components + interactions (simulations excluded)
**Session:** First complete course authoring attempt on live prototype

---

## Summary

| Severity | Count |
|---|---|
| 🔴 CRITICAL | 3 |
| 🟠 HIGH | 9 |
| 🟡 MEDIUM | 4 |
| 🔵 MISSING FEATURE | 3 |

---

## 🔴 CRITICAL — Blocks core authoring workflow

### BETA-01 — Question widgets: no way to mark correct answer (Multiple Choice)
**Component:** `question-mc` / `QuestionPropertiesPanel` / `MCPropertiesForm`
**Symptom:** The props panel renders options but provides no UI to mark which answer is correct. Adding/removing options refreshes the widget in the canvas but the props panel does not update to reflect the new option count.
**Impact:** Makes it impossible to author a valid Multiple Choice question. Core feature broken.
**Files to investigate:**
- `packages/authoring-ui/src/components/panels/QuestionPropertiesPanel.tsx`
- `packages/authoring-ui/src/components/panels/MCPropertiesForm.tsx`
- `packages/authoring-ui/src/editor/registerQuestionBlocks.ts`

### BETA-02 — Question widgets: question text and option text are not editable
**Component:** `question-mc`, `question-tf`, `question-fill`
**Symptom:** Typing in the question text field or option text fields has no effect — the canvas does not update and the value is not persisted.
**Impact:** Makes all three question types completely unusable for authoring.
**Shared with:** BETA-03, BETA-05, BETA-06

### BETA-03 — Question widgets: feedback text (correct/incorrect) is not editable
**Component:** `question-mc`, `question-tf`, `question-fill`
**Symptom:** The feedback text fields in the props panel accept input but changes are not reflected in the widget or persisted.
**Impact:** Removes all feedback capability from questions.

---

## 🟠 HIGH — Significantly impairs usability

### BETA-04 — Button widget: caption (label text) cannot be changed
**Component:** `button` widget / style manager
**Symptom:** The button label is not editable via the Style Manager or any panel. Double-clicking in the canvas may trigger GrapesJS text edit but changes do not persist.
**Impact:** Every button on every slide will have the default label.
**Shared with:** Navigation buttons, Done button.

### BETA-05 — Button / Done button: background image cannot be assigned
**Component:** `button`, `done-button`, `nav-buttons`
**Symptom:** The Asset Manager opens (with the preview bug BETA-07), an image is selected, but the `background-image` CSS property is not applied to the component.
**Impact:** No image-based buttons possible.

### BETA-06 — Positioning bug on initial drag for: Done button, True/False, Fill in Blank, Media Player
**Component:** `done-button`, `question-tf`, `question-fill`, `media-player`
**Symptom:** When first dragged from the Block Manager onto the canvas, the widget lands in the wrong position (top-left or 0,0 area). After the initial drop it can be moved normally.
**Impact:** Every drag requires an extra repositioning step. FM-01 regression in specific widget types.
**Note:** Rectangle and Multiple Choice do NOT have this bug, which suggests the issue is in the specific block definitions for these four types.
**Files to investigate:**
- `packages/authoring-ui/src/editor/registerBlocks.ts` — check `content` definition for affected blocks
- Compare working blocks (rectangle) vs broken blocks (done-button, question-tf, etc.)

### BETA-07 — Asset Manager: image preview shows generic icon instead of thumbnail
**Component:** GrapesJS Asset Manager / custom asset provider
**Symptom:** After uploading an image, the Asset Manager list shows a generic file icon and the Garage UUID filename instead of the actual image thumbnail.
**Impact:** Cannot visually identify which image to select — must guess from UUID filename.
**Files to investigate:**
- `packages/authoring-ui/src/editor/initEditor.ts` — Asset Manager configuration
- The custom asset upload handler and how it registers assets back into GrapesJS AM
- GrapesJS Asset Manager `src` field population after upload

### BETA-08 — True/False: correct answer selection broken
**Component:** `question-tf` / `TFPropertiesForm`
**Symptom:** Cannot select whether True or False is the correct answer from the props panel.
**Shared with:** BETA-02

### BETA-09 — Fill in Blank: accepted answer not editable
**Component:** `question-fill` / `FillPropertiesForm`
**Symptom:** The accepted answer field in the props panel does not persist changes.
**Shared with:** BETA-02

### BETA-10 — Media Player: no properties panel, no way to assign media file
**Component:** `media-player` widget
**Symptom:** The Media Player block can be dragged to the canvas but the Props panel shows no properties (no URL field, no file selector, no playback controls config). No way to assign a video or audio file.
**Impact:** Media Player widget is completely non-functional for authoring.
**Files to investigate:**
- `packages/authoring-ui/src/editor/registerBlocks.ts` — `media-player` block definition
- Is there a `MediaPlayerPropertiesPanel` component? If not, it needs to be created.

### BETA-11 — Navigation buttons: individual button captions not changeable
**Component:** `nav-buttons` grouped widget
**Symptom:** The navigation buttons group (prev/next/first/last) renders correctly but the caption of each individual button cannot be changed — only the group-level properties are accessible.
**Impact:** All navigation buttons have generic labels.

---

## 🟡 MEDIUM — Impairs UX but has workaround

### BETA-12 — Asset Manager: filename shown is UUID instead of original name
**Component:** GrapesJS Asset Manager / Garage upload response
**Symptom:** After upload, the asset is listed with its Garage UUID key (e.g., `a3f7c2d1-uuid.png`) instead of the original filename (`my-photo.png`).
**Workaround:** User can remember which UUID they just uploaded.
**Fix:** Store original filename as metadata in Garage or in the asset response; display it in the AM list alongside the UUID.

### BETA-13 — Props panel does not refresh when options are added/removed in MC
**Component:** `MCPropertiesForm` / GrapesJS `component:update` event
**Symptom:** Adding or removing an option from Multiple Choice refreshes the canvas preview correctly, but the props panel still shows the old option count until the user clicks away and back.
**Fix:** `MCPropertiesForm` needs to re-render when the underlying `extendedProperties.options` array changes length.

### BETA-14 — No visual feedback during SCORM export (no progress indicator)
**Component:** `TopToolbar.tsx` / Publish dialog
**Symptom:** After clicking Publish SCORM 1.2, nothing visible happens for several seconds. No spinner, no progress bar, no status message. The download eventually starts.
**Fix:** Show a loading state on the Publish button and/or a status message in the dialog.

### BETA-15 — Image block: double-click behaviour not obvious
**Component:** `image` widget
**Symptom:** The way to open the Asset Manager for an image widget (double-click) is not discoverable. No tooltip or hint is shown.
**Fix:** Add a placeholder state with a "Click to choose image" hint when no image is assigned.

---

## 🔵 MISSING FEATURES — Required for production-quality courses

### MISSING-01 — Audio narration component
**Description:** Modern e-learning courses include slide-level audio narration (voiceover). Need a dedicated audio narration widget that:
- Plays audio automatically when the slide loads (configurable)
- Shows a minimal play/pause control
- Supports MP3, OGG, WAV formats
- Integrates with the volume control (MISSING-02)
- Is distinct from the Media Player (which is for video)
**Priority:** HIGH — standard feature expected by instructional designers

### MISSING-02 — Global volume control for course multimedia
**Description:** A persistent volume control widget that affects all audio/video in the course:
- Controls Media Player volume
- Controls Audio Narration volume (MISSING-01)
- Persists volume preference across slides (stored in SCORM suspend_data or sessionStorage)
- Minimal UI: slider or mute/unmute button
**Priority:** MEDIUM

### MISSING-03 — Course progress bar
**Description:** A widget showing percentage of course completion:
- Based on slides visited vs total slides
- Updates as learner navigates
- Can be placed on the background (shared across all slides) or per-slide
- Reports to SCORM `cmi.core.lesson_location` or custom calculation
**Priority:** HIGH — learners need orientation within the course

---

## Root Cause Analysis

### Why BETA-04/05/08/09 (text fields not editable / properties not persisting) share a root cause

The pattern across multiple widgets — question text, option text, button label, feedback — suggests that the `component.set('extendedProperties', ...)` call in the props form `onChange` handlers is either:
1. Not being called at all (event handler not wired)
2. Being called but not triggering GrapesJS `component:update` (property path issue)
3. Being called but the Storage Manager debounce is not picking it up

**Investigation starting point:** Add a `console.log` in `MCPropertiesForm.onChange` to confirm the handler fires, then check if `component.get('extendedProperties')` reflects the change after the call.

### Why BETA-06 (positioning bug on initial drag) affects specific widgets

The working widgets (rectangle, question-mc) likely have explicit `style: { position: 'absolute', left: '...', top: '...' }` in their block `content` definition. The broken widgets (done-button, question-tf, question-fill, media-player) probably use a different content format that doesn't include the initial position, causing GrapesJS to default to (0,0).

**Fix pattern:** In `registerBlocks.ts`, ensure all block definitions include:
```typescript
content: {
  type: 'widget-type',
  style: { position: 'absolute', left: '100px', top: '100px', width: '200px', height: '50px' }
}
```

---

## Recommended Fix Order

1. **BETA-06** — Positioning bug (affects 4 widgets, quick fix in registerBlocks.ts)
2. **BETA-07 / BETA-12** — Asset Manager preview (affects all image usage)
3. **BETA-01 / BETA-02 / BETA-03** — Question props not working (core authoring broken)
4. **BETA-04 / BETA-05** — Button caption + background (affects all buttons)
5. **BETA-10** — Media Player properties panel
6. **BETA-08 / BETA-09** — TF and Fill specific bugs
7. **BETA-13 / BETA-14 / BETA-15** — UX polish
8. **MISSING-01** — Audio narration (new feature)
9. **MISSING-03** — Progress bar (new feature)
10. **MISSING-02** — Volume control (new feature)
