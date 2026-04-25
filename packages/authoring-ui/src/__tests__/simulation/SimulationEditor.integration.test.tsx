/**
 * TD-014.21 — SimulationEditor integration test.
 *
 * Wires the full overlay (step list + HotspotCanvas + StepForm + Record/Import
 * buttons) with real simStore and mocked APIs. Exercises the happy path that
 * the user manual §13 describes end-to-end, without Playwright.
 *
 * What this covers beyond the unit tests:
 *  (a) Clicking "+ Add step" creates a step that shows in the DOM and can be
 *      edited via the form panel (cross-store wiring).
 *  (b) Upload → uploadAsset → resolveAssetUrl → step patched with both keys
 *      on the real simStore instance (not a mocked onChange).
 *  (c) Record… button opens RecorderLauncherDialog.
 *  (d) Import… button opens SessionsPickerDialog.
 *  (e) A successful import via the picker lands in simStore via setConfig —
 *      the step-list refreshes automatically.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { ToastProvider } from '../../components/ui/Toast'
import { useSimStore } from '../../store/simStore'
import { useEditorStore } from '../../store/editorStore'
import { useRecorderStore } from '../../store/recorderStore'
import type { SimConfig } from '../../types/simulation'
import type { CourseDoc } from '../../types/course'

// ── Mocks — Konva (jsdom has no canvas module) ───────────────────────────────
vi.mock('react-konva', () => ({
  Stage: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Layer: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Image: () => null,
  Rect: () => null,
  Transformer: () => null,
}))
vi.mock('konva', () => ({ default: {} }))

// ── Mocks — APIs (recorderApi + courseApi subset) ────────────────────────────
const {
  mockUploadAsset, mockResolveAssetUrl, mockListSessions, mockImportSimulation,
  mockStopRecording, mockDeleteSession,
} = vi.hoisted(() => ({
  mockUploadAsset: vi.fn(),
  mockResolveAssetUrl: vi.fn(),
  mockListSessions: vi.fn(),
  mockImportSimulation: vi.fn(),
  // TD-014.34: exposed so the Stop / Discard integration tests below can
  // configure the backend's response per-test. Before .34 these were anonymous
  // vi.fn() inside the factory, unreachable from tests.
  mockStopRecording: vi.fn(),
  mockDeleteSession: vi.fn(),
}))

vi.mock('../../api/courseApi', async () => {
  const actual = await vi.importActual<typeof import('../../api/courseApi')>('../../api/courseApi')
  return {
    ...actual,
    uploadAsset: mockUploadAsset,
    resolveAssetUrl: mockResolveAssetUrl,
    importSimulation: mockImportSimulation,
  }
})

vi.mock('../../api/recorderApi', () => ({
  listSessions: mockListSessions,
  startRecording: vi.fn(),
  captureStep: vi.fn(),
  stopRecording: mockStopRecording,
  getSession: vi.fn(),
  deleteSession: mockDeleteSession,
  getLiveScreenshotUrl: (id: string) => `http://recorder/screenshot/${id}`,
}))

import { SimulationEditor } from '../../components/simulation/SimulationEditor'

function wrap(ui: ReactNode) {
  return render(<ToastProvider>{ui}</ToastProvider>)
}

function emptyConfig(): SimConfig {
  return { mode: 'practice', passingScore: 80, steps: [] }
}

function stubCourse(): CourseDoc {
  return { _id: 'course-1', title: 't', slides: [] } as unknown as CourseDoc
}

beforeEach(() => {
  useSimStore.setState({ config: null, selectedStepIndex: 0, panelOpen: false, editingComponentId: null })
  useEditorStore.setState({ isSaving: false, course: stubCourse() })
  useRecorderStore.setState({
    activeSessionId: null, recording: false, captures: [], error: null, isBusy: false,
  })
  mockUploadAsset.mockReset()
  mockResolveAssetUrl.mockReset()
  mockListSessions.mockReset()
  mockImportSimulation.mockReset()
  mockStopRecording.mockReset()
  mockDeleteSession.mockReset()
})

afterEach(() => {
  useEditorStore.setState({ course: null })
})

describe('SimulationEditor — integration (TD-014.21)', () => {
  it('end-to-end: + Add step creates a step visible in the list and editable in the form', async () => {
    useSimStore.getState().openPanel(emptyConfig(), 'comp-1')
    wrap(<SimulationEditor />)

    expect(useSimStore.getState().config?.steps).toHaveLength(0)
    fireEvent.click(screen.getByTestId('sim-add-step-btn'))

    await waitFor(() => {
      expect(useSimStore.getState().config?.steps).toHaveLength(1)
    })
    expect(screen.getByTestId('sim-step-item-0')).toBeDefined()

    // Step form is now bound to the new step — editing Instruction patches the store.
    const instructionInput = screen.getAllByRole('textbox').find(el =>
      (el as HTMLElement).previousElementSibling?.textContent?.toLowerCase() === 'instruction' ||
      (el.parentElement?.querySelector('label')?.textContent?.toLowerCase() === 'instruction')
    )
    // Fall back: the first textarea is Instruction (the second field after Description).
    const textarea = (instructionInput as HTMLElement | undefined) ?? screen.getAllByRole('textbox')[1]
    fireEvent.change(textarea, { target: { value: 'Click the blue button' } })
    await waitFor(() => {
      expect(useSimStore.getState().config?.steps[0].instruction).toBe('Click the blue button')
    })
  })

  it('Upload flow: click Upload → file selection → uploadAsset → resolveAssetUrl → step patched', async () => {
    // Seed a step so the form renders.
    useSimStore.getState().openPanel(emptyConfig(), 'comp-1')
    useSimStore.getState().addStep()
    wrap(<SimulationEditor />)

    mockUploadAsset.mockResolvedValue({
      objectName: 'img.png', url: '/assets/img.png', originalName: 'shot.png',
    })
    mockResolveAssetUrl.mockResolvedValue('https://garage/img.png?sig=xyz')

    const hiddenInput = document.querySelector<HTMLInputElement>('input[type="file"]')!
    const file = new File(['x'], 'shot.png', { type: 'image/png' })
    fireEvent.change(hiddenInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(useSimStore.getState().config?.steps[0].screenshotKey).toBe('img.png')
      expect(useSimStore.getState().config?.steps[0].screenshotUrl).toBe('https://garage/img.png?sig=xyz')
    })
  })

  it('Record… button opens the RecorderLauncherDialog', async () => {
    useSimStore.getState().openPanel(emptyConfig(), 'comp-1')
    wrap(<SimulationEditor />)

    fireEvent.click(screen.getByTestId('sim-record-btn'))
    expect(await screen.findByTestId('recorder-url-input')).toBeDefined()
    expect(screen.getByTestId('recorder-dialog-start')).toBeDefined()
  })

  it('Import… button opens the SessionsPickerDialog + fetches the list', async () => {
    mockListSessions.mockResolvedValue({ sessions: [], total: 0 })
    useSimStore.getState().openPanel(emptyConfig(), 'comp-1')
    wrap(<SimulationEditor />)

    fireEvent.click(screen.getByTestId('sim-import-btn'))
    await waitFor(() => expect(mockListSessions).toHaveBeenCalled())
    expect(await screen.findByTestId('sessions-picker-empty')).toBeDefined()
  })

  it('Successful import from the picker lands in simStore via setConfig', async () => {
    mockListSessions.mockResolvedValue({
      sessions: [{
        id: 'sess-ok', url: 'https://example.com', title: 'ok',
        status: 'finished', startedAt: '2026-04-24T00:00:00.000Z', stepCount: 2,
      }],
      total: 1,
    })
    // TD-014.33 (F1): the `interactionType: 'click'` lines that used to live
    // here were a "mock that lies about the contract" — they pre-seeded a
    // field the pre-.33 backend did NOT emit, hiding the drift. The new
    // source of truth is the backend contract test
    // `backend/api/src/__tests__/simulations.test.ts` →
    //   "seeds interactionType='click' on every imported step"
    // which fails if the backend ever stops emitting the field. This mock
    // stays deliberately minimal so a future backend regression is caught
    // upstream (at the contract) rather than papered over here.
    mockImportSimulation.mockResolvedValue({
      mode: 'practice', passingScore: 80,
      steps: [
        {
          id: 'x1', order: 0, description: '', instruction: '', hint: '',
          correctFeedback: '', incorrectFeedback: '', demoDelay: 3000, maxAttempts: -1,
          screenshotKey: '', screenshotUrl: '',
          hotspot: { x: 0, y: 0, width: 0, height: 0, tolerance: 12 },
        },
        {
          id: 'x2', order: 1, description: '', instruction: '', hint: '',
          correctFeedback: '', incorrectFeedback: '', demoDelay: 3000, maxAttempts: -1,
          screenshotKey: '', screenshotUrl: '',
          hotspot: { x: 0, y: 0, width: 0, height: 0, tolerance: 12 },
        },
      ],
    })
    useSimStore.getState().openPanel(emptyConfig(), 'comp-1')
    wrap(<SimulationEditor />)

    fireEvent.click(screen.getByTestId('sim-import-btn'))
    const importBtn = await screen.findByTestId('sessions-picker-import-sess-ok')
    fireEvent.click(importBtn)

    await waitFor(() => {
      expect(useSimStore.getState().config?.steps).toHaveLength(2)
    })
    // Step list in the DOM reflects the new config.
    await waitFor(() => {
      const list = screen.getByLabelText('Simulation steps')
      expect(within(list).getAllByTestId(/^sim-step-item-/)).toHaveLength(2)
    })
  })

  it('Record… and Import… are disabled during an active recording', () => {
    useSimStore.getState().openPanel(emptyConfig(), 'comp-1')
    useRecorderStore.setState({ recording: true, activeSessionId: 'sess-live' })
    wrap(<SimulationEditor />)

    expect((screen.getByTestId('sim-record-btn') as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByTestId('sim-import-btn') as HTMLButtonElement).disabled).toBe(true)
  })

  // ── TD-014.34 integration (F2 resolution) ─────────────────────────────────
  //
  // These two tests verify the Stop / Discard paths end-to-end through the
  // full SimulationEditor + RecorderLiveView overlay stack, exercising the
  // real store pipeline (recorderStore.stop → performCourseMutation →
  // recorderApi.stopRecording). Unit tests in RecorderLiveView.test.tsx pin
  // the four implementation invariants; this suite proves the overlay is
  // correctly wired from the outside-in.

  it('TD-014.34 — Stop (preserve) stops backend without deleting, shows count-aware toast', async () => {
    mockStopRecording.mockResolvedValue({
      id: 'sess-live',
      url: 'https://example.com',
      title: 'Live test',
      status: 'finished',
      startedAt: '2026-04-24T00:00:00.000Z',
      finishedAt: '2026-04-24T00:01:00.000Z',
      steps: [
        { id: 'step-0', type: 'click', x: 0.5, y: 0.5, timestamp: 1, screenshotKey: 'recordings/sess-live/step-0.png' },
        { id: 'step-1', type: 'click', x: 0.5, y: 0.5, timestamp: 2, screenshotKey: 'recordings/sess-live/step-1.png' },
      ],
    })
    useSimStore.getState().openPanel(emptyConfig(), 'comp-1')
    useRecorderStore.setState({
      recording: true,
      activeSessionId: 'sess-live',
      captures: [],
      error: null,
      isBusy: false,
    })
    wrap(<SimulationEditor />)

    fireEvent.click(screen.getByTestId('recorder-live-preserve'))

    // Backend stop called with the active session id; deleteSession NOT reached.
    await waitFor(() => expect(mockStopRecording).toHaveBeenCalledWith('sess-live'))
    expect(mockDeleteSession).not.toHaveBeenCalled()

    // Count-aware toast (Implementation Note c) — the count comes from the
    // backend response, not from captures buffer, so 2 steps is what lands.
    const notifications = await screen.findByLabelText('Notifications')
    expect(within(notifications).getByRole('alert').textContent).toMatch(/2 steps saved/i)

    // Overlay unmounts (recording=false after reset).
    await waitFor(() => expect(useRecorderStore.getState().recording).toBe(false))
    expect(useRecorderStore.getState().activeSessionId).toBeNull()
  })

  it('TD-014.34 — Discard calls deleteSession after confirm and closes overlay', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockStopRecording.mockResolvedValue({
      id: 'sess-live',
      url: 'https://example.com',
      title: 'Live test',
      status: 'finished',
      startedAt: '2026-04-24T00:00:00.000Z',
      finishedAt: '2026-04-24T00:01:00.000Z',
      steps: [
        { id: 'step-0', type: 'click', x: 0.5, y: 0.5, timestamp: 1, screenshotKey: 'recordings/sess-live/step-0.png' },
      ],
    })
    mockDeleteSession.mockResolvedValue(undefined)

    try {
      useSimStore.getState().openPanel(emptyConfig(), 'comp-1')
      useRecorderStore.setState({
        recording: true,
        activeSessionId: 'sess-live',
        captures: [],
        error: null,
        isBusy: false,
      })
      wrap(<SimulationEditor />)

      fireEvent.click(screen.getByTestId('recorder-live-discard'))

      await waitFor(() => expect(confirmSpy).toHaveBeenCalled())
      await waitFor(() => expect(mockStopRecording).toHaveBeenCalledWith('sess-live'))
      await waitFor(() => expect(mockDeleteSession).toHaveBeenCalledWith('sess-live'))

      const notifications = await screen.findByLabelText('Notifications')
      expect(within(notifications).getByRole('alert').textContent).toMatch(/recording discarded/i)

      await waitFor(() => expect(useRecorderStore.getState().recording).toBe(false))
    } finally {
      confirmSpy.mockRestore()
    }
  })
})
