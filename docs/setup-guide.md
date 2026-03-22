# eLearn Studio — Setup Guide

## Prerequisites

- [Docker Desktop](https://docs.docker.com/desktop/) (Engine ≥ 24)
- [Node.js](https://nodejs.org/) ≥ 20 LTS
- [pnpm](https://pnpm.io/) ≥ 9 (`npm install -g pnpm`)

---

## First-Run Checklist

```
[ ] Docker Desktop running
[ ] pnpm installed globally
[ ] .env file created from .env.example (optional — defaults work for local dev)
[ ] pnpm install run from repo root
[ ] Core Docker services started
[ ] API health check returns 200
```

---

## Docker Services

### Core stack (required for development)

```bash
docker compose -f docker/docker-compose.yml up -d mongo garage garage-init
```

`garage-init` is a one-shot container that bootstraps the Garage bucket. It exits after
completion — this is expected behaviour (`restart: "no"`).

> **Startup timing:** `docker compose up -d` returns immediately, but `garage-init`
> takes 10–20 seconds to complete. The API waits for `garage-init` via
> `service_completed_successfully`. Verify readiness before making requests:
> ```bash
> docker compose -f docker/docker-compose.yml logs -f garage-init
> # Wait for: "Garage initialization complete. Bucket 'elearn-assets' is ready."
> ```

### Full stack (includes API + UI)

```bash
docker compose -f docker/docker-compose.yml up -d
```

### Moodle SCORM testing (optional, ~10 min first pull)

```bash
docker compose -f docker/docker-compose.yml --profile moodle up -d
```

---

## Service URLs

| Service | URL | Credentials |
|---------|-----|-------------|
| API | http://localhost:3001 | `X-Api-Key: <API_KEY>` (optional in dev) |
| API health | http://localhost:3001/health | None required |
| Garage S3 API | http://localhost:3900 | `GARAGE_ACCESS_KEY` / `GARAGE_SECRET_KEY` |
| Garage admin API | http://localhost:3903 | None (unauthenticated in dev) |
| Authoring UI | http://localhost:3000 | — |
| Moodle LMS | http://localhost:8081 | `admin` / `Admin1234!` |

---

## Garage Object Storage

eLearn Studio uses [Garage](https://garagehq.deuxfleurs.fr/) (v1.0.0) as its S3-compatible
object storage backend. Garage is written in Rust, AGPL-licensed, and actively maintained.

### Why Garage

- **Actively maintained** — v1.0 released 2024, regular releases
- **True S3-compatible** — works with `@aws-sdk/client-s3` and `forcePathStyle: true`
- **Single-node friendly** — `replication_factor = 1` for development
- **Lightweight** — Rust binary, minimal resource usage
- **AGPL licensed** — free for self-hosted use

### `garage.toml` configuration

Located at `docker/garage.toml`:

```toml
metadata_dir = "/var/lib/garage/meta"
data_dir     = "/var/lib/garage/data"
db_engine    = "lmdb"
replication_factor = 1

rpc_bind_addr   = "[::]:3901"
rpc_public_addr = "garage:3901"
rpc_secret = "0000111122223333444455556666777788889999aaaabbbbccccddddeeeeffff"

[s3_api]
s3_region    = "garage"
api_bind_addr = "[::]:3900"
root_domain  = ""

[admin]
api_bind_addr = "0.0.0.0:3903"
admin_token = "garage-admin-dev"
```

> **Garage v1.0.0 requires `admin_token`** — without it the admin API is disabled entirely
> (returns 403). The default `garage-admin-dev` token is safe for local dev. Override via
> `GARAGE_ADMIN_TOKEN` in `.env` for production.

### Bucket init procedure (`garage-init.sh`)

The `garage-init` service runs `docker/garage-init.sh` once after Garage is healthy.
The script calls the Garage admin REST API (port 3903) to bootstrap the cluster:

1. **Wait for health** — polls `GET /v1/health` until 200
2. **Get node ID** — `GET /v1/status` → extract first node ID
3. **Assign layout** — `POST /v1/layout` with zone=dc1, capacity=1GiB
4. **Apply layout** — queries current version, skips if no staged changes, otherwise `POST /v1/layout/apply` with version=current+1
5. **Import key** — `POST /v1/key/import` with known access/secret key pair
6. **Create bucket** — `POST /v1/bucket` with `globalAlias: "elearn-assets"`
7. **Get bucket ID** — `GET /v1/bucket?globalAlias=elearn-assets`
8. **Grant permissions** — `POST /v1/bucket/allow` with read+write+owner

All steps are idempotent — re-running the container on an already-initialised Garage
logs warnings but does not fail.

---

## Environment Variables

Copy `.env.example` to `.env` and override as needed. All have working defaults for local dev.

> **Critical:** `GARAGE_ACCESS_KEY` and `GARAGE_SECRET_KEY` must be **identical** in both
> the API and the `garage-init` container. If they differ, `garage-init` imports a key with
> credentials the API cannot use — uploads will fail with 403. When changing these values,
> update `.env` and restart both `garage-init` and `api`.

### API (`backend/api`)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | HTTP listen port |
| `MONGO_URI` | `mongodb://localhost:27017/elearn` | MongoDB connection string |
| `GARAGE_ENDPOINT` | `localhost` | Garage S3 host |
| `GARAGE_PORT` | `3900` | Garage S3 port |
| `GARAGE_REGION` | `garage` | S3 region (must match `garage.toml`) |
| `GARAGE_USE_SSL` | `false` | Enable TLS |
| `GARAGE_ACCESS_KEY` | `GK000000000000000000000001` | Garage access key |
| `GARAGE_SECRET_KEY` | `0000000000000000000000000000000000000000000000000000000000000001` | Garage secret key |
| `GARAGE_BUCKET` | `elearn-assets` | Bucket name |
| `API_KEY` | _(unset)_ | If set, all routes except `/health` require `X-Api-Key` header |
| `CORS_ORIGIN` | `http://localhost:3000` | Allowed CORS origin |

### Docker Compose overrides

| Variable | Default | Description |
|----------|---------|-------------|
| `GARAGE_ACCESS_KEY` | `GK000000000000000000000001` | Shared by API and garage-init containers |
| `GARAGE_SECRET_KEY` | `0000000000000000000000000000000000000000000000000000000000000001` | Shared by API and garage-init containers |
| `CORS_ORIGIN` | `http://localhost:3000` | Frontend origin for CORS |
| `MOODLE_DB_PASSWORD` | `moodle_pass` | Moodle PostgreSQL password |
| `MOODLE_ADMIN_USER` | `admin` | Moodle admin username |
| `MOODLE_ADMIN_PASSWORD` | `Admin1234!` | Moodle admin password |

---

## Development

### Install all workspace dependencies

```bash
pnpm install
```

### Run API in dev mode (hot-reload)

```bash
# Ensure mongo + garage are running first
pnpm --filter @elearn-studio/api dev
```

### Run API tests

```bash
# Requires Docker mongo running on localhost:27017
pnpm --filter @elearn-studio/api test
```

Run a single test file:

```bash
cd backend/api && npx vitest run src/__tests__/courses.test.ts
```

### Build all packages

```bash
pnpm -r build
```

### TypeScript check (no emit)

```bash
# From repo root
node node_modules/.bin/tsc --noEmit -p backend/api/tsconfig.json
```

---

## Verifying the Stack

```bash
# 1. Verify garage-init completed successfully
docker compose -f docker/docker-compose.yml logs garage-init | tail -5
# Expected last line: "Garage initialization complete.  Bucket 'elearn-assets' is ready."

# 2. API health (expects {"status":"ok","mongo":"ok","storage":"ok"})
curl http://localhost:3001/health

# 3. Create a course (if API_KEY is set, add: -H 'X-Api-Key: <value>')
curl -X POST http://localhost:3001/courses \
  -H 'Content-Type: application/json' \
  -d '{"title":"Test Course"}'

# 4. Garage admin API
curl http://localhost:3903/v1/health
# Expected: {"status":"ok"}

# 5. List Garage buckets (verify elearn-assets exists)
curl http://localhost:3903/v1/bucket/all
# Should include "elearn-assets"
```

> **API_KEY:** If `API_KEY` is set in your `.env`, all routes except `/health` require the
> header `-H 'X-Api-Key: <your-api-key>'`. Omitting it returns 401.

---

## Troubleshooting

### Port conflict on `docker compose up`
Ports 27017 (MongoDB), 3900/3903 (Garage), 3001 (API), and 3000 (UI) must be free.
Check what is using them:
```bash
# Windows
netstat -ano | findstr "27017\|3900\|3903\|3001\|3000"
# macOS / Linux
lsof -i :27017 -i :3900 -i :3903 -i :3001 -i :3000
```
Stop conflicting services or change ports in `.env` and `docker-compose.yml`.

### `EPERM chmod` during pnpm install on Windows
Cosmetic — pnpm tries to set Unix permissions on NTFS. Install completes successfully; ignore the warning.

### API returns 401 Unauthorized
`API_KEY` env var is set. Either unset it for local dev, or pass `X-Api-Key: <value>` header.

### Garage bucket not found / storage error
The bucket is created by `garage-init` on first `docker compose up`. If it fails:
```bash
# Check garage-init logs
docker compose -f docker/docker-compose.yml logs garage-init

# Re-run just the init container
docker compose -f docker/docker-compose.yml run --rm garage-init
```

### `garage-init` exits with error on second run
Expected — the layout/key/bucket already exist. Warnings like "key already exists" are
harmless. The `service_completed_successfully` condition means the API waits for the
container to exit 0, which happens even when skipping already-completed steps.

### Tests fail with "MongoServerError: connect ECONNREFUSED"
The test suite connects to Docker MongoDB on `localhost:27017`. Start it with:
```bash
docker compose -f docker/docker-compose.yml up -d mongo
```
Override with `MONGO_URI_TEST=mongodb://...` env var to point elsewhere.

### Moodle first-run takes a long time
First run installs the Moodle database (~5 minutes). The `healthcheck` `start_period` is
set to 300 seconds to accommodate this. Check progress:
```bash
docker compose -f docker/docker-compose.yml --profile moodle logs -f moodle
```
Wait for the container health status to become `healthy` before accessing the UI.

### Moodle image pull fails
Uses `bitnamilegacy/moodle` image. Moodle services are opt-in via `--profile moodle`
and not required for core development.
