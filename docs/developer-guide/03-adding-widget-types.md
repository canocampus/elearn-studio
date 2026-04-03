# Adding Widget Types

Covers the full path from GrapesJS block registration to runtime player rendering.

> **Note:** This guide uses `flip-card` as a **hypothetical worked example**. It does not exist in the codebase — replace `flip-card` with your actual widget type name throughout these examples. Refer to the existing `text` widget in `packages/authoring-ui/src/editor/registerBlocks.ts` as a real reference implementation.

When you need this: you're adding a new interactive element (e.g., a hotspot map, a flip card, a timeline) that authors drag onto the slide canvas and learners interact with in the LMS.

---

## Overview

Every widget type requires changes in **five** places (steps 1–4 are mandatory, step 5 if the widget has a properties panel):

```
1. packages/authoring-ui/src/editor/registerBlocks.ts   — GrapesJS Block + Component
2. packages/authoring-ui/src/editor/converters.ts        — Widget ↔ GrapesJS converter
3. packages/authoring-ui/src/types/course.ts             — TypeScript type union
4. packages/runtime-player/src/                          — Runtime renderer
5. backend/api/src/models/Widget.ts                      — Backend WIDGET_TYPES enum
```

Optionally, if the widget has configurable properties:
```
6. packages/authoring-ui/src/components/sidebar/         — Properties panel
```

> **Do not skip step 5.** The backend validates `widget.type` against the `WIDGET_TYPES` enum in `Widget.ts`. If the new type is not listed there, every `PATCH /courses/:id` call that includes the widget will return `500`. This mistake was discovered during T607 (audio-narration) when the widget was fully working in the editor but silently rejected by the API on save.

---

## Step 1 — Register the GrapesJS Block and Component

Add to `packages/authoring-ui/src/editor/registerBlocks.ts`:

```typescript
// 1a. Register the Block (shows in the left palette)
editor.BlockManager.add('flip-card', {
  label: 'Flip Card',
  category: 'Interactive',
  media: ICONS.flipCard,  // add your SVG icon to the ICONS map above
  content: { type: 'flip-card' },
})

// 1b. Register the Component Type (defines model defaults + canvas preview)
editor.Components.addType('flip-card', {
  model: {
    defaults: {
      tagName: 'div',
      droppable: false,
      // GrapesJS traits expose fields in the right-sidebar Properties panel
      traits: [
        { name: 'frontText', label: 'Front text', type: 'text', default: 'Front' },
        { name: 'backText',  label: 'Back text',  type: 'text', default: 'Back' },
      ],
      // Custom data fields stored alongside GrapesJS component data
      frontText: 'Front',
      backText: 'Back',
    },
  },
  view: {
    onRender() {
      // Renders a static preview inside the GrapesJS canvas iframe
      // The canvas is an iframe — no React context here. Use native DOM only.
      const el = this.el as HTMLElement
      el.style.cssText = 'background:#3B82F6;color:#fff;display:flex;align-items:center;justify-content:center;border-radius:4px;font-size:14px;cursor:pointer;'
      el.textContent = this.model.get('frontText') || 'Flip Card'
    },
  },
})
```

> The GrapesJS canvas is an `<iframe>`. React components cannot render inside it. Use native DOM APIs in `view.onRender()`.

---

## Step 2 — Add the TypeScript type

In `packages/authoring-ui/src/types/course.ts`, add to the `WidgetType` union and create the extended properties interface:

```typescript
// Add to the WidgetType union
export type WidgetType =
  | 'text' | 'image' | 'button' | 'done-button' | 'nav-buttons' | 'rectangle'
  | 'question-mc' | 'question-tf' | 'question-fill' | 'question-match'
  | 'media-player' | 'audio-narration' | 'progress-bar' | 'volume-control'
  | 'score-display'
  | 'screenshot-sim' | 'phaser-sim'
  | 'flip-card'   // ← add here

// Add the extended properties interface
export interface FlipCardExtendedProps {
  frontText: string
  backText: string
}
```

## Step 2b — Add the type to the backend enum

In `backend/api/src/models/Widget.ts`, add the new type to the `WIDGET_TYPES` enum:

```typescript
export enum WIDGET_TYPES {
  // ... existing types ...
  FLIP_CARD = 'flip-card',   // ← add here
}
```

