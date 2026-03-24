/**
 * Unit tests for T041 — SCORM 2004 support in runtime-player
 * Tests the ScormAdapter dual-version reporting behaviour.
 *
 * NOTE: createScormAdapter and scormReport are not exported; we test
 * the observable side-effects via an injected mock API on window.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Minimal SCORM 2004 API mock (window.API_1484_11) */
function makeScorm2004Api(store: Record<string, string> = {}) {
  return {
    Initialize: vi.fn(() => 'true'),
    Terminate: vi.fn(() => 'true'),
    GetValue: vi.fn((key: string) => store[key] ?? ''),
    SetValue: vi.fn((key: string, value: string) => { store[key] = value; return 'true' }),
    Commit: vi.fn(() => 'true'),
    GetLastError: vi.fn(() => '0'),
  }
}

/** Minimal SCORM 1.2 API mock (window.API) */
function makeScorm12Api(store: Record<string, string> = {}) {
  return {
    LMSInitialize: vi.fn(() => 'true'),
    LMSFinish: vi.fn(() => 'true'),
    LMSGetValue: vi.fn((key: string) => store[key] ?? ''),
    LMSSetValue: vi.fn((key: string, value: string) => { store[key] = value; return 'true' }),
    LMSCommit: vi.fn(() => 'true'),
    LMSGetLastError: vi.fn(() => '0'),
  }
}

// ─── ScormAdapter — version detection ────────────────────────────────────────

describe('createScormAdapter — version detection', () => {
  beforeEach(() => {
    // Clean up window globals between tests
    // @ts-expect-error test cleanup
    delete window.API_1484_11
    // @ts-expect-error test cleanup
    delete window.API
  })

  it('detects SCORM 2004 when API_1484_11 is present', async () => {
    const api2004 = makeScorm2004Api()
    // @ts-expect-error injecting LMS mock
    window.API_1484_11 = api2004

    // Dynamically import to pick up latest module state
    const { init } = await import('../index')
    const container = document.createElement('div')
    container.id = 'test-container-2004-detect'
    document.body.appendChild(container)

    const course = {
      _id: 'c1', title: 'Test', slides: [{ id: 's1', title: 'S1', widgets: [] }],
      settings: { width: 1024, height: 768, passingScore: 80 },
      metadata: { identifier: 'T', masteryScore: 80 },
    }

    init('test-container-2004-detect', course)
    expect(api2004.Initialize).toHaveBeenCalledWith('')
    document.body.removeChild(container)
  })

  it('detects SCORM 1.2 when only window.API is present', async () => {
    const api12 = makeScorm12Api()
    // @ts-expect-error injecting LMS mock
    window.API = api12

    const { init } = await import('../index')
    const container = document.createElement('div')
    container.id = 'test-container-12-detect'
    document.body.appendChild(container)

    const course = {
      _id: 'c2', title: 'Test', slides: [{ id: 's1', title: 'S1', widgets: [] }],
      settings: { width: 1024, height: 768, passingScore: 80 },
      metadata: { identifier: 'T', masteryScore: 80 },
    }

    init('test-container-12-detect', course)
    expect(api12.LMSInitialize).toHaveBeenCalledWith('')
    document.body.removeChild(container)
  })

  it('prefers SCORM 2004 over 1.2 when both are present', async () => {
    const api2004 = makeScorm2004Api()
    const api12 = makeScorm12Api()
    // @ts-expect-error injecting LMS mock
    window.API_1484_11 = api2004
    // @ts-expect-error injecting LMS mock
    window.API = api12

    const { init } = await import('../index')
    const container = document.createElement('div')
    container.id = 'test-container-both'
    document.body.appendChild(container)

    const course = {
      _id: 'c3', title: 'Test', slides: [{ id: 's1', title: 'S1', widgets: [] }],
      settings: { width: 1024, height: 768, passingScore: 80 },
      metadata: { identifier: 'T', masteryScore: 80 },
    }

    init('test-container-both', course)
    expect(api2004.Initialize).toHaveBeenCalledWith('')
    expect(api12.LMSInitialize).not.toHaveBeenCalled()
    document.body.removeChild(container)
  })
})

// ─── SCORM 2004 CMI fields ─────────────────────────────────────────────────────

