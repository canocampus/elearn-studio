import type { ActiveSession, SimStep } from './types'

/** In-memory store for sessions that are actively recording. */
const store = new Map<string, ActiveSession>()

export function createSession(id: string, url: string, title: string): ActiveSession {
  const session: ActiveSession = {
    id,
    url,
    title,
    startedAt: new Date().toISOString(),
    steps: [],
    stepCounter: 0,
  }
  store.set(id, session)
  return session
}

export function getSession(id: string): ActiveSession | undefined {
  return store.get(id)
}

export function removeSession(id: string): void {
  store.delete(id)
}

export function activeCount(): number {
  return store.size
}

export function appendStep(session: ActiveSession, step: SimStep): void {
  session.steps.push(step)
  session.stepCounter = session.steps.length
}
