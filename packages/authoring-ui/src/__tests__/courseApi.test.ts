/**
 * Tests for courseApi.ts
 *
 * Covers reviewer fixes:
 *   R-01 — uploadAsset unwraps { success, data } envelope from backend
 *   R-02 — AssetUploadResult only has { url, objectName, originalName }
 *   R-06 — getMultipartHeaders: no Content-Type, includes X-Api-Key when set
 *   R-07 — addSlide/updateSlide/deleteSlide use targeted atomic routes (no PUT)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  listCourses,
  getCourse,
  createCourse,
  updateCourse,
  deleteCourse,
  addSlide,
  updateSlide,
  deleteSlide,
  duplicateSlide,
  reorderSlides,
  uploadAsset,
} from '../api/courseApi'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response
}

// ---------------------------------------------------------------------------
// Basic request routing
// ---------------------------------------------------------------------------

describe('courseApi — request routing', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('listCourses: GET /courses with JSON Content-Type', async () => {
    fetchSpy.mockResolvedValue(makeResponse([]))
    await listCourses()
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/courses')
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
  })

  it('getCourse: GET /courses/:id', async () => {
    fetchSpy.mockResolvedValue(makeResponse({}))
    await getCourse('abc123')
    const [url] = fetchSpy.mock.calls[0] as [string]
    expect(url).toContain('/courses/abc123')
  })

  it('createCourse: POST /courses with title body', async () => {
    fetchSpy.mockResolvedValue(makeResponse({}))
    await createCourse('Test Course')
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/courses')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ title: 'Test Course' })
  })

  it('updateCourse: PUT /courses/:id', async () => {
    fetchSpy.mockResolvedValue(makeResponse({}))
    await updateCourse('id1', { title: 'Updated' })
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/courses/id1')
    expect(init.method).toBe('PUT')
  })

  it('deleteCourse: DELETE /courses/:id', async () => {
    fetchSpy.mockResolvedValue(makeResponse({}))
    await deleteCourse('id1')
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe('DELETE')
  })

  it('throws descriptive error on network failure', async () => {
    fetchSpy.mockRejectedValue(new Error('ECONNREFUSED'))
    await expect(listCourses()).rejects.toThrow('network error')
  })

  it('throws with status code on non-ok response', async () => {
    fetchSpy.mockResolvedValue(makeResponse('Not Found', false, 404))
    await expect(getCourse('missing')).rejects.toThrow('404')
  })
})

// ---------------------------------------------------------------------------
// R-07 — Atomic slide sub-resource routes
// ---------------------------------------------------------------------------

describe('courseApi — R-07 atomic slide routes', () => {
  const courseId = 'course-1'
  const slideId = 'slide-abc'
  const mockCourse = { _id: courseId, slides: [{ id: slideId, title: 'Slide' }] }
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue(makeResponse(mockCourse))
    vi.stubGlobal('fetch', fetchSpy)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('addSlide — POST /courses/:id/slides (not a full PUT)', async () => {
    await addSlide(courseId, 'New Slide')
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toContain(`/courses/${courseId}/slides`)
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ title: 'New Slide' })
  })

  it('addSlide — does NOT call PUT /courses/:id', async () => {
    await addSlide(courseId, 'Slide')
    // Must be only one fetch call (targeted route), not two (fetch then PUT)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(init.method).not.toBe('PUT')
    expect(url).not.toMatch(/\/courses\/[^/]+$/) // not bare /courses/:id
  })

  it('updateSlide — PATCH /courses/:id/slides/:slideId', async () => {
    await updateSlide(courseId, slideId, { title: 'Renamed' })
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toContain(`/courses/${courseId}/slides/${slideId}`)
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body as string)).toEqual({ title: 'Renamed' })
  })

  it('updateSlide — does NOT fetch the whole course first', async () => {
    await updateSlide(courseId, slideId, { title: 'X' })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('deleteSlide — DELETE /courses/:id/slides/:slideId', async () => {
    await deleteSlide(courseId, slideId)
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toContain(`/courses/${courseId}/slides/${slideId}`)
    expect(init.method).toBe('DELETE')
  })

  it('deleteSlide — does NOT fetch the whole course first', async () => {
    await deleteSlide(courseId, slideId)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('reorderSlides — PATCH /courses/:id/slides/reorder with orderedIds', async () => {
    await reorderSlides(courseId, [slideId, 'slide-other'])
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toContain(`/courses/${courseId}/slides/reorder`)
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body as string)).toEqual({ orderedIds: [slideId, 'slide-other'] })
  })

  it('reorderSlides — does NOT call GET first (single fetch)', async () => {
    await reorderSlides(courseId, [slideId])
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// T013.2 — duplicateSlide
// ---------------------------------------------------------------------------

describe('courseApi — T013.2 duplicateSlide', () => {
  const courseId = 'course-1'
  const sourceSlide = {
    id: 'slide-src',
    title: 'Slide 1',
    widgets: [{ id: 'w1' }],
    actions: [],
  }
  const newSlide = { id: 'slide-new', title: 'Slide 1 copy', widgets: [], actions: [] }
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // First call: addSlide → returns course with new blank slide appended
    // Second call: updateSlide → returns course with copied content
    const withNew = { _id: courseId, slides: [sourceSlide, newSlide] }
    const withContent = {
      _id: courseId,
      slides: [sourceSlide, { ...newSlide, widgets: sourceSlide.widgets }],
    }
    fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(withNew))
      .mockResolvedValueOnce(makeResponse(withContent))
    vi.stubGlobal('fetch', fetchSpy)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('makes exactly 2 fetch calls (addSlide + updateSlide)', async () => {
    await duplicateSlide(courseId, sourceSlide as never)
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('first call is POST /courses/:id/slides with title "<source> copy"', async () => {
    await duplicateSlide(courseId, sourceSlide as never)
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toContain(`/courses/${courseId}/slides`)
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ title: 'Slide 1 copy' })
  })

  it('second call is PATCH to copy widgets and actions to new slide', async () => {
    await duplicateSlide(courseId, sourceSlide as never)
    const [url, init] = fetchSpy.mock.calls[1] as [string, RequestInit]
    expect(url).toContain(`/courses/${courseId}/slides/${newSlide.id}`)
    expect(init.method).toBe('PATCH')
    const body = JSON.parse(init.body as string)
    expect(body.widgets).toEqual(sourceSlide.widgets)
    expect(body.actions).toEqual(sourceSlide.actions)
  })

  it('returns the course returned by the second (updateSlide) call', async () => {
    const result = await duplicateSlide(courseId, sourceSlide as never)
    expect((result as { _id: string })._id).toBe(courseId)
    expect((result as { slides: typeof sourceSlide[] }).slides).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// R-01 / R-02 — uploadAsset response envelope unwrapping
// ---------------------------------------------------------------------------

describe('courseApi — R-01/R-02 uploadAsset', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('R-01: unwraps { success, data } envelope — returns data field directly', async () => {
    const backendPayload = {
      success: true,
      data: { url: 'http://garage/img.png', objectName: 'img.png', originalName: 'photo.png' },
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse(backendPayload)))

    const file = new File(['content'], 'photo.png', { type: 'image/png' })
    const result = await uploadAsset(file)

    expect(result.url).toBe('http://garage/img.png')
    expect(result.objectName).toBe('img.png')
    expect(result.originalName).toBe('photo.png')
  })

  it('R-02: result does NOT contain mimeType or size (interface matches backend)', async () => {
    const backendPayload = {
      success: true,
      data: { url: 'u', objectName: 'o', originalName: 'n' },
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse(backendPayload)))

    const file = new File(['x'], 'f.png', { type: 'image/png' })
    const result = await uploadAsset(file)

    expect(result).not.toHaveProperty('mimeType')
    expect(result).not.toHaveProperty('size')
  })

  it('throws on non-ok upload response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(makeResponse('Internal Server Error', false, 500)),
    )
    const file = new File(['x'], 'f.png', { type: 'image/png' })
    await expect(uploadAsset(file)).rejects.toThrow('Upload failed 500')
  })
})

// ---------------------------------------------------------------------------
// R-06 — getMultipartHeaders: no Content-Type, optional X-Api-Key
// ---------------------------------------------------------------------------

describe('courseApi — R-06 getMultipartHeaders', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('does NOT send Content-Type (browser must set multipart boundary)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        makeResponse({ success: true, data: { url: 'u', objectName: 'o', originalName: 'n' } }),
      ),
    )
    const file = new File(['x'], 'f.png', { type: 'image/png' })
    await uploadAsset(file)

    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers['Content-Type']).toBeUndefined()
  })

  it('includes X-Api-Key when VITE_API_KEY is set', async () => {
    vi.stubEnv('VITE_API_KEY', 'secret-key-123')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        makeResponse({ success: true, data: { url: 'u', objectName: 'o', originalName: 'n' } }),
      ),
    )
    const file = new File(['x'], 'f.png', { type: 'image/png' })
    await uploadAsset(file)

    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers['X-Api-Key']).toBe('secret-key-123')
  })

  it('omits X-Api-Key when VITE_API_KEY is not set', async () => {
    vi.stubEnv('VITE_API_KEY', '')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        makeResponse({ success: true, data: { url: 'u', objectName: 'o', originalName: 'n' } }),
      ),
    )
    const file = new File(['x'], 'f.png', { type: 'image/png' })
    await uploadAsset(file)

    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers['X-Api-Key']).toBeUndefined()
  })
})
