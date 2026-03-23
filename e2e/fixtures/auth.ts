import { test as base, type Page } from '@playwright/test'
import { EditorPage } from '../pages/EditorPage'
import { LoginPage } from '../pages/LoginPage'

/**
 * Extended fixture that provides an authenticated page with the editor ready.
 *
 * Uses storageState from globalSetup (.auth/state.json) so the test starts
 * already logged in. The `editorPage` fixture navigates to / and waits for
 * the editor to be in the ready state.
 */

type AuthFixtures = {
  editorPage: EditorPage
  loginPage: LoginPage
}

export const test = base.extend<AuthFixtures>({
  editorPage: async ({ page }: { page: Page }, use: (page: EditorPage) => Promise<void>) => {
    const editorPage = new EditorPage(page)
    await editorPage.goto()
    await use(editorPage)
  },

  loginPage: async ({ page }: { page: Page }, use: (page: LoginPage) => Promise<void>) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    await use(loginPage)
  },
})

export { expect } from '@playwright/test'
