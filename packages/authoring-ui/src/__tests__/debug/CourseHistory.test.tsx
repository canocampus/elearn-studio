/**
 * Tests for CourseHistory — T167
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CourseHistory } from '../../components/debug/CourseHistory'
import { server } from '../../mocks/server'
import { http, HttpResponse } from 'msw'

const API_BASE = 'http://localhost:3001'

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('CourseHistory', () => {
  it('renders the panel with "Course History" title', async () => {
    render(<CourseHistory courseId="mock-course-1" onClose={vi.fn()} />)
    expect(screen.getByTestId('course-history-panel')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('Loading…')).not.toBeInTheDocument())
    expect(screen.getByText('Course History')).toBeInTheDocument()
  })

  it('shows history entries after load', async () => {
    render(<CourseHistory courseId="mock-course-1" onClose={vi.fn()} />)
    await waitFor(() => expect(screen.getAllByTestId('history-entry').length).toBeGreaterThan(0))
    expect(screen.getByText('Created course')).toBeInTheDocument()
    expect(screen.getByText('Added slide')).toBeInTheDocument()
  })

  it('displays total event count', async () => {
    render(<CourseHistory courseId="mock-course-1" onClose={vi.fn()} />)
    await waitFor(() => expect(screen.queryByText('Loading…')).not.toBeInTheDocument())
    expect(screen.getByText('2 events')).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn()
    render(<CourseHistory courseId="mock-course-1" onClose={onClose} />)
    await waitFor(() => expect(screen.queryByText('Loading…')).not.toBeInTheDocument())
    await userEvent.click(screen.getByLabelText('Close history'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('shows error message on API failure', async () => {
    server.use(
      http.get(`${API_BASE}/courses/:id/history`, () =>
        HttpResponse.json({ success: false, error: 'Internal error' }, { status: 500 }),
      ),
    )
    render(<CourseHistory courseId="mock-course-1" onClose={vi.fn()} />)
    await waitFor(() => expect(screen.queryByText('Loading…')).not.toBeInTheDocument())
    expect(screen.getByText(/Failed to load history|Internal error/)).toBeInTheDocument()
  })

  it('shows "No history yet." when entries list is empty', async () => {
    server.use(
      http.get(`${API_BASE}/courses/:id/history`, () =>
        HttpResponse.json({ success: true, data: [], meta: { total: 0, limit: 20, skip: 0 } }),
      ),
    )
    render(<CourseHistory courseId="mock-course-1" onClose={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('No history yet.')).toBeInTheDocument())
  })

  it('does not show pagination when total <= limit', async () => {
    render(<CourseHistory courseId="mock-course-1" onClose={vi.fn()} />)
    await waitFor(() => expect(screen.queryByText('Loading…')).not.toBeInTheDocument())
    expect(screen.queryByText('← Prev')).not.toBeInTheDocument()
    expect(screen.queryByText('Next →')).not.toBeInTheDocument()
  })

  it('shows pagination when total > limit', async () => {
    server.use(
      http.get(`${API_BASE}/courses/:id/history`, ({ request }) => {
        const skip = Number(new URL(request.url).searchParams.get('skip') ?? 0)
        const entries = Array.from({ length: 20 }, (_, i) => ({
          _id: `e-${skip + i}`,
          courseId: 'mock-course-1',
          action: 'slide.update',
          actorId: 'u',
          actorEmail: 'dev@example.com',
          detail: {},
          createdAt: new Date().toISOString(),
        }))
        return HttpResponse.json({ success: true, data: entries, meta: { total: 35, limit: 20, skip } })
      }),
    )
    render(<CourseHistory courseId="mock-course-1" onClose={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('Next →')).toBeInTheDocument())
    expect(screen.getByText('← Prev')).toBeInTheDocument()
  })
})
