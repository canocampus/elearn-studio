/**
 * Unit tests for simStore — T024.2
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useSimStore } from '../store/simStore'
import type { SimConfig } from '../types/simulation'

function makeConfig(stepCount: number): SimConfig {
  return {
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

  // ── addStep (TD-014.2) ─────────────────────────────────────────────────────

  describe('addStep (TD-014.2)', () => {
    it('appends a step with default values when no overrides given', () => {
      useSimStore.getState().openPanel(makeConfig(0), 'comp-1')
      useSimStore.getState().addStep()

      const steps = useSimStore.getState().config!.steps
      expect(steps).toHaveLength(1)

      const [step] = steps
      expect(step.id).toMatch(/^step-[a-f0-9]{8}$/)
      expect(step.order).toBe(0)
      expect(step.description).toBe('')
      expect(step.instruction).toBe('')
      expect(step.hint).toBe('')
      expect(step.correctFeedback).toBe('')
      expect(step.incorrectFeedback).toBe('')
      expect(step.demoDelay).toBe(3000)
      expect(step.maxAttempts).toBe(-1)
      expect(step.screenshotKey).toBe('')
      expect(step.screenshotUrl).toBe('')
      // Zero-size hotspot sentinel → HotspotCanvas enters draw-mode
      expect(step.hotspot).toEqual({ x: 0, y: 0, width: 0, height: 0, tolerance: 12 })
    })

    it('sets order to the current steps length (appends to end)', () => {
      useSimStore.getState().openPanel(makeConfig(3), 'comp-1')
      useSimStore.getState().addStep()

      const steps = useSimStore.getState().config!.steps
      expect(steps).toHaveLength(4)
      expect(steps[3].order).toBe(3)
    })

    it('sets selectedStepIndex to the index of the new step', () => {
      useSimStore.getState().openPanel(makeConfig(2), 'comp-1')
      useSimStore.getState().selectStep(0)
      useSimStore.getState().addStep()

      expect(useSimStore.getState().selectedStepIndex).toBe(2)
    })

    it('overrides take precedence over defaults (shallow merge)', () => {
      useSimStore.getState().openPanel(makeConfig(0), 'comp-1')
      useSimStore.getState().addStep({
        description: 'Custom description',
        instruction: 'Click here',
        demoDelay: 500,
      })

      const [step] = useSimStore.getState().config!.steps
      expect(step.description).toBe('Custom description')
      expect(step.instruction).toBe('Click here')
      expect(step.demoDelay).toBe(500)
      // Un-overridden defaults preserved
      expect(step.maxAttempts).toBe(-1)
      expect(step.hotspot).toEqual({ x: 0, y: 0, width: 0, height: 0, tolerance: 12 })
    })

    it('does nothing when config is null', () => {
      // beforeEach already sets config: null
      useSimStore.getState().addStep()
      expect(useSimStore.getState().config).toBeNull()
    })

    it('is immutable — does not mutate the previous steps array', () => {
      const config = makeConfig(2)
      useSimStore.getState().openPanel(config, 'comp-1')
      const originalStepsRef = config.steps
      const originalLength = originalStepsRef.length

      useSimStore.getState().addStep()

      expect(originalStepsRef).toHaveLength(originalLength)
      expect(useSimStore.getState().config!.steps).not.toBe(originalStepsRef)
    })

    it('produces unique step ids across successive calls', () => {
      useSimStore.getState().openPanel(makeConfig(0), 'comp-1')
      useSimStore.getState().addStep()
      useSimStore.getState().addStep()
      useSimStore.getState().addStep()

      const ids = useSimStore.getState().config!.steps.map(s => s.id)
      expect(new Set(ids).size).toBe(3)
    })
  })

  // ── setConfig (TD-014.2) ───────────────────────────────────────────────────

  describe('setConfig (TD-014.2)', () => {
    it('replaces the config entirely', () => {
      useSimStore.getState().openPanel(makeConfig(2), 'comp-1')
      const next = makeConfig(5)
      useSimStore.getState().setConfig(next)

      expect(useSimStore.getState().config).toBe(next)
    })

    it('preserves panelOpen and editingComponentId', () => {
      useSimStore.getState().openPanel(makeConfig(2), 'comp-42')
      useSimStore.getState().setConfig(makeConfig(3))

      const state = useSimStore.getState()
      expect(state.panelOpen).toBe(true)
      expect(state.editingComponentId).toBe('comp-42')
    })

    it('clamps selectedStepIndex when the new config has fewer steps', () => {
      useSimStore.getState().openPanel(makeConfig(5), 'comp-1')
      useSimStore.getState().selectStep(4)
      useSimStore.getState().setConfig(makeConfig(2))

      // max valid index in a 2-step config is 1
      expect(useSimStore.getState().selectedStepIndex).toBe(1)
    })

    it('resets selectedStepIndex to 0 when the new config has no steps', () => {
      useSimStore.getState().openPanel(makeConfig(3), 'comp-1')
      useSimStore.getState().selectStep(2)
      useSimStore.getState().setConfig(makeConfig(0))

      expect(useSimStore.getState().selectedStepIndex).toBe(0)
    })

    it('keeps selectedStepIndex when the new config has enough steps', () => {
      useSimStore.getState().openPanel(makeConfig(5), 'comp-1')
      useSimStore.getState().selectStep(2)
      useSimStore.getState().setConfig(makeConfig(10))

      expect(useSimStore.getState().selectedStepIndex).toBe(2)
    })
  })
})
