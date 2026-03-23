/**
 * GamifiedQuizLogic unit tests.
 *
 * Tests quiz sequencing, lives, combo multiplier, timer state, and
 * mode-driven scoring.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import type { GamifiedQuizSceneDef } from '../types'
import { ScoreTracker } from '../ScoreTracker'
import { ModeController } from '../ModeController'
import { GamifiedQuizLogic } from '../scenes/GamifiedQuizLogic'

function makeQ(id: string, correctIndex = 0) {
  return { id, text: `Question ${id}`, options: ['A', 'B', 'C'], correctIndex, pointValue: 10 }
}

function makeDef(overrides?: Partial<GamifiedQuizSceneDef>): GamifiedQuizSceneDef {
  return {
    simType: 'gamified-quiz',
    questions: [makeQ('q1', 0), makeQ('q2', 1), makeQ('q3', 2)],
    timerSeconds: 0,    // no timer by default in tests
    initialLives: 3,
    comboMultiplier: 2,
    ...overrides,
  }
}

describe('GamifiedQuizLogic', () => {
  let tracker: ScoreTracker
  let practiceCtrl: ModeController
  let assessCtrl: ModeController
  let demoCtrl: ModeController

  beforeEach(() => {
    tracker      = new ScoreTracker('w1', 70)
    practiceCtrl = new ModeController('practice')
    assessCtrl   = new ModeController('assessment')
    demoCtrl     = new ModeController('demo')
  })

  // -------------------------------------------------------------------------
  describe('initialisation', () => {
    it('starts at question 0', () => {
      const logic = new GamifiedQuizLogic(makeDef(), tracker, practiceCtrl)
      expect(logic.currentQuestionIndex).toBe(0)
    })

    it('isComplete is false initially', () => {
      const logic = new GamifiedQuizLogic(makeDef(), tracker, practiceCtrl)
      expect(logic.isComplete).toBe(false)
    })

    it('starts with full lives', () => {
      const logic = new GamifiedQuizLogic(makeDef(), tracker, practiceCtrl)
      expect(logic.lives).toBe(3)
    })

    it('combo streak starts at 0', () => {
      const logic = new GamifiedQuizLogic(makeDef(), tracker, practiceCtrl)
      expect(logic.comboStreak).toBe(0)
    })

    it('initialScore is 0', () => {
      const logic = new GamifiedQuizLogic(makeDef(), tracker, practiceCtrl)
      expect(logic.totalScore).toBe(0)
    })
  })

  // -------------------------------------------------------------------------
  describe('getCurrentQuestion', () => {
    it('returns the first question', () => {
      const logic = new GamifiedQuizLogic(makeDef(), tracker, practiceCtrl)
      expect(logic.getCurrentQuestion()?.id).toBe('q1')
    })

    it('returns null when quiz is complete', () => {
      const logic = new GamifiedQuizLogic(makeDef(), tracker, practiceCtrl)
      logic.answerQuestion(0) // q1 correct
      logic.answerQuestion(1) // q2 correct
      logic.answerQuestion(2) // q3 correct
      expect(logic.getCurrentQuestion()).toBeNull()
    })
  })

  // -------------------------------------------------------------------------
  describe('answerQuestion — correct answer', () => {
    it('advances to next question on correct answer', () => {
      const logic = new GamifiedQuizLogic(makeDef(), tracker, practiceCtrl)
      logic.answerQuestion(0) // q1 correctIndex=0
      expect(logic.currentQuestionIndex).toBe(1)
    })

    it('returns true for a correct answer', () => {
      const logic = new GamifiedQuizLogic(makeDef(), tracker, practiceCtrl)
      const result = logic.answerQuestion(0)
      expect(result.correct).toBe(true)
    })

    it('increments combo streak on correct answer', () => {
      const logic = new GamifiedQuizLogic(makeDef(), tracker, practiceCtrl)
      logic.answerQuestion(0) // q1 correct
      expect(logic.comboStreak).toBe(1)
      logic.answerQuestion(1) // q2 correct
      expect(logic.comboStreak).toBe(2)
    })

    it('does not lose lives on correct answer', () => {
      const logic = new GamifiedQuizLogic(makeDef(), tracker, practiceCtrl)
      logic.answerQuestion(0)
      expect(logic.lives).toBe(3)
    })
  })

  // -------------------------------------------------------------------------
  describe('answerQuestion — wrong answer', () => {
    it('does NOT advance question on wrong answer (retry allowed in practice)', () => {
      const logic = new GamifiedQuizLogic(makeDef(), tracker, practiceCtrl)
      logic.answerQuestion(1) // q1 wrong (correctIndex=0)
      expect(logic.currentQuestionIndex).toBe(0)
    })

    it('returns false for a wrong answer', () => {
      const logic = new GamifiedQuizLogic(makeDef(), tracker, practiceCtrl)
      const result = logic.answerQuestion(1)
      expect(result.correct).toBe(false)
    })

    it('resets combo streak on wrong answer', () => {
      const logic = new GamifiedQuizLogic(makeDef(), tracker, practiceCtrl)
      logic.answerQuestion(0) // correct → streak 1
      logic.answerQuestion(2) // q2 wrong (correctIndex=1) → reset
      expect(logic.comboStreak).toBe(0)
    })

    it('deducts a life on wrong answer', () => {
      const logic = new GamifiedQuizLogic(makeDef(), tracker, practiceCtrl)
      logic.answerQuestion(1) // wrong
      expect(logic.lives).toBe(2)
    })

    it('completes quiz when lives reach 0', () => {
      const logic = new GamifiedQuizLogic(makeDef({ initialLives: 1 }), tracker, practiceCtrl)
      logic.answerQuestion(1) // wrong, loses last life
      expect(logic.isComplete).toBe(true)
    })

    it('advances in assessment mode on wrong answer (no retry)', () => {
      const logic = new GamifiedQuizLogic(makeDef(), tracker, assessCtrl)
      logic.answerQuestion(1) // q1 wrong
      expect(logic.currentQuestionIndex).toBe(1) // advanced despite being wrong
    })
  })

  // -------------------------------------------------------------------------
  describe('combo scoring', () => {
    it('first correct answer scores pointValue * 1 (no combo yet)', () => {
      const logic = new GamifiedQuizLogic(makeDef(), tracker, practiceCtrl)
      const result = logic.answerQuestion(0) // q1 correct, streak becomes 1 after
      // comboMultiplier=2, streak was 0 before answer → multiplier = 1
      expect(result.pointsEarned).toBe(10)
    })

    it('second consecutive correct answer doubles score (multiplier=2)', () => {
      const logic = new GamifiedQuizLogic(makeDef(), tracker, practiceCtrl)
      logic.answerQuestion(0) // q1 correct, streak→1
      const result = logic.answerQuestion(1) // q2 correct, streak was 1 → multiplier=2
      expect(result.pointsEarned).toBe(20)
    })

    it('wrong answer earns 0 points', () => {
      const logic = new GamifiedQuizLogic(makeDef(), tracker, practiceCtrl)
      const result = logic.answerQuestion(1) // wrong
      expect(result.pointsEarned).toBe(0)
    })

    it('accumulates totalScore across questions', () => {
      const logic = new GamifiedQuizLogic(makeDef(), tracker, practiceCtrl)
      logic.answerQuestion(0) // q1 +10
      logic.answerQuestion(1) // q2 +20
      expect(logic.totalScore).toBe(30)
    })
  })

  // -------------------------------------------------------------------------
  describe('demo mode', () => {
    it('does not score in demo mode', () => {
      const logic = new GamifiedQuizLogic(makeDef(), tracker, demoCtrl)
      logic.answerQuestion(0)
      expect(tracker.getStepScores()).toHaveLength(0)
    })

    it('still advances questions in demo mode', () => {
      const logic = new GamifiedQuizLogic(makeDef(), tracker, demoCtrl)
      logic.answerQuestion(0)
      expect(logic.currentQuestionIndex).toBe(1)
    })
  })

  // -------------------------------------------------------------------------
  describe('infinite lives', () => {
    it('lives stays at Infinity when initialLives=0', () => {
      const logic = new GamifiedQuizLogic(makeDef({ initialLives: 0 }), tracker, practiceCtrl)
      logic.answerQuestion(1) // wrong
      expect(logic.lives).toBe(Infinity)
      expect(logic.isComplete).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  describe('completion', () => {
    it('isComplete after all questions answered correctly', () => {
      const logic = new GamifiedQuizLogic(makeDef(), tracker, practiceCtrl)
      logic.answerQuestion(0)
      logic.answerQuestion(1)
      logic.answerQuestion(2)
      expect(logic.isComplete).toBe(true)
    })

    it('records all step scores on completion', () => {
      const logic = new GamifiedQuizLogic(makeDef(), tracker, practiceCtrl)
      logic.answerQuestion(0)
      logic.answerQuestion(1)
      logic.answerQuestion(2)
      expect(tracker.getStepScores()).toHaveLength(3)
    })
  })

  // -------------------------------------------------------------------------
  describe('timer state', () => {
    it('hasTimer is false when timerSeconds=0', () => {
      const logic = new GamifiedQuizLogic(makeDef({ timerSeconds: 0 }), tracker, practiceCtrl)
      expect(logic.hasTimer).toBe(false)
    })

    it('hasTimer is true when timerSeconds > 0', () => {
      const logic = new GamifiedQuizLogic(makeDef({ timerSeconds: 30 }), tracker, practiceCtrl)
      expect(logic.hasTimer).toBe(true)
    })

    it('onTimerExpired marks quiz as complete', () => {
      const logic = new GamifiedQuizLogic(makeDef({ timerSeconds: 30 }), tracker, practiceCtrl)
      logic.onTimerExpired()
      expect(logic.isComplete).toBe(true)
    })
  })
})
