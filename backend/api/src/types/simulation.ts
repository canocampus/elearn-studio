/**
 * Shared simulation types for the backend API.
 * RawSimStep / RawSession match what the simulation-engine records and stores.
 * AuthoredSimStep / SimConfig are the authoring output consumed by the player.
 */

export interface RawSimStep {
  id?: string
  type: string
  /** Normalised x coordinate (0–1) relative to viewport width */
  x?: number
  /** Normalised y coordinate (0–1) relative to viewport height */
  y?: number
  targetText?: string
  value?: string
  key?: string
  description?: string
  timestamp: number
  screenshotKey: string
}

export interface RawSession {
  id: string
  url: string
  title?: string
  startedAt: string
  endedAt?: string
  steps: RawSimStep[]
}

export interface SimHotspot {
  x: number
  y: number
  width: number
  height: number
  tolerance: number
}

/** T202 / TD-014.33: Interaction type for a simulation step. Must stay in
 *  lockstep with `packages/authoring-ui/src/types/simulation.ts` — the
 *  backend-to-frontend contract relies on identical union members. */
export type SimInteractionType = 'click' | 'hover' | 'type'

export interface AuthoredSimStep {
  id: string
  order: number
  description: string
  instruction: string
  hint: string
  correctFeedback: string
  incorrectFeedback: string
  demoDelay: number
  maxAttempts: number
  screenshotKey: string
  screenshotUrl: string
  hotspot: SimHotspot
  /** T202: How the learner interacts with this step (default: 'click').
   *  The backend always emits 'click' on import because the recorder only
   *  captures click events; the author can change it to 'hover' or 'type'
   *  in the StepForm. */
  interactionType: SimInteractionType
  /** T202: Required text for 'type' interaction steps.
   *  Never populated on import (the recorder produces no typing steps);
   *  authors set it manually after switching `interactionType` to 'type'. */
  expectedText?: string
}

export type SimMode = 'demo' | 'practice' | 'assessment'

export interface SimConfig {
  mode: SimMode
  passingScore: number
  steps: AuthoredSimStep[]
}
