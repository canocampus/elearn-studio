/**
 * Unit tests for runExport — TD-001.
 *
 * Verifies the shared export pipeline runs its steps in the correct order,
 * dispatches to the format-specific packer, cleans up tmpDir on error, and
 * surfaces errors from each pipeline step.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { Readable } from 'stream'
import type { CourseDoc } from '@elearn-studio/shared-types'

// ---------------------------------------------------------------------------
// Mock the external dependencies BEFORE importing the module under test.
// ---------------------------------------------------------------------------

const { mockPackSCORM12, mockPackSCORM2004, mockPackAICC, mockGetObject } = vi.hoisted(() => ({
  mockPackSCORM12:   vi.fn(),
  mockPackSCORM2004: vi.fn(),
  mockPackAICC:      vi.fn(),
  mockGetObject:     vi.fn(),
}))

vi.mock('@elearn-studio/scorm-packager', () => ({
  packSCORM12:   mockPackSCORM12,
  packSCORM2004: mockPackSCORM2004,
  packAICC:      mockPackAICC,
}))

vi.mock('../../storage/s3', () => ({
  getObject:  mockGetObject,
  putObject:  vi.fn(),
  statObject: vi.fn(),
  s3Client:   {},
  BUCKET:     'elearn-assets',
  initStorage: vi.fn().mockResolvedValue(undefined),
}))

// ---------------------------------------------------------------------------
// Import under test AFTER mocks are registered.
// ---------------------------------------------------------------------------

import { runExport, collectAssetSrcs, rewriteAssetSrcs, downloadAssets } from '../../lib/export/runExport'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ASSET_A = 'aaaaaaaa-0000-4000-8000-000000000000.png'
const ASSET_B = 'bbbbbbbb-0000-4000-8000-000000000000.mp3'

function makeCourse(overrides: Partial<CourseDoc> = {}): CourseDoc {
  return {
    _id: '507f1f77bcf86cd799439011',
    title: 'Test Course',
    slides: [{
      id: 'slide-1',
      title: 'Slide 1',
      widgets: [
        { id: 'w1', type: 'image', bounds: { x: 0, y: 0, width: 100, height: 100 }, properties: { src: `/assets/${ASSET_A}` } },
        { id: 'w2', type: 'audio-narration', bounds: { x: 0, y: 0, width: 100, height: 100 }, properties: { src: `/assets/${ASSET_B}` } },
      ],
    }],
    ...overrides,
  } as CourseDoc
}

/** Stream that resolves to an empty buffer — enough for pipeline to complete. */
function makeEmptyReadStream(): Readable {
  return Readable.from(Buffer.from([]))
}

/** Returns the absolute paths of any elearn-* temp dirs currently on disk. */
function listElearnTmpDirs(): string[] {
  const entries = fs.readdirSync(os.tmpdir(), { withFileTypes: true })
  return entries
    .filter(e => e.isDirectory() && /^elearn-(scorm|scorm2004|aicc)-/.test(e.name))
    .map(e => path.join(os.tmpdir(), e.name))
}

// ---------------------------------------------------------------------------
// Tests — core pipeline + format dispatch
// ---------------------------------------------------------------------------

