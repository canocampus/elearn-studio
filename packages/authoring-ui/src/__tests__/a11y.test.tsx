/**
 * T040 — Accessibility (WCAG 2.1 AA) automated tests
 *
 * Uses axe-core to verify dialogs, tab panels, landmarks, and live regions
 * meet WCAG AA standards. Each test renders the component in isolation and
 * checks for zero axe violations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import axe from 'axe-core'
import { NewCourseDialog } from '../components/layout/NewCourseDialog'
import { PublishDialog } from '../components/layout/PublishDialog'
import { EventSelector } from '../components/actions/EventSelector'

// ─── axe helper ──────────────────────────────────────────────────────────────

async function assertNoViolations(container: HTMLElement) {
  const results = await axe.run(container, {
    runOnly: {
      type: 'tag',
      values: ['wcag2a', 'wcag2aa'],
    },
  })
  if (results.violations.length > 0) {
    const msg = results.violations
      .map(v => `[${v.impact}] ${v.id}: ${v.description}\n  ${v.nodes.map(n => n.html).join('\n  ')}`)
      .join('\n')
    throw new Error(`axe violations:\n${msg}`)
  }
  expect(results.violations).toHaveLength(0)
}

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('../store/actionsStore', () => ({
  useActionsStore: (sel: (s: unknown) => unknown) => {
    const state = {
      sequences: [{ event: 'onClick', steps: [] }],
      selectedEvent: 'onClick',
      selectEvent: vi.fn(),
      addSequence: vi.fn(),
      removeSequence: vi.fn(),
    }
    return sel(state)
  },
}))

// ─── NewCourseDialog ─────────────────────────────────────────────────────────

describe('NewCourseDialog — accessibility', () => {
  it('has no axe violations', async () => {
    const { container } = render(
      <NewCourseDialog onConfirm={vi.fn()} onCancel={vi.fn()} />,
    )
    await assertNoViolations(container)
  })

  it('has role=dialog and aria-modal', () => {
    render(<NewCourseDialog onConfirm={vi.fn()} onCancel={vi.fn()} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-label', 'New Course')
  })

  it('closes on Escape key', () => {
    const onCancel = vi.fn()
    render(<NewCourseDialog onConfirm={vi.fn()} onCancel={onCancel} />)
    const input = screen.getByRole('textbox')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('template cards have aria-pressed', () => {
    render(<NewCourseDialog onConfirm={vi.fn()} onCancel={vi.fn()} />)
    const blankCard = screen.getByRole('button', { name: /blank/i })
    expect(blankCard).toHaveAttribute('aria-pressed')
  })
})

// ─── PublishDialog ───────────────────────────────────────────────────────────

const mockCourse = {
  _id: 'c1',
  title: 'Test Course',
  slides: [
    {
      id: 's1',
      title: 'Slide 1',
      widgets: [
        { id: 'w1', type: 'question-mc' },
        { id: 'w2', type: 'text' },
      ],
    },
  ],
  templates: [],
  resources: [],
  settings: {},
  metadata: {},
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

describe('PublishDialog — accessibility', () => {
  it('has no axe violations (normal state)', async () => {
    const { container } = render(
      <PublishDialog
        course={mockCourse as never}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        publishing={false}
      />,
    )
    await assertNoViolations(container)
  })

  it('has role=dialog, aria-modal, aria-labelledby', () => {
    render(
      <PublishDialog
        course={mockCourse as never}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        publishing={false}
      />,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    const titleId = dialog.getAttribute('aria-labelledby')!
    expect(document.getElementById(titleId)).toBeTruthy()
  })

  it('progress bar has role=progressbar with aria-valuenow', () => {
    render(
      <PublishDialog
        course={mockCourse as never}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        publishing={false}
      />,
    )
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow')
    expect(bar).toHaveAttribute('aria-valuemin', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '100')
  })

  it('Publish button has aria-busy=true while publishing', () => {
    render(
      <PublishDialog
        course={mockCourse as never}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        publishing={true}
      />,
    )
    const publishBtn = screen.getByRole('button', { name: /packaging/i })
    expect(publishBtn).toHaveAttribute('aria-busy', 'true')
  })

  it('closes on Escape key', () => {
    const onCancel = vi.fn()
    const { container } = render(
      <PublishDialog
        course={mockCourse as never}
        onConfirm={vi.fn()}
        onCancel={onCancel}
        publishing={false}
      />,
    )
    fireEvent.keyDown(container.firstElementChild!, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledOnce()
  })
})

// ─── EventSelector ───────────────────────────────────────────────────────────

describe('EventSelector — accessibility', () => {
  it('has no axe violations', async () => {
    const { container } = render(<EventSelector />)
    await assertNoViolations(container)
  })

  it('tab row has role=toolbar', () => {
    render(<EventSelector />)
    expect(screen.getByRole('toolbar')).toBeInTheDocument()
  })

  it('event buttons have aria-pressed reflecting selection state', () => {
    render(<EventSelector />)
    const btn = screen.getAllByRole('button', { name: /on click/i })
      .find(b => b.hasAttribute('aria-pressed'))!
    expect(btn).toHaveAttribute('aria-pressed', 'true')
  })

  it('Add event button has aria-haspopup=menu and aria-expanded', () => {
    render(<EventSelector />)
    const addBtn = screen.getByTitle('Add event')
    expect(addBtn).toHaveAttribute('aria-haspopup', 'menu')
    expect(addBtn).toHaveAttribute('aria-expanded', 'false')
  })
})
