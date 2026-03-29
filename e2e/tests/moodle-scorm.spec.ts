import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

/**
 * Moodle SCORM Integration Test
 *
 * Creates an eLearn Studio course with 3 slides:
 *   Slide 1 — text widget only
 *   Slide 2 — text + image widget
 *   Slide 3 — Multiple Choice question (interactive)
 *
 * Exports the course as SCORM 1.2, uploads to Moodle, and verifies that
 * each slide renders correctly inside Moodle's SCORM player iframe.
 *
 * Prerequisites:
 *   - eLearn Studio running: http://localhost:3001 (API) and http://localhost:3000 (UI)
 *   - Moodle running: MOODLE_URL (default: http://localhost:8081)
 *   - Docker profile: docker compose --profile moodle up
 *
 * Opt-in: set E2E_MOODLE=1 or MOODLE_URL to enable.
 * All tests are skipped when neither env var is present.
 */

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3001'
const MOODLE_URL = process.env.MOODLE_URL ?? 'http://localhost:8081'
const MOODLE_ADMIN = process.env.MOODLE_ADMIN_USER ?? 'admin'
const MOODLE_PASSWORD = process.env.MOODLE_ADMIN_PASSWORD ?? 'Admin1234!'
const E2E_EMAIL = process.env.E2E_TEST_USER_EMAIL ?? 'e2e-test@elearn.test'
const E2E_PASSWORD = process.env.E2E_TEST_USER_PASSWORD ?? 'e2e-password-secure-123'

// Opt-in guard: must set MOODLE_URL or E2E_MOODLE=1 to run these tests
const MOODLE_ENABLED = !!(process.env.MOODLE_URL ?? process.env.E2E_MOODLE)

// Shared state across serial tests (set in Step 1, read in Step 2)
let zipPath = ''
let tmpDir = ''

test.describe.configure({ mode: 'serial' })

