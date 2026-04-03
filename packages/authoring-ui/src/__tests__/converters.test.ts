/**
 * Unit tests for converters.ts — T011.6
 *
 * Validates the bidirectional cycle:
 *   BaseWidget → grapesjsFromWidgets → GrapesJS definition
 *   GrapesJS Component → widgetsFromGrapesjs → BaseWidget
 *   Round-trip: BaseWidget → [GrapesJS] → BaseWidget (no data loss)
 *
 * Specific invariants verified (per task T011.6 / user spec):
 *   1. Bounds   — CSS left/top/width/height ↔ bounds.{x,y,width,height} via parseInt
 *   2. Layer    — CSS z-index ↔ bounds.layer (numeric)
 *   3. Visible  — CSS display:none/block ↔ boolean visible
 *   4. Custom   — properties, actions, extendedProperties preserved intact
 *   5. Identity — id and type survive the round-trip unchanged
 */

import { describe, it, expect } from 'vitest'
import type { Component } from 'grapesjs'
import type { BaseWidget } from '../types/course'
import { grapesjsFromWidgets, widgetsFromGrapesjs } from '../editor/converters'

// ---------------------------------------------------------------------------
// Test fixture builders
// ---------------------------------------------------------------------------

/** Minimal valid BaseWidget for use in tests. */
function makeWidget(overrides: Partial<BaseWidget> = {}): BaseWidget {
  return {
    id: 'w-001',
    type: 'text',
    bounds: { x: 100, y: 200, width: 300, height: 150 },
    layer: 3,
    visible: true,
    properties: {},
    actions: [],
    extendedProperties: {},
    ...overrides,
  }
}

/**
 * Simulates how GrapesJS stores a component definition.
 * Bridges grapesjsFromWidgets output → Component mock for widgetsFromGrapesjs.
 *
 * GrapesJS stores the custom fields (properties, actions, extendedProperties)
 * in the component model and exposes them via c.get(key).
 * CSS styles come from getStyle(), HTML attributes from getAttributes().
 * getInnerHTML() is the authoritative content source for text/button types in real GrapesJS.
 */
function defToComponent(def: ReturnType<typeof grapesjsFromWidgets>[number]): Component {
  return {
    getStyle: () => ({ ...(def.style as Record<string, unknown>) }),
    getAttributes: () => ({ ...(def.attributes as Record<string, string>) }),
    getId: () => (def.attributes as Record<string, string>).id,
    get: (key: string) => (def as Record<string, unknown>)[key],
    getInnerHTML: () => def.content as string | undefined,
  } as unknown as Component
}

// ---------------------------------------------------------------------------
// grapesjsFromWidgets — Widget schema → GrapesJS definition
// ---------------------------------------------------------------------------

