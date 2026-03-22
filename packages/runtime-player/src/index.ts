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
import { saveSuspendData, restoreSuspendData } from './suspend'

// ─── Embedded types (mirror authoring-ui/types) ───────────────────────────────

interface Bounds { x: number; y: number; width: number; height: number }

interface BaseWidget {
  id: string
  type: string
  bounds: Bounds
  layer: number
  visible: boolean
  properties: Record<string, unknown>
  extendedProperties: Record<string, unknown>
  actions: Array<{ event: string; actions: unknown[] }>
}

interface Slide {
  id: string
  title: string
  widgets: BaseWidget[]
}

interface CourseSettings {
  width: number
  height: number
  passingScore: number
  remediationSlideId?: string
}

interface SCORMMetadata {
  identifier?: string
  masteryScore: number
}

interface CourseDoc {
  _id: string
  title: string
  slides: Slide[]
  settings: CourseSettings
  metadata: SCORMMetadata
}

// ─── Question inline types ────────────────────────────────────────────────────

type FillMatchType = 'exact' | 'regex' | 'case-insensitive'

// ─── SCORM 1.2 API ────────────────────────────────────────────────────────────

interface SCORM12API {
  LMSInitialize(s: string): string
  LMSFinish(s: string): string
  LMSGetValue(element: string): string
  LMSSetValue(element: string, value: string): string
  LMSCommit(s: string): string
  LMSGetLastError(): string
}

function findScormApi(win: Window): SCORM12API | null {
  let w: Window | null = win
  let attempts = 0
  while (w && attempts < 10) {
    // @ts-expect-error dynamic LMS global
    if (typeof w.API !== 'undefined') return w.API as SCORM12API
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
  scormApi: SCORM12API | null
  container: HTMLElement
  passMark: number
  remediationVisited: boolean
  /** Cleanup callback from the currently-mounted sim player (cancels demo timers). */
  simCleanup: (() => void) | null
}

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
    <button class="el-nav-next el-btn-nav" data-action="next" style="flex:1;height:100%;cursor:pointer;">Next &#8594;</button>
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

function renderWidget(w: BaseWidget): string {
  if (!w.visible) return ''
  switch (w.type) {
    case 'text':         return renderText(w)
    case 'image':        return renderImage(w)
    case 'rectangle':    return renderRectangle(w)
    case 'button':       return renderButton(w)
    case 'nav-buttons':  return renderNavButtons(w)
    case 'done-button':     return renderDoneButton(w)
    case 'suspend-button':  return renderSuspendButton(w)
    case 'score-field':  return renderScoreField(w)
    case 'score-quiz':   return renderScoreQuiz(w)
    case 'media-player': return renderMediaPlayer(w)
    case 'question-mc':     return renderMCQuestion(w)
    case 'question-tf':     return renderTFQuestion(w)
    case 'question-fill':   return renderFillQuestion(w)
    case 'question-match':  return renderMatchItems(w)
    case 'question-drag':   return renderDragObjects(w)
    case 'question-drop':   return renderDropTarget(w)
    case 'question-arrange':return renderArrangeObjects(w)
    case 'question-order':  return renderOrderText(w)
    case 'question-hotspot':   return renderHotspot(w)
    case 'screenshot-sim':     return renderScreenshotSim(w)
    default: return ''
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
  const lessonStatus = status === 'incomplete' ? 'incomplete' : (score >= passMark ? 'passed' : 'failed')

  api.LMSSetValue('cmi.core.score.raw', String(score))
  api.LMSSetValue('cmi.core.score.min', '0')
  api.LMSSetValue('cmi.core.score.max', '100')
  api.LMSSetValue('cmi.core.lesson_status', lessonStatus)

  const slideIndex = state.currentSlide
  api.LMSSetValue('cmi.core.lesson_location', String(slideIndex))
  api.LMSCommit('')
}

// ─── Navigation ───────────────────────────────────────────────────────────────

function goToSlide(state: PlayerState, index: number): void {
  // Cancel any running demo timer from the previous slide's sim player
  state.simCleanup?.()
  state.simCleanup = null

  const { course, container } = state
  if (index < 0 || index >= course.slides.length) return
  state.currentSlide = index
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
    }
  }

  updateScoreDisplays(state)
  scormReport(state, 'incomplete')
}

function goNext(state: PlayerState): void {
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
    const ok = api.LMSFinish('')
    if (ok !== 'true') console.warn('[ELearnPlayer] LMSFinish returned false — LMS may not have recorded session end.')
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
    const ok = api.LMSFinish('')
    if (ok !== 'true') console.warn('[ELearnPlayer] LMSFinish returned false — LMS may not have recorded session end.')
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

// ─── Question submission handler ──────────────────────────────────────────────

function handleSubmit(state: PlayerState, widgetId: string): void {
  const slideWidgets = state.course.slides[state.currentSlide]?.widgets ?? []
  const widget = slideWidgets.find(w => w.id === widgetId)
  if (!widget) return

  const widgetEl = state.container.querySelector<HTMLElement>(`#w-${widgetId}`)
  if (!widgetEl) return

  const feedbackEl = widgetEl.querySelector<HTMLElement>('.el-feedback')
  const ep = widget.extendedProperties
  const scoring = (ep.scoring as { weight?: number; attempts?: number }) ?? {}
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
  scormReport(state, 'incomplete')
}

// ─── Event delegation ─────────────────────────────────────────────────────────

function attachEvents(state: PlayerState): void {
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

  const scormApi = findScormApi(window)
  if (scormApi) scormApi.LMSInitialize('')

  const state: PlayerState = {
    course,
    currentSlide: options.startSlide ?? 0,
    questionStates: new Map(),
    scormApi,
    container,
    passMark: options.passMark ?? 80,
    remediationVisited: false,
    simCleanup: null,
  }

  // Attempt to restore full suspend state (slide + question scores) from cmi.suspend_data.
  // Falls back to cmi.core.lesson_location if no suspend_data is present.
  if (scormApi) {
    const restored = restoreSuspendData(state, scormApi, course.slides.length)
    if (!restored) {
      // Legacy fallback: restore slide location only
      const loc = scormApi.LMSGetValue('cmi.core.lesson_location')
      if (loc) {
        const idx = parseInt(loc, 10)
        if (!isNaN(idx) && idx >= 0 && idx < course.slides.length) {
          state.currentSlide = idx
        }
      }
    }
  }

  attachEvents(state)
  goToSlide(state, state.currentSlide)
}

// Expose on global ELearnPlayer (IIFE name)
export { init }
