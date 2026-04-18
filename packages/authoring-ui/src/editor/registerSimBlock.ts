/**
 * GrapesJS Block + Component for the Screenshot Simulation widget. (T024.1, T024.2)
 *
 * Canvas placeholder: dark panel with a film-strip icon + "Screenshot Simulation" label.
 * Double-clicking the component in the canvas opens the SimulationEditor overlay.
 *
 * extendedProperties.simConfig  — SimConfig JSON stored on the GrapesJS component model.
 */

import type { Editor } from 'grapesjs'
import { useSimStore } from '../store/simStore'
import type { SimConfig } from '../types/simulation'

const SIM_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <rect x="2" y="4" width="20" height="16" rx="2"/>
  <path d="M8 4v16M16 4v16M2 9h4M2 15h4M18 9h4M18 15h4"/>
</svg>`

const PLACEHOLDER_HTML = `
  <div style="
    width:100%;height:100%;
    display:flex;flex-direction:column;
    align-items:center;justify-content:center;
    background:#0d0d1a;color:#89b4fa;gap:10px;
    font-family:Inter,system-ui,sans-serif;
    user-select:none;
  ">
    <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#89b4fa" stroke-width="1.5">
      <rect x="2" y="4" width="20" height="16" rx="2"/>
      <path d="M8 4v16M16 4v16M2 9h4M2 15h4M18 9h4M18 15h4"/>
    </svg>
    <div style="font-size:13px;font-weight:600;color:#89b4fa;">Screenshot Simulation</div>
    <div style="font-size:11px;color:#6c7086;">Double-click to edit</div>
  </div>
`

export function registerSimBlock(editor: Editor): void {
  editor.Components.addType('screenshot-sim', {
    model: {
      defaults: {
        name: 'Screenshot Simulation',
        tagName: 'div',
        droppable: false,
        selectable: true,
        content: PLACEHOLDER_HTML,
        properties: [],
        actions: [],
        elearnActions: [],
        extendedProperties: {
          simConfig: null as SimConfig | null,
        },
        style: {
          width: '640px',
          height: '360px',
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
        // `this.model` is the GrapesJS component model (Backbone.Model)
        const model = (this as { model: { id: string; get: (k: string) => unknown } }).model
        const componentId: string = model.id
        const extProps = model.get('extendedProperties') as { simConfig: SimConfig | null } | undefined
        const existing = extProps?.simConfig ?? null

        if (existing) {
          useSimStore.getState().openPanel(existing, componentId)
        } else {
          // No config yet — open with an empty scaffold
          const emptyConfig: SimConfig = {
            sessionId: '',
            mode: 'practice',
            passingScore: 80,
            steps: [],
          }
          useSimStore.getState().openPanel(emptyConfig, componentId)
        }
      },
    } as unknown) as object,
  })

  editor.BlockManager.add('screenshot-sim', {
    label: 'Screenshot Sim',
    category: 'Simulations',
    media: SIM_ICON,
    content: { type: 'screenshot-sim', style: { position: 'absolute', width: '640px', height: '360px' } },
  })
}
