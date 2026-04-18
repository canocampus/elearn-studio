/**
 * ActionItemEditor — T020.6–T020.15
 *
 * Renders inline parameter controls for a single action.
 * One row per action in the sequence editor.
 */

import { useEditorStore } from '../../store/editorStore'
import { useActionsStore } from '../../store/actionsStore'
import type { Action, NavigateTarget } from '../../types/actions'

// Must stay in sync with packages/runtime-player/src/actions/expression.ts
const CONDITION_EXPR_RE = /^\s*(!?)\s*(\$[a-zA-Z_]\w*|"[^"]*"|'[^']*'|[\d.]+|true|false)\s*(==|!=|>=|<=|>|<)?\s*(\$[a-zA-Z_]\w*|"[^"]*"|'[^']*'|[\d.]+|true|false)?\s*$/

interface ActionItemEditorProps {
  action: Action
  onChange: (updated: Action) => void
}

export function ActionItemEditor({ action, onChange }: ActionItemEditorProps) {
  return (
    <div style={styles.container}>
      <span style={styles.label}>{actionLabel(action.type)}</span>
      <div style={styles.params}>
        <ParamEditor action={action} onChange={onChange} />
      </div>
    </div>
  )
}

// ─── Per-type parameter editors ────────────────────────────────────────────────

function ParamEditor({ action, onChange }: ActionItemEditorProps) {
  switch (action.type) {
    case 'navigate':
      return (
        <NavigateParams
          params={action.params}
          onChange={(params) => onChange({ ...action, params })}
        />
      )
    case 'show':
    case 'hide':
      return (
        <WidgetIdParam
          label="Widget ID"
          widgetId={action.params.widgetId}
          onChange={(widgetId) => onChange({ ...action, params: { widgetId } })}
        />
      )
    case 'set-variable':
      return (
        <SetVariableParams
          params={action.params}
          onChange={(params) => onChange({ ...action, params })}
        />
      )
    case 'display-message':
      return (
        <MessageParams
          params={action.params}
          onChange={(params) => onChange({ ...action, params })}
        />
      )
    case 'play-media':
    case 'stop-media':
      return (
        <WidgetIdParam
          label="Media Widget ID"
          widgetId={action.params.widgetId}
          onChange={(widgetId) => onChange({ ...action, params: { widgetId } })}
        />
      )
    case 'score-question':
      return (
        <WidgetIdParam
          label="Question Widget ID"
          widgetId={action.params.widgetId}
          onChange={(widgetId) => onChange({ ...action, params: { widgetId } })}
        />
      )
    case 'score-quiz':
    case 'send-to-lms':
    case 'suspend-lesson':
      return <span style={styles.noParams}>(no parameters)</span>
    case 'condition':
      return (
        <ExpressionParam
          label="If"
          expression={action.params.expression}
          onChange={(expression) =>
            onChange({ ...action, params: { ...action.params, expression } })
          }
        />
      )
    case 'loop':
      return (
        <LoopParams
          params={action.params as { mode: 'count' | 'while'; count?: number; condition?: string }}
          onChange={(params) => onChange({ ...action, params } as Action)}
        />
      )
    case 'play-animation':
      return (
        <PlayAnimationParams
          params={action.params}
          onChange={(params) => onChange({ ...action, params })}
        />
      )
    case 'call-sequence':
      return (
        <CallSequenceParams
          params={action.params}
          onChange={(params) => onChange({ ...action, params })}
        />
      )
    default:
      return null
  }
}

// ─── Sub-editors ───────────────────────────────────────────────────────────────

interface NavigateParamsProps {
  params: { target: NavigateTarget; slideName?: string; slideNumber?: number }
  onChange: (p: { target: NavigateTarget; slideName?: string; slideNumber?: number }) => void
}

function NavigateParams({ params, onChange }: NavigateParamsProps) {
  return (
    <div style={styles.row}>
      <select
        style={styles.select}
        value={params.target}
        onChange={(e) =>
          onChange({ ...params, target: e.target.value as NavigateTarget })
        }
      >
        <option value="next">Next slide</option>
        <option value="prev">Previous slide</option>
        <option value="first">First slide</option>
        <option value="last">Last slide</option>
        <option value="slide-name">By name…</option>
        <option value="slide-number">By number…</option>
      </select>
      {params.target === 'slide-name' && (
        <input
          style={styles.input}
          placeholder="Slide title"
          value={params.slideName ?? ''}
          onChange={(e) => onChange({ ...params, slideName: e.target.value })}
        />
      )}
      {params.target === 'slide-number' && (
        <input
          style={{ ...styles.input, width: 60 }}
          type="number"
          min={1}
          placeholder="1"
          value={params.slideNumber ?? ''}
          onChange={(e) =>
            onChange({ ...params, slideNumber: parseInt(e.target.value, 10) || 1 })
          }
        />
      )}
    </div>
  )
}

