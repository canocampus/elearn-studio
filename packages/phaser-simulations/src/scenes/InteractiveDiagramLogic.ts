import type { InteractiveDiagramSceneDef, DiagramHotspot } from '../types'
import type { ScoreTracker } from '../ScoreTracker'
import type { ModeController } from '../ModeController'

/**
 * InteractiveDiagramLogic — pure business logic for the interactive-diagram sim.
 *
 * Tracks which hotspots the learner has visited, records scores, and signals
 * completion when all hotspots have been explored.
 */
export class InteractiveDiagramLogic {
  private readonly _hotspots: DiagramHotspot[]
  private readonly _visited = new Set<string>()
  private _complete = false

  constructor(
    private readonly def: InteractiveDiagramSceneDef,
    private readonly tracker: ScoreTracker,
    private readonly controller: ModeController,
  ) {
    this._hotspots = def.hotspots
  }

  // ---------------------------------------------------------------------------
  // Read-only state
  // ---------------------------------------------------------------------------

  get visitedCount(): number {
    return this._visited.size
  }

  get isComplete(): boolean {
    return this._complete
  }

  get hotspotCount(): number {
    return this._hotspots.length
  }

  isVisited(hotspotId: string): boolean {
    return this._visited.has(hotspotId)
  }

  getHotspotById(id: string): DiagramHotspot | null {
    return this._hotspots.find(h => h.id === id) ?? null
  }

  // ---------------------------------------------------------------------------
  // User interaction
  // ---------------------------------------------------------------------------

  /**
   * Called when the learner clicks a hotspot sprite.
   *
   * @returns The hotspot description string to display in a tooltip/popup,
   *          or null if the id is not found.
   */
  handleHotspotClick(hotspotId: string): string | null {
    if (this._complete) return null

    const hotspot = this.getHotspotById(hotspotId)
    if (!hotspot) return null

    if (!this._visited.has(hotspotId)) {
      this._visited.add(hotspotId)
      this._maybeRecordScore(hotspot)

      if (this._visited.size >= this._hotspots.length) {
        this._complete = true
      }
    }

    return hotspot.description
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _maybeRecordScore(hotspot: DiagramHotspot): void {
    // Only score when isCorrect is explicitly set (diagram author opted in)
    if (!this.controller.isScored() || hotspot.isCorrect === undefined) return

    const correct = hotspot.isCorrect === true
    const score   = this.controller.getStepScore(correct, 1)
    this.tracker.addStep(hotspot.id, score, 1)
  }
}
