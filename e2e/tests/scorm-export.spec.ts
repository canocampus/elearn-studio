import { test, expect } from '../fixtures'

/**
 * T169.10 — SCORM export dialog
 *
 * All tests start authenticated with the editor ready.
 */

test.describe('SCORM Export', () => {
  test('Publish SCORM button is visible in toolbar', async ({ editorPage }) => {
    await expect(editorPage.publishScormButton).toBeVisible()
  })

  test('clicking Publish SCORM opens the publish dialog', async ({ editorPage }) => {
    await editorPage.openPublishDialog()
    await expect(editorPage.publishDialog).toBeVisible()
  })

  test('publish dialog shows correct title', async ({ editorPage }) => {
    await editorPage.openPublishDialog()
    await expect(editorPage.publishDialog).toContainText('Publish SCORM Package')
  })

  test('publish dialog has confirm and cancel buttons', async ({ editorPage }) => {
    await editorPage.openPublishDialog()
    await expect(editorPage.publishConfirmButton).toBeVisible()
    await expect(editorPage.publishCancelButton).toBeVisible()
  })

  test('cancel button closes the publish dialog', async ({ editorPage }) => {
    await editorPage.openPublishDialog()
    await editorPage.cancelPublish()
    await expect(editorPage.publishDialog).not.toBeVisible()
  })

  test('SCORM export downloads a ZIP file', async ({ editorPage, page }) => {
    await editorPage.openPublishDialog()

    // Listen for the download event before triggering it
    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 })
    await editorPage.publishConfirmButton.click()

    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/\.zip$/)
  })
})
