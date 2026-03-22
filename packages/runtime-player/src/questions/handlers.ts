/**
 * Submission handlers for advanced question types — T022
 *
 * Each handler reads the current DOM state for its question type,
 * evaluates the answer, and returns { correct, score, feedback }.
 */

export interface EvalResult {
  correct: boolean
  score: number
  feedback: string
}

// ─── Match Items ──────────────────────────────────────────────────────────────

export function evalMatchItems(
  ep: Record<string, unknown>,
  widgetEl: HTMLElement,
): EvalResult {
  const pairs = (ep.pairs as Array<{ id: string; left: string; right: string }>) ?? []
  if (pairs.length === 0) return { correct: false, score: 0, feedback: 'No pairs defined.' }

  const selects = widgetEl.querySelectorAll<HTMLSelectElement>('.el-match-select')
  let correct = 0
  selects.forEach(sel => {
    const pairId = sel.dataset.pairId
    const pair = pairs.find(p => p.id === pairId)
    if (pair && sel.value === pair.right) correct++
  })

  const score = correct / pairs.length
  const isCorrect = score === 1
  const feedback = isCorrect
    ? ((ep.correctFeedback as string) ?? 'Correct!')
    : ((ep.incorrectFeedback as string) ?? `${correct}/${pairs.length} matches correct.`)
  return { correct: isCorrect, score, feedback }
}

// ─── Drag Objects ─────────────────────────────────────────────────────────────

export function evalDragObjects(
  ep: Record<string, unknown>,
  widgetEl: HTMLElement,
): EvalResult {
  const items = (ep.items as Array<{ id: string; label: string; correctZoneId: string }>) ?? []
  if (items.length === 0) return { correct: false, score: 0, feedback: 'No items defined.' }

  let correct = 0
  for (const item of items) {
    // Find which zone contains this item
    const allZones = widgetEl.querySelectorAll<HTMLElement>('.el-drop-zone')
    for (const zoneEl of allZones) {
      const placed = zoneEl.querySelector(`[data-item-id="${item.id}"]`)
      if (placed && zoneEl.dataset.zoneId === item.correctZoneId) {
        correct++
      }
    }
  }

  const score = correct / items.length
  const isCorrect = score === 1
  const feedback = isCorrect
    ? ((ep.correctFeedback as string) ?? 'Correct!')
    : ((ep.incorrectFeedback as string) ?? `${correct}/${items.length} items correctly placed.`)
  return { correct: isCorrect, score, feedback }
}

// ─── Drop Target ──────────────────────────────────────────────────────────────

export function evalDropTarget(
  ep: Record<string, unknown>,
  widgetEl: HTMLElement,
): EvalResult {
  const items = (ep.items as Array<{ id: string; label: string; correctZoneId: string }>) ?? []
  const zones = (ep.zones as Array<{ id: string; label: string; acceptedItemIds: string[] }>) ?? []
  if (items.length === 0) return { correct: false, score: 0, feedback: 'No items defined.' }

  // Build accepted-items lookup
  const zoneAccepts = new Map<string, Set<string>>()
  for (const zone of zones) {
    zoneAccepts.set(zone.id, new Set(zone.acceptedItemIds))
  }

  let correct = 0
  const allZones = widgetEl.querySelectorAll<HTMLElement>('.el-drop-zone')
  for (const item of items) {
    for (const zoneEl of allZones) {
      const placed = zoneEl.querySelector(`[data-item-id="${item.id}"]`)
      if (placed) {
        const zoneId = zoneEl.dataset.zoneId ?? ''
        if (zoneAccepts.get(zoneId)?.has(item.id)) correct++
      }
    }
  }

  const score = correct / items.length
  const isCorrect = score === 1
  const feedback = isCorrect
    ? ((ep.correctFeedback as string) ?? 'Correct!')
    : ((ep.incorrectFeedback as string) ?? `${correct}/${items.length} items correctly placed.`)
  return { correct: isCorrect, score, feedback }
}

// ─── Arrange Objects ──────────────────────────────────────────────────────────

export function evalArrangeObjects(
  ep: Record<string, unknown>,
  widgetEl: HTMLElement,
): EvalResult {
  const correctOrder = (ep.correctOrder as string[]) ?? []
  if (correctOrder.length === 0) return { correct: false, score: 0, feedback: 'No order defined.' }

  const items = widgetEl.querySelectorAll<HTMLElement>('.el-arrange-item')
  let correct = 0
  items.forEach((el, idx) => {
    if (el.dataset.itemId === correctOrder[idx]) correct++
  })

  const score = correct / correctOrder.length
  const isCorrect = score === 1
  const feedback = isCorrect
    ? ((ep.correctFeedback as string) ?? 'Correct!')
    : ((ep.incorrectFeedback as string) ?? `${correct}/${correctOrder.length} items in correct position.`)
  return { correct: isCorrect, score, feedback }
}

