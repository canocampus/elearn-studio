/**
 * actions.ts — shared ActionsEditor drivers for the docs-screenshots campaign.
 *
 * Extracted in TD-013.9 from three near-identical spec-local helpers (§09
 * `ensureClickEvent`, §11 `insertFromPalette`, §17 `ensureEvent`). The
 * defensive menu-close from the §09 variant is preserved for EVERY event —
 * a half-open "+ Event" menu overlays later captures (playbook T-9 / T-12).
 */

import type { Page } from '@playwright/test'

/**
 * Add (or focus) an event tab in the ActionsEditor via the real `+ Event`
 * menu.
 *
 * Detection uses `role="group"` — EventSelector does NOT render `role="tab"`;
 * each event is a `<div role="group" aria-label="...">` containing a toggle
 * `<button>` (EventSelector.tsx:33-45; playbook T-12). If the event already
 * exists its toggle is clicked so the sequence becomes the active one.
 */
export async function ensureEvent(page: Page, label: RegExp): Promise<void> {
  const group = page.getByRole('group', { name: label })
  if ((await group.count()) > 0) {
    await group.getByRole('button').first().click({ timeout: 3000 })
    return
  }
  try {
    await page.getByRole('button', { name: /\+ *Event/i }).click({ timeout: 5000 })
    await page.getByRole('menuitem', { name: label }).click({ timeout: 5000 })
  } catch {
    // Best effort — close any half-open +Event menu so downstream captures
    // aren't covered by the overlay.
    if ((await page.locator('[role="menu"]').count()) > 0) {
      await page
        .getByRole('button', { name: /\+ *Event/i })
        .click({ timeout: 1500 })
        .catch(() => undefined)
    }
  }
}

/** Insert an action into the active sequence by clicking its palette button. */
export async function insertActionFromPalette(page: Page, label: RegExp): Promise<void> {
  const palette = page.locator('[data-testid="action-palette"]')
  await palette.waitFor({ state: 'visible', timeout: 5000 })
  await palette.getByRole('button', { name: label }).first().click({ timeout: 4000 })
}
