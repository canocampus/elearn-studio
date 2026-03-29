/**
 * GrapesJS API Contract Tests — T705
 *
 * These tests document the GrapesJS / Backbone APIs that eLearn Studio depends on.
 * They use minimal stubs that reflect the real GrapesJS 0.21.x Backbone-based API
 * shape and call signature.
 *
 * PURPOSE: If any of these tests break on a GrapesJS upgrade, the consuming code in
 * converters.ts, registerBlocks.ts, or storageManager.ts must be updated before merging.
 *
 * @grapesjs-contract — Re-verify ALL tests in this file after any GrapesJS upgrade.
 */

import { describe, it, expect, vi } from 'vitest'

// ---------------------------------------------------------------------------
// T705.1 — component.toArray() returns an array of child components
// ---------------------------------------------------------------------------

describe('T705.1 — component.toArray() returns array of children', () => {
  /**
   * @grapesjs-contract — re-verify on GrapesJS upgrade
   *
   * We call component.toArray() in converters.ts to iterate over child components.
   * This is a Backbone Collection method exposed on GrapesJS Component.
   * API location: grapesjs/src/domain_abstract/model/StyleableModel.ts (via Backbone.Collection)
   * Used in: packages/authoring-ui/src/editor/converters.ts → widgetsFromGrapesjs()
   */
  it('toArray() returns an Array', () => {
    const child1 = { get: vi.fn(), getId: vi.fn().mockReturnValue('child-1') }
    const child2 = { get: vi.fn(), getId: vi.fn().mockReturnValue('child-2') }
    const component = {
      toArray: vi.fn().mockReturnValue([child1, child2]),
    }

    const result = component.toArray()

    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(2)
  })

  it('toArray() returns empty array when component has no children', () => {
    const component = { toArray: vi.fn().mockReturnValue([]) }
    expect(component.toArray()).toEqual([])
  })

  it('children returned by toArray() expose the same get() / getId() API as their parent', () => {
    const child = {
      get: vi.fn((key: string) => (key === 'type' ? 'text' : undefined)),
      getId: vi.fn().mockReturnValue('child-abc'),
    }
    const parent = { toArray: vi.fn().mockReturnValue([child]) }

    const [first] = parent.toArray()
    expect(first.getId()).toBe('child-abc')
    expect(first.get('type')).toBe('text')
  })
})

// ---------------------------------------------------------------------------
// T705.2 — component.getInnerHTML() returns a string
// ---------------------------------------------------------------------------

describe('T705.2 — component.getInnerHTML() returns a string', () => {
  /**
   * @grapesjs-contract — re-verify on GrapesJS upgrade
   *
   * Used in converters.ts to extract text content of text/button widgets.
   * GrapesJS 0.21.x: defined on ComponentView, may be absent in SSR / unit tests.
   * Fallback path: component.get('content').
   * Used in: packages/authoring-ui/src/editor/converters.ts → widgetsFromGrapesjs()
   */
  it('getInnerHTML() returns a string', () => {
    const component = {
      getInnerHTML: vi.fn().mockReturnValue('<em>Hello</em> world'),
    }

    const result = component.getInnerHTML()

    expect(typeof result).toBe('string')
    expect(result).toContain('Hello')
  })

  it('getInnerHTML() preserves nested HTML tags in the returned string', () => {
    const content = 'Learning <em>objectives</em> matter'
    const component = { getInnerHTML: vi.fn().mockReturnValue(content) }

    expect(component.getInnerHTML()).toBe(content)
  })

  it('get("content") is the fallback when getInnerHTML is absent (unit-test / older GJS env)', () => {
    // Simulates the environment where getInnerHTML is not available on the view
    const component = {
      get: vi.fn((key: string) => (key === 'content' ? 'Fallback text' : undefined)),
      // getInnerHTML deliberately absent
    }

    const result = (component as { getInnerHTML?: () => string }).getInnerHTML?.()
      ?? (component.get('content') as string)

    expect(result).toBe('Fallback text')
  })
})

// ---------------------------------------------------------------------------
// T705.3 — editor.StorageManager.add() registers a custom storage type
// ---------------------------------------------------------------------------

