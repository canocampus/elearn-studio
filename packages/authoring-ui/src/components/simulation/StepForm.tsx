/**
 * Form for editing a single SimStep's authoring properties. (T024.7, T024.8, T024.9, T202)
 *
 * TD-014.4 — adds a "Step screenshot" field group at the top with two paths:
 *  (a) Upload… — hidden <input type="file"> → uploadAsset → resolveAssetUrl
 *  (b) Asset Library — editor.AssetManager.open({ types:['image'], select })
 * Per audit R-01, the library path reuses GrapesJS's AssetManager modal
 * (the canonical pattern from ButtonPropertiesPanel.tsx) — no new modal.
 */

import { useRef, useState } from 'react'
import { uploadAsset, resolveAssetUrl } from '../../api/courseApi'
import { useEditorStore } from '../../store/editorStore'
import { useToast } from '../ui/Toast'
import { isDrawModeHotspot } from './hotspotDraw'
import { colors, fontSize, fontWeight, radius, gap, text, buttons } from './simulationTheme'
import type { AuthoredSimStep, SimInteractionType } from '../../types/simulation'

interface StepFormProps {
  step: AuthoredSimStep
  onChange: (patch: Partial<AuthoredSimStep>) => void
}

export function StepForm({ step, onChange }: StepFormProps) {
  const editor = useEditorStore(s => s.editor)
  const toast = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  function handleUploadClick() {
    fileInputRef.current?.click()
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // Reset the input so selecting the same file twice still fires onChange.
    e.target.value = ''
    if (!file) return

    setUploading(true)
    try {
      const asset = await uploadAsset(file)
      const presignedUrl = await resolveAssetUrl(asset.objectName)
      onChange({ screenshotKey: asset.objectName, screenshotUrl: presignedUrl })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed'
      // TD-014.24 dec 12: unified error format `'X failed: ${msg}'`.
      toast.error(`Upload failed: ${message}`)
    } finally {
      setUploading(false)
    }
  }

  function handleClearHotspot() {
    // TD-014.7: reset to zero-size sentinel → HotspotCanvas re-enters draw-mode.
    // Position (x, y) and tolerance are preserved so the author's previous
    // configuration isn't lost (only the rectangle needs to be re-drawn).
    onChange({ hotspot: { ...step.hotspot, width: 0, height: 0 } })
  }

  function handleAssetLibraryClick() {
    if (!editor) return
    editor.AssetManager.open({
      types: ['image'],
      select(asset: { getSrc: () => string }, complete: boolean) {
        const src = asset.getSrc()
        if (!src) return
        // Library path: GrapesJS AM exposes only the src URL — screenshotKey
        // stays as set by the upload path (or empty for library-only steps).
        // See audit I-04 for the deferred "persistent asset listing" follow-up.
        onChange({ screenshotUrl: src })
        if (complete) editor.AssetManager.close()
      },
    })
  }

  return (
    <div style={styles.form}>
      {/* TD-014.4 — Step screenshot field group */}
      <Field label="Step screenshot" hint="Upload a new image or pick one from the library">
        <div style={styles.screenshotActions}>
          <button
            type="button"
            data-testid="step-upload-btn"
            // TD-014.24 dec 11 + `decisions/2026-04-25-button-label-change-convention.md`:
            // app-chrome buttons do NOT take label-change. Disabled-only is the
            // complete state signal — previously rendered `Uploading…` was an
            // accidental label-change drift, removed here.
            style={{ ...styles.screenshotBtn, ...(uploading ? buttons.disabled : null) }}
            onClick={handleUploadClick}
            disabled={uploading}
          >
            Upload…
          </button>
          <button
            type="button"
            data-testid="step-asset-library-btn"
            style={{ ...styles.screenshotBtn, ...((!editor || uploading) ? buttons.disabled : null) }}
            onClick={handleAssetLibraryClick}
            disabled={!editor || uploading}
          >
            Asset Library
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg"
          style={{ display: 'none' }}
          onChange={handleFileSelected}
        />
        {step.screenshotUrl && (
          <div style={styles.screenshotHint}>Current: {step.screenshotKey || step.screenshotUrl}</div>
        )}
      </Field>

      <Field label="Description" hint="Auto-generated; edit to customise">
        <input
          data-testid="step-description-input"
          style={styles.input}
          value={step.description}
          onChange={e => onChange({ description: e.target.value })}
        />
      </Field>

      <Field label="Instruction" hint="Shown to learner above the screenshot">
        <textarea
          style={{ ...styles.input, height: 60, resize: 'vertical' }}
          value={step.instruction}
          onChange={e => onChange({ instruction: e.target.value })}
        />
      </Field>

      <Field label="Hint" hint="Shown after first wrong attempt (practice/assessment)">
        <input
          style={styles.input}
          value={step.hint}
          onChange={e => onChange({ hint: e.target.value })}
        />
      </Field>

      <Field label="Correct feedback">
        <input
          style={styles.input}
          value={step.correctFeedback}
          onChange={e => onChange({ correctFeedback: e.target.value })}
        />
      </Field>

      <Field label="Incorrect feedback">
        <input
          style={styles.input}
          value={step.incorrectFeedback}
          onChange={e => onChange({ incorrectFeedback: e.target.value })}
        />
      </Field>

      <Field label="Demo delay (ms)" hint="Auto-advance time in demo mode">
        <input
          style={styles.input}
          type="number"
          min={0}
          step={500}
          value={step.demoDelay}
          onChange={e => onChange({ demoDelay: parseInt(e.target.value, 10) || 0 })}
        />
      </Field>

      <Field label="Max attempts" hint="-1 = unlimited">
        <input
          style={styles.input}
          type="number"
          min={-1}
          value={step.maxAttempts}
          onChange={e => onChange({ maxAttempts: parseInt(e.target.value, 10) || -1 })}
        />
      </Field>

      <Field label="Hotspot tolerance (px)">
        <input
          style={styles.input}
          type="number"
          min={0}
          step={5}
          value={step.hotspot.tolerance}
          onChange={e =>
            onChange({ hotspot: { ...step.hotspot, tolerance: parseInt(e.target.value, 10) || 0 } })
          }
        />
      </Field>

      {/* TD-014.7 — Clear hotspot → HotspotCanvas re-enters draw-mode */}
      <Field label="Hotspot" hint="Clear to re-draw the target rectangle">
        <button
          type="button"
          data-testid="step-clear-hotspot-btn"
          style={{
            ...styles.screenshotBtn,
            ...(isDrawModeHotspot(step.hotspot) ? buttons.disabled : null),
          }}
          onClick={handleClearHotspot}
          disabled={isDrawModeHotspot(step.hotspot)}
        >
          Clear hotspot
        </button>
      </Field>

      {/* T202 — Interaction type */}
      <Field label="Interaction type" hint="How the learner responds to this step">
        <select
          style={styles.input}
          value={step.interactionType ?? 'click'}
          onChange={e => onChange({ interactionType: e.target.value as SimInteractionType })}
        >
          <option value="click">Click</option>
          <option value="hover">Hover</option>
          <option value="type">Type text</option>
        </select>
      </Field>

      {(step.interactionType === 'type') && (
        <Field label="Expected text" hint="Learner must type this exact string (case-insensitive)">
          <input
            style={styles.input}
            value={step.expectedText ?? ''}
            onChange={e => onChange({ expectedText: e.target.value })}
          />
        </Field>
      )}
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={styles.field}>
      <label style={styles.label}>{label}</label>
      {hint && <span style={styles.hint}>{hint}</span>}
      {children}
    </div>
  )
}

