import { describe, it, expect } from 'vitest'
import {
  evaluateMultipleChoice,
  evaluateTrueFalse,
  evaluateFillInBlank,
  calculateQuizScore,
} from './index'

// ─── evaluateMultipleChoice ────────────────────────────────────────────────

describe('evaluateMultipleChoice', () => {
  const props = {
    questionText: 'What is 2+2?',
    options: ['3', '4', '5'],
    correctIndex: 1,
    scoring: { weight: 100, attempts: -1 },
  }

  it('returns correct=true when chosen matches correctIndex', () => {
    const r = evaluateMultipleChoice(props, 1)
    expect(r.correct).toBe(true)
    expect(r.score).toBe(1)
  })

  it('returns correct=false for wrong answer', () => {
    const r = evaluateMultipleChoice(props, 0)
    expect(r.correct).toBe(false)
    expect(r.score).toBe(0)
    expect(r.feedback).toContain('4') // shows correct answer
  })

  it('returns correct=false for no answer (-1)', () => {
    const r = evaluateMultipleChoice(props, -1)
    expect(r.correct).toBe(false)
    expect(r.score).toBe(0)
  })

  it('returns correct=false for out-of-range index', () => {
    const r = evaluateMultipleChoice(props, 99)
    expect(r.correct).toBe(false)
  })
})

// ─── evaluateTrueFalse ────────────────────────────────────────────────────

describe('evaluateTrueFalse', () => {
  const props = {
    questionText: 'The sky is blue.',
    correctAnswer: true,
    scoring: { weight: 50, attempts: 1 },
  }

  it('returns correct=true when answer matches', () => {
    const r = evaluateTrueFalse(props, true)
    expect(r.correct).toBe(true)
    expect(r.score).toBe(1)
  })

  it('returns correct=false when answer is wrong', () => {
    const r = evaluateTrueFalse(props, false)
    expect(r.correct).toBe(false)
    expect(r.feedback).toContain('True')
  })

  it('returns correct=false for null (no answer)', () => {
    const r = evaluateTrueFalse(props, null)
    expect(r.correct).toBe(false)
    expect(r.score).toBe(0)
  })
})

// ─── evaluateFillInBlank ──────────────────────────────────────────────────