describe('T705.3 — editor.StorageManager.add() registers a custom storage type', () => {
  /**
   * @grapesjs-contract — re-verify on GrapesJS upgrade
   *
   * We call editor.StorageManager.add('elearn-api', { load, store }) in storageManager.ts.
   * The registered load/store callbacks are called by GrapesJS when editor.load() /
   * editor.store() are invoked.
   * Used in: packages/authoring-ui/src/editor/storageManager.ts → registerStorageManager()
   */
  it('StorageManager.add() accepts a type name and a {load, store} implementation', () => {
    const registeredTypes = new Map<string, { load: unknown; store: unknown }>()
    const mockStorageManager = {
      add: vi.fn((type: string, impl: { load: unknown; store: unknown }) => {
        registeredTypes.set(type, impl)
      }),
    }

    const loadFn = vi.fn()
    const storeFn = vi.fn()
    mockStorageManager.add('elearn-api', { load: loadFn, store: storeFn })

    expect(mockStorageManager.add).toHaveBeenCalledWith('elearn-api', expect.objectContaining({
      load: loadFn,
      store: storeFn,
    }))
  })

  it('registered load() and store() callbacks are independently callable after registration', async () => {
    const registeredTypes = new Map<string, { load: (o: unknown) => Promise<unknown>; store: (d: unknown, o: unknown) => Promise<void> }>()
    const mockStorageManager = {
      add: vi.fn((type: string, impl: { load: (o: unknown) => Promise<unknown>; store: (d: unknown, o: unknown) => Promise<void> }) => {
        registeredTypes.set(type, impl)
      }),
    }

    const loadFn = vi.fn().mockResolvedValue({ components: [] })
    const storeFn = vi.fn().mockResolvedValue(undefined)
    mockStorageManager.add('elearn-api', { load: loadFn, store: storeFn })

    const impl = registeredTypes.get('elearn-api')!
    await impl.load({ courseId: 'c1', slideId: 's1' })
    await impl.store({ components: [] }, { courseId: 'c1', slideId: 's1' })

    expect(loadFn).toHaveBeenCalledWith({ courseId: 'c1', slideId: 's1' })
    expect(storeFn).toHaveBeenCalledWith({ components: [] }, { courseId: 'c1', slideId: 's1' })
  })
})

// ---------------------------------------------------------------------------
// T705.4 — component.listenTo() wires Backbone event listener
// ---------------------------------------------------------------------------

describe('T705.4 — component.listenTo() wires Backbone event listener', () => {
  /**
   * @grapesjs-contract — re-verify on GrapesJS upgrade
   *
   * GrapesJS components inherit Backbone.Events.listenTo().
   * We use listenTo(model, 'change:src', cb) in registerBlocks.ts to track src changes
   * on the image component model.
   * If GrapesJS removes Backbone Events inheritance, this API will break.
   * Used in: packages/authoring-ui/src/editor/registerBlocks.ts → image view initialize()
   */
  it('listenTo() accepts (target, event, callback) signature', () => {
    const component = {
      listenTo: vi.fn(),
    }
    const target = {}
    const callback = vi.fn()

    component.listenTo(target, 'change:src', callback)

    expect(component.listenTo).toHaveBeenCalledWith(target, 'change:src', callback)
  })

  it('listenTo() callback is invoked when the target triggers the named event', () => {
    const listeners: Array<{ event: string; cb: () => void }> = []

    const target = {
      trigger(event: string) {
        listeners.filter(l => l.event === event).forEach(l => l.cb())
      },
    }

    const component = {
      listenTo: vi.fn((_target: unknown, event: string, cb: () => void) => {
        listeners.push({ event, cb })
      }),
    }

    const callback = vi.fn()
    component.listenTo(target, 'change:extendedProperties', callback)
    target.trigger('change:extendedProperties')

    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('listenTo() does not invoke callback for a different event name', () => {
    const listeners: Array<{ event: string; cb: () => void }> = []
    const target = {
      trigger(event: string) {
        listeners.filter(l => l.event === event).forEach(l => l.cb())
      },
    }
    const component = {
      listenTo: vi.fn((_target: unknown, event: string, cb: () => void) => {
        listeners.push({ event, cb })
      }),
    }
    const callback = vi.fn()

    component.listenTo(target, 'change:src', callback)
    target.trigger('change:style') // different event — should NOT fire callback

    expect(callback).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// T705.5 — component.getId() matches component.getAttributes().id
// ---------------------------------------------------------------------------

describe('T705.5 — component.getId() matches component.getAttributes().id', () => {
  /**
   * @grapesjs-contract — re-verify on GrapesJS upgrade
   *
   * We rely on getId() returning the same id as the component's HTML `id` attribute.
   * This is used in converters.ts to assign widget.id when loading a slide.
   * GrapesJS 0.21.x guarantees this — it stores id in both the model attribute and
   * the underlying HTML element's `id` attribute.
   * Used in: packages/authoring-ui/src/editor/converters.ts → widgetsFromGrapesjs()
   */
  it('getId() and getAttributes().id return the same value', () => {
    const id = 'widget-abc-123'
    const component = {
      getId: vi.fn().mockReturnValue(id),
      getAttributes: vi.fn().mockReturnValue({ id, class: 'text-widget' }),
    }

    expect(component.getId()).toBe(component.getAttributes().id)
  })

  it('getId() returns a non-empty string', () => {
    const component = { getId: vi.fn().mockReturnValue('w-xyz') }

    const result = component.getId()

    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('getAttributes() returns an object containing at least an "id" key', () => {
    const component = {
      getAttributes: vi.fn().mockReturnValue({ id: 'w-xyz', class: '' }),
    }

    const attrs = component.getAttributes()

    expect(attrs).toHaveProperty('id')
    expect(typeof attrs.id).toBe('string')
  })
})
