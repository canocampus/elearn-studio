/**
 * Zustand store for the Actions Editor panel state — T020
 *
 * Manages the in-memory editing state for action sequences on the
 * currently-selected widget.  Changes are flushed to the course document
 * via onSave() which delegates to the GrapesJS Storage Manager.
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { unsafeCoerce } from '@elearn-studio/shared-types'
import { type Action, type ActionSequence, type SharedActionSequence, WIDGET_EVENTS, SLIDE_EVENTS } from '../types/actions'

// M4: allowlist of known event names validated at store level
const ALLOWED_EVENTS = new Set<string>([...WIDGET_EVENTS, ...SLIDE_EVENTS])

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActionsState {
  /** ID of the widget whose actions are being edited */
  widgetId: string | null
  /** All sequences for the current widget (indexed by event name) */
  sequences: ActionSequence[]

  // ── Selected sequence (the event tab in focus) ──
  selectedEvent: string | null

  // ── Variable definitions panel ──
  /** Course-level variable names defined by the author */
  variableNames: string[]

  // ── Shared sequences (T020.17) ──
  /** Course-level named macro sequences */
  sharedSequences: SharedActionSequence[]
  setSharedSequences: (sequences: SharedActionSequence[]) => void
  addSharedSequence: (name: string) => void
  removeSharedSequence: (name: string) => void
  renameSharedSequence: (oldName: string, newName: string) => void
  updateSharedSequenceActions: (name: string, actions: Action[]) => void

  // ── Actions ──
  setWidget: (widgetId: string, sequences: ActionSequence[]) => void
  clearWidget: () => void
  selectEvent: (event: string) => void

  addSequence: (event: string) => void
  removeSequence: (event: string) => void

  addAction: (event: string, action: Action) => void
  insertAction: (event: string, index: number, action: Action) => void
  removeAction: (event: string, index: number) => void
  updateAction: (event: string, index: number, action: Action) => void
  moveAction: (event: string, fromIndex: number, toIndex: number) => void

  /** Replace a nested sub-action (for condition/loop editors) */
  updateNestedAction: (
    event: string,
    actionIndex: number,
    path: ('then' | 'else' | 'body')[],
    nestedIndex: number,
    action: Action,
  ) => void

  setVariableNames: (names: string[]) => void
  addVariableName: (name: string) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _getSequence(sequences: ActionSequence[], event: string): ActionSequence | undefined {
  return sequences.find((s) => s.event === event)
}

function updateSequence(
  sequences: ActionSequence[],
  event: string,
  updater: (seq: ActionSequence) => ActionSequence,
): ActionSequence[] {
  return sequences.map((s) => (s.event === event ? updater(s) : s))
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useActionsStore = create<ActionsState>()(devtools((set, get) => ({
  widgetId: null,
  sequences: [],
  selectedEvent: null,
  variableNames: [],
  sharedSequences: [],

  setWidget: (widgetId, sequences) =>
    set({
      widgetId,
      sequences,
      selectedEvent: sequences[0]?.event ?? null,
    }),

  clearWidget: () =>
    set({ widgetId: null, sequences: [], selectedEvent: null }),

  selectEvent: (event) => set({ selectedEvent: event }),

  addSequence: (event) => {
    const { sequences } = get()
    if (sequences.some((s) => s.event === event)) return
    if (!ALLOWED_EVENTS.has(event)) {
      console.warn(`[actionsStore] Unknown event name "${event}" — sequence not added`)
      return
    }
    set({
      sequences: [...sequences, { event, actions: [] }],
      selectedEvent: event,
    })
  },

  removeSequence: (event) => {
    const { sequences, selectedEvent } = get()
    const next = sequences.filter((s) => s.event !== event)
    set({
      sequences: next,
      selectedEvent:
        selectedEvent === event ? (next[0]?.event ?? null) : selectedEvent,
    })
  },

  addAction: (event, action) => {
    set({
      sequences: updateSequence(get().sequences, event, (seq) => ({
        ...seq,
        actions: [...seq.actions, action],
      })),
    })
  },

  insertAction: (event, index, action) => {
    set({
      sequences: updateSequence(get().sequences, event, (seq) => {
        const actions = [...seq.actions]
        actions.splice(index, 0, action)
        return { ...seq, actions }
      }),
    })
  },

  removeAction: (event, index) => {
    set({
      sequences: updateSequence(get().sequences, event, (seq) => ({
        ...seq,
        actions: seq.actions.filter((_, i) => i !== index),
      })),
    })
  },

  updateAction: (event, index, action) => {
    set({
      sequences: updateSequence(get().sequences, event, (seq) => {
        const actions = [...seq.actions]
        actions[index] = action
        return { ...seq, actions }
      }),
    })
  },

  moveAction: (event, fromIndex, toIndex) => {
    set({
      sequences: updateSequence(get().sequences, event, (seq) => {
        const actions = [...seq.actions]
        const [moved] = actions.splice(fromIndex, 1)
        actions.splice(toIndex, 0, moved)
        return { ...seq, actions }
      }),
    })
  },

  updateNestedAction: (event, actionIndex, path, nestedIndex, action) => {
    set({
      sequences: updateSequence(get().sequences, event, (seq) => {
        const actions = [...seq.actions]
        // Deep-clone the target action before mutating
        const target = unsafeCoerce<Record<string, unknown>>(
          structuredClone(actions[actionIndex]),
          'structuredClone returns unknown shape; we walk it via dynamic keys (then/else/body) below',
        )
        let cursor = target.params as Record<string, unknown>
        for (const key of path) {
          cursor = cursor[key] as Record<string, unknown>
        }
        unsafeCoerce<Action[]>(
          cursor,
          'dynamic-key tree walk: cursor is the inner Action[] container at runtime',
        )[nestedIndex] = action
        actions[actionIndex] = unsafeCoerce<Action>(
          target,
          'finalize tree walk: target is the mutated Action shape (Record<string, unknown> at compile, Action at runtime)',
        )
        return { ...seq, actions }
      }),
    })
  },

  setVariableNames: (names) => set({ variableNames: names }),

  addVariableName: (name) => {
    const { variableNames } = get()
    if (!variableNames.includes(name)) {
      set({ variableNames: [...variableNames, name] })
    }
  },

  // ── Shared sequences (T020.17) ─────────────────────────────────────────────

  setSharedSequences: (sequences) => set({ sharedSequences: sequences }),

  addSharedSequence: (name) => {
    const { sharedSequences } = get()
    if (sharedSequences.some((s) => s.name === name)) {
      console.warn(`[actionsStore] Shared sequence "${name}" already exists`)
      return
    }
    set({ sharedSequences: [...sharedSequences, { name, actions: [] }] })
  },

  removeSharedSequence: (name) => {
    set({ sharedSequences: get().sharedSequences.filter((s) => s.name !== name) })
  },

  renameSharedSequence: (oldName, newName) => {
    const { sharedSequences } = get()
    if (sharedSequences.some((s) => s.name === newName)) {
      console.warn(`[actionsStore] Shared sequence "${newName}" already exists`)
      return
    }
    set({
      sharedSequences: sharedSequences.map((s) =>
        s.name === oldName ? { ...s, name: newName } : s,
      ),
    })
  },

  updateSharedSequenceActions: (name, actions) => {
    set({
      sharedSequences: get().sharedSequences.map((s) =>
        s.name === name ? { ...s, actions } : s,
      ),
    })
  },
}), { name: 'actionsStore', enabled: import.meta.env.DEV }))
