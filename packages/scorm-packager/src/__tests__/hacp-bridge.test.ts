/**
 * Unit tests for T026 — HACP Bridge
 * (buildHACPBridge)
 */

import { describe, it, expect } from 'vitest'
import { buildHACPBridge } from '../hacp-bridge'

describe('buildHACPBridge', () => {
  it('returns a non-empty string', () => {
    expect(buildHACPBridge()).toBeTruthy()
  })

  it('produces valid JavaScript (no syntax errors)', () => {
    const bridge = buildHACPBridge()
    // If there is a syntax error this will throw
    expect(() => new Function(bridge)).not.toThrow()
  })

  it('reads AICC_URL from query params (case variants)', () => {
    const bridge = buildHACPBridge()
    expect(bridge).toContain('AICC_URL')
    expect(bridge).toContain('aicc_url')
  })

  it('reads AICC_SID from query params (case variants)', () => {
    const bridge = buildHACPBridge()
    expect(bridge).toContain('AICC_SID')
    expect(bridge).toContain('aicc_sid')
  })

  it('includes an early-return guard when params are absent', () => {
    // Must contain a return; when !aiccUrl || !aiccSid
    expect(buildHACPBridge()).toMatch(/if\s*\(!aiccUrl\s*\|\|\s*!aiccSid\)\s*return/)
  })

  it('defines all 8 SCORM 1.2 window.API methods', () => {
    const bridge = buildHACPBridge()
    const methods = [
      'LMSInitialize',
      'LMSGetValue',
      'LMSSetValue',
      'LMSCommit',
      'LMSFinish',
      'LMSGetLastError',
      'LMSGetErrorString',
      'LMSGetDiagnostic',
    ]
    for (const m of methods) {
      expect(bridge, `missing method: ${m}`).toContain(m)
    }
  })

  it('uses POST method for fetch calls', () => {
    expect(buildHACPBridge()).toContain("method: 'POST'")
  })

  it('sets keepalive: true on fetch', () => {
    expect(buildHACPBridge()).toContain('keepalive: true')
  })

  it('sends GetParam command', () => {
    expect(buildHACPBridge()).toContain("'GetParam'")
  })

  it('sends PutParam command', () => {
    expect(buildHACPBridge()).toContain("'PutParam'")
  })

  it('sends ExitAU command', () => {
    expect(buildHACPBridge()).toContain("'ExitAU'")
  })

  it('wraps code in an IIFE', () => {
    const bridge = buildHACPBridge().trim()
    expect(bridge).toMatch(/^\(function\s*\(\s*\)/)
    expect(bridge).toMatch(/\)\(\);$/)
  })

  it('does not contain eval()', () => {
    expect(buildHACPBridge()).not.toContain('eval(')
  })

  it('does not assign user-controlled data to innerHTML', () => {
    // The bridge must not assign aiccUrl, aiccSid or any fetch response
    // directly to innerHTML — that would be XSS.
    const bridge = buildHACPBridge()
    // Simple heuristic: no innerHTML assignment
    expect(bridge).not.toContain('innerHTML')
  })

  it('validates AICC_URL origin to prevent cross-origin data exfiltration', () => {
    const bridge = buildHACPBridge()
    // Must contain same-origin validation logic
    expect(bridge).toContain('parsedUrl.origin')
    expect(bridge).toContain('location.origin')
  })

  it('rejects an invalid AICC_URL gracefully', () => {
    const bridge = buildHACPBridge()
    // Must catch URL parse errors
    expect(bridge).toContain('Invalid AICC_URL')
  })
})
