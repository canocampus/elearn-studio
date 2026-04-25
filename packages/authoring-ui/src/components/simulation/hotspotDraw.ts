/**
 * Pure helpers for HotspotCanvas draw-mode (TD-014.6).
 *
 * Kept React- and Konva-free so the coordinate maths can be unit-tested
 * exhaustively without the native `canvas` module (jsdom limitation — see
 * propsEmptyState.tsx comment, TD-010). The HotspotCanvas component uses
 * these helpers to derive the committed rectangle after a mouseUp from
 * raw pointer coordinates supplied by Konva.
 */

export interface Point {
  x: number
  y: number
}

/**
 * Zero-size sentinel convention — TD-014.2 `addStep` seeds every new step
 * with `{ width: 0, height: 0 }`; HotspotCanvas uses this to enter
 * draw-mode (suppress the Rect + Transformer, enable Stage mouse handlers).
 * Width-only or height-only zero also counts so partial data (e.g. after
 * Clear hotspot — TD-014.7) still re-enters draw-mode.
 */
export function isDrawModeHotspot(hotspot: { width: number; height: number }): boolean {
  return hotspot.width === 0 || hotspot.height === 0
}

/** Clamp a point to the closed interval [0, canvasW] × [0, canvasH]. */
export function clampPoint(p: Point, canvasW: number, canvasH: number): Point {
  return {
    x: Math.max(0, Math.min(canvasW, p.x)),
    y: Math.max(0, Math.min(canvasH, p.y)),
  }
}

/**
 * Build an axis-aligned rectangle from two corner points (any order).
 * Both corners are clamped to the canvas bounds BEFORE the rect is built
 * so a drag that crosses a border yields a rect that tightly hugs the
 * visible canvas edge. Output coordinates are rounded integers.
 */
export function rectFromPoints(
  a: Point,
  b: Point,
  canvasW: number,
  canvasH: number,
): { x: number; y: number; width: number; height: number } {
  const ca = clampPoint(a, canvasW, canvasH)
  const cb = clampPoint(b, canvasW, canvasH)
  return {
    x: Math.round(Math.min(ca.x, cb.x)),
    y: Math.round(Math.min(ca.y, cb.y)),
    width: Math.round(Math.abs(ca.x - cb.x)),
    height: Math.round(Math.abs(ca.y - cb.y)),
  }
}

/** Minimum size (px) at which a draw gesture commits a new hotspot. Below
 *  this threshold the gesture is treated as a misclick and the hotspot
 *  stays in the zero-size draw-mode sentinel. */
export const MIN_HOTSPOT_SIZE = 10

/** True iff both dimensions meet MIN_HOTSPOT_SIZE. */
export function isValidHotspotSize(width: number, height: number): boolean {
  return width >= MIN_HOTSPOT_SIZE && height >= MIN_HOTSPOT_SIZE
}
