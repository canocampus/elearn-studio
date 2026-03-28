# History

Audit log for course and slide changes. Every mutating operation on a course (create, update, delete, slide add/update/delete/reorder) writes an entry to the audit log.

All endpoints require `Authorization: Bearer <token>`.

---

## GET /courses/:id/history

Retrieve paginated audit log entries for a course, newest first.

**Auth:** `Authorization: Bearer <token>`

**Path parameters:**

| Parameter | Type | Description |
|---|---|---|
| `id` | string | MongoDB ObjectId of the course |

**Query parameters:**

| Parameter | Type | Default | Maximum | Description |
|---|---|---|---|---|
| `limit` | integer | `50` | `200` | Number of entries to return |
| `skip` | integer | `0` | — | Number of entries to skip (for pagination) |

**Responses:**

| Status | Body |
|---|---|
| `200` | Paginated audit entries |
| `400` | Invalid ObjectId |
| `401` | Unauthorized |

**curl:**

```bash
# Most recent 10 entries
curl "http://localhost:3001/courses/64e1f2a3b4c5d6e7f8a9b0c1/history?limit=10" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "64e1f2a3b4c5d6e7f8a9b0d1",
      "courseId": "64e1f2a3b4c5d6e7f8a9b0c1",
      "action": "slide.update",
      "userId": "64e1f2a3b4c5d6e7f8a9b0c1",
      "userEmail": "author@example.com",
      "meta": {
        "slideId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "fields": ["widgets"]
      },
      "createdAt": "2026-03-24T10:05:00.000Z"
    },
    {
      "_id": "64e1f2a3b4c5d6e7f8a9b0d0",
      "courseId": "64e1f2a3b4c5d6e7f8a9b0c1",
      "action": "course.create",
      "userId": "64e1f2a3b4c5d6e7f8a9b0c1",
      "userEmail": "author@example.com",
      "meta": { "title": "Safety Procedures" },
      "createdAt": "2026-03-24T10:00:00.000Z"
    }
  ],
  "meta": {
    "total": 2,
    "limit": 10,
    "skip": 0
  }
}
```

---

## Audit Actions

| Action | Trigger |
|---|---|
| `course.create` | `POST /courses` |
| `course.update` | `PUT /courses/:id` |
| `course.delete` | `DELETE /courses/:id` |
| `slide.create` | `POST /courses/:id/slides` |
| `slide.update` | `PATCH /courses/:id/slides/:slideId` |
| `slide.delete` | `DELETE /courses/:id/slides/:slideId` |
| `slide.reorder` | `PATCH /courses/:id/slides/reorder` |

---

## Pagination example

```bash
# Page 1
curl "http://localhost:3001/courses/:id/history?limit=20&skip=0" \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# Page 2
curl "http://localhost:3001/courses/:id/history?limit=20&skip=20" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

Use `meta.total` to determine the total number of pages: `Math.ceil(meta.total / limit)`.

> The `meta` envelope shape (`total`, `limit`, `skip`) is the standard `PaginatedEnvelope` used across all paginated endpoints — see [Response Envelope](index.md#response-envelope) in the API reference index.
