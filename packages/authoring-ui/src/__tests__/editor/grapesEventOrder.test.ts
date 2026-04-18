/**
 * TD-006 audit + regression — GrapesJS event order: storage vs component lifecycle.
 *
 * Empirical proof, by structural inspection of the compiled grapesjs source,
 * that `storage:end:load` fires BEFORE `loadData()` (and therefore BEFORE the
 * cascade of `component:add` events that loadData triggers when reconstructing
 * the slide). This is the timing constraint that makes `_isEditorLoading` (a
 * synchronous module-level flag) the correct gate, and makes
 * `storage:end:load` an UNSAFE replacement.
 *
 * Why structural inspection instead of a live `grapesjs.init()` test:
 *   GrapesJS uses iframe-based canvases and DOM measurement APIs that jsdom
 *   does not implement; `grapesjs.init()` hangs under vitest's jsdom env.
 *   Reading the compiled source is the next-best signal — it IS the runtime
 *   behaviour, and it survives library upgrades better than a flaky e2e probe
 *   (the test will fail loudly if a future grapesjs version inverts the order).
 *
 * If grapesjs ever changes this ordering — e.g. firing `storage:end:load` AFTER
 * `loadData()` completes — these assertions will fail and we should revisit TD-006.
 *
 * See:
 *   - decisions/2026-04-17-editor-loading-flag.md (GAP-06b/c)
 *   - docs/issues/issues-TD-006.md (audit summary)
 *   - packages/authoring-ui/src/editor/initEditor.ts (the gate consumer)
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

let grapesSource: string

beforeAll(() => {
  // grapesjs is a workspace dependency of authoring-ui. The bundled .mjs sits
  // under node_modules/.pnpm/grapesjs@<version>/node_modules/grapesjs/dist/.
  // We resolve via require.resolve-equivalent to stay version-agnostic.
  const grapesjsPkg = require.resolve('grapesjs/package.json', { paths: [resolve(__dirname, '../../..')] })
  const distPath = resolve(dirname(grapesjsPkg), 'dist', 'grapes.mjs')
  grapesSource = readFileSync(distPath, 'utf8')
})

describe('TD-006 audit — grapesjs source structural assertions', () => {
  it('grapes.mjs source loads (sanity check)', () => {
    expect(grapesSource.length).toBeGreaterThan(10_000)
  })

  it('EditorModel.prototype.load awaits Storage.load() BEFORE calling loadData()', () => {
    // Locate the function body
    const fnStart = grapesSource.indexOf('EditorModel.prototype.load = function')
    expect(fnStart).toBeGreaterThan(-1)

    // Look at the next ~80 lines / ~3000 chars
    const fnBody = grapesSource.slice(fnStart, fnStart + 3000)

    const storageLoadIdx = fnBody.indexOf('this.Storage.load(options)')
    const loadDataIdx = fnBody.indexOf('this.loadData(result)')

    expect(storageLoadIdx).toBeGreaterThan(-1)
    expect(loadDataIdx).toBeGreaterThan(-1)
    // Storage.load() comes first; result is awaited; THEN loadData(result) runs.
    expect(storageLoadIdx).toBeLessThan(loadDataIdx)
  })

  it('StorageManager.onEnd triggers storage:end:load (used to confirm endLoad fires inside Storage.load completion)', () => {
    // onEnd is called when StorageManager.load() resolves the underlying storage
    // promise — BEFORE returning to EditorModel.load.
    const onEndStart = grapesSource.indexOf('StorageManager.prototype.onEnd = function')
    expect(onEndStart).toBeGreaterThan(-1)
    const onEndBody = grapesSource.slice(onEndStart, onEndStart + 600)

    // Verify the function references the endLoad event type for 'load' actions.
    expect(onEndBody).toContain("type === 'load'")
    expect(onEndBody).toContain('endLoad')
  })

  it("StorageEvents['endLoad'] === 'storage:end:load' (event name has not been renamed)", () => {
    expect(grapesSource).toContain(`StorageEvents["endLoad"] = "storage:end:load"`)
  })

  it('REGRESSION GUARD — gating on storage:end:load would lift the gate too early', () => {
    // This assertion documents the bug pattern in code: storage:end:load fires
    // INSIDE Storage.load() (via onEnd), which is awaited and THEN loadData(result)
    // runs. So storage:end:load → component:add ordering is guaranteed by the
    // structure: clearing the gate on storage:end:load lifts it before the
    // component:add cascade arrives. The flag _isEditorLoading is set/cleared
    // by EditorCanvas around editor.load() to span both phases.
    const fnStart = grapesSource.indexOf('EditorModel.prototype.load = function')
    const fnBody = grapesSource.slice(fnStart, fnStart + 3000)

    // The whole point: yield to Storage.load BEFORE loadData. If a future
    // grapesjs ever delays endLoad until after loadData, this proof breaks
    // and TD-006 can be revisited.
    expect(fnBody).toMatch(/yield.*?Storage\.load[\s\S]*?loadData\(result\)/m)
  })
})