describe('grapesjsFromWidgets — Widget → GrapesJS definition', () => {
  it('returns an empty array for no widgets', () => {
    expect(grapesjsFromWidgets([])).toEqual([])
  })

  it('preserves widget type in the component type field', () => {
    const [def] = grapesjsFromWidgets([makeWidget({ type: 'question-mc' })])
    expect(def.type).toBe('question-mc')
  })

  it('maps bounds.x/y/width/height to CSS left/top/width/height with px suffix', () => {
    const [def] = grapesjsFromWidgets([makeWidget({ bounds: { x: 10, y: 20, width: 300, height: 150 } })])
    const style = def.style as Record<string, unknown>
    expect(style.left).toBe('10px')
    expect(style.top).toBe('20px')
    expect(style.width).toBe('300px')
    expect(style.height).toBe('150px')
  })

  it('maps layer to CSS z-index', () => {
    const [def] = grapesjsFromWidgets([makeWidget({ layer: 7 })])
    const style = def.style as Record<string, unknown>
    expect(style['z-index']).toBe('7')
  })

  it('maps visible:true to display:block for block-level widget types', () => {
    const [def] = grapesjsFromWidgets([makeWidget({ type: 'text', visible: true })])
    const style = def.style as Record<string, unknown>
    expect(style.display).toBe('block')
  })

  it('maps visible:false to display:none', () => {
    const [def] = grapesjsFromWidgets([makeWidget({ visible: false })])
    const style = def.style as Record<string, unknown>
    expect(style.display).toBe('none')
  })

  it('maps nav-buttons visible:true to display:flex (flex layout required)', () => {
    const [def] = grapesjsFromWidgets([makeWidget({ type: 'nav-buttons', visible: true })])
    const style = def.style as Record<string, unknown>
    expect(style.display).toBe('flex')
  })

  it('maps score-field visible:true to display:flex', () => {
    const [def] = grapesjsFromWidgets([makeWidget({ type: 'score-field', visible: true })])
    const style = def.style as Record<string, unknown>
    expect(style.display).toBe('flex')
  })

  it('maps nav-buttons visible:false to display:none', () => {
    const [def] = grapesjsFromWidgets([makeWidget({ type: 'nav-buttons', visible: false })])
    const style = def.style as Record<string, unknown>
    expect(style.display).toBe('none')
  })

  it('sets content from properties.content for text widgets', () => {
    const [def] = grapesjsFromWidgets([makeWidget({ type: 'text', properties: { content: 'Hello World' } })])
    expect(def.content).toBe('Hello World')
  })

  it('sets src from properties.src for image widgets', () => {
    const [def] = grapesjsFromWidgets([makeWidget({ type: 'image', properties: { src: '/assets/photo.jpg' } })])
    expect(def.src).toBe('/assets/photo.jpg')
  })

  it('does not set src for non-image widgets even if properties.src exists', () => {
    const [def] = grapesjsFromWidgets([makeWidget({ type: 'text', properties: { src: '/assets/photo.jpg' } })])
    expect(def.src).toBeUndefined()
  })

  it('always sets position:absolute (fixed-layout canvas)', () => {
    const [def] = grapesjsFromWidgets([makeWidget()])
    const style = def.style as Record<string, unknown>
    expect(style.position).toBe('absolute')
  })

  it('stores widget id in attributes.id', () => {
    const [def] = grapesjsFromWidgets([makeWidget({ id: 'widget-xyz' })])
    expect((def.attributes as Record<string, string>).id).toBe('widget-xyz')
  })

  it('preserves properties object intact', () => {
    const props = { text: 'Hello', fontSize: 16, bold: true }
    const [def] = grapesjsFromWidgets([makeWidget({ properties: props })])
    expect(def.properties).toEqual(props)
  })

  it('preserves actions in elearnActions (def.actions is always [] to prevent GrapesJS forEach crash)', () => {
    const actions = [{ event: 'click', actions: [{ id: 'a1', type: 'navigate', params: { slide: 2 } }] }]
    const [def] = grapesjsFromWidgets([makeWidget({ actions })])
    expect(def.actions).toEqual([])
    expect(def.elearnActions).toEqual(actions)
  })

  it('preserves extendedProperties intact', () => {
    const ext = { simType: 'process-flow', mode: 'practice', passingScore: 80 }
    const [def] = grapesjsFromWidgets([makeWidget({ extendedProperties: ext })])
    expect(def.extendedProperties).toEqual(ext)
  })

  it('spreads properties.style into CSS definition (decorative style restored on load)', () => {
    const savedStyle = { 'font-family': 'Georgia', color: '#222222', 'background-color': '#f5f5f5' }
    const [def] = grapesjsFromWidgets([makeWidget({ properties: { style: savedStyle } })])
    const style = def.style as Record<string, unknown>
    expect(style['font-family']).toBe('Georgia')
    expect(style.color).toBe('#222222')
    expect(style['background-color']).toBe('#f5f5f5')
  })

  it('layout keys always override stale values in properties.style', () => {
    // Even if a stale `left` was saved in properties.style, bounds must win
    const savedStyle = { left: '999px', top: '999px', color: '#abc' }
    const bounds = { x: 50, y: 75, width: 200, height: 100 }
    const [def] = grapesjsFromWidgets([makeWidget({ bounds, properties: { style: savedStyle } })])
    const style = def.style as Record<string, unknown>
    expect(style.left).toBe('50px')
    expect(style.top).toBe('75px')
    expect(style.color).toBe('#abc')
  })

  it('converts multiple widgets independently', () => {
    const widgets = [
      makeWidget({ id: 'w1', type: 'text', bounds: { x: 0, y: 0, width: 100, height: 50 } }),
      makeWidget({ id: 'w2', type: 'image', bounds: { x: 200, y: 100, width: 400, height: 300 } }),
    ]
    const defs = grapesjsFromWidgets(widgets)
    expect(defs).toHaveLength(2)
    expect(defs[0].type).toBe('text')
    expect(defs[1].type).toBe('image')
  })
})

// ---------------------------------------------------------------------------
// widgetsFromGrapesjs — GrapesJS Component → Widget schema
// ---------------------------------------------------------------------------

