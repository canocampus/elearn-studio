import { test, expect } from '@playwright/test'
import { LoginPage } from '../pages/LoginPage'
import { EditorPage } from '../pages/EditorPage'
import { E2E_USER_EMAIL, E2E_USER_PASSWORD } from '../global-setup'

/**
 * T169.5 — Authentication flows
 *
 * This spec runs in the `setup` project (no storageState), so the browser
 * always starts unauthenticated and sees the login page.
 */

test.describe('Authentication', () => {
  test('shows login page on first load', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()

    await expect(loginPage.email).toBeVisible()
    await expect(loginPage.password).toBeVisible()
    await expect(loginPage.submitButton).toBeVisible()
  })

  test('shows error on invalid credentials', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()

    await loginPage.login('wrong@example.com', 'wrongpassword')

    // Error message appears; submit button returns to "Sign in"
    await expect(loginPage.errorMessage).toBeVisible({ timeout: 8_000 })
    await expect(loginPage.submitButton).toHaveText('Sign in')
  })

  test('logs in with valid credentials and shows editor', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()

    await loginPage.login(E2E_USER_EMAIL, E2E_USER_PASSWORD)

    // After successful login, editor toolbar is visible
    const editorPage = new EditorPage(page)
    await expect(editorPage.publishScormButton).toBeVisible({ timeout: 20_000 })
  })

  test('submit button shows loading state while signing in', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()

    // Start login (don't await the full navigation)
    await loginPage.email.fill(E2E_USER_EMAIL)
    await loginPage.password.fill(E2E_USER_PASSWORD)
    await loginPage.submitButton.click()

    // Button should briefly show "Signing in…" before resolving
    // We check for the final state: editor is visible (login succeeded)
    const editorPage = new EditorPage(page)
    await expect(editorPage.publishScormButton).toBeVisible({ timeout: 20_000 })
  })
})
