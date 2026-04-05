# Adding Widget Types

Covers the full path from GrapesJS block registration to runtime player rendering.

> **Note:** This guide uses `flip-card` as a **hypothetical worked example**. It does not exist in the codebase — replace `flip-card` with your actual widget type name throughout these examples. Refer to the existing `text` widget in `packages/authoring-ui/src/editor/registerBlocks.ts` as a real reference implementation.

When you need this: you're adding a new interactive element (e.g., a hotspot map, a flip card, a timeline) that authors drag onto the slide canvas and learners interact with in the LMS.

---

## Overview

Every widget type requires changes in **five** places (steps 1–4 are mandatory, step 5 if the widget has a properties panel):

```
1. packages/shared-types/src/widgets.ts                  — Add to Widget union type
2. packages/authoring-ui/src/editor/registerBlocks.ts   — GrapesJS Block + Component
3. packages/authoring-ui/src/editor/converters.ts        — Widget ↔ GrapesJS converter
4. packages/runtime-player/src/                          — Runtime renderer
5. backend/api/src/models/Widget.ts                      — Backend WIDGET_TYPES enum
```

Optionally, if the widget has configurable properties:
```
6. packages/authoring-ui/src/components/sidebar/         — Properties panel
```

> **Do not skip steps 1 and 5.** All widget types are defined in the centralized `@elearn-studio/shared-types` package. The backend validates `widget.type` against the `WIDGET_TYPES` enum in `Widget.ts`. If the new type is not listed in either location, every `PATCH /courses/:id` call that includes the widget will return `500`. This mistake was discovered during T607 (audio-narration) when the widget was fully working in the editor but silently rejected by the API on save.

---

## Step 1 — Add the type to shared-types

All widget types are centralized in `packages/shared-types/src/widgets.ts`. Add your widget type to the `Widget` discriminated union:

```typescript
// packages/shared-types/src/widgets.ts

export interface FlipCardWidget extends BaseWidget {
  type: 'flip-card'
  extendedProperties: {
    frontText: string
    backText: string
  }
}

export type Widget =
  | TextWidget
  | ImageWidget
  | ... existing types ...
  | FlipCardWidget  // ← add here
```

Then rebuild the shared-types package so all dependents can import the new type:

```bash
pnpm --filter shared-types build
```

---

## Step 2 — Register the GrapesJS Block and Component

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

## Step 3 — Add the type to the backend whitelist

In `backend/api/src/models/Widget.ts`, add the new type to the `WIDGET_TYPES` const array:

```typescript
export const WIDGET_TYPES = [
  // ... existing types ...
  'flip-card',   // ← add here
] as const
```

The Mongoose schema uses this array to validate `widget.type` on every PATCH. Omitting this step causes `500` errors on save — see overview note above.

---

## Step 4 — Update the GrapesJS ↔ Widget converters

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

## Step 5 — Add the runtime player renderer

In `packages/runtime-player/src/`, create a renderer file for the new type:

```typescript
// packages/runtime-player/src/widgets/flipCardWidget.ts

import type { BaseWidget } from '@elearn-studio/shared-types'

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

## Step 6 — Add a Properties panel (optional)

If the widget has properties too complex for GrapesJS traits (e.g., nested arrays, color pickers, file pickers), add a React sidebar panel.

**Always use the `useExtendedProperties` hook** to read and write `extendedProperties`. Using a plain variable (no `useState`) is the root cause of the T602 regression — React never re-renders, every user edit is silently reverted by the stale closure on the next render cycle.

```typescript
// packages/authoring-ui/src/components/sidebar/FlipCardPropertiesPanel.tsx

import { useExtendedProperties } from '../QuestionPropertiesPanel'  // Defined inline in that file

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

The `useExtendedProperties` hook (defined inline in `packages/authoring-ui/src/components/sidebar/QuestionPropertiesPanel.tsx`) subscribes to the GrapesJS model via `change:extendedProperties` events, writes changes back with `component.set('extendedProperties', next)`, and includes an `isLocalRef` guard to prevent the update-subscription loop. If you need this hook in multiple properties panels, consider extracting it to `packages/authoring-ui/src/hooks/useExtendedProperties.ts`.

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

- [ ] **`packages/shared-types/src/widgets.ts`** — Add to `Widget` union + interface (required for all packages to import)
- [ ] `pnpm --filter shared-types build` — Rebuild to publish new type
- [ ] `packages/authoring-ui/src/editor/registerBlocks.ts` — Block + Component registration
- [ ] **`backend/api/src/models/Widget.ts`** — `WIDGET_TYPES` enum (causes 500 on save if omitted)
- [ ] `packages/authoring-ui/src/editor/converters.ts` — verify `extendedProperties` roundtrip
- [ ] `packages/runtime-player/src/widgets/<type>Widget.ts` — renderer (import types from `@elearn-studio/shared-types`)
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

