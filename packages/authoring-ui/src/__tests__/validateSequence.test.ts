/**
 * T020.18 / T201 — validateSequence / validateAllSequences / detectCycles unit tests
 *
 * Verifies that the pre-save validation utility produces correct warnings
 * for missing params, invalid widget refs, and unknown sequence names.
 */

import { describe, it, expect } from 'vitest'
import {
  validateSequence,
  validateAllSequences,
} from '../utils/validateSequence'
import { detectCycles } from '../utils/cycleDetection'
import type { ActionSequence, SharedActionSequence } from '../types/actions'

const WIDGET_IDS = ['widget-1', 'widget-2']
const SHARED_NAMES = [{ name: 'myMacro', actions: [] as never[] }]

// ─── validateSequence ─────────────────────────────────────────────────────────

describe('validateSequence — navigate', () => {
  it('no warning for navigate next', () => {
    const seq: ActionSequence = {
      event: 'click',
      actions: [{ type: 'navigate', params: { target: 'next' } }],
    }
    expect(validateSequence(seq, { widgetIds: [], sharedSequenceNames: [] })).toHaveLength(0)
  })

  it('warns when slide-name target missing slideName', () => {
    const seq: ActionSequence = {
      event: 'click',
      actions: [{ type: 'navigate', params: { target: 'slide-name', slideName: '' } }],
    }
    const warnings = validateSequence(seq, { widgetIds: [], sharedSequenceNames: [] })
    expect(warnings).toHaveLength(1)
    expect(warnings[0].message).toContain('slide title')
  })

  it('warns when slide-number target missing slideNumber', () => {
    const seq: ActionSequence = {
      event: 'click',
      actions: [{ type: 'navigate', params: { target: 'slide-number' } }],
    }
    const warnings = validateSequence(seq, { widgetIds: [], sharedSequenceNames: [] })
    expect(warnings).toHaveLength(1)
    expect(warnings[0].message).toContain('slide number')
  })
})

describe('validateSequence — widget-ref actions', () => {
  it('warns when widgetId is empty', () => {
    const seq: ActionSequence = {
      event: 'click',
      actions: [{ type: 'show', params: { widgetId: '' } }],
    }
    const warnings = validateSequence(seq, { widgetIds: WIDGET_IDS, sharedSequenceNames: [] })
    expect(warnings).toHaveLength(1)
    expect(warnings[0].message).toContain('Widget ID')
  })

  it('warns when widgetId not found in slide widgets', () => {
    const seq: ActionSequence = {
      event: 'click',
      actions: [{ type: 'hide', params: { widgetId: 'unknown-widget' } }],
    }
    const warnings = validateSequence(seq, { widgetIds: WIDGET_IDS, sharedSequenceNames: [] })
    expect(warnings).toHaveLength(1)
    expect(warnings[0].message).toContain('unknown-widget')
  })

  it('no warning when widgetIds list is empty (offline — cannot validate)', () => {
    const seq: ActionSequence = {
      event: 'click',
      actions: [{ type: 'show', params: { widgetId: 'some-id' } }],
    }
    // widgetIds empty = can't validate, so no warning
    expect(validateSequence(seq, { widgetIds: [], sharedSequenceNames: [] })).toHaveLength(0)
  })

  it('no warning for valid widgetId', () => {
    const seq: ActionSequence = {
      event: 'click',
      actions: [{ type: 'show', params: { widgetId: 'widget-1' } }],
    }
    expect(validateSequence(seq, { widgetIds: WIDGET_IDS, sharedSequenceNames: [] })).toHaveLength(0)
  })
})

describe('validateSequence — set-variable', () => {
  it('warns when variable name is empty', () => {
    const seq: ActionSequence = {
      event: 'click',
      actions: [{ type: 'set-variable', params: { name: '', value: '1', valueType: 'literal' } }],
    }
    const warnings = validateSequence(seq, { widgetIds: [], sharedSequenceNames: [] })
    expect(warnings).toHaveLength(1)
    expect(warnings[0].message).toContain('variable name')
  })
})

describe('validateSequence — condition', () => {
  it('warns when expression is empty', () => {
    const seq: ActionSequence = {
      event: 'click',
      actions: [{ type: 'condition', params: { expression: '', then: [], else: [] } }],
    }
    const warnings = validateSequence(seq, { widgetIds: [], sharedSequenceNames: [] })
    expect(warnings).toHaveLength(1)
    expect(warnings[0].message).toContain('expression')
  })

  it('recurses into then/else branches', () => {
    const seq: ActionSequence = {
      event: 'click',
      actions: [
        {
          type: 'condition',
          params: {
            expression: '$x == 1',
            then: [{ type: 'show', params: { widgetId: '' } }],
            else: [{ type: 'hide', params: { widgetId: '' } }],
          },
        },
      ],
    }
    const warnings = validateSequence(seq, { widgetIds: WIDGET_IDS, sharedSequenceNames: [] })
    // one for empty show, one for empty hide
    expect(warnings).toHaveLength(2)
  })
})

