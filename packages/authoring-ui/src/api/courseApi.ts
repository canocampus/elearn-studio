/**
 * API client for the eLearn Studio backend API.
 * All requests are authenticated via Bearer token (managed by apiClient).
 */

import type { CourseDoc, CourseListItem, Slide } from '../types/course'
import type { SimConfig } from '../types/simulation'
import type { components } from './generated'
import { apiRequest, apiBlobRequest } from './apiClient'

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------

// TD-024: typing responses as the shared domain types (CourseDoc/Slide) is
// backed by `apiContractGuard.ts`, which compile-checks the generated OpenAPI
// client against the shared contract — drift fails verify:types, so this is
// no longer trust-by-assertion (audit finding 3).
type ApiEnvelope<T> = { success: boolean; data: T }

export function listCourses(): Promise<CourseListItem[]> {
  return apiRequest<ApiEnvelope<CourseListItem[]>>('/courses').then(r => r.data)
}

export function getCourse(id: string): Promise<CourseDoc> {
  return apiRequest<ApiEnvelope<CourseDoc>>(`/courses/${id}`).then(r => r.data)
}

export function createCourse(title: string): Promise<CourseDoc> {
  return apiRequest<ApiEnvelope<CourseDoc>>('/courses', {
    method: 'POST',
    body: JSON.stringify({ title }),
  }).then(r => r.data)
}

export function updateCourse(id: string, data: Partial<CourseDoc>): Promise<CourseDoc> {
  return apiRequest<ApiEnvelope<CourseDoc>>(`/courses/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }).then(r => r.data)
}

export function deleteCourse(id: string): Promise<void> {
  return apiRequest<void>(`/courses/${id}`, { method: 'DELETE' })
}

// ---------------------------------------------------------------------------
// Slide helpers (operate on the course document)
// ---------------------------------------------------------------------------

/** T013-L-03: shared helper so SlideList and TopToolbar use the same naming formula. */
export function nextSlideTitle(slides: CourseDoc['slides']): string {
  return `Slide ${slides.length + 1}`
}

// R-07: targeted slide routes use atomic MongoDB $push/$set/$pull — no race conditions
export function addSlide(courseId: string, title: string): Promise<CourseDoc> {
  return apiRequest<ApiEnvelope<CourseDoc>>(`/courses/${courseId}/slides`, {
    method: 'POST',
    body: JSON.stringify({ title }),
  }).then(r => r.data)
}

export function updateSlide(
  courseId: string,
  slideId: string,
  patch: Partial<Slide>,
): Promise<CourseDoc> {
  return apiRequest<ApiEnvelope<CourseDoc>>(`/courses/${courseId}/slides/${slideId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  }).then(r => r.data)
}

export function deleteSlide(courseId: string, slideId: string): Promise<CourseDoc> {
  return apiRequest<ApiEnvelope<CourseDoc>>(`/courses/${courseId}/slides/${slideId}`, { method: 'DELETE' }).then(r => r.data)
}

// Duplicate: add a blank slide then copy the source slide's content into it.
// The new slide is appended at the end of the slide list.
// TD-027: only widgets are copied — widget sequences travel INSIDE widgets;
// the slide-level `actions` fossil is retired.
export async function duplicateSlide(courseId: string, sourceSlide: Slide): Promise<CourseDoc> {
  const withNew = await addSlide(courseId, `${sourceSlide.title} copy`)
  const newSlide = withNew.slides[withNew.slides.length - 1]
  return updateSlide(courseId, newSlide.id, {
    widgets: sourceSlide.widgets,
  })
}

// R-07 extension: atomic reorder via a targeted route (no GET+PUT race)
export function reorderSlides(courseId: string, orderedIds: string[]): Promise<CourseDoc> {
  return apiRequest<ApiEnvelope<CourseDoc>>(`/courses/${courseId}/slides/reorder`, {
    method: 'PATCH',
    body: JSON.stringify({ orderedIds }),
  }).then(r => r.data)
}

// ---------------------------------------------------------------------------
// Audit History (T167)
// ---------------------------------------------------------------------------

// Per-action detail shapes (discriminated by the action field on AuditLogEntry).
// generated.ts uses { [key: string]: unknown } — we override with precise types here.
type AuditDetailCourseCreate  = { title: string }
type AuditDetailCourseUpdate  = { fields: string[] }
type AuditDetailSlideCreate   = { slideId: string; title: string }
type AuditDetailSlideUpdate   = { slideId: string; fields: string[] }
type AuditDetailSlideDelete   = { slideId: string }
type AuditDetailSlideReorder  = { orderedIds: string[] }

