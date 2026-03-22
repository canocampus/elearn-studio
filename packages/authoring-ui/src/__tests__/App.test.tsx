/**
 * Tests for App.tsx
 *
 * Covers reviewer fix:
 *   R-08 — Error state shows dynamic health URL (VITE_API_URL ?? 'http://localhost:3001')
 *           instead of hardcoded 'http://localhost:3001'
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { App } from '../App'

// Mock the API layer so we don't hit the network
vi.mock('../api/courseApi', () => ({
  listCourses: vi.fn(),
  getCourse: vi.fn(),
  createCourse: vi.fn(),
}))

// Mock AppLayout — it initialises GrapesJS which is out of scope here
vi.mock('../components/layout/AppLayout', () => ({
  AppLayout: () => <div data-testid="app-layout">Mock AppLayout</div>,
}))

import { listCourses, getCourse, createCourse } from '../api/courseApi'

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

describe('App — loading state', () => {
  it('shows loading indicator while bootstrapping', () => {
    // Never resolves — keeps component in loading state
    vi.mocked(listCourses).mockReturnValue(new Promise(() => undefined))

    render(<App />)

    expect(screen.getByText(/Loading eLearn Studio/i)).toBeInTheDocument()
  })
})

describe('App — ready state', () => {
  it('renders AppLayout once course is loaded', async () => {
    const mockCourse = {
      _id: 'c1',
      title: 'Test Course',
      slides: [],
      updatedAt: new Date().toISOString(),
    }
    vi.mocked(listCourses).mockResolvedValue([
      { _id: 'c1', title: 'Test Course', updatedAt: new Date().toISOString() },
    ])
    vi.mocked(getCourse).mockResolvedValue(mockCourse as never)

    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('app-layout')).toBeInTheDocument()
    })
  })

  it('creates a course when none exist, then loads it', async () => {
    const mockCourse = { _id: 'new-1', title: 'My First Course', slides: [] }
    vi.mocked(listCourses).mockResolvedValue([])
    vi.mocked(createCourse).mockResolvedValue(mockCourse as never)
    vi.mocked(getCourse).mockResolvedValue(mockCourse as never)

    render(<App />)

    await waitFor(() => {
      expect(createCourse).toHaveBeenCalledWith('My First Course')
      expect(screen.getByTestId('app-layout')).toBeInTheDocument()
    })
  })
})

describe('App — R-08 error state health URL', () => {
  it('shows fallback localhost URL when VITE_API_URL is not set', async () => {
    vi.mocked(listCourses).mockRejectedValue(new Error('ECONNREFUSED'))

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText(/Failed to load/i)).toBeInTheDocument()
    })

    expect(screen.getByText(/http:\/\/localhost:3001\/health/)).toBeInTheDocument()
  })

  it('shows VITE_API_URL in health link when env var is set — R-08', async () => {
    vi.stubEnv('VITE_API_URL', 'http://prod-server:4000')
    vi.mocked(listCourses).mockRejectedValue(new Error('Network error'))

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText(/Failed to load/i)).toBeInTheDocument()
    })

    expect(screen.getByText(/http:\/\/prod-server:4000\/health/)).toBeInTheDocument()
  })

  it('shows the actual error message in the error state', async () => {
    vi.mocked(listCourses).mockRejectedValue(new Error('Specific error detail'))

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText(/Specific error detail/)).toBeInTheDocument()
    })
  })

  it('shows Retry button in error state', async () => {
    vi.mocked(listCourses).mockRejectedValue(new Error('fail'))

    render(<App />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument()
    })
  })
})
