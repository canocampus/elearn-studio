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
// switches. Keyed by courseId; cleared whenever a successful store() updates the
// slide data so the next load() reflects the latest saved state.
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
        return { components: [], styles: [] }
      }

      try {
        let course: CourseDoc
        if (courseCache?.courseId === courseId) {
          course = courseCache.doc
        } else {
          course = await courseApi.getCourse(courseId)
          courseCache = { courseId, doc: course }
        }

        const slide = course.slides.find((s) => s.id === slideId)

        if (!slide) {
          throw new Error(`Slide ${slideId} not found in course ${courseId}`)
        }

        // Convert our Widget schema → GrapesJS component tree
        const components = grapesjsFromWidgets(slide.widgets)

        return {
          components,
          // GrapesJS loadData() expects a 'styles' array, not a 'css' string.
          // All styles are inline in components (fixed layout) so this is always empty.
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

        // T013.6: capture a thumbnail srcdoc string from the current canvas state
        const html = editor.getHtml()
        const css = editor.getCss()
        const thumbnail =
          `<!DOCTYPE html><html><head><style>` +
          `*{box-sizing:border-box}body{margin:0;overflow:hidden;background:#fff}${css}` +
          `</style></head><body>${html}</body></html>`

        await courseApi.updateSlide(courseId, slideId, { widgets, thumbnail })
      } catch (err) {
        console.error('[StorageManager] store() failed:', err)
        throw err
      } finally {
        // Invalidate cache on all paths so stale data is never served after a save attempt
        courseCache = null
      }
    },
  })
}
