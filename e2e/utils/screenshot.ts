/**
 * Screenshot utilities for the user-manual v2 capture campaign.
 *
 * Consumed by `e2e/tests/docs-screenshots.spec.ts` to produce the 54 PNGs
 * referenced by placeholder comments throughout `docs/user-guide/*.md`.
 *
 * This module is NOT used by regression tests. It is an authoring helper.
 */

import { type Page, type Locator } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'

// ---------------------------------------------------------------------------
// Output path — matches the `<!-- screenshot: ... -->` placeholder locations.
// ---------------------------------------------------------------------------

export const SCREENSHOTS_DIR = path.resolve(
  __dirname,
  '..',
  '..',
  'docs',
  'user-guide',
  'assets',
  'screenshots',
)

export function ensureScreenshotsDir(): void {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })
  }
}

// ---------------------------------------------------------------------------
// capture — save a cropped PNG into the manual's assets folder.
// ---------------------------------------------------------------------------

export interface CaptureOpts {
  /** Filename under docs/user-guide/assets/screenshots/ (e.g. "04-text-props.png"). */
  filename: string
  /** Explicit crop rectangle. */
  clip?: { x: number; y: number; width: number; height: number }
  /** Alternatively, derive the crop from this CSS selector's bounding box. */
  selector?: string
  /** Inflate the bounding box of `selector` by N pixels on every side. */
  padding?: number
  /** If true, capture the full page instead of a crop. */
  fullPage?: boolean
  /** Mask sensitive locators with a solid block (e.g. absolute timestamps). */
  mask?: Locator[]
}

export async function capture(page: Page, opts: CaptureOpts): Promise<string> {
  ensureScreenshotsDir()
  const outPath = path.join(SCREENSHOTS_DIR, opts.filename)

  let clip = opts.clip
  if (!clip && opts.selector) {
    const loc = page.locator(opts.selector).first()
    await loc.waitFor({ state: 'visible', timeout: 10_000 })
    const box = await loc.boundingBox()
    if (!box) {
      throw new Error(
        `capture(${opts.filename}): selector ${opts.selector} has no bounding box`,
      )
    }
    const p = opts.padding ?? 0
    clip = {
      x: Math.max(0, Math.round(box.x - p)),
      y: Math.max(0, Math.round(box.y - p)),
      width: Math.round(box.width + 2 * p),
      height: Math.round(box.height + 2 * p),
    }
  }

  await page.screenshot({
    path: outPath,
    clip,
    fullPage: opts.fullPage,
    mask: opts.mask,
    type: 'png',
  })

  // eslint-disable-next-line no-console
  console.log(`[docs-screenshots] wrote ${opts.filename}`)
  return outPath
}

// ---------------------------------------------------------------------------
// captureElement — screenshot a single element via locator.screenshot().
// Handles scroll-into-view automatically; robust to scrollable panels.
// ---------------------------------------------------------------------------

export interface CaptureElementOpts {
  /** Filename under docs/user-guide/assets/screenshots/. */
  filename: string
  /** Pixels to inflate the crop on every side (done by switching to page.screenshot with clip). */
  padding?: number
  /** Mask child locators before capture. */
  mask?: Locator[]
  /** Timeout in ms waiting for the element. */
  timeout?: number
}

/**
 * Capture a single element with Playwright's `locator.screenshot()`, which
 * scrolls the element into view, then writes a PNG.
 *
 * Use this for close-ups of panels or rows that may live inside a
 * scrollable container — it works where `page.screenshot({clip})` on a raw
 * bounding box would miss offscreen content.
 */
export async function captureElement(
  page: Page,
  selector: string,
  opts: CaptureElementOpts,
): Promise<string> {
  ensureScreenshotsDir()
  const outPath = path.join(SCREENSHOTS_DIR, opts.filename)
  const loc = page.locator(selector).first()
  await loc.waitFor({ state: 'visible', timeout: opts.timeout ?? 10_000 })

  if (opts.padding && opts.padding > 0) {
    // Padding requires switching to page.screenshot so we can inflate the bbox.
    const box = await loc.boundingBox()
    if (!box) throw new Error(`captureElement(${opts.filename}): no bbox`)
    const p = opts.padding
    await page.screenshot({
      path: outPath,
      type: 'png',
      mask: opts.mask,
      clip: {
        x: Math.max(0, Math.round(box.x - p)),
        y: Math.max(0, Math.round(box.y - p)),
        width: Math.round(box.width + 2 * p),
        height: Math.round(box.height + 2 * p),
      },
    })
  } else {
    await loc.screenshot({ path: outPath, type: 'png', mask: opts.mask })
  }

  // eslint-disable-next-line no-console
  console.log(`[docs-screenshots] wrote ${opts.filename} (element)`)
  return outPath
}

// ---------------------------------------------------------------------------
// captureFullPage — save a whole-page PNG as a safety net.
//
// Use this for UI states that are hard to crop automatically (native <select>
// popups, complex inline controls). The manual-capture step then only needs
// to CROP the relevant region from a deterministic snapshot — no need to
// reproduce the UI state by hand. By convention the filename ends in
// `-fullpage.png` so it is easy to distinguish from the final cropped asset.
// ---------------------------------------------------------------------------

export async function captureFullPage(
  page: Page,
  filename: string,
): Promise<string> {
  ensureScreenshotsDir()
  if (!filename.endsWith('-fullpage.png')) {
    filename = filename.replace(/\.png$/, '') + '-fullpage.png'
  }
  const outPath = path.join(SCREENSHOTS_DIR, filename)
  await page.screenshot({ path: outPath, type: 'png', fullPage: true })
  // eslint-disable-next-line no-console
  console.log(`[docs-screenshots] wrote ${filename} (full-page safety net)`)
  return outPath
}

