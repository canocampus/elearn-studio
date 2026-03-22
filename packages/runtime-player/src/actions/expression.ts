/**
 * Safe expression evaluator — T021
 *
 * Evaluates simple boolean/arithmetic expressions used in ConditionAction and
 * LoopAction without using eval() or Function().
 *
 * Supported syntax:
 *   $varName              — read variable (string)
 *   $varName == "value"   — equality (string or number comparison)
 *   $varName != "value"
 *   $varName > 10
 *   $varName >= 10
 *   $varName < 10
 *   $varName <= 10
 *   true | false          — literals
 *   !$varName             — logical NOT
 *   $a == $b              — variable-to-variable comparison
 *
 * Returns a string result for set-variable expressions ($a), or a boolean
 * for condition/loop expressions.
 *
 * Anything that doesn't parse returns false (never throws) to avoid halting
 * the player on malformed expressions.
 */

type Variables = Map<string, string>

// ─── Token patterns ───────────────────────────────────────────────────────────

const COMPARISON_RE = /^\s*(!?)\s*(\$[a-zA-Z_]\w*|"[^"]*"|'[^']*'|[\d.]+|true|false)\s*(==|!=|>=|<=|>|<)?\s*(\$[a-zA-Z_]\w*|"[^"]*"|'[^']*'|[\d.]+|true|false)?\s*$/

function resolveToken(token: string, vars: Variables): string {
  if (token.startsWith('$')) {
    return vars.get(token.slice(1)) ?? ''
  }
  if ((token.startsWith('"') && token.endsWith('"')) ||
      (token.startsWith("'") && token.endsWith("'"))) {
    return token.slice(1, -1)
  }
  if (/^\d+(?:\.\d+)?$/.test(token)) return token
  if (token === 'true' || token === 'false') return token
  return '' // Reject unrecognized bareword tokens
}

function toNumber(s: string): number {
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}

/**
 * Evaluate an expression and return a boolean result.
 * Used for ConditionAction.params.expression and LoopAction.params.condition.
 */
export function evaluateCondition(expr: string, vars: Variables): boolean {
  const m = expr.match(COMPARISON_RE)
  if (!m) return false

  const [, negate, lhsTok, op, rhsTok] = m

  if (!op) {
    // Single token — truthy check
    const val = resolveToken(lhsTok, vars)
    const result = val !== '' && val !== '0' && val !== 'false'
    return negate ? !result : result
  }

  const lhs = resolveToken(lhsTok, vars)
  const rhs = resolveToken(rhsTok ?? '', vars)

  // Try numeric comparison first; fall back to string
  const lhsNum = parseFloat(lhs)
  const rhsNum = parseFloat(rhs)
  const useNumeric = !isNaN(lhsNum) && !isNaN(rhsNum)

  let result: boolean
  if (useNumeric) {
    switch (op) {
      case '==': result = lhsNum === rhsNum; break
      case '!=': result = lhsNum !== rhsNum; break
      case '>':  result = lhsNum >  rhsNum;  break
      case '>=': result = lhsNum >= rhsNum;  break
      case '<':  result = lhsNum <  rhsNum;  break
      case '<=': result = lhsNum <= rhsNum;  break
      default:   result = false
    }
  } else {
    switch (op) {
      case '==': result = lhs === rhs; break
      case '!=': result = lhs !== rhs; break
      case '>':  result = lhs >  rhs;  break
      case '>=': result = lhs >= rhs;  break
      case '<':  result = lhs <  rhs;  break
      case '<=': result = lhs <= rhs;  break
      default:   result = false
    }
  }

  return negate ? !result : result
}

/**
 * Evaluate a value expression and return a string result.
 * Used for SetVariableAction with valueType === 'expression'.
 *
 * Supports:
 *   $varName              → current variable value
 *   $a + $b               → numeric addition (returns string of number)
 *   $a - $b               → numeric subtraction
 *   $a * $b               → numeric multiplication
 *   $a / $b               → numeric division (safe: returns "0" on div by zero)
 *   42                    → numeric literal
 *   "hello"               → string literal
 */
const ARITHMETIC_RE = /^\s*(\$[a-zA-Z_]\w*|"[^"]*"|'[^']*'|[\d.]+)\s*([+\-*/])?\s*(\$[a-zA-Z_]\w*|"[^"]*"|'[^']*'|[\d.]+)?\s*$/

export function evaluateExpression(expr: string, vars: Variables): string {
  const m = expr.match(ARITHMETIC_RE)
  if (!m) return ''

  const [, lhsTok, op, rhsTok] = m
  const lhs = resolveToken(lhsTok, vars)

  if (!op) return lhs

  const rhs = resolveToken(rhsTok ?? '', vars)
  const lhsN = toNumber(lhs)
  const rhsN = toNumber(rhs)

  switch (op) {
    case '+': return String(lhsN + rhsN)
    case '-': return String(lhsN - rhsN)
    case '*': return String(lhsN * rhsN)
    case '/': return rhsN === 0 ? '0' : String(lhsN / rhsN)
    default:  return lhs
  }
}
