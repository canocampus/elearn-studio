import { describe, it, expect } from 'vitest'
import { ModeController } from '../ModeController'

describe('ModeController', () => {
  describe('demo mode', () => {
    const mc = new ModeController('demo')

    it('auto-advances through steps', () => {
      expect(mc.isAutoAdvance()).toBe(true)
    })

    it('does not require interaction', () => {
      expect(mc.requiresInteraction()).toBe(false)
    })

    it('does not score steps', () => {
      expect(mc.isScored()).toBe(false)
    })

    it('allows skipping steps', () => {
      expect(mc.canSkip()).toBe(true)
    })

    it('shows feedback', () => {
      expect(mc.showFeedback()).toBe(true)
    })

    it('allows unlimited retries', () => {
      expect(mc.canRetry()).toBe(true)
    })
  })

  describe('practice mode', () => {
    const mc = new ModeController('practice')

    it('does not auto-advance', () => {
      expect(mc.isAutoAdvance()).toBe(false)
    })

    it('requires interaction', () => {
      expect(mc.requiresInteraction()).toBe(true)
    })

    it('scores steps', () => {
      expect(mc.isScored()).toBe(true)
    })

    it('allows skipping steps', () => {
      expect(mc.canSkip()).toBe(true)
    })

    it('shows feedback after each step', () => {
      expect(mc.showFeedback()).toBe(true)
    })

    it('allows retries', () => {
      expect(mc.canRetry()).toBe(true)
    })
  })

  describe('assessment mode', () => {
    const mc = new ModeController('assessment')

    it('does not auto-advance', () => {
      expect(mc.isAutoAdvance()).toBe(false)
    })

    it('requires interaction', () => {
      expect(mc.requiresInteraction()).toBe(true)
    })

    it('scores steps', () => {
      expect(mc.isScored()).toBe(true)
    })

    it('does not allow skipping steps', () => {
      expect(mc.canSkip()).toBe(false)
    })

    it('does not show feedback during attempt', () => {
      expect(mc.showFeedback()).toBe(false)
    })

    it('does not allow retries', () => {
      expect(mc.canRetry()).toBe(false)
    })
  })

  describe('getStepScore', () => {
    it('returns full score for correct first attempt in assessment', () => {
      const mc = new ModeController('assessment')
      expect(mc.getStepScore(true, 1)).toBe(1.0)
    })

    it('returns 0 for incorrect in assessment', () => {
      const mc = new ModeController('assessment')
      expect(mc.getStepScore(false, 1)).toBe(0)
    })

    it('returns full score for correct first attempt in practice', () => {
      const mc = new ModeController('practice')
      expect(mc.getStepScore(true, 1)).toBe(1.0)
    })

    it('returns partial score for correct on second attempt in practice', () => {
      const mc = new ModeController('practice')
      expect(mc.getStepScore(true, 2)).toBe(0.5)
    })

    it('returns partial score for correct on third attempt in practice', () => {
      const mc = new ModeController('practice')
      expect(mc.getStepScore(true, 3)).toBe(0.25)
    })

    it('returns 0 in demo mode regardless of correctness', () => {
      const mc = new ModeController('demo')
      expect(mc.getStepScore(true, 1)).toBe(0)
      expect(mc.getStepScore(false, 1)).toBe(0)
    })
  })
})
