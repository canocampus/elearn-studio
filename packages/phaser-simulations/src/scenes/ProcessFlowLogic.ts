import type { ProcessFlowSceneDef } from '../types'
import type { ScoreTracker } from '../ScoreTracker'
import type { ModeController } from '../ModeController'

/**
 * ProcessFlowLogic — pure business logic for the process-flow simulation.
 *
 * Decoupled from Phaser so it can be unit-tested in jsdom without a canvas.
 * ProcessFlowScene owns the Phaser rendering; it delegates all state
 * transitions to this class.
 */
export class ProcessFlowLogic {
  private _stepIndex = 0
  private _complete = false
  /** Attempt counter per step (reset when step advances). */
  private _attempt = 1

  constructor(
    private readonly def: ProcessFlowSceneDef,
    private readonly tracker: ScoreTracker,
    private readonly controller: ModeController,
  ) {}

  // ---------------------------------------------------------------------------
  // Read-only state
  // ---------------------------------------------------------------------------

  get currentStepIndex(): number {
    return this._stepIndex
  }

  get isComplete(): boolean {
    return this._complete
  }

  get stepCount(): number {
    return this.def.steps.length
  }

  // ---------------------------------------------------------------------------
  // User interaction
  // ---------------------------------------------------------------------------

  /**
   * Called when the learner clicks a node.
   *
   * In practice/assessment modes the click is evaluated against the expected
   * node for the current step.  In demo mode clicks are ignored (auto-advance
   * drives progression).
   */
  handleNodeClick(nodeId: string): void {
    if (this._complete) return
    if (this.controller.isAutoAdvance()) return  // demo: no click handling

    const step = this.def.steps[this._stepIndex]
    if (!step) return

    const correct = nodeId === step.nodeId

    if (correct) {
      this._recordStep(step.nodeId, true)
      this._advance()
    } else if (!this.controller.canRetry()) {
      // Assessment mode: no retry — record failure and advance
      this._recordStep(step.nodeId, false)
      this._advance()
    } else {
      // Practice mode: wrong answer increments attempt counter
      this._attempt++
    }
  }

  /**
   * Called by the scene's Phaser timer in demo mode.
   * Records no score (demo is unscored) and advances to the next step.
   */
  advanceStep(): void {
    if (this._complete) return
    const step = this.def.steps[this._stepIndex]
    if (step && this.controller.isScored()) {
      this._recordStep(step.nodeId, true)
    }
    this._advance()
  }

  // ---------------------------------------------------------------------------
  // UI helpers (consumed by ProcessFlowScene for rendering)
  // ---------------------------------------------------------------------------

  /** Returns the instruction text for the current step, or '' when done. */
  getCurrentInstruction(): string {
    if (this._complete) return ''
    return this.def.steps[this._stepIndex]?.instruction ?? ''
  }

  /**
   * Returns the nodeId that should be highlighted for the current step.
   * Returns null in demo mode (all nodes are equally visible) or when done.
   */
  getHighlightedNodeId(): string | null {
    if (this._complete) return null
    if (this.controller.isAutoAdvance()) return null
    return this.def.steps[this._stepIndex]?.nodeId ?? null
  }

  /** Auto-advance delay for demo mode in milliseconds. */
  getAutoAdvanceDelayMs(): number {
    return this.def.autoAdvanceDelayMs ?? 2000
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _recordStep(stepId: string, correct: boolean): void {
    if (!this.controller.isScored()) return
    const score = this.controller.getStepScore(correct, this._attempt)
    this.tracker.addStep(stepId, score, 1)
  }

  private _advance(): void {
    this._stepIndex++
    this._attempt = 1
    if (this._stepIndex >= this.def.steps.length) {
      this._complete = true
    }
  }
}
