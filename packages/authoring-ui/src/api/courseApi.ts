/**
 * API client for the eLearn Studio backend API.
 * All requests are JSON. API_KEY header is sent when configured.
 */

import type { CourseDoc, CourseListItem, Slide } from '../types/course'
import type { SimConfig } from '../types/simulation'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const apiKey = import.meta.env.VITE_API_KEY
  if (apiKey) {
    headers['X-Api-Key'] = apiKey
  }
  return headers
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method ?? 'GET'
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { ...getHeaders(), ...(init?.headers ?? {}) },
    })
  } catch (networkErr) {
    throw new Error(
      `API ${method} ${path} — network error (is the backend running at ${API_BASE}?): ${networkErr}`,
    )
  }
  if (!res.ok) {
    const raw = await res.text().catch(() => '')
    const body = raw.length > 500 ? raw.slice(0, 500) + '…' : raw
    throw new Error(`API ${method} ${path} → ${res.status}: ${body}`)
  }
  return res.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------

export function listCourses(): Promise<CourseListItem[]> {
  return request<CourseListItem[]>('/courses')
}

export function getCourse(id: string): Promise<CourseDoc> {
  return request<CourseDoc>(`/courses/${id}`)
}

export function createCourse(title: string): Promise<CourseDoc> {
  return request<CourseDoc>('/courses', {
    method: 'POST',
    body: JSON.stringify({ title }),
  })
}

export function updateCourse(id: string, data: Partial<CourseDoc>): Promise<CourseDoc> {
  return request<CourseDoc>(`/courses/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function deleteCourse(id: string): Promise<void> {
  return request<void>(`/courses/${id}`, { method: 'DELETE' })
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
  return request<CourseDoc>(`/courses/${courseId}/slides`, {
    method: 'POST',
    body: JSON.stringify({ title }),
  })
}

export function updateSlide(
  courseId: string,
  slideId: string,
  patch: Partial<Slide>,
): Promise<CourseDoc> {
  return request<CourseDoc>(`/courses/${courseId}/slides/${slideId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

export function deleteSlide(courseId: string, slideId: string): Promise<CourseDoc> {
  return request<CourseDoc>(`/courses/${courseId}/slides/${slideId}`, { method: 'DELETE' })
}

// Duplicate: add a blank slide then copy the source slide's content into it.
// The new slide is appended at the end of the slide list.
export async function duplicateSlide(courseId: string, sourceSlide: Slide): Promise<CourseDoc> {
  const withNew = await addSlide(courseId, `${sourceSlide.title} copy`)
  const newSlide = withNew.slides[withNew.slides.length - 1]
  return updateSlide(courseId, newSlide.id, {
    widgets: sourceSlide.widgets,
    actions: sourceSlide.actions,
  })
}

// R-07 extension: atomic reorder via a targeted route (no GET+PUT race)
export function reorderSlides(courseId: string, orderedIds: string[]): Promise<CourseDoc> {
  return request<CourseDoc>(`/courses/${courseId}/slides/reorder`, {
    method: 'PATCH',
    body: JSON.stringify({ orderedIds }),
  })
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/**
 * Request a SCORM 1.2 ZIP from the backend and trigger a browser download.
 * Returns the suggested file name from the Content-Disposition header.
 */
export async function exportSCORM12(courseId: string, courseTitle: string): Promise<void> {
  const apiKey = import.meta.env.VITE_API_KEY
  const headers: Record<string, string> = {}
  if (apiKey) headers['X-Api-Key'] = apiKey

  let res: Response
  try {
    res = await fetch(`${API_BASE}/courses/${courseId}/export/scorm12`, {
      method: 'POST',
      headers,
    })
  } catch (err) {
    throw new Error(`Export network error: ${err}`)
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Export failed ${res.status}: ${body}`)
  }

  const blob = await res.blob()
  const disposition = res.headers.get('Content-Disposition') ?? ''
  const match = disposition.match(/filename="([^"]+)"/)
  const fileName = match?.[1] ?? `${courseTitle}_scorm12.zip`

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------
// Simulations (T024.3)
// ---------------------------------------------------------------------------

/**
 * Import a recorded simulation session into a course.
 * Fetches the raw session from Garage via the backend and returns an authoring-ready SimConfig.
 */
export function importSimulation(courseId: string, sessionId: string): Promise<SimConfig> {
  return request<{ success: boolean; data: SimConfig }>(
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

// R-02: interface matches actual backend response ({ url, objectName, originalName })
export interface AssetUploadResult {
  url: string
  objectName: string
  originalName: string
}

// R-06: shared auth headers for multipart requests (no Content-Type — let browser set boundary)
function getMultipartHeaders(): Record<string, string> {
  const headers: Record<string, string> = {}
  const apiKey = import.meta.env.VITE_API_KEY
  if (apiKey) {
    headers['X-Api-Key'] = apiKey
  }
  return headers
}

export async function uploadAsset(file: File): Promise<AssetUploadResult> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${API_BASE}/assets`, {
    method: 'POST',
    body: formData,
    headers: getMultipartHeaders(),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Upload failed ${res.status}: ${body}`)
  }
  // R-01: backend wraps response in { success, data } — unwrap the data field
  return ((await res.json()) as { data: AssetUploadResult }).data
}
