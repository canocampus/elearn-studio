/**
 * ELearn Studio Runtime Player — T017 / T022
 *
 * Vanilla TypeScript, compiled to IIFE (ELearnPlayer global) by Rollup.
 * No external frameworks. Runs inside LMS iframes.
 * Target: < 150KB gzipped.
 *
 * Entry point: ELearnPlayer.init(containerId, courseJson, options?)
 */

import {
  renderMatchItems, renderDragObjects, renderDropTarget,
  renderArrangeObjects, renderOrderText, renderHotspot,
} from './questions/renderers'
import {
  evalMatchItems, evalDragObjects, evalDropTarget,
  evalArrangeObjects, evalOrderText, evalHotspot,
  attachDragEvents, attachArrangeEvents, attachHotspotEvents,
} from './questions/handlers'
import {
  renderSimShell, mountSimPlayer,
  type SimConfig,
} from './sim/simPlayer'
import {
  mountPhaserSim,
  type PhaserSimConfig,
} from './widgets/phaserSimWidget'
import { saveSuspendData, restoreSuspendData } from './suspend'
import { EventDispatcher } from './actions/dispatcher'
import { createExecutionContext } from './actions/context'
import type {
  Bounds, BaseWidget, Slide, CourseSettings, CourseDoc,
  FillMatchType,
} from '@elearn-studio/shared-types'

/** Scoring config stored in extendedProperties.scoring for question widgets. */
interface QuestionScoringInfo {
  weight?: number
  attempts?: number
  mandatory?: boolean
}

// ─── SCORM APIs and adapter ───────────────────────────────────────────────────

interface SCORM12API {
  LMSInitialize(s: string): string
  LMSFinish(s: string): string
  LMSGetValue(element: string): string
  LMSSetValue(element: string, value: string): string
  LMSCommit(s: string): string
  LMSGetLastError(): string
}

interface SCORM2004API {
  Initialize(s: string): string
  Terminate(s: string): string
  GetValue(element: string): string
  SetValue(element: string, value: string): string
  Commit(s: string): string
  GetLastError(): string
}

/**
 * Normalised SCORM adapter — wraps either SCORM 1.2 or SCORM 2004 API behind
 * a single interface. Callers use version-agnostic methods; scormReport()
 * dispatches the correct CMI keys based on `version`.
 */
interface ScormAdapter {
  version: '1.2' | '2004'
  initialize(): void
  finish(): string
  getValue(key: string): string
  setValue(key: string, value: string): string
  commit(): void
}

/**
 * Traverse the window hierarchy looking for a SCORM API object.
 * Checks SCORM 2004 (`window.API_1484_11`) first, then SCORM 1.2 (`window.API`).
 * Returns null when neither is found.
 */
function createScormAdapter(win: Window): ScormAdapter | null {
  let w: Window | null = win
  let attempts = 0
  while (w && attempts < 10) {
    // SCORM 2004 4th Edition: window.API_1484_11
    // @ts-expect-error dynamic LMS global
    if (typeof w.API_1484_11 !== 'undefined') {
      // @ts-expect-error dynamic LMS global
      const raw = w.API_1484_11 as SCORM2004API
      return {
        version: '2004',
        initialize: () => { raw.Initialize('') },
        finish: () => raw.Terminate(''),
        getValue: (key) => raw.GetValue(key),
        setValue: (key, value) => raw.SetValue(key, value),
        commit: () => { raw.Commit('') },
      }
    }
    // SCORM 1.2: window.API
    // @ts-expect-error dynamic LMS global
    if (typeof w.API !== 'undefined') {
      // @ts-expect-error dynamic LMS global
      const raw = w.API as SCORM12API
      return {
        version: '1.2',
        initialize: () => { raw.LMSInitialize('') },
        finish: () => raw.LMSFinish(''),
        getValue: (key) => raw.LMSGetValue(key),
        setValue: (key, value) => raw.LMSSetValue(key, value),
        commit: () => { raw.LMSCommit('') },
      }
    }
    try {
      w = w.parent === w ? null : w.parent
    } catch {
      return null
    }
    attempts++
  }
  return null
}

// ─── Player state ─────────────────────────────────────────────────────────────

interface QuestionState {
  widgetId: string
  /** Partial credit score in range [0.0, 1.0]. Multiplied by weight for final scoring. */
  score: number
  weight: number
  answered: boolean
}

interface PlayerState {
  course: CourseDoc
  currentSlide: number
  questionStates: Map<string, QuestionState>
  scormApi: ScormAdapter | null
  container: HTMLElement
  passMark: number
  remediationVisited: boolean
  /** Cleanup callback from the currently-mounted sim player (cancels demo timers). */
  simCleanup: (() => void) | null
  /** Cleanup callbacks for any Phaser games on the current slide. */
  phaserCleanups: Array<() => void>
  /** Slide indices visited this session — used to calculate progress bar fill. */
  visitedSlides: Set<number>
  /** Actions engine event dispatcher — null until init() wires it up. */
  dispatcher: EventDispatcher | null
}

// ─── Global volume state (persists across slides, not stored in SCORM) ────────

/** Volume level 0.0–1.0. Module-level so it persists across slide navigations. */
let _globalVolume = 0.8
/** Whether audio is currently muted. */
let _globalMuted = false
/** Suppress repeated "no nav-next buttons" warning after the first occurrence. */
let _noNavNextWarned = false

// ─── Question evaluation (inlined from question-engine) ───────────────────────

function evalMC(props: Record<string, unknown>, chosen: number): { correct: boolean; feedback: string } {
  const options = props.options as string[]
  const correctIndex = props.correctIndex as number
  if (chosen < 0 || chosen >= options.length) {
    return { correct: false, feedback: 'No answer selected.' }
  }
  const correct = chosen === correctIndex
  return {
    correct,
    feedback: correct ? 'Correct!' : `Incorrect. The correct answer was: ${options[correctIndex]}`,
  }
}

