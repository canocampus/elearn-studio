/**
 * MSW browser worker for dev mode — T165.4
 *
 * Activated via ?mock=1 in URL (see main.tsx).
 * Requires the service worker to be registered at /mockServiceWorker.js.
 * Run: pnpm --filter authoring-ui exec msw init public/ --save
 */

import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

export const worker = setupWorker(...handlers)
