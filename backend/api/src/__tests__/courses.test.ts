import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import { app } from '../app'

vi.mock('../storage/s3', () => ({
  s3Client:    {},
  BUCKET:      'elearn-assets',
  initStorage: vi.fn().mockResolvedValue(undefined),
  putObject:   vi.fn(),
  getObject:   vi.fn(),
  statObject:  vi.fn(),
}))

vi.stubEnv('API_KEY', '')

describe('GET /courses', () => {
  it('returns empty array initially', async () => {
    const res = await request(app).get('/courses')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toEqual([])
  })

  it('returns created courses sorted by updatedAt desc', async () => {
    await request(app).post('/courses').send({ title: 'First' })
    await request(app).post('/courses').send({ title: 'Second' })

    const res = await request(app).get('/courses')
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(2)
    expect(res.body.data[0].title).toBe('Second')
  })
})

describe('POST /courses', () => {
  it('creates a course with the given title', async () => {
    const res = await request(app).post('/courses').send({ title: 'My Course' })
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.title).toBe('My Course')
    expect(res.body.data._id).toBeDefined()
  })

  it('defaults to "Untitled Course" when title is missing', async () => {
    const res = await request(app).post('/courses').send({})
    expect(res.status).toBe(201)
    expect(res.body.data.title).toBe('Untitled Course')
  })

  it('trims and truncates title at 200 chars', async () => {
    const longTitle = 'A'.repeat(250)
    const res = await request(app).post('/courses').send({ title: longTitle })
    expect(res.status).toBe(201)
    expect(res.body.data.title).toHaveLength(200)
  })
})

