/**
 * Integration test: elearn:widgetScore → questionStates → LMSSetValue — T035-L01
 *
 * Verifies the full SCORM score reporting chain:
 *   Phaser sim dispatches elearn:widgetScore
 *   → index.ts listener updates questionStates
 *   → scormReport() calls LMSSetValue('cmi.core.score.raw', ...)
 *
 * mountPhaserSim and suspend helpers are mocked so the test runs in jsdom
 * without a real Phaser bundle or SCORM LMS.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { init } from '../index'

// Prevent dynamic phaser-bundle.js import from failing in jsdom
vi.mock('../widgets/phaserSimWidget', () => ({
  mountPhaserSim: vi.fn().mockResolvedValue(() => { /* no-op cleanup */ }),
}))

// Prevent restoreSuspendData from attempting SCORM reads during init
vi.mock('../suspend', () => ({
  saveSuspendData: vi.fn().mockReturnValue(true),
  restoreSuspendData: vi.fn().mockReturnValue(false),
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface MockScormApi {
  LMSInitialize: ReturnType<typeof vi.fn>
  LMSFinish: ReturnType<typeof vi.fn>
  LMSGetValue: ReturnType<typeof vi.fn>
  LMSSetValue: ReturnType<typeof vi.fn>
  LMSCommit: ReturnType<typeof vi.fn>
  LMSGetLastError: ReturnType<typeof vi.fn>
}

function makeMockApi(): MockScormApi {
  return {
    LMSInitialize: vi.fn().mockReturnValue('true'),
    LMSFinish: vi.fn().mockReturnValue('true'),
    LMSGetValue: vi.fn().mockReturnValue(''),
    LMSSetValue: vi.fn().mockReturnValue('true'),
    LMSCommit: vi.fn().mockReturnValue('true'),
    LMSGetLastError: vi.fn().mockReturnValue('0'),
  }
}

function makeCourse(widgetId = 'w-phaser-1', passingScore = 70) {
  return {
    _id: 'course-1',
    title: 'SCORM Chain Test',
    slides: [{
      id: 's1',
      title: 'Slide 1',
      widgets: [{
        id: widgetId,
        type: 'phaser-sim',
        bounds: { x: 0, y: 0, width: 800, height: 500 },
        layer: 0,
        visible: true,
        properties: {},
        extendedProperties: {
          simType: 'process-flow',
          mode: 'demo',
          passingScore,
          sceneDef: null,
        },
        actions: [],
      }],
    }],
    settings: { width: 1024, height: 768, passingScore: 80 },
    metadata: { masteryScore: 80 },
  }
}

/** Dispatch elearn:widgetScore with a normalised [0,1] score (as mountPhaserSim does). */
function dispatchScore(widgetId: string, score: unknown): void {
  window.dispatchEvent(new CustomEvent('elearn:widgetScore', {
    detail: { widgetId, score },
  }))
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SCORM score chain: elearn:widgetScore → LMSSetValue', () => {
  let container: HTMLElement
  let mockApi: MockScormApi

  beforeEach(() => {
    container = document.createElement('div')
    container.id = 'test-player'
    document.body.appendChild(container)
    mockApi = makeMockApi()
    ;(window as unknown as Record<string, unknown>).API = mockApi
  })

  afterEach(() => {
    container.remove()
    delete (window as unknown as Record<string, unknown>).API
  })

  it('reports weighted score to SCORM after elearn:widgetScore fires', () => {
    init('test-player', makeCourse('w-phaser-1', 70))
    mockApi.LMSSetValue.mockClear()

    // Normalised score 0.9, weight 70:
    // Math.round((0.9 * 70 / 70) * 100) = 90
    dispatchScore('w-phaser-1', 0.9)

    expect(mockApi.LMSSetValue).toHaveBeenCalledWith('cmi.core.score.raw', '90')
  })

  it('reports 100 when score is 1.0', () => {
    init('test-player', makeCourse())
    mockApi.LMSSetValue.mockClear()

    dispatchScore('w-phaser-1', 1.0)

    expect(mockApi.LMSSetValue).toHaveBeenCalledWith('cmi.core.score.raw', '100')
  })

  it('reports 0 when score is 0', () => {
    init('test-player', makeCourse())
    mockApi.LMSSetValue.mockClear()

    dispatchScore('w-phaser-1', 0)

    expect(mockApi.LMSSetValue).toHaveBeenCalledWith('cmi.core.score.raw', '0')
  })

  it('clamps score above 1.0 to 100', () => {
    init('test-player', makeCourse())
    mockApi.LMSSetValue.mockClear()

    dispatchScore('w-phaser-1', 1.5)

    expect(mockApi.LMSSetValue).toHaveBeenCalledWith('cmi.core.score.raw', '100')
  })

  it('treats NaN score as 0 (NaN guard)', () => {
    init('test-player', makeCourse())
    mockApi.LMSSetValue.mockClear()

    dispatchScore('w-phaser-1', NaN)

    expect(mockApi.LMSSetValue).toHaveBeenCalledWith('cmi.core.score.raw', '0')
  })

  it('treats Infinity score as 0 (Infinity guard)', () => {
    init('test-player', makeCourse())
    mockApi.LMSSetValue.mockClear()

    dispatchScore('w-phaser-1', Infinity)

    expect(mockApi.LMSSetValue).toHaveBeenCalledWith('cmi.core.score.raw', '0')
  })

  it('treats non-numeric score as 0', () => {
    init('test-player', makeCourse())
    mockApi.LMSSetValue.mockClear()

    dispatchScore('w-phaser-1', 'not-a-number')

    expect(mockApi.LMSSetValue).toHaveBeenCalledWith('cmi.core.score.raw', '0')
  })

  it('ignores event with missing widgetId (no SCORM update)', () => {
    init('test-player', makeCourse())
    mockApi.LMSSetValue.mockClear()

    window.dispatchEvent(new CustomEvent('elearn:widgetScore', {
      detail: { score: 0.9 }, // no widgetId field
    }))

    expect(mockApi.LMSSetValue).not.toHaveBeenCalled()
  })

  it('reports lesson_status as incomplete during mid-course scoring', () => {
    init('test-player', makeCourse())
    mockApi.LMSSetValue.mockClear()

    dispatchScore('w-phaser-1', 0.5)

    expect(mockApi.LMSSetValue).toHaveBeenCalledWith('cmi.core.lesson_status', 'incomplete')
  })

  it('also sets score.min and score.max on each report', () => {
    init('test-player', makeCourse())
    mockApi.LMSSetValue.mockClear()

    dispatchScore('w-phaser-1', 0.8)

    expect(mockApi.LMSSetValue).toHaveBeenCalledWith('cmi.core.score.min', '0')
    expect(mockApi.LMSSetValue).toHaveBeenCalledWith('cmi.core.score.max', '100')
  })

  it('commits to SCORM after each score event', () => {
    init('test-player', makeCourse())
    mockApi.LMSCommit.mockClear()

    dispatchScore('w-phaser-1', 0.7)

    expect(mockApi.LMSCommit).toHaveBeenCalledWith('')
  })

  it('does not throw when no SCORM API is present', () => {
    delete (window as unknown as Record<string, unknown>).API

    expect(() => {
      init('test-player', makeCourse())
      dispatchScore('w-phaser-1', 0.9)
    }).not.toThrow()
  })
})
