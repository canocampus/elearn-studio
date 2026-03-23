# eLearn Studio — Security Guide

## Overview

This guide covers the security model of the eLearn Studio backend: authentication,
JWT configuration, rate limiting, asset handling, and known trade-offs.

---

## Authentication & JWT

### Architecture

eLearn Studio uses a two-token system:

| Token | Type | Lifetime | Storage |
|---|---|---|---|
| Access token | JWT (RS256-compatible, HS256 in dev) | `JWT_EXPIRY` (default: 15m) | Memory only (Zustand store) |
| Refresh token | Opaque random bytes, SHA-256 hashed in DB | 7 days | httpOnly `refreshToken` cookie |

The access token is passed as `Authorization: Bearer <token>` on every API request.
The refresh token is stored in an httpOnly cookie — invisible to JavaScript, so safe
from XSS attacks even if malicious script runs in the page.

### JWT Configuration

Required environment variables:

```env
JWT_SECRET=<minimum 32 characters — use a random 64-char hex string in production>
JWT_EXPIRY=15m                        # valid units: s, m, h, d, w
REFRESH_SECRET=<separate secret for refresh tokens>
```

**Startup validation** rejects the app if `JWT_SECRET` is missing or < 32 characters.

**Generating a strong secret:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### User Registration

Registration is gated by the `ALLOW_REGISTRATION` env var:

```env
ALLOW_REGISTRATION=true   # Allow new registrations (dev / open beta)
# unset                   # Disable registration (production default)
```

In production, create users via the seed script:
```bash
ADMIN_EMAIL=admin@yourorg.com ADMIN_PASSWORD=<strong-password> \
  pnpm --filter api run seed:admin
```

The seed script is **idempotent** — running it twice does not create duplicate admins.

### Token Rotation

On each `POST /auth/refresh`:
1. The incoming refresh token is verified against the stored hash.
2. The DB record is **deleted** (consumed).
3. A new refresh token is issued and stored.

This means a stolen refresh token can only be used once before the legitimate user
rotates it away. If an attacker uses a consumed token, the server returns 401.

### Roles

| Role | Access |
|---|---|
| `author` | All course/slide CRUD, asset upload, history, export |
| `admin` | All of the above + admin-only routes (future) |

Role is embedded in the JWT payload (`role` claim). `requireRole('admin')` middleware
validates it server-side on every request.

---

## Rate Limiting

Rate limits are applied per IP address via `express-rate-limit`.

| Endpoint | Limit | Window |
|---|---|---|
| `POST /auth/register` | 5 req | 15 min |
| `POST /auth/login` | 10 req | 15 min |
| `POST /auth/refresh` | 30 req | 15 min |
| `POST /assets` (upload) | 20 req | 15 min |
| `POST /courses/:id/export/scorm12` | 5 req | 5 min |

Requests over the limit receive `429 Too Many Requests`.

**Production note:** If the API runs behind a reverse proxy (Nginx, Caddy, load balancer),
set the `trust proxy` Express setting so rate limiting uses the real client IP:

```typescript
app.set('trust proxy', 1)  // trust first proxy
```

---

## Asset Security

### Upload Validation

Uploads are validated at two levels:

1. **MIME type** — `Content-Type` header checked against the allowlist.
2. **File size** — configurable maximum (default 50 MB).

```env
MAX_ASSET_SIZE_MB=50
# Optional override — comma-separated MIME types:
ALLOWED_MIME_TYPES=image/jpeg,image/png,image/gif,image/webp,image/svg+xml,video/mp4,video/webm,audio/mpeg,audio/ogg,audio/wav,application/pdf
```

> **Known limitation (M-166-02):** MIME validation trusts the `Content-Type` header set
> by the client. Magic-byte (file signature) validation is deferred to a future hardening
> pass. For most threat models (authenticated authors, not anonymous uploads), this is
> acceptable.

### Pre-signed URLs

Assets are served as **pre-signed S3 URLs** (1-hour expiry) rather than through the API:

1. Client requests `GET /assets/:objectName`.
2. Backend verifies the JWT.
3. Backend generates a Garage pre-signed URL and responds with `302 Redirect`.
4. Client follows the redirect directly to Garage.

This means:
- Asset downloads do not consume API bandwidth.
- All asset access requires a valid JWT — no public bucket ACL.
- Pre-signed URLs expire after 1 hour (configurable via `S3_PRESIGN_EXPIRY_SECONDS`).

### Content-Disposition: attachment

Assets are served with `Content-Disposition: attachment`, which forces download rather
than in-browser preview. This is a deliberate trade-off against clickjacking/XSS via
hosted SVGs. If in-browser preview is needed (e.g. image editor), use the pre-signed URL
directly with a `?inline=1` parameter (not yet implemented).

---

## Security Headers

All responses include security headers via `helmet()`:

| Header | Value | Notes |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | Prevents MIME sniffing |
| `X-Frame-Options` | `DENY` | Prevents clickjacking |
| `Strict-Transport-Security` | `max-age=31536000` | HTTPS enforcement (prod only) |
| `Content-Security-Policy` | See below | |

### CSP Configuration

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';   ← intentional trade-off (see below)
img-src 'self' data: blob:;
font-src 'self';
connect-src 'self'
```

> **Known trade-off (H-166-01):** `style-src 'unsafe-inline'` is required for GrapesJS to
> apply inline styles to canvas elements. Removing it breaks the drag-and-drop editor.
> Mitigation: GrapesJS runs in an iframe sandbox; inline style injection is limited to
> that iframe context. CSS data exfiltration risk is accepted as a product requirement.
> This will be revisited when GrapesJS adds CSP nonce support.

---

## MongoDB Injection

All Mongoose queries use typed schema fields — `req.body` is never passed directly to
`$where`, `$regex`, or other MongoDB operators. The Mongoose schema enforces field types
at the driver level, preventing operator injection.

Validation is done via Zod schemas at the route layer before data reaches Mongoose.

---

## Production Checklist

Before deploying to production:

- [ ] `JWT_SECRET` ≥ 64 random characters (not the dev default)
- [ ] `REFRESH_SECRET` ≥ 64 random characters
- [ ] `ALLOW_REGISTRATION` unset (disable open registration)
- [ ] `NODE_ENV=production` (disables Swagger UI, `/telemetry/ping`, verbose errors)
- [ ] `CORS_ORIGIN` set to your frontend domain
- [ ] MongoDB behind VPC — not exposed to the internet
- [ ] Garage (S3) behind VPC — API key not in source code
- [ ] Rate limiting configured for your proxy setup (`trust proxy`)
- [ ] HTTPS enforced at the reverse proxy level
- [ ] Rotate secrets on first deployment
