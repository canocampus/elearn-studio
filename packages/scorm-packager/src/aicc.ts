/**
 * AICC Descriptor Builders — T026
 *
 * Generates the four INI-format AICC descriptor files required for an AICC
 * package.  All functions are pure (no file I/O) and accept only serialisable
 * arguments so they can be unit-tested without any filesystem setup.
 *
 * File mapping:
 *   buildCourseDescriptor       → <name>.crs
 *   buildAUDescriptor           → <name>.au
 *   buildDescriptionDescriptor  → <name>.des
 *   buildStructureDescriptor    → <name>.cst
 */

// Type-only import — erased at compile time, no circular runtime dependency.
import type { CourseDoc } from './index'

// ─── Options ──────────────────────────────────────────────────────────────────

export interface PackAICCOptions {
  /**
   * Absolute path to the compiled runtime-player bundle (player.js).
   * Defaults to sibling package's dist: ../../runtime-player/dist/player.js
   */
  playerPath?: string
  /**
   * Extra local asset files to include under assets/ inside the ZIP.
   */
  assetPaths?: Array<{ localPath: string; zipPath: string }>
  /**
   * Output ZIP file name (without directory). Defaults to `<courseId>_aicc.zip`.
   */
  fileName?: string
  /**
   * Assignable Unit identifier. Defaults to 'AU_001'.
   */
  auId?: string
  /**
   * Course system ID used in the .crs [Course] section.
   * Defaults to the course's metadata.identifier or ELEARN_<_id>.
   */
  courseSystemId?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Sanitise a string for use as an INI value (right-hand side of `key=value`).
 * Replaces CR and LF characters with a space to prevent INI section injection.
 */
function iniValue(value: string): string {
  return value.replace(/[\r\n]/g, ' ').trim()
}

/**
 * Escape a value for use inside a CSV-encoded AICC data field.
 * Strips CR/LF to prevent CSV row injection, wraps in double-quotes, and
 * escapes any embedded double-quotes per RFC 4180.
 */
function csvField(value: string): string {
  const sanitised = value.replace(/[\r\n]/g, ' ').trim()
  return '"' + sanitised.replace(/"/g, '""') + '"'
}

function masteryScore(course: CourseDoc): number {
  return course.metadata?.masteryScore ?? course.settings?.passingScore ?? 80
}

// ─── .crs — Course Descriptor ─────────────────────────────────────────────────

/**
 * Returns the content of the AICC Course Descriptor file (<name>.crs).
 *
 * [Course]         — required section with top-level course metadata
 * [Course_Behavior_Settings] — controls max normal completions
 * [Course_Description] — free-text description (optional but recommended)
 */
export function buildCourseDescriptor(course: CourseDoc, opts: PackAICCOptions = {}): string {
  const courseId = iniValue(opts.courseSystemId ?? course.metadata?.identifier ?? `ELEARN_${course._id}`)
  const title    = iniValue(course.title ?? 'Untitled Course')
  const mastery  = masteryScore(course)

  return (
    '[Course]\r\n' +
    `Course_ID=${courseId}\r\n` +
    `Course_Title=${title}\r\n` +
    'Version=2.0\r\n' +
    'Total_AUs=1\r\n' +
    'Total_Blocks=0\r\n' +
    `Mastery_Score=${mastery}\r\n` +
    '\r\n' +
    '[Course_Behavior_Settings]\r\n' +
    'Max_Normal=99\r\n' +
    '\r\n' +
    '[Course_Description]\r\n' +
    `${title}\r\n`
  )
}

// ─── .au — Assignable Unit Descriptor ─────────────────────────────────────────

/**
 * Returns the content of the AICC Assignable Unit file (<name>.au).
 *
 * The [AU] section contains one header row and one data row per AU.
 * Fields: AU_ID, Max_Score, Max_Time, Mastery_Score, System_Vendor,
 *         Core_Vendor, File_Name, Launch_Parameters
 */
export function buildAUDescriptor(course: CourseDoc, opts: PackAICCOptions = {}): string {
  const auId    = opts.auId ?? 'AU_001'
  const mastery = masteryScore(course)

  return (
    '[AU]\r\n' +
    'AU_ID,Max_Score,Max_Time,Mastery_Score,System_Vendor,Core_Vendor,File_Name,Launch_Parameters\r\n' +
    `${auId},100,,${mastery},,,index.html,\r\n`
  )
}

// ─── .des — Description Descriptor ───────────────────────────────────────────

/**
 * Returns the content of the AICC Description file (<name>.des).
 *
 * The [Description] section pairs each AU with a human-readable title and
 * description.
 */
export function buildDescriptionDescriptor(course: CourseDoc, opts: PackAICCOptions = {}): string {
  const auId  = opts.auId ?? 'AU_001'
  const title = course.title ?? 'Untitled Course'

  return (
    '[Description]\r\n' +
    'AU_ID,Title,Description\r\n' +
    `${auId},${csvField(title)},${csvField(title)}\r\n`
  )
}

// ─── .cst — Course Structure Tree ─────────────────────────────────────────────

/**
 * Returns the content of the AICC Course Structure file (<name>.cst).
 *
 * A single-AU package has one block (Root) whose sole member is the AU.
 */
export function buildStructureDescriptor(_course: CourseDoc, opts: PackAICCOptions = {}): string {
  const auId = opts.auId ?? 'AU_001'

  return (
    '[Course_Structure]\r\n' +
    'Block,Member\r\n' +
    `Root,${auId}\r\n`
  )
}
