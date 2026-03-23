import type Phaser from 'phaser'
import type { InteractiveDiagramSceneDef, DiagramHotspot } from '../types'
import type { ScoreTracker } from '../ScoreTracker'
import type { ModeController } from '../ModeController'
import { InteractiveDiagramLogic } from './InteractiveDiagramLogic'

const HOTSPOT_IDLE_COLOUR      = 0x2980b9
const HOTSPOT_VISITED_COLOUR   = 0x27ae60
const HOTSPOT_STROKE_IDLE      = 0xffffff
const HOTSPOT_STROKE_HOVER     = 0xf1c40f
const POPUP_BG_COLOUR          = 0x1a1a2e
const FONT_FAMILY              = '"Arial", sans-serif'

/**
 * InteractiveDiagramScene — Phaser.Scene that displays a labelled diagram
 * with clickable hotspot circles over a background image.
 *
 * All state tracking lives in InteractiveDiagramLogic; this class handles
 * only rendering and Phaser lifecycle hooks.
 */
export class InteractiveDiagramScene extends (Phaser.Scene as typeof Phaser.Scene) {
  private readonly def: InteractiveDiagramSceneDef
  private readonly tracker: ScoreTracker
  private readonly controller: ModeController
  private logic!: InteractiveDiagramLogic

  private hotspotSprites = new Map<string, Phaser.GameObjects.Arc>()
  private popup!: Phaser.GameObjects.Container
  private popupText!: Phaser.GameObjects.Text
  private progressText!: Phaser.GameObjects.Text
  private completionText!: Phaser.GameObjects.Text

  constructor(def: InteractiveDiagramSceneDef, tracker: ScoreTracker, controller: ModeController) {
    super({ key: 'InteractiveDiagramScene' })
    this.def        = def
    this.tracker    = tracker
    this.controller = controller
  }

  // ---------------------------------------------------------------------------
  // Phaser lifecycle
  // ---------------------------------------------------------------------------

  preload(): void {
    this.load.image('diagram-bg', this.def.backgroundImageUrl)
  }

  create(): void {
    this.logic = new InteractiveDiagramLogic(this.def, this.tracker, this.controller)

    // Background image
    this.add.image(
      (this.def.width ?? 800) / 2,
      (this.def.height ?? 500) / 2,
      'diagram-bg',
    )

    this._createHotspots()
    this._createPopup()
    this._createHUD()
  }

  // ---------------------------------------------------------------------------
  // Hotspots
  // ---------------------------------------------------------------------------

  private _createHotspots(): void {
    for (const hs of this.def.hotspots) {
      const circle = this.add.circle(hs.x, hs.y, hs.radius, HOTSPOT_IDLE_COLOUR, 0.7)
      circle.setStrokeStyle(2, HOTSPOT_STROKE_IDLE)
      circle.setInteractive({ useHandCursor: true })

      circle.on('pointerover', () => circle.setStrokeStyle(3, HOTSPOT_STROKE_HOVER))
      circle.on('pointerout',  () => {
        const visited = this.logic.isVisited(hs.id)
        circle.setFillStyle(visited ? HOTSPOT_VISITED_COLOUR : HOTSPOT_IDLE_COLOUR, 0.7)
        circle.setStrokeStyle(2, HOTSPOT_STROKE_IDLE)
      })
      circle.on('pointerdown', () => this._onHotspotClick(hs))

      this.add.text(hs.x, hs.y - hs.radius - 6, hs.label, {
        fontSize:   '12px',
        fontFamily: FONT_FAMILY,
        color:      '#ffffff',
        align:      'center',
      }).setOrigin(0.5, 1)

      this.hotspotSprites.set(hs.id, circle)
    }
  }

  private _onHotspotClick(hs: DiagramHotspot): void {
    const description = this.logic.handleHotspotClick(hs.id)
    if (!description) return

    // Turn the hotspot green to signal it has been visited
    const circle = this.hotspotSprites.get(hs.id)
    circle?.setFillStyle(HOTSPOT_VISITED_COLOUR, 0.8)

    this._showPopup(hs.label, description)
    this._updateHUD()

    if (this.logic.isComplete) {
      this._onComplete()
    }
  }

  // ---------------------------------------------------------------------------
  // Popup
  // ---------------------------------------------------------------------------

  private _createPopup(): void {
    const bg = this.add.rectangle(0, 0, 360, 100, POPUP_BG_COLOUR, 0.9)
      .setStrokeStyle(1, 0x888888)

    this.popupText = this.add.text(0, 0, '', {
      fontSize:   '14px',
      fontFamily: FONT_FAMILY,
      color:      '#eeeeee',
      align:      'center',
      wordWrap:   { width: 340 },
    }).setOrigin(0.5)

    const closeBtn = this.add.text(170, -40, '✕', {
      fontSize:   '18px',
      fontFamily: FONT_FAMILY,
      color:      '#aaaaaa',
    }).setInteractive({ useHandCursor: true })
    closeBtn.on('pointerdown', () => this.popup.setVisible(false))

    this.popup = this.add.container(
      (this.def.width  ?? 800) / 2,
      (this.def.height ?? 500) - 80,
      [bg, this.popupText, closeBtn],
    ).setVisible(false)
  }

  private _showPopup(label: string, description: string): void {
    this.popupText.setText(`${label}\n\n${description}`)
    this.popup.setVisible(true)
  }

  // ---------------------------------------------------------------------------
  // HUD
  // ---------------------------------------------------------------------------

  private _createHUD(): void {
    this.progressText = this.add.text(12, 12, '', {
      fontSize:   '14px',
      fontFamily: FONT_FAMILY,
      color:      '#ffffff',
    })

    this.completionText = this.add.text(
      (this.def.width  ?? 800) / 2,
      (this.def.height ?? 500) / 2,
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

  private _updateHUD(): void {
    const visited = this.logic.visitedCount
    const total   = this.logic.hotspotCount
    this.progressText.setText(`Explored: ${visited} / ${total}`)
  }

  // ---------------------------------------------------------------------------
  // Completion
  // ---------------------------------------------------------------------------

  private _onComplete(): void {
    this.popup.setVisible(false)
    this.completionText.setVisible(true).setText('All areas explored!')
    this.tracker.complete()
    this.game.events.emit('sim-complete')
  }
}
