/**
 * Unit tests for T021 — ActionExecutor, EventDispatcher, and expression evaluator.
 *
 * Uses vitest + jsdom environment.
 */

import { describe, it, expect, vi } from 'vitest'
import { ActionExecutor } from '../actions/executor'
import { EventDispatcher } from '../actions/dispatcher'
import { createExecutionContext } from '../actions/context'
import { evaluateCondition, evaluateExpression } from '../actions/expression'
import type { Action, ActionSequence } from '../actions/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCtx(overrides = {}) {
  return createExecutionContext({
    container: document.createElement('div'),
    ...overrides,
  })
}

// ─── Expression evaluator ─────────────────────────────────────────────────────

describe('evaluateCondition', () => {
  it('true literal', () => expect(evaluateCondition('true', new Map())).toBe(true))
  it('false literal', () => expect(evaluateCondition('false', new Map())).toBe(false))

  it('variable truthy check', () => {
    const vars = new Map([['score', '1']])
    expect(evaluateCondition('$score', vars)).toBe(true)
  })

  it('variable falsy check — empty string', () => {
    const vars = new Map([['name', '']])
    expect(evaluateCondition('$name', vars)).toBe(false)
  })

  it('variable falsy check — "false"', () => {
    const vars = new Map([['flag', 'false']])
    expect(evaluateCondition('$flag', vars)).toBe(false)
  })

  it('string equality', () => {
    const vars = new Map([['status', 'pass']])
    expect(evaluateCondition('$status == "pass"', vars)).toBe(true)
    expect(evaluateCondition('$status == "fail"', vars)).toBe(false)
  })

  it('numeric greater-than', () => {
    const vars = new Map([['score', '90']])
    expect(evaluateCondition('$score > 80', vars)).toBe(true)
    expect(evaluateCondition('$score > 95', vars)).toBe(false)
  })

  it('numeric greater-than-or-equal', () => {
    const vars = new Map([['score', '80']])
    expect(evaluateCondition('$score >= 80', vars)).toBe(true)
    expect(evaluateCondition('$score >= 81', vars)).toBe(false)
  })

  it('inequality', () => {
    const vars = new Map([['x', '5']])
    expect(evaluateCondition('$x != 3', vars)).toBe(true)
    expect(evaluateCondition('$x != 5', vars)).toBe(false)
  })

  it('negation with !', () => {
    const vars = new Map([['flag', 'true']])
    // negate truthy
    expect(evaluateCondition('!$flag', vars)).toBe(false)
  })

  it('variable to variable comparison', () => {
    const vars = new Map([['a', '10'], ['b', '10']])
    expect(evaluateCondition('$a == $b', vars)).toBe(true)
  })

  it('unknown expression returns false', () => {
    expect(evaluateCondition('this is garbage |||', new Map())).toBe(false)
  })
})

describe('evaluateExpression', () => {
  it('returns variable value', () => {
    const vars = new Map([['name', 'Alice']])
    expect(evaluateExpression('$name', vars)).toBe('Alice')
  })

  it('returns unknown variable as empty string', () => {
    expect(evaluateExpression('$missing', new Map())).toBe('')
  })

  it('numeric addition', () => {
    const vars = new Map([['a', '3'], ['b', '4']])
    expect(evaluateExpression('$a + $b', vars)).toBe('7')
  })

  it('numeric multiplication', () => {
    const vars = new Map([['x', '6']])
    expect(evaluateExpression('$x * 2', vars)).toBe('12')
  })

  it('division by zero returns "0"', () => {
    const vars = new Map([['n', '5']])
    expect(evaluateExpression('$n / 0', vars)).toBe('0')
  })
})

// ─── ActionExecutor — navigate ────────────────────────────────────────────────

