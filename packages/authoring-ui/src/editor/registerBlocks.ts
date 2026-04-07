/**
 * GrapesJS Block Manager and Component Type registration.
 * Corrected for free-form drag & drop: left/top/position removed from defaults.
 */

import type { Editor } from 'grapesjs'
import { resolveAssetUrl } from '../api/courseApi'
import { NAV_BUTTON_DEFAULTS } from './converters'
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
  audioNarration: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19" fill="currentColor" stroke="none"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`,
  progressBar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="9" width="20" height="6" rx="3"/><rect x="2" y="9" width="13" height="6" rx="3" fill="currentColor" stroke="none"/></svg>`,
  volumeControl: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19" fill="currentColor" stroke="none"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><line x1="18" y1="10" x2="22" y2="10"/><line x1="18" y1="14" x2="22" y2="14"/></svg>`,
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
  registerAudioNarrationWidget(editor)
  registerProgressBarWidget(editor)
  registerVolumeControlWidget(editor)
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
  editor.BlockManager.add('text', { label: 'Text', category: 'Basic', media: ICONS.text, content: { type: 'text', style: { position: 'absolute', width: '200px', height: '50px' } } })
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
    // T623: extendFnView tells GrapesJS to call the parent initialize()
    // automatically, eliminating the brittle Object.getPrototypeOf(…) chain.
    extendFnView: ['initialize'],
    view: ({
      // T605.2 — Double-click opens the Asset Manager (single-click just selects).
      events: { dblclick: 'onImageClick' },

      initialize(this: unknown) {
        // Register presigned-URL resolver on src changes via the public
        // Backbone.listenTo API. The parent initialize() (GrapesJS
        // ComponentImageView) is called automatically by extendFnView.
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
        // T605.2 — Tooltip guides authors to open the image selector on double-click.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(this as any).el.title = 'Double-click to open image selector'
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
  editor.BlockManager.add('image', { label: 'Image', category: 'Basic', media: ICONS.image, content: { type: 'image', style: { position: 'absolute', width: '200px', height: '150px' } } })
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
  editor.BlockManager.add('button', { label: 'Button', category: 'Basic', media: ICONS.button, content: { type: 'button', style: { position: 'absolute', width: '120px', height: '40px' } } })
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
  editor.BlockManager.add('rectangle', { label: 'Rectangle', category: 'Basic', media: ICONS.rectangle, content: { type: 'rectangle', style: { position: 'absolute', width: '200px', height: '100px' } } })
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
        style: {
          width: '240px',
          height: '50px',
          display: 'flex',
          'align-items': 'center',
          'z-index': '1',
        },
        traits: [NAME_TRAIT],
        // T634: defaults.components so component.components().at(0/1) returns them.
        // Each child must carry actions:[] to prevent the GrapesJS loadData forEach crash.
        // Label strings come from NAV_BUTTON_DEFAULTS (converters.ts).
        components: [
          {
            tagName: 'button', content: NAV_BUTTON_DEFAULTS.prevLabel,
            droppable: false, draggable: false,
            actions: [], elearnActions: [], properties: {}, extendedProperties: {},
            style: { padding: '8px 16px', 'margin-right': '8px', background: '#64748b', color: '#fff', border: 'none', 'border-radius': '4px', cursor: 'pointer', 'font-size': '13px' },
          },
          {
            tagName: 'button', content: NAV_BUTTON_DEFAULTS.nextLabel,
            droppable: false, draggable: false,
            actions: [], elearnActions: [], properties: {}, extendedProperties: {},
            style: { padding: '8px 16px', background: '#4f46e5', color: '#fff', border: 'none', 'border-radius': '4px', cursor: 'pointer', 'font-size': '13px' },
          },
        ],
      },
    },
  })
  editor.BlockManager.add('nav-buttons', { label: 'Nav Buttons', category: 'Navigation', media: ICONS.navButtons, content: { type: 'nav-buttons', style: { position: 'absolute', width: '240px', height: '50px' } } })
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
      style: { position: 'absolute', width: '120px', height: '40px' },
    },
  })
}

