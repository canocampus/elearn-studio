/**
 * Extended-properties interfaces for question widget types.
 * Stored in BaseWidget.extendedProperties and serialised to MongoDB.
 *
 * T014.4 — MC: question text, options, mark correct, scoring
 * T014.5 — TF: question text, correct answer, scoring
 * T014.6 — Fill: question text, accepted answers, match type
 * T014.7 — All types: feedback text for correct/incorrect
 * T014.8 — All types: attempt limit (-1 = unlimited)
 */

export interface QuestionScoring {
  /** Points contributed to total quiz score (0–100). */
  weight: number
  /** Max attempts: -1 = unlimited. */
  attempts: number
  /** When true and navigationMode is linear-strict, learner cannot advance until this question is answered. */
  mandatory?: boolean
}

// ---------------------------------------------------------------------------
// Multiple Choice (question-mc)
// ---------------------------------------------------------------------------

export interface MCOption {
  id: string
  text: string
  isCorrect: boolean
}

export interface MCExtendedProps {
  questionText: string
  options: MCOption[]
  feedbackCorrect: string
  feedbackIncorrect: string
  scoring: QuestionScoring
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
  scoring: { weight: 100, attempts: -1 },
}

// ---------------------------------------------------------------------------
// True / False (question-tf)
// ---------------------------------------------------------------------------

export interface TFExtendedProps {
  questionText: string
  correctAnswer: boolean
  feedbackCorrect: string
  feedbackIncorrect: string
  scoring: QuestionScoring
}

export const TF_DEFAULT_EXTENDED: TFExtendedProps = {
  questionText: 'This statement is true.',
  correctAnswer: true,
  feedbackCorrect: 'Correct!',
  feedbackIncorrect: 'Incorrect. Try again.',
  scoring: { weight: 100, attempts: -1 },
}

// ---------------------------------------------------------------------------
// Fill in the Blank (question-fill)
// ---------------------------------------------------------------------------

export type FillMatchType = 'exact' | 'regex' | 'case-insensitive'

export interface FillExtendedProps {
  questionText: string
  /** Accepted correct answers. */
  answers: string[]
  matchType: FillMatchType
  feedbackCorrect: string
  feedbackIncorrect: string
  scoring: QuestionScoring
}

export const FILL_DEFAULT_EXTENDED: FillExtendedProps = {
  questionText: 'Complete the sentence: The capital of France is ___.',
  answers: ['Paris'],
  matchType: 'case-insensitive',
  feedbackCorrect: 'Correct!',
  feedbackIncorrect: 'Incorrect. Try again.',
  scoring: { weight: 100, attempts: -1 },
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
