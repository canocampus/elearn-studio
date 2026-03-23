/**
 * CourseInspector — T165.2
 *
 * Renders the current course JSON in a floating panel.
 * Activated via ?debug=1 or localStorage.setItem('debug','1').
 * Rendered only in DEV builds (guarded in AppLayout).
 */

import { useEditorStore } from '../../store/editorStore'

interface CourseInspectorProps {
  onClose: () => void
}

export function CourseInspector({ onClose }: CourseInspectorProps) {
  const course = useEditorStore(s => s.course)

  return (
    <div style={styles.overlay}>
      <div style={styles.panel}>
        <div style={styles.header}>
          <span style={styles.title}>Course Inspector</span>
          <button style={styles.closeBtn} onClick={onClose} aria-label="Close inspector">✕</button>
        </div>
        <pre style={styles.pre} data-testid="course-inspector-json">
          {course ? JSON.stringify(course, null, 2) : 'No course loaded'}
        </pre>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    bottom: 16,
    right: 16,
    zIndex: 9999,
    width: 480,
    maxHeight: '60vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
    borderRadius: 8,
    overflow: 'hidden',
    border: '1px solid #45475a',
  },
  panel: {
    display: 'flex',
    flexDirection: 'column',
    background: '#1e1e2e',
    flex: 1,
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 12px',
    background: '#313244',
    borderBottom: '1px solid #45475a',
    flexShrink: 0,
  },
  title: {
    fontSize: 12,
    fontWeight: 600,
    color: '#f9e2af',
    fontFamily: 'monospace',
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: '#6c7086',
    cursor: 'pointer',
    fontSize: 14,
    padding: '0 4px',
  },
  pre: {
    margin: 0,
    padding: 12,
    fontSize: 11,
    lineHeight: 1.5,
    color: '#cdd6f4',
    fontFamily: 'monospace',
    overflow: 'auto',
    flex: 1,
    background: '#1e1e2e',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
  },
}
