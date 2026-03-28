# Auth

Authentication uses short-lived JWT access tokens + a rotating httpOnly refresh token cookie.

- Access token: returned in the JSON response body. Include in `Authorization: Bearer <token>` on all protected requests.
- Refresh token: set as an httpOnly cookie on `/auth/refresh` path only. Never exposed to JavaScript.
- Refresh token TTL: 7 days, rotated on each use in production.

---

## POST /auth/register

Register a new user. Only available when `ALLOW_REGISTRATION=true` is set in the environment.

**Auth:** Public

**Request body:**

```typescript
interface RegisterRequest {
  email: string     // valid email address
  password: string  // minimum 8 characters
}
```

**Responses:**

| Status | Body |
|---|---|
| `201` | `{ success: true, data: { id, email, role } }` |
| `400` | Missing or invalid fields |
| `403` | Registration is disabled |
| `409` | Email already registered |

**curl:**

```bash
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "author@example.com", "password": "securepass"}'
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "64e1f2a3b4c5d6e7f8a9b0c1",
    "email": "author@example.com",
    "role": "author"
  }
}
```

---

## POST /auth/login

Authenticate and receive an access token. Sets the `refreshToken` httpOnly cookie.

**Auth:** Public

**Request body:**

```typescript
interface LoginRequest {
  email: string
  password: string
}
```

**Responses:**

| Status | Body |
|---|---|
| `200` | `{ success: true, data: { accessToken, user } }` — also sets `refreshToken` cookie |
| `400` | Missing credentials |
| `401` | Invalid credentials |

**curl:**

> `-c cookies.txt` tells curl to save the `refreshToken` httpOnly cookie the server sets. Pass this file to subsequent calls that need the cookie.

```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email": "author@example.com", "password": "securepass"}'
```

**Response:**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
    "user": {
      "id": "64e1f2a3b4c5d6e7f8a9b0c1",
      "email": "author@example.com",
      "role": "author"
    }
  }
}
```

> The `accessToken` is a JWT. Decode it client-side to check expiry — do not call `/auth/me` to validate it.

---

## POST /auth/refresh

Exchange the `refreshToken` cookie for a new access token. In production the refresh token is rotated on each call.

**Auth:** Public (requires valid `refreshToken` cookie)

**Request body:** None

**Responses:**

| Status | Body |
|---|---|
| `200` | `{ success: true, data: { accessToken } }` — also updates `refreshToken` cookie |
| `401` | Missing, invalid, or expired refresh token |

**curl:**

> `-b cookies.txt` reads the saved `refreshToken` cookie. `-c cookies.txt` writes the rotated token back to the same file.

```bash
curl -X POST http://localhost:3001/auth/refresh \
  -b cookies.txt \
  -c cookies.txt
```

**Response:**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiJ9..."
  }
}
```

---

## POST /auth/logout

Invalidate the refresh token and clear the cookie. The access token is not revoked server-side — it expires on its own.

**Auth:** Public (the refresh cookie is used to identify the session)

**Request body:** None

**Responses:**

| Status | Body |
|---|---|
| `200` | `{ success: true }` |

**curl:**

```bash
curl -X POST http://localhost:3001/auth/logout \
  -b cookies.txt \
  -c cookies.txt
```

---

## GET /auth/me

Return the current user's profile.

**Auth:** `Authorization: Bearer <token>`

**Responses:**

| Status | Body |
|---|---|
| `200` | `{ success: true, data: { id, email, role } }` |
| `401` | Invalid or missing token |

**curl:**

```bash
curl http://localhost:3001/auth/me \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "64e1f2a3b4c5d6e7f8a9b0c1",
    "email": "author@example.com",
    "role": "author"
  }
}
```
