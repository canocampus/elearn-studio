// Core types for the phaser-simulations package.
// Consumed by PhaserSimWidget, scene classes, authoring-ui, and runtime-player.

export type SimType =
  | 'process-flow'
  | 'interactive-diagram'
  | 'gamified-quiz'
  | 'physics-demo'
  | 'concept-animator'

export type SimMode = 'demo' | 'practice' | 'assessment'

// ---------------------------------------------------------------------------
// SceneDef variants (one per SimType)
// ---------------------------------------------------------------------------

export interface ProcessFlowNode {
  id: string
  x: number
  y: number
  label: string
  type: 'start' | 'step' | 'decision' | 'end'
}

export interface ProcessFlowEdge {
  from: string
  to: string
  label?: string
}

export interface ProcessFlowStep {
  nodeId: string
  instruction: string
  correctAction: 'click' | 'hover'
}

export interface ProcessFlowSceneDef {
  simType: 'process-flow'
  nodes: ProcessFlowNode[]
  edges: ProcessFlowEdge[]
  steps: ProcessFlowStep[]
  autoAdvanceDelayMs?: number  // demo mode: ms between steps (default 2000)
}

export interface DiagramHotspot {
  id: string
  x: number
  y: number
  radius: number
  label: string
  description: string
  isCorrect?: boolean  // assessment mode
}

export interface InteractiveDiagramSceneDef {
  simType: 'interactive-diagram'
  backgroundImageUrl: string
  hotspots: DiagramHotspot[]
  width?: number
  height?: number
}

export interface GamifiedQuizSceneDef {
  simType: 'gamified-quiz'
  questions: QuizQuestion[]
  timerSeconds?: number        // 0 = no timer
  initialLives?: number        // 0 = infinite lives
  comboMultiplier?: number     // score multiplier per correct streak (default 1)
}

export interface QuizQuestion {
  id: string
  text: string
  options: string[]
  correctIndex: number
  pointValue: number
}

// ---------------------------------------------------------------------------
// Widget config (passed to PhaserSimWidget.mount)
// ---------------------------------------------------------------------------

// Stubs for future scene types (T034, T035)
export interface PhysicsDemoSceneDef {
  simType: 'physics-demo'
  // TODO: T034 — Matter.js physics scene definition
}

export interface ConceptAnimatorSceneDef {
  simType: 'concept-animator'
  // TODO: T035 — Step-by-step algorithm/data structure visualisation
}

export type SceneDef =
  | ProcessFlowSceneDef
  | InteractiveDiagramSceneDef
  | GamifiedQuizSceneDef
  | PhysicsDemoSceneDef
  | ConceptAnimatorSceneDef

export interface PhaserSimConfig {
  widgetId: string
  sceneDef: SceneDef
  mode: SimMode
  passingScore: number         // 0–100
  width?: number               // canvas width (default 800)
  height?: number              // canvas height (default 500)
}

// ---------------------------------------------------------------------------
// Score event (dispatched on window when sim completes)
// ---------------------------------------------------------------------------

export interface WidgetScoreDetail {
  widgetId: string
  score: number          // 0–100
  passed: boolean
  stepScores: StepScore[]
}

export interface StepScore {
  stepId: string
  score: number
  maxScore: number
}
