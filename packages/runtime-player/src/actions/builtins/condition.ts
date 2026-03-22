import type { ConditionAction } from '../types'
import type { ExecutionContext } from '../context'
import { evaluateCondition } from '../expression'

/**
 * executeCondition is intentionally NOT async here because it delegates to
 * ActionExecutor.executeSequence which is already async.  The executor's
 * dispatch method awaits this function's return value.
 */
export async function executeCondition(
  action: ConditionAction,
  ctx: ExecutionContext,
  executeSequence: (actions: unknown[], ctx: ExecutionContext) => Promise<void>,
): Promise<void> {
  const { expression, then: thenActions, else: elseActions } = action.params
  const result = evaluateCondition(expression, ctx.variables)
  if (result) {
    await executeSequence(thenActions, ctx)
  } else if (elseActions) {
    await executeSequence(elseActions, ctx)
  }
}
