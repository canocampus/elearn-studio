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
  readonly actionsTab: Locator

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
    this.actionsTab = page.getByRole('tab', { name: 'Actions', exact: true })

    // Publish dialog
    this.publishDialog = page.getByRole('dialog').filter({ hasText: 'Publish SCORM Package' })
    this.publishConfirmButton = page.getByRole('button', { name: /Publish SCORM 1\.2/i })
    this.publishCancelButton = page.getByRole('button', { name: 'Cancel' })
  }

  // ── GrapesJS Locators ──────────────────────────────────────────────────────
  
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
  }

  async waitForReady() {
    // Only waits for the toolbar — the canvas iframe may not exist if no slide is selected.
    await this.publishScormButton.waitFor({ state: 'visible', timeout: 30_000 })
  }

  /** Wait for the GrapesJS canvas iframe to be visible (requires an active slide). */
  async waitForCanvas() {
    const iframe = this.page.locator('iframe.gjs-frame')
    await iframe.waitFor({ state: 'visible', timeout: 30_000 })
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
    await this.addSlideButton.click()
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
