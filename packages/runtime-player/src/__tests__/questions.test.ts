/**
 * Unit tests for T022 — Advanced question type handlers and renderers.
 *
 * Uses vitest + jsdom environment.
 */

import { describe, it, expect } from 'vitest'
import {
  evalMatchItems,
  evalDragObjects,
  evalDropTarget,
  evalArrangeObjects,
  evalOrderText,
  evalHotspot,
} from '../questions/handlers'
import {
  renderMatchItems,
  renderDragObjects,
  renderDropTarget,
  renderArrangeObjects,
  renderOrderText,
  renderHotspot,
} from '../questions/renderers'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEl(html: string): HTMLElement {
  const div = document.createElement('div')
  div.innerHTML = html
  return div
}

const bounds = { x: 0, y: 0, width: 400, height: 300 }

// ─── evalMatchItems ───────────────────────────────────────────────────────────

describe('evalMatchItems', () => {
  const pairs = [
    { id: 'p1', left: 'Cat', right: 'Feline' },
    { id: 'p2', left: 'Dog', right: 'Canine' },
  ]
  const ep: Record<string, unknown> = { pairs }

  it('returns score 0 when no pairs defined', () => {
    const el = makeEl('')
    const result = evalMatchItems({}, el)
    expect(result.correct).toBe(false)
    expect(result.score).toBe(0)
  })

  it('all correct — score 1', () => {
    // jsdom requires matching <option> elements for select.value to take effect
    const el = makeEl(`
      <select class="el-match-select" data-pair-id="p1">
        <option value="Feline">Feline</option>
        <option value="Canine">Canine</option>
      </select>
      <select class="el-match-select" data-pair-id="p2">
        <option value="Feline">Feline</option>
        <option value="Canine">Canine</option>
      </select>
    `)
    el.querySelectorAll<HTMLSelectElement>('.el-match-select').forEach((sel) => {
      const pair = pairs.find(p => p.id === sel.dataset.pairId)!
      sel.value = pair.right
    })
    const result = evalMatchItems(ep, el)
    expect(result.correct).toBe(true)
    expect(result.score).toBe(1)
    expect(result.feedback).toBe('Correct!')
  })

  it('partial credit — 1 of 2 correct', () => {
    const el = makeEl(`
      <select class="el-match-select" data-pair-id="p1">
        <option value="Feline">Feline</option>
        <option value="Canine">Canine</option>
      </select>
      <select class="el-match-select" data-pair-id="p2">
        <option value="Feline">Feline</option>
        <option value="Canine">Canine</option>
      </select>
    `)
    const sels = el.querySelectorAll<HTMLSelectElement>('.el-match-select')
    sels[0].value = 'Feline'   // correct for p1
    sels[1].value = 'Feline'   // wrong for p2 (expects 'Canine')
    const result = evalMatchItems(ep, el)
    expect(result.correct).toBe(false)
    expect(result.score).toBeCloseTo(0.5)
    expect(result.feedback).toMatch(/1\/2/)
  })

  it('none correct — score 0', () => {
    const el = makeEl(`
      <select class="el-match-select" data-pair-id="p1"></select>
      <select class="el-match-select" data-pair-id="p2"></select>
    `)
    const result = evalMatchItems(ep, el)
    expect(result.correct).toBe(false)
    expect(result.score).toBe(0)
  })

  it('uses custom feedback strings', () => {
    const epCustom = { ...ep, correctFeedback: 'Well done!', incorrectFeedback: 'Try again.' }
    const el = makeEl(`
      <select class="el-match-select" data-pair-id="p1">
        <option value="Feline">Feline</option>
        <option value="Canine">Canine</option>
      </select>
      <select class="el-match-select" data-pair-id="p2">
        <option value="Feline">Feline</option>
        <option value="Canine">Canine</option>
      </select>
    `)
    el.querySelectorAll<HTMLSelectElement>('.el-match-select').forEach((sel) => {
      const pair = pairs.find(p => p.id === sel.dataset.pairId)!
      sel.value = pair.right
    })
    const result = evalMatchItems(epCustom, el)
    expect(result.feedback).toBe('Well done!')
  })
})

