/**
 * Widget domain types — shared across authoring-ui, runtime-player,
 * scorm-packager, backend/api, and question-engine.
 *
 * Single source of truth for D-01.
 */

export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

/**
 * All widget type identifiers.
 * Exported as a const array so Mongoose schema can reference it as an enum.
 */
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
  'audio-narration',
  'progress-bar',
  'volume-control',
  'question-mc',
  'question-tf',
  'question-fill',
  'question-match',
  'question-drag',
  'question-drop',
  'question-arrange',
  'question-order',
  'suspend-button',
  'question-hotspot',
  'screenshot-sim',
  'phaser-sim',
] as const

export type WidgetType = (typeof WIDGET_TYPES)[number]

import type { ActionSequence } from './actions'

export interface BaseWidget {
  id: string
  type: WidgetType
  /**
   * Optional human-readable name authored via the GrapesJS `name` trait
   * (Props panel → Name field). Used as the display label in the Actions
   * Editor widget-target dropdown; `id` remains the technical routing key.
   * Optional for backward compatibility with courses saved before this field
   * was introduced.
   */
  name?: string
  bounds: Bounds
  layer: number
  visible: boolean
  properties: Record<string, unknown>
  actions?: ActionSequence[]
  extendedProperties: Record<string, unknown>
}
