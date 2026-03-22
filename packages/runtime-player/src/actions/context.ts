/**
 * ExecutionContext — T021
 *
 * Carries all mutable state needed by ActionExecutor at runtime:
 *   - course + slide navigation callbacks
 *   - widget visibility map
 *   - session variables
 *   - SCORM bridge (optional)
 *   - DOM container (for show/hide, media, message overlay)
 *   - sharedSequences lookup for call-sequence (T020.17)
 */

import type { SharedActionSequence } from './types'

// ─── Minimal SCORM 1.2 bridge ─────────────────────────────────────────────────

export interface ScormBridge {
  getValue(element: string): string
  setValue(element: string, value: string): void
  commit(): void
  finish(): void
}

// ─── Widget reference ─────────────────────────────────────────────────────────

export interface WidgetRef {
  id: string
  type: string
  el: HTMLElement | null
  /** Extended properties from the course JSON (e.g. animations, simConfig) */
  extendedProperties?: Record<string, unknown>
}

// ─── Slide reference (minimal info needed for navigation) ─────────────────────

export interface SlideRef {
  id: string
  title: string
}

// ─── Navigation callbacks ─────────────────────────────────────────────────────

export interface NavigationCallbacks {
  goToIndex(index: number): void
  getCurrentIndex(): number
  getSlideCount(): number
  getSlides(): SlideRef[]
}

// ─── Question scoring callbacks ───────────────────────────────────────────────

export interface ScoringCallbacks {
  /** Evaluate a question widget and update internal score state */
  scoreQuestion(widgetId: string): void
  /** Compute overall quiz score (0-100) and report to SCORM */
  scoreQuiz(): void
  /** Get current computed score (0-100) */
  getCurrentScore(): number
}

// ─── ExecutionContext ─────────────────────────────────────────────────────────

export interface ExecutionContext {
  /** Session variables — string-keyed, string values for simplicity */
  variables: Map<string, string>

  /** Navigate between slides */
  navigation: NavigationCallbacks

  /** Widget visibility and element lookup */
  getWidget(widgetId: string): WidgetRef | undefined

  /** Scoring + SCORM reporting */
  scoring: ScoringCallbacks

  /** Optional SCORM bridge — null when running outside an LMS */
  scorm: ScormBridge | null

  /** DOM container of the player (used for message overlays) */
  container: HTMLElement

  /** T020.17 — course-level named shared sequences (macros) */
  sharedSequences: SharedActionSequence[]
}

// ─── Factory helper ───────────────────────────────────────────────────────────

/**
 * Creates a minimal ExecutionContext for unit tests / offline use.
 * Provide real callbacks when wiring into the runtime player.
 */
export function createExecutionContext(
  overrides: Partial<ExecutionContext> = {},
): ExecutionContext {
  const variables = overrides.variables ?? new Map<string, string>()
  const container = overrides.container ?? document.createElement('div')

  const navigation: NavigationCallbacks = overrides.navigation ?? {
    goToIndex: () => {},
    getCurrentIndex: () => 0,
    getSlideCount: () => 1,
    getSlides: () => [],
  }

  const scoring: ScoringCallbacks = overrides.scoring ?? {
    scoreQuestion: () => {},
    scoreQuiz: () => {},
    getCurrentScore: () => 0,
  }

  return {
    variables,
    navigation,
    getWidget: overrides.getWidget ?? (() => undefined),
    scoring,
    scorm: overrides.scorm ?? null,
    container,
    sharedSequences: overrides.sharedSequences ?? [],
  }
}
