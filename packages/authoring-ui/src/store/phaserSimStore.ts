/**
 * Zustand store for the Phaser Simulation preview modal (T034).
 */

import { create } from 'zustand'
import type { PhaserSimExtendedProps } from '../types/phaserSim'

interface PhaserSimState {
  /** Whether the preview modal is open */
  previewOpen: boolean
  /** GrapesJS component ID of the phaser-sim widget being previewed */
  editingComponentId: string | null
  /** Config snapshot used to render the preview */
  config: PhaserSimExtendedProps | null

  openPreview: (config: PhaserSimExtendedProps, componentId: string) => void
  closePreview: () => void
}

export const usePhaserSimStore = create<PhaserSimState>((set) => ({
  previewOpen: false,
  editingComponentId: null,
  config: null,

  openPreview: (config, componentId) =>
    set({ previewOpen: true, config, editingComponentId: componentId }),

  closePreview: () =>
    set({ previewOpen: false, config: null, editingComponentId: null }),
}))
