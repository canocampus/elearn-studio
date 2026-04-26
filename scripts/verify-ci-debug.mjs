#!/usr/bin/env node
// scripts/verify-ci-debug.mjs
//
// Diagnostic wrapper around the `pnpm verify:*` scripts defined in root
// package.json. Mirrors the canonical CI pipeline locally with extra
// observability:
//   - Environment banner (Node, pnpm, OS, branch, dirty working dir)
//   - Per-step timing
//   - Optional fail-soft mode (run all steps even after failure)
//   - Optional quick mode (skip heavy steps)
//   - Optional subset / resume modes
//
// Source of truth for the pipeline is `pnpm verify:ci` (in package.json).
// This wrapper does NOT redefine the pipeline — it invokes the same scripts.
// Adding/removing/reordering steps must happen in package.json AND in the
// STEPS array below.
//
// Usage:
//   pnpm verify:ci:debug              # default: stop on first failure
//   pnpm verify:ci:debug --fail-soft  # run all steps, report all failures
//   pnpm verify:ci:debug --quick      # skip heavy steps (test, gen, build)
//   pnpm verify:ci:debug --only=lint,types
//   pnpm verify:ci:debug --from=test  # resume from this step
//   pnpm verify:ci:debug --no-banner

import { spawn, execSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { platform, release } from 'node:os';

const STEPS = [
  { name: 'install', cmd: 'pnpm verify:install', heavy: false, why: 'pnpm install --frozen-lockfile (lockfile parity)' },
  { name: 'lint',    cmd: 'pnpm verify:lint',    heavy: false, why: 'pnpm lint (eslint root)' },
  { name: 'types',   cmd: 'pnpm verify:types',   heavy: false, why: 'shared-types build (types floor for consumers)' },
  { name: 'test',    cmd: 'pnpm verify:test',    heavy: true,  why: 'unit + integration tests (excluding e2e)' },
  { name: 'gen',     cmd: 'pnpm verify:gen',     heavy: true,  why: 'authoring-ui gen:api-client (regen openapi types)' },
  { name: 'build',   cmd: 'pnpm verify:build',   heavy: true,  why: 'pnpm -r run build (canonical typecheck floor + vite emit)' },
];

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  printHelp();
  process.exit(0);
}

const flags = {
  failSoft: args.includes('--fail-soft') || args.includes('-f'),
  quick:    args.includes('--quick')     || args.includes('-q'),
  noBanner: args.includes('--no-banner'),
  only:     parseListFlag(args, '--only'),
  from:     parseValueFlag(args, '--from'),
};

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(3);
});

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const stepsToRun = selectSteps(STEPS, flags);
  if (stepsToRun.length === 0) {
    console.error('No steps selected — check --only / --from / --quick filters.');
    process.exit(2);
  }

  if (!flags.noBanner) printBanner();

  const results = [];
  let aborted = false;

  for (const step of stepsToRun) {
    const result = await runStep(step);
    results.push(result);
    if (!result.ok && !flags.failSoft) {
      console.log(`\n[verify:ci:debug] Aborting (fail-fast). Use --fail-soft to continue past failures.`);
      aborted = true;
      // Mark remaining as skipped
      const idx = stepsToRun.indexOf(step);
      for (const remaining of stepsToRun.slice(idx + 1)) {
        results.push({ step: remaining.name, ok: false, code: null, ms: 0, skipped: true });
      }
      break;
    }
  }

  printSummary(results, aborted);
  const anyFailed = results.some((r) => !r.ok && !r.skipped);
  process.exit(anyFailed ? 1 : 0);
}

// ─────────────────────────────────────────────────────────────────────────────

function parseListFlag(args, name) {
  const arg = args.find((a) => a.startsWith(`${name}=`));
  return arg ? arg.slice(name.length + 1).split(',').map((s) => s.trim()).filter(Boolean) : null;
}

function parseValueFlag(args, name) {
  const arg = args.find((a) => a.startsWith(`${name}=`));
  return arg ? arg.slice(name.length + 1).trim() : null;
}

function selectSteps(steps, flags) {
  let result = steps;
  if (flags.only) {
    const unknown = flags.only.filter((n) => !steps.some((s) => s.name === n));
    if (unknown.length) {
      console.error(`Unknown step(s) in --only: ${unknown.join(', ')}`);
      console.error(`Valid steps: ${steps.map((s) => s.name).join(', ')}`);
      process.exit(2);
    }
    result = result.filter((s) => flags.only.includes(s.name));
  }
  if (flags.from) {
    const idx = result.findIndex((s) => s.name === flags.from);
    if (idx === -1) {
      console.error(`Unknown step for --from: ${flags.from}`);
      console.error(`Valid steps: ${result.map((s) => s.name).join(', ')}`);
      process.exit(2);
    }
    result = result.slice(idx);
  }
  if (flags.quick) result = result.filter((s) => !s.heavy);
  return result;
}

