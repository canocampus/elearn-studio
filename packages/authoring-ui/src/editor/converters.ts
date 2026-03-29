/**
 * Bidirectional converters between GrapesJS component tree and eLearn Studio Widget schema.
 * T011.4 — Bidirectional converter implementation.
 * T011.5 — Preserve all Widget fields: id, type, bounds, layer, visible, properties, actions, extendedProperties.
 */

import type { Component } from 'grapesjs'
import type { BaseWidget, Bounds, WidgetType } from '../types/course'
import {
  MC_DEFAULT_EXTENDED,
  TF_DEFAULT_EXTENDED,
  FILL_DEFAULT_EXTENDED,
} from '../types/questions'
import type { MCExtendedProps, TFExtendedProps, FillExtendedProps } from '../types/questions'
import {
  buildMCPreviewHTML,
  buildTFPreviewHTML,
  buildFillPreviewHTML,
} from './registerQuestionBlocks'

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
  properties: BaseWidget['properties']
  /** GrapesJS-native actions field — always empty array to prevent loadData forEach crash. */
  actions: []
  /** Our ActionSequence[] stored under a separate key to avoid GrapesJS key collision. */
  elearnActions: BaseWidget['actions']
  extendedProperties: BaseWidget['extendedProperties']
}

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
const GENERATED_CONTENT_TYPES = new Set(['question-mc', 'question-tf', 'question-fill'])

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
 * GrapesJS-internal attributes that should NOT be persisted into the widget properties.
 * These are managed by GrapesJS or our converters directly.
 */
const INTERNAL_GJS_ATTRS = new Set(['id', 'class', 'style', 'src'])

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

    return {
      id: attributes.id || c.getId(),
      type: (componentType as WidgetType) || 'rectangle',
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
      // Skip fields that are handled explicitly (content, src, style, actions)
      if (['content', 'src', 'style', 'actions'].includes(key)) continue
      attributes[key] = value
    }

    const def: GrapesJsComponentDef = {
      type: w.type,
      // id preserved so the round-trip produces the same Widget id after load
      attributes,
      style: {
        ...savedStyle,
        position: 'absolute',
        left: `${w.bounds.x}px`,
        top: `${w.bounds.y}px`,
        width: `${w.bounds.width}px`,
        height: `${w.bounds.height}px`,
        'z-index': w.layer,
        display: displayValue,
      },
      // GrapesJS will store these custom fields in the component model.
      // actions must be an empty array (not our ActionSequence[]) — GrapesJS's loadData
      // calls .forEach on componentDef.actions; if undefined it crashes with TypeError.
      actions: [],
      properties: props,
      elearnActions: w.actions ?? [],
      extendedProperties: w.extendedProperties ?? {},
    }

    // Map properties.content → GrapesJS content field so text/button/nav widgets
    // render their stored HTML instead of the component type's default placeholder.
    if (typeof props?.content === 'string') {
      def.content = props.content
    }

    // Restore image src as a root-level GrapesJS model attribute.
    // model.set('src', ...) is how the image component stores its URL — setting it here
    // triggers the change:src listener and the presigned-URL resolution on load.
    if (w.type === 'image' && typeof props?.src === 'string' && props.src) {
      def.src = props.src
    }

    // Pre-render question widget previews into def.content so GrapesJS natively
    // displays the question on load. onRender() may not fire during programmatic
    // loadProjectData(), but GrapesJS always renders def.content.
    if (w.type === 'question-mc') {
      const raw = w.extendedProperties as Partial<MCExtendedProps> | undefined
      const ep: MCExtendedProps = raw?.options ? (raw as MCExtendedProps) : MC_DEFAULT_EXTENDED
      def.content = buildMCPreviewHTML(ep)
    } else if (w.type === 'question-tf') {
      const raw = w.extendedProperties as Partial<TFExtendedProps> | undefined
      const ep: TFExtendedProps = raw?.scoring ? (raw as TFExtendedProps) : TF_DEFAULT_EXTENDED
      def.content = buildTFPreviewHTML(ep)
    } else if (w.type === 'question-fill') {
      const raw = w.extendedProperties as Partial<FillExtendedProps> | undefined
      const ep: FillExtendedProps = raw?.scoring ? (raw as FillExtendedProps) : FILL_DEFAULT_EXTENDED
      def.content = buildFillPreviewHTML(ep)
    }
    return def
  })
}