// ─── evalDragObjects ──────────────────────────────────────────────────────────

describe('evalDragObjects', () => {
  const items = [
    { id: 'i1', label: 'Apple', correctZoneId: 'z1' },
    { id: 'i2', label: 'Banana', correctZoneId: 'z2' },
  ]
  const ep: Record<string, unknown> = { items }

  it('returns score 0 when no items defined', () => {
    const el = makeEl('')
    expect(evalDragObjects({}, el).score).toBe(0)
  })

  it('all items in correct zones — score 1', () => {
    const el = makeEl(`
      <div class="el-drop-zone" data-zone-id="z1">
        <div data-item-id="i1"></div>
      </div>
      <div class="el-drop-zone" data-zone-id="z2">
        <div data-item-id="i2"></div>
      </div>
    `)
    const result = evalDragObjects(ep, el)
    expect(result.correct).toBe(true)
    expect(result.score).toBe(1)
  })

  it('items in wrong zones — score 0', () => {
    const el = makeEl(`
      <div class="el-drop-zone" data-zone-id="z1">
        <div data-item-id="i2"></div>
      </div>
      <div class="el-drop-zone" data-zone-id="z2">
        <div data-item-id="i1"></div>
      </div>
    `)
    const result = evalDragObjects(ep, el)
    expect(result.correct).toBe(false)
    expect(result.score).toBe(0)
  })

  it('partial credit — 1 of 2 correct', () => {
    const el = makeEl(`
      <div class="el-drop-zone" data-zone-id="z1">
        <div data-item-id="i1"></div>
      </div>
      <div class="el-drop-zone" data-zone-id="z2">
        <div data-item-id="i1"></div>
      </div>
    `)
    // i1 is in z1 (correct), i2 is nowhere
    const result = evalDragObjects(ep, el)
    expect(result.score).toBeCloseTo(0.5)
  })

  it('unplaced items score 0', () => {
    const el = makeEl(`
      <div class="el-drop-zone" data-zone-id="z1"></div>
      <div class="el-drop-zone" data-zone-id="z2"></div>
    `)
    expect(evalDragObjects(ep, el).score).toBe(0)
  })
})

// ─── evalDropTarget ───────────────────────────────────────────────────────────

describe('evalDropTarget', () => {
  const items = [
    { id: 'i1', label: 'Cat', correctZoneId: 'z1' },
    { id: 'i2', label: 'Dog', correctZoneId: 'z1' },
  ]
  const zones = [
    { id: 'z1', label: 'Animals', acceptedItemIds: ['i1', 'i2'] },
    { id: 'z2', label: 'Plants', acceptedItemIds: [] },
  ]
  const ep: Record<string, unknown> = { items, zones }

  it('returns score 0 when no items defined', () => {
    expect(evalDropTarget({}, makeEl('')).score).toBe(0)
  })

  it('all items in accepted zone — score 1', () => {
    const el = makeEl(`
      <div class="el-drop-zone" data-zone-id="z1">
        <div data-item-id="i1"></div>
        <div data-item-id="i2"></div>
      </div>
      <div class="el-drop-zone" data-zone-id="z2"></div>
    `)
    const result = evalDropTarget(ep, el)
    expect(result.correct).toBe(true)
    expect(result.score).toBe(1)
  })

  it('items in unaccepted zone — score 0', () => {
    const el = makeEl(`
      <div class="el-drop-zone" data-zone-id="z1"></div>
      <div class="el-drop-zone" data-zone-id="z2">
        <div data-item-id="i1"></div>
        <div data-item-id="i2"></div>
      </div>
    `)
    const result = evalDropTarget(ep, el)
    expect(result.correct).toBe(false)
    expect(result.score).toBe(0)
  })

  it('partial — one accepted, one not', () => {
    const el = makeEl(`
      <div class="el-drop-zone" data-zone-id="z1">
        <div data-item-id="i1"></div>
      </div>
      <div class="el-drop-zone" data-zone-id="z2">
        <div data-item-id="i2"></div>
      </div>
    `)
    const result = evalDropTarget(ep, el)
    expect(result.score).toBeCloseTo(0.5)
  })
})

