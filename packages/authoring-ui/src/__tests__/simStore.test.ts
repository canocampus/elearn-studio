/**
 * Unit tests for simStore — T024.2
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useSimStore } from '../store/simStore'
import type { SimConfig } from '../types/simulation'

function makeConfig(stepCount: number): SimConfig {
  return {
    sessionId: 'sess-test',
    mode: 'practice',
    passingScore: 80,
    steps: Array.from({ length: stepCount }, (_, i) => ({
      id: `step-${i}`,
      order: i,
      description: `Step ${i + 1}`,
      instruction: '',
      hint: '',
      correctFeedback: 'Correct!',
      incorrectFeedback: 'Try again.',
      demoDelay: 1500,
      maxAttempts: -1,
      screenshotKey: `recordings/sess-test/screenshots/step-${i}.png`,
      screenshotUrl: `/simulations/screenshot?key=recordings/sess-test/screenshots/step-${i}.png`,
      hotspot: { x: 100, y: 100, width: 80, height: 40, tolerance: 10 },
    })),
  }
}

describe('simStore', () => {
  beforeEach(() => {
    useSimStore.setState({
      config: null,
      selectedStepIndex: 0,
      panelOpen: false,
      editingComponentId: null,
    })
  })

  // ── openPanel / closePanel ──────────────────────────────────────────────────

  it('openPanel sets config, componentId, panelOpen=true, selectedStepIndex=0', () => {
    const config = makeConfig(3)
    useSimStore.getState().openPanel(config, 'comp-1')

    const state = useSimStore.getState()
    expect(state.panelOpen).toBe(true)
    expect(state.config).toBe(config)
    expect(state.editingComponentId).toBe('comp-1')
    expect(state.selectedStepIndex).toBe(0)
  })

  it('closePanel resets config and panelOpen', () => {
    useSimStore.getState().openPanel(makeConfig(2), 'comp-1')
    useSimStore.getState().closePanel()

    const state = useSimStore.getState()
    expect(state.panelOpen).toBe(false)
    expect(state.config).toBeNull()
    expect(state.editingComponentId).toBeNull()
  })

  // ── selectStep ─────────────────────────────────────────────────────────────

  it('selectStep updates selectedStepIndex', () => {
    useSimStore.getState().openPanel(makeConfig(3), 'comp-1')
    useSimStore.getState().selectStep(2)
    expect(useSimStore.getState().selectedStepIndex).toBe(2)
  })

  // ── updateStep ─────────────────────────────────────────────────────────────

  it('updateStep patches the correct step immutably', () => {
    const config = makeConfig(3)
    useSimStore.getState().openPanel(config, 'comp-1')
    useSimStore.getState().updateStep(1, { description: 'Updated' })

    const updated = useSimStore.getState().config!
    expect(updated.steps[0].description).toBe('Step 1')   // unchanged
    expect(updated.steps[1].description).toBe('Updated')  // patched
    expect(updated.steps[2].description).toBe('Step 3')   // unchanged
    // Immutability: original config steps array not mutated
    expect(config.steps[1].description).toBe('Step 2')
  })

  it('updateStep does nothing when config is null', () => {
    useSimStore.getState().updateStep(0, { description: 'X' })
    expect(useSimStore.getState().config).toBeNull()
  })

  // ── reorderStep ────────────────────────────────────────────────────────────

  it('reorderStep moves step forward and re-assigns order values', () => {
    useSimStore.getState().openPanel(makeConfig(3), 'comp-1')
    useSimStore.getState().reorderStep(0, 2) // move step-0 to last position

    const steps = useSimStore.getState().config!.steps
    expect(steps[0].id).toBe('step-1')
    expect(steps[1].id).toBe('step-2')
    expect(steps[2].id).toBe('step-0')
    // order values re-assigned
    expect(steps.map(s => s.order)).toEqual([0, 1, 2])
    // selectedStepIndex follows the moved step
    expect(useSimStore.getState().selectedStepIndex).toBe(2)
  })

  it('reorderStep moves step backward', () => {
    useSimStore.getState().openPanel(makeConfig(3), 'comp-1')
    useSimStore.getState().reorderStep(2, 0)

    const steps = useSimStore.getState().config!.steps
    expect(steps[0].id).toBe('step-2')
    expect(steps[1].id).toBe('step-0')
    expect(steps[2].id).toBe('step-1')
  })

  // ── deleteStep ─────────────────────────────────────────────────────────────

  it('deleteStep removes step and re-assigns order values', () => {
    useSimStore.getState().openPanel(makeConfig(3), 'comp-1')
    useSimStore.getState().deleteStep(1)

    const steps = useSimStore.getState().config!.steps
    expect(steps).toHaveLength(2)
    expect(steps[0].id).toBe('step-0')
    expect(steps[1].id).toBe('step-2')
    expect(steps.map(s => s.order)).toEqual([0, 1])
  })

  it('deleteStep adjusts selectedStepIndex when deleting the last step', () => {
    useSimStore.getState().openPanel(makeConfig(2), 'comp-1')
    useSimStore.getState().selectStep(1)
    useSimStore.getState().deleteStep(1)

    expect(useSimStore.getState().selectedStepIndex).toBe(0)
  })

  it('deleteStep on empty result does not go below 0', () => {
    useSimStore.getState().openPanel(makeConfig(1), 'comp-1')
    useSimStore.getState().deleteStep(0)

    expect(useSimStore.getState().selectedStepIndex).toBe(0)
    expect(useSimStore.getState().config!.steps).toHaveLength(0)
  })

  // ── updateMode ─────────────────────────────────────────────────────────────

  it('updateMode changes the simulation mode', () => {
    useSimStore.getState().openPanel(makeConfig(1), 'comp-1')
    useSimStore.getState().updateMode('demo')
    expect(useSimStore.getState().config!.mode).toBe('demo')
  })

  it('updateMode does nothing when config is null', () => {
    useSimStore.getState().updateMode('assessment')
    expect(useSimStore.getState().config).toBeNull()
  })

  // ── updatePassingScore ─────────────────────────────────────────────────────

  it('updatePassingScore updates the passing score', () => {
    useSimStore.getState().openPanel(makeConfig(1), 'comp-1')
    useSimStore.getState().updatePassingScore(70)
    expect(useSimStore.getState().config!.passingScore).toBe(70)
  })
})
