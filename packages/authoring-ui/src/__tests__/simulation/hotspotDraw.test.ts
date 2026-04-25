/**
 * hotspotDraw — TD-014.6 pure-logic unit tests.
 *
 * Scope: coordinate math + clamping + size validation used by HotspotCanvas
 * draw-mode. Keeping the maths pure (no React, no Konva) lets us test it
 * exhaustively here and reduces HotspotCanvas.test.tsx to a thin rendering
 * smoke. The full drag gesture is validated end-to-end in TD-014.22.
 */

import { describe, it, expect } from 'vitest'
import {
  isDrawModeHotspot,
  clampPoint,
  rectFromPoints,
  isValidHotspotSize,
  MIN_HOTSPOT_SIZE,
} from '../../components/simulation/hotspotDraw'

describe('hotspotDraw — TD-014.6', () => {
  describe('isDrawModeHotspot', () => {
    it('returns true when width is 0 (draw-mode sentinel)', () => {
      expect(isDrawModeHotspot({ width: 0, height: 100 })).toBe(true)
    })
    it('returns true when height is 0 (draw-mode sentinel)', () => {
      expect(isDrawModeHotspot({ width: 100, height: 0 })).toBe(true)
    })
    it('returns true for the addStep sentinel (both dimensions zero)', () => {
      expect(isDrawModeHotspot({ width: 0, height: 0 })).toBe(true)
    })
    it('returns false when both dimensions are positive', () => {
      expect(isDrawModeHotspot({ width: 80, height: 40 })).toBe(false)
    })
    it('returns false for minimum-size hotspot (10×10)', () => {
      expect(isDrawModeHotspot({ width: 10, height: 10 })).toBe(false)
    })
  })

  describe('clampPoint', () => {
    it('passes through a point inside bounds unchanged', () => {
      expect(clampPoint({ x: 100, y: 50 }, 640, 360)).toEqual({ x: 100, y: 50 })
    })
    it('clamps negative coordinates to 0', () => {
      expect(clampPoint({ x: -10, y: -20 }, 640, 360)).toEqual({ x: 0, y: 0 })
    })
    it('clamps coordinates above max to canvas bounds', () => {
      expect(clampPoint({ x: 1000, y: 500 }, 640, 360)).toEqual({ x: 640, y: 360 })
    })
    it('clamps one axis while preserving the other', () => {
      expect(clampPoint({ x: 100, y: 500 }, 640, 360)).toEqual({ x: 100, y: 360 })
      expect(clampPoint({ x: -5, y: 50 }, 640, 360)).toEqual({ x: 0, y: 50 })
    })
    it('treats bounds inclusively (exactly canvasW / canvasH is valid)', () => {
      expect(clampPoint({ x: 640, y: 360 }, 640, 360)).toEqual({ x: 640, y: 360 })
    })
  })

  describe('rectFromPoints', () => {
    it('builds a rectangle with min-x/min-y origin regardless of point order', () => {
      const ab = rectFromPoints({ x: 10, y: 20 }, { x: 50, y: 60 }, 640, 360)
      const ba = rectFromPoints({ x: 50, y: 60 }, { x: 10, y: 20 }, 640, 360)
      expect(ab).toEqual({ x: 10, y: 20, width: 40, height: 40 })
      expect(ba).toEqual({ x: 10, y: 20, width: 40, height: 40 })
    })

    it('rounds fractional coordinates to integers', () => {
      const r = rectFromPoints({ x: 10.3, y: 20.8 }, { x: 50.7, y: 60.2 }, 640, 360)
      // Rounding applied after clamp → Math.round(10.3)=10, Math.round(20.8)=21
      // width = |10.3 - 50.7| = 40.4 → 40; height = |20.8 - 60.2| = 39.4 → 39
      expect(r.width).toBe(40)
      expect(r.height).toBe(39)
      expect(Number.isInteger(r.x)).toBe(true)
      expect(Number.isInteger(r.y)).toBe(true)
    })

    it('clamps both corners to canvas bounds before building the rect', () => {
      const r = rectFromPoints({ x: -50, y: -50 }, { x: 800, y: 500 }, 640, 360)
      expect(r).toEqual({ x: 0, y: 0, width: 640, height: 360 })
    })

    it('returns zero width/height when both points coincide (click without drag)', () => {
      const r = rectFromPoints({ x: 100, y: 100 }, { x: 100, y: 100 }, 640, 360)
      expect(r).toEqual({ x: 100, y: 100, width: 0, height: 0 })
    })

    it('handles drawing from bottom-right to top-left (swap via min)', () => {
      const r = rectFromPoints({ x: 200, y: 150 }, { x: 50, y: 30 }, 640, 360)
      expect(r).toEqual({ x: 50, y: 30, width: 150, height: 120 })
    })
  })

  describe('isValidHotspotSize', () => {
    it('accepts width and height at exactly MIN_HOTSPOT_SIZE', () => {
      expect(isValidHotspotSize(MIN_HOTSPOT_SIZE, MIN_HOTSPOT_SIZE)).toBe(true)
    })
    it('accepts sizes above the minimum', () => {
      expect(isValidHotspotSize(100, 50)).toBe(true)
    })
    it('rejects below-minimum width', () => {
      expect(isValidHotspotSize(5, 20)).toBe(false)
    })
    it('rejects below-minimum height', () => {
      expect(isValidHotspotSize(20, 5)).toBe(false)
    })
    it('rejects zero-size (the addStep sentinel)', () => {
      expect(isValidHotspotSize(0, 0)).toBe(false)
    })
    it('MIN_HOTSPOT_SIZE is 10 (matches task contract)', () => {
      expect(MIN_HOTSPOT_SIZE).toBe(10)
    })
  })
})
