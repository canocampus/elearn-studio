/**
 * T606 — Component Tests: Actions Panel
 *
 * T606.1 — ActionItemEditor renders with a navigate action without throwing
 * T606.2 — ActionItemEditor: changing the navigate target calls onChange with updated action
 * T606.3 — EventSelector renders the existing event tab from store state
 * T606.4 — EventSelector: clicking an inactive tab calls selectEvent (updates selectedEvent)
 * T606.5 — ActionSequenceEditor shows empty-state text when no actions in selected event
 * T606.6 — ActionPalette: clicking Navigate inserts a navigate action into the sequence
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ActionItemEditor } from '../../components/actions/ActionItemEditor'
import { EventSelector } from '../../components/actions/EventSelector'
import { ActionSequenceEditor } from '../../components/actions/ActionSequenceEditor'
import { ActionPalette } from '../../components/actions/ActionPalette'
import { useActionsStore } from '../../store/actionsStore'
import { useEditorStore } from '../../store/editorStore'

// ─── Reset stores between tests ────────────────────────────────────────────────

beforeEach(() => {
  useActionsStore.setState({
    widgetId: null,
    sequences: [],
    selectedEvent: null,
    variableNames: [],
    sharedSequences: [],
  })
  useEditorStore.setState({ course: null, currentSlideIndex: 0 })
})

afterEach(() => {
  vi.restoreAllMocks()
  useActionsStore.setState({
    widgetId: null,
    sequences: [],
    selectedEvent: null,
    variableNames: [],
    sharedSequences: [],
  })
})

// ─── T606.1 — ActionItemEditor renders without throwing ────────────────────────

describe('T606.1 — ActionItemEditor renders with navigate action', () => {
  it('renders without throwing and shows Navigate label', () => {
    const onChange = vi.fn()
    render(
      <ActionItemEditor
        action={{ type: 'navigate', params: { target: 'next' } }}
        onChange={onChange}
      />,
    )

    expect(screen.getByText('Navigate')).toBeTruthy()
    // NavigateParams select should show "Next slide" as current value
    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('next')
  })

  it('renders show action with Widget ID input (no widgets on slide)', () => {
    const onChange = vi.fn()
    render(
      <ActionItemEditor
        action={{ type: 'show', params: { widgetId: '' } }}
        onChange={onChange}
      />,
    )
    expect(screen.getByText('Show')).toBeTruthy()
  })

  it('renders score-quiz action with "(no parameters)" label', () => {
    render(
      <ActionItemEditor
        action={{ type: 'score-quiz' }}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByText('Score Quiz')).toBeTruthy()
    expect(screen.getByText('(no parameters)')).toBeTruthy()
  })

  it('renders set-variable action with variable name input', () => {
    render(
      <ActionItemEditor
        action={{ type: 'set-variable', params: { name: 'myVar', value: '42', valueType: 'literal' } }}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByText('Set Variable')).toBeTruthy()
    const nameInput = screen.getByPlaceholderText('Variable') as HTMLInputElement
    expect(nameInput.value).toBe('myVar')
  })
})

// ─── T606.2 — ActionItemEditor onChange when navigate target changes ───────────

describe('T606.2 — ActionItemEditor calls onChange with updated action', () => {
  it('calls onChange with new target when navigate select changes', () => {
    const onChange = vi.fn()
    render(
      <ActionItemEditor
        action={{ type: 'navigate', params: { target: 'next' } }}
        onChange={onChange}
      />,
    )

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'prev' } })

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith({
      type: 'navigate',
      params: { target: 'prev' },
    })
  })

  it('shows slideName input when target is slide-name', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <ActionItemEditor
        action={{ type: 'navigate', params: { target: 'next' } }}
        onChange={onChange}
      />,
    )

    rerender(
      <ActionItemEditor
        action={{ type: 'navigate', params: { target: 'slide-name', slideName: '' } }}
        onChange={onChange}
      />,
    )

    expect(screen.getByPlaceholderText('Slide title')).toBeTruthy()
  })

  it('calls onChange when slideName input changes', () => {
    const onChange = vi.fn()
    render(
      <ActionItemEditor
        action={{ type: 'navigate', params: { target: 'slide-name', slideName: '' } }}
        onChange={onChange}
      />,
    )

    const nameInput = screen.getByPlaceholderText('Slide title')
    fireEvent.change(nameInput, { target: { value: 'Introduction' } })

    expect(onChange).toHaveBeenCalledWith({
      type: 'navigate',
      params: { target: 'slide-name', slideName: 'Introduction' },
    })
  })

  it('calls onChange when display-message text changes', () => {
    const onChange = vi.fn()
    render(
      <ActionItemEditor
        action={{ type: 'display-message', params: { message: '', title: '' } }}
        onChange={onChange}
      />,
    )

    const msgTextarea = screen.getByPlaceholderText('Message text')
    fireEvent.change(msgTextarea, { target: { value: 'Hello!' } })

    expect(onChange).toHaveBeenCalledWith({
      type: 'display-message',
      params: { message: 'Hello!', title: '' },
    })
  })
})

// ─── T606.3 — EventSelector renders existing event tab ────────────────────────

describe('T606.3 — EventSelector renders tabs from store state', () => {
  it('renders an onClick tab when sequences has onClick event', () => {
    useActionsStore.setState({
      sequences: [{ event: 'onClick', actions: [] }],
      selectedEvent: 'onClick',
    })

    render(<EventSelector />)

    // formatEvent converts 'onClick' → 'On Click'
    expect(screen.getByText('On Click')).toBeTruthy()
  })

  it('renders multiple event tabs', () => {
    useActionsStore.setState({
      sequences: [
        { event: 'onClick', actions: [] },
        { event: 'onHover', actions: [] },
      ],
      selectedEvent: 'onClick',
    })

    render(<EventSelector />)

    expect(screen.getByText('On Click')).toBeTruthy()
    expect(screen.getByText('On Hover')).toBeTruthy()
  })

  it('renders "+ Event" button when there are available events', () => {
    useActionsStore.setState({
      sequences: [],
      selectedEvent: null,
    })

    render(<EventSelector />)
    expect(screen.getByText('+ Event')).toBeTruthy()
  })

  it('marks the selected event tab as aria-pressed=true', () => {
    useActionsStore.setState({
      sequences: [
        { event: 'onClick', actions: [] },
        { event: 'onHover', actions: [] },
      ],
      selectedEvent: 'onClick',
    })

    render(<EventSelector />)

    const onClickBtn = screen.getByRole('button', { name: 'On Click' })
    expect(onClickBtn.getAttribute('aria-pressed')).toBe('true')

    const onHoverBtn = screen.getByRole('button', { name: 'On Hover' })
    expect(onHoverBtn.getAttribute('aria-pressed')).toBe('false')
  })
})

// ─── T606.4 — EventSelector clicking a tab selects it ────────────────────────

describe('T606.4 — EventSelector tab click updates selectedEvent', () => {
  it('clicking onHover tab makes it selected', () => {
    useActionsStore.setState({
      sequences: [
        { event: 'onClick', actions: [] },
        { event: 'onHover', actions: [] },
      ],
      selectedEvent: 'onClick',
    })

    render(<EventSelector />)

    const onHoverBtn = screen.getByRole('button', { name: 'On Hover' })
    fireEvent.click(onHoverBtn)

    expect(useActionsStore.getState().selectedEvent).toBe('onHover')
  })

  it('clicking Remove button for an event removes it from sequences', () => {
    useActionsStore.setState({
      sequences: [{ event: 'onClick', actions: [] }],
      selectedEvent: 'onClick',
    })

    render(<EventSelector />)

    const removeBtn = screen.getByRole('button', { name: 'Remove On Click event' })
    fireEvent.click(removeBtn)

    expect(useActionsStore.getState().sequences).toHaveLength(0)
    expect(useActionsStore.getState().selectedEvent).toBeNull()
  })

  it('clicking "+ Event" shows the dropdown of available events', () => {
    useActionsStore.setState({
      sequences: [],
      selectedEvent: null,
    })

    render(<EventSelector />)

    fireEvent.click(screen.getByText('+ Event'))

    // The dropdown should appear with available events (onClick is available)
    const menu = screen.getByRole('menu', { name: 'Available events' })
    expect(menu).toBeTruthy()
  })

  it('clicking an event in the dropdown adds it to sequences', () => {
    useActionsStore.setState({
      sequences: [],
      selectedEvent: null,
    })

    render(<EventSelector />)
    fireEvent.click(screen.getByText('+ Event'))

    // Click the first available event in the dropdown
    const menuItems = screen.getAllByRole('menuitem')
    expect(menuItems.length).toBeGreaterThan(0)
    fireEvent.click(menuItems[0])

    // One sequence should now exist
    expect(useActionsStore.getState().sequences).toHaveLength(1)
  })
})

// ─── T606.5 — ActionSequenceEditor empty state ────────────────────────────────

describe('T606.5 — ActionSequenceEditor shows empty-state messages', () => {
  it('shows "No event selected" when selectedEvent is null', () => {
    useActionsStore.setState({
      sequences: [],
      selectedEvent: null,
    })

    render(<ActionSequenceEditor />)
    expect(screen.getByText('No event selected')).toBeTruthy()
  })

  it('shows "No actions yet" when selected event has no actions', () => {
    useActionsStore.setState({
      sequences: [{ event: 'onClick', actions: [] }],
      selectedEvent: 'onClick',
    })

    render(<ActionSequenceEditor />)
    expect(screen.getByText(/No actions yet/)).toBeTruthy()
  })

  it('shows action items when sequence has actions', () => {
    useActionsStore.setState({
      sequences: [
        {
          event: 'onClick',
          actions: [
            { type: 'navigate', params: { target: 'next' } },
          ],
        },
      ],
      selectedEvent: 'onClick',
    })

    render(<ActionSequenceEditor />)

    // Should render the event-list container (not empty state)
    expect(screen.getByTestId('event-list')).toBeTruthy()
    expect(screen.getByTestId('action-item')).toBeTruthy()
  })

  it('renders multiple action items in order', () => {
    useActionsStore.setState({
      sequences: [
        {
          event: 'onClick',
          actions: [
            { type: 'navigate', params: { target: 'next' } },
            { type: 'score-quiz' },
          ],
        },
      ],
      selectedEvent: 'onClick',
    })

    render(<ActionSequenceEditor />)

    const items = screen.getAllByTestId('action-item')
    expect(items).toHaveLength(2)
  })
})

// ─── T606.6 — ActionPalette inserts action into sequence ──────────────────────

describe('T606.6 — ActionPalette clicking a button inserts action into sequence', () => {
  it('clicking Navigate inserts a navigate action into the selected sequence', () => {
    useActionsStore.setState({
      sequences: [{ event: 'onClick', actions: [] }],
      selectedEvent: 'onClick',
    })

    render(<ActionPalette />)

    const navigateBtn = screen.getByRole('button', { name: 'Navigate' })
    fireEvent.click(navigateBtn)

    const { sequences } = useActionsStore.getState()
    expect(sequences[0].actions).toHaveLength(1)
    expect(sequences[0].actions[0].type).toBe('navigate')
  })

  it('clicking Show inserts a show action', () => {
    useActionsStore.setState({
      sequences: [{ event: 'onClick', actions: [] }],
      selectedEvent: 'onClick',
    })

    render(<ActionPalette />)

    fireEvent.click(screen.getByRole('button', { name: 'Show' }))

    const { sequences } = useActionsStore.getState()
    expect(sequences[0].actions[0].type).toBe('show')
  })

  it('clicking multiple palette buttons accumulates actions', () => {
    useActionsStore.setState({
      sequences: [{ event: 'onClick', actions: [] }],
      selectedEvent: 'onClick',
    })

    render(<ActionPalette />)

    fireEvent.click(screen.getByRole('button', { name: 'Navigate' }))
    fireEvent.click(screen.getByRole('button', { name: 'Hide' }))

    const { sequences } = useActionsStore.getState()
    expect(sequences[0].actions).toHaveLength(2)
    expect(sequences[0].actions[0].type).toBe('navigate')
    expect(sequences[0].actions[1].type).toBe('hide')
  })

  it('warns and does not insert when no event is selected', () => {
    useActionsStore.setState({
      sequences: [],
      selectedEvent: null,
    })

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    render(<ActionPalette />)
    fireEvent.click(screen.getByRole('button', { name: 'Navigate' }))

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('No event selected'),
      'navigate',
    )
    expect(useActionsStore.getState().sequences).toHaveLength(0)

    warnSpy.mockRestore()
  })

  it('calls onInsert callback instead of store when provided', () => {
    const onInsert = vi.fn()
    useActionsStore.setState({
      sequences: [],
      selectedEvent: null,
    })

    render(<ActionPalette onInsert={onInsert} />)
    fireEvent.click(screen.getByRole('button', { name: 'Navigate' }))

    expect(onInsert).toHaveBeenCalledTimes(1)
    expect(onInsert).toHaveBeenCalledWith({ type: 'navigate', params: { target: 'next' } })
    // Store not modified
    expect(useActionsStore.getState().sequences).toHaveLength(0)
  })
})