function safeExec(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

function printBanner() {
  const node = process.version;
  const pnpm = safeExec('pnpm --version') || 'unknown';
  const os = `${platform()} ${release()}`;
  const branch = safeExec('git rev-parse --abbrev-ref HEAD') || 'unknown';
  const dirtyOutput = safeExec('git status --porcelain') || '';
  const dirtyCount = dirtyOutput ? dirtyOutput.split('\n').filter(Boolean).length : 0;
  const dirty = dirtyCount > 0 ? `dirty (${dirtyCount} files)` : 'clean';

  console.log('═'.repeat(70));
  console.log('verify:ci:debug — diagnostic wrapper around pnpm verify:ci');
  console.log(`  Node:    ${node}    pnpm: ${pnpm}    OS: ${os}`);
  console.log(`  Branch:  ${branch}    Working dir: ${dirty}`);
  console.log(`  Flags:   ${formatFlags(flags)}`);
  console.log('═'.repeat(70));
}

function formatFlags(flags) {
  const parts = [];
  if (flags.failSoft) parts.push('fail-soft');
  if (flags.quick) parts.push('quick');
  if (flags.only) parts.push(`only=${flags.only.join(',')}`);
  if (flags.from) parts.push(`from=${flags.from}`);
  return parts.length ? parts.join(' ') : '(default — fail-fast, all steps)';
}

function runStep(step) {
  return new Promise((resolve) => {
    const header = `── [${step.name}] ${step.cmd} `;
    const padLen = Math.max(0, 70 - header.length);
    console.log(`\n${header}${'─'.repeat(padLen)}`);
    const t0 = performance.now();
    const child = spawn(step.cmd, { shell: true, stdio: 'inherit' });
    child.on('close', (code) => {
      const ms = Math.round(performance.now() - t0);
      const ok = code === 0;
      console.log(`── [${step.name}] ${ok ? 'OK' : `FAILED (exit ${code})`} in ${formatMs(ms)}`);
      resolve({ step: step.name, ok, code, ms });
    });
    child.on('error', (err) => {
      const ms = Math.round(performance.now() - t0);
      console.log(`── [${step.name}] ERROR: ${err.message}`);
      resolve({ step: step.name, ok: false, code: -1, ms, error: err.message });
    });
  });
}

function formatMs(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function printSummary(results, aborted) {
  console.log('\n' + '═'.repeat(70));
  console.log('Summary' + (aborted ? ' (aborted on first failure — use --fail-soft to see all)' : ''));
  console.log('─'.repeat(70));
  for (const r of results) {
    let status;
    if (r.skipped) status = '⊘ SKIP';
    else if (r.ok) status = '✓ OK  ';
    else status = '✗ FAIL';
    const codeStr = r.skipped ? '   -' : `${r.code ?? '-'}`.padStart(4);
    console.log(`  ${status}  ${r.step.padEnd(10)} ${formatMs(r.ms).padStart(8)}  exit=${codeStr}`);
  }
  const failed = results.filter((r) => !r.ok && !r.skipped);
  console.log('─'.repeat(70));
  if (failed.length === 0) {
    const ran = results.filter((r) => !r.skipped).length;
    console.log(`All ${ran} step(s) passed.`);
  } else {
    console.log(`${failed.length}/${results.length} step(s) failed: ${failed.map((r) => r.step).join(', ')}`);
  }
  console.log('═'.repeat(70));
}

function printHelp() {
  console.log(`
Usage: pnpm verify:ci:debug [options]

Options:
  -f, --fail-soft     Run all steps even after a failure; report all at end
  -q, --quick         Skip heavy steps (test, gen, build) — fast iteration
      --only=<list>   Run only the listed steps (comma-separated)
      --from=<step>   Resume from this step (skip earlier ones)
      --no-banner     Suppress environment banner
  -h, --help          Show this help

Steps (in order):
${STEPS.map((s) => `  ${s.name.padEnd(8)} ${s.heavy ? '[heavy]' : '       '} ${s.why}`).join('\n')}

The pipeline is defined in package.json (verify:install ... verify:build).
This wrapper invokes those scripts; it does not redefine the pipeline.
`);
}