// ─── Order Text ───────────────────────────────────────────────────────────────

export function evalOrderText(
  ep: Record<string, unknown>,
  widgetEl: HTMLElement,
): EvalResult {
  const correctOrder = (ep.correctOrder as string[]) ?? []
  if (correctOrder.length === 0) return { correct: false, score: 0, feedback: 'No order defined.' }

  const items = widgetEl.querySelectorAll<HTMLElement>('.el-order-item')
  let correct = 0
  items.forEach((el, idx) => {
    if (el.dataset.segId === correctOrder[idx]) correct++
  })

  const score = correct / correctOrder.length
  const isCorrect = score === 1
  const feedback = isCorrect
    ? ((ep.correctFeedback as string) ?? 'Correct!')
    : ((ep.incorrectFeedback as string) ?? `${correct}/${correctOrder.length} segments in correct position.`)
  return { correct: isCorrect, score, feedback }
}

// ─── Hotspot ──────────────────────────────────────────────────────────────────

/** Geometry helpers (inlined — no external dependency) */
function pointInRect(px: number, py: number, x1: number, y1: number, x2: number, y2: number): boolean {
  return px >= Math.min(x1, x2) && px <= Math.max(x1, x2)
      && py >= Math.min(y1, y2) && py <= Math.max(y1, y2)
}

function pointInCircle(px: number, py: number, cx: number, cy: number, r: number): boolean {
  return (px - cx) ** 2 + (py - cy) ** 2 <= r * r
}

function pointInPolygon(px: number, py: number, coords: number[]): boolean {
  const n = Math.floor(coords.length / 2)
  if (n < 3) return false
  let inside = false
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = coords[i * 2], yi = coords[i * 2 + 1]
    const xj = coords[j * 2], yj = coords[j * 2 + 1]
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

interface HotspotShape {
  type: 'rect' | 'circle' | 'polygon'
  coords: number[]
}

interface HotspotRegion {
  id: string
  shape: HotspotShape
  isCorrect: boolean
  feedback?: string
}

function regionFromPoint(px: number, py: number, regions: HotspotRegion[]): HotspotRegion | null {
  for (const r of regions) {
    let hit = false
    const c = r.shape.coords
    // MEDIUM-004: skip regions with malformed coordinate arrays
    if (r.shape.type === 'rect'    && c.length < 4) continue
    if (r.shape.type === 'circle'  && c.length < 3) continue
    if (r.shape.type === 'polygon' && c.length < 6) continue
    if (r.shape.type === 'rect')    hit = pointInRect(px, py, c[0], c[1], c[2], c[3])
    if (r.shape.type === 'circle')  hit = pointInCircle(px, py, c[0], c[1], c[2])
    if (r.shape.type === 'polygon') hit = pointInPolygon(px, py, c)
    if (hit) return r
  }
  return null
}

export function evalHotspot(
  ep: Record<string, unknown>,
  widgetEl: HTMLElement,
): EvalResult {
  const regions = (ep.regions as HotspotRegion[]) ?? []
  const multiSelect = ep.multiSelect as boolean | undefined
  const clicksEl = widgetEl.querySelector<HTMLElement>('.el-hotspot-clicks')
  const clickedIds: string[] = clicksEl
    ? Array.from(clicksEl.querySelectorAll<HTMLElement>('[data-region-id]'))
        .map(el => el.dataset.regionId ?? '')
        .filter(Boolean)
    : []

  if (!multiSelect) {
    const regionId = clickedIds[0]
    if (!regionId) return { correct: false, score: 0, feedback: (ep.incorrectFeedback as string) ?? 'No region clicked.' }
    const region = regions.find(r => r.id === regionId)
    const isCorrect = region?.isCorrect ?? false
    return {
      correct: isCorrect,
      score: isCorrect ? 1 : 0,
      feedback: region?.feedback ?? (isCorrect ? (ep.correctFeedback as string) ?? 'Correct!' : (ep.incorrectFeedback as string) ?? 'Incorrect.'),
    }
  }

  // Multi-select
  const correctRegions = regions.filter(r => r.isCorrect)
  if (correctRegions.length === 0) return { correct: false, score: 0, feedback: '' }
  const answerSet = new Set(clickedIds)
  let correctClicks = 0
  let wrongClicks = 0
  for (const id of answerSet) {
    const region = regions.find(r => r.id === id)
    if (region?.isCorrect) correctClicks++
    else wrongClicks++
  }
  const rawScore = (correctClicks - wrongClicks) / correctRegions.length
  const score = Math.max(0, Math.min(1, rawScore))
  const isCorrect = score === 1
  return {
    correct: isCorrect,
    score,
    feedback: isCorrect ? (ep.correctFeedback as string) ?? 'Correct!' : (ep.incorrectFeedback as string) ?? 'Incorrect.',
  }
}

// ─── DOM interaction setup (called after a hotspot widget is rendered) ────────

export function attachHotspotEvents(widgetEl: HTMLElement, ep: Record<string, unknown>): void {
  const regions = (ep.regions as HotspotRegion[]) ?? []
  const multiSelect = ep.multiSelect as boolean | undefined
  const img = widgetEl.querySelector<HTMLImageElement>('img')
  const canvas = widgetEl.querySelector<HTMLCanvasElement>('.el-hotspot-canvas')
  const clicksEl = widgetEl.querySelector<HTMLElement>('.el-hotspot-clicks')
  if (!img || !canvas || !clicksEl) return

  // Resize canvas to match image after load
  const syncCanvas = (): void => {
    canvas.width = img.naturalWidth || img.offsetWidth
    canvas.height = img.naturalHeight || img.offsetHeight
    canvas.style.width = `${img.offsetWidth}px`
    canvas.style.height = `${img.offsetHeight}px`
  }
  img.addEventListener('load', syncCanvas, { once: true })
  if (img.complete) syncCanvas()

  canvas.addEventListener('click', (e) => {
    if (canvas.offsetWidth === 0 || canvas.offsetHeight === 0) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = (img.naturalWidth || img.offsetWidth) / canvas.offsetWidth
    const scaleY = (img.naturalHeight || img.offsetHeight) / canvas.offsetHeight
    const px = (e.clientX - rect.left) * scaleX
    const py = (e.clientY - rect.top) * scaleY

    const hit = regionFromPoint(px, py, regions)
    if (!hit) return

    if (!multiSelect) {
      // Replace previous click
      clicksEl.innerHTML = `<span data-region-id="${hit.id}"></span>`
      // Visual feedback: draw rectangle
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.fillStyle = hit.isCorrect ? 'rgba(0,200,0,0.4)' : 'rgba(200,0,0,0.4)'
        const c = hit.shape.coords
        if (hit.shape.type === 'rect') ctx.fillRect(c[0], c[1], c[2] - c[0], c[3] - c[1])
        if (hit.shape.type === 'circle') { ctx.beginPath(); ctx.arc(c[0], c[1], c[2], 0, Math.PI * 2); ctx.fill() }
      }
    } else {
      // Toggle
      const existing = clicksEl.querySelector<HTMLElement>(`[data-region-id="${hit.id}"]`)
      if (existing) {
        existing.remove()
      } else {
        const marker = document.createElement('span')
        marker.dataset.regionId = hit.id
        clicksEl.appendChild(marker)
      }
    }
  })
}