describe('SCORM 2004 CMI field mapping', () => {
  beforeEach(() => {
    // @ts-expect-error test cleanup
    delete window.API_1484_11
    // @ts-expect-error test cleanup
    delete window.API
  })

  it('writes cmi.score.raw (not cmi.core.score.raw) on slide navigation', async () => {
    const store: Record<string, string> = {}
    const api2004 = makeScorm2004Api(store)
    // @ts-expect-error injecting LMS mock
    window.API_1484_11 = api2004

    const { init } = await import('../index')
    const container = document.createElement('div')
    container.id = 'test-cmi-score-raw'
    document.body.appendChild(container)

    init('test-cmi-score-raw', {
      _id: 'c4', title: 'T', slides: [{ id: 's1', title: 'S1', widgets: [] }],
      settings: { width: 1024, height: 768, passingScore: 80 },
      metadata: { identifier: 'T', masteryScore: 80 },
    })

    const setValueCalls = api2004.SetValue.mock.calls.map(([k]: string[]) => k)
    expect(setValueCalls).toContain('cmi.score.raw')
    expect(setValueCalls).not.toContain('cmi.core.score.raw')
    document.body.removeChild(container)
  })

  it('writes cmi.completion_status and cmi.success_status (not cmi.core.lesson_status)', async () => {
    const store: Record<string, string> = {}
    const api2004 = makeScorm2004Api(store)
    // @ts-expect-error injecting LMS mock
    window.API_1484_11 = api2004

    const { init } = await import('../index')
    const container = document.createElement('div')
    container.id = 'test-cmi-status'
    document.body.appendChild(container)

    init('test-cmi-status', {
      _id: 'c5', title: 'T', slides: [{ id: 's1', title: 'S1', widgets: [] }],
      settings: { width: 1024, height: 768, passingScore: 80 },
      metadata: { identifier: 'T', masteryScore: 80 },
    })

    const setValueCalls = api2004.SetValue.mock.calls.map(([k]: string[]) => k)
    expect(setValueCalls).toContain('cmi.completion_status')
    expect(setValueCalls).toContain('cmi.success_status')
    expect(setValueCalls).not.toContain('cmi.core.lesson_status')
    document.body.removeChild(container)
  })

  it('writes cmi.location (not cmi.core.lesson_location)', async () => {
    const store: Record<string, string> = {}
    const api2004 = makeScorm2004Api(store)
    // @ts-expect-error injecting LMS mock
    window.API_1484_11 = api2004

    const { init } = await import('../index')
    const container = document.createElement('div')
    container.id = 'test-cmi-location'
    document.body.appendChild(container)

    init('test-cmi-location', {
      _id: 'c6', title: 'T', slides: [{ id: 's1', title: 'S1', widgets: [] }],
      settings: { width: 1024, height: 768, passingScore: 80 },
      metadata: { identifier: 'T', masteryScore: 80 },
    })

    const setValueCalls = api2004.SetValue.mock.calls.map(([k]: string[]) => k)
    expect(setValueCalls).toContain('cmi.location')
    expect(setValueCalls).not.toContain('cmi.core.lesson_location')
    document.body.removeChild(container)
  })

  it('writes cmi.score.scaled in range [0.0, 1.0]', async () => {
    const store: Record<string, string> = {}
    const api2004 = makeScorm2004Api(store)
    // @ts-expect-error injecting LMS mock
    window.API_1484_11 = api2004

    const { init } = await import('../index')
    const container = document.createElement('div')
    container.id = 'test-cmi-scaled'
    document.body.appendChild(container)

    init('test-cmi-scaled', {
      _id: 'c7', title: 'T', slides: [{ id: 's1', title: 'S1', widgets: [] }],
      settings: { width: 1024, height: 768, passingScore: 80 },
      metadata: { identifier: 'T', masteryScore: 80 },
    })

    const scaledValue = parseFloat(store['cmi.score.scaled'] ?? '0')
    expect(scaledValue).toBeGreaterThanOrEqual(0)
    expect(scaledValue).toBeLessThanOrEqual(1)
    document.body.removeChild(container)
  })
})

// ─── success_status value correctness (T041-H002) ────────────────────────────
//
// SCORM 2004 spec:
//   success_status = 'unknown'  when completion_status = 'incomplete'
//   success_status = 'passed'   when completed AND score >= passMark
//   success_status = 'failed'   when completed AND score <  passMark

