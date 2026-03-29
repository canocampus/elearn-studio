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

  /** Wait for the GrapesJS canvas iframe to be visible and the slide to be fully loaded. */
  async waitForCanvas() {
    const iframe = this.page.locator('iframe.gjs-frame')
    await iframe.waitFor({ state: 'visible', timeout: 30_000 })

    // Phase 1 (short): After a slide switch, React commits setIsReady(false) within ~16ms,
    // setting data-editor-ready="false". Polling here catches that transition and prevents
    // returning on a stale data-editor-ready="true" from a previous slide load.
    // If data-editor-ready is already "false" (loading), this resolves immediately.
    // If no slide switch is in progress (stable state), the 500ms timeout fires and is
    // silently ignored — Phase 2 then confirms the existing "true" is valid.
    await this.page.waitForFunction(
      () => document.querySelector('[data-editor-ready]')?.getAttribute('data-editor-ready') !== 'true',
      { timeout: 500, polling: 50 },
    ).catch(() => {})

    // Phase 2: Wait for the editor to finish loading the current slide.
    await this.page.locator('[data-editor-ready="true"]').waitFor({ state: 'attached', timeout: 30_000 })
  }

  /** 
   * Manual drag-and-drop to ensure GrapesJS triggers its dragover/drop handlers correctly.
   */
  async dragBlockToCanvas(blockLabel: string, targetX: number, targetY: number) {
    // console.log(`[E2E] Dragging block: ${blockLabel} to ${targetX}, ${targetY}`)
    await this.blocksTab.click()
    await this.page.waitForTimeout(1000) // Wait for panel to render

    // Try multiple ways to find the block (some GrapesJS versions wrap labels differently)
    const block = this.page.locator('.gjs-block').filter({ hasText: blockLabel }).first()
    await block.waitFor({ state: 'visible', timeout: 15_000 })
    // Scroll the block into view in case its category is below the visible area of the sidebar
    await block.scrollIntoViewIfNeeded()

    const iframe = this.page.locator('iframe.gjs-frame').first()
    const iframeBox = await iframe.boundingBox()
    const blockBox = await block.boundingBox()
    
    if (!iframeBox || !blockBox) throw new Error('Could not find iframe or block bounding box')

    // Start drag
    await this.page.mouse.move(blockBox.x + blockBox.width / 2, blockBox.y + blockBox.height / 2)
    await this.page.mouse.down()
    
    // Move into canvas to trigger dragover
    await this.page.mouse.move(iframeBox.x + targetX, iframeBox.y + targetY, { steps: 10 })
    await this.page.waitForTimeout(200)
    
    // Drop
    await this.page.mouse.up()
    
    // Wait for network to idle so component addition is synced
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
}
