# Telemetry

Client-side error reporting from the Authoring UI.

All endpoints require `Authorization: Bearer <token>`.

---

## POST /telemetry/client-errors

Report an unhandled error from the Authoring UI. The error is logged via Pino with `source: 'client'` and flows to Loki in the observability stack.

**Auth:** `Authorization: Bearer <token>`

**Rate limit:** 30 requests per minute per user.

**Request body:**

```typescript
interface ClientErrorReport {
  message:      string   // max 500 characters
  stack?:       string   // max 2000 characters
  url:          string   // page URL where the error occurred (must be valid URL)
  line:         number   // line number (0–99999)
  column:       number   // column number (0–99999)
  userId:       string | null
  timestamp:    string   // ISO 8601 datetime
  buildVersion: string   // app build version, max 100 characters
  context?:     Record<string, unknown>  // additional data, max 1 KB serialized
}
```

**Responses:**

| Status | Body |
|---|---|
| `200` | `{ success: true }` |
| `400` | Validation error — invalid or missing required fields |
| `401` | Unauthorized |
| `429` | Rate limit exceeded |

**curl:**

```bash
curl -X POST http://localhost:3001/telemetry/client-errors \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Cannot read properties of undefined",
    "stack": "TypeError: Cannot read properties of undefined\n    at Editor.tsx:42:15",
    "url": "http://localhost:3000/courses/64e1f2a3b4c5d6e7f8a9b0c1",
    "line": 42,
    "column": 15,
    "userId": "64e1f2a3b4c5d6e7f8a9b0c1",
    "timestamp": "2026-03-24T10:05:00.000Z",
    "buildVersion": "1.0.0",
    "context": { "slideId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890" }
  }'
```

---

## GET /telemetry/ping

Verify the auth → API → Pino → Loki pipeline. **Development only** — returns `404` in production.

**Auth:** `Authorization: Bearer <token>`

**Responses:**

| Status | Body |
|---|---|
| `200` | `{ ok: true, userId: "<id>" }` |
| `401` | Unauthorized |
| `404` | Not available in production |

**curl:**

```bash
curl http://localhost:3001/telemetry/ping \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

After calling this, verify the log entry arrived in Loki:

```bash
# In Grafana Explore — Loki query:
{service="api"} | json | source="telemetry-ping"
```
