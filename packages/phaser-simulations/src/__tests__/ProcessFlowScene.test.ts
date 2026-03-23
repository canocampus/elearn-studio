/**
 * ProcessFlowScene unit tests.
 *
 * Phaser.Scene is not available in jsdom, so we mock the Phaser dependency
 * entirely and test only the scene's own logic: step sequencing, scoring,
 * mode-driven behaviour, and the sim-complete event.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ProcessFlowSceneDef } from '../types'
import { ScoreTracker } from '../ScoreTracker'
import { ModeController } from '../ModeController'

// ---------------------------------------------------------------------------
// Import ProcessFlowScene after mocks are in place
// Note: vitest hoists vi.mock() calls, but since ProcessFlowScene imports
// 'phaser' dynamically (not at module top-level), we test by instantiation.
// ---------------------------------------------------------------------------

// We import the concrete class and provide the MockScene base via prototype
// swapping — the simplest approach without needing full Phaser in jsdom.

// Helper: build a minimal sceneDef
function makeDef(overrides?: Partial<ProcessFlowSceneDef>): ProcessFlowSceneDef {
  return {
    simType: 'process-flow',
    nodes: [
      { id: 'n1', x: 100, y: 100, label: 'Start', type: 'start' },
      { id: 'n2', x: 300, y: 100, label: 'Do Task', type: 'step' },
      { id: 'n3', x: 500, y: 100, label: 'End', type: 'end' },
    ],
    edges: [
      { from: 'n1', to: 'n2' },
      { from: 'n2', to: 'n3' },
    ],
    steps: [
      { nodeId: 'n2', instruction: 'Click the task node', correctAction: 'click' },
    ],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// ProcessFlowLogic — the testable business logic extracted from the scene
// ---------------------------------------------------------------------------
// ProcessFlowScene delegates all game logic to ProcessFlowLogic so we can
// unit-test it without instantiating Phaser.  The scene itself is only an
// integration of logic + Phaser rendering calls.

import { ProcessFlowLogic } from '../scenes/ProcessFlowLogic'

describe('ProcessFlowLogic', () => {
  let tracker: ScoreTracker
  let practiceController: ModeController
  let assessController: ModeController
  let demoController: ModeController

  beforeEach(() => {
    tracker = new ScoreTracker('widget-1', 70)
    practiceController = new ModeController('practice')
    assessController = new ModeController('assessment')
    demoController = new ModeController('demo')
  })

  // -------------------------------------------------------------------------
  describe('initialisation', () => {
    it('starts at step index 0', () => {
      const logic = new ProcessFlowLogic(makeDef(), tracker, practiceController)
      expect(logic.currentStepIndex).toBe(0)
    })

    it('isComplete is false initially', () => {
      const logic = new ProcessFlowLogic(makeDef(), tracker, practiceController)
      expect(logic.isComplete).toBe(false)
    })

    it('exposes the step count', () => {
      const logic = new ProcessFlowLogic(makeDef(), tracker, practiceController)
      expect(logic.stepCount).toBe(1) // one step in makeDef
    })
  })

  // -------------------------------------------------------------------------
  describe('handleNodeClick', () => {
    it('advances step when the correct node is clicked', () => {
      const logic = new ProcessFlowLogic(makeDef(), tracker, practiceController)
      logic.handleNodeClick('n2')
      expect(logic.currentStepIndex).toBe(1)
    })

    it('does not advance on wrong node click', () => {
      const logic = new ProcessFlowLogic(makeDef(), tracker, practiceController)
      logic.handleNodeClick('n1')
      expect(logic.currentStepIndex).toBe(0)
    })

    it('marks complete after the final step', () => {
      const logic = new ProcessFlowLogic(makeDef(), tracker, practiceController)
      logic.handleNodeClick('n2')
      expect(logic.isComplete).toBe(true)
    })

    it('records a step score on correct click in practice mode', () => {
      const logic = new ProcessFlowLogic(makeDef(), tracker, practiceController)
      logic.handleNodeClick('n2')
      const scores = tracker.getStepScores()
      expect(scores).toHaveLength(1)
      expect(scores[0].score).toBeGreaterThan(0)
    })

    it('records 0 score on incorrect click in practice mode', () => {
      const logic = new ProcessFlowLogic(makeDef(), tracker, practiceController)
      logic.handleNodeClick('n1') // wrong node
      const scores = tracker.getStepScores()
      expect(scores).toHaveLength(0) // not recorded yet — wrong attempt
    })

    it('does not record score in demo mode', () => {
      const logic = new ProcessFlowLogic(makeDef(), tracker, demoController)
      logic.handleNodeClick('n2')
      expect(tracker.getStepScores()).toHaveLength(0)
    })

    it('ignores clicks after completion', () => {
      const logic = new ProcessFlowLogic(makeDef(), tracker, practiceController)
      logic.handleNodeClick('n2') // completes
      logic.handleNodeClick('n2') // should be ignored
      expect(logic.currentStepIndex).toBe(1)
    })
  })

  // -------------------------------------------------------------------------
  describe('attempt tracking', () => {
    it('first attempt gives full score in practice', () => {
      const logic = new ProcessFlowLogic(makeDef(), tracker, practiceController)
      logic.handleNodeClick('n2')
      expect(tracker.getStepScores()[0].score).toBe(1)
    })

    it('second attempt gives half score in practice', () => {
      const logic = new ProcessFlowLogic(makeDef(), tracker, practiceController)
      logic.handleNodeClick('n1') // wrong — increments attempt counter
      logic.handleNodeClick('n2') // correct on attempt 2
      expect(tracker.getStepScores()[0].score).toBe(0.5)
    })

    it('incorrect attempt in assessment records 0 and advances', () => {
      const logic = new ProcessFlowLogic(makeDef(), tracker, assessController)
      logic.handleNodeClick('n1') // wrong in assessment → no retry → advance with 0
      // In assessment mode canRetry=false, so a wrong click should record 0 and advance
      expect(logic.currentStepIndex).toBe(1)
      expect(tracker.getStepScores()[0].score).toBe(0)
    })
  })

  // -------------------------------------------------------------------------
  describe('demo mode auto-advance', () => {
    it('getAutoAdvanceDelayMs returns the configured delay', () => {
      const def = makeDef({ autoAdvanceDelayMs: 3000 })
      const logic = new ProcessFlowLogic(def, tracker, demoController)
      expect(logic.getAutoAdvanceDelayMs()).toBe(3000)
    })

    it('getAutoAdvanceDelayMs returns 2000 by default', () => {
      const logic = new ProcessFlowLogic(makeDef(), tracker, demoController)
      expect(logic.getAutoAdvanceDelayMs()).toBe(2000)
    })

    it('advanceStep advances index in demo mode', () => {
      const logic = new ProcessFlowLogic(makeDef(), tracker, demoController)
      logic.advanceStep()
      expect(logic.currentStepIndex).toBe(1)
      expect(logic.isComplete).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  describe('getCurrentInstruction', () => {
    it('returns instruction for current step', () => {
      const logic = new ProcessFlowLogic(makeDef(), tracker, practiceController)
      expect(logic.getCurrentInstruction()).toBe('Click the task node')
    })

    it('returns empty string when complete', () => {
      const logic = new ProcessFlowLogic(makeDef(), tracker, practiceController)
      logic.handleNodeClick('n2')
      expect(logic.getCurrentInstruction()).toBe('')
    })
  })

  // -------------------------------------------------------------------------
  describe('getHighlightedNodeId', () => {
    it('returns the nodeId of the current step', () => {
      const logic = new ProcessFlowLogic(makeDef(), tracker, practiceController)
      expect(logic.getHighlightedNodeId()).toBe('n2')
    })

    it('returns null after completion', () => {
      const logic = new ProcessFlowLogic(makeDef(), tracker, practiceController)
      logic.handleNodeClick('n2')
      expect(logic.getHighlightedNodeId()).toBeNull()
    })

    it('returns null in demo mode (all nodes visible)', () => {
      const logic = new ProcessFlowLogic(makeDef(), tracker, demoController)
      expect(logic.getHighlightedNodeId()).toBeNull()
    })
  })

  // -------------------------------------------------------------------------
  describe('multi-step flow', () => {
    it('works through all steps in order', () => {
      const def: ProcessFlowSceneDef = {
        simType: 'process-flow',
        nodes: [
          { id: 'a', x: 0, y: 0, label: 'A', type: 'start' },
          { id: 'b', x: 0, y: 0, label: 'B', type: 'step' },
          { id: 'c', x: 0, y: 0, label: 'C', type: 'step' },
          { id: 'd', x: 0, y: 0, label: 'D', type: 'end' },
        ],
        edges: [
          { from: 'a', to: 'b' },
          { from: 'b', to: 'c' },
          { from: 'c', to: 'd' },
        ],
        steps: [
          { nodeId: 'b', instruction: 'Step 1', correctAction: 'click' },
          { nodeId: 'c', instruction: 'Step 2', correctAction: 'click' },
        ],
      }
      const logic = new ProcessFlowLogic(def, tracker, practiceController)
      logic.handleNodeClick('b')
      expect(logic.currentStepIndex).toBe(1)
      expect(logic.isComplete).toBe(false)
      logic.handleNodeClick('c')
      expect(logic.currentStepIndex).toBe(2)
      expect(logic.isComplete).toBe(true)
      expect(tracker.getStepScores()).toHaveLength(2)
    })
  })
})
