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
  /**
   * TD-014.2: append a new step with defaults; overrides shallow-merge on top.
   * Zero-size hotspot is the sentinel that puts HotspotCanvas into draw-mode.
   * No-op when config is null.
   */
  addStep: (overrides?: Partial<AuthoredSimStep>) => void
  /**
   * TD-014.2: replace the active SimConfig (used after `importSimulation`).
   * Preserves panelOpen + editingComponentId — this swaps data without
   * re-opening the overlay (which is what openPanel is for). Clamps
   * selectedStepIndex to the new steps range.
   */
  setConfig: (config: SimConfig) => void
}

export const useSimStore = create<SimState>((set, get) => ({
  config: null,
  selectedStepIndex: 0,
  panelOpen: false,
  editingComponentId: null,

  openPanel: (config, componentId) =>
    set({ config, panelOpen: true, selectedStepIndex: 0, editingComponentId: componentId }),

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

  addStep: (overrides = {}) => {
    const { config } = get()
    if (!config) return
    const newStep: AuthoredSimStep = {
      id: `step-${crypto.randomUUID().slice(0, 8)}`,
      order: config.steps.length,
      description: '',
      instruction: '',
      hint: '',
      correctFeedback: '',
      incorrectFeedback: '',
      demoDelay: 3000,
      maxAttempts: -1,
      screenshotKey: '',
      screenshotUrl: '',
      hotspot: { x: 0, y: 0, width: 0, height: 0, tolerance: 12 },
      interactionType: 'click',
      ...overrides,
    }
    set({
      config: { ...config, steps: [...config.steps, newStep] },
      selectedStepIndex: config.steps.length,
    })
  },

  setConfig: (config) => {
    const { selectedStepIndex } = get()
    const clampedIndex = config.steps.length === 0
      ? 0
      : Math.min(selectedStepIndex, config.steps.length - 1)
    set({ config, selectedStepIndex: clampedIndex })
  },
}))

// TD-014.29 (F7) — expose the store on window for E2E specs (dev + VITE_E2E_MODE
// only). Mirrors the pattern used for __elearn_store in EditorCanvas.tsx:93-96.
// Reads: E2E assertions over simStore.config (hotspot bounds, persisted order).
if (typeof window !== 'undefined' &&
    (import.meta.env.DEV || import.meta.env.VITE_E2E_MODE === 'true')) {
  window.__simStore = useSimStore
}
