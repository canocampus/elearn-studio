# Adding Widget Types

Covers the full path from GrapesJS block registration to runtime player rendering.

> **Note:** This guide uses `flip-card` as a **hypothetical worked example**. It does not exist in the codebase — replace `flip-card` with your actual widget type name throughout these examples. Refer to the existing `text` widget in `packages/authoring-ui/src/editor/registerBlocks.ts` as a real reference implementation.

When you need this: you're adding a new interactive element (e.g., a hotspot map, a flip card, a timeline) that authors drag onto the slide canvas and learners interact with in the LMS.

---

## Overview

Every widget type requires changes in four places:

```
1. packages/authoring-ui/src/editor/registerBlocks.ts   — GrapesJS Block + Component
2. packages/authoring-ui/src/editor/converters.ts        — Widget ↔ GrapesJS converter
3. packages/authoring-ui/src/types/course.ts             — TypeScript type union
4. packages/runtime-player/src/                          — Runtime renderer
```

Optionally, if the widget has configurable properties:
```
5. packages/authoring-ui/src/components/sidebar/         — Properties panel
```

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
  | 'text' | 'image' | 'button' | 'rectangle'
  | 'question-mc' | 'question-tf' | 'question-fill' | 'question-match'
  | 'screenshot-sim' | 'phaser-sim'
  | 'flip-card'   // ← add here

// Add the extended properties interface
export interface FlipCardExtendedProps {
  frontText: string
  backText: string
}
```

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

If the widget has properties too complex for GrapesJS traits (e.g., nested arrays), add a React sidebar panel:

```typescript
// packages/authoring-ui/src/components/sidebar/FlipCardPropertiesPanel.tsx

import { useEditorStore } from '../../store/editorStore'

export function FlipCardPropertiesPanel() {
  const { selectedWidget, updateWidgetProps } = useEditorStore()
  if (selectedWidget?.type !== 'flip-card') return null

  const { frontText, backText } = selectedWidget.extendedProperties as FlipCardExtendedProps

  return (
    <div className="properties-panel">
      <label>Front text</label>
      <input
        value={frontText}
        onChange={e => updateWidgetProps({ frontText: e.target.value })}
      />
      <label>Back text</label>
      <input
        value={backText}
        onChange={e => updateWidgetProps({ backText: e.target.value })}
      />
    </div>
  )
}
```

Render this panel from `packages/authoring-ui/src/components/sidebar/PropertiesPanel.tsx` when `selectedWidget.type === 'flip-card'`.

---

## Checklist — all places to update

- [ ] `packages/authoring-ui/src/editor/registerBlocks.ts` — Block + Component registration
- [ ] `packages/authoring-ui/src/types/course.ts` — `WidgetType` union + `ExtendedProps` interface
- [ ] `packages/authoring-ui/src/editor/converters.ts` — verify `extendedProperties` roundtrip
- [ ] `packages/runtime-player/src/widgets/<type>Widget.ts` — renderer
- [ ] `packages/runtime-player/src/index.ts` — register renderer in widget switch
- [ ] `packages/authoring-ui/src/components/sidebar/` — properties panel (if needed)
- [ ] Unit test for the renderer in `packages/runtime-player/src/__tests__/`
- [ ] Unit test for extended props in `packages/authoring-ui/src/__tests__/`

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
