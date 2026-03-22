import { describe, it, expect } from 'vitest'
import { aggregateQuizScore } from '../scoring/quiz-aggregator'

describe('aggregateQuizScore', () => {
  it('returns 100 for all correct with equal weights', () => {
    const r = aggregateQuizScore({
      results: [
        { questionId: 'q1', correct: true,  score: 1, weight: 50 },
        { questionId: 'q2', correct: true,  score: 1, weight: 50 },
      ],
      passMark: 80,
    })
    expect(r.totalScore).toBeCloseTo(100)
    expect(r.passed).toBe(true)
    expect(r.correctCount).toBe(2)
  })

  it('returns 0 for all wrong with no negativeWeight', () => {
    const r = aggregateQuizScore({
      results: [
        { questionId: 'q1', correct: false, score: 0, weight: 50 },
        { questionId: 'q2', correct: false, score: 0, weight: 50 },
      ],
      passMark: 80,
    })
    expect(r.totalScore).toBe(0)
    expect(r.passed).toBe(false)
  })

  it('applies negative weight as penalty for wrong answer', () => {
    // q1 correct weight=100 → +100; q2 wrong negativeWeight=-25 → -25
    // weightedSum = 75; denominator = 100+100 = 200 → 75/200*100 = 37.5
    const r = aggregateQuizScore({
      results: [
        { questionId: 'q1', correct: true,  score: 1, weight: 100 },
        { questionId: 'q2', correct: false, score: 0, weight: 100, negativeWeight: -25 },
      ],
      passMark: 80,
    })
    expect(r.totalScore).toBeCloseTo(37.5)
    expect(r.passed).toBe(false)
  })

  it('clamps score to 0 when penalties exceed correct answers', () => {
    const r = aggregateQuizScore({
      results: [
        { questionId: 'q1', correct: false, score: 0, weight: 50, negativeWeight: -200 },
      ],
      passMark: 80,
    })
    expect(r.totalScore).toBe(0)
  })

  it('supports partial credit (score between 0 and 1)', () => {
    // score=0.5, weight=100 → contribution=50; denominator=100 → 50%
    const r = aggregateQuizScore({
      results: [
        { questionId: 'q1', correct: false, score: 0.5, weight: 100 },
      ],
      passMark: 80,
    })
    expect(r.totalScore).toBeCloseTo(50)
  })

  it('handles empty results', () => {
    const r = aggregateQuizScore({ results: [], passMark: 80 })
    expect(r.totalScore).toBe(0)
    expect(r.totalCount).toBe(0)
    expect(r.passed).toBe(false)
  })

  it('weighted average with unequal weights', () => {
    // q1: weight=25, score=1 → 25; q2: weight=75, score=0 → 0
    // total = 25/100 = 25
    const r = aggregateQuizScore({
      results: [
        { questionId: 'q1', correct: true,  score: 1, weight: 25 },
        { questionId: 'q2', correct: false, score: 0, weight: 75 },
      ],
      passMark: 80,
    })
    expect(r.totalScore).toBeCloseTo(25)
    expect(r.passed).toBe(false)
  })

  it('passes when score equals passMark exactly', () => {
    const r = aggregateQuizScore({
      results: [
        { questionId: 'q1', correct: true,  score: 1, weight: 80 },
        { questionId: 'q2', correct: false, score: 0, weight: 20 },
      ],
      passMark: 80,
    })
    expect(r.totalScore).toBeCloseTo(80)
    expect(r.passed).toBe(true)
  })
})
