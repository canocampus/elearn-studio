// Question Engine — T015 / T022
// Pure TypeScript, no external dependencies.
// Evaluates MC / TF / Fill-in-blank responses and calculates quiz scores.
// T022: Advanced question types, negative weights, delayed feedback, MC randomization.

// ─── T022 types ───────────────────────────────────────────────────────────────
export type {
  MatchPair, MatchItemsExtendedProps, MatchAnswer,
  DragObjectItem, DropZone, DragObjectsExtendedProps, DragAnswer,
  DropTargetZone, DropTargetExtendedProps, DropAnswer,
  ArrangeItem, ArrangeObjectsExtendedProps, ArrangeAnswer,
  OrderTextExtendedProps, OrderAnswer,
  HotspotShape, HotspotRegion, HotspotExtendedProps, HotspotAnswer,
  MCOption, MCRandomizationState,
  DeferredFeedback, FeedbackQueue,
} from './types'

// ─── T022 evaluators ─────────────────────────────────────────────────────────
export { evaluateMatchItems }    from './evaluators/match-items'
export { evaluateDragObjects }   from './evaluators/drag-objects'
export { evaluateDropTarget }    from './evaluators/drop-target'
export { evaluateArrangeObjects } from './evaluators/arrange-objects'
export { evaluateOrderText }     from './evaluators/order-text'
export {
  evaluateHotspot,
  pointInRect, pointInCircle, pointInPolygon, pointInShape,
} from './evaluators/hotspot'
export { buildRandomizationState } from './evaluators/multiple-choice'

// ─── T022 scoring / feedback ──────────────────────────────────────────────────
export type { QuizAggregatorInput } from './scoring/quiz-aggregator'
export { aggregateQuizScore }    from './scoring/quiz-aggregator'
export {
  createFeedbackQueue, enqueueFeedback, flushFeedback, feedbackForQuestion,
} from './feedback/delayed-feedback'

// ─── Types ───────────────────────────────────────────────────────────────────

export type FillMatchType = 'exact' | 'regex' | 'case-insensitive'

export interface QuestionScoring {
  weight: number   // 0-100 relative weight for this question in the quiz
  attempts: number // -1 = unlimited
}

export interface MCExtendedProps {
  questionText: string
  options: string[]
  correctIndex: number
  scoring: QuestionScoring
}

export interface TFExtendedProps {
  questionText: string
  correctAnswer: boolean
  scoring: QuestionScoring
}

export interface FillExtendedProps {
  questionText: string
  correctAnswer: string
  matchType: FillMatchType
  scoring: QuestionScoring
}

export interface EvaluationResult {
  correct: boolean
  /** Normalised 0-1 score for this question (1 = fully correct) */
  score: number
  feedback?: string
}

export interface QuizScoreResult {
  /** Raw weighted score 0-100 */
  score: number
  /** How many questions were answered correctly */
  correctCount: number
  totalCount: number
  passed: boolean
}

// ─── Evaluators ──────────────────────────────────────────────────────────────

/**
 * Evaluate a multiple-choice answer.
 * @param props  Question definition
 * @param chosen Index of the option the learner selected (-1 = no answer)
 */
export function evaluateMultipleChoice(
  props: MCExtendedProps,
  chosen: number,
): EvaluationResult {
  if (chosen < 0 || chosen >= props.options.length) {
    return { correct: false, score: 0, feedback: 'No answer selected.' }
  }
  const correct = chosen === props.correctIndex
  return {
    correct,
    score: correct ? 1 : 0,
    feedback: correct ? 'Correct!' : `Incorrect. The correct answer was: ${props.options[props.correctIndex]}`,
  }
}

/**
 * Evaluate a true/false answer.
 * @param props   Question definition
 * @param answer  The learner's boolean answer (null = no answer)
 */
export function evaluateTrueFalse(
  props: TFExtendedProps,
  answer: boolean | null,
): EvaluationResult {
  if (answer === null) {
    return { correct: false, score: 0, feedback: 'No answer selected.' }
  }
  const correct = answer === props.correctAnswer
  return {
    correct,
    score: correct ? 1 : 0,
    feedback: correct ? 'Correct!' : `Incorrect. The correct answer was: ${props.correctAnswer ? 'True' : 'False'}`,
  }
}

/**
 * Returns true when a regex pattern contains nested quantifiers that can cause
 * catastrophic backtracking (ReDoS), e.g. `(a+)+`, `(.+)+`, `(a|aa)+`.
 * These are characterised by a quantified sub-expression inside a group that
 * is itself followed by a quantifier.
 */
function hasNestedQuantifiers(pattern: string): boolean {
  // Matches: group containing a quantifier (+, *, or {n,m}) followed by an
  // outer quantifier on the group itself.
  return /\([^()]*[+*{][^()]*\)[+*{?]/.test(pattern)
}

/**
 * Evaluate a fill-in-the-blank answer.
 * @param props   Question definition (includes matchType)
 * @param answer  The learner's typed answer
 */
export function evaluateFillInBlank(
  props: FillExtendedProps,
  answer: string,
): EvaluationResult {
  const trimmed = answer.trim()
  if (!trimmed) {
    return { correct: false, score: 0, feedback: 'No answer provided.' }
  }

  let correct = false
  switch (props.matchType) {
    case 'exact':
      correct = trimmed === props.correctAnswer
      break
    case 'case-insensitive':
      correct = trimmed.toLowerCase() === props.correctAnswer.toLowerCase()
      break
    case 'regex': {
      try {
        if (props.correctAnswer.length > 500 || hasNestedQuantifiers(props.correctAnswer)) {
          // Reject patterns that are too long or contain nested quantifiers.
          // Nested quantifiers (e.g. (a+)+) cause catastrophic backtracking (ReDoS).
          correct = trimmed === props.correctAnswer
        } else {
          const re = new RegExp(props.correctAnswer)
          correct = re.test(trimmed)
        }
      } catch {
        // Malformed regex — treat as exact match fallback
        correct = trimmed === props.correctAnswer
      }
      break
    }
  }

  return {
    correct,
    score: correct ? 1 : 0,
    feedback: correct ? 'Correct!' : `Incorrect. The expected answer was: ${props.correctAnswer}`,
  }
}

// ─── Quiz Aggregator ─────────────────────────────────────────────────────────

export interface QuestionResult {
  score: number   // 0-1 per question
  weight: number  // from QuestionScoring.weight
}

/**
 * Calculate an overall quiz score from individual question results.
 * Uses weighted average: sum(score_i * weight_i) / sum(weight_i) * 100
 *
 * @param results    Per-question evaluation results paired with their weights
 * @param passMark   Minimum score (0-100) required to pass (default 80)
 */
export function calculateQuizScore(
  results: QuestionResult[],
  passMark = 80,
): QuizScoreResult {
  if (results.length === 0) {
    return { score: 0, correctCount: 0, totalCount: 0, passed: false }
  }

  const totalWeight = results.reduce((sum, r) => sum + r.weight, 0)
  const weightedSum = results.reduce((sum, r) => sum + r.score * r.weight, 0)

  const score = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) : 0
  const correctCount = results.filter(r => r.score === 1).length

  return {
    score,
    correctCount,
    totalCount: results.length,
    passed: score >= passMark,
  }
}
