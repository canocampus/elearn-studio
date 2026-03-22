/**
 * Unit tests for registerQuestionBlocks.ts — T014.1 / T014.2
 *
 * Verifies:
 *   - All three question blocks (question-mc, question-tf, question-fill) are registered.
 *   - Each block is in the 'Questions' category.
 *   - Each component type has correct extendedProperties defaults.
 *   - Canvas preview HTML builders produce valid output.
 *   - Preview builders escape HTML to prevent XSS.
 */

import { describe, it, expect, vi } from 'vitest'
import { registerQuestionBlocks } from '../editor/registerQuestionBlocks'
import { buildMCPreviewHTML, buildTFPreviewHTML, buildFillPreviewHTML } from '../editor/registerQuestionBlocks'
import { MC_DEFAULT_EXTENDED, TF_DEFAULT_EXTENDED, FILL_DEFAULT_EXTENDED } from '../types/questions'
import type { MCExtendedProps, TFExtendedProps, FillExtendedProps } from '../types/questions'
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
    _blocks: blocks,
    _components: components,
  } as unknown as Editor & {
    _blocks: Map<string, Record<string, unknown>>
    _components: Map<string, Record<string, unknown>>
  }

  return editor
}

type MockEditor = ReturnType<typeof makeMockEditor>

function getBlock(editor: MockEditor, id: string) {
  return editor._blocks.get(id)
}

function getComponent(editor: MockEditor, id: string) {
  return editor._components.get(id)
}

function getDefaults(editor: MockEditor, id: string): Record<string, unknown> {
  const comp = getComponent(editor, id)
  return ((comp?.model as Record<string, unknown>)?.defaults as Record<string, unknown>) ?? {}
}

// ---------------------------------------------------------------------------
// Registration tests (T014.1)
// ---------------------------------------------------------------------------

describe('registerQuestionBlocks — T014.1 registration', () => {
  let editor: MockEditor

  beforeEach(() => {
    editor = makeMockEditor()
    registerQuestionBlocks(editor as unknown as Editor)
  })

  it('does not throw', () => {
    expect(() =>
      registerQuestionBlocks(makeMockEditor() as unknown as Editor),
    ).not.toThrow()
  })

  // ---- question-mc ----

  it('registers question-mc block in Questions category', () => {
    const block = getBlock(editor, 'question-mc')
    expect(block).toBeDefined()
    expect(block?.category).toBe('Questions')
    expect(block?.label).toBe('Multiple Choice')
    expect(block?.content).toMatchObject({ type: 'question-mc' })
  })

  it('registers question-mc component type', () => {
    expect(getComponent(editor, 'question-mc')).toBeDefined()
  })

  it('question-mc component has MC_DEFAULT_EXTENDED as extendedProperties default', () => {
    const defaults = getDefaults(editor, 'question-mc')
    expect(defaults.extendedProperties).toEqual(MC_DEFAULT_EXTENDED)
  })

  it('question-mc component has name "Multiple Choice"', () => {
    const defaults = getDefaults(editor, 'question-mc')
    expect(defaults.name).toBe('Multiple Choice')
  })

  it('question-mc component is not droppable', () => {
    const defaults = getDefaults(editor, 'question-mc')
    expect(defaults.droppable).toBe(false)
  })

  // ---- question-tf ----

  it('registers question-tf block in Questions category', () => {
    const block = getBlock(editor, 'question-tf')
    expect(block).toBeDefined()
    expect(block?.category).toBe('Questions')
    expect(block?.label).toBe('True / False')
    expect(block?.content).toMatchObject({ type: 'question-tf' })
  })

  it('registers question-tf component type', () => {
    expect(getComponent(editor, 'question-tf')).toBeDefined()
  })

  it('question-tf component has TF_DEFAULT_EXTENDED as extendedProperties default', () => {
    const defaults = getDefaults(editor, 'question-tf')
    expect(defaults.extendedProperties).toEqual(TF_DEFAULT_EXTENDED)
  })

  it('question-tf component has name "True / False"', () => {
    const defaults = getDefaults(editor, 'question-tf')
    expect(defaults.name).toBe('True / False')
  })

  it('question-tf component is not droppable', () => {
    const defaults = getDefaults(editor, 'question-tf')
    expect(defaults.droppable).toBe(false)
  })

  // ---- question-fill ----

  it('registers question-fill block in Questions category', () => {
    const block = getBlock(editor, 'question-fill')
    expect(block).toBeDefined()
    expect(block?.category).toBe('Questions')
    expect(block?.label).toBe('Fill in the Blank')
    expect(block?.content).toMatchObject({ type: 'question-fill' })
  })

  it('registers question-fill component type', () => {
    expect(getComponent(editor, 'question-fill')).toBeDefined()
  })

  it('question-fill component has FILL_DEFAULT_EXTENDED as extendedProperties default', () => {
    const defaults = getDefaults(editor, 'question-fill')
    expect(defaults.extendedProperties).toEqual(FILL_DEFAULT_EXTENDED)
  })

  it('question-fill component has name "Fill in the Blank"', () => {
    const defaults = getDefaults(editor, 'question-fill')
    expect(defaults.name).toBe('Fill in the Blank')
  })

  it('question-fill component is not droppable', () => {
    const defaults = getDefaults(editor, 'question-fill')
    expect(defaults.droppable).toBe(false)
  })

  // ---- view presence ----

  it('all question component types have a view defined', () => {
    for (const type of ['question-mc', 'question-tf', 'question-fill']) {
      const comp = getComponent(editor, type)
      expect((comp as Record<string, unknown>)?.view).toBeDefined()
    }
  })
})

