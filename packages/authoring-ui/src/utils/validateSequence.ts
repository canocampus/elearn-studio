/**
 * validateSequence — T020.18
 *
 * Pre-save validation pass for action sequences.
 * Returns an array of ValidationWarning objects.
 * Does NOT throw — warnings are advisory and do not block saving.
 *
 * Checks performed:
 *  - Actions with a required widgetId param that is empty
 *  - navigate actions targeting 'slide-name' without a slideName
 *  - navigate actions targeting 'slide-number' without a slideNumber
 *  - set-variable actions with an empty variable name
 *  - condition actions with an empty expression
 *  - call-sequence actions whose sequenceName doesn't exist in sharedSequences
 */

import type { Action, ActionSequence, SharedActionSequence } from '../types/actions'
import { detectCycles } from './cycleDetection'

export interface ValidationWarning {
  /** Human-readable description of the problem */
  message: string
  /** Event name the warning belongs to */
  event: string
  /** 0-based index of the action in its sequence */
  actionIndex: number
}

interface ValidationContext {
  /** Widget IDs on the current slide (may be empty when offline) */
  widgetIds: string[]
  /** Course-level shared sequence names */
  sharedSequenceNames: string[]
}

function validateAction(
  action: Action,
  index: number,
  event: string,
  ctx: ValidationContext,
  warnings: ValidationWarning[],
): void {
  const warn = (msg: string) => warnings.push({ message: msg, event, actionIndex: index })

  switch (action.type) {
    case 'show':
    case 'hide':
    case 'bring-to-front':
    case 'play-media':
    case 'stop-media':
    case 'score-question': {
      const { widgetId } = action.params
      if (!widgetId) {
        warn(`"${action.type}" requires a Widget ID`)
      } else if (ctx.widgetIds.length > 0 && !ctx.widgetIds.includes(widgetId)) {
        warn(`"${action.type}" references unknown widget "${widgetId}"`)
      }
      break
    }
    case 'play-animation': {
      const { widgetId } = action.params
      if (!widgetId) {
        warn('"play-animation" requires a Widget ID')
      } else if (ctx.widgetIds.length > 0 && !ctx.widgetIds.includes(widgetId)) {
        warn(`"play-animation" references unknown widget "${widgetId}"`)
      }
      break
    }
    case 'navigate': {
      const { target, slideName, slideNumber } = action.params
      if (target === 'slide-name' && !slideName?.trim()) {
        warn('"navigate" to slide-name requires a slide title')
      }
      if (target === 'slide-number' && (slideNumber == null || slideNumber < 1)) {
        warn('"navigate" to slide-number requires a valid slide number (≥ 1)')
      }
      break
    }
    case 'set-variable': {
      if (!action.params.name?.trim()) {
        warn('"set-variable" requires a variable name')
      }
      break
    }
    case 'condition': {
      if (!action.params.expression?.trim()) {
        warn('"condition" requires an expression')
      }
      // Recurse into then/else branches
      // T643.2: then may be undefined in old MongoDB documents — guard with ?.
      action.params.then?.forEach((a, i) =>
        validateAction(a, i, event, ctx, warnings),
      )
      action.params.else?.forEach((a, i) =>
        validateAction(a, i, event, ctx, warnings),
      )
      break
    }
    case 'loop': {
      if (action.params.mode === 'while' && !action.params.condition?.trim()) {
        warn('"loop" in while mode requires a condition expression')
      }
      // T643.2: body may be undefined in old MongoDB documents — guard with ?.
      action.params.body?.forEach((a, i) =>
        validateAction(a, i, event, ctx, warnings),
      )
      break
    }
    case 'call-sequence': {
      const { sequenceName } = action.params
      if (!sequenceName?.trim()) {
        warn('"call-sequence" requires a sequence name')
      } else if (
        ctx.sharedSequenceNames.length > 0 &&
        !ctx.sharedSequenceNames.includes(sequenceName)
      ) {
        warn(`"call-sequence" references unknown sequence "${sequenceName}"`)
      }
      break
    }
    default:
      break
  }
}

export function validateSequence(
  sequence: ActionSequence,
  ctx: ValidationContext,
): ValidationWarning[] {
  const warnings: ValidationWarning[] = []
  // T643.2: actions may be undefined in old MongoDB documents — guard with ?.
  sequence.actions?.forEach((action, index) =>
    validateAction(action, index, sequence.event, ctx, warnings),
  )
  return warnings
}

export function validateAllSequences(
  sequences: ActionSequence[],
  widgetIds: string[],
  sharedSequences: SharedActionSequence[],
): ValidationWarning[] {
  const ctx: ValidationContext = {
    widgetIds,
    sharedSequenceNames: sharedSequences.map((s) => s.name),
  }
  const warnings = sequences.flatMap((seq) => validateSequence(seq, ctx))

  // Detect circular dependencies among shared sequences (T201)
  const cycles = detectCycles(sharedSequences)
  for (const cycle of cycles) {
    warnings.push({
      message: `Circular dependency in shared sequences: ${cycle.path.join(' → ')}`,
      event: 'call-sequence',
      actionIndex: -1,
    })
  }

  return warnings
}
