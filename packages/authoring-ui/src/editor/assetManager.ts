/**
 * GrapesJS Asset Manager — connects to Garage via backend API.
 * T010.10: Custom asset manager for image/media uploads and browsing.
 */

import type { AssetManagerConfig } from 'grapesjs'
import { uploadAsset } from '../api/courseApi'

/**
 * Returns GrapesJS AssetManager config that proxies through the backend API.
 * Assets are stored in Garage; the API returns proxied URLs.
 */
export function buildAssetManagerConfig(): AssetManagerConfig {
  return {
    // Override the upload with our custom multi-part handler
    uploadFile: async (e: Event) => {
      const input = e.target as HTMLInputElement | null
      const files = input?.files
      if (!files?.length) return []

      const results = await Promise.all(
        Array.from(files).map(file => uploadAsset(file)),
      )
      return results.map(r => r.url)
    },

    // Empty initial assets; GrapesJS will call uploadFile for new uploads
    assets: [],

    // Show URL input field in the asset picker
    showUrlInput: true,
  }
}
