import express, { Router, Request, RequestHandler } from 'express'
import * as fs from 'fs'
import { randomUUID } from 'crypto'
import { isValidObjectId } from 'mongoose'
import rateLimit from 'express-rate-limit'
import { Course } from '../models/Course'
import { AuditLog } from '../models/AuditLog'
import { WidgetsArrayZ, ActionSequencesArrayZ, SlidesArrayZ, formatZodError } from '../lib/courseValidation'
import { logAudit } from '../lib/auditLogger'
import { runExport, type ExportFormat } from '../lib/export/runExport'

// Limit per-user SCORM export requests — exports are CPU/disk intensive
const exportLimiter = rateLimit({
  windowMs:        15 * 60 * 1000, // 15 minutes
  // Relax the limit in development so E2E tests don't hit rate-limiting during repeated runs
  limit:           process.env.NODE_ENV === 'production' ? 5 : 100,
  keyGenerator:    (req: Request) => req.user?.sub ?? 'unknown',
  standardHeaders: 'draft-7',
  legacyHeaders:   false,
  message:         { success: false, error: 'Too many export requests, please try again later' },
})

export const coursesRouter: express.Router = Router()

// C-03: validate ObjectId before every query
function validateId(id: string): boolean {
  return isValidObjectId(id)
}

interface CourseUpdatePayload {
  title?: string
  slides?: unknown[]
  templates?: unknown[]
  resources?: unknown[]
  settings?: unknown
  metadata?: unknown
  sharedSequences?: unknown[]
}

/**
 * @openapi
 * /courses:
 *   get:
 *     summary: List all courses
 *     description: Returns all non-deleted courses sorted by updatedAt descending. Only title, _id and updatedAt are returned.
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Course list
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/CourseSummary' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 */
// GET /courses — list (title, id, updatedAt)
coursesRouter.get('/', async (_req, res) => {
  const courses = await Course.find({ deletedAt: null }, { title: 1, updatedAt: 1 }).sort({
    updatedAt: -1,
  })
  res.json({ success: true, data: courses })
})

/**
 * @openapi
 * /courses/{id}:
 *   get:
 *     summary: Get a course by ID
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: MongoDB ObjectId of the course
 *     responses:
 *       200:
 *         description: Full course document
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/Course' }
 *       400:
 *         description: Invalid ObjectId
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       404:
 *         description: Course not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 */
// GET /courses/:id — full document
coursesRouter.get('/:id', async (req, res) => {
  if (!validateId(req.params.id)) {
    res.status(400).json({ success: false, error: 'Invalid course id' })
    return
  }
  const course = await Course.findOne({ _id: req.params.id, deletedAt: null })
  if (!course) {
    res.status(404).json({ success: false, error: 'Course not found' })
    return
  }
  res.json({ success: true, data: course })
})

/**
 * @openapi
 * /courses:
 *   post:
 *     summary: Create a new course
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string, maxLength: 200, example: My New Course }
 *     responses:
 *       201:
 *         description: Course created
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/Course' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 */
// POST /courses — create empty course
coursesRouter.post('/', async (req, res) => {
  const body = req.body as { title?: unknown }
  // H-02: runtime validation
  const title = typeof body.title === 'string' && body.title.trim()
    ? body.title.trim().slice(0, 200)
    : 'Untitled Course'
  const course = await Course.create({ title })
  if (req.user) {
    void logAudit(course._id as string, 'course.create', req.user, { title })
  }
  res.status(201).json({ success: true, data: course })
})

/**
 * @openapi
 * /courses/{id}:
 *   put:
 *     summary: Update a course (full replace of allowed fields)
 *     description: Allowlisted fields only — title, slides, templates, resources, settings, metadata.
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:     { type: string, maxLength: 200 }
 *               slides:    { type: array, items: { $ref: '#/components/schemas/Slide' } }
 *               templates: { type: array, items: { type: object } }
 *               resources: { type: array, items: { type: object } }
 *               settings:  { type: object }
 *               metadata:  { type: object }
 *     responses:
 *       200:
 *         description: Updated course
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/Course' }
 *       400:
 *         description: Invalid ObjectId
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       404:
 *         description: Course not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 */