function registerScoreQuizWidget(editor: Editor): void {
  editor.Components.addType('score-quiz', {
    extendFnView: ['initialize'],
    model: {
      defaults: {
        name: 'Quiz Score',
        tagName: 'div',
        droppable: false,
        properties: {},
        actions: [],
        elearnActions: [],
        extendedProperties: {},
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
    view: {
      onRender(this: { el: HTMLElement }) {
        this.el.innerHTML = `<div style="font-size:13px;color:#64748b;margin-bottom:4px;">Quiz Score</div><div style="font-size:28px;font-weight:bold;color:#4f46e5;">0 / 0</div>`
      },
    },
  })
  editor.BlockManager.add('score-quiz', { label: 'Quiz Score', category: 'Assessment', media: ICONS.scoreQuiz, content: { type: 'score-quiz', style: { position: 'absolute', width: '160px', height: '70px' } } })
}

function registerScoreFieldWidget(editor: Editor): void {
  editor.Components.addType('score-field', {
    extendFnView: ['initialize'],
    model: {
      defaults: {
        name: 'Score Field',
        tagName: 'div',
        droppable: false,
        properties: {},
        actions: [],
        elearnActions: [],
        extendedProperties: {},
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
    view: {
      onRender(this: { el: HTMLElement }) {
        this.el.innerHTML = `<span style="font-size:13px;color:#64748b;">Score: </span><span style="font-size:13px;font-weight:bold;color:#0f172a;">—</span>`
      },
    },
  })
  editor.BlockManager.add('score-field', { label: 'Score Field', category: 'Assessment', media: ICONS.scoreField, content: { type: 'score-field', style: { position: 'absolute', width: '140px', height: '36px' } } })
}

function registerMediaPlayerWidget(editor: Editor): void {
  editor.Components.addType('media-player', {
    extendFnView: ['initialize'],
    model: {
      defaults: {
        name: 'Media Player',
        tagName: 'div',
        droppable: false,
        properties: {},
        actions: [],
        elearnActions: [],
        extendedProperties: {},
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
    view: {
      onRender(this: { el: HTMLElement }) {
        this.el.innerHTML = `<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0f172a;color:#94a3b8;font-size:13px;gap:8px;"><svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="5 3 19 12 5 21" fill="currentColor" stroke="none"/></svg><span>Media Player</span></div>`
      },
    },
  })
  editor.BlockManager.add('media-player', {
    label: 'Media Player',
    category: 'Media',
    media: ICONS.mediaPlayer,
    content: {
      type: 'media-player',
      style: { position: 'absolute', width: '320px', height: '200px' },
    },
  })
  registerQuestionBlocks(editor)
}

function registerAudioNarrationWidget(editor: Editor): void {
  editor.Components.addType('audio-narration', {
    extendFnView: ['initialize'],
    model: {
      defaults: {
        name: 'Audio Narration',
        tagName: 'div',
        droppable: false,
        properties: [],
        actions: [],
        elearnActions: [],
        extendedProperties: { controls: true, autoplay: false },
        style: {
          width: '280px',
          height: '60px',
          'background-color': '#0f172a',
          'border-radius': '6px',
          'z-index': '1',
          display: 'block',
        },
        traits: [NAME_TRAIT, { type: 'text', name: 'src', label: 'Audio URL' }],
      },
    },
    view: {
      onRender(this: { el: HTMLElement }) {
        this.el.innerHTML = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;gap:10px;color:#94a3b8;font-size:13px;"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19" fill="currentColor" stroke="none"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg><span>Audio Narration</span></div>`
      },
    },
  })
  editor.BlockManager.add('audio-narration', {
    label: 'Audio Narration',
    category: 'Media',
    media: ICONS.audioNarration,
    content: {
      type: 'audio-narration',
      style: { position: 'absolute', width: '280px', height: '60px' },
    },
  })
}

function registerProgressBarWidget(editor: Editor): void {
  editor.Components.addType('progress-bar', {
    extendFnView: ['initialize'],
    model: {
      defaults: {
        name: 'Progress Bar',
        tagName: 'div',
        droppable: false,
        properties: [],
        actions: [],
        elearnActions: [],
        extendedProperties: { color: '#4f46e5', height: 12, showPercent: true },
        style: {
          width: '300px',
          height: '40px',
          padding: '0 8px',
          'box-sizing': 'border-box',
          'z-index': '1',
          display: 'block',
        },
        traits: [NAME_TRAIT],
      },
    },
    view: {
      onRender(this: { el: HTMLElement }) {
        this.el.innerHTML = `<div style="width:100%;height:100%;display:flex;flex-direction:column;justify-content:center;gap:4px;"><div style="width:100%;background:#e2e8f0;border-radius:99px;overflow:hidden;"><div style="width:40%;height:12px;background:#4f46e5;border-radius:99px;"></div></div><div style="font-size:11px;color:#64748b;text-align:right;">40%</div></div>`
      },
    },
  })
  editor.BlockManager.add('progress-bar', {
    label: 'Progress Bar',
    category: 'Navigation',
    media: ICONS.progressBar,
    content: {
      type: 'progress-bar',
      style: { position: 'absolute', width: '80%', height: '40px' },
    },
  })
}

function registerVolumeControlWidget(editor: Editor): void {
  editor.Components.addType('volume-control', {
    extendFnView: ['initialize'],
    model: {
      defaults: {
        name: 'Volume Control',
        tagName: 'div',
        droppable: false,
        properties: [],
        actions: [],
        elearnActions: [],
        extendedProperties: { defaultVolume: 80, showMute: true },
        style: {
          width: '200px',
          height: '40px',
          background: '#1e293b',
          'border-radius': '6px',
          color: '#94a3b8',
          'z-index': '1',
          display: 'block',
        },
        traits: [NAME_TRAIT],
      },
    },
    view: {
      onRender(this: { el: HTMLElement }) {
        this.el.innerHTML = `<div style="width:100%;height:100%;display:flex;align-items:center;gap:8px;padding:0 8px;box-sizing:border-box;"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19" fill="currentColor" stroke="none"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg><input type="range" min="0" max="100" value="80" style="flex:1;cursor:pointer;" /></div>`
      },
    },
  })
  editor.BlockManager.add('volume-control', {
    label: 'Volume Control',
    category: 'Media',
    media: ICONS.volumeControl,
    content: {
      type: 'volume-control',
      style: { position: 'absolute', width: '200px', height: '40px' },
    },
  })
}
