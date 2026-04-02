/**
 * GrapesJS Block + Component registration for P0 question widget types.
 *
 * T014.1 — Register blocks: question-mc, question-tf, question-fill
 * T014.2 — Read-only canvas preview that updates when extendedProperties change
 *
 * Each component stores its full question config in extendedProperties,
 * which is round-tripped by converters.ts and saved to MongoDB.
 */

import type { Editor } from 'grapesjs'
import {
  MC_DEFAULT_EXTENDED,
  TF_DEFAULT_EXTENDED,
  FILL_DEFAULT_EXTENDED,
} from '../types/questions'
import type { MCExtendedProps, TFExtendedProps, FillExtendedProps } from '../types/questions'

/**
 * Minimal typing for GrapesJS ComponentView `this` context.
 * GrapesJS does not export a typed ComponentView class, so we declare
 * only the members we actually use in view callbacks.
 */
interface GjsViewContext {
  model: {
    get: (key: string) => unknown
  }
  el: HTMLElement
  listenTo: (obj: unknown, event: string, handler: () => void) => void
  _refreshPreview: () => void
}

// ---------------------------------------------------------------------------
// SVG block icons
// ---------------------------------------------------------------------------

const ICONS = {
  questionMC: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="5" cy="7" r="2"/>
    <line x1="9" y1="7" x2="20" y2="7"/>
    <circle cx="5" cy="12" r="2" fill="currentColor" stroke="none"/>
    <line x1="9" y1="12" x2="20" y2="12"/>
    <circle cx="5" cy="17" r="2"/>
    <line x1="9" y1="17" x2="20" y2="17"/>
  </svg>`,

  questionTF: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="2" y="8" width="9" height="8" rx="2"/>
    <polyline points="4 12 6 14 9 10"/>
    <rect x="13" y="8" width="9" height="8" rx="2"/>
    <line x1="15" y1="10" x2="20" y2="14"/>
    <line x1="15" y1="14" x2="20" y2="10"/>
  </svg>`,

  questionFill: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="3" y="4" width="18" height="7" rx="1"/>
    <line x1="7" y1="8" x2="17" y2="8"/>
    <line x1="3" y1="16" x2="21" y2="16" stroke-dasharray="3 2"/>
    <line x1="3" y1="20" x2="15" y2="20" stroke-dasharray="3 2"/>
  </svg>`,
}

// ---------------------------------------------------------------------------
// HTML helpers
// ---------------------------------------------------------------------------

/** Escape HTML entities to prevent XSS in canvas previews. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const PREVIEW_BASE_STYLE =
  'font-family:system-ui,sans-serif;padding:12px;height:100%;box-sizing:border-box;' +
  'background:#fff;border-radius:6px;overflow:hidden;'

const Q_TEXT_STYLE =
  'font-size:13px;font-weight:600;color:#0f172a;margin-bottom:10px;line-height:1.4;' +
  'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'

const HINT_STYLE = 'font-size:10px;color:#94a3b8;margin-top:8px;'

// ---------------------------------------------------------------------------
// Canvas preview builders (T014.2)
// ---------------------------------------------------------------------------

export function buildMCPreviewHTML(ep: MCExtendedProps): string {
  // T701.1: guard all fields that may be absent when the component is created
  // programmatically without a full extendedProperties object (e.g. via addComponentViaEditor).
  const questionText = ep.questionText ?? 'Question'
  const options = ep.options ?? []
  const scoring = ep.scoring ?? { weight: 100, attempts: -1 }

  const optionsHTML = options
    .map(
      opt =>
        `<div style="display:flex;align-items:center;gap:7px;margin-bottom:5px">` +
        `<div style="width:14px;height:14px;border-radius:50%;border:2px solid ${opt.isCorrect ? '#4f46e5' : '#94a3b8'};` +
        `background:${opt.isCorrect ? '#4f46e5' : 'transparent'};flex-shrink:0"></div>` +
        `<span style="font-size:12px;color:#334155;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(opt.text)}</span>` +
        `</div>`,
    )
    .join('')

  const attemptsLabel =
    scoring.attempts === -1 ? 'Unlimited attempts' : `${scoring.attempts} attempt(s)`

  return (
    `<div style="${PREVIEW_BASE_STYLE}">` +
    `<div style="${Q_TEXT_STYLE}">${esc(questionText)}</div>` +
    optionsHTML +
    `<div style="${HINT_STYLE}">Multiple Choice · ${scoring.weight}pts · ${attemptsLabel}</div>` +
    `</div>`
  )
}