function evalTF(props: Record<string, unknown>, answer: boolean | null): { correct: boolean; feedback: string } {
  if (answer === null) return { correct: false, feedback: 'No answer selected.' }
  const correct = answer === props.correctAnswer
  return {
    correct,
    feedback: correct ? 'Correct!' : `Incorrect. The correct answer was: ${props.correctAnswer ? 'True' : 'False'}`,
  }
}

function evalFill(props: Record<string, unknown>, answer: string): { correct: boolean; feedback: string } {
  const trimmed = answer.trim()
  if (!trimmed) return { correct: false, feedback: 'No answer provided.' }
  const expected = props.correctAnswer as string
  const matchType = (props.matchType as FillMatchType) ?? 'case-insensitive'
  let correct = false
  if (matchType === 'exact') {
    correct = trimmed === expected
  } else if (matchType === 'case-insensitive') {
    correct = trimmed.toLowerCase() === expected.toLowerCase()
  } else {
    try { correct = new RegExp(expected).test(trimmed) } catch { correct = trimmed === expected }
  }
  return {
    correct,
    feedback: correct ? 'Correct!' : `Incorrect. The expected answer was: ${expected}`,
  }
}

// ─── Widget renderers ─────────────────────────────────────────────────────────

function positionStyle(b: Bounds): string {
  return `position:absolute;left:${b.x}px;top:${b.y}px;width:${b.width}px;height:${b.height}px;`
}

/** Reads `ep[key]` as a number, falling back to `fallback` if absent or non-numeric. */
function numProp(ep: Record<string, unknown>, key: string, fallback: number): number {
  const v = ep[key]
  return typeof v === 'number' ? v : fallback
}

function renderText(w: BaseWidget): string {
  const html = (w.properties.html as string) ?? (w.properties.content as string) ?? ''
  const style = `${positionStyle(w.bounds)}overflow:hidden;box-sizing:border-box;`
  return `<div class="el-widget el-text" id="w-${w.id}" style="${style}">${html}</div>`
}

function renderImage(w: BaseWidget): string {
  const src = (w.properties.src as string) ?? ''
  const alt = (w.properties.alt as string) ?? ''
  const style = positionStyle(w.bounds)
  return `<div class="el-widget el-image" id="w-${w.id}" style="${style}"><img src="${escAttr(src)}" alt="${escAttr(alt)}" style="width:100%;height:100%;object-fit:contain;" /></div>`
}

function renderRectangle(w: BaseWidget): string {
  const bg = (w.properties.backgroundColor as string) ?? '#cccccc'
  const border = (w.properties.border as string) ?? 'none'
  const style = `${positionStyle(w.bounds)}background:${escCss(bg)};border:${escCss(border)};box-sizing:border-box;`
  return `<div class="el-widget el-rect" id="w-${w.id}" style="${style}"></div>`
}

function renderButton(w: BaseWidget): string {
  const label = (w.properties.label as string) ?? 'Button'
  const style = `${positionStyle(w.bounds)}cursor:pointer;`
  return `<button class="el-widget el-btn" id="w-${w.id}" data-widget-id="${w.id}" style="${style}">${escHtml(label)}</button>`
}

function renderNavButtons(w: BaseWidget): string {
  const style = positionStyle(w.bounds)
  return `<div class="el-widget el-nav" id="w-${w.id}" style="${style};display:flex;gap:8px;align-items:center;">
    <button class="el-nav-prev el-btn-nav" data-action="prev" style="flex:1;height:100%;cursor:pointer;">&#8592; Back</button>
    <button class="el-nav-next el-btn-nav" data-action="next" data-nav-next="true" style="flex:1;height:100%;cursor:pointer;">Next &#8594;</button>
  </div>`
}

function renderDoneButton(w: BaseWidget): string {
  const label = (w.properties.label as string) ?? 'Done'
  const style = `${positionStyle(w.bounds)}cursor:pointer;`
  return `<button class="el-widget el-done" id="w-${w.id}" data-action="finish" style="${style}">${escHtml(label)}</button>`
}

function renderSuspendButton(w: BaseWidget): string {
  const label = (w.properties.label as string) ?? 'Suspend Lesson'
  const style = `${positionStyle(w.bounds)}cursor:pointer;`
  return `<button class="el-widget el-suspend-btn" id="w-${w.id}" data-action="suspend" style="${style}">${escHtml(label)}</button>`
}

function renderScoreField(w: BaseWidget): string {
  const style = `${positionStyle(w.bounds)}display:flex;align-items:center;justify-content:center;font-size:1.2em;`
  return `<div class="el-widget el-score-field" id="w-${w.id}" style="${style}">Score: <span class="el-score-value">—</span></div>`
}

function renderScoreQuiz(w: BaseWidget): string {
  const style = `${positionStyle(w.bounds)}display:flex;align-items:center;justify-content:center;font-size:1.2em;`
  return `<div class="el-widget el-score-quiz" id="w-${w.id}" style="${style}">Quiz Score: <span class="el-quiz-score-value">—</span></div>`
}

function renderMediaPlayer(w: BaseWidget): string {
  const src = (w.properties.src as string) ?? ''
  const mime = (w.properties.mimeType as string) ?? ''
  const style = positionStyle(w.bounds)
  if (mime.startsWith('video/') || src.match(/\.(mp4|webm|ogg)$/i)) {
    return `<div class="el-widget el-media" id="w-${w.id}" style="${style}"><video src="${escAttr(src)}" controls style="width:100%;height:100%;"></video></div>`
  }
  if (mime.startsWith('audio/') || src.match(/\.(mp3|wav|ogg)$/i)) {
    return `<div class="el-widget el-media" id="w-${w.id}" style="${style};display:flex;align-items:center;"><audio src="${escAttr(src)}" controls style="width:100%;"></audio></div>`
  }
  return `<div class="el-widget el-media" id="w-${w.id}" style="${style}"><a href="${escAttr(src)}" target="_blank">[media]</a></div>`
}

