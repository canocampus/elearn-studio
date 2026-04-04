/**
 * Action type definitions — re-exported from @elearn-studio/shared-types.
 * Authoring-specific metadata (ActionMeta, ACTION_PALETTE) kept here.
 *
 * T020/T021 — see decisions/2026-04-04-scorm-question-schema.md
 */

export type {
  NavigateTarget,
  NavigateAction,
  ShowAction,
  HideAction,
  BringToFrontAction,
  VariableValueType,
  SetVariableAction,
  DisplayMessageAction,
  PlayMediaAction,
  StopMediaAction,
  ScoreQuestionAction,
  ScoreQuizAction,
  SendToLMSAction,
  SuspendLessonAction,
  ConditionAction,
  LoopAction,
  PlayAnimationAction,
  CallSequenceAction,
  Action,
  ActionType,
  ActionSequence,
  SharedActionSequence,
  WidgetEvent,
  SlideEvent,
} from '@elearn-studio/shared-types'

export { WIDGET_EVENTS, SLIDE_EVENTS } from '@elearn-studio/shared-types'

// ─── Action metadata (authoring-UI-specific — palette only) ──────────────────

import type { ActionType } from '@elearn-studio/shared-types'

export interface ActionMeta {
  type: ActionType
  label: string
  category: 'Navigation' | 'Object' | 'Media' | 'Scoring' | 'Variables' | 'Flow' | 'Macros'
  description: string
}

export const ACTION_PALETTE: ActionMeta[] = [
  // Navigation
  { type: 'navigate',        label: 'Navigate',        category: 'Navigation', description: 'Go to a slide' },
  // Object
  { type: 'show',            label: 'Show',            category: 'Object',     description: 'Make a widget visible' },
  { type: 'hide',            label: 'Hide',            category: 'Object',     description: 'Hide a widget' },
  { type: 'bring-to-front',  label: 'Bring to Front',  category: 'Object',     description: 'Move widget above all others (max z-index)' },
  { type: 'display-message', label: 'Display Message', category: 'Object',     description: 'Show a modal message' },
  // Media
  { type: 'play-media',      label: 'Play Media',      category: 'Media',      description: 'Play audio or video' },
  { type: 'stop-media',      label: 'Stop Media',      category: 'Media',      description: 'Stop audio or video' },
  // Scoring
  { type: 'score-question',  label: 'Score Question',  category: 'Scoring',    description: 'Evaluate a question widget' },
  { type: 'score-quiz',      label: 'Score Quiz',      category: 'Scoring',    description: 'Calculate overall quiz score' },
  { type: 'send-to-lms',     label: 'Send to LMS',     category: 'Scoring',    description: 'Report score to SCORM LMS' },
  { type: 'suspend-lesson',  label: 'Suspend Lesson',  category: 'Scoring',    description: 'Save progress and exit' },
  // Variables
  { type: 'set-variable',    label: 'Set Variable',    category: 'Variables',  description: 'Create or update a variable' },
  // Animations
  { type: 'play-animation',  label: 'Play Animation',  category: 'Object',     description: 'Play a path animation on a widget' },
  // Flow
  { type: 'condition',       label: 'If / Else',       category: 'Flow',       description: 'Branch on a condition' },
  { type: 'loop',            label: 'Loop',            category: 'Flow',       description: 'Repeat actions N times or while condition' },
  // Macros
  { type: 'call-sequence',   label: 'Call Sequence',   category: 'Macros',     description: 'Run a shared course-level action sequence' },
]
