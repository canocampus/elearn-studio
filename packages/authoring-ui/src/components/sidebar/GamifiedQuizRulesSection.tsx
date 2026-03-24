/**
 * GamifiedQuizRulesSection — T033.9
 *
 * Shown inside PhaserSimPropertiesPanel when simType === 'gamified-quiz'.
 * Provides structured form fields for: timerSeconds, initialLives, comboMultiplier.
 * Also provides a question list editor (add / edit / delete QuizQuestion items).
 *
 * Writes directly to sceneDef via the onSceneDefChange callback.
 */

import { useState } from 'react'
import type { GamifiedQuizSceneDef, QuizQuestion } from '../../types/phaserSim'

// ---------------------------------------------------------------------------
// Shared inline styles
// ---------------------------------------------------------------------------

const FIELD: React.CSSProperties = {
  width: '100%',
  background: '#313244',
  border: '1px solid #45475a',
  borderRadius: 4,
  color: '#cdd6f4',
  fontSize: 12,
  padding: '5px 8px',
  boxSizing: 'border-box',
  outline: 'none',
  fontFamily: 'inherit',
}

const LABEL: React.CSSProperties = {
  fontSize: 11,
  color: '#94a3b8',
  marginBottom: 3,
  display: 'block',
}

const SECTION: React.CSSProperties = {
  padding: '10px 12px',
  borderBottom: '1px solid #313244',
}

const SECTION_TITLE: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: '#6c7086',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 8,
}

const BTN_SMALL: React.CSSProperties = {
  background: '#313244',
  border: '1px solid #45475a',
  borderRadius: 4,
  color: '#cdd6f4',
  fontSize: 11,
  padding: '3px 8px',
  cursor: 'pointer',
}

