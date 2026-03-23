/**
 * Unit tests for phaserSimWidget — T035
 *
 * The Phaser bundle is dynamically imported and is not available in the test
 * environment. We verify:
 *  - mountPhaserSim returns a cleanup function when the bundle is missing
 *  - the container shows an error message when the bundle fails to load
 *  - the cleanup returned is safe to call
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mountPhaserSim, type PhaserSimConfig } from '../widgets/phaserSimWidget'

// Suppress expected console.error from failed dynamic import
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => { /* suppress */ })
})

function makeContainer(): HTMLElement {
  const el = document.createElement('div')
  document.body.appendChild(el)
  return el
}

function makeConfig(overrides: Partial<PhaserSimConfig> = {}): PhaserSimConfig {
  return {
    widgetId: 'w-phaser-1',
    simType: 'process-flow',
    mode: 'demo',
    passingScore: 70,
    sceneDef: null,
    width: 800,
    height: 500,
    ...overrides,
  }
}

describe('mountPhaserSim', () => {
  it('returns a cleanup function even when phaser-bundle.js is unavailable', async () => {
    const container = makeContainer()
    const cleanup = await mountPhaserSim(container, makeConfig())
    expect(typeof cleanup).toBe('function')
  })

  it('shows an error message in the container when the bundle fails to load', async () => {
    const container = makeContainer()
    await mountPhaserSim(container, makeConfig())
    // The dynamic import of phaser-bundle.js will fail in jsdom;
    // the widget should render a user-visible error paragraph.
    expect(container.innerHTML).toContain('Phaser bundle not available')
  })

  it('cleanup function is safe to call', async () => {
    const container = makeContainer()
    const cleanup = await mountPhaserSim(container, makeConfig())
    expect(() => cleanup()).not.toThrow()
  })

  it('cleanup function is safe to call multiple times', async () => {
    const container = makeContainer()
    const cleanup = await mountPhaserSim(container, makeConfig())
    expect(() => { cleanup(); cleanup() }).not.toThrow()
  })

  it('accepts various simType values without throwing', async () => {
    const types = ['process-flow', 'interactive-diagram', 'gamified-quiz', 'physics-demo', 'concept-animator'] as const
    for (const simType of types) {
      const container = makeContainer()
      const cleanup = await mountPhaserSim(container, makeConfig({ simType }))
      expect(typeof cleanup).toBe('function')
    }
  })
})
