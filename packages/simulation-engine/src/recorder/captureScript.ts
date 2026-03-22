/**
 * JavaScript injected into the recorded page via Playwright addInitScript.
 * Runs before any page script; survives navigation (re-injected automatically).
 *
 * Captured events accumulate in window.__elearnCapture.events and are flushed
 * by the Node.js side via page.evaluate().
 */
export const CAPTURE_SCRIPT = /* javascript */ `
(function () {
  if (window.__elearnCapture) return  // already injected (SPA navigation guard)

  var seq = 0

  function ts() { return new Date().toISOString() }

  /**
   * Build a concise CSS selector for the element.
   * Priority: #id > data-testid > aria-label > tag+class > nth-child path
   */
  function buildSelector(el) {
    if (!el || el === document.body) return 'body'
    if (el.id) return '#' + el.id
    if (el.getAttribute('data-testid')) return '[data-testid="' + el.getAttribute('data-testid') + '"]'
    if (el.getAttribute('aria-label')) return '[aria-label="' + el.getAttribute('aria-label').replace(/"/g, '\\"') + '"]'

    var path = []
    var curr = el
    while (curr && curr !== document.documentElement) {
      var tag = curr.tagName ? curr.tagName.toLowerCase() : ''
      if (curr.id) { path.unshift('#' + curr.id); break }
      var siblings = curr.parentNode ? Array.prototype.slice.call(curr.parentNode.children) : []
      var idx = siblings.indexOf(curr)
      path.unshift(idx >= 0 ? tag + ':nth-child(' + (idx + 1) + ')' : tag)
      curr = curr.parentNode
      if (path.length > 4) break  // keep selector short
    }
    return path.join(' > ') || 'unknown'
  }

  /** Extract visible text content (max 80 chars, trimmed). */
  function extractText(el) {
    var text = (el.innerText || el.textContent || el.value || el.placeholder || '').trim()
    return text.slice(0, 80)
  }

  window.__elearnCapture = { events: [] }

  // ── Click (left / right / double) ──────────────────────────────────────────
  document.addEventListener('click', function (e) {
    if (e.detail > 1) return  // handled by dblclick
    window.__elearnCapture.events.push({
      seq: ++seq,
      type: e.button === 2 ? 'rightclick' : 'click',
      selector: buildSelector(e.target),
      targetText: extractText(e.target),
      x: Math.round(e.clientX),
      y: Math.round(e.clientY),
      button: e.button === 2 ? 'right' : 'left',
      timestamp: ts(),
    })
  }, true)

  document.addEventListener('dblclick', function (e) {
    window.__elearnCapture.events.push({
      seq: ++seq,
      type: 'dblclick',
      selector: buildSelector(e.target),
      targetText: extractText(e.target),
      x: Math.round(e.clientX),
      y: Math.round(e.clientY),
      timestamp: ts(),
    })
  }, true)

  // ── Keyboard (Tab, Enter, arrow keys, Escape) ───────────────────────────────
  var NAV_KEYS = ['Tab', 'Enter', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ']
  document.addEventListener('keydown', function (e) {
    if (NAV_KEYS.indexOf(e.key) === -1) return
    window.__elearnCapture.events.push({
      seq: ++seq,
      type: 'keydown',
      key: e.key,
      selector: buildSelector(document.activeElement),
      targetText: extractText(document.activeElement),
      timestamp: ts(),
    })
  }, true)

  // ── Text input (debounced to final value) ────────────────────────────────────
  var inputTimer = null
  document.addEventListener('input', function (e) {
    var el = e.target
    if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') return
    if (el.type === 'checkbox' || el.type === 'radio') return
    var capturedSeq = ++seq
    if (inputTimer) clearTimeout(inputTimer)
    inputTimer = setTimeout(function () {
      window.__elearnCapture.events.push({
        seq: capturedSeq,
        type: 'input',
        selector: buildSelector(el),
        targetText: el.placeholder || el.getAttribute('aria-label') || el.name || '',
        value: el.value,
        timestamp: ts(),
      })
      inputTimer = null
    }, 400)
  }, true)

  // ── Select / combo box ───────────────────────────────────────────────────────
  document.addEventListener('change', function (e) {
    var el = e.target
    if (el.tagName !== 'SELECT') return
    var opt = el.options[el.selectedIndex]
    window.__elearnCapture.events.push({
      seq: ++seq,
      type: 'change',
      selector: buildSelector(el),
      targetText: opt ? opt.text : '',
      value: el.value,
      timestamp: ts(),
    })
  }, true)
})()
`
