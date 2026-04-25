/**
 * TD-014.20 — SessionsPickerDialog tests.
 *
 * Mocks recorderApi.listSessions + courseApi.importSimulation. Uses ToastProvider
 * because `SessionsPickerDialog` reads `useToast()` for success/error surfacing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { ToastProvider } from '../../components/ui/Toast'
import { useEditorStore } from '../../store/editorStore'
import { useSimStore } from '../../store/simStore'
import type { SessionSummary } from '../../types/recorder'
import type { CourseDoc } from '../../types/course'

const { mockListSessions, mockImportSimulation } = vi.hoisted(() => ({
  mockListSessions: vi.fn(),
  mockImportSimulation: vi.fn(),
}))

vi.mock('../../api/recorderApi', () => ({
  listSessions: mockListSessions,
  startRecording: vi.fn(),
  captureStep: vi.fn(),
  stopRecording: vi.fn(),
  getSession: vi.fn(),
  deleteSession: vi.fn(),
  getLiveScreenshotUrl: (id: string) => `http://recorder/screenshot/${id}`,
}))

vi.mock('../../api/courseApi', async () => {
  const actual = await vi.importActual<typeof import('../../api/courseApi')>('../../api/courseApi')
  return { ...actual, importSimulation: mockImportSimulation }
})

import { SessionsPickerDialog } from '../../components/simulation/SessionsPickerDialog'

function wrap(ui: ReactNode) {
  return render(<ToastProvider>{ui}</ToastProvider>)
}

function makeSummary(over: Partial<SessionSummary> = {}): SessionSummary {
  return {
    id: 'sess-1',
    url: 'https://example.com',
    title: 'Example session',
    status: 'finished',
    startedAt: '2026-04-24T00:00:00.000Z',
    stepCount: 3,
    ...over,
  }
}

function stubCourse(): CourseDoc {
  return {
    id: 'course-1',
    title: 'Test course',
    slides: [],
  } as unknown as CourseDoc
}

beforeEach(() => {
  mockListSessions.mockReset()
  mockImportSimulation.mockReset()
  useEditorStore.setState({ course: stubCourse() })
  useSimStore.setState({
    config: null,
    selectedStepIndex: 0,
    panelOpen: false,
    editingComponentId: null,
  })
})

afterEach(() => {
  useEditorStore.setState({ course: null })
})

describe('SessionsPickerDialog — render gating', () => {
  it('renders nothing when open=false (does not fetch)', () => {
    const { container } = wrap(
      <SessionsPickerDialog open={false} onClose={vi.fn()} />,
    )
    expect(container.firstChild).toBeNull()
    expect(mockListSessions).not.toHaveBeenCalled()
  })

  it('fetches sessions when opened', async () => {
    mockListSessions.mockResolvedValue({ sessions: [], total: 0 })
    wrap(<SessionsPickerDialog open={true} onClose={vi.fn()} />)
    await waitFor(() => expect(mockListSessions).toHaveBeenCalledTimes(1))
  })
})

describe('SessionsPickerDialog — list rendering', () => {
  it('shows empty-state copy when the list is empty', async () => {
    mockListSessions.mockResolvedValue({ sessions: [], total: 0 })
    wrap(<SessionsPickerDialog open={true} onClose={vi.fn()} />)
    const empty = await screen.findByTestId('sessions-picker-empty')
    expect(empty.textContent).toMatch(/No recordings yet/i)
    expect(empty.textContent).toMatch(/Record/i)
  })

  it('renders one row per session summary', async () => {
    mockListSessions.mockResolvedValue({
      sessions: [
        makeSummary({ id: 'a', title: 'First' }),
        makeSummary({ id: 'b', title: 'Second' }),
      ],
      total: 2,
    })
    wrap(<SessionsPickerDialog open={true} onClose={vi.fn()} />)
    expect(await screen.findByTestId('sessions-picker-row-a')).toBeDefined()
    expect(screen.getByTestId('sessions-picker-row-b')).toBeDefined()
    expect(screen.getByTestId('sessions-picker-import-a')).toBeDefined()
    expect(screen.getByTestId('sessions-picker-import-b')).toBeDefined()
  })

  it('surfaces fetch error without crashing', async () => {
    mockListSessions.mockRejectedValue(new Error('Storage unavailable'))
    wrap(<SessionsPickerDialog open={true} onClose={vi.fn()} />)
    const err = await screen.findByTestId('sessions-picker-error')
    expect(err.textContent).toMatch(/Storage unavailable/)
  })
})

describe('SessionsPickerDialog — Import flow', () => {
  it('Import button calls importSimulation + setConfig + closes dialog', async () => {
    mockListSessions.mockResolvedValue({
      sessions: [makeSummary({ id: 'sess-1' })],
      total: 1,
    })
    mockImportSimulation.mockResolvedValue({
      mode: 'practice',
      passingScore: 80,
      steps: [
        { id: 's1', order: 0 }, { id: 's2', order: 1 }, { id: 's3', order: 2 },
      ],
    })
    const onClose = vi.fn()

    wrap(<SessionsPickerDialog open={true} onClose={onClose} />)
    const importBtn = await screen.findByTestId('sessions-picker-import-sess-1')
    fireEvent.click(importBtn)

    await waitFor(() => {
      expect(mockImportSimulation).toHaveBeenCalledWith('course-1', 'sess-1')
    })
    await waitFor(() => {
      expect(useSimStore.getState().config?.steps).toHaveLength(3)
    })
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('Import failure keeps dialog open and does not mutate simStore', async () => {
    mockListSessions.mockResolvedValue({
      sessions: [makeSummary({ id: 'sess-1' })],
      total: 1,
    })
    mockImportSimulation.mockRejectedValue(new Error('Session not found'))
    const onClose = vi.fn()

    wrap(<SessionsPickerDialog open={true} onClose={onClose} />)
    const importBtn = await screen.findByTestId('sessions-picker-import-sess-1')
    fireEvent.click(importBtn)

    await waitFor(() => {
      expect(mockImportSimulation).toHaveBeenCalled()
    })
    expect(useSimStore.getState().config).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('SessionsPickerDialog — Refresh', () => {
  it('Refresh re-fetches the session list', async () => {
    mockListSessions.mockResolvedValue({ sessions: [], total: 0 })
    wrap(<SessionsPickerDialog open={true} onClose={vi.fn()} />)
    await waitFor(() => expect(mockListSessions).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByTestId('sessions-picker-refresh'))
    await waitFor(() => expect(mockListSessions).toHaveBeenCalledTimes(2))
  })
})

describe('SessionsPickerDialog — close paths', () => {
  it('Escape closes the dialog', async () => {
    mockListSessions.mockResolvedValue({ sessions: [], total: 0 })
    const onClose = vi.fn()
    wrap(<SessionsPickerDialog open={true} onClose={onClose} />)
    await screen.findByTestId('sessions-picker-empty')
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Close button closes the dialog', async () => {
    mockListSessions.mockResolvedValue({ sessions: [], total: 0 })
    const onClose = vi.fn()
    wrap(<SessionsPickerDialog open={true} onClose={onClose} />)
    await screen.findByTestId('sessions-picker-empty')
    fireEvent.click(screen.getByTestId('sessions-picker-close'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
