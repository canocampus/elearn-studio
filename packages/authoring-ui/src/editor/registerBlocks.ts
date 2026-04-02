/**
 * GrapesJS Block Manager and Component Type registration.
 * Corrected for free-form drag & drop: left/top/position removed from defaults.
 */

import type { Editor } from 'grapesjs'
import { resolveAssetUrl } from '../api/courseApi'
import { registerQuestionBlocks } from './registerQuestionBlocks'
import { registerSimBlock } from './registerSimBlock'
import { registerPhaserSimBlock } from './registerPhaserSimBlock'

const ICONS = {
  text: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="7" y1="8" x2="17" y2="8"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="7" y1="16" x2="13" y2="16"/></svg>`,
  image: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
  button: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="10" rx="3"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`,
  rectangle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="1"/></svg>`,
  navButtons: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="8" width="8" height="8" rx="2"/><rect x="14" y="8" width="8" height="8" rx="2"/><polyline points="5 12 3 12 5 10"/><polyline points="19 12 21 12 19 10"/></svg>`,
  scoreQuiz: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><polyline points="12 8 12 12 15 14"/></svg>`,
  doneButton: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="10" rx="3"/><polyline points="7 12 10 15 17 9"/></svg>`,
  scoreField: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="8" width="18" height="8" rx="1"/><line x1="7" y1="12" x2="17" y2="12" stroke-dasharray="2 2"/></svg>`,
  mediaPlayer: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><polygon points="10 9 10 15 15 12" fill="currentColor" stroke="none"/></svg>`,
}

const NAME_TRAIT = { type: 'text', name: 'name', label: 'Name' }

export function registerBlocks(editor: Editor): void {
  registerTextWidget(editor)
  registerImageWidget(editor)
  registerButtonWidget(editor)
  registerRectangleWidget(editor)
  registerNavButtonsWidget(editor)
  registerScoreQuizWidget(editor)
  registerDoneButtonWidget(editor)
  registerScoreFieldWidget(editor)
  registerMediaPlayerWidget(editor)
  registerSimBlock(editor)
  registerPhaserSimBlock(editor)
}

function registerTextWidget(editor: Editor): void {
  editor.Components.addType('text', {
    model: {
      defaults: {
        name: 'Text',
        tagName: 'div',
        editable: true,
        droppable: false,
        content: 'Double-click to edit text',
        properties: {},
        actions: [],
        elearnActions: [],
        extendedProperties: {},        style: {
          width: '200px',
          height: '50px',
          'font-size': '16px',
          color: '#000000',
          'z-index': '1',
          display: 'block',
          'box-sizing': 'border-box',
          'padding-top': '4px',
          'padding-right': '8px',
          'padding-bottom': '4px',
          'padding-left': '8px',
        },
        traits: [NAME_TRAIT],
      },
    },
  })
  editor.BlockManager.add('text', { label: 'Text', category: 'Basic', media: ICONS.text, content: { type: 'text', style: { position: 'absolute', left: '100px', top: '100px', width: '200px', height: '50px' } } })
}

function registerImageWidget(editor: Editor): void {
  editor.Components.addType('image', {
    model: {
      defaults: {
        name: 'Image',
        tagName: 'img',
        void: true,
        resizable: true,
        attributes: { src: '' },
        properties: {},
        actions: [],
        elearnActions: [],
        extendedProperties: {},
        style: {
          width: '200px',
          height: '150px',
          'object-fit': 'contain',
          'z-index': '1',
          display: 'block',
        },
        traits: [NAME_TRAIT, { type: 'text', name: 'alt', label: 'Alt text' }],
      },
    },
    view: ({
      events: { click: 'onImageClick' },

      initialize(props: unknown) {
        // Call GrapesJS ComponentImageView parent initialize.
        // It registers the change:src → updateSrc listener and sets classEmpty.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const parent = Object.getPrototypeOf(Object.getPrototypeOf(this as any)) as {
          initialize?: (p: unknown) => void
        }
        parent.initialize?.call(this, props)
        // Also resolve presigned URLs whenever the root-level src property changes.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(this as any).listenTo(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (this as any).model,
          'change:src',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (this as any).resolveAndSetSrc.bind(this as any),
        )
      },

      onRender() {
        // Called once on initial mount; handle the case where src is already set.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this as any).resolveAndSetSrc()
      },

      resolveAndSetSrc(this: unknown) {
        // Read from the root-level src property (set via model.set('src', ...)).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const src: string = ((this as any).model.get('src') as string) ?? ''
        if (!src.startsWith('/assets/')) return
        const objectName = src.slice('/assets/'.length)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const el = (this as any).el as HTMLElement
        resolveAssetUrl(objectName)
          .then((presignedUrl: string) => {
            // Guard against stale DOM reference — the component may have been
            // removed from the canvas while the presigned-URL request was in-flight.
            if (!el.isConnected) return
            el.setAttribute('src', presignedUrl)
          })
          .catch((err: unknown) => {
            // Log with error message so failure mode is distinguishable
            // (network timeout vs 401 token expiry vs 403 vs 500 Garage down).
            const msg = err instanceof Error ? err.message : String(err)
            console.warn('[registerBlocks] resolveAndSetSrc failed for', objectName, '—', msg)
          })
      },

      onImageClick() {
        editor.AssetManager.open({
          types: ['image'],
          select(asset: { getSrc: () => string }, complete: boolean) {
            const src = asset.getSrc()
            if (!src) return
            const selected = editor.getSelected()
            // Use model.set('src', ...) so the root-level change:src event fires,
            // which triggers both GrapesJS's updateSrc and our resolveAndSetSrc.
            if (selected) selected.set('src', src)
            if (complete) editor.AssetManager.close()
          },
        })
      },
    } as unknown) as object,
  })
  editor.BlockManager.add('image', { label: 'Image', category: 'Basic', media: ICONS.image, content: { type: 'image', style: { position: 'absolute', left: '100px', top: '100px', width: '200px', height: '150px' } } })
}

