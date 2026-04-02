/**
 * GrapesJS Asset Manager — connects to Garage via backend API.
 * T010.10: Custom asset manager for image/media uploads and browsing.
 *
 * Uses GrapesJS's built-in upload path (upload + customFetch) so that
 * autoAdd:true works and uploaded assets appear in the AM list immediately.
 * The customFetch wrapper adds the Bearer token and transforms the backend
 * response into the format GrapesJS expects: { data: [srcUrl] }.
 */

import type { AssetManagerConfig } from 'grapesjs'
import { useAuthStore } from '../store/authStore'

const API_BASE: string = (import.meta as unknown as Record<string, { VITE_API_URL?: string }>).env?.VITE_API_URL ?? ''

/**
 * Returns GrapesJS AssetManager config that proxies through the backend API.
 * Assets are stored in Garage; the API returns proxied /assets/:objectName URLs.
 */
export function buildAssetManagerConfig(): AssetManagerConfig {
  return {
    // GrapesJS will POST FormData to this URL when a file is selected.
    upload: `${API_BASE}/assets`,

    // Must match multer.single('file') on the backend (default GrapesJS value is 'files').
    uploadName: 'file',

    // Single-file upload — our backend's multer config uses .single().
    multiUpload: false,

    // autoAdd:true (GrapesJS default) — adds response.data to the AM list automatically.
    autoAdd: true,

    // customFetch: injects Bearer token and transforms the backend envelope
    // { success, data: { url, objectName, originalName } } into the object GrapesJS expects.
    //
    // IMPORTANT: GrapesJS calls customFetch then does:
    //   fetchResult.then(text => onUploadResponse(text, clb))
    //   onUploadResponse: json = (typeof text === 'string') ? JSON.parse(text) : text
    //   target.add(json.data, { at: 0 })
    //
    // So customFetch must resolve to a STRING (same as the standard res.text() path),
    // NOT a Response object (which would make json.data === undefined, nothing added).
    //
    // T601 (BETA-07 + BETA-12):
    //   - BETA-07: /assets/:objectName requires Bearer auth — browser <img> can't load it.
    //     Fix: resolve the presigned URL immediately after upload and pass it as `src`.
    //   - BETA-12: passing only a URL string causes GrapesJS to display the UUID as the name.
    //     Fix: pass { src, name, type } object so the original filename is shown in the AM list.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    customFetch: async (url: string, options: RequestInit): Promise<any> => {
      const token = useAuthStore.getState().accessToken
      const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
      const headers: Record<string, string> = {
        ...((options.headers ?? {}) as Record<string, string>),
        ...authHeaders,
      }

      const resp = await fetch(url, { ...options, headers })
      if (!resp.ok) {
        // Standard GrapesJS path does Promise.reject(text) for non-2xx — match it.
        return Promise.reject(await resp.text())
      }

      const body = await resp.json() as {
        success: boolean
        data: { url: string; objectName: string; originalName: string }
      }

      // T601 BETA-07: resolve a presigned URL so the AM thumbnail can load without auth.
      // T601 BETA-12: use originalName from upload response as the AM display name.
      const { objectName, originalName } = body.data
      let src: string = body.data.url
      try {
        const presignedResp = await fetch(
          `${API_BASE}/assets/${objectName}/presigned`,
          { headers: authHeaders },
        )
        if (presignedResp.ok) {
          const presignedBody = await presignedResp.json() as {
            success: boolean
            data: { presignedUrl: string }
          }
          src = presignedBody.data.presignedUrl
        }
      } catch (err: unknown) {
        // If presigned URL fetch fails, fall back to the /assets/ path.
        // The thumbnail will not display (auth-protected) but the asset is still added.
        console.warn('[assetManager] presigned fetch failed for', objectName, err)
      }

      // Return JSON string: GrapesJS will JSON.parse it, then call target.add(json.data).
      return JSON.stringify({
        data: [{ src, name: originalName, type: 'image' }],
      })
    },

    // Empty initial assets; uploads populate the list dynamically.
    assets: [],

    // Show URL input field so users can paste an external image URL.
    showUrlInput: true,
  }
}
