/**
 * Tests for storageManager.ts
 *
 * Covers reviewer fix:
 *   R-03 — updateStorageContext() replaces per-call options so slide switches
 *           don't require a full editor re-init on every slide switch.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Editor } from 'grapesjs'

// Mock the API and converters before importing the module under test
vi.mock('../api/courseApi', () => ({
  getCourse: vi.fn(),
  updateSlide: vi.fn(),
}))

vi.mock('../editor/converters', () => ({
  grapesjsFromWidgets: vi.fn().mockReturnValue([]),
  widgetsFromGrapesjs: vi.fn().mockReturnValue([]),
}))

import { updateStorageContext, registerStorageManager, getStorageContext, invalidateCourseCache } from '../editor/storageManager'
import * as courseApi from '../api/courseApi'
import { grapesjsFromWidgets, widgetsFromGrapesjs } from '../editor/converters'

// ---------------------------------------------------------------------------
// R-03 — updateStorageContext
// ---------------------------------------------------------------------------

describe('storageManager — R-03 updateStorageContext', () => {
  it('accepts a courseId and slideId without throwing', () => {
    expect(() => updateStorageContext({ courseId: 'c1', slideId: 's1' })).not.toThrow()
  })

  it('can be called multiple times (slide switching)', () => {
    updateStorageContext({ courseId: 'c1', slideId: 's1' })
    updateStorageContext({ courseId: 'c1', slideId: 's2' })
    updateStorageContext({ courseId: 'c2', slideId: 's3' })
    // No error expected — module absorbs all context changes
  })
})

// ---------------------------------------------------------------------------
// CRITICAL-01 fix — getStorageContext snapshot for race-condition guard
// ---------------------------------------------------------------------------

describe('storageManager — getStorageContext', () => {
  it('returns the current context as a snapshot', () => {
    updateStorageContext({ courseId: 'c1', slideId: 's1' })
    const snap = getStorageContext()
    expect(snap.courseId).toBe('c1')
    expect(snap.slideId).toBe('s1')
  })

  it('snapshot is not affected by subsequent updateStorageContext calls', () => {
    updateStorageContext({ courseId: 'c1', slideId: 's1' })
    const snap = getStorageContext()
    updateStorageContext({ courseId: 'c2', slideId: 's2' })
    // Snapshot is a copy — should reflect the values at snapshot time
    expect(snap.courseId).toBe('c1')
    expect(snap.slideId).toBe('s1')
  })
})

// ---------------------------------------------------------------------------
// registerStorageManager
// ---------------------------------------------------------------------------

describe('storageManager — registerStorageManager', () => {
  let addMock: ReturnType<typeof vi.fn>
  let editor: Editor

  beforeEach(() => {
    addMock = vi.fn()
    editor = {
      StorageManager: { add: addMock },
      getComponents: vi.fn().mockReturnValue({ toArray: vi.fn().mockReturnValue([]) }),
      getHtml: vi.fn().mockReturnValue('<div></div>'),
      getCss: vi.fn().mockReturnValue(''),
    } as unknown as Editor
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('registers elearn-api type with GrapesJS editor', () => {
    registerStorageManager(editor)

    expect(addMock).toHaveBeenCalledOnce()
    expect(addMock).toHaveBeenCalledWith(
      'elearn-api',
      expect.objectContaining({
        load: expect.any(Function),
        store: expect.any(Function),
      }),
    )
  })

  describe('load()', () => {
    it('returns empty object when context is missing', async () => {
      updateStorageContext({ courseId: '', slideId: '' })
      registerStorageManager(editor)

      const impl = addMock.mock.calls[0][1] as { load: () => Promise<unknown> }
      const result = await impl.load()

      expect(result).toEqual({ components: [], styles: [] })
      expect(courseApi.getCourse).not.toHaveBeenCalled()
    })

    it('fetches course and converts widgets when context is set', async () => {
      const mockCourse = {
        slides: [{ id: 's1', title: 'Slide', widgets: [{ type: 'text', id: 'w1' }] }],
      }
      vi.mocked(courseApi.getCourse).mockResolvedValue(mockCourse as never)
      vi.mocked(grapesjsFromWidgets).mockReturnValue([{ type: 'text' }] as never)

      updateStorageContext({ courseId: 'c1', slideId: 's1' })
      registerStorageManager(editor)

      const impl = addMock.mock.calls[0][1] as { load: () => Promise<unknown> }
      const result = await impl.load()

      expect(courseApi.getCourse).toHaveBeenCalledWith('c1')
      expect(grapesjsFromWidgets).toHaveBeenCalledWith(mockCourse.slides[0].widgets)
      expect(result).toEqual({ components: [{ type: 'text' }], styles: [] })
    })

    it('throws when slide is not found in course', async () => {
      vi.mocked(courseApi.getCourse).mockResolvedValue({ slides: [] } as never)

      updateStorageContext({ courseId: 'c1', slideId: 'missing-slide' })
      registerStorageManager(editor)

      const impl = addMock.mock.calls[0][1] as { load: () => Promise<unknown> }
      await expect(impl.load()).rejects.toThrow('Slide missing-slide not found')
    })

    it('T042.5: reuses cached course on second load() for the same courseId', async () => {
      invalidateCourseCache()
      const mockCourse = {
        slides: [
          { id: 's1', title: 'Slide 1', widgets: [] },
          { id: 's2', title: 'Slide 2', widgets: [] },
        ],
      }
      vi.mocked(courseApi.getCourse).mockResolvedValue(mockCourse as never)

      registerStorageManager(editor)
      const impl = addMock.mock.calls[0][1] as { load: () => Promise<unknown> }

      updateStorageContext({ courseId: 'c1', slideId: 's1' })
      await impl.load()

      updateStorageContext({ courseId: 'c1', slideId: 's2' })
      await impl.load()

      // getCourse should only have been called once (cache hit on second load)
      expect(courseApi.getCourse).toHaveBeenCalledTimes(1)
    })

    it('T042.5: fetches fresh course after invalidateCourseCache()', async () => {
      invalidateCourseCache()
      const mockCourse = {
        slides: [{ id: 's1', title: 'Slide', widgets: [] }],
      }
      vi.mocked(courseApi.getCourse).mockResolvedValue(mockCourse as never)

      registerStorageManager(editor)
      const impl = addMock.mock.calls[0][1] as { load: () => Promise<unknown> }

      updateStorageContext({ courseId: 'c1', slideId: 's1' })
      await impl.load()
      invalidateCourseCache()
      await impl.load()

      expect(courseApi.getCourse).toHaveBeenCalledTimes(2)
    })
  })

  describe('store()', () => {
    it('skips save when context is missing', async () => {
      updateStorageContext({ courseId: '', slideId: '' })
      registerStorageManager(editor)

      const impl = addMock.mock.calls[0][1] as { store: (data: unknown) => Promise<void> }
      await impl.store({})

      expect(courseApi.updateSlide).not.toHaveBeenCalled()
    })

    it('converts components and calls updateSlide when context is set', async () => {
      const mockComponents = [{ type: 'text', id: 'w1' }]
      const mockWidgets = [{ type: 'text', id: 'w1', bounds: { x: 0, y: 0, width: 100, height: 50 } }]
      vi.mocked(editor.getComponents).mockReturnValue({ toArray: vi.fn().mockReturnValue(mockComponents) } as never)
      vi.mocked(widgetsFromGrapesjs).mockReturnValue(mockWidgets as never)
      vi.mocked(courseApi.updateSlide).mockResolvedValue({} as never)

      updateStorageContext({ courseId: 'c1', slideId: 's1' })
      registerStorageManager(editor)

      const impl = addMock.mock.calls[0][1] as { store: (data: unknown) => Promise<void> }
      await impl.store({})

      expect(widgetsFromGrapesjs).toHaveBeenCalledWith(mockComponents)
      expect(courseApi.updateSlide).toHaveBeenCalledWith(
        'c1',
        's1',
        expect.objectContaining({ widgets: mockWidgets, thumbnail: expect.any(String) }),
      )
    })

    it('T042.5: invalidates course cache even when store() throws', async () => {
      invalidateCourseCache()
      const mockCourse = {
        slides: [{ id: 's1', title: 'Slide', widgets: [] }],
      }
      vi.mocked(courseApi.getCourse).mockResolvedValue(mockCourse as never)
      vi.mocked(courseApi.updateSlide).mockRejectedValue(new Error('save failed'))

      updateStorageContext({ courseId: 'c1', slideId: 's1' })
      registerStorageManager(editor)
      const impl = addMock.mock.calls[0][1] as {
        load: () => Promise<unknown>
        store: (data: unknown) => Promise<void>
      }

      // First load populates cache
      await impl.load()

      // store() fails — cache must still be cleared
      await expect(impl.store({})).rejects.toThrow('save failed')

      // Next load must re-fetch (not use stale cache)
      await impl.load()
      expect(courseApi.getCourse).toHaveBeenCalledTimes(2)
    })

    it('T042.5: invalidates course cache after successful store()', async () => {
      invalidateCourseCache()
      const mockCourse = {
        slides: [{ id: 's1', title: 'Slide', widgets: [] }],
      }
      vi.mocked(courseApi.getCourse).mockResolvedValue(mockCourse as never)
      vi.mocked(courseApi.updateSlide).mockResolvedValue({} as never)

      updateStorageContext({ courseId: 'c1', slideId: 's1' })
      registerStorageManager(editor)
      const impl = addMock.mock.calls[0][1] as {
        load: () => Promise<unknown>
        store: (data: unknown) => Promise<void>
      }

      // First load populates cache
      await impl.load()
      expect(courseApi.getCourse).toHaveBeenCalledTimes(1)

      // store() should invalidate the cache
      await impl.store({})

      // Second load after store() must re-fetch
      await impl.load()
      expect(courseApi.getCourse).toHaveBeenCalledTimes(2)
    })
  })
})