interface WidgetIdParamProps {
  label: string
  widgetId: string
  onChange: (id: string) => void
}

function WidgetIdParam({ label, widgetId, onChange }: WidgetIdParamProps) {
  const widgets = useEditorStore((s) =>
    s.course?.slides[s.currentSlideIndex]?.widgets ?? [],
  )

  if (widgets.length > 0) {
    const isValid = widgetId === '' || widgets.some((w) => w.id === widgetId)
    return (
      <select
        style={{ ...styles.select, borderColor: isValid ? '#45475a' : '#f38ba8' }}
        value={widgetId}
        onChange={(e) => onChange(e.target.value)}
        title={isValid ? label : 'Widget not found on current slide'}
      >
        <option value="">— select widget —</option>
        {widgets.map((w) => (
          // UX: show human-readable name; fallback to ID for unnamed widgets.
          // `value` stays as w.id (technical routing key for action execution).
          <option key={w.id} value={w.id}>
            {w.name || w.id}
          </option>
        ))}
      </select>
    )
  }

  return (
    <input
      style={styles.input}
      placeholder={label}
      value={widgetId}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

interface SetVariableParamsProps {
  params: { name: string; value: string; valueType: 'literal' | 'expression' }
  onChange: (p: { name: string; value: string; valueType: 'literal' | 'expression' }) => void
}

function SetVariableParams({ params, onChange }: SetVariableParamsProps) {
  return (
    <div style={styles.row}>
      <input
        style={{ ...styles.input, width: 80 }}
        placeholder="Variable"
        value={params.name}
        onChange={(e) => onChange({ ...params, name: e.target.value })}
      />
      <span style={styles.separator}>=</span>
      <input
        style={styles.input}
        placeholder={params.valueType === 'expression' ? 'expr' : 'value'}
        value={params.value}
        onChange={(e) => onChange({ ...params, value: e.target.value })}
      />
      <select
        style={styles.select}
        value={params.valueType}
        onChange={(e) =>
          onChange({ ...params, valueType: e.target.value as 'literal' | 'expression' })
        }
      >
        <option value="literal">Literal</option>
        <option value="expression">Expr</option>
      </select>
    </div>
  )
}

interface MessageParamsProps {
  params: { message: string; title?: string }
  onChange: (p: { message: string; title?: string }) => void
}

function MessageParams({ params, onChange }: MessageParamsProps) {
  return (
    <div style={styles.col}>
      <input
        style={styles.input}
        placeholder="Title (optional)"
        value={params.title ?? ''}
        onChange={(e) => onChange({ ...params, title: e.target.value })}
      />
      <textarea
        style={{ ...styles.input, resize: 'vertical', minHeight: 44, fontFamily: 'inherit' }}
        placeholder="Message text"
        value={params.message}
        onChange={(e) => onChange({ ...params, message: e.target.value })}
      />
    </div>
  )
}

interface ExpressionParamProps {
  label: string
  expression: string
  onChange: (expr: string) => void
}

function ExpressionParam({ label, expression, onChange }: ExpressionParamProps) {
  const isValid = expression === '' || CONDITION_EXPR_RE.test(expression)
  return (
    <div style={styles.col}>
      <div style={styles.row}>
        <span style={styles.exprLabel}>{label}</span>
        <input
          style={{ ...styles.input, borderColor: isValid ? '#45475a' : '#f38ba8' }}
          placeholder="$var == value"
          value={expression}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      {!isValid && (
        <span style={styles.exprError}>
          Invalid syntax. Use: $var == value, $var &gt; 10, true, false
        </span>
      )}
    </div>
  )
}

interface LoopParamsProps {
  params: { mode: 'count' | 'while'; count?: number; condition?: string }
  onChange: (p: { mode: 'count' | 'while'; count?: number; condition?: string }) => void
}

function LoopParams({ params, onChange }: LoopParamsProps) {
  return (
    <div style={styles.row}>
      <select
        style={styles.select}
        value={params.mode}
        onChange={(e) =>
          onChange({ ...params, mode: e.target.value as 'count' | 'while' })
        }
      >
        <option value="count">Repeat N times</option>
        <option value="while">While condition</option>
      </select>
      {params.mode === 'count' ? (
        <input
          style={{ ...styles.input, width: 60 }}
          type="number"
          min={0}
          value={params.count ?? 1}
          onChange={(e) =>
            onChange({ ...params, count: parseInt(e.target.value, 10) || 0 })
          }
        />
      ) : (
        <input
          style={styles.input}
          placeholder="$var < 10"
          value={params.condition ?? ''}
          onChange={(e) => onChange({ ...params, condition: e.target.value })}
        />
      )}
    </div>
  )
}

interface PlayAnimationParamsProps {
  params: { widgetId: string; animationName?: string }
  onChange: (p: { widgetId: string; animationName?: string }) => void
}

function PlayAnimationParams({ params, onChange }: PlayAnimationParamsProps) {
  return (
    <div style={styles.col}>
      <WidgetIdParam
        label="Widget ID"
        widgetId={params.widgetId}
        onChange={(widgetId) => onChange({ ...params, widgetId })}
      />
      <input
        style={styles.input}
        placeholder="Animation name (optional — plays first if blank)"
        value={params.animationName ?? ''}
        onChange={(e) =>
          onChange({ ...params, animationName: e.target.value || undefined })
        }
      />
    </div>
  )
}

interface CallSequenceParamsProps {
  params: { sequenceName: string }
  onChange: (p: { sequenceName: string }) => void
}

function CallSequenceParams({ params, onChange }: CallSequenceParamsProps) {
  const sharedSequences = useActionsStore((s) => s.sharedSequences)

  if (sharedSequences.length > 0) {
    const isValid = params.sequenceName === '' || sharedSequences.some((s) => s.name === params.sequenceName)
    return (
      <select
        style={{ ...styles.select, borderColor: isValid ? '#45475a' : '#f38ba8' }}
        value={params.sequenceName}
        onChange={(e) => onChange({ sequenceName: e.target.value })}
        title={isValid ? 'Sequence to call' : 'Sequence not found'}
      >
        <option value="">— select sequence —</option>
        {sharedSequences.map((s) => (
          <option key={s.name} value={s.name}>{s.name}</option>
        ))}
      </select>
    )
  }

  return (
    <input
      style={styles.input}
      placeholder="Sequence name"
      value={params.sequenceName}
      onChange={(e) => onChange({ sequenceName: e.target.value })}
    />
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function actionLabel(type: string): string {
  const labels: Record<string, string> = {
    'navigate':        'Navigate',
    'show':            'Show',
    'hide':            'Hide',
    'set-variable':    'Set Variable',
    'display-message': 'Display Message',
    'play-media':      'Play Media',
    'stop-media':      'Stop Media',
    'score-question':  'Score Question',
    'score-quiz':      'Score Quiz',
    'send-to-lms':     'Send to LMS',
    'suspend-lesson':  'Suspend Lesson',
    'condition':       'If / Else',
    'loop':            'Loop',
    'play-animation':  'Play Animation',
    'call-sequence':   'Call Sequence',
  }
  return labels[type] ?? type
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    fontSize: 11,
  },
  label: {
    fontWeight: 600,
    color: '#89b4fa',
    fontSize: 11,
    marginBottom: 2,
  },
  params: {
    flex: 1,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  col: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    width: '100%',
  },
  input: {
    flex: 1,
    minWidth: 60,
    padding: '3px 6px',
    fontSize: 11,
    background: '#11111b',
    color: '#cdd6f4',
    border: '1px solid #45475a',
    borderRadius: 3,
    outline: 'none',
  },
  select: {
    padding: '3px 4px',
    fontSize: 11,
    background: '#11111b',
    color: '#cdd6f4',
    border: '1px solid #45475a',
    borderRadius: 3,
  },
  separator: {
    color: '#6c7086',
    fontSize: 12,
    padding: '0 2px',
  },
  exprLabel: {
    color: '#f9e2af',
    fontWeight: 600,
    fontSize: 11,
    flexShrink: 0,
  },
  noParams: {
    color: '#6c7086',
    fontSize: 11,
    fontStyle: 'italic',
  },
  exprError: {
    color: '#f38ba8',
    fontSize: 10,
    marginTop: 2,
  },
}
