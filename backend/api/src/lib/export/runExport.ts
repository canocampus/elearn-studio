/**
 * TD-001 — Shared export pipeline.
 *
 * Encapsulates the SCORM/AICC export recipe that was previously duplicated
 * across three Express routes (`/courses/:id/export/{scorm12,scorm2004,aicc}`).
 * Each route now becomes a thin wrapper that calls `runExport(course, format, opts)`.
 *
 * The module is pure with respect to Express (no `req`/`res`, no route logic).
 * It depends only on:
 *   - `@elearn-studio/scorm-packager` (the three format-specific packers)
 *   - `storage/s3` (to stream assets out of Garage)
 *   - `fs`/`path`/`os`/`stream` from Node
 *
 * Adding a new format (e.g. xAPI) requires one new entry in the `PACKERS` map
 * plus one route registration. No additional copy-paste of the pipeline.
 */

import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { pipeline } from 'stream/promises'
import type { CourseDoc } from '@elearn-studio/shared-types'
import { packSCORM12, packSCORM2004, packAICC } from '@elearn-studio/scorm-packager'
import { getObject } from '../../storage/s3'

export type ExportFormat = 'scorm12' | 'scorm2004' | 'aicc'

// ---------------------------------------------------------------------------
// Asset pipeline (moved verbatim from routes/courses.ts — C-03)
// ---------------------------------------------------------------------------

/** Matches /assets/<uuid>.<ext> in widget properties.src fields. */
const ASSET_SRC_RE = /^\/assets\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[a-z0-9]+)$/

type SlideLike = { widgets: Array<{ properties?: Record<string, unknown> }> }
type CourseLike = { slides: SlideLike[] }

/**
 * Extract all asset objectNames referenced in widget `properties.src` fields.
 * Returns a deduplicated map: `objectName → relative zip path ("assets/<objectName>")`.
 */
export function collectAssetSrcs(slides: SlideLike[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const slide of slides) {
    for (const widget of slide.widgets) {
      const src = widget.properties?.['src']
      if (typeof src === 'string') {
        const m = ASSET_SRC_RE.exec(src)
        if (m) map.set(m[1] as string, `assets/${m[1] as string}`)
      }
    }
  }
  return map
}

/**
 * Deep-clone the course and rewrite widget `properties.src` from absolute
 * backend paths (`/assets/<uuid>.ext`) to relative paths inside the ZIP
 * (`assets/<uuid>.ext`). Non-mutating.
 */
export function rewriteAssetSrcs<T extends CourseLike>(course: T): T {
  return {
    ...course,
    slides: course.slides.map(slide => ({
      ...slide,
      widgets: slide.widgets.map(widget => {
        const src = widget.properties?.['src']
        if (typeof src === 'string' && ASSET_SRC_RE.test(src)) {
          return {
            ...widget,
            properties: { ...widget.properties, src: src.replace(/^\/assets\//, 'assets/') },
          }
        }
        return widget
      }),
    })),
  }
}

/**
 * Download each referenced asset from Garage into `<tmpDir>/assets/`.
 * Missing assets are skipped (non-fatal): a course that references a deleted
 * upload still exports — the resulting ZIP simply omits that file.
 *
 * Returns the list of `{ localPath, zipPath }` tuples that the packer will
 * consume to include the assets in the output ZIP.
 */
export async function downloadAssets(
  assetMap: Map<string, string>,
  tmpDir: string,
): Promise<Array<{ localPath: string; zipPath: string }>> {
  const assetsDir = path.join(tmpDir, 'assets')
  if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true })

  const assetPaths: Array<{ localPath: string; zipPath: string }> = []
  for (const [objectName, zipPath] of assetMap.entries()) {
    const localPath = path.join(tmpDir, zipPath)
    try {
      const { stream } = await getObject(objectName)
      await pipeline(stream, fs.createWriteStream(localPath))
      assetPaths.push({ localPath, zipPath })
    } catch {
      // Non-fatal: skip missing assets so one bad reference does not abort the export.
    }
  }
  return assetPaths
}

// ---------------------------------------------------------------------------
// Format registry
// ---------------------------------------------------------------------------

interface FormatSpec {
  /** Packer function from @elearn-studio/scorm-packager. */
  pack: (course: CourseDoc, outputDir: string, options: {
    playerPath?: string
    assetPaths?: Array<{ localPath: string; zipPath: string }>
  }) => Promise<string>
  /** Prefix for the temp directory name — useful for debugging orphaned dirs. */
  tmpPrefix: string
  /** Suffix used in the final download filename: `<title>_<suffix>.zip`. */
  fileSuffix: string
}

const PACKERS: Record<ExportFormat, FormatSpec> = {
  scorm12:   { pack: packSCORM12,   tmpPrefix: 'elearn-scorm-',     fileSuffix: 'scorm12' },
  scorm2004: { pack: packSCORM2004, tmpPrefix: 'elearn-scorm2004-', fileSuffix: 'scorm2004' },
  aicc:      { pack: packAICC,      tmpPrefix: 'elearn-aicc-',      fileSuffix: 'aicc' },
}

// ---------------------------------------------------------------------------
// runExport
// ---------------------------------------------------------------------------

export interface RunExportOptions {
  /** Absolute path to the runtime-player JS bundle (e.g. `/app/player.js` in Docker). */
  playerPath?: string
}

export interface RunExportResult {
  /** Absolute path to the generated ZIP on disk. */
  zipPath: string
  /** Temp directory the ZIP lives in — caller must cleanup after streaming. */
  tmpDir: string
  /** Suggested filename for the download: sanitised title + format suffix. */
  fileName: string
  /** Number of assets actually bundled (skipped ones not counted). */
  assetCount: number
}

/**
 * Run the full export pipeline for the given course.
 *
 * Steps (fixed order):
 *   1. mkdtemp under OS temp dir, using the format-specific prefix.
 *   2. `collectAssetSrcs` — scan widget src fields for /assets/<uuid> references.
 *   3. `downloadAssets` — stream each referenced asset out of Garage.
 *   4. `rewriteAssetSrcs` — deep-clone the course with relative asset paths.
 *   5. Call the format-specific packer (`packSCORM12`/`packSCORM2004`/`packAICC`).
 *
 * Ownership of tmpDir:
 *   - On success: returned to caller in `RunExportResult.tmpDir`. Caller is
 *     responsible for cleanup after `res.download` completes.
 *   - On error: tmpDir is removed inside `runExport` and the original error
 *     is re-thrown. Caller only needs to render the 500 response.
 */
export async function runExport(
  course: CourseDoc,
  format: ExportFormat,
  options: RunExportOptions = {},
): Promise<RunExportResult> {
  const { pack, tmpPrefix, fileSuffix } = PACKERS[format]
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), tmpPrefix))

  try {
    const assetMap = collectAssetSrcs(course.slides)
    const assetPaths = await downloadAssets(assetMap, tmpDir)
    const rewritten = rewriteAssetSrcs(course)
    const zipPath = await pack(rewritten, tmpDir, {
      ...(options.playerPath ? { playerPath: options.playerPath } : {}),
      assetPaths,
    })
    const safeTitle = (course.title ?? '').replace(/[^a-z0-9_-]/gi, '_').slice(0, 64) || 'course'
    const fileName = `${safeTitle}_${fileSuffix}.zip`
    return { zipPath, tmpDir, fileName, assetCount: assetPaths.length }
  } catch (err) {
    // Error path owns tmpDir cleanup — caller only sees tmpDir on success.
    fs.rmSync(tmpDir, { recursive: true, force: true })
    throw err
  }
}
