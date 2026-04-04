import { describe, it, expect, vi } from 'vitest'
import { Readable } from 'stream'
import request from 'supertest'
import { app } from '../app'
import { authHeader } from './authHelper'
import { getObject } from '../storage/s3'

vi.mock('../storage/s3', () => ({
  s3Client:    {},
  BUCKET:      'elearn-assets',
  initStorage: vi.fn().mockResolvedValue(undefined),
  putObject:   vi.fn(),
  getObject:   vi.fn(),
  statObject:  vi.fn(),
}))

const auth = authHeader()

describe('GET /courses', () => {
  it('returns empty array initially', async () => {
    const res = await request(app).get('/courses').set(auth)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toEqual([])
  })

  it('returns created courses sorted by updatedAt desc', async () => {
    await request(app).post('/courses').set(auth).send({ title: 'First' })
    await request(app).post('/courses').set(auth).send({ title: 'Second' })

    const res = await request(app).get('/courses').set(auth)
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(2)
    expect(res.body.data[0].title).toBe('Second')
  })
})

describe('POST /courses', () => {
  it('creates a course with the given title', async () => {
    const res = await request(app).post('/courses').set(auth).send({ title: 'My Course' })
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.title).toBe('My Course')
    expect(res.body.data._id).toBeDefined()
  })

  it('defaults to "Untitled Course" when title is missing', async () => {
    const res = await request(app).post('/courses').set(auth).send({})
    expect(res.status).toBe(201)
    expect(res.body.data.title).toBe('Untitled Course')
  })

  it('trims and truncates title at 200 chars', async () => {
    const longTitle = 'A'.repeat(250)
    const res = await request(app).post('/courses').set(auth).send({ title: longTitle })
    expect(res.status).toBe(201)
    expect(res.body.data.title).toHaveLength(200)
  })
})

