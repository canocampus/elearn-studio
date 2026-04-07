import { type Page, type Locator } from '@playwright/test'

/**
 * Page Object Model for the main Slide Editor page.
 *
 * Selectors derived from:
 * - packages/authoring-ui/src/components/layout/TopToolbar.tsx
 * - packages/authoring-ui/src/components/sidebar/SlideList.tsx
 * - packages/authoring-ui/src/components/layout/AppLayout.tsx
 * - packages/authoring-ui/src/components/layout/PublishDialog.tsx
 */
export class EditorPage {
  // ── Top Toolbar ────────────────────────────────────────────────────────────
  readonly addSlideButton: Locator
  readonly publishScormButton: Locator
  readonly previewButton: Locator

  // ── Left Sidebar Tabs ──────────────────────────────────────────────────────
  readonly slidesTab: Locator
  readonly blocksTab: Locator

  // ── Right Sidebar Tabs ─────────────────────────────────────────────────────
  readonly layersTab: Locator
  readonly stylesTab: Locator
  readonly propsTab: Locator
  readonly actionsTab: Locator
  readonly animTab: Locator

  // ── Publish Dialog ─────────────────────────────────────────────────────────
  readonly publishDialog: Locator
  readonly publishConfirmButton: Locator
  readonly publishCancelButton: Locator
  readonly publishCloseButton: Locator
  readonly publishStatusBox: Locator

  constructor(private readonly page: Page) {
    // TopToolbar buttons
    this.addSlideButton = page.getByTitle('Add slide')
    this.publishScormButton = page.getByRole('button', { name: /Publish SCORM/i })
    this.previewButton = page.getByRole('button', { name: /Preview/i })

    // Left sidebar tabs (AppLayout TabButton renders as <button role="tab">)
    this.slidesTab = page.getByRole('tab', { name: 'Slides', exact: true })
    this.blocksTab = page.getByRole('tab', { name: 'Blocks', exact: true })

    // Right sidebar tabs
    this.layersTab = page.getByRole('tab', { name: 'Layers', exact: true })
    this.stylesTab = page.getByRole('tab', { name: 'Styles', exact: true })
    this.propsTab = page.getByRole('tab', { name: 'Props', exact: true })
    this.actionsTab = page.getByRole('tab', { name: 'Actions', exact: true })
    this.animTab = page.getByRole('tab', { name: 'Anim', exact: true })

    // Publish dialog
    this.publishDialog = page.getByRole('dialog').filter({ hasText: 'Publish SCORM Package' })
    this.publishConfirmButton = page.getByRole('button', { name: /Publish SCORM 1\.2/i })
    this.publishCancelButton = page.getByRole('button', { name: 'Cancel' })
    this.publishCloseButton = page.getByRole('button', { name: 'Close' })
    this.publishStatusBox = page.getByTestId('publish-status')
  }

  // ── GrapesJS Locators ──────────────────────────────────────────────────────

  /**
   * Programmatically add a GrapesJS component and select it.
   * Requires `window.__elearn_editor` (set in EditorCanvas.tsx in DEV builds).
   */
  async addComponentViaEditor(type: string): Promise<void> {
    // Wait for the editor to be exposed on window (set in EditorCanvas.tsx onReady)
    await this.page.waitForFunction(
      () => !!(window as Record<string, unknown>).__elearn_editor,
      { timeout: 15_000 },
    )
    await this.page.evaluate((componentType: string) => {
      const ed = (window as Record<string, unknown>).__elearn_editor as {
        addComponents: (c: object[]) => unknown
        select: (c: unknown) => void
      }
      const added = ed.addComponents([{ type: componentType }])
      const comp = Array.isArray(added) ? added[0] : added
      if (comp) ed.select(comp)
    }, type)
  }

  /** The GrapesJS iframe where components are rendered. */
  canvasFrame() {
    return this.page.frameLocator('iframe.gjs-frame')
  }

  /** Signal from EditorCanvas.tsx when editor.load() is complete. */
  readySignal() {
    return this.page.locator('[data-editor-ready="true"]')
  }

  /** A block in the Block Manager by its title (e.g., 'Text'). */
  blockItem(label: string): Locator {
    // GrapesJS blocks often have the label inside a div with class gjs-block-label or similar
    return this.page.locator('.gjs-block').filter({ hasText: label })
  }

  /** A component inside the canvas by its ID or data-gjs-type. */
  canvasComponent(selector: string): Locator {
    return this.canvasFrame().locator(selector)
  }

  /** Returns the bounding box of the GrapesJS iframe in viewport coordinates. */
  async getCanvasIframeBox() {
    return this.page.locator('iframe.gjs-frame').boundingBox()
  }

