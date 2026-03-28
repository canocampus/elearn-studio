/**
 * capture-moodle-screenshot.ts
 *
 * Captures screenshot 18-moodle-course.png — a SCORM course in Moodle.
 *
 * Steps:
 *   1. Log in to Moodle (admin)
 *   2. Find or create a "Safety Procedures Training" course
 *   3. Capture the course page screenshot
 *
 * Usage:
 *   cd docs && npx tsx scripts/capture-moodle-screenshot.ts
 */

import { chromium } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const MOODLE_URL   = process.env.MOODLE_URL              ?? 'http://localhost:8081'
const MOODLE_ADMIN = process.env.MOODLE_ADMIN_USER       ?? 'admin'
const MOODLE_PASS  = process.env.MOODLE_ADMIN_PASSWORD   ?? 'Admin1234!'

const OUTPUT_PATH = path.join(__dirname, '../assets/screenshots/18-moodle-course.png')

function log(msg: string)  { console.log(`[moodle-capture] ${msg}`) }
function warn(msg: string) { console.warn(`[moodle-capture] WARN: ${msg}`) }

async function main() {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()

  try {
    // ── 1. Log in ──────────────────────────────────────────────────────────
    log('Logging in to Moodle…')
    await page.goto(`${MOODLE_URL}/login/index.php`)
    await page.locator('#username').waitFor({ state: 'visible', timeout: 30_000 })
    await page.locator('#username').fill(MOODLE_ADMIN)
    await page.locator('#password').fill(MOODLE_PASS)
    await page.locator('#loginbtn').click()
    await page.waitForURL(`${MOODLE_URL}/**`, { timeout: 30_000 })
    log(`Logged in — at ${page.url()}`)

    // ── 2. Find an existing course or create one ───────────────────────────
    log('Looking for existing Safety Procedures Training course…')
    await page.goto(`${MOODLE_URL}/course/management.php`)
    await page.waitForLoadState('domcontentloaded')

    // Try to click the course link if it exists
    const courseLink = page.locator('a:has-text("Safety Procedures Training")').first()
    let courseViewUrl: string | null = null

    if (await courseLink.count() > 0) {
      const href = await courseLink.getAttribute('href')
      if (href) {
        // href is something like /course/view.php?id=4 or /moodle/course/view.php?id=4
        courseViewUrl = href.startsWith('http') ? href : `${MOODLE_URL}${href}`
        log(`Found existing course: ${courseViewUrl}`)
      }
    }

    if (!courseViewUrl) {
      log('Course not found via management page — scanning /course/index.php…')
      await page.goto(`${MOODLE_URL}/course/index.php`)
      await page.waitForLoadState('domcontentloaded')
      const altLink = page.locator('a:has-text("Safety Procedures Training")').first()
      if (await altLink.count() > 0) {
        const href = await altLink.getAttribute('href')
        if (href) courseViewUrl = href.startsWith('http') ? href : `${MOODLE_URL}${href}`
        log(`Found existing course via index: ${courseViewUrl}`)
      }
    }

    if (!courseViewUrl) {
      log('No existing course found — creating one…')
      await page.goto(`${MOODLE_URL}/course/edit.php?category=1`)
      await page.locator('#id_fullname').waitFor({ state: 'visible', timeout: 20_000 })
      await page.locator('#id_fullname').fill('Safety Procedures Training')
      await page.locator('#id_shortname').fill(`safety-${Date.now()}`)
      await page.locator('#id_saveanddisplay').click()
      await page.waitForURL(`${MOODLE_URL}/course/view.php?id=*`, { timeout: 30_000 })
      courseViewUrl = page.url()
      log(`Created course: ${courseViewUrl}`)
    }

    // ── 3. Navigate to course and capture ─────────────────────────────────
    log(`Navigating to course: ${courseViewUrl}`)
    await page.goto(courseViewUrl)
    await page.waitForLoadState('networkidle', { timeout: 30_000 })
    await page.waitForTimeout(1500)

    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true })
    await page.screenshot({ path: OUTPUT_PATH, fullPage: false })
    log(`✓ Saved: ${OUTPUT_PATH}`)

  } catch (err) {
    warn(`Fatal: ${err}`)
    // Fallback: capture whatever page is currently loaded
    try {
      fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true })
      await page.screenshot({ path: OUTPUT_PATH, fullPage: false })
      warn(`Fallback screenshot saved to ${OUTPUT_PATH}`)
    } catch (_) { /* ignore */ }
    process.exitCode = 1
  } finally {
    await browser.close()
  }
}

main()
