/**
 * question-engine — shared types — T022
 */

// ─── Shared scoring/feedback ──────────────────────────────────────────────────

export interface QuestionScoring {
  /** 0-100 point weight for this question in the quiz total */
  weight: number
  /** Negative weight: deduct points on wrong answer (use negative number, e.g. -25) */
  negativeWeight?: number
  /** Max attempts allowed (-1 = unlimited) */
  attempts: number
  /** Delay feedback until quiz is submitted (ms, or -1 = hold until flush) */
  feedbackDelay?: number
}

export interface EvaluationResult {
  correct: boolean
  /** 0.0–1.0 partial credit score */
  score: number
  feedback?: string
}

export interface QuestionResult {
  questionId: string
  correct: boolean
  score: number
  /** Contribution to quiz total after applying weight */
  weightedScore: number
}

export interface QuizScoreResult {
  /** 0-100 final score */
  totalScore: number
  /** Number of correct questions */
  correctCount: number
  totalCount: number
  results: QuestionResult[]
  passed: boolean
}

// ─── Multiple choice (extended) ───────────────────────────────────────────────

export interface MCOption {
  id: string
  text: string
  feedback?: string
}

export interface MCExtendedProps {
  questionText: string
  options: MCOption[]
  correctId: string
  allowRandomize?: boolean
  scoring: QuestionScoring
  correctFeedback?: string
  incorrectFeedback?: string
}

export interface MCRandomizationState {
  /** Shuffled option indices (index into original options array) */
  shuffledIndices: number[]
  /** Index in shuffledIndices that maps to the correct option */
  correctDisplayIndex: number
}

// ─── True/False ───────────────────────────────────────────────────────────────

export interface TFExtendedProps {
  questionText: string
  correctAnswer: boolean
  scoring: QuestionScoring
  correctFeedback?: string
  incorrectFeedback?: string
}

// ─── Fill-in-the-blank ────────────────────────────────────────────────────────

export interface FillExtendedProps {
  questionText: string
  correctAnswers: string[]
  caseSensitive: boolean
  scoring: QuestionScoring
  correctFeedback?: string
  incorrectFeedback?: string
}

// ─── Match items ──────────────────────────────────────────────────────────────

export interface MatchPair {
  id: string
  left: string
  right: string
}

export interface MatchItemsExtendedProps {
  questionText: string
  pairs: MatchPair[]
  /** If true, right-side items are shuffled for the learner */
  shuffleRight?: boolean
  scoring: QuestionScoring
  correctFeedback?: string
  incorrectFeedback?: string
}

/** Answer: map of leftId → rightId */
export type MatchAnswer = Record<string, string>

// ─── Drag objects ─────────────────────────────────────────────────────────────

export interface DragObjectItem {
  id: string
  label: string
  correctZoneId: string
}

export interface DropZone {
  id: string
  label: string
}

export interface DragObjectsExtendedProps {
  questionText: string
  items: DragObjectItem[]
  zones: DropZone[]
  /** Allow multiple items per zone */
  allowMultiple?: boolean
  scoring: QuestionScoring
  correctFeedback?: string
  incorrectFeedback?: string
}

/** Answer: map of itemId → zoneId */
export type DragAnswer = Record<string, string>

// ─── Drop target ──────────────────────────────────────────────────────────────

export interface DropTargetZone {
  id: string
  label: string
  acceptedItemIds: string[]
}

export interface DropTargetExtendedProps {
  questionText: string
  items: DragObjectItem[]
  zones: DropTargetZone[]
  scoring: QuestionScoring
  correctFeedback?: string
  incorrectFeedback?: string
}

/** Same shape as DragAnswer */
export type DropAnswer = Record<string, string>

// ─── Arrange objects ──────────────────────────────────────────────────────────

export interface ArrangeItem {
  id: string
  label: string
}

export interface ArrangeObjectsExtendedProps {
  questionText: string
  items: ArrangeItem[]
  /** Correct order: array of item ids */
  correctOrder: string[]
  scoring: QuestionScoring
  correctFeedback?: string
  incorrectFeedback?: string
}

/** Answer: array of item ids in learner-chosen order */
export type ArrangeAnswer = string[]

// ─── Order text ───────────────────────────────────────────────────────────────

export interface OrderTextExtendedProps {
  questionText: string
  /** Each sentence/segment to be ordered */
  segments: Array<{ id: string; text: string }>
  correctOrder: string[]
  scoring: QuestionScoring
  correctFeedback?: string
  incorrectFeedback?: string
}

/** Answer: array of segment ids in learner-chosen order */
export type OrderAnswer = string[]

// ─── Hotspot ──────────────────────────────────────────────────────────────────

/** rect: [x1, y1, x2, y2] | circle: [cx, cy, r] | polygon: [x1,y1, x2,y2, ...] */
export type HotspotShape =
  | { type: 'rect';    coords: [number, number, number, number] }
  | { type: 'circle';  coords: [number, number, number] }
  | { type: 'polygon'; coords: number[] }

export interface HotspotRegion {
  id: string
  shape: HotspotShape
  /** If true, clicking here is correct */
  isCorrect: boolean
  feedback?: string
}

export interface HotspotExtendedProps {
  questionText: string
  imageUrl: string
  regions: HotspotRegion[]
  /** Allow clicking multiple regions before submitting */
  multiSelect?: boolean
  scoring: QuestionScoring
  correctFeedback?: string
  incorrectFeedback?: string
}

/** Answer: array of clicked region ids */
export type HotspotAnswer = string[]

// ─── Deferred / delayed feedback ─────────────────────────────────────────────

export interface DeferredFeedback {
  questionId: string
  message: string
  correct: boolean
  /** Timestamp when feedback was queued */
  queuedAt: number
}

export interface FeedbackQueue {
  items: DeferredFeedback[]
}