describe('widgetsFromGrapesjs — GrapesJS Component → Widget', () => {
  it('returns an empty array for no components', () => {
    expect(widgetsFromGrapesjs([])).toEqual([])
  })

  it('parses left/top/width/height from CSS styles via parseInt', () => {
    const comp = {
      getStyle: () => ({ left: '150px', top: '75px', width: '500px', height: '250px', 'z-index': '1', display: 'block' }),
      getAttributes: () => ({ id: 'w1' }),
      getId: () => 'w1',
      get: (key: string) => ({ type: 'rectangle', properties: {}, actions: [], extendedProperties: {} }[key]),
    } as unknown as Component

    const [widget] = widgetsFromGrapesjs([comp])
    expect(widget.bounds).toEqual({ x: 150, y: 75, width: 500, height: 250 })
  })

  it('returns fallback defaults for malformed CSS values (NaN guard)', () => {
    const comp = {
      getStyle: () => ({ left: 'auto', top: 'inherit', width: '', height: 'abc', 'z-index': 'none', display: 'block' }),
      getAttributes: () => ({ id: 'w1' }),
      getId: () => 'w1',
      get: (key: string) => ({ type: 'text', properties: {}, actions: [], extendedProperties: {} }[key]),
    } as unknown as Component

    const [widget] = widgetsFromGrapesjs([comp])
    expect(widget.bounds.x).toBe(0)
    expect(widget.bounds.y).toBe(0)
    expect(widget.bounds.width).toBe(100)
    expect(widget.bounds.height).toBe(50)
    expect(widget.layer).toBe(1)
  })

  it('truncates fractional pixel values via parseInt', () => {
    const comp = {
      getStyle: () => ({ left: '10.9px', top: '20.1px', width: '100.5px', height: '50.7px', 'z-index': '1', display: 'block' }),
      getAttributes: () => ({ id: 'w1' }),
      getId: () => 'w1',
      get: (key: string) => ({ type: 'text', properties: {}, actions: [], extendedProperties: {} }[key]),
    } as unknown as Component

    const [widget] = widgetsFromGrapesjs([comp])
    expect(widget.bounds.x).toBe(10)
    expect(widget.bounds.y).toBe(20)
    expect(widget.bounds.width).toBe(100)
    expect(widget.bounds.height).toBe(50)
  })

  it('defaults missing CSS values: x=0, y=0, width=100, height=50, layer=1', () => {
    const comp = {
      getStyle: () => ({}),
      getAttributes: () => ({ id: 'w1' }),
      getId: () => 'w1',
      get: (key: string) => ({ type: 'rectangle', properties: {}, actions: [], extendedProperties: {} }[key]),
    } as unknown as Component

    const [widget] = widgetsFromGrapesjs([comp])
    expect(widget.bounds).toEqual({ x: 0, y: 0, width: 100, height: 50 })
    expect(widget.layer).toBe(1)
  })

  it('parses z-index string to numeric layer', () => {
    const comp = {
      getStyle: () => ({ left: '0', top: '0', width: '100', height: '50', 'z-index': '5', display: 'block' }),
      getAttributes: () => ({ id: 'w1' }),
      getId: () => 'w1',
      get: (key: string) => ({ type: 'text', properties: {}, actions: [], extendedProperties: {} }[key]),
    } as unknown as Component

    const [widget] = widgetsFromGrapesjs([comp])
    expect(widget.layer).toBe(5)
    expect(typeof widget.layer).toBe('number')
  })

  it('maps display:none to visible:false', () => {
    const comp = {
      getStyle: () => ({ left: '0', top: '0', width: '0', height: '0', 'z-index': '1', display: 'none' }),
      getAttributes: () => ({ id: 'w1' }),
      getId: () => 'w1',
      get: (key: string) => ({ type: 'text', properties: {}, actions: [], extendedProperties: {} }[key]),
    } as unknown as Component

    const [widget] = widgetsFromGrapesjs([comp])
    expect(widget.visible).toBe(false)
  })

  it('maps display:block to visible:true', () => {
    const comp = {
      getStyle: () => ({ left: '0', top: '0', width: '0', height: '0', 'z-index': '1', display: 'block' }),
      getAttributes: () => ({ id: 'w1' }),
      getId: () => 'w1',
      get: (key: string) => ({ type: 'text', properties: {}, actions: [], extendedProperties: {} }[key]),
    } as unknown as Component

    const [widget] = widgetsFromGrapesjs([comp])
    expect(widget.visible).toBe(true)
  })

  it('uses attributes.id first, falls back to c.getId()', () => {
    const compWithAttrId = {
      getStyle: () => ({ left: '0', top: '0', width: '0', height: '0', 'z-index': '1', display: 'block' }),
      getAttributes: () => ({ id: 'attr-id' }),
      getId: () => 'generated-id',
      get: (key: string) => ({ type: 'text', properties: {}, actions: [], extendedProperties: {} }[key]),
    } as unknown as Component

    const compWithoutAttrId = {
      getStyle: () => ({ left: '0', top: '0', width: '0', height: '0', 'z-index': '1', display: 'block' }),
      getAttributes: () => ({}),
      getId: () => 'generated-id',
      get: (key: string) => ({ type: 'text', properties: {}, actions: [], extendedProperties: {} }[key]),
    } as unknown as Component

    expect(widgetsFromGrapesjs([compWithAttrId])[0].id).toBe('attr-id')
    expect(widgetsFromGrapesjs([compWithoutAttrId])[0].id).toBe('generated-id')
  })

  it('defaults missing custom fields to empty objects/arrays', () => {
    const comp = {
      getStyle: () => ({ left: '0', top: '0', width: '0', height: '0', 'z-index': '1', display: 'block' }),
      getAttributes: () => ({ id: 'w1' }),
      getId: () => 'w1',
      get: (_key: string) => undefined,
    } as unknown as Component

    const [widget] = widgetsFromGrapesjs([comp])
    expect(widget.properties).toEqual({})
    expect(widget.actions).toEqual([])
    expect(widget.extendedProperties).toEqual({})
  })

  it('captures c.get("content") into properties.content for text widgets', () => {
    const comp = {
      getStyle: () => ({ left: '10px', top: '20px', width: '200px', height: '50px', 'z-index': '1', display: 'block' }),
      getAttributes: () => ({ id: 'w1' }),
      getId: () => 'w1',
      get: (key: string) => ({ type: 'text', content: 'User edited text', properties: {}, actions: [], extendedProperties: {} }[key]),
    } as unknown as Component

    const [widget] = widgetsFromGrapesjs([comp])
    expect((widget.properties as Record<string, unknown>).content).toBe('User edited text')
  })

  it('merges c.get("content") with existing properties (does not overwrite other keys)', () => {
    const comp = {
      getStyle: () => ({ left: '0', top: '0', width: '200px', height: '50px', 'z-index': '1', display: 'block' }),
      getAttributes: () => ({ id: 'w1' }),
      getId: () => 'w1',
      get: (key: string) => ({ type: 'button', content: '<b>Click me</b>', properties: { fontSize: 16 }, actions: [], extendedProperties: {} }[key]),
    } as unknown as Component

    const [widget] = widgetsFromGrapesjs([comp])
    const props = widget.properties as Record<string, unknown>
    expect(props.content).toBe('<b>Click me</b>')
    expect(props.fontSize).toBe(16)
  })

  it('does NOT capture content for question-mc (generated HTML preview, not user data)', () => {
    const comp = {
      getStyle: () => ({ left: '0', top: '0', width: '400px', height: '200px', 'z-index': '1', display: 'block' }),
      getAttributes: () => ({ id: 'w1' }),
      getId: () => 'w1',
      get: (key: string) => ({
        type: 'question-mc',
        content: '<div class="mc-preview">...</div>',
        properties: { questionText: 'What is 2+2?' },
        actions: [],
        extendedProperties: {},
      }[key]),
    } as unknown as Component

    const [widget] = widgetsFromGrapesjs([comp])
    const props = widget.properties as Record<string, unknown>
    expect(props.content).toBeUndefined()
    expect(props.questionText).toBe('What is 2+2?')
  })

  it('does NOT capture content for question-tf', () => {
    const comp = {
      getStyle: () => ({ left: '0', top: '0', width: '300px', height: '100px', 'z-index': '1', display: 'block' }),
      getAttributes: () => ({ id: 'w1' }),
      getId: () => 'w1',
      get: (key: string) => ({ type: 'question-tf', content: '<div>True/False preview</div>', properties: {}, actions: [], extendedProperties: {} }[key]),
    } as unknown as Component

    const [widget] = widgetsFromGrapesjs([comp])
    expect((widget.properties as Record<string, unknown>).content).toBeUndefined()
  })

  it('captures c.get("src") into properties.src for image widgets', () => {
    const comp = {
      getStyle: () => ({ left: '50px', top: '100px', width: '300px', height: '200px', 'z-index': '1', display: 'block' }),
      getAttributes: () => ({ id: 'w1' }),
      getId: () => 'w1',
      get: (key: string) => ({ type: 'image', src: '/assets/modamania.jpg', properties: {}, actions: [], extendedProperties: {} }[key]),
    } as unknown as Component

    const [widget] = widgetsFromGrapesjs([comp])
    expect((widget.properties as Record<string, unknown>).src).toBe('/assets/modamania.jpg')
  })

  it('does not add src to properties when c.get("src") is undefined', () => {
    const comp = {
      getStyle: () => ({ left: '0', top: '0', width: '200px', height: '150px', 'z-index': '1', display: 'block' }),
      getAttributes: () => ({ id: 'w1' }),
      getId: () => 'w1',
      get: (key: string) => ({ type: 'image', properties: {}, actions: [], extendedProperties: {} }[key]),
    } as unknown as Component

    const [widget] = widgetsFromGrapesjs([comp])
    expect('src' in (widget.properties as Record<string, unknown>)).toBe(false)
  })

  it('saves decorative CSS (font, color, background) into properties.style', () => {
    const comp = {
      getStyle: () => ({
        left: '10px', top: '20px', width: '200px', height: '50px', 'z-index': '1', display: 'block',
        'font-family': 'Arial', color: '#ff0000', 'background-color': '#ffffff',
      }),
      getAttributes: () => ({ id: 'w1' }),
      getId: () => 'w1',
      get: (key: string) => ({ type: 'text', properties: {}, actions: [], extendedProperties: {} }[key]),
    } as unknown as Component

    const [widget] = widgetsFromGrapesjs([comp])
    const style = (widget.properties as Record<string, unknown>).style as Record<string, unknown>
    expect(style).toBeDefined()
    expect(style['font-family']).toBe('Arial')
    expect(style.color).toBe('#ff0000')
    expect(style['background-color']).toBe('#ffffff')
  })

  it('does NOT include layout keys in saved properties.style', () => {
    const comp = {
      getStyle: () => ({
        position: 'absolute', left: '10px', top: '20px', width: '200px', height: '50px',
        'z-index': '3', display: 'block', color: '#333333',
      }),
      getAttributes: () => ({ id: 'w1' }),
      getId: () => 'w1',
      get: (key: string) => ({ type: 'text', properties: {}, actions: [], extendedProperties: {} }[key]),
    } as unknown as Component

    const [widget] = widgetsFromGrapesjs([comp])
    const style = (widget.properties as Record<string, unknown>).style as Record<string, unknown>
    expect(style).toBeDefined()
    expect('left' in style).toBe(false)
    expect('top' in style).toBe(false)
    expect('width' in style).toBe(false)
    expect('height' in style).toBe(false)
    expect('z-index' in style).toBe(false)
    expect('position' in style).toBe(false)
    expect('display' in style).toBe(false)
    expect(style.color).toBe('#333333')
  })

  it('does NOT add properties.style when only layout CSS is present', () => {
    const comp = {
      getStyle: () => ({
        position: 'absolute', left: '10px', top: '20px', width: '200px', height: '50px',
        'z-index': '1', display: 'block',
      }),
      getAttributes: () => ({ id: 'w1' }),
      getId: () => 'w1',
      get: (key: string) => ({ type: 'text', properties: {}, actions: [], extendedProperties: {} }[key]),
    } as unknown as Component

    const [widget] = widgetsFromGrapesjs([comp])
    expect('style' in (widget.properties as Record<string, unknown>)).toBe(false)
  })

  it('saves border and padding CSS into properties.style', () => {
    const comp = {
      getStyle: () => ({
        left: '0', top: '0', width: '100px', height: '50px', 'z-index': '1', display: 'block',
        border: '1px solid #ccc', padding: '8px',
      }),
      getAttributes: () => ({ id: 'w1' }),
      getId: () => 'w1',
      get: (key: string) => ({ type: 'rectangle', properties: {}, actions: [], extendedProperties: {} }[key]),
    } as unknown as Component

    const [widget] = widgetsFromGrapesjs([comp])
    const style = (widget.properties as Record<string, unknown>).style as Record<string, unknown>
    expect(style.border).toBe('1px solid #ccc')
    expect(style.padding).toBe('8px')
  })
})

