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
 */
function defToComponent(def: ReturnType<typeof grapesjsFromWidgets>[number]): Component {
  return {
    getStyle: () => ({ ...(def.style as Record<string, unknown>) }),
    getAttributes: () => ({ ...(def.attributes as Record<string, string>) }),
    getId: () => (def.attributes as Record<string, string>).id,
    get: (key: string) => (def as Record<string, unknown>)[key],
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
    expect(style['z-index']).toBe(7)
  })

  it('maps visible:true to display:block', () => {
    const [def] = grapesjsFromWidgets([makeWidget({ visible: true })])
    const style = def.style as Record<string, unknown>
    expect(style.display).toBe('block')
  })

  it('maps visible:false to display:none', () => {
    const [def] = grapesjsFromWidgets([makeWidget({ visible: false })])
    const style = def.style as Record<string, unknown>
    expect(style.display).toBe('none')
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

  it('preserves actions array intact', () => {
    const actions = [{ event: 'click', actions: [{ id: 'a1', type: 'navigate', params: { slide: 2 } }] }]
    const [def] = grapesjsFromWidgets([makeWidget({ actions })])
    expect(def.actions).toEqual(actions)
  })

  it('preserves extendedProperties intact', () => {
    const ext = { simType: 'process-flow', mode: 'practice', passingScore: 80 }
    const [def] = grapesjsFromWidgets([makeWidget({ extendedProperties: ext })])
    expect(def.extendedProperties).toEqual(ext)
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