describe('TD-001 — runExport pipeline', () => {
  // Snapshot of pre-existing tmpDirs so afterEach only removes ones created by the test.
  let preExistingTmpDirs: Set<string>

  beforeEach(() => {
    vi.clearAllMocks()
    preExistingTmpDirs = new Set(listElearnTmpDirs())

    // Default: packers resolve with a fake zip path
    mockPackSCORM12.mockImplementation(async (_course, tmpDir) => path.join(tmpDir as string, 'out.zip'))
    mockPackSCORM2004.mockImplementation(async (_course, tmpDir) => path.join(tmpDir as string, 'out.zip'))
    mockPackAICC.mockImplementation(async (_course, tmpDir) => path.join(tmpDir as string, 'out.zip'))

    // Default: getObject returns an empty stream for both assets
    mockGetObject.mockImplementation(async () => ({ stream: makeEmptyReadStream() }))
  })

  afterEach(() => {
    // Clean up any tmpDirs that runExport left for the caller (success path).
    for (const dir of listElearnTmpDirs()) {
      if (!preExistingTmpDirs.has(dir) && fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true })
      }
    }
  })

  // ── TD-001.1 — dispatches to correct packer per format ──

  it('TD-001.1: format=scorm12 dispatches to packSCORM12 only', async () => {
    await runExport(makeCourse(), 'scorm12')
    expect(mockPackSCORM12).toHaveBeenCalledOnce()
    expect(mockPackSCORM2004).not.toHaveBeenCalled()
    expect(mockPackAICC).not.toHaveBeenCalled()
  })

  it('TD-001.1b: format=scorm2004 dispatches to packSCORM2004 only', async () => {
    await runExport(makeCourse(), 'scorm2004')
    expect(mockPackSCORM2004).toHaveBeenCalledOnce()
    expect(mockPackSCORM12).not.toHaveBeenCalled()
    expect(mockPackAICC).not.toHaveBeenCalled()
  })

  it('TD-001.1c: format=aicc dispatches to packAICC only', async () => {
    await runExport(makeCourse(), 'aicc')
    expect(mockPackAICC).toHaveBeenCalledOnce()
    expect(mockPackSCORM12).not.toHaveBeenCalled()
    expect(mockPackSCORM2004).not.toHaveBeenCalled()
  })

  // ── TD-001.2 — pipeline is called in the correct order ──

  it('TD-001.2: downloads assets before rewriting srcs before packing', async () => {
    const callOrder: string[] = []
    mockGetObject.mockImplementation(async (objectName: string) => {
      callOrder.push(`getObject:${objectName}`)
      return { stream: makeEmptyReadStream() }
    })
    mockPackSCORM12.mockImplementation(async (course, tmpDir) => {
      callOrder.push('pack')
      // The course passed to the packer MUST have rewritten (relative) asset srcs
      const cast = course as unknown as { slides: Array<{ widgets: Array<{ properties?: { src?: string } }> }> }
      expect(cast.slides[0].widgets[0].properties?.src).toBe(`assets/${ASSET_A}`)
      expect(cast.slides[0].widgets[1].properties?.src).toBe(`assets/${ASSET_B}`)
      return path.join(tmpDir as string, 'out.zip')
    })

    await runExport(makeCourse(), 'scorm12')

    // Two getObject calls (one per asset) precede the pack call
    expect(callOrder[0]).toBe(`getObject:${ASSET_A}`)
    expect(callOrder[1]).toBe(`getObject:${ASSET_B}`)
    expect(callOrder[2]).toBe('pack')
  })

  // ── TD-001.3 — result shape ──

  it('TD-001.3: returns zipPath, tmpDir, fileName, assetCount', async () => {
    const result = await runExport(makeCourse({ title: 'My Course!' }), 'scorm12')

    expect(result.zipPath).toContain('out.zip')
    expect(result.tmpDir).toContain('elearn-scorm-')
    expect(result.fileName).toBe('My_Course__scorm12.zip')  // unsafe chars → underscores
    expect(result.assetCount).toBe(2)  // two successfully downloaded assets
  })

  it('TD-001.3b: fileName uses format-specific suffix', async () => {
    const r12 = await runExport(makeCourse(), 'scorm12')
    const r2004 = await runExport(makeCourse(), 'scorm2004')
    const rAicc = await runExport(makeCourse(), 'aicc')
    expect(r12.fileName.endsWith('_scorm12.zip')).toBe(true)
    expect(r2004.fileName.endsWith('_scorm2004.zip')).toBe(true)
    expect(rAicc.fileName.endsWith('_aicc.zip')).toBe(true)
  })

  it('TD-001.3c: fileName falls back to "course" when title is empty/missing', async () => {
    const result = await runExport(makeCourse({ title: '' }), 'scorm12')
    expect(result.fileName).toBe('course_scorm12.zip')
  })

  // ── TD-001.4 — playerPath is forwarded when provided ──

  it('TD-001.4: forwards playerPath to the packer when set', async () => {
    await runExport(makeCourse(), 'scorm12', { playerPath: '/opt/player.js' })
    expect(mockPackSCORM12).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('elearn-scorm-'),
      expect.objectContaining({ playerPath: '/opt/player.js' }),
    )
  })

  it('TD-001.4b: omits playerPath when not provided (scorm-packager falls back to default)', async () => {
    await runExport(makeCourse(), 'scorm12')
    const [, , opts] = mockPackSCORM12.mock.calls[0]
    expect(opts).not.toHaveProperty('playerPath')
    expect(opts).toHaveProperty('assetPaths')
  })

  // ── TD-001.5 — tmpDir cleanup on error ──

  it('TD-001.5: cleans up tmpDir and rethrows when packer fails', async () => {
    const error = new Error('boom: zip encoder failed')
    mockPackSCORM12.mockRejectedValue(error)

    await expect(runExport(makeCourse(), 'scorm12')).rejects.toThrow('boom: zip encoder failed')

    // No new elearn-* tmpDirs should remain on disk
    const leaked = listElearnTmpDirs().filter(d => !preExistingTmpDirs.has(d))
    expect(leaked).toEqual([])
  })

  it('TD-001.5b: cleans up tmpDir and rethrows when packer fails during download phase', async () => {
    // The pipeline inside downloadAssets catches per-asset errors silently (design),
    // so we exercise the outer error path by failing the packer instead.
    mockPackSCORM12.mockRejectedValue(new Error('pack failed'))

    await expect(runExport(makeCourse(), 'scorm12')).rejects.toThrow('pack failed')
    const leaked = listElearnTmpDirs().filter(d => !preExistingTmpDirs.has(d))
    expect(leaked).toEqual([])
  })

  // ── TD-001.6 — missing assets are skipped, not fatal ──

  it('TD-001.6: getObject rejection for one asset still lets the export complete', async () => {
    mockGetObject
      .mockResolvedValueOnce({ stream: makeEmptyReadStream() })     // asset A ok
      .mockRejectedValueOnce(new Error('not found: asset B'))        // asset B missing

    const result = await runExport(makeCourse(), 'scorm12')
    expect(mockPackSCORM12).toHaveBeenCalledOnce()
    expect(result.assetCount).toBe(1)  // only A was successfully downloaded
  })

  // ── TD-001.7 — tmpDir prefix reveals the format (for orphan-debugging) ──

  it('TD-001.7: tmpDir prefix is format-specific', async () => {
    const r12 = await runExport(makeCourse(), 'scorm12')
    const r2004 = await runExport(makeCourse(), 'scorm2004')
    const rAicc = await runExport(makeCourse(), 'aicc')

    expect(path.basename(r12.tmpDir)).toMatch(/^elearn-scorm-/)
    expect(path.basename(r2004.tmpDir)).toMatch(/^elearn-scorm2004-/)
    expect(path.basename(rAicc.tmpDir)).toMatch(/^elearn-aicc-/)
  })
})

