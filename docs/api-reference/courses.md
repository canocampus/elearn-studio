# Courses

Course CRUD and slide atomic operations.

All endpoints require `Authorization: Bearer <token>`.

---

## GET /courses

List all non-deleted courses, sorted by `updatedAt` descending.

**Returns:** summary only — `_id`, `title`, `updatedAt`. Use `GET /courses/:id` for the full document.

**Responses:**

| Status | Body |
|---|---|
| `200` | `{ success: true, data: [...] }` — array of course summaries |
| `401` | Unauthorized |

**curl:**

```bash
curl http://localhost:3001/courses \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

**Response:**

```json
{
  "success": true,
  "data": [
    { "_id": "64e1f2a3b4c5d6e7f8a9b0c1", "title": "Safety Procedures", "updatedAt": "2026-03-24T10:00:00.000Z" },
    { "_id": "64e1f2a3b4c5d6e7f8a9b0c2", "title": "New Employee Onboarding", "updatedAt": "2026-03-23T15:30:00.000Z" }
  ]
}
```

---

## POST /courses

Create a new course with an empty slide list.

**Request body:**

```typescript
interface CreateCourseRequest {
  title?: string  // default: "Untitled Course", max 200 chars
}
```

**Responses:**

| Status | Body |
|---|---|
| `201` | Full course document |
| `401` | Unauthorized |

**curl:**

```bash
curl -X POST http://localhost:3001/courses \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Safety Procedures"}'
```

**Response:**

```json
{
  "success": true,
  "data": {
    "_id": "64e1f2a3b4c5d6e7f8a9b0c1",
    "title": "Safety Procedures",
    "slides": [],
    "templates": [],
    "resources": [],
    "settings": {},
    "metadata": {},
    "createdAt": "2026-03-24T10:00:00.000Z",
    "updatedAt": "2026-03-24T10:00:00.000Z"
  }
}
```

---

## GET /courses/:id

Retrieve the full course document including all slides and widgets.

**Path parameters:**

| Parameter | Type | Description |
|---|---|---|
| `id` | string | MongoDB ObjectId |

**Responses:**

| Status | Body |
|---|---|
| `200` | Full course document |
| `400` | Invalid ObjectId format |
| `404` | Course not found or deleted |

**curl:**

```bash
curl http://localhost:3001/courses/64e1f2a3b4c5d6e7f8a9b0c1 \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

---

## PUT /courses/:id

Replace allowed fields on a course. Only the listed fields are writable — other properties are ignored.

**Path parameters:**

| Parameter | Type | Description |
|---|---|---|
| `id` | string | MongoDB ObjectId |

**Request body:**

```typescript
interface UpdateCourseRequest {
  title?:     string       // max 200 chars
  slides?:    Slide[]
  templates?: SlideTemplate[]
  resources?: Resource[]
  settings?:  CourseSettings
  metadata?:  SCORMMetadata
}
```

**Responses:**

| Status | Body |
|---|---|
| `200` | Updated course document |
| `400` | Invalid ObjectId |
| `404` | Course not found |

**curl:**

```bash
curl -X PUT http://localhost:3001/courses/64e1f2a3b4c5d6e7f8a9b0c1 \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Safety Procedures — Updated"}'
```

> For slide content, prefer the atomic slide endpoints below over `PUT /courses/:id` to avoid race conditions when multiple saves overlap.

---

## DELETE /courses/:id

Soft-delete a course. The course is excluded from `GET /courses` list but remains in MongoDB.

**Path parameters:**

| Parameter | Type | Description |
|---|---|---|
| `id` | string | MongoDB ObjectId |

**Responses:**

| Status | Body |
|---|---|
| `200` | `{ success: true, data: null }` |
| `400` | Invalid ObjectId |
| `404` | Course not found or already deleted |

**curl:**

```bash
curl -X DELETE http://localhost:3001/courses/64e1f2a3b4c5d6e7f8a9b0c1 \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

---

## Slide Sub-Resource

Slide endpoints use MongoDB atomic operators (`$push`, `$pull`, `$set`) to avoid the fetch-modify-PUT race condition. Each endpoint returns the full updated course document.

### POST /courses/:id/slides

Append a new slide to a course.

**Path parameters:**

| Parameter | Type | Description |
|---|---|---|
| `id` | string | Course ObjectId |

**Request body:**

```typescript
interface CreateSlideRequest {
  title?: string  // default: "New Slide", max 200 chars
}
```

**Responses:**

| Status | Body |
|---|---|
| `201` | Updated course document |
| `400` | Invalid ObjectId |
| `401` | Unauthorized |
| `404` | Course not found |

**curl:**

```bash
curl -X POST http://localhost:3001/courses/64e1f2a3b4c5d6e7f8a9b0c1/slides \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Introduction"}'
```

---

### PATCH /courses/:id/slides/:slideId

Update one or more fields on a single slide. Fields not present in the body are left unchanged.

**Path parameters:**

| Parameter | Type | Description |
|---|---|---|
| `id` | string | Course ObjectId |
| `slideId` | string | Slide UUID |

**Request body:**

```typescript
interface UpdateSlideRequest {
  title?:     string    // max 200 chars
  widgets?:   Widget[]
  actions?:   ActionSequence[]
  thumbnail?: string    // URL
}
```

At least one field must be provided.

**Responses:**

| Status | Body |
|---|---|
| `200` | Updated course document |
| `400` | Invalid ObjectId or no updatable fields provided |
| `401` | Unauthorized |
| `404` | Course or slide not found |

**curl:**

```bash
curl -X PATCH \
  http://localhost:3001/courses/64e1f2a3b4c5d6e7f8a9b0c1/slides/a1b2c3d4-e5f6-7890-abcd-ef1234567890 \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Welcome"}'
```

---

### DELETE /courses/:id/slides/:slideId

Remove a slide from a course.

**Path parameters:**

| Parameter | Type | Description |
|---|---|---|
| `id` | string | Course ObjectId |
| `slideId` | string | Slide UUID |

**Responses:**

| Status | Body |
|---|---|
| `200` | Updated course document |
| `400` | Invalid ObjectId |
| `401` | Unauthorized |
| `404` | Course not found |

**curl:**

```bash
curl -X DELETE \
  http://localhost:3001/courses/64e1f2a3b4c5d6e7f8a9b0c1/slides/a1b2c3d4-e5f6-7890-abcd-ef1234567890 \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

---

### PATCH /courses/:id/slides/reorder

Reorder all slides by supplying the complete ordered array of slide IDs. All existing slide IDs must be present — missing IDs return `400`.

**Path parameters:**

| Parameter | Type | Description |
|---|---|---|
| `id` | string | Course ObjectId |

**Request body:**

```typescript
interface ReorderSlidesRequest {
  orderedIds: string[]  // non-empty array of slide UUIDs in desired order
}
```

**Responses:**

| Status | Body |
|---|---|
| `200` | Updated course document |
| `400` | Invalid ObjectId, empty array, or slide IDs mismatch |
| `401` | Unauthorized |
| `404` | Course not found |

**curl:**

```bash
curl -X PATCH http://localhost:3001/courses/64e1f2a3b4c5d6e7f8a9b0c1/slides/reorder \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"orderedIds": ["slide-uuid-2", "slide-uuid-1", "slide-uuid-3"]}'
```