// ─── Arrange/Order reorder events ─────────────────────────────────────────────

export function attachArrangeEvents(widgetEl: HTMLElement, itemSelector: string): void {
  const list = widgetEl.querySelector<HTMLElement>('.el-arrange-list')
  if (!list) return

  list.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('.el-arrange-up, .el-arrange-down')
    if (!btn) return

    const item = btn.closest<HTMLElement>(itemSelector)
    if (!item) return

    const items = Array.from(list.querySelectorAll<HTMLElement>(itemSelector))
    const idx = items.indexOf(item)
    const isUp = btn.classList.contains('el-arrange-up')

    if (isUp && idx > 0) {
      list.insertBefore(item, items[idx - 1])
    } else if (!isUp && idx < items.length - 1) {
      const next = items[idx + 1]
      if (next.nextSibling) {
        list.insertBefore(item, next.nextSibling)
      } else {
        list.appendChild(item)
      }
    }
  })
}

// ─── Drag events for drag-objects and drop-target ─────────────────────────────

export function attachDragEvents(widgetEl: HTMLElement): void {
  widgetEl.addEventListener('dragstart', (e) => {
    const item = (e.target as HTMLElement).closest<HTMLElement>('.el-drag-item')
    if (!item) return
    e.dataTransfer?.setData('text/plain', item.dataset.itemId ?? '')
    e.dataTransfer?.setData('text/source', item.parentElement?.className.includes('el-drag-bank') ? 'bank' : 'zone')
  })

  widgetEl.addEventListener('dragover', (e) => {
    const zone = (e.target as HTMLElement).closest<HTMLElement>('.el-drop-zone, .el-drag-bank')
    if (zone) e.preventDefault()
  })

  widgetEl.addEventListener('drop', (e) => {
    const zone = (e.target as HTMLElement).closest<HTMLElement>('.el-drop-zone, .el-drag-bank')
    if (!zone) return
    e.preventDefault()

    const itemId = e.dataTransfer?.getData('text/plain')
    if (!itemId) return

    const item = widgetEl.querySelector<HTMLElement>(`[data-item-id="${itemId}"]`)
    if (!item) return

    zone.appendChild(item)
  })
}
