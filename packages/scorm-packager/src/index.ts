/**
 * SCORM Packager — T016
 *
 * Generates a SCORM 1.2-compliant ZIP package from a CourseDoc.
 *
 * Output structure inside the ZIP:
 *   imsmanifest.xml
 *   index.html           (launches the player)
 *   player.js            (copied from runtime-player dist)
 *   assets/              (all course media assets, optional)
 *
 * Usage:
 *   import { packSCORM12 } from '@elearn-studio/scorm-packager'
 *   const zipPath = await packSCORM12(course, outputDir, { playerPath, assetPaths })
 */

import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import archiver from 'archiver'
import { create as xmlCreate } from 'xmlbuilder2'
import { buildHACPBridge } from './hacp-bridge'
import {
  buildCourseDescriptor,
  buildAUDescriptor,
  buildDescriptionDescriptor,
  buildStructureDescriptor,
} from './aicc'
export type { PackAICCOptions } from './aicc'

// ─── Embedded course types (mirror authoring-ui) ──────────────────────────────

export interface Bounds { x: number; y: number; width: number; height: number }

export interface BaseWidget {
  id: string
  type: string
  bounds: Bounds
  layer: number
  visible: boolean
  properties: Record<string, unknown>
  extendedProperties: Record<string, unknown>
}

export interface Slide {
  id: string
  title: string
  widgets: BaseWidget[]
}

export interface CourseSettings {
  width: number
  height: number
  passingScore: number
}

export interface SCORMMetadata {
  identifier?: string
  version: string
  masteryScore: number
}

export interface CourseDoc {
  _id: string
  title: string
  slides: Slide[]
  settings: CourseSettings
  metadata: SCORMMetadata
}

// ─── Options ──────────────────────────────────────────────────────────────────

export interface PackSCORM12Options {
  /**
   * Absolute path to the compiled runtime-player bundle (player.js).
   * Defaults to sibling package's dist: ../../runtime-player/dist/player.js
   */
  playerPath?: string
  /**
   * Extra local asset files to include under assets/ inside the ZIP.
   * Each entry: { localPath, zipPath }
   */
  assetPaths?: Array<{ localPath: string; zipPath: string }>
  /**
   * Output ZIP file name (without directory). Defaults to `<courseId>.zip`.
   */
  fileName?: string
}

// ─── imsmanifest.xml builder ──────────────────────────────────────────────────

function buildManifest(course: CourseDoc): string {
  const identifier = course.metadata?.identifier ?? `ELEARN_${course._id}`
  const title = course.title ?? 'Untitled Course'
  const masteryScore = course.metadata?.masteryScore ?? course.settings?.passingScore ?? 80

  const doc = xmlCreate({ version: '1.0', encoding: 'UTF-8' })
    .ele('manifest', {
      identifier,
      version: '1',
      'xmlns': 'http://www.imsproject.org/xsd/imscp_rootv1p1p2',
      'xmlns:adlcp': 'http://www.adlnet.org/xsd/adlcp_rootv1p2',
      'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
      'xsi:schemaLocation':
        'http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd ' +
        'http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd',
    })

  // <metadata>
  doc
    .ele('metadata')
      .ele('schema').txt('ADL SCORM').up()
      .ele('schemaversion').txt('1.2').up()
    .up()

  // <organizations>
  const org = doc
    .ele('organizations', { default: 'ORG_1' })
      .ele('organization', { identifier: 'ORG_1' })
        .ele('title').txt(title).up()

  const item = org
    .ele('item', { identifier: 'ITEM_1', identifierref: 'RES_1', isvisible: 'true' })
      .ele('title').txt(title).up()
  item.ele('adlcp:masteryscore').txt(String(masteryScore)).up()
  item.up() // close item
  org.up()  // close organization
  doc.up()  // close organizations (popping to manifest)

  // <resources>
  doc
    .ele('resources')
      .ele('resource', {
        identifier: 'RES_1',
        type: 'webcontent',
        'adlcp:scormtype': 'sco',
        href: 'index.html',
      })
        .ele('file', { href: 'index.html' }).up()
        .ele('file', { href: 'player.js' }).up()
    .up()

  return doc.end({ prettyPrint: true })
}

