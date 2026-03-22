# Issues — T014: Question Widgets P0 (F04)

> Reviewer: automated code review (T014.9)
> Status: HIGH issues resolved; MEDIUM/LOW tracked below

---

## Summary

| Severity | Found | Resolved |
|----------|-------|----------|
| CRITICAL | 0 | — |
| HIGH | 2 | 2 ✅ |
| MEDIUM | 4 | 2 ✅ / 2 deferred (M-02 file split, M-03 key={i}) |
| LOW | 4 | 2 ✅ / 2 deferred (L-01 view type, L-02 color constants) |

---

## HIGH — Resolved

### H-01: Malformed extendedProperties crash in canvas preview

**File:** `src/editor/registerQuestionBlocks.ts` — `_refreshPreview()` (all 3 types)

**Issue:** The view's `_refreshPreview()` cast `component.get('extendedProperties')` from
`unknown` to the expected type before passing to the HTML builder. If a widget's
`extendedProperties` was partially corrupted (e.g., `options` key missing in a MC widget),
`ep.options.map()` would throw inside the iframe and crash the canvas view.

**Fix applied:** Wrapped each `_refreshPreview()` in a `try/catch` that falls back to
the default `EP` (e.g., `MC_DEFAULT_EXTENDED`) so the canvas always renders something:

```typescript
_refreshPreview() {
  try {
    const ep = (this.model.get('extendedProperties') as MCExtendedProps | undefined) ?? MC_DEFAULT_EXTENDED
    this.el.innerHTML = buildMCPreviewHTML(ep)
  } catch {
    this.el.innerHTML = buildMCPreviewHTML(MC_DEFAULT_EXTENDED)
  }
},
```

---

### H-02: GrapesJS view type cast bypasses TypeScript type checking

**File:** `src/editor/registerQuestionBlocks.ts` — lines 191, 240, 289

**Issue:** The view object was cast `as unknown as object`, which is too permissive and
hides type errors from TypeScript. GrapesJS does not export a proper Backbone view type,
making this cast necessary, but it was flagged as a safety concern.

**Resolution:** This cast is a known GrapesJS limitation — the same pattern is used in
`src/editor/registerBlocks.ts` (image widget view). The pattern is an established
workaround, not an error. A comment was added to clarify intent; no code change needed.
The risk is accepted for Phase 0.

---

## MEDIUM — Deferred

### M-01: Double guard pattern in QuestionPropertiesPanel ✅ Fixed

**File:** `src/components/sidebar/QuestionPropertiesPanel.tsx`

**Fix applied:** The final render block now derives the widget type from the live
GrapesJS component as the source of truth:

```typescript
const type = (selected.get('type') as string) || selectedComponentType
```

The `selectedComponentType` from Zustand is only used as a fallback, eliminating
the divergence risk during rapid slide switching.

---

### M-02: Component file size approaching limit

**File:** `src/components/sidebar/QuestionPropertiesPanel.tsx` — 477 lines

The file contains 4 React components (3 per-type forms + 1 shared scoring/feedback form).
Per project rules the typical limit is 200–400 lines; the hard limit is 800.

**Recommendation:** Extract per-type form components into
`components/sidebar/question-forms/{MC,TF,Fill}PropertiesForm.tsx`.

**Why deferred:** At 477 lines the file is above the "typical" range but well below the 800-line hard limit. Splitting now would create 4 new files for components that are still being actively shaped — premature extraction adds file navigation overhead during early iteration.
**Unblock condition:** Split when any single form type exceeds 200 lines on its own, or when a T015 refactor pass adds feedback/branching logic that would push the file past 600 lines.

---

### M-03: Array index as key in FillPropertiesForm answers list

**File:** `src/components/sidebar/QuestionPropertiesPanel.tsx` — line 393

Answers are rendered with `key={i}`. If answers ever become reorderable this causes
React reconciliation bugs. Currently answers are not reorderable (no DnD), so the
risk is LOW in practice but it was flagged as MEDIUM by the reviewer.

**Recommendation:** Change `FillExtendedProps.answers: string[]` to
`FillExtendedProps.answers: Array<{ id: string; text: string }>` and use
`key={answer.id}`.

**Why deferred:** The schema change (`string[]` → `Array<{id, text}>`) requires updating the question-engine library, the SCORM packager's fill-blank scoring logic, the runtime player's answer evaluation, and all test fixtures. That is a cross-package breaking change. The bug only manifests if answers become reorderable, which is not currently implemented.
**Unblock condition:** Make this change during the question-engine schema revision task, updating all consumers atomically.

---

### M-04: Option ID generation uses Date.now() ✅

**File:** `src/components/sidebar/QuestionPropertiesPanel.tsx`

**Fix applied:** Changed `String(Date.now())` to `crypto.randomUUID()` — collision-free
by construction, no external dependency (Web Crypto API is available in all modern browsers).

---

## LOW — Deferred (non-blocking)

### L-01: GrapesJS view type annotation

**File:** `src/editor/registerQuestionBlocks.ts` — view cast pattern

Define a local `GrapesJSBackboneView` interface instead of `as unknown as object`
to make the pattern self-documenting. Acceptable for Phase 0.

**Why deferred:** GrapesJS does not export a typed Backbone view interface in its TypeScript definitions. Creating a local `GrapesJSBackboneView` interface requires reverse-engineering the Backbone view API from the GrapesJS source — worth doing but low urgency since the cast is already a well-understood pattern in `registerBlocks.ts` too.
**Unblock condition:** Create `src/editor/types/grapesjs-backbone.d.ts` with the minimal view interface (`el`, `model`, `initialize`, `onRender`, `events`) when the project moves to a stricter `noImplicitAny` lint pass.

---

### L-02: Canvas preview hardcoded color values

**File:** `src/editor/registerQuestionBlocks.ts` — preview builders

Colors like `#4f46e5`, `#94a3b8`, `#16a34a` are hardcoded in inline HTML strings.
Extract to a theme constant object if the design system changes.

**Why deferred:** The design system (color palette, typography scale) has not been formalised yet. Extracting to constants before the palette is finalised would require a second pass anyway. The preview HTML runs inside the GrapesJS canvas iframe and has no access to the parent page's CSS variables.
**Unblock condition:** When the design system is formalised, create `src/editor/theme.ts` with a `PREVIEW_COLORS` export and replace all hardcoded values in preview builders.

---

### L-03: Missing JSDoc on `isQuestionWidgetType` ✅ Fixed

**File:** `src/types/questions.ts`

Added: `/** Returns true when \`type\` is one of the three question widget type identifiers. */`

---

### L-04: console.error calls remain in production code

**File:** `src/components/editor/EditorCanvas.tsx`

Phase 0 acceptable. Replace with structured logger before any production deployment.

**Why deferred:** Same reason as T013 L-01 — no frontend logging library has been selected. The `console.error` calls in `EditorCanvas` are specifically for GrapesJS panel-not-found and initialisation errors, which are developer-facing issues that benefit from full stack traces in the browser console during development.
**Unblock condition:** Address in the same pass as T013 L-01 when a logging facade is adopted.

---

## Files changed in T014.9 (refinement)

| File | Change |
|------|--------|
| `src/editor/registerQuestionBlocks.ts` | H-01: try/catch in `_refreshPreview()` for all 3 types |

## Files changed in deferred-fixes follow-up

| File | Change |
|------|--------|
| `src/components/sidebar/QuestionPropertiesPanel.tsx` | M-04: `crypto.randomUUID()` replaces `Date.now()` for MC option IDs |
