# Export

Generate SCORM packages from a course for LMS upload.

All endpoints require `Authorization: Bearer <token>`.

---

## POST /courses/:id/export/scorm12

Generate a SCORM 1.2 ZIP archive and stream it as a file download.

**Auth:** `Authorization: Bearer <token>`

**Rate limit:** 5 requests per 15 minutes per user. Exports are CPU and disk intensive — the rate limit prevents overload from repeated requests.

**Path parameters:**

| Parameter | Type | Description |
|---|---|---|
| `id` | string | MongoDB ObjectId of the course |

**Request body:** None

**Responses:**

| Status | Description |
|---|---|
| `200` | `application/zip` file download — `Content-Disposition: attachment; filename="<course-title>_scorm12.zip"` |
| `400` | Invalid ObjectId |
| `401` | Unauthorized |
| `404` | Course not found |
| `429` | Too many export requests |
| `500` | Package generation failed |

**curl:**

```bash
curl -X POST http://localhost:3001/courses/64e1f2a3b4c5d6e7f8a9b0c1/export/scorm12 \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -o safety_procedures_scorm12.zip
```

**ZIP contents:**

```
<course-title>_scorm12/
├── imsmanifest.xml           # SCORM 1.2 manifest
├── adlcp_rootv1p2.xsd        # schema files
├── ims_xml.xsd
├── imscp_rootv1p1p2.xsd
├── index.html                # course entry point
├── player.js                 # runtime player bundle
├── phaser-bundle.js          # (only if course contains phaser-sim widgets)
└── assets/                   # bundled course media files
    ├── <uuid>.png
    └── ...
```

**Asset Bundling Process:**

The export endpoint automatically collects and bundles all assets referenced by the course:

1. **Extraction** — Scans all slide widgets for asset references (e.g., `/assets/<uuid>.ext`)
2. **Download** — Fetches assets from Garage S3 to a temporary directory
3. **Rewriting** — Replaces absolute asset paths (`/assets/`) with relative paths (`assets/`) in the slide HTML
4. **Packaging** — Bundles rewritten assets into the ZIP under the `assets/` folder

This process ensures the course package is self-contained and runs offline in the LMS without requiring external asset requests. Asset URLs in the Course JSON are automatically rewritten during export.

**Phaser Bundle Inclusion:**

The `phaser-bundle.js` file is only included in the ZIP if the course contains at least one `phaser-sim` widget. This keeps packages small when advanced simulations are not used.

The generated file name uses the course title with non-alphanumeric characters replaced by underscores, truncated to 64 characters.

---

## Uploading to Moodle

1. Download the SCORM ZIP using the curl command above.
2. In Moodle: **Course** → **Add activity** → **SCORM package** → upload the ZIP.
3. Set **Grading method** and **Attempts allowed** as required.
4. Save and test with a learner account.

Moodle is available at `http://localhost:8081` in the dev Docker stack.