// ---------------------------------------------------------------------------
// BUG-T611-04 — Trait attributes from getAttributes() are persisted in properties
// Root cause: early widgetsFromGrapesjs never called getAttributes() — fixed 2026-03-28.
// These tests verify the fix cannot be silently reverted.
// ---------------------------------------------------------------------------
describe('BUG-T611-04 — Trait attributes from getAttributes() are persisted in properties', () => {
  it('captures non-internal attributes (alt, mediaType) into widget.properties', () => {
    const comp = {
      getStyle: () => ({
        position: 'absolute', left: '10px', top: '20px', width: '200px', height: '100px',
        'z-index': '1', display: 'block',
      }),
      getAttributes: () => ({ id: 'w1', alt: 'A cat photo', mediaType: 'image/jpeg' }),
      getId: () => 'w1',
      get: (key: string) => ({ type: 'image', properties: {}, actions: [], extendedProperties: {}, elearnActions: [] }[key]),
      getInnerHTML: () => undefined as string | undefined,
    } as unknown as Component

    const [widget] = widgetsFromGrapesjs([comp])
    const props = widget.properties as Record<string, unknown>
    expect(props.alt).toBe('A cat photo')
    expect(props.mediaType).toBe('image/jpeg')
  })

  it('does NOT capture internal GJS attributes (id, class, style, src) into properties', () => {
    const comp = {
      getStyle: () => ({
        position: 'absolute', left: '0', top: '0', width: '100px', height: '50px',
        'z-index': '1', display: 'block',
      }),
      getAttributes: () => ({ id: 'w1', class: 'gjs-selected', style: 'color:red', src: 'http://example.com/img.jpg' }),
      getId: () => 'w1',
      get: (key: string) => ({ type: 'image', properties: {}, actions: [], extendedProperties: {}, elearnActions: [] }[key]),
      getInnerHTML: () => undefined as string | undefined,
    } as unknown as Component

    const [widget] = widgetsFromGrapesjs([comp])
    const props = widget.properties as Record<string, unknown>
    // id is captured as widget.id, not into properties
    expect('class' in props).toBe(false)
    expect('style' in props).toBe(false)
    expect('src' in props).toBe(false)
  })

  it('alt attribute on image widget survives grapesjsFromWidgets → widgetsFromGrapesjs round-trip', () => {
    const widget = makeWidget({ type: 'image', properties: { alt: 'Product screenshot', src: 'https://garage/img.jpg' } })
    const [def] = grapesjsFromWidgets([widget])
    const [restored] = widgetsFromGrapesjs([defToComponent(def)])
    expect((restored.properties as Record<string, unknown>).alt).toBe('Product screenshot')
  })

  it('data-* custom attributes survive the round-trip', () => {
    const widget = makeWidget({ type: 'button', properties: { 'data-action-id': 'btn-primary', 'data-track': 'click' } })
    const [def] = grapesjsFromWidgets([widget])
    const [restored] = widgetsFromGrapesjs([defToComponent(def)])
    const props = restored.properties as Record<string, unknown>
    expect(props['data-action-id']).toBe('btn-primary')
    expect(props['data-track']).toBe('click')
  })
})

