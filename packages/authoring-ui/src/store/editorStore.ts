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

  leftTab: 'slides',
  setLeftTab: (leftTab) => set({ leftTab }),

  rightTab: 'layers',
  setRightTab: (rightTab) => set({ rightTab }),

  selectedComponentType: null,
  setSelectedComponentType: (selectedComponentType) => set({ selectedComponentType }),

  selectedWidgetId: null,
  setSelectedWidgetId: (selectedWidgetId) => set({ selectedWidgetId }),
}), { name: 'editorStore', enabled: import.meta.env.DEV }))