function renderAudioNarration(w: BaseWidget): string {
  const src = (w.properties.src as string) ?? ''
  const ep = (w.extendedProperties as Record<string, unknown> | null) ?? {}
  const autoplay = ep.autoplay === true ? ' autoplay' : ''
  const controls = ep.controls !== false ? ' controls' : ''
  const style = positionStyle(w.bounds)
  if (!src) {
    return `<div class="el-widget el-audio-narration" id="w-${w.id}" style="${style}display:flex;align-items:center;justify-content:center;background:#0f172a;color:#94a3b8;font-size:13px;">
      <span>&#128266; No audio assigned</span>
    </div>`
  }
  return `<div class="el-widget el-audio-narration" id="w-${w.id}" style="${style}display:flex;align-items:center;background:#0f172a;padding:0 8px;box-sizing:border-box;">
    <audio src="${escAttr(src)}"${controls}${autoplay} style="width:100%;"></audio>
  </div>`
}

function renderProgressBar(w: BaseWidget): string {
  const ep = (w.extendedProperties as Record<string, unknown> | null) ?? {}
  const color = typeof ep.color === 'string' ? ep.color : '#4f46e5'
  const barHeight = typeof ep.height === 'number' ? ep.height : 12
  const showPercent = ep.showPercent !== false
  const style = `${positionStyle(w.bounds)}box-sizing:border-box;padding:0 8px;display:flex;flex-direction:column;justify-content:center;gap:4px;`
  const percentEl = showPercent
    ? `<div class="el-progress-percent" style="font-size:11px;color:#64748b;text-align:right;">0%</div>`
    : ''
  return `<div class="el-widget el-progress-bar" id="w-${w.id}" style="${style}">
    <div style="width:100%;background:#e2e8f0;border-radius:99px;overflow:hidden;">
      <div class="el-progress-bar-fill" style="width:0%;height:${barHeight}px;background:${escAttr(color)};border-radius:99px;transition:width 0.3s ease;"></div>
    </div>
    ${percentEl}
  </div>`
}

function renderVolumeControl(w: BaseWidget): string {
  const ep = (w.extendedProperties as Record<string, unknown> | null) ?? {}
  const defaultVolume = typeof ep.defaultVolume === 'number' ? ep.defaultVolume : 80
  const showMute = ep.showMute !== false
  const style = `${positionStyle(w.bounds)}display:flex;align-items:center;gap:8px;padding:0 8px;box-sizing:border-box;background:#1e293b;border-radius:6px;`
  const muteBtn = showMute
    ? `<button class="el-mute-btn" data-widget-id="${w.id}" style="background:none;border:none;cursor:pointer;color:#94a3b8;padding:2px;display:flex;align-items:center;" title="Toggle mute">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19" fill="currentColor" stroke="none"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
      </button>`
    : `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#94a3b8" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19" fill="#94a3b8" stroke="none"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`
  return `<div class="el-widget el-volume-control" id="w-${w.id}" data-widget-id="${w.id}" style="${style}">
    ${muteBtn}
    <input class="el-volume-slider" type="range" min="0" max="100" value="${defaultVolume}" data-widget-id="${w.id}" style="flex:1;cursor:pointer;accent-color:#4f46e5;" />
  </div>`
}

function renderMCQuestion(w: BaseWidget): string {
  const ep = w.extendedProperties
  const qText = (ep.questionText as string) ?? 'Question'
  const options = (ep.options as string[]) ?? []
  const style = `${positionStyle(w.bounds)}box-sizing:border-box;padding:12px;border:1px solid #ddd;border-radius:4px;`
  const opts = options.map((opt, i) =>
    `<label style="display:block;margin:4px 0;cursor:pointer;">
      <input type="radio" name="q-${w.id}" value="${i}" style="margin-right:6px;" />
      ${escHtml(opt)}
    </label>`
  ).join('')
  return `<div class="el-widget el-question el-question-mc" id="w-${w.id}" data-qtype="mc" data-widget-id="${w.id}" style="${style}">
    <p style="font-weight:bold;margin:0 0 8px;">${escHtml(qText)}</p>
    <div class="el-options">${opts}</div>
    <button class="el-submit-btn" data-widget-id="${w.id}" style="margin-top:8px;cursor:pointer;">Submit</button>
    <div class="el-feedback" style="margin-top:6px;font-style:italic;"></div>
  </div>`
}

function renderTFQuestion(w: BaseWidget): string {
  const ep = w.extendedProperties
  const qText = (ep.questionText as string) ?? 'Question'
  const style = `${positionStyle(w.bounds)}box-sizing:border-box;padding:12px;border:1px solid #ddd;border-radius:4px;`
  return `<div class="el-widget el-question el-question-tf" id="w-${w.id}" data-qtype="tf" data-widget-id="${w.id}" style="${style}">
    <p style="font-weight:bold;margin:0 0 8px;">${escHtml(qText)}</p>
    <div class="el-options">
      <label style="display:block;margin:4px 0;cursor:pointer;">
        <input type="radio" name="q-${w.id}" value="true" style="margin-right:6px;" />True
      </label>
      <label style="display:block;margin:4px 0;cursor:pointer;">
        <input type="radio" name="q-${w.id}" value="false" style="margin-right:6px;" />False
      </label>
    </div>
    <button class="el-submit-btn" data-widget-id="${w.id}" style="margin-top:8px;cursor:pointer;">Submit</button>
    <div class="el-feedback" style="margin-top:6px;font-style:italic;"></div>
  </div>`
}

