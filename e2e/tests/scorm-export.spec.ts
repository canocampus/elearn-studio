import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import AdmZip from 'adm-zip'
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

  test('GAP-04 — SCORM ZIP contains imsmanifest.xml and index.html', async ({ editorPage, page }) => {
    test.setTimeout(60_000)

    await editorPage.openPublishDialog()

    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 })
    await editorPage.publishConfirmButton.click()

    const download = await downloadPromise

    // Save the download to a temp directory for inspection
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'elearn-scorm-'))
    const zipPath = path.join(tmpDir, 'course.zip')
    await download.saveAs(zipPath)

    try {
      const zip = new AdmZip(zipPath)
      const entries = zip.getEntries().map(e => e.entryName)

      expect(entries).toContain('imsmanifest.xml')
      expect(entries).toContain('index.html')
    } finally {
      fs.rmSync(tmpDir, { recursive: true })
    }
  })

  // T606 — Loading feedback tests
  test('T606 — publish dialog shows "Download ready" after successful export', async ({ editorPage, page }) => {
    test.setTimeout(60_000)

    await editorPage.openPublishDialog()

    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 })
    await editorPage.publishConfirmButton.click()

    await downloadPromise

    // Status box must appear and show success message
    await expect(editorPage.publishStatusBox).toBeVisible({ timeout: 10_000 })
    await expect(editorPage.publishStatusBox).toContainText('Download ready')
  })

  test('T606 — publish dialog shows Close button (not Cancel) after export', async ({ editorPage, page }) => {
    test.setTimeout(60_000)

    await editorPage.openPublishDialog()

    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 })
    await editorPage.publishConfirmButton.click()

    await downloadPromise

    // Cancel button must be replaced by Close
    await expect(editorPage.publishCloseButton).toBeVisible({ timeout: 10_000 })
    await expect(editorPage.publishCancelButton).not.toBeVisible()
  })

  test('T606 — Close button dismisses the dialog after export', async ({ editorPage, page }) => {
    test.setTimeout(60_000)

    await editorPage.openPublishDialog()

    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 })
    await editorPage.publishConfirmButton.click()

    await downloadPromise

    await editorPage.publishCloseButton.waitFor({ state: 'visible', timeout: 10_000 })
    await editorPage.publishCloseButton.click()

    await expect(editorPage.publishDialog).not.toBeVisible()
  })

  // T635 — Format selector
  test('@regression T635 — all 3 format options visible in publish dialog', async ({ editorPage, page }) => {
    await editorPage.openPublishDialog()

    await expect(page.getByTestId('format-option-scorm12')).toBeVisible()
    await expect(page.getByTestId('format-option-scorm2004')).toBeVisible()
    await expect(page.getByTestId('format-option-aicc')).toBeVisible()
  })

  test('@regression T635 — SCORM 1.2 is selected by default', async ({ editorPage, page }) => {
    await editorPage.openPublishDialog()

    const scorm12Radio = page.getByTestId('format-option-scorm12').getByRole('radio')
    await expect(scorm12Radio).toBeChecked()

    const confirmBtn = page.getByTestId('publish-confirm-btn')
    await expect(confirmBtn).toContainText('Publish SCORM 1.2')
  })

  test('@regression T635 — selecting SCORM 2004 updates confirm button label', async ({ editorPage, page }) => {
    await editorPage.openPublishDialog()

    await page.getByTestId('format-option-scorm2004').getByRole('radio').click()

    const confirmBtn = page.getByTestId('publish-confirm-btn')
    await expect(confirmBtn).toContainText('Publish SCORM 2004')
  })

  test('@regression T635 — selecting AICC updates confirm button label', async ({ editorPage, page }) => {
    await editorPage.openPublishDialog()

    await page.getByTestId('format-option-aicc').getByRole('radio').click()

    const confirmBtn = page.getByTestId('publish-confirm-btn')
    await expect(confirmBtn).toContainText('Publish AICC')
  })

  test('@regression T635 — select SCORM 2004 and confirm downloads a ZIP', async ({ editorPage, page }) => {
    test.setTimeout(60_000)

    await editorPage.openPublishDialog()
    await page.getByTestId('format-option-scorm2004').getByRole('radio').click()

    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 })
    await page.getByTestId('publish-confirm-btn').click()

    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/scorm2004.*\.zip$|\.zip$/)
  })
})
