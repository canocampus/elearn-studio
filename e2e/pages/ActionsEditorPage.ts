import { type Page, type Locator } from '@playwright/test'

/**
 * Page Object Model for the Actions Editor panel.
 *
 * The Actions tab is in the right sidebar of AppLayout.
 * Selectors derived from packages/authoring-ui/src/components/actions/ActionsEditor.tsx
 */
export class ActionsEditorPage {
  readonly actionsTab: Locator
  readonly panel: Locator
  readonly addEventButton: Locator
  readonly eventList: Locator

  constructor(private readonly page: Page) {
    this.actionsTab = page.getByRole('button', { name: 'Actions', exact: true })
    // The Actions panel container
    this.panel = page.locator('[data-testid="actions-panel"]')
    this.addEventButton = page.getByRole('button', { name: /Add event/i })
    this.eventList = page.locator('[data-testid="event-list"], .event-list')
  }

  async open() {
    await this.actionsTab.click()
    // Wait for the panel content to be visible
    await this.page.waitForTimeout(300)
  }

  eventItem(index: number): Locator {
    return this.eventList.locator('> *').nth(index)
  }

  actionItem(eventIndex: number, actionIndex: number): Locator {
    return this.eventItem(eventIndex)
      .locator('[data-testid="action-item"], .action-item')
      .nth(actionIndex)
  }
}
