# eLearn Studio — API Reference

Complete REST API documentation for the eLearn Studio backend (Node.js 20 + Express 5).

All endpoints require a Bearer token for authentication (`Authorization: Bearer <token>`).

Base URL: `http://localhost:3001/api` (direct backend) or `http://localhost:3000/api` (via Vite dev proxy — requests proxied automatically). Use port 3001 when calling the API directly (e.g., curl, Postman); use port 3000 in browser code during development.

---

## Response Format

All endpoints return a consistent JSON envelope:

```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

or on error:

```json
{
  "success": false,
  "data": null,
  "error": "Error message"
}
```

---

## Quick Examples

### Authenticate (Login)

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"SecurePassword123!"}'
```

Response:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ0eXAiOiJKV1QiLCJhbGc...",
    "refreshToken": "7f8g9h0i1j2k3l4m5n6o7p8q9r0s1t2u3v4w5x6"
  }
}
```

### List All Courses

```bash
curl -X GET http://localhost:3001/api/courses \
  -H "Authorization: Bearer <accessToken>"
```

### Get Course by ID

```bash
curl -X GET http://localhost:3001/api/courses/507f1f77bcf86cd799439011 \
  -H "Authorization: Bearer <accessToken>"
```

### Upload Asset

```bash
curl -X POST http://localhost:3001/api/assets/upload \
  -H "Authorization: Bearer <accessToken>" \
  -F "file=@image.png"
```

### Using fetch() in Browser

```javascript
// Login
const loginRes = await fetch('http://localhost:3001/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePassword123!'
  })
})
const { data: { accessToken } } = await loginRes.json()

// Get courses
const coursesRes = await fetch('http://localhost:3001/api/courses', {
  headers: { 'Authorization': `Bearer ${accessToken}` }
})
const { data: courses } = await coursesRes.json()
```

---

## Courses

### List All Courses

**GET** `/courses`

Returns all non-deleted courses (title, _id, updatedAt only).

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    { "_id": "507f1f77bcf86cd799439011", "title": "My Course", "updatedAt": "2026-03-24T10:00:00Z" }
  ]
}
```

**Errors:**
- 401: Unauthorized

---

### Get Course by ID

**GET** `/courses/:id`

Fetch the full course document including all slides, templates, and metadata.

