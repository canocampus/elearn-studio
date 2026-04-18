/**
 * Bidirectional converters between GrapesJS component tree and eLearn Studio Widget schema.
 * T011.4 — Bidirectional converter implementation.
 * T011.5 — Preserve all Widget fields: id, type, bounds, layer, visible, properties, actions, extendedProperties.
 */

import type { Component } from 'grapesjs'
import type { BaseWidget, Bounds, WidgetType } from '../types/course'

/**
 * Shape of a GrapesJS component definition as produced by grapesjsFromWidgets.
 * GrapesJS accepts plain objects here; we type them so callers are not forced to use `any`.
 */
export interface GrapesJsComponentDef {
  type: string
  attributes: Record<string, unknown>
  /**
   * Full CSS style for this component.
   * Always contains the layout keys: position, left, top, width, height, z-index, display.
   * Also contains any decorative CSS restored from widget.properties.style
   * (font-family, color, background-color, border, padding, etc.).
   */
  style: Record<string, string | number>
  /** GrapesJS inner HTML content — used by text/button types to render stored HTML. */
  content?: string
  /** Root-level GrapesJS src for image components — triggers change:src and presigned-URL resolution. */
  src?: string
  /**
   * Child component definitions — used by composite widget types (e.g. nav-buttons)
   * that own proper GrapesJS child components rather than raw innerHTML.
   * Each child must include `actions: []` to prevent the GrapesJS loadData forEach crash.
   */
  components?: NavButtonChildDef[]
  properties?: BaseWidget['properties']
  /** GrapesJS-native actions field — always empty array to prevent loadData forEach crash. */
  actions: []
  /** Our ActionSequence[] stored under a separate key to avoid GrapesJS key collision. */
  elearnActions: BaseWidget['actions']
  extendedProperties: BaseWidget['extendedProperties']
}

/**
 * Typed shape for nav-buttons child component definitions.
 * Used as the element type of `GrapesJsComponentDef.components`.
 */
export interface NavButtonChildDef {
  tagName: string
  content: string
  droppable: boolean
  draggable: boolean
  actions: []
  elearnActions: []
  // GrapesJS Style Manager PropertyComposite expects an array here
  // (this.get('properties') || []).forEach(...). See the omit-on-load logic
  // in grapesjsFromWidgets() below. The defaults in registerBlocks.ts use []
  // uniformly across all widget types.
  properties: []
  extendedProperties: Record<string, unknown>
  style: Record<string, string>
}

/**
 * Default labels for the nav-buttons Previous / Next children.
 * Single source of truth — imported by registerBlocks.ts and ButtonPropertiesPanel.tsx.
 */
export const NAV_BUTTON_DEFAULTS = {
  prevLabel: '← Previous',
  nextLabel: 'Next →',
} as const

/** Parses a CSS pixel value string, returning `fallback` if NaN or missing. */
function parsePx(value: string | undefined, fallback: number): number {
  const n = parseInt(value ?? '', 10)
  return isNaN(n) ? fallback : n
}

/**
 * Widget types whose GrapesJS `content` attribute is a generated HTML preview,
 * not user-edited content. We must NOT capture their content back into properties
 * or it will overwrite the user's actual data on the next store() cycle.
 */
const GENERATED_CONTENT_TYPES = new Set([
  'question-mc', 'question-tf', 'question-fill',
  'progress-bar', 'audio-narration', 'volume-control',
  'nav-buttons', 'score-quiz', 'score-field', 'media-player',
  // T643.1: phaser-sim and screenshot-sim render a PLACEHOLDER_HTML as their canvas
  // preview. That HTML must never be captured into widget.properties.content — if it
  // is, grapesjsFromWidgets() sets def.content on reload, GrapesJS parses the multi-
  // element HTML into child component defs that lack actions:[], and loadData crashes
  // with "Cannot read properties of undefined (reading 'forEach')".
  'phaser-sim', 'screenshot-sim',
])

/**
 * Widget types whose CSS `display` value must be 'flex' rather than 'block'.
 * This map is consulted by grapesjsFromWidgets to restore the correct display
 * value when reloading a slide — GrapesJS overrides the component type's default
 * style with whatever is in the component definition, so we must be explicit.
 */
const FLEX_DISPLAY_TYPES = new Set(['nav-buttons', 'score-field'])

