/**
 * Animator — T028
 *
 * Executes path animations on DOM elements using the Web Animations API (WAAPI).
 * An AnimationPath describes a series of (x, y) pixel-offset keypoints that the
 * widget travels through, plus timing parameters (duration, easing, loop, etc.).
 *
 * Pixel offsets are relative to the widget's natural CSS position — no coordinate
 * transform is needed; the `translate()` keyframes simply offset the element.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AnimationKeypoint {
  /** Horizontal pixel offset from the widget's starting position */
  x: number
  /** Vertical pixel offset from the widget's starting position */
  y: number
  /**
   * Optional explicit time position in [0, 1].
   * When omitted, the offset is distributed evenly between adjacent explicit points.
   */
  t?: number
}

export type AnimationFill = 'none' | 'forwards' | 'backwards' | 'both' | 'auto'

export interface AnimationPath {
  id: string
  name: string
  keypoints: AnimationKeypoint[]
  /** Total animation duration in milliseconds */
  duration: number
  /** CSS easing string: 'linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out',
   *  or 'cubic-bezier(n1, n2, n3, n4)' */
  easing: string
  /** Number of play-throughs. 1 = once, -1 = infinite, N = N times. */
  loop: number
  /** Delay before the animation starts, in milliseconds */
  delay?: number
  /** WAAPI fill mode — controls the element's state before/after animation */
  fill?: AnimationFill
}

// ─── Keyframe builder ────────────────────────────────────────────────────────

/**
 * Convert AnimationKeypoints into WAAPI Keyframe objects.
 *
 * Each keyframe gets a `transform: translate(Xpx, Ypx)` and an `offset` in [0, 1].
 * Offsets from explicit `t` values are used directly; gaps are filled by even
 * linear interpolation between the surrounding explicit (or endpoint) offsets.
 */
export function buildKeyframes(keypoints: AnimationKeypoint[]): Keyframe[] {
  if (keypoints.length === 0) return []

  // Single-point shortcut — offset is always 0 (or explicit t)
  if (keypoints.length === 1) {
    const kp = keypoints[0]
    return [{ transform: `translate(${kp.x}px, ${kp.y}px)`, offset: kp.t ?? 0 }]
  }

  // ── 1. Determine the offset for every keypoint ───────────────────────────
  const offsets: (number | undefined)[] = new Array(keypoints.length).fill(undefined)

  // Anchor the first and last keypoints
  offsets[0] = keypoints[0].t ?? 0
  offsets[keypoints.length - 1] = keypoints[keypoints.length - 1].t ?? 1

  // Set explicit t values for intermediate points
  for (let i = 1; i < keypoints.length - 1; i++) {
    if (keypoints[i].t !== undefined) {
      offsets[i] = keypoints[i].t!
    }
  }

  // Fill gaps by linear interpolation between known values
  let gapStart = 0
  while (gapStart < keypoints.length) {
    // Find the next undefined slot
    if (offsets[gapStart] !== undefined) {
      gapStart++
      continue
    }
    // Find the extent of the gap
    let gapEnd = gapStart
    while (gapEnd < keypoints.length && offsets[gapEnd] === undefined) {
      gapEnd++
    }
    // [gapStart - 1, gapEnd] are the known bookends (guaranteed defined by anchor logic above)
    const lo = offsets[gapStart - 1]!
    const hi = offsets[gapEnd]!
    const steps = gapEnd - (gapStart - 1)
    for (let i = gapStart; i < gapEnd; i++) {
      offsets[i] = lo + ((hi - lo) * (i - (gapStart - 1))) / steps
    }
    gapStart = gapEnd + 1
  }

  // ── 2. Build Keyframe objects ─────────────────────────────────────────────
  return keypoints.map((kp, i) => ({
    transform: `translate(${kp.x}px, ${kp.y}px)`,
    offset: offsets[i],
  }))
}

// ─── Timing builder ──────────────────────────────────────────────────────────

/**
 * Convert AnimationPath parameters into a WAAPI KeyframeAnimationOptions object.
 */
export function buildTiming(path: AnimationPath): KeyframeAnimationOptions {
  const rawLoop = path.loop ?? 1
  const iterations = rawLoop === -1 ? Infinity : rawLoop <= 0 ? 1 : rawLoop

  return {
    duration: path.duration,
    easing: path.easing,
    iterations,
    delay: path.delay ?? 0,
    fill: path.fill ?? 'none',
  }
}

// ─── Main executor ───────────────────────────────────────────────────────────

/**
 * Execute a path animation on a DOM element using the Web Animations API.
 *
 * Returns the Animation handle (which can be cancelled), or null if:
 * - the keypoints list is empty
 * - the browser does not support element.animate
 * - element.animate throws
 */
export function executeAnimation(
  element: HTMLElement,
  path: AnimationPath,
): Animation | null {
  if (path.keypoints.length === 0) return null

  if (typeof element.animate !== 'function') {
    console.warn('[ELearnPlayer] Web Animations API not available — skipping animation')
    return null
  }

  try {
    const keyframes = buildKeyframes(path.keypoints)
    const timing    = buildTiming(path)
    return element.animate(keyframes, timing)
  } catch (err) {
    console.error('[ELearnPlayer] executeAnimation failed:', err)
    return null
  }
}
