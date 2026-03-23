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

// ---------------------------------------------------------------------------
// Selector hooks — avoids inline arrow selectors in every consumer
// ---------------------------------------------------------------------------

/** Returns true when the Phaser preview modal is open. */
export const usePreviewOpen = () => usePhaserSimStore((s) => s.previewOpen)

/** Returns the GrapesJS component ID currently being previewed (or null). */
export const useEditingComponentId = () => usePhaserSimStore((s) => s.editingComponentId)

/** Returns the config snapshot for the simulation being previewed (or null). */
export const usePhaserSimConfig = () => usePhaserSimStore((s) => s.config)

/** Returns the store's action functions (stable references, never cause re-renders). */
export const usePhaserSimActions = () =>
  usePhaserSimStore((s) => ({ openPreview: s.openPreview, closePreview: s.closePreview }))
