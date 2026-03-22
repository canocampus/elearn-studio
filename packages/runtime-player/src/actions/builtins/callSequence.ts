/**
 * call-sequence builtin — T020.17
 *
 * Looks up a named SharedActionSequence from ExecutionContext.sharedSequences
 * and runs its actions via the executor's run() method (passed as a callback
 * to avoid a circular import with ActionExecutor).
 */

import type { CallSequenceAction } from '../types'
import type { ExecutionContext } from '../context'
import type { Action } from '../types'

type RunFn = (actions: Action[]) => Promise<void>

export async function executeCallSequence(
  action: CallSequenceAction,
  ctx: ExecutionContext,
  run: RunFn,
): Promise<void> {
  const { sequenceName } = action.params
  const shared = ctx.sharedSequences.find((s) => s.name === sequenceName)
  if (!shared) {
    console.warn(`[call-sequence] No shared sequence found with name "${sequenceName}"`)
    return
  }
  await run(shared.actions)
}
