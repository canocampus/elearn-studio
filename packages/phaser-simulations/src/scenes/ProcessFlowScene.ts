import * as Phaser from 'phaser'
import type { ProcessFlowSceneDef, ProcessFlowNode } from '../types'
import type { ScoreTracker } from '../ScoreTracker'
import type { ModeController } from '../ModeController'
import { ProcessFlowLogic } from './ProcessFlowLogic'

// Node colours by type
const NODE_COLOUR: Record<ProcessFlowNode['type'], number> = {
  start:    0x27ae60,
  step:     0x2980b9,
  decision: 0xf39c12,
  end:      0xe74c3c,
}
const HIGHLIGHT_COLOUR = 0xf1c40f
const IDLE_STROKE     = 0xffffff
const HIGHLIGHT_STROKE = 0xf39c12

const NODE_RADIUS   = 36
const FONT_SIZE     = '14px'
const FONT_FAMILY   = '"Arial", sans-serif'

/**
 * ProcessFlowScene — Phaser.Scene that renders a node/arrow process-flow
 * diagram and drives step-by-step learner interaction.
 *
 * All business logic lives in ProcessFlowLogic; this class is only
 * responsible for rendering and Phaser lifecycle hooks.
 */
export class ProcessFlowScene extends (Phaser.Scene as typeof Phaser.Scene) {
  private readonly def: ProcessFlowSceneDef
  private readonly tracker: ScoreTracker
  private readonly controller: ModeController
  private logic!: ProcessFlowLogic

  // Phaser display objects
  private nodeObjects = new Map<string, Phaser.GameObjects.Arc>()
  private nodeLabels  = new Map<string, Phaser.GameObjects.Text>()
  private graphics!:   Phaser.GameObjects.Graphics
  private edgeLabels:  Phaser.GameObjects.Text[] = []
  private instructionText!: Phaser.GameObjects.Text
  private completionText!:  Phaser.GameObjects.Text

  constructor(def: ProcessFlowSceneDef, tracker: ScoreTracker, controller: ModeController) {
    super({ key: 'ProcessFlowScene' })
    this.def      = def
    this.tracker  = tracker
    this.controller = controller
  }

  // ---------------------------------------------------------------------------
  // Phaser lifecycle
  // ---------------------------------------------------------------------------

  create(): void {
    this.logic = new ProcessFlowLogic(this.def, this.tracker, this.controller)

    this.graphics = this.add.graphics()
    this._drawEdges()
    this._drawNodes()
    this._drawEdgeLabels()
    this._createHUD()

    if (this.controller.isAutoAdvance()) {
      this._scheduleAutoAdvance()
    }
  }

  // ---------------------------------------------------------------------------
  // Drawing helpers
  // ---------------------------------------------------------------------------

  private _drawEdges(): void {
    this.graphics.clear()
    this.graphics.lineStyle(2, 0xaaaaaa, 1)

    for (const edge of this.def.edges) {
      const from = this.def.nodes.find(n => n.id === edge.from)
      const to   = this.def.nodes.find(n => n.id === edge.to)
      if (!from || !to) continue
      this.graphics.lineBetween(from.x, from.y, to.x, to.y)
    }
    this.graphics.strokePath()
  }

  private _drawNodes(): void {
    for (const node of this.def.nodes) {
      const colour = NODE_COLOUR[node.type] ?? 0x555555

      const circle = this.add.circle(node.x, node.y, NODE_RADIUS, colour)
      circle.setStrokeStyle(2, IDLE_STROKE)

      if (this.controller.requiresInteraction()) {
        circle.setInteractive({ useHandCursor: true })
        circle.on('pointerdown', () => this._onNodeClick(node.id))
        circle.on('pointerover', () => this._onNodeHover(node.id))
      }

      const label = this.add.text(node.x, node.y + NODE_RADIUS + 8, node.label, {
        fontSize:   FONT_SIZE,
        fontFamily: FONT_FAMILY,
        color:      '#ffffff',
        align:      'center',
      }).setOrigin(0.5, 0)

      this.nodeObjects.set(node.id, circle)
      this.nodeLabels.set(node.id, label)
    }

    this._refreshHighlight()
  }

  private _drawEdgeLabels(): void {
    for (const label of this.edgeLabels) label.destroy()
    this.edgeLabels = []

    for (const edge of this.def.edges) {
      if (!edge.label) continue
      const from = this.def.nodes.find(n => n.id === edge.from)
      const to   = this.def.nodes.find(n => n.id === edge.to)
      if (!from || !to) continue

      const mx = (from.x + to.x) / 2
      const my = (from.y + to.y) / 2

      const t = this.add.text(mx, my - 12, edge.label, {
        fontSize:   '12px',
        fontFamily: FONT_FAMILY,
        color:      '#dddddd',
        backgroundColor: '#333333',
        padding:    { x: 4, y: 2 },
      }).setOrigin(0.5, 0.5)

      this.edgeLabels.push(t)
    }
  }

  private _createHUD(): void {
    this.instructionText = this.add.text(16, 16, '', {
      fontSize:   '16px',
      fontFamily: FONT_FAMILY,
      color:      '#ffffff',
      wordWrap:   { width: 740 },
    })

    this.completionText = this.add.text(
      (this.scale?.width ?? 800) / 2,
      (this.scale?.height ?? 500) / 2,
      '',
      {
        fontSize:   '28px',
        fontFamily: FONT_FAMILY,
        color:      '#f1c40f',
        align:      'center',
      },
    ).setOrigin(0.5).setVisible(false)

    this._updateHUD()
  }

  // ---------------------------------------------------------------------------
  // State sync
  // ---------------------------------------------------------------------------

  private _updateHUD(): void {
    if (this.logic.isComplete) {
      this.instructionText.setText('')
      this.completionText.setVisible(true).setText('Simulation complete!')
      this.tracker.complete()
      this.game.events.emit('sim-complete')
      return
    }
    this.instructionText.setText(this.logic.getCurrentInstruction())
    this._refreshHighlight()
  }

  private _refreshHighlight(): void {
    const highlightId = this.logic.getHighlightedNodeId()

    for (const [id, circle] of this.nodeObjects) {
      if (id === highlightId) {
        circle.setFillStyle(HIGHLIGHT_COLOUR)
        circle.setStrokeStyle(3, HIGHLIGHT_STROKE)
      } else {
        const node   = this.def.nodes.find(n => n.id === id)!
        const colour = NODE_COLOUR[node.type] ?? 0x555555
        circle.setFillStyle(colour)
        circle.setStrokeStyle(2, IDLE_STROKE)
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Input handlers
  // ---------------------------------------------------------------------------

  private _onNodeClick(nodeId: string): void {
    this.logic.handleNodeClick(nodeId)
    this._updateHUD()
  }

  private _onNodeHover(nodeId: string): void {
    // hover highlight is visual only — no logic side-effect
    const circle = this.nodeObjects.get(nodeId)
    circle?.setStrokeStyle(3, HIGHLIGHT_STROKE)
  }

  // ---------------------------------------------------------------------------
  // Demo mode auto-advance
  // ---------------------------------------------------------------------------

  private _scheduleAutoAdvance(): void {
    if (this.logic.isComplete) return
    this.time.delayedCall(this.logic.getAutoAdvanceDelayMs(), () => {
      this.logic.advanceStep()
      this._updateHUD()
      this._scheduleAutoAdvance()
    })
  }
}
