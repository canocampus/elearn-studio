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
}

export type SimMode = 'demo' | 'practice' | 'assessment'

export interface SimConfig {
  sessionId: string
  mode: SimMode
  passingScore: number
  steps: AuthoredSimStep[]
}