const BTN_DANGER: React.CSSProperties = {
  ...BTN_SMALL,
  color: '#f38ba8',
  borderColor: '#f38ba8',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toGamifiedDef(raw: Record<string, unknown> | null): GamifiedQuizSceneDef {
  return {
    simType: 'gamified-quiz',
    // H3: validate each question element is a non-null object with required id field
    questions: Array.isArray(raw?.questions)
      ? (raw.questions as unknown[]).filter((q): q is QuizQuestion =>
          typeof q === 'object' && q !== null && !Array.isArray(q) &&
          typeof (q as QuizQuestion).id === 'string',
        )
      : [],
    timerSeconds: typeof raw?.timerSeconds === 'number' ? raw.timerSeconds : 0,
    initialLives: typeof raw?.initialLives === 'number' ? raw.initialLives : 0,
    comboMultiplier: typeof raw?.comboMultiplier === 'number' ? raw.comboMultiplier : 1,
  }
}

function makeQuestion(): QuizQuestion {
  return {
    id: `q-${Date.now()}`,
    text: '',
    options: ['', ''],
    correctIndex: 0,
    pointValue: 10,
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  sceneDef: Record<string, unknown> | null
  onSceneDefChange: (def: GamifiedQuizSceneDef) => void
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function GamifiedQuizRulesSection({ sceneDef, onSceneDefChange }: Props) {
  const def = toGamifiedDef(sceneDef)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  function patch(changes: Partial<GamifiedQuizSceneDef>): void {
    onSceneDefChange({ ...def, ...changes })
  }

  // --- Timer ----------------------------------------------------------------

  function handleTimerChange(value: number): void {
    patch({ timerSeconds: Math.max(0, value) })
  }

  // --- Lives ----------------------------------------------------------------

  function handleLivesChange(value: number): void {
    patch({ initialLives: Math.max(0, value) })
  }

  // --- Combo ----------------------------------------------------------------

  function handleComboChange(value: number): void {
    patch({ comboMultiplier: Math.max(1, value) })
  }

  // --- Questions ------------------------------------------------------------

  function addQuestion(): void {
    const newQ = makeQuestion()
    patch({ questions: [...def.questions, newQ] })
    setExpandedId(newQ.id)
  }

  function deleteQuestion(index: number): void {
    const q = def.questions[index]
    const updated = def.questions.filter((_, i) => i !== index)
    patch({ questions: updated })
    if (q && expandedId === q.id) setExpandedId(null)
  }

  function updateQuestion(index: number, qPatch: Partial<QuizQuestion>): void {
    const updated = def.questions.map((q, i) =>
      i === index ? { ...q, ...qPatch } : q,
    )
    patch({ questions: updated })
  }

  function addOption(index: number): void {
    const q = def.questions[index]
    if (!q) return
    updateQuestion(index, { options: [...q.options, ''] })
  }

  function removeOption(qIndex: number, optIndex: number): void {
    const q = def.questions[qIndex]
    if (!q || q.options.length <= 2) return
    const options = q.options.filter((_, i) => i !== optIndex)
    const correctIndex = q.correctIndex >= options.length ? options.length - 1 : q.correctIndex
    updateQuestion(qIndex, { options, correctIndex })
  }

  function updateOption(qIndex: number, optIndex: number, value: string): void {
    const q = def.questions[qIndex]
    if (!q) return
    const options = q.options.map((o, i) => (i === optIndex ? value : o))
    updateQuestion(qIndex, { options })
  }

  return (
    <>
      {/* Rules */}
      <div style={SECTION}>
        <div style={SECTION_TITLE}>Quiz Rules</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <div>
            <label style={LABEL}>Timer (s)</label>
            <input
              type="number"
              min={0}
              value={def.timerSeconds ?? 0}
              onChange={e => handleTimerChange(Number(e.target.value))}
              style={FIELD}
              title="Timer in seconds (0 = no timer)"
            />
            <div style={{ fontSize: 9, color: '#6c7086', marginTop: 2 }}>0 = off</div>
          </div>
          <div>
            <label style={LABEL}>Lives</label>
            <input
              type="number"
              min={0}
              value={def.initialLives ?? 0}
              onChange={e => handleLivesChange(Number(e.target.value))}
              style={FIELD}
              title="Initial lives (0 = infinite)"
            />
            <div style={{ fontSize: 9, color: '#6c7086', marginTop: 2 }}>0 = ∞</div>
          </div>
          <div>
            <label style={LABEL}>Combo ×</label>
            <input
              type="number"
              min={1}
              step={0.1}
              value={def.comboMultiplier ?? 1}
              onChange={e => handleComboChange(Number(e.target.value))}
              style={FIELD}
              title="Score multiplier per correct streak"
            />
          </div>
        </div>
      </div>

      {/* Questions */}
      <div style={SECTION}>
        <div style={{ ...SECTION_TITLE, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Questions ({def.questions.length})</span>
          <button onClick={addQuestion} style={BTN_SMALL}>+ Add</button>
        </div>

        {def.questions.length === 0 && (
          <div style={{ fontSize: 11, color: '#6c7086' }}>No questions yet.</div>
        )}

        {def.questions.map((q, qi) => (
          <div
            key={q.id}
            style={{ border: '1px solid #45475a', borderRadius: 4, marginBottom: 6, overflow: 'hidden' }}
          >
            {/* Question header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '5px 8px',
                background: '#1e1e2e',
                cursor: 'pointer',
              }}
              onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}
            >
              <span style={{ fontSize: 11, color: '#cdd6f4', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {qi + 1}. {q.text || '(no text)'}
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                <span style={{ fontSize: 10, color: '#6c7086' }}>{expandedId === q.id ? '▲' : '▼'}</span>
                <button
                  onClick={e => { e.stopPropagation(); deleteQuestion(qi) }}
                  style={BTN_DANGER}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Question body */}
            {expandedId === q.id && (
              <div style={{ padding: 8, background: '#181825' }}>
                <label style={LABEL}>Question Text</label>
                <input
                  type="text"
                  value={q.text}
                  onChange={e => updateQuestion(qi, { text: e.target.value })}
                  style={{ ...FIELD, marginBottom: 8 }}
                  placeholder="Enter question text"
                />

                <label style={LABEL}>Point Value</label>
                <input
                  type="number"
                  min={1}
                  value={q.pointValue}
                  onChange={e => updateQuestion(qi, { pointValue: Math.max(1, Number(e.target.value)) })}
                  style={{ ...FIELD, marginBottom: 8 }}
                />

                <label style={LABEL}>Options (select correct answer)</label>
                {q.options.map((opt, oi) => (
                  <div key={oi} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                    <input
                      type="radio"
                      name={`correct-${q.id}`}
                      checked={q.correctIndex === oi}
                      onChange={() => updateQuestion(qi, { correctIndex: oi })}
                      style={{ margin: 0 }}
                    />
                    <input
                      type="text"
                      value={opt}
                      onChange={e => updateOption(qi, oi, e.target.value)}
                      style={{ ...FIELD, flex: 1 }}
                      placeholder={`Option ${oi + 1}`}
                    />
                    {q.options.length > 2 && (
                      <button
                        onClick={() => removeOption(qi, oi)}
                        style={{ ...BTN_DANGER, padding: '2px 6px' }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button onClick={() => addOption(qi)} style={{ ...BTN_SMALL, marginTop: 2, fontSize: 10 }}>
                  + Option
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}
