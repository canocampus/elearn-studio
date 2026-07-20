/**
 * TD-024.4 (audit finding 3, decision D3) — zod validation for the Course
 * write boundary, derived from the shared-types contract.
 *
 * Before this module, contract-invalid widgets reached Mongoose raw: required
 * fields surfaced as unhandled 500s and undeclared fields were silently
 * stripped (the TD-019b failure mode). The boundary now rejects with 400 and
 * a path-qualified message before anything touches the database.
 *
 * Shapes mirror `@elearn-studio/shared-types` (BaseWidget / ActionSequence /
 * Slide). Loose objects: unknown extra keys pass through (Mongoose strict
 * mode strips them) — strictness applies to the contract fields themselves.
 * Fields with Mongoose defaults (layer, visible, properties,
 * extendedProperties) stay optional at the boundary.
 */
import { z } from 'zod'
import { WIDGET_TYPES } from '@elearn-studio/shared-types'

const BoundsZ = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
})

// Recursive schema via zod v4 getter pattern — no explicit type annotation
// (and no cast) needed for self-reference.
const ActionZ = z.looseObject({
  id: z.string().optional(),
  type: z.string().min(1),
  params: z.record(z.string(), z.unknown()).optional(),
  get children() {
    return z.array(ActionZ).optional()
  },
  get elseChildren() {
    return z.array(ActionZ).optional()
  },
})

const ActionSequenceZ = z.looseObject({
  event: z.string().min(1),
  actions: z.array(ActionZ),
})

const WidgetZ = z.looseObject({
  id: z.string().min(1),
  type: z.enum(WIDGET_TYPES),
  name: z.string().optional(),
  bounds: BoundsZ,
  layer: z.number().optional(),
  visible: z.boolean().optional(),
  properties: z.record(z.string(), z.unknown()).optional(),
  actions: z.array(ActionSequenceZ).optional(),
  extendedProperties: z.record(z.string(), z.unknown()).optional(),
})

export const WidgetsArrayZ = z.array(WidgetZ)
export const ActionSequencesArrayZ = z.array(ActionSequenceZ)

const SlideZ = z.looseObject({
  id: z.string().min(1),
  title: z.string(),
  widgets: WidgetsArrayZ.optional(),
  actions: ActionSequencesArrayZ.optional(),
  thumbnail: z.string().optional(),
})

export const SlidesArrayZ = z.array(SlideZ)

/** Compact, path-qualified single-line message for a 400 body. */
export function formatZodError(fieldName: string, error: z.ZodError): string {
  const parts = error.issues.slice(0, 3).map(issue => {
    const path = issue.path.reduce<string>(
      (acc, seg) => (typeof seg === 'number' ? `${acc}[${seg}]` : `${acc}.${String(seg)}`),
      fieldName,
    )
    return `${path}: ${issue.message}`
  })
  const more = error.issues.length > 3 ? ` (+${error.issues.length - 3} more)` : ''
  return `Invalid ${fieldName} — ${parts.join('; ')}${more}`
}
