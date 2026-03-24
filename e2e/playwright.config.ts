import { defineConfig, devices } from '@playwright/test'

/**
 * E2E test configuration for eLearn Studio.
 *
 * Environment variables:
 *   E2E_BASE_URL  — authoring-ui URL (default: http://localhost:3000)
 *   E2E_API_URL   — backend API URL  (default: http://localhost:3001)
 *
 * Authentication state is prepared once in globalSetup and reused across tests
 * via storageState so each test starts already logged in.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000'

export default defineConfig({
  testDir: './tests',
  outputDir: '../test-results/e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },

  // Fail the build on CI if you accidentally left test.only in the source code.
  forbidOnly: !!process.env.CI,
  // Retry on CI only.
  retries: process.env.CI ? 2 : 0,
  // One worker in CI for stability; parallel locally.
  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ['list'],
    ['html', { outputFolder: '../test-results/e2e-report', open: 'never' }],
  ],

  globalSetup: './global-setup',
  globalTeardown: './global-teardown',

  use: {
    baseURL: BASE_URL,
    // All authenticated tests load this cookie/localStorage snapshot.
    storageState: '.auth/state.json',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },

  projects: [
    // ── Unauthenticated setup project ────────────────────────────────────────
    // Runs auth.spec.ts without a pre-baked login state so we can test the
    // login page itself.
    {
      name: 'setup',
      testMatch: /auth\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        // Explicitly clear storage so auth tests start unauthenticated.
        // `undefined` falls through to the global storageState; an explicit
        // empty object is required to override it.
        storageState: { cookies: [], origins: [] },
      },
    },

    // ── Main test project — Chromium headless ─────────────────────────────────
    {
      name: 'chromium',
      testIgnore: /auth\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/state.json',
      },
    },
  ],
})
