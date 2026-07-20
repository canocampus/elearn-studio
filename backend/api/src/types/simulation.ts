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

/**
 * TD-023: the authored family (SimHotspot / SimInteractionType /
 * AuthoredSimStep / SimMode / SimConfig) is now a pure re-export of the
 * canonical contract in `@elearn-studio/shared-types` — the old
 * "must stay in lockstep" comment is retired because the compiler enforces
 * it (`simulationContractGuard.ts`). Only the recorder wire format above
 * stays local by design.
 */
export type {
  SimHotspot,
  SimInteractionType,
  AuthoredSimStep,
  SimMode,
  SimConfig,
} from '@elearn-studio/shared-types'