describe('ActionExecutor — navigate', () => {
  it('navigate next increments slide index', async () => {
    const goToIndex = vi.fn()
    const ctx = makeCtx({
      navigation: {
        goToIndex,
        getCurrentIndex: () => 1,
        getSlideCount: () => 5,
        getSlides: () => [],
      },
    })
    const executor = new ActionExecutor(ctx)
    await executor.run([{ type: 'navigate', params: { target: 'next' } }])
    expect(goToIndex).toHaveBeenCalledWith(2)
  })

  it('navigate next does not go past last slide', async () => {
    const goToIndex = vi.fn()
    const ctx = makeCtx({
      navigation: {
        goToIndex,
        getCurrentIndex: () => 4,
        getSlideCount: () => 5,
        getSlides: () => [],
      },
    })
    await new ActionExecutor(ctx).run([{ type: 'navigate', params: { target: 'next' } }])
    expect(goToIndex).not.toHaveBeenCalled()
  })

  it('navigate prev decrements slide index', async () => {
    const goToIndex = vi.fn()
    const ctx = makeCtx({
      navigation: {
        goToIndex,
        getCurrentIndex: () => 2,
        getSlideCount: () => 5,
        getSlides: () => [],
      },
    })
    await new ActionExecutor(ctx).run([{ type: 'navigate', params: { target: 'prev' } }])
    expect(goToIndex).toHaveBeenCalledWith(1)
  })

  it('navigate first goes to index 0', async () => {
    const goToIndex = vi.fn()
    const ctx = makeCtx({
      navigation: { goToIndex, getCurrentIndex: () => 3, getSlideCount: () => 5, getSlides: () => [] },
    })
    await new ActionExecutor(ctx).run([{ type: 'navigate', params: { target: 'first' } }])
    expect(goToIndex).toHaveBeenCalledWith(0)
  })

  it('navigate last goes to last index', async () => {
    const goToIndex = vi.fn()
    const ctx = makeCtx({
      navigation: { goToIndex, getCurrentIndex: () => 0, getSlideCount: () => 5, getSlides: () => [] },
    })
    await new ActionExecutor(ctx).run([{ type: 'navigate', params: { target: 'last' } }])
    expect(goToIndex).toHaveBeenCalledWith(4)
  })

  it('navigate slide-name finds slide by title (case-insensitive)', async () => {
    const goToIndex = vi.fn()
    const ctx = makeCtx({
      navigation: {
        goToIndex,
        getCurrentIndex: () => 0,
        getSlideCount: () => 3,
        getSlides: () => [
          { id: '1', title: 'Introduction' },
          { id: '2', title: 'Chapter One' },
          { id: '3', title: 'Summary' },
        ],
      },
    })
    await new ActionExecutor(ctx).run([
      { type: 'navigate', params: { target: 'slide-name', slideName: 'chapter one' } },
    ])
    expect(goToIndex).toHaveBeenCalledWith(1)
  })

  it('navigate slide-number uses 1-based index', async () => {
    const goToIndex = vi.fn()
    const ctx = makeCtx({
      navigation: { goToIndex, getCurrentIndex: () => 0, getSlideCount: () => 5, getSlides: () => [] },
    })
    await new ActionExecutor(ctx).run([
      { type: 'navigate', params: { target: 'slide-number', slideNumber: 3 } },
    ])
    expect(goToIndex).toHaveBeenCalledWith(2)
  })
})

// ─── ActionExecutor — visibility ──────────────────────────────────────────────

describe('ActionExecutor — show/hide', () => {
  it('hide sets display:none on widget element', async () => {
    const el = document.createElement('div')
    el.style.display = 'block'
    const ctx = makeCtx({
      getWidget: (id: string) => (id === 'w1' ? { id: 'w1', type: 'text', el } : undefined),
    })
    await new ActionExecutor(ctx).run([{ type: 'hide', params: { widgetId: 'w1' } }])
    expect(el.style.display).toBe('none')
    expect(el.getAttribute('data-hidden')).toBe('true')
  })

  it('show removes display:none on widget element', async () => {
    const el = document.createElement('div')
    el.style.display = 'none'
    el.setAttribute('data-hidden', 'true')
    const ctx = makeCtx({
      getWidget: (id: string) => (id === 'w2' ? { id: 'w2', type: 'text', el } : undefined),
    })
    await new ActionExecutor(ctx).run([{ type: 'show', params: { widgetId: 'w2' } }])
    expect(el.style.display).toBe('')
    expect(el.getAttribute('data-hidden')).toBeNull()
  })

  it('hide/show on unknown widget id does not throw', async () => {
    const ctx = makeCtx({ getWidget: () => undefined })
    await expect(
      new ActionExecutor(ctx).run([
        { type: 'hide', params: { widgetId: 'ghost' } },
        { type: 'show', params: { widgetId: 'ghost' } },
      ]),
    ).resolves.toBeUndefined()
  })
})

// ─── ActionExecutor — variables ───────────────────────────────────────────────

describe('ActionExecutor — set-variable', () => {
  it('stores a literal variable', async () => {
    const ctx = makeCtx()
    await new ActionExecutor(ctx).run([
      { type: 'set-variable', params: { name: 'greeting', value: 'hello', valueType: 'literal' } },
    ])
    expect(ctx.variables.get('greeting')).toBe('hello')
  })

  it('evaluates an expression variable', async () => {
    const ctx = makeCtx()
    ctx.variables.set('score', '5')
    await new ActionExecutor(ctx).run([
      { type: 'set-variable', params: { name: 'doubled', value: '$score * 2', valueType: 'expression' } },
    ])
    expect(ctx.variables.get('doubled')).toBe('10')
  })
})

// ─── ActionExecutor — condition ───────────────────────────────────────────────

