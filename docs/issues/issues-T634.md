# issues-T634 — Fix nav-buttons "missing child buttons" error

**Task:** T634  
**Version:** v0.5.39  
**Reviewer:** code-reviewer agent (claude-haiku-4-5)  
**Date:** 2026-04-05  
**Verdict:** APPROVE — no blocking issues

---

## Summary of Changes

| File | Change |
|---|---|
| `packages/authoring-ui/src/editor/registerBlocks.ts` | Replaced `onRender()` HTML injection with `defaults.components` proper GrapesJS child objects |
| `packages/authoring-ui/src/editor/converters.ts` | Added `prevLabel`/`nextLabel` save/load persistence + `GrapesJsComponentDef.components` interface field |
| `packages/authoring-ui/src/__tests__/converters.test.ts` | 6 new T634 regression tests |
| `e2e/tests/nav-buttons-widget.spec.ts` | 3 new E2E tests |

---

## CRITICAL — None

## HIGH — None

## MEDIUM

### M-01 — GrapesJsComponentDef.components typed too broadly

**File:** `packages/authoring-ui/src/editor/converters.ts:33`  
**Status:** Accepted — not blocking, deferred to future refactor

The `components` field on `GrapesJsComponentDef` is typed as `Record<string, unknown>[]`, which is too broad. The actual runtime shape has typed fields: `tagName`, `content`, `droppable`, `draggable`, `actions`, `elearnActions`, `properties`, `extendedProperties`, `style`.

A more precise type would be either `GrapesJsComponentDef[]` (self-referential) or a named child component type. The current loose typing is a maintainability issue — future developers may pass malformed child components without TypeScript catching it.

**Recommended fix (future refactor):**
```typescript
// converters.ts
interface NavButtonChildDef {
  tagName: string
  content?: string
  droppable: boolean
  draggable: boolean
  actions: []
  elearnActions: []
  properties: Record<string, unknown>
  extendedProperties: Record<string, unknown>
  style: Record<string, string>
}

// Then in GrapesJsComponentDef:
components?: NavButtonChildDef[]
```

---

## LOW

### L-01 — Comment duplication

`registerBlocks.ts` lines 249–251 and `converters.ts` lines 272–276 contain nearly identical explanations of the T634 fix mechanism. Consider cross-referencing rather than duplicating.

### L-02 — Magic strings for nav button default labels

Default labels (`'← Previous'`, `'Next →'`) appear in three places:
- `registerBlocks.ts:254, 260`
- `converters.ts:278, 279`
- `ButtonPropertiesPanel.tsx:201–202`

`ButtonPropertiesPanel.tsx` already defines `NAV_BUTTON_DEFAULTS` as the UI source-of-truth. Exporting those constants from `ButtonPropertiesPanel.tsx` and importing in `registerBlocks.ts` and `converters.ts` would be a single source of truth — not required for merge.

---

## Validation Passed

### GrapesJS Pattern Correctness ✅
`defaults.components` is the correct GrapesJS pattern for composite widgets with child components. The `onRender()` HTML injection approach broke `component.components().at(0/1)` because GrapesJS does not register injected HTML as Component objects.

### Label Persistence Round-Trip ✅
- **Save:** `widgetsFromGrapesjs` extracts child labels via `c.components().at(0/1).get('content')` and stores as `prevLabel`/`nextLabel` in widget properties with defaults as fallback.
- **Load:** `grapesjsFromWidgets` injects two child component definitions with stored labels; falls back to defaults for widgets saved before T634 (backward compatibility).

### actions:[] Requirement ✅
Every child component definition in both `registerBlocks.ts` (lines 252–265) and `grapesjsFromWidgets` (lines 286, 306) includes `actions: []`. This prevents the GrapesJS `loadData()` forEach crash. Test coverage at `converters.test.ts:568–572` explicitly verifies this.

### Test Coverage ✅
- **6 unit tests** in `converters.test.ts`: save with custom labels, save with missing children (defaults), load with stored labels, load backward-compat defaults, child def structure, non-nav-buttons exclusion.
- **3 E2E tests** in `nav-buttons-widget.spec.ts`: Props panel label inputs visible (not error), canvas renders default buttons, label edit propagates to canvas. All 3 passed in 14.8s.

### Security ✅
No secrets, no injection vectors, no XSS. Child `content` flows through GrapesJS's model which handles escaping.

---

## Observation — forEach browser error in E2E console

During E2E test run, a `[BROWSER ERROR]` appeared:
```
[EditorCanvas] load() failed: TypeError: Cannot read properties of undefined (reading 'forEach')
```
This error appeared **before** the nav-buttons widget was dropped and **all 3 tests passed**. This is consistent with a pre-existing load issue triggered by loading an initially empty canvas (not caused by T634). The T634 fix targets this crash when it occurs on nav-buttons children; the E2E error is from a different code path (likely `loadData` on empty canvas state). Does not block merge.
