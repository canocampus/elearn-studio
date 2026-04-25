/**
 * Authoring-side types for Screenshot Simulation (T024).
 * AuthoredSimStep extends the raw recorder SimStep with learner-facing fields.
 */

export interface SimHotspot {
  x: number
  y: number
  width: number
  height: number
  tolerance: number
}

/** T202: Interaction type for a simulation step */
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
  /** Backend-proxied URL for displaying the screenshot in the editor */
  screenshotUrl: string
  hotspot: SimHotspot
  /** T202: How the learner interacts with this step (default: 'click') */
  interactionType: SimInteractionType
  /** T202: Required text for 'type' interaction steps */
  expectedText?: string
}

export type SimMode = 'demo' | 'practice' | 'assessment'

export interface SimConfig {
  mode: SimMode
  passingScore: number
  steps: AuthoredSimStep[]
}