export function buildTFPreviewHTML(ep: TFExtendedProps): string {
  // T701.1: guard fields that may be absent on programmatic creation
  const questionText = ep.questionText ?? 'Question'
  const scoring = ep.scoring ?? { weight: 100, attempts: -1 }

  const trueStyle =
    `padding:6px 14px;border:2px solid ${ep.correctAnswer ? '#16a34a' : '#e2e8f0'};` +
    `background:${ep.correctAnswer ? '#dcfce7' : 'transparent'};` +
    'border-radius:4px;font-size:12px;cursor:default;color:#0f172a;'
  const falseStyle =
    `padding:6px 14px;border:2px solid ${!ep.correctAnswer ? '#16a34a' : '#e2e8f0'};` +
    `background:${!ep.correctAnswer ? '#dcfce7' : 'transparent'};` +
    'border-radius:4px;font-size:12px;cursor:default;color:#0f172a;'

  const attemptsLabel =
    scoring.attempts === -1 ? 'Unlimited attempts' : `${scoring.attempts} attempt(s)`

  return (
    `<div style="${PREVIEW_BASE_STYLE}">` +
    `<div style="${Q_TEXT_STYLE}">${esc(questionText)}</div>` +
    `<div style="display:flex;gap:10px;margin-top:6px">` +
    `<button style="${trueStyle}">True</button>` +
    `<button style="${falseStyle}">False</button>` +
    `</div>` +
    `<div style="${HINT_STYLE}">True / False · ${scoring.weight}pts · ${attemptsLabel}</div>` +
    `</div>`
  )
}

export function buildFillPreviewHTML(ep: FillExtendedProps): string {
  // T701.1: guard fields that may be absent on programmatic creation
  const questionText = ep.questionText ?? 'Question'
  const scoring = ep.scoring ?? { weight: 100, attempts: -1 }

  // Replace first ___ in question text with a blank underline, or append if none
  const hasBlank = questionText.includes('___')
  const withBlank = hasBlank
    ? esc(questionText).replace('___', '<span style="display:inline-block;width:80px;border-bottom:2px solid #4f46e5;margin:0 4px">&nbsp;</span>')
    : `${esc(questionText)} <span style="display:inline-block;width:80px;border-bottom:2px solid #4f46e5;margin:0 4px">&nbsp;</span>`

  const attemptsLabel =
    scoring.attempts === -1 ? 'Unlimited attempts' : `${scoring.attempts} attempt(s)`

  return (
    `<div style="${PREVIEW_BASE_STYLE}">` +
    `<div style="font-size:13px;font-weight:600;color:#0f172a;margin-bottom:10px;line-height:1.6">${withBlank}</div>` +
    `<div style="${HINT_STYLE}">Fill in the Blank · ${scoring.weight}pts · ${attemptsLabel}</div>` +
    `</div>`
  )
}

// ---------------------------------------------------------------------------
// Entry point — called from registerBlocks.ts
// ---------------------------------------------------------------------------

export function registerQuestionBlocks(editor: Editor): void {
  registerMCWidget(editor)
  registerTFWidget(editor)
  registerFillWidget(editor)
}

// ---------------------------------------------------------------------------
// T014.1 + T014.2 — question-mc
// ---------------------------------------------------------------------------