describe('SCORM 2004 success_status values', () => {
  beforeEach(() => {
    // @ts-expect-error test cleanup
    delete window.API_1484_11
    // @ts-expect-error test cleanup
    delete window.API
  })

  it('sets success_status = "unknown" on initial (incomplete) report', async () => {
    const store: Record<string, string> = {}
    const api2004 = makeScorm2004Api(store)
    // @ts-expect-error injecting LMS mock
    window.API_1484_11 = api2004

    const { init } = await import('../index')
    const container = document.createElement('div')
    container.id = 'test-ss-unknown'
    document.body.appendChild(container)

    init('test-ss-unknown', {
      _id: 'ss1', title: 'T', slides: [{ id: 's1', title: 'S1', widgets: [] }],
      settings: { width: 1024, height: 768, passingScore: 80 },
      metadata: { identifier: 'T', masteryScore: 80 },
    })

    // After init, the first scormReport is called with 'incomplete'
    expect(store['cmi.success_status']).toBe('unknown')
    expect(store['cmi.completion_status']).toBe('incomplete')
    document.body.removeChild(container)
  })

  it('sets success_status = "passed" when finishCourse called with score >= passMark', async () => {
    const store: Record<string, string> = {}
    const api2004 = makeScorm2004Api(store)
    // @ts-expect-error injecting LMS mock
    window.API_1484_11 = api2004

    const { init } = await import('../index')
    const container = document.createElement('div')
    container.id = 'test-ss-passed'
    document.body.appendChild(container)

    // passMark = 0 → any score (including 0 from no questions) passes
    init('test-ss-passed', {
      _id: 'ss2', title: 'T', slides: [{ id: 's1', title: 'S1', widgets: [] }],
      settings: { width: 1024, height: 768, passingScore: 0 },
      metadata: { identifier: 'T', masteryScore: 0 },
    })

    // Simulate finish button click
    const finishBtn = document.createElement('button')
    finishBtn.dataset.action = 'finish'
    container.appendChild(finishBtn)
    finishBtn.click()

    expect(store['cmi.success_status']).toBe('passed')
    expect(store['cmi.completion_status']).toBe('completed')
    document.body.removeChild(container)
  })

  it('sets success_status = "failed" when finishCourse called with score < passMark', async () => {
    const store: Record<string, string> = {}
    const api2004 = makeScorm2004Api(store)
    // @ts-expect-error injecting LMS mock
    window.API_1484_11 = api2004

    const { init } = await import('../index')
    const container = document.createElement('div')
    container.id = 'test-ss-failed'
    document.body.appendChild(container)

    // passMark = 100 → score 0 (no questions answered) fails
    init('test-ss-failed', {
      _id: 'ss3', title: 'T', slides: [{ id: 's1', title: 'S1', widgets: [] }],
      settings: { width: 1024, height: 768, passingScore: 100 },
      metadata: { identifier: 'T', masteryScore: 100 },
    })

    // Simulate finish button click
    const finishBtn = document.createElement('button')
    finishBtn.dataset.action = 'finish'
    container.appendChild(finishBtn)
    finishBtn.click()

    expect(store['cmi.success_status']).toBe('failed')
    expect(store['cmi.completion_status']).toBe('completed')
    document.body.removeChild(container)
  })
})

// ─── SCORM 1.2 CMI fields (regression) ───────────────────────────────────────

describe('SCORM 1.2 CMI field mapping (regression)', () => {
  beforeEach(() => {
    // @ts-expect-error test cleanup
    delete window.API_1484_11
    // @ts-expect-error test cleanup
    delete window.API
  })

  it('writes cmi.core.score.raw (not cmi.score.raw)', async () => {
    const store: Record<string, string> = {}
    const api12 = makeScorm12Api(store)
    // @ts-expect-error injecting LMS mock
    window.API = api12

    const { init } = await import('../index')
    const container = document.createElement('div')
    container.id = 'test-12-score-raw'
    document.body.appendChild(container)

    init('test-12-score-raw', {
      _id: 'c8', title: 'T', slides: [{ id: 's1', title: 'S1', widgets: [] }],
      settings: { width: 1024, height: 768, passingScore: 80 },
      metadata: { identifier: 'T', masteryScore: 80 },
    })

    const setValueCalls = api12.LMSSetValue.mock.calls.map(([k]: string[]) => k)
    expect(setValueCalls).toContain('cmi.core.score.raw')
    expect(setValueCalls).not.toContain('cmi.score.raw')
    document.body.removeChild(container)
  })

  it('writes cmi.core.lesson_status (not cmi.completion_status)', async () => {
    const store: Record<string, string> = {}
    const api12 = makeScorm12Api(store)
    // @ts-expect-error injecting LMS mock
    window.API = api12

    const { init } = await import('../index')
    const container = document.createElement('div')
    container.id = 'test-12-lesson-status'
    document.body.appendChild(container)

    init('test-12-lesson-status', {
      _id: 'c9', title: 'T', slides: [{ id: 's1', title: 'S1', widgets: [] }],
      settings: { width: 1024, height: 768, passingScore: 80 },
      metadata: { identifier: 'T', masteryScore: 80 },
    })

    const setValueCalls = api12.LMSSetValue.mock.calls.map(([k]: string[]) => k)
    expect(setValueCalls).toContain('cmi.core.lesson_status')
    expect(setValueCalls).not.toContain('cmi.completion_status')
    document.body.removeChild(container)
  })
})