  async goto() {
    await this.page.goto('/')
    await this.waitForReady()
    // If the course already has slides, the GrapesJS canvas iframe appears and
    // editor.load() starts immediately. Wait for the initial load to complete before
    // returning so that beforeEach hooks (e.g. addSlide()) don't trigger a second
    // editor.load() while the first is still in-flight — concurrent loads crash GrapesJS.
    const iframe = this.page.locator('iframe.gjs-frame')
    const appeared = await iframe.waitFor({ state: 'visible', timeout: 3000 })
      .then(() => true).catch(() => false)
    if (appeared) {
      await this.page.locator('[data-editor-ready="true"]')
        .waitFor({ state: 'attached', timeout: 15_000 })
    }
  }

  async waitForReady() {
    // Only waits for the toolbar — the canvas iframe may not exist if no slide is selected.
    await this.publishScormButton.waitFor({ state: 'visible', timeout: 30_000 })
  }

  /**
   * Wait for the editor to be fully ready after a `page.reload()` when a canvas slide
   * is expected to be visible. Combines `waitForReady()` (toolbar) and `waitForCanvas()`
   * (initial slide load) before any slide-navigation clicks.
   *
   * Without `waitForCanvas()` here, clicking a slide immediately after reload triggers
   * a second `editor.load()` while the auto-selected slide 0 load is still in-flight —
   * concurrent GrapesJS loads corrupt internal state and crash the browser tab.
   */
  async waitForReloadComplete() {
    await this.waitForReady()
    await this.waitForCanvas()
  }

  /** Wait for the GrapesJS canvas iframe to be visible and the slide to be fully loaded. */
  async waitForCanvas() {
    const iframe = this.page.locator('iframe.gjs-frame')
    await iframe.waitFor({ state: 'visible', timeout: 30_000 })

    // Phase 1 (short): After a slide switch, React commits setIsReady(false) within ~16ms,
    // setting data-editor-ready="false". A brief sleep here catches that transition and prevents
    // returning on a stale data-editor-ready="true" from a previous slide load.
    // NOTE: page.waitForFunction() with a 500ms timeout was used here previously but caused
    // a ~59s hang when the browser JS thread was busy processing GrapesJS post-load events.
    // Playwright's waitForFunction queues CDP evaluations and blocks when the browser is
    // unresponsive; waitForTimeout is a pure Node.js timer that bypasses this issue.
    await this.page.waitForTimeout(300)

    // Phase 2: Wait for the editor to finish loading the current slide.
    await this.page.locator('[data-editor-ready="true"]').waitFor({ state: 'attached', timeout: 30_000 })
  }

  /**
   * Add a block from the Block Manager panel onto the GrapesJS canvas at (targetX, targetY).
   *
   * GrapesJS's Block Manager uses HTML5 drag events (dragstart / dragover / drop) which
   * Playwright cannot reliably fire via page.mouse (those APIs dispatch MouseEvent, not
   * DragEvent). Synthetic DragEvents dispatched via page.evaluate() are also rejected
   * because browsers mark programmatically-dispatched drag events as non-trusted,
   * causing GrapesJS to ignore them.
   *
   * Solution: use window.__elearn_editor (exposed in DEV/E2E builds) to look up the
   * component type from BlockManager, then call addComponents() with explicit position
   * styles. This is functionally equivalent to a block drag-and-drop at those coordinates:
   * the same GrapesJS component lifecycle fires (component:add → component:update →
   * triggerAutosave), and the component appears at the target position in the canvas.
   */
  async dragBlockToCanvas(blockLabel: string, targetX: number, targetY: number) {
    // Show the Blocks tab so tests can assert panel state if needed.
    await this.blocksTab.click()
    await this.page.waitForTimeout(300)

    // Ensure the editor is ready before manipulating it programmatically.
    await this.page.waitForFunction(
      () => !!(window as Record<string, unknown>).__elearn_editor,
      { timeout: 15_000 },
    )

    await this.page.evaluate(
      ({ label, x, y }) => {
        type GjsComp = { addStyle: (s: Record<string, string>) => void }
        type GjsEditor = {
          BlockManager: { getAll: () => Array<{ get: (k: string) => unknown }> }
          addComponents: (c: object[]) => unknown
          select: (c: unknown) => void
        }
        const ed = (window as Record<string, unknown>).__elearn_editor as GjsEditor

        // Resolve component type from block label via BlockManager.
        const blocks = ed.BlockManager.getAll()
        const block = blocks.find(b => {
          const lbl = b.get('label') as string | undefined
          return lbl?.trim() === label
        })
        const content = block?.get('content') as { type?: string } | string | undefined
        const compType =
          content && typeof content === 'object' && 'type' in content
            ? (content.type ?? 'default')
            : 'default'

        // Add the component without overriding default styles so that the type's
        // defaults (width, height, background, etc.) are preserved. The component:add
        // handler in initEditor.ts already sets position:absolute on every new component.
        const added = ed.addComponents([{ type: compType }])
        const comp = Array.isArray(added) ? added[0] : added
        if (comp) {
          // Merge the target position into the existing styles (addStyle merges, not replaces).
          (comp as GjsComp).addStyle({ left: `${x}px`, top: `${y}px` })
          ed.select(comp)
        }
      },
      { label: blockLabel, x: targetX, y: targetY },
    )

    // Wait for the autosave PATCH to complete before returning.
    await this.page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
  }

