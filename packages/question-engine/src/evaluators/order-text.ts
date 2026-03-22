import type { OrderTextExtendedProps, OrderAnswer, EvaluationResult } from '../types'

/**
 * Evaluate an order-text question.
 * Score = fraction of segments in correct position (0.0–1.0).
 */
export function evaluateOrderText(
  props: OrderTextExtendedProps,
  answer: OrderAnswer,
): EvaluationResult {
  const expected = props.correctOrder
  if (expected.length === 0) {
    return { correct: false, score: 0, feedback: props.incorrectFeedback }
  }

  let correct = 0
  for (let i = 0; i < expected.length; i++) {
    if (answer[i] === expected[i]) correct++
  }

  const score = correct / expected.length
  const isCorrect = score === 1

  return {
    correct: isCorrect,
    score,
    feedback: isCorrect ? props.correctFeedback : props.incorrectFeedback,
  }
}
