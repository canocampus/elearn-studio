import type { DisplayMessageAction } from '../types'
import type { ExecutionContext } from '../context'

export function executeDisplayMessage(
  action: DisplayMessageAction,
  ctx: ExecutionContext,
): void {
  const MAX_MESSAGE_LENGTH = 5000
  const MAX_TITLE_LENGTH = 200
  const { message, title } = action.params
  const truncatedMsg = (message || '').slice(0, MAX_MESSAGE_LENGTH)
  const truncatedTitle = title ? title.slice(0, MAX_TITLE_LENGTH) : undefined

  // Build a simple modal overlay inside the player container
  const overlay = document.createElement('div')
  overlay.className = 'el-message-overlay'
  overlay.style.cssText = [
    'position:absolute;inset:0;',
    'background:rgba(0,0,0,0.5);',
    'display:flex;align-items:center;justify-content:center;',
    'z-index:9999;',
  ].join('')

  const box = document.createElement('div')
  box.style.cssText = [
    'background:#fff;padding:24px;border-radius:6px;',
    'max-width:400px;width:90%;box-shadow:0 4px 16px rgba(0,0,0,0.3);',
    'max-height:60vh;overflow-y:auto;font-family:sans-serif;',
  ].join('')

  if (truncatedTitle) {
    const h = document.createElement('h3')
    h.style.cssText = 'margin:0 0 12px;font-size:1.1em;'
    h.textContent = truncatedTitle
    box.appendChild(h)
  }

  const p = document.createElement('p')
  p.style.cssText = 'margin:0 0 16px;line-height:1.5;'
  p.textContent = truncatedMsg
  box.appendChild(p)

  const btn = document.createElement('button')
  btn.textContent = 'OK'
  btn.style.cssText = 'padding:8px 24px;cursor:pointer;'
  btn.addEventListener('click', () => overlay.remove(), { once: true })
  box.appendChild(btn)

  overlay.appendChild(box)
  ctx.container.appendChild(overlay)
}