  // ── Slide List helpers ─────────────────────────────────────────────────────

  slideItem(title: string): Locator {
    return this.page.locator('[data-testid="slide-item"]').filter({ hasText: title })
  }

  slideItemByIndex(index: number): Locator {
    // Slide items in SlideList are div[role="button"] elements
    return this.page.locator('[data-testid="slide-item"]').nth(index)
  }

  duplicateSlideButton(slideTitle: string): Locator {
    return this.slideItem(slideTitle).locator('..').getByTitle('Duplicate slide')
  }

  deleteSlideButton(slideTitle: string): Locator {
    return this.slideItem(slideTitle).locator('..').getByTitle(/Delete slide/)
  }

  async addSlide() {
    const slidesBefore = await this.page.locator('[data-testid="slide-item"]').count()
    await this.addSlideButton.click()
    // Ensure the Slides tab is active so slide items are visible.
    // dragBlockToCanvas() switches to the Blocks tab; if addSlide() is called after a
    // drag, the slide items are hidden (Blocks tab still active) and the waitFor below
    // would time out waiting for a visible element that is actually just hidden.
    await this.slidesTab.click()
    // Wait for the new slide item to appear in the list. This confirms the API
    // round-trip has completed and React has committed the new slideId to the store.
    // Without this wait, waitForCanvas() can see data-editor-ready="true" from the
    // *previous* slide's load and return early, causing a race where the test adds
    // components that are wiped when the new slide's editor.load() fires later.
    await this.page.locator('[data-testid="slide-item"]')
      .nth(slidesBefore)
      .waitFor({ state: 'visible', timeout: 30_000 })
  }

  async clickSlide(title: string) {
    await this.slideItem(title).click()
  }

  async renameSlide(currentTitle: string, newTitle: string) {
    // Double-click opens inline rename input
    await this.slideItem(currentTitle).dblclick()
    const renameInput = this.page.locator('input[aria-label="Slide title"], input.slide-rename')
    await renameInput.fill(newTitle)
    await renameInput.press('Enter')
  }

  // ── Publish SCORM helpers ──────────────────────────────────────────────────

  async openPublishDialog() {
    await this.publishScormButton.click()
    await this.publishDialog.waitFor({ state: 'visible', timeout: 10_000 })
  }

  async cancelPublish() {
    await this.publishCancelButton.click()
    await this.publishDialog.waitFor({ state: 'hidden', timeout: 5_000 })
  }

  // ── Course Settings helpers ────────────────────────────────────────────────

  async openCourseSettings() {
    const settingsBtn = this.page.getByTestId('course-settings-btn')
    await settingsBtn.click()
    const dialog = this.page.getByRole('dialog').filter({ hasText: 'Course Settings' })
    await dialog.waitFor({ state: 'visible', timeout: 10_000 })
    return dialog
  }

  async setNavigationMode(mode: 'free' | 'linear-strict') {
    const select = this.page.getByTestId('navigation-mode-select')
    await select.selectOption(mode)
    // Wait for the change to be saved (debounced)
    await this.page.waitForTimeout(500)
  }

  async closeCourseSettings() {
    const dialog = this.page.getByRole('dialog').filter({ hasText: 'Course Settings' })
    // Look for a close button (X or similar) or click outside
    const closeBtn = dialog.getByRole('button', { name: /close|cancel/i }).first()
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click()
    } else {
      // Press Escape to close the dialog
      await this.page.keyboard.press('Escape')
    }
    await dialog.waitFor({ state: 'hidden', timeout: 5_000 })
  }

  // ── Preview helpers ────────────────────────────────────────────────────────

  /**
   * Click the Preview button and return the runtime player page (new popup/window).
   * The preview opens in a new window/popup that must be tracked separately.
   */
  async openPreview(context: import('@playwright/test').BrowserContext) {
    const [popup] = await Promise.all([
      context.waitForEvent('page'),
      this.previewButton.click(),
    ])
    await popup.waitForLoadState('networkidle')
    return popup
  }
}
