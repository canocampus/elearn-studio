/** A raw browser interaction captured by the injected script. */
export interface CapturedEvent {
  seq: number
  type: 'click' | 'dblclick' | 'rightclick' | 'keydown' | 'input' | 'change'
  selector: string
  targetText?: string
  x?: number
  y?: number
  button?: 'left' | 'right'
  key?: string
  value?: string
  timestamp: string
}

/** One recorded step: a screenshot + the event that triggered it. */
export interface SimStep {
  id: string
  order: number
  eventType: CapturedEvent['type']
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

/** Full recording session as persisted to Garage. */
export interface Session {
  id: string
  url: string
  title: string
  status: 'recording' | 'finished' | 'error'
  startedAt: string
  finishedAt?: string
  steps: SimStep[]
}

/** Minimal session info returned by GET /recorder/sessions. */
export interface SessionSummary {
  id: string
  url: string
  title: string
  status: Session['status']
  startedAt: string
  finishedAt?: string
  stepCount: number
}

/** In-memory state for an active recording — not persisted until stop. */
export interface ActiveSession {
  id: string
  url: string
  title: string
  startedAt: string
  steps: SimStep[]
  stepCounter: number
}
