/**
 * Path animations — canonical contract (TD-023).
 *
 * Single authority for the types previously hand-mirrored in
 * authoring-ui (`AnimationPropertiesPanel.tsx`) and runtime-player
 * (`animations/animator.ts`); both now re-export from here. Doc comments
 * merged from the richer runtime copy.
 */

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
