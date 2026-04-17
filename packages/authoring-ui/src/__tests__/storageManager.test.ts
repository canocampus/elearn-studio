/**
 * Tests for storageManager.ts
 *
 * T645.3: storageManager no longer owns its own context singleton.
 * Context is injected via StorageContextProvider (Dependency Inversion).
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

import { registerStorageManager, type StorageContextProvider, generateThumbnail } from '../editor/storageManager'
import * as courseApi from '../api/courseApi'
import { grapesjsFromWidgets, widgetsFromGrapesjs } from '../editor/converters'

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Creates a mutable provider for tests. Call setContext() to change context
 * between operations. Call triggerInvalidate() to simulate cache invalidation
 * (replaces the old invalidateCourseCache() helper).
 */
function makeProvider(initial: { courseId: string; slideId: string }) {
  let context = { ...initial }
  let invalidateCallback: (() => void) | null = null

  const provider: StorageContextProvider = {
    getContext: vi.fn(() => ({ ...context })),
    onCacheInvalidate: vi.fn((cb) => {
      invalidateCallback = cb
      return () => { invalidateCallback = null }
    }),
  }

  return {
    provider,
    setContext: (c: { courseId: string; slideId: string }) => { context = c },
    triggerInvalidate: () => invalidateCallback?.(),
  }
}

// ---------------------------------------------------------------------------
// T700 — generateThumbnail unit tests
// ---------------------------------------------------------------------------

describe('generateThumbnail', () => {
  it('returns an HTML string containing the editor HTML and CSS', () => {
    const mockEditor = {
      getHtml: vi.fn().mockReturnValue('<div class="slide">hello</div>'),
      getCss: vi.fn().mockReturnValue('body{background:blue}'),
    } as unknown as Editor

    const result = generateThumbnail(mockEditor)

    expect(result).toContain('<div class="slide">hello</div>')
    expect(result).toContain('body{background:blue}')
    expect(result).toContain('<!DOCTYPE html>')
  })

  it('returns a complete HTML document structure', () => {
    const mockEditor = {
      getHtml: vi.fn().mockReturnValue(''),
      getCss: vi.fn().mockReturnValue(''),
    } as unknown as Editor

    const result = generateThumbnail(mockEditor)

    expect(result).toContain('<html>')
    expect(result).toContain('<head>')
    expect(result).toContain('<body>')
    expect(result).toContain('</html>')
  })
})

// ---------------------------------------------------------------------------
// registerStorageManager
// ---------------------------------------------------------------------------