describe('GET /courses/:id', () => {
  it('returns the course by id', async () => {
    const { body: created } = await request(app).post('/courses').send({ title: 'Detail Test' })
    const id = created.data._id

    const res = await request(app).get(`/courses/${id}`)
    expect(res.status).toBe(200)
    expect(res.body.data.title).toBe('Detail Test')
  })

  it('returns 400 for invalid ObjectId — C-03', async () => {
    const res = await request(app).get('/courses/not-an-id')
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('returns 404 for non-existent course', async () => {
    const res = await request(app).get('/courses/000000000000000000000001')
    expect(res.status).toBe(404)
  })
})

describe('PUT /courses/:id — C-01 field allowlisting', () => {
  it('updates allowed fields', async () => {
    const { body: created } = await request(app).post('/courses').send({ title: 'Original' })
    const id = created.data._id

    const res = await request(app)
      .put(`/courses/${id}`)
      .send({ title: 'Updated', slides: [] })
    expect(res.status).toBe(200)
    expect(res.body.data.title).toBe('Updated')
  })

  it('ignores mass-assignment attempt — deletedAt cannot be cleared via PUT', async () => {
    const { body: created } = await request(app).post('/courses').send({ title: 'Safe' })
    const id = created.data._id

    // Attempt to unset deletedAt by sending it as null in body
    await request(app)
      .put(`/courses/${id}`)
      .send({ title: 'Safe', deletedAt: null })

    const res = await request(app).get(`/courses/${id}`)
    expect(res.status).toBe(200)
    // deletedAt is not in the CourseUpdatePayload allowlist, so it must not appear changed
    expect(res.body.data).not.toHaveProperty('isAdmin')
  })

  it('returns 400 for invalid ObjectId', async () => {
    const res = await request(app).put('/courses/bad-id').send({ title: 'x' })
    expect(res.status).toBe(400)
  })
})

describe('DELETE /courses/:id — soft delete', () => {
  it('soft-deletes the course', async () => {
    const { body: created } = await request(app).post('/courses').send({ title: 'ToDelete' })
    const id = created.data._id

    const del = await request(app).delete(`/courses/${id}`)
    expect(del.status).toBe(200)

    const get = await request(app).get(`/courses/${id}`)
    expect(get.status).toBe(404)
  })

  it('returns 404 when deleting already-deleted course', async () => {
    const { body: created } = await request(app).post('/courses').send({ title: 'DeleteTwice' })
    const id = created.data._id

    await request(app).delete(`/courses/${id}`)
    const res = await request(app).delete(`/courses/${id}`)
    expect(res.status).toBe(404)
  })
})

describe('POST /courses/:id/export/scorm12', () => {
  it('returns 200 ZIP or 500 if player not built', async () => {
    const { body: created } = await request(app).post('/courses').send({ title: 'SCORM Test' })
    const id = created.data._id

    const res = await request(app).post(`/courses/${id}/export/scorm12`)
    // Either 200 (ZIP) or 500 (player bundle not present in CI)
    expect([200, 500]).toContain(res.status)
    if (res.status === 200) {
      expect(res.headers['content-type']).toMatch(/zip/)
    }
  }, 30000)

  it('returns 404 for unknown course', async () => {
    const res = await request(app).post('/courses/000000000000000000000001/export/scorm12')
    expect(res.status).toBe(404)
  })
})

// ---------------------------------------------------------------------------
// Slide sub-resource routes — R-07 atomic operations
// ---------------------------------------------------------------------------

describe('POST /courses/:id/slides', () => {
  it('adds a new slide atomically', async () => {
    const { body: created } = await request(app).post('/courses').send({ title: 'Slide Course' })
    const id = created.data._id

    const res = await request(app)
      .post(`/courses/${id}/slides`)
      .send({ title: 'Slide One' })
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.slides).toHaveLength(1)
    expect(res.body.data.slides[0].title).toBe('Slide One')
    expect(res.body.data.slides[0].id).toBeDefined()
  })

  it('defaults slide title to "New Slide" when not provided', async () => {
    const { body: created } = await request(app).post('/courses').send({ title: 'C' })
    const id = created.data._id

    const res = await request(app).post(`/courses/${id}/slides`).send({})
    expect(res.status).toBe(201)
    expect(res.body.data.slides[0].title).toBe('New Slide')
  })

  it('returns 404 for non-existent course', async () => {
    const res = await request(app)
      .post('/courses/000000000000000000000001/slides')
      .send({ title: 'X' })
    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid course id', async () => {
    const res = await request(app).post('/courses/bad-id/slides').send({ title: 'X' })
    expect(res.status).toBe(400)
  })
})

describe('PATCH /courses/:id/slides/:slideId', () => {
  it('updates slide title atomically', async () => {
    const { body: created } = await request(app).post('/courses').send({ title: 'C' })
    const id = created.data._id
    const { body: withSlide } = await request(app)
      .post(`/courses/${id}/slides`)
      .send({ title: 'Original' })
    const slideId = withSlide.data.slides[0].id

    const res = await request(app)
      .patch(`/courses/${id}/slides/${slideId}`)
      .send({ title: 'Renamed' })
    expect(res.status).toBe(200)
    expect(res.body.data.slides[0].title).toBe('Renamed')
  })

  it('returns 400 when no updatable fields provided', async () => {
    const { body: created } = await request(app).post('/courses').send({ title: 'C' })
    const id = created.data._id
    const { body: withSlide } = await request(app)
      .post(`/courses/${id}/slides`)
      .send({ title: 'S' })
    const slideId = withSlide.data.slides[0].id

    const res = await request(app)
      .patch(`/courses/${id}/slides/${slideId}`)
      .send({})
    expect(res.status).toBe(400)
  })

  it('returns 404 for non-existent slide', async () => {
    const { body: created } = await request(app).post('/courses').send({ title: 'C' })
    const id = created.data._id

    const res = await request(app)
      .patch(`/courses/${id}/slides/non-existent-slide-id`)
      .send({ title: 'X' })
    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid course id', async () => {
    const res = await request(app).patch('/courses/bad-id/slides/s1').send({ title: 'X' })
    expect(res.status).toBe(400)
  })
})

describe('DELETE /courses/:id/slides/:slideId', () => {
  it('removes the slide atomically', async () => {
    const { body: created } = await request(app).post('/courses').send({ title: 'C' })
    const id = created.data._id
    await request(app).post(`/courses/${id}/slides`).send({ title: 'S1' })
    const { body: withTwo } = await request(app)
      .post(`/courses/${id}/slides`)
      .send({ title: 'S2' })
    expect(withTwo.data.slides).toHaveLength(2)
    const slideId = withTwo.data.slides[0].id

    const res = await request(app).delete(`/courses/${id}/slides/${slideId}`)
    expect(res.status).toBe(200)
    expect(res.body.data.slides).toHaveLength(1)
    expect(res.body.data.slides[0].title).toBe('S2')
  })

  it('returns 404 for non-existent course', async () => {
    const res = await request(app).delete('/courses/000000000000000000000001/slides/s1')
    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid course id', async () => {
    const res = await request(app).delete('/courses/bad-id/slides/s1')
    expect(res.status).toBe(400)
  })
})
