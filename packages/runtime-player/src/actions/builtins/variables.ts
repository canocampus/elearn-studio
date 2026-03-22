import type { SetVariableAction } from '../types'
import type { ExecutionContext } from '../context'
import { evaluateExpression } from '../expression'

// T021-06: valid variable names must start with a letter or _ followed by word chars
const VALID_VAR_NAME = /^[a-zA-Z_]\w*$/

export function executeSetVariable(
  action: SetVariableAction,
  ctx: ExecutionContext,
): void {
  const { name, value, valueType } = action.params
  if (!VALID_VAR_NAME.test(name)) {
    console.warn(`[executeSetVariable] Invalid variable name "${name}" — skipped`)
    return
  }
  const resolved =
    valueType === 'expression' ? evaluateExpression(value, ctx.variables) : value
  ctx.variables.set(name, resolved)
}