describe('evaluateFillInBlank', () => {
  it('exact match — correct', () => {
    const r = evaluateFillInBlank(
      { questionText: 'Q', correctAnswer: 'Paris', matchType: 'exact', scoring: { weight: 100, attempts: -1 } },
      'Paris',
    )
    expect(r.correct).toBe(true)
  })

  it('exact match — wrong case fails', () => {
    const r = evaluateFillInBlank(
      { questionText: 'Q', correctAnswer: 'Paris', matchType: 'exact', scoring: { weight: 100, attempts: -1 } },
      'paris',
    )
    expect(r.correct).toBe(false)
  })

  it('case-insensitive — ignores case', () => {
    const r = evaluateFillInBlank(
      { questionText: 'Q', correctAnswer: 'Paris', matchType: 'case-insensitive', scoring: { weight: 100, attempts: -1 } },
      'PARIS',
    )
    expect(r.correct).toBe(true)
  })

  it('regex match — matches pattern', () => {
    const r = evaluateFillInBlank(
      { questionText: 'Q', correctAnswer: '^[Pp]aris$', matchType: 'regex', scoring: { weight: 100, attempts: -1 } },
      'paris',
    )
    expect(r.correct).toBe(true)
  })

  it('regex match — fails non-matching', () => {
    const r = evaluateFillInBlank(
      { questionText: 'Q', correctAnswer: '^Paris$', matchType: 'regex', scoring: { weight: 100, attempts: -1 } },
      'Lyon',
    )
    expect(r.correct).toBe(false)
  })

  it('returns correct=false for empty answer', () => {
    const r = evaluateFillInBlank(
      { questionText: 'Q', correctAnswer: 'Paris', matchType: 'exact', scoring: { weight: 100, attempts: -1 } },
      '   ',
    )
    expect(r.correct).toBe(false)
    expect(r.score).toBe(0)
  })

  it('trims whitespace before matching', () => {
    const r = evaluateFillInBlank(
      { questionText: 'Q', correctAnswer: 'Paris', matchType: 'exact', scoring: { weight: 100, attempts: -1 } },
      '  Paris  ',
    )
    expect(r.correct).toBe(true)
  })

  // T015-02: regex guard edge cases
  it('regex: pattern > 500 chars falls back to exact match', () => {
    const longPattern = 'a'.repeat(501)
    const r = evaluateFillInBlank(
      { questionText: 'Q', correctAnswer: longPattern, matchType: 'regex', scoring: { weight: 100, attempts: -1 } },
      longPattern,
    )
    expect(r.correct).toBe(true)
    // and a non-matching input should be false
    const r2 = evaluateFillInBlank(
      { questionText: 'Q', correctAnswer: longPattern, matchType: 'regex', scoring: { weight: 100, attempts: -1 } },
      'something else',
    )
    expect(r2.correct).toBe(false)
  })

  it('regex: malformed pattern falls back to exact match', () => {
    const badPattern = '(unclosed'
    const r = evaluateFillInBlank(
      { questionText: 'Q', correctAnswer: badPattern, matchType: 'regex', scoring: { weight: 100, attempts: -1 } },
      badPattern,
    )
    expect(r.correct).toBe(true)
    const r2 = evaluateFillInBlank(
      { questionText: 'Q', correctAnswer: badPattern, matchType: 'regex', scoring: { weight: 100, attempts: -1 } },
      'other',
    )
    expect(r2.correct).toBe(false)
  })

  it('regex: catastrophic backtracking pattern is blocked and completes instantly', () => {
    // (a+)+$ causes exponential backtracking without the nested-quantifier guard
    const catastrophic = '(a+)+$'
    const evil = 'a'.repeat(30) + 'X'
    const start = Date.now()
    const r = evaluateFillInBlank(
      { questionText: 'Q', correctAnswer: catastrophic, matchType: 'regex', scoring: { weight: 100, attempts: -1 } },
      evil,
    )
    expect(Date.now() - start).toBeLessThan(100) // must complete in <100ms
    expect(r.correct).toBe(false)
  })

  it('regex: safe patterns like ^[Pp]aris$ are not blocked by the nested-quantifier guard', () => {
    const r = evaluateFillInBlank(
      { questionText: 'Q', correctAnswer: '^[Pp]aris$', matchType: 'regex', scoring: { weight: 100, attempts: -1 } },
      'paris',
    )
    expect(r.correct).toBe(true)
  })
})

// ─── calculateQuizScore ───────────────────────────────────────────────────

describe('calculateQuizScore', () => {
  it('returns 0 for empty results', () => {
    const r = calculateQuizScore([])
    expect(r.score).toBe(0)
    expect(r.passed).toBe(false)
  })

  it('100% when all correct with equal weights', () => {
    const r = calculateQuizScore([
      { score: 1, weight: 100 },
      { score: 1, weight: 100 },
    ])
    expect(r.score).toBe(100)
    expect(r.correctCount).toBe(2)
    expect(r.passed).toBe(true)
  })

  it('0% when all wrong', () => {
    const r = calculateQuizScore([
      { score: 0, weight: 100 },
      { score: 0, weight: 100 },
    ])
    expect(r.score).toBe(0)
    expect(r.passed).toBe(false)
  })

  it('50% for 1 correct out of 2 equal-weighted', () => {
    const r = calculateQuizScore([
      { score: 1, weight: 100 },
      { score: 0, weight: 100 },
    ])
    expect(r.score).toBe(50)
    expect(r.passed).toBe(false) // default passMark=80
  })

  it('weighted: heavy question counts more', () => {
    // 1 question weight=200 correct, 1 weight=100 wrong → 200/300 = 67%
    const r = calculateQuizScore([
      { score: 1, weight: 200 },
      { score: 0, weight: 100 },
    ])
    expect(r.score).toBe(67)
  })

  it('respects custom passMark', () => {
    const r = calculateQuizScore([{ score: 1, weight: 100 }, { score: 0, weight: 100 }], 50)
    expect(r.score).toBe(50)
    expect(r.passed).toBe(true)
  })
})
