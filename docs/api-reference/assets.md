# Assets

Upload and retrieve media files stored in Garage S3.

All endpoints require `Authorization: Bearer <token>`.

---

## Allowed file types

| MIME type | Extensions |
|---|---|
| `image/jpeg` | `.jpg`, `.jpeg` |
| `image/png` | `.png` |
| `image/gif` | `.gif` |
| `image/webp` | `.webp` |
| `image/svg+xml` | `.svg` |
| `video/mp4` | `.mp4` |
| `video/webm` | `.webm` |
| `audio/mpeg` | `.mp3` |
| `audio/ogg` | `.ogg` |
| `audio/wav` | `.wav` |
| `application/pdf` | `.pdf` |

Override the allowlist via `ALLOWED_MIME_TYPES` environment variable (comma-separated).

**SVG uploads:** Script elements, `<foreignObject>` blocks, and inline event handlers (`on*`) are stripped at upload time.

**Size limit:** 50 MB per file. Configure via `MAX_ASSET_SIZE_MB` environment variable.

---

## POST /assets

Upload a file to Garage. Returns the asset URL path and object name.

**Auth:** `Authorization: Bearer <token>`

**Rate limit:** 20 uploads per 15 minutes per user.

**Request:** `multipart/form-data` with a `file` field.

**Responses:**

| Status | Body |
|---|---|
| `201` | `{ success: true, data: { url, objectName, originalName } }` |
| `400` | No file provided |
| `401` | Unauthorized |
| `413` | File exceeds size limit |
| `415` | MIME type not allowed |
| `429` | Rate limit exceeded |
| `503` | Storage service unavailable |

**curl:**

```bash
curl -X POST http://localhost:3001/assets \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -F "file=@/path/to/image.png"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "url": "/assets/a1b2c3d4-e5f6-4789-abcd-ef0123456789.png",
    "objectName": "a1b2c3d4-e5f6-4789-abcd-ef0123456789.png",
    "originalName": "image.png"
  }
}
```

Store the `url` field in your Widget's `extendedProperties` or `src` attribute. Use `GET /assets/:objectName` to retrieve the asset.

---

## GET /assets/:objectName

Retrieve an asset. Returns a `302` redirect to a time-limited Garage pre-signed URL (1 hour expiry).

The object name must match the UUID + whitelisted extension pattern. Requests with invalid patterns return `400`.

**SVG and PDF files** are served with `Content-Disposition: attachment` to prevent browser execution.

**Auth:** `Authorization: Bearer <token>`

**Path parameters:**

| Parameter | Type | Description |
|---|---|---|
| `objectName` | string | UUID + extension (e.g., `a1b2c3d4-e5f6-4789-abcd-ef0123456789.png`) |

**Responses:**

| Status | Description |
|---|---|
| `302` | Redirect to pre-signed Garage URL |
| `400` | Invalid asset name format |
| `401` | Unauthorized |
| `503` | Storage service unavailable |

**curl:**

```bash
# Follow the redirect (-L) to download the file
curl -L http://localhost:3001/assets/a1b2c3d4-e5f6-4789-abcd-ef0123456789.png \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -o downloaded.png
```

> The pre-signed URL in the `Location` header is time-limited. Do not cache it — call `GET /assets/:objectName` each time you need the file.
