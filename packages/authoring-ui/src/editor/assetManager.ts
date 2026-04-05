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

const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.mov', '.avi', '.mkv', '.ogv'])
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.opus'])

function detectAssetType(filename: string): 'image' | 'video' | 'audio' {
  const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase()
  if (VIDEO_EXTENSIONS.has(ext)) return 'video'
  if (AUDIO_EXTENSIONS.has(ext)) return 'audio'
  return 'image'
}

// VITE_API_URL must be set to an absolute URL (e.g. http://localhost:3001) at build time.
// If empty, presigned URL fetches use a relative path which fails on cross-origin deployments.
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
    // BETA-07 (T601): /assets/:objectName is auth-protected — browser <img> tags cannot send
    //   Bearer tokens, so loading the raw path returns 401 and GrapesJS shows a broken icon.
    //   Fix: call GET /assets/:objectName/presigned immediately after upload to get a
    //   time-limited, browser-loadable URL, and pass that as `src` to GrapesJS.
    //
    // BETA-12 (T601): when only a URL string is passed, GrapesJS uses the URL path as the
    //   display name — resulting in the UUID-based path shown to the user instead of the
    //   original filename. Fix: pass { src, name: originalName, type: 'image' } so GrapesJS
    //   displays the original filename (e.g. "diagram.png") in the Asset Manager list.
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

      // M-01: guard against backend response missing required fields (e.g. after backend refactor).
      if (!body.data?.objectName || !body.data?.originalName) {
        return Promise.reject('[assetManager] upload response missing objectName or originalName')
      }

      // BETA-07: resolve presigned URL for AM thumbnail. BETA-12: use original filename as display name.
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
      // Detect the correct GrapesJS asset type from the file extension so the AM
      // `types` filter in MediaPlayer and AudioNarration panels works correctly.
      return JSON.stringify({
        data: [{ src, name: originalName, type: detectAssetType(originalName) }],
      })
    },

    // Empty initial assets; uploads populate the list dynamically.
    assets: [],

    // Show URL input field so users can paste an external image URL.
    showUrlInput: true,
  }
}
