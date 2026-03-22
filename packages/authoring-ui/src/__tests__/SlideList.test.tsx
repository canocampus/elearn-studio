/**
 * Unit tests for SlideList component — T013.1–T013.5
 *
 * T013.1 — Add blank slide via "+" button
 * T013.2 — Duplicate slide
 * T013.3 — Delete slide with confirm (disabled when only one slide)
 * T013.4 — Slides are draggable (reorder via HTML5 DnD; full flow covered by E2E)
 * T013.5 — Rename slide via double-click inline edit
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { SlideList } from '../components/sidebar/SlideList'
import { useEditorStore } from '../store/editorStore'
import type { CourseDoc } from '../types/course'

// ---------------------------------------------------------------------------
// Mock the API layer
// ---------------------------------------------------------------------------

vi.mock('../api/courseApi', () => ({
  addSlide: vi.fn(),
  deleteSlide: vi.fn(),
  duplicateSlide: vi.fn(),
  reorderSlides: vi.fn(),
  updateSlide: vi.fn(),
  nextSlideTitle: (slides: { id: string }[]) => `Slide ${slides.length + 1}`,
}))

import {
  addSlide,
  deleteSlide,
  duplicateSlide,
  updateSlide,
} from '../api/courseApi'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSlide(id: string, title: string) {
  return {
    id,
    title,
    widgets: [],
    actions: [],
  }
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

function setupStore(course: CourseDoc | null, currentSlideIndex = 0) {
  useEditorStore.setState({ course, currentSlideIndex })
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('SlideList', () => {
  afterEach(() => {
    vi.clearAllMocks()
    // Reset store to clean state
    useEditorStore.setState({ course: null, currentSlideIndex: 0 })
  })

  // -------------------------------------------------------------------------
  // Empty state
  // -------------------------------------------------------------------------

  describe('no course loaded', () => {
    it('shows "No course loaded" message', () => {
      setupStore(null)
      render(<SlideList />)
      expect(screen.getByText(/No course loaded/i)).toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // Slide rendering
  // -------------------------------------------------------------------------

  describe('slide rendering', () => {
    it('renders all slide titles', () => {
      setupStore(makeCourse([makeSlide('s1', 'Intro'), makeSlide('s2', 'Module 1')]))
      render(<SlideList />)
      expect(screen.getByText('Intro')).toBeInTheDocument()
      expect(screen.getByText('Module 1')).toBeInTheDocument()
    })

    it('renders 1-based slide numbers in thumbnails', () => {
      setupStore(makeCourse([makeSlide('s1', 'A'), makeSlide('s2', 'B'), makeSlide('s3', 'C')]))
      render(<SlideList />)
      expect(screen.getByText('1')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
    })

    it('renders "+ Add Slide" button', () => {
      setupStore(makeCourse([makeSlide('s1', 'Slide 1')]))
      render(<SlideList />)
      expect(screen.getByRole('button', { name: /Add Slide/i })).toBeInTheDocument()
    })

    it('slide items are draggable (T013.4)', () => {
      setupStore(makeCourse([makeSlide('s1', 'Slide 1'), makeSlide('s2', 'Slide 2')]))
      const { container } = render(<SlideList />)
      const items = container.querySelectorAll('[draggable]')
      expect(items).toHaveLength(2)
    })
  })

  // -------------------------------------------------------------------------
  // T013.1 — Add slide
  // -------------------------------------------------------------------------

  describe('T013.1 — add slide', () => {
    beforeEach(() => {
      const initial = makeCourse([makeSlide('s1', 'Slide 1')])
      const updated = makeCourse([makeSlide('s1', 'Slide 1'), makeSlide('s2', 'Slide 2')])
      vi.mocked(addSlide).mockResolvedValue(updated)
      setupStore(initial)
    })

    it('calls addSlide with courseId and new title on "+" click', async () => {
      render(<SlideList />)
      fireEvent.click(screen.getByRole('button', { name: /Add Slide/i }))
      await waitFor(() => expect(addSlide).toHaveBeenCalledWith('course-1', 'Slide 2'))
    })

    it('updates the store with returned course after add', async () => {
      render(<SlideList />)
      fireEvent.click(screen.getByRole('button', { name: /Add Slide/i }))
      await waitFor(() => {
        const course = useEditorStore.getState().course
        expect(course?.slides).toHaveLength(2)
      })
    })

    it('selects the new (last) slide after add', async () => {
      render(<SlideList />)
      fireEvent.click(screen.getByRole('button', { name: /Add Slide/i }))
      await waitFor(() => {
        expect(useEditorStore.getState().currentSlideIndex).toBe(1)
      })
    })
  })

  // -------------------------------------------------------------------------
  // T013.3 — Delete slide
  // -------------------------------------------------------------------------

  describe('T013.3 — delete slide', () => {
    it('delete button is disabled when only one slide', () => {
      setupStore(makeCourse([makeSlide('s1', 'Only Slide')]))
      render(<SlideList />)
      // Hover to reveal action buttons
      const item = screen.getByTitle('Only Slide')
      fireEvent.mouseEnter(item)
      const deleteBtn = screen.getByTitle('Cannot delete last slide')
      expect(deleteBtn).toBeDisabled()
    })

    it('does not call deleteSlide if user cancels confirm', async () => {
      const course = makeCourse([makeSlide('s1', 'A'), makeSlide('s2', 'B')])
      setupStore(course)
      vi.spyOn(window, 'confirm').mockReturnValue(false)
      render(<SlideList />)
      const item = screen.getByTitle('A')
      fireEvent.mouseEnter(item)
      const deleteBtn = screen.getByTitle('Delete slide')
      fireEvent.click(deleteBtn)
      await waitFor(() => expect(deleteSlide).not.toHaveBeenCalled())
    })

    it('calls deleteSlide after confirm and updates store', async () => {
      const course = makeCourse([makeSlide('s1', 'A'), makeSlide('s2', 'B')])
      const updated = makeCourse([makeSlide('s2', 'B')])
      vi.mocked(deleteSlide).mockResolvedValue(updated)
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      setupStore(course)

      render(<SlideList />)
      const item = screen.getByTitle('A')
      fireEvent.mouseEnter(item)
      const deleteBtn = screen.getByTitle('Delete slide')
      fireEvent.click(deleteBtn)

      await waitFor(() => {
        expect(deleteSlide).toHaveBeenCalledWith('course-1', 's1')
        expect(useEditorStore.getState().course?.slides).toHaveLength(1)
      })
    })

    it('adjusts currentSlideIndex when deleted slide was last', async () => {
      const course = makeCourse([makeSlide('s1', 'A'), makeSlide('s2', 'B')])
      const updated = makeCourse([makeSlide('s1', 'A')])
      vi.mocked(deleteSlide).mockResolvedValue(updated)
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      setupStore(course, 1) // s2 is selected

      render(<SlideList />)
      const item = screen.getByTitle('B')
      fireEvent.mouseEnter(item)
      const deleteBtn = screen.getByTitle('Delete slide')
      fireEvent.click(deleteBtn)

      await waitFor(() => {
        expect(useEditorStore.getState().currentSlideIndex).toBe(0)
      })
    })
  })

  // -------------------------------------------------------------------------
  // T013.2 — Duplicate slide
  // -------------------------------------------------------------------------

  describe('T013.2 — duplicate slide', () => {
    it('calls duplicateSlide with courseId and source slide', async () => {
      const slide = makeSlide('s1', 'Slide 1')
      const course = makeCourse([slide])
      const updated = makeCourse([slide, makeSlide('s2', 'Slide 1 copy')])
      vi.mocked(duplicateSlide).mockResolvedValue(updated)
      setupStore(course)

      render(<SlideList />)
      const item = screen.getByTitle('Slide 1')
      fireEvent.mouseEnter(item)
      const dupBtn = screen.getByTitle('Duplicate slide')
      fireEvent.click(dupBtn)

      await waitFor(() => {
        expect(duplicateSlide).toHaveBeenCalledWith('course-1', slide)
        expect(useEditorStore.getState().course?.slides).toHaveLength(2)
      })
    })

    it('selects the new (last) slide after duplicate', async () => {
      const slide = makeSlide('s1', 'Slide 1')
      const updated = makeCourse([slide, makeSlide('s2', 'Slide 1 copy')])
      vi.mocked(duplicateSlide).mockResolvedValue(updated)
      setupStore(makeCourse([slide]))

      render(<SlideList />)
      const item = screen.getByTitle('Slide 1')
      fireEvent.mouseEnter(item)
      fireEvent.click(screen.getByTitle('Duplicate slide'))

      await waitFor(() => {
        expect(useEditorStore.getState().currentSlideIndex).toBe(1)
      })
    })
  })

  // -------------------------------------------------------------------------
  // T013.5 — Rename slide
  // -------------------------------------------------------------------------

  describe('T013.5 — rename slide (double-click)', () => {
    it('double-click on slide shows an input with current title', () => {
      setupStore(makeCourse([makeSlide('s1', 'Old Title')]))
      render(<SlideList />)
      const item = screen.getByTitle('Old Title')
      fireEvent.dblClick(item)
      const input = screen.getByRole('textbox')
      expect(input).toBeInTheDocument()
      expect((input as HTMLInputElement).value).toBe('Old Title')
    })

    it('Enter commits the rename and calls updateSlide', async () => {
      const course = makeCourse([makeSlide('s1', 'Old Title')])
      const updated = makeCourse([makeSlide('s1', 'New Title')])
      vi.mocked(updateSlide).mockResolvedValue(updated)
      setupStore(course)

      render(<SlideList />)
      fireEvent.dblClick(screen.getByTitle('Old Title'))
      const input = screen.getByRole('textbox')
      fireEvent.change(input, { target: { value: 'New Title' } })
      fireEvent.keyDown(input, { key: 'Enter' })

      await waitFor(() => {
        expect(updateSlide).toHaveBeenCalledWith('course-1', 's1', { title: 'New Title' })
      })
    })

    it('Escape cancels the rename without calling updateSlide', async () => {
      setupStore(makeCourse([makeSlide('s1', 'Original')]))
      render(<SlideList />)
      fireEvent.dblClick(screen.getByTitle('Original'))
      const input = screen.getByRole('textbox')
      fireEvent.change(input, { target: { value: 'Changed' } })
      fireEvent.keyDown(input, { key: 'Escape' })

      await waitFor(() => {
        expect(updateSlide).not.toHaveBeenCalled()
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
      })
    })

    it('does not call updateSlide when title is unchanged', async () => {
      const course = makeCourse([makeSlide('s1', 'Same Title')])
      setupStore(course)
      render(<SlideList />)
      fireEvent.dblClick(screen.getByTitle('Same Title'))
      const input = screen.getByRole('textbox')
      fireEvent.keyDown(input, { key: 'Enter' }) // commit unchanged title

      await waitFor(() => {
        expect(updateSlide).not.toHaveBeenCalled()
      })
    })

    it('does not call updateSlide when title is blank', async () => {
      setupStore(makeCourse([makeSlide('s1', 'Title')]))
      render(<SlideList />)
      fireEvent.dblClick(screen.getByTitle('Title'))
      const input = screen.getByRole('textbox')
      fireEvent.change(input, { target: { value: '   ' } })
      fireEvent.keyDown(input, { key: 'Enter' })

      await waitFor(() => {
        expect(updateSlide).not.toHaveBeenCalled()
      })
    })
  })

  // -------------------------------------------------------------------------
  // T013-M-01 — Error handling: API throws
  // -------------------------------------------------------------------------

  describe('error handling — API throws', () => {
    it('addSlide throws → sets saveError, course unchanged', async () => {
      const course = makeCourse([makeSlide('s1', 'Slide 1')])
      vi.mocked(addSlide).mockRejectedValue(new Error('network error'))
      setupStore(course)

      render(<SlideList />)
      fireEvent.click(screen.getByTitle('Add blank slide'))

      await waitFor(() => {
        expect(useEditorStore.getState().saveError).toBe('network error')
        // Course in store must remain unchanged
        expect(useEditorStore.getState().course).toEqual(course)
      })
    })

    it('deleteSlide throws → sets saveError, course unchanged', async () => {
      const course = makeCourse([makeSlide('s1', 'Slide 1'), makeSlide('s2', 'Slide 2')])
      vi.mocked(deleteSlide).mockRejectedValue(new Error('delete failed'))
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      setupStore(course, 1)

      render(<SlideList />)
      // Click delete on the first slide's button (both canDelete since 2 slides)
      const deleteButtons = screen.getAllByTitle('Delete slide')
      fireEvent.click(deleteButtons[0])

      await waitFor(() => {
        expect(useEditorStore.getState().saveError).toBe('delete failed')
        expect(useEditorStore.getState().course).toEqual(course)
      })
    })

    it('duplicateSlide throws → sets saveError, course unchanged', async () => {
      const course = makeCourse([makeSlide('s1', 'Slide 1')])
      vi.mocked(duplicateSlide).mockRejectedValue(new Error('dup failed'))
      setupStore(course)

      render(<SlideList />)
      fireEvent.click(screen.getByTitle('Duplicate slide'))

      await waitFor(() => {
        expect(useEditorStore.getState().saveError).toBe('dup failed')
        expect(useEditorStore.getState().course).toEqual(course)
      })
      await act(async () => {})
    })

    it('updateSlide (rename) throws → sets saveError, course unchanged', async () => {
      const course = makeCourse([makeSlide('s1', 'Original')])
      vi.mocked(updateSlide).mockRejectedValue(new Error('rename failed'))
      setupStore(course)

      render(<SlideList />)
      fireEvent.dblClick(screen.getByTitle('Original'))
      const input = screen.getByRole('textbox')
      fireEvent.change(input, { target: { value: 'New Name' } })
      fireEvent.keyDown(input, { key: 'Enter' })

      await waitFor(() => {
        expect(useEditorStore.getState().saveError).toBe('rename failed')
        expect(useEditorStore.getState().course).toEqual(course)
      })
      await act(async () => {})
    })
  })
})