describe('ActionExecutor — condition', () => {
  it('executes then branch when condition is true', async () => {
    const ctx = makeCtx()
    ctx.variables.set('x', '10')
    await new ActionExecutor(ctx).run([
      {
        type: 'condition',
        params: {
          expression: '$x > 5',
          then: [{ type: 'set-variable', params: { name: 'result', value: 'big', valueType: 'literal' } }],
          else: [{ type: 'set-variable', params: { name: 'result', value: 'small', valueType: 'literal' } }],
        },
      },
    ])
    expect(ctx.variables.get('result')).toBe('big')
  })

  it('executes else branch when condition is false', async () => {
    const ctx = makeCtx()
    ctx.variables.set('x', '2')
    await new ActionExecutor(ctx).run([
      {
        type: 'condition',
        params: {
          expression: '$x > 5',
          then: [{ type: 'set-variable', params: { name: 'result', value: 'big', valueType: 'literal' } }],
          else: [{ type: 'set-variable', params: { name: 'result', value: 'small', valueType: 'literal' } }],
        },
      },
    ])
    expect(ctx.variables.get('result')).toBe('small')
  })

  it('condition with no else branch is fine when false', async () => {
    const ctx = makeCtx()
    ctx.variables.set('x', '1')
    await expect(
      new ActionExecutor(ctx).run([
        {
          type: 'condition',
          params: {
            expression: '$x > 100',
            then: [{ type: 'set-variable', params: { name: 'r', value: 'yes', valueType: 'literal' } }],
          },
        },
      ]),
    ).resolves.toBeUndefined()
    expect(ctx.variables.has('r')).toBe(false)
  })

  it('nested conditions work (then inside else)', async () => {
    const ctx = makeCtx()
    ctx.variables.set('score', '50')
    const actions: Action[] = [
      {
        type: 'condition',
        params: {
          expression: '$score >= 80',
          then: [{ type: 'set-variable', params: { name: 'grade', value: 'A', valueType: 'literal' } }],
          else: [
            {
              type: 'condition',
              params: {
                expression: '$score >= 60',
                then: [{ type: 'set-variable', params: { name: 'grade', value: 'B', valueType: 'literal' } }],
                else: [{ type: 'set-variable', params: { name: 'grade', value: 'C', valueType: 'literal' } }],
              },
            },
          ],
        },
      },
    ]
    await new ActionExecutor(ctx).run(actions)
    expect(ctx.variables.get('grade')).toBe('C')
  })
})

// ─── ActionExecutor — loop ────────────────────────────────────────────────────

describe('ActionExecutor — loop', () => {
  it('count loop executes body N times', async () => {
    const ctx = makeCtx()
    ctx.variables.set('counter', '0')
    await new ActionExecutor(ctx).run([
      {
        type: 'loop',
        params: {
          mode: 'count',
          count: 3,
          body: [
            { type: 'set-variable', params: { name: 'counter', value: '$counter + 1', valueType: 'expression' } },
          ],
        },
      },
    ])
    expect(ctx.variables.get('counter')).toBe('3')
  })

  it('while loop increments until condition false', async () => {
    const ctx = makeCtx()
    ctx.variables.set('i', '0')
    await new ActionExecutor(ctx).run([
      {
        type: 'loop',
        params: {
          mode: 'while',
          condition: '$i < 5',
          body: [
            { type: 'set-variable', params: { name: 'i', value: '$i + 1', valueType: 'expression' } },
          ],
        },
      },
    ])
    expect(ctx.variables.get('i')).toBe('5')
  })

  it('loop count 0 does nothing', async () => {
    const ctx = makeCtx()
    ctx.variables.set('x', 'unchanged')
    await new ActionExecutor(ctx).run([
      {
        type: 'loop',
        params: {
          mode: 'count',
          count: 0,
          body: [{ type: 'set-variable', params: { name: 'x', value: 'changed', valueType: 'literal' } }],
        },
      },
    ])
    expect(ctx.variables.get('x')).toBe('unchanged')
  })

  it('loop is capped at maxIterations', async () => {
    const ctx = makeCtx()
    ctx.variables.set('n', '0')
    // Count 2000 but cap at 10
    await new ActionExecutor(ctx).run([
      {
        type: 'loop',
        params: {
          mode: 'count',
          count: 2000,
          maxIterations: 10,
          body: [
            { type: 'set-variable', params: { name: 'n', value: '$n + 1', valueType: 'expression' } },
          ],
        },
      },
    ])
    expect(ctx.variables.get('n')).toBe('10')
  })

  it('loop body executes serially — each iteration sees previous iteration result', async () => {
    // Verifies sequential (not parallel) execution: iteration N+1 must observe
    // the variable written by iteration N.
    // Uses numeric increment ($n + 1) which requires prior value to accumulate.
    // If parallel: all three iterations would see n=0 → each writes '1' → result '1'.
    // If serial: n=0→1, n=1→2, n=2→3 → result '3'.
    const ctx = makeCtx()
    ctx.variables.set('n', '0')
    const order: number[] = []
    // Intercept set-variable to record execution order
    const origSet = ctx.variables.set.bind(ctx.variables)
    ctx.variables.set = (k: string, v: string) => { order.push(Number(v)); return origSet(k, v) }
    await new ActionExecutor(ctx).run([
      {
        type: 'loop',
        params: {
          mode: 'count',
          count: 3,
          body: [
            { type: 'set-variable', params: { name: 'n', value: '$n + 1', valueType: 'expression' } },
          ],
        },
      },
    ])
    // Serial execution: final value must be 3, and order must be 1, 2, 3
    expect(ctx.variables.get('n')).toBe('3')
    expect(order).toEqual([1, 2, 3])
  })
})

