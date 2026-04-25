/**
 * HotspotCanvas — TD-014.6 rendering smoke for draw-mode vs edit-mode.
 *
 * Scope: verify the mode selector — when hotspot is the zero-size sentinel
 * (TD-014.2 addStep default), the component suppresses Rect + Transformer
 * and wires mouse handlers on Stage; when hotspot has size, the component
 * renders the existing Rect + Transformer in edit-mode and omits the
 * mouse handlers.
 *
 * The drag gesture itself (mouseDown → mouseMove → mouseUp → onChange with
 * the committed rect) is validated end-to-end in TD-014.22 with real
 * `page.mouse` events — Konva events require a Stage instance with
 * getPointerPosition() that jsdom cannot provide faithfully, so the drag
 * logic lives in the pure helpers `hotspotDraw.ts` and is unit-tested
 * exhaustively in `hotspotDraw.test.ts`.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { AuthoredSimStep } from '../../types/simulation'

const konvaRendered: string[] = []

vi.mock('react-konva', () => ({
  Stage: ({ children, onMouseDown, onMouseMove, onMouseUp }: {
    children?: ReactNode
    onMouseDown?: unknown
    onMouseMove?: unknown
    onMouseUp?: unknown
  }) => {
    konvaRendered.push('Stage')
    return (
      <div
        data-testid="konva-stage"
        data-has-mousedown={onMouseDown ? '1' : '0'}
        data-has-mousemove={onMouseMove ? '1' : '0'}
        data-has-mouseup={onMouseUp ? '1' : '0'}
      >
        {children}
      </div>
    )
  },
  Layer: ({ children }: { children?: ReactNode }) => {
    konvaRendered.push('Layer')
    return <div>{children}</div>
  },
  Image: () => { konvaRendered.push('Image'); return <div data-testid="konva-image" /> },
  Rect: (props: { fill?: string; 'data-role'?: string }) => {
    konvaRendered.push('Rect')
    return (
      <div
        data-testid="konva-rect"
        data-fill={props.fill ?? ''}
        data-role={props['data-role'] ?? ''}
      />
    )
  },
  Transformer: () => { konvaRendered.push('Transformer'); return <div data-testid="konva-transformer" /> },
}))
vi.mock('konva', () => ({ default: {} }))

import { HotspotCanvas } from '../../components/simulation/HotspotCanvas'

function makeStep(overrides: Partial<AuthoredSimStep> = {}): AuthoredSimStep {
  return {
    id: 'step-1',
    order: 0,
    description: '',
    instruction: '',
    hint: '',
    correctFeedback: '',
    incorrectFeedback: '',
    demoDelay: 3000,
    maxAttempts: -1,
    screenshotKey: '',
    screenshotUrl: 'http://test/img.png',
    hotspot: { x: 0, y: 0, width: 0, height: 0, tolerance: 12 },
    interactionType: 'click',
    ...overrides,
  }
}

beforeEach(() => {
  konvaRendered.length = 0
})

describe('HotspotCanvas — TD-014.6 draw-mode vs edit-mode', () => {
  it('edit-mode: a sized hotspot renders Rect + Transformer (existing behaviour preserved)', () => {
    const step = makeStep({ hotspot: { x: 10, y: 20, width: 80, height: 40, tolerance: 12 } })
    render(<HotspotCanvas step={step} onChange={vi.fn()} />)
    expect(konvaRendered).toContain('Rect')
    expect(konvaRendered).toContain('Transformer')
  })

  it('draw-mode: zero-size hotspot omits the Transformer', () => {
    const step = makeStep({ hotspot: { x: 0, y: 0, width: 0, height: 0, tolerance: 12 } })
    render(<HotspotCanvas step={step} onChange={vi.fn()} />)
    expect(konvaRendered).toContain('Stage')
    expect(konvaRendered).not.toContain('Transformer')
  })

  it('draw-mode: Stage has mouse-event handlers wired', () => {
    const step = makeStep({ hotspot: { x: 0, y: 0, width: 0, height: 0, tolerance: 12 } })
    const { getByTestId } = render(<HotspotCanvas step={step} onChange={vi.fn()} />)
    const stage = getByTestId('konva-stage')
    expect(stage.dataset.hasMousedown).toBe('1')
    expect(stage.dataset.hasMousemove).toBe('1')
    expect(stage.dataset.hasMouseup).toBe('1')
  })

  it('edit-mode: Stage omits draw-mode mouse handlers (handlers scoped to draw-mode only)', () => {
    const step = makeStep({ hotspot: { x: 10, y: 20, width: 80, height: 40, tolerance: 12 } })
    const { getByTestId } = render(<HotspotCanvas step={step} onChange={vi.fn()} />)
    const stage = getByTestId('konva-stage')
    expect(stage.dataset.hasMousedown).toBe('0')
    expect(stage.dataset.hasMousemove).toBe('0')
    expect(stage.dataset.hasMouseup).toBe('0')
  })

  it('draw-mode: width-only zero still triggers draw-mode (sentinel is width===0 OR height===0)', () => {
    const step = makeStep({ hotspot: { x: 0, y: 0, width: 0, height: 100, tolerance: 12 } })
    const { getByTestId } = render(<HotspotCanvas step={step} onChange={vi.fn()} />)
    expect(getByTestId('konva-stage').dataset.hasMousedown).toBe('1')
    expect(konvaRendered).not.toContain('Transformer')
  })

  it('draw-mode: height-only zero still triggers draw-mode', () => {
    const step = makeStep({ hotspot: { x: 0, y: 0, width: 100, height: 0, tolerance: 12 } })
    const { getByTestId } = render(<HotspotCanvas step={step} onChange={vi.fn()} />)
    expect(getByTestId('konva-stage').dataset.hasMousedown).toBe('1')
    expect(konvaRendered).not.toContain('Transformer')
  })
})
