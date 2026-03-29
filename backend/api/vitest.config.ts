import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      // Resolve workspace packages from their TypeScript source so tests run without
      // a pre-built dist/ folder (dist/ is gitignored and not present in CI).
      '@elearn-studio/scorm-packager': path.resolve(
        __dirname,
        '../../packages/scorm-packager/src/index.ts'
      ),
    },
  },
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
