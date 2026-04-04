/**
 * Action and ActionSequence types — shared across all packages.
 *
 * Single source of truth for D-01.
 * Authoritative source: authoring-ui/src/types/actions.ts
 */

// ─── Navigation ───────────────────────────────────────────────────────────────

export type NavigateTarget =
  | 'next'
  | 'prev'
  | 'first'
  | 'last'
  | 'slide-name'
  | 'slide-number'

export interface NavigateAction {
  type: 'navigate'
  params: {
    target: NavigateTarget
    /** Used when target === 'slide-name' */
    slideName?: string
    /** Used when target === 'slide-number' (1-based) */
    slideNumber?: number
  }
}

// ─── Visibility ───────────────────────────────────────────────────────────────

export interface ShowAction {
  type: 'show'
  params: { widgetId: string }
}

export interface HideAction {
  type: 'hide'
  params: { widgetId: string }
}

export interface BringToFrontAction {
  type: 'bring-to-front'
  params: { widgetId: string }
}

// ─── Variables ────────────────────────────────────────────────────────────────

export type VariableValueType = 'literal' | 'expression'

export interface SetVariableAction {
  type: 'set-variable'
  params: {
    name: string
    value: string
    /** 'literal' stores as-is; 'expression' is evaluated (safe whitelist evaluator) */
    valueType: VariableValueType
  }
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export interface DisplayMessageAction {
  type: 'display-message'
  params: {
    message: string
    title?: string
  }
}

// ─── Media ────────────────────────────────────────────────────────────────────

export interface PlayMediaAction {
  type: 'play-media'
  params: { widgetId: string }
}

export interface StopMediaAction {
  type: 'stop-media'
  params: { widgetId: string }
}

// ─── Scoring / LMS ────────────────────────────────────────────────────────────

export interface ScoreQuestionAction {
  type: 'score-question'
  params: { widgetId: string }
}

export interface ScoreQuizAction {
  type: 'score-quiz'
  params?: Record<string, never>
}

export interface SendToLMSAction {
  type: 'send-to-lms'
  params?: Record<string, never>
}

export interface SuspendLessonAction {
  type: 'suspend-lesson'
  params?: Record<string, never>
}

// ─── Flow control ─────────────────────────────────────────────────────────────

export interface ConditionAction {
  type: 'condition'
  params: {
    /** Safe expression string. Variables referenced as $varName. */
    expression: string
    then: Action[]
    else?: Action[]
  }
}

export interface LoopAction {
  type: 'loop'
  params: {
    mode: 'count' | 'while'
    /** Used when mode === 'count' */
    count?: number
    /** Used when mode === 'while' — safe expression string */
    condition?: string
    body: Action[]
    /** Max iterations safety cap (default 1000) */
    maxIterations?: number
  }
}

// ─── Animations ───────────────────────────────────────────────────────────────

export interface PlayAnimationAction {
  type: 'play-animation'
  params: {
    widgetId: string
    /**
     * Name of the AnimationPath to play (matches AnimationPath.name).
     * When omitted, the first animation is used.
     */
    animationName?: string
  }
}

// ─── Shared sequence macro (T020.17) ─────────────────────────────────────────

export interface CallSequenceAction {
  type: 'call-sequence'
  params: {
    sequenceName: string
  }
}

// ─── Discriminated union ──────────────────────────────────────────────────────

export type Action =
  | NavigateAction
  | ShowAction
  | HideAction
  | BringToFrontAction
  | SetVariableAction
  | DisplayMessageAction
  | PlayMediaAction
  | StopMediaAction
  | ScoreQuestionAction
  | ScoreQuizAction
  | SendToLMSAction
  | SuspendLessonAction
  | ConditionAction
  | LoopAction
  | PlayAnimationAction
  | CallSequenceAction

export type ActionType = Action['type']

// ─── ActionSequence ───────────────────────────────────────────────────────────

/**
 * Stored in widget.actions[].
 * The `event` maps to EventDispatcher trigger keys (e.g. 'click', 'enterSlide').
 */
export interface ActionSequence {
  event: string
  actions: Action[]
}

// ─── Shared sequence (course-level macro) — T020.17 ──────────────────────────

/**
 * A named, reusable action sequence stored at the course level.
 * Referenced by CallSequenceAction with matching `name`.
 */
export interface SharedActionSequence {
  name: string
  actions: Action[]
}

// ─── Event names ──────────────────────────────────────────────────────────────

export const WIDGET_EVENTS = [
  'click',
  'doubleClick',
  'mouseEnter',
  'mouseLeave',
  'questionAnswered',
  'questionCorrect',
  'questionIncorrect',
] as const

export const SLIDE_EVENTS = ['enterSlide', 'exitSlide'] as const

export type WidgetEvent = (typeof WIDGET_EVENTS)[number]
export type SlideEvent = (typeof SLIDE_EVENTS)[number]
