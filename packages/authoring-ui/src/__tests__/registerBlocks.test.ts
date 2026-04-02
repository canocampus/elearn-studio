/**
 * Unit tests for registerBlocks.ts — T012.1 / T012.2 / T012.3 / T600.2
 *
 * Verifies that registerBlocks() correctly registers all widget block and
 * component types with GrapesJS without throwing, and that each type is
 * registered with the expected metadata.
 *
 * T600.2 — Image widget view: resolveAndSetSrc behavior
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { registerBlocks } from '../editor/registerBlocks'
import type { Editor } from 'grapesjs'

// ---------------------------------------------------------------------------
// Mock courseApi so resolveAssetUrl is controllable in T600.2
// ---------------------------------------------------------------------------

vi.mock('../api/courseApi', () => ({
  resolveAssetUrl: vi.fn(),
}))

import { resolveAssetUrl } from '../api/courseApi'
const mockResolveAssetUrl = vi.mocked(resolveAssetUrl)

// ---------------------------------------------------------------------------
// Mock GrapesJS editor
// ---------------------------------------------------------------------------

function makeMockEditor() {
  const blocks: Map<string, Record<string, unknown>> = new Map()
  const components: Map<string, Record<string, unknown>> = new Map()

  const editor = {
    BlockManager: {
      add: vi.fn((id: string, opts: Record<string, unknown>) => {
        blocks.set(id, opts)
      }),
    },
    Components: {
      addType: vi.fn((id: string, opts: Record<string, unknown>) => {
        components.set(id, opts)
      }),
    },
    AssetManager: {
      open: vi.fn(),
      close: vi.fn(),
    },
    getSelected: vi.fn().mockReturnValue(null),
    _blocks: blocks,
    _components: components,
  } as unknown as Editor & {
    _blocks: Map<string, Record<string, unknown>>
    _components: Map<string, Record<string, unknown>>
  }

  return editor
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type MockEditor = ReturnType<typeof makeMockEditor>

function getBlock(editor: MockEditor, id: string) {
  return editor._blocks.get(id)
}

function getComponent(editor: MockEditor, id: string) {
  return editor._components.get(id)
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('registerBlocks', () => {
  let editor: MockEditor

  beforeEach(() => {
    editor = makeMockEditor()
    registerBlocks(editor as unknown as Editor)
  })

  // -------------------------------------------------------------------------
  // Does not throw
  // -------------------------------------------------------------------------

  it('registers without throwing', () => {
    expect(() => registerBlocks(makeMockEditor() as unknown as Editor)).not.toThrow()
  })

  // -------------------------------------------------------------------------
  // T012.1 — Basic widgets
  // -------------------------------------------------------------------------

  describe('T012.1 — Basic widgets', () => {
    it('registers text block in "Basic" category', () => {
      const block = getBlock(editor, 'text')
      expect(block).toBeDefined()
      expect(block?.category).toBe('Basic')
      expect(block?.label).toBe('Text')
      expect(block?.content).toMatchObject({ type: 'text' })
    })

    it('registers text component type', () => {
      const comp = getComponent(editor, 'text')
      expect(comp).toBeDefined()
    })

    it('text component has editable:true for double-click editing (T012.7)', () => {
      const comp = getComponent(editor, 'text')
      const defaults = (comp?.model as Record<string, unknown>)?.defaults as Record<string, unknown>
      expect(defaults?.editable).toBe(true)
    })

    it('registers image block in "Basic" category', () => {
      const block = getBlock(editor, 'image')
      expect(block).toBeDefined()
      expect(block?.category).toBe('Basic')
      expect(block?.label).toBe('Image')
    })

    it('registers image component type with view (T012.8)', () => {
      const comp = getComponent(editor, 'image')
      expect(comp).toBeDefined()
      expect((comp as Record<string, unknown>)?.view).toBeDefined()
    })

    it('registers button block in "Basic" category', () => {
      const block = getBlock(editor, 'button')
      expect(block).toBeDefined()
      expect(block?.category).toBe('Basic')
      expect(block?.label).toBe('Button')
    })

    it('button component exposes content trait for label editing (T012.9)', () => {
      const comp = getComponent(editor, 'button')
      const defaults = (comp?.model as Record<string, unknown>)?.defaults as Record<string, unknown>
      const traits = defaults?.traits as Array<Record<string, string>>
      expect(traits).toContainEqual(expect.objectContaining({ name: 'content', label: 'Label' }))
    })

    it('registers rectangle block in "Basic" category', () => {
      const block = getBlock(editor, 'rectangle')
      expect(block).toBeDefined()
      expect(block?.category).toBe('Basic')
      expect(block?.label).toBe('Rectangle')
    })
  })

  // -------------------------------------------------------------------------
  // T012.2 — Navigation and Assessment widgets
  // -------------------------------------------------------------------------

  describe('T012.2 — Navigation and Assessment widgets', () => {
    it('registers nav-buttons block in "Navigation" category', () => {
      const block = getBlock(editor, 'nav-buttons')
      expect(block).toBeDefined()
      expect(block?.category).toBe('Navigation')
      expect(block?.label).toBe('Nav Buttons')
    })

    it('registers done-button block in "Navigation" category', () => {
      const block = getBlock(editor, 'done-button')
      expect(block).toBeDefined()
      expect(block?.category).toBe('Navigation')
      expect(block?.label).toBe('Done Button')
    })

    it('registers score-quiz block in "Assessment" category', () => {
      const block = getBlock(editor, 'score-quiz')
      expect(block).toBeDefined()
      expect(block?.category).toBe('Assessment')
      expect(block?.label).toBe('Quiz Score')
    })

    it('registers score-field block in "Assessment" category', () => {
      const block = getBlock(editor, 'score-field')
      expect(block).toBeDefined()
      expect(block?.category).toBe('Assessment')
      expect(block?.label).toBe('Score Field')
    })
  })

  // -------------------------------------------------------------------------
  // T012.3 — Media widget
  // -------------------------------------------------------------------------

  describe('T012.3 — Media widget', () => {
    it('registers media-player block in "Media" category', () => {
      const block = getBlock(editor, 'media-player')
      expect(block).toBeDefined()
      expect(block?.category).toBe('Media')
      expect(block?.label).toBe('Media Player')
    })

    it('media-player component has src and mediaType traits', () => {
      const comp = getComponent(editor, 'media-player')
      const defaults = (comp?.model as Record<string, unknown>)?.defaults as Record<string, unknown>
      const traits = defaults?.traits as Array<Record<string, string>>
      expect(traits).toContainEqual(expect.objectContaining({ name: 'src' }))
      expect(traits).toContainEqual(expect.objectContaining({ name: 'mediaType' }))
    })
  })

  // -------------------------------------------------------------------------
  // T012.4 — All blocks present in the expected categories
  // -------------------------------------------------------------------------

  describe('T012.4 — All expected blocks are registered', () => {
    const EXPECTED_BLOCKS = [
      'text',
      'image',
      'button',
      'rectangle',
      'nav-buttons',
      'done-button',
      'score-quiz',
      'score-field',
      'media-player',
    ]

    for (const id of EXPECTED_BLOCKS) {
      it(`block "${id}" is registered`, () => {
        expect(getBlock(editor, id)).toBeDefined()
      })
    }
  })

  // -------------------------------------------------------------------------
  // T012.10 — All component types expose a "name" trait
  // -------------------------------------------------------------------------

  describe('T012.10 — All components expose a name trait', () => {
    const COMPONENT_TYPES = [
      'text',
      'image',
      'button',
      'rectangle',
      'nav-buttons',
      'done-button',
      'score-quiz',
      'score-field',
      'media-player',
    ]

    for (const type of COMPONENT_TYPES) {
      it(`component "${type}" has a name trait`, () => {
        const comp = getComponent(editor, type)
        const defaults = (comp?.model as Record<string, unknown>)?.defaults as Record<string, unknown>
        const traits = defaults?.traits as Array<Record<string, string>>
        expect(traits).toContainEqual(expect.objectContaining({ name: 'name' }))
      })
    }
  })

  // -------------------------------------------------------------------------
  // T012.11 — All component types declare properties/elearnActions/extendedProperties
  //           in defaults so GrapesJS Backbone.Model reliably persists them.
  // -------------------------------------------------------------------------

  describe('T012.11 — All component defaults declare custom persistence fields', () => {
    const ALL_COMPONENT_TYPES = [
      'text',
      'image',
      'button',
      'rectangle',
      'nav-buttons',
      'done-button',
      'score-quiz',
      'score-field',
      'media-player',
      'screenshot-sim',
      'phaser-sim',
      'question-mc',
      'question-tf',
      'question-fill',
    ]

    for (const type of ALL_COMPONENT_TYPES) {
      it(`component "${type}" defaults include properties: {}`, () => {
        const comp = getComponent(editor, type)
        const defaults = (comp?.model as Record<string, unknown>)?.defaults as Record<string, unknown>
        expect(defaults).toHaveProperty('properties')
        expect(defaults?.properties).toEqual({})
      })

      it(`component "${type}" defaults include elearnActions: []`, () => {
        const comp = getComponent(editor, type)
        const defaults = (comp?.model as Record<string, unknown>)?.defaults as Record<string, unknown>
        expect(defaults).toHaveProperty('elearnActions')
        expect(defaults?.elearnActions).toEqual([])
      })

      it(`component "${type}" defaults include extendedProperties`, () => {
        const comp = getComponent(editor, type)
        const defaults = (comp?.model as Record<string, unknown>)?.defaults as Record<string, unknown>
        expect(defaults).toHaveProperty('extendedProperties')
        expect(typeof defaults?.extendedProperties).toBe('object')
      })
    }
  })

  // -------------------------------------------------------------------------
  // T012.5 — Components have sensible default styles for canvas preview
  // -------------------------------------------------------------------------

  describe('T012.5 — Component default styles are registered', () => {
    // position:absolute is injected by grapesjsFromWidgets (converters.ts) at load time,
    // not stored in component defaults — free-form drag & drop canvas intentional design.
    const STYLED_TYPES = ['text', 'image', 'button', 'rectangle', 'media-player']

    for (const type of STYLED_TYPES) {
      it(`component "${type}" default style has z-index`, () => {
        const comp = getComponent(editor, type)
        const defaults = (comp?.model as Record<string, unknown>)?.defaults as Record<string, unknown>
        const style = defaults?.style as Record<string, string>
        expect(style?.['z-index']).toBeDefined()
      })

      it(`component "${type}" default style has width and height`, () => {
        const comp = getComponent(editor, type)
        const defaults = (comp?.model as Record<string, unknown>)?.defaults as Record<string, unknown>
        const style = defaults?.style as Record<string, string>
        expect(style?.width).toBeDefined()
        expect(style?.height).toBeDefined()
      })
    }
  })
})

// ---------------------------------------------------------------------------
// T600.2 — Image widget view: resolveAndSetSrc behavior
// ---------------------------------------------------------------------------

describe('T600.2 — image widget resolveAndSetSrc', () => {
  let imageView: Record<string, unknown>
  let mockEl: { setAttribute: ReturnType<typeof vi.fn>; src: string }
  let mockModel: { get: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    mockResolveAssetUrl.mockReset()

    const localEditor = makeMockEditor()
    registerBlocks(localEditor as unknown as Editor)
    const comp = getComponent(localEditor, 'image')
    imageView = (comp as Record<string, unknown>)?.view as Record<string, unknown>

    mockEl = { setAttribute: vi.fn(), src: '', isConnected: true }
    mockModel = { get: vi.fn() }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('does nothing when src does not start with /assets/', () => {
    mockModel.get.mockReturnValue('https://external.example.com/image.png')

    const fakeThis = { model: mockModel, el: mockEl }
    ;(imageView.resolveAndSetSrc as (this: unknown) => void).call(fakeThis)

    expect(mockResolveAssetUrl).not.toHaveBeenCalled()
    expect(mockEl.setAttribute).not.toHaveBeenCalled()
  })

  it('does nothing when src is empty string', () => {
    mockModel.get.mockReturnValue('')

    const fakeThis = { model: mockModel, el: mockEl }
    ;(imageView.resolveAndSetSrc as (this: unknown) => void).call(fakeThis)

    expect(mockResolveAssetUrl).not.toHaveBeenCalled()
  })

  it('calls resolveAssetUrl with objectName and sets el src on success', async () => {
    mockModel.get.mockReturnValue('/assets/my-folder/photo.jpg')
    mockResolveAssetUrl.mockResolvedValue('https://s3.example.com/presigned-url?sig=abc')

    const fakeThis = { model: mockModel, el: mockEl }
    ;(imageView.resolveAndSetSrc as (this: unknown) => void).call(fakeThis)

    expect(mockResolveAssetUrl).toHaveBeenCalledWith('my-folder/photo.jpg')

    // Wait for the promise microtask to resolve
    await vi.waitFor(() => {
      expect(mockEl.setAttribute).toHaveBeenCalledWith('src', 'https://s3.example.com/presigned-url?sig=abc')
    })
  })

  it('does not throw when resolveAssetUrl rejects', async () => {
    mockModel.get.mockReturnValue('/assets/broken.png')
    mockResolveAssetUrl.mockRejectedValue(new Error('Network error'))

    const fakeThis = { model: mockModel, el: mockEl }

    await expect(async () => {
      ;(imageView.resolveAndSetSrc as (this: unknown) => void).call(fakeThis)
      // Allow the rejected promise to settle without surfacing as unhandled
      await new Promise(resolve => setTimeout(resolve, 10))
    }).not.toThrow()

    expect(mockEl.setAttribute).not.toHaveBeenCalled()
  })

  // ---- T702 ----

  it('T702.1: does not call setAttribute when el is no longer connected to the DOM', async () => {
    mockModel.get.mockReturnValue('/assets/photo.jpg')
    mockResolveAssetUrl.mockResolvedValue('https://s3.example.com/presigned')
    const disconnectedEl = { setAttribute: vi.fn(), isConnected: false }
    const fakeThis = { model: mockModel, el: disconnectedEl }
    ;(imageView.resolveAndSetSrc as (this: unknown) => void).call(fakeThis)
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(disconnectedEl.setAttribute).not.toHaveBeenCalled()
  })

  it('T702.2: calls setAttribute when el is still connected to the DOM', async () => {
    mockModel.get.mockReturnValue('/assets/photo.jpg')
    mockResolveAssetUrl.mockResolvedValue('https://s3.example.com/presigned')
    const connectedEl = { setAttribute: vi.fn(), isConnected: true }
    const fakeThis = { model: mockModel, el: connectedEl }
    ;(imageView.resolveAndSetSrc as (this: unknown) => void).call(fakeThis)
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(connectedEl.setAttribute).toHaveBeenCalledWith('src', 'https://s3.example.com/presigned')
  })

  it('T702.3: logs console.warn with objectName and error when resolveAssetUrl rejects', async () => {
    mockModel.get.mockReturnValue('/assets/broken.png')
    const networkErr = new Error('Network error')
    mockResolveAssetUrl.mockRejectedValue(networkErr)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fakeThis = { model: mockModel, el: { ...mockEl, isConnected: true } }
    ;(imageView.resolveAndSetSrc as (this: unknown) => void).call(fakeThis)
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[registerBlocks] resolveAndSetSrc failed for'),
      'broken.png',
      '—',
      networkErr.message,
    )
    warnSpy.mockRestore()
  })

  it('initialize() registers a change:src listener that triggers resolveAndSetSrc', () => {
    let capturedHandler: (() => void) | null = null
    const mockListenTo = vi.fn((_model: unknown, _event: string, handler: () => void) => {
      capturedHandler = handler
    })
    mockModel.get.mockReturnValue('/assets/slide/widget.png')
    mockResolveAssetUrl.mockResolvedValue('https://s3.example.com/widget-presigned')

    // The initialize() implementation calls Object.getPrototypeOf(Object.getPrototypeOf(this))
    // to reach the grandparent prototype. A plain object literal would make that null.
    // Create a two-level prototype chain so the lookup returns a non-null object.
    const fakeThis = Object.assign(Object.create(Object.create({})), {
      model: mockModel,
      el: mockEl,
      listenTo: mockListenTo,
      resolveAndSetSrc: function (this: unknown) {
        ;(imageView.resolveAndSetSrc as (this: unknown) => void).call(this)
      },
    })

    ;(imageView.initialize as (this: unknown, props: unknown) => void).call(fakeThis, {})

    expect(mockListenTo).toHaveBeenCalledWith(
      mockModel,
      'change:src',
      expect.any(Function),
    )

    // Simulate the model emitting change:src
    expect(capturedHandler).not.toBeNull()
    capturedHandler!()

    expect(mockResolveAssetUrl).toHaveBeenCalledWith('slide/widget.png')
  })
})

// ---------------------------------------------------------------------------
// T701 — buildMCPreviewHTML / buildTFPreviewHTML / buildFillPreviewHTML
//         null/content edge cases
// ---------------------------------------------------------------------------

import {
  buildMCPreviewHTML,
  buildTFPreviewHTML,
  buildFillPreviewHTML,
} from '../editor/registerQuestionBlocks'
import type { MCExtendedProps, TFExtendedProps, FillExtendedProps } from '../types/questions'

describe('T701 — buildMCPreviewHTML null/empty guards', () => {
  it('T701.2: does not throw when extendedProperties is empty object (no answers, no questionText)', () => {
    expect(() => buildMCPreviewHTML({} as MCExtendedProps)).not.toThrow()
    const html = buildMCPreviewHTML({} as MCExtendedProps)
    expect(html).toContain('</div>')
  })

  it('T701.3: does not throw when options is null', () => {
    expect(() => buildMCPreviewHTML({ options: null } as unknown as MCExtendedProps)).not.toThrow()
  })

  it('renders fallback question text when questionText is absent', () => {
    const html = buildMCPreviewHTML({} as MCExtendedProps)
    expect(html).toContain('Question')
  })

  it('renders provided questionText and options when fully populated', () => {
    const ep: MCExtendedProps = {
      questionText: 'What is 2+2?',
      options: [
        { id: '1', text: 'Three', isCorrect: false },
        { id: '2', text: 'Four', isCorrect: true },
      ],
      feedbackCorrect: 'Correct!',
      feedbackIncorrect: 'Wrong.',
      scoring: { weight: 50, attempts: 2 },
    }
    const html = buildMCPreviewHTML(ep)
    expect(html).toContain('What is 2+2?')
    expect(html).toContain('Four')
    expect(html).toContain('50pts')
    expect(html).toContain('2 attempt(s)')
  })
})

describe('T701 — buildTFPreviewHTML null/empty guards', () => {
  it('does not throw when extendedProperties is empty object', () => {
    expect(() => buildTFPreviewHTML({} as TFExtendedProps)).not.toThrow()
  })

  it('renders fallback question text when questionText is absent', () => {
    const html = buildTFPreviewHTML({} as TFExtendedProps)
    expect(html).toContain('Question')
  })
})

describe('T701 — buildFillPreviewHTML null/empty guards', () => {
  it('does not throw when extendedProperties is empty object', () => {
    expect(() => buildFillPreviewHTML({} as FillExtendedProps)).not.toThrow()
  })

  it('does not throw when answers is null', () => {
    expect(() => buildFillPreviewHTML({ answers: null } as unknown as FillExtendedProps)).not.toThrow()
  })

  it('renders fallback question text when questionText is absent', () => {
    const html = buildFillPreviewHTML({} as FillExtendedProps)
    expect(html).toContain('Question')
  })
})