// ─── ActionExecutor — scoring ─────────────────────────────────────────────────

describe('ActionExecutor — scoring', () => {
  it('score-question calls scoreQuestion with widgetId', async () => {
    const scoreQuestion = vi.fn()
    const ctx = makeCtx({ scoring: { scoreQuestion, scoreQuiz: vi.fn(), getCurrentScore: () => 0 } })
    await new ActionExecutor(ctx).run([{ type: 'score-question', params: { widgetId: 'q1' } }])
    expect(scoreQuestion).toHaveBeenCalledWith('q1')
  })

  it('score-quiz calls scoreQuiz', async () => {
    const scoreQuiz = vi.fn()
    const ctx = makeCtx({ scoring: { scoreQuestion: vi.fn(), scoreQuiz, getCurrentScore: () => 0 } })
    await new ActionExecutor(ctx).run([{ type: 'score-quiz' }])
    expect(scoreQuiz).toHaveBeenCalled()
  })

  it('send-to-lms reports score to SCORM bridge', async () => {
    const setValue = vi.fn()
    const commit = vi.fn()
    const ctx = makeCtx({
      scoring: { scoreQuestion: vi.fn(), scoreQuiz: vi.fn(), getCurrentScore: () => 75 },
      scorm: { getValue: vi.fn(() => ''), setValue, commit, finish: vi.fn() },
    })
    await new ActionExecutor(ctx).run([{ type: 'send-to-lms' }])
    expect(setValue).toHaveBeenCalledWith('cmi.core.score.raw', '75')
    expect(commit).toHaveBeenCalled()
  })

  it('send-to-lms is a no-op when scorm bridge is null', async () => {
    const ctx = makeCtx({ scorm: null })
    await expect(
      new ActionExecutor(ctx).run([{ type: 'send-to-lms' }]),
    ).resolves.toBeUndefined()
  })
})

// ─── ActionExecutor — display-message ────────────────────────────────────────

describe('ActionExecutor — display-message', () => {
  it('appends overlay to container', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const ctx = makeCtx({ container })
    await new ActionExecutor(ctx).run([
      { type: 'display-message', params: { message: 'Hello world', title: 'Test' } },
    ])
    const overlay = container.querySelector('.el-message-overlay')
    expect(overlay).not.toBeNull()
    expect(overlay?.textContent).toContain('Hello world')
    expect(overlay?.textContent).toContain('Test')
    document.body.removeChild(container)
  })
})

// ─── ActionExecutor — unknown type ───────────────────────────────────────────

describe('ActionExecutor — unknown action type', () => {
  it('ignores unknown action types gracefully', async () => {
    const ctx = makeCtx()
    await expect(
      new ActionExecutor(ctx).run([
        // @ts-expect-error intentionally passing unknown type for forward-compat test
        { type: 'unknown-future-action', params: {} },
      ]),
    ).resolves.toBeUndefined()
  })
})

// ─── EventDispatcher ──────────────────────────────────────────────────────────

