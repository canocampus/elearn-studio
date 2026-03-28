export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

// Exported as array so Mongoose schema can reference it as an enum
export const WIDGET_TYPES = [
  'text',
  'image',
  'button',
  'rectangle',
  'media-player',
  'nav-buttons',
  'score-quiz',
  'done-button',
  'score-field',
  'question-mc',
  'question-tf',
  'question-fill',
  'question-match',
  'question-drag',
  'question-hotspot',
  'screenshot-sim',
  'phaser-sim',
] as const

export type WidgetType = (typeof WIDGET_TYPES)[number]

export interface Action {
  id?: string
  type: string
  params: Record<string, unknown>
  children?: Action[]
  elseChildren?: Action[]
}

export interface ActionSequence {
  event: string
  actions: Action[]
}

export interface BaseWidget {
  id: string
  type: WidgetType
  bounds: Bounds
  layer: number
  visible: boolean
  properties: Record<string, unknown>
  actions: ActionSequence[]
  extendedProperties: Record<string, unknown>
}