// ---------------------------------------------------------------------------
// BUG-T611-05 — getInnerHTML() is preferred over get('content') for text/button
// Root cause: early widgetsFromGrapesjs only used c.get('content'), losing formatted
// HTML when GrapesJS moved rich children into its component tree. Fixed 2026-03-28.
// Tests also guard the test-environment fallback (getInnerHTML not always available).
// ---------------------------------------------------------------------------
describe('BUG-T611-05 — getInnerHTML() preferred over get("content") for text/button', () => {
  /** Component mock where getInnerHTML() returns a different value than get('content'). */
  function makeContentComp(type: string, innerHtml: string | undefined, modelContent: string | undefined) {
    return {
      getStyle: () => ({
        position: 'absolute', left: '0', top: '0', width: '300px', height: '100px',
        'z-index': '1', display: 'block',
      }),
      getAttributes: () => ({ id: 'w1' }),
      getId: () => 'w1',
      get: (key: string) => {
        const model: Record<string, unknown> = {
          type, properties: {}, actions: [], extendedProperties: {}, elearnActions: [],
          content: modelContent,
        }
        return model[key]
      },
      getInnerHTML: () => innerHtml,
    } as unknown as Component
  }

  it('text widget: getInnerHTML() value is captured, not stale get("content")', () => {
    // Simulates GrapesJS after user adds bold text — innerHTML diverges from model content.
    const comp = makeContentComp('text', '<b>Rich text from getInnerHTML</b>', 'stale content from get()')
    const [widget] = widgetsFromGrapesjs([comp])
    expect((widget.properties as Record<string, unknown>).content).toBe('<b>Rich text from getInnerHTML</b>')
  })

  it('button widget: getInnerHTML() value is captured, not stale get("content")', () => {
    const comp = makeContentComp('button', '<span>Click here</span>', 'stale button content')
    const [widget] = widgetsFromGrapesjs([comp])
    expect((widget.properties as Record<string, unknown>).content).toBe('<span>Click here</span>')
  })

  it('rectangle widget: uses get("content"), not getInnerHTML() (getInnerHTML only for text/button)', () => {
    // For non-text/non-button types, get('content') is authoritative regardless of getInnerHTML.
    const comp = makeContentComp('rectangle', 'value from getInnerHTML — should be ignored', 'rectangle content from model')
    const [widget] = widgetsFromGrapesjs([comp])
    expect((widget.properties as Record<string, unknown>).content).toBe('rectangle content from model')
  })

  it('text widget WITHOUT getInnerHTML method falls back to get("content") (test-env safety)', () => {
    // getInnerHTML() may not be available in all environments (unit tests, older GJS builds).
    const comp = {
      getStyle: () => ({ position: 'absolute', left: '0', top: '0', width: '200px', height: '80px', 'z-index': '1', display: 'block' }),
      getAttributes: () => ({ id: 'w1' }),
      getId: () => 'w1',
      get: (key: string) => {
        const model: Record<string, unknown> = {
          type: 'text', properties: {}, actions: [], extendedProperties: {}, elearnActions: [],
          content: 'fallback content via get(content)',
        }
        return model[key]
      },
      // deliberately omit getInnerHTML to simulate environments where it is unavailable
    } as unknown as Component

    const [widget] = widgetsFromGrapesjs([comp])
    expect((widget.properties as Record<string, unknown>).content).toBe('fallback content via get(content)')
  })

  it('text widget formatted HTML round-trip: content from getInnerHTML is stored and restored', () => {
    // Store a widget whose properties.content is rich HTML.
    const richHtml = '<b>Bold</b> and <em>italic</em>'
    const widget = makeWidget({ type: 'text', properties: { content: richHtml } })
    const [def] = grapesjsFromWidgets([widget])
    // defToComponent exposes def.content via getInnerHTML (updated fixture).
    const [restored] = widgetsFromGrapesjs([defToComponent(def)])
    expect((restored.properties as Record<string, unknown>).content).toBe(richHtml)
  })
})

