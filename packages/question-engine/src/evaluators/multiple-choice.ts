import type { MCExtendedProps, MCRandomizationState, EvaluationResult } from '../types'

/**
 * Evaluate a multiple-choice question.
 * Returns correct=true only if selectedId matches correctId.
 */
export function evaluateMultipleChoice(
  props: MCExtendedProps,
  selectedId: string,
): EvaluationResult {
  const isCorrect = selectedId === props.correctId
  const selectedOption = props.options.find((o) => o.id === selectedId)

  return {
    correct: isCorrect,
    score: isCorrect ? 1 : 0,
    feedback:
      selectedOption?.feedback ??
      (isCorrect ? props.correctFeedback : props.incorrectFeedback),
  }
}

// ─── Fisher-Yates shuffle for option randomization ───────────────────────────

/**
 * Build a MCRandomizationState for an MC question.
 * Uses a seeded-style approach: caller provides a seed array (e.g. from Math.random).
 * Pass `rng` as an override for deterministic testing; defaults to Math.random.
 */
export function buildRandomizationState(
  props: MCExtendedProps,
  rng: () => number = Math.random,
): MCRandomizationState {
  const indices = props.options.map((_, i) => i)

  // Fisher-Yates shuffle
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = indices[i]
    indices[i] = indices[j]
    indices[j] = tmp
  }

  const correctOriginalIndex = props.options.findIndex((o) => o.id === props.correctId)
  const correctDisplayIndex = indices.indexOf(correctOriginalIndex)

  return { shuffledIndices: indices, correctDisplayIndex }
}
