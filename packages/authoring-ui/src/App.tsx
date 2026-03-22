/**
 * Root application component.
 * Loads (or creates) the first available course on mount.
 * Phase 1: single-course UI. Phase 2+ will add course picker.
 */

import { useEffect, useState } from 'react'
import { AppLayout } from './components/layout/AppLayout'
import { useEditorStore } from './store/editorStore'
import { listCourses, createCourse, getCourse } from './api/courseApi'

type LoadState = 'loading' | 'ready' | 'error'

export function App() {
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [courseId, setCourseId] = useState<string | null>(null)
  const setCourse = useEditorStore(s => s.setCourse)

  useEffect(() => {
    async function bootstrap() {
      try {
        const courses = await listCourses()
        let id: string

        if (courses.length > 0) {
          const sorted = [...courses].sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
          )
          id = sorted[0]._id
        } else {
          const created = await createCourse('My First Course')
          id = created._id
        }

        const full = await getCourse(id)
        setCourse(full)
        setCourseId(id)
        setLoadState('ready')
      } catch (err) {
        console.error('[App] bootstrap failed:', err)
        setErrorMessage(err instanceof Error ? err.message : String(err))
        setLoadState('error')
      }
    }

    bootstrap()
  }, [setCourse])

  if (loadState === 'loading') {
    return (
      <div style={splashStyle}>
        <span style={{ color: '#89b4fa', fontSize: 14 }}>Loading eLearn Studio…</span>
      </div>
    )
  }

  if (loadState === 'error') {
    return (
      <div style={{ ...splashStyle, flexDirection: 'column', gap: 12 }}>
        <span style={{ color: '#f38ba8', fontSize: 14, fontWeight: 600 }}>Failed to load</span>
        <span style={{ color: '#a6adc8', fontSize: 12, maxWidth: 400, textAlign: 'center' }}>
          {errorMessage}
        </span>
        <span style={{ color: '#6c7086', fontSize: 11 }}>
          Is the backend running? Check {import.meta.env.VITE_API_URL ?? 'http://localhost:3001'}/health
        </span>
        <button
          style={{
            marginTop: 8,
            padding: '6px 16px',
            cursor: 'pointer',
            borderRadius: 4,
            background: '#313244',
            border: '1px solid #45475a',
            color: '#cdd6f4',
            fontSize: 12,
          }}
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    )
  }

  return <AppLayout courseId={courseId!} />
}

const splashStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100vh',
  width: '100vw',
  background: '#1e1e2e',
  fontFamily: 'Inter, system-ui, sans-serif',
}
