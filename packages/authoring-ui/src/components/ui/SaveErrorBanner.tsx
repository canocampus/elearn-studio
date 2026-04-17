/**
 * T622 — Persistent save-error banner.
 *
 * Renders a non-dismissible red banner below the TopToolbar whenever
 * `saveError` in the editor store is non-null.
 *
 * T651.3 — The Retry button now delegates to `requestSave` (the unified save
 * entry point bound in `initEditor.ts`). This gives the retry the same
 * `isSaving` / `saveError` lifecycle as every other save, fixing a pre-T651
 * bug where the "Saving…" badge never appeared during a retry.
 *
 * The banner is intentionally non-dismissible: the unsaved state is a
 * data-loss risk and must remain visible until the save succeeds.
 */

import { useEditorStore } from '../../store/editorStore'

export function SaveErrorBanner() {
  const saveError = useEditorStore(s => s.saveError)
  const requestSave = useEditorStore(s => s.requestSave)

  if (!saveError) return null

  function handleRetry() {
    if (!requestSave) return
    // requestSave's onStart clears saveError and sets isSaving(true).
    // On failure, onError re-sets saveError; onSuccess leaves it null.
    // The .catch swallows the rejection — state is already surfaced via Zustand.
    requestSave().catch(() => { /* error already in Zustand */ })
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