// PUT /courses/:id — full replace
coursesRouter.put('/:id', async (req, res) => {
  if (!validateId(req.params.id)) {
    res.status(400).json({ success: false, error: 'Invalid course id' })
    return
  }

  // C-01: allowlist only writable fields — never pass raw req.body to Mongoose
  const { title, slides, templates, resources, settings, metadata, sharedSequences } =
    req.body as CourseUpdatePayload

  // TD-024.4 (D3): slides carry the widget contract — validate before Mongo.
  if (slides !== undefined) {
    const parsed = SlidesArrayZ.safeParse(slides)
    if (!parsed.success) {
      res.status(400).json({ success: false, error: formatZodError('slides', parsed.error) })
      return
    }
  }

  const course = await Course.findOneAndUpdate(
    { _id: req.params.id, deletedAt: null },
    { $set: { title, slides, templates, resources, settings, metadata, sharedSequences } },
    { new: true, runValidators: true }
  )
  if (!course) {
    res.status(404).json({ success: false, error: 'Course not found' })
    return
  }
  if (req.user) {
    void logAudit(req.params.id, 'course.update', req.user, {
      fields: Object.keys({ title, slides, templates, resources, settings, metadata, sharedSequences }).filter(
        k => (req.body as CourseUpdatePayload)[k as keyof CourseUpdatePayload] !== undefined
      ),
    })
  }
  res.json({ success: true, data: course })
})

/**
 * @openapi
 * /courses/{id}:
 *   delete:
 *     summary: Soft-delete a course
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Course soft-deleted
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object, nullable: true, example: null }
 *       400:
 *         description: Invalid ObjectId
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       404:
 *         description: Course not found or already deleted
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 */
// DELETE /courses/:id — soft delete
coursesRouter.delete('/:id', async (req, res) => {
  if (!validateId(req.params.id)) {
    res.status(400).json({ success: false, error: 'Invalid course id' })
    return
  }
  const course = await Course.findOneAndUpdate(
    { _id: req.params.id, deletedAt: null },
    { deletedAt: new Date() },
    { new: true }
  )
  if (!course) {
    res.status(404).json({ success: false, error: 'Course not found' })
    return
  }
  if (req.user) {
    void logAudit(req.params.id, 'course.delete', req.user)
  }
  res.json({ success: true, data: null })
})

// ---------------------------------------------------------------------------
// Slide sub-resource routes — atomic operations via MongoDB operators (R-07)
// Avoids the fetch-modify-PUT race condition in the old slide CRUD helpers.
// ---------------------------------------------------------------------------

interface SlidePatchPayload {
  title?: unknown
  widgets?: unknown
  actions?: unknown
  thumbnail?: unknown
}

/**
 * @openapi
 * /courses/{id}/slides:
 *   post:
 *     summary: Add a slide to a course
 *     tags: [Slides]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string, maxLength: 200, example: Introduction }
 *     responses:
 *       201:
 *         description: Updated course with the new slide appended
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/Course' }
 *       400:
 *         description: Invalid ObjectId
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       404:
 *         description: Course not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 */
// POST /courses/:id/slides — atomically push a new slide
coursesRouter.post('/:id/slides', async (req, res) => {
  if (!validateId(req.params.id)) {
    res.status(400).json({ success: false, error: 'Invalid course id' })
    return
  }
  const body = req.body as { title?: unknown }
  const title =
    typeof body.title === 'string' && body.title.trim()
      ? body.title.trim().slice(0, 200)
      : 'New Slide'
  const slide = { id: randomUUID(), title, widgets: [], actions: [] }
  const course = await Course.findOneAndUpdate(
    { _id: req.params.id, deletedAt: null },
    { $push: { slides: slide } },
    { new: true, runValidators: true },
  )
  if (!course) {
    res.status(404).json({ success: false, error: 'Course not found' })
    return
  }
  if (req.user) {
    void logAudit(req.params.id, 'slide.create', req.user, { slideId: slide.id, title: slide.title })
  }
  res.status(201).json({ success: true, data: course })
})

/**
 * @openapi
 * /courses/{id}/slides/reorder:
 *   patch:
 *     summary: Reorder slides
 *     description: Supply the complete ordered array of slide IDs. All existing slide IDs must be present.
 *     tags: [Slides]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orderedIds]
 *             properties:
 *               orderedIds:
 *                 type: array
 *                 items: { type: string }
 *                 example: [slide-uuid-1, slide-uuid-2]
 *     responses:
 *       200:
 *         description: Updated course with slides in new order
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/Course' }
 *       400:
 *         description: Invalid ObjectId, empty orderedIds, or IDs do not match existing slides
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       404:
 *         description: Course not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 */
