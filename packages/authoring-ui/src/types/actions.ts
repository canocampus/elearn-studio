/**
 * Action type definitions — T020/T021
 *
 * Discriminated union covering all action types in the eLearn Studio
 * authoring/runtime pipeline.  Shared between:
 *   - authoring-ui (editor stores, ActionSequenceEditor components)
 *   - runtime-player (ActionExecutor, EventDispatcher)
 *
 * Serialised as JSON to widget.actions[] in the Course document.
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

// ─── Shared sequence macro (T020.17) ─────────────────────────────────────────

/**
 * Calls a named course-level shared sequence (macro).
 * The executor looks up `course.sharedSequences` by name and runs its actions.
 */
export interface CallSequenceAction {
  type: 'call-sequence'
  params: {
    /** Name of the SharedActionSequence to invoke */
    sequenceName: string
  }
}

// ─── Animations ───────────────────────────────────────────────────────────────

export interface PlayAnimationAction {
  type: 'play-animation'
  params: {
    /** ID of the widget to animate */
    widgetId: string
    /**
     * Name of the AnimationPath to play (matches AnimationPath.name).
     * When omitted, the first animation in the widget's extendedProperties.animations
     * array is used.
     */
    animationName?: string
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

// ─── Action metadata (used by the palette in the authoring UI) ────────────────

export interface ActionMeta {
  type: ActionType
  label: string
  category: 'Navigation' | 'Object' | 'Media' | 'Scoring' | 'Variables' | 'Flow' | 'Macros'
  description: string
}

export const ACTION_PALETTE: ActionMeta[] = [
  // Navigation
  { type: 'navigate',         label: 'Navigate',         category: 'Navigation', description: 'Go to a slide' },
  // Object
  { type: 'show',             label: 'Show',             category: 'Object',     description: 'Make a widget visible' },
  { type: 'hide',             label: 'Hide',             category: 'Object',     description: 'Hide a widget' },
  { type: 'bring-to-front',  label: 'Bring to Front',   category: 'Object',     description: 'Move widget above all others (max z-index)' },
  { type: 'display-message',  label: 'Display Message',  category: 'Object',     description: 'Show a modal message' },
  // Media
  { type: 'play-media',       label: 'Play Media',       category: 'Media',      description: 'Play audio or video' },
  { type: 'stop-media',       label: 'Stop Media',       category: 'Media',      description: 'Stop audio or video' },
  // Scoring
  { type: 'score-question',   label: 'Score Question',   category: 'Scoring',    description: 'Evaluate a question widget' },
  { type: 'score-quiz',       label: 'Score Quiz',       category: 'Scoring',    description: 'Calculate overall quiz score' },
  { type: 'send-to-lms',      label: 'Send to LMS',      category: 'Scoring',    description: 'Report score to SCORM LMS' },
  { type: 'suspend-lesson',   label: 'Suspend Lesson',   category: 'Scoring',    description: 'Save progress and exit' },
  // Variables
  { type: 'set-variable',     label: 'Set Variable',     category: 'Variables',  description: 'Create or update a variable' },
  // Animations
  { type: 'play-animation',   label: 'Play Animation',   category: 'Object',     description: 'Play a path animation on a widget' },
  // Flow
  { type: 'condition',        label: 'If / Else',        category: 'Flow',       description: 'Branch on a condition' },
  { type: 'loop',             label: 'Loop',             category: 'Flow',       description: 'Repeat actions N times or while condition' },
  // Macros
  { type: 'call-sequence',    label: 'Call Sequence',    category: 'Macros',     description: 'Run a shared course-level action sequence' },
]