describe('storageManager — registerStorageManager', () => {
  let addMock: ReturnType<typeof vi.fn>
  let editor: Editor

  function makeEditor(): Editor {
    return {
      StorageManager: { add: addMock },
      getComponents: vi.fn().mockReturnValue({ toArray: vi.fn().mockReturnValue([]) }),
      getHtml: vi.fn().mockReturnValue('<div></div>'),
      getCss: vi.fn().mockReturnValue(''),
    } as unknown as Editor
  }

  beforeEach(() => {
    vi.clearAllMocks()
    addMock = vi.fn()
    editor = makeEditor()

    // M-03: reset the module-level courseCache before each test.
    // A provider whose onCacheInvalidate immediately fires the callback achieves this
    // without exporting a separate invalidateCourseCache() function.
    registerStorageManager(
      { StorageManager: { add: vi.fn() } } as unknown as Editor,
      { getContext: () => ({ courseId: '', slideId: '' }), onCacheInvalidate: (cb) => { cb(); return () => {} } },
    )

    // Fresh addMock and editor after the above registration
    vi.clearAllMocks()
    addMock = vi.fn()
    editor = makeEditor()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('registers elearn-api type with GrapesJS editor', () => {
    const ctx = makeProvider({ courseId: '', slideId: '' })
    registerStorageManager(editor, ctx.provider)

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
      const ctx = makeProvider({ courseId: '', slideId: '' })
      registerStorageManager(editor, ctx.provider)

      const impl = addMock.mock.calls[0][1] as { load: () => Promise<unknown> }
      const result = await impl.load()

      expect(result).toEqual({ pages: [{ component: { actions: [], components: [] } }], styles: [] })
      expect(courseApi.getCourse).not.toHaveBeenCalled()
    })

    it('fetches course and converts widgets when context is set', async () => {
      const mockCourse = {
        slides: [{ id: 's1', title: 'Slide', widgets: [{ type: 'text', id: 'w1' }] }],
      }
      vi.mocked(courseApi.getCourse).mockResolvedValue(mockCourse as never)
      vi.mocked(grapesjsFromWidgets).mockReturnValue([{ type: 'text' }] as never)

      const ctx = makeProvider({ courseId: 'c1', slideId: 's1' })
      registerStorageManager(editor, ctx.provider)

      const impl = addMock.mock.calls[0][1] as { load: () => Promise<unknown> }
      const result = await impl.load()

      expect(courseApi.getCourse).toHaveBeenCalledWith('c1')
      expect(grapesjsFromWidgets).toHaveBeenCalledWith(mockCourse.slides[0].widgets)
      expect(result).toEqual({
        pages: [{ id: 's1', component: { actions: [], components: [{ type: 'text' }] } }],
        styles: [],
      })
    })

    it('throws when slide is not found in course', async () => {
      vi.mocked(courseApi.getCourse).mockResolvedValue({ slides: [] } as never)

      const ctx = makeProvider({ courseId: 'c1', slideId: 'missing-slide' })
      registerStorageManager(editor, ctx.provider)

      const impl = addMock.mock.calls[0][1] as { load: () => Promise<unknown> }
      await expect(impl.load()).rejects.toThrow('Slide missing-slide not found')
    })

    it('T042.5: reuses cached course on second load() for the same courseId', async () => {
      const mockCourse = {
        slides: [
          { id: 's1', title: 'Slide 1', widgets: [] },
          { id: 's2', title: 'Slide 2', widgets: [] },
        ],
      }
      vi.mocked(courseApi.getCourse).mockResolvedValue(mockCourse as never)

      const ctx = makeProvider({ courseId: 'c1', slideId: 's1' })
      registerStorageManager(editor, ctx.provider)
      const impl = addMock.mock.calls[0][1] as { load: () => Promise<unknown> }

      await impl.load()

      ctx.setContext({ courseId: 'c1', slideId: 's2' })
      await impl.load()

      // getCourse should only have been called once (cache hit on second load)
      expect(courseApi.getCourse).toHaveBeenCalledTimes(1)
    })

    it('T042.5: fetches fresh course after cache invalidation', async () => {
      const mockCourse = {
        slides: [{ id: 's1', title: 'Slide', widgets: [] }],
      }
      vi.mocked(courseApi.getCourse).mockResolvedValue(mockCourse as never)

      const ctx = makeProvider({ courseId: 'c1', slideId: 's1' })
      registerStorageManager(editor, ctx.provider)
      const impl = addMock.mock.calls[0][1] as { load: () => Promise<unknown> }

      await impl.load()
      ctx.triggerInvalidate() // replaces invalidateCourseCache()
      await impl.load()

      expect(courseApi.getCourse).toHaveBeenCalledTimes(2)
    })
  })

  describe('store()', () => {
    it('skips save when context is missing', async () => {
      const ctx = makeProvider({ courseId: '', slideId: '' })
      registerStorageManager(editor, ctx.provider)

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

      const ctx = makeProvider({ courseId: 'c1', slideId: 's1' })
      registerStorageManager(editor, ctx.provider)

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
      const mockCourse = {
        slides: [{ id: 's1', title: 'Slide', widgets: [] }],
      }
      vi.mocked(courseApi.getCourse).mockResolvedValue(mockCourse as never)
      vi.mocked(courseApi.updateSlide).mockRejectedValue(new Error('save failed'))

      const ctx = makeProvider({ courseId: 'c1', slideId: 's1' })
      registerStorageManager(editor, ctx.provider)
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

    it('T700.2: store() still resolves and calls updateSlide when generateThumbnail throws', async () => {
      vi.mocked(editor.getHtml).mockImplementation(() => { throw new Error('canvas error') })
      vi.mocked(courseApi.updateSlide).mockResolvedValue({} as never)
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const ctx = makeProvider({ courseId: 'c1', slideId: 's1' })
      registerStorageManager(editor, ctx.provider)

      const impl = addMock.mock.calls[0][1] as { store: (data: unknown) => Promise<void> }
      await expect(impl.store({})).resolves.toBeUndefined()

      expect(courseApi.updateSlide).toHaveBeenCalledWith(
        'c1',
        's1',
        expect.objectContaining({ thumbnail: undefined }),
      )
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[StorageManager] thumbnail generation failed'),
        expect.any(Error),
      )
      warnSpy.mockRestore()
    })

    it('T700.3: updateSlide payload includes thumbnail string when generateThumbnail succeeds', async () => {
      vi.mocked(editor.getHtml).mockReturnValue('<p>slide</p>')
      vi.mocked(editor.getCss).mockReturnValue('p{color:red}')
      vi.mocked(courseApi.updateSlide).mockResolvedValue({} as never)

      const ctx = makeProvider({ courseId: 'c1', slideId: 's1' })
      registerStorageManager(editor, ctx.provider)

      const impl = addMock.mock.calls[0][1] as { store: (data: unknown) => Promise<void> }
      await impl.store({})

      expect(courseApi.updateSlide).toHaveBeenCalledWith(
        'c1',
        's1',
        expect.objectContaining({ thumbnail: expect.stringContaining('<p>slide</p>') }),
      )
    })

    it('T700.4: store() rejects and propagates the API error (thumbnail isolation does not hide real failures)', async () => {
      vi.mocked(courseApi.updateSlide).mockRejectedValue(new Error('network timeout'))

      const ctx = makeProvider({ courseId: 'c1', slideId: 's1' })
      registerStorageManager(editor, ctx.provider)

      const impl = addMock.mock.calls[0][1] as { store: (data: unknown) => Promise<void> }
      await expect(impl.store({})).rejects.toThrow('network timeout')
    })

    it('T640.1: updates course cache after successful store() (no redundant GET)', async () => {
      const savedWidgets = [{ type: 'text', id: 'w1', bounds: { x: 0, y: 0, width: 100, height: 50 } }]
      const mockCourse = {
        slides: [{ id: 's1', title: 'Slide', widgets: [] }],
      }
      vi.mocked(courseApi.getCourse).mockResolvedValue(mockCourse as never)
      vi.mocked(courseApi.updateSlide).mockResolvedValue({} as never)
      vi.mocked(widgetsFromGrapesjs).mockReturnValue(savedWidgets as never)

      const ctx = makeProvider({ courseId: 'c1', slideId: 's1' })
      registerStorageManager(editor, ctx.provider)
      const impl = addMock.mock.calls[0][1] as {
        load: () => Promise<unknown>
        store: (data: unknown) => Promise<void>
      }

      // First load populates cache
      await impl.load()
      expect(courseApi.getCourse).toHaveBeenCalledTimes(1)

      // store() should update the cache, NOT clear it
      await impl.store({})

      // Second load after store() must use cache — getCourse still called only once
      await impl.load()
      expect(courseApi.getCourse).toHaveBeenCalledTimes(1)
    })

    it('T640.1: cache reflects saved widgets after store() (BUG-T640 regression)', async () => {
      const savedWidgets = [{ type: 'text', id: 'w1', bounds: { x: 0, y: 0, width: 100, height: 50 } }]
      const mockCourse = {
        slides: [{ id: 's1', title: 'Slide', widgets: [] }],
      }
      vi.mocked(courseApi.getCourse).mockResolvedValue(mockCourse as never)
      vi.mocked(courseApi.updateSlide).mockResolvedValue({} as never)
      vi.mocked(widgetsFromGrapesjs).mockReturnValue(savedWidgets as never)
      vi.mocked(grapesjsFromWidgets).mockReturnValue([{ type: 'text' }] as never)

      const ctx = makeProvider({ courseId: 'c1', slideId: 's1' })
      registerStorageManager(editor, ctx.provider)
      const impl = addMock.mock.calls[0][1] as {
        load: () => Promise<unknown>
        store: (data: unknown) => Promise<void>
      }

      await impl.load()   // populates cache with original widgets: []
      await impl.store({}) // should update cache with savedWidgets
      const result = await impl.load() as { pages: Array<{ component: { components: unknown[] } }> }

      // grapesjsFromWidgets was called with the saved widgets (not the stale empty array)
      expect(grapesjsFromWidgets).toHaveBeenLastCalledWith(savedWidgets)
      expect(result.pages[0].component.components).toEqual([{ type: 'text' }])
    })

    it('T640.3: multi-slide edit sequence — getCourse called once, slide A returns saved widgets after round-trip via slide B', async () => {
      // Scenario: edit slide A, switch to slide B, switch back to slide A.
      // getCourse must be called exactly once throughout (all loads use cache).
      // Slide A must serve the widgets saved during the edit, not the original stale data.
      const originalWidgetsA = [{ type: 'text', id: 'orig-a' }]
      const savedWidgetsA   = [{ type: 'image', id: 'saved-a' }]
      const originalWidgetsB = [{ type: 'button', id: 'orig-b' }]

      const mockCourse = {
        slides: [
          { id: 'sA', title: 'Slide A', widgets: originalWidgetsA },
          { id: 'sB', title: 'Slide B', widgets: originalWidgetsB },
        ],
      }
      vi.mocked(courseApi.getCourse).mockResolvedValue(mockCourse as never)
      vi.mocked(courseApi.updateSlide).mockResolvedValue({} as never)

      const ctx = makeProvider({ courseId: 'c1', slideId: 'sA' })
      registerStorageManager(editor, ctx.provider)
      const impl = addMock.mock.calls[0][1] as {
        load: () => Promise<unknown>
        store: (data: unknown) => Promise<void>
      }

      // 1. Load slide A — populates cache (1 API call)
      await impl.load()
      expect(courseApi.getCourse).toHaveBeenCalledTimes(1)

      // 2. Edit slide A and store — cache is updated, NOT cleared
      vi.mocked(widgetsFromGrapesjs).mockReturnValue(savedWidgetsA as never)
      await impl.store({})
      expect(courseApi.getCourse).toHaveBeenCalledTimes(1) // still 1 — no re-fetch

      // 3. Switch to slide B and load — cache hit for same courseId (still 1 API call)
      ctx.setContext({ courseId: 'c1', slideId: 'sB' })
      await impl.load()
      expect(courseApi.getCourse).toHaveBeenCalledTimes(1)

      // 4. Switch back to slide A and load — cache hit again (still 1 API call)
      ctx.setContext({ courseId: 'c1', slideId: 'sA' })
      await impl.load()
      expect(courseApi.getCourse).toHaveBeenCalledTimes(1)

      // 5. Slide A must serve the saved widgets, not the original stale ones
      expect(grapesjsFromWidgets).toHaveBeenLastCalledWith(savedWidgetsA)
    })
  })
})