// ---------------------------------------------------------------------------
// Callouts — inject numbered circles over elements for annotated screenshots.
// ---------------------------------------------------------------------------

export interface CalloutSpec {
  /** The number shown inside the circle (1, 2, 3, …). */
  number: number
  /** CSS selector of the element the circle should point at. */
  selector: string
  /**
   * Override the circle's position relative to the element's top-left corner.
   * Defaults to the element's centre.
   */
  offset?: { x: number; y: number }
}

/**
 * Overlays numbered callouts on the page. Use before `capture()` and pair
 * with `removeCallouts()` after to keep subsequent shots clean.
 */
export async function addCallouts(
  page: Page,
  specs: CalloutSpec[],
): Promise<void> {
  await page.evaluate((items) => {
    document.getElementById('__docs_callouts')?.remove()

    const root = document.createElement('div')
    root.id = '__docs_callouts'
    root.setAttribute('data-docs-overlay', 'true')
    root.style.cssText =
      'position:fixed;inset:0;pointer-events:none;z-index:2147483647'

    for (const item of items) {
      const el = document.querySelector(item.selector) as HTMLElement | null
      if (!el) continue
      const rect = el.getBoundingClientRect()
      const cx = rect.left + (item.offset?.x ?? rect.width / 2)
      const cy = rect.top + (item.offset?.y ?? rect.height / 2)
      const size = 32
      const circle = document.createElement('div')
      circle.style.cssText = [
        'position:absolute',
        `left:${Math.round(cx - size / 2)}px`,
        `top:${Math.round(cy - size / 2)}px`,
        `width:${size}px`,
        `height:${size}px`,
        'border-radius:50%',
        'background:#f9e2af',
        'color:#1e1e2e',
        'font-family:system-ui,sans-serif',
        'font-size:16px',
        'font-weight:700',
        'display:flex',
        'align-items:center',
        'justify-content:center',
        'box-shadow:0 0 0 3px #1e1e2e, 0 6px 14px rgba(0,0,0,0.4)',
      ].join(';')
      circle.textContent = String(item.number)
      root.appendChild(circle)
    }

    document.body.appendChild(root)
  }, specs)
}

export async function removeCallouts(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.getElementById('__docs_callouts')?.remove()
  })
}

// ---------------------------------------------------------------------------
// forceDarkTheme — the authoring UI already uses dark panels. Kept as a hook
// in case the Preview popup (different origin) ever needs coercing.
// ---------------------------------------------------------------------------

export async function forceDarkTheme(_page: Page): Promise<void> {
  // intentional no-op today
}

// ---------------------------------------------------------------------------
// Helpers for reading editor state programmatically in DEV builds.
// ---------------------------------------------------------------------------

/**
 * Adds a GrapesJS component to the current slide via the DEV-only
 * `window.__elearn_editor` handle and returns the new component's id.
 */
export async function addBlockById(
  page: Page,
  type: string,
  name?: string,
): Promise<string> {
  const id = await page.evaluate(
    ({ type, name }) => {
      const ed = window.__elearn_editor
      if (!ed) throw new Error('__elearn_editor not exposed (need DEV build)')
      const added = ed.addComponents([
        name ? { type, attributes: { name } } : { type },
      ])
      const c = Array.isArray(added) ? added[0] : added
      if (!c) throw new Error(`addComponents returned no component for ${type}`)
      if (name) c.set('name', name)
      ed.select(c)
      return c.getId()
    },
    { type, name },
  )
  return id
}

/**
 * Reposition a widget so it is not clipped at the canvas origin.
 *
 * `editor.addComponents(...)` places widgets at the wrapper origin (0,0),
 * which produces top-left-clipped thumbnails in the docs-screenshots
 * campaign. We set `left` / `top` via `component.addStyle({...})` — the same
 * path the normal drag-and-drop flow uses in `initEditor.ts::block:drag:stop`.
 *
 * `x` / `y` default to (400, 250), the mid-upper region of the 1024×768
 * slide canvas — close enough to "centered" for screenshot purposes without
 * needing to measure the widget's actual bounding box per widget type.
 */
export async function ensureWidgetIsCentered(
  page: Page,
  blockId: string,
  x: number = 400,
  y: number = 250,
): Promise<void> {
  await page.evaluate(
    ({ id, x, y }) => {
      const ed = window.__elearn_editor
      if (!ed) throw new Error('__elearn_editor not exposed (need DEV build)')
      const comp = ed.getWrapper().find('#' + id)[0]
      if (!comp) throw new Error(`no component with id ${id}`)
      comp.addStyle({
        position: 'absolute',
        left: `${Math.round(x)}px`,
        top: `${Math.round(y)}px`,
      })
    },
    { id: blockId, x, y },
  )
  // Yield a microtask so GrapesJS's component:update handlers fire before
  // the caller proceeds to screenshot.
  await page.waitForTimeout(50)
}

/**
 * Select a component by its GrapesJS id so its Props panel appears.
 */
export async function selectById(page: Page, id: string): Promise<void> {
  await page.evaluate((cid) => {
    const ed = window.__elearn_editor
    if (!ed) throw new Error('__elearn_editor not exposed')
    const match = ed.getWrapper().find('#' + cid)[0]
    if (!match) throw new Error(`no component with id ${cid}`)
    ed.select(match)
  }, id)
}
