/**
 * TD-021 — Correctness-gated navigation (SCORM-aligned conditional navigation)
 *
 * Standard context (ADR 2026-07-19-conditional-navigation-scorm-alignment):
 * SCORM 2004 sequencing is inter-SCO only and SCORM 1.2 has none — intra-SCO
 * gating is explicitly the content's responsibility. These tests pin the
 * player-side contract:
 *
 *   1. `scoring.requireCorrect` blocks Next (linear-strict) until the question
 *      is answered CORRECTLY — not merely answered.
 *   2. Attempts are ENFORCED: a wrong answer re-enables Submit while attempts
 *      remain (`-1` = unlimited); pre-TD-021 the player hard-disabled Submit
 *      after the first answer while the default feedback said "Try again".
 *   3. Exhausting attempts without success UNLOCKS navigation (learner is not
 *      trapped; the failure is reflected in the reported score/status).
 *   4. The LMS-provided mastery threshold (`cmi.scaled_passing_score` 2004 /
 *      `cmi.student_data.mastery_score` 1.2) overrides the packaged passMark.
 *
 * Harness: full init() in jsdom with a mock LMS API (same pattern as
 * scorm2004.test.ts) — assertions on the rendered [data-nav-next] /
 * .el-submit-btn state and on SetValue side-effects.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── LMS API mocks (same shapes as scorm2004.test.ts) ─────────────────────────

function makeScorm2004Api(store: Record<string, string> = {}) {
  return {
    Initialize: vi.fn(() => 'true'),
    Terminate: vi.fn(() => 'true'),
    GetValue: vi.fn((key: string) => store[key] ?? ''),
    SetValue: vi.fn((key: string, value: string) => { store[key] = value; return 'true' }),
    Commit: vi.fn(() => 'true'),
    GetLastError: vi.fn(() => '0'),
  }
}

function makeScorm12Api(store: Record<string, string> = {}) {
  return {
    LMSInitialize: vi.fn(() => 'true'),
    LMSFinish: vi.fn(() => 'true'),
    LMSGetValue: vi.fn((key: string) => store[key] ?? ''),
    LMSSetValue: vi.fn((key: string, value: string) => { store[key] = value; return 'true' }),
    LMSCommit: vi.fn(() => 'true'),
    LMSGetLastError: vi.fn(() => '0'),
  }
}

// ─── Course fixtures ──────────────────────────────────────────────────────────

interface McScoring {
  weight: number
  attempts: number
  mandatory?: boolean
  requireCorrect?: boolean
}

function mcWidget(id: string, scoring: McScoring) {
  return {
    id,
    type: 'question-mc',
    bounds: { x: 10, y: 10, width: 400, height: 200 },
    layer: 1,
    properties: {},
    extendedProperties: {
      questionText: 'Pick B',
      options: [
        { id: 'o0', text: 'A', isCorrect: false },
        { id: 'o1', text: 'B', isCorrect: true },
      ],
      scoring,
      feedbackCorrect: 'Correct!',
      feedbackIncorrect: 'Incorrect. Try again.',
    },
  }
}

function navWidget(id: string) {
  return {
    id,
    type: 'nav-buttons',
    bounds: { x: 10, y: 600, width: 240, height: 50 },
    layer: 2,
    properties: {},
    extendedProperties: {},
  }
}

function doneWidget(id: string) {
  return {
    id,
    type: 'done-button',
    bounds: { x: 300, y: 600, width: 120, height: 50 },
    layer: 3,
    properties: {},
    extendedProperties: {},
  }
}

function makeCourse(opts: {
  scoring?: McScoring
  navigationMode?: 'free' | 'linear-strict'
  extraMc?: McScoring
  passingScore?: number
}) {
  const widgets: unknown[] = []
  if (opts.scoring) widgets.push(mcWidget('q1', opts.scoring))
  if (opts.extraMc) widgets.push(mcWidget('q2', opts.extraMc))
  widgets.push(navWidget('nav1'), doneWidget('done1'))
  return {
    _id: 'c1',
    title: 'TD-021 course',
    slides: [
      { id: 's1', title: 'S1', widgets },
      { id: 's2', title: 'S2', widgets: [] },
    ],
    settings: {
      width: 1024,
      height: 768,
      passingScore: opts.passingScore ?? 80,
      navigationMode: opts.navigationMode ?? 'linear-strict',
    },
    metadata: { identifier: 'TD021', version: '1.0' },
  }
}

// ─── DOM helpers ──────────────────────────────────────────────────────────────

let containerCounter = 0

async function mountPlayer(
  course: unknown,
  api?: { kind: '2004' | '1.2'; store: Record<string, string> },
) {
  // Clean any previous LMS globals
  // @ts-expect-error test cleanup
  delete window.API_1484_11
  // @ts-expect-error test cleanup
  delete window.API

  let lms: ReturnType<typeof makeScorm2004Api> | ReturnType<typeof makeScorm12Api> | null = null
  if (api?.kind === '2004') {
    lms = makeScorm2004Api(api.store)
    // @ts-expect-error injecting LMS mock
    window.API_1484_11 = lms
  } else if (api?.kind === '1.2') {
    lms = makeScorm12Api(api.store)
    // @ts-expect-error injecting LMS mock
    window.API = lms
  }

  const { init } = await import('../index')
  const container = document.createElement('div')
  container.id = `td021-container-${containerCounter++}`
  document.body.appendChild(container)
  // @ts-expect-error course fixture is structurally sufficient for init
  init(container.id, course)
  // Render sanity gate: if init bailed (seen once as a mystery null under
  // heavy parallel load in verify:test), fail HERE with a diagnosable message
  // instead of a downstream "expected null to be truthy".
  expect(
    container.querySelector('.el-slide'),
    `player did not render a slide — container innerHTML: ${container.innerHTML.slice(0, 200)}`,
  ).toBeTruthy()
  return { container, lms }
}

function submitAnswer(container: HTMLElement, widgetId: string, optionIndex: number): void {
  const radio = container.querySelector<HTMLInputElement>(
    `input[name="q-${widgetId}"][value="${optionIndex}"]`,
  )
  expect(radio, `radio q-${widgetId} value=${optionIndex}`).toBeTruthy()
  radio!.checked = true
  const submit = container.querySelector<HTMLButtonElement>(`#w-${widgetId} .el-submit-btn`)
  expect(submit, `submit btn for ${widgetId}`).toBeTruthy()
  submit!.click()
}

function nextBtn(container: HTMLElement): HTMLButtonElement {
  const btn = container.querySelector<HTMLButtonElement>('[data-nav-next]')
  expect(btn, 'nav-next button').toBeTruthy()
  return btn!
}

function submitBtn(container: HTMLElement, widgetId: string): HTMLButtonElement {
  return container.querySelector<HTMLButtonElement>(`#w-${widgetId} .el-submit-btn`)!
}

beforeEach(() => {
  document.body.innerHTML = ''
})

afterEach(() => {
  document.body.innerHTML = ''
  // @ts-expect-error test cleanup
  delete window.API_1484_11
  // @ts-expect-error test cleanup
  delete window.API
})

// ─── 1. requireCorrect gating ─────────────────────────────────────────────────

describe('TD-021 — requireCorrect gates Next on correctness (linear-strict)', () => {
  it('blocks Next while the question is unanswered', async () => {
    const { container } = await mountPlayer(
      makeCourse({ scoring: { weight: 100, attempts: -1, requireCorrect: true } }),
    )
    expect(nextBtn(container).disabled).toBe(true)
  })

  it('keeps Next blocked after a WRONG answer (attempts remaining)', async () => {
    const { container } = await mountPlayer(
      makeCourse({ scoring: { weight: 100, attempts: -1, requireCorrect: true } }),
    )
    submitAnswer(container, 'q1', 0) // wrong
    expect(nextBtn(container).disabled).toBe(true)
  })

  it('unblocks Next after a CORRECT answer', async () => {
    const { container } = await mountPlayer(
      makeCourse({ scoring: { weight: 100, attempts: -1, requireCorrect: true } }),
    )
    submitAnswer(container, 'q1', 1) // correct
    expect(nextBtn(container).disabled).toBe(false)
  })

  it('mandatory WITHOUT requireCorrect keeps the pre-TD-021 contract: any answer unblocks', async () => {
    const { container } = await mountPlayer(
      makeCourse({ scoring: { weight: 100, attempts: -1, mandatory: true } }),
    )
    expect(nextBtn(container).disabled).toBe(true)
    submitAnswer(container, 'q1', 0) // wrong — but answered
    expect(nextBtn(container).disabled).toBe(false)
  })

  it('requireCorrect is inert in free navigation mode', async () => {
    const { container } = await mountPlayer(
      makeCourse({
        scoring: { weight: 100, attempts: -1, requireCorrect: true },
        navigationMode: 'free',
      }),
    )
    expect(nextBtn(container).disabled).toBe(false)
  })
})

// ─── 2. Attempts enforcement ──────────────────────────────────────────────────

describe('TD-021 — attempts are enforced at the Submit button', () => {
  it('re-enables Submit after a wrong answer while attempts remain (attempts: 2)', async () => {
    const { container } = await mountPlayer(
      makeCourse({ scoring: { weight: 100, attempts: 2, requireCorrect: true } }),
    )
    submitAnswer(container, 'q1', 0) // wrong, 1 of 2 used
    expect(submitBtn(container, 'q1').disabled).toBe(false)
  })

  it('re-enables Submit after a wrong answer with unlimited attempts (-1)', async () => {
    const { container } = await mountPlayer(
      makeCourse({ scoring: { weight: 100, attempts: -1, requireCorrect: true } }),
    )
    submitAnswer(container, 'q1', 0)
    expect(submitBtn(container, 'q1').disabled).toBe(false)
  })

  it('disables Submit for good after a CORRECT answer', async () => {
    const { container } = await mountPlayer(
      makeCourse({ scoring: { weight: 100, attempts: -1, requireCorrect: true } }),
    )
    submitAnswer(container, 'q1', 1)
    expect(submitBtn(container, 'q1').disabled).toBe(true)
  })

  it('disables Submit once attempts are exhausted (attempts: 2, two wrong answers)', async () => {
    const { container } = await mountPlayer(
      makeCourse({ scoring: { weight: 100, attempts: 2, requireCorrect: true } }),
    )
    submitAnswer(container, 'q1', 0)
    submitAnswer(container, 'q1', 0)
    expect(submitBtn(container, 'q1').disabled).toBe(true)
  })
})

// ─── 3. Exhaustion unlocks navigation ─────────────────────────────────────────

describe('TD-021 — exhausted attempts unlock navigation (no trapped learners)', () => {
  it('unblocks Next after attempts are exhausted without a correct answer', async () => {
    const { container } = await mountPlayer(
      makeCourse({ scoring: { weight: 100, attempts: 2, requireCorrect: true } }),
    )
    submitAnswer(container, 'q1', 0)
    expect(nextBtn(container).disabled).toBe(true) // 1 of 2 — still gated
    submitAnswer(container, 'q1', 0)
    expect(nextBtn(container).disabled).toBe(false) // exhausted — unlocked
  })
})

// ─── 4. LMS mastery-threshold override ────────────────────────────────────────

describe('TD-021 — LMS-provided mastery threshold overrides packaged passMark', () => {
  it('SCORM 2004: cmi.scaled_passing_score (0..1) overrides passingScore', async () => {
    // Two questions, one answered right, one wrong → 50%. Packaged passMark 80
    // would fail; the LMS-provided 0.4 (=40%) must win → passed.
    const store: Record<string, string> = { 'cmi.scaled_passing_score': '0.4' }
    const { container, lms } = await mountPlayer(
      makeCourse({
        scoring: { weight: 100, attempts: 1, requireCorrect: false },
        extraMc: { weight: 100, attempts: 1 },
        navigationMode: 'free',
      }),
      { kind: '2004', store },
    )
    submitAnswer(container, 'q1', 1) // correct
    submitAnswer(container, 'q2', 0) // wrong
    container.querySelector<HTMLButtonElement>('[data-action="finish"]')!.click()
    expect(store['cmi.success_status']).toBe('passed')
    expect(lms).toBeTruthy()
  })

  it('SCORM 1.2: cmi.student_data.mastery_score (0..100) overrides passingScore', async () => {
    const store: Record<string, string> = { 'cmi.student_data.mastery_score': '40' }
    const { container } = await mountPlayer(
      makeCourse({
        scoring: { weight: 100, attempts: 1 },
        extraMc: { weight: 100, attempts: 1 },
        navigationMode: 'free',
      }),
      { kind: '1.2', store },
    )
    submitAnswer(container, 'q1', 1)
    submitAnswer(container, 'q2', 0)
    container.querySelector<HTMLButtonElement>('[data-action="finish"]')!.click()
    expect(store['cmi.core.lesson_status']).toBe('passed')
  })

  it('control: without an LMS threshold the packaged passMark (80) fails a 50% score', async () => {
    const store: Record<string, string> = {}
    const { container } = await mountPlayer(
      makeCourse({
        scoring: { weight: 100, attempts: 1 },
        extraMc: { weight: 100, attempts: 1 },
        navigationMode: 'free',
      }),
      { kind: '2004', store },
    )
    submitAnswer(container, 'q1', 1)
    submitAnswer(container, 'q2', 0)
    container.querySelector<HTMLButtonElement>('[data-action="finish"]')!.click()
    expect(store['cmi.success_status']).toBe('failed')
  })
})