function registerButtonWidget(editor: Editor): void {
  editor.Components.addType('button', {
    model: {
      defaults: {
        name: 'Button',
        tagName: 'button',
        content: 'Button',
        droppable: false,
        properties: {},
        actions: [],
        elearnActions: [],
        extendedProperties: {},
        style: {
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
        traits: [NAME_TRAIT, { type: 'text', name: 'content', label: 'Label' }],
      },
    },
  })
  editor.BlockManager.add('button', { label: 'Button', category: 'Basic', media: ICONS.button, content: { type: 'button', style: { position: 'absolute', left: '100px', top: '100px', width: '120px', height: '40px' } } })
}

function registerRectangleWidget(editor: Editor): void {
  editor.Components.addType('rectangle', {
    model: {
      defaults: {
        name: 'Rectangle',
        tagName: 'div',
        droppable: false,
        properties: {},
        actions: [],
        elearnActions: [],
        extendedProperties: {},
        style: {
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
  editor.BlockManager.add('rectangle', { label: 'Rectangle', category: 'Basic', media: ICONS.rectangle, content: { type: 'rectangle', style: { position: 'absolute', left: '100px', top: '100px', width: '200px', height: '100px' } } })
}

function registerNavButtonsWidget(editor: Editor): void {
  editor.Components.addType('nav-buttons', {
    model: {
      defaults: {
        name: 'Nav Buttons',
        tagName: 'div',
        droppable: false,
        properties: {},
        actions: [],
        elearnActions: [],
        extendedProperties: {},
        content: `
          <button style="padding:8px 16px;margin-right:8px;background:#64748b;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:13px;">← Previous</button>
          <button style="padding:8px 16px;background:#4f46e5;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:13px;">Next →</button>
        `,
        style: {
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
  editor.BlockManager.add('nav-buttons', { label: 'Nav Buttons', category: 'Navigation', media: ICONS.navButtons, content: { type: 'nav-buttons', style: { position: 'absolute', left: '100px', top: '100px', width: '240px', height: '50px' } } })
}

function registerDoneButtonWidget(editor: Editor): void {
  editor.Components.addType('done-button', {
    model: {
      defaults: {
        name: 'Done Button',
        tagName: 'button',
        content: '✓ Done',
        droppable: false,
        properties: {},
        actions: [],
        elearnActions: [],
        extendedProperties: {},
        style: {
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
    content: {
      type: 'done-button',
      style: { position: 'absolute', left: '100px', top: '100px', width: '120px', height: '40px' },
    },
  })
}

function registerScoreQuizWidget(editor: Editor): void {
  editor.Components.addType('score-quiz', {
    model: {
      defaults: {
        name: 'Quiz Score',
        tagName: 'div',
        droppable: false,
        properties: {},
        actions: [],
        elearnActions: [],
        extendedProperties: {},
        content: `
          <div style="font-size:13px;color:#64748b;margin-bottom:4px;">Quiz Score</div>
          <div style="font-size:28px;font-weight:bold;color:#4f46e5;">0 / 0</div>
        `,
        style: {
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
  editor.BlockManager.add('score-quiz', { label: 'Quiz Score', category: 'Assessment', media: ICONS.scoreQuiz, content: { type: 'score-quiz', style: { position: 'absolute', left: '100px', top: '100px', width: '160px', height: '70px' } } })
}

function registerScoreFieldWidget(editor: Editor): void {
  editor.Components.addType('score-field', {
    model: {
      defaults: {
        name: 'Score Field',
        tagName: 'div',
        droppable: false,
        properties: {},
        actions: [],
        elearnActions: [],
        extendedProperties: {},
        content: `
          <span style="font-size:13px;color:#64748b;">Score: </span>
          <span style="font-size:13px;font-weight:bold;color:#0f172a;">—</span>
        `,
        style: {
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
  editor.BlockManager.add('score-field', { label: 'Score Field', category: 'Assessment', media: ICONS.scoreField, content: { type: 'score-field', style: { position: 'absolute', left: '100px', top: '100px', width: '140px', height: '36px' } } })
}

function registerMediaPlayerWidget(editor: Editor): void {
  editor.Components.addType('media-player', {
    model: {
      defaults: {
        name: 'Media Player',
        tagName: 'div',
        droppable: false,
        properties: {},
        actions: [],
        elearnActions: [],
        extendedProperties: {},
        content: `
          <div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0f172a;color:#94a3b8;font-size:13px;gap:8px;">
            <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="5 3 19 12 5 21" fill="currentColor" stroke="none"/></svg>
            <span>Media Player</span>
          </div>
        `,
        style: {
          width: '320px',
          height: '200px',
          'background-color': '#0f172a',
          'border-radius': '6px',
          overflow: 'hidden',
          'z-index': '1',
          display: 'block',
        },
        traits: [NAME_TRAIT, { type: 'text', name: 'src', label: 'Media URL' }, { type: 'select', name: 'mediaType', label: 'Type', default: 'video', options: [{ id: 'video', name: 'Video' }, { id: 'audio', name: 'Audio' }] }],
      },
    },
  })
  editor.BlockManager.add('media-player', {
    label: 'Media Player',
    category: 'Media',
    media: ICONS.mediaPlayer,
    content: {
      type: 'media-player',
      style: { position: 'absolute', left: '100px', top: '100px', width: '320px', height: '200px' },
    },
  })
  registerQuestionBlocks(editor)
}
