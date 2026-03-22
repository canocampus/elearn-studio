/**
 * Unit and integration tests for T026 — AICC Packager
 * (descriptor builders + packAICC)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import AdmZip from 'adm-zip'
import {
  buildCourseDescriptor,
  buildAUDescriptor,
  buildDescriptionDescriptor,
  buildStructureDescriptor,
} from '../aicc'
import { packAICC } from '../index'
import type { CourseDoc } from '../index'

// ─── Test fixture ─────────────────────────────────────────────────────────────

function makeCourse(overrides: Partial<CourseDoc> = {}): CourseDoc {
  return {
    _id: 'course-abc',
    title: 'My Test Course',
    slides: [],
    settings: { width: 1024, height: 768, passingScore: 75 },
    metadata: { identifier: 'TEST_001', version: '1', masteryScore: 80 },
    ...overrides,
  }
}

// ─── buildCourseDescriptor ────────────────────────────────────────────────────

describe('buildCourseDescriptor', () => {
  it('includes [Course] section header', () => {
    expect(buildCourseDescriptor(makeCourse())).toContain('[Course]')
  })

  it('sets Course_ID from metadata.identifier', () => {
    const out = buildCourseDescriptor(makeCourse())
    expect(out).toContain('Course_ID=TEST_001')
  })

  it('uses courseSystemId option when provided', () => {
    const out = buildCourseDescriptor(makeCourse(), { courseSystemId: 'SYS_XYZ' })
    expect(out).toContain('Course_ID=SYS_XYZ')
  })

  it('falls back to ELEARN_<_id> when no identifier or option', () => {
    const course = makeCourse()
    course.metadata = { version: '1', masteryScore: 80 } // no identifier
    const out = buildCourseDescriptor(course)
    expect(out).toContain('Course_ID=ELEARN_course-abc')
  })

  it('sets Course_Title', () => {
    expect(buildCourseDescriptor(makeCourse())).toContain('Course_Title=My Test Course')
  })

  it('sets Total_AUs=1', () => {
    expect(buildCourseDescriptor(makeCourse())).toContain('Total_AUs=1')
  })

  it('sets Mastery_Score from metadata.masteryScore', () => {
    expect(buildCourseDescriptor(makeCourse())).toContain('Mastery_Score=80')
  })

  it('falls back mastery score to settings.passingScore when metadata.masteryScore is absent', () => {
    const course2: CourseDoc = {
      ...makeCourse(),
      metadata: { version: '1' } as CourseDoc['metadata'],
    }
    const out = buildCourseDescriptor(course2)
    expect(out).toContain('Mastery_Score=75')
  })

  it('respects masteryScore of 0 (does not fall back to passingScore)', () => {
    const course2: CourseDoc = {
      ...makeCourse(),
      metadata: { version: '1', masteryScore: 0 },
    }
    const out = buildCourseDescriptor(course2)
    expect(out).toContain('Mastery_Score=0')
  })

  it('includes [Course_Behavior_Settings] section', () => {
    expect(buildCourseDescriptor(makeCourse())).toContain('[Course_Behavior_Settings]')
  })

  it('uses CRLF line endings', () => {
    const out = buildCourseDescriptor(makeCourse())
    expect(out).toContain('\r\n')
  })

  it('sanitizes newlines in title to prevent INI injection', () => {
    const course = makeCourse({ title: 'Evil\r\nCourse_ID=HACKED' })
    const out = buildCourseDescriptor(course)
    // Only one Course_ID line must appear
    const courseIdLines = out.split('\r\n').filter(l => l.startsWith('Course_ID='))
    expect(courseIdLines).toHaveLength(1)
  })

  it('sanitizes newlines in courseSystemId option to prevent INI injection', () => {
    const out = buildCourseDescriptor(makeCourse(), { courseSystemId: 'EVIL\r\nID=HACKED' })
    const courseIdLines = out.split('\r\n').filter(l => l.startsWith('Course_ID='))
    expect(courseIdLines).toHaveLength(1)
  })
})

// ─── buildAUDescriptor ────────────────────────────────────────────────────────

describe('buildAUDescriptor', () => {
  it('includes [AU] section header', () => {
    expect(buildAUDescriptor(makeCourse())).toContain('[AU]')
  })

  it('uses default AU_ID of AU_001', () => {
    expect(buildAUDescriptor(makeCourse())).toContain('AU_001')
  })

  it('uses custom auId from options', () => {
    const out = buildAUDescriptor(makeCourse(), { auId: 'MY_AU' })
    expect(out).toContain('MY_AU')
  })

  it('sets Max_Score to 100', () => {
    expect(buildAUDescriptor(makeCourse())).toContain('100')
  })

  it('sets launch file to index.html', () => {
    expect(buildAUDescriptor(makeCourse())).toContain('index.html')
  })

  it('has correct CSV header row', () => {
    const out = buildAUDescriptor(makeCourse())
    expect(out).toContain(
      'AU_ID,Max_Score,Max_Time,Mastery_Score,System_Vendor,Core_Vendor,File_Name,Launch_Parameters'
    )
  })

  it('produces exact AU data row in correct field order', () => {
    const out = buildAUDescriptor(makeCourse())
    const lines = out.split('\r\n').filter(l => l.trim())
    // lines[0] = section header, lines[1] = CSV header, lines[2] = data row
    expect(lines[2]).toBe('AU_001,100,,80,,,index.html,')
  })
})

// ─── buildDescriptionDescriptor ───────────────────────────────────────────────

describe('buildDescriptionDescriptor', () => {
  it('includes [Description] section header', () => {
    expect(buildDescriptionDescriptor(makeCourse())).toContain('[Description]')
  })

  it('includes AU_ID column header', () => {
    expect(buildDescriptionDescriptor(makeCourse())).toContain('AU_ID,Title,Description')
  })

  it('quotes title in CSV output', () => {
    const out = buildDescriptionDescriptor(makeCourse())
    expect(out).toContain('"My Test Course"')
  })

  it('escapes embedded double-quotes in title', () => {
    const course = makeCourse({ title: 'Say "Hello"' })
    const out = buildDescriptionDescriptor(course)
    expect(out).toContain('"Say ""Hello"""')
  })

  it('sanitizes newlines in title to prevent CSV row injection', () => {
    const course = makeCourse({ title: 'Evil\r\nAU_ID,Injected' })
    const out = buildDescriptionDescriptor(course)
    // Must have exactly 3 CRLF-terminated rows: section header, column header, data
    const rows = out.split('\r\n').filter(l => l.trim() !== '')
    expect(rows).toHaveLength(3)
  })

  it('uses custom auId from options', () => {
    const out = buildDescriptionDescriptor(makeCourse(), { auId: 'UNIT_42' })
    expect(out).toContain('UNIT_42')
  })
})

// ─── buildStructureDescriptor ─────────────────────────────────────────────────

describe('buildStructureDescriptor', () => {
  it('includes [Course_Structure] section header', () => {
    expect(buildStructureDescriptor(makeCourse())).toContain('[Course_Structure]')
  })

  it('has header row Block,Member', () => {
    expect(buildStructureDescriptor(makeCourse())).toContain('Block,Member')
  })

  it('maps Root to AU_001 by default', () => {
    expect(buildStructureDescriptor(makeCourse())).toContain('Root,AU_001')
  })

  it('uses custom auId from options', () => {
    const out = buildStructureDescriptor(makeCourse(), { auId: 'UNIT_7' })
    expect(out).toContain('Root,UNIT_7')
  })
})

// ─── packAICC integration ─────────────────────────────────────────────────────

describe('packAICC — ZIP contents', () => {
  let zipPath: string
  let tmpDir: string
  let zip: AdmZip

  // Create a fake player.js so the packager finds the file
  const fakePLayerPath = path.join(os.tmpdir(), 'fake-player-aicc.js')

  beforeAll(async () => {
    fs.writeFileSync(fakePLayerPath, '/* fake player */')
    tmpDir  = fs.mkdtempSync(path.join(os.tmpdir(), 'aicc-test-'))
    zipPath = await packAICC(makeCourse(), tmpDir, { playerPath: fakePLayerPath })
    zip = new AdmZip(zipPath)
  })

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    fs.rmSync(fakePLayerPath, { force: true })
  })

  function entry(name: string): string | null {
    const e = zip.getEntry(name)
    return e ? e.getData().toString('utf-8') : null
  }

  it('creates a ZIP file on disk', () => {
    expect(fs.existsSync(zipPath)).toBe(true)
  })

  it('ZIP contains imsmanifest.xml', () => {
    expect(entry('imsmanifest.xml')).not.toBeNull()
  })

  it('ZIP contains index.html', () => {
    expect(entry('index.html')).not.toBeNull()
  })

  it('ZIP contains player.js', () => {
    expect(entry('player.js')).not.toBeNull()
  })

  it('ZIP contains .crs descriptor', () => {
    // File is named after sanitised course title
    const names = zip.getEntries().map(e => e.entryName)
    expect(names.some(n => n.endsWith('.crs'))).toBe(true)
  })

  it('ZIP contains .au descriptor', () => {
    const names = zip.getEntries().map(e => e.entryName)
    expect(names.some(n => n.endsWith('.au'))).toBe(true)
  })

  it('ZIP contains .des descriptor', () => {
    const names = zip.getEntries().map(e => e.entryName)
    expect(names.some(n => n.endsWith('.des'))).toBe(true)
  })

  it('ZIP contains .cst descriptor', () => {
    const names = zip.getEntries().map(e => e.entryName)
    expect(names.some(n => n.endsWith('.cst'))).toBe(true)
  })

  it('index.html embeds the HACP bridge IIFE', () => {
    const html = entry('index.html')!
    expect(html).toContain('HACP bridge')
    expect(html).toContain('(function ()')
    expect(html).toContain('AICC_URL')
  })

  it('index.html does not embed bridge when none provided (SCORM12 path)', async () => {
    // Pack a SCORM12 package to confirm bridge is absent
    const { packSCORM12 } = await import('../index')
    const tmpDir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'scorm12-nobridge-'))
    try {
      const zip12Path = await packSCORM12(makeCourse(), tmpDir2, { playerPath: fakePLayerPath })
      const zip12 = new AdmZip(zip12Path)
      const html = zip12.getEntry('index.html')!.getData().toString('utf-8')
      expect(html).not.toContain('HACP bridge')
      expect(html).not.toContain('AICC_URL')
    } finally {
      fs.rmSync(tmpDir2, { recursive: true, force: true })
    }
  })

  it('respects custom fileName option', async () => {
    const tmpDir3 = fs.mkdtempSync(path.join(os.tmpdir(), 'aicc-custom-'))
    try {
      const customPath = await packAICC(makeCourse(), tmpDir3, {
        playerPath: fakePLayerPath,
        fileName: 'custom_output.zip',
      })
      expect(path.basename(customPath)).toBe('custom_output.zip')
    } finally {
      fs.rmSync(tmpDir3, { recursive: true, force: true })
    }
  })

  it('throws when player bundle does not exist', async () => {
    await expect(
      packAICC(makeCourse(), os.tmpdir(), { playerPath: '/nonexistent/player.js' })
    ).rejects.toThrow('Runtime player bundle not found')
  })
})
