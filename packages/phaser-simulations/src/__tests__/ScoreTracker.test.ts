import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ScoreTracker } from '../ScoreTracker'

describe('ScoreTracker', () => {
  let tracker: ScoreTracker

  beforeEach(() => {
    tracker = new ScoreTracker('widget-1', 70)
  })

  describe('addStep', () => {
    it('records a step score', () => {
      tracker.addStep('step-1', 10, 10)
      expect(tracker.getStepScores()).toHaveLength(1)
      expect(tracker.getStepScores()[0]).toEqual({ stepId: 'step-1', score: 10, maxScore: 10 })
    })

    it('accumulates multiple step scores', () => {
      tracker.addStep('step-1', 10, 10)
      tracker.addStep('step-2', 5, 10)
      expect(tracker.getStepScores()).toHaveLength(2)
    })

    it('overwrites a step score if same stepId added twice', () => {
      tracker.addStep('step-1', 5, 10)
      tracker.addStep('step-1', 8, 10)
      expect(tracker.getStepScores()).toHaveLength(1)
      expect(tracker.getStepScores()[0].score).toBe(8)
    })

    it('clamps score to maxScore', () => {
      tracker.addStep('step-1', 15, 10)
      expect(tracker.getStepScores()[0].score).toBe(10)
    })

    it('clamps score to minimum 0', () => {
      tracker.addStep('step-1', -5, 10)
      expect(tracker.getStepScores()[0].score).toBe(0)
    })
  })

  describe('getPercentage', () => {
    it('returns 0 when no steps recorded', () => {
      expect(tracker.getPercentage()).toBe(0)
    })

    it('returns 100 for perfect score', () => {
      tracker.addStep('s1', 10, 10)
      tracker.addStep('s2', 10, 10)
      expect(tracker.getPercentage()).toBe(100)
    })

    it('calculates correct percentage across steps', () => {
      tracker.addStep('s1', 5, 10)   // 50%
      tracker.addStep('s2', 10, 10)  // 100%
      // total earned: 15, total max: 20 → 75%
      expect(tracker.getPercentage()).toBe(75)
    })

    it('rounds to nearest integer', () => {
      tracker.addStep('s1', 1, 3)  // 33.33...%
      expect(tracker.getPercentage()).toBe(33)
    })
  })

  describe('hasPassed', () => {
    it('returns true when percentage meets passing score', () => {
      tracker.addStep('s1', 7, 10)  // 70% — exactly passing
      expect(tracker.hasPassed()).toBe(true)
    })

    it('returns false when percentage below passing score', () => {
      tracker.addStep('s1', 6, 10)  // 60% — below 70 threshold
      expect(tracker.hasPassed()).toBe(false)
    })
  })

  describe('complete', () => {
    let listener: ReturnType<typeof vi.fn>

    beforeEach(() => {
      listener = vi.fn()
      window.addEventListener('elearn:widgetScore', listener)
    })

    afterEach(() => {
      window.removeEventListener('elearn:widgetScore', listener)
    })

    it('dispatches elearn:widgetScore event on window', () => {
      tracker.addStep('s1', 8, 10)
      tracker.complete()

      expect(listener).toHaveBeenCalledOnce()
      const detail = (listener.mock.calls[0][0] as CustomEvent).detail
      expect(detail.widgetId).toBe('widget-1')
      expect(detail.score).toBe(80)
      expect(detail.passed).toBe(true)
      expect(detail.stepScores).toHaveLength(1)
    })

    it('includes passed: false when score is below threshold', () => {
      tracker.addStep('s1', 5, 10)  // 50% < 70
      tracker.complete()

      const detail = (listener.mock.calls[0][0] as CustomEvent).detail
      expect(detail.passed).toBe(false)
    })

    it('dispatches with score 0 when no steps recorded', () => {
      tracker.complete()

      const detail = (listener.mock.calls[0][0] as CustomEvent).detail
      expect(detail.score).toBe(0)
      expect(detail.passed).toBe(false)
    })
  })

  describe('reset', () => {
    it('clears all step scores', () => {
      tracker.addStep('s1', 10, 10)
      tracker.reset()
      expect(tracker.getStepScores()).toHaveLength(0)
      expect(tracker.getPercentage()).toBe(0)
    })
  })
})
