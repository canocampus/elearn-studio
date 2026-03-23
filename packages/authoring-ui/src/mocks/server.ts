/**
 * MSW server for Vitest (Node environment) — T165.4
 *
 * Usage in test files:
 *   import { server } from '../mocks/server'
 *   beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
 *   afterEach(() => server.resetHandlers())
 *   afterAll(() => server.close())
 */

import { setupServer } from 'msw/node'
import { handlers } from './handlers'

export const server = setupServer(...handlers)
