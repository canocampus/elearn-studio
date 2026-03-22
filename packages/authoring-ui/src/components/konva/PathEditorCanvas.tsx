/**
 * PathEditorCanvas — T028.1
 *
 * Full-screen overlay for drawing/editing an AnimationPath.
 * Uses Konva for interactive waypoint placement over a neutral canvas.
 *
 * Interaction:
 *  - Click empty canvas area → add waypoint at clicked position
 *  - Drag existing circle → reposition waypoint
 *  - Click waypoint then press Delete / Backspace → remove it
 *  - Save → calls onSave with updated keypoints
 *  - Cancel → calls onCancel with no changes
 *
 * The canvas origin (0, 0) corresponds to the widget's natural position.
 * Offsets are stored as pixels relative to that origin.
 */

import { useState, useCallback } from 'react'
import { Stage, Layer, Circle, Line, Text } from 'react-konva'
import Konva from 'konva'
import type { AnimationKeypoint } from '../sidebar/AnimationPropertiesPanel'

// ─── Constants ───────────────────────────────────────────────────────────────

const CANVAS_W = 720
const CANVAS_H = 480
const POINT_RADIUS = 8
const START_COLOR  = '#a6e3a1'  // green — first point
const POINT_COLOR  = '#89b4fa'  // blue — middle points
const END_COLOR    = '#f38ba8'  // red — last point
const LINE_COLOR   = '#cdd6f4'
const SEL_COLOR    = '#f9e2af'  // yellow — selected

// ─── Props ───────────────────────────────────────────────────────────────────

interface PathEditorCanvasProps {
  keypoints: AnimationKeypoint[]
  onSave: (keypoints: AnimationKeypoint[]) => void
  onCancel: () => void
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PathEditorCanvas({ keypoints, onSave, onCancel }: PathEditorCanvasProps) {
  // Initialize with a copy of the incoming keypoints, placing the first point at canvas centre if empty
  const [points, setPoints] = useState<AnimationKeypoint[]>(() => {
    if (keypoints.length > 0) return keypoints.map(kp => ({ ...kp }))
    return [{ x: 0, y: 0 }]
  })
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)

  // ── Canvas click: add waypoint ───────────────────────────────────────────
  function handleStageClick(e: Konva.KonvaEventObject<MouseEvent>) {
    // Ignore clicks on child shapes (circles) — they handle themselves
    if (e.target !== e.currentTarget) return
    const pos = e.target.getStage()?.getPointerPosition()
    if (!pos) return
    const newPt: AnimationKeypoint = {
      x: Math.round(pos.x - CANVAS_W / 2),
      y: Math.round(pos.y - CANVAS_H / 2),
    }
    const next = [...points, newPt]
    setPoints(next)
    setSelectedIdx(next.length - 1)
  }

  // ── Drag: reposition waypoint ────────────────────────────────────────────
  function handleDragEnd(idx: number, e: Konva.KonvaEventObject<DragEvent>) {
    const updated = points.map((kp, i) =>
      i === idx
        ? { ...kp, x: Math.round(e.target.x() - CANVAS_W / 2), y: Math.round(e.target.y() - CANVAS_H / 2) }
        : kp,
    )
    setPoints(updated)
  }

