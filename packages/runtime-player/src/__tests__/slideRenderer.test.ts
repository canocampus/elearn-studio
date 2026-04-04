/**
 * T605.4 — slide-renderer: HTML output verification
 * T605.5 — navigation: Next/Prev button and keyboard navigation
 *
 * renderSlide() and goToSlide() are not exported directly; we test them
 * via the public init() API and inspect the resulting DOM state.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { init } from '../index'

// Prevent dynamic phaser-bundle.js import from failing in jsdom
vi.mock('../widgets/phaserSimWidget', () => ({
  mountPhaserSim: vi.fn().mockResolvedValue(() => { /* no-op cleanup */ }),
}))

// Prevent restoreSuspendData from attempting SCORM reads during init
vi.mock('../suspend', () => ({
  saveSuspendData: vi.fn().mockReturnValue(true),
  restoreSuspendData: vi.fn().mockReturnValue(false),
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeApi() {
  return {
    LMSInitialize: vi.fn().mockReturnValue('true'),
    LMSFinish: vi.fn().mockReturnValue('true'),
    LMSGetValue: vi.fn().mockReturnValue(''),
    LMSSetValue: vi.fn().mockReturnValue('true'),
    LMSCommit: vi.fn().mockReturnValue('true'),
    LMSGetLastError: vi.fn().mockReturnValue('0'),
  }
}

function makeWidget(overrides: Record<string, unknown> = {}) {
  return {
    id: 'w1',
    type: 'text',
    bounds: { x: 10, y: 20, width: 300, height: 50 },
    layer: 1,
    visible: true,
    properties: { html: '<p>Hello</p>' },
    extendedProperties: {},
    actions: [],
    ...overrides,
  }
}

function makeCourse(slides: unknown[]) {
  return {
    _id: 'c1',
    title: 'Test Course',
    slides,
    settings: { width: 1024, height: 768, passingScore: 80 },
    metadata: { masteryScore: 80 },
  }
}

// ─── T605.4 — Slide renderer HTML output ─────────────────────────────────────

describe('T605.4 — renderSlide() HTML output', () => {
  let container: HTMLElement

  beforeEach(() => {
    container = document.createElement('div')
    container.id = 'renderer-test'
    document.body.appendChild(container)
    ;(window as unknown as Record<string, unknown>).API = makeApi()
  })

  afterEach(() => {
    container.remove()
    delete (window as unknown as Record<string, unknown>).API
  })

  it('renders .el-slide wrapper with configured dimensions', () => {
    init('renderer-test', makeCourse([
      { id: 's1', title: 'Slide 1', widgets: [] },
    ]))

    const slide = container.querySelector('.el-slide')
    expect(slide).toBeTruthy()
    expect((slide as HTMLElement).style.width).toBe('1024px')
    expect((slide as HTMLElement).style.height).toBe('768px')
  })

  it('renders a text widget with el-text class and content HTML', () => {
    init('renderer-test', makeCourse([
      {
        id: 's1', title: 'Slide 1',
        widgets: [makeWidget({ id: 'w-txt', type: 'text', properties: { html: '<p>Hello World</p>' } })],
      },
    ]))

    const el = container.querySelector('#w-w-txt')
    expect(el).toBeTruthy()
    expect(el!.classList.contains('el-text')).toBe(true)
    expect(el!.innerHTML).toContain('Hello World')
  })

  it('renders an image widget with el-image class and <img> tag', () => {
    init('renderer-test', makeCourse([
      {
        id: 's1', title: 'Slide 1',
        widgets: [makeWidget({ id: 'w-img', type: 'image', properties: { src: 'https://example.com/img.png', alt: 'Alt text' } })],
      },
    ]))

    const el = container.querySelector('#w-w-img')
    expect(el).toBeTruthy()
    expect(el!.classList.contains('el-image')).toBe(true)
    const img = el!.querySelector('img')
    expect(img).toBeTruthy()
    expect(img!.getAttribute('src')).toBe('https://example.com/img.png')
    expect(img!.getAttribute('alt')).toBe('Alt text')
  })

  it('renders a button widget with el-btn class and label text', () => {
    init('renderer-test', makeCourse([
      {
        id: 's1', title: 'Slide 1',
        widgets: [makeWidget({ id: 'w-btn', type: 'button', properties: { label: 'Click Me' } })],
      },
    ]))

    const el = container.querySelector('#w-w-btn')
    expect(el).toBeTruthy()
    expect(el!.classList.contains('el-btn')).toBe(true)
    expect(el!.textContent).toBe('Click Me')
  })

  it('renders a rectangle widget with background color style', () => {
    init('renderer-test', makeCourse([
      {
        id: 's1', title: 'Slide 1',
        widgets: [makeWidget({ id: 'w-rect', type: 'rectangle', properties: { backgroundColor: '#ff0000' } })],
      },
    ]))

    const el = container.querySelector('#w-w-rect') as HTMLElement
    expect(el).toBeTruthy()
    expect(el.classList.contains('el-rect')).toBe(true)
    // jsdom normalises CSS colors; check the raw style attribute instead
    expect(el.getAttribute('style')).toContain('ff0000')
  })

  it('renders nav-buttons widget with Prev and Next buttons', () => {
    init('renderer-test', makeCourse([
      {
        id: 's1', title: 'Slide 1',
        widgets: [makeWidget({ id: 'w-nav', type: 'nav-buttons', properties: {} })],
      },
    ]))

    const el = container.querySelector('#w-w-nav')
    expect(el).toBeTruthy()
    expect(el!.classList.contains('el-nav')).toBe(true)
    const prevBtn = el!.querySelector('[data-action="prev"]')
    const nextBtn = el!.querySelector('[data-action="next"]')
    expect(prevBtn).toBeTruthy()
    expect(nextBtn).toBeTruthy()
  })

  it('applies absolute positioning from widget bounds', () => {
    init('renderer-test', makeCourse([
      {
        id: 's1', title: 'Slide 1',
        widgets: [makeWidget({ id: 'w-pos', bounds: { x: 50, y: 100, width: 200, height: 80 } })],
      },
    ]))

    const el = container.querySelector('#w-w-pos') as HTMLElement
    expect(el.style.position).toBe('absolute')
    expect(el.style.left).toBe('50px')
    expect(el.style.top).toBe('100px')
    expect(el.style.width).toBe('200px')
    expect(el.style.height).toBe('80px')
  })

  it('renders invisible widgets hidden so show/hide actions can operate on them (visible: false)', () => {
    init('renderer-test', makeCourse([
      {
        id: 's1', title: 'Slide 1',
        widgets: [makeWidget({ id: 'w-hidden', type: 'text', visible: false })],
      },
    ]))

    const el = container.querySelector<HTMLElement>('#w-w-hidden')
    expect(el).not.toBeNull()
    // Must start with display:none and data-hidden so show() action can restore it
    expect(el!.style.display).toBe('none')
    expect(el!.getAttribute('data-hidden')).toBe('true')
  })

  it('renders multiple widgets in z-index layer order', () => {
    init('renderer-test', makeCourse([
      {
        id: 's1', title: 'Slide 1',
        widgets: [
          makeWidget({ id: 'w-top', type: 'text', layer: 3, properties: { html: 'Top' } }),
          makeWidget({ id: 'w-bot', type: 'text', layer: 1, properties: { html: 'Bottom' } }),
          makeWidget({ id: 'w-mid', type: 'text', layer: 2, properties: { html: 'Mid' } }),
        ],
      },
    ]))

    const widgets = container.querySelectorAll('.el-text')
    expect(widgets.length).toBe(3)
    // Bottom (layer 1) should come first in DOM order after sorting
    expect(widgets[0]!.id).toBe('w-w-bot')
    expect(widgets[1]!.id).toBe('w-w-mid')
    expect(widgets[2]!.id).toBe('w-w-top')
  })

  it('renders MC question widget with options and submit button', () => {
    init('renderer-test', makeCourse([
      {
        id: 's1', title: 'Slide 1',
        widgets: [makeWidget({
          id: 'w-mc', type: 'question-mc',
          extendedProperties: {
            questionText: 'Pick one',
            options: ['A', 'B', 'C'],
            correctIndex: 0,
            scoring: { weight: 100, attempts: -1 },
          },
        })],
      },
    ]))

    const el = container.querySelector('#w-w-mc')
    expect(el).toBeTruthy()
    expect(el!.classList.contains('el-question-mc')).toBe(true)
    expect(el!.textContent).toContain('Pick one')
    expect(el!.textContent).toContain('A')
    expect(el!.textContent).toContain('B')
    expect(el!.querySelectorAll('input[type=radio]').length).toBe(3)
    expect(el!.querySelector('.el-submit-btn')).toBeTruthy()
  })

  it('renders TF question widget with True/False radio buttons', () => {
    init('renderer-test', makeCourse([
      {
        id: 's1', title: 'Slide 1',
        widgets: [makeWidget({
          id: 'w-tf', type: 'question-tf',
          extendedProperties: {
            questionText: 'Is this true?',
            correctAnswer: true,
            scoring: { weight: 100, attempts: 1 },
          },
        })],
      },
    ]))

    const el = container.querySelector('#w-w-tf')
    expect(el).toBeTruthy()
    expect(el!.classList.contains('el-question-tf')).toBe(true)
    const radioInputs = el!.querySelectorAll('input[type=radio]')
    expect(radioInputs.length).toBe(2)
    const values = Array.from(radioInputs).map(r => (r as HTMLInputElement).value)
    expect(values).toContain('true')
    expect(values).toContain('false')
  })

  it('renders Fill question widget with text input', () => {
    init('renderer-test', makeCourse([
      {
        id: 's1', title: 'Slide 1',
        widgets: [makeWidget({
          id: 'w-fill', type: 'question-fill',
          extendedProperties: {
            questionText: 'What is 2+2?',
            correctAnswer: '4',
            matchType: 'exact',
            scoring: { weight: 100, attempts: -1 },
          },
        })],
      },
    ]))

    const el = container.querySelector('#w-w-fill')
    expect(el).toBeTruthy()
    expect(el!.classList.contains('el-question-fill')).toBe(true)
    expect(el!.querySelector('input[type=text]')).toBeTruthy()
  })

  it('shows "No slides found." when course has no slides', () => {
    init('renderer-test', makeCourse([]))
    expect(container.textContent).toContain('No slides found.')
  })

  it('shows error message when courseJson is invalid JSON string', () => {
    init('renderer-test', '{ invalid json }')
    expect(container.textContent).toContain('invalid')
  })
})

// ─── T605.5 — Navigation via buttons and keyboard ─────────────────────────────

describe('T605.5 — navigation: Next/Prev buttons and keyboard', () => {
  let container: HTMLElement

  beforeEach(() => {
    container = document.createElement('div')
    container.id = 'nav-test'
    document.body.appendChild(container)
    ;(window as unknown as Record<string, unknown>).API = makeApi()
  })

  afterEach(() => {
    container.remove()
    delete (window as unknown as Record<string, unknown>).API
  })

  function makeTwoSlide() {
    return makeCourse([
      {
        id: 's1', title: 'Slide 1',
        widgets: [
          makeWidget({ id: 'w-nav1', type: 'nav-buttons', properties: {} }),
          makeWidget({ id: 'w-label1', type: 'text', properties: { html: '<p>Slide One</p>' } }),
        ],
      },
      {
        id: 's2', title: 'Slide 2',
        widgets: [
          makeWidget({ id: 'w-nav2', type: 'nav-buttons', properties: {} }),
          makeWidget({ id: 'w-label2', type: 'text', properties: { html: '<p>Slide Two</p>' } }),
        ],
      },
    ])
  }

  it('starts on slide 1 and renders its content', () => {
    init('nav-test', makeTwoSlide())
    expect(container.textContent).toContain('Slide One')
    expect(container.textContent).not.toContain('Slide Two')
  })

  it('clicking Next button advances to slide 2', () => {
    init('nav-test', makeTwoSlide())

    const nextBtn = container.querySelector<HTMLElement>('[data-action="next"]')
    expect(nextBtn).toBeTruthy()
    nextBtn!.click()

    expect(container.textContent).toContain('Slide Two')
    expect(container.textContent).not.toContain('Slide One')
  })

  it('clicking Prev button on slide 2 goes back to slide 1', () => {
    init('nav-test', makeTwoSlide())

    // Advance to slide 2
    container.querySelector<HTMLElement>('[data-action="next"]')!.click()
    expect(container.textContent).toContain('Slide Two')

    // Go back
    container.querySelector<HTMLElement>('[data-action="prev"]')!.click()
    expect(container.textContent).toContain('Slide One')
  })

  it('does not go before slide 1 when clicking Prev on first slide', () => {
    init('nav-test', makeTwoSlide())
    // Already on slide 1; clicking Prev should be a no-op
    container.querySelector<HTMLElement>('[data-action="prev"]')!.click()
    expect(container.textContent).toContain('Slide One')
  })

  it('does not advance past last slide when clicking Next on last slide', () => {
    init('nav-test', makeTwoSlide())
    // Advance to slide 2 (last slide)
    container.querySelector<HTMLElement>('[data-action="next"]')!.click()
    expect(container.textContent).toContain('Slide Two')

    // Try to go further — should stay on slide 2
    container.querySelector<HTMLElement>('[data-action="next"]')!.click()
    expect(container.textContent).toContain('Slide Two')
  })

  it('ArrowRight key advances to next slide', () => {
    init('nav-test', makeTwoSlide())
    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(container.textContent).toContain('Slide Two')
  })

  it('ArrowLeft key goes to previous slide', () => {
    init('nav-test', makeTwoSlide())
    // Go to slide 2 first
    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(container.textContent).toContain('Slide Two')
    // Go back
    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
    expect(container.textContent).toContain('Slide One')
  })

  it('PageDown key advances to next slide', () => {
    init('nav-test', makeTwoSlide())
    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true }))
    expect(container.textContent).toContain('Slide Two')
  })

  it('PageUp key goes to previous slide', () => {
    init('nav-test', makeTwoSlide())
    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageUp', bubbles: true }))
    expect(container.textContent).toContain('Slide One')
  })

  it('startSlide option skips to specified slide index', () => {
    init('nav-test', makeTwoSlide(), { startSlide: 1 })
    expect(container.textContent).toContain('Slide Two')
  })

  it('SCORM reports lesson_status as passed when Done clicked and score meets pass mark', () => {
    const api = makeApi()
    ;(window as unknown as Record<string, unknown>).API = api

    const course = makeCourse([
      {
        id: 's1', title: 'Slide 1',
        widgets: [
          makeWidget({ id: 'w-done', type: 'done-button', properties: { label: 'Done' } }),
        ],
      },
    ])
    // No questions — score is 0, but passMark is also overridden to 0 via options
    ;(course.settings as Record<string, unknown>).passingScore = 0
    ;(course.metadata as Record<string, unknown>).masteryScore = 0

    init('nav-test', course)
    api.LMSSetValue.mockClear()

    const doneBtn = container.querySelector<HTMLElement>('[data-action="finish"]')
    expect(doneBtn).toBeTruthy()
    doneBtn!.click()

    expect(api.LMSSetValue).toHaveBeenCalledWith('cmi.core.lesson_status', 'passed')
  })
})
