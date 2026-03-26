/**
 * Unit tests for actionsStore.ts — T020
 *
 * Covers all store mutations and selectors for the Actions Editor panel state.
 *
 * Test categories:
 *   1. setWidget — loads widget context
 *   2. clearWidget — resets to empty
 *   3. selectEvent — changes tab
 *   4. addSequence — creates new event handler
 *   5. removeSequence — deletes event handler
 *   6. addAction — appends action
 *   7. insertAction — inserts at specific index
 *   8. removeAction — removes by index
 *   9. updateAction — replaces immutably
 *   10. moveAction — reorders actions
 *   11. updateNestedAction — updates nested branch in condition/loop
 *   12. setVariableNames — replaces variable list
 *   13. addVariableName — appends with dedup
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useActionsStore } from '../store/actionsStore'
import { WIDGET_EVENTS, SLIDE_EVENTS } from '../types/actions'
import type { Action, ActionSequence } from '../types/actions'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Reset store to initial state before each test */
function resetStore() {
  useActionsStore.setState({
    widgetId: null,
    sequences: [],
    selectedEvent: null,
    variableNames: [],
  })
}

/** Get current store state */
function getState() {
  return useActionsStore.getState()
}

/** Simple navigate action for testing */
function navAction(target: 'next' | 'prev' | 'first' | 'last' = 'next'): Action {
  return { type: 'navigate', params: { target } }
}

/** Simple show action for testing */
function showAction(widgetId: string): Action {
  return { type: 'show', params: { widgetId } }
}

/** Simple hide action for testing */
function hideAction(widgetId: string): Action {
  return { type: 'hide', params: { widgetId } }
}

/** Simple set-variable action for testing */
function setVarAction(name: string, value: string): Action {
  return { type: 'set-variable', params: { name, value, valueType: 'literal' } }
}

/** Simple condition action (has then/else for nested testing) */
function conditionAction(thenActions: Action[] = [], elseActions: Action[] = []): Action {
  return {
    type: 'condition',
    params: { expression: '$x > 5', then: thenActions, else: elseActions },
  }
}

/** Simple loop action (has body for nested testing) */
function loopAction(bodyActions: Action[] = []): Action {
  return { type: 'loop', params: { mode: 'count', count: 3, body: bodyActions } }
}

// ─────────────────────────────────────────────────────────────────────────────
// setWidget
// ─────────────────────────────────────────────────────────────────────────────

