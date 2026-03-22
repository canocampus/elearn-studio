/**
 * Course domain types for authoring-ui.
 * Mirror the backend interfaces from backend/api/src/models/types.ts.
 * Keep in sync manually until a shared package is created.
 */

export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

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
  id: string
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

export interface Slide {
  id: string
  title: string
  templateId?: string
  widgets: BaseWidget[]
  actions: ActionSequence[]
  transition?: Record<string, unknown>
  /** T013.6: serialized HTML thumbnail for slide list preview. */
  thumbnail?: string
}

export interface SlideTemplate {
  id: string
  name: string
  widgets: BaseWidget[]
}

export interface Resource {
  id: string
  name: string
  url: string
  mimeType: string
}

export interface CourseSettings {
  width: number
  height: number
  passingScore: number
  allowReview: boolean
}

export interface SCORMMetadata {
  identifier?: string
  version: string
  masteryScore: number
}

export interface SharedActionSequence {
  name: string
  actions: Action[]
}

export interface CourseDoc {
  _id: string
  title: string
  slides: Slide[]
  templates: SlideTemplate[]
  resources: Resource[]
  settings: CourseSettings
  metadata: SCORMMetadata
  /** T020.17 — course-level named macro sequences */
  sharedSequences: SharedActionSequence[]
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CourseListItem {
  _id: string
  title: string
  updatedAt: Date
}
