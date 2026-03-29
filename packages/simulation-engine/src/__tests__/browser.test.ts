/**
 * T604 — Unit Tests: simulation-engine recorder core
 * T604.1 — startRecording(): verify chromium launch with correct flags
 * T604.2 — stopRecording(): verify page and browser close are called
 * T604.3 — CAPTURE_SCRIPT content: verify selectors/event hooks are present
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Hoisted mocks (vi.hoisted runs before vi.mock factories) ─────────────────

const { mockPage, mockContext, mockBrowser, chromiumLaunch } = vi.hoisted(() => {
  const mockPage = {
    evaluate:   vi.fn().mockResolvedValue([]),
    screenshot: vi.fn().mockResolvedValue(Buffer.alloc(100, 0xff)),
    goto:       vi.fn().mockResolvedValue(undefined),
    on:         vi.fn(),
  }
  const mockContext = {
    addInitScript: vi.fn().mockResolvedValue(undefined),
    newPage:       vi.fn().mockResolvedValue(mockPage),
  }
  const mockBrowser = {
    newContext: vi.fn().mockResolvedValue(mockContext),
    close:      vi.fn().mockResolvedValue(undefined),
  }
  const chromiumLaunch = vi.fn().mockResolvedValue(mockBrowser)
  return { mockPage, mockContext, mockBrowser, chromiumLaunch }
})

vi.mock('@playwright/test', () => ({
  chromium: { launch: chromiumLaunch },
}))

vi.mock('../storage/s3', () => ({
  putObject:       vi.fn().mockResolvedValue(undefined),
  getObjectBuffer: vi.fn(),
  getObjectJson:   vi.fn(),
  listObjects:     vi.fn().mockResolvedValue([]),
  checkStorage:    vi.fn().mockResolvedValue(undefined),
}))

// ── Import after mocks ────────────────────────────────────────────────────────

import { startRecording, stopRecording, activeBrowserCount } from '../recorder/browser'
import { getSession } from '../recorder/sessions'
import { CAPTURE_SCRIPT } from '../recorder/captureScript'

// ── T604.1 — startRecording() ─────────────────────────────────────────────────

describe('T604.1 — startRecording()', () => {
  let sessionId: string

  beforeEach(() => {
    vi.clearAllMocks()
    mockPage.evaluate.mockResolvedValue([])
    mockPage.screenshot.mockResolvedValue(Buffer.alloc(100, 0xff))
    mockPage.goto.mockResolvedValue(undefined)
    mockBrowser.close.mockResolvedValue(undefined)
    mockBrowser.newContext.mockResolvedValue(mockContext)
    mockContext.newPage.mockResolvedValue(mockPage)
    chromiumLaunch.mockResolvedValue(mockBrowser)
  })

  afterEach(async () => {
    if (sessionId) {
      try { await stopRecording(sessionId) } catch { /* ignore */ }
      sessionId = ''
    }
  })

  it('launches Chromium with --no-sandbox and --disable-dev-shm-usage flags', async () => {
    const session = await startRecording('https://example.com')
    sessionId = session.id

    expect(chromiumLaunch).toHaveBeenCalledWith(
      expect.objectContaining({
        args: expect.arrayContaining(['--no-sandbox', '--disable-dev-shm-usage']),
      }),
    )
  })

  it('creates a browser context with 1280×720 viewport', async () => {
    const session = await startRecording('https://example.com')
    sessionId = session.id

    expect(mockBrowser.newContext).toHaveBeenCalledWith(
      expect.objectContaining({
        viewport: { width: 1280, height: 720 },
      }),
    )
  })

  it('injects CAPTURE_SCRIPT via addInitScript before navigation', async () => {
    const session = await startRecording('https://example.com')
    sessionId = session.id

    expect(mockContext.addInitScript).toHaveBeenCalledWith(CAPTURE_SCRIPT)
  })

  it('navigates to the provided URL with domcontentloaded', async () => {
    const session = await startRecording('https://example.com/app')
    sessionId = session.id

    expect(mockPage.goto).toHaveBeenCalledWith(
      'https://example.com/app',
      expect.objectContaining({ waitUntil: 'domcontentloaded' }),
    )
  })

  it('returns an ActiveSession with the correct url and initial navigate step', async () => {
    const session = await startRecording('https://example.com', 'My App')
    sessionId = session.id

    expect(session.url).toBe('https://example.com')
    expect(session.id).toBeTruthy()
    expect(session.steps.length).toBeGreaterThanOrEqual(1)
    expect(session.steps[0].description).toContain('Navigate to')
  })

  it('stores the session in the sessions map', async () => {
    const session = await startRecording('https://example.com')
    sessionId = session.id

    expect(getSession(session.id)).toBeDefined()
    expect(getSession(session.id)?.id).toBe(session.id)
  })

  it('increments activeBrowserCount after start', async () => {
    const before = activeBrowserCount()
    const session = await startRecording('https://example.com')
    sessionId = session.id

    expect(activeBrowserCount()).toBeGreaterThan(before)
  })
})

