import { type Page, type Locator } from '@playwright/test'

/**
 * Page Object Model for the Login page.
 *
 * Selectors derived from packages/authoring-ui/src/pages/LoginPage.tsx:
 * - Email:    <input type="email" autoComplete="email"> inside <label>Email</label>
 * - Password: <input type="password" autoComplete="current-password"> inside <label>Password</label>
 * - Submit:   <button type="submit">Sign in</button>
 * - Error:    <p> element shown when login fails
 */
export class LoginPage {
  readonly email: Locator
  readonly password: Locator
  readonly submitButton: Locator
  readonly errorMessage: Locator

  constructor(private readonly page: Page) {
    this.email = page.getByLabel('Email')
    this.password = page.getByLabel('Password')
    this.submitButton = page.getByRole('button', { name: 'Sign in' })
    this.errorMessage = page.locator('form p')
  }

  async goto() {
    await this.page.goto('/')
    await this.waitForVisible()
  }

  async waitForVisible() {
    await this.email.waitFor({ state: 'visible', timeout: 15_000 })
  }

  async login(email: string, password: string) {
    await this.email.fill(email)
    await this.password.fill(password)
    await this.submitButton.click()
  }
}