/**
 * CSS properties that encode widget layout (position, size, stacking, visibility).
 * These are stored in the structured fields bounds / layer / visible and must NOT
 * be included in the saved decorative-style snapshot — they are always re-derived
 * from those fields by grapesjsFromWidgets on load.
 */
const LAYOUT_STYLE_KEYS = new Set(['position', 'left', 'top', 'width', 'height', 'z-index', 'display'])

/**
 * GrapesJS-internal attributes and custom eLearn model fields that should NOT be
 * persisted into the widget properties via c.getAttributes().
 *
 * GrapesJS Backbone model: calling component.set('extendedProperties', ...) places
 * the value into the Backbone attributes hash, which c.getAttributes() then returns.
 * If we allow extendedProperties / elearnActions / properties to flow into mergedProps
 * they get persisted as widget.properties keys, and on the next load grapesjsFromWidgets
 * would copy them into the GrapesJS component def's `attributes` field — where GrapesJS
 * tries to process them as HTML element attributes, crashing with "Cannot read properties
 * of undefined (reading 'forEach')" inside loadData (T601.8 regression).
 */
const INTERNAL_GJS_ATTRS = new Set([
  'id', 'class', 'style', 'src',
  'extendedProperties', 'elearnActions', 'actions', 'properties',
])

/**
 * Converts a flat list of GrapesJS components into eLearn Studio Widgets.
 * Recursively traverses the tree if necessary, though our current model is mostly flat.
 *
 * IMPORTANT: GrapesJS stores user-edited text in c.get('content') and the image URL
 * in c.get('src') as root-level model attributes — NOT inside c.get('properties').
 * We must capture both and merge them into the properties map so they survive the
 * store → backend → load round-trip without data loss.
 */
export function widgetsFromGrapesjs(components: Component[]): BaseWidget[] {
  return components.map((c) => {
    const style = c.getStyle()

    // Parse bounds from CSS styles; parsePx guards against NaN from malformed values
    const bounds: Bounds = {
      x: parsePx(typeof style.left === 'string' ? style.left : undefined, 0),
      y: parsePx(typeof style.top === 'string' ? style.top : undefined, 0),
      width: parsePx(typeof style.width === 'string' ? style.width : undefined, 100),
      height: parsePx(typeof style.height === 'string' ? style.height : undefined, 50),
    }

    const componentType = (c.get('type') as string) || ''

    // Read GrapesJS-native model attributes that are NOT stored in properties.
    // c.get('content') holds user-edited innerHTML for text/button/nav-button types.
    // However, if the user adds HTML tags (bold, links), GrapesJS may move them to 
    // the components tree. c.getInnerHTML() is the authoritative way to get the content.
    // Fall back to c.get('content') if getInnerHTML is not available (e.g. in tests).
    const gjsContent = (componentType === 'text' || componentType === 'button') 
      ? (typeof c.getInnerHTML === 'function' ? c.getInnerHTML() : c.get('content') as string | undefined)
      : (c.get('content') as string | undefined)
    const gjsSrc = c.get('src') as string | undefined

    const baseProps = (c.get('properties') || {}) as Record<string, unknown>
    const mergedProps: Record<string, unknown> = { ...baseProps }

    // T611: Capture all GrapesJS model attributes (Traits) into properties.
    // This ensures things like 'alt', 'title', 'mediaType' survive the round-trip.
    const attributes = c.getAttributes()
    for (const [key, value] of Object.entries(attributes)) {
      if (!INTERNAL_GJS_ATTRS.has(key)) {
        mergedProps[key] = value
      }
    }

    // Capture user-edited content for non-question types only.
    // Question widget content is a generated HTML preview — never persist it back
    // into properties or it will corrupt the extendedProperties-driven render.
    if (gjsContent !== undefined && !GENERATED_CONTENT_TYPES.has(componentType)) {
      mergedProps.content = gjsContent
    }

    // Capture image src so it survives the store/load round-trip.
    if (gjsSrc !== undefined) {
      mergedProps.src = gjsSrc
    }

    // Save all non-layout CSS styles (font, color, background, border, padding, etc.)
    // so that the full visual appearance survives the store → backend → load round-trip.
    // Layout properties (left/top/width/height/z-index/display/position) are excluded
    // here because they are already captured in bounds/layer/visible and will always be
    // re-derived from those authoritative fields when grapesjsFromWidgets runs on load.
    const decorativeStyle: Record<string, string> = {}
    for (const [key, value] of Object.entries(style)) {
      if (!LAYOUT_STYLE_KEYS.has(key)) {
        decorativeStyle[key] = value as string
      }
    }
    if (Object.keys(decorativeStyle).length > 0) {
      mergedProps.style = decorativeStyle
    }

    // T634: Persist nav-buttons child labels so they survive the store → load round-trip.
    // The child components hold the user-edited text in their 'content' model attribute.
    if (componentType === 'nav-buttons') {
      const prevChild = c.components().at(0)
      const nextChild = c.components().at(1)
      mergedProps.prevLabel = (prevChild?.get('content') as string | undefined) ?? NAV_BUTTON_DEFAULTS.prevLabel
      mergedProps.nextLabel = (nextChild?.get('content') as string | undefined) ?? NAV_BUTTON_DEFAULTS.nextLabel
    }

    // Extract the human-readable `name` trait (Props → Name). Used as display
    // label for widget-target dropdowns (Actions Editor). Kept at top-level on
    // BaseWidget alongside `id` so consumers can render it directly without
    // digging into properties. Read both model and attribute paths: the
    // `name` trait has no changeProp flag, so GrapesJS mirrors it to the HTML
    // attribute, but c.get('name') may also return it on certain setups.
    const rawName = (c.get('name') as string | undefined) ?? (attributes.name as string | undefined) ?? ''
    const name = typeof rawName === 'string' ? rawName.trim() : ''

    return {
      id: attributes.id || c.getId(),
      type: (componentType as WidgetType) || 'rectangle',
      name: name || undefined, // omit empty strings to keep storage tidy
      bounds,
      layer: (() => {
        const zIdx = style['z-index']
        if (typeof zIdx === 'number') return zIdx
        return parsePx(typeof zIdx === 'string' ? zIdx : undefined, 1)
      })(),
      visible: style.display !== 'none',
      properties: mergedProps,
      actions: c.get('elearnActions') || [],
      extendedProperties: c.get('extendedProperties') || {},
    }
  })
}

