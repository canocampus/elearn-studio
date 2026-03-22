/**
 * HACP Bridge generator — T026
 *
 * Returns a self-contained IIFE that implements window.API (SCORM 1.2 JS interface)
 * backed by AICC HACP HTTP POST requests when AICC_URL and AICC_SID are present in
 * the URL query string.
 *
 * If those params are absent the bridge does nothing and the runtime player falls
 * back to whatever window.API the LMS has already injected (SCORM 1.2 path).
 *
 * HACP command mapping:
 *   LMSInitialize → GetParam  (fetches existing tracking data from LMS)
 *   LMSCommit     → PutParam  (sends cached cmi.* values to LMS)
 *   LMSFinish     → PutParam + ExitAU  (commit then terminate session)
 *   LMSGetValue / LMSSetValue operate on an in-memory cache; no HTTP per-call
 */

/** Returns the HACP bridge as an IIFE string safe to embed in a <script> tag. */
export function buildHACPBridge(): string {
  // Written as an ES5 IIFE (no arrow functions, no const/let) for maximum
  // browser compatibility inside LMS iframes.
  return `(function () {
  'use strict';
  var qp = new URLSearchParams(location.search);
  var aiccUrl = qp.get('AICC_URL') || qp.get('aicc_url');
  var aiccSid = qp.get('AICC_SID') || qp.get('aicc_sid');
  if (!aiccUrl || !aiccSid) return; // Not an AICC launch — do nothing

  // Validate that AICC_URL is same-origin to prevent data exfiltration via
  // a crafted launch URL pointing at an attacker-controlled endpoint.
  try {
    var parsedUrl = new URL(aiccUrl, location.href);
    if (parsedUrl.origin !== location.origin) {
      console.warn('[HACP] AICC_URL origin mismatch — refusing cross-origin POST:', parsedUrl.origin);
      return;
    }
  } catch (e) {
    console.warn('[HACP] Invalid AICC_URL:', aiccUrl);
    return;
  }

  var cache = {};

  // Send a HACP command to the LMS via HTTP POST.
  // Uses fetch with keepalive:true so the request survives page unload
  // (important for LMSFinish which may fire during navigation).
  function postHACP(cmd, aiccData) {
    var body = 'command=' + encodeURIComponent(cmd) +
               '&session_id=' + encodeURIComponent(aiccSid);
    if (aiccData) body += '&AICC_Data=' + encodeURIComponent(aiccData);
    return fetch(aiccUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body,
      keepalive: true,
    }).catch(function (e) { console.warn('[HACP] POST failed:', e); });
  }

  // Parse key=value pairs from a named [Section] in HACP INI response text.
  function readSection(text, name) {
    var out = {};
    var lines = text.split('\\n');
    var active = false;
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i].trim();
      if (l.toLowerCase() === '[' + name.toLowerCase() + ']') { active = true; continue; }
      if (active && l.charAt(0) === '[') { break; }
      if (active) {
        var eq = l.indexOf('=');
        if (eq > 0) out[l.slice(0, eq).trim().toLowerCase()] = l.slice(eq + 1).trim();
      }
    }
    return out;
  }

  // Build the HACP PutParam body: [Core] INI section + optional [Core_Lesson] for suspend_data.
  function buildPutBody() {
    var s = '[Core]\\r\\n';
    if (cache['cmi.core.lesson_status']    !== undefined) s += 'lesson_status='    + cache['cmi.core.lesson_status']    + '\\r\\n';
    if (cache['cmi.core.score.raw']        !== undefined) s += 'score='            + cache['cmi.core.score.raw']        + '\\r\\n';
    if (cache['cmi.core.session_time']     !== undefined) s += 'time='             + cache['cmi.core.session_time']     + '\\r\\n';
    if (cache['cmi.core.lesson_location']  !== undefined) s += 'lesson_location='  + cache['cmi.core.lesson_location']  + '\\r\\n';
    if (cache['cmi.suspend_data']) s += '\\r\\n[Core_Lesson]\\r\\n' + cache['cmi.suspend_data'];
    return s;
  }

  window.API = {
    LMSInitialize: function (x) {
      postHACP('GetParam', '')
        .then(function (r) { return r ? r.text() : null; })
        .then(function (t) {
          if (!t) return;
          var c = readSection(t, 'Core');
          if (c.lesson_status)    cache['cmi.core.lesson_status']   = c.lesson_status;
          if (c.score)            cache['cmi.core.score.raw']        = c.score;
          if (c.lesson_location)  cache['cmi.core.lesson_location']  = c.lesson_location;
          var cl = readSection(t, 'Core_Lesson');
          if (cl.suspend_data)    cache['cmi.suspend_data']          = cl.suspend_data;
        })
        .catch(function (e) { console.warn('[HACP] GetParam parse failed:', e); });
      return 'true';
    },

    LMSGetValue:       function (e)    { return cache[e] !== undefined ? String(cache[e]) : ''; },
    LMSSetValue:       function (e, v) { cache[e] = v; return 'true'; },
    LMSCommit:         function (x)    { postHACP('PutParam', buildPutBody()); return 'true'; },
    LMSFinish:         function (x)    {
      postHACP('PutParam', buildPutBody()).then(function () { postHACP('ExitAU', ''); });
      return 'true';
    },
    LMSGetLastError:   function ()     { return '0'; },
    LMSGetErrorString: function (c)    { return ''; },
    LMSGetDiagnostic:  function (p)    { return ''; },
  };
})();`
}
