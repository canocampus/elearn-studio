# Issues — T168: OpenAPI Documentation + Auto-generated TypeScript Client
> Generated: 2026-03-23
> Status: reviewed

## Summary

T168 adds OpenAPI 3.0 documentation (via swagger-jsdoc + swagger-ui-express) to the backend
API and auto-generates a TypeScript client for the authoring-ui (via openapi-typescript).
The work spanned route JSDoc annotations, a gen:openapi script, a `tsconfig.scripts.json`
for cross-platform compatibility, and wiring `generated.ts` into `courseApi.ts`.

## Issues Found

### CRITICAL

_None_

---

### HIGH

_None_

---

### MEDIUM

#### M-01 — Windows shell quoting incompatible with `--compiler-options` flag

**Location:** `backend/api/package.json` — `gen:openapi` script

**Description:** The original script used `ts-node --compiler-options '{"module":"commonjs"}'`.
On Windows (cmd/PowerShell), single quotes are not special; they are passed literally to
ts-node, resulting in `SyntaxError: Unexpected token ''', "'{module:commonjs}'" is not valid JSON`.

**Resolution:** Created `backend/api/tsconfig.scripts.json` extending the base tsconfig with
`"module": "CommonJS"` for the `scripts/` directory and updated the npm script to use
`ts-node --project tsconfig.scripts.json scripts/gen-openapi.ts`.

---

#### M-02 — `openapi-typescript` binary not found when called via `pnpm exec` from workspace root

**Location:** `packages/authoring-ui/package.json` — `gen:api-client` script

**Description:** `pnpm exec openapi-typescript` resolved from the workspace root, where the
binary was not installed (it's a devDependency of authoring-ui). Changed to `npx openapi-typescript`
which correctly resolves the binary from the local package.

---

#### M-03 — Generated `AuditEntry.detail` is optional; `CourseHistory.tsx` expected it as required

**Location:** `packages/authoring-ui/src/components/debug/CourseHistory.tsx:49`

**Description:** The OpenAPI schema marks `AuditEntry.detail` as optional because not all
audit events include extra detail. The manually-typed `AuditLogEntry.detail` was `Record<string, unknown>`
(required). After switching to the generated type, TypeScript raised TS2322. Fixed by updating
the `DetailBadge` prop type to `detail?: Record<string, unknown>`.

---

### LOW

#### L-01 — `ts-node` was missing from devDependencies

**Location:** `backend/api/package.json`

**Description:** `ts-node-dev` was present but bare `ts-node` was not. The `gen:openapi` script
requires bare `ts-node`. Added `"ts-node": "^10.9.2"` to devDependencies.

---

## Changes Made

| File | Change |
|---|---|
| `backend/api/tsconfig.scripts.json` | New — cross-platform tsconfig for scripts/ |
| `backend/api/package.json` | Fixed `gen:openapi` script quoting; added `ts-node` devDependency |
| `backend/api/openapi.json` | Generated — OpenAPI 3.0 spec (1600+ lines) |
| `backend/api/openapi.hash` | Generated — SHA-256 drift-detection hash |
| `packages/authoring-ui/package.json` | Fixed `gen:api-client` script to use `npx` |
| `packages/authoring-ui/src/api/generated.ts` | Generated — TypeScript types from OpenAPI spec |
| `packages/authoring-ui/src/api/courseApi.ts` | Replaced manual `AuditLogEntry` and `AssetUploadResult` with generated types |
| `packages/authoring-ui/src/components/debug/CourseHistory.tsx` | Made `DetailBadge.detail` optional to match generated schema |

## Drift Detection

The `openapi.hash` file contains a SHA-256 of the generated `openapi.json`. CI should run
`gen:openapi` and compare the hash to detect spec drift:

```bash
pnpm --filter api run gen:openapi
git diff --exit-code backend/api/openapi.hash
```
