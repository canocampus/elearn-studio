import express, { Router } from 'express'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { randomUUID } from 'crypto'
import { isValidObjectId } from 'mongoose'
import { Course } from '../models/Course'
import { packSCORM12 } from '@elearn-studio/scorm-packager'

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
}

// GET /courses — list (title, id, updatedAt)
coursesRouter.get('/', async (_req, res) => {
  const courses = await Course.find({ deletedAt: null }, { title: 1, updatedAt: 1 }).sort({
    updatedAt: -1,
  })
  res.json({ success: true, data: courses })
})

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

// POST /courses — create empty course
coursesRouter.post('/', async (req, res) => {
  const body = req.body as { title?: unknown }
  // H-02: runtime validation
  const title = typeof body.title === 'string' && body.title.trim()
    ? body.title.trim().slice(0, 200)
    : 'Untitled Course'
  const course = await Course.create({ title })
  res.status(201).json({ success: true, data: course })
})

// PUT /courses/:id — full replace
coursesRouter.put('/:id', async (req, res) => {
  if (!validateId(req.params.id)) {
    res.status(400).json({ success: false, error: 'Invalid course id' })
    return
  }

  // C-01: allowlist only writable fields — never pass raw req.body to Mongoose
  const { title, slides, templates, resources, settings, metadata } =
    req.body as CourseUpdatePayload

  const course = await Course.findOneAndUpdate(
    { _id: req.params.id, deletedAt: null },
    { $set: { title, slides, templates, resources, settings, metadata } },
    { new: true, runValidators: true }
  )
  if (!course) {
    res.status(404).json({ success: false, error: 'Course not found' })
    return
  }
  res.json({ success: true, data: course })
})

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
  res.status(201).json({ success: true, data: course })
})

// PATCH /courses/:id/slides/:slideId — atomically update one slide's fields
coursesRouter.patch('/:id/slides/:slideId', async (req, res) => {
  if (!validateId(req.params.id)) {
    res.status(400).json({ success: false, error: 'Invalid course id' })
    return
  }
  const { title, widgets, actions, thumbnail } = req.body as SlidePatchPayload
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
  res.json({ success: true, data: course })
})

// DELETE /courses/:id/slides/:slideId — atomically pull one slide
coursesRouter.delete('/:id/slides/:slideId', async (req, res) => {
  if (!validateId(req.params.id)) {
    res.status(400).json({ success: false, error: 'Invalid course id' })
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
  res.json({ success: true, data: course })
})

// PATCH /courses/:id/slides/reorder — atomically reorder slides by supplying ordered ID array
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

  // Fetch the course once and reorder in-memory — atomic single write
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
  res.json({ success: true, data: updated })
})

// POST /courses/:id/export/scorm12 — generate SCORM 1.2 ZIP and stream to client
coursesRouter.post('/:id/export/scorm12', async (req, res) => {
  if (!validateId(req.params.id)) {
    res.status(400).json({ success: false, error: 'Invalid course id' })
    return
  }
  const course = await Course.findOne({ _id: req.params.id, deletedAt: null })
  if (!course) {
    res.status(404).json({ success: false, error: 'Course not found' })
    return
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'elearn-scorm-'))
  try {
    // PLAYER_JS_PATH env var allows Docker to provide a pre-built player.js at a
    // known location (e.g. /app/player.js), avoiding reliance on workspace path resolution.
    const playerPath = process.env.PLAYER_JS_PATH
    const zipPath = await packSCORM12(course.toObject(), tmpDir, playerPath ? { playerPath } : undefined)
    const safeTitle = course.title.replace(/[^a-z0-9_-]/gi, '_').slice(0, 64) || 'course'
    const fileName = `${safeTitle}_scorm12.zip`
    res.download(zipPath, fileName, () => {
      // Cleanup after download completes (or errors)
      setTimeout(() => fs.rmSync(tmpDir, { recursive: true, force: true }), 500)
    })
  } catch (err) {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    const message = err instanceof Error ? err.message : 'Package generation failed'
    res.status(500).json({ success: false, error: message })
  }
})