function renderFillQuestion(w: BaseWidget): string {
  const ep = w.extendedProperties
  const qText = (ep.questionText as string) ?? 'Question'
  const style = `${positionStyle(w.bounds)}box-sizing:border-box;padding:12px;border:1px solid #ddd;border-radius:4px;`
  return `<div class="el-widget el-question el-question-fill" id="w-${w.id}" data-qtype="fill" data-widget-id="${w.id}" style="${style}">
    <p style="font-weight:bold;margin:0 0 8px;">${escHtml(qText)}</p>
    <input type="text" class="el-fill-input" placeholder="Type your answer…" style="width:100%;box-sizing:border-box;padding:4px;" />
    <button class="el-submit-btn" data-widget-id="${w.id}" style="margin-top:8px;cursor:pointer;">Submit</button>
    <div class="el-feedback" style="margin-top:6px;font-style:italic;"></div>
  </div>`
}

function renderScreenshotSim(w: BaseWidget): string {
  const style = `${positionStyle(w.bounds)}overflow:hidden;background:#000;display:flex;flex-direction:column;`
  return `<div class="el-widget el-sim-player" id="w-${w.id}" data-widget-id="${w.id}" style="${style}">${renderSimShell()}</div>`
}

function renderPhaserSim(w: BaseWidget): string {
  const ep = w.extendedProperties
  const width = numProp(ep, 'width', w.bounds.width)
  const height = numProp(ep, 'height', w.bounds.height)
  const style = `${positionStyle(w.bounds)}overflow:hidden;background:#1a1a2e;`
  return `<div class="el-widget el-phaser-sim" id="w-${w.id}" data-widget-id="${w.id}" data-phaser-width="${width}" data-phaser-height="${height}" style="${style}"></div>`
}

function renderWidget(w: BaseWidget): string {
  let html: string
  switch (w.type) {
    case 'text':         html = renderText(w);          break
    case 'image':        html = renderImage(w);         break
    case 'rectangle':    html = renderRectangle(w);     break
    case 'button':       html = renderButton(w);        break
    case 'nav-buttons':  html = renderNavButtons(w);    break
    case 'done-button':     html = renderDoneButton(w);     break
    case 'suspend-button':  html = renderSuspendButton(w);  break
    case 'score-field':  html = renderScoreField(w);    break
    case 'score-quiz':   html = renderScoreQuiz(w);     break
    case 'media-player':     html = renderMediaPlayer(w);     break
    case 'audio-narration':  html = renderAudioNarration(w);  break
    case 'progress-bar':     html = renderProgressBar(w);     break
    case 'volume-control':   html = renderVolumeControl(w);   break
    case 'question-mc':     html = renderMCQuestion(w);    break
    case 'question-tf':     html = renderTFQuestion(w);    break
    case 'question-fill':   html = renderFillQuestion(w);  break
    case 'question-match':  html = renderMatchItems(w);    break
    case 'question-drag':   html = renderDragObjects(w);   break
    case 'question-drop':   html = renderDropTarget(w);    break
    case 'question-arrange':html = renderArrangeObjects(w);break
    case 'question-order':  html = renderOrderText(w);     break
    case 'question-hotspot':   html = renderHotspot(w);         break
    case 'screenshot-sim':     html = renderScreenshotSim(w);   break
    case 'phaser-sim':         html = renderPhaserSim(w);       break
    default: return ''
  }
  // Widgets with visible:false are rendered hidden so show/hide actions can operate on them.
  // Inject display:none and data-hidden into the outer element's style attribute.
  if (!w.visible) {
    html = html
      .replace(`id="w-${w.id}"`, `id="w-${w.id}" data-hidden="true"`)
      .replace(/style="/, 'style="display:none;')
  }
  return html
}

// ─── Slide asset prefetching (T042.3) ─────────────────────────────────────────

/**
 * Returns true for safe http(s) URLs that may be prefetched.
 * Rejects data:, javascript:, and other non-http schemes.
 */
function isSafeUrl(url: string): boolean {
  return /^https?:\/\//i.test(url)
}

/**
 * Prefetch image and video-poster assets for the next `count` slides so they
 * are in the browser cache before the learner navigates to them.
 * Only http(s) URLs are prefetched; data: and javascript: URIs are skipped.
 */
function prefetchSlideAssets(slides: Slide[], fromIndex: number, count = 2): void {
  // count is bounded by the caller (default 2); guard here as well
  const limit = Math.min(count, 3)
  for (let i = fromIndex + 1; i <= fromIndex + limit && i < slides.length; i++) {
    for (const w of slides[i]!.widgets) {
      const src = (w.properties.src as string | undefined)
        ?? (w.properties.poster as string | undefined)
      if (src && isSafeUrl(src)) {
        const img = new Image()
        img.src = src
      }
    }
  }
}

// ─── Slide rendering ──────────────────────────────────────────────────────────

function renderSlide(slide: Slide, settings: CourseSettings): string {
  const sorted = [...slide.widgets].sort((a, b) => a.layer - b.layer)
  const widgets = sorted.map(renderWidget).join('')
  return `<div class="el-slide" style="position:relative;width:${settings.width}px;height:${settings.height}px;overflow:hidden;background:#fff;">${widgets}</div>`
}

// ─── SCORM reporting ──────────────────────────────────────────────────────────

function scormReport(state: PlayerState, status: 'passed' | 'failed' | 'incomplete'): void {
  const api = state.scormApi
  if (!api) return

  const { questionStates, course } = state
  const results = Array.from(questionStates.values())
  const total = results.length
  let score = 0
  if (total > 0) {
    const totalWeight = results.reduce((s, r) => s + r.weight, 0)
    const weightedSum = results.reduce((s, r) => s + r.score * r.weight, 0)
    score = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) : 0
  }

  const passMark = course.metadata?.masteryScore ?? course.settings?.passingScore ?? state.passMark
  const slideIndex = state.currentSlide

  if (api.version === '2004') {
    // SCORM 2004: separate completion_status and success_status; score fields under cmi.score.*
    const completionStatus = status === 'incomplete' ? 'incomplete' : 'completed'
    const successStatus = status === 'incomplete' ? 'unknown' : (score >= passMark ? 'passed' : 'failed')
    api.setValue('cmi.score.raw', String(score))
    api.setValue('cmi.score.min', '0')
    api.setValue('cmi.score.max', '100') // always 100 per SCORM 2004 spec; mastery threshold is set via adlcp:completionThreshold in the manifest
    api.setValue('cmi.score.scaled', (score / 100).toFixed(7))
    api.setValue('cmi.completion_status', completionStatus)
    api.setValue('cmi.success_status', successStatus)
    api.setValue('cmi.location', String(slideIndex))
  } else {
    // SCORM 1.2: single lesson_status; score fields under cmi.core.*
    const lessonStatus = status === 'incomplete' ? 'incomplete' : (score >= passMark ? 'passed' : 'failed')
    api.setValue('cmi.core.score.raw', String(score))
    api.setValue('cmi.core.score.min', '0')
    api.setValue('cmi.core.score.max', '100')
    api.setValue('cmi.core.lesson_status', lessonStatus)
    api.setValue('cmi.core.lesson_location', String(slideIndex))
  }
  api.commit()
}

