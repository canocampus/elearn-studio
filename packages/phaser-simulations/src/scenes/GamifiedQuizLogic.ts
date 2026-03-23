import type { GamifiedQuizSceneDef, QuizQuestion } from '../types'
import type { ScoreTracker } from '../ScoreTracker'
import type { ModeController } from '../ModeController'

export interface AnswerResult {
  correct:      boolean
  pointsEarned: number
}

/**
 * GamifiedQuizLogic — pure business logic for the gamified-quiz simulation.
 *
 * Manages question sequencing, lives, combo streaks, and scoring without
 * any Phaser dependency so it can be unit-tested in jsdom.
 */
export class GamifiedQuizLogic {
  private _questionIndex = 0
  private _complete      = false
  private _comboStreak   = 0
  private _totalScore    = 0
  private _lives:        number

  constructor(
    private readonly def: GamifiedQuizSceneDef,
    private readonly tracker: ScoreTracker,
    private readonly controller: ModeController,
  ) {
    // initialLives = 0 means infinite lives
    this._lives = def.initialLives === 0 ? Infinity : (def.initialLives ?? Infinity)
  }

  // ---------------------------------------------------------------------------
  // Read-only state
  // ---------------------------------------------------------------------------

  get currentQuestionIndex(): number {
    return this._questionIndex
  }

  get isComplete(): boolean {
    return this._complete
  }

  get lives(): number {
    return this._lives
  }

  get comboStreak(): number {
    return this._comboStreak
  }

  get totalScore(): number {
    return this._totalScore
  }

  get hasTimer(): boolean {
    return (this.def.timerSeconds ?? 0) > 0
  }

  getCurrentQuestion(): QuizQuestion | null {
    if (this._complete) return null
    return this.def.questions[this._questionIndex] ?? null
  }

  // ---------------------------------------------------------------------------
  // Answer handling
  // ---------------------------------------------------------------------------

  /**
   * Submit an answer for the current question.
   *
   * @param optionIndex - Zero-based index of the chosen option.
   * @returns AnswerResult with `correct` flag and `pointsEarned`.
   */
  answerQuestion(optionIndex: number): AnswerResult {
    if (this._complete) return { correct: false, pointsEarned: 0 }

    const question = this.getCurrentQuestion()
    if (!question) return { correct: false, pointsEarned: 0 }

    const correct = optionIndex === question.correctIndex

    if (correct) {
      const pointsEarned = this._calculatePoints(question)
      this._comboStreak++
      this._totalScore += pointsEarned
      this._recordStep(question, true)
      this._advance()
      return { correct: true, pointsEarned }
    } else {
      this._comboStreak = 0
      this._loseLife()

      if (!this.controller.canRetry()) {
        // Assessment mode: no retry, record failure and advance
        this._recordStep(question, false)
        this._advance()
      }

      return { correct: false, pointsEarned: 0 }
    }
  }

  /**
   * Called by the scene's Phaser timer when time runs out.
   * Marks the quiz as complete immediately.
   */
  onTimerExpired(): void {
    this._complete = true
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _calculatePoints(question: QuizQuestion): number {
    if (!this.controller.isScored()) return 0
    const multiplier = this.def.comboMultiplier ?? 1
    // comboStreak is the streak *before* this correct answer
    const effectiveMultiplier = this._comboStreak >= 1
      ? Math.pow(multiplier, this._comboStreak)
      : 1
    return question.pointValue * effectiveMultiplier
  }

  private _recordStep(question: QuizQuestion, correct: boolean): void {
    if (!this.controller.isScored()) return
    const score = this.controller.getStepScore(correct, 1)
    this.tracker.addStep(question.id, score, 1)
  }

  private _loseLife(): void {
    if (this._lives === Infinity) return
    this._lives--
    if (this._lives <= 0) {
      this._complete = true
    }
  }

  private _advance(): void {
    this._questionIndex++
    if (this._questionIndex >= this.def.questions.length) {
      this._complete = true
    }
  }
}