describe('EventDispatcher', () => {
  it('attaches click listener and fires action on click', async () => {
    const goToIndex = vi.fn()
    const ctx = makeCtx({
      navigation: { goToIndex, getCurrentIndex: () => 0, getSlideCount: () => 3, getSlides: () => [] },
    })
    const dispatcher = new EventDispatcher(ctx)
    const el = document.createElement('button')
    document.body.appendChild(el)

    const sequences: ActionSequence[] = [
      {
        event: 'click',
        actions: [{ type: 'navigate', params: { target: 'next' } }],
      },
    ]
    dispatcher.attachWidget(el, 'btn1', sequences)
    el.click()

    // Allow microtasks to flush
    await new Promise((r) => setTimeout(r, 0))
    expect(goToIndex).toHaveBeenCalledWith(1)
    dispatcher.teardown()
    document.body.removeChild(el)
  })

  it('teardown removes listener — click after teardown does not fire', async () => {
    const goToIndex = vi.fn()
    const ctx = makeCtx({
      navigation: { goToIndex, getCurrentIndex: () => 0, getSlideCount: () => 3, getSlides: () => [] },
    })
    const dispatcher = new EventDispatcher(ctx)
    const el = document.createElement('button')
    document.body.appendChild(el)

    const sequences: ActionSequence[] = [
      { event: 'click', actions: [{ type: 'navigate', params: { target: 'next' } }] },
    ]
    dispatcher.attachWidget(el, 'btn1', sequences)
    dispatcher.teardown()
    el.click()

    await new Promise((r) => setTimeout(r, 0))
    expect(goToIndex).not.toHaveBeenCalled()
    document.body.removeChild(el)
  })

  it('fireSlideEvent runs enterSlide sequences for all widgets', async () => {
    const _setValue = vi.fn()
    const ctx = makeCtx()
    ctx.variables.set('visited', '0')

    const dispatcher = new EventDispatcher(ctx)
    dispatcher.fireSlideEvent('enterSlide', [
      {
        widgetId: 'w1',
        sequences: [
          {
            event: 'enterSlide',
            actions: [{ type: 'set-variable', params: { name: 'visited', value: '1', valueType: 'literal' } }],
          },
        ],
      },
    ])

    await new Promise((r) => setTimeout(r, 0))
    expect(ctx.variables.get('visited')).toBe('1')
  })
})

// ─── TD-003 regression: legacy MongoDB data (undefined arrays) ───────────────
//
// Legacy documents persisted before `actions` / `then` / `else` / `body` became
// required fields can arrive at runtime with those arrays missing. Iterating
// over `undefined` throws TypeError and aborts the sequence. The guards added
// in executor.ts / dispatcher.ts / callSequence.ts must turn these cases into
// no-ops instead of crashes.

describe('TD-003 — forEach guards on legacy MongoDB data', () => {
  it('ActionExecutor.run() no-ops on undefined actions array', async () => {
    const ctx = makeCtx()
    await expect(
      // @ts-expect-error intentionally passing undefined to exercise the guard
      new ActionExecutor(ctx).run(undefined),
    ).resolves.toBeUndefined()
  })

  it('ActionExecutor.run() no-ops on empty actions array (control)', async () => {
    const ctx = makeCtx()
    await expect(new ActionExecutor(ctx).run([])).resolves.toBeUndefined()
  })

  it('condition with undefined then branch does not throw', async () => {
    const ctx = makeCtx()
    ctx.variables.set('flag', 'true')
    // @ts-expect-error intentionally omit then/else to simulate legacy data
    const action: Action = {
      type: 'condition',
      params: { expression: '$flag' /* then / else missing */ },
    }
    await expect(new ActionExecutor(ctx).run([action])).resolves.toBeUndefined()
  })

  it('loop with undefined body does not throw', async () => {
    const ctx = makeCtx()
    // @ts-expect-error intentionally omit body to simulate legacy data
    const action: Action = {
      type: 'loop',
      params: { mode: 'count', count: 3 /* body missing */ },
    }
    await expect(new ActionExecutor(ctx).run([action])).resolves.toBeUndefined()
  })

  it('call-sequence referencing a shared sequence without actions does not throw', async () => {
    const ctx = makeCtx({
      // @ts-expect-error legacy shared sequence missing actions
      sharedSequences: [{ name: 'legacyShared' }],
    })
    const action: Action = {
      type: 'call-sequence',
      params: { sequenceName: 'legacyShared' },
    }
    await expect(new ActionExecutor(ctx).run([action])).resolves.toBeUndefined()
  })

  it('EventDispatcher.attachWidget does not throw on undefined sequences', () => {
    const ctx = makeCtx()
    const dispatcher = new EventDispatcher(ctx)
    const el = document.createElement('button')
    document.body.appendChild(el)
    expect(() =>
      // @ts-expect-error legacy widget with no actions persisted
      dispatcher.attachWidget(el, 'w1', undefined),
    ).not.toThrow()
    dispatcher.teardown()
    document.body.removeChild(el)
  })

  it('EventDispatcher.fireSlideEvent does not throw on undefined outer array', () => {
    const ctx = makeCtx()
    const dispatcher = new EventDispatcher(ctx)
    expect(() =>
      // @ts-expect-error simulate a slide render call with no widgets collected
      dispatcher.fireSlideEvent('enterSlide', undefined),
    ).not.toThrow()
  })

  it('EventDispatcher.fireSlideEvent does not throw on entry with undefined sequences', () => {
    const ctx = makeCtx()
    const dispatcher = new EventDispatcher(ctx)
    expect(() =>
      dispatcher.fireSlideEvent('enterSlide', [
        // @ts-expect-error legacy widget entry missing its sequences array
        { widgetId: 'w1' /* sequences missing */ },
      ]),
    ).not.toThrow()
  })

  it('EventDispatcher.fireWidgetEvent does not throw on undefined sequences', () => {
    const ctx = makeCtx()
    const dispatcher = new EventDispatcher(ctx)
    expect(() =>
      // @ts-expect-error legacy widget with no actions persisted
      dispatcher.fireWidgetEvent('w1', 'click', undefined),
    ).not.toThrow()
  })
})