export type AuditDetail =
  | AuditDetailCourseCreate
  | AuditDetailCourseUpdate
  | AuditDetailSlideCreate
  | AuditDetailSlideUpdate
  | AuditDetailSlideDelete
  | AuditDetailSlideReorder
  | Record<string, unknown>  // fallback for future actions

/** AuditEntry with narrowed detail type. Overrides the generated schema. */
export type AuditLogEntry = Omit<components['schemas']['AuditEntry'], 'detail'> & {
  detail?: AuditDetail
}

export interface CourseHistoryResult {
  entries: AuditLogEntry[]
  total: number
}

export async function getCourseHistory(
  courseId: string,
  opts: { limit?: number; skip?: number } = {},
): Promise<CourseHistoryResult> {
  const params = new URLSearchParams()
  if (opts.limit !== undefined) params.set('limit', String(opts.limit))
  if (opts.skip !== undefined) params.set('skip', String(opts.skip))
  const qs = params.toString() ? `?${params.toString()}` : ''

  // Backend returns { success, data: AuditLogEntry[], meta: { total, limit, skip } }
  const res = await apiRequest<{
    success: boolean
    data: AuditLogEntry[]
    meta: { total: number; limit: number; skip: number }
  }>(`/courses/${courseId}/history${qs}`)
  return { entries: res.data, total: res.meta.total }
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

async function triggerZipDownload(
  endpoint: string,
  fallbackFileName: string,
): Promise<void> {
  const res = await apiBlobRequest(endpoint, { method: 'POST' })
  const blob = await res.blob()
  const disposition = res.headers.get('Content-Disposition') ?? ''
  const match = disposition.match(/filename="([^"]+)"/)
  const fileName = match?.[1] ?? fallbackFileName
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

/** Request a SCORM 1.2 ZIP from the backend and trigger a browser download. */
export function exportSCORM12(courseId: string, courseTitle: string): Promise<void> {
  return triggerZipDownload(
    `/courses/${courseId}/export/scorm12`,
    `${courseTitle}_scorm12.zip`,
  )
}

/** Request a SCORM 2004 ZIP from the backend and trigger a browser download. */
export function exportSCORM2004(courseId: string, courseTitle: string): Promise<void> {
  return triggerZipDownload(
    `/courses/${courseId}/export/scorm2004`,
    `${courseTitle}_scorm2004.zip`,
  )
}

/** Request an AICC ZIP from the backend and trigger a browser download. */
export function exportAICC(courseId: string, courseTitle: string): Promise<void> {
  return triggerZipDownload(
    `/courses/${courseId}/export/aicc`,
    `${courseTitle}_aicc.zip`,
  )
}

// ---------------------------------------------------------------------------
// Simulations (T024.3)
// ---------------------------------------------------------------------------

/**
 * Import a recorded simulation session into a course.
 */
export function importSimulation(courseId: string, sessionId: string): Promise<SimConfig> {
  return apiRequest<{ success: boolean; data: SimConfig }>(
    `/courses/${courseId}/simulations/import`,
    {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    },
  ).then(r => r.data)
}

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

/** Generated from OpenAPI schema — do not edit manually. */
export type AssetUploadResult = components['schemas']['Asset']

/**
 * Fetch a time-limited presigned URL for an asset object.
 * Used when a Bearer-authenticated fetch is needed (e.g. canvas <img> rendering).
 */
export async function resolveAssetUrl(objectName: string): Promise<string> {
  const result = await apiRequest<{ success: boolean; data: { presignedUrl: string } }>(
    `/assets/${objectName}/presigned`,
  )
  return result.data.presignedUrl
}

export async function uploadAsset(file: File): Promise<AssetUploadResult> {
  const { apiFetch } = await import('./apiClient')

  const formData = new FormData()
  formData.append('file', file)

  // apiFetch handles Bearer injection and silent token refresh on 401.
  // Do NOT set Content-Type — browser must set it with the multipart boundary.
  const res = await apiFetch('/assets', {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Upload failed ${res.status}: ${body}`)
  }
  // R-01: backend wraps response in { success, data } — unwrap the data field
  return ((await res.json()) as { data: AssetUploadResult }).data
}
