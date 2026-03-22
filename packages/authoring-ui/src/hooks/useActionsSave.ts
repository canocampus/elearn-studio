/**
 * useActionsSave — T020.19
 *
 * Subscribes to actionsStore changes and persists action sequences back to
 * the course document whenever the sequences for the current widget change.
 * Delegates to the GrapesJS editor.store() (Storage Manager) so that the
 * save path is identical to all other slide edits.
 */

import { useEffect, useRef } from 'react'
import { useActionsStore } from '../store/actionsStore'
import { useEditorStore } from '../store/editorStore'
import { updateCourse } from '../api/courseApi'
import type { ActionSequence, SharedActionSequence } from '../types/actions'

export function useActionsSave() {
  // Track last saved sequences to avoid redundant saves
  const lastSavedRef = useRef<ActionSequence[] | null>(null)

  // Track the widgetId we last saved for, so we can reset the comparison ref
  // when the selection changes to a different widget.
  const lastWidgetRef = useRef<string | null>(null)

  // Track last saved shared sequences to avoid redundant course PATCH calls
  const lastSharedRef = useRef<SharedActionSequence[] | null>(null)

  useEffect(() => {
    return useActionsStore.subscribe((state) => {
      const { widgetId, sequences, sharedSequences } = state

      // ── Shared sequences — persist via updateCourse() on change ──────────
      if (sharedSequences !== lastSharedRef.current) {
        lastSharedRef.current = sharedSequences
        const { course, setCourse } = useEditorStore.getState()
        if (course) {
          const updated = { ...course, sharedSequences }
          setCourse(updated)
          updateCourse(course._id, { sharedSequences }).catch((err: unknown) => {
            console.error('[useActionsSave] updateCourse(sharedSequences) failed:', err)
          })
        }
      }

      if (!widgetId) return

      // Reset stale comparison when switching widgets
      if (widgetId !== lastWidgetRef.current) {
        lastWidgetRef.current = widgetId
        lastSavedRef.current = null
      }

      if (sequences === lastSavedRef.current) return

      lastSavedRef.current = sequences

      // Update the in-memory course doc so the GrapesJS storage manager picks
      // up the latest sequences on the next editor.store() call.
      const { course, currentSlideIndex, setCourse } = useEditorStore.getState()
      if (!course) return

      const slide = course.slides[currentSlideIndex]
      if (!slide) return

      const updatedWidgets = slide.widgets.map((w) =>
        w.id === widgetId ? { ...w, actions: sequences } : w,
      )

      const updatedSlides = course.slides.map((s, i) =>
        i === currentSlideIndex ? { ...s, widgets: updatedWidgets } : s,
      )

      setCourse({ ...course, slides: updatedSlides })

      // Trigger GrapesJS autosave (storage.store) if the editor is mounted
      const { editor } = useEditorStore.getState()
      if (editor) {
        void editor.store().catch((err: unknown) => {
          console.error('[useActionsSave] store() failed:', err)
        })
      }
    })
  }, [])
}
