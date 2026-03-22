/**
 * Zustand store for the Screenshot Simulation editor (T024).
 */

import { create } from 'zustand'
import type { SimConfig, AuthoredSimStep, SimMode } from '../types/simulation'

interface SimState {
  /** Current simulation config being edited; null when panel is closed */
  config: SimConfig | null
  /** Index of the currently selected step in the list */
  selectedStepIndex: number
  /** Whether the SimulationEditor panel is open */
  panelOpen: boolean
  /** GrapesJS component ID of the screenshot-sim widget being edited */
  editingComponentId: string | null

  openPanel: (config: SimConfig, componentId: string) => void
  closePanel: () => void
  selectStep: (index: number) => void
  updateStep: (index: number, patch: Partial<AuthoredSimStep>) => void
  reorderStep: (fromIndex: number, toIndex: number) => void
  deleteStep: (index: number) => void
  updateMode: (mode: SimMode) => void
  updatePassingScore: (score: number) => void
}

export const useSimStore = create<SimState>((set, get) => ({
  config: null,
  selectedStepIndex: 0,
  panelOpen: false,
  editingComponentId: null,

  openPanel: (config, componentId) =>
    set({ config, componentId, panelOpen: true, selectedStepIndex: 0, editingComponentId: componentId }),

  closePanel: () =>
    set({ panelOpen: false, config: null, editingComponentId: null }),

  selectStep: (selectedStepIndex) => set({ selectedStepIndex }),

  updateStep: (index, patch) => {
    const { config } = get()
    if (!config) return
    const steps = config.steps.map((s, i) =>
      i === index ? { ...s, ...patch } : s,
    )
    set({ config: { ...config, steps } })
  },

  reorderStep: (fromIndex, toIndex) => {
    const { config } = get()
    if (!config) return
    const steps = [...config.steps]
    const [moved] = steps.splice(fromIndex, 1)
    steps.splice(toIndex, 0, moved)
    // Re-assign order values
    const reordered = steps.map((s, i) => ({ ...s, order: i }))
    set({ config: { ...config, steps: reordered }, selectedStepIndex: toIndex })
  },

  deleteStep: (index) => {
    const { config, selectedStepIndex } = get()
    if (!config) return
    const steps = config.steps
      .filter((_, i) => i !== index)
      .map((s, i) => ({ ...s, order: i }))
    const newSelected = Math.min(selectedStepIndex, Math.max(0, steps.length - 1))
    set({ config: { ...config, steps }, selectedStepIndex: newSelected })
  },

  updateMode: (mode) => {
    const { config } = get()
    if (!config) return
    set({ config: { ...config, mode } })
  },

  updatePassingScore: (passingScore) => {
    const { config } = get()
    if (!config) return
    set({ config: { ...config, passingScore } })
  },
}))
