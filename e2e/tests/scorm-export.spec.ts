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
})
