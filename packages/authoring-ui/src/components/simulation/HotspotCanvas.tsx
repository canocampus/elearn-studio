/**
 * Konva canvas that renders a step screenshot and lets the author
 * drag/resize a rectangular hotspot over it. (T024.5, T024.6)
 */

import { useEffect, useRef } from 'react'
import { Stage, Layer, Image as KonvaImage, Rect, Transformer } from 'react-konva'
import Konva from 'konva'
import type { AuthoredSimStep, SimHotspot } from '../../types/simulation'

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

  // Attach transformer to rect on mount
  useEffect(() => {
    if (trRef.current && rectRef.current) {
      trRef.current.nodes([rectRef.current])
      trRef.current.getLayer()?.batchDraw()
    }
  }, [])

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

  return (
    <div style={{ background: '#0d0d1a', borderRadius: 6, overflow: 'hidden', display: 'inline-block' }}>
      <Stage width={CANVAS_W} height={CANVAS_H}>
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
          {/* Hotspot */}
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
        </Layer>
      </Stage>
    </div>
  )
}
