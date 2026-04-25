/**
 * TD-014.34 — RecorderLiveView stop-semantics tests (F2 resolution).
 *
 * Pins the three-action split (Stop & import / Stop / Discard) and the four
 * implementation invariants captured in
 * `decisions/2026-04-24-recorder-stop-semantics.md`:
 *
 *   (a) stop() failure MUST NOT call reset() — zombie-session prevention
 *   (b) DELETE 404 is silent success (resource already gone)
 *   (c) Stop-preserve toast reports real step count
 *   (d) Discard is leftmost, separated from stop-group by the actionSpacer
 *
 * The file targets behaviour, not styling — DOM-ordering assertion (test 10)
 * is the only structural check, because Implementation Note (d) is the whole
 * reason Option C beats Option B.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { RecorderLiveView } from '../../components/simulation/RecorderLiveView'
import { useRecorderStore } from '../../store/recorderStore'
import { useEditorStore } from '../../store/editorStore'
import { ToastProvider } from '../../components/ui/Toast'
import type { Session, SimStep } from '../../types/recorder'

// ── API mocks ────────────────────────────────────────────────────────────────
//
// We mock at the API boundary (recorderApi.*) rather than patching store
// actions directly — this lets the real recorderStore.stop pipeline run, which
// is where invariant (a) lives (performCourseMutation's onError preserves
// `recording: true` on failure). Patching stop() directly would bypass the
// invariant we're trying to pin.

const { mockStopRecording, mockDeleteSession } = vi.hoisted(() => ({
  mockStopRecording: vi.fn(),
  mockDeleteSession: vi.fn(),
}))

vi.mock('../../api/recorderApi', () => ({
  startRecording:       vi.fn(),
  captureStep:          vi.fn(),
  stopRecording:        mockStopRecording,
  deleteSession:        mockDeleteSession,
  getSession:           vi.fn(),
  listSessions:         vi.fn(),
  getLiveScreenshotUrl: (id: string) => `http://test-live/${id}`,
}))

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeStep(i: number): SimStep {
  return {
    id: `step-${i}`,
    type: 'click',
    x: 0.5,
    y: 0.5,
    timestamp: 1000 + i,
    screenshotKey: `recordings/sess-test/step-${i}.png`,
  }
}

function makeSession(stepCount: number): Session {
  return {
    id: 'sess-test',
    url: 'https://example.com',
    title: 'Test',
    status: 'finished',
    startedAt: '2026-04-24T00:00:00.000Z',
    finishedAt: '2026-04-24T00:01:00.000Z',
    steps: Array.from({ length: stepCount }, (_, i) => makeStep(i)),
  }
}

function seedActiveRecording() {
  useRecorderStore.setState({
    activeSessionId: 'sess-test',
    recording: true,
    captures: [],
    error: null,
    isBusy: false,
  })
}

function wrap(ui: ReactNode) {
  return render(<ToastProvider>{ui}</ToastProvider>)
}

// jsdom provides `window.confirm` that returns false by default; each test
// spies on it to force the branch it needs.
let confirmSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  mockStopRecording.mockReset()
  mockDeleteSession.mockReset()
  useRecorderStore.setState({
    activeSessionId: null, recording: false, captures: [], error: null, isBusy: false,
  })
  useEditorStore.setState({ course: null })
  confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
})

afterEach(() => {
  confirmSpy.mockRestore()
})

// ── Tests ────────────────────────────────────────────────────────────────────

describe('RecorderLiveView — TD-014.34 Stop (preserve) semantics', () => {
  it('1. happy path — stop resolves → deleteSession NOT called, toast /2 steps saved/, reset() fires', async () => {
    mockStopRecording.mockResolvedValue(makeSession(2))
    seedActiveRecording()
    wrap(<RecorderLiveView />)

    fireEvent.click(screen.getByTestId('recorder-live-preserve'))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toMatch(/2 steps saved/i)
    expect(mockDeleteSession).not.toHaveBeenCalled()
    // reset() flipped both flags back to initial.
    await waitFor(() => expect(useRecorderStore.getState().recording).toBe(false))
    expect(useRecorderStore.getState().activeSessionId).toBeNull()
  })

  it('2. zero-step session — toast reports "0 steps saved" (Implementation Note c)', async () => {
    mockStopRecording.mockResolvedValue(makeSession(0))
    seedActiveRecording()
    wrap(<RecorderLiveView />)

    fireEvent.click(screen.getByTestId('recorder-live-preserve'))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toMatch(/0 steps saved/i)
    expect(mockDeleteSession).not.toHaveBeenCalled()
  })

  it('3. stop failure — toast.error with underlying message, reset() NOT called, recording stays true (Implementation Note a)', async () => {
    mockStopRecording.mockRejectedValue(new Error('network down'))
    seedActiveRecording()
    wrap(<RecorderLiveView />)

    fireEvent.click(screen.getByTestId('recorder-live-preserve'))

    // Scope to the toast container — the inline `recorder-live-error` banner
    // also carries role="alert" when recorderStore.error is set, and it shows
    // just the raw reason; only the toast carries the "Stop failed:" wrapper
    // (canonical error format from TD-014.24 dec 12).
    const notifications = await screen.findByLabelText('Notifications')
    const alert = within(notifications).getByRole('alert')
    expect(alert.textContent).toMatch(/stop failed.*network down/i)
    // Critical invariant: recorderStore keeps recording=true so retry is possible.
    expect(useRecorderStore.getState().recording).toBe(true)
    expect(useRecorderStore.getState().activeSessionId).toBe('sess-test')
  })
})

describe('RecorderLiveView — TD-014.34 Discard semantics', () => {
  it('4. confirm cancelled — neither stop nor deleteSession called, reset NOT fired', () => {
    confirmSpy.mockReturnValue(false)
    seedActiveRecording()
    wrap(<RecorderLiveView />)

    fireEvent.click(screen.getByTestId('recorder-live-discard'))

    expect(confirmSpy).toHaveBeenCalled()
    expect(mockStopRecording).not.toHaveBeenCalled()
    expect(mockDeleteSession).not.toHaveBeenCalled()
    expect(useRecorderStore.getState().recording).toBe(true)
  })

  it('5. happy path — stop resolves → delete resolves → toast.info("Recording discarded") → reset', async () => {
    confirmSpy.mockReturnValue(true)
    mockStopRecording.mockResolvedValue(makeSession(3))
    mockDeleteSession.mockResolvedValue(undefined)
    seedActiveRecording()
    wrap(<RecorderLiveView />)

    fireEvent.click(screen.getByTestId('recorder-live-discard'))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toMatch(/recording discarded/i)
    expect(mockDeleteSession).toHaveBeenCalledWith('sess-test')
    await waitFor(() => expect(useRecorderStore.getState().recording).toBe(false))
  })

  it('6. delete 404 — treated as success, toast.info (NOT warning), reset fires (Implementation Note b)', async () => {
    confirmSpy.mockReturnValue(true)
    mockStopRecording.mockResolvedValue(makeSession(1))
    mockDeleteSession.mockRejectedValue(new Error('deleteSession failed: 404'))
    seedActiveRecording()
    wrap(<RecorderLiveView />)

    fireEvent.click(screen.getByTestId('recorder-live-discard'))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toMatch(/recording discarded/i)
    expect(alert.textContent).not.toMatch(/cleanup failed/i)
    await waitFor(() => expect(useRecorderStore.getState().recording).toBe(false))
  })

  it('7. delete non-404 failure — toast.warning with Sessions-list hint, reset still fires (user not stranded)', async () => {
    confirmSpy.mockReturnValue(true)
    mockStopRecording.mockResolvedValue(makeSession(1))
    mockDeleteSession.mockRejectedValue(new Error('deleteSession failed: 500'))
    seedActiveRecording()
    wrap(<RecorderLiveView />)

    fireEvent.click(screen.getByTestId('recorder-live-discard'))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toMatch(/cleanup failed.*500/i)
    expect(alert.textContent).toMatch(/sessions list/i)
    // Reset still runs — orphan session in Garage, but overlay closes.
    await waitFor(() => expect(useRecorderStore.getState().recording).toBe(false))
  })

  it('8. stop failure inside Discard — deleteSession NOT called, reset NOT fired, recording stays true (Implementation Note a)', async () => {
    confirmSpy.mockReturnValue(true)
    mockStopRecording.mockRejectedValue(new Error('backend unreachable'))
    seedActiveRecording()
    wrap(<RecorderLiveView />)

    fireEvent.click(screen.getByTestId('recorder-live-discard'))

    // Scope as in test 3 — inline error banner also has role="alert".
    const notifications = await screen.findByLabelText('Notifications')
    const alert = within(notifications).getByRole('alert')
    expect(alert.textContent).toMatch(/stop failed.*backend unreachable/i)
    expect(mockDeleteSession).not.toHaveBeenCalled()
    // Zombie-session prevention: backend still alive, local state preserved.
    expect(useRecorderStore.getState().recording).toBe(true)
    expect(useRecorderStore.getState().activeSessionId).toBe('sess-test')
  })
})

describe('RecorderLiveView — TD-014.34 keyboard + DOM contract', () => {
  it('9. Esc key routes to handleDiscard (confirm gate honoured)', async () => {
    confirmSpy.mockReturnValue(true)
    mockStopRecording.mockResolvedValue(makeSession(1))
    mockDeleteSession.mockResolvedValue(undefined)
    seedActiveRecording()
    wrap(<RecorderLiveView />)

    // The listener is attached to window (RecorderLiveView.tsx:74) — dispatch
    // at the window level so the same handler that Escape-from-keyboard would
    // trigger in production fires here.
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    await waitFor(() => expect(confirmSpy).toHaveBeenCalled())
    await waitFor(() => expect(mockDeleteSession).toHaveBeenCalledWith('sess-test'))
  })

  it('10. DOM ordering — Discard is first child of headerActions, Stop & import is last (Implementation Note d)', () => {
    mockStopRecording.mockResolvedValue(makeSession(1))
    seedActiveRecording()
    wrap(<RecorderLiveView />)

    // Walk up from the Discard button to the flex row that groups all header
    // actions; assert the expected left-to-right layout. This is the
    // regression guard for Implementation Note (d): Discard MUST be leftmost,
    // Stop & import MUST be rightmost — a future refactor that moves Discard
    // next to Stop re-opens the misclick vector Option C was chosen to close.
    const discard = screen.getByTestId('recorder-live-discard')
    const row = discard.parentElement
    expect(row).not.toBeNull()
    const buttons = Array.from(row!.querySelectorAll('button'))
    const testIds = buttons.map(b => b.getAttribute('data-testid'))
    expect(testIds[0]).toBe('recorder-live-discard')
    expect(testIds[testIds.length - 1]).toBe('recorder-live-stop')
    // Preserve button lives between Capture and Stop & import.
    expect(testIds).toContain('recorder-live-preserve')
  })
})
