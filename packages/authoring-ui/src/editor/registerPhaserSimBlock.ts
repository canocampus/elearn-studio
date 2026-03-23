/**
 * GrapesJS Block + Component for the Phaser Simulation widget. (T034)
 *
 * Canvas placeholder: dark panel with a game-controller icon + "Phaser Simulation" label.
 * Double-clicking the component opens the PhaserSimPreviewModal overlay.
 *
 * extendedProperties — PhaserSimExtendedProps stored on the GrapesJS component model.
 */

import type { Editor } from 'grapesjs'
import { usePhaserSimStore } from '../store/phaserSimStore'
import type { PhaserSimExtendedProps } from '../types/phaserSim'
import { PHASER_SIM_DEFAULT_EXTENDED } from '../types/phaserSim'

const PHASER_SIM_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <rect x="2" y="6" width="20" height="12" rx="3"/>
  <circle cx="8" cy="12" r="2"/>
  <line x1="14" y1="10" x2="14" y2="14"/>
  <line x1="12" y1="12" x2="16" y2="12"/>
</svg>`

const PLACEHOLDER_HTML = `
  <div style="
    width:100%;height:100%;
    display:flex;flex-direction:column;
    align-items:center;justify-content:center;
    background:#0d0d1a;color:#a6e3a1;gap:10px;
    font-family:Inter,system-ui,sans-serif;
    user-select:none;
  ">
    <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#a6e3a1" stroke-width="1.5">
      <rect x="2" y="6" width="20" height="12" rx="3"/>
      <circle cx="8" cy="12" r="2"/>
      <line x1="14" y1="10" x2="14" y2="14"/>
      <line x1="12" y1="12" x2="16" y2="12"/>
    </svg>
    <div style="font-size:13px;font-weight:600;color:#a6e3a1;">Phaser Simulation</div>
    <div style="font-size:11px;color:#6c7086;">Double-click to preview</div>
  </div>
`

export function registerPhaserSimBlock(editor: Editor): void {
  editor.Components.addType('phaser-sim', {
    model: {
      defaults: {
        name: 'Phaser Simulation',
        tagName: 'div',
        droppable: false,
        selectable: true,
        content: PLACEHOLDER_HTML,
        extendedProperties: { ...PHASER_SIM_DEFAULT_EXTENDED } as PhaserSimExtendedProps,
        style: {
          position: 'absolute',
          left: '112px',
          top: '134px',
          width: '800px',
          height: '500px',
          background: '#0d0d1a',
          'border-radius': '4px',
          overflow: 'hidden',
          'z-index': '1',
          display: 'block',
        },
        traits: [
          { type: 'text', name: 'name', label: 'Name' },
        ],
      },
    },

    view: ({
      events: { dblclick: 'onDblClick' },

      onDblClick() {
        const model = (this as { model: { id: string; get: (k: string) => unknown } }).model
        const componentId: string = model.id
        const extProps = model.get('extendedProperties') as PhaserSimExtendedProps | undefined
        const config = extProps ?? { ...PHASER_SIM_DEFAULT_EXTENDED }
        usePhaserSimStore.getState().openPreview(config, componentId)
      },
    } as unknown) as object,
  })

  editor.BlockManager.add('phaser-sim', {
    label: 'Phaser Sim',
    category: 'Simulations',
    media: PHASER_SIM_ICON,
    content: { type: 'phaser-sim' },
  })
}