describe('actionsStore — setWidget', () => {
  beforeEach(() => {
    resetStore()
  })

  it('sets widgetId to the provided value', () => {
    const sequences: ActionSequence[] = []
    useActionsStore.getState().setWidget('widget-123', sequences)
    expect(getState().widgetId).toBe('widget-123')
  })

  it('sets sequences to the provided array', () => {
    const sequences: ActionSequence[] = [
      { event: 'click', actions: [] },
      { event: 'mouseEnter', actions: [] },
    ]
    useActionsStore.getState().setWidget('w1', sequences)
    expect(getState().sequences).toEqual(sequences)
  })

  it('selects the first sequence event when sequences is non-empty', () => {
    const sequences: ActionSequence[] = [
      { event: 'click', actions: [] },
      { event: 'mouseEnter', actions: [] },
    ]
    useActionsStore.getState().setWidget('w1', sequences)
    expect(getState().selectedEvent).toBe('click')
  })

  it('sets selectedEvent to null when sequences is empty', () => {
    useActionsStore.getState().setWidget('w1', [])
    expect(getState().selectedEvent).toBeNull()
  })

  it('updates widgetId and sequences when called multiple times', () => {
    useActionsStore.getState().setWidget('w1', [{ event: 'click', actions: [] }])
    expect(getState().widgetId).toBe('w1')

    useActionsStore.getState().setWidget('w2', [{ event: 'enterSlide', actions: [] }])
    expect(getState().widgetId).toBe('w2')
    expect(getState().selectedEvent).toBe('enterSlide')
  })

  it('preserves variableNames (does not reset them)', () => {
    useActionsStore.getState().setVariableNames(['var1', 'var2'])
    useActionsStore.getState().setWidget('w1', [])
    expect(getState().variableNames).toEqual(['var1', 'var2'])
  })

  it('overwrites previous sequences entirely', () => {
    useActionsStore.getState().setWidget('w1', [
      { event: 'click', actions: [navAction()] },
    ])
    useActionsStore.getState().setWidget('w2', [
      { event: 'mouseEnter', actions: [] },
    ])
    expect(getState().sequences).toHaveLength(1)
    expect(getState().sequences[0]?.event).toBe('mouseEnter')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// clearWidget
// ─────────────────────────────────────────────────────────────────────────────

describe('actionsStore — clearWidget', () => {
  beforeEach(() => {
    resetStore()
  })

  it('sets widgetId to null', () => {
    useActionsStore.getState().setWidget('w1', [])
    useActionsStore.getState().clearWidget()
    expect(getState().widgetId).toBeNull()
  })

  it('clears sequences array', () => {
    useActionsStore.getState().setWidget('w1', [{ event: 'click', actions: [navAction()] }])
    useActionsStore.getState().clearWidget()
    expect(getState().sequences).toEqual([])
  })

  it('sets selectedEvent to null', () => {
    useActionsStore.getState().setWidget('w1', [{ event: 'click', actions: [] }])
    useActionsStore.getState().clearWidget()
    expect(getState().selectedEvent).toBeNull()
  })

  it('preserves variableNames (does not reset them)', () => {
    useActionsStore.getState().setVariableNames(['x', 'y'])
    useActionsStore.getState().setWidget('w1', [])
    useActionsStore.getState().clearWidget()
    expect(getState().variableNames).toEqual(['x', 'y'])
  })

  it('is idempotent when called multiple times', () => {
    useActionsStore.getState().setWidget('w1', [])
    useActionsStore.getState().clearWidget()
    useActionsStore.getState().clearWidget()
    expect(getState()).toMatchObject({
      widgetId: null,
      sequences: [],
      selectedEvent: null,
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// selectEvent
// ─────────────────────────────────────────────────────────────────────────────

describe('actionsStore — selectEvent', () => {
  beforeEach(() => {
    resetStore()
  })

  it('changes selectedEvent to the provided event name', () => {
    useActionsStore.getState().setWidget('w1', [
      { event: 'click', actions: [] },
      { event: 'mouseEnter', actions: [] },
    ])
    useActionsStore.getState().selectEvent('mouseEnter')
    expect(getState().selectedEvent).toBe('mouseEnter')
  })

  it('can switch between multiple events', () => {
    useActionsStore.getState().setWidget('w1', [
      { event: 'click', actions: [] },
      { event: 'mouseEnter', actions: [] },
      { event: 'mouseLeave', actions: [] },
    ])
    useActionsStore.getState().selectEvent('click')
    expect(getState().selectedEvent).toBe('click')
    useActionsStore.getState().selectEvent('mouseLeave')
    expect(getState().selectedEvent).toBe('mouseLeave')
  })

  it('does not validate that event exists in sequences', () => {
    useActionsStore.getState().setWidget('w1', [{ event: 'click', actions: [] }])
    // Should not error even though 'nonexistent' is not in sequences
    useActionsStore.getState().selectEvent('nonexistent')
    expect(getState().selectedEvent).toBe('nonexistent')
  })

  it('can select null', () => {
    useActionsStore.getState().setWidget('w1', [])
    useActionsStore.getState().selectEvent('click')
    expect(getState().selectedEvent).toBe('click')
    // Manually set via action (not typical, but allowed)
    useActionsStore.getState().selectEvent(null as unknown as string)
    expect(getState().selectedEvent).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// addSequence
// ─────────────────────────────────────────────────────────────────────────────

describe('actionsStore — addSequence', () => {
  beforeEach(() => {
    resetStore()
  })

  it('adds a new sequence with empty actions array', () => {
    useActionsStore.getState().addSequence('click')
    const seq = getState().sequences.find((s) => s.event === 'click')
    expect(seq).toEqual({ event: 'click', actions: [] })
  })

  it('selects the newly added sequence', () => {
    useActionsStore.getState().setWidget('w1', [])
    useActionsStore.getState().addSequence('click')
    expect(getState().selectedEvent).toBe('click')
  })

  it('selects the newly added sequence even if others existed', () => {
    useActionsStore.getState().addSequence('click')
    useActionsStore.getState().addSequence('mouseEnter')
    expect(getState().selectedEvent).toBe('mouseEnter')
  })

  it('accepts valid WIDGET_EVENTS', () => {
    for (const event of WIDGET_EVENTS) {
      resetStore()
      useActionsStore.getState().addSequence(event)
      expect(getState().sequences).toHaveLength(1)
      expect(getState().sequences[0]?.event).toBe(event)
    }
  })

  it('accepts valid SLIDE_EVENTS', () => {
    for (const event of SLIDE_EVENTS) {
      resetStore()
      useActionsStore.getState().addSequence(event)
      expect(getState().sequences).toHaveLength(1)
      expect(getState().sequences[0]?.event).toBe(event)
    }
  })

  it('ignores duplicate event (does not add second sequence)', () => {
    useActionsStore.getState().addSequence('click')
    useActionsStore.getState().addSequence('click')
    expect(getState().sequences.filter((s) => s.event === 'click')).toHaveLength(1)
  })

  it('does not change selectedEvent when duplicate event attempted', () => {
    useActionsStore.getState().addSequence('click')
    expect(getState().selectedEvent).toBe('click')
    useActionsStore.getState().addSequence('mouseEnter')
    expect(getState().selectedEvent).toBe('mouseEnter')
    useActionsStore.getState().addSequence('mouseEnter')
    expect(getState().selectedEvent).toBe('mouseEnter')
  })

  it('warns on unknown event (console.warn) and does not add', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    useActionsStore.getState().addSequence('unknownEvent')
    expect(warnSpy).toHaveBeenCalledWith(
      '[actionsStore] Unknown event name "unknownEvent" — sequence not added',
    )
    expect(getState().sequences).toHaveLength(0)
    warnSpy.mockRestore()
  })

  it('does not add unknown event even if it looks similar to valid event', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    useActionsStore.getState().addSequence('Click') // capitalized
    expect(warnSpy).toHaveBeenCalled()
    expect(getState().sequences).toHaveLength(0)
    warnSpy.mockRestore()
  })

  it('does not change selectedEvent when unknown event attempted', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    useActionsStore.getState().addSequence('click')
    expect(getState().selectedEvent).toBe('click')
    useActionsStore.getState().addSequence('notAValidEvent')
    expect(getState().selectedEvent).toBe('click')
    warnSpy.mockRestore()
  })

  it('maintains immutability: sequences array reference changes', () => {
    const before = getState().sequences
    useActionsStore.getState().addSequence('click')
    const after = getState().sequences
    expect(before).not.toBe(after)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// removeSequence
// ─────────────────────────────────────────────────────────────────────────────

describe('actionsStore — removeSequence', () => {
  beforeEach(() => {
    resetStore()
  })

  it('removes a sequence by event name', () => {
    useActionsStore.getState().addSequence('click')
    useActionsStore.getState().addSequence('mouseEnter')
    useActionsStore.getState().removeSequence('click')
    expect(getState().sequences.find((s) => s.event === 'click')).toBeUndefined()
    expect(getState().sequences.find((s) => s.event === 'mouseEnter')).toBeDefined()
  })

  it('if removed sequence was selectedEvent, selects first remaining', () => {
    useActionsStore.getState().addSequence('click')
    useActionsStore.getState().addSequence('mouseEnter')
    useActionsStore.getState().addSequence('mouseLeave')
    useActionsStore.getState().selectEvent('mouseEnter')
    useActionsStore.getState().removeSequence('mouseEnter')
    expect(getState().selectedEvent).toBe('click')
  })

  it('if last sequence removed, selectedEvent becomes null', () => {
    useActionsStore.getState().addSequence('click')
    useActionsStore.getState().removeSequence('click')
    expect(getState().selectedEvent).toBeNull()
  })

  it('preserves selectedEvent if not the removed sequence', () => {
    useActionsStore.getState().addSequence('click')
    useActionsStore.getState().addSequence('mouseEnter')
    useActionsStore.getState().selectEvent('click')
    useActionsStore.getState().removeSequence('mouseEnter')
    expect(getState().selectedEvent).toBe('click')
  })

  it('does nothing if sequence does not exist', () => {
    useActionsStore.getState().addSequence('click')
    const before = getState().sequences.length
    useActionsStore.getState().removeSequence('nonexistent')
    expect(getState().sequences.length).toBe(before)
  })

  it('maintains immutability: sequences array reference changes', () => {
    useActionsStore.getState().addSequence('click')
    const before = getState().sequences
    useActionsStore.getState().removeSequence('click')
    const after = getState().sequences
    expect(before).not.toBe(after)
  })

  it('handles removal when selectedEvent is not in sequences (edge case)', () => {
    useActionsStore.getState().addSequence('click')
    useActionsStore.getState().selectEvent('nonexistent')
    useActionsStore.getState().removeSequence('click')
    expect(getState().selectedEvent).toBe('nonexistent')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// addAction
// ─────────────────────────────────────────────────────────────────────────────

describe('actionsStore — addAction', () => {
  beforeEach(() => {
    resetStore()
  })

  it('appends action to sequence actions array', () => {
    useActionsStore.getState().addSequence('click')
    const action = navAction()
    useActionsStore.getState().addAction('click', action)
    const seq = getState().sequences.find((s) => s.event === 'click')
    expect(seq?.actions).toContain(action)
  })

  it('appends multiple actions in order', () => {
    useActionsStore.getState().addSequence('click')
    const a1 = navAction('next')
    const a2 = showAction('w1')
    const a3 = hideAction('w2')
    useActionsStore.getState().addAction('click', a1)
    useActionsStore.getState().addAction('click', a2)
    useActionsStore.getState().addAction('click', a3)
    const seq = getState().sequences.find((s) => s.event === 'click')
    expect(seq?.actions).toEqual([a1, a2, a3])
  })

  it('appends to empty actions array', () => {
    useActionsStore.getState().addSequence('click')
    expect(getState().sequences[0]?.actions).toHaveLength(0)
    useActionsStore.getState().addAction('click', navAction())
    expect(getState().sequences[0]?.actions).toHaveLength(1)
  })

  it('maintains immutability: actions array reference changes', () => {
    useActionsStore.getState().addSequence('click')
    const before = getState().sequences[0]?.actions
    useActionsStore.getState().addAction('click', navAction())
    const after = getState().sequences[0]?.actions
    expect(before).not.toBe(after)
  })

  it('supports all action types', () => {
    useActionsStore.getState().addSequence('click')
    const actions: Action[] = [
      navAction(),
      showAction('w1'),
      hideAction('w2'),
      setVarAction('x', '10'),
      { type: 'display-message', params: { message: 'Hello' } },
      { type: 'play-media', params: { widgetId: 'w3' } },
      { type: 'stop-media', params: { widgetId: 'w4' } },
      { type: 'score-question', params: { widgetId: 'w5' } },
      { type: 'score-quiz' },
      { type: 'send-to-lms' },
      { type: 'suspend-lesson' },
      conditionAction(),
      loopAction(),
    ]
    for (const action of actions) {
      useActionsStore.getState().addAction('click', action)
    }
    expect(getState().sequences[0]?.actions).toHaveLength(actions.length)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// insertAction
// ─────────────────────────────────────────────────────────────────────────────

describe('actionsStore — insertAction', () => {
  beforeEach(() => {
    resetStore()
  })

  it('inserts action at specific index', () => {
    useActionsStore.getState().addSequence('click')
    const a1 = navAction('next')
    const a2 = navAction('prev')
    const a3 = navAction('first')
    useActionsStore.getState().addAction('click', a1)
    useActionsStore.getState().addAction('click', a2)
    useActionsStore.getState().insertAction('click', 1, a3)
    const seq = getState().sequences.find((s) => s.event === 'click')
    expect(seq?.actions).toEqual([a1, a3, a2])
  })

  it('inserts at beginning (index 0)', () => {
    useActionsStore.getState().addSequence('click')
    const a1 = navAction('next')
    const a2 = navAction('prev')
    useActionsStore.getState().addAction('click', a1)
    useActionsStore.getState().insertAction('click', 0, a2)
    const seq = getState().sequences.find((s) => s.event === 'click')
    expect(seq?.actions[0]).toEqual(a2)
    expect(seq?.actions[1]).toEqual(a1)
  })

  it('inserts at end (index equals length)', () => {
    useActionsStore.getState().addSequence('click')
    const a1 = navAction('next')
    const a2 = navAction('prev')
    useActionsStore.getState().addAction('click', a1)
    useActionsStore.getState().insertAction('click', 1, a2)
    const seq = getState().sequences.find((s) => s.event === 'click')
    expect(seq?.actions).toEqual([a1, a2])
  })

  it('into empty actions array', () => {
    useActionsStore.getState().addSequence('click')
    useActionsStore.getState().insertAction('click', 0, navAction())
    const seq = getState().sequences.find((s) => s.event === 'click')
    expect(seq?.actions).toHaveLength(1)
  })

  it('maintains immutability: actions array reference changes', () => {
    useActionsStore.getState().addSequence('click')
    useActionsStore.getState().addAction('click', navAction())
    const before = getState().sequences[0]?.actions
    useActionsStore.getState().insertAction('click', 0, navAction())
    const after = getState().sequences[0]?.actions
    expect(before).not.toBe(after)
  })

  it('preserves other actions unchanged', () => {
    useActionsStore.getState().addSequence('click')
    const a1 = { type: 'show', params: { widgetId: 'orig1' } } as Action
    const a2 = { type: 'show', params: { widgetId: 'orig2' } } as Action
    useActionsStore.getState().addAction('click', a1)
    useActionsStore.getState().addAction('click', a2)
    useActionsStore.getState().insertAction('click', 1, navAction())
    const seq = getState().sequences.find((s) => s.event === 'click')
    expect(seq?.actions[0]).toBe(a1)
    expect(seq?.actions[2]).toBe(a2)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// removeAction
// ─────────────────────────────────────────────────────────────────────────────

describe('actionsStore — removeAction', () => {
  beforeEach(() => {
    resetStore()
  })

  it('removes action at specified index', () => {
    useActionsStore.getState().addSequence('click')
    const a1 = navAction('next')
    const a2 = navAction('prev')
    const a3 = navAction('first')
    useActionsStore.getState().addAction('click', a1)
    useActionsStore.getState().addAction('click', a2)
    useActionsStore.getState().addAction('click', a3)
    useActionsStore.getState().removeAction('click', 1)
    const seq = getState().sequences.find((s) => s.event === 'click')
    expect(seq?.actions).toEqual([a1, a3])
  })

  it('removes first action (index 0)', () => {
    useActionsStore.getState().addSequence('click')
    const a1 = navAction('next')
    const a2 = navAction('prev')
    useActionsStore.getState().addAction('click', a1)
    useActionsStore.getState().addAction('click', a2)
    useActionsStore.getState().removeAction('click', 0)
    const seq = getState().sequences.find((s) => s.event === 'click')
    expect(seq?.actions).toEqual([a2])
  })

  it('removes last action', () => {
    useActionsStore.getState().addSequence('click')
    const a1 = navAction('next')
    const a2 = navAction('prev')
    useActionsStore.getState().addAction('click', a1)
    useActionsStore.getState().addAction('click', a2)
    useActionsStore.getState().removeAction('click', 1)
    const seq = getState().sequences.find((s) => s.event === 'click')
    expect(seq?.actions).toEqual([a1])
  })

  it('does not affect other actions indices', () => {
    useActionsStore.getState().addSequence('click')
    const a1 = { type: 'show', params: { widgetId: 'w1' } } as Action
    const a2 = { type: 'show', params: { widgetId: 'w2' } } as Action
    const a3 = { type: 'show', params: { widgetId: 'w3' } } as Action
    useActionsStore.getState().addAction('click', a1)
    useActionsStore.getState().addAction('click', a2)
    useActionsStore.getState().addAction('click', a3)
    useActionsStore.getState().removeAction('click', 1)
    const seq = getState().sequences.find((s) => s.event === 'click')
    // Index 0 still holds a1, index 1 now holds a3 (what was index 2)
    expect(seq?.actions[0]).toBe(a1)
    expect(seq?.actions[1]).toBe(a3)
  })

  it('maintains immutability: actions array reference changes', () => {
    useActionsStore.getState().addSequence('click')
    useActionsStore.getState().addAction('click', navAction())
    useActionsStore.getState().addAction('click', navAction())
    const before = getState().sequences[0]?.actions
    useActionsStore.getState().removeAction('click', 0)
    const after = getState().sequences[0]?.actions
    expect(before).not.toBe(after)
  })

  it('results in empty actions array when last action removed', () => {
    useActionsStore.getState().addSequence('click')
    useActionsStore.getState().addAction('click', navAction())
    useActionsStore.getState().removeAction('click', 0)
    const seq = getState().sequences.find((s) => s.event === 'click')
    expect(seq?.actions).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// updateAction
// ─────────────────────────────────────────────────────────────────────────────

describe('actionsStore — updateAction', () => {
  beforeEach(() => {
    resetStore()
  })

  it('replaces action at index with new action', () => {
    useActionsStore.getState().addSequence('click')
    const old = navAction('next')
    const newAct = navAction('prev')
    useActionsStore.getState().addAction('click', old)
    useActionsStore.getState().updateAction('click', 0, newAct)
    const seq = getState().sequences.find((s) => s.event === 'click')
    expect(seq?.actions[0]).toBe(newAct)
  })

  it('does not mutate original action object passed in', () => {
    useActionsStore.getState().addSequence('click')
    const original = navAction('next')
    useActionsStore.getState().addAction('click', original)
    const replacement = navAction('prev')
    useActionsStore.getState().updateAction('click', 0, replacement)
    expect(original).toEqual(navAction('next'))
  })

  it('updates action in middle of array', () => {
    useActionsStore.getState().addSequence('click')
    const a1 = navAction('next')
    const a2 = navAction('prev')
    const a3 = navAction('first')
    useActionsStore.getState().addAction('click', a1)
    useActionsStore.getState().addAction('click', a2)
    useActionsStore.getState().addAction('click', a3)
    const updated = navAction('last')
    useActionsStore.getState().updateAction('click', 1, updated)
    const seq = getState().sequences.find((s) => s.event === 'click')
    expect(seq?.actions).toEqual([a1, updated, a3])
  })

  it('maintains immutability: actions array reference changes', () => {
    useActionsStore.getState().addSequence('click')
    useActionsStore.getState().addAction('click', navAction())
    const before = getState().sequences[0]?.actions
    useActionsStore.getState().updateAction('click', 0, showAction('w1'))
    const after = getState().sequences[0]?.actions
    expect(before).not.toBe(after)
  })

  it('maintains immutability: sequence object reference changes', () => {
    useActionsStore.getState().addSequence('click')
    useActionsStore.getState().addAction('click', navAction())
    const before = getState().sequences[0]
    useActionsStore.getState().updateAction('click', 0, showAction('w1'))
    const after = getState().sequences[0]
    expect(before).not.toBe(after)
  })

  it('can change action type', () => {
    useActionsStore.getState().addSequence('click')
    useActionsStore.getState().addAction('click', navAction())
    useActionsStore.getState().updateAction('click', 0, showAction('w1'))
    const seq = getState().sequences.find((s) => s.event === 'click')
    expect(seq?.actions[0]?.type).toBe('show')
  })

  it('preserves other actions in array', () => {
    useActionsStore.getState().addSequence('click')
    const a1 = navAction('next')
    const a2 = navAction('prev')
    useActionsStore.getState().addAction('click', a1)
    useActionsStore.getState().addAction('click', a2)
    useActionsStore.getState().updateAction('click', 0, showAction('w1'))
    const seq = getState().sequences.find((s) => s.event === 'click')
    expect(seq?.actions[1]).toBe(a2)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// moveAction
// ─────────────────────────────────────────────────────────────────────────────

describe('actionsStore — moveAction', () => {
  beforeEach(() => {
    resetStore()
  })

  it('moves action from one index to another', () => {
    useActionsStore.getState().addSequence('click')
    const a1 = navAction('next')
    const a2 = navAction('prev')
    const a3 = navAction('first')
    useActionsStore.getState().addAction('click', a1)
    useActionsStore.getState().addAction('click', a2)
    useActionsStore.getState().addAction('click', a3)
    useActionsStore.getState().moveAction('click', 0, 2)
    const seq = getState().sequences.find((s) => s.event === 'click')
    expect(seq?.actions).toEqual([a2, a3, a1])
  })

  it('moves action backward', () => {
    useActionsStore.getState().addSequence('click')
    const a1 = navAction('next')
    const a2 = navAction('prev')
    const a3 = navAction('first')
    useActionsStore.getState().addAction('click', a1)
    useActionsStore.getState().addAction('click', a2)
    useActionsStore.getState().addAction('click', a3)
    useActionsStore.getState().moveAction('click', 2, 0)
    const seq = getState().sequences.find((s) => s.event === 'click')
    expect(seq?.actions).toEqual([a3, a1, a2])
  })

  it('handles same index (no-op)', () => {
    useActionsStore.getState().addSequence('click')
    const a1 = navAction('next')
    const a2 = navAction('prev')
    useActionsStore.getState().addAction('click', a1)
    useActionsStore.getState().addAction('click', a2)
    useActionsStore.getState().moveAction('click', 0, 0)
    const seq = getState().sequences.find((s) => s.event === 'click')
    expect(seq?.actions).toEqual([a1, a2])
  })

  it('swaps first and last', () => {
    useActionsStore.getState().addSequence('click')
    const a1 = navAction('next')
    const a2 = navAction('prev')
    const a3 = navAction('first')
    useActionsStore.getState().addAction('click', a1)
    useActionsStore.getState().addAction('click', a2)
    useActionsStore.getState().addAction('click', a3)
    useActionsStore.getState().moveAction('click', 0, 2)
    const seq = getState().sequences.find((s) => s.event === 'click')
    expect(seq?.actions[0]).toBe(a2)
    expect(seq?.actions[2]).toBe(a1)
  })

  it('maintains immutability: actions array reference changes', () => {
    useActionsStore.getState().addSequence('click')
    useActionsStore.getState().addAction('click', navAction('next'))
    useActionsStore.getState().addAction('click', navAction('prev'))
    const before = getState().sequences[0]?.actions
    useActionsStore.getState().moveAction('click', 0, 1)
    const after = getState().sequences[0]?.actions
    expect(before).not.toBe(after)
  })

  it('moves adjacent actions (shift one place)', () => {
    useActionsStore.getState().addSequence('click')
    const a1 = navAction('next')
    const a2 = navAction('prev')
    useActionsStore.getState().addAction('click', a1)
    useActionsStore.getState().addAction('click', a2)
    useActionsStore.getState().moveAction('click', 0, 1)
    const seq = getState().sequences.find((s) => s.event === 'click')
    expect(seq?.actions).toEqual([a2, a1])
  })

  it('handles single-element array (no-op)', () => {
    useActionsStore.getState().addSequence('click')
    const a1 = navAction()
    useActionsStore.getState().addAction('click', a1)
    useActionsStore.getState().moveAction('click', 0, 0)
    const seq = getState().sequences.find((s) => s.event === 'click')
    expect(seq?.actions).toEqual([a1])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// updateNestedAction
// ─────────────────────────────────────────────────────────────────────────────

describe('actionsStore — updateNestedAction', () => {
  beforeEach(() => {
    resetStore()
  })

  it('updates action in then branch of condition', () => {
    useActionsStore.getState().addSequence('click')
    const thenAct = navAction('next')
    const cond = conditionAction([thenAct], [])
    useActionsStore.getState().addAction('click', cond)

    const newThenAct = navAction('prev')
    useActionsStore.getState().updateNestedAction('click', 0, ['then'], 0, newThenAct)

    const seq = getState().sequences.find((s) => s.event === 'click')
    const condAction = seq?.actions[0] as ReturnType<typeof conditionAction>
    expect(condAction.params.then[0]).toBe(newThenAct)
  })

  it('updates action in else branch of condition', () => {
    useActionsStore.getState().addSequence('click')
    const elseAct = navAction('next')
    const cond = conditionAction([], [elseAct])
    useActionsStore.getState().addAction('click', cond)

    const newElseAct = hideAction('w1')
    useActionsStore.getState().updateNestedAction('click', 0, ['else'], 0, newElseAct)

    const seq = getState().sequences.find((s) => s.event === 'click')
    const condAction = seq?.actions[0] as ReturnType<typeof conditionAction>
    expect(condAction.params.else?.[0]).toBe(newElseAct)
  })

  it('updates action in body of loop', () => {
    useActionsStore.getState().addSequence('click')
    const bodyAct = navAction('next')
    const loopAct = loopAction([bodyAct])
    useActionsStore.getState().addAction('click', loopAct)

    const newBodyAct = showAction('w1')
    useActionsStore.getState().updateNestedAction('click', 0, ['body'], 0, newBodyAct)

    const seq = getState().sequences.find((s) => s.event === 'click')
    const updatedLoop = seq?.actions[0] as ReturnType<typeof loopAction>
    expect(updatedLoop.params.body[0]).toBe(newBodyAct)
  })

  it('updates nested action at specific index in branch', () => {
    useActionsStore.getState().addSequence('click')
    const then0 = navAction('next')
    const then1 = navAction('prev')
    const cond = conditionAction([then0, then1], [])
    useActionsStore.getState().addAction('click', cond)

    const newThen1 = navAction('first')
    useActionsStore.getState().updateNestedAction('click', 0, ['then'], 1, newThen1)

    const seq = getState().sequences.find((s) => s.event === 'click')
    const condAction = seq?.actions[0] as ReturnType<typeof conditionAction>
    // After updateNestedAction, objects are deep-cloned, so use toEqual instead of toBe
    expect(condAction.params.then[0]).toEqual(then0)
    expect(condAction.params.then[1]).toEqual(newThen1)
  })

  it('does not mutate original nested action (deep clone)', () => {
    useActionsStore.getState().addSequence('click')
    const thenAct = navAction('next')
    const cond = conditionAction([thenAct], [])
    useActionsStore.getState().addAction('click', cond)

    const newThenAct = navAction('prev')
    useActionsStore.getState().updateNestedAction('click', 0, ['then'], 0, newThenAct)

    // Verify original condition action was not mutated
    const seq = getState().sequences.find((s) => s.event === 'click')
    const condAction = seq?.actions[0] as ReturnType<typeof conditionAction>
    const params = condAction.params as unknown as Record<string, unknown>
    expect(params).toHaveProperty('then')
    expect((params.then as unknown as Action[])[0]).toBe(newThenAct)
  })

  it('preserves other nested actions in same branch', () => {
    useActionsStore.getState().addSequence('click')
    const then0 = navAction('next')
    const then1 = navAction('prev')
    const cond = conditionAction([then0, then1], [])
    useActionsStore.getState().addAction('click', cond)

    const newThen0 = showAction('w1')
    useActionsStore.getState().updateNestedAction('click', 0, ['then'], 0, newThen0)

    const seq = getState().sequences.find((s) => s.event === 'click')
    const condAction = seq?.actions[0] as ReturnType<typeof conditionAction>
    // After updateNestedAction, objects are deep-cloned, so use toEqual instead of toBe
    expect(condAction.params.then[1]).toEqual(then1)
  })

  it('preserves other branches when updating one', () => {
    useActionsStore.getState().addSequence('click')
    const thenAct = navAction('next')
    const elseAct = navAction('prev')
    const cond = conditionAction([thenAct], [elseAct])
    useActionsStore.getState().addAction('click', cond)

    const newThenAct = showAction('w1')
    useActionsStore.getState().updateNestedAction('click', 0, ['then'], 0, newThenAct)

    const seq = getState().sequences.find((s) => s.event === 'click')
    const condAction = seq?.actions[0] as ReturnType<typeof conditionAction>
    // After updateNestedAction, objects are deep-cloned, so use toEqual instead of toBe
    expect(condAction.params.else?.[0]).toEqual(elseAct)
  })

  it('maintains immutability: actions array reference changes', () => {
    useActionsStore.getState().addSequence('click')
    const cond = conditionAction([navAction()], [])
    useActionsStore.getState().addAction('click', cond)
    const before = getState().sequences[0]?.actions
    useActionsStore.getState().updateNestedAction('click', 0, ['then'], 0, showAction('w1'))
    const after = getState().sequences[0]?.actions
    expect(before).not.toBe(after)
  })

  it('handles multiple levels of nesting (e.g., condition inside loop)', () => {
    useActionsStore.getState().addSequence('click')
    const innerCond = conditionAction([navAction('next')], [])
    const loop = loopAction([innerCond])
    useActionsStore.getState().addAction('click', loop)

    // Update the nested condition's then branch
    const newAct = showAction('w1')
    useActionsStore.getState().updateNestedAction('click', 0, ['body'], 0, newAct)

    const seq = getState().sequences.find((s) => s.event === 'click')
    const loopAct = seq?.actions[0] as ReturnType<typeof loopAction>
    expect(loopAct.params.body[0]).toBe(newAct)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// setVariableNames
// ─────────────────────────────────────────────────────────────────────────────

describe('actionsStore — setVariableNames', () => {
  beforeEach(() => {
    resetStore()
  })

  it('replaces variableNames array', () => {
    useActionsStore.getState().setVariableNames(['x', 'y', 'z'])
    expect(getState().variableNames).toEqual(['x', 'y', 'z'])
  })

  it('overwrites previous variable names completely', () => {
    useActionsStore.getState().setVariableNames(['a', 'b'])
    useActionsStore.getState().setVariableNames(['x', 'y', 'z'])
    expect(getState().variableNames).toEqual(['x', 'y', 'z'])
  })

  it('sets to empty array', () => {
    useActionsStore.getState().setVariableNames(['a', 'b', 'c'])
    useActionsStore.getState().setVariableNames([])
    expect(getState().variableNames).toEqual([])
  })

  it('maintains immutability: array reference changes', () => {
    const before = getState().variableNames
    useActionsStore.getState().setVariableNames(['x'])
    const after = getState().variableNames
    expect(before).not.toBe(after)
  })

  it('does not preserve previous variables (complete replacement)', () => {
    useActionsStore.getState().setVariableNames(['old1', 'old2'])
    useActionsStore.getState().setVariableNames(['new1'])
    expect(getState().variableNames).toEqual(['new1'])
    expect(getState().variableNames).not.toContain('old1')
  })

  it('handles unicode and special characters in variable names', () => {
    useActionsStore.getState().setVariableNames(['$var1', '_private', 'camelCase', 'snake_case'])
    expect(getState().variableNames).toEqual(['$var1', '_private', 'camelCase', 'snake_case'])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// addVariableName
// ─────────────────────────────────────────────────────────────────────────────

describe('actionsStore — addVariableName', () => {
  beforeEach(() => {
    resetStore()
  })

  it('appends variable name to list', () => {
    useActionsStore.getState().addVariableName('x')
    expect(getState().variableNames).toContain('x')
  })

  it('appends multiple variables in order', () => {
    useActionsStore.getState().addVariableName('x')
    useActionsStore.getState().addVariableName('y')
    useActionsStore.getState().addVariableName('z')
    expect(getState().variableNames).toEqual(['x', 'y', 'z'])
  })

  it('ignores duplicate variable name', () => {
    useActionsStore.getState().addVariableName('x')
    useActionsStore.getState().addVariableName('x')
    expect(getState().variableNames).toEqual(['x'])
  })

  it('detects duplicate even with multiple existing variables', () => {
    useActionsStore.getState().addVariableName('a')
    useActionsStore.getState().addVariableName('b')
    useActionsStore.getState().addVariableName('c')
    useActionsStore.getState().addVariableName('b')
    expect(getState().variableNames).toEqual(['a', 'b', 'c'])
  })

  it('ignores duplicate regardless of add order', () => {
    useActionsStore.getState().addVariableName('first')
    useActionsStore.getState().addVariableName('second')
    useActionsStore.getState().addVariableName('first')
    expect(getState().variableNames).toEqual(['first', 'second'])
  })

  it('maintains immutability: array reference changes on add', () => {
    useActionsStore.getState().addVariableName('x')
    const before = getState().variableNames
    useActionsStore.getState().addVariableName('y')
    const after = getState().variableNames
    expect(before).not.toBe(after)
  })

  it('does not change array reference when duplicate attempted', () => {
    useActionsStore.getState().addVariableName('x')
    const before = getState().variableNames
    useActionsStore.getState().addVariableName('x')
    const after = getState().variableNames
    expect(before).toBe(after)
  })

  it('handles empty string variable name', () => {
    useActionsStore.getState().addVariableName('')
    expect(getState().variableNames).toContain('')
  })

  it('handles unicode variable names', () => {
    useActionsStore.getState().addVariableName('μ')
    useActionsStore.getState().addVariableName('π')
    expect(getState().variableNames).toContain('μ')
    expect(getState().variableNames).toContain('π')
  })

  it('preserves variable order (FIFO)', () => {
    for (const name of ['apple', 'banana', 'cherry']) {
      useActionsStore.getState().addVariableName(name)
    }
    expect(getState().variableNames).toEqual(['apple', 'banana', 'cherry'])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Integration tests — multiple operations
// ─────────────────────────────────────────────────────────────────────────────

describe('actionsStore — integration', () => {
  beforeEach(() => {
    resetStore()
  })

  it('full workflow: load widget → add sequences → add actions → update', () => {
    // Load widget
    useActionsStore.getState().setWidget('widget-1', [])
    expect(getState().widgetId).toBe('widget-1')

    // Add sequences
    useActionsStore.getState().addSequence('click')
    useActionsStore.getState().addSequence('mouseEnter')
    expect(getState().sequences).toHaveLength(2)

    // Add actions
    useActionsStore.getState().addAction('click', navAction('next'))
    useActionsStore.getState().addAction('click', showAction('w1'))
    expect(getState().sequences[0]?.actions).toHaveLength(2)

    // Update action
    useActionsStore.getState().updateAction('click', 0, navAction('prev'))
    expect((getState().sequences[0]?.actions[0] as Record<string, Record<string, string>>).params.target).toBe('prev')

    // Switch event
    useActionsStore.getState().selectEvent('mouseEnter')
    expect(getState().selectedEvent).toBe('mouseEnter')

    // Add variable
    useActionsStore.getState().addVariableName('score')
    expect(getState().variableNames).toContain('score')
  })

  it('immutability check: no mutation across multiple operations', () => {
    useActionsStore.getState().setWidget('w1', [])
    const snap1Seqs = getState().sequences
    useActionsStore.getState().addSequence('click')
    const snap2Seqs = getState().sequences
    expect(snap1Seqs).not.toBe(snap2Seqs)

    const snap2Click = snap2Seqs[0]
    useActionsStore.getState().addAction('click', navAction())
    const snap3Click = getState().sequences[0]
    expect(snap2Click).not.toBe(snap3Click)
  })

  it('independent store instances do not share state', () => {
    useActionsStore.getState().setWidget('w1', [])
    useActionsStore.getState().addSequence('click')
    const state1 = getState()
    expect(state1.sequences).toHaveLength(1)

    // Create another reference to confirm Zustand singleton
    const state2 = useActionsStore.getState()
    expect(state1).toBe(state2)
  })
})
