/**
 * Unit tests for T028 — Animations (animator.ts)
 * Tests cover: keyframe building, loop mapping, easing passthrough,
 * time distribution, WAAPI unavailability, and edge cases.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildKeyframes, buildTiming, executeAnimation } from '../animations/animator'
import type { AnimationPath } from '../animations/animator'

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeElement(): HTMLElement {
  const el = document.createElement('div')
  // JSDOM supports element.animate in recent versions; mock for determinism
  el.animate = vi.fn().mockReturnValue({
    id: 'mock-animation',
    cancel: vi.fn(),
    finish: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
  } as unknown as Animation)
  return el
}

function makePath(overrides: Partial<AnimationPath> = {}): AnimationPath {
  return {
    id: 'anim-1',
    name: 'Slide In',
    keypoints: [
      { x: 0, y: 0 },
      { x: 100, y: 50 },
    ],
    duration: 1000,
    easing: 'linear',
    loop: 1,
    ...overrides,
  }
}

// ─── buildKeyframes ───────────────────────────────────────────────────────────

describe('buildKeyframes', () => {
  it('maps keypoints to translate transforms', () => {
    const kfs = buildKeyframes([
      { x: 0, y: 0 },
      { x: 100, y: 50 },
    ])
    expect(kfs).toHaveLength(2)
    expect(kfs[0].transform).toBe('translate(0px, 0px)')
    expect(kfs[1].transform).toBe('translate(100px, 50px)')
  })

  it('assigns evenly distributed offsets when t is absent', () => {
    const kfs = buildKeyframes([
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 100, y: 0 },
    ])
    expect(kfs[0].offset).toBeCloseTo(0)
    expect(kfs[1].offset).toBeCloseTo(0.5)
    expect(kfs[2].offset).toBeCloseTo(1)
  })

  it('uses explicit t values when provided', () => {
    const kfs = buildKeyframes([
      { x: 0, y: 0, t: 0 },
      { x: 100, y: 0, t: 0.3 },
      { x: 200, y: 0, t: 1 },
    ])
    expect(kfs[0].offset).toBeCloseTo(0)
    expect(kfs[1].offset).toBeCloseTo(0.3)
    expect(kfs[2].offset).toBeCloseTo(1)
  })

  it('mixes explicit and auto t: explicit take precedence, gaps filled evenly', () => {
    // First has t=0, last has t=1, middle auto-fills to 0.5
    const kfs = buildKeyframes([
      { x: 0, y: 0, t: 0 },
      { x: 50, y: 0 },
      { x: 100, y: 0, t: 1 },
    ])
    expect(kfs[0].offset).toBeCloseTo(0)
    expect(kfs[1].offset).toBeCloseTo(0.5)
    expect(kfs[2].offset).toBeCloseTo(1)
  })

  it('returns single keyframe for single-point path', () => {
    const kfs = buildKeyframes([{ x: 42, y: -7 }])
    expect(kfs).toHaveLength(1)
    expect(kfs[0].transform).toBe('translate(42px, -7px)')
    expect(kfs[0].offset).toBe(0)
  })

  it('returns empty array for empty keypoints', () => {
    expect(buildKeyframes([])).toHaveLength(0)
  })
})

// ─── buildTiming ─────────────────────────────────────────────────────────────

describe('buildTiming', () => {
  it('maps loop:1 to iterations:1', () => {
    const t = buildTiming(makePath({ loop: 1 }))
    expect(t.iterations).toBe(1)
  })

  it('maps loop:-1 to iterations:Infinity', () => {
    const t = buildTiming(makePath({ loop: -1 }))
    expect(t.iterations).toBe(Infinity)
  })

  it('maps loop:3 to iterations:3', () => {
    const t = buildTiming(makePath({ loop: 3 }))
    expect(t.iterations).toBe(3)
  })

  it('clamps loop:0 to 1 (prevent zero-iteration animation)', () => {
    const t = buildTiming(makePath({ loop: 0 }))
    expect(t.iterations).toBe(1)
  })

  it('passes through duration', () => {
    const t = buildTiming(makePath({ duration: 2500 }))
    expect(t.duration).toBe(2500)
  })

  it('passes through easing string', () => {
    for (const easing of ['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out']) {
      const t = buildTiming(makePath({ easing }))
      expect(t.easing).toBe(easing)
    }
  })

  it('passes through cubic-bezier easing', () => {
    const easing = 'cubic-bezier(0.42, 0, 0.58, 1)'
    const t = buildTiming(makePath({ easing }))
    expect(t.easing).toBe(easing)
  })

  it('includes delay when specified', () => {
    const t = buildTiming(makePath({ delay: 300 }))
    expect(t.delay).toBe(300)
  })

  it('defaults delay to 0 when absent', () => {
    const path = makePath()
    delete (path as AnimationPath & { delay?: number }).delay
    const t = buildTiming(path)
    expect(t.delay).toBe(0)
  })

  it('includes fill when specified', () => {
    const t = buildTiming(makePath({ fill: 'forwards' }))
    expect(t.fill).toBe('forwards')
  })

  it('defaults fill to "none" when absent', () => {
    const path = makePath()
    const t = buildTiming(path)
    expect(t.fill).toBe('none')
  })
})

// ─── executeAnimation ────────────────────────────────────────────────────────

describe('executeAnimation', () => {
  let el: HTMLElement

  beforeEach(() => {
    el = makeElement()
  })

  it('calls element.animate with keyframes and timing', () => {
    executeAnimation(el, makePath())
    expect(el.animate).toHaveBeenCalledOnce()
    const [kfs, timing] = (el.animate as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(Array.isArray(kfs)).toBe(true)
    expect(kfs.length).toBeGreaterThan(0)
    expect(typeof timing.duration).toBe('number')
  })

  it('returns the Animation object from element.animate', () => {
    const result = executeAnimation(el, makePath())
    expect(result).not.toBeNull()
    expect(result).toHaveProperty('cancel')
  })

  it('returns null when keypoints array is empty', () => {
    const result = executeAnimation(el, makePath({ keypoints: [] }))
    expect(result).toBeNull()
    expect(el.animate).not.toHaveBeenCalled()
  })

  it('returns null gracefully when element.animate is not available', () => {
    // Simulate environment without WAAPI
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(el as any).animate = undefined
    const result = executeAnimation(el, makePath())
    expect(result).toBeNull()
  })

  it('returns null when element.animate throws', () => {
    ;(el.animate as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('DOMException: animate not supported')
    })
    const result = executeAnimation(el, makePath())
    expect(result).toBeNull()
  })

  it('produces correct keyframes for a two-point path end-to-end', () => {
    executeAnimation(el, makePath({
      keypoints: [{ x: 0, y: 0 }, { x: 200, y: 100 }],
      duration: 500,
    }))
    const [kfs] = (el.animate as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(kfs[0].transform).toBe('translate(0px, 0px)')
    expect(kfs[1].transform).toBe('translate(200px, 100px)')
  })

  it('passes infinite iterations for loop:-1 end-to-end', () => {
    executeAnimation(el, makePath({ loop: -1 }))
    const [, timing] = (el.animate as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(timing.iterations).toBe(Infinity)
  })

  it('T205 TEST-04: two concurrent play-animation calls on same widget each start a new Animation (browser manages overlap)', () => {
    // Documented behavior: executeAnimation does NOT cancel the prior animation.
    // Each call returns a distinct Animation object. The browser (or caller) is
    // responsible for cancelling the previous animation if needed.
    const mockAnim1 = { id: 'anim-1', cancel: vi.fn(), finish: vi.fn(), play: vi.fn(), pause: vi.fn() }
    const mockAnim2 = { id: 'anim-2', cancel: vi.fn(), finish: vi.fn(), play: vi.fn(), pause: vi.fn() }
    ;(el.animate as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(mockAnim1)
      .mockReturnValueOnce(mockAnim2)

    const anim1 = executeAnimation(el, makePath({ duration: 2000 }))
    const anim2 = executeAnimation(el, makePath({ duration: 500 }))

    expect(el.animate).toHaveBeenCalledTimes(2)
    expect(anim1).not.toBeNull()
    expect(anim2).not.toBeNull()
    // Both are independent WAAPI Animation objects — no implicit cancellation
    expect(anim1).not.toBe(anim2)
    expect((anim1 as unknown as typeof mockAnim1).id).toBe('anim-1')
    expect((anim2 as unknown as typeof mockAnim2).id).toBe('anim-2')
  })
})
