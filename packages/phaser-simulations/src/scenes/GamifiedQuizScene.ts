import Phaser from 'phaser'
import type { GamifiedQuizSceneDef } from '../types'
import type { ScoreTracker } from '../ScoreTracker'
import type { ModeController } from '../ModeController'
import { GamifiedQuizLogic } from './GamifiedQuizLogic'

const FONT_FAMILY   = '"Arial", sans-serif'
const BG_COLOUR     = 0x1a1a2e
const BTN_COLOUR    = 0x2980b9
const BTN_HOVER     = 0x3498db
const BTN_CORRECT   = 0x27ae60
const BTN_WRONG     = 0xe74c3c

/**
 * GamifiedQuizScene — Phaser.Scene that wraps questions in game mechanics:
 * lives, combo multiplier, optional countdown timer, and animated feedback.
 *
 * All business logic lives in GamifiedQuizLogic; this class handles only
 * rendering and Phaser lifecycle hooks.
 */
export class GamifiedQuizScene extends (Phaser.Scene as typeof Phaser.Scene) {
  private readonly def: GamifiedQuizSceneDef
  private readonly tracker: ScoreTracker
  private readonly controller: ModeController
  private logic!: GamifiedQuizLogic

  // HUD elements
  private questionText!:  Phaser.GameObjects.Text
  private optionButtons:  Phaser.GameObjects.Rectangle[] = []
  private optionLabels:   Phaser.GameObjects.Text[]      = []
  private livesText!:     Phaser.GameObjects.Text
  private scoreText!:     Phaser.GameObjects.Text
  private comboText!:     Phaser.GameObjects.Text
  private timerText!:     Phaser.GameObjects.Text
  private feedbackText!:  Phaser.GameObjects.Text
  private completionBg!:  Phaser.GameObjects.Rectangle
  private completionText!: Phaser.GameObjects.Text

  private timerEvent: Phaser.Time.TimerEvent | null = null
  private remainingSeconds = 0

  constructor(def: GamifiedQuizSceneDef, tracker: ScoreTracker, controller: ModeController) {
    super({ key: 'GamifiedQuizScene' })
    this.def        = def
    this.tracker    = tracker
    this.controller = controller
  }

  // ---------------------------------------------------------------------------
  // Phaser lifecycle
  // ---------------------------------------------------------------------------

  create(): void {
    this.logic = new GamifiedQuizLogic(this.def, this.tracker, this.controller)

    const W = this.scale?.width  ?? 800
    const H = this.scale?.height ?? 500

    // Background
    this.add.rectangle(W / 2, H / 2, W, H, BG_COLOUR)

    this._createHUD(W, H)
    this._createOptionButtons(W, H)
    this._createFeedback(W, H)
    this._createCompletionScreen(W, H)
    this._renderCurrentQuestion()

    if (this.logic.hasTimer) {
      this._startTimer()
    }
  }

  // ---------------------------------------------------------------------------
  // HUD
  // ---------------------------------------------------------------------------

  private _createHUD(W: number, H: number): void {
    this.questionText = this.add.text(W / 2, 40, '', {
      fontSize:   '20px',
      fontFamily: FONT_FAMILY,
      color:      '#ffffff',
      align:      'center',
      wordWrap:   { width: W - 80 },
    }).setOrigin(0.5, 0)

    this.livesText = this.add.text(16, 16, '', {
      fontSize:   '16px',
      fontFamily: FONT_FAMILY,
      color:      '#e74c3c',
    })

    this.scoreText = this.add.text(W - 16, 16, '', {
      fontSize:   '16px',
      fontFamily: FONT_FAMILY,
      color:      '#f1c40f',
      align:      'right',
    }).setOrigin(1, 0)

    this.comboText = this.add.text(W / 2, H - 20, '', {
      fontSize:   '14px',
      fontFamily: FONT_FAMILY,
      color:      '#e67e22',
      align:      'center',
    }).setOrigin(0.5, 1)

    this.timerText = this.add.text(W / 2, 16, '', {
      fontSize:   '16px',
      fontFamily: FONT_FAMILY,
      color:      '#1abc9c',
      align:      'center',
    }).setOrigin(0.5, 0)
  }

  // ---------------------------------------------------------------------------
  // Option buttons
  // ---------------------------------------------------------------------------

  private _createOptionButtons(W: number, H: number): void {
    const maxOptions = 4
    const btnW = Math.min(320, W - 80)
    const btnH = 44
    const gap  = 12
    const startY = H / 2 - ((maxOptions * (btnH + gap)) / 2) + 30

    for (let i = 0; i < maxOptions; i++) {
      const y = startY + i * (btnH + gap)

      const btn = this.add.rectangle(W / 2, y, btnW, btnH, BTN_COLOUR)
        .setInteractive({ useHandCursor: true })
      btn.on('pointerover', () => btn.setFillStyle(BTN_HOVER))
      btn.on('pointerout',  () => btn.setFillStyle(BTN_COLOUR))
      btn.on('pointerdown', () => this._onOptionClick(i))

      const lbl = this.add.text(W / 2, y, '', {
        fontSize:   '15px',
        fontFamily: FONT_FAMILY,
        color:      '#ffffff',
        align:      'center',
      }).setOrigin(0.5)

      this.optionButtons.push(btn)
      this.optionLabels.push(lbl)
    }
  }

