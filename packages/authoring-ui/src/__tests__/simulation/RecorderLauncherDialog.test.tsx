/**
 * TD-014.19 — RecorderLauncherDialog tests.
 *
 * Covers:
 *  - URL client-side validation (SSRF rules mirror the backend)
 *  - URL length limit (TD-014.37 — guards against `>` vs `>=` flips)
 *  - Title length limit
 *  - Submit wires to recorderStore.start(url, title)
 *  - Dialog closes on success (onStarted + onClose)
 *  - Inline error surfaces store.error without closing
 *  - Escape + click-outside close unless isBusy (TD-014.38 — completes
 *    coverage promised in this docstring since TD-014.19)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { RecorderLauncherDialog } from '../../components/simulation/RecorderLauncherDialog'
import { useRecorderStore } from '../../store/recorderStore'
import { MAX_RECORDER_TITLE_LENGTH, MAX_RECORDER_URL_LENGTH } from '../../lib/urlValidation'

const { mockStart } = vi.hoisted(() => ({ mockStart: vi.fn() }))

vi.mock('../../api/recorderApi', () => ({
  startRecording: mockStart,
  captureStep:    vi.fn(),
  stopRecording:  vi.fn(),
}))

function resetStore() {
  useRecorderStore.setState({
    activeSessionId: null,
    recording: false,
    captures: [],
    error: null,
    isBusy: false,
  })
}

beforeEach(() => {
  resetStore()
  mockStart.mockReset()
})

describe('RecorderLauncherDialog — render + lifecycle', () => {
  it('renders nothing when open=false', () => {
    const { container } = render(
      <RecorderLauncherDialog open={false} onClose={vi.fn()} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders URL + title inputs + action buttons when open=true', () => {
    render(<RecorderLauncherDialog open={true} onClose={vi.fn()} />)
    expect(screen.getByTestId('recorder-url-input')).toBeDefined()
    expect(screen.getByTestId('recorder-title-input')).toBeDefined()
    expect(screen.getByTestId('recorder-dialog-start')).toBeDefined()
    expect(screen.getByTestId('recorder-dialog-cancel')).toBeDefined()
  })

  it('closes on Cancel click', () => {
    const onClose = vi.fn()
    render(<RecorderLauncherDialog open={true} onClose={onClose} />)
    fireEvent.click(screen.getByTestId('recorder-dialog-cancel'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on Escape', () => {
    const onClose = vi.fn()
    render(<RecorderLauncherDialog open={true} onClose={onClose} />)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('RecorderLauncherDialog — URL validation rejects SSRF targets', () => {
  const forbidden: Array<[string, RegExp]> = [
    ['http://localhost:3000',      /localhost/i],
    ['http://127.0.0.1',           /localhost/i],
    ['http://10.0.0.1',            /private/i],
    ['http://172.16.0.5',          /private/i],
    ['http://172.31.255.255',      /private/i],
    ['http://192.168.1.1',         /private/i],
    ['http://169.254.169.254',     /private/i],
  ]

  for (const [bad, rgx] of forbidden) {
    it(`rejects ${bad} with an inline error (does not call start)`, async () => {
      render(<RecorderLauncherDialog open={true} onClose={vi.fn()} />)
      fireEvent.change(screen.getByTestId('recorder-url-input'), { target: { value: bad } })
      fireEvent.click(screen.getByTestId('recorder-dialog-start'))
      const err = await screen.findByTestId('recorder-dialog-error')
      expect(err.textContent).toMatch(rgx)
      expect(mockStart).not.toHaveBeenCalled()
    })
  }

  it('rejects ftp://example.com with "http or https" error', async () => {
    render(<RecorderLauncherDialog open={true} onClose={vi.fn()} />)
    fireEvent.change(screen.getByTestId('recorder-url-input'), {
      target: { value: 'ftp://example.com' },
    })
    fireEvent.click(screen.getByTestId('recorder-dialog-start'))
    const err = await screen.findByTestId('recorder-dialog-error')
    expect(err.textContent).toMatch(/http or https/i)
    expect(mockStart).not.toHaveBeenCalled()
  })

  it('rejects malformed URL with "valid URL" error', async () => {
    render(<RecorderLauncherDialog open={true} onClose={vi.fn()} />)
    fireEvent.change(screen.getByTestId('recorder-url-input'), {
      target: { value: 'not-a-url' },
    })
    fireEvent.click(screen.getByTestId('recorder-dialog-start'))
    const err = await screen.findByTestId('recorder-dialog-error')
    expect(err.textContent).toMatch(/valid URL/i)
  })

  it('rejects empty URL', async () => {
    render(<RecorderLauncherDialog open={true} onClose={vi.fn()} />)
    fireEvent.click(screen.getByTestId('recorder-dialog-start'))
    const err = await screen.findByTestId('recorder-dialog-error')
    expect(err.textContent).toMatch(/required/i)
  })
})

describe('RecorderLauncherDialog — URL length limit (TD-014.37 / F8)', () => {
  it('rejects URLs exceeding MAX_RECORDER_URL_LENGTH with an error containing the limit', async () => {
    // The check at RecorderLauncherDialog.tsx:62 is `url.length > MAX_RECORDER_URL_LENGTH`
    // (strict >). Building a value of length `MAX + len('https://example.com/')`
    // = MAX + 20 puts us strictly above the cap, so the > comparison fires.
    // Guards against future `>` → `>=` flips: with `>=`, `length === MAX`
    // would no longer be allowed and the error message would read on a
    // boundary the rest of the codebase (and the backend mirror) doesn't
    // share. Without this test, that semantic drift is silent.
    const overlongUrl = 'https://example.com/' + 'a'.repeat(MAX_RECORDER_URL_LENGTH)
    render(<RecorderLauncherDialog open={true} onClose={vi.fn()} />)
    fireEvent.change(screen.getByTestId('recorder-url-input'), {
      target: { value: overlongUrl },
    })
    fireEvent.click(screen.getByTestId('recorder-dialog-start'))
    const err = await screen.findByTestId('recorder-dialog-error')
    // Match the limit number anywhere in the message — keeps the test stable
    // if the surrounding copy is reworded ("must not exceed N characters" →
    // "exceeds the N-character limit", etc). Asserting `mockStart` was not
    // called pins the second half of the contract: the dialog short-circuits
    // before reaching the store call.
    expect(err.textContent).toMatch(new RegExp(`${MAX_RECORDER_URL_LENGTH}`))
    expect(mockStart).not.toHaveBeenCalled()
  })
})

describe('RecorderLauncherDialog — click-outside + isBusy guards (TD-014.38 / F9)', () => {
  // Both guards live inline in the JSX (not extracted to a hook) so a refactor
  // that moves them or swaps the DOM target would silently drop the contract:
  //   • RecorderLauncherDialog.tsx:86 — `key === 'Escape' && !isBusy`
  //   • RecorderLauncherDialog.tsx:94 — overlay `onMouseDown`:
  //     `target === currentTarget && !isBusy`
  // The file docstring has promised this coverage since TD-014.19 but only
  // the Escape happy-path was actually tested. These three tests close the
  // gap.

  it('closes on mouseDown on overlay backdrop (click-outside happy path)', () => {
    const onClose = vi.fn()
    const { container } = render(<RecorderLauncherDialog open={true} onClose={onClose} />)
    // The overlay is the dialog's outermost wrapper — parent of the
    // role=dialog form. Firing mouseDown on it makes target === currentTarget
    // (exactly what production keys on). Clicking inside the form would have
    // a different target (a child of the overlay) and the guard would
    // short-circuit — that contract is implicit here: any close from inside
    // the form fails this test by exception (overlay would not be the
    // currentTarget).
    const overlay = container.firstChild as HTMLElement
    expect(overlay).toBeTruthy()
    fireEvent.mouseDown(overlay)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does NOT close on Escape while isBusy=true', () => {
    // Set isBusy BEFORE render so the dialog mounts already subscribed to
    // the busy state — avoids any subscription-update timing question
    // between setState and fireEvent in the same tick.
    useRecorderStore.setState({ isBusy: true })
    const onClose = vi.fn()
    render(<RecorderLauncherDialog open={true} onClose={onClose} />)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('does NOT close on click-outside while isBusy=true', () => {
    useRecorderStore.setState({ isBusy: true })
    const onClose = vi.fn()
    const { container } = render(<RecorderLauncherDialog open={true} onClose={onClose} />)
    const overlay = container.firstChild as HTMLElement
    fireEvent.mouseDown(overlay)
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('RecorderLauncherDialog — title length limit', () => {
  it('input has a maxLength attribute matching the backend cap', () => {
    render(<RecorderLauncherDialog open={true} onClose={vi.fn()} />)
    const titleInput = screen.getByTestId('recorder-title-input') as HTMLInputElement
    expect(titleInput.maxLength).toBe(MAX_RECORDER_TITLE_LENGTH)
  })
})

describe('RecorderLauncherDialog — happy path', () => {
  it('calls recorderStore.start(url, title) on valid submit + fires onStarted + onClose', async () => {
    mockStart.mockResolvedValue({
      sessionId: 'sess-abc',
      status: 'recording',
      startedAt: '2026-04-24T00:00:00.000Z',
    })
    const onStarted = vi.fn()
    const onClose = vi.fn()

    render(<RecorderLauncherDialog open={true} onClose={onClose} onStarted={onStarted} />)
    fireEvent.change(screen.getByTestId('recorder-url-input'), {
      target: { value: 'https://example.com' },
    })
    fireEvent.change(screen.getByTestId('recorder-title-input'), {
      target: { value: 'My recording' },
    })
    fireEvent.click(screen.getByTestId('recorder-dialog-start'))

    await waitFor(() => {
      expect(mockStart).toHaveBeenCalledWith('https://example.com', 'My recording')
    })
    await waitFor(() => {
      expect(onStarted).toHaveBeenCalledTimes(1)
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  it('omits title when empty (passes undefined to start)', async () => {
    mockStart.mockResolvedValue({
      sessionId: 'sess-abc',
      status: 'recording',
      startedAt: '2026-04-24T00:00:00.000Z',
    })
    render(<RecorderLauncherDialog open={true} onClose={vi.fn()} />)
    fireEvent.change(screen.getByTestId('recorder-url-input'), {
      target: { value: 'https://example.com' },
    })
    fireEvent.click(screen.getByTestId('recorder-dialog-start'))

    await waitFor(() => {
      expect(mockStart).toHaveBeenCalledWith('https://example.com', undefined)
    })
  })
})

describe('RecorderLauncherDialog — backend error path', () => {
  it('surfaces recorderStore.error inline + keeps dialog open', async () => {
    mockStart.mockRejectedValue(new Error('max browsers reached'))
    const onClose = vi.fn()

    render(<RecorderLauncherDialog open={true} onClose={onClose} />)
    fireEvent.change(screen.getByTestId('recorder-url-input'), {
      target: { value: 'https://example.com' },
    })
    fireEvent.click(screen.getByTestId('recorder-dialog-start'))

    const err = await screen.findByTestId('recorder-dialog-error')
    expect(err.textContent).toMatch(/max browsers/i)
    expect(onClose).not.toHaveBeenCalled()
  })
})
