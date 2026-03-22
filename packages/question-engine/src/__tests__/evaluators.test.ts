import { describe, it, expect } from 'vitest'
import { evaluateMatchItems }    from '../evaluators/match-items'
import { evaluateDragObjects }   from '../evaluators/drag-objects'
import { evaluateDropTarget }    from '../evaluators/drop-target'
import { evaluateArrangeObjects } from '../evaluators/arrange-objects'
import { evaluateOrderText }     from '../evaluators/order-text'
import {
  evaluateHotspot,
  pointInRect, pointInCircle, pointInPolygon,
} from '../evaluators/hotspot'
import {
  evaluateMultipleChoice as evaluateMCById,
  buildRandomizationState,
} from '../evaluators/multiple-choice'
import type {
  MatchItemsExtendedProps,
  DragObjectsExtendedProps,
  DropTargetExtendedProps,
  ArrangeObjectsExtendedProps,
  OrderTextExtendedProps,
  HotspotExtendedProps,
  MCExtendedProps,
} from '../types'

// ─── evaluateMatchItems ───────────────────────────────────────────────────────

describe('evaluateMatchItems', () => {
  const props: MatchItemsExtendedProps = {
    questionText: 'Match capitals',
    pairs: [
      { id: 'p1', left: 'France',  right: 'Paris' },
      { id: 'p2', left: 'Germany', right: 'Berlin' },
      { id: 'p3', left: 'Italy',   right: 'Rome' },
    ],
    scoring: { weight: 100, attempts: -1 },
  }

  it('returns score=1 when all pairs matched correctly', () => {
    const r = evaluateMatchItems(props, { p1: 'Paris', p2: 'Berlin', p3: 'Rome' })
    expect(r.correct).toBe(true)
    expect(r.score).toBe(1)
  })

  it('returns partial score for partial match', () => {
    const r = evaluateMatchItems(props, { p1: 'Paris', p2: 'Rome', p3: 'Berlin' })
    expect(r.correct).toBe(false)
    expect(r.score).toBeCloseTo(1 / 3)
  })

  it('returns score=0 when all wrong', () => {
    const r = evaluateMatchItems(props, { p1: 'Rome', p2: 'Paris', p3: 'Berlin' })
    expect(r.score).toBe(0)
  })

  it('handles empty pairs', () => {
    const r = evaluateMatchItems({ ...props, pairs: [] }, {})
    expect(r.correct).toBe(false)
    expect(r.score).toBe(0)
  })
})

// ─── evaluateDragObjects ──────────────────────────────────────────────────────

describe('evaluateDragObjects', () => {
  const props: DragObjectsExtendedProps = {
    questionText: 'Sort by size',
    items: [
      { id: 'i1', label: 'Cat',      correctZoneId: 'small' },
      { id: 'i2', label: 'Elephant', correctZoneId: 'large' },
    ],
    zones: [
      { id: 'small', label: 'Small' },
      { id: 'large', label: 'Large' },
    ],
    scoring: { weight: 100, attempts: -1 },
  }

  it('full score when all items in correct zones', () => {
    const r = evaluateDragObjects(props, { i1: 'small', i2: 'large' })
    expect(r.correct).toBe(true)
    expect(r.score).toBe(1)
  })

  it('partial score when one item is wrong', () => {
    const r = evaluateDragObjects(props, { i1: 'large', i2: 'large' })
    expect(r.score).toBe(0.5)
  })

  it('zero score when all wrong', () => {
    const r = evaluateDragObjects(props, { i1: 'large', i2: 'small' })
    expect(r.score).toBe(0)
  })
})

// ─── evaluateDropTarget ───────────────────────────────────────────────────────

describe('evaluateDropTarget', () => {
  const props: DropTargetExtendedProps = {
    questionText: 'Place items',
    items: [
      { id: 'apple',  label: 'Apple',  correctZoneId: 'fruit' },
      { id: 'carrot', label: 'Carrot', correctZoneId: 'veg' },
    ],
    zones: [
      { id: 'fruit', label: 'Fruit', acceptedItemIds: ['apple'] },
      { id: 'veg',   label: 'Vegetable', acceptedItemIds: ['carrot'] },
    ],
    scoring: { weight: 100, attempts: -1 },
  }

  it('full score for correct placement', () => {
    const r = evaluateDropTarget(props, { apple: 'fruit', carrot: 'veg' })
    expect(r.correct).toBe(true)
    expect(r.score).toBe(1)
  })

  it('zero score when items swapped', () => {
    const r = evaluateDropTarget(props, { apple: 'veg', carrot: 'fruit' })
    expect(r.score).toBe(0)
  })

  it('partial score for one correct', () => {
    const r = evaluateDropTarget(props, { apple: 'fruit', carrot: 'fruit' })
    expect(r.score).toBe(0.5)
  })
})

