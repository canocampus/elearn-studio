/**
 * Suspend/Resume support — T027
 *
 * Serialises player state to a compact JSON payload, compresses it with
 * LZString, and stores it in cmi.suspend_data (SCORM 1.2, max 4096 chars).
 * On resume, the compressed payload is decompressed and the state is restored.
 *
 * SuspendData schema (v:2):
 *   { v: 2, slide: number, visited: number[], scores: [widgetId, { s: score, w: weight, a: answered }][] }
 *
 * v:1 payloads (no visited field) are still parsed and restored; visited defaults to [slide].
 */

import LZString from 'lz-string'

/** Compact form stored inside suspend_data */
interface SuspendPayload {
  v: 1 | 2
  slide: number
  /** Slide indices visited this session (v:2+). Absent in v:1 payloads. */
  visited?: number[]
  scores: Array<[string, { s: number; w: number; a: boolean }]>
}

/** Subset of PlayerState needed for suspend serialisation (avoids circular dep) */
export interface SuspendableState {
  currentSlide: number
  visitedSlides: Set<number>
  questionStates: Map<string, { widgetId: string; score: number; weight: number; answered: boolean }>
}

/** Maximum length (chars) allowed in cmi.suspend_data by SCORM 1.2 */
export const SUSPEND_DATA_MAX = 4096

/**
 * Serialise and compress player state into a string ≤ SUSPEND_DATA_MAX chars.
 * Returns null if the slide index is invalid, or if compressed output exceeds the SCORM 1.2 limit.
 */
export function serializeSuspend(state: SuspendableState): string | null {
  // H-01 fix: reject invalid slide indices before serialising
  if (!Number.isInteger(state.currentSlide) || state.currentSlide < 0) {
    console.error(
      `[ELearnPlayer] Cannot serialize suspend data: invalid currentSlide = ${state.currentSlide}`,
    )
    return null
  }
  const payload: SuspendPayload = {
    v: 2,
    slide: state.currentSlide,
    visited: Array.from(state.visitedSlides),
    scores: Array.from(state.questionStates.values()).map(q => [
      q.widgetId,
      { s: q.score, w: q.weight, a: q.answered },
    ]),
  }
  const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(payload))
  if (compressed.length > SUSPEND_DATA_MAX) {
    console.warn(
      `[ELearnPlayer] suspend_data (${compressed.length} chars) exceeds SCORM 1.2 limit of ${SUSPEND_DATA_MAX} chars — not saving`,
    )
    return null
  }
  return compressed
}

/**
 * Decompress and parse a suspend_data string produced by serializeSuspend().
 * Returns null on any failure (empty string, corrupt data, unknown version).
 */
export function deserializeSuspend(compressed: string): SuspendPayload | null {
  if (!compressed) return null
  try {
    const json = LZString.decompressFromEncodedURIComponent(compressed)
    if (!json) return null
    const payload = JSON.parse(json) as SuspendPayload
    if (payload.v !== 1 && payload.v !== 2) return null
    if (typeof payload.slide !== 'number') return null
    if (!Array.isArray(payload.scores)) return null
    return payload
  } catch {
    return null
  }
}

// ─── Suspend data size estimation (T204) ─────────────────────────────────────

export interface SuspendSizeEstimate {
  /** Estimated compressed length (chars) for cmi.suspend_data */
  compressed: number
  /** Percentage of the SCORM 1.2 limit used (0–100) */
  percentage: number
}

/**
 * Estimates the cmi.suspend_data size for a course with the given question widget IDs.
 * Builds a worst-case payload (all questions answered at midpoint score), compresses it,
 * and returns the size relative to the SCORM 1.2 limit.
 *
 * This is an authoring-time advisory only — actual runtime size may vary based on
 * variable values and intermediate state.
 */
export function estimateSuspendSize(questionWidgetIds: string[]): SuspendSizeEstimate {
  const payload: SuspendPayload = {
    v: 1,
    slide: 0,
    scores: questionWidgetIds.map((id) => [id, { s: 0.5, w: 100, a: true }]),
  }
  const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(payload))
  const size = compressed.length
  const percentage = Math.round((size / SUSPEND_DATA_MAX) * 100)
  return { compressed: size, percentage }
}

/**
 * Normalised SCORM API subset used by suspend helpers.
 * Accepts both SCORM 1.2 and 2004 via the ScormAdapter in index.ts.
 */
interface ScormApi {
  getValue(element: string): string
  setValue(element: string, value: string): string
}

/**
 * Persist the current player state into cmi.suspend_data via the SCORM API.
 * Returns true if the LMS accepted the save, false otherwise.
 * No-op (returns false) if there is no SCORM API or if compression exceeds the limit.
 * Note: cmi.suspend_data key is identical in SCORM 1.2 and SCORM 2004.
 */
export function saveSuspendData(state: SuspendableState, api: ScormApi | null): boolean {
  if (!api) return false
  const compressed = serializeSuspend(state)
  if (compressed === null) return false
  // C-01 fix: check setValue return value — 'true' means accepted by LMS
  const result = api.setValue('cmi.suspend_data', compressed)
  if (result !== 'true') {
    console.error(
      `[ELearnPlayer] setValue('cmi.suspend_data') failed — LMS returned: ${result}. Progress may not be saved.`,
    )
    return false
  }
  return true
}

/**
 * Restore player state from cmi.suspend_data.
 * Mutates the provided state object in-place (consistent with the player's mutable-state design).
 * Returns true if state was successfully restored, false otherwise.
 */
export function restoreSuspendData(
  state: SuspendableState,
  api: ScormApi | null,
  slideCount: number,
): boolean {
  if (!api) return false
  const raw = api.getValue('cmi.suspend_data')
  const payload = deserializeSuspend(raw)
  if (!payload) return false

  // C-02 fix: treat out-of-bounds slide as a restore failure rather than silently ignoring it
  if (payload.slide < 0 || payload.slide >= slideCount) {
    console.warn(
      `[ELearnPlayer] Suspended slide ${payload.slide} is out of bounds [0, ${slideCount}). Course may have been edited. Ignoring suspend_data.`,
    )
    return false
  }
  state.currentSlide = payload.slide

  // Restore visited slide indices (v:2+). For v:1 payloads (no visited field),
  // seed with just the current slide so progress doesn't show 0% on resume.
  state.visitedSlides = new Set(
    Array.isArray(payload.visited)
      ? payload.visited.filter(n => typeof n === 'number' && n >= 0 && n < slideCount)
      : [payload.slide],
  )

  state.questionStates.clear()
  for (const [widgetId, q] of payload.scores) {
    // H-03 fix: clamp score/weight/answered to safe ranges to prevent NaN propagation
    const score   = typeof q.s === 'number' && isFinite(q.s) && q.s >= 0 && q.s <= 1 ? q.s : 0
    const weight  = typeof q.w === 'number' && isFinite(q.w) && q.w > 0 ? q.w : 100
    const answered = q.a === true
    state.questionStates.set(widgetId, { widgetId, score, weight, answered })
  }

  return true
}