// ─── ActionExecutor — play-animation ─────────────────────────────────────────

describe('ActionExecutor — play-animation', () => {
  function makeAnimWidget(
    _animations: unknown[] = [],
  ): { el: HTMLElement; animateSpy: ReturnType<typeof vi.fn> } {
    const el = document.createElement('div')
    const animateSpy = vi.fn().mockReturnValue({ cancel: vi.fn() } as unknown as Animation)
    el.animate = animateSpy
    return { el, animateSpy }
  }

  it('calls element.animate when widget has an animation', async () => {
    const { el, animateSpy } = makeAnimWidget()
    const ctx = makeCtx({
      getWidget: (id: string) => id === 'btn1'
        ? { id: 'btn1', type: 'button', el, extendedProperties: {
            animations: [{
              id: 'a1', name: 'Slide In', keypoints: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
              duration: 500, easing: 'linear', loop: 1,
            }],
          } }
        : undefined,
    })
    const executor = new ActionExecutor(ctx)
    await executor.run([{ type: 'play-animation', params: { widgetId: 'btn1' } }])
    expect(animateSpy).toHaveBeenCalledOnce()
  })

  it('plays a named animation', async () => {
    const { el, animateSpy } = makeAnimWidget()
    const ctx = makeCtx({
      getWidget: (id: string) => id === 'btn1'
        ? { id: 'btn1', type: 'button', el, extendedProperties: {
            animations: [
              { id: 'a1', name: 'Fade', keypoints: [{ x: 0, y: 0 }], duration: 300, easing: 'ease', loop: 1 },
              { id: 'a2', name: 'Bounce', keypoints: [{ x: 0, y: 0 }, { x: 0, y: -20 }, { x: 0, y: 0 }], duration: 600, easing: 'ease-in-out', loop: 3 },
            ],
          } }
        : undefined,
    })
    const executor = new ActionExecutor(ctx)
    await executor.run([{ type: 'play-animation', params: { widgetId: 'btn1', animationName: 'Bounce' } }])
    expect(animateSpy).toHaveBeenCalledOnce()
    const [kfs] = animateSpy.mock.calls[0]
    expect(kfs).toHaveLength(3)
  })

  it('does not throw when widget is not found', async () => {
    const ctx = makeCtx({ getWidget: () => undefined })
    const executor = new ActionExecutor(ctx)
    await expect(
      executor.run([{ type: 'play-animation', params: { widgetId: 'missing' } }]),
    ).resolves.not.toThrow()
  })

  it('does not throw when widget has no animations', async () => {
    const el = document.createElement('div')
    el.animate = vi.fn()
    const ctx = makeCtx({
      getWidget: (id: string) => ({ id, type: 'text', el, extendedProperties: {} }),
    })
    const executor = new ActionExecutor(ctx)
    await expect(
      executor.run([{ type: 'play-animation', params: { widgetId: 'txt1' } }]),
    ).resolves.not.toThrow()
    expect(el.animate).not.toHaveBeenCalled()
  })

  it('does not throw when named animation is not found', async () => {
    const { el, animateSpy } = makeAnimWidget()
    const ctx = makeCtx({
      getWidget: (id: string) => ({
        id, type: 'button', el,
        extendedProperties: {
          animations: [{ id: 'a1', name: 'Slide', keypoints: [{ x: 0, y: 0 }], duration: 300, easing: 'linear', loop: 1 }],
        },
      }),
    })
    const executor = new ActionExecutor(ctx)
    await expect(
      executor.run([{ type: 'play-animation', params: { widgetId: 'btn1', animationName: 'NonExistent' } }]),
    ).resolves.not.toThrow()
    expect(animateSpy).not.toHaveBeenCalled()
  })
})

// ─── ActionExecutor — play-media ──────────────────────────────────────────────

