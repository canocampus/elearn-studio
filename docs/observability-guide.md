# eLearn Studio — Observability Guide

## Overview

The observability stack is **mandatory in development** — it starts automatically with
`docker compose -f docker/docker-compose.dev.yml up -d` alongside MongoDB and Garage.

The stack provides:
- **Structured logs** via Pino → Promtail → Loki → Grafana
- **Distributed traces** via OpenTelemetry → OTel Collector → Tempo → Grafana
- **Metrics** via Prometheus → Grafana

---

## Quick Start

```bash
# Start core + observability stack
docker compose -f docker/docker-compose.dev.yml up -d

# Verify services are running
docker compose -f docker/docker-compose.dev.yml ps
```

| Service | URL | Default Credentials |
|---|---|---|
| **Grafana** | http://localhost:3001 | admin / changeme |
| **Prometheus** | http://localhost:9090 | — |
| Loki (internal) | http://localhost:3100 | — |
| Tempo (internal) | http://localhost:3200 | — |
| OTel Collector | http://localhost:4318 | — |

> Change the Grafana admin password via `GRAFANA_ADMIN_PASSWORD` in `docker/.env`.

---

## Viewing Logs in Grafana

1. Open http://localhost:3001 → **Explore** (compass icon in sidebar)
2. Select **Loki** as the data source
3. Use LogQL to query:

```logql
# All API logs
{job="elearn-api"}

# Only errors
{job="elearn-api"} | json | level = "error"

# Logs for a specific request (by trace ID)
{job="elearn-api"} | json | traceId = "abc123..."

# Auth events
{job="elearn-api"} | json | msg =~ "login|register|refresh"

# Client error reports (frontend errors forwarded to backend)
{job="elearn-api"} | json | source = "client"
```

---

## Viewing Traces in Grafana

Every HTTP request to the API generates a trace via OpenTelemetry. Traces include:
- HTTP method + route
- Mongoose query spans (collection, operation, duration)
- Any child spans created in the request handler

### How to find a trace for a specific request

1. Open http://localhost:3001 → **Explore** → select **Tempo**
2. In **Search**, filter by:
   - Service name: `elearn-api`
   - HTTP method / route name / status code
3. Or link from a log entry: Loki entries include `traceId` — click to jump to Tempo

### Correlating logs ↔ traces

Both Loki and Tempo use the same `traceId` field. In Grafana Explore you can:
1. Find the error in Loki
2. Extract the `traceId` from the JSON log line
3. Paste into Tempo search to see the full distributed trace

---

## Metrics & Alerting

Prometheus scrapes metrics every 15 seconds from:
- `elearn-api` — standard Node.js process metrics via OpenTelemetry
- `otel-collector` — collector self-metrics

Predefined Grafana alert rules:

| Alert | Condition | Severity |
|---|---|---|
| API Error Rate High | >5% 5xx responses in 5 min | warning |
| API Latency High | p95 > 2s over 5 min | warning |
| API Down | No scrape for 1 min | critical |

> Alerts are defined in Grafana provisioning (`docker/observability/grafana/alerting/`).
> Notification endpoints (Slack, email, PagerDuty) are **not configured by default** —
> set them up in Grafana → Alerting → Contact Points.

---

## Environment Variables

```env
# OTel — set to the collector endpoint to enable trace export
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318

# Service name in Tempo / Jaeger
OTEL_SERVICE_NAME=elearn-api      # default

# Log level (trace | debug | info | warn | error | fatal | silent)
LOG_LEVEL=info

# Grafana admin password
GRAFANA_ADMIN_PASSWORD=changeme
```

When `OTEL_EXPORTER_OTLP_ENDPOINT` is **not set**, the OTel SDK still runs but no traces
are exported — safe to run without the observability stack (e.g. in lightweight test environments).

---

## Developer Verification Endpoint

In `NODE_ENV !== 'production'`, a ping endpoint is available:

```bash
# Verify the auth → telemetry → Loki pipeline end-to-end
curl http://localhost:3001/telemetry/ping \
  -H "Authorization: Bearer <your-access-token>"
# Response: { "ok": true, "userId": "..." }
```

This generates a Pino log entry with `level: debug` and a trace span — visible in
Grafana within ~5 seconds.

---

## Known Limitations (Development)

| Limitation | Impact | Status |
|---|---|---|
| Loki uses in-memory storage (no volume mount) | Logs lost on `docker compose down` | Acceptable for dev; add a volume for staging |
| Tempo block retention: 24h | Traces from yesterday unavailable | Acceptable for dev |
| Alert notifications not configured | Alerts fire but go nowhere | Configure contact points for staging/prod |

---

## Production Deployment

For production, connect your existing Grafana/Loki/Prometheus/Tempo infrastructure:

1. Set `OTEL_EXPORTER_OTLP_ENDPOINT` to your OTel Collector or Grafana Agent endpoint.
2. Set `LOG_LEVEL=warn` (or `info` if you want request logs).
3. Do **not** run the dev compose stack in production — use your own managed observability.
4. The API Dockerfile passes `OTEL_EXPORTER_OTLP_ENDPOINT` through at build time.

For managed cloud observability, the OTel Collector config in
`docker/observability/otel-collector-config.yaml` can be adapted to export to:
- **Grafana Cloud** (Tempo + Loki endpoints)
- **Datadog** (OTLP ingest)
- **Honeycomb** (OTLP ingest)
- Any OTLP-compatible backend