  private _onOptionClick(optionIndex: number): void {
    // Disable all buttons during feedback
    this._setButtonsEnabled(false)

    const result = this.logic.answerQuestion(optionIndex)
    const btn    = this.optionButtons[optionIndex]

    btn.setFillStyle(result.correct ? BTN_CORRECT : BTN_WRONG)

    const feedbackMsg = result.correct
      ? (result.pointsEarned > 0 ? `+${result.pointsEarned} pts` : 'Correct!')
      : 'Wrong!'

    this._showFeedback(feedbackMsg, result.correct)

    if (this.logic.isComplete) {
      this.time.delayedCall(800, () => this._onComplete())
    } else {
      this.time.delayedCall(800, () => {
        this._renderCurrentQuestion()
        this._setButtonsEnabled(true)
      })
    }
  }

  // ---------------------------------------------------------------------------
  // Render state
  // ---------------------------------------------------------------------------

  private _renderCurrentQuestion(): void {
    const q = this.logic.getCurrentQuestion()
    if (!q) return

    this.questionText.setText(q.text)

    for (let i = 0; i < this.optionButtons.length; i++) {
      const option = q.options[i]
      const visible = option !== undefined
      this.optionButtons[i].setVisible(visible).setFillStyle(BTN_COLOUR)
      this.optionLabels[i].setVisible(visible).setText(option ?? '')
    }

    this._updateHUD()
  }

  private _updateHUD(): void {
    const lives = this.logic.lives === Infinity ? '∞' : String(this.logic.lives)
    this.livesText.setText(`♥ ${lives}`)
    this.scoreText.setText(`Score: ${this.logic.totalScore}`)

    const streak = this.logic.comboStreak
    this.comboText.setText(streak >= 2 ? `🔥 Combo ×${streak}` : '')
  }

  // ---------------------------------------------------------------------------
  // Feedback
  // ---------------------------------------------------------------------------

  private _createFeedback(W: number, H: number): void {
    this.feedbackText = this.add.text(W / 2, H * 0.78, '', {
      fontSize:   '22px',
      fontFamily: FONT_FAMILY,
      color:      '#ffffff',
      align:      'center',
    }).setOrigin(0.5).setVisible(false)
  }

  private _showFeedback(message: string, correct: boolean): void {
    this.feedbackText
      .setText(message)
      .setColor(correct ? '#2ecc71' : '#e74c3c')
      .setVisible(true)
    this.time.delayedCall(700, () => this.feedbackText.setVisible(false))
  }

  // ---------------------------------------------------------------------------
  // Timer
  // ---------------------------------------------------------------------------

  private _startTimer(): void {
    this.remainingSeconds = this.def.timerSeconds ?? 0
    this._updateTimerText()

    this.timerEvent = this.time.addEvent({
      delay:    1000,
      repeat:   this.remainingSeconds - 1,
      callback: () => {
        this.remainingSeconds--
        this._updateTimerText()
        if (this.remainingSeconds <= 0) {
          this.logic.onTimerExpired()
          this._onComplete()
        }
      },
    })
  }

  private _updateTimerText(): void {
    if (this.logic.hasTimer) {
      this.timerText.setText(`⏱ ${this.remainingSeconds}s`)
    }
  }

  // ---------------------------------------------------------------------------
  // Completion
  // ---------------------------------------------------------------------------

  private _createCompletionScreen(W: number, H: number): void {
    this.completionBg = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.7)
      .setVisible(false)
    this.completionText = this.add.text(W / 2, H / 2, '', {
      fontSize:   '28px',
      fontFamily: FONT_FAMILY,
      color:      '#f1c40f',
      align:      'center',
    }).setOrigin(0.5).setVisible(false)
  }

  private _onComplete(): void {
    this.timerEvent?.remove()
    this._setButtonsEnabled(false)
    this.feedbackText.setVisible(false)

    const pct = this.tracker.getPercentage()
    this.completionBg.setVisible(true)
    this.completionText
      .setText(`Quiz complete!\nScore: ${this.logic.totalScore}\nRating: ${pct}%`)
      .setVisible(true)

    this.tracker.complete()
    this.game.events.emit('sim-complete')
  }

  // ---------------------------------------------------------------------------
  // Utility
  // ---------------------------------------------------------------------------

  private _setButtonsEnabled(enabled: boolean): void {
    for (const btn of this.optionButtons) {
      if (enabled) {
        btn.setInteractive({ useHandCursor: true })
      } else {
        btn.disableInteractive()
      }
    }
  }
}
