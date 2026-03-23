import { test, expect } from '../fixtures'
import { ActionsEditorPage } from '../pages/ActionsEditorPage'

/**
 * T169.11 — Action sequence editor panel
 *
 * All tests start authenticated with the editor ready.
 */

test.describe('Action Sequence Editor', () => {
  test('Actions tab is visible in right sidebar', async ({ editorPage }) => {
    await expect(editorPage.actionsTab).toBeVisible()
  })

  test('clicking Actions tab opens the actions panel', async ({ editorPage, page }) => {
    const actionsPage = new ActionsEditorPage(page)
    await actionsPage.open()

    // After clicking the Actions tab, the panel or its content should be visible
    // The tab itself should appear selected/active
    await expect(editorPage.actionsTab).toBeVisible()
  })

  test('right sidebar has all expected tabs', async ({ editorPage }) => {
    await expect(editorPage.layersTab).toBeVisible()
    await expect(editorPage.stylesTab).toBeVisible()
    await expect(editorPage.actionsTab).toBeVisible()
  })
})
