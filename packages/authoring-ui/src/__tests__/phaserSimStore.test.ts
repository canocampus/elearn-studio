/**
 * Unit tests for phaserSimStore — T034
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { usePhaserSimStore } from '../store/phaserSimStore'
import type { PhaserSimExtendedProps } from '../types/phaserSim'

const DEFAULT_CONFIG: PhaserSimExtendedProps = {
  simType: 'process-flow',
  mode: 'practice',
  passingScore: 70,
  sceneDef: null,
  width: 800,
  height: 500,
}

describe('phaserSimStore', () => {
  beforeEach(() => {
    usePhaserSimStore.setState({
      previewOpen: false,
      editingComponentId: null,
      config: null,
    })
  })

  describe('openPreview', () => {
    it('sets previewOpen, config, and editingComponentId', () => {
      usePhaserSimStore.getState().openPreview(DEFAULT_CONFIG, 'comp-1')

      const state = usePhaserSimStore.getState()
      expect(state.previewOpen).toBe(true)
      expect(state.config).toBe(DEFAULT_CONFIG)
      expect(state.editingComponentId).toBe('comp-1')
    })

    it('can open with a different config', () => {
      const config: PhaserSimExtendedProps = { ...DEFAULT_CONFIG, simType: 'gamified-quiz', mode: 'assessment' }
      usePhaserSimStore.getState().openPreview(config, 'comp-2')

      const state = usePhaserSimStore.getState()
      expect(state.config?.simType).toBe('gamified-quiz')
      expect(state.config?.mode).toBe('assessment')
      expect(state.editingComponentId).toBe('comp-2')
    })
  })

  describe('closePreview', () => {
    it('resets previewOpen, config, and editingComponentId', () => {
      usePhaserSimStore.getState().openPreview(DEFAULT_CONFIG, 'comp-1')
      usePhaserSimStore.getState().closePreview()

      const state = usePhaserSimStore.getState()
      expect(state.previewOpen).toBe(false)
      expect(state.config).toBeNull()
      expect(state.editingComponentId).toBeNull()
    })

    it('is safe to call when already closed', () => {
      expect(() => usePhaserSimStore.getState().closePreview()).not.toThrow()
      expect(usePhaserSimStore.getState().previewOpen).toBe(false)
    })
  })

  describe('openPreview then closePreview cycle', () => {
    it('can re-open with a new config after closing', () => {
      usePhaserSimStore.getState().openPreview(DEFAULT_CONFIG, 'comp-1')
      usePhaserSimStore.getState().closePreview()

      const newConfig: PhaserSimExtendedProps = { ...DEFAULT_CONFIG, simType: 'interactive-diagram' }
      usePhaserSimStore.getState().openPreview(newConfig, 'comp-3')

      const state = usePhaserSimStore.getState()
      expect(state.previewOpen).toBe(true)
      expect(state.config?.simType).toBe('interactive-diagram')
      expect(state.editingComponentId).toBe('comp-3')
    })
  })
})