// ─── Navigation ───────────────────────────────────────────────────────────────

function goToSlide(state: PlayerState, index: number): void {
  // Fire exitSlide for widgets on the slide we're leaving
  if (state.dispatcher) {
    const leavingSlide = state.course.slides[state.currentSlide]
    if (leavingSlide) {
      state.dispatcher.fireSlideEvent(
        'exitSlide',
        leavingSlide.widgets.map(w => ({ widgetId: w.id, sequences: w.actions })),
      )
    }
    state.dispatcher.teardown()
  }

  // Cancel any running demo timer from the previous slide's sim player
  state.simCleanup?.()
  state.simCleanup = null

  // Destroy any Phaser games from the previous slide
  for (const cleanup of state.phaserCleanups) {
    cleanup()
  }
  state.phaserCleanups = []

  const { course, container } = state
  if (index < 0 || index >= course.slides.length) return
  state.currentSlide = index
  state.visitedSlides.add(index)
  const slide = course.slides[index]
  container.innerHTML = renderSlide(slide, course.settings)

  // Wire interactive events for advanced widget types
  for (const w of slide.widgets) {
    if (!w.visible) continue
    const el = container.querySelector<HTMLElement>(`#w-${w.id}`)
    if (!el) continue
    if (w.type === 'question-drag' || w.type === 'question-drop') {
      attachDragEvents(el)
    } else if (w.type === 'question-arrange') {
      attachArrangeEvents(el, '.el-arrange-item')
    } else if (w.type === 'question-order') {
      attachArrangeEvents(el, '.el-order-item')
    } else if (w.type === 'question-hotspot') {
      attachHotspotEvents(el, w.extendedProperties)
    } else if (w.type === 'screenshot-sim') {
      const simConfig = (w.extendedProperties as { simConfig?: SimConfig }).simConfig
      if (simConfig) {
        state.simCleanup = mountSimPlayer(el, simConfig, {
          onComplete: () => goNext(state),
          onScore: (widgetId, score, weight) => {
            state.questionStates.set(widgetId, { widgetId, score, weight, answered: true })
            updateScoreDisplays(state)
            scormReport(state, 'incomplete')
          },
        })
      }
    } else if (w.type === 'phaser-sim') {
      const ep = w.extendedProperties
      const phaserConfig: PhaserSimConfig = {
        widgetId: w.id,
        simType: (ep.simType as string) ?? 'process-flow',
        mode: (ep.mode as string) ?? 'demo',
        passingScore: (ep.passingScore as number) ?? 70,
        sceneDef: (ep.sceneDef as Record<string, unknown> | null) ?? null,
        width: numProp(ep, 'width', w.bounds.width),
        height: numProp(ep, 'height', w.bounds.height),
      }
      // Mount asynchronously — dynamic import keeps Phaser out of main bundle
      mountPhaserSim(el, phaserConfig).then(cleanup => {
        state.phaserCleanups.push(cleanup)
      }).catch(err => {
        console.error(`[ELearnPlayer] Failed to mount phaser-sim ${w.id}:`, err)
      })
    } else if (w.type === 'volume-control') {
      const ep = (w.extendedProperties as Record<string, unknown> | null) ?? {}
      const defaultVolume = typeof ep.defaultVolume === 'number' ? ep.defaultVolume : 80
      // On the very first slide, seed global volume from the widget's default
      if (state.visitedSlides.size === 1) {
        _globalVolume = defaultVolume / 100
        _globalMuted = false
      }
      const slider = el.querySelector<HTMLInputElement>('.el-volume-slider')
      if (slider) {
        slider.value = String(Math.round(_globalVolume * 100))
        slider.addEventListener('input', () => {
          _globalVolume = Number(slider.value) / 100
          _globalMuted = false
          applyVolumeToSlide(container)
          const muteBtn = el.querySelector<HTMLElement>('.el-mute-btn')
          if (muteBtn) updateMuteBtnIcon(muteBtn, false)
        })
      }
      const muteBtn = el.querySelector<HTMLButtonElement>('.el-mute-btn')
      if (muteBtn) {
        updateMuteBtnIcon(muteBtn, _globalMuted)
        muteBtn.addEventListener('click', () => {
          _globalMuted = !_globalMuted
          applyVolumeToSlide(container)
          if (slider) slider.value = String(_globalMuted ? 0 : Math.round(_globalVolume * 100))
          updateMuteBtnIcon(muteBtn, _globalMuted)
        })
      }
    }
  }

  updateScoreDisplays(state)
  updateProgressBars(state)
  updateNavButtons(state)
  applyVolumeToSlide(container)
  scormReport(state, 'incomplete')

  // Wire actions engine: attach widget event listeners, then fire enterSlide
  if (state.dispatcher) {
    for (const w of slide.widgets) {
      if (!w.visible || !w.actions?.length) continue
      const el = container.querySelector<HTMLElement>(`#w-${w.id}`)
      if (el) state.dispatcher.attachWidget(el, w.id, w.actions)
    }
    state.dispatcher.fireSlideEvent(
      'enterSlide',
      slide.widgets.map(w => ({ widgetId: w.id, sequences: w.actions })),
    )
  }

  // Prefetch assets for the next 2 slides (T042.3)
  prefetchSlideAssets(course.slides, index)
}

