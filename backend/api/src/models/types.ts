/**
 * Shared TypeScript interfaces that mirror the Mongoose schemas.
 * Import these in authoring-ui and other packages for typed API responses.
 *
 * Note: These are plain interfaces (no Mongoose), safe to import from any package.
 */

import type { BaseWidget, ActionSequence } from './Widget'

export type { BaseWidget, ActionSequence, Action, Bounds, WidgetType } from './Widget'

// ---------------------------------------------------------------------------
// Slide
// ---------------------------------------------------------------------------

export interface Slide {
  id: string
  title: string
  templateId?: string
  widgets: BaseWidget[]
  actions: ActionSequence[]
  /** Transition config (opaque blob in Phase 0, typed in a future phase) */
  transition?: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Slide Template (shared background layer)
// ---------------------------------------------------------------------------

export interface SlideTemplate {
  id: string
  name: string
  widgets: BaseWidget[]
}

// ---------------------------------------------------------------------------
// Resource (asset reference stored in the course document)
// ---------------------------------------------------------------------------

export interface Resource {
  id: string
  name: string
  url: string
  mimeType: string
}

// ---------------------------------------------------------------------------
// Course Settings
// ---------------------------------------------------------------------------

export interface CourseSettings {
  width: number
  height: number
  passingScore: number
  allowReview: boolean
}

// ---------------------------------------------------------------------------
// SCORM Metadata
// ---------------------------------------------------------------------------

export interface SCORMMetadata {
  identifier?: string
  version: string
  masteryScore: number
}

// ---------------------------------------------------------------------------
// Course (full document shape returned by the API)
// ---------------------------------------------------------------------------

export interface CourseDoc {
  _id: string
  title: string
  slides: Slide[]
  templates: SlideTemplate[]
  resources: Resource[]
  settings: CourseSettings
  metadata: SCORMMetadata
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

/**
 * Lightweight course shape returned by GET /courses (list).
 * Only includes title, _id, and updatedAt.
 */
export interface CourseListItem {
  _id: string
  title: string
  updatedAt: Date
}
