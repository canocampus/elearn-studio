#!/usr/bin/env node
/**
 * run-crop.cjs — cross-platform launcher for `crop-screenshots.py` (TD-013.6).
 *
 * Picks the first Python interpreter that can import Pillow, runs the crop
 * tool with it, and propagates the tool's exit code verbatim. Needed because
 * on Windows dev boxes plain `python` may resolve to a project venv without
 * Pillow while the system launcher (`py -3`) has it — and on Linux CI the
 * launcher is `python3`. Probing for Pillow (instead of just for the
 * interpreter) avoids the double-run-on-real-failure problem of a shell
 * `a || b` fallback chain.
 */
const { spawnSync } = require('node:child_process')
const path = require('node:path')

const script = path.join(__dirname, 'crop-screenshots.py')
const candidates =
  process.platform === 'win32'
    ? [['py', ['-3']], ['python', []], ['python3', []]]
    : [['python3', []], ['python', []]]

for (const [cmd, args] of candidates) {
  const probe = spawnSync(cmd, [...args, '-c', 'import PIL'], { stdio: 'ignore' })
  if (probe.status === 0) {
    const run = spawnSync(cmd, [...args, script], { stdio: 'inherit' })
    process.exit(run.status ?? 1)
  }
}
console.error('[run-crop] no Python interpreter with Pillow found (pip install Pillow)')
process.exit(2)
