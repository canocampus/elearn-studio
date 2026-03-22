/**
 * Unit tests for T025 — Screenshot Simulation Player
 * (renderSimShell + mountSimPlayer)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderSimShell, mountSimPlayer } from '../sim/simPlayer'
import type { SimConfig, SimPlayerCallbacks } from '../sim/simPlayer'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeContainer(id = 'w-sim-1'): HTMLElement {
  const el = document.createElement('div')
  el.id = id
  el.innerHTML = renderSimShell()
  document.body.appendChild(el)
  return el
}

function makeCbs(): SimPlayerCallbacks & { onComplete: ReturnType<typeof vi.fn>; onScore: ReturnType<typeof vi.fn> } {
  return {
    onComplete: vi.fn(),
    onScore: vi.fn(),
  }
}

function makeConfig(overrides: Partial<SimConfig> = {}): SimConfig {
  return {
    sessionId: 'sess-test',
    mode: 'practice',
    passingScore: 80,
    steps: [
      {
        id: 'step-0',
        order: 0,
        description: 'Click Submit',
        instruction: 'Click the Submit button',
        hint: 'Look at the bottom right',
        correctFeedback: 'Correct!',
        incorrectFeedback: 'Try again.',
        demoDelay: 500,
        maxAttempts: -1,
        screenshotKey: 'recordings/sess-test/step-0000.png',
        screenshotUrl: '/simulations/screenshot?key=recordings/sess-test/step-0000.png',
        hotspot: { x: 280, y: 160, width: 80, height: 40, tolerance: 10 },
      },
      {
        id: 'step-1',
        order: 1,
        description: 'Type hello',
        instruction: 'Type hello in the box',
        hint: '',
        correctFeedback: 'Correct!',
        incorrectFeedback: 'Wrong.',
        demoDelay: 500,
        maxAttempts: 2,
        screenshotKey: 'recordings/sess-test/step-0001.png',
        screenshotUrl: '/simulations/screenshot?key=recordings/sess-test/step-0001.png',
        hotspot: { x: 100, y: 100, width: 80, height: 30, tolerance: 5 },
      },
    ],
    ...overrides,
  }
}

function fireClick(el: HTMLElement, clientX: number, clientY: number): void {
  const clickLayer = el.querySelector<HTMLElement>('.el-sim-click-layer')!
  // getBoundingClientRect returns 0,0,0,0 in jsdom — override it
  vi.spyOn(clickLayer, 'getBoundingClientRect').mockReturnValue({
    left: 0, top: 0, width: 640, height: 360,
    right: 640, bottom: 360, x: 0, y: 0, toJSON: () => {},
  } as DOMRect)
  clickLayer.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX, clientY }))
}

// ─── renderSimShell ───────────────────────────────────────────────────────────

describe('renderSimShell', () => {
  it('contains expected child elements', () => {
    const div = document.createElement('div')
    div.innerHTML = renderSimShell()
    expect(div.querySelector('.el-sim-screenshot')).toBeTruthy()
    expect(div.querySelector('.el-sim-hotspot')).toBeTruthy()
    expect(div.querySelector('.el-sim-click-layer')).toBeTruthy()
    expect(div.querySelector('.el-sim-step-counter')).toBeTruthy()
    expect(div.querySelector('.el-sim-instruction')).toBeTruthy()
    expect(div.querySelector('.el-sim-feedback')).toBeTruthy()
    expect(div.querySelector('.el-sim-next-btn')).toBeTruthy()
  })
})

// ─── mountSimPlayer — initial render ─────────────────────────────────────────

describe('mountSimPlayer — initial render', () => {
  let el: HTMLElement

  beforeEach(() => {
    el = makeContainer()
  })

  it('sets screenshot src for step 0', () => {
    const config = makeConfig()
    mountSimPlayer(el, config, makeCbs())
    const img = el.querySelector<HTMLImageElement>('.el-sim-screenshot')!
    expect(img.src).toContain('step-0000.png')
  })

  it('shows step counter "Step 1 / 2"', () => {
    const config = makeConfig()
    mountSimPlayer(el, config, makeCbs())
    expect(el.querySelector('.el-sim-step-counter')!.textContent).toBe('Step 1 / 2')
  })

  it('shows instruction text', () => {
    const config = makeConfig()
    mountSimPlayer(el, config, makeCbs())
    expect(el.querySelector('.el-sim-instruction')!.textContent).toBe('Click the Submit button')
  })

  it('hides feedback and next button initially', () => {
    const config = makeConfig()
    mountSimPlayer(el, config, makeCbs())
    const feedback = el.querySelector<HTMLElement>('.el-sim-feedback')!
    const nextBtn  = el.querySelector<HTMLElement>('.el-sim-next-btn')!
    expect(feedback.style.display).toBe('none')
    expect(nextBtn.style.display).toBe('none')
  })

  it('shows "No steps configured." when steps is empty', () => {
    const config = makeConfig({ steps: [] })
    mountSimPlayer(el, config, makeCbs())
    expect(el.querySelector('.el-sim-instruction')!.textContent).toBe('No steps configured.')
  })
})

// ─── Practice mode — correct click ───────────────────────────────────────────

describe('practice mode — correct click', () => {
  let el: HTMLElement

  beforeEach(() => {
    el = makeContainer('w-sim-practice')
  })

  it('shows correct feedback on click within hotspot', () => {
    const config = makeConfig({ mode: 'practice' })
    mountSimPlayer(el, config, makeCbs())
    // step 0 hotspot: x=280, y=160, w=80, h=40, tol=10 → click at 320, 180 = centre
    fireClick(el, 320, 180)
    const feedback = el.querySelector<HTMLElement>('.el-sim-feedback')!
    expect(feedback.textContent).toBe('Correct!')
    expect(feedback.style.color).toBe('rgb(46, 204, 113)') // #2ecc71
  })

  it('disables click layer after correct click', () => {
    const config = makeConfig({ mode: 'practice' })
    mountSimPlayer(el, config, makeCbs())
    fireClick(el, 320, 180)
    const layer = el.querySelector<HTMLElement>('.el-sim-click-layer')!
    expect(layer.style.pointerEvents).toBe('none')
  })

  it('shows Next button after correct click', () => {
    const config = makeConfig({ mode: 'practice' })
    mountSimPlayer(el, config, makeCbs())
    fireClick(el, 320, 180)
    expect(el.querySelector<HTMLElement>('.el-sim-next-btn')!.style.display).toBe('block')
  })

  it('advances to step 2 after clicking Next', () => {
    const config = makeConfig({ mode: 'practice' })
    mountSimPlayer(el, config, makeCbs())
    fireClick(el, 320, 180)
    el.querySelector<HTMLButtonElement>('.el-sim-next-btn')!.click()
    expect(el.querySelector('.el-sim-step-counter')!.textContent).toBe('Step 2 / 2')
  })
})

// ─── Practice mode — incorrect click ─────────────────────────────────────────

describe('practice mode — incorrect click', () => {
  let el: HTMLElement

  beforeEach(() => {
    el = makeContainer('w-sim-incorrect')
  })

  it('shows incorrect feedback on miss', () => {
    const config = makeConfig({ mode: 'practice' })
    mountSimPlayer(el, config, makeCbs())
    // Click far outside hotspot (x=0, y=0)
    fireClick(el, 0, 0)
    const feedback = el.querySelector<HTMLElement>('.el-sim-feedback')!
    expect(feedback.textContent).toContain('Try again.')
  })

  it('shows hint on second wrong attempt', () => {
    const config = makeConfig({ mode: 'practice' })
    mountSimPlayer(el, config, makeCbs())
    fireClick(el, 0, 0) // first miss — hint shown immediately (attemptCount=1)
    const feedback = el.querySelector<HTMLElement>('.el-sim-feedback')!
    expect(feedback.textContent).toContain('Look at the bottom right')
  })

  it('forces advance when maxAttempts exhausted', () => {
    const config = makeConfig({ mode: 'practice' })
    mountSimPlayer(el, config, makeCbs())
    // advance to step 1 (maxAttempts=2) via correct click on step 0
    fireClick(el, 320, 180)
    el.querySelector<HTMLButtonElement>('.el-sim-next-btn')!.click()
    // step 1 hotspot: x=100,y=100,w=80,h=30,tol=5
    fireClick(el, 0, 0) // miss 1
    fireClick(el, 0, 0) // miss 2 → limit reached
    expect(el.querySelector<HTMLElement>('.el-sim-next-btn')!.style.display).toBe('block')
  })

  it('does not advance click layer pointer events before limit', () => {
    const config = makeConfig({ mode: 'practice' })
    mountSimPlayer(el, config, makeCbs())
    fireClick(el, 0, 0) // miss 1 on unlimited step
    const layer = el.querySelector<HTMLElement>('.el-sim-click-layer')!
    expect(layer.style.pointerEvents).toBe('auto')
  })
})

// ─── Assessment mode ──────────────────────────────────────────────────────────

describe('assessment mode', () => {
  let el: HTMLElement

  beforeEach(() => {
    el = makeContainer('w-sim-assessment')
  })

  it('calls onScore with score=1.0 when all steps correct', () => {
    const cbs = makeCbs()
    const config = makeConfig({ mode: 'assessment' })
    mountSimPlayer(el, config, cbs)

    // Correct click on step 0
    fireClick(el, 320, 180)
    el.querySelector<HTMLButtonElement>('.el-sim-next-btn')!.click()

    // Correct click on step 1 (centre: 100+40=140, 100+15=115)
    fireClick(el, 140, 115)
    el.querySelector<HTMLButtonElement>('.el-sim-next-btn')!.click()

    // onScore should have been called once on completion
    expect(cbs.onScore).toHaveBeenCalledOnce()
    const [wid, score, weight] = cbs.onScore.mock.calls[0]!
    expect(wid).toBe('sim-assessment') // widget id stripped of 'w-'
    expect(score).toBe(1.0)
    expect(weight).toBe(100)
  })

  it('calls onScore with score=0.5 when half steps correct', () => {
    const cbs = makeCbs()
    const config = makeConfig({ mode: 'assessment' })
    mountSimPlayer(el, config, cbs)

    // Miss step 0 (unlimited) then click Next after maxAttempts...
    // Step 0 is unlimited so we can't force completion that way.
    // Use a 1-attempt variant instead.
    // Make a new container with maxAttempts=1 on step 0
    el.remove()
    el = makeContainer('w-sim-half')
    const halfConfig: SimConfig = {
      ...config,
      steps: [
        { ...config.steps[0]!, maxAttempts: 1 },
        { ...config.steps[1]!, maxAttempts: -1 },
      ],
    }
    mountSimPlayer(el, halfConfig, cbs)

    // Miss step 0 (only 1 attempt) → next forced
    fireClick(el, 0, 0) // miss → maxAttempts reached
    el.querySelector<HTMLButtonElement>('.el-sim-next-btn')!.click()

    // Correct on step 1
    fireClick(el, 140, 115) // inside step-1 hotspot
    el.querySelector<HTMLButtonElement>('.el-sim-next-btn')!.click()

    expect(cbs.onScore).toHaveBeenCalledOnce()
    expect(cbs.onScore.mock.calls[0]![1]).toBeCloseTo(0.5)
  })

  it('calls onComplete when Continue is clicked after all steps', () => {
    const cbs = makeCbs()
    const config = makeConfig({ mode: 'assessment' })
    mountSimPlayer(el, config, cbs)

    // Complete both steps correctly
    fireClick(el, 320, 180)
    el.querySelector<HTMLButtonElement>('.el-sim-next-btn')!.click()
    fireClick(el, 140, 115)
    el.querySelector<HTMLButtonElement>('.el-sim-next-btn')!.click()

    // Continue button now visible
    el.querySelector<HTMLButtonElement>('.el-sim-next-btn')!.click()
    expect(cbs.onComplete).toHaveBeenCalledOnce()
  })
})

// ─── Demo mode ────────────────────────────────────────────────────────────────

describe('demo mode', () => {
  it('does not respond to clicks on click layer', () => {
    vi.useFakeTimers()
    const el = makeContainer('w-sim-demo')
    const cbs = makeCbs()
    const config = makeConfig({ mode: 'demo' })
    mountSimPlayer(el, config, cbs)

    const layer = el.querySelector<HTMLElement>('.el-sim-click-layer')!
    expect(layer.style.pointerEvents).toBe('none')

    vi.useRealTimers()
  })

  it('cleanup function cancels pending timer', () => {
    vi.useFakeTimers()
    const el = makeContainer('w-sim-demo-cleanup')
    const cbs = makeCbs()
    const config = makeConfig({ mode: 'demo', steps: [config2step(1500)] })
    const cleanup = mountSimPlayer(el, config, cbs)

    cleanup()
    vi.advanceTimersByTime(2000) // timer should not fire
    // counter still shows Step 1
    expect(el.querySelector('.el-sim-step-counter')!.textContent).toBe('Step 1 / 1')
    vi.useRealTimers()
  })
})

// ─── Hotspot click detection edge cases ──────────────────────────────────────

describe('hotspot boundary click detection', () => {
  let el: HTMLElement

  beforeEach(() => {
    el = makeContainer('w-sim-boundary')
  })

  it('accepts click at exactly tolerance boundary', () => {
    const config = makeConfig({ mode: 'practice' })
    mountSimPlayer(el, config, makeCbs())
    // step 0: hotspot x=280, y=160, w=80, h=40, tol=10
    // left edge with tolerance: x=280-10=270
    fireClick(el, 270, 180) // exactly at left tolerance boundary
    expect(el.querySelector('.el-sim-feedback')!.textContent).toBe('Correct!')
  })

  it('rejects click just outside tolerance', () => {
    const config = makeConfig({ mode: 'practice' })
    mountSimPlayer(el, config, makeCbs())
    // left edge - 1 pixel outside tolerance: x=269
    fireClick(el, 269, 180)
    expect(el.querySelector('.el-sim-feedback')!.textContent).toContain('Try again.')
  })
})

// ─── Helper for demo mode test ────────────────────────────────────────────────

function config2step(demoDelay: number) {
  return {
    id: 'step-0', order: 0,
    description: 'Demo step', instruction: 'Watch', hint: '',
    correctFeedback: 'Correct!', incorrectFeedback: 'Wrong.',
    demoDelay, maxAttempts: -1,
    screenshotKey: 'recordings/s/step-0000.png',
    screenshotUrl: '/simulations/screenshot?key=recordings/s/step-0000.png',
    hotspot: { x: 0, y: 0, width: 100, height: 100, tolerance: 5 },
  }
}
