/**
 * Screenshot Simulation Player — T025
 *
 * Vanilla TypeScript, no external dependencies.
 * Runs in the runtime-player IIFE alongside other widget types.
 *
 * Supports three modes:
 *   demo       — auto-advance with demoDelay; hotspot highlighted for guidance
 *   practice   — learner must click within the hotspot (+ tolerance); unlimited by default
 *   assessment — same as practice; correct clicks accumulate score reported to SCORM
 */

// ─── Types (mirror authoring-ui/types/simulation) ────────────────────────────

export interface SimHotspot {
  x: number
  y: number
  width: number
  height: number
  tolerance: number
}

export interface AuthoredSimStep {
  id: string
  order: number
  description: string
  instruction: string
  hint: string
  correctFeedback: string
  incorrectFeedback: string
  /** Milliseconds before auto-advance in demo mode */
  demoDelay: number
  /** Max wrong attempts before forced advance; -1 = unlimited */
  maxAttempts: number
  screenshotKey: string
  /** Backend-proxied URL for the screenshot image */
  screenshotUrl: string
  hotspot: SimHotspot
}

export type SimMode = 'demo' | 'practice' | 'assessment'

export interface SimConfig {
  sessionId: string
  mode: SimMode
  passingScore: number
  steps: AuthoredSimStep[]
}

// ─── Callbacks injected by the player host ────────────────────────────────────

export interface SimPlayerCallbacks {
  /** Called when the learner completes all steps. Host should advance the slide. */
  onComplete: () => void
  /**
   * Called when assessment is done so the host can record a SCORM score.
   * score is [0.0, 1.0]; weight is 100 (default sim widget weight).
   */
  onScore: (widgetId: string, score: number, weight: number) => void
}

// ─── Reference canvas dimensions (fixed, matches the recorder) ───────────────

const REF_W = 640
const REF_H = 360

// ─── HTML shell ──────────────────────────────────────────────────────────────

/**
 * Returns the inner HTML to inject inside the sim widget's outer container.
 * The outer container (id="w-{widgetId}") is created by the host renderWidget call.
 */
export function renderSimShell(): string {
  return `
    <div class="el-sim-body" style="position:relative;width:100%;height:calc(100% - 60px);overflow:hidden;background:#000;">
      <img class="el-sim-screenshot" style="width:100%;height:100%;object-fit:contain;display:block;" src="" alt="" />
      <div class="el-sim-hotspot" style="position:absolute;display:none;box-sizing:border-box;pointer-events:none;"></div>
      <div class="el-sim-click-layer" style="position:absolute;inset:0;cursor:crosshair;"></div>
    </div>
    <div class="el-sim-bar" style="height:60px;display:flex;align-items:center;padding:0 12px;gap:8px;background:#1a1a2e;color:#fff;font-size:12px;overflow:hidden;flex-shrink:0;">
      <span class="el-sim-step-counter" style="white-space:nowrap;font-weight:600;color:#89b4fa;min-width:72px;"></span>
      <p class="el-sim-instruction" style="flex:1;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></p>
      <span class="el-sim-feedback" style="display:none;white-space:nowrap;font-weight:600;max-width:200px;overflow:hidden;text-overflow:ellipsis;"></span>
      <button class="el-sim-next-btn" style="display:none;cursor:pointer;padding:4px 12px;background:#89b4fa;border:none;border-radius:4px;color:#1a1a2e;font-weight:600;flex-shrink:0;"></button>
    </div>`
}

// ─── Mount ────────────────────────────────────────────────────────────────────

/**
 * Mounts the sim player state machine onto `el`.
 * The element must already contain the HTML shell from `renderSimShell()`.
 *
 * @returns A cleanup function — call it when navigating away to cancel demo timers.
 */
