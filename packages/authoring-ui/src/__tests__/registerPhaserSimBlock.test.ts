/**
 * Unit tests for registerPhaserSimBlock.ts — T034
 *
 * Verifies block registration, component type defaults, and that the phaser-sim
 * block appears in the 'Simulations' category with the correct default extendedProperties.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { registerPhaserSimBlock } from '../editor/registerPhaserSimBlock'
import type { Editor } from 'grapesjs'
import { PHASER_SIM_DEFAULT_EXTENDED } from '../types/phaserSim'

// ---------------------------------------------------------------------------
// Mock GrapesJS editor
// ---------------------------------------------------------------------------

function makeMockEditor() {
  const blocks: Map<string, Record<string, unknown>> = new Map()
  const components: Map<string, Record<string, unknown>> = new Map()

  const editor = {
    BlockManager: {
      add: vi.fn((id: string, opts: Record<string, unknown>) => { blocks.set(id, opts) }),
    },
    Components: {
      addType: vi.fn((id: string, opts: Record<string, unknown>) => { components.set(id, opts) }),
    },
    _blocks: blocks,
    _components: components,
  } as unknown as Editor & {
    _blocks: Map<string, Record<string, unknown>>
    _components: Map<string, Record<string, unknown>>
  }

  return editor
}

type MockEditor = ReturnType<typeof makeMockEditor>

describe('registerPhaserSimBlock', () => {
  let editor: MockEditor

  beforeEach(() => {
    editor = makeMockEditor()
    registerPhaserSimBlock(editor as unknown as Editor)
  })

  // ── Block Manager ──────────────────────────────────────────────────────────

  describe('BlockManager.add', () => {
    it('registers a block with id "phaser-sim"', () => {
      expect(editor.BlockManager.add).toHaveBeenCalledWith('phaser-sim', expect.anything())
    })

    it('block is in the Simulations category', () => {
      const block = editor._blocks.get('phaser-sim') as { category: string }
      expect(block.category).toBe('Simulations')
    })

    it('block content references the phaser-sim component type', () => {
      const block = editor._blocks.get('phaser-sim') as { content: { type: string } }
      expect(block.content.type).toBe('phaser-sim')
    })

    it('block has a label', () => {
      const block = editor._blocks.get('phaser-sim') as { label: string }
      expect(block.label).toBeTruthy()
    })

    it('block has an SVG icon', () => {
      const block = editor._blocks.get('phaser-sim') as { media: string }
      expect(block.media).toContain('<svg')
    })
  })

  // ── Component Type ─────────────────────────────────────────────────────────

  describe('Components.addType', () => {
    it('registers a component type with id "phaser-sim"', () => {
      expect(editor.Components.addType).toHaveBeenCalledWith('phaser-sim', expect.anything())
    })

    function getDefaults(): Record<string, unknown> {
      const reg = editor._components.get('phaser-sim') as {
        model: { defaults: Record<string, unknown> }
      }
      return reg.model.defaults
    }

    it('component tagName is div', () => {
      expect(getDefaults().tagName).toBe('div')
    })

    it('component is not droppable', () => {
      expect(getDefaults().droppable).toBe(false)
    })

    it('default extendedProperties matches PHASER_SIM_DEFAULT_EXTENDED', () => {
      const ep = getDefaults().extendedProperties as typeof PHASER_SIM_DEFAULT_EXTENDED
      expect(ep.simType).toBe(PHASER_SIM_DEFAULT_EXTENDED.simType)
      expect(ep.mode).toBe(PHASER_SIM_DEFAULT_EXTENDED.mode)
      expect(ep.passingScore).toBe(PHASER_SIM_DEFAULT_EXTENDED.passingScore)
    })

    it('default style has z-index (position:absolute is injected by converters.ts at load time)', () => {
      const style = getDefaults().style as Record<string, string>
      expect(style['z-index']).toBeDefined()
    })

    it('default width is 800px', () => {
      const style = getDefaults().style as Record<string, string>
      expect(style.width).toBe('800px')
    })

    it('default height is 500px', () => {
      const style = getDefaults().style as Record<string, string>
      expect(style.height).toBe('500px')
    })

    it('component has placeholder content HTML', () => {
      const content = getDefaults().content as string
      expect(content).toContain('Phaser Simulation')
    })
  })
})
