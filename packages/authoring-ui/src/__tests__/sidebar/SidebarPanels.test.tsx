/**
 * T607 — Component Tests: Sidebar Panels
 *
 * T607.1 — SlideList renders slide thumbnails in order
 * T607.2 — SlideList: clicking a slide item updates currentSlideIndex
 * T607.3 — SlideList "Add Slide" button adds a slide and selects it
 * T607.4 — SlideList slide items are draggable for reordering
 * T607.5 — QuestionPropertiesPanel: MC form renders question text + options
 * T607.6 — QuestionPropertiesPanel: TF form renders True/False radio buttons
 * T607.7 — QuestionPropertiesPanel: Fill form renders answer inputs + match-type select
 * T607.8 — QuestionPropertiesPanel: shows empty state when no question widget is selected
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SlideList } from '../../components/sidebar/SlideList'
import { QuestionPropertiesPanel } from '../../components/sidebar/QuestionPropertiesPanel'
import { ToastProvider } from '../../components/ui/Toast'
import { useEditorStore } from '../../store/editorStore'
import type { CourseDoc } from '../../types/course'
import type { Editor } from 'grapesjs'
import {
  MC_DEFAULT_EXTENDED,
  TF_DEFAULT_EXTENDED,
  FILL_DEFAULT_EXTENDED,
} from '../../types/questions'

// ─── Mock the API layer ───────────────────────────────────────────────────────

vi.mock('../../api/courseApi', () => ({
  addSlide: vi.fn(),
  deleteSlide: vi.fn(),
  duplicateSlide: vi.fn(),
  reorderSlides: vi.fn(),
  updateSlide: vi.fn(),
  nextSlideTitle: (slides: { id: string }[]) => `Slide ${slides.length + 1}`,
}))

import { addSlide } from '../../api/courseApi'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSlide(id: string, title: string) {
  return { id, title, widgets: [], actions: [] }
}

function makeCourse(slides: ReturnType<typeof makeSlide>[]): CourseDoc {
  return {
    _id: 'course-1',
    title: 'Test Course',
    slides,
    templates: [],
    resources: [],
    settings: { width: 1024, height: 768, passingScore: 80, allowReview: true },
    metadata: { version: '1.2', masteryScore: 80 },
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

/** Minimal GrapesJS component mock supporting get() and set(). */
function makeMockComponent(type: string, extendedProperties: unknown) {
  const data: Record<string, unknown> = { type, extendedProperties }
  return {
    get: vi.fn((key: string) => data[key]),
    set: vi.fn((key: string, value: unknown) => { data[key] = value }),
  }
}

/** Minimal GrapesJS editor mock. */
function makeMockEditor(selected: ReturnType<typeof makeMockComponent> | null) {
  return {
    getSelected: vi.fn().mockReturnValue(selected),
    store: vi.fn().mockResolvedValue({}),
  } as unknown as Editor
}

// ─── Store reset ──────────────────────────────────────────────────────────────

afterEach(() => {
  vi.clearAllMocks()
  useEditorStore.setState({
    course: null,
    currentSlideIndex: 0,
    editor: null,
    selectedComponentType: null,
  })
})

// ─── T607.1–T607.4 — SlideList ───────────────────────────────────────────────

