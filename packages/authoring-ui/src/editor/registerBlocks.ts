/**
 * GrapesJS Block Manager and Component Type registration for eLearn Studio widgets.
 *
 * T012.1 — text, image, button, rectangle
 * T012.2 — nav-buttons, score-quiz, done-button, score-field
 * T012.3 — media-player
 *
 * Each widget type is registered as:
 *   - A BlockManager entry (shown in the left sidebar palette)
 *   - A ComponentType (model defaults + canvas preview via GrapesJS native rendering)
 *
 * T012.5 — Each component renders a useful preview in the GrapesJS canvas iframe.
 * T012.6 — Drag-and-drop placement is handled by GrapesJS + position:absolute via initEditor.ts.
 * T012.7 — Text widget uses GrapesJS built-in editable (contenteditable on dblclick).
 * T012.8 — Image widget view opens AssetManager on click.
 * T012.9 — Button label is exposed as an editable trait.
 * T012.10 — All components expose 'name' trait for Layer Manager display naming.
 */

import type { Editor } from 'grapesjs'
import { registerQuestionBlocks } from './registerQuestionBlocks'
import { registerSimBlock } from './registerSimBlock'
import { registerPhaserSimBlock } from './registerPhaserSimBlock'

// ---------------------------------------------------------------------------
// SVG icons (inline, minimal)
// ---------------------------------------------------------------------------

