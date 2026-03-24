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

// ---------------------------------------------------------------------------
// SceneDef mirrors (no Phaser runtime dependency — types only)
// ---------------------------------------------------------------------------

export interface ProcessFlowNode {
  id: string
  x: number
  y: number
  label: string
  type: 'start' | 'step' | 'decision' | 'end'
}

export interface ProcessFlowEdge {
  id: string
  from: string
  to: string
  label?: string
}

export interface ProcessFlowStep {
  id: string
  nodeId: string
  instruction: string
  correctAction: 'click' | 'hover'
}

export interface ProcessFlowSceneDef {
  simType: 'process-flow'
  nodes: ProcessFlowNode[]
  edges: ProcessFlowEdge[]
  steps: ProcessFlowStep[]
  autoAdvanceDelayMs?: number
}

export interface DiagramHotspot {
  id: string
  x: number
  y: number
  radius: number
  label: string
  description: string
  isCorrect?: boolean
}

export interface InteractiveDiagramSceneDef {
  simType: 'interactive-diagram'
  backgroundImageUrl: string
  hotspots: DiagramHotspot[]
  width?: number
  height?: number
}

export interface QuizQuestion {
  id: string
  text: string
  options: string[]
  correctIndex: number
  pointValue: number
}

export interface GamifiedQuizSceneDef {
  simType: 'gamified-quiz'
  questions: QuizQuestion[]
  timerSeconds?: number
  initialLives?: number
  comboMultiplier?: number
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
