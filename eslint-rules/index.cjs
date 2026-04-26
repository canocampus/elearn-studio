'use strict'

/**
 * Local ESLint plugin entry point.
 *
 * Plugin is resolved by ESLint as `elearn-local` (the `eslint-plugin-` prefix
 * is dropped per ESLint convention). Reference rules in `.eslintrc.cjs` as:
 *
 *   plugins: ['elearn-local']
 *   rules: { 'elearn-local/no-unsafe-domain-cast': 'error' }
 */

module.exports = {
  rules: {
    'no-unsafe-domain-cast': require('./no-unsafe-domain-cast.cjs'),
  },
}