### Media Widget Source Resolution (Garage / S3 presigned URLs)

**Why `src` cannot be stored as a raw path**

Garage, the S3-compatible asset storage, serves all media files via presigned URLs. These URLs expire after a short period (typically 1 hour). The raw path (e.g., `/assets/my-video.mp4`) must be resolved to a presigned URL at **render time**, not at save time. Storing a presigned URL in the database is futile — it will be expired by the time the author reloads the slide or the learner plays the course.

**The `WIDGETS_WITH_SRC_TRAIT` whitelist**

From `packages/authoring-ui/src/editor/converters.ts`:

```typescript
const WIDGETS_WITH_SRC_TRAIT = new Set(['image', 'media-player', 'audio-narration'])
```

This whitelist controls which widget types have `src` as a GrapesJS component trait (a model-level attribute). When the converter restores a slide on load, it only sets the `src` attribute on components in this set:

```typescript
// From grapesjsFromWidgets()
const WIDGETS_WITH_SRC_TRAIT = new Set(['image', 'media-player', 'audio-narration'])
if (WIDGETS_WITH_SRC_TRAIT.has(w.type) && typeof props?.src === 'string' && props.src) {
  def.src = props.src  // ← Triggers change:src event on load
}
```

Setting `src` as a root-level GrapesJS model attribute is essential because it triggers the `change:src` event, which fires the presigned-URL resolution handler.

**How presigned URL resolution works at render time**

From `packages/authoring-ui/src/editor/registerBlocks.ts` (image widget implementation):

```typescript
view: {
  initialize(props: unknown) {
    // Register a listener for the change:src event
    ;(this as any).listenTo(
      (this as any).model,
      'change:src',
      (this as any).resolveAndSetSrc.bind(this as any),
    )
  },

  onRender() {
    // Trigger presigned URL resolution on initial mount
    (this as any).resolveAndSetSrc()
  },

  resolveAndSetSrc(this: unknown) {
    // Read the asset path (e.g., '/assets/my-image.png')
    const src: string = ((this as any).model.get('src') as string) ?? ''
    if (!src.startsWith('/assets/')) return
    const objectName = src.slice('/assets/'.length)
    const el = (this as any).el as HTMLElement

    // Fetch the presigned URL asynchronously
    resolveAssetUrl(objectName)
      .then((presignedUrl: string) => {
        // STALE DOM REFERENCE GUARD:
        // If the component was removed from the canvas while the request
        // was in-flight, el.isConnected will be false. Do not try to update
        // a detached DOM node — it is wasted work and masks real errors.
        if (!el.isConnected) return
        el.setAttribute('src', presignedUrl)
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn('[registerBlocks] resolveAndSetSrc failed for', objectName, '—', msg)
      })
  },
}
```

**Key points:**

1. The `initialize()` hook registers a listener on `change:src` so resolution is triggered whenever the author changes the image/audio/video file.
2. The `onRender()` hook calls `resolveAndSetSrc()` once on mount to handle the initial load case.
3. The `resolveAndSetSrc()` method checks `el.isConnected` before updating the DOM — this is the **stale DOM reference guard**. If the component was removed from the canvas while the fetch was in-flight, the guard prevents a crash or silent error.
4. On error, the handler logs a warning with the specific error message (network timeout, 401, 403, 500, etc.) so the author can diagnose the issue.

**When to add your widget type to `WIDGETS_WITH_SRC_TRAIT`**

Add your widget type to the whitelist if it:
- Renders an `<img src>`, `<audio src>`, or `<video src>` element
- Stores the asset path (e.g., `/assets/my-file.ext`) in `properties.src` or `extendedProperties`
- Needs the `src` attribute to be resolved to a presigned URL on load and on every file change

If you do NOT add your widget type to the whitelist but the widget stores `src` in `properties`, the `src` value will still be captured and saved to the database (via `widgetsFromGrapesjs`), but it will NOT be restored as a GrapesJS model attribute on load. The result: the change:src event never fires, and presigned-URL resolution never happens. The browser will try to load `/assets/my-file.ext` directly — which fails because the path is not publicly accessible without a presigned URL. Authors will see a broken image/audio/video in the slide preview, and learners will see the same in the LMS.

**TTL / caching considerations**

Presigned URLs expire. Do not cache them in component state beyond the current session. Each time a slide loads (or an author changes a file), the presigned URL must be fetched fresh from the backend. The `resolveAssetUrl()` call happens asynchronously on every mount and on every `change:src` event — this is correct and intentional.

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
