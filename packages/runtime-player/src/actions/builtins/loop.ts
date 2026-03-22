import type { LoopAction } from '../types'
import type { ExecutionContext } from '../context'
import { evaluateCondition } from '../expression'

const DEFAULT_MAX_ITERATIONS = 1000

export async function executeLoop(
  action: LoopAction,
  ctx: ExecutionContext,
  executeSequence: (actions: unknown[], ctx: ExecutionContext) => Promise<void>,
): Promise<void> {
  const { mode, count, condition, body, maxIterations } = action.params
  const cap = maxIterations ?? DEFAULT_MAX_ITERATIONS

  if (mode === 'count') {
    const iterations = Math.min(count ?? 0, cap)
    for (let i = 0; i < iterations; i++) {
      await executeSequence(body, ctx)
    }
  } else {
    // while
    let iterations = 0
    while (
      iterations < cap &&
      evaluateCondition(condition ?? 'false', ctx.variables)
    ) {
      await executeSequence(body, ctx)
      iterations++
    }
  }
}
