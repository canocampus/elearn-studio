import { chromium, Browser, Page } from '@playwright/test'
import { randomUUID } from 'crypto'
import { config } from '../config'
import { putObject } from '../storage/s3'
import { CAPTURE_SCRIPT } from './captureScript'
import { generateStepName } from './naming'
import {
  createSession,
  getSession,
  removeSession,
  appendStep,
} from './sessions'
import type { ActiveSession, CapturedEvent, SimStep } from './types'

/** Typed map entry — eliminates `as any` casts (L-02). */
interface BrowserEntry {
  browser:       Browser
  page:          Page
  timer:         NodeJS.Timeout
  timeoutHandle: NodeJS.Timeout
  /** C-01: stored here so stopRecording() can clear it. */
  debounceHandle: NodeJS.Timeout | null
}

/** Map of sessionId → Playwright browser+page instances. */
const browsers = new Map<string, BrowserEntry>()

/** S3 key for a step screenshot. */
function screenshotKey(sessionId: string, stepOrder: number): string {
  return `recordings/${sessionId}/screenshots/step-${String(stepOrder).padStart(4, '0')}.png`
}

/** M-03: Maximum screenshot size (10MB). Prevents storage exhaustion from large renders. */
const MAX_SCREENSHOT_SIZE = 10 * 1024 * 1024 // 10MB

/**
 * Validate screenshot size. Throws if screenshot exceeds the limit.
 */
function validateScreenshotSize(screenshot: Buffer): void {
  if (screenshot.length > MAX_SCREENSHOT_SIZE) {
    throw new Error(
      `Screenshot too large: ${Math.round(screenshot.length / 1024 / 1024)}MB exceeds 10MB limit`
    )
  }
}

/** Flush captured events from the page and return them. */
async function flushEvents(page: Page): Promise<CapturedEvent[]> {
  try {
    return await page.evaluate(() => {
      const cap = (window as Window & { __elearnCapture?: { events: unknown[] } }).__elearnCapture
      if (!cap) return []
      const events = [...cap.events]
      cap.events = []
      return events
    }) as CapturedEvent[]
  } catch {
    // Page may have navigated away; swallow the error
    return []
  }
}

/** Convert a list of captured events into SimSteps (one step per event). */
async function eventsToSteps(
  sessionId: string,
  events: CapturedEvent[],
  screenshot: Buffer,
  startOrder: number,
): Promise<SimStep[]> {
  // M-03: validate screenshot size before uploading
  validateScreenshotSize(screenshot)

  const steps: SimStep[] = []
  // All events in this batch share the same screenshot
  const key = screenshotKey(sessionId, startOrder)
  await putObject(key, screenshot, 'image/png')

  for (const ev of events) {
    const step: SimStep = {
      id:          randomUUID(),
      order:       startOrder + steps.length,
      eventType:   ev.type,
      selector:    ev.selector,
      targetText:  ev.targetText,
      coordinates: ev.x != null && ev.y != null ? { x: ev.x, y: ev.y } : undefined,
      value:       ev.value,
      key:         ev.key,
      screenshotKey: key,
      description: generateStepName(ev),
      timestamp:   ev.timestamp,
    }
    steps.push(step)
  }
  return steps
}

/**
 * Start a new recording session: launch Chromium, navigate, begin auto-capturing events.
 * Returns the new ActiveSession.
 */
export async function startRecording(
  url: string,
  title?: string,
): Promise<ActiveSession> {
  const sessionId = randomUUID()
  const session   = createSession(sessionId, url, title ?? new URL(url).hostname)

  const browser = await chromium.launch({
    headless: config.recorder.headless,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'eLearnStudio-Recorder/1.0',
  })

  await context.addInitScript(CAPTURE_SCRIPT)

  const page = await context.newPage()

  // Capture failed navigations (e.g. 404)
  page.on('pageerror', (err) => {
    // L-01: log only first 8 chars of sessionId
    console.warn(`[Recorder] page error in session ${sessionId.slice(0, 8)}:`, err.message)
  })

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })

  // Take initial screenshot (navigate step)
  const initScreenshot = await page.screenshot({ type: 'png', fullPage: false })
  // M-03: validate screenshot size before uploading
  validateScreenshotSize(initScreenshot)
  const initKey        = screenshotKey(sessionId, 0)
  await putObject(initKey, initScreenshot, 'image/png')
  appendStep(session, {
    id:            randomUUID(),
    order:         0,
    eventType:     'click',
    selector:      'body',
    description:   `Navigate to ${url}`,
    screenshotKey: initKey,
    timestamp:     session.startedAt,
  })

  // ── Auto-capture polling loop ──────────────────────────────────────────────
  // C-03: accumulate events across poll cycles so debounce captures all of them.
  let pendingEvents: CapturedEvent[] = []

  const timer = setInterval(async () => {
    const entry = browsers.get(sessionId)
    if (!entry || !getSession(sessionId)) {
      clearInterval(timer)
      return
    }

    const events = await flushEvents(page)
    if (events.length === 0) return

    // C-03: accumulate — do not discard events from earlier cycles
    pendingEvents = [...pendingEvents, ...events]

    // Debounce: wait a bit after last event before capturing screenshot
    if (entry.debounceHandle) clearTimeout(entry.debounceHandle)
    entry.debounceHandle = setTimeout(async () => {
      const currentEntry = browsers.get(sessionId)
      if (currentEntry) currentEntry.debounceHandle = null

      // H-03: re-fetch session — may have been removed by stopRecording()
      const activeSession = getSession(sessionId)
      if (!activeSession) return

      // C-03: consume and clear accumulated events at screenshot time
      const eventsToProcess = pendingEvents
      pendingEvents = []

      try {
        const screenshot = await page.screenshot({ type: 'png', fullPage: false })
        const startOrder = activeSession.steps.length
        const newSteps   = await eventsToSteps(sessionId, eventsToProcess, screenshot, startOrder)
        for (const step of newSteps) {
          appendStep(activeSession, step)
        }
      } catch (err) {
        console.warn(`[Recorder] auto-capture failed for ${sessionId.slice(0, 8)}:`, err)
      }
    }, config.recorder.debounceMs)
  }, config.recorder.pollIntervalMs)

  // Session timeout safeguard
  const timeoutHandle = setTimeout(() => {
    console.warn(`[Recorder] session ${sessionId.slice(0, 8)} timed out`)
    void stopRecording(sessionId)
  }, config.recorder.timeoutMs)

  browsers.set(sessionId, { browser, page, timer, timeoutHandle, debounceHandle: null })

  return session
}

