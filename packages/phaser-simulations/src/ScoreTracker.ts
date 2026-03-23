import type { StepScore, WidgetScoreDetail } from './types'

/**
 * Accumulates per-step scores for a Phaser simulation widget and dispatches
 * the `elearn:widgetScore` CustomEvent on `window` when the simulation ends.
 *
 * Usage:
 *   const tracker = new ScoreTracker(widgetId, passingScore)
 *   tracker.addStep('step-1', earned, max)
 *   tracker.complete()   // → dispatches window CustomEvent
 */
export class ScoreTracker {
  private readonly widgetId: string
  private readonly passingScore: number
  private steps = new Map<string, StepScore>()

  constructor(widgetId: string, passingScore: number) {
    this.widgetId = widgetId
    this.passingScore = passingScore
  }

  /** Record (or overwrite) the score for a single step. */
  addStep(stepId: string, score: number, maxScore: number): void {
    const clamped = Math.min(Math.max(score, 0), maxScore)
    this.steps.set(stepId, { stepId, score: clamped, maxScore })
  }

  /** Returns a snapshot of all recorded step scores. */
  getStepScores(): StepScore[] {
    return Array.from(this.steps.values())
  }

  /** Returns the overall score as a 0–100 integer. */
  getPercentage(): number {
    const scores = this.getStepScores()
    if (scores.length === 0) return 0
    const earned = scores.reduce((sum, s) => sum + s.score, 0)
    const max = scores.reduce((sum, s) => sum + s.maxScore, 0)
    if (max === 0) return 0
    return Math.round((earned / max) * 100)
  }

  /** Returns true if the overall percentage meets the passing threshold. */
  hasPassed(): boolean {
    return this.getPercentage() >= this.passingScore
  }

  /**
   * Finalises the simulation: dispatches `elearn:widgetScore` on `window`
   * so the runtime-player can forward the result to SCORM/LMS.
   */
  complete(): void {
    const score = this.getPercentage()
    const detail: WidgetScoreDetail = {
      widgetId: this.widgetId,
      score,
      passed: score >= this.passingScore,
      stepScores: this.getStepScores(),
    }
    window.dispatchEvent(new CustomEvent<WidgetScoreDetail>('elearn:widgetScore', { detail }))
  }

  /** Resets all step scores (allows re-attempt in practice mode). */
  reset(): void {
    this.steps.clear()
  }
}