// ─── evaluateArrangeObjects ───────────────────────────────────────────────────

describe('evaluateArrangeObjects', () => {
  const props: ArrangeObjectsExtendedProps = {
    questionText: 'Order steps',
    items: [
      { id: 'a', label: 'Step A' },
      { id: 'b', label: 'Step B' },
      { id: 'c', label: 'Step C' },
    ],
    correctOrder: ['a', 'b', 'c'],
    scoring: { weight: 100, attempts: -1 },
  }

  it('score=1 for correct order', () => {
    const r = evaluateArrangeObjects(props, ['a', 'b', 'c'])
    expect(r.correct).toBe(true)
    expect(r.score).toBe(1)
  })

  it('partial score for one wrong position', () => {
    const r = evaluateArrangeObjects(props, ['a', 'c', 'b'])
    expect(r.score).toBeCloseTo(1 / 3)
  })

  it('partial score for reverse order (middle element stays correct)', () => {
    // ['c','b','a'] vs correct ['a','b','c'] — 'b' at index 1 matches → 1/3
    const r = evaluateArrangeObjects(props, ['c', 'b', 'a'])
    expect(r.score).toBeCloseTo(1 / 3)
    expect(r.correct).toBe(false)
  })
})

// ─── evaluateOrderText ────────────────────────────────────────────────────────

describe('evaluateOrderText', () => {
  const props: OrderTextExtendedProps = {
    questionText: 'Order sentences',
    segments: [
      { id: 's1', text: 'First.' },
      { id: 's2', text: 'Second.' },
    ],
    correctOrder: ['s1', 's2'],
    scoring: { weight: 100, attempts: -1 },
  }

  it('score=1 for correct order', () => {
    const r = evaluateOrderText(props, ['s1', 's2'])
    expect(r.correct).toBe(true)
  })

  it('score=0 for reversed order', () => {
    const r = evaluateOrderText(props, ['s2', 's1'])
    expect(r.score).toBe(0)
  })
})

// ─── Hotspot geometry ─────────────────────────────────────────────────────────

describe('pointInRect', () => {
  it('returns true for a point inside', () => {
    expect(pointInRect(5, 5, 0, 0, 10, 10)).toBe(true)
  })
  it('returns true for a point on boundary', () => {
    expect(pointInRect(0, 0, 0, 0, 10, 10)).toBe(true)
  })
  it('returns false for a point outside', () => {
    expect(pointInRect(11, 5, 0, 0, 10, 10)).toBe(false)
  })
})

describe('pointInCircle', () => {
  it('returns true for center', () => {
    expect(pointInCircle(5, 5, 5, 5, 10)).toBe(true)
  })
  it('returns true for a point on radius', () => {
    expect(pointInCircle(15, 5, 5, 5, 10)).toBe(true)
  })
  it('returns false outside', () => {
    expect(pointInCircle(20, 5, 5, 5, 10)).toBe(false)
  })
})

describe('pointInPolygon', () => {
  // Square: (0,0) (10,0) (10,10) (0,10)
  const square = [0, 0, 10, 0, 10, 10, 0, 10]

  it('returns true for interior point', () => {
    expect(pointInPolygon(5, 5, square)).toBe(true)
  })
  it('returns false for exterior point', () => {
    expect(pointInPolygon(15, 5, square)).toBe(false)
  })
  it('returns false for degenerate polygon (<3 points)', () => {
    expect(pointInPolygon(0, 0, [0, 0, 1, 1])).toBe(false)
  })
})

// ─── evaluateHotspot ─────────────────────────────────────────────────────────