describe('ActionExecutor — play-media', () => {
  it('calls play() on HTMLMediaElement found in widget', async () => {
    const container = document.createElement('div')
    const video = document.createElement('video')
    const playSpy = vi.fn().mockResolvedValue(undefined)
    video.play = playSpy
    container.appendChild(video)
    const ctx = makeCtx({
      getWidget: (id: string) => id === 'vid1'
        ? { id: 'vid1', type: 'media', el: container }
        : undefined,
    })
    await new ActionExecutor(ctx).run([{ type: 'play-media', params: { widgetId: 'vid1' } }])
    expect(playSpy).toHaveBeenCalledOnce()
  })

  it('plays audio element within widget', async () => {
    const container = document.createElement('div')
    const audio = document.createElement('audio')
    const playSpy = vi.fn().mockResolvedValue(undefined)
    audio.play = playSpy
    container.appendChild(audio)
    const ctx = makeCtx({
      getWidget: (id: string) => id === 'aud1'
        ? { id: 'aud1', type: 'media', el: container }
        : undefined,
    })
    await new ActionExecutor(ctx).run([{ type: 'play-media', params: { widgetId: 'aud1' } }])
    expect(playSpy).toHaveBeenCalledOnce()
  })

  it('does not throw when widget is not found', async () => {
    const ctx = makeCtx({ getWidget: () => undefined })
    await expect(
      new ActionExecutor(ctx).run([{ type: 'play-media', params: { widgetId: 'missing' } }]),
    ).resolves.not.toThrow()
  })

  it('does not throw when element is null', async () => {
    const ctx = makeCtx({
      getWidget: (id: string) => id === 'vid1'
        ? { id: 'vid1', type: 'media', el: null }
        : undefined,
    })
    await expect(
      new ActionExecutor(ctx).run([{ type: 'play-media', params: { widgetId: 'vid1' } }]),
    ).resolves.not.toThrow()
  })

  it('does not throw when media element is not found within widget', async () => {
    const el = document.createElement('div')
    el.innerHTML = '<span>No media here</span>'
    const ctx = makeCtx({
      getWidget: (id: string) => id === 'div1'
        ? { id: 'div1', type: 'container', el }
        : undefined,
    })
    await expect(
      new ActionExecutor(ctx).run([{ type: 'play-media', params: { widgetId: 'div1' } }]),
    ).resolves.not.toThrow()
  })

  it('ignores autoplay errors (browser may block)', async () => {
    const container = document.createElement('div')
    const video = document.createElement('video')
    const playSpy = vi.fn().mockRejectedValue(new DOMException('NotAllowedError'))
    video.play = playSpy
    container.appendChild(video)
    const ctx = makeCtx({
      getWidget: (id: string) => id === 'vid1'
        ? { id: 'vid1', type: 'media', el: container }
        : undefined,
    })
    // Should not throw even though play() rejects
    await expect(
      new ActionExecutor(ctx).run([{ type: 'play-media', params: { widgetId: 'vid1' } }]),
    ).resolves.not.toThrow()
    expect(playSpy).toHaveBeenCalledOnce()
  })
})

// ─── ActionExecutor — stop-media ──────────────────────────────────────────────

describe('ActionExecutor — stop-media', () => {
  it('pauses and resets currentTime on HTMLMediaElement', async () => {
    const container = document.createElement('div')
    const video = document.createElement('video')
    const pauseSpy = vi.fn()
    video.pause = pauseSpy
    video.currentTime = 5.5
    container.appendChild(video)
    const ctx = makeCtx({
      getWidget: (id: string) => id === 'vid1'
        ? { id: 'vid1', type: 'media', el: container }
        : undefined,
    })
    await new ActionExecutor(ctx).run([{ type: 'stop-media', params: { widgetId: 'vid1' } }])
    expect(pauseSpy).toHaveBeenCalledOnce()
    expect(video.currentTime).toBe(0)
  })

  it('pauses and resets audio element', async () => {
    const container = document.createElement('div')
    const audio = document.createElement('audio')
    const pauseSpy = vi.fn()
    audio.pause = pauseSpy
    audio.currentTime = 10
    container.appendChild(audio)
    const ctx = makeCtx({
      getWidget: (id: string) => id === 'aud1'
        ? { id: 'aud1', type: 'media', el: container }
        : undefined,
    })
    await new ActionExecutor(ctx).run([{ type: 'stop-media', params: { widgetId: 'aud1' } }])
    expect(pauseSpy).toHaveBeenCalledOnce()
    expect(audio.currentTime).toBe(0)
  })

  it('pauses and resets media found via querySelector', async () => {
    const container = document.createElement('div')
    const video = document.createElement('video')
    const pauseSpy = vi.fn()
    video.pause = pauseSpy
    video.currentTime = 7
    container.appendChild(video)
    const ctx = makeCtx({
      getWidget: (id: string) => id === 'vid1'
        ? { id: 'vid1', type: 'media', el: container }
        : undefined,
    })
    await new ActionExecutor(ctx).run([{ type: 'stop-media', params: { widgetId: 'vid1' } }])
    expect(pauseSpy).toHaveBeenCalledOnce()
    expect(video.currentTime).toBe(0)
  })

  it('does not throw when widget is not found', async () => {
    const ctx = makeCtx({ getWidget: () => undefined })
    await expect(
      new ActionExecutor(ctx).run([{ type: 'stop-media', params: { widgetId: 'missing' } }]),
    ).resolves.not.toThrow()
  })

  it('does not throw when element is null', async () => {
    const ctx = makeCtx({
      getWidget: (id: string) => id === 'vid1'
        ? { id: 'vid1', type: 'media', el: null }
        : undefined,
    })
    await expect(
      new ActionExecutor(ctx).run([{ type: 'stop-media', params: { widgetId: 'vid1' } }]),
    ).resolves.not.toThrow()
  })

  it('does not throw when media element is not found within widget', async () => {
    const el = document.createElement('div')
    el.innerHTML = '<span>No media here</span>'
    const ctx = makeCtx({
      getWidget: (id: string) => id === 'div1'
        ? { id: 'div1', type: 'container', el }
        : undefined,
    })
    await expect(
      new ActionExecutor(ctx).run([{ type: 'stop-media', params: { widgetId: 'div1' } }]),
    ).resolves.not.toThrow()
  })
})

