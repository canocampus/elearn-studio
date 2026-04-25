/**
 * Client-side URL validation for the recorder (TD-014.10).
 *
 * Intentionally mirrors `validateRecordingUrl` in
 * `packages/simulation-engine/src/routes/recorder.ts:44-82` line-for-line so
 * the launcher dialog rejects the same inputs the backend would reject. The
 * server enforces the same rules; this client-side copy is a UX nicety (fail
 * fast with an inline message) — not a security boundary.
 *
 * Returns a human-readable error string if the URL is unsafe, or `null` if OK.
 */

const PRIVATE_IPV4 = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/

export function validateRecordingUrl(raw: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return 'url must be a valid URL'
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return 'url must use http or https protocol'
  }

  const hostname = parsed.hostname.toLowerCase()

  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '[::1]'
  ) {
    return 'url must not target localhost'
  }

  const m = hostname.match(PRIVATE_IPV4)
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])]
    if (
      a === 10 ||                          // 10.0.0.0/8
      a === 127 ||                         // 127.0.0.0/8
      (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
      (a === 192 && b === 168) ||           // 192.168.0.0/16
      (a === 169 && b === 254)              // 169.254.0.0/16 link-local
    ) {
      return 'url must not target private IP ranges'
    }
  }

  return null
}

export const MAX_RECORDER_URL_LENGTH = 2048
export const MAX_RECORDER_TITLE_LENGTH = 256
