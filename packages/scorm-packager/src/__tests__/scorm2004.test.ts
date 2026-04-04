/**
 * Unit tests for T041 — SCORM 2004 4th Edition packager
 * (packSCORM2004, buildManifest2004)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import AdmZip from 'adm-zip'
import { packSCORM2004, type CourseDoc } from '../index'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

let tempDir: string
let fakePlayerPath: string

beforeAll(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scorm2004-test-'))
  fakePlayerPath = path.join(tempDir, 'player.js')
  fs.writeFileSync(fakePlayerPath, '// fake player bundle\nvar ELearnPlayer = {};')
})

afterAll(() => {
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
})

function makeCourse(overrides: Partial<CourseDoc> = {}): CourseDoc {
  return {
    _id: 'course-2004',
    title: 'SCORM 2004 Course',
    slides: [{ id: 's1', title: 'Slide 1', widgets: [] }],
    settings: { width: 1024, height: 768, passingScore: 75 },
    metadata: { identifier: 'TEST_2004', version: '1.0', masteryScore: 75 },
    ...overrides,
  }
}

// ─── packSCORM2004 — error handling ───────────────────────────────────────────

describe('packSCORM2004 — error handling', () => {
  it('throws when playerPath does not exist', async () => {
    const course = makeCourse()
    const nonExistent = path.join(tempDir, 'no-player.js')
    await expect(
      packSCORM2004(course, path.join(tempDir, 'err-out'), { playerPath: nonExistent }),
    ).rejects.toThrow(/Runtime player bundle not found/)
  })

  it('creates outputDir when it does not exist', async () => {
    const outDir = path.join(tempDir, 'new-2004-dir')
    expect(fs.existsSync(outDir)).toBe(false)
    await packSCORM2004(makeCourse(), outDir, { playerPath: fakePlayerPath })
    expect(fs.existsSync(outDir)).toBe(true)
  })
})

// ─── packSCORM2004 — output naming ────────────────────────────────────────────

describe('packSCORM2004 — output naming', () => {
  it('returns path ending in <safeTitle>_scorm2004.zip (case-insensitive)', async () => {
    const course = makeCourse({ title: 'My 2004 Course' })
    const outDir = path.join(tempDir, 'naming-2004')
    const zipPath = await packSCORM2004(course, outDir, { playerPath: fakePlayerPath })
    expect(zipPath).toMatch(/2004_course_scorm2004\.zip$/i)
  })

  it('uses custom fileName when provided', async () => {
    const outDir = path.join(tempDir, 'custom-name-2004')
    const zipPath = await packSCORM2004(makeCourse(), outDir, {
      playerPath: fakePlayerPath,
      fileName: 'custom_output',
    })
    expect(path.basename(zipPath)).toMatch(/custom_output/)
  })
})

// ─── packSCORM2004 — ZIP contents ─────────────────────────────────────────────

describe('packSCORM2004 — ZIP contents', () => {
  let zip: AdmZip
  let zipPath: string

  beforeAll(async () => {
    const outDir = path.join(tempDir, 'zip-contents-2004')
    zipPath = await packSCORM2004(makeCourse(), outDir, { playerPath: fakePlayerPath })
    zip = new AdmZip(zipPath)
  })

  it('contains imsmanifest.xml', () => {
    const entry = zip.getEntry('imsmanifest.xml')
    expect(entry).not.toBeNull()
  })

  it('contains index.html', () => {
    expect(zip.getEntry('index.html')).not.toBeNull()
  })

  it('contains player.js', () => {
    expect(zip.getEntry('player.js')).not.toBeNull()
  })

  // T041-M004: verify index.html contents
  it('index.html contains escaped course JSON', () => {
    const html = zip.getEntry('index.html')!.getData().toString('utf-8')
    // Course title should appear in the embedded JSON (HTML-escaped)
    expect(html).toContain('SCORM 2004 Course')
  })

  it('index.html references ELearnPlayer.init', () => {
    const html = zip.getEntry('index.html')!.getData().toString('utf-8')
    expect(html).toContain('ELearnPlayer.init')
  })

  it('index.html includes player.js script tag', () => {
    const html = zip.getEntry('index.html')!.getData().toString('utf-8')
    expect(html).toContain('player.js')
  })
})

// ─── imsmanifest.xml — SCORM 2004 schema ──────────────────────────────────────

describe('imsmanifest.xml — SCORM 2004 schema', () => {
  let manifest: string

  beforeAll(async () => {
    const outDir = path.join(tempDir, 'manifest-2004')
    const zipPath = await packSCORM2004(
      makeCourse({ metadata: { identifier: 'SCHEMA_TEST', version: '1.0', masteryScore: 80 } }),
      outDir,
      { playerPath: fakePlayerPath },
    )
    const zip = new AdmZip(zipPath)
    manifest = zip.getEntry('imsmanifest.xml')!.getData().toString('utf-8')
  })

  it('uses SCORM 2004 IMS namespace', () => {
    expect(manifest).toContain('http://www.imsglobal.org/xsd/imscp_v1p1')
  })

  it('uses adlcp v1p3 namespace (not v1p2)', () => {
    expect(manifest).toContain('http://www.adlnet.org/xsd/adlcp_v1p3')
    expect(manifest).not.toContain('adlcp_v1p2')
  })

  it('includes imsss sequencing namespace', () => {
    expect(manifest).toContain('http://www.imsglobal.org/xsd/imssequencing_v1p0')
  })

  it('schemaversion is "2004 4th Edition"', () => {
    expect(manifest).toContain('2004 4th Edition')
  })

  it('uses adlcp:completionThreshold (not masteryscore)', () => {
    expect(manifest).toContain('adlcp:completionThreshold')
    expect(manifest).not.toContain('masteryscore')
  })

  it('completionThreshold is normalized 0.0–1.0', () => {
    // masteryScore = 80 → completionThreshold element content = 0.80
    expect(manifest).toContain('>0.80<')
  })

  it('adlcp:scormType is camelCase "sco"', () => {
    expect(manifest).toMatch(/adlcp:scormType\s*=\s*"sco"/)
    // SCORM 1.2 uses lowercase adlcp:scormtype — must not appear
    expect(manifest).not.toMatch(/adlcp:scormtype\s*=/)
  })

  it('contains imsss:sequencing block', () => {
    expect(manifest).toContain('imsss:sequencing')
  })

  it('identifier is taken from metadata.identifier', () => {
    expect(manifest).toContain('SCHEMA_TEST')
  })
})

// ─── T613 — imsss:controlMode based on navigationMode ────────────────────────

describe('T613 — imsss:controlMode based on navigationMode', () => {
  async function getManifest(navigationMode?: 'free' | 'linear-strict'): Promise<string> {
    const settings = navigationMode
      ? { width: 1024, height: 768, navigationMode }
      : { width: 1024, height: 768 }
    const outDir = path.join(tempDir, `nav-${navigationMode ?? 'undefined'}`)
    const zipPath = await packSCORM2004(
      makeCourse({ settings }),
      outDir,
      { playerPath: fakePlayerPath },
    )
    return new AdmZip(zipPath).getEntry('imsmanifest.xml')!.getData().toString('utf-8')
  }

  it('free mode generates choice="true" flow="true" (permissive — regression)', async () => {
    const manifest = await getManifest('free')
    expect(manifest).toContain('choice="true"')
    expect(manifest).toContain('flow="true"')
    expect(manifest).not.toContain('choiceExit')
  })

  it('undefined navigationMode defaults to free — choice="true" flow="true"', async () => {
    const manifest = await getManifest(undefined)
    expect(manifest).toContain('choice="true"')
    expect(manifest).toContain('flow="true"')
    expect(manifest).not.toContain('choiceExit')
  })

  it('linear-strict mode generates choice="false" choiceExit="false" flow="true"', async () => {
    const manifest = await getManifest('linear-strict')
    expect(manifest).toContain('choice="false"')
    expect(manifest).toContain('choiceExit="false"')
    expect(manifest).toContain('flow="true"')
    // Must NOT allow free TOC navigation
    expect(manifest).not.toContain('choice="true"')
  })
})

// ─── masteryScore → completionThreshold conversion ───────────────────────────

describe('completionThreshold normalisation', () => {
  it.each([
    [100, '1.00'],
    [75, '0.75'],
    [50, '0.50'],
    [0, '0.00'],
  ])('masteryScore %i → completionThreshold %s (element content)', async (masteryScore, expected) => {
    const outDir = path.join(tempDir, `threshold-${masteryScore}`)
    const course = makeCourse({ metadata: { identifier: 'T', version: '1.0', masteryScore } })
    const zipPath = await packSCORM2004(course, outDir, { playerPath: fakePlayerPath })
    const zip = new AdmZip(zipPath)
    const manifest = zip.getEntry('imsmanifest.xml')!.getData().toString('utf-8')
    expect(manifest).toContain(`>${expected}<`)
  })

  // T041-M002: fallback case — both masteryScore and passingScore undefined → defaults to 0.80
  it('defaults completionThreshold to 0.80 when masteryScore and passingScore are both undefined', async () => {
    const outDir = path.join(tempDir, 'threshold-fallback')
    const course = makeCourse({
      metadata: { identifier: 'FALLBACK', version: '1.0' },
      settings: { width: 1024, height: 768 },
    })
    const zipPath = await packSCORM2004(course, outDir, { playerPath: fakePlayerPath })
    const zip = new AdmZip(zipPath)
    const manifest = zip.getEntry('imsmanifest.xml')!.getData().toString('utf-8')
    expect(manifest).toContain('>0.80<')
  })
})