/**
 * Returns true if the learner may leave the given slide.
 * In 'linear-strict' mode, all questions with scoring.mandatory === true must be answered.
 * In 'free' mode (or when no navigationMode is set), always returns true.
 *
 * Note: a widget absent from questionStates means it has never been submitted.
 * // Missing entry means unanswered; answered must be explicitly true.
 * Note: mandatory is persisted in MongoDB as part of extendedProperties.scoring —
 * absent field (undefined) is treated as false (non-mandatory), matching the authoring default.
 */
function slideIsComplete(state: PlayerState, slideIndex: number): boolean {
  if (state.course.settings?.navigationMode !== 'linear-strict') return true
  const slide = state.course.slides[slideIndex]
  if (!slide) return true
  for (const widget of slide.widgets) {
    const scoring = (widget.extendedProperties?.scoring as QuestionScoringInfo | undefined)
    if (scoring?.mandatory) {
      const qs = state.questionStates.get(widget.id)
      if (!qs?.answered) return false
    }
  }
  return true
}

/** Update the disabled state of all Next nav buttons based on slideIsComplete. */
function updateNavButtons(state: PlayerState): void {
  const complete = slideIsComplete(state, state.currentSlide)
  const buttons = state.container.querySelectorAll<HTMLButtonElement>('[data-nav-next]')
  if (buttons.length === 0 && state.course.settings?.navigationMode === 'linear-strict' && !_noNavNextWarned) {
    console.warn('[ELearnPlayer] No nav-next buttons found on slide — mandatory question gating disabled.')
    _noNavNextWarned = true
  }
  buttons.forEach(btn => {
    btn.disabled = !complete
    btn.style.opacity = complete ? '' : '0.4'
    btn.style.cursor = complete ? 'pointer' : 'not-allowed'
  })
}

function goNext(state: PlayerState): void {
  // Defensive check: also enforced in updateNavButtons() but re-verify at action time
  if (!slideIsComplete(state, state.currentSlide)) return
  if (state.currentSlide < state.course.slides.length - 1) {
    goToSlide(state, state.currentSlide + 1)
  }
}

function goPrev(state: PlayerState): void {
  if (state.currentSlide > 0) {
    goToSlide(state, state.currentSlide - 1)
  }
}

function finishCourse(state: PlayerState): void {
  // If requireAllSlides is active, ensure every slide has been visited before finishing.
  if (state.course.settings?.requireAllSlides) {
    const totalSlides = state.course.slides.length
    for (let i = 0; i < totalSlides; i++) {
      if (!state.visitedSlides.has(i)) {
        // Find the first unvisited slide (lowest index) and navigate there instead of finishing
        try {
          goToSlide(state, i)
        } catch (err) {
          console.error('[ELearnPlayer] finishCourse: failed to navigate to unvisited slide', i, err)
        }
        return
      }
    }
  }

  const score = calculateCurrentScore(state)
  const passMark = state.course.metadata?.masteryScore ?? state.course.settings?.passingScore ?? state.passMark
  const passed = score >= passMark

  scormReport(state, passed ? 'passed' : 'failed')

  if (!passed && !state.remediationVisited) {
    const remediationId = state.course.settings?.remediationSlideId
    if (remediationId) {
      const idx = state.course.slides.findIndex(s => s.id === remediationId)
      if (idx >= 0) {
        state.remediationVisited = true
        goToSlide(state, idx)
        return
      }
    }
  }

  const api = state.scormApi
  if (api) {
    const ok = api.finish()
    if (ok !== 'true') console.warn('[ELearnPlayer] finish() returned false — LMS may not have recorded session end.')
  }
}

function suspendLesson(state: PlayerState): void {
  // Persist question scores + current slide index, then end the session as incomplete
  scormReport(state, 'incomplete')
  const saved = saveSuspendData(state, state.scormApi)
  if (!saved && state.scormApi) {
    console.warn('[ELearnPlayer] Session state could not be saved — progress may be lost on resume.')
  }
  const api = state.scormApi
  if (api) {
    const ok = api.finish()
    if (ok !== 'true') console.warn('[ELearnPlayer] finish() returned false — LMS may not have recorded session end.')
  }
}

// ─── Score display helpers ────────────────────────────────────────────────────

function calculateCurrentScore(state: PlayerState): number {
  const results = Array.from(state.questionStates.values())
  if (results.length === 0) return 0
  const totalWeight = results.reduce((s, r) => s + r.weight, 0)
  const weightedSum = results.reduce((s, r) => s + r.score * r.weight, 0)
  return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) : 0
}

function updateScoreDisplays(state: PlayerState): void {
  const score = calculateCurrentScore(state)
  state.container.querySelectorAll<HTMLElement>('.el-score-value, .el-quiz-score-value').forEach(el => {
    el.textContent = `${score}%`
  })
}