test.describe('Moodle SCORM Integration', () => {
  test.beforeEach(() => {
    test.skip(!MOODLE_ENABLED, 'Set MOODLE_URL or E2E_MOODLE=1 to run Moodle integration tests')
  })

  test.afterAll(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Step 1: Create an eLearn Studio course with 3 slides and export SCORM ZIP
  // ──────────────────────────────────────────────────────────────────────────
  test('Step 1 — build 3-slide course and download SCORM ZIP', async ({ request }) => {
    test.setTimeout(60_000)

    // Authenticate with the eLearn API
    const loginRes = await request.post(`${API_URL}/auth/login`, {
      data: { email: E2E_EMAIL, password: E2E_PASSWORD },
    })
    expect(loginRes.ok(), `eLearn API login failed: ${await loginRes.text()}`).toBeTruthy()
    const loginBody = await loginRes.json() as { data: { accessToken: string } }
    const accessToken = loginBody.data.accessToken

    // Create a fresh course
    const courseTitle = `Moodle SCORM Test ${Date.now()}`
    const createRes = await request.post(`${API_URL}/courses`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { title: courseTitle },
    })
    expect(createRes.ok(), `Course creation failed: ${await createRes.text()}`).toBeTruthy()
    const { data: course } = await createRes.json() as { data: { _id: string } }
    const courseId = course._id

    // Build slide data for 3 slides
    // Using a small inline SVG for the image widget — avoids external HTTP dependency
    const testImageSrc = [
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='200'%3E",
      "%3Crect width='400' height='200' fill='%2322a06b'/%3E",
      "%3Ctext x='200' y='110' text-anchor='middle' fill='white' font-size='28' font-family='sans-serif'%3ESlide 2 Image%3C/text%3E",
      "%3C/svg%3E",
    ].join('')

    const slides = [
      // Slide 1 — text only
      {
        id: 'moodle-slide-1',
        title: 'Slide 1 — Text',
        widgets: [
          {
            id: 'w-s1-text',
            type: 'text',
            bounds: { x: 100, y: 80, width: 824, height: 200 },
            layer: 1,
            visible: true,
            properties: {
              html: '<h2>Welcome to eLearn Studio</h2><p>This is slide 1 with text content only.</p>',
            },
            extendedProperties: {},
            actions: [],
          },
          {
            id: 'w-s1-nav',
            type: 'nav-buttons',
            bounds: { x: 412, y: 710, width: 200, height: 40 },
            layer: 2,
            visible: true,
            properties: {},
            extendedProperties: {},
            actions: [],
          },
        ],
      },
      // Slide 2 — text + image
      {
        id: 'moodle-slide-2',
        title: 'Slide 2 — Text and Image',
        widgets: [
          {
            id: 'w-s2-text',
            type: 'text',
            bounds: { x: 520, y: 80, width: 400, height: 120 },
            layer: 1,
            visible: true,
            properties: { html: '<p>Slide 2 has both text and an image widget.</p>' },
            extendedProperties: {},
            actions: [],
          },
          {
            id: 'w-s2-image',
            type: 'image',
            bounds: { x: 80, y: 80, width: 400, height: 200 },
            layer: 2,
            visible: true,
            properties: {
              src: testImageSrc,
              alt: 'Slide 2 test image',
            },
            extendedProperties: {},
            actions: [],
          },
          {
            id: 'w-s2-nav',
            type: 'nav-buttons',
            bounds: { x: 412, y: 710, width: 200, height: 40 },
            layer: 3,
            visible: true,
            properties: {},
            extendedProperties: {},
            actions: [],
          },
        ],
      },
      // Slide 3 — MC question (interactive)
      {
        id: 'moodle-slide-3',
        title: 'Slide 3 — Interactive Question',
        widgets: [
          {
            id: 'w-s3-mc',
            type: 'question-mc',
            bounds: { x: 100, y: 120, width: 700, height: 380 },
            layer: 1,
            visible: true,
            properties: {},
            extendedProperties: {
              questionText: 'What is the capital of France?',
              options: ['London', 'Paris', 'Berlin', 'Madrid'],
              correctIndex: 1,
              scoring: { weight: 100, attempts: -1 },
            },
            actions: [],
          },
        ],
      },
    ]

    // PUT the course to add slides and settings (backend uses PUT for full course update)
    const patchRes = await request.put(`${API_URL}/courses/${courseId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: {
        slides,
        settings: { width: 1024, height: 768, passingScore: 80 },
      },
    })
    expect(patchRes.ok(), `Course PUT failed: ${await patchRes.text()}`).toBeTruthy()

    // Export as SCORM 1.2 ZIP
    const exportRes = await request.post(`${API_URL}/courses/${courseId}/export/scorm12`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    expect(exportRes.ok(), `SCORM export failed: ${await exportRes.text()}`).toBeTruthy()
    expect(exportRes.headers()['content-type']).toMatch(/zip|octet-stream/)

    // Save the ZIP to a temp directory
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'elearn-moodle-'))
    zipPath = path.join(tmpDir, 'course.zip')
    const zipBuffer = await exportRes.body()
    fs.writeFileSync(zipPath, zipBuffer)

    expect(fs.existsSync(zipPath), 'ZIP file was not saved').toBeTruthy()
    expect(fs.statSync(zipPath).size, 'ZIP file is empty').toBeGreaterThan(1000)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Step 2: Upload to Moodle and verify content renders in SCORM player
  // ──────────────────────────────────────────────────────────────────────────
  test('Step 2 — upload to Moodle and verify slides render', async ({ browser }) => {
    test.setTimeout(180_000)

    expect(zipPath, 'ZIP path empty — Step 1 must have passed').toBeTruthy()
    expect(fs.existsSync(zipPath), 'ZIP file not found').toBeTruthy()

    const context = await browser.newContext({ acceptDownloads: false })
    const page = await context.newPage()

    try {
      // ── 1. Login to Moodle ─────────────────────────────────────────────────
      await page.goto(`${MOODLE_URL}/login/index.php`)
      // Use pressSequentially (not fill) for both fields — Moodle 5.x uses
      // core_form/submit JS that clears password fields set via direct value
      // assignment (page.fill). Simulating real keystrokes bypasses this.
      await page.locator('#username').pressSequentially(MOODLE_ADMIN)
      await page.locator('#password').pressSequentially(MOODLE_PASSWORD)
      await page.click('#loginbtn')
      // Wait for post-login redirect — Moodle redirects to /my/ after login
      // Avoid networkidle: Moodle has persistent background polling that prevents it
      await page.waitForURL(url => !url.pathname.includes('/login/'), { timeout: 20_000 })
      await page.waitForLoadState('domcontentloaded', { timeout: 10_000 })

      // ── 2. Create a Moodle course ──────────────────────────────────────────
      const shortname = `elearn-e2e-${Date.now()}`
      await page.goto(`${MOODLE_URL}/course/edit.php?category=1`)
      await page.waitForLoadState('domcontentloaded')
      await page.fill('#id_fullname', 'eLearn SCORM E2E Course')
      await page.fill('#id_shortname', shortname)
      await page.locator('#id_saveanddisplay').click()
      await page.waitForURL(/\/course\/view\.php/, { timeout: 20_000 })

      // Save the course URL for later navigation
      const courseViewUrl = page.url()

      // ── 3. Dismiss Moodle UI tour (appears on first course visit) ─────────────
      const skipTourBtn = page.locator('button[data-action="end-tour"], button:has-text("Skip tour"), .btn:has-text("Skip tour")').first()
      if (await skipTourBtn.isVisible({ timeout: 4_000 }).catch(() => false)) {
        await skipTourBtn.click()
        await page.waitForTimeout(800)
      }

      // ── 4. Enable editing mode ─────────────────────────────────────────────
      // Moodle 5.x uses a checkbox input inside .editmode-switch-form
      // Moodle 4.x used a button with data-key="editmode"
      const editCheckbox = page.locator('.editmode-switch-form input[type="checkbox"]').first()
      if (await editCheckbox.isVisible({ timeout: 5_000 }).catch(() => false)) {
        const checked = await editCheckbox.isChecked().catch(() => false)
        if (!checked) {
          await editCheckbox.click()
          await page.waitForLoadState('domcontentloaded', { timeout: 10_000 })
        }
      } else {
        // Fallback: Moodle 4.x button-based toggle
        const editModeBtn = page.locator('[data-key="editmode"]').first()
        if (await editModeBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
          const pressed = await editModeBtn.getAttribute('aria-pressed').catch(() => null)
          if (pressed !== 'true') {
            await editModeBtn.click()
            await page.waitForLoadState('domcontentloaded', { timeout: 10_000 })
          }
        }
      }

      // Dismiss any tour that appears after enabling edit mode
      const skipTourBtn2 = page.locator('button[data-action="end-tour"], button:has-text("Skip tour"), .btn:has-text("Skip tour")').first()
      if (await skipTourBtn2.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await skipTourBtn2.click()
        await page.waitForTimeout(800)
      }

      // ── 5. Add SCORM activity via direct URL ──────────────────────────────
      // The Moodle 5.x activity chooser UI has changed significantly.
      // Navigating directly to modedit.php bypasses the chooser entirely
      // and works across all Moodle versions.
      const courseId = courseViewUrl.match(/id=(\d+)/)?.[1]
      expect(courseId, 'Could not extract course ID from course view URL').toBeTruthy()
      await page.goto(
        `${MOODLE_URL}/course/modedit.php?add=scorm&type=&course=${courseId}&section=1&return=0&sr=0`
      )
      await page.waitForURL(/\/course\/modedit\.php/, { timeout: 20_000 })
      await page.waitForLoadState('domcontentloaded')

      // ── 6. Fill in SCORM settings and upload ZIP ───────────────────────────
      await page.fill('#id_name', 'eLearn Studio SCORM Test')

      // Open the file picker for the SCORM package field
      // Moodle 5.x renders the filepicker inside #fitem_id_packagefile
      // The "Add..." button is an <a role="button"> inside .fp-btn-add
      const addFileBtn = page.locator('#fitem_id_packagefile .fp-btn-add a[role="button"]').first()

      // Wait for the filepicker to load
      await expect(addFileBtn).toBeVisible({ timeout: 10_000 })
      await addFileBtn.click()
      await page.waitForTimeout(1_000)

      // File picker popup — click "Upload a file" tab
      const uploadTab = page.locator(
        '.fp-repo[title*="Upload"], ' +
        '.fp-tab-upload, ' +
        '[data-name="upload"], ' +
        'a[data-action="choose-repo"]:has-text("Upload")'
      ).first()
      if (await uploadTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await uploadTab.click()
        await page.waitForTimeout(500)
      }

      // Find the file input in the upload panel
      // Moodle uses `name="repo_upload_file"` for its upload input
      const fileInput = page.locator(
        'input[name="repo_upload_file"], ' +
        '.fp-upload-form input[type="file"], ' +
        '.moodle-dialogue-base input[type="file"]'
      ).first()
      await expect(fileInput).toBeAttached({ timeout: 10_000 })
      await fileInput.setInputFiles(zipPath)
      await page.waitForTimeout(500)

      // Click "Upload this file" to confirm the upload
      const uploadThisFileBtn = page.locator(
        'button.fp-upload-btn, ' +
        'input.fp-upload-btn, ' +
        'button:has-text("Upload this file"), ' +
        '[data-action="upload"]'
      ).first()
      await expect(uploadThisFileBtn).toBeVisible({ timeout: 5_000 })
      await uploadThisFileBtn.click()
      await page.waitForTimeout(2_000)

      // ── 7. Save the SCORM activity ─────────────────────────────────────────
      await page.locator('#id_submitbutton, [name="submitbutton"]').click()
      await page.waitForURL(
        /\/(mod\/scorm\/view|course\/view)\.php/,
        { timeout: 30_000 }
      )

      // If redirected to course view, navigate to the SCORM activity
      if (!page.url().includes('/mod/scorm/view.php')) {
        await page.goto(courseViewUrl)
        const scormLink = page.locator('a:has-text("eLearn Studio SCORM Test")').first()
        await expect(scormLink).toBeVisible({ timeout: 10_000 })
        await scormLink.click()
        await page.waitForURL(/\/mod\/scorm\/view\.php/, { timeout: 15_000 })
      }

      // ── 8. Launch the SCORM player ─────────────────────────────────────────
      // Moodle shows an "Enter" button to launch the SCORM
      const enterBtn = page.locator(
        'button:has-text("Enter"), ' +
        'a:has-text("Enter"), ' +
        'input[value="Enter"], ' +
        'button:has-text("Preview"), ' +
        'a.btn:has-text("Launch")'
      ).first()
      await expect(enterBtn).toBeVisible({ timeout: 20_000 })

      // SCORM typically opens in a popup window in Moodle 4.x
      const [popupPage] = await Promise.all([
        context.waitForEvent('page', { timeout: 15_000 }).catch(() => null),
        enterBtn.click(),
      ])

      // Use popup if it opened, otherwise use the current page
      const playerPage = popupPage ?? page

      if (popupPage) {
        await popupPage.waitForLoadState('domcontentloaded', { timeout: 20_000 })
      }

      // ── 9. Access the SCORM content iframe ────────────────────────────────
      // Moodle wraps the SCORM content in an iframe named "scorm_object"
      await playerPage.waitForTimeout(2_000)

      const scormFrame = playerPage.frameLocator(
        'iframe#scorm_object, iframe[name="scorm_object"]'
      )

      // ── 10. Verify Slide 1 — text content ──────────────────────────────────
      await expect(scormFrame.locator('.el-widget.el-text')).toBeVisible({ timeout: 20_000 })
      await expect(scormFrame.locator('.el-widget.el-text')).toContainText(
        'Welcome to eLearn Studio',
        { timeout: 10_000 }
      )

      // ── 11. Navigate to Slide 2 ─────────────────────────────────────────
      await scormFrame.locator('[data-action="next"]').click()
      await playerPage.waitForTimeout(500)

      // ── 12. Verify Slide 2 — image widget visible ────────────────────────
      await expect(scormFrame.locator('.el-widget.el-image img')).toBeVisible({ timeout: 10_000 })
      // The image src attribute must not be empty
      const imgSrc = await scormFrame.locator('.el-widget.el-image img').getAttribute('src')
      expect(imgSrc, 'Image widget must have a non-empty src').toBeTruthy()

      // ── 13. Navigate to Slide 3 ─────────────────────────────────────────
      await scormFrame.locator('[data-action="next"]').click()
      await playerPage.waitForTimeout(500)

      // ── 14. Verify Slide 3 — MC question interactive widget ──────────────
      await expect(scormFrame.locator('.el-widget.el-question-mc')).toBeVisible({ timeout: 10_000 })
      await expect(scormFrame.locator('.el-widget.el-question-mc')).toContainText(
        'What is the capital of France?'
      )
      // Radio options must be present and enabled
      await expect(scormFrame.locator('.el-widget.el-question-mc input[type="radio"]').first()).toBeVisible()
      // Verify all 4 options rendered
      await expect(scormFrame.locator('.el-widget.el-question-mc input[type="radio"]')).toHaveCount(4)

    } finally {
      await context.close()
    }
  })
})
