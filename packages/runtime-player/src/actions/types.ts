/**
 * Action type definitions — runtime-player mirror of authoring-ui/src/types/actions.ts
 *
 * Kept in sync manually (or via a future shared-types package).
 * Inlined here to keep the runtime-player self-contained with no cross-package deps.
 */

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
    slideName?: string
    slideNumber?: number
  }
}

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

export type VariableValueType = 'literal' | 'expression'

export interface SetVariableAction {
  type: 'set-variable'
  params: {
    name: string
    value: string
    valueType: VariableValueType
  }
}

export interface DisplayMessageAction {
  type: 'display-message'
  params: {
    message: string
    title?: string
  }
}

export interface PlayMediaAction {
  type: 'play-media'
  params: { widgetId: string }
}

export interface StopMediaAction {
  type: 'stop-media'
  params: { widgetId: string }
}

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

export interface ConditionAction {
  type: 'condition'
  params: {
    expression: string
    then: Action[]
    else?: Action[]
  }
}

export interface LoopAction {
  type: 'loop'
  params: {
    mode: 'count' | 'while'
    count?: number
    condition?: string
    body: Action[]
    maxIterations?: number
  }
}

export interface PlayAnimationAction {
  type: 'play-animation'
  params: {
    widgetId: string
    animationName?: string
  }
}

export interface CallSequenceAction {
  type: 'call-sequence'
  params: {
    sequenceName: string
  }
}

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

export interface ActionSequence {
  event: string
  actions: Action[]
}

export interface SharedActionSequence {
  name: string
  actions: Action[]
}
