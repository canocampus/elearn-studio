import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
    testTimeout: 60000,
    hookTimeout: 60000,
    // Single worker prevents parallel MongoDB binary downloads
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
  },
})
