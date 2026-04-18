/**
 * Unit tests for performCourseMutation — TD-007 Layer 1.
 *
 * The pure primitive is tested in isolation with mock API callables and
 * mock hooks. No Zustand, no React — verifies:
 *  - Happy path: onStart fires before apiCall, onSuccess fires after, result returned
 *  - Error path: onError fires with narrowed message, returns undefined, no re-throw
 *  - Non-Error throws are narrowed via String(err)
 *  - Hooks object is fully optional (every hook can be absent)
 *  - Hook ordering is strict (onStart synchronous before await; on{Success,Error} after)
 */

import { describe, it, expect, vi } from 'vitest'
import { performCourseMutation } from '../../lib/courseMutation'

describe('performCourseMutation — success path', () => {
  it('returns the API result when apiCall resolves', async () => {
    const result = await performCourseMutation(async () => ({ id: 'c1', title: 'hello' }))
    expect(result).toEqual({ id: 'c1', title: 'hello' })
  })

  it('invokes onStart before onSuccess; neither onError is called', async () => {
    const onStart = vi.fn()
    const onSuccess = vi.fn()
    const onError = vi.fn()

    await performCourseMutation(async () => 42, { onStart, onSuccess, onError })

    expect(onStart).toHaveBeenCalledTimes(1)
    expect(onSuccess).toHaveBeenCalledTimes(1)
    expect(onError).not.toHaveBeenCalled()
    // Call order: onStart must fire before onSuccess
    expect(onStart.mock.invocationCallOrder[0]).toBeLessThan(onSuccess.mock.invocationCallOrder[0]!)
  })

  it('onStart fires synchronously BEFORE apiCall is awaited', async () => {
    const calls: string[] = []
    const apiCall = vi.fn(async () => {
      calls.push('apiCall')
      return 'ok'
    })
    const onStart = vi.fn(() => { calls.push('onStart') })

    await performCourseMutation(apiCall, { onStart })

    expect(calls).toEqual(['onStart', 'apiCall'])
  })
})

describe('performCourseMutation — error path', () => {
  it('returns undefined when apiCall rejects with an Error', async () => {
    const result = await performCourseMutation(async () => {
      throw new Error('network down')
    })
    expect(result).toBeUndefined()
  })

  it('invokes onError with Error.message; onSuccess is not called', async () => {
    const onStart = vi.fn()
    const onSuccess = vi.fn()
    const onError = vi.fn()

    await performCourseMutation(
      async () => { throw new Error('boom') },
      { onStart, onSuccess, onError },
    )

    expect(onStart).toHaveBeenCalledTimes(1)
    expect(onSuccess).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledWith('boom')
  })

  it('narrows non-Error throws via String(err)', async () => {
    const onError = vi.fn()
    await performCourseMutation(async () => { throw 'plain-string-error' }, { onError })
    expect(onError).toHaveBeenCalledWith('plain-string-error')
  })

  it('does NOT re-throw — the Promise always resolves', async () => {
    // If this test hangs or fails, performCourseMutation is re-throwing.
    await expect(
      performCourseMutation(async () => { throw new Error('x') }),
    ).resolves.toBeUndefined()
  })
})

describe('performCourseMutation — optional hooks', () => {
  it('works when hooks argument is omitted entirely', async () => {
    await expect(performCourseMutation(async () => 'ok')).resolves.toBe('ok')
    await expect(performCourseMutation(async () => { throw new Error('x') })).resolves.toBeUndefined()
  })
})
