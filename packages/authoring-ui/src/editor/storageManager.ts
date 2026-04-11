/**
 * GrapesJS custom Storage Manager — elearn-api type.
 *
 * T011.1 — Register custom storage type `elearn-api` in GrapesJS.
 * T011.2 — store(): convert GrapesJS component tree → Widget[] schema → PATCH /courses/:id/slides/:slideId.
 * T011.3 — load(): GET /courses/:id → find slide → convert Widget[] → GrapesJS component definitions.
 *
 * CRITICAL: Never let GrapesJS save raw HTML (see CLAUDE.md).
 * All persistence goes through our Course/Slide/Widget JSON schema.
 */

import type { Editor } from 'grapesjs'
import type { CourseDoc } from '../types/course'
import * as courseApi from '../api/courseApi'
import { grapesjsFromWidgets, widgetsFromGrapesjs } from './converters'

export interface StorageOptions {
  courseId: string
  slideId: string
}

// R-03: Module-level mutable context so the storage manager can access the current
// slide without requiring a full editor re-init on every slide switch.
const storageContext: StorageOptions = { courseId: '', slideId: '' }

// T042.5: In-memory course cache to eliminate redundant API round-trips on slide
// switches. Keyed by courseId. On a successful store(), the cache is updated with
// fresh widget data so the next load() can serve from cache instead of re-fetching.
// On a failed store(), the cache is cleared so stale data is never served.
let courseCache: { courseId: string; doc: CourseDoc } | null = null

/**
 * Updates the active course/slide context that the storage manager reads.
 * Call this before `editor.load()` when switching slides.
 */
export function updateStorageContext(opts: StorageOptions): void {
  storageContext.courseId = opts.courseId
  storageContext.slideId = opts.slideId
}

/**
 * Returns a snapshot of the current storage context.
 * Used by the autosave handler to detect slide switches during the debounce window.
 */
export function getStorageContext(): Readonly<StorageOptions> {
  return { courseId: storageContext.courseId, slideId: storageContext.slideId }
}

/**
 * Evicts the course cache. Exposed for testing and for explicit invalidation
 * when the course structure changes (e.g. slide added/deleted via SlideList).
 */
export function invalidateCourseCache(): void {
  courseCache = null
}

/**
 * Generates an inline HTML srcdoc string that represents the current slide canvas state.
 * Used as the thumbnail payload sent to the backend on every save.
 *
 * T700: Extracted from store() so thumbnail failures can be isolated with a try-catch —
 * a canvas API error must NOT block the widget data from being saved.
 */
export function generateThumbnail(editor: Editor): string {
  const html = editor.getHtml()
  const css = editor.getCss()
  return (
    `<!DOCTYPE html><html><head><style>` +
    `*{box-sizing:border-box}body{margin:0;overflow:hidden;background:#fff}${css}` +
    `</style></head><body>${html}</body></html>`
  )
}

/**
 * Registers the `elearn-api` storage type with GrapesJS.
 * Must be called before `editor.load()`.
 */
export function registerStorageManager(editor: Editor): void {
  editor.StorageManager.add('elearn-api', {
    /**
     * Loads the slide content from the backend.
     * T011.3 — Implementation.
     * T042.5 — Uses in-memory cache to skip redundant API fetches on slide switches.
     */
    async load() {
      const { courseId, slideId } = storageContext
      if (!courseId || !slideId) {
        console.warn('[StorageManager] load() skipped — missing context', { courseId, slideId })
        // actions: [] required on the wrapper component — GrapesJS loadData() calls
        // .forEach() on componentDef.actions for every component it processes (including
        // the page wrapper). Omitting it causes "Cannot read properties of undefined
        // (reading 'forEach')" TypeError in loadData.
        return { pages: [{ component: { actions: [], components: [] } }], styles: [] }
      }

      try {
        let course: CourseDoc
        if (courseCache?.courseId === courseId) {
          course = courseCache.doc
        } else {
          course = await courseApi.getCourse(courseId)
          courseCache = { courseId, doc: course }
        }

        if (!Array.isArray(course.slides)) {
          throw new Error(`Invalid course data: 'slides' is missing or not an array for course ${courseId}`)
        }

        const slide = course.slides.find((s) => s.id === slideId)

        if (!slide) {
          throw new Error(`Slide ${slideId} not found in course ${courseId}`)
        }

        // Convert our Widget schema → GrapesJS component tree
        const components = grapesjsFromWidgets(slide.widgets ?? [])

        // GrapesJS loadData() requires project data in { pages: [...] } format.
        // Returning { components: [...] } directly causes a TypeError in loadData because
        // PageManager.clear() empties the pages collection before ComponentManager.load()
        // tries to call getWrapper() — which returns null when no pages exist.
        // Wrapping in a page with a component object creates the frame + wrapper correctly.
        return {
          pages: [
            {
              id: slideId,
              // actions: [] required on the wrapper component — GrapesJS loadData() calls
              // .forEach() on componentDef.actions for every component it processes.
              component: { actions: [], components },
            },
          ],
          styles: [],
        }
      } catch (err) {
        console.error('[StorageManager] load() failed:', err)
        throw err
      }
    },

    /**
     * Stores the slide content to the backend.
     * T011.2 — Implementation.
     */
    async store(_data: unknown) {
      const { courseId, slideId } = storageContext
      if (!courseId || !slideId) {
        console.warn('[StorageManager] store() skipped — missing context', { courseId, slideId })
        return
      }

      try {
        // Convert GrapesJS component tree → our Widget schema
        // 'components' in data is the array of top-level component definitions
        const widgets = widgetsFromGrapesjs(editor.getComponents().toArray())

        // T700: Thumbnail generation is isolated in its own try-catch so that any
        // canvas API failure (security policy, missing element, GrapesJS internal error)
        // does NOT block the widget data from being saved. Data integrity > thumbnail.
        let thumbnail: string | undefined
        try {
          thumbnail = generateThumbnail(editor)
        } catch (thumbnailErr) {
          console.warn('[StorageManager] thumbnail generation failed, saving without thumbnail:', thumbnailErr)
        }

        await courseApi.updateSlide(courseId, slideId, { widgets, thumbnail })

        // T640.1: Update cache with fresh widget data instead of invalidating it.
        // This avoids a redundant GET /courses/:id on the next load() call.
        // Only update if the cache already holds this course — if cache is cold
        // (e.g. first store before any load), leave it as-is.
        if (courseCache?.courseId === courseId) {
          const updatedSlides = courseCache.doc.slides.map(s =>
            s.id === slideId ? { ...s, widgets } : s
          )
          courseCache = { courseId, doc: { ...courseCache.doc, slides: updatedSlides } }
        }
      } catch (err) {
        // T042.5: Invalidate on failure so stale data is never served after a failed save.
        courseCache = null
        console.error('[StorageManager] store() failed:', err)
        throw err
      }
    },
  })
}