// ─── evalArrangeObjects ───────────────────────────────────────────────────────

describe('evalArrangeObjects', () => {
  const correctOrder = ['a', 'b', 'c']
  const ep: Record<string, unknown> = { correctOrder }

  it('returns score 0 when no order defined', () => {
    expect(evalArrangeObjects({}, makeEl('')).score).toBe(0)
  })

  it('correct order — score 1', () => {
    const el = makeEl(`
      <li class="el-arrange-item" data-item-id="a"></li>
      <li class="el-arrange-item" data-item-id="b"></li>
      <li class="el-arrange-item" data-item-id="c"></li>
    `)
    const result = evalArrangeObjects(ep, el)
    expect(result.correct).toBe(true)
    expect(result.score).toBe(1)
  })

  it('fully wrong order — score 0', () => {
    const el = makeEl(`
      <li class="el-arrange-item" data-item-id="c"></li>
      <li class="el-arrange-item" data-item-id="b"></li>
      <li class="el-arrange-item" data-item-id="a"></li>
    `)
    const result = evalArrangeObjects(ep, el)
    expect(result.correct).toBe(false)
    // b is at index 1 which is correct, so score = 1/3
    expect(result.score).toBeCloseTo(1 / 3)
  })

  it('partial credit — 2 of 3 correct', () => {
    const el = makeEl(`
      <li class="el-arrange-item" data-item-id="a"></li>
      <li class="el-arrange-item" data-item-id="b"></li>
      <li class="el-arrange-item" data-item-id="a"></li>
    `)
    // a at 0 ✓, b at 1 ✓, 'a' at 2 wrong (expected 'c') → 2/3
    const result = evalArrangeObjects(ep, el)
    expect(result.score).toBeCloseTo(2 / 3)
  })

  it('feedback says correct position count', () => {
    const el = makeEl(`
      <li class="el-arrange-item" data-item-id="a"></li>
      <li class="el-arrange-item" data-item-id="c"></li>
      <li class="el-arrange-item" data-item-id="b"></li>
    `)
    const result = evalArrangeObjects(ep, el)
    expect(result.feedback).toMatch(/1\/3/)
  })
})

// ─── evalOrderText ────────────────────────────────────────────────────────────

describe('evalOrderText', () => {
  const correctOrder = ['s1', 's2', 's3']
  const ep: Record<string, unknown> = { correctOrder }

  it('returns score 0 when no order defined', () => {
    expect(evalOrderText({}, makeEl('')).score).toBe(0)
  })

  it('correct order — score 1', () => {
    const el = makeEl(`
      <li class="el-order-item" data-seg-id="s1"></li>
      <li class="el-order-item" data-seg-id="s2"></li>
      <li class="el-order-item" data-seg-id="s3"></li>
    `)
    const result = evalOrderText(ep, el)
    expect(result.correct).toBe(true)
    expect(result.score).toBe(1)
  })

  it('wrong order — partial credit', () => {
    const el = makeEl(`
      <li class="el-order-item" data-seg-id="s2"></li>
      <li class="el-order-item" data-seg-id="s1"></li>
      <li class="el-order-item" data-seg-id="s3"></li>
    `)
    // s3 at index 2 is correct → 1/3
    const result = evalOrderText(ep, el)
    expect(result.score).toBeCloseTo(1 / 3)
  })

  it('feedback uses segment count', () => {
    const el = makeEl(`
      <li class="el-order-item" data-seg-id="s1"></li>
      <li class="el-order-item" data-seg-id="s3"></li>
      <li class="el-order-item" data-seg-id="s2"></li>
    `)
    const result = evalOrderText(ep, el)
    expect(result.feedback).toMatch(/1\/3/)
  })
})

