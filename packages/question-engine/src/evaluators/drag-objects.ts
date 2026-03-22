import type { DragObjectsExtendedProps, DragAnswer, EvaluationResult } from '../types'

/**
 * Evaluate a drag-objects question.
 * Score = fraction of items placed in correct zones (0.0–1.0).
 */
export function evaluateDragObjects(
  props: DragObjectsExtendedProps,
  answer: DragAnswer,
): EvaluationResult {
  if (props.items.length === 0) {
    return { correct: false, score: 0, feedback: props.incorrectFeedback }
  }

  let correct = 0
  for (const item of props.items) {
    if (answer[item.id] === item.correctZoneId) correct++
  }

  const score = correct / props.items.length
  const isCorrect = score === 1

  return {
    correct: isCorrect,
    score,
    feedback: isCorrect ? props.correctFeedback : props.incorrectFeedback,
  }
}
