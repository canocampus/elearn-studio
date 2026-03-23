/**
 * Local type definitions for Phaser simulation authoring.
 * Mirrors @elearn-studio/phaser-simulations types without importing the Phaser bundle.
 */

export type PhaserSimType =
  | 'process-flow'
  | 'interactive-diagram'
  | 'gamified-quiz'
  | 'physics-demo'
  | 'concept-animator'

export type PhaserSimMode = 'demo' | 'practice' | 'assessment'

export interface PhaserSimExtendedProps {
  simType: PhaserSimType
  mode: PhaserSimMode
  passingScore: number   // 0–100
  sceneDef: Record<string, unknown> | null
  width?: number
  height?: number
}

export const PHASER_SIM_TYPES: Array<{ id: PhaserSimType; label: string }> = [
  { id: 'process-flow',        label: 'Process Flow' },
  { id: 'interactive-diagram', label: 'Interactive Diagram' },
  { id: 'gamified-quiz',       label: 'Gamified Quiz' },
  { id: 'physics-demo',        label: 'Physics Demo' },
  { id: 'concept-animator',    label: 'Concept Animator' },
]

export function isPhaserSimWidgetType(type: string): boolean {
  return type === 'phaser-sim'
}

/** Type guard: returns true if `s` is a valid PhaserSimType string. */
export function isPhaserSimType(s: string): s is PhaserSimType {
  return PHASER_SIM_TYPES.some((t) => t.id === s)
}

export const PHASER_SIM_DEFAULT_EXTENDED: PhaserSimExtendedProps = {
  simType: 'process-flow',
  mode: 'practice',
  passingScore: 70,
  sceneDef: null,
  width: 800,
  height: 500,
}