The Mongoose schema uses this enum to validate `widget.type` on every PATCH. Omitting this step causes `500` errors on save — see overview note above.

---

## Step 3 — Update the GrapesJS ↔ Widget converters

In `packages/authoring-ui/src/editor/converters.ts`, `widgetsFromGrapesjs` already handles all widget types generically via `c.get('extendedProperties')`. Verify the new component stores its custom data in `extendedProperties` within the Component Type's `model.defaults` object:

```typescript
// In registerBlocks.ts — model defaults for flip-card
defaults: {
  // ...
  extendedProperties: {
    frontText: 'Front',
    backText: 'Back',
  },
},
```

If your widget has properties that change via traits, sync trait changes back to `extendedProperties`:

```typescript
// In the Component Type model
init() {
  this.listenTo(this, 'change:frontText change:backText', () => {
    this.set('extendedProperties', {
      frontText: this.get('frontText'),
      backText: this.get('backText'),
    })
  })
},
```

---

## Step 4 — Add the runtime player renderer

In `packages/runtime-player/src/`, create a renderer file for the new type:

```typescript
// packages/runtime-player/src/widgets/flipCardWidget.ts

import type { BaseWidget } from '../types'

export function renderFlipCard(container: HTMLElement, widget: BaseWidget): void {
  const { frontText, backText } = widget.extendedProperties as {
    frontText: string
    backText: string
  }

  let flipped = false

  const el = document.createElement('div')
  el.style.cssText = `
    width: 100%; height: 100%;
    background: #3B82F6; color: #fff;
    display: flex; align-items: center; justify-content: center;
    border-radius: 4px; cursor: pointer; font-size: 14px;
    user-select: none;
  `
  el.textContent = frontText

  el.addEventListener('click', () => {
    flipped = !flipped
    el.textContent = flipped ? backText : frontText
    el.style.background = flipped ? '#10B981' : '#3B82F6'
  })

  container.appendChild(el)
}
```

Register the renderer in `packages/runtime-player/src/index.ts`:

```typescript
import { renderFlipCard } from './widgets/flipCardWidget'

// Inside the renderWidget switch/map:
case 'flip-card':
  renderFlipCard(container, widget)
  break
```

---

## Step 5 — Add a Properties panel (optional)

If the widget has properties too complex for GrapesJS traits (e.g., nested arrays, color pickers, file pickers), add a React sidebar panel.

**Always use the `useExtendedProperties` hook** to read and write `extendedProperties`. Using a plain variable (no `useState`) is the root cause of the T602 regression — React never re-renders, every user edit is silently reverted by the stale closure on the next render cycle.

```typescript
// packages/authoring-ui/src/components/sidebar/FlipCardPropertiesPanel.tsx

import { useExtendedProperties } from '../../hooks/useExtendedProperties'

interface FlipCardEP {
  frontText: string
  backText: string
}

export function FlipCardPropertiesPanel() {
  const [props, setProps] = useExtendedProperties<FlipCardEP>({
    frontText: 'Front',
    backText: 'Back',
  })

  return (
    <div data-testid="flip-card-properties-panel">
      <label>Front text</label>
      <input
        value={props.frontText}
        onChange={e => setProps({ frontText: e.target.value })}
      />
      <label>Back text</label>
      <input
        value={props.backText}
        onChange={e => setProps({ backText: e.target.value })}
      />
    </div>
  )
}
```

The `useExtendedProperties` hook (in `packages/authoring-ui/src/hooks/`) subscribes to the GrapesJS model via `component:update`, writes changes back with `component.set('extendedProperties', next)`, and includes an `isLocalRef` guard to prevent the update-subscription loop.

Wire the panel in `packages/authoring-ui/src/components/sidebar/PropertiesPanel.tsx`:

```typescript
// In the switch/conditional that selects the panel:
if (selectedType === 'flip-card') return <FlipCardPropertiesPanel />
```

And export a type guard from the panel file for the selector:

```typescript
export function isFlipCardWidgetType(type: string): boolean {
  return type === 'flip-card'
}
```

---

## Checklist — all places to update