// ---------------------------------------------------------------------------
// Round-trip — T011.6: BaseWidget → GrapesJS → BaseWidget (no data loss)
// ---------------------------------------------------------------------------

describe('converters — T011.6 round-trip: BaseWidget → GrapesJS → BaseWidget', () => {
  function roundTrip(widget: BaseWidget): BaseWidget {
    const [def] = grapesjsFromWidgets([widget])
    const [restored] = widgetsFromGrapesjs([defToComponent(def)])
    return restored
  }

  it('preserves id', () => {
    const w = makeWidget({ id: 'unique-id-42' })
    expect(roundTrip(w).id).toBe('unique-id-42')
  })

  it('preserves type', () => {
    for (const type of ['text', 'image', 'button', 'question-mc', 'phaser-sim'] as const) {
      expect(roundTrip(makeWidget({ type })).type).toBe(type)
    }
  })

  it('preserves bounds exactly (no float drift)', () => {
    const bounds = { x: 123, y: 456, width: 789, height: 321 }
    expect(roundTrip(makeWidget({ bounds })).bounds).toEqual(bounds)
  })

  it('preserves bounds at origin (0,0)', () => {
    const bounds = { x: 0, y: 0, width: 100, height: 50 }
    expect(roundTrip(makeWidget({ bounds })).bounds).toEqual(bounds)
  })

  it('preserves bounds at canvas edge (1024×768)', () => {
    const bounds = { x: 924, y: 718, width: 100, height: 50 }
    expect(roundTrip(makeWidget({ bounds })).bounds).toEqual(bounds)
  })

  it('preserves layer (numeric)', () => {
    expect(roundTrip(makeWidget({ layer: 1 })).layer).toBe(1)
    expect(roundTrip(makeWidget({ layer: 10 })).layer).toBe(10)
    expect(roundTrip(makeWidget({ layer: 99 })).layer).toBe(99)
  })

  it('preserves visible:true', () => {
    expect(roundTrip(makeWidget({ visible: true })).visible).toBe(true)
  })

  it('preserves visible:false', () => {
    expect(roundTrip(makeWidget({ visible: false })).visible).toBe(false)
  })

  it('preserves flat properties object', () => {
    const properties = { text: 'Hello World', fontSize: 14, bold: false, color: '#ffffff' }
    expect(roundTrip(makeWidget({ properties })).properties).toEqual(properties)
  })

  it('preserves nested properties object', () => {
    const properties = { style: { font: 'Inter', size: 14 }, alignment: { h: 'left', v: 'top' } }
    expect(roundTrip(makeWidget({ properties })).properties).toEqual(properties)
  })

  it('preserves actions array with nested structure', () => {
    const actions = [
      {
        event: 'click',
        actions: [
          { id: 'a1', type: 'navigate', params: { target: 'slide', slideIndex: 2 } },
          { id: 'a2', type: 'show', params: { widgetId: 'w2' } },
        ],
      },
    ]
    expect(roundTrip(makeWidget({ actions })).actions).toEqual(actions)
  })

  it('preserves empty actions array', () => {
    expect(roundTrip(makeWidget({ actions: [] })).actions).toEqual([])
  })

  it('preserves extendedProperties for phaser-sim widget', () => {
    const extendedProperties = {
      simType: 'process-flow',
      mode: 'practice',
      passingScore: 80,
      sceneDef: { nodes: [{ id: 'n1', x: 100, y: 100, label: 'Start' }], edges: [] },
    }
    expect(roundTrip(makeWidget({ type: 'phaser-sim', extendedProperties })).extendedProperties).toEqual(
      extendedProperties,
    )
  })

  it('preserves empty extendedProperties', () => {
    expect(roundTrip(makeWidget({ extendedProperties: {} })).extendedProperties).toEqual({})
  })

  // Regression: question types with empty extendedProperties fall back to MC_DEFAULT_EXTENDED
  // for the HTML preview (def.content), but extendedProperties itself must remain {} (not the default).
  // An AI refactor that accidentally writes def.extendedProperties = ep would break this.
  it('question-mc with empty extendedProperties preserves {} (not MC_DEFAULT_EXTENDED)', () => {
    const w = makeWidget({ type: 'question-mc', extendedProperties: {} })
    expect(roundTrip(w).extendedProperties).toEqual({})
  })

  it('question-tf with empty extendedProperties preserves {}', () => {
    const w = makeWidget({ type: 'question-tf', extendedProperties: {} })
    expect(roundTrip(w).extendedProperties).toEqual({})
  })

  it('question-fill with empty extendedProperties preserves {}', () => {
    const w = makeWidget({ type: 'question-fill', extendedProperties: {} })
    expect(roundTrip(w).extendedProperties).toEqual({})
  })

  it('decorative CSS styles survive the round-trip intact (font, color, background)', () => {
    // Simulates a widget that had font/color applied via the GrapesJS Style Manager.
    // The CSS is saved into properties.style on store and spread back on load.
    const decorativeStyle = { 'font-family': 'Arial', color: '#ff0000', 'background-color': '#eeeeee' }

    // Build a component that already has properties.style (as if previously saved)
    // and also exposes those keys via getStyle (as GrapesJS would after loading).
    const widget = makeWidget({ properties: { style: decorativeStyle } })
    const [def] = grapesjsFromWidgets([widget])

    // The component mock returns ALL keys from def.style via getStyle()
    const comp = defToComponent(def)
    const [restored] = widgetsFromGrapesjs([comp])

    const restoredStyle = (restored.properties as Record<string, unknown>).style as Record<string, unknown>
    expect(restoredStyle['font-family']).toBe('Arial')
    expect(restoredStyle.color).toBe('#ff0000')
    expect(restoredStyle['background-color']).toBe('#eeeeee')
  })

  it('decorative CSS does not bleed layout keys back into properties.style after round-trip', () => {
    const decorativeStyle = { 'font-size': '16px', padding: '4px' }
    const widget = makeWidget({ properties: { style: decorativeStyle } })
    const [def] = grapesjsFromWidgets([widget])
    const [restored] = widgetsFromGrapesjs([defToComponent(def)])

    const restoredStyle = (restored.properties as Record<string, unknown>).style as Record<string, unknown>
    expect('left' in restoredStyle).toBe(false)
    expect('top' in restoredStyle).toBe(false)
    expect('position' in restoredStyle).toBe(false)
    expect('display' in restoredStyle).toBe(false)
    expect(restoredStyle['font-size']).toBe('16px')
    expect(restoredStyle.padding).toBe('4px')
  })

  it('full widget — all fields survive intact', () => {
    const original: BaseWidget = {
      id: 'full-widget-001',
      type: 'question-mc',
      bounds: { x: 50, y: 100, width: 600, height: 400 },
      layer: 5,
      visible: true,
      properties: {
        questionText: 'What is 2 + 2?',
        options: ['3', '4', '5'],
        correctIndex: 1,
        scoring: { weight: 100, attempts: 3 },
      },
      actions: [
        { event: 'correct', actions: [{ id: 'nav', type: 'navigate', params: { slideIndex: 3 } }] },
      ],
      extendedProperties: { hints: ['Think about basic arithmetic'], showFeedback: true },
    }
    expect(roundTrip(original)).toEqual(original)
  })
})

