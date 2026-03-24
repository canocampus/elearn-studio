# Simulations

Import Playwright recording sessions and proxy simulation screenshots.

All endpoints require `Authorization: Bearer <token>`.

---

## POST /courses/:courseId/simulations/import

Import a Playwright recording session into a course as a `SimConfig`. Fetches `recordings/{sessionId}/session.json` from Garage, converts raw `SimStep[]` to `AuthoredSimStep[]` with default hotspots, and returns the resulting `SimConfig`.

**Auth:** `Authorization: Bearer <token>`

**Path parameters:**

| Parameter | Type | Description |
|---|---|---|
| `courseId` | string | MongoDB ObjectId of the target course |

**Request body:**

```typescript
interface ImportSimulationRequest {
  sessionId: string  // alphanumeric + hyphens/underscores only (e.g. "session-abc123")
}
```

**Responses:**

| Status | Body |
|---|---|
| `200` | `{ success: true, data: SimConfig }` |
| `400` | Invalid `courseId` or `sessionId` format |
| `401` | Unauthorized |
| `404` | Session recording not found in storage |
| `422` | Session file found but JSON is corrupted |
| `500` | Storage error |

**Response body (`SimConfig`):**

```typescript
interface SimConfig {
  sessionId:   string
  mode:        'demo' | 'practice' | 'assessment'
  passingScore: number           // 0–100
  steps:       AuthoredSimStep[]
}

interface AuthoredSimStep {
  id:                string
  order:             number
  description:       string
  instruction:       string
  hint:              string
  correctFeedback:   string
  incorrectFeedback: string
  demoDelay:         number      // ms
  maxAttempts:       number      // -1 = unlimited
  screenshotKey:     string      // Garage object key
  screenshotUrl:     string      // proxy URL via GET /simulations/screenshot
  hotspot:           SimHotspot
}

interface SimHotspot {
  x:         number  // pixels from left
  y:         number  // pixels from top
  width:     number
  height:    number
  tolerance: number  // click hit-area padding in pixels
}
```

**curl:**

```bash
curl -X POST http://localhost:3001/courses/64e1f2a3b4c5d6e7f8a9b0c1/simulations/import \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "sessionId": "session-abc123" }'
```

**Notes:**

- Default hotspots are centred on the captured click coordinates within a 640×360 canvas (80×40 px rectangle). Authors can resize and reposition in the Hotspot Canvas editor.
- Imported defaults: `mode: "practice"`, `passingScore: 80`, `maxAttempts: -1`, `demoDelay: 1500 ms`.
- Step descriptions are auto-generated from the raw event type and target text if not provided in the recording.

---

## GET /simulations/screenshot

Proxy a simulation screenshot from Garage. The Authoring UI uses this endpoint so that it never needs direct Garage credentials.

**Auth:** `Authorization: Bearer <token>`

**Query parameters:**

| Parameter | Type | Description |
|---|---|---|
| `key` | string | Garage object key (must start with `recordings/`, end with `.png` or `.jpeg`) |

**Responses:**

| Status | Body |
|---|---|
| `200` | `image/png` or `image/jpeg` binary stream |
| `400` | `key` query parameter missing |
| `401` | Unauthorized |
| `403` | Key outside `recordings/` prefix or contains path traversal |
| `404` | Screenshot not found in storage |
| `500` | Storage error |

**curl:**

```bash
curl "http://localhost:3001/simulations/screenshot?key=recordings%2Fsession-abc123%2Fstep-1.png" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -o step-1.png
```

**Security:**

- Keys are validated against the `recordings/` prefix. Any attempt to access keys outside this path returns `403`.
- Path traversal sequences (`..`) are rejected with `403`.
- Only `.png` and `.jpeg` extensions are served.
- Response includes `Cache-Control: private, max-age=3600`.
