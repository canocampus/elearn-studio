/**
 * Course domain types — shared across all packages.
 *
 * Single source of truth for D-01.
 */

import type { BaseWidget } from './widgets'
import type { SharedActionSequence } from './actions'

export interface Slide {
  id: string
  title: string
  templateId?: string
  widgets: BaseWidget[]
  // TD-027 (2026-07-21): the fossil `actions?: ActionSequence[]` field is
  // GONE. It was never wired (TD-017 archaeology) — slide lifecycle events
  // (enterSlide/exitSlide) live on WIDGET sequences via the EventDispatcher.
  // DB census before removal: 0 documents with content (only inert seeded
  // empty arrays, which Mongo strict mode now drops on every save).
  transition?: Record<string, unknown>
  /** Serialized HTML thumbnail for slide list preview (T013.6). */
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

export type NavigationMode = 'free' | 'linear-strict'

export interface CourseSettings {
  width: number
  height: number
  passingScore?: number
  allowReview?: boolean
  navigationMode?: NavigationMode
  requireAllSlides?: boolean
  remediationSlideId?: string
}

export interface SCORMMetadata {
  identifier?: string
  version: string
  masteryScore?: number
}

export interface CourseDoc {
  _id: string
  title: string
  slides: Slide[]
  templates?: SlideTemplate[]
  resources?: Resource[]
  settings: CourseSettings
  metadata: SCORMMetadata
  /** Course-level named macro sequences (T020.17). */
  sharedSequences?: SharedActionSequence[]
  deletedAt?: Date | null
  createdAt?: Date
  updatedAt?: Date
}

export interface CourseListItem {
  _id: string
  title: string
  updatedAt: Date
}
