/**
 * useDebugMode — T165.2
 *
 * Returns true when debug mode is active:
 *  - URL contains ?debug=1, OR
 *  - localStorage has key 'debug' set to '1'
 *
 * Re-evaluates on mount only (URL params don't change at runtime).
 */

import { useMemo } from 'react'

export function useDebugMode(): boolean {
  return useMemo(() => {
    const urlParam = new URLSearchParams(window.location.search).get('debug')
    const stored = localStorage.getItem('debug')
    return urlParam === '1' || stored === '1'
  }, [])
}
