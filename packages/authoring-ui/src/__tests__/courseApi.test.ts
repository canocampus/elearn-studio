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
  resolveAssetUrl,
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

  it('listCourses: GET /courses — no body, no Content-Type', async () => {
    fetchSpy.mockResolvedValue(makeResponse([]))
    await listCourses()
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/courses')
    // GET has no body — apiClient must NOT set Content-Type (would break some servers)
    expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined()
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
  // TD-028: the SERVER copy of the source slide differs from the caller's
  // (store-stale) copy — the duplicate must carry the server's widgets.
  const freshWidgets = [{ id: 'w1' }, { id: 'w2-fresh-from-server' }]
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // Call 1: getCourse → fresh course (TD-028: authoritative source)
    // Call 2: addSlide  → course with new blank slide appended
    // Call 3: updateSlide → course with copied content
    const fresh = { _id: courseId, slides: [{ ...sourceSlide, widgets: freshWidgets }] }
    const withNew = { _id: courseId, slides: [{ ...sourceSlide, widgets: freshWidgets }, newSlide] }
    const withContent = {
      _id: courseId,
      slides: [{ ...sourceSlide, widgets: freshWidgets }, { ...newSlide, widgets: freshWidgets }],
    }
    fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(makeResponse({ success: true, data: fresh }))
      .mockResolvedValueOnce(makeResponse({ success: true, data: withNew }))
      .mockResolvedValueOnce(makeResponse({ success: true, data: withContent }))
    vi.stubGlobal('fetch', fetchSpy)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('TD-028: fetches the fresh course first — 3 calls (GET + addSlide + updateSlide)', async () => {
    await duplicateSlide(courseId, sourceSlide as never)
    expect(fetchSpy).toHaveBeenCalledTimes(3)
    const [getUrl] = fetchSpy.mock.calls[0] as [string, RequestInit | undefined]
    expect(getUrl).toContain(`/courses/${courseId}`)
  })

  it('second call is POST /courses/:id/slides with title "<source> copy"', async () => {
    await duplicateSlide(courseId, sourceSlide as never)
    const [url, init] = fetchSpy.mock.calls[1] as [string, RequestInit]
    expect(url).toContain(`/courses/${courseId}/slides`)
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ title: 'Slide 1 copy' })
  })

  it("TD-028: PATCH copies the SERVER widgets, not the caller's stale copy", async () => {
    // The caller passes the store-stale slide (1 widget); the server has 2.
    await duplicateSlide(courseId, sourceSlide as never)
    const [url, init] = fetchSpy.mock.calls[2] as [string, RequestInit]
    expect(url).toContain(`/courses/${courseId}/slides/${newSlide.id}`)
    expect(init.method).toBe('PATCH')
    const body = JSON.parse(init.body as string)
    expect(body.widgets).toEqual(freshWidgets)
    // TD-027: the slide-level actions fossil stays retired.
    expect(body).not.toHaveProperty('actions')
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

  it('includes Authorization: Bearer when token is in authStore', async () => {
    // Set a token in the auth store
    const { useAuthStore } = await import('../store/authStore')
    useAuthStore.setState({ accessToken: 'jwt-token-xyz', user: null })

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
    expect(headers['Authorization']).toBe('Bearer jwt-token-xyz')

    // Cleanup store
    useAuthStore.setState({ accessToken: null, user: null })
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

// ---------------------------------------------------------------------------
// T600.1 — resolveAssetUrl (presigned URL resolution)
// ---------------------------------------------------------------------------

describe('courseApi — T600 resolveAssetUrl', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('calls GET /assets/:objectName/presigned', async () => {
    fetchSpy.mockResolvedValue(
      makeResponse({ success: true, data: { presignedUrl: 'https://garage.example/img.png?sig=abc' } }),
    )
    await resolveAssetUrl('uuid-1234.png')
    const [url] = fetchSpy.mock.calls[0] as [string]
    expect(url).toContain('/assets/uuid-1234.png/presigned')
  })

  it('returns the presignedUrl from the response body', async () => {
    const presignedUrl = 'https://garage.example/my-image.jpg?X-Amz-Signature=xyz'
    fetchSpy.mockResolvedValue(
      makeResponse({ success: true, data: { presignedUrl } }),
    )
    const result = await resolveAssetUrl('my-image.jpg')
    expect(result).toBe(presignedUrl)
  })

  it('rejects when the endpoint returns a 4xx response', async () => {
    fetchSpy.mockResolvedValue(makeResponse('Unauthorized', false, 401))
    await expect(resolveAssetUrl('private.png')).rejects.toThrow('401')
  })

  it('rejects when the endpoint returns a 5xx response', async () => {
    fetchSpy.mockResolvedValue(makeResponse('Internal Server Error', false, 500))
    await expect(resolveAssetUrl('broken.png')).rejects.toThrow('500')
  })

  it('rejects on network error', async () => {
    fetchSpy.mockRejectedValue(new Error('net::ERR_NAME_NOT_RESOLVED'))
    await expect(resolveAssetUrl('any.png')).rejects.toThrow()
  })

  it('uses GET method (no request body)', async () => {
    fetchSpy.mockResolvedValue(
      makeResponse({ success: true, data: { presignedUrl: 'https://ok' } }),
    )
    await resolveAssetUrl('file.png')
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    // apiRequest defaults to GET — init.method may be undefined or 'GET'
    expect((init?.method ?? 'GET').toUpperCase()).toBe('GET')
    expect(init?.body).toBeUndefined()
  })
})
