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

  async goto() {
    await this.page.goto('/')
    await this.waitForReady()
  }

  async waitForReady() {
    await this.publishScormButton.waitFor({ state: 'visible', timeout: 20_000 })
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
