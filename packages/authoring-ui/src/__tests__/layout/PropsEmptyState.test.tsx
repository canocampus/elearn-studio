/**
 * TD-010 — Centralised Props empty-state regression guard.
 *
 * Before the fix, every PropertiesPanel rendered its own "Select a X widget"
 * fallback, so the Props tab stacked up to 7 grey placeholder messages below
 * any real panel. The fix moves the copy to a single component in AppLayout
 * and has the per-widget panels return `null`.
 *
 * This suite pins the contract of the two exported helpers:
 *   - hasCustomPropsPanel(type): true only for the 7 widget families that
 *     ship a dedicated Props panel; false for text/image/rectangle/score-*
 *     and for null (no selection).
 *   - PropsEmptyState: renders one message targeted by `data-testid`, and
 *     the copy adapts based on whether SOMETHING is selected (Styles-tab
 *     hint) or not (select-something hint).
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { hasCustomPropsPanel, PropsEmptyState } from '../../components/layout/propsEmptyState'

describe('TD-010 — hasCustomPropsPanel', () => {
  it('returns true for every widget family that ships a dedicated Props panel', () => {
    const families = [
      'question-mc',
      'question-tf',
      'question-fill',
      'phaser-sim',
      'button',
      'done-button',
      'nav-buttons',
      'media-player',
      'audio-narration',
      'progress-bar',
      'volume-control',
    ]
    for (const type of families) {
      expect(hasCustomPropsPanel(type)).toBe(true)
    }
  })

  it('returns false for widget types whose props live in the Styles tab', () => {
    const noPanel = ['text', 'image', 'rectangle', 'score-quiz', 'score-field', 'screenshot-sim']
    for (const type of noPanel) {
      expect(hasCustomPropsPanel(type)).toBe(false)
    }
  })

  it('returns false when nothing is selected', () => {
    expect(hasCustomPropsPanel(null)).toBe(false)
  })
})

describe('TD-010 — PropsEmptyState', () => {
  it('renders the select-a-widget hint when nothing is selected', () => {
    render(<PropsEmptyState selectedType={null} />)
    const node = screen.getByTestId('props-empty-state')
    expect(node.textContent).toMatch(/select a widget/i)
  })

  it('renders the Styles-tab hint when a widget is selected that has no custom panel', () => {
    render(<PropsEmptyState selectedType="text" />)
    const node = screen.getByTestId('props-empty-state')
    expect(node.textContent).toMatch(/styles tab/i)
  })

  it('stays a single node (no stacked copies)', () => {
    render(<PropsEmptyState selectedType={null} />)
    const nodes = screen.getAllByTestId('props-empty-state')
    expect(nodes).toHaveLength(1)
  })
})
