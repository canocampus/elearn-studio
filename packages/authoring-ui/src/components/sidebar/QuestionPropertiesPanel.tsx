/**
 * Question Properties Panel — right sidebar panel rendered outside the GrapesJS canvas.
 *
 * T014.3 — Opens when a question widget is selected; auto-shown by EditorCanvas component:selected hook.
 * T014.4 — MC form: question text, options (add/remove/mark correct), scoring, feedback.
 * T014.5 — TF form: question text, correct answer, scoring, feedback.
 * T014.6 — Fill form: question text, answers list, match type, scoring, feedback.
 * T014.7 — All forms: feedbackCorrect / feedbackIncorrect text fields.
 * T014.8 — All forms: scoring.attempts (-1 = unlimited) + scoring.weight.
 *
 * Writes directly to GrapesJS component via model.set('extendedProperties', {...}),
 * which triggers the canvas preview refresh via the listenTo hook in registerQuestionBlocks.ts.
 */

import type { Component } from 'grapesjs'
import { useEditorStore } from '../../store/editorStore'
import {
  MC_DEFAULT_EXTENDED,
  TF_DEFAULT_EXTENDED,
  FILL_DEFAULT_EXTENDED,
  isQuestionWidgetType,
} from '../../types/questions'
import type {
  MCExtendedProps,
  TFExtendedProps,
  FillExtendedProps,
  MCOption,
  FillMatchType,
} from '../../types/questions'

// ---------------------------------------------------------------------------
// Shared field styles
// ---------------------------------------------------------------------------

const FIELD_STYLE: React.CSSProperties = {
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

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 11,
  color: '#94a3b8',
  marginBottom: 3,
  display: 'block',
}

const SECTION_STYLE: React.CSSProperties = {
  padding: '10px 12px',
  borderBottom: '1px solid #313244',
}

const SECTION_TITLE_STYLE: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: '#6c7086',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 8,
}

// ---------------------------------------------------------------------------
// Shared scoring + feedback sub-form
// ---------------------------------------------------------------------------

interface ScoringFeedbackProps {
  weight: number
  attempts: number
  feedbackCorrect: string
  feedbackIncorrect: string
  onWeightChange: (v: number) => void
  onAttemptsChange: (v: number) => void
  onFeedbackCorrectChange: (v: string) => void
  onFeedbackIncorrectChange: (v: string) => void
}

