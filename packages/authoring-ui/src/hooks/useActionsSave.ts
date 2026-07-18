/**
 * useActionsSave — T020.19
 *
 * Subscribes to actionsStore changes and persists action sequences back to
 * the course document whenever the sequences for the current widget change.
 * T651.3: delegates to requestSave() (the unified save entry point) so that
 * the save path — and its isSaving/saveError UI state — is identical to all
 * other slide edits. Prior to T651 this path called editor.store() directly
 * and swallowed errors into console.error, leaving users with no indication
 * of a failed save.
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

      // TD-015: a widget switch means setWidget() just LOADED the persisted
      // sequences into the panel — adopt them as the comparison baseline and
      // stop. Treating the load like an edit (the previous `lastSavedRef =
      // null` reset) made the subscription re-save whatever was loaded; when
      // the selection-boundary id bug seeded `[]`, mere selection persisted
      // an empty array and wiped the widget's saved actions. Loading must
      // never save; only a subsequent real edit (new sequences array) may.
      if (widgetId !== lastWidgetRef.current) {
        lastWidgetRef.current = widgetId
        lastSavedRef.current = sequences
        return
      }

      if (sequences === lastSavedRef.current) return

      lastSavedRef.current = sequences

      // Update the in-memory course doc so the GrapesJS storage manager picks
      // up the latest sequences on the next requestSave() call (T651.3).
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

      const { editor, requestSave } = useEditorStore.getState()
      if (editor) {
        // Sync actions to the GrapesJS component model so storageManager's store()
        // reads the updated value via widgetsFromGrapesjs (c.get('actions')).
        // Without this, newly-added components never have 'actions' on their model
        // and the storage manager always saves an empty array after reload.
        //
        // Try GrapesJS model ID first, then fall back to HTML attribute 'id'
        // (set via grapesjsFromWidgets → attributes: { id: w.id }).
        // Note: getById() declares Component (non-nullable) but returns undefined
        // at runtime when not found, so we cast via unknown.
        const byId = editor.Components.getById(widgetId) as unknown as
          | ReturnType<typeof editor.Components.getById>
          | undefined
        const component =
          byId ??
          editor
            .getComponents()
            .toArray()
            .find((c) => c.getAttributes().id === widgetId)
        if (component) {
          component.set('elearnActions', sequences)
        }
        // T651.3: unified save — failures now surface via SaveErrorBanner instead of
        // being swallowed into console.error only. Log retained for audit trail.
        if (requestSave) {
          void requestSave().catch((err: unknown) => {
            console.error('[useActionsSave] store() failed:', err)
          })
        }
      }
    })
  }, [])
}
