/**
 * T020.18 — validateSequence / validateAllSequences unit tests
 *
 * Verifies that the pre-save validation utility produces correct warnings
 * for missing params, invalid widget refs, and unknown sequence names.
 */

import { describe, it, expect } from 'vitest'
import {
  validateSequence,
  validateAllSequences,
} from '../utils/validateSequence'
import type { ActionSequence } from '../types/actions'

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
