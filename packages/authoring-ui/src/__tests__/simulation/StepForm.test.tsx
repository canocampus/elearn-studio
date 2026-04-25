/**
 * StepForm — TD-014.4 unit tests for the "Step screenshot" field group.
 *
 * Two affordances wire to the same step patch:
 *  (a) Upload… → hidden <input type="file"> → uploadAsset → resolveAssetUrl
 *      → onChange({ screenshotKey, screenshotUrl })
 *  (b) Asset Library → editor.AssetManager.open({ types:['image'], select })
 *      → onChange({ screenshotUrl: asset.getSrc() })
 *
 * Per audit R-01 (TD-014.1), the library path reuses GrapesJS's AssetManager
 * modal — the canonical pattern already used in ButtonPropertiesPanel.tsx —
 * so no AssetPickerModal component is introduced.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { ToastProvider } from '../../components/ui/Toast'
import { useEditorStore } from '../../store/editorStore'
import type { AuthoredSimStep } from '../../types/simulation'

const { mockUploadAsset, mockResolveAssetUrl } = vi.hoisted(() => ({
  mockUploadAsset: vi.fn(),
  mockResolveAssetUrl: vi.fn(),
}))

vi.mock('../../api/courseApi', async () => {
  const actual = await vi.importActual<typeof import('../../api/courseApi')>('../../api/courseApi')
  return {
    ...actual,
    uploadAsset: mockUploadAsset,
    resolveAssetUrl: mockResolveAssetUrl,
  }
})

// Import AFTER mocks.
import { StepForm } from '../../components/simulation/StepForm'

function makeStep(overrides: Partial<AuthoredSimStep> = {}): AuthoredSimStep {
  return {
    id: 'step-x',
    order: 0,
    description: '',
    instruction: '',
    hint: '',
    correctFeedback: '',
    incorrectFeedback: '',
    demoDelay: 3000,
    maxAttempts: -1,
    screenshotKey: '',
    screenshotUrl: '',
    hotspot: { x: 0, y: 0, width: 0, height: 0, tolerance: 12 },
    interactionType: 'click',
    ...overrides,
  }
}

function wrap(ui: ReactNode) {
  return render(<ToastProvider>{ui}</ToastProvider>)
}

beforeEach(() => {
  mockUploadAsset.mockReset()
  mockResolveAssetUrl.mockReset()
  useEditorStore.setState({ editor: null })
})

describe('StepForm — TD-014.4 Step screenshot field group', () => {
  it('renders Upload… and Asset Library buttons', () => {
    wrap(<StepForm step={makeStep()} onChange={vi.fn()} />)
    expect(screen.getByTestId('step-upload-btn')).toBeDefined()
    expect(screen.getByTestId('step-asset-library-btn')).toBeDefined()
  })

  it('clicking Upload… triggers the hidden file input', () => {
    wrap(<StepForm step={makeStep()} onChange={vi.fn()} />)
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')
    expect(input).not.toBeNull()
    const clickSpy = vi.spyOn(input as HTMLInputElement, 'click').mockImplementation(() => undefined)
    fireEvent.click(screen.getByTestId('step-upload-btn'))
    expect(clickSpy).toHaveBeenCalledTimes(1)
  })

  it('file selection triggers uploadAsset → resolveAssetUrl → onChange with both keys', async () => {
    const onChange = vi.fn()
    mockUploadAsset.mockResolvedValue({
      objectName: 'abc-123.png',
      url: '/assets/abc-123.png',
      originalName: 'foo.png',
    })
    mockResolveAssetUrl.mockResolvedValue('https://garage/abc-123.png?sig=xyz')

    wrap(<StepForm step={makeStep()} onChange={onChange} />)
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!
    const file = new File(['x'], 'foo.png', { type: 'image/png' })
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith({
        screenshotKey: 'abc-123.png',
        screenshotUrl: 'https://garage/abc-123.png?sig=xyz',
      })
    })
    expect(mockUploadAsset).toHaveBeenCalledWith(file)
    expect(mockResolveAssetUrl).toHaveBeenCalledWith('abc-123.png')
  })

  it('upload failure does not call onChange', async () => {
    const onChange = vi.fn()
    mockUploadAsset.mockRejectedValue(new Error('Upload failed 500'))

    wrap(<StepForm step={makeStep()} onChange={onChange} />)
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!
    const file = new File(['x'], 'foo.png', { type: 'image/png' })
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(mockUploadAsset).toHaveBeenCalled()
    })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('Upload… button is disabled while an upload is pending', async () => {
    // Never-resolving promise to simulate in-flight upload.
    mockUploadAsset.mockImplementation(() => new Promise(() => undefined))

    wrap(<StepForm step={makeStep()} onChange={vi.fn()} />)
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!
    const file = new File(['x'], 'foo.png', { type: 'image/png' })
    fireEvent.change(input, { target: { files: [file] } })

    const btn = screen.getByTestId('step-upload-btn') as HTMLButtonElement
    await waitFor(() => expect(btn.disabled).toBe(true))
  })

  it('clicking Asset Library calls editor.AssetManager.open with types:["image"]', () => {
    const open = vi.fn()
    const close = vi.fn()
    useEditorStore.setState({
      editor: { AssetManager: { open, close } } as unknown as NonNullable<ReturnType<typeof useEditorStore.getState>['editor']>,
    })

    wrap(<StepForm step={makeStep()} onChange={vi.fn()} />)
    fireEvent.click(screen.getByTestId('step-asset-library-btn'))

    expect(open).toHaveBeenCalledTimes(1)
    const options = open.mock.calls[0][0] as { types: string[]; select: unknown }
    expect(options.types).toEqual(['image'])
    expect(typeof options.select).toBe('function')
  })

  it('Asset Library select callback patches screenshotUrl and closes the AM when complete=true', () => {
    const open = vi.fn()
    const close = vi.fn()
    useEditorStore.setState({
      editor: { AssetManager: { open, close } } as unknown as NonNullable<ReturnType<typeof useEditorStore.getState>['editor']>,
    })

    const onChange = vi.fn()
    wrap(<StepForm step={makeStep()} onChange={onChange} />)
    fireEvent.click(screen.getByTestId('step-asset-library-btn'))

    const options = open.mock.calls[0][0] as {
      select: (asset: { getSrc: () => string }, complete: boolean) => void
    }
    options.select({ getSrc: () => 'https://cdn/img.png' }, true)

    expect(onChange).toHaveBeenCalledWith({ screenshotUrl: 'https://cdn/img.png' })
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('Asset Library select with complete=false does not close the AM', () => {
    const open = vi.fn()
    const close = vi.fn()
    useEditorStore.setState({
      editor: { AssetManager: { open, close } } as unknown as NonNullable<ReturnType<typeof useEditorStore.getState>['editor']>,
    })

    const onChange = vi.fn()
    wrap(<StepForm step={makeStep()} onChange={onChange} />)
    fireEvent.click(screen.getByTestId('step-asset-library-btn'))

    const options = open.mock.calls[0][0] as {
      select: (asset: { getSrc: () => string }, complete: boolean) => void
    }
    options.select({ getSrc: () => 'https://cdn/img2.png' }, false)

    expect(onChange).toHaveBeenCalledWith({ screenshotUrl: 'https://cdn/img2.png' })
    expect(close).not.toHaveBeenCalled()
  })

  it('Asset Library button is disabled when editor is not available', () => {
    useEditorStore.setState({ editor: null })
    wrap(<StepForm step={makeStep()} onChange={vi.fn()} />)
    const btn = screen.getByTestId('step-asset-library-btn') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('Asset Library select with empty src does not emit onChange', () => {
    const open = vi.fn()
    const close = vi.fn()
    useEditorStore.setState({
      editor: { AssetManager: { open, close } } as unknown as NonNullable<ReturnType<typeof useEditorStore.getState>['editor']>,
    })

    const onChange = vi.fn()
    wrap(<StepForm step={makeStep()} onChange={onChange} />)
    fireEvent.click(screen.getByTestId('step-asset-library-btn'))

    const options = open.mock.calls[0][0] as {
      select: (asset: { getSrc: () => string }, complete: boolean) => void
    }
    options.select({ getSrc: () => '' }, true)

    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('StepForm — TD-014.7 Clear hotspot button', () => {
  it('renders a Clear hotspot button', () => {
    wrap(<StepForm step={makeStep()} onChange={vi.fn()} />)
    expect(screen.getByTestId('step-clear-hotspot-btn')).toBeDefined()
  })

  it('click resets hotspot to the zero-size sentinel while preserving position + tolerance', () => {
    const onChange = vi.fn()
    const step = makeStep({ hotspot: { x: 50, y: 60, width: 100, height: 80, tolerance: 15 } })
    wrap(<StepForm step={step} onChange={onChange} />)
    fireEvent.click(screen.getByTestId('step-clear-hotspot-btn'))
    expect(onChange).toHaveBeenCalledWith({
      hotspot: { x: 50, y: 60, width: 0, height: 0, tolerance: 15 },
    })
  })

  it('is disabled when the hotspot is already zero-size (already in draw-mode)', () => {
    const step = makeStep({ hotspot: { x: 0, y: 0, width: 0, height: 0, tolerance: 12 } })
    wrap(<StepForm step={step} onChange={vi.fn()} />)
    const btn = screen.getByTestId('step-clear-hotspot-btn') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('is enabled when the hotspot has size (edit-mode)', () => {
    const step = makeStep({ hotspot: { x: 10, y: 20, width: 80, height: 40, tolerance: 12 } })
    wrap(<StepForm step={step} onChange={vi.fn()} />)
    const btn = screen.getByTestId('step-clear-hotspot-btn') as HTMLButtonElement
    expect(btn.disabled).toBe(false)
  })

  it('is disabled when only height is zero (partial sentinel)', () => {
    const step = makeStep({ hotspot: { x: 10, y: 20, width: 80, height: 0, tolerance: 12 } })
    wrap(<StepForm step={step} onChange={vi.fn()} />)
    const btn = screen.getByTestId('step-clear-hotspot-btn') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })
})
