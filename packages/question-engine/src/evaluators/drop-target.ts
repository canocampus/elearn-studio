import type { DropTargetExtendedProps, DropAnswer, EvaluationResult } from '../types'

/**
 * Evaluate a drop-target question.
 * Each zone defines which items are accepted. Score = fraction of items
 * that landed in a zone that accepts them.
 */
export function evaluateDropTarget(
  props: DropTargetExtendedProps,
  answer: DropAnswer,
): EvaluationResult {
  if (props.items.length === 0) {
    return { correct: false, score: 0, feedback: props.incorrectFeedback }
  }

  // Build lookup: zoneId → Set of accepted itemIds
  const zoneAccepts = new Map<string, Set<string>>()
  for (const zone of props.zones) {
    zoneAccepts.set(zone.id, new Set(zone.acceptedItemIds))
  }

  let correct = 0
  for (const item of props.items) {
    const placedZone = answer[item.id]
    if (placedZone !== undefined) {
      const accepted = zoneAccepts.get(placedZone)
      if (accepted?.has(item.id)) correct++
    }
  }

  const score = correct / props.items.length
  const isCorrect = score === 1

  return {
    correct: isCorrect,
    score,
    feedback: isCorrect ? props.correctFeedback : props.incorrectFeedback,
  }
}
