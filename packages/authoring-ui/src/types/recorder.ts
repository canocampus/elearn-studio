/**
 * Client-side mirror of the recorder types defined in
 * `packages/simulation-engine/src/recorder/types.ts`.
 *
 * TD-014.8 keeps these duplicated rather than adding a cross-package import so
 * the authoring-ui build stays decoupled from simulation-engine's server-only
 * deps (Playwright, @aws-sdk/client-s3). If the shapes diverge the OpenAPI
 * regeneration step in TD-014.27.d will surface the drift.
 */

export type RecorderEventType =
  | 'click'
  | 'dblclick'
  | 'rightclick'
  | 'keydown'
  | 'input'
  | 'change'

export interface SimStep {
  id: string
  order: number
  eventType: RecorderEventType
  selector: string
  targetText?: string
  coordinates?: { x: number; y: number }
  value?: string
  key?: string
  /** S3 key for the screenshot, e.g. recordings/{sessionId}/screenshots/step-0.png */
  screenshotKey: string
  /** Human-readable description auto-generated from the event */
  description: string
  timestamp: string
}

export type SessionStatus = 'recording' | 'finished' | 'error'

/** Full recording session as persisted to Garage. */
export interface Session {
  id: string
  url: string
  title: string
  status: SessionStatus
  startedAt: string
  finishedAt?: string
  steps: SimStep[]
}

/** Minimal session info returned by GET /recorder/sessions. */
export interface SessionSummary {
  id: string
  url: string
  title: string
  status: SessionStatus
  startedAt: string
  finishedAt?: string
  stepCount: number
}

/** Response shape of POST /recorder/start. */
export interface StartRecordingResponse {
  sessionId: string
  status: 'recording'
  startedAt: string
}

/** Response shape of POST /recorder/capture. */
export interface CaptureStepResponse {
  steps: SimStep[]
}

/** Response shape of GET /recorder/sessions. */
export interface ListSessionsResponse {
  sessions: SessionSummary[]
  total: number
}
