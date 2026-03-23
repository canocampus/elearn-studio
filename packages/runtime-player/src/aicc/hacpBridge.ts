/**
 * AICC HACP Bridge — T205 TEST-05
 *
 * Provides a minimal postMessage-based bridge for AICC HACP communication.
 * Security requirement: messages from unauthorized origins MUST be rejected.
 *
 * In production, `allowedOrigin` is set to the LMS server origin at runtime.
 */

export interface HacpMessage {
  type: string
  payload?: unknown
}

export interface HacpBridgeCallbacks {
  /** Called when a valid HACP message is received from an authorized origin */
  onMessage: (msg: HacpMessage) => void
  /** Called when a message from an unauthorized origin is rejected */
  onUnauthorized?: (origin: string) => void
}

export interface HacpBridge {
  /** Remove the message listener and clean up */
  destroy: () => void
}

/**
 * Creates a HACP bridge that listens for postMessage events and enforces
 * same-origin policy by rejecting messages from unauthorized origins.
 *
 * @param allowedOrigin - The authorized LMS origin (e.g. 'https://lms.example.com')
 * @param callbacks     - Handlers for authorized and unauthorized messages
 * @param win           - Window to attach the listener to (defaults to globalThis)
 */
export function createHacpBridge(
  allowedOrigin: string,
  callbacks: HacpBridgeCallbacks,
  win: Window = globalThis as unknown as Window,
): HacpBridge {
  function onMessage(event: MessageEvent): void {
    if (event.origin !== allowedOrigin) {
      callbacks.onUnauthorized?.(event.origin)
      return
    }

    const raw = event.data
    if (typeof raw !== 'object' || raw === null || typeof raw.type !== 'string') {
      return
    }

    callbacks.onMessage({ type: raw.type, payload: raw.payload })
  }

  win.addEventListener('message', onMessage)

  return {
    destroy() {
      win.removeEventListener('message', onMessage)
    },
  }
}
