/**
 * Unit tests for registerBlocks.ts — T012.1 / T012.2 / T012.3
 *
 * Verifies that registerBlocks() correctly registers all widget block and
 * component types with GrapesJS without throwing, and that each type is
 * registered with the expected metadata.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { registerBlocks } from '../editor/registerBlocks'
import type { Editor } from 'grapesjs'

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
  // T012.5 — Components have sensible default styles for canvas preview
  // -------------------------------------------------------------------------

  describe('T012.5 — Component default styles include position:absolute', () => {
    const STYLED_TYPES = ['text', 'image', 'button', 'rectangle', 'media-player']

    for (const type of STYLED_TYPES) {
      it(`component "${type}" default style has position:absolute`, () => {
        const comp = getComponent(editor, type)
        const defaults = (comp?.model as Record<string, unknown>)?.defaults as Record<string, unknown>
        const style = defaults?.style as Record<string, string>
        expect(style?.position).toBe('absolute')
      })
    }
  })
})