// ---------------------------------------------------------------------------
// T701 — Null-guard edge cases: nested HTML and button label round-trip
// ---------------------------------------------------------------------------

describe('T701 — nested HTML and button label round-trip', () => {
  it('T701.4: text widget with nested <em> content is not silently dropped (getInnerHTML fallback)', () => {
    // Simulates the case where getInnerHTML is not available (unit-test environment or
    // older GrapesJS build). The converter must fall back to c.get('content') and NOT
    // silently return undefined/empty for a text widget containing italic markup.
    const emContent = 'Learning <em>objectives</em> matter'
    const comp = {
      getStyle: () => ({
        position: 'absolute', left: '50px', top: '80px', width: '400px', height: '60px',
        'z-index': '2', display: 'block',
      }),
      getAttributes: () => ({ id: 'w-em' }),
      getId: () => 'w-em',
      get: (key: string) => {
        const model: Record<string, unknown> = {
          type: 'text', properties: {}, actions: [], extendedProperties: {}, elearnActions: [],
          content: emContent,
        }
        return model[key]
      },
      // getInnerHTML deliberately absent — simulates unit-test / older GJS environment
    } as unknown as Component

    const [widget] = widgetsFromGrapesjs([comp])
    // The <em> content must survive; must not be undefined or empty
    expect((widget.properties as Record<string, unknown>).content).toBe(emContent)
  })

  it('T701.5: button widget custom label survives grapesjsFromWidgets → widgetsFromGrapesjs round-trip', () => {
    // Verifies that a button widget whose label is stored in properties.content
    // is faithfully restored after the full converter cycle.
    const customLabel = 'Next Slide →'
    const widget = makeWidget({ type: 'button', properties: { content: customLabel } })
    const [def] = grapesjsFromWidgets([widget])
    const [restored] = widgetsFromGrapesjs([defToComponent(def)])
    expect((restored.properties as Record<string, unknown>).content).toBe(customLabel)
  })
})
