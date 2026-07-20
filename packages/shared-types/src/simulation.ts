/**
 * Screenshot Simulation — canonical authoring/runtime contract (TD-023).
 *
 * Single authority for the types previously hand-mirrored in
 * authoring-ui (`types/simulation.ts`), backend (`types/simulation.ts`) and
 * runtime-player (`sim/simPlayer.ts`); those modules now re-export from here
 * and per-package `expectTypeOf` guards fail the build if a local
 * redefinition reappears.
 *
 * NOT here on purpose: the recorder wire format (`RawSimStep`/`RawSession`)
 * stays local to backend/api — it mirrors simulation-engine's `SimStep`
 * (naming asymmetry documented in TD-014.26 R-M1), it is not a copy of this
 * contract.
 */

export interface SimHotspot {
  x: number
  y: number
  width: number
  height: number
  tolerance: number
}

/** T202: Interaction type for a simulation step. */
export type SimInteractionType = 'click' | 'hover' | 'type'

export interface AuthoredSimStep {
  id: string
  order: number
  /** Auto-generated from captured event; also editable */
  description: string
  /** Instruction text shown to the learner */
  instruction: string
  /** Hint shown after the first wrong attempt (practice mode) */
  hint: string
  correctFeedback: string
  incorrectFeedback: string
  /** Milliseconds to display step before auto-advance (demo mode) */
  demoDelay: number
  /** Max allowed attempts; -1 = unlimited */
  maxAttempts: number
  screenshotKey: string
  /** Backend-proxied URL for displaying the screenshot */
  screenshotUrl: string
  hotspot: SimHotspot
  /**
   * T202: How the learner interacts with this step.
   * REQUIRED by contract (D2, TD-023.2): every producer emits it — the
   * backend import always writes 'click' (the recorder only captures
   * clicks) and the authoring StepForm initialises it. Steps inside SCORM
   * packages exported before T202 may lack the field; that is a READ-side
   * legacy concern only — the player keeps its documented `?? 'click'`
   * default at the boundary (simPlayer), the contract does not widen for it.
   */
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