// ---------------------------------------------------------------------------
// Canvas preview HTML builders (T014.2)
// ---------------------------------------------------------------------------

describe('buildMCPreviewHTML — T014.2', () => {
  it('renders questionText', () => {
    const html = buildMCPreviewHTML(MC_DEFAULT_EXTENDED)
    expect(html).toContain(MC_DEFAULT_EXTENDED.questionText)
  })

  it('renders all option texts', () => {
    const html = buildMCPreviewHTML(MC_DEFAULT_EXTENDED)
    for (const opt of MC_DEFAULT_EXTENDED.options) {
      expect(html).toContain(opt.text)
    }
  })

  it('highlights correct option with indigo color', () => {
    const ep: MCExtendedProps = {
      ...MC_DEFAULT_EXTENDED,
      options: [
        { id: '1', text: 'Right', isCorrect: true },
        { id: '2', text: 'Wrong', isCorrect: false },
      ],
    }
    const html = buildMCPreviewHTML(ep)
    // Correct option border/background uses #4f46e5
    expect(html).toContain('#4f46e5')
  })

  it('shows weight and attempts in hint', () => {
    const html = buildMCPreviewHTML(MC_DEFAULT_EXTENDED)
    expect(html).toContain(`${MC_DEFAULT_EXTENDED.scoring.weight}pts`)
    expect(html).toContain('Unlimited attempts')
  })

  it('shows numeric attempts when not -1', () => {
    const ep: MCExtendedProps = {
      ...MC_DEFAULT_EXTENDED,
      scoring: { weight: 50, attempts: 3 },
    }
    const html = buildMCPreviewHTML(ep)
    expect(html).toContain('3 attempt(s)')
  })

  it('escapes HTML in questionText to prevent XSS', () => {
    const ep: MCExtendedProps = {
      ...MC_DEFAULT_EXTENDED,
      questionText: '<script>alert("xss")</script>',
    }
    const html = buildMCPreviewHTML(ep)
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('escapes HTML in option text', () => {
    const ep: MCExtendedProps = {
      ...MC_DEFAULT_EXTENDED,
      options: [{ id: '1', text: '<b>Bold</b>', isCorrect: false }],
    }
    const html = buildMCPreviewHTML(ep)
    expect(html).not.toContain('<b>')
    expect(html).toContain('&lt;b&gt;')
  })
})

describe('buildTFPreviewHTML — T014.2', () => {
  it('renders questionText', () => {
    const html = buildTFPreviewHTML(TF_DEFAULT_EXTENDED)
    expect(html).toContain(TF_DEFAULT_EXTENDED.questionText)
  })

  it('renders True and False buttons', () => {
    const html = buildTFPreviewHTML(TF_DEFAULT_EXTENDED)
    expect(html).toContain('True')
    expect(html).toContain('False')
  })

  it('highlights True when correctAnswer is true', () => {
    const ep: TFExtendedProps = { ...TF_DEFAULT_EXTENDED, correctAnswer: true }
    const html = buildTFPreviewHTML(ep)
    // Green color for correct button
    expect(html).toContain('#16a34a')
  })

  it('highlights False when correctAnswer is false', () => {
    const ep: TFExtendedProps = { ...TF_DEFAULT_EXTENDED, correctAnswer: false }
    const html = buildTFPreviewHTML(ep)
    expect(html).toContain('#16a34a')
  })

  it('shows weight in hint', () => {
    const html = buildTFPreviewHTML(TF_DEFAULT_EXTENDED)
    expect(html).toContain(`${TF_DEFAULT_EXTENDED.scoring.weight}pts`)
  })

  it('escapes HTML in questionText', () => {
    const ep: TFExtendedProps = {
      ...TF_DEFAULT_EXTENDED,
      questionText: '<img src=x onerror=alert(1)>',
    }
    const html = buildTFPreviewHTML(ep)
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img')
  })
})

describe('buildFillPreviewHTML — T014.2', () => {
  it('renders questionText', () => {
    const html = buildFillPreviewHTML(FILL_DEFAULT_EXTENDED)
    expect(html).toContain('capital of France')
  })

  it('renders a blank underline element when ___ present', () => {
    const html = buildFillPreviewHTML(FILL_DEFAULT_EXTENDED)
    // The blank is replaced with a span underline; ___ should not appear literally
    expect(html).toContain('border-bottom')
    expect(html).not.toContain('___')
  })

  it('appends blank when no ___ in questionText', () => {
    const ep: FillExtendedProps = {
      ...FILL_DEFAULT_EXTENDED,
      questionText: 'What is the answer',
    }
    const html = buildFillPreviewHTML(ep)
    expect(html).toContain('border-bottom')
    expect(html).toContain('What is the answer')
  })

  it('shows weight in hint', () => {
    const html = buildFillPreviewHTML(FILL_DEFAULT_EXTENDED)
    expect(html).toContain(`${FILL_DEFAULT_EXTENDED.scoring.weight}pts`)
  })

  it('escapes HTML in questionText', () => {
    const ep: FillExtendedProps = {
      ...FILL_DEFAULT_EXTENDED,
      questionText: '<script>alert(1)</script> is ___',
    }
    const html = buildFillPreviewHTML(ep)
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })
})

// ---------------------------------------------------------------------------
// questions.ts type guards
// ---------------------------------------------------------------------------

describe('isQuestionWidgetType', () => {
  it('returns true for all question widget types', async () => {
    const { isQuestionWidgetType } = await import('../types/questions')
    expect(isQuestionWidgetType('question-mc')).toBe(true)
    expect(isQuestionWidgetType('question-tf')).toBe(true)
    expect(isQuestionWidgetType('question-fill')).toBe(true)
  })

  it('returns false for non-question types', async () => {
    const { isQuestionWidgetType } = await import('../types/questions')
    expect(isQuestionWidgetType('text')).toBe(false)
    expect(isQuestionWidgetType('image')).toBe(false)
    expect(isQuestionWidgetType('')).toBe(false)
  })
})
