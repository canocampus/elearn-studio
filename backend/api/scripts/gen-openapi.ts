/**
 * gen-openapi.ts
 *
 * Generates openapi.json from the swagger-jsdoc spec and writes it to
 * backend/api/openapi.json (gitignored). Also writes openapi.hash for
 * CI drift detection — the hash is committed; CI fails if the spec has
 * changed without a corresponding hash update.
 *
 * Usage:
 *   pnpm --filter api run gen:openapi
 *
 * Called automatically by gen:api-client in packages/authoring-ui.
 */

import { createHash } from 'crypto'
import { writeFileSync } from 'fs'
import path from 'path'
import { swaggerSpec } from '../src/lib/swagger'

const ROOT = path.join(__dirname, '..')

const json = JSON.stringify(swaggerSpec, null, 2)

// Write the spec
const specPath = path.join(ROOT, 'openapi.json')
writeFileSync(specPath, json, 'utf-8')
console.log(`✔ Written ${specPath}`)

// Write the hash (committed — CI checks this)
const hash = createHash('sha256').update(json).digest('hex')
const hashPath = path.join(ROOT, 'openapi.hash')
writeFileSync(hashPath, hash, 'utf-8')
console.log(`✔ Written ${hashPath} (sha256: ${hash.slice(0, 16)}…)`)
