/**
 * CourseSettingsDialog — T610.6
 * Modal for editing course-level settings: passing score, navigation mode,
 * require-all-slides gate, and allow-review flag.
 */

import { useState } from 'react'
import type { CourseSettings, NavigationMode } from '../../types/course'

interface CourseSettingsDialogProps {
  settings: CourseSettings
  onSave: (updated: CourseSettings) => void
  onCancel: () => void
}

export function CourseSettingsDialog({ settings, onSave, onCancel }: CourseSettingsDialogProps) {
  const [passingScore, setPassingScore] = useState(settings.passingScore)
  const [navigationMode, setNavigationMode] = useState<NavigationMode>(
    settings.navigationMode ?? 'free'
  )
  const [requireAllSlides, setRequireAllSlides] = useState(settings.requireAllSlides ?? false)
  const [allowReview, setAllowReview] = useState(settings.allowReview)

  function handleSave() {
    onSave({
      ...settings,
      passingScore,
      navigationMode,
      requireAllSlides,
      allowReview,
    })
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onCancel()
  }

  return (
    <div style={styles.overlay} onMouseDown={e => { if (e.target === e.currentTarget) onCancel() }} onKeyDown={handleKeyDown}>
      <div role="dialog" aria-modal="true" aria-label="Course Settings" style={styles.dialog}>
        <h2 style={styles.heading}>Course Settings</h2>

        <label style={styles.label} htmlFor="cs-passing-score">Passing Score (%)</label>
        <input
          id="cs-passing-score"
          type="number"
          min={0}
          max={100}
          value={passingScore}
          onChange={e => setPassingScore(Math.max(0, Math.min(100, Number(e.target.value))))}
          style={styles.input}
        />

        <label style={styles.label} htmlFor="cs-nav-mode">Navigation Mode</label>
        <select
          id="cs-nav-mode"
          value={navigationMode}
          onChange={e => setNavigationMode(e.target.value as NavigationMode)}
          style={styles.select}
          data-testid="navigation-mode-select"
        >
          <option value="free">Free — learner can jump to any slide</option>
          <option value="linear-strict">Linear (strict) — must complete each slide in order</option>
        </select>

        {navigationMode === 'linear-strict' && (
          <label style={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={requireAllSlides}
              onChange={e => setRequireAllSlides(e.target.checked)}
              data-testid="require-all-slides-checkbox"
            />
            <span>Require all slides visited before course completion</span>
          </label>
        )}

        <label style={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={allowReview}
            onChange={e => setAllowReview(e.target.checked)}
          />
          <span>Allow learner to review slides after completing</span>
        </label>

        <div style={styles.actions}>
          <button style={styles.btnCancel} onClick={onCancel}>Cancel</button>
          <button style={styles.btnSave} onClick={handleSave} data-testid="course-settings-save">Save</button>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
  },
  dialog: {
    background: '#1e1e2e',
    border: '1px solid #313244',
    borderRadius: 8,
    padding: '24px 28px',
    width: 400,
    maxWidth: 'calc(100vw - 32px)',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  heading: { margin: 0, fontSize: 16, fontWeight: 600, color: '#cdd6f4' },
  label: { margin: 0, fontSize: 12, color: '#a6adc8', fontWeight: 500 },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '7px 10px',
    background: '#181825',
    border: '1px solid #45475a',
    borderRadius: 4,
    color: '#cdd6f4',
    fontSize: 13,
    outline: 'none',
  },
  select: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '7px 10px',
    background: '#181825',
    border: '1px solid #45475a',
    borderRadius: 4,
    color: '#cdd6f4',
    fontSize: 13,
    outline: 'none',
  },
  checkboxRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 12,
    color: '#cdd6f4',
    cursor: 'pointer',
  },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  btnCancel: {
    padding: '6px 14px', fontSize: 12,
    background: 'transparent', border: '1px solid #45475a',
    borderRadius: 4, color: '#a6adc8', cursor: 'pointer',
  },
  btnSave: {
    padding: '6px 18px', fontSize: 12,
    background: '#89b4fa', border: '1px solid #89b4fa',
    borderRadius: 4, color: '#1e1e2e', fontWeight: 600, cursor: 'pointer',
  },
}
