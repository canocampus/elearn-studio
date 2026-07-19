/**
 * Course domain types — shared across all packages.
 *
 * Single source of truth for D-01.
 */

import type { BaseWidget } from './widgets'
import type { ActionSequence, SharedActionSequence } from './actions'

export interface Slide {
  id: string
  title: string
  templateId?: string
  widgets: BaseWidget[]
  /**
   * @deprecated FOSSIL FIELD — never wired (TD-017 archaeology, 2026-07-19).
   * Slide-level sequence storage was the original intent, but the shipped
   * design (T021.10 EventDispatcher) hosts slide lifecycle events
   * (enterSlide/exitSlide) on WIDGET sequences instead: the runtime's
   * fireSlideEvent scans every widget's `actions` for the event, and the
   * authoring panel attaches sequences to the selected widget. Nothing reads
   * or writes this field. Kept only to avoid a schema migration; do not start
   * using it — remove in a future schema-hygiene pass.
   */
  actions?: ActionSequence[]
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
