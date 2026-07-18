/**
 * worked-example.ts — helpers for the §17 "Capitals of Europe" course build
 * in the docs-screenshots campaign (TD-013.5c, extracted in TD-013.9).
 *
 * The build orchestration itself (course creation, per-slide sections, the
 * finals-prep closures) stays in `docs-screenshots.spec.ts` — it IS the
 * campaign narrative the playbook maps §-by-§ (T-18). This module holds the
 * reusable primitives it composes.
 */

import type { Page } from '@playwright/test'
import { addBlockById, ensureWidgetIsCentered } from './screenshot'

/**
 * Retry a page.evaluate-backed step once if the execution context is
 * recycled mid-build. Observed deterministically during the §17 build
 * (~2s after the slide-3→4 edits — the autosave debounce window is the
 * prime suspect): the evaluate throws "Execution context was destroyed"
 * yet the page, URL and editor state demonstrably survive (no
 * framenavigated event, no [vite] reload, no pageerror — see the
 * campaign's diagnostic listeners; safety-net shots taken right after
 * show the built course intact). Root cause tracked as TD-020 in
 * docs/issues/issues-TD-013.md; for an authoring utility a single
 * settle-and-retry is the proportionate defence.
 */
export async function retryOnDestroyedContext<R>(page: Page, fn: () => Promise<R>): Promise<R> {
  try {
    return await fn()
  } catch (err) {
    if (!String(err).includes('Execution context was destroyed')) throw err
    // eslint-disable-next-line no-console
    console.warn('[docs-screenshots] evaluate hit a destroyed context — retrying once')
    await page.waitForTimeout(1000)
    return await fn()
  }
}

/** Place a block at explicit slide coordinates with optional dimensions. */
export async function placeAt(
  page: Page,
  type: string,
  name: string,
  x: number,
  y: number,
  size?: { width?: number; height?: number },
): Promise<string> {
  const id = await retryOnDestroyedContext(page, () => addBlockById(page, type, name))
  await retryOnDestroyedContext(page, () => ensureWidgetIsCentered(page, id, x, y))
  if (size) {
    await retryOnDestroyedContext(page, () =>
      page.evaluate(
        ({ id, size }) => {
          const comp = window.__elearn_editor?.getWrapper().find('#' + id)[0]
          if (!comp) return
          const styles: Record<string, string> = {}
          if (size.width) styles['width'] = `${size.width}px`
          if (size.height) styles['height'] = `${size.height}px`
          comp.addStyle(styles)
        },
        { id, size },
      ),
    )
  }
  return id
}

/** Replace a text widget's content and apply typography styles. */
export async function setTextContent(
  page: Page,
  id: string,
  text: string,
  styles: Record<string, string>,
): Promise<void> {
  await retryOnDestroyedContext(page, () =>
    page.evaluate(
      ({ id, text, styles }) => {
        const comp = window.__elearn_editor?.getWrapper().find('#' + id)[0]
        if (!comp) throw new Error(`setTextContent: no component ${id}`)
        comp.components(text)
        comp.addStyle(styles)
      },
      { id, text, styles },
    ),
  )
  await page.waitForTimeout(50)
}

/**
 * Re-resolve a widget id by its `name` on the CURRENT slide. Component ids
 * from placeAt go stale after slide switches (GrapesJS regenerates ids when
 * a slide reloads — playbook T-5). The `name` TRAIT is stripped by the save
 * round-trip (TD-019), so the fallback matches the persisted `[name]` DOM
 * attribute.
 */
export async function idByName(page: Page, name: string): Promise<string | undefined> {
  return await retryOnDestroyedContext(page, () =>
    page.evaluate((n) => {
      const ed = window.__elearn_editor
      if (!ed) return undefined
      for (const c of ed.getWrapper().components()) {
        if (c.get('name') === n) return c.getId()
      }
      return ed.getWrapper().find(`[name="${n}"]`)[0]?.getId()
    }, name),
  )
}

/**
 * Illustrative inline-SVG "map" so MapImage renders real content without a
 * Garage upload round-trip. Honestly labelled — it is not a real map.
 */
export const EUROPE_MAP_DATA_URI =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="260" viewBox="0 0 400 260">' +
      '<rect width="400" height="260" fill="#dbeafe"/>' +
      '<path d="M60 180 L95 120 L150 95 L210 70 L280 60 L330 90 L345 140 L310 185 L250 205 L180 215 L110 205 Z" fill="#86efac" stroke="#16a34a" stroke-width="3"/>' +
      '<path d="M120 150 L160 130 L200 140 L190 175 L140 180 Z" fill="#4ade80"/>' +
      '<circle cx="205" cy="120" r="6" fill="#1d4ed8"/>' +
      '<text x="200" y="245" font-family="system-ui" font-size="16" fill="#1e3a5f" text-anchor="middle">Map of Europe (illustrative)</text>' +
      '</svg>',
  )
