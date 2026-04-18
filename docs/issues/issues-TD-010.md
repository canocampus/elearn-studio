# Self-Review — TD-010: PropertiesPanels stack empty-state placeholders

**Status:** RESOLVED — empty states centralised
**Date:** 2026-04-18
**Version:** v0.5.63
**Commit:** `d3361d6` (bundled with TD-009 race #3)
**Trigger:** Surfaced while building `e2e/tests/docs-screenshots.spec.ts` — every Properties panel screenshot showed 6 stacked "Select a X widget" placeholders below the one real panel.

---

## Context

Each of the 7 `*PropertiesPanel` components had this shape at the top of its render:

```tsx
if (!editor || !selectedComponentType || !isButtonWidgetType(selectedComponentType)) {
  return <div>Select a button widget to edit its properties.</div>
}
```

`AppLayout.tsx` rendered all 7 panels side-by-side in the Props tab. Selecting ONE widget therefore produced: 1 real panel + 6 "Select a X widget" placeholders stacked below. Authors had to scroll past a wall of dead copy, and the UI looked broken.

## Fix — centralised empty-state

### Step 1: 6 panels return `null` when they don't apply

The 6 previously-stacking panels now return `null`:

- `QuestionPropertiesPanel.tsx`
- `ButtonPropertiesPanel.tsx`
- `MediaPlayerPropertiesPanel.tsx`
- `AudioNarrationPropertiesPanel.tsx`
- `ProgressBarPropertiesPanel.tsx`
- `VolumeControlPropertiesPanel.tsx`

(`PhaserSimPropertiesPanel` already returned `null` — untouched.)

### Step 2: centralised helpers in a new module

`packages/authoring-ui/src/components/layout/propsEmptyState.tsx` exports:

```ts
export function hasCustomPropsPanel(type: string | null): boolean
export function PropsEmptyState({ selectedType }: { selectedType: string | null })
```

`hasCustomPropsPanel` returns `true` only for the 11 widget families that ship a dedicated Props panel (`question-mc`, `question-tf`, `question-fill`, `phaser-sim`, `button`, `done-button`, `nav-buttons`, `media-player`, `audio-narration`, `progress-bar`, `volume-control`). Everything else (text, image, rectangle, score-quiz, score-field, screenshot-sim) → `false`. `null` → `false`.

`PropsEmptyState` renders ONE centred `<div data-testid="props-empty-state">` with one of two messages:

- Nothing selected → "Select a widget on the canvas to edit its properties."
- Selected type has no custom panel → "This widget has no dedicated properties. Use the Styles tab to change its appearance."

### Step 3: AppLayout wires the router

```tsx
const selectedComponentType = useEditorStore(s => s.selectedComponentType)
const propsHasCustomPanel = hasCustomPropsPanel(selectedComponentType)
// ...
{propsHasCustomPanel ? (
  <>
    <PanelErrorBoundary name="QuestionPropertiesPanel"><QuestionPropertiesPanel /></PanelErrorBoundary>
    {/* …6 more panels, each wrapped in PanelErrorBoundary… */}
  </>
) : (
  <PropsEmptyState selectedType={selectedComponentType} />
)}
```

## Why a separate module (`propsEmptyState.tsx`) instead of putting the helpers in `AppLayout.tsx`

The new unit-test file needed to import `hasCustomPropsPanel` and `<PropsEmptyState>`. Importing from `AppLayout.tsx` drags the full AppLayout tree into the test's module graph — including `SimulationEditor` → `react-konva` → `konva`. `konva` requires the native `canvas` module at import time, which is not installed in the authoring-ui vitest environment (and is expensive to add just for a test). Extracting the two tiny helpers into their own file eliminates the transitive dep entirely.

## Regression guards

### Unit — `packages/authoring-ui/src/__tests__/layout/PropsEmptyState.test.tsx` (6 tests)

- `hasCustomPropsPanel` returns `true` for all 11 custom-panel widget families.
- `hasCustomPropsPanel` returns `false` for text, image, rectangle, score-quiz, score-field, screenshot-sim.
- `hasCustomPropsPanel(null)` returns `false`.
- `PropsEmptyState` with `selectedType={null}` renders the "Select a widget" copy.
- `PropsEmptyState` with `selectedType="text"` renders the "Styles tab" copy.
- `PropsEmptyState` renders exactly one `[data-testid="props-empty-state"]` node (pins the "no stacking" invariant).

### Unit — `packages/authoring-ui/src/__tests__/sidebar/SidebarPanels.test.tsx` (7 suites updated)

The 7 panel test suites that previously asserted the fallback text now assert `container.firstChild === null` when the panel does not apply.

## TD-009 interaction (discovered during verification)

Moving `selectedComponentType` into AppLayout added re-renders that widened a pre-existing async window in `EditorCanvas`, turning a latent race into a deterministic failure of `widget-persistence-across-slides.spec.ts`. That is the race #3 documented in `issues-TD-009.md` (imperative `data-editor-ready="false"` flip). The fix ships in the same commit (`d3361d6`) so the persistence guard stays green under the new AppLayout behaviour.

## Verification matrix

| Check | Result |
|---|---|
| `npx tsc -b` | exit 0 |
| authoring-ui vitest | 763 → **769/769** across 34 files (+1 file, +6 tests) |
| runtime-player vitest | **265/265** (unchanged) |
| E2E `widget-persistence-across-slides` | 2/2 pass |
| E2E `docs-screenshots` | still green |

## CRITICAL / HIGH / MEDIUM / LOW

0 open.

---

**Reopen criteria:** a new PropertiesPanel is added that renders its own empty-state fallback instead of delegating to the centralised component; or `PropsEmptyState.test.tsx` fails.
