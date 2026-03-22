import type { HotspotExtendedProps, HotspotAnswer, HotspotShape, EvaluationResult } from '../types'

// ─── Geometry helpers ─────────────────────────────────────────────────────────

export function pointInRect(
  px: number, py: number,
  x1: number, y1: number, x2: number, y2: number,
): boolean {
  return px >= Math.min(x1, x2) && px <= Math.max(x1, x2)
      && py >= Math.min(y1, y2) && py <= Math.max(y1, y2)
}

export function pointInCircle(
  px: number, py: number,
  cx: number, cy: number, r: number,
): boolean {
  const dx = px - cx
  const dy = py - cy
  return dx * dx + dy * dy <= r * r
}

/**
 * Ray-casting algorithm — works for convex and concave polygons.
 * coords: [x1,y1, x2,y2, ...] (flat array, at least 3 pairs)
 */
export function pointInPolygon(px: number, py: number, coords: number[]): boolean {
  const n = Math.floor(coords.length / 2)
  if (n < 3) return false

  let inside = false
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = coords[i * 2]
    const yi = coords[i * 2 + 1]
    const xj = coords[j * 2]
    const yj = coords[j * 2 + 1]

    const intersects =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi) + xi

    if (intersects) inside = !inside
  }
  return inside
}

export function pointInShape(px: number, py: number, shape: HotspotShape): boolean {
  switch (shape.type) {
    case 'rect':
      return pointInRect(px, py, shape.coords[0], shape.coords[1], shape.coords[2], shape.coords[3])
    case 'circle':
      return pointInCircle(px, py, shape.coords[0], shape.coords[1], shape.coords[2])
    case 'polygon':
      return pointInPolygon(px, py, shape.coords)
  }
}

// ─── Evaluator ────────────────────────────────────────────────────────────────

/**
 * Evaluate a hotspot question.
 *
 * Single-select: score 1 if the one clicked region is correct, else 0.
 * Multi-select: score = (correct clicks − wrong clicks) / total correct regions,
 * clamped to [0, 1].
 */
export function evaluateHotspot(
  props: HotspotExtendedProps,
  answer: HotspotAnswer,
): EvaluationResult {
  const correctRegions = props.regions.filter((r) => r.isCorrect)

  if (!props.multiSelect) {
    // Single-select: only first click counts
    const clicked = answer[0]
    if (!clicked) {
      return { correct: false, score: 0, feedback: props.incorrectFeedback }
    }
    const region = props.regions.find((r) => r.id === clicked)
    const isCorrect = region?.isCorrect ?? false
    return {
      correct: isCorrect,
      score: isCorrect ? 1 : 0,
      feedback: region?.feedback ?? (isCorrect ? props.correctFeedback : props.incorrectFeedback),
    }
  }

  // Multi-select
  if (correctRegions.length === 0) {
    return { correct: false, score: 0, feedback: props.incorrectFeedback }
  }

  const answerSet = new Set(answer)
  let correctClicks = 0
  let wrongClicks = 0

  for (const id of answerSet) {
    const region = props.regions.find((r) => r.id === id)
    if (region?.isCorrect) {
      correctClicks++
    } else {
      wrongClicks++
    }
  }

  const rawScore = (correctClicks - wrongClicks) / correctRegions.length
  const score = Math.max(0, Math.min(1, rawScore))
  const isCorrect = score === 1

  return {
    correct: isCorrect,
    score,
    feedback: isCorrect ? props.correctFeedback : props.incorrectFeedback,
  }
}
