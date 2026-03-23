import type { SimMode } from './types'

/**
 * Enforces the behavioural rules for demo / practice / assessment modes.
 *
 * Each scene delegates all mode-specific decisions here so the scene code
 * stays free of conditionals scattered across its methods.
 *
 * | Rule              | demo | practice | assessment |
 * |-------------------|------|----------|------------|
 * | Auto-advance      |  ✅  |    ❌    |     ❌     |
 * | Requires input    |  ❌  |    ✅    |     ✅     |
 * | Scored            |  ❌  |    ✅    |     ✅     |
 * | Can skip          |  ✅  |    ✅    |     ❌     |
 * | Show feedback     |  ✅  |    ✅    |     ❌     |
 * | Can retry         |  ✅  |    ✅    |     ❌     |
 */
export class ModeController {
  constructor(private readonly mode: SimMode) {}

  /** Demo mode auto-advances through steps without waiting for user input. */
  isAutoAdvance(): boolean {
    return this.mode === 'demo'
  }

  /** Practice and assessment require the user to interact before advancing. */
  requiresInteraction(): boolean {
    return this.mode !== 'demo'
  }

  /** Demo mode never records scores. */
  isScored(): boolean {
    return this.mode !== 'demo'
  }

  /** Assessment mode locks navigation — every step must be attempted in order. */
  canSkip(): boolean {
    return this.mode !== 'assessment'
  }

  /** Assessment hides feedback until the simulation ends. */
  showFeedback(): boolean {
    return this.mode !== 'assessment'
  }

  /** Assessment allows exactly one attempt per run. */
  canRetry(): boolean {
    return this.mode !== 'assessment'
  }

  /**
   * Returns a 0–1 score fraction for a step result.
   *
   * - demo:       always 0 (unscored)
   * - assessment: 1.0 for correct first attempt, 0 otherwise
   * - practice:   1.0 / attempt number (halves each retry: 1st=1.0, 2nd=0.5, 3rd=0.25…)
   */
  getStepScore(correct: boolean, attempt: number): number {
    if (this.mode === 'demo') return 0
    if (!correct) return 0
    if (this.mode === 'assessment') return 1.0
    // practice: score halves on each retry (1st=1.0, 2nd=0.5, 3rd=0.25, …)
    return 1.0 / Math.pow(ModeController.RETRY_DECAY_BASE, attempt - 1)
  }

  /** Base for the exponential retry decay: score = 1 / 2^(attempt-1). */
  private static readonly RETRY_DECAY_BASE = 2
}
