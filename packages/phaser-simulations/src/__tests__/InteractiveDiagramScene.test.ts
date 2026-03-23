/**
 * InteractiveDiagramLogic unit tests.
 *
 * Tests hotspot interaction, scoring, mode behaviour, and completion.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import type { InteractiveDiagramSceneDef } from '../types'
import { ScoreTracker } from '../ScoreTracker'
import { ModeController } from '../ModeController'
import { InteractiveDiagramLogic } from '../scenes/InteractiveDiagramLogic'

function makeDef(overrides?: Partial<InteractiveDiagramSceneDef>): InteractiveDiagramSceneDef {
  return {
    simType: 'interactive-diagram',
    backgroundImageUrl: 'https://example.com/diagram.png',
    hotspots: [
      { id: 'h1', x: 100, y: 100, radius: 20, label: 'CPU',  description: 'Central processing unit', isCorrect: true },
      { id: 'h2', x: 200, y: 100, radius: 20, label: 'RAM',  description: 'Random access memory',    isCorrect: false },
      { id: 'h3', x: 300, y: 100, radius: 20, label: 'Disk', description: 'Hard disk drive',         isCorrect: true },
    ],
    ...overrides,
  }
}

describe('InteractiveDiagramLogic', () => {
  let tracker: ScoreTracker
  let practiceCtrl: ModeController
  let assessCtrl: ModeController
  let demoCtrl: ModeController

  beforeEach(() => {
    tracker      = new ScoreTracker('w1', 70)
    practiceCtrl = new ModeController('practice')
    assessCtrl   = new ModeController('assessment')
    demoCtrl     = new ModeController('demo')
  })

  // -------------------------------------------------------------------------
  describe('initialisation', () => {
    it('starts with no hotspot visited', () => {
      const logic = new InteractiveDiagramLogic(makeDef(), tracker, practiceCtrl)
      expect(logic.visitedCount).toBe(0)
    })

    it('isComplete is false initially', () => {
      const logic = new InteractiveDiagramLogic(makeDef(), tracker, practiceCtrl)
      expect(logic.isComplete).toBe(false)
    })

    it('exposes hotspot count', () => {
      const logic = new InteractiveDiagramLogic(makeDef(), tracker, practiceCtrl)
      expect(logic.hotspotCount).toBe(3)
    })
  })

  // -------------------------------------------------------------------------
  describe('handleHotspotClick', () => {
    it('marks hotspot as visited on click', () => {
      const logic = new InteractiveDiagramLogic(makeDef(), tracker, practiceCtrl)
      logic.handleHotspotClick('h1')
      expect(logic.isVisited('h1')).toBe(true)
    })

    it('does not double-count repeated clicks on same hotspot', () => {
      const logic = new InteractiveDiagramLogic(makeDef(), tracker, practiceCtrl)
      logic.handleHotspotClick('h1')
      logic.handleHotspotClick('h1')
      expect(logic.visitedCount).toBe(1)
    })

    it('completes when all hotspots are clicked', () => {
      const logic = new InteractiveDiagramLogic(makeDef(), tracker, practiceCtrl)
      logic.handleHotspotClick('h1')
      logic.handleHotspotClick('h2')
      logic.handleHotspotClick('h3')
      expect(logic.isComplete).toBe(true)
    })

    it('returns the description for the clicked hotspot', () => {
      const logic = new InteractiveDiagramLogic(makeDef(), tracker, practiceCtrl)
      const desc = logic.handleHotspotClick('h1')
      expect(desc).toBe('Central processing unit')
    })

    it('returns null for unknown hotspot id', () => {
      const logic = new InteractiveDiagramLogic(makeDef(), tracker, practiceCtrl)
      const desc = logic.handleHotspotClick('unknown')
      expect(desc).toBeNull()
    })

    it('ignores clicks after completion', () => {
      const logic = new InteractiveDiagramLogic(makeDef(), tracker, practiceCtrl)
      logic.handleHotspotClick('h1')
      logic.handleHotspotClick('h2')
      logic.handleHotspotClick('h3') // completes
      logic.handleHotspotClick('h1') // ignored
      expect(logic.visitedCount).toBe(3)
    })
  })

  // -------------------------------------------------------------------------
  describe('scoring in practice mode', () => {
    it('records score for a correct hotspot (isCorrect=true)', () => {
      const logic = new InteractiveDiagramLogic(makeDef(), tracker, practiceCtrl)
      logic.handleHotspotClick('h1') // isCorrect=true
      expect(tracker.getStepScores()).toHaveLength(1)
      expect(tracker.getStepScores()[0].score).toBe(1)
      expect(tracker.getStepScores()[0].maxScore).toBe(1)
    })

    it('records 0 score for an incorrect hotspot (isCorrect=false)', () => {
      const logic = new InteractiveDiagramLogic(makeDef(), tracker, practiceCtrl)
      logic.handleHotspotClick('h2') // isCorrect=false
      expect(tracker.getStepScores()[0].score).toBe(0)
    })

    it('hotspots without isCorrect are treated as neutral (not scored)', () => {
      const def = makeDef({
        hotspots: [
          { id: 'h1', x: 0, y: 0, radius: 20, label: 'A', description: 'desc A' }, // no isCorrect
        ],
      })
      const logic = new InteractiveDiagramLogic(def, tracker, practiceCtrl)
      logic.handleHotspotClick('h1')
      expect(tracker.getStepScores()).toHaveLength(0)
    })
  })

  // -------------------------------------------------------------------------
  describe('scoring in assessment mode', () => {
    it('records full score for correct hotspot on first click', () => {
      const logic = new InteractiveDiagramLogic(makeDef(), tracker, assessCtrl)
      logic.handleHotspotClick('h1') // isCorrect=true
      expect(tracker.getStepScores()[0].score).toBe(1)
    })

    it('records 0 for incorrect hotspot', () => {
      const logic = new InteractiveDiagramLogic(makeDef(), tracker, assessCtrl)
      logic.handleHotspotClick('h2') // isCorrect=false
      expect(tracker.getStepScores()[0].score).toBe(0)
    })
  })

  // -------------------------------------------------------------------------
  describe('no scoring in demo mode', () => {
    it('does not record step scores in demo mode', () => {
      const logic = new InteractiveDiagramLogic(makeDef(), tracker, demoCtrl)
      logic.handleHotspotClick('h1')
      logic.handleHotspotClick('h2')
      logic.handleHotspotClick('h3')
      expect(tracker.getStepScores()).toHaveLength(0)
    })
  })

  // -------------------------------------------------------------------------
  describe('getHotspotById', () => {
    it('returns the hotspot for a known id', () => {
      const logic = new InteractiveDiagramLogic(makeDef(), tracker, practiceCtrl)
      const hs = logic.getHotspotById('h2')
      expect(hs?.label).toBe('RAM')
    })

    it('returns null for unknown id', () => {
      const logic = new InteractiveDiagramLogic(makeDef(), tracker, practiceCtrl)
      expect(logic.getHotspotById('nope')).toBeNull()
    })
  })

  // -------------------------------------------------------------------------
  describe('completion', () => {
    it('isComplete becomes true after all hotspots visited', () => {
      const logic = new InteractiveDiagramLogic(makeDef(), tracker, practiceCtrl)
      for (const hs of makeDef().hotspots) logic.handleHotspotClick(hs.id)
      expect(logic.isComplete).toBe(true)
    })

    it('visitedCount matches hotspotCount on completion', () => {
      const logic = new InteractiveDiagramLogic(makeDef(), tracker, practiceCtrl)
      for (const hs of makeDef().hotspots) logic.handleHotspotClick(hs.id)
      expect(logic.visitedCount).toBe(logic.hotspotCount)
    })
  })
})
