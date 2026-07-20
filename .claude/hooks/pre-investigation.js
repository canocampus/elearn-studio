/**
 * Pre-investigation hook: refresh the Graphify architecture graph before any
 * TXX.N "Investigate" task (CLAUDE.md §Hooks) so /audit-structural and graph
 * queries run against current code, not a stale snapshot.
 *
 * Interpreter resolution (2026-07-20 fix): the original `python3` call always
 * failed on Windows — it resolves to the WindowsApps store stub, which exits
 * with "Permission denied", so the graph silently never refreshed (it sat at
 * its 2026-04-18 build for three months). Probe real interpreters instead,
 * preferring the project venv where graphifyy is installed.
 */
const { execSync } = require('child_process');
const path = require('path');

console.log('🔍 Running Pre-Investigation Hook...');

const candidates = [
  path.join(__dirname, '..', '..', '.venv', 'Scripts', 'python.exe'), // project venv (Windows)
  path.join(__dirname, '..', '..', '.venv', 'bin', 'python'),         // project venv (POSIX)
  'python',
  'py -3',
];

function findPython() {
  for (const cmd of candidates) {
    try {
      execSync(`"${cmd}" -c "import graphify"`, { stdio: 'ignore', shell: true, timeout: 30_000 });
      return cmd;
    } catch {
      /* try next candidate */
    }
  }
  return null;
}

const python = findPython();
if (!python) {
  console.warn('⚠️ No interpreter with graphify found (.venv, python, py -3). Run: python -m pip install graphifyy');
  process.exit(0);
}

try {
  execSync(
    `"${python}" -c "from graphify.watch import _rebuild_code; from pathlib import Path; import sys; sys.exit(0 if _rebuild_code(Path('.')) else 1)"`,
    { stdio: 'inherit', shell: true, timeout: 300_000 },
  );
  console.log('✅ Architecture graph ready.');
} catch {
  console.warn('⚠️ Graphify rebuild failed — investigate before trusting /audit-structural results.');
}

process.exit(0);