// ─── ActionExecutor — suspend-lesson ──────────────────────────────────────────

describe('ActionExecutor — suspend-lesson', () => {
  it('calls SCORM bridge setValue with score and lesson_status', async () => {
    const setValue = vi.fn()
    const commit = vi.fn()
    const finish = vi.fn()
    const ctx = makeCtx({
      scoring: { scoreQuestion: vi.fn(), scoreQuiz: vi.fn(), getCurrentScore: () => 68 },
      scorm: { getValue: vi.fn(() => ''), setValue, commit, finish },
    })
    await new ActionExecutor(ctx).run([{ type: 'suspend-lesson' }])
    expect(setValue).toHaveBeenCalledWith('cmi.core.score.raw', '68')
    expect(setValue).toHaveBeenCalledWith('cmi.core.lesson_status', 'incomplete')
    expect(commit).toHaveBeenCalledOnce()
    expect(finish).toHaveBeenCalledOnce()
  })

  it('sets lesson status to incomplete', async () => {
    const setValue = vi.fn()
    const ctx = makeCtx({
      scoring: { scoreQuestion: vi.fn(), scoreQuiz: vi.fn(), getCurrentScore: () => 100 },
      scorm: { getValue: vi.fn(() => ''), setValue, commit: vi.fn(), finish: vi.fn() },
    })
    await new ActionExecutor(ctx).run([{ type: 'suspend-lesson' }])
    // Verify that lesson_status was set to 'incomplete'
    const calls = setValue.mock.calls
    const statusCall = calls.find((c) => c[0] === 'cmi.core.lesson_status')
    expect(statusCall).toEqual(['cmi.core.lesson_status', 'incomplete'])
  })

  it('commits before finishing', async () => {
    const callOrder: string[] = []
    const setValue = vi.fn(() => { callOrder.push('setValue') })
    const commit = vi.fn(() => { callOrder.push('commit') })
    const finish = vi.fn(() => { callOrder.push('finish') })
    const ctx = makeCtx({
      scoring: { scoreQuestion: vi.fn(), scoreQuiz: vi.fn(), getCurrentScore: () => 50 },
      scorm: { getValue: vi.fn(() => ''), setValue, commit, finish },
    })
    await new ActionExecutor(ctx).run([{ type: 'suspend-lesson' }])
    expect(callOrder).toContain('commit')
    expect(callOrder).toContain('finish')
    // commit should come before finish
    const commitIdx = callOrder.lastIndexOf('commit')
    const finishIdx = callOrder.indexOf('finish')
    expect(commitIdx < finishIdx).toBe(true)
  })

  it('is a no-op when scorm bridge is null', async () => {
    const ctx = makeCtx({ scorm: null })
    await expect(
      new ActionExecutor(ctx).run([{ type: 'suspend-lesson' }]),
    ).resolves.not.toThrow()
  })

  it('uses current score from scoring interface', async () => {
    const setValue = vi.fn()
    const ctx = makeCtx({
      scoring: { scoreQuestion: vi.fn(), scoreQuiz: vi.fn(), getCurrentScore: () => 42 },
      scorm: { getValue: vi.fn(() => ''), setValue, commit: vi.fn(), finish: vi.fn() },
    })
    await new ActionExecutor(ctx).run([{ type: 'suspend-lesson' }])
    // Verify the score passed was exactly 42
    const scoreCall = setValue.mock.calls.find((c) => c[0] === 'cmi.core.score.raw')
    expect(scoreCall).toEqual(['cmi.core.score.raw', '42'])
  })
})
