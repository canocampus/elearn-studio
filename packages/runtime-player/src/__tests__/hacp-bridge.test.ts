/**
 * T205 TEST-05 — AICC HACP Bridge cross-origin security
 *
 * Verifies that the HACP bridge rejects messages from unauthorized origins
 * and only processes messages from the configured allowed origin.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHacpBridge } from '../aicc/hacpBridge'
import type { HacpBridgeCallbacks } from '../aicc/hacpBridge'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeWindow() {
  const listeners = new Map<string, EventListenerOrEventListenerObject[]>()
  const win = {
    addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      const arr = listeners.get(type) ?? []
      arr.push(listener)
      listeners.set(type, arr)
    },
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      const arr = listeners.get(type) ?? []
      listeners.set(type, arr.filter(l => l !== listener))
    },
    dispatch(type: string, event: object) {
      const arr = listeners.get(type) ?? []
      for (const l of arr) {
        if (typeof l === 'function') l(event as Event)
        else (l as EventListenerObject).handleEvent(event as Event)
      }
    },
    listenerCount(type: string) {
      return (listeners.get(type) ?? []).length
    },
  }
  return win
}

function makeCallbacks(): HacpBridgeCallbacks & {
  onMessage: ReturnType<typeof vi.fn>
  onUnauthorized: ReturnType<typeof vi.fn>
} {
  return {
    onMessage: vi.fn(),
    onUnauthorized: vi.fn(),
  }
}

function makeEvent(origin: string, data: unknown): MessageEvent {
  return { origin, data } as MessageEvent
}

const ALLOWED = 'https://lms.example.com'

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('createHacpBridge — origin enforcement (TEST-05)', () => {
  let win: ReturnType<typeof makeWindow>
  let cbs: ReturnType<typeof makeCallbacks>

  beforeEach(() => {
    win = makeWindow()
    cbs = makeCallbacks()
  })

  it('delivers message to onMessage when origin matches allowedOrigin', () => {
    createHacpBridge(ALLOWED, cbs, win as unknown as Window)
    win.dispatch('message', makeEvent(ALLOWED, { type: 'HACP_INIT', payload: { sid: 'abc' } }))
    expect(cbs.onMessage).toHaveBeenCalledOnce()
    expect(cbs.onMessage).toHaveBeenCalledWith({ type: 'HACP_INIT', payload: { sid: 'abc' } })
  })

  it('rejects and calls onUnauthorized for a different origin', () => {
    createHacpBridge(ALLOWED, cbs, win as unknown as Window)
    win.dispatch('message', makeEvent('https://evil.example.com', { type: 'HACP_INIT' }))
    expect(cbs.onMessage).not.toHaveBeenCalled()
    expect(cbs.onUnauthorized).toHaveBeenCalledWith('https://evil.example.com')
  })

  it('rejects messages from null/empty origin', () => {
    createHacpBridge(ALLOWED, cbs, win as unknown as Window)
    win.dispatch('message', makeEvent('null', { type: 'HACP_INIT' }))
    expect(cbs.onMessage).not.toHaveBeenCalled()
    expect(cbs.onUnauthorized).toHaveBeenCalledWith('null')
  })

  it('rejects messages from a subdomain of the allowed origin', () => {
    createHacpBridge(ALLOWED, cbs, win as unknown as Window)
    win.dispatch('message', makeEvent('https://attacker.lms.example.com', { type: 'HACP_INIT' }))
    expect(cbs.onMessage).not.toHaveBeenCalled()
    expect(cbs.onUnauthorized).toHaveBeenCalledOnce()
  })

  it('rejects messages from the same host but different protocol', () => {
    createHacpBridge(ALLOWED, cbs, win as unknown as Window)
    win.dispatch('message', makeEvent('http://lms.example.com', { type: 'HACP_INIT' }))
    expect(cbs.onMessage).not.toHaveBeenCalled()
  })

  it('silently ignores messages with non-object data (no crash)', () => {
    createHacpBridge(ALLOWED, cbs, win as unknown as Window)
    win.dispatch('message', makeEvent(ALLOWED, 'just a string'))
    expect(cbs.onMessage).not.toHaveBeenCalled()
  })

  it('silently ignores messages missing the type field', () => {
    createHacpBridge(ALLOWED, cbs, win as unknown as Window)
    win.dispatch('message', makeEvent(ALLOWED, { payload: 123 }))
    expect(cbs.onMessage).not.toHaveBeenCalled()
  })

  it('does not call onUnauthorized when the callback is omitted', () => {
    const { onUnauthorized: _, ...cbsNoUnauth } = cbs
    expect(() => {
      createHacpBridge(ALLOWED, cbsNoUnauth, win as unknown as Window)
      win.dispatch('message', makeEvent('https://evil.com', { type: 'X' }))
    }).not.toThrow()
  })
})

describe('createHacpBridge — destroy()', () => {
  it('stops delivering messages after destroy is called', () => {
    const win = makeWindow()
    const cbs = makeCallbacks()
    const bridge = createHacpBridge(ALLOWED, cbs, win as unknown as Window)

    win.dispatch('message', makeEvent(ALLOWED, { type: 'BEFORE' }))
    bridge.destroy()
    win.dispatch('message', makeEvent(ALLOWED, { type: 'AFTER' }))

    expect(cbs.onMessage).toHaveBeenCalledOnce()
    expect(cbs.onMessage.mock.calls[0][0].type).toBe('BEFORE')
  })

  it('removes the event listener from the window on destroy', () => {
    const win = makeWindow()
    createHacpBridge(ALLOWED, makeCallbacks(), win as unknown as Window).destroy()
    expect(win.listenerCount('message')).toBe(0)
  })
})