**Path Parameters:**
- `id` (string, required): MongoDB ObjectId

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "title": "My Course",
    "slides": [...],
    "templates": [...],
    "resources": [...],
    "settings": {...},
    "metadata": {...},
    "createdAt": "2026-03-01T08:00:00Z",
    "updatedAt": "2026-03-24T10:00:00Z"
  }
}
```

**Errors:**
- 400: Invalid ObjectId
- 401: Unauthorized
- 404: Course not found

---

### Create Course

**POST** `/courses`

Create a new empty course.

**Request Body:**
```json
{
  "title": "New Course"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439012",
    "title": "New Course",
    "slides": [],
    "templates": [],
    "resources": [],
    "createdAt": "2026-03-24T10:00:00Z",
    "updatedAt": "2026-03-24T10:00:00Z"
  }
}
```

**Errors:**
- 401: Unauthorized

---

### Update Course

**PUT** `/courses/:id`

Fully replace allowed fields (title, slides, templates, resources, settings, metadata).

**Path Parameters:**
- `id` (string, required): MongoDB ObjectId

**Request Body:**
```json
{
  "title": "Updated Title",
  "slides": [...],
  "templates": [...],
  "resources": [...],
  "settings": {...},
  "metadata": {...}
}
```

**Response** (200 OK): Full updated course document

**Errors:**
- 400: Invalid ObjectId
- 401: Unauthorized
- 404: Course not found

---

### Delete Course (Soft)

**DELETE** `/courses/:id`

Soft-delete a course (sets deletedAt timestamp, recoverable).

**Path Parameters:**
- `id` (string, required): MongoDB ObjectId

**Response** (200 OK):
```json
{
  "success": true,
  "data": null
}
```

**Errors:**
- 400: Invalid ObjectId
- 401: Unauthorized
- 404: Course not found

---

## Slides

### Add Slide

**POST** `/courses/:id/slides`

Atomically append a new slide to a course.

**Path Parameters:**
- `id` (string, required): Course ObjectId

**Request Body:**
```json
{
  "title": "Introduction"
}
```

**Response** (201 Created): Full updated course document with new slide appended

**Errors:**
- 400: Invalid ObjectId
- 401: Unauthorized
- 404: Course not found

---

### Update Slide

**PATCH** `/courses/:id/slides/:slideId`

Update specific fields of a slide (title, widgets, actions, thumbnail).

**Path Parameters:**
- `id` (string, required): Course ObjectId
- `slideId` (string, required): Slide UUID

**Request Body:**
```json
{
  "title": "Updated Title",
  "widgets": [...],
  "actions": [...],
  "thumbnail": "https://..."
}
```

**Response** (200 OK): Full updated course document

**Errors:**
- 400: Invalid ObjectId or no updatable fields
- 401: Unauthorized
- 404: Course or slide not found

---

### Delete Slide

**DELETE** `/courses/:id/slides/:slideId`

Remove a slide from a course.

**Path Parameters:**
- `id` (string, required): Course ObjectId
- `slideId` (string, required): Slide UUID

**Response** (200 OK): Full updated course document with slide removed

**Errors:**
- 400: Invalid ObjectId
- 401: Unauthorized
- 404: Course not found

---

### Reorder Slides

**PATCH** `/courses/:id/slides/reorder`

Reorder all slides by providing a complete ordered array of slide IDs. The `orderedIds` array **must contain every slide ID** in the course — partial arrays are rejected. Slides are reindexed to match the provided order exactly.

**Path Parameters:**
- `id` (string, required): Course ObjectId

**Request Body:**
```json
{
  "orderedIds": ["slide-uuid-1", "slide-uuid-2", "slide-uuid-3"]
}
```

**Response** (200 OK): Full updated course document

**Errors:**
- 400: Invalid ObjectId, empty orderedIds, or IDs don't match existing slides
- 401: Unauthorized
- 404: Course not found

---

## Assets

### Upload Asset

**POST** `/assets/upload`

Upload media file (image, video, audio, PDF) to Garage S3 storage.

**Request Body:** Form-data with `file` field

**Query Parameters:**
- `courseId` (string, optional): Associate asset with course (for storage organization)

**Accepted MIME Types:**
- Images: `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `image/svg+xml`
- Video: `video/mp4`, `video/webm`
- Audio: `audio/mpeg`, `audio/ogg`, `audio/wav`
- Documents: `application/pdf`

**Constraints:**
- **Max file size**: 50 MB (configurable via `MAX_ASSET_SIZE_MB` environment variable)
- **Rate limit**: 20 uploads per 15 minutes per user
- **SVG files**: Served as `Content-Disposition: attachment` to prevent XSS attacks
- **Empty files**: Not allowed (must be > 0 bytes)

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "objectName": "550e8400-e29b-41d4-a716-446655440000.jpg",
    "url": "https://garage.example.com/bucket/550e8400-e29b-41d4-a716-446655440000.jpg",
    "mimeType": "image/jpeg",
    "sizeBytes": 102400
  }
}
```

**Error Responses:**
- **400**: Invalid MIME type, empty file, or invalid form data
  ```json
  { "success": false, "error": "image/heic is not an accepted MIME type" }
  ```
- **401**: Unauthorized — missing or invalid authentication token
- **413**: Payload too large — file exceeds 50 MB limit
  ```json
  { "success": false, "error": "File exceeds maximum size of 50 MB" }
  ```
- **415**: Unsupported media type — MIME type not in accepted list
- **429**: Too many upload requests — rate limit exceeded
  ```json
  { "success": false, "error": "Rate limit exceeded: 20 uploads per 15 minutes" }
  ```
- **500**: S3 storage error

---

### Get Presigned URL

**GET** `/assets/presigned`

Get a temporary presigned URL for downloading an asset from S3.

**Query Parameters:**
- `objectName` (string, required): UUID + extension (e.g., 550e8400-e29b-41d4-a716-446655440000.jpg)
- `expirySeconds` (number, optional): URL expiry in seconds (default 3600, max 86400)

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "url": "https://garage.example.com/bucket/550e8400...?X-Amz-Signature=..."
  }
}
```

**Errors:**
- 400: Invalid object name, expiry out of range
- 401: Unauthorized
- 404: Asset not found in S3

---

### Delete Asset

**DELETE** `/assets/:objectName`

Remove an asset from S3 storage.

**Path Parameters:**
- `objectName` (string, required): UUID + extension

**Response** (200 OK):
```json
{
  "success": true,
  "data": null
}
```

