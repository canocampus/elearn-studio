/**
 * CORS middleware factory (TD-014.8a — audit R-03).
 *
 * The authoring-ui (localhost:3000) calls the recorder API directly from the
 * browser (POST /recorder/sessions, GET /recorder/sessions/:id/live.png, etc.).
 * Without CORS headers on the :3002 response the browser blocks the call with
 * a network-level error that is hard to distinguish from an outage.
 *
 * Policy:
 *   - Single allowed origin from SIMULATION_ENGINE_ALLOWED_ORIGIN env
 *     (default: http://localhost:3000 for dev).
 *   - Methods: GET, POST, DELETE (all currently-used verbs on /recorder/*).
 *   - Headers: Content-Type (JSON bodies) + Authorization (Bearer from API).
 *   - credentials: false — session ID travels in the JSON body, never cookies.
 *
 * A function-based `origin` is used (rather than the static-string form) so
 * unexpected origins receive no `Access-Control-Allow-Origin` header at all —
 * which gives clearer "rejected" test semantics than reflecting back a
 * non-matching value.
 */

import cors from 'cors'
import type { RequestHandler } from 'express'
import { config } from '../config'

export function createCorsMiddleware(): RequestHandler {
  const allowed = config.http.allowedOrigin
  return cors({
    origin: (origin, cb) => {
      // No Origin → same-origin or non-browser client (curl, health probes).
      if (!origin) return cb(null, true)
      if (origin === allowed) return cb(null, true)
      cb(null, false)
    },
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
  })
}