  // ── Delete selected waypoint ─────────────────────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIdx !== null) {
      e.preventDefault()
      if (points.length <= 1) return   // keep at least one point
      const next = points.filter((_, i) => i !== selectedIdx)
      setPoints(next)
      setSelectedIdx(Math.min(selectedIdx, next.length - 1))
    }
  }, [selectedIdx, points])

  // ── Build polyline flat array for Konva Line ─────────────────────────────
  const linePoints = points.flatMap(kp => [kp.x + CANVAS_W / 2, kp.y + CANVAS_H / 2])

  function pointColor(idx: number): string {
    if (idx === selectedIdx) return SEL_COLOR
    if (idx === 0) return START_COLOR
    if (idx === points.length - 1 && points.length > 1) return END_COLOR
    return POINT_COLOR
  }

  return (
    <div style={styles.overlay} onKeyDown={handleKeyDown} tabIndex={0} autoFocus>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.title}>Path Editor</span>
          <span style={styles.hint}>
            Click to add waypoints · Drag to move · Delete/Backspace to remove selected
          </span>
        </div>
        <div style={styles.headerRight}>
          <span style={styles.stats}>{points.length} waypoint{points.length !== 1 ? 's' : ''}</span>
          <button style={styles.cancelBtn} onClick={onCancel}>Cancel</button>
          <button style={styles.saveBtn} onClick={() => onSave(points)}>Save Path</button>
        </div>
      </div>

      {/* Canvas */}
      <div style={styles.canvasWrap}>
        <Stage
          width={CANVAS_W}
          height={CANVAS_H}
          onClick={handleStageClick}
          style={{ cursor: 'crosshair', background: '#181825', display: 'block' }}
        >
          <Layer>
            {/* Grid lines */}
            <Line points={[CANVAS_W / 2, 0, CANVAS_W / 2, CANVAS_H]} stroke="#313244" strokeWidth={1} />
            <Line points={[0, CANVAS_H / 2, CANVAS_W, CANVAS_H / 2]} stroke="#313244" strokeWidth={1} />

            {/* Origin label */}
            <Text x={CANVAS_W / 2 + 4} y={CANVAS_H / 2 + 4} text="(0,0)" fontSize={10} fill="#45475a" />

            {/* Path polyline */}
            {points.length > 1 && (
              <Line
                points={linePoints}
                stroke={LINE_COLOR}
                strokeWidth={1.5}
                dash={[5, 3]}
                listening={false}
              />
            )}

            {/* Waypoint circles */}
            {points.map((kp, idx) => (
              <Circle
                key={idx}
                x={kp.x + CANVAS_W / 2}
                y={kp.y + CANVAS_H / 2}
                radius={POINT_RADIUS}
                fill={pointColor(idx)}
                stroke="#1e1e2e"
                strokeWidth={2}
                draggable
                onClick={(e) => { e.cancelBubble = true; setSelectedIdx(idx) }}
                onDragEnd={(e) => handleDragEnd(idx, e)}
              />
            ))}
          </Layer>
        </Stage>
      </div>

      {/* Selected point info */}
      {selectedIdx !== null && points[selectedIdx] && (
        <div style={styles.footer}>
          Waypoint {selectedIdx + 1}: x = {points[selectedIdx].x}px, y = {points[selectedIdx].y}px
          {selectedIdx === 0 && '  (start)'}
          {selectedIdx === points.length - 1 && points.length > 1 && '  (end)'}
        </div>
      )}
    </div>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 9000,
    background: 'rgba(17, 17, 27, 0.95)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 32,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: CANVAS_W,
    marginBottom: 12,
  },
  headerLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    color: '#cdd6f4',
  },
  hint: {
    fontSize: 11,
    color: '#6c7086',
  },
  stats: {
    fontSize: 11,
    color: '#94a3b8',
  },
  cancelBtn: {
    background: '#313244',
    border: '1px solid #45475a',
    borderRadius: 4,
    color: '#cdd6f4',
    fontSize: 12,
    padding: '5px 12px',
    cursor: 'pointer',
  },
  saveBtn: {
    background: '#89b4fa',
    border: 'none',
    borderRadius: 4,
    color: '#1e1e2e',
    fontSize: 12,
    fontWeight: 600,
    padding: '5px 12px',
    cursor: 'pointer',
  },
  canvasWrap: {
    borderRadius: 6,
    overflow: 'hidden',
    border: '1px solid #313244',
  },
  footer: {
    marginTop: 10,
    fontSize: 11,
    color: '#94a3b8',
  },
}
