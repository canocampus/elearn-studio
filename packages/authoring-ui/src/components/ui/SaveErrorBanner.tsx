/**
 * T622 — Persistent save-error banner.
 *
 * Renders a non-dismissible red banner below the TopToolbar whenever
 * `saveError` in the editor store is non-null. The user can retry the
 * last save via the Retry button, which re-triggers the GrapesJS store
 * operation by calling `editor.store()`.
 *
 * The banner is intentionally non-dismissible: the unsaved state is a
 * data-loss risk and must remain visible until the save succeeds.
 */

import { useEditorStore } from '../../store/editorStore'

export function SaveErrorBanner() {
  const saveError = useEditorStore(s => s.saveError)
  const setSaveError = useEditorStore(s => s.setSaveError)
  const editor = useEditorStore(s => s.editor)

  if (!saveError) return null

  function handleRetry() {
    if (!editor) return
    setSaveError(null)
    // Re-trigger the GrapesJS storage store cycle
    editor.store().catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err)
      setSaveError(msg)
    })
  }

  return (
    <div role="alert" aria-live="assertive" style={styles.banner}>
      <span style={styles.icon}>⚠</span>
      <span style={styles.message}>
        Save failed: {saveError}
      </span>
      <button onClick={handleRetry} style={styles.retryButton}>
        Retry
      </button>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  banner: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 16px',
    background: '#f38ba8',
    color: '#11111b',
    fontSize: 13,
    fontWeight: 500,
    flexShrink: 0,
    zIndex: 100,
  },
  icon: {
    flexShrink: 0,
    fontSize: 16,
  },
  message: {
    flex: 1,
  },
  retryButton: {
    padding: '4px 12px',
    fontSize: 12,
    fontWeight: 600,
    background: '#11111b',
    color: '#f38ba8',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    flexShrink: 0,
  },
}
