# Local Setup

Covers cloning, installing, starting the dev stack, running tests, and hot reload.

---

## Prerequisites

| Tool | Minimum version | Install |
|---|---|---|
| Node.js | 20 LTS | https://nodejs.org |
| pnpm | 9 | `npm install -g pnpm@9` |
| Docker Desktop | 4.x | https://docs.docker.com/get-docker/ |
| Git | 2.x | https://git-scm.com |

---

## Installation

```bash
# 1. Clone the repository
git clone https://github.com/your-org/elearn-studio.git
cd elearn-studio

# 2. Install all workspace dependencies
pnpm install

# 3. Copy the environment template
cp docker/.env.example docker/.env
```

Edit `docker/.env` and set at minimum:

| Variable | Default | Description |
|---|---|---|
| `MONGO_URL` | `mongodb://mongo:27017/elearn` | MongoDB connection string |
| `GARAGE_ENDPOINT` | `http://garage:3900` | Garage S3 endpoint |
| `GARAGE_ACCESS_KEY` | `root-key` | Garage root access key |
| `GARAGE_SECRET_KEY` | `root-secret` | Garage root secret |
| `JWT_SECRET` | — | **Required.** Set a random 64-char string |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated allowed origins |
| `LOG_LEVEL` | `info` | `debug` \| `info` \| `warn` \| `error` |

---

## Start the dev stack

```bash
# Start infrastructure services (MongoDB, Garage, Grafana stack)
docker compose -f docker/docker-compose.dev.yml up -d

# Start all packages in dev mode (hot reload)
pnpm dev
```

### Verify services are running

```bash
docker compose -f docker/docker-compose.dev.yml ps
# NAME         STATUS    PORTS
# mongo        running   27017/tcp
# garage       running   0.0.0.0:3900->3900/tcp, 0.0.0.0:3903->3903/tcp
# grafana      running   0.0.0.0:3010->3000/tcp
# loki         running   3100/tcp
# tempo        running   3200/tcp
# prometheus   running   0.0.0.0:9090->9090/tcp
```

### Service URLs

| Service | URL | Credentials |
|---|---|---|
| Authoring UI | http://localhost:3000 | — |
| Backend API | http://localhost:3001 | Bearer token |
| API Health | http://localhost:3001/health | Public |
| Swagger UI | http://localhost:3001/docs | Public |
| Garage S3 API | http://localhost:3900 | AWS SDK |
| Garage Admin API | http://localhost:3903 | Admin key |
| Grafana | http://localhost:3010 | admin / admin |
| Prometheus | http://localhost:9090 | — |
| Moodle | http://localhost:8081 | admin / admin (first run ~5 min) |

---

## Running tests

```bash
# All packages — unit tests
pnpm test

# Single package
pnpm --filter question-engine test
pnpm --filter authoring-ui test
pnpm --filter @elearn-studio/api test

# Watch mode (single package)
pnpm --filter question-engine test -- --watch

# E2E tests (requires full dev stack running)
pnpm --filter authoring-ui run test:e2e
```

### Coverage report

```bash
pnpm --filter question-engine test -- --coverage
# Coverage report: packages/question-engine/coverage/index.html
```

---

## Hot reload

`pnpm dev` starts Vite's dev server for `authoring-ui` and `ts-node-dev` (or `tsx --watch`) for `backend/api`. File saves in either package reload immediately.

For `runtime-player` and `phaser-simulations` changes, rebuild the bundle:

```bash
pnpm --filter runtime-player run build
pnpm --filter phaser-simulations run build
```

---

## Build all packages

```bash
# Build all packages in dependency order
pnpm build

# Build a specific package
pnpm --filter scorm-packager run build
```

---

## Troubleshooting

**`pnpm install` fails with peer dependency errors**

Run with `--no-strict-peer-dependencies`:
```bash
pnpm install --no-strict-peer-dependencies
```

**Garage bucket not created on first run**

The `garage-init` container creates the `elearn-assets` bucket automatically. If it fails, run it manually:
```bash
docker compose -f docker/docker-compose.dev.yml run --rm garage-init
```

**MongoDB connection refused**

Confirm MongoDB started:
```bash
docker compose -f docker/docker-compose.dev.yml logs mongo
```

**`GET /health` returns `garage: false`**

Check Garage logs. The most common cause is the access key not matching `docker/.env`:
```bash
docker compose -f docker/docker-compose.dev.yml logs garage
```

**Port conflict on 3000 or 3001**

Find and kill the conflicting process, or override the port in `.env`:
```bash
VITE_PORT=3030 pnpm --filter authoring-ui run dev
API_PORT=3031 pnpm --filter @elearn-studio/api run dev
```