// ─── index.html builder ───────────────────────────────────────────────────────

/**
 * @param bridge  Optional JS IIFE string to inject before player.js (used by
 *                AICC packages to establish window.API via HACP).
 */
function buildIndexHtml(course: CourseDoc, bridge?: string): string {
  const title = course.title ?? 'Course'
  const courseJson = JSON.stringify(course)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/<\/script>/gi, '<\\/script>')

  const { width = 1024, height = 768 } = course.settings ?? {}

  // Validate that the bridge is a well-formed IIFE to prevent script injection.
  // The bridge must come from buildHACPBridge() — user-controlled input is not allowed.
  if (bridge !== undefined && !/^\s*\(function\s*\(\s*\)/.test(bridge)) {
    throw new Error('bridge must be a valid IIFE from buildHACPBridge()')
  }
  const bridgeBlock = bridge
    ? `  <script>\n/* HACP bridge — injected by AICC packager */\n${bridge}\n  </script>\n`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      display: flex;
      justify-content: center;
      align-items: flex-start;
      min-height: 100vh;
      background: #333;
      font-family: system-ui, sans-serif;
    }
    #elearn-player-wrap {
      margin: 20px auto;
      width: ${width}px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.4);
    }
  </style>
</head>
<body>
  <div id="elearn-player-wrap">
    <div id="elearn-player"></div>
  </div>
${bridgeBlock}  <script src="player.js"></script>
  <script>
    var _courseData = ${courseJson};
    if (typeof ELearnPlayer !== 'undefined') {
      ELearnPlayer.init('elearn-player', _courseData);
    } else {
      document.getElementById('elearn-player').innerHTML =
        '<p style="color:red;padding:20px;">Player failed to load.</p>';
    }
  </script>