export function mountSimPlayer(
  el: HTMLElement,
  config: SimConfig,
  callbacks: SimPlayerCallbacks,
): () => void {
  const { steps, mode } = config

  const screenshotEl  = el.querySelector<HTMLImageElement>('.el-sim-screenshot')!
  const hotspotEl     = el.querySelector<HTMLElement>('.el-sim-hotspot')!
  const clickLayerEl  = el.querySelector<HTMLElement>('.el-sim-click-layer')!
  const counterEl     = el.querySelector<HTMLElement>('.el-sim-step-counter')!
  const instructionEl = el.querySelector<HTMLElement>('.el-sim-instruction')!
  const feedbackEl    = el.querySelector<HTMLElement>('.el-sim-feedback')!
  const nextBtn       = el.querySelector<HTMLButtonElement>('.el-sim-next-btn')!

  let currentStepIdx = 0
  let attemptCount   = 0
  let correctCount   = 0
  let completed      = false
  let hintShown      = false    // tracks whether hint has been shown for current step
  let demoTimer: ReturnType<typeof setTimeout> | null = null

  // Extract widget id from element id ("w-abc" → "abc")
  const widgetId = el.id.startsWith('w-') ? el.id.slice(2) : el.id

  function cancel(): void {
    if (demoTimer !== null) {
      clearTimeout(demoTimer)
      demoTimer = null
    }
  }

  function showHotspot(step: AuthoredSimStep, isDemo: boolean): void {
    const { x, y, width, height } = step.hotspot
    hotspotEl.style.left   = `${((x / REF_W) * 100).toFixed(3)}%`
    hotspotEl.style.top    = `${((y / REF_H) * 100).toFixed(3)}%`
    hotspotEl.style.width  = `${((width / REF_W) * 100).toFixed(3)}%`
    hotspotEl.style.height = `${((height / REF_H) * 100).toFixed(3)}%`
    if (isDemo) {
      hotspotEl.style.border     = '2px dashed #f1c40f'
      hotspotEl.style.background = 'rgba(241,196,15,0.15)'
    } else {
      hotspotEl.style.border     = '2px dashed rgba(137,180,250,0.5)'
      hotspotEl.style.background = 'rgba(137,180,250,0.05)'
    }
    hotspotEl.style.display = 'block'
  }

  function showFeedback(text: string, color: string): void {
    feedbackEl.textContent    = text
    feedbackEl.style.color    = color
    feedbackEl.style.display  = 'inline'
  }

  function showNextBtn(label: string, onClick: () => void): void {
    nextBtn.textContent = label
    nextBtn.onclick = onClick
    nextBtn.style.display = 'block'
  }

  function clearFeedbackAndNext(): void {
    feedbackEl.style.display = 'none'
    feedbackEl.textContent   = ''
    nextBtn.style.display    = 'none'
    nextBtn.onclick          = null
  }

  function loadStep(idx: number): void {
    if (idx >= steps.length) {
      onSimComplete()
      return
    }

    const step = steps[idx]!
    currentStepIdx = idx
    attemptCount   = 0
    hintShown      = false

    screenshotEl.src = step.screenshotUrl
    screenshotEl.alt = step.description

    counterEl.textContent    = `Step ${idx + 1} / ${steps.length}`
    instructionEl.textContent = step.instruction || step.description

    clearFeedbackAndNext()
    showHotspot(step, mode === 'demo')

    if (mode === 'demo') {
      clickLayerEl.style.pointerEvents = 'none'
      // Clamp demoDelay to a safe range to prevent a zero or excessively long pause
      const delay = Math.min(Math.max(step.demoDelay > 0 ? step.demoDelay : 1500, 100), 30_000)
      demoTimer = setTimeout(() => {
        demoTimer = null
        loadStep(idx + 1)
      }, delay)
    } else {
      clickLayerEl.style.pointerEvents = 'auto'
    }
  }

  function onSimComplete(): void {
    if (completed) return
    completed = true
    cancel()

    hotspotEl.style.display          = 'none'
    clickLayerEl.style.pointerEvents = 'none'
    counterEl.textContent            = `${steps.length} / ${steps.length}`
    instructionEl.textContent        = 'Simulation complete.'
    clearFeedbackAndNext()

    if (mode === 'assessment' && steps.length > 0) {
      // score = fraction of steps where the learner clicked inside the hotspot.
      // Steps where maxAttempts was exhausted without a correct click count as 0.
      const score = correctCount / steps.length
      callbacks.onScore(widgetId, score, 100)
    }

    showNextBtn('Continue', () => callbacks.onComplete())
  }

  // ─── Click handler (practice / assessment) ─────────────────────────────────

  function onClickLayer(e: MouseEvent): void {
    if (mode === 'demo' || completed) return
    const step = steps[currentStepIdx]
    if (!step) return

    const rect = clickLayerEl.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return

    // Map display-space click → 640×360 reference space
    const clickX = ((e.clientX - rect.left) / rect.width) * REF_W
    const clickY = ((e.clientY - rect.top) / rect.height) * REF_H

    const { x, y, width, height, tolerance } = step.hotspot
    const hit =
      clickX >= x - tolerance && clickX <= x + width  + tolerance &&
      clickY >= y - tolerance && clickY <= y + height + tolerance

    if (hit) {
      if (mode === 'assessment') correctCount++
      showFeedback(step.correctFeedback || 'Correct!', '#2ecc71')
      clickLayerEl.style.pointerEvents = 'none'
      showNextBtn('Next', () => loadStep(currentStepIdx + 1))
    } else {
      attemptCount++
      const maxAttempts = step.maxAttempts === -1 ? Infinity : step.maxAttempts
      const limitReached = maxAttempts !== Infinity && attemptCount >= maxAttempts

      if (limitReached) {
        showFeedback(step.incorrectFeedback || 'Incorrect.', '#e74c3c')
        clickLayerEl.style.pointerEvents = 'none'
        showNextBtn('Next', () => loadStep(currentStepIdx + 1))
      } else {
        // Prepend hint text on the first wrong attempt only; omit it on subsequent misses
        let msg = step.incorrectFeedback || 'Try again.'
        if (!hintShown && step.hint) {
          msg = `${step.hint} — ${msg}`
          hintShown = true
        }
        showFeedback(msg, '#f39c12')
      }
    }
  }

  clickLayerEl.addEventListener('click', onClickLayer)

  // ─── Boot ──────────────────────────────────────────────────────────────────

  if (steps.length > 0) {
    loadStep(0)
  } else {
    instructionEl.textContent = 'No steps configured.'
    hotspotEl.style.display   = 'none'
  }

  // Return a full cleanup: cancel pending timer AND remove the click listener
  return () => {
    cancel()
    clickLayerEl.removeEventListener('click', onClickLayer)
  }
}
