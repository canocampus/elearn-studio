/**
 * Unit tests for assetManager.ts — T010.10
 *
 * Regression tests for the customFetch transformation:
 *   Backend envelope { success, data: { url } }
 *   → JSON string → { data: [url] }
 *   for GrapesJS asset manager autoAdd to work.
 *
 * REGRESSION: customFetch MUST return a STRING, not a Response object.
 * If it returns a Response or a parsed object, GrapesJS target.add(json.data)
 * receives undefined and the uploaded asset never appears in the AM list.
 *
 * These tests catch the pattern where an AI fix updates the backend response
 * shape but forgets to update the customFetch transformation to match.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

type CustomFetchFn = (url: string, options: Record<string, unknown>) => Promise<string>

// Mock authStore before importing module
vi.mock('../store/authStore', () => ({
  useAuthStore: {
    getState: vi.fn().mockReturnValue({ accessToken: 'test-token-abc' }),
  },
}))

import { buildAssetManagerConfig } from '../editor/assetManager'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBackendResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
  } as unknown as Response
}

// ---------------------------------------------------------------------------
// buildAssetManagerConfig — static config fields
// ---------------------------------------------------------------------------

describe('buildAssetManagerConfig — static fields', () => {
  it('sets uploadName to "file" (matches multer.single on backend)', () => {
    const cfg = buildAssetManagerConfig()
    expect(cfg.uploadName).toBe('file')
  })

  it('sets multiUpload to false (backend uses .single())', () => {
    const cfg = buildAssetManagerConfig()
    expect(cfg.multiUpload).toBe(false)
  })

  it('sets autoAdd to true (uploads appear in AM list immediately)', () => {
    const cfg = buildAssetManagerConfig()
    expect(cfg.autoAdd).toBe(true)
  })

  it('sets showUrlInput to true (allow pasting external URLs)', () => {
    const cfg = buildAssetManagerConfig()
    expect(cfg.showUrlInput).toBe(true)
  })

  it('initialises assets to empty array', () => {
    const cfg = buildAssetManagerConfig()
    expect(cfg.assets).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// customFetch — regression: must return a STRING, not a Response or object
// ---------------------------------------------------------------------------

describe('customFetch — REGRESSION: return type must be a JSON string', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  it('returns a string (not a Response or object)', async () => {
    fetchMock.mockResolvedValue(
      makeBackendResponse({ success: true, data: { url: '/assets/img-001.png', objectName: 'img-001.png' } }),
    )

    const cfg = buildAssetManagerConfig()
    const result = await (cfg.customFetch as unknown as CustomFetchFn)('/assets', {})

    // CRITICAL: GrapesJS calls JSON.parse(result), then target.add(json.data)
    // If this is not a string, json.data is undefined and upload silently fails.
    expect(typeof result).toBe('string')
  })

  it('parsed result has a "data" array (GrapesJS calls target.add(json.data))', async () => {
    fetchMock.mockResolvedValue(
      makeBackendResponse({ success: true, data: { url: '/assets/img-001.png', objectName: 'img-001.png' } }),
    )

    const cfg = buildAssetManagerConfig()
    const result = await (cfg.customFetch as unknown as CustomFetchFn)('/assets', {})
    const parsed = JSON.parse(result)

    // GrapesJS expects json.data to be an array of src strings
    expect(Array.isArray(parsed.data)).toBe(true)
    expect(parsed.data.length).toBeGreaterThan(0)
  })

  it('data[0] is the asset URL from the backend response (REGRESSION: field mapping)', async () => {
    const expectedUrl = '/assets/my-image-abc123.png'
    fetchMock.mockResolvedValue(
      makeBackendResponse({ success: true, data: { url: expectedUrl, objectName: 'my-image-abc123.png' } }),
    )

    const cfg = buildAssetManagerConfig()
    const result = await (cfg.customFetch as unknown as CustomFetchFn)('/assets', {})
    const parsed = JSON.parse(result)

    // If backend renames "url" to "src" or "path", this test catches it.
    expect(parsed.data[0]).toBe(expectedUrl)
  })
})

// ---------------------------------------------------------------------------
// customFetch — auth token injection
// ---------------------------------------------------------------------------

describe('customFetch — Bearer token injection', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(
      makeBackendResponse({ success: true, data: { url: '/assets/test.png' } }),
    )
    vi.stubGlobal('fetch', fetchMock)
  })

  it('injects Authorization: Bearer header from authStore', async () => {
    const cfg = buildAssetManagerConfig()
    await (cfg.customFetch as unknown as CustomFetchFn)('/assets', { headers: {} })

    const calledOptions = fetchMock.mock.calls[0][1] as RequestInit
    const headers = calledOptions.headers as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer test-token-abc')
  })

  it('does not inject Authorization when token is null', async () => {
    const { useAuthStore } = await import('../store/authStore')
    vi.mocked(useAuthStore.getState).mockReturnValueOnce({ accessToken: null } as never)

    const cfg = buildAssetManagerConfig()
    await (cfg.customFetch as unknown as CustomFetchFn)('/assets', { headers: {} })

    const calledOptions = fetchMock.mock.calls[0][1] as RequestInit
    const headers = calledOptions.headers as Record<string, string>
    expect(headers['Authorization']).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// customFetch — error handling
// ---------------------------------------------------------------------------

describe('customFetch — non-2xx response handling', () => {
  it('rejects with the response text body on 4xx (matches standard GrapesJS path)', async () => {
    const errorBody = 'Upload failed: file too large'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 413,
      text: vi.fn().mockResolvedValue(errorBody),
    }))

    const cfg = buildAssetManagerConfig()
    await expect(
      (cfg.customFetch as unknown as CustomFetchFn)('/assets', {}),
    ).rejects.toBe(errorBody)
  })

  it('rejects with the response text body on 500', async () => {
    const errorBody = 'Internal Server Error'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValue(errorBody),
    }))

    const cfg = buildAssetManagerConfig()
    await expect(
      (cfg.customFetch as unknown as CustomFetchFn)('/assets', {}),
    ).rejects.toBe(errorBody)
  })
})