- [ ] `packages/authoring-ui/src/editor/registerBlocks.ts` — Block + Component registration
- [ ] `packages/authoring-ui/src/types/course.ts` — `WidgetType` union + `ExtendedProps` interface
- [ ] **`backend/api/src/models/Widget.ts`** — `WIDGET_TYPES` enum (causes 500 on save if omitted)
- [ ] `packages/authoring-ui/src/editor/converters.ts` — verify `extendedProperties` roundtrip
- [ ] `packages/runtime-player/src/widgets/<type>Widget.ts` — renderer
- [ ] `packages/runtime-player/src/index.ts` — register renderer in widget switch
- [ ] `packages/authoring-ui/src/components/sidebar/` — properties panel using `useExtendedProperties` hook (if needed)
- [ ] Unit test for the renderer in `packages/runtime-player/src/__tests__/`
- [ ] E2E test covering: block visible, props panel opens, extendedProperties survive reload

### Special whitelists to check

Two additional whitelists in `converters.ts` may need updating depending on the widget:

| Whitelist constant | What it controls | Add your type if... |
|---|---|---|
| `WIDGETS_WITH_SRC_TRAIT` | Widgets that carry a `src` HTML attribute (audio/video/image source) | Your widget renders `<audio src>`, `<video src>`, or `<img src>` |
| `GENERATED_CONTENT_TYPES` | Widgets whose `innerHTML` is generated by `view.onRender()`, not authored as HTML | Your widget uses `onRender()` to build a DOM preview (not editable text) |

If your widget type belongs in `GENERATED_CONTENT_TYPES`, the converter discards `innerHTML` during save (correct) and rebuilds it from `extendedProperties` during load. If you forget this, you may see stale HTML bleed into saves.

If your widget type belongs in `WIDGETS_WITH_SRC_TRAIT`, the converter preserves the `src` attribute during the GrapesJS ↔ Widget round-trip. Omitting this causes `src` to be dropped on reload (the T607 bug that affected `media-player` and `audio-narration`).

---

## GrapesJS API contract risks

GrapesJS exposes a **Backbone.js-derived component model** that is not covered by
TypeScript's type system at runtime. Several internal APIs are called throughout
the codebase and must be re-verified on every GrapesJS major version upgrade.

### Contract-tested APIs

The following five APIs are explicitly exercised by
`packages/authoring-ui/src/__tests__/grapesjs-contracts.test.ts` (tagged
`@grapesjs-contract` in test names). If GrapesJS changes the signature or
return type of any of these, those tests will fail before the breakage reaches
production:

| API | Used in | Risk |
|---|---|---|
| `component.toArray()` | `converters.ts` — iterating child components | Returns `Component[]`; may become an iterator or change shape |
| `component.getInnerHTML()` | `converters.ts` — serialising text content | May return `undefined` instead of `''` in newer builds |
| `editor.StorageManager.add(type, plugin)` | `storageManager.ts` — registering the custom storage driver | Signature changed between GrapesJS 0.20 and 0.21 |
| `component.listenTo(target, event, cb)` | `registerBlocks.ts` — reactive property sync | Backbone `listenTo` may be removed in a future non-Backbone rewrite |
| `component.getId()` | `converters.ts` — unique widget ID for `Widget.id` | Returns a string; could become `undefined` if component is detached |

### What to do on a GrapesJS upgrade

1. Run `pnpm --filter authoring-ui test --run` immediately after bumping the
   version. The `@grapesjs-contract` tests will catch any broken API.
2. If any contract test fails, **do not proceed** — the converters or storage
   manager will silently corrupt slide data until fixed.
3. Check the GrapesJS changelog for the specific API that failed. The fix is
   usually a one-line call-site change in `converters.ts` or `storageManager.ts`.
4. Update the contract test to match the new signature, then re-run to confirm
   green.

### Why these APIs are fragile

GrapesJS uses Backbone.js internally. The TypeScript types published by
`@types/grapesjs` are hand-maintained community types and **lag behind the
actual GrapesJS releases by months**. This means:

- TypeScript will not catch a removed method at compile time.
- The component model APIs (`toArray`, `getInnerHTML`, `getId`) are not in the
  official GrapesJS public API surface — they are Backbone model methods that
  GrapesJS exposes informally.
- `editor.StorageManager.add()` has a documented interface but its option bag
  has changed in minor releases without a major version bump.

The contract tests exist precisely because the TypeScript compiler cannot
protect against these runtime changes.