// ---------------------------------------------------------------------------
// Tests — asset pipeline helpers (directly exercised for regression coverage)
// ---------------------------------------------------------------------------

describe('TD-001 — asset pipeline helpers', () => {
  it('collectAssetSrcs: extracts UUID assets only, dedupes, builds zipPath map', () => {
    const slides = [{
      widgets: [
        { properties: { src: `/assets/${ASSET_A}` } },
        { properties: { src: `/assets/${ASSET_A}` } }, // duplicate → deduped
        { properties: { src: 'https://example.com/foo.png' } }, // non-matching → ignored
        { properties: { src: `/assets/${ASSET_B}` } },
        { properties: {} }, // no src → ignored
      ],
    }]
    const map = collectAssetSrcs(slides as Parameters<typeof collectAssetSrcs>[0])
    expect(map.size).toBe(2)
    expect(map.get(ASSET_A)).toBe(`assets/${ASSET_A}`)
    expect(map.get(ASSET_B)).toBe(`assets/${ASSET_B}`)
  })

  it('rewriteAssetSrcs: replaces /assets/<uuid> with assets/<uuid> without mutating input', () => {
    const original = {
      title: 'Test',
      slides: [{ widgets: [{ properties: { src: `/assets/${ASSET_A}`, alt: 'keep' } }] }],
    }
    const rewritten = rewriteAssetSrcs(original)
    expect(rewritten).not.toBe(original)
    expect(original.slides[0].widgets[0].properties.src).toBe(`/assets/${ASSET_A}`) // unchanged
    expect(rewritten.slides[0].widgets[0].properties.src).toBe(`assets/${ASSET_A}`)
    expect(rewritten.slides[0].widgets[0].properties.alt).toBe('keep')
  })

  it('rewriteAssetSrcs: leaves non-matching src fields unchanged', () => {
    const course = {
      slides: [{ widgets: [
        { properties: { src: 'https://cdn.example.com/foo.png' } },
        { properties: { src: '' } },
      ] }],
    }
    const r = rewriteAssetSrcs(course)
    expect(r.slides[0].widgets[0].properties.src).toBe('https://cdn.example.com/foo.png')
    expect(r.slides[0].widgets[1].properties.src).toBe('')
  })

  it('downloadAssets: skips missing assets and returns only successful downloads', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'runexport-test-'))
    try {
      mockGetObject.mockReset()
      mockGetObject
        .mockResolvedValueOnce({ stream: makeEmptyReadStream() })
        .mockRejectedValueOnce(new Error('not found'))
      const map = new Map([
        [ASSET_A, `assets/${ASSET_A}`],
        [ASSET_B, `assets/${ASSET_B}`],
      ])
      const result = await downloadAssets(map, dir)
      expect(result.length).toBe(1)
      expect(result[0].zipPath).toBe(`assets/${ASSET_A}`)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})