describe('evaluateHotspot (single-select)', () => {
  const props: HotspotExtendedProps = {
    questionText: 'Click the correct region',
    imageUrl: 'img.png',
    regions: [
      { id: 'correct', shape: { type: 'rect', coords: [0, 0, 100, 100] }, isCorrect: true },
      { id: 'wrong',   shape: { type: 'rect', coords: [200, 0, 300, 100] }, isCorrect: false },
    ],
    scoring: { weight: 100, attempts: -1 },
  }

  it('correct region clicked → score=1', () => {
    const r = evaluateHotspot(props, ['correct'])
    expect(r.correct).toBe(true)
    expect(r.score).toBe(1)
  })

  it('wrong region clicked → score=0', () => {
    const r = evaluateHotspot(props, ['wrong'])
    expect(r.correct).toBe(false)
    expect(r.score).toBe(0)
  })

  it('no click → score=0', () => {
    const r = evaluateHotspot(props, [])
    expect(r.score).toBe(0)
  })
})

describe('evaluateHotspot (multi-select)', () => {
  const props: HotspotExtendedProps = {
    questionText: 'Click all correct regions',
    imageUrl: 'img.png',
    multiSelect: true,
    regions: [
      { id: 'r1', shape: { type: 'rect', coords: [0, 0, 50, 50] },   isCorrect: true },
      { id: 'r2', shape: { type: 'rect', coords: [50, 0, 100, 50] },  isCorrect: true },
      { id: 'r3', shape: { type: 'rect', coords: [100, 0, 150, 50] }, isCorrect: false },
    ],
    scoring: { weight: 100, attempts: -1 },
  }

  it('both correct clicked → score=1', () => {
    const r = evaluateHotspot(props, ['r1', 'r2'])
    expect(r.score).toBe(1)
  })

  it('one correct + one wrong → penalised', () => {
    const r = evaluateHotspot(props, ['r1', 'r3'])
    // correct=1, wrong=1 → (1-1)/2 = 0
    expect(r.score).toBe(0)
  })

  it('score clamped to 0 when more wrong than correct', () => {
    const r = evaluateHotspot(props, ['r3'])
    expect(r.score).toBe(0)
  })
})

// ─── evaluateMultipleChoiceById ───────────────────────────────────────────────

describe('evaluateMCById', () => {
  const props: MCExtendedProps = {
    questionText: 'Pick one',
    options: [
      { id: 'a', text: 'Wrong' },
      { id: 'b', text: 'Correct', feedback: 'Nice!' },
      { id: 'c', text: 'Also wrong' },
    ],
    correctId: 'b',
    scoring: { weight: 100, attempts: -1 },
    correctFeedback: 'Well done!',
    incorrectFeedback: 'Try again.',
  }

  it('correct id → score=1', () => {
    const r = evaluateMCById(props, 'b')
    expect(r.correct).toBe(true)
    expect(r.score).toBe(1)
    expect(r.feedback).toBe('Nice!') // per-option feedback wins
  })

  it('wrong id → score=0', () => {
    const r = evaluateMCById(props, 'a')
    expect(r.correct).toBe(false)
    expect(r.score).toBe(0)
    expect(r.feedback).toBe('Try again.')
  })
})

// ─── buildRandomizationState ─────────────────────────────────────────────────

describe('buildRandomizationState', () => {
  const props: MCExtendedProps = {
    questionText: 'Pick',
    options: [
      { id: 'a', text: 'A' },
      { id: 'b', text: 'B' },
      { id: 'c', text: 'C' },
    ],
    correctId: 'b',
    scoring: { weight: 100, attempts: -1 },
  }

  it('shuffledIndices contains all original indices', () => {
    const state = buildRandomizationState(props)
    expect(state.shuffledIndices.slice().sort()).toEqual([0, 1, 2])
  })

  it('correctDisplayIndex points to correct option', () => {
    const state = buildRandomizationState(props)
    const originalIndex = state.shuffledIndices[state.correctDisplayIndex]
    expect(props.options[originalIndex].id).toBe('b')
  })

  it('deterministic with fixed rng', () => {
    let seed = 0
    const rng = () => { seed = (seed + 0.3) % 1; return seed }
    const s1 = buildRandomizationState(props, rng)
    seed = 0
    const s2 = buildRandomizationState(props, rng)
    expect(s1.shuffledIndices).toEqual(s2.shuffledIndices)
  })
})