function registerMCWidget(editor: Editor): void {
  editor.Components.addType('question-mc', {
    // extendFnView ensures ComponentView.prototype.initialize runs before ours,
    // so setViewEl() sets data-gjs-type on the element (required for canvas selectors).
    extendFnView: ['initialize'],
    model: {
      defaults: {
        name: 'Multiple Choice',
        tagName: 'div',
        droppable: false,
        properties: {},
        actions: [],
        elearnActions: [],
        extendedProperties: { ...MC_DEFAULT_EXTENDED },
        style: {
          width: '340px',
          height: '180px',
          'border-radius': '6px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          'z-index': '1',
          display: 'block',
        },
        traits: [{ type: 'text', name: 'name', label: 'Name' }],
      },
    },
    view: ({
      initialize(this: GjsViewContext) {
        // Parent ComponentView.prototype.initialize is called automatically before this
        // via extendFnView. We only add our custom change listener here.
        this.listenTo(
          this.model,
          'change:extendedProperties',
          this._refreshPreview.bind(this),
        )
      },
      _refreshPreview(this: GjsViewContext) {
        try {
          const ep = (this.model.get('extendedProperties') as MCExtendedProps | undefined) ?? MC_DEFAULT_EXTENDED
          this.el.innerHTML = buildMCPreviewHTML(ep)
        } catch {
          this.el.innerHTML = buildMCPreviewHTML(MC_DEFAULT_EXTENDED)
        }
      },
      onRender(this: GjsViewContext) {
        this._refreshPreview()
      },
    } as unknown) as object,
  })

  editor.BlockManager.add('question-mc', {
    label: 'Multiple Choice',
    category: 'Questions',
    media: ICONS.questionMC,
    content: { type: 'question-mc', style: { position: 'absolute', left: '100px', top: '100px', width: '340px', height: '180px' } },
  })
}

// ---------------------------------------------------------------------------
// T014.1 + T014.2 — question-tf
// ---------------------------------------------------------------------------

function registerTFWidget(editor: Editor): void {
  editor.Components.addType('question-tf', {
    extendFnView: ['initialize'],
    model: {
      defaults: {
        name: 'True / False',
        tagName: 'div',
        droppable: false,
        properties: {},
        actions: [],
        elearnActions: [],
        extendedProperties: { ...TF_DEFAULT_EXTENDED },
        style: {
          width: '280px',
          height: '130px',
          'border-radius': '6px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          'z-index': '1',
          display: 'block',
        },
        traits: [{ type: 'text', name: 'name', label: 'Name' }],
      },
    },
    view: ({
      initialize(this: GjsViewContext) {
        this.listenTo(
          this.model,
          'change:extendedProperties',
          this._refreshPreview.bind(this),
        )
      },
      _refreshPreview(this: GjsViewContext) {
        try {
          const ep = (this.model.get('extendedProperties') as TFExtendedProps | undefined) ?? TF_DEFAULT_EXTENDED
          this.el.innerHTML = buildTFPreviewHTML(ep)
        } catch {
          this.el.innerHTML = buildTFPreviewHTML(TF_DEFAULT_EXTENDED)
        }
      },
      onRender(this: GjsViewContext) {
        this._refreshPreview()
      },
    } as unknown) as object,
  })

  editor.BlockManager.add('question-tf', {
    label: 'True / False',
    category: 'Questions',
    media: ICONS.questionTF,
    content: {
      type: 'question-tf',
      style: { position: 'absolute', left: '100px', top: '100px', width: '280px', height: '130px' },
    },
  })
}

// ---------------------------------------------------------------------------
// T014.1 + T014.2 — question-fill
// ---------------------------------------------------------------------------

function registerFillWidget(editor: Editor): void {
  editor.Components.addType('question-fill', {
    extendFnView: ['initialize'],
    model: {
      defaults: {
        name: 'Fill in the Blank',
        tagName: 'div',
        droppable: false,
        properties: {},
        actions: [],
        elearnActions: [],
        extendedProperties: { ...FILL_DEFAULT_EXTENDED },
        style: {
          width: '320px',
          height: '110px',
          'border-radius': '6px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          'z-index': '1',
          display: 'block',
        },
        traits: [{ type: 'text', name: 'name', label: 'Name' }],
      },
    },
    view: ({
      initialize(this: GjsViewContext) {
        this.listenTo(
          this.model,
          'change:extendedProperties',
          this._refreshPreview.bind(this),
        )
      },
      _refreshPreview(this: GjsViewContext) {
        try {
          const ep = (this.model.get('extendedProperties') as FillExtendedProps | undefined) ?? FILL_DEFAULT_EXTENDED
          this.el.innerHTML = buildFillPreviewHTML(ep)
        } catch {
          this.el.innerHTML = buildFillPreviewHTML(FILL_DEFAULT_EXTENDED)
        }
      },
      onRender(this: GjsViewContext) {
        this._refreshPreview()
      },
    } as unknown) as object,
  })

  editor.BlockManager.add('question-fill', {
    label: 'Fill in the Blank',
    category: 'Questions',
    media: ICONS.questionFill,
    content: {
      type: 'question-fill',
      style: { position: 'absolute', left: '100px', top: '100px', width: '320px', height: '110px' },
    },
  })
}
