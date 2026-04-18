/**
 * Global Zustand store for authoring-ui editor state.
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Editor } from 'grapesjs'
import type { CourseDoc, Slide } from '../types/course'

interface EditorState {
  // GrapesJS editor instance (set after init)
  editor: Editor | null
  setEditor: (editor: Editor | null) => void

  // Course data
  course: CourseDoc | null
  setCourse: (course: CourseDoc) => void

  // Current slide index
  currentSlideIndex: number
  setCurrentSlideIndex: (index: number) => void

  // Derived: current slide
  currentSlide: () => Slide | null

  // UI state
  isSaving: boolean
  setIsSaving: (saving: boolean) => void
  saveError: string | null
  setSaveError: (error: string | null) => void

  // T651.3: unified save entry point — bound closure returned by initEditor().
  // Null until the editor is ready; set via setRequestSave in EditorCanvas Effect 1.
  // See decisions/2026-04-17-request-save.md.
  requestSave: ((opts?: { timeoutMs?: number }) => Promise<void>) | null
  setRequestSave: (fn: EditorState['requestSave']) => void

  // TD-007: unified course-meta mutation entry point — bound closure constructed
  // in initEditor() alongside requestSave. Takes a courseApi call and funnels
  // setIsSaving/setSaveError/bumpCacheVersion around it. Null until the editor
  // is ready; set via setRequestCourseMutation in EditorCanvas Effect 1.
  // See decisions/2026-04-18-course-mutation.md.
  requestCourseMutation:
    | (<R>(apiCall: () => Promise<R>, opts?: { bumpCache?: boolean }) => Promise<R | undefined>)
    | null
  setRequestCourseMutation: (fn: EditorState['requestCourseMutation']) => void

  // Left sidebar tab: 'slides' | 'blocks'
  leftTab: 'slides' | 'blocks'
  setLeftTab: (tab: 'slides' | 'blocks') => void

  // Right sidebar tab: 'layers' | 'styles' | 'properties' | 'actions' | 'animations'
  rightTab: 'layers' | 'styles' | 'properties' | 'actions' | 'animations'
  setRightTab: (tab: 'layers' | 'styles' | 'properties' | 'actions' | 'animations') => void

  // Selected component type (null when nothing is selected)
  selectedComponentType: string | null
  setSelectedComponentType: (type: string | null) => void

  // Selected widget ID in GrapesJS canvas (null when nothing selected)
  selectedWidgetId: string | null
  setSelectedWidgetId: (id: string | null) => void

  // New Course dialog visibility
  showNewCourseDialog: boolean
  setShowNewCourseDialog: (show: boolean) => void

  // Storage context — active courseId/slideId for the storage manager
  courseId: string
  slideId: string
  cacheVersion: number
  setEditorContext: (opts: { courseId: string; slideId: string }) => void
  bumpCacheVersion: () => void
}

export const useEditorStore = create<EditorState>()(devtools((set, get) => ({
  editor: null,
  setEditor: (editor) => set({ editor }),

  course: null,
  setCourse: (course) => set({ course }),

  currentSlideIndex: 0,
  setCurrentSlideIndex: (index) => set({ currentSlideIndex: index }),

  currentSlide: () => {
    const { course, currentSlideIndex } = get()
    return course?.slides[currentSlideIndex] ?? null
  },

  isSaving: false,
  setIsSaving: (isSaving) => set({ isSaving }),
  saveError: null,
  setSaveError: (saveError) => set({ saveError }),

  requestSave: null,
  setRequestSave: (requestSave) => set({ requestSave }),

  requestCourseMutation: null,
  setRequestCourseMutation: (requestCourseMutation) => set({ requestCourseMutation }),

  leftTab: 'slides',
  setLeftTab: (leftTab) => set({ leftTab }),

  rightTab: 'layers',
  setRightTab: (rightTab) => set({ rightTab }),

  selectedComponentType: null,
  setSelectedComponentType: (selectedComponentType) => set({ selectedComponentType }),

  selectedWidgetId: null,
  setSelectedWidgetId: (selectedWidgetId) => set({ selectedWidgetId }),

  showNewCourseDialog: false,
  setShowNewCourseDialog: (showNewCourseDialog) => set({ showNewCourseDialog }),

  courseId: '',
  slideId: '',
  cacheVersion: 0,
  setEditorContext: ({ courseId, slideId }) => set({ courseId, slideId }),
  bumpCacheVersion: () => set((s) => ({ cacheVersion: s.cacheVersion + 1 })),
}), { name: 'editorStore', enabled: import.meta.env.DEV }))
