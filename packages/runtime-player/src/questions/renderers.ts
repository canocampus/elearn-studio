/**
 * HTML string renderers for advanced question types — T022
 * All functions are pure: they return HTML strings, no DOM side effects.
 */

// Reuse helpers from parent module via re-export pattern — inline them here
// (runtime-player is a bundled IIFE; all local modules are tree-shaken in).

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function escAttr(s: string): string {
  return s.replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function positionStyle(b: { x: number; y: number; width: number; height: number }): string {
  return `position:absolute;left:${b.x}px;top:${b.y}px;width:${b.width}px;height:${b.height}px;`
}

const BOX_STYLE = [
  'box-sizing:border-box;padding:12px;border:1px solid #ddd;border-radius:4px;',
  'overflow:auto;font-family:sans-serif;',
].join('')

const SUBMIT_STYLE = 'margin-top:8px;cursor:pointer;padding:4px 16px;'

// ─── Match Items ──────────────────────────────────────────────────────────────

/** Renders a match-items question widget as an HTML string. Each left-side term has a dropdown to select a right-side match. */
export function renderMatchItems(w: { id: string; bounds: { x: number; y: number; width: number; height: number }; extendedProperties: Record<string, unknown> }): string {
  const ep = w.extendedProperties
  const qText = (ep.questionText as string) ?? 'Question'
  const pairs = (ep.pairs as Array<{ id: string; left: string; right: string }>) ?? []
  // Collect right-side options
  const rights = pairs.map(p => p.right)
  const style = `${positionStyle(w.bounds)}${BOX_STYLE}`

  const rows = pairs.map(p => {
    const opts = rights.map(r => `<option value="${escAttr(r)}"${r === '' ? ' selected' : ''}>${escHtml(r)}</option>`).join('')
    return `<tr>
      <td style="padding:4px 8px 4px 0;font-weight:bold;">${escHtml(p.left)}</td>
      <td><select class="el-match-select" data-pair-id="${escAttr(p.id)}" style="width:100%;">
        <option value="">-- select --</option>${opts}
      </select></td>
    </tr>`
  }).join('')

  return `<div class="el-widget el-question el-question-match" id="w-${w.id}" data-qtype="match" data-widget-id="${w.id}" style="${style}">
    <p style="font-weight:bold;margin:0 0 8px;">${escHtml(qText)}</p>
    <table style="width:100%;border-collapse:collapse;">${rows}</table>
    <button class="el-submit-btn" data-widget-id="${w.id}" style="${SUBMIT_STYLE}">Submit</button>
    <div class="el-feedback" style="margin-top:6px;font-style:italic;"></div>
  </div>`
}

// ─── Drag Objects ─────────────────────────────────────────────────────────────

/** Renders a drag-objects question widget as an HTML string. Items in a drag bank are dragged into labeled drop zones. */
export function renderDragObjects(w: { id: string; bounds: { x: number; y: number; width: number; height: number }; extendedProperties: Record<string, unknown> }): string {
  const ep = w.extendedProperties
  const qText = (ep.questionText as string) ?? 'Question'
  const items = (ep.items as Array<{ id: string; label: string }>) ?? []
  const zones = (ep.zones as Array<{ id: string; label: string }>) ?? []
  const style = `${positionStyle(w.bounds)}${BOX_STYLE}`

  const itemHtml = items.map(item =>
    `<div class="el-drag-item" draggable="true" data-item-id="${escAttr(item.id)}"
       style="display:inline-block;margin:4px;padding:4px 10px;background:#e0e0e0;border-radius:4px;cursor:grab;">
      ${escHtml(item.label)}
    </div>`
  ).join('')

  const zoneHtml = zones.map(zone =>
    `<div class="el-drop-zone" data-zone-id="${escAttr(zone.id)}"
       style="min-height:48px;border:2px dashed #999;border-radius:4px;padding:4px;margin:4px 0;flex:1;">
      <span style="color:#aaa;font-size:0.85em;">${escHtml(zone.label)}</span>
    </div>`
  ).join('')

  return `<div class="el-widget el-question el-question-drag" id="w-${w.id}" data-qtype="drag-objects" data-widget-id="${w.id}" style="${style}">
    <p style="font-weight:bold;margin:0 0 8px;">${escHtml(qText)}</p>
    <div class="el-drag-bank" style="margin-bottom:8px;min-height:40px;border:1px solid #ccc;padding:4px;border-radius:4px;">
      ${itemHtml}
    </div>
    <div class="el-drag-zones" style="display:flex;gap:8px;">${zoneHtml}</div>
    <button class="el-submit-btn" data-widget-id="${w.id}" style="${SUBMIT_STYLE}">Submit</button>
    <div class="el-feedback" style="margin-top:6px;font-style:italic;"></div>
  </div>`
}

// ─── Drop Target ──────────────────────────────────────────────────────────────

/** Renders a drop-target question widget. Shares HTML structure with drag-objects; scoring differs (one correct zone per item). */
export function renderDropTarget(w: { id: string; bounds: { x: number; y: number; width: number; height: number }; extendedProperties: Record<string, unknown> }): string {
  // Uses same HTML structure as drag-objects; scoring logic differs
  return renderDragObjects(w).replace('data-qtype="drag-objects"', 'data-qtype="drop-target"')
}

// ─── Arrange Objects ──────────────────────────────────────────────────────────

/** Renders an arrange-objects question widget. Items are reordered via up/down buttons; correct order evaluated on submit. */
export function renderArrangeObjects(w: { id: string; bounds: { x: number; y: number; width: number; height: number }; extendedProperties: Record<string, unknown> }): string {
  const ep = w.extendedProperties
  const qText = (ep.questionText as string) ?? 'Question'
  const items = (ep.items as Array<{ id: string; label: string }>) ?? []
  const style = `${positionStyle(w.bounds)}${BOX_STYLE}`

  const rows = items.map((item) =>
    `<li class="el-arrange-item" data-item-id="${escAttr(item.id)}"
       style="list-style:none;display:flex;align-items:center;gap:8px;margin:4px 0;padding:6px;background:#f4f4f4;border-radius:4px;">
      <span style="flex:1;">${escHtml(item.label)}</span>
      <button class="el-arrange-up" style="cursor:pointer;padding:2px 8px;" aria-label="Move up">▲</button>
      <button class="el-arrange-down" style="cursor:pointer;padding:2px 8px;" aria-label="Move down">▼</button>
    </li>`
  ).join('')

  return `<div class="el-widget el-question el-question-arrange" id="w-${w.id}" data-qtype="arrange-objects" data-widget-id="${w.id}" style="${style}">
    <p style="font-weight:bold;margin:0 0 8px;">${escHtml(qText)}</p>
    <ol class="el-arrange-list" style="padding:0;margin:0;">${rows}</ol>
    <button class="el-submit-btn" data-widget-id="${w.id}" style="${SUBMIT_STYLE}">Submit</button>
    <div class="el-feedback" style="margin-top:6px;font-style:italic;"></div>
  </div>`
}

// ─── Order Text ───────────────────────────────────────────────────────────────

/** Renders an order-text question widget. Text segments are shuffled (Fisher-Yates) and reordered via up/down buttons. */
export function renderOrderText(w: { id: string; bounds: { x: number; y: number; width: number; height: number }; extendedProperties: Record<string, unknown> }): string {
  const ep = w.extendedProperties
  const qText = (ep.questionText as string) ?? 'Question'
  const segments = (ep.segments as Array<{ id: string; text: string }>) ?? []
  // Shuffle display order using Fisher-Yates so segments start in random order
  const displaySegments = [...segments]
  for (let i = displaySegments.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [displaySegments[i], displaySegments[j]] = [displaySegments[j], displaySegments[i]]
  }
  const style = `${positionStyle(w.bounds)}${BOX_STYLE}`

  const rows = displaySegments.map((seg) =>
    `<li class="el-order-item" data-seg-id="${escAttr(seg.id)}"
       style="list-style:none;display:flex;align-items:center;gap:8px;margin:4px 0;padding:6px;background:#f4f4f4;border-radius:4px;">
      <span style="flex:1;">${escHtml(seg.text)}</span>
      <button class="el-arrange-up" style="cursor:pointer;padding:2px 8px;" aria-label="Move up">▲</button>
      <button class="el-arrange-down" style="cursor:pointer;padding:2px 8px;" aria-label="Move down">▼</button>
    </li>`
  ).join('')

  return `<div class="el-widget el-question el-question-order" id="w-${w.id}" data-qtype="order-text" data-widget-id="${w.id}" style="${style}">
    <p style="font-weight:bold;margin:0 0 8px;">${escHtml(qText)}</p>
    <ol class="el-arrange-list" style="padding:0;margin:0;">${rows}</ol>
    <button class="el-submit-btn" data-widget-id="${w.id}" style="${SUBMIT_STYLE}">Submit</button>
    <div class="el-feedback" style="margin-top:6px;font-style:italic;"></div>
  </div>`
}

// ─── Hotspot ──────────────────────────────────────────────────────────────────

/** Renders a hotspot question widget. An image is overlaid with an invisible canvas; clicks are evaluated against named regions on submit. */
export function renderHotspot(w: { id: string; bounds: { x: number; y: number; width: number; height: number }; extendedProperties: Record<string, unknown> }): string {
  const ep = w.extendedProperties
  const qText = (ep.questionText as string) ?? 'Question'
  const imageUrl = (ep.imageUrl as string) ?? ''
  const style = `${positionStyle(w.bounds)}${BOX_STYLE}`

  return `<div class="el-widget el-question el-question-hotspot" id="w-${w.id}" data-qtype="hotspot" data-widget-id="${w.id}" style="${style}">
    <p style="font-weight:bold;margin:0 0 8px;">${escHtml(qText)}</p>
    <div class="el-hotspot-container" style="position:relative;display:inline-block;cursor:crosshair;">
      <img src="${escAttr(imageUrl)}" alt="Hotspot image" style="display:block;max-width:100%;user-select:none;" draggable="false" />
      <canvas class="el-hotspot-canvas" style="position:absolute;top:0;left:0;pointer-events:all;opacity:0.3;"></canvas>
    </div>
    <div class="el-hotspot-clicks" style="display:none;"></div>
    <button class="el-submit-btn" data-widget-id="${w.id}" style="${SUBMIT_STYLE}">Submit</button>
    <div class="el-feedback" style="margin-top:6px;font-style:italic;"></div>
  </div>`
}