describe('validateSequence — call-sequence', () => {
  it('warns when sequenceName is empty', () => {
    const seq: ActionSequence = {
      event: 'click',
      actions: [{ type: 'call-sequence', params: { sequenceName: '' } }],
    }
    const warnings = validateSequence(seq, { widgetIds: [], sharedSequenceNames: ['myMacro'] })
    expect(warnings).toHaveLength(1)
    expect(warnings[0].message).toContain('sequence name')
  })

  it('warns when sequenceName not found in shared sequences', () => {
    const seq: ActionSequence = {
      event: 'click',
      actions: [{ type: 'call-sequence', params: { sequenceName: 'missingMacro' } }],
    }
    const warnings = validateSequence(seq, { widgetIds: [], sharedSequenceNames: ['myMacro'] })
    expect(warnings).toHaveLength(1)
    expect(warnings[0].message).toContain('missingMacro')
  })

  it('no warning for valid sequenceName', () => {
    const seq: ActionSequence = {
      event: 'click',
      actions: [{ type: 'call-sequence', params: { sequenceName: 'myMacro' } }],
    }
    expect(validateSequence(seq, { widgetIds: [], sharedSequenceNames: ['myMacro'] })).toHaveLength(0)
  })

  it('no warning when sharedSequenceNames is empty (cannot validate)', () => {
    const seq: ActionSequence = {
      event: 'click',
      actions: [{ type: 'call-sequence', params: { sequenceName: 'anything' } }],
    }
    expect(validateSequence(seq, { widgetIds: [], sharedSequenceNames: [] })).toHaveLength(0)
  })
})

// ─── validateAllSequences ─────────────────────────────────────────────────────

describe('validateAllSequences', () => {
  it('aggregates warnings across multiple sequences', () => {
    const sequences: ActionSequence[] = [
      { event: 'click', actions: [{ type: 'show', params: { widgetId: '' } }] },
      { event: 'mouseEnter', actions: [{ type: 'hide', params: { widgetId: '' } }] },
    ]
    const warnings = validateAllSequences(sequences, WIDGET_IDS, SHARED_NAMES)
    expect(warnings).toHaveLength(2)
    expect(warnings[0].event).toBe('click')
    expect(warnings[1].event).toBe('mouseEnter')
  })

  it('returns empty array when all sequences are valid', () => {
    const sequences: ActionSequence[] = [
      { event: 'click', actions: [{ type: 'navigate', params: { target: 'next' } }] },
    ]
    expect(validateAllSequences(sequences, WIDGET_IDS, SHARED_NAMES)).toHaveLength(0)
  })
})

// ─── detectCycles (T201) ───────────────────────────────────────────────────────

describe('detectCycles — acyclic', () => {
  it('returns no cycles for empty shared sequences', () => {
    expect(detectCycles([])).toHaveLength(0)
  })

  it('returns no cycles for a linear chain A→B→C', () => {
    const shared: SharedActionSequence[] = [
      { name: 'A', actions: [{ type: 'call-sequence', params: { sequenceName: 'B' } }] },
      { name: 'B', actions: [{ type: 'call-sequence', params: { sequenceName: 'C' } }] },
      { name: 'C', actions: [] },
    ]
    expect(detectCycles(shared)).toHaveLength(0)
  })

  it('returns no cycles when call targets unknown sequences (unresolved refs)', () => {
    const shared: SharedActionSequence[] = [
      { name: 'A', actions: [{ type: 'call-sequence', params: { sequenceName: 'Unknown' } }] },
    ]
    expect(detectCycles(shared)).toHaveLength(0)
  })
})

describe('detectCycles — self-loop', () => {
  it('detects A → A', () => {
    const shared: SharedActionSequence[] = [
      { name: 'A', actions: [{ type: 'call-sequence', params: { sequenceName: 'A' } }] },
    ]
    const cycles = detectCycles(shared)
    expect(cycles).toHaveLength(1)
    expect(cycles[0].path).toEqual(['A', 'A'])
  })
})

