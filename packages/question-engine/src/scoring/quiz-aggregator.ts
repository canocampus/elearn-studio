/**
 * Quiz score aggregator — T022
 *
 * Supports:
 * - Per-question weights (0-100)
 * - Negative weights (deduct on wrong answer)
 * - Passing mark
 * - Remediation slide lookup
 */

import type { QuestionResult, QuizScoreResult } from '../types'

export interface QuizAggregatorInput {
  results: Array<{
    questionId: string
    correct: boolean
    /** Raw 0.0–1.0 score from evaluator */
    score: number
    weight: number
    /** Optional negative weight (negative number, e.g. -25) */
    negativeWeight?: number
  }>
  passMark: number
}

/**
 * Compute weighted quiz total.
 *
 * Contribution formula per question:
 *   if weight < 0 (negative):   weight < 0 → contribution = score > 0 ? 0 : weight
 *   else:                        contribution = score * weight
 *
 * Denominator = sum of positive weights only (negative weights reduce the score
 * but don't affect the denominator — they are penalties on top of the base score).
 *
 * Final score clamped to [0, 100].
 */
export function aggregateQuizScore(input: QuizAggregatorInput): QuizScoreResult {
  const questionResults: QuestionResult[] = []
  let positiveWeightTotal = 0
  let weightedSum = 0

  for (const r of input.results) {
    // Partial / full credit: score > 0 → proportional contribution
    // No credit (score === 0) + negativeWeight defined → penalty
    let contribution: number
    if (r.score > 0) {
      contribution = r.weight * r.score
    } else {
      contribution = r.negativeWeight !== undefined ? r.negativeWeight : 0
    }

    if (r.weight > 0) positiveWeightTotal += r.weight
    weightedSum += contribution

    questionResults.push({
      questionId: r.questionId,
      correct: r.correct,
      score: r.score,
      weightedScore: contribution,
    })
  }

  // Avoid division by zero
  const rawScore = positiveWeightTotal > 0
    ? (weightedSum / positiveWeightTotal) * 100
    : 0

  const totalScore = Math.max(0, Math.min(100, rawScore))
  const correctCount = questionResults.filter((r) => r.correct).length

  return {
    totalScore,
    correctCount,
    totalCount: questionResults.length,
    results: questionResults,
    passed: totalScore >= input.passMark,
  }
}
