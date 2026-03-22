/**
 * T016.9 — imsmanifest.xml structural validation
 *
 * Verifies that the imsmanifest.xml produced by packSCORM12 conforms to the
 * expected SCORM 1.2 / IMS CP structure.  Uses @xmldom/xmldom (pure JS) for
 * DOM-based structural checks — no external XSD server or native bindings
 * required.
 *
 * Checks performed:
 *  - Valid XML (parses without error)
 *  - Root element is <manifest> with the three expected namespace declarations
 *  - <metadata> contains <schema>ADL SCORM</schema> and
 *    <schemaversion>1.2</schemaversion>
 *  - <organizations default="ORG_1"> exists
 *  - <organization identifier="ORG_1"> exists inside it
 *  - <item identifierref="RES_1"> exists inside the organization
 *  - <adlcp:masteryscore> exists inside the item with a numeric string value
 *  - <resources> contains a <resource adlcp:scormtype="sco" href="index.html">
 *  - Malformed XML is detected (negative test)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import AdmZip from 'adm-zip'
import { DOMParser } from '@xmldom/xmldom'
import { packSCORM12, CourseDoc } from '../index'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

let tempDir: string
let fakePlayerPath: string
let manifestXml: string

const SCORM12_NS  = 'http://www.imsproject.org/xsd/imscp_rootv1p1p2'
const ADLCP_NS    = 'http://www.adlnet.org/xsd/adlcp_rootv1p2'

function makeCourse(overrides: Partial<CourseDoc> = {}): CourseDoc {
  return {
    _id: 'xsd-test-001',
    title: 'XSD Validation Course',
    slides: [{ id: 's1', title: 'Slide 1', widgets: [] }],
    settings: { width: 1024, height: 768, passingScore: 75 },
    metadata: { identifier: 'XSD_TEST_001', version: '1.0', masteryScore: 75 },
    ...overrides,
  }
}

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scorm-xsd-test-'))
  fakePlayerPath = path.join(tempDir, 'player.js')
  fs.writeFileSync(fakePlayerPath, '// fake player')

  const outputDir = path.join(tempDir, 'out')
  const zipPath = await packSCORM12(makeCourse(), outputDir, { playerPath: fakePlayerPath })

  const zip = new AdmZip(zipPath)
  const entry = zip.getEntry('imsmanifest.xml')
  if (!entry) throw new Error('imsmanifest.xml missing from ZIP')
  manifestXml = entry.getData().toString('utf8')
})

afterAll(() => {
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function parseXml(xml: string) {
  const errors: string[] = []
  // @xmldom/xmldom v0.9+ uses onError callback instead of errorHandler object
  const parser = new DOMParser({
    onError: (level: string | Error, msg: string) => {
      const text = typeof level === 'string' ? `${level}: ${msg}` : String(level)
      errors.push(text)
    },
  } as ConstructorParameters<typeof DOMParser>[0])
  const doc = parser.parseFromString(xml, 'text/xml')
  // Report non-fatal parse errors accumulated during parsing
  if (errors.length) throw new Error(`XML parse errors:\n${errors.join('\n')}`)
  // xmldom also embeds a <parsererror> element on fatal parse failures
  if (doc.documentElement?.localName === 'parsererror') {
    throw new Error(`XML parse error: ${doc.documentElement.textContent}`)
  }
  return doc
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function first(doc: ReturnType<typeof parseXml>, ns: string, localName: string) {
  const nodes = doc.getElementsByTagNameNS(ns, localName)
  return nodes.length > 0 ? nodes[0] : null
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('imsmanifest.xml structure — T016.9', () => {
  it('is valid XML (parses without error)', () => {
    expect(() => parseXml(manifestXml)).not.toThrow()
  })

  it('root element is <manifest> in the IMS CP namespace', () => {
    const doc = parseXml(manifestXml)
    const root = doc.documentElement!
    expect(root.localName).toBe('manifest')
    expect(root.namespaceURI).toBe(SCORM12_NS)
  })

  it('manifest declares the three required namespace attributes', () => {
    const doc = parseXml(manifestXml)
    const root = doc.documentElement!
    const defaultNs  = root.getAttribute('xmlns')
    const adlcpNs    = root.getAttributeNS('http://www.w3.org/2000/xmlns/', 'adlcp')
                    ?? root.getAttribute('xmlns:adlcp')
    const xsiNs      = root.getAttributeNS('http://www.w3.org/2000/xmlns/', 'xsi')
                    ?? root.getAttribute('xmlns:xsi')

    expect(defaultNs).toBe(SCORM12_NS)
    expect(adlcpNs).toBe(ADLCP_NS)
    expect(xsiNs).toBe('http://www.w3.org/2001/XMLSchema-instance')
  })

  it('manifest has identifier and version attributes', () => {
    const doc = parseXml(manifestXml)
    const root = doc.documentElement!
    expect(root.getAttribute('identifier')).toBe('XSD_TEST_001')
    expect(root.getAttribute('version')).toBe('1')
  })

  it('<metadata> contains schema=ADL SCORM and schemaversion=1.2', () => {
    const doc = parseXml(manifestXml)
    const metadata = first(doc, SCORM12_NS, 'metadata')
    expect(metadata).not.toBeNull()

    const schema = first(doc, SCORM12_NS, 'schema')
    expect(schema?.textContent?.trim()).toBe('ADL SCORM')

    const version = first(doc, SCORM12_NS, 'schemaversion')
    expect(version?.textContent?.trim()).toBe('1.2')
  })

  it('<organizations> has default="ORG_1"', () => {
    const doc = parseXml(manifestXml)
    const orgs = first(doc, SCORM12_NS, 'organizations')
    expect(orgs).not.toBeNull()
    expect(orgs?.getAttribute('default')).toBe('ORG_1')
  })

  it('<organization> has identifier="ORG_1" inside <organizations>', () => {
    const doc = parseXml(manifestXml)
    const orgs = first(doc, SCORM12_NS, 'organizations')
    expect(orgs).not.toBeNull()

    const orgList = orgs!.getElementsByTagNameNS(SCORM12_NS, 'organization')
    expect(orgList.length).toBeGreaterThanOrEqual(1)
    expect(orgList[0].getAttribute('identifier')).toBe('ORG_1')
  })

  it('<item> has identifierref="RES_1" inside <organization>', () => {
    const doc = parseXml(manifestXml)
    const item = first(doc, SCORM12_NS, 'item')
    expect(item).not.toBeNull()
    expect(item?.getAttribute('identifierref')).toBe('RES_1')
  })

  it('<adlcp:masteryscore> is present inside <item> with a numeric value', () => {
    const doc = parseXml(manifestXml)
    const score = first(doc, ADLCP_NS, 'masteryscore')
    expect(score).not.toBeNull()
    const val = Number(score?.textContent?.trim())
    expect(Number.isFinite(val)).toBe(true)
    expect(val).toBe(75)  // matches the course masteryScore
  })

  it('<resources> contains a <resource> with adlcp:scormtype="sco"', () => {
    const doc = parseXml(manifestXml)
    const resources = first(doc, SCORM12_NS, 'resources')
    expect(resources).not.toBeNull()

    const resourceList = resources!.getElementsByTagNameNS(SCORM12_NS, 'resource')
    expect(resourceList.length).toBeGreaterThanOrEqual(1)

    const res = resourceList[0]
    expect(res.getAttributeNS(ADLCP_NS, 'scormtype')).toBe('sco')
    expect(res.getAttribute('href')).toBe('index.html')
  })

  it('<resource> references index.html and player.js as <file> children', () => {
    const doc = parseXml(manifestXml)
    const resources = first(doc, SCORM12_NS, 'resources')!
    const resource  = resources.getElementsByTagNameNS(SCORM12_NS, 'resource')[0]
    const fileNodes = resource.getElementsByTagNameNS(SCORM12_NS, 'file')
    const hrefs     = Array.from({ length: fileNodes.length }, (_, i) => fileNodes[i].getAttribute('href'))

    expect(hrefs).toContain('index.html')
    expect(hrefs).toContain('player.js')
  })
})

// ─── Negative test ────────────────────────────────────────────────────────────

describe('malformed XML detection', () => {
  it('throws on unclosed root tag', () => {
    expect(() => parseXml('<manifest><metadata></manifest>')).toThrow()
  })

  it('throws on XML without root element', () => {
    expect(() => parseXml('not xml at all <<<')).toThrow()
  })
})
