/**
 * cycleDetection — T201
 *
 * Detects circular dependencies among shared action sequences.
 * A cycle occurs when sequence A calls B (directly or through nested
 * condition/loop), and B (transitively) calls back to A.
 *
 * Algorithm: DFS over the call-sequence dependency graph.
 * When a node already in the current recursion stack is encountered,
 * a cycle is reported.
 */

import type { Action, SharedActionSequence } from '../types/actions'

export interface CycleInfo {
  /**
   * Sequence names forming the cycle, starting and ending at the repeated name.
   * Example: ['A', 'B', 'A'] for A→B→A, ['A', 'A'] for a self-loop.
   */
  path: string[]
}

/**
 * Recursively extracts all call-sequence target names from an action list,
 * traversing into condition.then / condition.else / loop.body.
 */
function extractCallTargets(actions: Action[]): string[] {
  const targets: string[] = []
  for (const action of actions) {
    if (action.type === 'call-sequence') {
      const name = action.params.sequenceName?.trim()
      if (name) targets.push(name)
    } else if (action.type === 'condition') {
      targets.push(...extractCallTargets(action.params.then))
      if (action.params.else) targets.push(...extractCallTargets(action.params.else))
    } else if (action.type === 'loop') {
      targets.push(...extractCallTargets(action.params.body))
    }
  }
  return targets
}

/**
 * Builds a directed graph: sequence name → list of sequence names it calls.
 * Only sequences present in sharedSequences appear as graph nodes.
 */
function buildDependencyGraph(
  sharedSequences: SharedActionSequence[],
): Map<string, string[]> {
  const graph = new Map<string, string[]>()
  for (const seq of sharedSequences) {
    graph.set(seq.name, extractCallTargets(seq.actions))
  }
  return graph
}

/**
 * Detects cycles in shared sequence dependencies via DFS.
 * Returns one CycleInfo per unique back-edge found.
 */
export function detectCycles(sharedSequences: SharedActionSequence[]): CycleInfo[] {
  const graph = buildDependencyGraph(sharedSequences)
  const cycles: CycleInfo[] = []

  const visited = new Set<string>()
  const inStack = new Set<string>()
  const recStack: string[] = []

  function dfs(node: string): void {
    visited.add(node)
    inStack.add(node)
    recStack.push(node)

    const neighbors = graph.get(node) ?? []
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        // Node hasn't been explored — only recurse if it's a known sequence
        if (graph.has(neighbor)) {
          dfs(neighbor)
        }
      } else if (inStack.has(neighbor)) {
        // Back-edge found: extract cycle path from recStack
        const cycleStart = recStack.indexOf(neighbor)
        const cyclePath = [...recStack.slice(cycleStart), neighbor]
        cycles.push({ path: cyclePath })
      }
    }

    recStack.pop()
    inStack.delete(node)
  }

  for (const seq of sharedSequences) {
    if (!visited.has(seq.name)) {
      dfs(seq.name)
    }
  }

  return cycles
}
