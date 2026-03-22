/**
 * T020.17 — call-sequence builtin and ExecutionContext.sharedSequences
 *
 * Tests:
 *  - executeCallSequence runs the referenced shared sequence's actions
 *  - executeCallSequence no-ops (with console.warn) when name not found
 *  - ActionExecutor dispatch routes 'call-sequence' correctly
 *  - ExecutionContext factory initialises sharedSequences to []
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ActionExecutor } from '../actions/executor'
import { createExecutionContext } from '../actions/context'
import type { Action } from '../actions/types'

function makeCtx(overrides = {}) {
  return createExecutionContext({
    container: document.createElement('div'),
    ...overrides,
  })
}

describe('createExecutionContext — sharedSequences default', () => {
  it('initialises sharedSequences to empty array', () => {
    const ctx = makeCtx()
    expect(ctx.sharedSequences).toEqual([])
  })

  it('accepts sharedSequences override', () => {
    const shared = [{ name: 'myMacro', actions: [] }]
    const ctx = makeCtx({ sharedSequences: shared })
    expect(ctx.sharedSequences).toBe(shared)
  })
})

describe('call-sequence via ActionExecutor', () => {
  it('runs the referenced shared sequence actions', async () => {
    const log: string[] = []
    const ctx = makeCtx({
      sharedSequences: [
        {
          name: 'logHello',
          // use display-message as a proxy — we'll spy on the message overlay
          // but simpler: use set-variable which is pure state
          actions: [
            {
              type: 'set-variable',
              params: { name: 'result', value: 'called', valueType: 'literal' },
            } satisfies Action,
          ],
        },
      ],
    })

    const executor = new ActionExecutor(ctx)
    await executor.run([
      { type: 'call-sequence', params: { sequenceName: 'logHello' } },
    ])

    expect(ctx.variables.get('result')).toBe('called')
  })

  it('warns and no-ops when sequence name not found', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const ctx = makeCtx()
    const executor = new ActionExecutor(ctx)

    await executor.run([
      { type: 'call-sequence', params: { sequenceName: 'nonExistent' } },
    ])

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('nonExistent'),
    )
    warnSpy.mockRestore()
  })

  it('chains multiple shared sequence calls in order', async () => {
    const ctx = makeCtx({
      sharedSequences: [
        {
          name: 'setA',
          actions: [
            { type: 'set-variable', params: { name: 'order', value: 'A', valueType: 'literal' } },
          ],
        },
        {
          name: 'setB',
          actions: [
            { type: 'set-variable', params: { name: 'order', value: 'B', valueType: 'literal' } },
          ],
        },
      ],
    })
    const executor = new ActionExecutor(ctx)
    await executor.run([
      { type: 'call-sequence', params: { sequenceName: 'setA' } },
      { type: 'call-sequence', params: { sequenceName: 'setB' } },
    ])
    // last write wins
    expect(ctx.variables.get('order')).toBe('B')
  })
})
