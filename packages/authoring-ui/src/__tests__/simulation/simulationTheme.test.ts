/**
 * simulationTheme — withDisabled helper (TD-014-followup-1 / R-M2).
 *
 * The reviewer pass flagged the spread-with-null pattern
 * `{ ...base, ...(cond ? buttons.disabled : null) }` as obscuring intent at
 * the callsite; `withDisabled(base, cond)` replaces it everywhere.
 */
import { describe, it, expect } from 'vitest'
import { buttons, withDisabled } from '../../components/simulation/simulationTheme'

describe('withDisabled (TD-014-followup-1)', () => {
  it('overlays buttons.disabled on the base style when disabled', () => {
    const result = withDisabled(buttons.primary, true)
    expect(result).toEqual({ ...buttons.primary, ...buttons.disabled })
    expect(result.opacity).toBe(0.5)
    expect(result.cursor).toBe('not-allowed')
  })

  it('returns the base style untouched when not disabled', () => {
    expect(withDisabled(buttons.secondary, false)).toEqual(buttons.secondary)
  })

  it('never mutates the base style object', () => {
    const base = { ...buttons.danger }
    withDisabled(base, true)
    expect(base).toEqual(buttons.danger)
  })
})