</body>
</html>`
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// ─── Default player path resolution ──────────────────────────────────────────

function defaultPlayerPath(): string {
  // __dirname = packages/scorm-packager/dist → ../../runtime-player/dist/player.js
  return path.resolve(__dirname, '..', '..', 'runtime-player', 'dist', 'player.js')
}

// ─── Main packager function ───────────────────────────────────────────────────

/**
 * Build a SCORM 1.2 ZIP package for the given course.
 *
 * @param course     CourseDoc to package
 * @param outputDir  Directory where the ZIP will be written
 * @param options    Optional overrides
 * @returns          Absolute path to the generated ZIP file
 */
export async function packSCORM12(
  course: CourseDoc,
  outputDir: string,
  options: PackSCORM12Options = {},
): Promise<string> {
  const playerPath = options.playerPath ?? defaultPlayerPath()

  if (!fs.existsSync(playerPath)) {
    throw new Error(
      'Runtime player bundle not found. ' +
      'Run: pnpm --filter @elearn-studio/runtime-player run build'
    )
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const safeTitle = course.title.replace(/[^a-z0-9_-]/gi, '_').slice(0, 64) || 'course'
  const fileName = options.fileName ?? `${safeTitle}_scorm12.zip`
  const outputPath = path.join(outputDir, fileName)

  return new Promise<string>((resolve, reject) => {
    const output = fs.createWriteStream(outputPath)
    const archive = archiver('zip', { zlib: { level: 9 } })

    output.on('close', () => resolve(outputPath))
    archive.on('error', reject)
    archive.pipe(output)

    // imsmanifest.xml
    const manifest = buildManifest(course)
    archive.append(manifest, { name: 'imsmanifest.xml' })

    // index.html
    const indexHtml = buildIndexHtml(course)
    archive.append(indexHtml, { name: 'index.html' })

    // player.js
    archive.file(playerPath, { name: 'player.js' })

    // Optional extra assets
    if (options.assetPaths) {
      for (const { localPath, zipPath } of options.assetPaths) {
        if (fs.existsSync(localPath)) {
          archive.file(localPath, { name: zipPath })
        }
      }
    }

    archive.finalize()
  })
}

// ─── AICC packager function ───────────────────────────────────────────────────

/**
 * Build an AICC-compliant ZIP package for the given course.
 *
 * Generates four AICC descriptor files (.crs, .au, .des, .cst) plus an
 * index.html that embeds the HACP bridge IIFE so the runtime player can
 * communicate with AICC-compliant LMSes via HTTP POST.
 *
 * @param course     CourseDoc to package
 * @param outputDir  Directory where the ZIP will be written
 * @param options    Optional overrides (playerPath, fileName, auId, …)
 * @returns          Absolute path to the generated ZIP file
 */
export async function packAICC(
  course: CourseDoc,
  outputDir: string,
  options: import('./aicc').PackAICCOptions = {},
): Promise<string> {
  const playerPath = options.playerPath ?? defaultPlayerPath()

  if (!fs.existsSync(playerPath)) {
    throw new Error(
      'Runtime player bundle not found. ' +
      'Run: pnpm --filter @elearn-studio/runtime-player run build'
    )
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const safeTitle = course.title.replace(/[^a-z0-9_-]/gi, '_').slice(0, 64) || 'course'
  const baseName  = safeTitle  // used for the four AICC descriptor file names
  const fileName  = options.fileName ?? `${safeTitle}_aicc.zip`
  const outputPath = path.join(outputDir, fileName)

  const bridge = buildHACPBridge()

  return new Promise<string>((resolve, reject) => {
    const output  = fs.createWriteStream(outputPath)
    const archive = archiver('zip', { zlib: { level: 9 } })

    output.on('close', () => resolve(outputPath))
    archive.on('error', reject)
    archive.pipe(output)

    // AICC descriptor files
    archive.append(buildCourseDescriptor(course, options),       { name: `${baseName}.crs` })
    archive.append(buildAUDescriptor(course, options),           { name: `${baseName}.au`  })
    archive.append(buildDescriptionDescriptor(course, options),  { name: `${baseName}.des` })
    archive.append(buildStructureDescriptor(course, options),    { name: `${baseName}.cst` })

    // imsmanifest.xml (optional but widely expected even in AICC packages)
    const manifest = buildManifest(course)
    archive.append(manifest, { name: 'imsmanifest.xml' })

    // index.html with embedded HACP bridge
    const indexHtml = buildIndexHtml(course, bridge)
    archive.append(indexHtml, { name: 'index.html' })

    // player.js
    archive.file(playerPath, { name: 'player.js' })

    // Optional extra assets
    if (options.assetPaths) {
      for (const { localPath, zipPath } of options.assetPaths) {
        if (fs.existsSync(localPath)) {
          archive.file(localPath, { name: zipPath })
        }
      }
    }

    archive.finalize()
  })
}

// ─── CLI entry point (called from package.json "package" script) ──────────────

async function runCli(): Promise<void> {
  const args = process.argv.slice(2)
  const courseIdArg = args.find(a => a.startsWith('--courseId='))?.split('=')[1]
  const outputArg = args.find(a => a.startsWith('--output='))?.split('=')[1]

  if (!courseIdArg) {
    console.error('Usage: node dist/cli.js --courseId=<id> [--output=./dist]')
    process.exit(1)
  }

  console.log(`SCORM packager CLI — courseId: ${courseIdArg}`)
  console.log('Use packSCORM12() programmatically from the backend for full integration.')
  console.log('Output directory:', outputArg ?? os.tmpdir())
}

// Run CLI when executed directly
if (require.main === module) {
  runCli().catch(err => { console.error(err); process.exit(1) })
}
