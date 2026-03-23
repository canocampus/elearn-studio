/**
 * Tests for CourseInspector — T165.5
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CourseInspector } from '../../components/debug/CourseInspector'
import { useEditorStore } from '../../store/editorStore'

// Seed the store with a mock course before each test
const mockCourse = {
  _id: 'test-course',
  title: 'Test Course',
  slides: [{ id: 's1', title: 'Slide 1', widgets: [], actions: [] }],
  templates: [],
  resources: [],
  settings: {},
  metadata: {},
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

beforeEach(() => {
  useEditorStore.setState({ course: mockCourse as never })
})

afterEach(() => {
  useEditorStore.setState({ course: null })
})

describe('CourseInspector', () => {
  it('renders course JSON in <pre> element', () => {
    render(<CourseInspector onClose={vi.fn()} />)
    const pre = screen.getByTestId('course-inspector-json')
    expect(pre).toBeInTheDocument()
    expect(pre.textContent).toContain('"title": "Test Course"')
    expect(pre.textContent).toContain('"_id": "test-course"')
  })

  it('shows "No course loaded" when course is null', () => {
    useEditorStore.setState({ course: null })
    render(<CourseInspector onClose={vi.fn()} />)
    expect(screen.getByTestId('course-inspector-json').textContent).toBe('No course loaded')
  })

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn()
    render(<CourseInspector onClose={onClose} />)
    await userEvent.click(screen.getByLabelText('Close inspector'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('renders pretty-printed JSON with indentation', () => {
    render(<CourseInspector onClose={vi.fn()} />)
    const json = screen.getByTestId('course-inspector-json').textContent ?? ''
    // Pretty-printed JSON has newlines and spaces
    expect(json).toContain('\n')
    expect(json).toContain('  ')
  })
})