function updateProgressBars(state: PlayerState): void {
  const total = state.course.slides.length
  if (total === 0) return
  const pct = Math.round((state.visitedSlides.size / total) * 100)
  state.container.querySelectorAll<HTMLElement>('.el-progress-bar-fill').forEach(fill => {
    fill.style.width = `${pct}%`
    const percent = fill.closest('.el-progress-bar')?.querySelector<HTMLElement>('.el-progress-percent')
    if (percent) percent.textContent = `${pct}%`
  })
}

/** Update the mute button SVG icon to reflect current mute state. */
function updateMuteBtnIcon(btn: HTMLElement, muted: boolean): void {
  btn.innerHTML = muted
    ? `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19" fill="currentColor" stroke="none"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`
    : `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19" fill="currentColor" stroke="none"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`
}

/** Apply the current global volume to all audio/video elements in the container. */
function applyVolumeToSlide(container: HTMLElement): void {
  const vol = _globalMuted ? 0 : _globalVolume
  container.querySelectorAll<HTMLMediaElement>('audio, video').forEach(el => {
    el.volume = vol
    el.muted = _globalMuted
  })
}

// ─── Question submission handler ──────────────────────────────────────────────

function handleSubmit(state: PlayerState, widgetId: string): void {
  const slideWidgets = state.course.slides[state.currentSlide]?.widgets ?? []
  const widget = slideWidgets.find(w => w.id === widgetId)
  if (!widget) return

  const widgetEl = state.container.querySelector<HTMLElement>(`#w-${widgetId}`)
  if (!widgetEl) return

  const feedbackEl = widgetEl.querySelector<HTMLElement>('.el-feedback')
  const ep = widget.extendedProperties
  const scoring = (ep.scoring as QuestionScoringInfo) ?? {}
  const weight = scoring.weight ?? 100

  let correct = false
  let score = 0
  let feedback = ''

  if (widget.type === 'question-mc') {
    const selected = widgetEl.querySelector<HTMLInputElement>('input[type=radio]:checked')
    const chosen = selected ? parseInt(selected.value, 10) : -1
    const result = evalMC(ep, chosen)
    correct = result.correct; score = correct ? 1 : 0; feedback = result.feedback
  } else if (widget.type === 'question-tf') {
    const selected = widgetEl.querySelector<HTMLInputElement>('input[type=radio]:checked')
    const answer = selected ? selected.value === 'true' : null
    const result = evalTF(ep, answer)
    correct = result.correct; score = correct ? 1 : 0; feedback = result.feedback
  } else if (widget.type === 'question-fill') {
    const input = widgetEl.querySelector<HTMLInputElement>('.el-fill-input')
    const answer = input?.value ?? ''
    const result = evalFill(ep, answer)
    correct = result.correct; score = correct ? 1 : 0; feedback = result.feedback
  } else if (widget.type === 'question-match') {
    const r = evalMatchItems(ep, widgetEl)
    correct = r.correct; score = r.score; feedback = r.feedback
  } else if (widget.type === 'question-drag') {
    const r = evalDragObjects(ep, widgetEl)
    correct = r.correct; score = r.score; feedback = r.feedback
  } else if (widget.type === 'question-drop') {
    const r = evalDropTarget(ep, widgetEl)
    correct = r.correct; score = r.score; feedback = r.feedback
  } else if (widget.type === 'question-arrange') {
    const r = evalArrangeObjects(ep, widgetEl)
    correct = r.correct; score = r.score; feedback = r.feedback
  } else if (widget.type === 'question-order') {
    const r = evalOrderText(ep, widgetEl)
    correct = r.correct; score = r.score; feedback = r.feedback
  } else if (widget.type === 'question-hotspot') {
    const r = evalHotspot(ep, widgetEl)
    correct = r.correct; score = r.score; feedback = r.feedback
  }

  // Save result
  state.questionStates.set(widgetId, {
    widgetId,
    score,
    weight,
    answered: true,
  })

  // Show feedback
  if (feedbackEl) {
    feedbackEl.textContent = feedback
    feedbackEl.style.color = correct ? 'green' : 'red'
  }

  // Disable submit after answering
  const submitBtn = widgetEl.querySelector<HTMLButtonElement>('.el-submit-btn')
  if (submitBtn) submitBtn.disabled = true

  updateScoreDisplays(state)
  updateNavButtons(state)
  scormReport(state, 'incomplete')

  // Fire question lifecycle events for authored action sequences
  if (state.dispatcher && widget.actions?.length) {
    state.dispatcher.fireWidgetEvent(widgetId, 'questionAnswered', widget.actions)
    if (correct) {
      state.dispatcher.fireWidgetEvent(widgetId, 'questionCorrect', widget.actions)
    } else {
      state.dispatcher.fireWidgetEvent(widgetId, 'questionIncorrect', widget.actions)
    }
  }
}

// ─── Event delegation ─────────────────────────────────────────────────────────

function attachEvents(state: PlayerState): void {
  // T035 — SCORM bridge for Phaser sim score events.
  // Phaser sims dispatch 'elearn:widgetScore' on window when complete.
  window.addEventListener('elearn:widgetScore', (e: Event) => {
    const detail = (e as CustomEvent<{ widgetId: string; score: number }>).detail
    if (!detail?.widgetId) return
    // Find the widget to get its passingScore for weight calculation
    const slide = state.course.slides[state.currentSlide]
    const widget = slide?.widgets.find(w => w.id === detail.widgetId)
    const ep = widget?.extendedProperties ?? {}
    const passingScore = (ep.passingScore as number | undefined) ?? 70
    // Guard against NaN/Infinity before clamping (buggy sim could dispatch non-finite value)
    const rawScore = typeof detail.score === 'number' && isFinite(detail.score) ? detail.score : 0
    // Weight defaults to passingScore so a perfect phaser sim scores 100%
    state.questionStates.set(detail.widgetId, {
      widgetId: detail.widgetId,
      score: Math.min(1, Math.max(0, rawScore)),
      weight: passingScore,
      answered: true,
    })
    updateScoreDisplays(state)
    updateNavButtons(state)
    scormReport(state, 'incomplete')
  })

  state.container.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    const btn = target.closest<HTMLElement>('[data-action]')
    if (btn) {
      const action = btn.dataset.action
      if (action === 'next') goNext(state)
      else if (action === 'prev') goPrev(state)
      else if (action === 'finish') finishCourse(state)
      else if (action === 'suspend') suspendLesson(state)
      return
    }
    const submitBtn = target.closest<HTMLElement>('.el-submit-btn')
    if (submitBtn) {
      const widgetId = submitBtn.dataset.widgetId
      if (widgetId) handleSubmit(state, widgetId)
    }
  })

  // keyboard navigation — scoped to container to avoid capturing keys from other widgets
  state.container.setAttribute('tabindex', '0')
  state.container.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'PageDown') goNext(state)
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') goPrev(state)
  })
}

