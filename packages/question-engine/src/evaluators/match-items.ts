import type { MatchItemsExtendedProps, MatchAnswer, EvaluationResult } from '../types'

/**
 * Evaluate a match-items question.
 * Score = fraction of pairs correctly matched (0.0–1.0).
 */
export function evaluateMatchItems(
  props: MatchItemsExtendedProps,
  answer: MatchAnswer,
): EvaluationResult {
  if (props.pairs.length === 0) {
    return { correct: false, score: 0, feedback: props.incorrectFeedback }
  }

  let correct = 0
  for (const pair of props.pairs) {
    if (answer[pair.id] === pair.right) correct++
  }

  const score = correct / props.pairs.length
  const isCorrect = score === 1

  return {
    correct: isCorrect,
    score,
    feedback: isCorrect ? props.correctFeedback : props.incorrectFeedback,
  }
}
