/**
 * TD-014.9 — Zustand recorderStore tests.
 *
 * Mocks `../api/recorderApi` so the store is exercised without a live
 * simulation-engine. The tests assert:
 *   - initial state
 *   - start/capture/stop happy paths (activeSessionId, recording flag, captures)
 *   - error paths (error message set, isBusy reset)
 *   - concurrency guards (start is a no-op while recording, capture/stop
 *     no-op without an active session)
 *   - reset returns to the initial shape
 *   - activeSessionId persists after a successful stop (caller still needs it
 *     to call importSimulation, per TD-014.11 flow)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SimStep, Session, StartRecordingResponse } from '../types/recorder'

// ── Mocks ────────────────────────────────────────────────────────────────────

const { mockStart, mockCapture, mockStop } = vi.hoisted(() => ({
  mockStart:   vi.fn(),
  mockCapture: vi.fn(),
  mockStop:    vi.fn(),
}))

vi.mock('../api/recorderApi', () => ({
  startRecording: mockStart,
  captureStep:    mockCapture,
  stopRecording:  mockStop,
}))

// Import after mocks so the store picks up the mocked module.
import { useRecorderStore } from '../store/recorderStore'

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeStep(i: number): SimStep {
  return {
    id: `step-${i}`,
    order: i,
    eventType: 'click',
    selector: 'button',
    description: `Click ${i}`,
    screenshotKey: `recordings/sess/screenshots/step-${i}.png`,
    timestamp: '2026-04-24T00:00:00.000Z',
  }
}

const startOk: StartRecordingResponse = {
  sessionId: 'sess-abc',
  status: 'recording',
  startedAt: '2026-04-24T00:00:00.000Z',
}

const stoppedSession: Session = {
  id: 'sess-abc',
  url: 'https://example.com',
  title: 'Example',
  status: 'finished',
  startedAt: '2026-04-24T00:00:00.000Z',
  finishedAt: '2026-04-24T00:01:00.000Z',
  steps: [makeStep(0), makeStep(1)],
}

function resetStore() {
  useRecorderStore.getState().reset()
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('recorderStore — initial state', () => {
  beforeEach(() => {
    resetStore()
    vi.clearAllMocks()
  })

  it('starts with activeSessionId=null, recording=false, empty captures, no error, not busy', () => {
    const s = useRecorderStore.getState()
    expect(s.activeSessionId).toBeNull()
    expect(s.recording).toBe(false)
    expect(s.captures).toEqual([])
    expect(s.error).toBeNull()
    expect(s.isBusy).toBe(false)
  })
})

describe('recorderStore — start()', () => {
  beforeEach(() => {
    resetStore()
    vi.clearAllMocks()
  })

  it('sets activeSessionId + recording=true + clears captures + clears error on success', async () => {
    mockStart.mockResolvedValue(startOk)
    // Pre-populate to verify clear-on-start
    useRecorderStore.setState({ captures: [makeStep(99)], error: 'old' })

    await useRecorderStore.getState().start('https://example.com', 'Example')

    const s = useRecorderStore.getState()
    expect(s.activeSessionId).toBe('sess-abc')
    expect(s.recording).toBe(true)
    expect(s.captures).toEqual([])
    expect(s.error).toBeNull()
    expect(s.isBusy).toBe(false)
    expect(mockStart).toHaveBeenCalledWith('https://example.com', 'Example')
  })

  it('sets error message + stays not-recording on failure', async () => {
    mockStart.mockRejectedValue(new Error('SSRF: localhost'))

    await useRecorderStore.getState().start('http://localhost:3000')

    const s = useRecorderStore.getState()
    expect(s.activeSessionId).toBeNull()
    expect(s.recording).toBe(false)
    expect(s.error).toBe('SSRF: localhost')
    expect(s.isBusy).toBe(false)
  })

  it('narrows non-Error throws to a string message', async () => {
    mockStart.mockRejectedValue('plain string error')
    await useRecorderStore.getState().start('https://example.com')
    expect(useRecorderStore.getState().error).toBe('plain string error')
  })

  it('is a no-op while already recording (does not call backend again)', async () => {
    mockStart.mockResolvedValue(startOk)
    await useRecorderStore.getState().start('https://example.com')
    expect(mockStart).toHaveBeenCalledTimes(1)

    await useRecorderStore.getState().start('https://other.com')
    expect(mockStart).toHaveBeenCalledTimes(1)
    expect(useRecorderStore.getState().activeSessionId).toBe('sess-abc')
  })

  it('is a no-op while isBusy (prevents duplicate calls from racing clicks)', async () => {
    // Never-resolving promise: simulates an in-flight call.
    let release: (v: StartRecordingResponse) => void = () => undefined
    mockStart.mockImplementationOnce(
      () => new Promise<StartRecordingResponse>((resolve) => { release = resolve }),
    )
    const p1 = useRecorderStore.getState().start('https://example.com')
    expect(useRecorderStore.getState().isBusy).toBe(true)

    await useRecorderStore.getState().start('https://example2.com')
    expect(mockStart).toHaveBeenCalledTimes(1)

    // Release so the first call finishes and subsequent tests aren't affected.
    release(startOk)
    await p1
  })
})

describe('recorderStore — capture()', () => {
  beforeEach(async () => {
    resetStore()
    vi.clearAllMocks()
    mockStart.mockResolvedValue(startOk)
    await useRecorderStore.getState().start('https://example.com')
    vi.clearAllMocks() // reset the call-count after setup
  })

  it('replaces captures with the returned step list', async () => {
    mockCapture.mockResolvedValue({ steps: [makeStep(0), makeStep(1), makeStep(2)] })
    await useRecorderStore.getState().capture()
    expect(useRecorderStore.getState().captures).toHaveLength(3)
    expect(mockCapture).toHaveBeenCalledWith('sess-abc')
  })

  it('sets error on failure without mutating previous captures', async () => {
    // Seed a prior capture so we can verify it is NOT cleared.
    useRecorderStore.setState({ captures: [makeStep(0)] })
    mockCapture.mockRejectedValue(new Error('Browser not found'))
    await useRecorderStore.getState().capture()

    const s = useRecorderStore.getState()
    expect(s.error).toBe('Browser not found')
    expect(s.captures).toEqual([makeStep(0)])
  })

  it('is a no-op without an active session', async () => {
    resetStore()
    await useRecorderStore.getState().capture()
    expect(mockCapture).not.toHaveBeenCalled()
  })

  it('is a no-op after recording has stopped', async () => {
    useRecorderStore.setState({ recording: false })
    await useRecorderStore.getState().capture()
    expect(mockCapture).not.toHaveBeenCalled()
  })
})

describe('recorderStore — stop()', () => {
  beforeEach(async () => {
    resetStore()
    vi.clearAllMocks()
    mockStart.mockResolvedValue(startOk)
    await useRecorderStore.getState().start('https://example.com')
    vi.clearAllMocks()
  })

  it('returns the persisted Session on success and flips recording=false', async () => {
    mockStop.mockResolvedValue(stoppedSession)
    const result = await useRecorderStore.getState().stop()

    expect(result).toEqual(stoppedSession)
    const s = useRecorderStore.getState()
    expect(s.recording).toBe(false)
    // activeSessionId MUST persist — caller needs it for importSimulation (TD-014.11).
    expect(s.activeSessionId).toBe('sess-abc')
    expect(s.isBusy).toBe(false)
  })

  it('leaves recording=true on failure so the user can retry', async () => {
    mockStop.mockRejectedValue(new Error('Storage unavailable'))
    const result = await useRecorderStore.getState().stop()

    expect(result).toBeUndefined()
    const s = useRecorderStore.getState()
    expect(s.recording).toBe(true)
    expect(s.error).toBe('Storage unavailable')
    expect(s.isBusy).toBe(false)
  })

  it('is a no-op without an active session (returns undefined, does not call backend)', async () => {
    resetStore()
    const result = await useRecorderStore.getState().stop()
    expect(result).toBeUndefined()
    expect(mockStop).not.toHaveBeenCalled()
  })
})

describe('recorderStore — reset()', () => {
  it('returns every field to its initial value', async () => {
    mockStart.mockResolvedValue(startOk)
    await useRecorderStore.getState().start('https://example.com')
    useRecorderStore.setState({ error: 'stale', captures: [makeStep(0)] })

    useRecorderStore.getState().reset()

    const s = useRecorderStore.getState()
    expect(s.activeSessionId).toBeNull()
    expect(s.recording).toBe(false)
    expect(s.captures).toEqual([])
    expect(s.error).toBeNull()
    expect(s.isBusy).toBe(false)
  })
})