// ─── Sanitisation helpers ─────────────────────────────────────────────────────

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function escAttr(s: string): string {
  return s.replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function escCss(s: string): string {
  // Strict allowlist: alphanumeric, space, #, -, _ , . only
  // Excludes ( ) % / to prevent url() and calc() CSS injection
  return s.replace(/[^a-zA-Z0-9 #\-_.]/g, '')
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface PlayerOptions {
  startSlide?: number
  passMark?: number
}

/**
 * Initialise the runtime player.
 *
 * @param containerId  ID of the DOM element to render into
 * @param courseJson   Serialised CourseDoc (JSON string or object)
 * @param options      Optional configuration overrides
 */
function init(
  containerId: string,
  courseJson: string | CourseDoc,
  options: PlayerOptions = {},
): void {
  const container = document.getElementById(containerId)
  if (!container) {
    console.error(`[ELearnPlayer] Container #${containerId} not found.`)
    return
  }

  let course: CourseDoc
  try {
    course = typeof courseJson === 'string' ? JSON.parse(courseJson) : courseJson
  } catch {
    container.innerHTML = '<p style="color:red;padding:20px;">Course data is invalid.</p>'
    return
  }

  if (!course.slides || course.slides.length === 0) {
    container.innerHTML = '<p>No slides found.</p>'
    return
  }

  const scormApi = createScormAdapter(window)
  if (scormApi) scormApi.initialize()

  const state: PlayerState = {
    course,
    currentSlide: options.startSlide ?? 0,
    questionStates: new Map(),
    scormApi,
    container,
    passMark: options.passMark ?? 80,
    remediationVisited: false,
    simCleanup: null,
    phaserCleanups: [],
    visitedSlides: new Set<number>(),
    dispatcher: null,
  }

  // Build the ExecutionContext that bridges the actions engine to player internals
  const scormBridge = scormApi
    ? {
        getValue: (key: string) => scormApi.getValue(key),
        setValue: (key: string, value: string) => { scormApi.setValue(key, value) },
        commit: () => { scormApi.commit() },
        finish: () => { scormApi.finish() },
      }
    : null

  const ctx = createExecutionContext({
    container,
    scorm: scormBridge,
    sharedSequences: course.sharedSequences ?? [],
    navigation: {
      goToIndex: (i) => { goToSlide(state, i) },
      getCurrentIndex: () => state.currentSlide,
      getSlideCount: () => course.slides.length,
      getSlides: () => course.slides.map(s => ({ id: s.id, title: s.title })),
    },
    scoring: {
      scoreQuestion: (widgetId) => { handleSubmit(state, widgetId) },
      scoreQuiz: () => { finishCourse(state) },
      getCurrentScore: () => calculateCurrentScore(state),
    },
    getWidget: (widgetId) => {
      const slide = course.slides[state.currentSlide]
      const w = slide?.widgets.find(x => x.id === widgetId)
      if (!w) return undefined
      return {
        id: w.id,
        type: w.type,
        el: container.querySelector<HTMLElement>(`#w-${w.id}`),
        extendedProperties: w.extendedProperties,
      }
    },
  })

  state.dispatcher = new EventDispatcher(ctx)

  // Attempt to restore full suspend state (slide + question scores) from cmi.suspend_data.
  // Falls back to the version-appropriate location key if no suspend_data is present.
  if (scormApi) {
    const restored = restoreSuspendData(state, scormApi, course.slides.length)
    if (!restored) {
      // Legacy fallback: restore slide location only (no full suspend_data available)
      const locationKey = scormApi.version === '2004' ? 'cmi.location' : 'cmi.core.lesson_location'
      const loc = scormApi.getValue(locationKey)
      if (loc) {
        const idx = parseInt(loc, 10)
        if (!isNaN(idx) && idx >= 0 && idx < course.slides.length) {
          state.currentSlide = idx
          // Seed visitedSlides to approximate prior-session progress.
          // In linear-strict mode, slides are visited in order, so [0..idx] is safe.
          // In free mode, the learner may have jumped non-sequentially; we can only
          // guarantee the restored slide itself was visited — seeding more would be wrong
          // and could incorrectly allow requireAllSlides gate to pass.
          if (course.settings?.navigationMode === 'linear-strict') {
            for (let i = 0; i <= idx; i++) {
              state.visitedSlides.add(i)
            }
          } else {
            state.visitedSlides.add(idx)
          }
        }
      }
    }
  }

  // Flush any live Phaser games when the LMS navigates away from the iframe.
  // Without this, re-initialising the player in the same window without a page
  // reload could accumulate stale Phaser instances (T035-M01).
  window.addEventListener('beforeunload', () => {
    state.simCleanup?.()
    state.simCleanup = null
    for (const cleanup of state.phaserCleanups) {
      cleanup()
    }
    state.phaserCleanups = []
  }, { once: true })

  attachEvents(state)
  goToSlide(state, state.currentSlide)
}

// Expose on global ELearnPlayer (IIFE name)
export { init }