**Errors:**
- 400: Invalid object name
- 401: Unauthorized
- 404: Asset not found

---

## Audit History

### Get Course History

**GET** `/courses/:id/history`

Fetch paginated audit log for a course (newest first).

**Note:** History is tracked at the **course level** (all slides and resources within a course), not at the slide level. This is why the endpoint uses `/courses/:id/history` rather than `/courses/:id/slides/:slideId/history`. All modifications to any part of the course (slides added, widgets updated, assets uploaded) are recorded in this single audit trail.

**Path Parameters:**
- `id` (string, required): Course ObjectId

**Query Parameters:**
- `limit` (number, optional): Results per page (default 50, max 200)
- `skip` (number, optional): Offset (default 0)

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "courseId": "507f1f77bcf86cd799439011",
      "action": "slide.update",
      "userId": "user-123",
      "details": { "slideId": "...", "fields": ["title", "widgets"] },
      "createdAt": "2026-03-24T10:00:00Z"
    }
  ],
  "meta": {
    "total": 45,
    "limit": 50,
    "skip": 0
  }
}
```

**Errors:**
- 400: Invalid ObjectId
- 401: Unauthorized

---

## Export

### Export to SCORM 1.2

**POST** `/courses/:id/export/scorm12`

Generate and download a SCORM 1.2 compliant ZIP package.

**Path Parameters:**
- `id` (string, required): Course ObjectId

**Response** (200 OK): Binary ZIP file download

**File Contents:**
- `imsmanifest.xml` — SCORM manifest
- `player.js` — Runtime player
- `assets/` — Course media files
- `suspend_data.json` — Initial state

**Errors:**
- 400: Invalid ObjectId
- 401: Unauthorized
- 404: Course not found
- 429: Too many export requests (rate limited: 5 per 15 min per user)
- 500: Package generation failed

---

## Authentication

### Register

**POST** `/auth/register`

Create a new user account. Only available if `ALLOW_REGISTRATION=true` env var is set.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ0eXAiOiJKV1QiLCJhbGc...",
    "refreshToken": "7f8g9h0i1j2k3l4m5n6o7p8q9r0s1t2u3v4w5x6"
  }
}
```

**Errors:**
- 400: Email already registered, weak password
- 403: Registration disabled

---

### Login

**POST** `/auth/login`

Authenticate and receive access/refresh tokens.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ0eXAiOiJKV1QiLCJhbGc...",
    "refreshToken": "7f8g9h0i1j2k3l4m5n6o7p8q9r0s1t2u3v4w5x6"
  }
}
```

**Cookies:** Sets httpOnly refresh token cookie.

**Errors:**
- 401: Invalid email or password

---

### Refresh Token

**POST** `/auth/refresh`

Exchange refresh token for new access token.

**Cookies:** Requires refreshToken in httpOnly cookie

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ0eXAiOiJKV1QiLCJhbGc..."
  }
}
```

**Errors:**
- 401: Invalid or expired refresh token

---

### Logout

**POST** `/auth/logout`

Clear refresh token and invalidate session.

**Response** (200 OK):
```json
{
  "success": true,
  "data": null
}
```

---

## Health Check

### API Health

**GET** `/health`

Simple health check endpoint (no authentication required).

**Response** (200 OK):
```json
{
  "success": true,
  "data": { "status": "ok", "timestamp": "2026-03-24T10:00:00Z" }
}
```

---

## Error Codes

| Code | Meaning |
|------|---------|
| 400 | Bad Request — validation failed |
| 401 | Unauthorized — missing/invalid token |
| 403 | Forbidden — access denied |
| 404 | Not Found — resource does not exist |
| 413 | Payload Too Large — file exceeds size limit |
| 429 | Too Many Requests — rate limited |
| 500 | Internal Server Error — unhandled exception |

---

## Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/assets/upload` | 20 per user | 15 minutes |
| `/courses/:id/export/scorm12` | 5 per user | 15 minutes |

Rate limit info is returned in response headers: `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`.

---

## Authentication Header

Include Bearer token in all requests:

```
Authorization: Bearer <accessToken>
```

Access tokens expire after 1 hour. Use the `/auth/refresh` endpoint to get a new one.

---

## Pagination

Endpoints that support pagination use `limit` and `skip` query parameters:

```
GET /courses/:id/history?limit=20&skip=40
```

Response includes metadata:

```json
{
  "meta": {
    "total": 100,
    "limit": 20,
    "skip": 40
  }
}
```
