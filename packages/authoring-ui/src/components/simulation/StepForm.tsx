/**
 * Form for editing a single SimStep's authoring properties. (T024.7, T024.8, T024.9)
 */

import type { AuthoredSimStep } from '../../types/simulation'

interface StepFormProps {
  step: AuthoredSimStep
  onChange: (patch: Partial<AuthoredSimStep>) => void
}

export function StepForm({ step, onChange }: StepFormProps) {
  return (
    <div style={styles.form}>
      <Field label="Description" hint="Auto-generated; edit to customise">
        <input
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
    gap: 2,
  },
  label: {
    fontSize: 11,
    fontWeight: 600,
    color: '#a6adc8',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  hint: {
    fontSize: 10,
    color: '#6c7086',
    marginBottom: 2,
  },
  input: {
    background: '#1e1e2e',
    border: '1px solid #313244',
    borderRadius: 4,
    color: '#cdd6f4',
    fontSize: 12,
    padding: '5px 8px',
    outline: 'none',
    fontFamily: 'inherit',
    width: '100%',
    boxSizing: 'border-box',
  },
}
