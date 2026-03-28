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
  attributes: { id: string }
  style: {
    position: 'absolute'
    left: string
    top: string
    width: string
    height: string
    'z-index': number
    display: 'block' | 'none'
  }
  /** GrapesJS inner HTML content — used by text/button types to render stored HTML. */
  content?: string
  properties: BaseWidget['properties']
  actions: BaseWidget['actions']
  extendedProperties: BaseWidget['extendedProperties']
}

/** Parses a CSS pixel value string, returning `fallback` if NaN or missing. */
function parsePx(value: string | undefined, fallback: number): number {
  const n = parseInt(value ?? '', 10)
  return isNaN(n) ? fallback : n
}

/**
 * Converts a flat list of GrapesJS components into eLearn Studio Widgets.
 * Recursively traverses the tree if necessary, though our current model is mostly flat.
 */
export function widgetsFromGrapesjs(components: Component[]): BaseWidget[] {
  return components.map((c) => {
    const style = c.getStyle()

    // Parse bounds from CSS styles; parsePx guards against NaN from malformed values
    const bounds: Bounds = {
      x: parsePx(style.left, 0),
      y: parsePx(style.top, 0),
      width: parsePx(style.width, 100),
      height: parsePx(style.height, 50),
    }

    // Extract custom data stored in GrapesJS attributes/traits
    return {
      id: c.getAttributes().id || c.getId(),
      type: (c.get('type') as WidgetType) || 'rectangle',
      bounds,
      layer: parsePx(style['z-index'], 1),
      visible: style.display !== 'none',
      properties: c.get('properties') || {},
      actions: c.get('actions') || [],
      extendedProperties: c.get('extendedProperties') || {},
    }
  })
}

/**
 * Converts eLearn Studio Widgets into GrapesJS component definitions.
 */
export function grapesjsFromWidgets(widgets: BaseWidget[]): GrapesJsComponentDef[] {
  return widgets.map((w) => {
    const props = w.properties as Record<string, unknown>
    const def: GrapesJsComponentDef = {
      type: w.type,
      // id preserved so the round-trip produces the same Widget id after load
      attributes: { id: w.id },
      style: {
        position: 'absolute',
        left: `${w.bounds.x}px`,
        top: `${w.bounds.y}px`,
        width: `${w.bounds.width}px`,
        height: `${w.bounds.height}px`,
        'z-index': w.layer,
        display: w.visible ? 'block' : 'none',
      },
      // GrapesJS will store these custom fields in the component model
      properties: w.properties,
      actions: w.actions,
      extendedProperties: w.extendedProperties,
    }
    // Map properties.content → GrapesJS content field so text/button/nav widgets
    // render their stored HTML instead of the component type's default placeholder.
    if (typeof props?.content === 'string') {
      def.content = props.content
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