/**
 * Converts eLearn Studio Widgets into GrapesJS component definitions.
 */
export function grapesjsFromWidgets(widgets: BaseWidget[]): GrapesJsComponentDef[] {
  return widgets.map((w) => {
    const props = (w.properties as Record<string, unknown> | undefined) ?? {}

    // Determine the correct CSS display value for this widget type.
    // grapesjsFromWidgets provides an explicit style that OVERRIDES the component type's
    // defaults in GrapesJS, so we must restore the exact display value — 'flex' for
    // widget types that use flexbox layout, 'block' for everything else.
    const displayValue = w.visible
      ? (FLEX_DISPLAY_TYPES.has(w.type) ? 'flex' : 'block')
      : 'none'

    // Restore saved decorative styles (font, color, background, border, padding, etc.).
    // Layout properties always follow and override any stale values that may have been
    // captured in properties.style from a previous session.
    const savedStyle = (props?.style as Record<string, string | number> | undefined) ?? {}

    // T611: Restore all saved attributes from properties.
    const attributes: Record<string, unknown> = { id: w.id }
    for (const [key, value] of Object.entries(props)) {
      // Skip fields that are handled explicitly or that must never become HTML attributes.
      // extendedProperties / elearnActions / properties are complex objects stored as
      // top-level fields on the GrapesJS component def — placing them inside `attributes`
      // would cause GrapesJS's loadData to crash trying to iterate their nested values.
      if (['content', 'src', 'style', 'actions',
           'extendedProperties', 'elearnActions', 'properties'].includes(key)) continue
      attributes[key] = value
    }

    // Restore the human-readable name trait. The top-level widget.name is the
    // authoritative source; only fall through to properties.name for legacy
    // courses saved before widget.name existed.
    if (typeof w.name === 'string' && w.name.length > 0) {
      attributes.name = w.name
    }

    const def: GrapesJsComponentDef = {
      type: w.type,
      // id preserved so the round-trip produces the same Widget id after load
      attributes,
      style: {
        ...savedStyle,
        position: 'absolute',
        left: `${w.bounds?.x ?? 0}px`,
        top: `${w.bounds?.y ?? 0}px`,
        width: `${w.bounds?.width ?? 100}px`,
        height: `${w.bounds?.height ?? 50}px`,
        'z-index': String(w.layer),
        display: displayValue,
      },
      // GrapesJS will store these custom fields in the component model.
      // actions must be an empty array (not our ActionSequence[]) — GrapesJS's loadData
      // calls .forEach on componentDef.actions; if undefined it crashes with TypeError.
      // properties must be omitted for GENERATED_CONTENT_TYPES: GrapesJS's Style Manager
      // PropertyComposite calls new model_Properties(this.get('properties') || [], ...)
      // expecting an array. Passing our { style: {...} } object crashes with TypeError
      // (reading 'forEach') during loadData. Style data is already in the `style` field.
      actions: [],
      ...(GENERATED_CONTENT_TYPES.has(w.type) ? {} : { properties: props }),
      elearnActions: w.actions ?? [],
      extendedProperties: w.extendedProperties ?? {},
    }

    // Map properties.content → GrapesJS content field so text/button widgets render
    // their stored HTML. Only these two types use GrapesJS editable-text mode, which
    // treats def.content as innerHTML directly — HTML markup is safe here.
    // All other widget types either have no stored content, use def.src (image), or
    // are in GENERATED_CONTENT_TYPES. Setting def.content for any other type would
    // cause GrapesJS to parse the HTML into child component defs that lack actions:[],
    // crashing with "Cannot read properties of undefined (reading 'forEach')" in
    // loadData (T643.1 fix — positive allowlist replaces the previous unconditional set).
    if ((w.type === 'text' || w.type === 'button') && typeof props?.content === 'string') {
      def.content = props.content
    }

    // Restore src as a root-level GrapesJS model attribute for widget types that
    // declare src as a model-level trait. model.set('src', ...) triggers change:src
    // listeners (e.g. presigned-URL resolution for images) on load.
    // Only widget types that use src as a GrapesJS trait are listed here to avoid
    // inadvertently setting src on types that merely store it in properties.
    const WIDGETS_WITH_SRC_TRAIT = new Set(['image', 'media-player', 'audio-narration'])
    if (WIDGETS_WITH_SRC_TRAIT.has(w.type) && typeof props?.src === 'string' && props.src) {
      def.src = props.src
    }

    // Do NOT set def.content for any composite widget type (questions, nav-buttons,
    // score-quiz, media-player, etc.). GrapesJS parses HTML content strings into
    // child component definitions during loadData(), and those auto-generated child
    // definitions lack `actions: []`, causing "Cannot read properties of undefined
    // (reading 'forEach')" crashes. Composite widgets that need children must use
    // def.components (typed child defs) rather than def.content (raw HTML).

    // T634: Restore nav-buttons child components from saved prevLabel / nextLabel.
    // Always inject both children — widgets saved before T634 fall back to NAV_BUTTON_DEFAULTS.
    // Each child must carry `actions: []` to prevent the GrapesJS loadData forEach crash.
    if (w.type === 'nav-buttons') {
      const prevLabel = typeof props.prevLabel === 'string' ? props.prevLabel : NAV_BUTTON_DEFAULTS.prevLabel
      const nextLabel = typeof props.nextLabel === 'string' ? props.nextLabel : NAV_BUTTON_DEFAULTS.nextLabel
      def.components = [
        {
          tagName: 'button',
          content: prevLabel,
          droppable: false,
          draggable: false,
          actions: [],
          elearnActions: [],
          properties: [],
          extendedProperties: {},
          style: {
            padding: '8px 16px',
            'margin-right': '8px',
            background: '#64748b',
            color: '#fff',
            border: 'none',
            'border-radius': '4px',
            cursor: 'pointer',
            'font-size': '13px',
          },
        },
        {
          tagName: 'button',
          content: nextLabel,
          droppable: false,
          draggable: false,
          actions: [],
          elearnActions: [],
          properties: [],
          extendedProperties: {},
          style: {
            padding: '8px 16px',
            background: '#4f46e5',
            color: '#fff',
            border: 'none',
            'border-radius': '4px',
            cursor: 'pointer',
            'font-size': '13px',
          },
        },
      ]
    }

    return def
  })
}
