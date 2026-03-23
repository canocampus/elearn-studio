/**
 * MSW v2 request handlers — T165.4
 *
 * Covers all API endpoints used by authoring-ui.
 * Activated via ?mock=1 in browser dev, or imported in Vitest tests.
 */

import { http, HttpResponse } from 'msw'

const API_BASE = 'http://localhost:3001'

// ── Fixture data ────────────────────────────────────────────────────────────

const mockCourse = {
  _id: 'mock-course-1',
  title: 'Mock Course',
  slides: [
    { id: 'slide-1', title: 'Slide 1', widgets: [], actions: [] },
  ],
  templates: [],
  resources: [],
  settings: {},
  metadata: {},
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

// ── Handlers ────────────────────────────────────────────────────────────────

export const handlers = [
  // Auth
  http.post(`${API_BASE}/auth/login`, () =>
    HttpResponse.json({ success: true, data: { accessToken: 'mock-token', user: { sub: 'mock-user', email: 'dev@example.com' } } }),
  ),

  http.post(`${API_BASE}/auth/refresh`, () =>
    HttpResponse.json({ success: true, data: { accessToken: 'mock-token' } }),
  ),

  http.post(`${API_BASE}/auth/logout`, () =>
    HttpResponse.json({ success: true }),
  ),

  // Courses
  http.get(`${API_BASE}/courses`, () =>
    HttpResponse.json({ success: true, data: [{ _id: mockCourse._id, title: mockCourse.title, updatedAt: mockCourse.updatedAt }] }),
  ),

  http.get(`${API_BASE}/courses/:id`, ({ params }) =>
    HttpResponse.json({ success: true, data: { ...mockCourse, _id: params.id } }),
  ),

  http.post(`${API_BASE}/courses`, async ({ request }) => {
    const body = await request.json() as { title?: string }
    return HttpResponse.json({ success: true, data: { ...mockCourse, _id: `course-${Date.now()}`, title: body.title ?? 'New Course' } }, { status: 201 })
  }),

  http.put(`${API_BASE}/courses/:id`, async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({ success: true, data: { ...mockCourse, ...body, _id: params.id } })
  }),

  http.delete(`${API_BASE}/courses/:id`, () =>
    new HttpResponse(null, { status: 204 }),
  ),

  // Slides
  http.post(`${API_BASE}/courses/:courseId/slides`, async ({ params, request }) => {
    const body = await request.json() as { title?: string }
    const newSlide = { id: `slide-${Date.now()}`, title: body.title ?? 'New Slide', widgets: [], actions: [] }
    return HttpResponse.json({ success: true, data: { ...mockCourse, _id: params.courseId, slides: [...mockCourse.slides, newSlide] } }, { status: 201 })
  }),

  http.patch(`${API_BASE}/courses/:courseId/slides/:slideId`, async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>
    const slides = mockCourse.slides.map(s =>
      s.id === params.slideId ? { ...s, ...body } : s,
    )
    return HttpResponse.json({ success: true, data: { ...mockCourse, _id: params.courseId, slides } })
  }),

  http.delete(`${API_BASE}/courses/:courseId/slides/:slideId`, ({ params }) => {
    const slides = mockCourse.slides.filter(s => s.id !== params.slideId)
    return HttpResponse.json({ success: true, data: { ...mockCourse, _id: params.courseId, slides } })
  }),

  http.patch(`${API_BASE}/courses/:courseId/slides/reorder`, async ({ params, request }) => {
    const body = await request.json() as { orderedIds?: string[] }
    const orderedIds = body.orderedIds ?? []
    const slides = orderedIds.map(id => mockCourse.slides.find(s => s.id === id)).filter(Boolean)
    return HttpResponse.json({ success: true, data: { ...mockCourse, _id: params.courseId, slides } })
  }),

  // Course history (T167)
  http.get(`${API_BASE}/courses/:id/history`, ({ request }) => {
    const url = new URL(request.url)
    const limit = Number(url.searchParams.get('limit') ?? 20)
    const skip  = Number(url.searchParams.get('skip') ?? 0)
    const mockEntries = [
      {
        _id: 'entry-1',
        courseId: 'mock-course-1',
        action: 'course.create',
        actorId: 'mock-user',
        actorEmail: 'dev@example.com',
        detail: { title: 'Mock Course' },
        createdAt: new Date().toISOString(),
      },
      {
        _id: 'entry-2',
        courseId: 'mock-course-1',
        action: 'slide.create',
        actorId: 'mock-user',
        actorEmail: 'dev@example.com',
        detail: { slideId: 'slide-1', title: 'Slide 1' },
        createdAt: new Date().toISOString(),
      },
    ]
    const paged = mockEntries.slice(skip, skip + limit)
    return HttpResponse.json({ success: true, data: paged, meta: { total: mockEntries.length, limit, skip } })
  }),

  // Assets
  http.post(`${API_BASE}/assets`, () =>
    HttpResponse.json({ success: true, data: { url: 'http://localhost:3910/mock-bucket/asset.png', objectName: 'asset.png', originalName: 'asset.png' } }),
  ),

  // Client error telemetry
  http.post(`${API_BASE}/telemetry/client-errors`, () =>
    new HttpResponse(null, { status: 204 }),
  ),
]