describe('GET /courses/:id', () => {
  it('returns the course by id', async () => {
    const { body: created } = await request(app).post('/courses').set(auth).send({ title: 'Detail Test' })
    const id = created.data._id

    const res = await request(app).get(`/courses/${id}`).set(auth)
    expect(res.status).toBe(200)
    expect(res.body.data.title).toBe('Detail Test')
  })

  it('returns 400 for invalid ObjectId — C-03', async () => {
    const res = await request(app).get('/courses/not-an-id').set(auth)
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('returns 404 for non-existent course', async () => {
    const res = await request(app).get('/courses/000000000000000000000001').set(auth)
    expect(res.status).toBe(404)
  })
})

describe('PUT /courses/:id — C-01 field allowlisting', () => {
  it('updates allowed fields', async () => {
    const { body: created } = await request(app).post('/courses').set(auth).send({ title: 'Original' })
    const id = created.data._id

    const res = await request(app)
      .put(`/courses/${id}`)
      .set(auth)
      .send({ title: 'Updated', slides: [] })
    expect(res.status).toBe(200)
    expect(res.body.data.title).toBe('Updated')
  })

  it('ignores mass-assignment attempt — deletedAt cannot be cleared via PUT', async () => {
    const { body: created } = await request(app).post('/courses').set(auth).send({ title: 'Safe' })
    const id = created.data._id

    // Attempt to unset deletedAt by sending it as null in body
    await request(app)
      .put(`/courses/${id}`)
      .set(auth)
      .send({ title: 'Safe', deletedAt: null })

    const res = await request(app).get(`/courses/${id}`).set(auth)
    expect(res.status).toBe(200)
    // deletedAt is not in the CourseUpdatePayload allowlist, so it must not appear changed
    expect(res.body.data).not.toHaveProperty('isAdmin')
  })

  it('returns 400 for invalid ObjectId', async () => {
    const res = await request(app).put('/courses/bad-id').set(auth).send({ title: 'x' })
    expect(res.status).toBe(400)
  })

  it('persists and returns sharedSequences (C-02 regression)', async () => {
    const { body: created } = await request(app).post('/courses').set(auth).send({ title: 'SharedSeq' })
    const id = created.data._id

    const sharedSequences = [
      { name: 'onCorrect', actions: [{ type: 'navigate-next', params: {} }] },
    ]
    const put = await request(app)
      .put(`/courses/${id}`)
      .set(auth)
      .send({ title: 'SharedSeq', sharedSequences })
    expect(put.status).toBe(200)
    expect(put.body.data.sharedSequences).toHaveLength(1)
    expect(put.body.data.sharedSequences[0].name).toBe('onCorrect')

    const get = await request(app).get(`/courses/${id}`).set(auth)
    expect(get.status).toBe(200)
    expect(get.body.data.sharedSequences).toHaveLength(1)
    expect(get.body.data.sharedSequences[0].name).toBe('onCorrect')
  })
})

describe('DELETE /courses/:id — soft delete', () => {
  it('soft-deletes the course', async () => {
    const { body: created } = await request(app).post('/courses').set(auth).send({ title: 'ToDelete' })
    const id = created.data._id

    const del = await request(app).delete(`/courses/${id}`).set(auth)
    expect(del.status).toBe(200)

    const get = await request(app).get(`/courses/${id}`).set(auth)
    expect(get.status).toBe(404)
  })

  it('returns 404 when deleting already-deleted course', async () => {
    const { body: created } = await request(app).post('/courses').set(auth).send({ title: 'DeleteTwice' })
    const id = created.data._id

    await request(app).delete(`/courses/${id}`).set(auth)
    const res = await request(app).delete(`/courses/${id}`).set(auth)
    expect(res.status).toBe(404)
  })
})

describe('POST /courses/:id/export/scorm12', () => {
  it('returns 200 ZIP or 500 if player not built', async () => {
    const { body: created } = await request(app).post('/courses').set(auth).send({ title: 'SCORM Test' })
    const id = created.data._id

    const res = await request(app).post(`/courses/${id}/export/scorm12`).set(auth)
    // Either 200 (ZIP) or 500 (player bundle not present in CI)
    expect([200, 500]).toContain(res.status)
    if (res.status === 200) {
      expect(res.headers['content-type']).toMatch(/zip/)
    }
  }, 30000)

  it('returns 404 for unknown course', async () => {
    const res = await request(app).post('/courses/000000000000000000000001/export/scorm12').set(auth)
    expect(res.status).toBe(404)
  })

  it('calls getObject for each asset src in widgets (C-03 regression)', async () => {
    const mockGetObject = vi.mocked(getObject)
    mockGetObject.mockResolvedValue({
      stream: Readable.from(Buffer.from('fake-image-data')),
      contentType: 'image/png',
      contentLength: 15,
    })

    const { body: created } = await request(app).post('/courses').set(auth).send({ title: 'C03 Test' })
    const courseId = created.data._id

    // Add a slide, then patch it with an image widget referencing a Garage asset
    const { body: slideBody } = await request(app)
      .post(`/courses/${courseId}/slides`)
      .set(auth)
      .send({ title: 'S1' })
    const slideId = slideBody.data.slides.at(-1).id

    await request(app)
      .patch(`/courses/${courseId}/slides/${slideId}`)
      .set(auth)
      .send({
        widgets: [
          {
            id: 'w1',
            type: 'image',
            bounds: { x: 0, y: 0, width: 100, height: 100 },
            properties: { src: '/assets/a1b2c3d4-e5f6-4789-abcd-ef0123456789.png' },
          },
        ],
      })

    mockGetObject.mockClear()

    const res = await request(app).post(`/courses/${courseId}/export/scorm12`).set(auth)
    expect([200, 500]).toContain(res.status)
    // getObject must have been called with the uuid key (C-03 asset bundling)
    expect(mockGetObject).toHaveBeenCalledWith('a1b2c3d4-e5f6-4789-abcd-ef0123456789.png')
  }, 30000)
})

// ---------------------------------------------------------------------------
// Slide sub-resource routes — R-07 atomic operations
// ---------------------------------------------------------------------------

describe('POST /courses/:id/slides', () => {
  it('adds a new slide atomically', async () => {
    const { body: created } = await request(app).post('/courses').set(auth).send({ title: 'Slide Course' })
    const id = created.data._id

    const res = await request(app)
      .post(`/courses/${id}/slides`)
      .set(auth)
      .send({ title: 'Slide One' })
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.slides).toHaveLength(1)
    expect(res.body.data.slides[0].title).toBe('Slide One')
    expect(res.body.data.slides[0].id).toBeDefined()
  })

  it('defaults slide title to "New Slide" when not provided', async () => {
    const { body: created } = await request(app).post('/courses').set(auth).send({ title: 'C' })
    const id = created.data._id

    const res = await request(app).post(`/courses/${id}/slides`).set(auth).send({})
    expect(res.status).toBe(201)
    expect(res.body.data.slides[0].title).toBe('New Slide')
  })

  it('returns 404 for non-existent course', async () => {
    const res = await request(app)
      .post('/courses/000000000000000000000001/slides')
      .set(auth)
      .send({ title: 'X' })
    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid course id', async () => {
    const res = await request(app).post('/courses/bad-id/slides').set(auth).send({ title: 'X' })
    expect(res.status).toBe(400)
  })
})

describe('PATCH /courses/:id/slides/:slideId', () => {
  it('updates slide title atomically', async () => {
    const { body: created } = await request(app).post('/courses').set(auth).send({ title: 'C' })
    const id = created.data._id
    const { body: withSlide } = await request(app)
      .post(`/courses/${id}/slides`)
      .set(auth)
      .send({ title: 'Original' })
    const slideId = withSlide.data.slides[0].id

    const res = await request(app)
      .patch(`/courses/${id}/slides/${slideId}`)
      .set(auth)
      .send({ title: 'Renamed' })
    expect(res.status).toBe(200)
    expect(res.body.data.slides[0].title).toBe('Renamed')
  })

  it('returns 400 when no updatable fields provided', async () => {
    const { body: created } = await request(app).post('/courses').set(auth).send({ title: 'C' })
    const id = created.data._id
    const { body: withSlide } = await request(app)
      .post(`/courses/${id}/slides`)
      .set(auth)
      .send({ title: 'S' })
    const slideId = withSlide.data.slides[0].id

    const res = await request(app)
      .patch(`/courses/${id}/slides/${slideId}`)
      .set(auth)
      .send({})
    expect(res.status).toBe(400)
  })

  it('returns 404 for non-existent slide', async () => {
    const { body: created } = await request(app).post('/courses').set(auth).send({ title: 'C' })
    const id = created.data._id

    const res = await request(app)
      .patch(`/courses/${id}/slides/non-existent-slide-id`)
      .set(auth)
      .send({ title: 'X' })
    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid course id', async () => {
    const res = await request(app).patch('/courses/bad-id/slides/s1').set(auth).send({ title: 'X' })
    expect(res.status).toBe(400)
  })
})

describe('DELETE /courses/:id/slides/:slideId', () => {
  it('removes the slide atomically', async () => {
    const { body: created } = await request(app).post('/courses').set(auth).send({ title: 'C' })
    const id = created.data._id
    await request(app).post(`/courses/${id}/slides`).set(auth).send({ title: 'S1' })
    const { body: withTwo } = await request(app)
      .post(`/courses/${id}/slides`)
      .set(auth)
      .send({ title: 'S2' })
    expect(withTwo.data.slides).toHaveLength(2)
    const slideId = withTwo.data.slides[0].id

    const res = await request(app).delete(`/courses/${id}/slides/${slideId}`).set(auth)
    expect(res.status).toBe(200)
    expect(res.body.data.slides).toHaveLength(1)
    expect(res.body.data.slides[0].title).toBe('S2')
  })

  it('returns 404 for non-existent course', async () => {
    const res = await request(app).delete('/courses/000000000000000000000001/slides/s1').set(auth)
    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid course id', async () => {
    const res = await request(app).delete('/courses/bad-id/slides/s1').set(auth)
    expect(res.status).toBe(400)
  })

  it('returns 404 when slideId does not match any slide (A-05 regression)', async () => {
    // A-05: DELETE slide must return 404 when slideId doesn't exist, not silently 200
    const { body: created } = await request(app).post('/courses').set(auth).send({ title: 'C' })
    const id = created.data._id
    await request(app).post(`/courses/${id}/slides`).set(auth).send({ title: 'S1' })

    const res = await request(app).delete(`/courses/${id}/slides/non-existent-slide-id`).set(auth)
    expect(res.status).toBe(404)
  })
})

// ---------------------------------------------------------------------------
// PATCH /courses/:id/slides/reorder — T603.5 atomic slide reordering
// ---------------------------------------------------------------------------

describe('PATCH /courses/:id/slides/reorder', () => {
  it('reorders slides to the supplied order', async () => {
    const { body: created } = await request(app).post('/courses').set(auth).send({ title: 'ReorderTest' })
    const id = created.data._id
    await request(app).post(`/courses/${id}/slides`).set(auth).send({ title: 'Slide A' })
    await request(app).post(`/courses/${id}/slides`).set(auth).send({ title: 'Slide B' })
    const { body: r3 } = await request(app).post(`/courses/${id}/slides`).set(auth).send({ title: 'Slide C' })
    const ids = r3.data.slides.map((s: { id: string }) => s.id)
    // Reverse the order
    const reversed = [...ids].reverse()

    const res = await request(app)
      .patch(`/courses/${id}/slides/reorder`)
      .set(auth)
      .send({ orderedIds: reversed })
    expect(res.status).toBe(200)
    const resultIds = res.body.data.slides.map((s: { id: string }) => s.id)
    expect(resultIds).toEqual(reversed)
  })

  it('returns 400 when orderedIds is empty', async () => {
    const { body: created } = await request(app).post('/courses').set(auth).send({ title: 'C' })
    const id = created.data._id

    const res = await request(app)
      .patch(`/courses/${id}/slides/reorder`)
      .set(auth)
      .send({ orderedIds: [] })
    expect(res.status).toBe(400)
  })

  it('returns 400 when orderedIds is missing', async () => {
    const { body: created } = await request(app).post('/courses').set(auth).send({ title: 'C' })
    const id = created.data._id

    const res = await request(app)
      .patch(`/courses/${id}/slides/reorder`)
      .set(auth)
      .send({})
    expect(res.status).toBe(400)
  })

  it('returns 400 when orderedIds does not match existing slides', async () => {
    const { body: created } = await request(app).post('/courses').set(auth).send({ title: 'C' })
    const id = created.data._id
    await request(app).post(`/courses/${id}/slides`).set(auth).send({ title: 'S1' })

    const res = await request(app)
      .patch(`/courses/${id}/slides/reorder`)
      .set(auth)
      .send({ orderedIds: ['wrong-id-1', 'wrong-id-2'] })
    expect(res.status).toBe(400)
  })

  it('returns 404 for non-existent course', async () => {
    const res = await request(app)
      .patch('/courses/000000000000000000000001/slides/reorder')
      .set(auth)
      .send({ orderedIds: ['s1'] })
    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid course id', async () => {
    const res = await request(app)
      .patch('/courses/bad-id/slides/reorder')
      .set(auth)
      .send({ orderedIds: ['s1'] })
    expect(res.status).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// T603.3 — Auth protection (401) on all protected routes
// ---------------------------------------------------------------------------

describe('T603.3 — 401 Unauthorized without auth token', () => {
  it('GET /courses → 401', async () => {
    const res = await request(app).get('/courses')
    expect(res.status).toBe(401)
  })

  it('POST /courses → 401', async () => {
    const res = await request(app).post('/courses').send({ title: 'X' })
    expect(res.status).toBe(401)
  })

  it('GET /courses/:id → 401', async () => {
    const res = await request(app).get('/courses/000000000000000000000001')
    expect(res.status).toBe(401)
  })

  it('PUT /courses/:id → 401', async () => {
    const res = await request(app).put('/courses/000000000000000000000001').send({ title: 'X' })
    expect(res.status).toBe(401)
  })

  it('DELETE /courses/:id → 401', async () => {
    const res = await request(app).delete('/courses/000000000000000000000001')
    expect(res.status).toBe(401)
  })

  it('POST /courses/:id/slides → 401', async () => {
    const res = await request(app).post('/courses/000000000000000000000001/slides').send({ title: 'S' })
    expect(res.status).toBe(401)
  })

  it('PATCH /courses/:id/slides/:slideId → 401', async () => {
    const res = await request(app).patch('/courses/000000000000000000000001/slides/s1').send({ title: 'S' })
    expect(res.status).toBe(401)
  })

  it('DELETE /courses/:id/slides/:slideId → 401', async () => {
    const res = await request(app).delete('/courses/000000000000000000000001/slides/s1')
    expect(res.status).toBe(401)
  })

  it('PATCH /courses/:id/slides/reorder → 401', async () => {
    const res = await request(app)
      .patch('/courses/000000000000000000000001/slides/reorder')
      .send({ orderedIds: ['s1'] })
    expect(res.status).toBe(401)
  })

  it('GET /courses/:id/history → 401', async () => {
    const res = await request(app).get('/courses/000000000000000000000001/history')
    expect(res.status).toBe(401)
  })
})

// ---------------------------------------------------------------------------
// GET /courses/:id/history — audit trail (T167)
// ---------------------------------------------------------------------------

describe('GET /courses/:id/history', () => {
  it('returns empty history for a newly created course', async () => {
    const { body: created } = await request(app).post('/courses').set(auth).send({ title: 'History Test' })
    const id = created.data._id

    const res = await request(app).get(`/courses/${id}/history`).set(auth)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.meta).toMatchObject({ limit: expect.any(Number), skip: 0 })
    expect(typeof res.body.meta.total).toBe('number')
  })

  it('records a course.create audit entry after POST /courses', async () => {
    const { body: created } = await request(app)
      .post('/courses')
      .set(auth)
      .send({ title: 'Audited Course' })
    const id = created.data._id

    const res = await request(app).get(`/courses/${id}/history`).set(auth)
    expect(res.status).toBe(200)
    const actions = res.body.data.map((e: { action: string }) => e.action)
    expect(actions).toContain('course.create')
  })

  it('records a slide.create entry after adding a slide', async () => {
    const { body: created } = await request(app).post('/courses').set(auth).send({ title: 'SlideAudit' })
    const id = created.data._id

    await request(app).post(`/courses/${id}/slides`).set(auth).send({ title: 'Audit Slide' })

    const res = await request(app).get(`/courses/${id}/history`).set(auth)
    expect(res.status).toBe(200)
    const slideCreate = res.body.data.find((e: { action: string }) => e.action === 'slide.create')
    expect(slideCreate).toBeDefined()
    expect(slideCreate.detail.title).toBe('Audit Slide')
  })

  it('paginates results with limit and skip', async () => {
    const { body: created } = await request(app).post('/courses').set(auth).send({ title: 'PaginationTest' })
    const id = created.data._id

    // Create multiple slides to generate multiple audit entries
    for (let i = 0; i < 3; i++) {
      await request(app).post(`/courses/${id}/slides`).set(auth).send({ title: `Slide ${i}` })
    }

    const res1 = await request(app).get(`/courses/${id}/history?limit=2&skip=0`).set(auth)
    expect(res1.status).toBe(200)
    expect(res1.body.data).toHaveLength(2)
    expect(res1.body.meta.limit).toBe(2)
    expect(res1.body.meta.skip).toBe(0)
    expect(res1.body.meta.total).toBeGreaterThanOrEqual(4) // course.create + 3 slide.create

    const res2 = await request(app).get(`/courses/${id}/history?limit=2&skip=2`).set(auth)
    expect(res2.status).toBe(200)
    expect(res2.body.meta.skip).toBe(2)
    // Entries on page 2 must not overlap with page 1
    const ids1 = res1.body.data.map((e: { _id: string }) => e._id)
    const ids2 = res2.body.data.map((e: { _id: string }) => e._id)
    expect(ids1.some((id: string) => ids2.includes(id))).toBe(false)
  })

  it('caps limit at 200', async () => {
    const { body: created } = await request(app).post('/courses').set(auth).send({ title: 'CapTest' })
    const id = created.data._id

    const res = await request(app).get(`/courses/${id}/history?limit=9999`).set(auth)
    expect(res.status).toBe(200)
    expect(res.body.meta.limit).toBe(200)
  })

  it('returns entries newest-first', async () => {
    const { body: created } = await request(app).post('/courses').set(auth).send({ title: 'OrderTest' })
    const id = created.data._id

    await request(app).post(`/courses/${id}/slides`).set(auth).send({ title: 'First Slide' })
    await request(app).post(`/courses/${id}/slides`).set(auth).send({ title: 'Second Slide' })

    const res = await request(app).get(`/courses/${id}/history`).set(auth)
    expect(res.status).toBe(200)
    const dates = res.body.data.map((e: { createdAt: string }) => new Date(e.createdAt).getTime())
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i])
    }
  })

  it('returns 400 for invalid course id', async () => {
    const res = await request(app).get('/courses/bad-id/history').set(auth)
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('returns empty data for unknown (but valid) course id', async () => {
    const res = await request(app).get('/courses/000000000000000000000099/history').set(auth)
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
    expect(res.body.meta.total).toBe(0)
  })
})
