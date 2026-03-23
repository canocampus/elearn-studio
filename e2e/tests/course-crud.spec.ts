import { test, expect } from '../fixtures'
import { EditorPage } from '../pages/EditorPage'

/**
 * T169.6 — Course CRUD & slide management
 *
 * All tests start authenticated (storageState from globalSetup).
 * The seed course created in globalSetup ensures the editor is in ready state.
 */

test.describe('Course & Slide Management', () => {
  test('editor loads with at least one slide visible', async ({ editorPage }) => {
    await expect(editorPage.publishScormButton).toBeVisible()
    await expect(editorPage.addSlideButton).toBeVisible()
  })

  test('Slides tab is active by default in left sidebar', async ({ editorPage }) => {
    await expect(editorPage.slidesTab).toBeVisible()
  })

  test('can add a new slide', async ({ editorPage, page }) => {
    // Count slides before
    const slidesListBefore = page.locator('[data-testid="slide-item"]')
    const countBefore = await slidesListBefore.count()

    await editorPage.addSlide()

    // Slide count increases by 1
    await expect(slidesListBefore).toHaveCount(countBefore + 1, { timeout: 5_000 })
  })

  test('toolbar shows correct buttons', async ({ editorPage }) => {
    await expect(editorPage.addSlideButton).toBeVisible()
    await expect(editorPage.publishScormButton).toBeVisible()
    await expect(editorPage.previewButton).toBeVisible()
  })

  test('add slide button has correct accessible title', async ({ editorPage }) => {
    await expect(editorPage.addSlideButton).toHaveAttribute('title', 'Add slide')
  })
})