// PATCH /courses/:id/slides/reorder — MUST be registered before /:id/slides/:slideId to avoid
// Express treating "reorder" as a slideId parameter.
// Atomically reorder slides by supplying ordered ID array.
// Uses $set on the entire slides subdocument to avoid the GET+PUT race condition of the old
// reorderSlides client implementation.
coursesRouter.patch('/:id/slides/reorder', async (req, res) => {
  if (!validateId(req.params.id)) {
    res.status(400).json({ success: false, error: 'Invalid course id' })
    return
  }
  const body = req.body as { orderedIds?: unknown }
  if (
    !Array.isArray(body.orderedIds) ||
    body.orderedIds.length === 0 ||
    !body.orderedIds.every(id => typeof id === 'string')
  ) {
    res.status(400).json({ success: false, error: 'orderedIds must be a non-empty array of strings' })
    return
  }
  const orderedIds = body.orderedIds as string[]

  // NOTE: This is a read-then-write, not a true atomic operation.
  // A concurrent reorder between the findOne and findOneAndUpdate could cause a
  // lost update. In practice the risk is low (reorder is a manual UI drag operation),
  // but do not assume this is safe under high concurrency.
  const course = await Course.findOne({ _id: req.params.id, deletedAt: null })
  if (!course) {
    res.status(404).json({ success: false, error: 'Course not found' })
    return
  }
  const slideMap = new Map(course.slides.map((s: { id: string }) => [s.id, s]))
  const reordered = orderedIds.flatMap(id => {
    const slide = slideMap.get(id)
    return slide ? [slide] : []
  })
  if (reordered.length !== course.slides.length) {
    res.status(400).json({ success: false, error: 'orderedIds does not match existing slides' })
    return
  }
  const updated = await Course.findOneAndUpdate(
    { _id: req.params.id, deletedAt: null },
    { $set: { slides: reordered } },
    { new: true },
  )
  if (req.user) {
    void logAudit(req.params.id, 'slide.reorder', req.user, { orderedIds })
  }
  res.json({ success: true, data: updated })
})

/**
 * @openapi
 * /courses/{id}/slides/{slideId}:
 *   patch:
 *     summary: Update a slide's fields
 *     tags: [Slides]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: slideId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:     { type: string }
 *               widgets:   { type: array, items: { $ref: '#/components/schemas/Widget' } }
 *               actions:   { type: array, items: { $ref: '#/components/schemas/ActionSequence' } }
 *               thumbnail: { type: string }
 *     responses:
 *       200:
 *         description: Updated course
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/Course' }
 *       400:
 *         description: Invalid ObjectId or no updatable fields
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       404:
 *         description: Course or slide not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 */
// PATCH /courses/:id/slides/:slideId — atomically update one slide's fields
coursesRouter.patch('/:id/slides/:slideId', async (req, res) => {
  if (!validateId(req.params.id)) {
    res.status(400).json({ success: false, error: 'Invalid course id' })
    return
  }
  const { title, widgets, actions, thumbnail } = req.body as SlidePatchPayload
  // TD-024.4 (D3): validate the widget/action payload against the shared
  // contract BEFORE Mongo. Previously contract-invalid widgets surfaced as
  // unhandled Mongoose ValidationErrors (500) and undeclared fields were
  // silently stripped — the TD-019b failure mode.
  if (widgets !== undefined) {
    const parsed = WidgetsArrayZ.safeParse(widgets)
    if (!parsed.success) {
      res.status(400).json({ success: false, error: formatZodError('widgets', parsed.error) })
      return
    }
  }
  if (actions !== undefined) {
    const parsed = ActionSequencesArrayZ.safeParse(actions)
    if (!parsed.success) {
      res.status(400).json({ success: false, error: formatZodError('actions', parsed.error) })
      return
    }
  }
  const $set: Record<string, unknown> = {}
  if (title !== undefined) $set['slides.$.title'] = title
  if (widgets !== undefined) $set['slides.$.widgets'] = widgets
  if (actions !== undefined) $set['slides.$.actions'] = actions
  if (thumbnail !== undefined) $set['slides.$.thumbnail'] = thumbnail

  if (Object.keys($set).length === 0) {
    res.status(400).json({ success: false, error: 'No updatable fields provided' })
    return
  }

  const course = await Course.findOneAndUpdate(
    { _id: req.params.id, deletedAt: null, 'slides.id': req.params.slideId },
    { $set },
    { new: true, runValidators: true },
  )
  if (!course) {
    res.status(404).json({ success: false, error: 'Course or slide not found' })
    return
  }
  if (req.user) {
    void logAudit(req.params.id, 'slide.update', req.user, {
      slideId: req.params.slideId,
      fields: Object.keys($set).map(k => k.replace('slides.$.', '')),
    })
  }
  res.json({ success: true, data: course })
})

/**
 * @openapi
 * /courses/{id}/slides/{slideId}:
 *   delete:
 *     summary: Remove a slide from a course
 *     tags: [Slides]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: slideId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Updated course with slide removed
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/Course' }
 *       400:
 *         description: Invalid ObjectId
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       404:
 *         description: Course not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 */