/**
 * Manually trigger a capture step: flush any buffered events and take a screenshot.
 * Returns newly appended steps.
 */
export async function manualCapture(sessionId: string): Promise<SimStep[]> {
  const session = getSession(sessionId)
  if (!session) throw new Error(`Session not found: ${sessionId}`)

  const browserEntry = browsers.get(sessionId)
  if (!browserEntry) throw new Error(`Browser not found for session: ${sessionId}`)

  const { page } = browserEntry
  const events     = await flushEvents(page)
  const screenshot = await page.screenshot({ type: 'png', fullPage: false })
  // M-03: validate screenshot size before uploading
  validateScreenshotSize(screenshot)
  const startOrder = session.steps.length

  if (events.length === 0) {
    // Still create a screenshot step even with no events (user requested it)
    const key = screenshotKey(sessionId, startOrder)
    await putObject(key, screenshot, 'image/png')
    const step: SimStep = {
      id:            randomUUID(),
      order:         startOrder,
      eventType:     'click',
      selector:      'body',
      description:   'Manual capture',
      screenshotKey: key,
      timestamp:     new Date().toISOString(),
    }
    appendStep(session, step)
    return [step]
  }

  const newSteps = await eventsToSteps(sessionId, events, screenshot, startOrder)
  for (const step of newSteps) {
    appendStep(session, step)
  }
  return newSteps
}

/**
 * Get the current page screenshot without creating a step.
 * Used by the live preview endpoint.
 */
export async function getLiveScreenshot(sessionId: string): Promise<Buffer> {
  const browserEntry = browsers.get(sessionId)
  if (!browserEntry) throw new Error(`Browser not found for session: ${sessionId}`)
  return browserEntry.page.screenshot({ type: 'jpeg', quality: 70, fullPage: false })
}

/**
 * Stop a recording: flush remaining events, close the browser, return the completed session.
 */
export async function stopRecording(sessionId: string): Promise<ActiveSession> {
  const session = getSession(sessionId)
  if (!session) throw new Error(`Session not found: ${sessionId}`)

  const browserEntry = browsers.get(sessionId)
  try {
    if (browserEntry) {
      clearInterval(browserEntry.timer)
      clearTimeout(browserEntry.timeoutHandle)
      // C-01: clear pending debounce so it cannot fire after browser is closed
      if (browserEntry.debounceHandle) clearTimeout(browserEntry.debounceHandle)
      try {
        // Final flush before closing
        const events = await flushEvents(browserEntry.page)
        if (events.length > 0) {
          const screenshot = await browserEntry.page.screenshot({ type: 'png', fullPage: false })
          const newSteps   = await eventsToSteps(sessionId, events, screenshot, session.steps.length)
          for (const step of newSteps) appendStep(session, step)
        }
      } catch {
        // Best-effort final flush; ignore errors on close
      }
      try {
        await browserEntry.browser.close()
      } catch {
        // Ignore close errors
      }
    }
  } finally {
    // M-02: always delete from Map, even if an error is thrown above
    browsers.delete(sessionId)
  }

  removeSession(sessionId)
  return session
}

/** Stop all active recording sessions. Used during graceful shutdown (H-04). */
export async function stopAllRecordings(): Promise<void> {
  const sessionIds = [...browsers.keys()]
  await Promise.allSettled(sessionIds.map(id => stopRecording(id)))
}

/** Count of currently running browser sessions. */
export function activeBrowserCount(): number {
  return browsers.size
}
