/**
 * Konva canvas that renders a step screenshot and lets the author
 * drag/resize a rectangular hotspot over it. (T024.5, T024.6)
 *
 * TD-014.6 — adds draw-mode. When `step.hotspot.width === 0 || height === 0`
 * (the TD-014.2 addStep sentinel), the Rect + Transformer are suppressed
 * and the Stage captures `mouseDown → mouseMove → mouseUp` to draw a new
 * hotspot. On commit, the gesture is validated via isValidHotspotSize
 * (≥ MIN_HOTSPOT_SIZE each axis); below that, the hotspot stays in the
 * zero-size sentinel (treated as a misclick).
 */

import { useEffect, useRef, useState } from 'react'
import { Stage, Layer, Image as KonvaImage, Rect, Transformer } from 'react-konva'
import Konva from 'konva'
import type { AuthoredSimStep, SimHotspot } from '../../types/simulation'
import {
  clampPoint,
  isDrawModeHotspot,
  isValidHotspotSize,
  rectFromPoints,
  type Point,
} from './hotspotDraw'

const CANVAS_W = 640
const CANVAS_H = 360

interface HotspotCanvasProps {
  step: AuthoredSimStep
  onChange: (hotspot: SimHotspot) => void
}

export function HotspotCanvas({ step, onChange }: HotspotCanvasProps) {
  const imageRef   = useRef<Konva.Image>(null)
  const rectRef    = useRef<Konva.Rect>(null)
  const trRef      = useRef<Konva.Transformer>(null)
  const imgElRef   = useRef<HTMLImageElement | null>(null)
  const loadedKey  = useRef<string>('')

  // TD-014.6: draw-mode state. drawStart === null means no drag in progress.
  const [drawStart, setDrawStart] = useState<Point | null>(null)
  const [drawEnd, setDrawEnd] = useState<Point | null>(null)

  const drawMode = isDrawModeHotspot(step.hotspot)

  // Load screenshot image
  useEffect(() => {
    if (step.screenshotUrl === loadedKey.current) return
    loadedKey.current = step.screenshotUrl

    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      imgElRef.current = img
      if (imageRef.current) {
        imageRef.current.image(img)
        imageRef.current.getLayer()?.batchDraw()
      }
    }
    img.onerror = () => { imgElRef.current = null }
    img.src = step.screenshotUrl
  }, [step.screenshotUrl])

  // Attach transformer to rect when in edit-mode (skipped in draw-mode where
  // neither Rect nor Transformer render).
  useEffect(() => {
    if (drawMode) return
    if (trRef.current && rectRef.current) {
      trRef.current.nodes([rectRef.current])
      trRef.current.getLayer()?.batchDraw()
    }
  }, [drawMode])

  const { x, y, width, height } = step.hotspot

  function handleDragEnd(e: Konva.KonvaEventObject<DragEvent>) {
    onChange({
      ...step.hotspot,
      x: Math.round(e.target.x()),
      y: Math.round(e.target.y()),
    })
  }

  function handleTransformEnd() {
    const node = rectRef.current
    if (!node) return
    const scaleX = node.scaleX()
    const scaleY = node.scaleY()
    node.scaleX(1)
    node.scaleY(1)
    onChange({
      ...step.hotspot,
      x:      Math.round(node.x()),
      y:      Math.round(node.y()),
      width:  Math.round(Math.max(10, node.width() * scaleX)),
      height: Math.round(Math.max(10, node.height() * scaleY)),
    })
  }

  // ─── Draw-mode handlers ────────────────────────────────────────────────────

  function pointerPosition(e: Konva.KonvaEventObject<MouseEvent>): Point | null {
    const pos = e.target.getStage()?.getPointerPosition()
    if (!pos) return null
    return clampPoint(pos, CANVAS_W, CANVAS_H)
  }

  function handleStageMouseDown(e: Konva.KonvaEventObject<MouseEvent>) {
    const pos = pointerPosition(e)
    if (!pos) return
    setDrawStart(pos)
    setDrawEnd(pos)
  }

  function handleStageMouseMove(e: Konva.KonvaEventObject<MouseEvent>) {
    if (!drawStart) return
    const pos = pointerPosition(e)
    if (!pos) return
    setDrawEnd(pos)
  }

  function handleStageMouseUp() {
    if (!drawStart || !drawEnd) {
      setDrawStart(null)
      setDrawEnd(null)
      return
    }
    const rect = rectFromPoints(drawStart, drawEnd, CANVAS_W, CANVAS_H)
    setDrawStart(null)
    setDrawEnd(null)
    if (!isValidHotspotSize(rect.width, rect.height)) return
    onChange({ ...step.hotspot, ...rect })
  }

  // Preview rectangle while the user is dragging in draw-mode.
  const previewRect = drawMode && drawStart && drawEnd
    ? rectFromPoints(drawStart, drawEnd, CANVAS_W, CANVAS_H)
    : null

  return (
    <div style={{ background: '#0d0d1a', borderRadius: 6, overflow: 'hidden', display: 'inline-block' }}>
      <Stage
        width={CANVAS_W}
        height={CANVAS_H}
        onMouseDown={drawMode ? handleStageMouseDown : undefined}
        onMouseMove={drawMode ? handleStageMouseMove : undefined}
        onMouseUp={drawMode ? handleStageMouseUp : undefined}
      >
        <Layer>
          {/* Screenshot */}
          <KonvaImage
            ref={imageRef}
            x={0}
            y={0}
            width={CANVAS_W}
            height={CANVAS_H}
            image={imgElRef.current ?? undefined}
          />

          {/* Edit-mode: existing draggable/resizable hotspot + Transformer */}
          {!drawMode && (
            <>
              <Rect
                ref={rectRef}
                x={x}
                y={y}
                width={width}
                height={height}
                fill="rgba(89, 175, 255, 0.25)"
                stroke="#59afff"
                strokeWidth={2}
                draggable
                onDragEnd={handleDragEnd}
                onTransformEnd={handleTransformEnd}
              />
              <Transformer
                ref={trRef}
                rotateEnabled={false}
                boundBoxFunc={(oldBox, newBox) =>
                  newBox.width < 10 || newBox.height < 10 ? oldBox : newBox
                }
              />
            </>
          )}

          {/* Draw-mode: transient preview while the author drags */}
          {previewRect && (
            <Rect
              x={previewRect.x}
              y={previewRect.y}
              width={previewRect.width}
              height={previewRect.height}
              fill="rgba(89, 175, 255, 0.15)"
              stroke="#59afff"
              strokeWidth={2}
              dash={[6, 4]}
              listening={false}
            />
          )}
        </Layer>
      </Stage>
    </div>
  )
}
