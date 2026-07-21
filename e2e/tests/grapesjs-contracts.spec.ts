/**
 * grapesjs-contracts.spec.ts — TD-025 (@contract)
 *
 * REAL-instance contract tests for the GrapesJS APIs eLearn Studio depends
 * on. The unit-level shape tests (formerly "contract" tests, H-01/T705)
 * exercise stubs and stay green no matter what GrapesJS ships — this spec is
 * the actual guarantee: it asserts the same contracts against the live
 * editor (`window.__elearn_editor`) running the bundled GrapesJS version,
 * so an incompatible upgrade fails CI here.
 *
 * @grapesjs-contract — re-verify on any GrapesJS upgrade. Consumers:
 * converters.ts, registerBlocks.ts, storageManager.ts, initEditor.ts.
 */
import { test, expect } from '../fixtures'

test.describe('@contract TD-025 — GrapesJS real-instance API contracts', () => {
  test.beforeEach(async ({ editorPage }) => {
    await editorPage.addSlide()
    await editorPage.waitForCanvas()
  })

  test('T705.5 — getId() matches getAttributes().id on a placed component', async ({ editorPage }) => {
    await editorPage.addComponentViaEditor('button')
    const { modelId, attrId } = await editorPage.page.evaluate(() => {
      const comp = window.__elearn_editor!.getWrapper().components().at(0)!
      return { modelId: comp.getId(), attrId: comp.getAttributes()['id'] as string }
    })
    expect(modelId).toBeTruthy()
    expect(modelId).toBe(attrId)
  })

  test('T705.1 — editor.getComponents().toArray() returns array-shaped components', async ({ editorPage }) => {
    // Real consumer contract (AppLayout.handlePreview): toArray() lives on
    // the root Components COLLECTION, not on an individual component. The
    // old stub test documented `component.toArray()` — this real-instance
    // run corrected that drift (TD-025 finding).
    await editorPage.addComponentViaEditor('button')
    const shape = await editorPage.page.evaluate(() => {
      const collection = window.__elearn_editor!.getComponents()
      const arr = collection.toArray()
      return {
        hasToArray: typeof collection.toArray === 'function',
        isArray: Array.isArray(arr),
        itemHasApi: arr.length > 0 &&
          typeof arr[0]!.getId === 'function' && typeof arr[0]!.get === 'function',
      }
    })
    expect(shape.hasToArray).toBe(true)
    expect(shape.isArray).toBe(true)
    expect(shape.itemHasApi).toBe(true)
  })

  test('T705.2 — getInnerHTML() returns a string on a mounted view; content fallback stays readable', async ({ editorPage }) => {
    await editorPage.addComponentViaEditor('text')
    const r = await editorPage.page.evaluate(() => {
      const comp = window.__elearn_editor!.getWrapper().components().at(0)!
      return {
        hasFn: typeof comp.getInnerHTML === 'function',
        html: comp.getInnerHTML?.(),
        contentReadable: comp.get('content') !== null && !(comp.get('content') instanceof Promise),
      }
    })
    expect(r.hasFn).toBe(true)
    expect(typeof r.html).toBe('string')
    expect(r.contentReadable).toBe(true)
  })

  test('T705.3 — the elearn-api custom storage type is registered on the real StorageManager', async ({ editorPage }) => {
    const registered = await editorPage.page.evaluate(() => {
      const sm = window.__elearn_editor!.StorageManager
      return typeof sm?.get === 'function' && Boolean(sm.get('elearn-api'))
    })
    expect(registered).toBe(true)
  })

  test('T705.4 — Backbone Events: listenTo() fires on model change, editor bus emits component:add', async ({ editorPage }) => {
    const r = await editorPage.page.evaluate(async () => {
      const ed = window.__elearn_editor!
      // editor bus: component:add delivers a component-shaped model
      let addedType: unknown = 'never-fired'
      const onAdd = (...args: unknown[]) => {
        const model = args[0] as { get?: (k: string) => unknown } | undefined
        addedType = typeof model?.get === 'function' ? model.get('type') : 'no-model-shape'
      }
      ed.on('component:add', onAdd)
      ed.addComponents([{ type: 'button' }])
      ed.off('component:add', onAdd)

      // Backbone listenTo on a real model
      const comp = ed.getWrapper().components().at(0)!
      let fired = 0
      comp.listenTo?.(comp, 'change:name', () => { fired += 1 })
      comp.set('name', 'ContractProbe')
      return { addedType, hasListenTo: typeof comp.listenTo === 'function', fired }
    })
    expect(r.addedType).toBe('button')
    expect(r.hasListenTo).toBe(true)
    expect(r.fired).toBe(1)
  })

  test('component:selected — editor bus delivers the selected component; getSelected() agrees', async ({ editorPage }) => {
    await editorPage.addComponentViaEditor('button')
    const r = await editorPage.page.evaluate(() => {
      const ed = window.__elearn_editor!
      const comp = ed.getWrapper().components().at(0)!
      let selectedId: unknown = 'never-fired'
      const onSel = (...args: unknown[]) => {
        const model = args[0] as { getId?: () => string } | undefined
        selectedId = model?.getId?.() ?? 'no-model-shape'
      }
      // addComponentViaEditor may leave the component already selected —
      // select() on the current selection is a no-op and emits nothing.
      ed.select(null)
      ed.on('component:selected', onSel)
      ed.select(comp)
      ed.off('component:selected', onSel)
      return { selectedId, agreed: ed.getSelected()?.getId() === comp.getId() }
    })
    expect(r.selectedId).not.toBe('never-fired')
    expect(r.agreed).toBe(true)
  })

  test('name trait — model name survives the store/load round-trip (TD-019 contract)', async ({ editorPage }) => {
    const page = editorPage.page
    await editorPage.addComponentViaEditor('button')
    await page.evaluate(async () => {
      const ed = window.__elearn_editor!
      ed.getWrapper().components().at(0)!.set('name', 'ContractName')
      await ed.store()
    })
    // Round-trip: away and back forces a fresh load through the converters.
    const slides = page.locator('[data-testid="slide-item"]')
    const ourIndex = (await slides.count()) - 1
    await slides.first().click()
    await editorPage.waitForCanvas()
    await slides.nth(ourIndex).click()
    await editorPage.waitForCanvas()
    const name = await page.evaluate(
      () => window.__elearn_editor!.getWrapper().components().at(0)!.get('name'),
    )
    expect(name).toBe('ContractName')
  })
})
