/**
 * Unit tests for PhaserSimWidget lifecycle — T030-M03
 *
 * Tests mount(), destroy(), getTracker(), getController() using mocked Phaser
 * and scene modules so no real WebGL or canvas is required in jsdom.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PhaserSimWidget } from '../PhaserSimWidget'
import { ScoreTracker } from '../ScoreTracker'
import type { PhaserSimConfig } from '../types'

// ─── Mock Phaser ──────────────────────────────────────────────────────────────

const mockGameDestroy = vi.fn()
const mockGameEventsOn = vi.fn()
const MockGame = vi.fn().mockImplementation(() => ({
  destroy: mockGameDestroy,
  events: { on: mockGameEventsOn },
}))

vi.mock('phaser', () => ({ Game: MockGame }))

// ─── Mock scene modules ───────────────────────────────────────────────────────

vi.mock('../scenes/ProcessFlowScene', () => ({
  ProcessFlowScene: vi.fn().mockReturnValue({}),
}))
vi.mock('../scenes/InteractiveDiagramScene', () => ({
  InteractiveDiagramScene: vi.fn().mockReturnValue({}),
}))
vi.mock('../scenes/GamifiedQuizScene', () => ({
  GamifiedQuizScene: vi.fn().mockReturnValue({}),
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeContainer(): HTMLElement {
  const el = document.createElement('div')
  document.body.appendChild(el)
  return el
}

function makeConfig(overrides: Partial<PhaserSimConfig> = {}): PhaserSimConfig {
  return {
    widgetId: 'w-1',
    sceneDef: {
      simType: 'process-flow',
      nodes: [],
      edges: [],
      steps: [],
    },
    mode: 'demo',
    passingScore: 70,
    width: 800,
    height: 500,
    ...overrides,
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PhaserSimWidget', () => {
  let widget: PhaserSimWidget

  beforeEach(() => {
    vi.clearAllMocks()
    widget = new PhaserSimWidget()
  })

  // ── Initial state ──────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('getTracker() returns null before mount', () => {
      expect(widget.getTracker()).toBeNull()
    })

    it('getController() returns null before mount', () => {
      expect(widget.getController()).toBeNull()
    })
  })

  // ── mount() ────────────────────────────────────────────────────────────────

  describe('mount()', () => {
    it('creates a Phaser.Game instance with widget dimensions', async () => {
      const container = makeContainer()
      await widget.mount(container, makeConfig())

      expect(MockGame).toHaveBeenCalledWith(expect.objectContaining({
        parent: container,
        width: 800,
        height: 500,
      }))
    })

    it('getTracker() returns a ScoreTracker after mount', async () => {
      const container = makeContainer()
      await widget.mount(container, makeConfig())

      expect(widget.getTracker()).toBeInstanceOf(ScoreTracker)
    })

    it('getController() returns a non-null ModeController after mount', async () => {
      const container = makeContainer()
      await widget.mount(container, makeConfig())

      expect(widget.getController()).not.toBeNull()
    })

    it('registers a sim-complete event listener on game.events', async () => {
      const container = makeContainer()
      await widget.mount(container, makeConfig())

      expect(mockGameEventsOn).toHaveBeenCalledWith('sim-complete', expect.any(Function))
    })

    it('sim-complete listener dispatches elearn:widgetScore on window', async () => {
      const container = makeContainer()
      await widget.mount(container, makeConfig({ widgetId: 'w-phaser-1' }))

      const scoreListener = vi.fn()
      window.addEventListener('elearn:widgetScore', scoreListener)

      // Retrieve and invoke the sim-complete callback captured by the mock
      const simCompleteCall = mockGameEventsOn.mock.calls.find(([event]) => event === 'sim-complete')
      const simCompleteCallback = simCompleteCall?.[1] as (() => void) | undefined
      expect(simCompleteCallback).toBeDefined()
      simCompleteCallback?.()

      window.removeEventListener('elearn:widgetScore', scoreListener)
      expect(scoreListener).toHaveBeenCalledOnce()
    })

    it('sim-complete dispatches correct widgetId in the event detail', async () => {
      const container = makeContainer()
      await widget.mount(container, makeConfig({ widgetId: 'w-quiz-99' }))

      let receivedDetail: Record<string, unknown> | null = null
      const listener = (e: Event) => {
        receivedDetail = (e as CustomEvent).detail as Record<string, unknown>
      }
      window.addEventListener('elearn:widgetScore', listener)

      const simCompleteCall = mockGameEventsOn.mock.calls.find(([event]) => event === 'sim-complete')
      const simCompleteCallback = simCompleteCall?.[1] as (() => void) | undefined
      simCompleteCallback?.()

      window.removeEventListener('elearn:widgetScore', listener)
      expect(receivedDetail?.widgetId).toBe('w-quiz-99')
    })

    it('injects error UI into container when Phaser.Game constructor throws', async () => {
      MockGame.mockImplementationOnce(() => { throw new Error('WebGL not available') })

      const container = makeContainer()
      await widget.mount(container, makeConfig())

      expect(container.innerHTML).toContain('Simulation failed to initialize')
    })

    it('leaves game null when constructor throws (destroy is safe after failed mount)', async () => {
      MockGame.mockImplementationOnce(() => { throw new Error('WebGL not available') })

      const container = makeContainer()
      await widget.mount(container, makeConfig())

      expect(() => widget.destroy()).not.toThrow()
      expect(mockGameDestroy).not.toHaveBeenCalled()
    })

    it('destroys the previous game when mount is called a second time', async () => {
      const container = makeContainer()
      await widget.mount(container, makeConfig())
      await widget.mount(container, makeConfig())

      // First game is destroyed before the second is created
      expect(mockGameDestroy).toHaveBeenCalledTimes(1)
      expect(MockGame).toHaveBeenCalledTimes(2)
    })
  })

  // ── destroy() ─────────────────────────────────────────────────────────────

  describe('destroy()', () => {
    it('calls game.destroy(true) when a game is mounted', async () => {
      const container = makeContainer()
      await widget.mount(container, makeConfig())
      widget.destroy()

      expect(mockGameDestroy).toHaveBeenCalledWith(true)
    })

    it('nulls the tracker after destroy', async () => {
      const container = makeContainer()
      await widget.mount(container, makeConfig())
      widget.destroy()

      expect(widget.getTracker()).toBeNull()
    })

    it('nulls the controller after destroy', async () => {
      const container = makeContainer()
      await widget.mount(container, makeConfig())
      widget.destroy()

      expect(widget.getController()).toBeNull()
    })

    it('is safe to call before mount has been called', () => {
      expect(() => widget.destroy()).not.toThrow()
    })

    it('is safe to call multiple times (idempotent)', async () => {
      const container = makeContainer()
      await widget.mount(container, makeConfig())

      expect(() => { widget.destroy(); widget.destroy() }).not.toThrow()
      // game.destroy(true) called only once — subsequent calls are no-ops
      expect(mockGameDestroy).toHaveBeenCalledTimes(1)
    })
  })
})
