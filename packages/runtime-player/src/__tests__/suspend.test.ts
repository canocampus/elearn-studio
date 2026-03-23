/**
 * Unit tests for T027 — Suspend/Resume
 * (serializeSuspend, deserializeSuspend, saveSuspendData, restoreSuspendData)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  serializeSuspend,
  deserializeSuspend,
  saveSuspendData,
  restoreSuspendData,
  SUSPEND_DATA_MAX,
  type SuspendableState,
} from '../suspend'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeState(slide = 0, scores: [string, { score: number; weight: number; answered: boolean }][] = []): SuspendableState {
  return {
    currentSlide: slide,
    questionStates: new Map(scores.map(([id, q]) => [id, { widgetId: id, ...q }])),
  }
}

function makeApi(suspendDataStore: Record<string, string> = {}) {
  return {
    LMSGetValue: vi.fn((key: string) => suspendDataStore[key] ?? ''),
    LMSSetValue: vi.fn((key: string, value: string) => { suspendDataStore[key] = value; return 'true' }),
  }
}

// ─── serializeSuspend ─────────────────────────────────────────────────────────

describe('serializeSuspend', () => {
  it('returns a non-empty string for minimal state', () => {
    const result = serializeSuspend(makeState())
    expect(result).toBeTruthy()
    expect(typeof result).toBe('string')
  })

  it('output length is within SCORM 1.2 limit for typical course state', () => {
    const state = makeState(3, [
      ['w-001', { score: 1, weight: 100, answered: true }],
      ['w-002', { score: 0, weight: 100, answered: true }],
      ['w-003', { score: 1, weight: 100, answered: true }],
    ])
    const result = serializeSuspend(state)
    expect(result).not.toBeNull()
    expect(result!.length).toBeLessThanOrEqual(SUSPEND_DATA_MAX)
  })

  it('encodes slide index', () => {
    const state = makeState(7)
    const result = serializeSuspend(state)!
    const decoded = deserializeSuspend(result)
    expect(decoded?.slide).toBe(7)
  })

  it('encodes question scores', () => {
    const state = makeState(0, [
      ['q1', { score: 0.5, weight: 50, answered: true }],
    ])
    const result = serializeSuspend(state)!
    const decoded = deserializeSuspend(result)
    expect(decoded?.scores).toHaveLength(1)
    expect(decoded?.scores[0][0]).toBe('q1')
    expect(decoded?.scores[0][1].s).toBe(0.5)
    expect(decoded?.scores[0][1].w).toBe(50)
    expect(decoded?.scores[0][1].a).toBe(true)
  })

  it('returns null for negative slide index (H-01 fix)', () => {
    const state: SuspendableState = { currentSlide: -1, questionStates: new Map() }
    expect(serializeSuspend(state)).toBeNull()
  })

  it('returns null for non-integer slide index', () => {
    const state: SuspendableState = { currentSlide: 1.5, questionStates: new Map() }
    expect(serializeSuspend(state)).toBeNull()
  })

  it('returns null when compressed result exceeds SUSPEND_DATA_MAX', () => {
    // Create a state with a very long widget ID to force oversized output
    const bigScores: [string, { score: number; weight: number; answered: boolean }][] = Array.from({ length: 500 }, (_, i) => [
      `widget-id-that-is-deliberately-very-long-to-exceed-the-limit-${i}`.repeat(3),
      { score: Math.random(), weight: 100, answered: true },
    ])
    const state = makeState(0, bigScores)
    const result = serializeSuspend(state)
    expect(result).toBeNull()
  })
})

  it('T205 TEST-01: 100 questions with realistic IDs stay within SCORM 1.2 limit', () => {
    // Stress test: 100 questions, realistic widget IDs, worst-case scores (0.5 = no compression gain)
    const scores: [string, { score: number; weight: number; answered: boolean }][] = Array.from(
      { length: 100 },
      (_, i) => [`widget-q${String(i).padStart(3, '0')}`, { score: 0.5, weight: 100, answered: true }],
    )
    const state = makeState(0, scores)
    const result = serializeSuspend(state)
    expect(result).not.toBeNull()
    expect(result!.length).toBeLessThanOrEqual(SUSPEND_DATA_MAX)
  })

// ─── deserializeSuspend ───────────────────────────────────────────────────────

describe('deserializeSuspend', () => {
  it('returns null for an empty string', () => {
    expect(deserializeSuspend('')).toBeNull()
  })

  it('returns null for corrupt data', () => {
    expect(deserializeSuspend('not_valid_lz_data')).toBeNull()
  })

  it('returns null for unknown schema version', () => {
    // Manually craft a payload with v:2
    const LZString = require('lz-string')
    const bad = LZString.compressToEncodedURIComponent(JSON.stringify({ v: 2, slide: 0, scores: [] }))
    expect(deserializeSuspend(bad)).toBeNull()
  })

  it('returns null when slide field is missing', () => {
    const LZString = require('lz-string')
    const bad = LZString.compressToEncodedURIComponent(JSON.stringify({ v: 1, scores: [] }))
    expect(deserializeSuspend(bad)).toBeNull()
  })

  it('returns null when scores field is not an array', () => {
    const LZString = require('lz-string')
    const bad = LZString.compressToEncodedURIComponent(JSON.stringify({ v: 1, slide: 0, scores: null }))
    expect(deserializeSuspend(bad)).toBeNull()
  })

  it('round-trips correctly through serialize → deserialize', () => {
    const state = makeState(5, [
      ['q-abc', { score: 1, weight: 100, answered: true }],
      ['q-def', { score: 0, weight: 50, answered: false }],
    ])
    const compressed = serializeSuspend(state)!
    const payload = deserializeSuspend(compressed)!
    expect(payload.v).toBe(1)
    expect(payload.slide).toBe(5)
    expect(payload.scores).toHaveLength(2)
  })
})

// ─── saveSuspendData ──────────────────────────────────────────────────────────

describe('saveSuspendData', () => {
  it('calls LMSSetValue("cmi.suspend_data", ...) with compressed data', () => {
    const store: Record<string, string> = {}
    const api = makeApi(store)
    const state = makeState(2, [['w1', { score: 1, weight: 100, answered: true }]])
    saveSuspendData(state, api)
    expect(api.LMSSetValue).toHaveBeenCalledWith('cmi.suspend_data', expect.any(String))
    expect(store['cmi.suspend_data']).toBeTruthy()
  })

  it('does nothing when api is null', () => {
    expect(() => saveSuspendData(makeState(), null)).not.toThrow()
  })

  it('returns true when LMSSetValue succeeds (C-01 fix)', () => {
    const api = makeApi()
    const ok = saveSuspendData(makeState(0), api)
    expect(ok).toBe(true)
  })

  it('returns false when LMSSetValue returns "false" (C-01 fix)', () => {
    const api = {
      LMSGetValue: vi.fn(() => ''),
      LMSSetValue: vi.fn(() => 'false'),
    }
    const ok = saveSuspendData(makeState(0), api)
    expect(ok).toBe(false)
  })

  it('returns false when api is null', () => {
    expect(saveSuspendData(makeState(), null)).toBe(false)
  })

  it('does not call LMSSetValue when serialisation returns null (oversized)', () => {
    const bigScores: [string, { score: number; weight: number; answered: boolean }][] = Array.from({ length: 500 }, (_, i) => [
      `widget-id-that-is-deliberately-very-long-to-exceed-the-limit-${i}`.repeat(3),
      { score: Math.random(), weight: 100, answered: true },
    ])
    const api = makeApi()
    saveSuspendData(makeState(0, bigScores), api)
    expect(api.LMSSetValue).not.toHaveBeenCalled()
  })
})

// ─── restoreSuspendData ───────────────────────────────────────────────────────

describe('restoreSuspendData', () => {
  it('restores slide index and question states from suspend_data', () => {
    const state = makeState(2, [['w1', { score: 1, weight: 100, answered: true }]])
    const store: Record<string, string> = {}
    const api = makeApi(store)
    saveSuspendData(state, api)

    const restored = makeState()
    const ok = restoreSuspendData(restored, api, 10)

    expect(ok).toBe(true)
    expect(restored.currentSlide).toBe(2)
    expect(restored.questionStates.size).toBe(1)
    const q = restored.questionStates.get('w1')!
    expect(q.score).toBe(1)
    expect(q.weight).toBe(100)
    expect(q.answered).toBe(true)
  })

  it('returns false and leaves state unchanged when api is null', () => {
    const state = makeState(3)
    const ok = restoreSuspendData(state, null, 10)
    expect(ok).toBe(false)
    expect(state.currentSlide).toBe(3)
  })

  it('returns false when suspend_data is empty', () => {
    const api = makeApi()
    const state = makeState(1)
    const ok = restoreSuspendData(state, api, 10)
    expect(ok).toBe(false)
    expect(state.currentSlide).toBe(1) // unchanged
  })

  it('returns false for corrupt suspend_data', () => {
    const api = makeApi({ 'cmi.suspend_data': 'garbage!!!' })
    const ok = restoreSuspendData(makeState(), api, 10)
    expect(ok).toBe(false)
  })

  it('returns false when restored slide is out of bounds (C-02 fix)', () => {
    // Manually craft payload with slide=99, slideCount=5
    const LZString = require('lz-string')
    const compressed = LZString.compressToEncodedURIComponent(
      JSON.stringify({ v: 1, slide: 99, scores: [] }),
    )
    const api = makeApi({ 'cmi.suspend_data': compressed })
    const restored = makeState(0)
    const ok = restoreSuspendData(restored, api, 5)
    // C-02: out-of-bounds slide must fail the restore, leaving state unchanged
    expect(ok).toBe(false)
    expect(restored.currentSlide).toBe(0)
  })

  it('preserves widgetId on each restored question state', () => {
    const state = makeState(0, [
      ['q-alpha', { score: 0.75, weight: 80, answered: true }],
    ])
    const store: Record<string, string> = {}
    saveSuspendData(state, makeApi(store))

    const restored = makeState()
    restoreSuspendData(restored, makeApi(store), 10)
    const q = restored.questionStates.get('q-alpha')!
    expect(q.widgetId).toBe('q-alpha')
  })

  it('clamps invalid score/weight values and rejects non-boolean answered (H-03 fix)', () => {
    const LZString = require('lz-string')
    const bad = LZString.compressToEncodedURIComponent(
      JSON.stringify({ v: 1, slide: 0, scores: [['q1', { s: -999, w: 0, a: 'yes' }]] }),
    )
    const api = makeApi({ 'cmi.suspend_data': bad })
    const state = makeState()
    const ok = restoreSuspendData(state, api, 10)
    expect(ok).toBe(true)
    const q = state.questionStates.get('q1')!
    expect(q.score).toBe(0)      // clamped from -999
    expect(q.weight).toBe(100)   // clamped from 0
    expect(q.answered).toBe(false) // rejected non-boolean 'yes'
  })

  it('clamps score > 1 to 0 (H-03 fix)', () => {
    const LZString = require('lz-string')
    const bad = LZString.compressToEncodedURIComponent(
      JSON.stringify({ v: 1, slide: 0, scores: [['q2', { s: 9999, w: 100, a: true }]] }),
    )
    const api = makeApi({ 'cmi.suspend_data': bad })
    const state = makeState()
    restoreSuspendData(state, api, 10)
    expect(state.questionStates.get('q2')!.score).toBe(0)
  })

  it('clears any pre-existing question states before restoring', () => {
    const original = makeState(0, [['old-q', { score: 1, weight: 100, answered: true }]])
    const store: Record<string, string> = {}
    saveSuspendData(makeState(0, [['new-q', { score: 0.5, weight: 50, answered: true }]]), makeApi(store))

    restoreSuspendData(original, makeApi(store), 10)
    expect(original.questionStates.has('old-q')).toBe(false)
    expect(original.questionStates.has('new-q')).toBe(true)
  })
})