describe('T607.1 — SlideList renders slide thumbnails in order', () => {
  it('renders slide titles in order', () => {
    useEditorStore.setState({
      course: makeCourse([makeSlide('s1', 'Intro'), makeSlide('s2', 'Chapter 1'), makeSlide('s3', 'Conclusion')]),
      currentSlideIndex: 0,
    })
    render(<ToastProvider><SlideList /></ToastProvider>)
    const items = screen.getAllByTestId('slide-item')
    expect(items).toHaveLength(3)
    expect(items[0].textContent).toContain('Intro')
    expect(items[1].textContent).toContain('Chapter 1')
    expect(items[2].textContent).toContain('Conclusion')
  })

  it('shows 1-based thumbnail numbers for slides without thumbnails', () => {
    useEditorStore.setState({
      course: makeCourse([makeSlide('s1', 'A'), makeSlide('s2', 'B')]),
      currentSlideIndex: 0,
    })
    render(<ToastProvider><SlideList /></ToastProvider>)
    expect(screen.getByText('1')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
  })
})

describe('T607.2 — SlideList clicking a slide item updates currentSlideIndex', () => {
  it('clicking the second slide sets currentSlideIndex to 1', () => {
    useEditorStore.setState({
      course: makeCourse([makeSlide('s1', 'First'), makeSlide('s2', 'Second')]),
      currentSlideIndex: 0,
    })
    render(<ToastProvider><SlideList /></ToastProvider>)
    const items = screen.getAllByTestId('slide-item')
    fireEvent.click(items[1])
    expect(useEditorStore.getState().currentSlideIndex).toBe(1)
  })

  it('clicking the first slide keeps currentSlideIndex at 0', () => {
    useEditorStore.setState({
      course: makeCourse([makeSlide('s1', 'First'), makeSlide('s2', 'Second')]),
      currentSlideIndex: 1,
    })
    render(<ToastProvider><SlideList /></ToastProvider>)
    const items = screen.getAllByTestId('slide-item')
    fireEvent.click(items[0])
    expect(useEditorStore.getState().currentSlideIndex).toBe(0)
  })

  it('active slide item has aria-current="true"', () => {
    useEditorStore.setState({
      course: makeCourse([makeSlide('s1', 'A'), makeSlide('s2', 'B')]),
      currentSlideIndex: 1,
    })
    render(<ToastProvider><SlideList /></ToastProvider>)
    const items = screen.getAllByTestId('slide-item')
    expect(items[0].getAttribute('aria-current')).toBeNull()
    expect(items[1].getAttribute('aria-current')).toBe('true')
  })
})

describe('T607.3 — SlideList "Add Slide" button adds a slide', () => {
  it('Add Slide button is visible and not disabled', () => {
    useEditorStore.setState({
      course: makeCourse([makeSlide('s1', 'Slide 1')]),
      currentSlideIndex: 0,
    })
    render(<ToastProvider><SlideList /></ToastProvider>)
    const btn = screen.getByRole('button', { name: /Add Slide/i })
    expect(btn).toBeTruthy()
    expect(btn).not.toBeDisabled()
  })

  it('clicking Add Slide calls addSlide with the course ID and updates store', async () => {
    const initial = makeCourse([makeSlide('s1', 'Slide 1')])
    const updated = makeCourse([makeSlide('s1', 'Slide 1'), makeSlide('s2', 'Slide 2')])
    vi.mocked(addSlide).mockResolvedValue(updated)
    useEditorStore.setState({ course: initial, currentSlideIndex: 0 })

    render(<ToastProvider><SlideList /></ToastProvider>)
    fireEvent.click(screen.getByRole('button', { name: /Add Slide/i }))

    await waitFor(() => expect(addSlide).toHaveBeenCalledWith('course-1', expect.any(String)))
    // Verify the store was updated with the returned course
    await waitFor(() => expect(useEditorStore.getState().course?.slides).toHaveLength(2))
  })
})

describe('T607.4 — SlideList slide items are draggable', () => {
  it('every slide item has the draggable attribute', () => {
    useEditorStore.setState({
      course: makeCourse([makeSlide('s1', 'A'), makeSlide('s2', 'B'), makeSlide('s3', 'C')]),
      currentSlideIndex: 0,
    })
    const { container } = render(<ToastProvider><SlideList /></ToastProvider>)
    const draggable = container.querySelectorAll('[draggable="true"]')
    expect(draggable).toHaveLength(3)
  })
})

// ─── T607.5–T607.8 — QuestionPropertiesPanel ─────────────────────────────────

describe('T607.8 — QuestionPropertiesPanel empty state', () => {
  it('shows hint when no editor is loaded', () => {
    useEditorStore.setState({ editor: null, selectedComponentType: null })
    render(<QuestionPropertiesPanel />)
    expect(screen.getByText(/Select a question widget/i)).toBeTruthy()
  })

  it('shows hint when a non-question widget type is selected', () => {
    const editor = makeMockEditor(makeMockComponent('text', {}))
    useEditorStore.setState({ editor, selectedComponentType: 'text' })
    render(<QuestionPropertiesPanel />)
    expect(screen.getByText(/Select a question widget/i)).toBeTruthy()
  })

  it('shows "No component selected" when question type is set but getSelected returns null', () => {
    const editor = makeMockEditor(null)
    useEditorStore.setState({ editor, selectedComponentType: 'question-mc' })
    render(<QuestionPropertiesPanel />)
    expect(screen.getByText(/No component selected/i)).toBeTruthy()
  })
})

describe('T607.5 — QuestionPropertiesPanel: MC form renders question text + options', () => {
  beforeEach(() => {
    const comp = makeMockComponent('question-mc', MC_DEFAULT_EXTENDED)
    const editor = makeMockEditor(comp)
    useEditorStore.setState({ editor, selectedComponentType: 'question-mc' })
  })

  it('renders the "Multiple Choice" section heading', () => {
    render(<QuestionPropertiesPanel />)
    expect(screen.getByText('Multiple Choice')).toBeTruthy()
  })

  it('renders a textarea with the default question text', () => {
    render(<QuestionPropertiesPanel />)
    const textarea = screen.getByDisplayValue(MC_DEFAULT_EXTENDED.questionText) as HTMLTextAreaElement
    expect(textarea.tagName).toBe('TEXTAREA')
  })

  it('renders radio buttons for each option to mark correct', () => {
    render(<QuestionPropertiesPanel />)
    const radios = screen.getAllByTitle('Mark as correct')
    expect(radios).toHaveLength(MC_DEFAULT_EXTENDED.options.length)
  })

  it('renders option text inputs for each option', () => {
    render(<QuestionPropertiesPanel />)
    expect(screen.getByDisplayValue('Option A')).toBeTruthy()
    expect(screen.getByDisplayValue('Option B')).toBeTruthy()
    expect(screen.getByDisplayValue('Option C')).toBeTruthy()
  })

  it('calls component.set when question text changes', () => {
    const comp = makeMockComponent('question-mc', { ...MC_DEFAULT_EXTENDED })
    const editor = makeMockEditor(comp)
    useEditorStore.setState({ editor, selectedComponentType: 'question-mc' })

    render(<QuestionPropertiesPanel />)
    const textarea = screen.getByDisplayValue(MC_DEFAULT_EXTENDED.questionText)
    fireEvent.change(textarea, { target: { value: 'What is 2+2?' } })

    expect(comp.set).toHaveBeenCalledWith(
      'extendedProperties',
      expect.objectContaining({ questionText: 'What is 2+2?' }),
    )
  })
})

describe('T607.6 — QuestionPropertiesPanel: TF form renders True/False radio buttons', () => {
  beforeEach(() => {
    const comp = makeMockComponent('question-tf', TF_DEFAULT_EXTENDED)
    const editor = makeMockEditor(comp)
    useEditorStore.setState({ editor, selectedComponentType: 'question-tf' })
  })

  it('renders the "True / False" section heading', () => {
    render(<QuestionPropertiesPanel />)
    expect(screen.getByText('True / False')).toBeTruthy()
  })

  it('renders "Correct Answer" section with True and False labels', () => {
    render(<QuestionPropertiesPanel />)
    expect(screen.getByText('Correct Answer')).toBeTruthy()
    expect(screen.getByLabelText('True')).toBeTruthy()
    expect(screen.getByLabelText('False')).toBeTruthy()
  })

  it('True radio is checked by default (TF_DEFAULT_EXTENDED.correctAnswer = true)', () => {
    render(<QuestionPropertiesPanel />)
    const trueRadio = screen.getByLabelText('True') as HTMLInputElement
    const falseRadio = screen.getByLabelText('False') as HTMLInputElement
    expect(trueRadio.checked).toBe(true)
    expect(falseRadio.checked).toBe(false)
  })

  it('calls component.set with correctAnswer: false when False is selected', () => {
    const comp = makeMockComponent('question-tf', { ...TF_DEFAULT_EXTENDED })
    const editor = makeMockEditor(comp)
    useEditorStore.setState({ editor, selectedComponentType: 'question-tf' })

    render(<QuestionPropertiesPanel />)
    fireEvent.click(screen.getByLabelText('False'))

    expect(comp.set).toHaveBeenCalledWith(
      'extendedProperties',
      expect.objectContaining({ correctAnswer: false }),
    )
  })
})

describe('T607.7 — QuestionPropertiesPanel: Fill form renders answers + match-type', () => {
  beforeEach(() => {
    const comp = makeMockComponent('question-fill', FILL_DEFAULT_EXTENDED)
    const editor = makeMockEditor(comp)
    useEditorStore.setState({ editor, selectedComponentType: 'question-fill' })
  })

  it('renders the "Fill in the Blank" section heading', () => {
    render(<QuestionPropertiesPanel />)
    expect(screen.getByText('Fill in the Blank')).toBeTruthy()
  })

  it('renders a match-type <select> with case-insensitive, exact, regex options', () => {
    render(<QuestionPropertiesPanel />)
    const select = screen.getByDisplayValue('Case-insensitive') as HTMLSelectElement
    expect(select).toBeTruthy()
    expect(select.tagName).toBe('SELECT')
    const options = Array.from(select.options).map(o => o.value)
    expect(options).toContain('case-insensitive')
    expect(options).toContain('exact')
    expect(options).toContain('regex')
  })

  it('renders the default accepted answer input', () => {
    render(<QuestionPropertiesPanel />)
    expect(screen.getByDisplayValue('Paris')).toBeTruthy()
  })

  it('calls component.set when match type changes to "exact"', () => {
    const comp = makeMockComponent('question-fill', { ...FILL_DEFAULT_EXTENDED })
    const editor = makeMockEditor(comp)
    useEditorStore.setState({ editor, selectedComponentType: 'question-fill' })

    render(<QuestionPropertiesPanel />)
    const select = screen.getByDisplayValue('Case-insensitive')
    fireEvent.change(select, { target: { value: 'exact' } })

    expect(comp.set).toHaveBeenCalledWith(
      'extendedProperties',
      expect.objectContaining({ matchType: 'exact' }),
    )
  })
})