// TD-014.24: theme-derived styles. Layout-specific values (gap: 10 in
// .form, gap: 6 in .screenshotActions, padding '5px 8px' in .input,
// padding '6px 10px' in .screenshotBtn) stay inline — they are surface
// tuning, not theme tokens. See `decisions/2026-04-25-simulation-style-consistency.md`
// sub-decision 10 (pragmatic spacing extraction).
const styles: Record<string, React.CSSProperties> = {
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    overflowY: 'auto',
    padding: '8px 0',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: gap.tight,
  },
  label: {
    ...text.label,
  },
  hint: {
    fontSize: fontSize.tiny,
    color: colors.textMuted,
    marginBottom: 2,
  },
  input: {
    background: colors.bgBase,
    border: `1px solid ${colors.bgElevated}`,
    borderRadius: radius.default,
    color: colors.textPrimary,
    fontSize: fontSize.caption,
    padding: '5px 8px',
    outline: 'none',
    fontFamily: 'inherit',
    width: '100%',
    boxSizing: 'border-box',
  },
  screenshotActions: {
    display: 'flex',
    gap: 6,
  },
  // Smaller variant of the secondary-pattern button (panel-density: 11px font,
  // tighter padding). Doesn't merit a theme entry — only used in StepForm.
  screenshotBtn: {
    flex: 1,
    padding: '6px 10px',
    background: colors.bgElevated,
    color: colors.textPrimary,
    border: `1px solid ${colors.borderSubtle}`,
    borderRadius: radius.default,
    fontSize: fontSize.small,
    fontWeight: fontWeight.medium,
    cursor: 'pointer',
  },
  screenshotHint: {
    fontSize: fontSize.tiny,
    color: colors.textMuted,
    marginTop: 4,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
}
