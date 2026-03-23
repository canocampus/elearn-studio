/**
 * Unit tests for courseTemplates.ts
 * Covers: applyTemplate, getUserTemplates, saveUserTemplate, deleteUserTemplate,
 * getAllTemplates, and the isValidTemplateWidget guard.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  applyTemplate,
  getUserTemplates,
  saveUserTemplate,
  deleteUserTemplate,
  getAllTemplates,
  BUILTIN_TEMPLATES,
  type CourseTemplate,
} from '../templates/courseTemplates'

// ── localStorage mock ─────────────────────────────────────────────────────────

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
  }
})()

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

beforeEach(() => {
  localStorageMock.clear()
  vi.clearAllMocks()
})

// ── applyTemplate ─────────────────────────────────────────────────────────────

describe('applyTemplate', () => {
  const tpl: CourseTemplate = {
    id: 'test-tpl',
    name: 'Test',
    description: 'desc',
    icon: '📖',
    isBuiltIn: true,
    slides: [
      {
        title: 'Slide A',
        widgets: [
          {
            type: 'text',
            bounds: { x: 0, y: 0, width: 200, height: 100 },
            layer: 0,
            visible: true,
            properties: { htmlContent: 'Hello' },
            extendedProperties: {},
          },
        ],
      },
    ],
  }

  it('generates fresh ids for each slide and widget', () => {
    const slides1 = applyTemplate(tpl)
    const slides2 = applyTemplate(tpl)
    expect(slides1[0].id).not.toBe(slides2[0].id)
    expect(slides1[0].widgets[0].id).not.toBe(slides2[0].widgets[0].id)
  })

  it('preserves slide title and widget type', () => {
    const [slide] = applyTemplate(tpl)
    expect(slide.title).toBe('Slide A')
    expect(slide.widgets[0].type).toBe('text')
  })

  it('adds empty actions array to each slide and widget', () => {
    const [slide] = applyTemplate(tpl)
    expect(slide.actions).toEqual([])
    expect(slide.widgets[0].actions).toEqual([])
  })

  it('filters out malformed widgets (missing bounds)', () => {
    const badTpl: CourseTemplate = {
      ...tpl,
      slides: [
        {
          title: 'Slide B',
          widgets: [
            // valid widget
            { type: 'text', bounds: { x: 0, y: 0, width: 100, height: 50 }, layer: 0, visible: true, properties: {}, extendedProperties: {} },
            // invalid — no bounds
            { type: 'text' } as never,
            // invalid — bounds fields are strings
            { type: 'text', bounds: { x: '0', y: 0, width: 100, height: 50 } } as never,
          ],
        },
      ],
    }
    const [slide] = applyTemplate(badTpl)
    expect(slide.widgets).toHaveLength(1)
    expect(slide.widgets[0].type).toBe('text')
  })

  it('filters out widgets with empty type string', () => {
    const badTpl: CourseTemplate = {
      ...tpl,
      slides: [{ title: 'S', widgets: [{ type: '', bounds: { x: 0, y: 0, width: 1, height: 1 }, layer: 0, visible: true, properties: {}, extendedProperties: {} }] }],
    }
    const [slide] = applyTemplate(badTpl)
    expect(slide.widgets).toHaveLength(0)
  })

  it('handles templates with zero slides', () => {
    const empty: CourseTemplate = { ...tpl, slides: [] }
    expect(applyTemplate(empty)).toEqual([])
  })
})

// ── getUserTemplates ──────────────────────────────────────────────────────────

describe('getUserTemplates', () => {
  it('returns empty array when localStorage is empty', () => {
    expect(getUserTemplates()).toEqual([])
  })

  it('returns parsed templates from localStorage', () => {
    const data: CourseTemplate[] = [{
      id: 'u1', name: 'My Tpl', description: 'd', icon: '★', isBuiltIn: false, slides: [],
    }]
    localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(data))
    expect(getUserTemplates()).toEqual(data)
  })

  it('returns empty array and logs error when JSON is invalid', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    localStorageMock.getItem.mockReturnValueOnce('{broken json}')
    const result = getUserTemplates()
    expect(result).toEqual([])
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Templates]'),
      expect.anything(),
    )
    consoleSpy.mockRestore()
  })

  it('returns empty array and logs error when localStorage.getItem throws', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    localStorageMock.getItem.mockImplementationOnce(() => { throw new Error('quota exceeded') })
    expect(getUserTemplates()).toEqual([])
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})

// ── saveUserTemplate ──────────────────────────────────────────────────────────

describe('saveUserTemplate', () => {
  it('saves a new template to localStorage', () => {
    const tpl: CourseTemplate = { id: 'u1', name: 'T', description: 'd', icon: '★', isBuiltIn: false, slides: [] }
    saveUserTemplate(tpl)
    const stored = JSON.parse(localStorageMock.setItem.mock.calls[0][1] as string) as CourseTemplate[]
    expect(stored).toHaveLength(1)
    expect(stored[0].id).toBe('u1')
  })

  it('replaces an existing template with the same id', () => {
    const tpl: CourseTemplate = { id: 'u1', name: 'Old', description: 'd', icon: '★', isBuiltIn: false, slides: [] }
    localStorageMock.getItem.mockReturnValueOnce(JSON.stringify([tpl]))
    const updated = { ...tpl, name: 'New' }
    saveUserTemplate(updated)
    const stored = JSON.parse(localStorageMock.setItem.mock.calls[0][1] as string) as CourseTemplate[]
    expect(stored).toHaveLength(1)
    expect(stored[0].name).toBe('New')
  })
})

// ── deleteUserTemplate ────────────────────────────────────────────────────────

describe('deleteUserTemplate', () => {
  it('removes the template with the given id', () => {
    const tpls: CourseTemplate[] = [
      { id: 'u1', name: 'A', description: '', icon: '', isBuiltIn: false, slides: [] },
      { id: 'u2', name: 'B', description: '', icon: '', isBuiltIn: false, slides: [] },
    ]
    localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(tpls))
    deleteUserTemplate('u1')
    const stored = JSON.parse(localStorageMock.setItem.mock.calls[0][1] as string) as CourseTemplate[]
    expect(stored).toHaveLength(1)
    expect(stored[0].id).toBe('u2')
  })

  it('no-ops when id not found', () => {
    const tpls: CourseTemplate[] = [
      { id: 'u1', name: 'A', description: '', icon: '', isBuiltIn: false, slides: [] },
    ]
    localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(tpls))
    deleteUserTemplate('nonexistent')
    const stored = JSON.parse(localStorageMock.setItem.mock.calls[0][1] as string) as CourseTemplate[]
    expect(stored).toHaveLength(1)
  })
})

// ── getAllTemplates ────────────────────────────────────────────────────────────

describe('getAllTemplates', () => {
  it('returns built-in templates when no user templates exist', () => {
    const all = getAllTemplates()
    expect(all.length).toBeGreaterThanOrEqual(BUILTIN_TEMPLATES.length)
    BUILTIN_TEMPLATES.forEach(bt => {
      expect(all.find(t => t.id === bt.id)).toBeTruthy()
    })
  })

  it('appends user templates after built-ins', () => {
    const userTpl: CourseTemplate = { id: 'u1', name: 'Mine', description: '', icon: '', isBuiltIn: false, slides: [] }
    localStorageMock.getItem.mockReturnValueOnce(JSON.stringify([userTpl]))
    const all = getAllTemplates()
    const lastItem = all[all.length - 1]
    expect(lastItem.id).toBe('u1')
    expect(all.length).toBe(BUILTIN_TEMPLATES.length + 1)
  })
})

// ── BUILTIN_TEMPLATES ─────────────────────────────────────────────────────────

describe('BUILTIN_TEMPLATES', () => {
  it('has at least 4 built-in templates', () => {
    expect(BUILTIN_TEMPLATES.length).toBeGreaterThanOrEqual(4)
  })

  it('each built-in has required fields', () => {
    for (const t of BUILTIN_TEMPLATES) {
      expect(typeof t.id).toBe('string')
      expect(typeof t.name).toBe('string')
      expect(t.isBuiltIn).toBe(true)
      expect(Array.isArray(t.slides)).toBe(true)
    }
  })
})