// ── T604.2 — stopRecording() ──────────────────────────────────────────────────

describe('T604.2 — stopRecording()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPage.evaluate.mockResolvedValue([])
    mockPage.screenshot.mockResolvedValue(Buffer.alloc(100, 0xff))
    mockPage.goto.mockResolvedValue(undefined)
    mockBrowser.close.mockResolvedValue(undefined)
    mockBrowser.newContext.mockResolvedValue(mockContext)
    mockContext.newPage.mockResolvedValue(mockPage)
    chromiumLaunch.mockResolvedValue(mockBrowser)
  })

  it('calls browser.close() when stopping', async () => {
    const session = await startRecording('https://example.com')
    await stopRecording(session.id)

    expect(mockBrowser.close).toHaveBeenCalled()
  })

  it('returns the completed session with a steps array', async () => {
    const session = await startRecording('https://example.com')
    const completed = await stopRecording(session.id)

    expect(completed.id).toBe(session.id)
    expect(Array.isArray(completed.steps)).toBe(true)
  })

  it('removes the session from the sessions store after stop', async () => {
    const session = await startRecording('https://example.com')
    await stopRecording(session.id)

    expect(getSession(session.id)).toBeUndefined()
  })

  it('decrements activeBrowserCount after stop', async () => {
    const session = await startRecording('https://example.com')
    const before = activeBrowserCount()
    await stopRecording(session.id)

    expect(activeBrowserCount()).toBeLessThan(before)
  })

  it('throws "Session not found" for an unknown session id', async () => {
    await expect(stopRecording('non-existent-session-id')).rejects.toThrow('Session not found')
  })
})

// ── T604.3 — CAPTURE_SCRIPT content ──────────────────────────────────────────

describe('T604.3 — CAPTURE_SCRIPT content', () => {
  it('is a non-empty string', () => {
    expect(typeof CAPTURE_SCRIPT).toBe('string')
    expect(CAPTURE_SCRIPT.length).toBeGreaterThan(100)
  })

  it('initialises __elearnCapture with empty events array on window', () => {
    expect(CAPTURE_SCRIPT).toContain('__elearnCapture')
    expect(CAPTURE_SCRIPT).toContain('events: []')
  })

  it('contains a buildSelector function', () => {
    expect(CAPTURE_SCRIPT).toContain('buildSelector')
  })

  it('prefers #id selector strategy', () => {
    expect(CAPTURE_SCRIPT).toContain('el.id')
    expect(CAPTURE_SCRIPT).toContain("'#'")
  })

  it('falls back to data-testid attribute', () => {
    expect(CAPTURE_SCRIPT).toContain('data-testid')
  })

  it('falls back to aria-label attribute', () => {
    expect(CAPTURE_SCRIPT).toContain('aria-label')
  })

  it('captures click events with addEventListener', () => {
    expect(CAPTURE_SCRIPT).toContain("'click'")
    expect(CAPTURE_SCRIPT).toContain("addEventListener('click'")
  })

  it('captures dblclick events with addEventListener', () => {
    expect(CAPTURE_SCRIPT).toContain("'dblclick'")
    expect(CAPTURE_SCRIPT).toContain("addEventListener('dblclick'")
  })

  it('captures keydown for Tab, Enter, and Escape navigation keys', () => {
    expect(CAPTURE_SCRIPT).toContain("addEventListener('keydown'")
    expect(CAPTURE_SCRIPT).toContain("'Tab'")
    expect(CAPTURE_SCRIPT).toContain("'Enter'")
    expect(CAPTURE_SCRIPT).toContain("'Escape'")
  })

  it('captures text input events with debouncing via setTimeout', () => {
    expect(CAPTURE_SCRIPT).toContain("addEventListener('input'")
    expect(CAPTURE_SCRIPT).toContain('setTimeout')
  })

  it('captures select/change events for <select> elements', () => {
    expect(CAPTURE_SCRIPT).toContain("addEventListener('change'")
    expect(CAPTURE_SCRIPT).toContain("'SELECT'")
  })

  it('guards against double injection on SPA navigation', () => {
    expect(CAPTURE_SCRIPT).toContain('if (window.__elearnCapture) return')
  })

  it('captures rightclick events (button === 2)', () => {
    expect(CAPTURE_SCRIPT).toContain('rightclick')
    expect(CAPTURE_SCRIPT).toContain('e.button === 2')
  })

  it('extracts visible text via extractText helper (innerText / textContent / value)', () => {
    expect(CAPTURE_SCRIPT).toContain('extractText')
    expect(CAPTURE_SCRIPT).toContain('innerText')
  })
})