describe('detectCycles — mutual recursion', () => {
  it('detects A → B → A', () => {
    const shared: SharedActionSequence[] = [
      { name: 'A', actions: [{ type: 'call-sequence', params: { sequenceName: 'B' } }] },
      { name: 'B', actions: [{ type: 'call-sequence', params: { sequenceName: 'A' } }] },
    ]
    const cycles = detectCycles(shared)
    expect(cycles).toHaveLength(1)
    expect(cycles[0].path[0]).toBe(cycles[0].path[cycles[0].path.length - 1])
  })

  it('detects A → B → C → A (longer chain)', () => {
    const shared: SharedActionSequence[] = [
      { name: 'A', actions: [{ type: 'call-sequence', params: { sequenceName: 'B' } }] },
      { name: 'B', actions: [{ type: 'call-sequence', params: { sequenceName: 'C' } }] },
      { name: 'C', actions: [{ type: 'call-sequence', params: { sequenceName: 'A' } }] },
    ]
    const cycles = detectCycles(shared)
    expect(cycles).toHaveLength(1)
    expect(cycles[0].path).toHaveLength(4) // A→B→C→A
  })
})

describe('detectCycles — nested in condition/loop', () => {
  it('detects cycle inside condition.then branch', () => {
    const shared: SharedActionSequence[] = [
      {
        name: 'A',
        actions: [
          {
            type: 'condition',
            params: {
              expression: '$x == 1',
              then: [{ type: 'call-sequence', params: { sequenceName: 'B' } }],
            },
          },
        ],
      },
      { name: 'B', actions: [{ type: 'call-sequence', params: { sequenceName: 'A' } }] },
    ]
    const cycles = detectCycles(shared)
    expect(cycles).toHaveLength(1)
  })

  it('detects cycle inside loop.body', () => {
    const shared: SharedActionSequence[] = [
      {
        name: 'A',
        actions: [
          {
            type: 'loop',
            params: {
              mode: 'count',
              count: 3,
              body: [{ type: 'call-sequence', params: { sequenceName: 'A' } }],
            },
          },
        ],
      },
    ]
    const cycles = detectCycles(shared)
    expect(cycles).toHaveLength(1)
    expect(cycles[0].path).toEqual(['A', 'A'])
  })
})

describe('validateAllSequences — cycle warnings (T201)', () => {
  it('reports cycle warning with event: call-sequence and actionIndex: -1', () => {
    const shared: SharedActionSequence[] = [
      { name: 'A', actions: [{ type: 'call-sequence', params: { sequenceName: 'B' } }] },
      { name: 'B', actions: [{ type: 'call-sequence', params: { sequenceName: 'A' } }] },
    ]
    const warnings = validateAllSequences([], [], shared)
    const cycleWarnings = warnings.filter((w) => w.actionIndex === -1)
    expect(cycleWarnings).toHaveLength(1)
    expect(cycleWarnings[0].event).toBe('call-sequence')
    expect(cycleWarnings[0].message).toContain('Circular dependency')
  })

  it('cycle path included in warning message', () => {
    const shared: SharedActionSequence[] = [
      { name: 'X', actions: [{ type: 'call-sequence', params: { sequenceName: 'X' } }] },
    ]
    const warnings = validateAllSequences([], [], shared)
    expect(warnings[0].message).toContain('X → X')
  })
})

// ─── TEST-03: deeply nested validation (T205) ─────────────────────────────────

describe('validateAllSequences — T205 TEST-03: deeply nested If/Loop', () => {
  it('reports warnings from 5-level deep nesting', () => {
    // Build: If → Loop → If → Loop → If → show(empty widgetId) at deepest level
    const deepSeq: ActionSequence = {
      event: 'click',
      actions: [
        {
          type: 'condition',
          params: {
            expression: '$a == 1',
            then: [
              {
                type: 'loop',
                params: {
                  mode: 'count',
                  count: 2,
                  body: [
                    {
                      type: 'condition',
                      params: {
                        expression: '$b == 2',
                        then: [
                          {
                            type: 'loop',
                            params: {
                              mode: 'count',
                              count: 2,
                              body: [
                                {
                                  type: 'condition',
                                  params: {
                                    expression: '$c == 3',
                                    then: [
                                      // Deepest level: empty widgetId → should warn
                                      { type: 'show', params: { widgetId: '' } },
                                    ],
                                  },
                                },
                              ],
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    }
    const warnings = validateAllSequences([deepSeq], ['w-1'], [])
    expect(warnings.length).toBeGreaterThanOrEqual(1)
    expect(warnings.some((w) => w.message.includes('Widget ID'))).toBe(true)
  })
})