function ScoringFeedbackForm({
  weight,
  attempts,
  feedbackCorrect,
  feedbackIncorrect,
  onWeightChange,
  onAttemptsChange,
  onFeedbackCorrectChange,
  onFeedbackIncorrectChange,
}: ScoringFeedbackProps) {
  return (
    <>
      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Scoring</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
          <div style={{ flex: 1 }}>
            <label style={LABEL_STYLE}>Points</label>
            <input
              type="number"
              min={0}
              max={100}
              value={weight}
              onChange={e => onWeightChange(Number(e.target.value))}
              style={FIELD_STYLE}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={LABEL_STYLE}>Attempts</label>
            <input
              type="number"
              min={-1}
              value={attempts}
              onChange={e => onAttemptsChange(Number(e.target.value))}
              style={FIELD_STYLE}
              title="-1 = unlimited"
            />
          </div>
        </div>
        <div style={{ fontSize: 10, color: '#6c7086' }}>-1 attempts = unlimited</div>
      </div>
      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Feedback</div>
        <label style={LABEL_STYLE}>Correct</label>
        <input
          type="text"
          value={feedbackCorrect}
          onChange={e => onFeedbackCorrectChange(e.target.value)}
          style={{ ...FIELD_STYLE, marginBottom: 6 }}
        />
        <label style={LABEL_STYLE}>Incorrect</label>
        <input
          type="text"
          value={feedbackIncorrect}
          onChange={e => onFeedbackIncorrectChange(e.target.value)}
          style={FIELD_STYLE}
        />
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// MC Properties form (T014.4)
// ---------------------------------------------------------------------------

function MCPropertiesForm({ component }: { component: Component }) {
  const ep: MCExtendedProps =
    (component.get('extendedProperties') as MCExtendedProps | undefined) ?? MC_DEFAULT_EXTENDED

  function update(patch: Partial<MCExtendedProps>) {
    component.set('extendedProperties', { ...ep, ...patch })
  }

  function updateOption(id: string, patch: Partial<MCOption>) {
    update({
      options: ep.options.map(o => (o.id === id ? { ...o, ...patch } : o)),
    })
  }

  function addOption() {
    update({ options: [...ep.options, { id: crypto.randomUUID(), text: 'New option', isCorrect: false }] })
  }

  function removeOption(id: string) {
    if (ep.options.length <= 2) return // keep minimum 2 options
    update({ options: ep.options.filter(o => o.id !== id) })
  }

  return (
    <>
      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Multiple Choice</div>
        <label style={LABEL_STYLE}>Question Text</label>
        <textarea
          value={ep.questionText}
          onChange={e => update({ questionText: e.target.value })}
          rows={3}
          style={{ ...FIELD_STYLE, resize: 'vertical' }}
        />
      </div>

      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>
          Options
          <button
            onClick={addOption}
            style={{
              marginLeft: 8,
              background: '#313244',
              border: '1px solid #45475a',
              borderRadius: 3,
              color: '#89b4fa',
              fontSize: 10,
              padding: '1px 6px',
              cursor: 'pointer',
            }}
          >
            + Add
          </button>
        </div>

        {ep.options.map(opt => (
          <div
            key={opt.id}
            style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}
          >
            <input
              type="radio"
              checked={opt.isCorrect}
              onChange={() =>
                update({
                  options: ep.options.map(o => ({ ...o, isCorrect: o.id === opt.id })),
                })
              }
              title="Mark as correct"
              style={{ flexShrink: 0, accentColor: '#89b4fa' }}
            />
            <input
              type="text"
              value={opt.text}
              onChange={e => updateOption(opt.id, { text: e.target.value })}
              style={{ ...FIELD_STYLE, flex: 1 }}
            />
            <button
              onClick={() => removeOption(opt.id)}
              disabled={ep.options.length <= 2}
              title="Remove"
              style={{
                background: 'none',
                border: 'none',
                color: ep.options.length <= 2 ? '#45475a' : '#f38ba8',
                fontSize: 14,
                cursor: ep.options.length <= 2 ? 'default' : 'pointer',
                flexShrink: 0,
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <ScoringFeedbackForm
        weight={ep.scoring.weight}
        attempts={ep.scoring.attempts}
        feedbackCorrect={ep.feedbackCorrect}
        feedbackIncorrect={ep.feedbackIncorrect}
        onWeightChange={w => update({ scoring: { ...ep.scoring, weight: w } })}
        onAttemptsChange={a => update({ scoring: { ...ep.scoring, attempts: a } })}
        onFeedbackCorrectChange={v => update({ feedbackCorrect: v })}
        onFeedbackIncorrectChange={v => update({ feedbackIncorrect: v })}
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// TF Properties form (T014.5)
// ---------------------------------------------------------------------------

function TFPropertiesForm({ component }: { component: Component }) {
  const ep: TFExtendedProps =
    (component.get('extendedProperties') as TFExtendedProps | undefined) ?? TF_DEFAULT_EXTENDED

  function update(patch: Partial<TFExtendedProps>) {
    component.set('extendedProperties', { ...ep, ...patch })
  }

  return (
    <>
      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>True / False</div>
        <label style={LABEL_STYLE}>Question Text</label>
        <textarea
          value={ep.questionText}
          onChange={e => update({ questionText: e.target.value })}
          rows={3}
          style={{ ...FIELD_STYLE, resize: 'vertical' }}
        />
      </div>

      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Correct Answer</div>
        <div style={{ display: 'flex', gap: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
            <input
              type="radio"
              checked={ep.correctAnswer === true}
              onChange={() => update({ correctAnswer: true })}
              style={{ accentColor: '#89b4fa' }}
            />
            True
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
            <input
              type="radio"
              checked={ep.correctAnswer === false}
              onChange={() => update({ correctAnswer: false })}
              style={{ accentColor: '#89b4fa' }}
            />
            False
          </label>
        </div>
      </div>

      <ScoringFeedbackForm
        weight={ep.scoring.weight}
        attempts={ep.scoring.attempts}
        feedbackCorrect={ep.feedbackCorrect}
        feedbackIncorrect={ep.feedbackIncorrect}
        onWeightChange={w => update({ scoring: { ...ep.scoring, weight: w } })}
        onAttemptsChange={a => update({ scoring: { ...ep.scoring, attempts: a } })}
        onFeedbackCorrectChange={v => update({ feedbackCorrect: v })}
        onFeedbackIncorrectChange={v => update({ feedbackIncorrect: v })}
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// Fill Properties form (T014.6)
// ---------------------------------------------------------------------------

function FillPropertiesForm({ component }: { component: Component }) {
  const ep: FillExtendedProps =
    (component.get('extendedProperties') as FillExtendedProps | undefined) ?? FILL_DEFAULT_EXTENDED

  function update(patch: Partial<FillExtendedProps>) {
    component.set('extendedProperties', { ...ep, ...patch })
  }

  function addAnswer() {
    update({ answers: [...ep.answers, ''] })
  }

  function removeAnswer(index: number) {
    if (ep.answers.length <= 1) return
    update({ answers: ep.answers.filter((_, i) => i !== index) })
  }

  function updateAnswer(index: number, value: string) {
    const answers = ep.answers.map((a, i) => (i === index ? value : a))
    update({ answers })
  }

  return (
    <>
      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Fill in the Blank</div>
        <label style={LABEL_STYLE}>Question Text (use ___ for blank)</label>
        <textarea
          value={ep.questionText}
          onChange={e => update({ questionText: e.target.value })}
          rows={3}
          style={{ ...FIELD_STYLE, resize: 'vertical', marginBottom: 8 }}
        />
        <label style={LABEL_STYLE}>Match Type</label>
        <select
          value={ep.matchType}
          onChange={e => update({ matchType: e.target.value as FillMatchType })}
          style={FIELD_STYLE}
        >
          <option value="case-insensitive">Case-insensitive</option>
          <option value="exact">Exact</option>
          <option value="regex">Regex</option>
        </select>
      </div>

      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>
          Accepted Answers
          <button
            onClick={addAnswer}
            style={{
              marginLeft: 8,
              background: '#313244',
              border: '1px solid #45475a',
              borderRadius: 3,
              color: '#89b4fa',
              fontSize: 10,
              padding: '1px 6px',
              cursor: 'pointer',
            }}
          >
            + Add
          </button>
        </div>
        {ep.answers.map((answer, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <input
              type="text"
              value={answer}
              onChange={e => updateAnswer(i, e.target.value)}
              style={{ ...FIELD_STYLE, flex: 1 }}
              placeholder="Accepted answer"
            />
            <button
              onClick={() => removeAnswer(i)}
              disabled={ep.answers.length <= 1}
              title="Remove"
              style={{
                background: 'none',
                border: 'none',
                color: ep.answers.length <= 1 ? '#45475a' : '#f38ba8',
                fontSize: 14,
                cursor: ep.answers.length <= 1 ? 'default' : 'pointer',
                flexShrink: 0,
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <ScoringFeedbackForm
        weight={ep.scoring.weight}
        attempts={ep.scoring.attempts}
        feedbackCorrect={ep.feedbackCorrect}
        feedbackIncorrect={ep.feedbackIncorrect}
        onWeightChange={w => update({ scoring: { ...ep.scoring, weight: w } })}
        onAttemptsChange={a => update({ scoring: { ...ep.scoring, attempts: a } })}
        onFeedbackCorrectChange={v => update({ feedbackCorrect: v })}
        onFeedbackIncorrectChange={v => update({ feedbackIncorrect: v })}
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// Top-level panel (T014.3)
// ---------------------------------------------------------------------------

export function QuestionPropertiesPanel() {
  const editor = useEditorStore(s => s.editor)
  const selectedComponentType = useEditorStore(s => s.selectedComponentType)

  if (!editor || !selectedComponentType || !isQuestionWidgetType(selectedComponentType)) {
    return (
      <div
        style={{
          padding: 16,
          color: '#6c7086',
          fontSize: 12,
          textAlign: 'center',
          lineHeight: 1.6,
        }}
      >
        Select a question widget to edit its properties.
      </div>
    )
  }

  const selected = editor.getSelected()
  if (!selected) {
    return (
      <div style={{ padding: 16, color: '#6c7086', fontSize: 12, textAlign: 'center' }}>
        No component selected.
      </div>
    )
  }

  // T014-M-01: derive the type from the live GrapesJS component as source of truth;
  // fall back to Zustand only if the component has no type attribute yet.
  const type = (selected.get('type') as string) || selectedComponentType

  return (
    <div style={{ overflowY: 'auto', flex: 1 }}>
      {type === 'question-mc' && <MCPropertiesForm component={selected} />}
      {type === 'question-tf' && <TFPropertiesForm component={selected} />}
      {type === 'question-fill' && <FillPropertiesForm component={selected} />}
    </div>
  )
}