// ─── evalHotspot — single-select ──────────────────────────────────────────────

describe('evalHotspot (single-select)', () => {
  const regions = [
    { id: 'r1', shape: { type: 'rect' as const, coords: [0, 0, 100, 100] }, isCorrect: true },
    { id: 'r2', shape: { type: 'rect' as const, coords: [200, 0, 300, 100] }, isCorrect: false, feedback: 'Wrong area.' },
  ]
  const ep: Record<string, unknown> = { regions, multiSelect: false }

  it('no click — score 0', () => {
    const el = makeEl('<div class="el-hotspot-clicks"></div>')
    const result = evalHotspot(ep, el)
    expect(result.correct).toBe(false)
    expect(result.score).toBe(0)
  })

  it('correct region clicked — score 1', () => {
    const el = makeEl('<div class="el-hotspot-clicks"><span data-region-id="r1"></span></div>')
    const result = evalHotspot(ep, el)
    expect(result.correct).toBe(true)
    expect(result.score).toBe(1)
  })

  it('incorrect region clicked — score 0', () => {
    const el = makeEl('<div class="el-hotspot-clicks"><span data-region-id="r2"></span></div>')
    const result = evalHotspot(ep, el)
    expect(result.correct).toBe(false)
    expect(result.score).toBe(0)
    expect(result.feedback).toBe('Wrong area.')
  })

  it('missing clicks container — score 0', () => {
    const el = makeEl('<div></div>')
    const result = evalHotspot(ep, el)
    expect(result.correct).toBe(false)
    expect(result.score).toBe(0)
  })
})

// ─── evalHotspot — multi-select ───────────────────────────────────────────────

describe('evalHotspot (multi-select)', () => {
  const regions = [
    { id: 'r1', shape: { type: 'rect' as const, coords: [0, 0, 50, 50] }, isCorrect: true },
    { id: 'r2', shape: { type: 'rect' as const, coords: [100, 0, 150, 50] }, isCorrect: true },
    { id: 'r3', shape: { type: 'rect' as const, coords: [200, 0, 250, 50] }, isCorrect: false },
  ]
  const ep: Record<string, unknown> = { regions, multiSelect: true }

  it('all correct regions selected — score 1', () => {
    const el = makeEl(`
      <div class="el-hotspot-clicks">
        <span data-region-id="r1"></span>
        <span data-region-id="r2"></span>
      </div>
    `)
    const result = evalHotspot(ep, el)
    expect(result.correct).toBe(true)
    expect(result.score).toBe(1)
  })

  it('one correct, one wrong — penalised score', () => {
    const el = makeEl(`
      <div class="el-hotspot-clicks">
        <span data-region-id="r1"></span>
        <span data-region-id="r3"></span>
      </div>
    `)
    // correctClicks=1, wrongClicks=1, correctRegions=2 → (1-1)/2 = 0
    const result = evalHotspot(ep, el)
    expect(result.score).toBe(0)
    expect(result.correct).toBe(false)
  })

  it('no regions defined — score 0', () => {
    const el = makeEl('<div class="el-hotspot-clicks"></div>')
    const result = evalHotspot({ regions: [], multiSelect: true }, el)
    expect(result.score).toBe(0)
  })

  it('score never goes below 0 (over-penalised)', () => {
    const el = makeEl(`
      <div class="el-hotspot-clicks">
        <span data-region-id="r3"></span>
      </div>
    `)
    // correctClicks=0, wrongClicks=1 → max(0, -1/2) = 0
    const result = evalHotspot(ep, el)
    expect(result.score).toBeGreaterThanOrEqual(0)
  })
})

// ─── Renderers ────────────────────────────────────────────────────────────────

const w = (id: string, ep: Record<string, unknown>) => ({ id, bounds, extendedProperties: ep })

