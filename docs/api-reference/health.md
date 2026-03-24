# Health

Liveness probe for the API and its dependencies. No authentication required.

---

## GET /health

Check the health of MongoDB and Garage storage. Storage status is cached for 30 seconds to avoid hammering Garage with frequent probes.

**Auth:** Public

**Request body:** None

**Responses:**

| Status | Description |
|---|---|
| `200` | All subsystems healthy — `status: "ok"` |
| `503` | One or more subsystems degraded — `status: "degraded"` |

**Response body:**

```typescript
interface HealthResponse {
  status:  'ok' | 'degraded'
  mongo:   'ok' | 'error'
  storage: 'ok' | 'error'
}
```

**Example — healthy:**

```json
{
  "status": "ok",
  "mongo": "ok",
  "storage": "ok"
}
```

**Example — degraded:**

```json
{
  "status": "degraded",
  "mongo": "ok",
  "storage": "error"
}
```

**curl:**

```bash
curl http://localhost:3001/health
```

**Notes:**

- Storage status is cached for 30 seconds. A single failing `HeadBucket` call will not immediately flip `storage` to `error` on the next request within the cache window.
- Use this endpoint as a Docker `HEALTHCHECK` target. The 503 status code causes Docker to mark the container unhealthy.
- The response does **not** use the standard `{ success, data }` envelope — it returns the fields at the top level for compatibility with standard health-check tooling.
