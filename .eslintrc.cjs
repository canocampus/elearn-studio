module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'elearn-local'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  env: {
    node: true,
    es2022: true,
  },
  overrides: [
    {
      files: ['packages/authoring-ui/**', 'packages/actions-editor/**'],
      plugins: ['react', 'react-hooks'],
      extends: [
        'plugin:react/recommended',
        'plugin:react/jsx-runtime',
        'plugin:react-hooks/recommended',
      ],
      settings: {
        react: { version: 'detect' },
      },
    },
    {
      // Playwright's test/beforeAll/beforeEach API REQUIRES the first argument
      // to be a destructure pattern (so its fixtures injector can recognise the
      // shape). When a hook needs no fixtures, the canonical Playwright form is
      // `async ({}, testInfo) => …` — `no-empty-pattern` flags this as a style
      // issue but the rule cannot know about Playwright's runtime contract.
      // Disabling the rule for E2E spec files is a scoped, justified exception
      // (per AGENTS.md §11.8 lint-suppression policy): the off-toggle is paired
      // with a documented reason, and confined to the directory where the API
      // contract makes the empty pattern legitimate. Discovered as a regression
      // in TD-014.35 → TD-014.27.e: the alternative ('_args' rename) broke
      // Playwright's runtime validator at suite start.
      files: ['e2e/**/*.spec.ts'],
      rules: {
        'no-empty-pattern': 'off',
      },
    },
    {
      // Phase 1 + Phase 2 of the `as unknown as <DomainType>` cleanup:
      //  - Phase 1 (test stubs): decisions/2026-04-26-as-unknown-as-test-stub-cast.md
      //  - Phase 2 (production): decisions/2026-04-26-as-unknown-as-production-cast.md
      // The rule is type-aware (resolves the cast target's source file to
      // distinguish "ours" from `node_modules/`); `parserOptions.project` is
      // therefore set in this override only — global type-aware linting would
      // slow CI without benefit elsewhere.
      files: [
        'packages/*/src/**/*.ts',
        'packages/*/src/**/*.tsx',
        'backend/*/src/**/*.ts',
      ],
      parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: __dirname,
      },
      rules: {
        'elearn-local/no-unsafe-domain-cast': 'error',
      },
    },
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', {
      varsIgnorePattern: '^_',
      argsIgnorePattern: '^_',
      ignoreRestSiblings: true,
    }],
  },
  ignorePatterns: ['dist/', 'node_modules/', '.venv/', 'coverage/'],
}