// DELETE /courses/:id/slides/:slideId — atomically pull one slide
coursesRouter.delete('/:id/slides/:slideId', async (req, res) => {
  if (!validateId(req.params.id)) {
    res.status(400).json({ success: false, error: 'Invalid course id' })
    return
  }
  // Verify the slide exists before pulling it so a missing slideId returns 404 not 200.
  const before = await Course.findOne({ _id: req.params.id, deletedAt: null, 'slides.id': req.params.slideId })
  if (!before) {
    res.status(404).json({ success: false, error: 'Course or slide not found' })
    return
  }
  const course = await Course.findOneAndUpdate(
    { _id: req.params.id, deletedAt: null },
    { $pull: { slides: { id: req.params.slideId } } },
    { new: true },
  )
  if (!course) {
    res.status(404).json({ success: false, error: 'Course not found' })
    return
  }
  if (req.user) {
    void logAudit(req.params.id, 'slide.delete', req.user, { slideId: req.params.slideId })
  }
  res.json({ success: true, data: course })
})

/**
 * @openapi
 * /courses/{id}/history:
 *   get:
 *     summary: Get audit history for a course
 *     description: Returns paginated audit log entries, newest first. Limit is capped at 200, default 50.
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50, maximum: 200 }
 *       - in: query
 *         name: skip
 *         schema: { type: integer, default: 0, minimum: 0 }
 *     responses:
 *       200:
 *         description: Paginated audit entries
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [success, data, meta]
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/AuditEntry' }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *       400:
 *         description: Invalid ObjectId
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 */
// GET /courses/:id/history — paginated audit log for a course (newest first)
coursesRouter.get('/:id/history', async (req, res) => {
  if (!validateId(req.params.id)) {
    res.status(400).json({ success: false, error: 'Invalid course id' })
    return
  }

  const limit = Math.min(Number(req.query.limit) || 50, 200)
  const skip = Math.max(Number(req.query.skip) || 0, 0)

  const [entries, total] = await Promise.all([
    AuditLog.find({ courseId: req.params.id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments({ courseId: req.params.id }),
  ])

  res.json({ success: true, data: entries, meta: { total, limit, skip } })
})

/**
 * @openapi
 * /courses/{id}/export/scorm12:
 *   post:
 *     summary: Export course as SCORM 1.2 ZIP
 *     description: Generates a SCORM 1.2 compliant ZIP and streams it as a file download. Rate limited to 5 requests per 15 minutes per user.
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: SCORM 1.2 ZIP file download
 *         content:
 *           application/zip:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Invalid ObjectId
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       404:
 *         description: Course not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       429:
 *         description: Too many export requests
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       500:
 *         description: Package generation failed
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 */
// TD-001: Shared handler factory for the three export formats. Every pre-TD-001
// route duplicated ~35 LOC of asset collection + download + rewrite + packer call
// plus identical UI-state plumbing. The full pipeline now lives in runExport();
// each route is reduced to a one-line registration. Adding a 4th format
// (e.g. xAPI) requires one entry in runExport's PACKERS map + one register call.
//
// PLAYER_JS_PATH env var allows Docker to inject a pre-built player.js at a
// known location (e.g. /app/player.js) so the packer does not need workspace
// path resolution at runtime.
function buildExportHandler(format: ExportFormat): RequestHandler {
  return async (req, res) => {
    const courseId = req.params['id'] as string
    if (!validateId(courseId)) {
      res.status(400).json({ success: false, error: 'Invalid course id' })
      return
    }
    const course = await Course.findOne({ _id: courseId, deletedAt: null })
    if (!course) {
      res.status(404).json({ success: false, error: 'Course not found' })
      return
    }

    try {
      const playerPath = process.env.PLAYER_JS_PATH
      const { zipPath, tmpDir, fileName } = await runExport(
        course.toObject(),
        format,
        playerPath ? { playerPath } : {},
      )
      res.download(zipPath, fileName, () => {
        // Success-path cleanup: tmpDir removal deferred 500ms so the OS has
        // released the file descriptor that res.download held open.
        setTimeout(() => fs.rmSync(tmpDir, { recursive: true, force: true }), 500)
      })
    } catch (err) {
      // runExport already cleaned tmpDir on its own error path.
      const message = err instanceof Error ? err.message : 'Package generation failed'
      res.status(500).json({ success: false, error: message })
    }
  }
}

// POST /courses/:id/export/scorm12 — generate SCORM 1.2 ZIP and stream to client
coursesRouter.post('/:id/export/scorm12', exportLimiter, buildExportHandler('scorm12'))

// POST /courses/:id/export/scorm2004 — generate SCORM 2004 ZIP and stream to client
coursesRouter.post('/:id/export/scorm2004', exportLimiter, buildExportHandler('scorm2004'))

// POST /courses/:id/export/aicc — generate AICC ZIP and stream to client
coursesRouter.post('/:id/export/aicc', exportLimiter, buildExportHandler('aicc'))
