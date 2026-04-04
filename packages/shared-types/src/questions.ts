/**
 * Question widget types — shared across authoring-ui, runtime-player,
 * scorm-packager, and question-engine.
 *
 * Authoritative schema: authoring-ui (see decisions/2026-04-04-scorm-question-schema.md).
 * Single source of truth for D-01.
 */

// ---------------------------------------------------------------------------
// SCORM interaction type mapping
// ---------------------------------------------------------------------------

/**
 * SCORM 2004 CMI interaction types.
 * Custom widgets use 'other'; SCORM 1.2 falls back to 'true-false'.
 */
export type ScormInteractionType =
  | 'true-false'
  | 'choice'
  | 'fill-in'
  | 'long-fill-in'
  | 'matching'
  | 'sequencing'
  | 'likert'
  | 'numeric'
  | 'performance'
  | 'other'

// ---------------------------------------------------------------------------
// Shared scoring config
// ---------------------------------------------------------------------------

export interface QuestionScoring {
  /** Points contributed to total quiz score (0–100). */
  weight: number
  /** Max attempts: -1 = unlimited. */
  attempts: number
  /** When true and navigationMode is linear-strict, learner cannot advance until answered. */
  mandatory?: boolean
}

// ---------------------------------------------------------------------------
// Base question props (common to all question types)
// ---------------------------------------------------------------------------

export interface BaseQuestionExtendedProps {
  questionText: string
  feedbackCorrect: string
  feedbackIncorrect: string
  scoring: QuestionScoring
  /**
   * How this question is reported to the LMS via SCORM CMI interactions.
   * Decouples widget identity from SCORM reporting type.
   * Custom widgets (word search, etc.) use 'other' for SCORM 2004;
   * SCORM 1.2 packager falls back to 'true-false'.
   */
  scormInteractionType: ScormInteractionType
  /**
   * Override for SCORM correct_responses pattern.
   * When omitted, the packager derives the pattern from the widget's answer data.
   * Useful for custom widgets that need non-standard response patterns.
   */
  scormCorrectResponsePattern?: string
}

// ---------------------------------------------------------------------------
// Multiple Choice (question-mc)
// ---------------------------------------------------------------------------

export interface MCOption {
  id: string
  text: string
  isCorrect: boolean
}

export interface MCExtendedProps extends BaseQuestionExtendedProps {
  options: MCOption[]
}

export const MC_DEFAULT_EXTENDED: MCExtendedProps = {
  questionText: 'What is the correct answer?',
  options: [
    { id: '1', text: 'Option A', isCorrect: true },
    { id: '2', text: 'Option B', isCorrect: false },
    { id: '3', text: 'Option C', isCorrect: false },
  ],
  feedbackCorrect: 'Correct!',
  feedbackIncorrect: 'Incorrect. Try again.',
  scoring: { weight: 100, attempts: -1, mandatory: false },
  scormInteractionType: 'choice',
}

// ---------------------------------------------------------------------------
// True / False (question-tf)
// ---------------------------------------------------------------------------

export interface TFExtendedProps extends BaseQuestionExtendedProps {
  correctAnswer: boolean
}

export const TF_DEFAULT_EXTENDED: TFExtendedProps = {
  questionText: 'This statement is true.',
  correctAnswer: true,
  feedbackCorrect: 'Correct!',
  feedbackIncorrect: 'Incorrect. Try again.',
  scoring: { weight: 100, attempts: -1, mandatory: false },
  scormInteractionType: 'true-false',
}

// ---------------------------------------------------------------------------
// Fill in the Blank (question-fill)
// ---------------------------------------------------------------------------

export type FillMatchType = 'exact' | 'regex' | 'case-insensitive'

export interface FillExtendedProps extends BaseQuestionExtendedProps {
  /** Accepted correct answers. */
  answers: string[]
  matchType: FillMatchType
}

export const FILL_DEFAULT_EXTENDED: FillExtendedProps = {
  questionText: 'Complete the sentence: The capital of France is ___.',
  answers: ['Paris'],
  matchType: 'case-insensitive',
  feedbackCorrect: 'Correct!',
  feedbackIncorrect: 'Incorrect. Try again.',
  scoring: { weight: 100, attempts: -1, mandatory: false },
  scormInteractionType: 'fill-in',
}

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

export const QUESTION_WIDGET_TYPES = ['question-mc', 'question-tf', 'question-fill'] as const
export type QuestionWidgetType = (typeof QUESTION_WIDGET_TYPES)[number]

/** Returns true when `type` is one of the three question widget type identifiers. */
export function isQuestionWidgetType(type: string): type is QuestionWidgetType {
  return (QUESTION_WIDGET_TYPES as readonly string[]).includes(type)
}