const ICONS = {
  text: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <line x1="7" y1="8" x2="17" y2="8"/><line x1="7" y1="12" x2="17" y2="12"/>
    <line x1="7" y1="16" x2="13" y2="16"/>
  </svg>`,

  image: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <circle cx="8.5" cy="8.5" r="1.5"/>
    <polyline points="21 15 16 10 5 21"/>
  </svg>`,

  button: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="2" y="7" width="20" height="10" rx="3"/>
    <line x1="8" y1="12" x2="16" y2="12"/>
  </svg>`,

  rectangle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="3" y="5" width="18" height="14" rx="1"/>
  </svg>`,

  navButtons: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="2" y="8" width="8" height="8" rx="2"/>
    <rect x="14" y="8" width="8" height="8" rx="2"/>
    <polyline points="5 12 3 12 5 10"/><polyline points="19 12 21 12 19 10"/>
  </svg>`,

  scoreQuiz: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="9"/>
    <polyline points="12 8 12 12 15 14"/>
  </svg>`,

  doneButton: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="2" y="7" width="20" height="10" rx="3"/>
    <polyline points="7 12 10 15 17 9"/>
  </svg>`,

  scoreField: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="3" y="8" width="18" height="8" rx="1"/>
    <line x1="7" y1="12" x2="17" y2="12" stroke-dasharray="2 2"/>
  </svg>`,

  mediaPlayer: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="2" y="4" width="20" height="16" rx="2"/>
    <polygon points="10 9 10 15 15 12" fill="currentColor" stroke="none"/>
  </svg>`,
}

// ---------------------------------------------------------------------------
// Shared name trait — T012.10
// ---------------------------------------------------------------------------

const NAME_TRAIT = { type: 'text', name: 'name', label: 'Name' }

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function registerBlocks(editor: Editor): void {
  // T012.1
  registerTextWidget(editor)
  registerImageWidget(editor)
  registerButtonWidget(editor)
  registerRectangleWidget(editor)
  // T012.2
  registerNavButtonsWidget(editor)
  registerScoreQuizWidget(editor)
  registerDoneButtonWidget(editor)
  registerScoreFieldWidget(editor)
  // T012.3
  registerMediaPlayerWidget(editor)
  // T024.1
  registerSimBlock(editor)
  // T034
  registerPhaserSimBlock(editor)
}

// ---------------------------------------------------------------------------
// T012.1 — text
// ---------------------------------------------------------------------------

function registerTextWidget(editor: Editor): void {
  // Extend the built-in GrapesJS text type so double-click editing (T012.7) is inherited.
  editor.Components.addType('text', {
    model: {
      defaults: {
        name: 'Text',
        tagName: 'div',
        editable: true,    // double-click activates contenteditable (T012.7)
        droppable: false,
        content: 'Double-click to edit text',
        style: {
          position: 'absolute',
          left: '20px',
          top: '20px',
          width: '200px',
          height: '50px',
          'font-size': '16px',
          color: '#000000',
          'z-index': '1',
          display: 'block',
        },
        traits: [NAME_TRAIT],
      },
    },
  })

  editor.BlockManager.add('text', {
    label: 'Text',
    category: 'Basic',
    media: ICONS.text,
    content: { type: 'text' },
  })
}

// ---------------------------------------------------------------------------
// T012.1 — image
// ---------------------------------------------------------------------------

function registerImageWidget(editor: Editor): void {
  editor.Components.addType('image', {
    model: {
      defaults: {
        name: 'Image',
        tagName: 'img',
        void: true,         // self-closing tag
        resizable: true,
        attributes: { src: '' },
        style: {
          position: 'absolute',
          left: '20px',
          top: '20px',
          width: '200px',
          height: '150px',
          'object-fit': 'contain',
          'z-index': '1',
          display: 'block',
        },
        traits: [NAME_TRAIT, { type: 'text', name: 'alt', label: 'Alt text' }],
      },
    },
    // GrapesJS Backbone-style view — events map + named handlers
    view: ({
      events: { click: 'onImageClick' },
      onImageClick() {
        // editor is available via closure from registerImageWidget(editor) — T012.8
        editor.AssetManager.open({
          types: ['image'],
          select(asset: { getSrc: () => string }, complete: boolean) {
            // Validate src before applying — C-02 guard
            const src = asset.getSrc()
            if (!src) return
            const selected = editor.getSelected()
            // addAttributes is the correct GrapesJS API for updating HTML attributes
            if (selected) selected.addAttributes({ src })
            if (complete) editor.AssetManager.close()
          },
        })
      },
    } as unknown) as object,
  })

  editor.BlockManager.add('image', {
    label: 'Image',
    category: 'Basic',
    media: ICONS.image,
    // Defaults (dimensions, position) come from the component type registered above
    content: { type: 'image' },
  })
}

// ---------------------------------------------------------------------------
// T012.1 — button
// ---------------------------------------------------------------------------

function registerButtonWidget(editor: Editor): void {
  editor.Components.addType('button', {
    model: {
      defaults: {
        name: 'Button',
        tagName: 'button',
        content: 'Button',
        droppable: false,
        style: {
          position: 'absolute',
          left: '20px',
          top: '20px',
          width: '120px',
          height: '40px',
          'background-color': '#4f46e5',
          color: '#ffffff',
          border: 'none',
          'border-radius': '4px',
          'font-size': '14px',
          cursor: 'pointer',
          'z-index': '1',
          display: 'block',
        },
        // T012.9 — label editable via traits panel
        traits: [NAME_TRAIT, { type: 'text', name: 'content', label: 'Label' }],
      },
    },
  })

  editor.BlockManager.add('button', {
    label: 'Button',
    category: 'Basic',
    media: ICONS.button,
    content: { type: 'button' },
  })
}

// ---------------------------------------------------------------------------
// T012.1 — rectangle
// ---------------------------------------------------------------------------

function registerRectangleWidget(editor: Editor): void {
  editor.Components.addType('rectangle', {
    model: {
      defaults: {
        name: 'Rectangle',
        tagName: 'div',
        droppable: false,
        style: {
          position: 'absolute',
          left: '20px',
          top: '20px',
          width: '200px',
          height: '100px',
          'background-color': '#e2e8f0',
          border: '1px solid #cbd5e1',
          'z-index': '1',
          display: 'block',
        },
        traits: [NAME_TRAIT],
      },
    },
  })

  editor.BlockManager.add('rectangle', {
    label: 'Rectangle',
    category: 'Basic',
    media: ICONS.rectangle,
    content: { type: 'rectangle' },
  })
}

// ---------------------------------------------------------------------------
// T012.2 — nav-buttons (Previous / Next navigation)
// ---------------------------------------------------------------------------

function registerNavButtonsWidget(editor: Editor): void {
  editor.Components.addType('nav-buttons', {
    model: {
      defaults: {
        name: 'Nav Buttons',
        tagName: 'div',
        droppable: false,
        content: `
          <button style="padding:8px 16px;margin-right:8px;background:#64748b;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:13px;">← Previous</button>
          <button style="padding:8px 16px;background:#4f46e5;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:13px;">Next →</button>
        `,
        style: {
          position: 'absolute',
          left: '20px',
          top: '20px',
          width: '240px',
          height: '50px',
          display: 'flex',
          'align-items': 'center',
          'z-index': '1',
        },
        traits: [NAME_TRAIT],
      },
    },
  })

  editor.BlockManager.add('nav-buttons', {
    label: 'Nav Buttons',
    category: 'Navigation',
    media: ICONS.navButtons,
    content: { type: 'nav-buttons' },
  })
}

// ---------------------------------------------------------------------------
// T012.2 — done-button
// ---------------------------------------------------------------------------

function registerDoneButtonWidget(editor: Editor): void {
  editor.Components.addType('done-button', {
    model: {
      defaults: {
        name: 'Done Button',
        tagName: 'button',
        content: '✓ Done',
        droppable: false,
        style: {
          position: 'absolute',
          left: '20px',
          top: '20px',
          width: '120px',
          height: '40px',
          'background-color': '#16a34a',
          color: '#ffffff',
          border: 'none',
          'border-radius': '4px',
          'font-size': '14px',
          cursor: 'pointer',
          'z-index': '1',
          display: 'block',
        },
        traits: [NAME_TRAIT, { type: 'text', name: 'content', label: 'Label' }],
      },
    },
  })

  editor.BlockManager.add('done-button', {
    label: 'Done Button',
    category: 'Navigation',
    media: ICONS.doneButton,
    content: { type: 'done-button' },
  })
}

// ---------------------------------------------------------------------------
// T012.2 — score-quiz
// ---------------------------------------------------------------------------

function registerScoreQuizWidget(editor: Editor): void {
  editor.Components.addType('score-quiz', {
    model: {
      defaults: {
        name: 'Quiz Score',
        tagName: 'div',
        droppable: false,
        content: `
          <div style="font-size:13px;color:#64748b;margin-bottom:4px;">Quiz Score</div>
          <div style="font-size:28px;font-weight:bold;color:#4f46e5;">0 / 0</div>
        `,
        style: {
          position: 'absolute',
          left: '20px',
          top: '20px',
          width: '160px',
          height: '70px',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          'border-radius': '6px',
          padding: '10px',
          'text-align': 'center',
          'z-index': '1',
          display: 'block',
        },
        traits: [NAME_TRAIT],
      },
    },
  })

  editor.BlockManager.add('score-quiz', {
    label: 'Quiz Score',
    category: 'Assessment',
    media: ICONS.scoreQuiz,
    content: { type: 'score-quiz' },
  })
}

// ---------------------------------------------------------------------------
// T012.2 — score-field
// ---------------------------------------------------------------------------

function registerScoreFieldWidget(editor: Editor): void {
  editor.Components.addType('score-field', {
    model: {
      defaults: {
        name: 'Score Field',
        tagName: 'div',
        droppable: false,
        content: `
          <span style="font-size:13px;color:#64748b;">Score: </span>
          <span style="font-size:13px;font-weight:bold;color:#0f172a;">—</span>
        `,
        style: {
          position: 'absolute',
          left: '20px',
          top: '20px',
          width: '140px',
          height: '36px',
          background: '#f1f5f9',
          border: '1px solid #e2e8f0',
          'border-radius': '4px',
          padding: '8px 12px',
          'line-height': '1',
          'z-index': '1',
          display: 'flex',
          'align-items': 'center',
        },
        traits: [NAME_TRAIT],
      },
    },
  })

  editor.BlockManager.add('score-field', {
    label: 'Score Field',
    category: 'Assessment',
    media: ICONS.scoreField,
    content: { type: 'score-field' },
  })
}

// ---------------------------------------------------------------------------
// T012.3 — media-player
// ---------------------------------------------------------------------------

function registerMediaPlayerWidget(editor: Editor): void {
  editor.Components.addType('media-player', {
    model: {
      defaults: {
        name: 'Media Player',
        tagName: 'div',
        droppable: false,
        content: `
          <div style="
            width:100%;height:100%;
            display:flex;flex-direction:column;
            align-items:center;justify-content:center;
            background:#0f172a;color:#94a3b8;
            font-size:13px;gap:8px;
          ">
            <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5">
              <polygon points="5 3 19 12 5 21" fill="currentColor" stroke="none"/>
            </svg>
            <span>Media Player</span>
          </div>
        `,
        style: {
          position: 'absolute',
          left: '20px',
          top: '20px',
          width: '320px',
          height: '200px',
          'background-color': '#0f172a',
          'border-radius': '6px',
          overflow: 'hidden',
          'z-index': '1',
          display: 'block',
        },
        traits: [
          NAME_TRAIT,
          { type: 'text', name: 'src', label: 'Media URL' },
          {
            type: 'select',
            name: 'mediaType',
            label: 'Type',
            default: 'video',
            options: [
              { id: 'video', name: 'Video' },
              { id: 'audio', name: 'Audio' },
            ],
          },
        ],
      },
    },
  })

  editor.BlockManager.add('media-player', {
    label: 'Media Player',
    category: 'Media',
    media: ICONS.mediaPlayer,
    content: { type: 'media-player' },
  })

  registerQuestionBlocks(editor)
}