describe('renderMatchItems', () => {
  it('renders el-match-select for each pair', () => {
    const html = renderMatchItems(w('q1', {
      questionText: 'Match these',
      pairs: [
        { id: 'p1', left: 'Cat', right: 'Feline' },
        { id: 'p2', left: 'Dog', right: 'Canine' },
      ],
    }))
    expect(html).toContain('class="el-match-select"')
    expect(html).toContain('data-pair-id="p1"')
    expect(html).toContain('data-pair-id="p2"')
    expect(html).toContain('data-qtype="match"')
    expect(html).toContain('el-submit-btn')
    expect(html).toContain('Match these')
  })

  it('escapes HTML in pair labels', () => {
    const html = renderMatchItems(w('q2', {
      pairs: [{ id: 'x', left: '<script>', right: '</script>' }],
    }))
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })
})

describe('renderDragObjects', () => {
  it('renders drag items and drop zones', () => {
    const html = renderDragObjects(w('q3', {
      questionText: 'Drag these',
      items: [{ id: 'i1', label: 'Apple' }],
      zones: [{ id: 'z1', label: 'Fruit' }],
    }))
    expect(html).toContain('class="el-drag-item"')
    expect(html).toContain('data-item-id="i1"')
    expect(html).toContain('class="el-drop-zone"')
    expect(html).toContain('data-zone-id="z1"')
    expect(html).toContain('data-qtype="drag-objects"')
    expect(html).toContain('el-drag-bank')
  })
})

describe('renderDropTarget', () => {
  it('uses drop-target qtype', () => {
    const html = renderDropTarget(w('q4', {
      items: [{ id: 'i1', label: 'X' }],
      zones: [{ id: 'z1', label: 'Z' }],
    }))
    expect(html).toContain('data-qtype="drop-target"')
    expect(html).not.toContain('data-qtype="drag-objects"')
  })
})

describe('renderArrangeObjects', () => {
  it('renders arrange items with up/down buttons', () => {
    const html = renderArrangeObjects(w('q5', {
      questionText: 'Arrange',
      items: [
        { id: 'a', label: 'First' },
        { id: 'b', label: 'Second' },
      ],
    }))
    expect(html).toContain('class="el-arrange-item"')
    expect(html).toContain('data-item-id="a"')
    expect(html).toContain('el-arrange-up')
    expect(html).toContain('el-arrange-down')
    expect(html).toContain('data-qtype="arrange-objects"')
    expect(html).toContain('el-arrange-list')
  })
})

describe('renderOrderText', () => {
  it('renders order items with el-order-item class', () => {
    const html = renderOrderText(w('q6', {
      questionText: 'Order these',
      segments: [
        { id: 's1', text: 'First segment' },
        { id: 's2', text: 'Second segment' },
      ],
    }))
    expect(html).toContain('class="el-order-item"')
    expect(html).toContain('data-seg-id="s1"')
    expect(html).toContain('data-seg-id="s2"')
    expect(html).toContain('data-qtype="order-text"')
  })
})

describe('renderHotspot', () => {
  it('renders canvas, img, and clicks container', () => {
    const html = renderHotspot(w('q7', {
      questionText: 'Click the hotspot',
      imageUrl: '/img/map.png',
    }))
    expect(html).toContain('el-hotspot-canvas')
    expect(html).toContain('el-hotspot-clicks')
    expect(html).toContain('src="/img/map.png"')
    expect(html).toContain('data-qtype="hotspot"')
    expect(html).toContain('Click the hotspot')
  })

  it('escapes double-quotes in imageUrl to prevent attribute breakout', () => {
    // escAttr() escapes " → &quot; so the attribute cannot be closed prematurely
    const html = renderHotspot(w('q8', {
      imageUrl: 'x" onload="alert(1)',
    }))
    expect(html).toContain('&quot;')
    expect(html).not.toContain('" onload="')
  })
})
