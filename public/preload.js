;(function () {
  try {
    if (typeof window.global === 'undefined') window.global = window
    if (typeof window.process === 'undefined') window.process = { env: { NODE_ENV: 'production' } }
    if (!window.process) window.process = { env: { NODE_ENV: 'production' } }
    if (!window.process.env) window.process.env = { NODE_ENV: 'production' }
    if (!window.process.env.NODE_ENV) window.process.env.NODE_ENV = 'production'
  } catch (_) {}

  try {
    var host = String(window.location.hostname || '').toLowerCase()
    if (host !== 'app.connektco.com') return
    var path = String(window.location.pathname || '')
    var isAlunoPath = path === '/aluno' || path.indexOf('/aluno/') === 0 || path === '/login-aluno' || path === '/aluno/login'
    if (!isAlunoPath) return
    var search = String(window.location.search || '')
    var sp = new URLSearchParams(search)
    var producerUid = sp.get('producer_uid') || sp.get('producerUserId') || sp.get('PRODUCER_UID') || ''
    producerUid = String(producerUid || '').trim()
    if (!producerUid) return
    if (sp.get('code') || sp.get('error') || sp.get('error_code')) return
    var hash = String(window.location.hash || '')
    if (hash.indexOf('access_token=') >= 0 || hash.indexOf('refresh_token=') >= 0 || hash.indexOf('sb_at=') >= 0 || hash.indexOf('sb_rt=') >= 0) return
    var readTokens = function () {
      try {
        var ls = window.localStorage
        if (!ls) return null
        var keys = []
        try {
          var n = Number(ls.length || 0)
          if (Number.isFinite(n) && n > 0 && typeof ls.key === 'function') {
            for (var i = 0; i < n; i += 1) {
              var k = ls.key(i)
              if (k) keys.push(String(k))
            }
          }
        } catch (_) {}
        if (!keys.length) {
          try { keys = Object.keys(ls || {}) } catch (_) { keys = [] }
        }
        for (var j = 0; j < keys.length; j += 1) {
          var kk = String(keys[j] || '')
          var isSbKey = (kk.indexOf('sb-') === 0 && kk.lastIndexOf('-auth-token') === kk.length - '-auth-token'.length) || kk === 'supabase.auth.token'
          if (!isSbKey) continue
          var raw = ls.getItem(kk)
          if (!raw) continue
          var parsed = null
          try { parsed = JSON.parse(raw) } catch (_) { parsed = null }
          if (!parsed || typeof parsed !== 'object') continue
          var s = parsed.currentSession && typeof parsed.currentSession === 'object' ? parsed.currentSession : parsed
          var at = String(s.access_token || '').trim()
          var rt = String(s.refresh_token || '').trim()
          if (at && rt) return { at: at, rt: rt }
        }
      } catch (_) {}
      return null
    }

    var tokens = readTokens()
    if (tokens && typeof fetch === 'function') {
      fetch('/api/producer?type=public_branding&producerId=' + encodeURIComponent(producerUid))
        .then(function (r) { return r.json().catch(function () { return {} }) })
        .then(function (body) {
          try {
            var memberUrl = String(body && body.member_area_url ? body.member_area_url : '').trim()
            if (!memberUrl) throw new Error('missing_member_url')
            var dest = new URL(memberUrl)
            var to = dest.origin + path + search + '#sb_at=' + encodeURIComponent(tokens.at) + '&sb_rt=' + encodeURIComponent(tokens.rt)
            window.location.replace(to)
          } catch (_) {
            var target = '/api/producer?type=aluno_redirect&producer_uid=' + encodeURIComponent(producerUid) + '&p=' + encodeURIComponent(path) + '&q=' + encodeURIComponent(search)
            window.location.replace(target)
          }
        })
        .catch(function () {
          var target = '/api/producer?type=aluno_redirect&producer_uid=' + encodeURIComponent(producerUid) + '&p=' + encodeURIComponent(path) + '&q=' + encodeURIComponent(search)
          window.location.replace(target)
        })
      return
    }

    var fallbackTarget = '/api/producer?type=aluno_redirect&producer_uid=' + encodeURIComponent(producerUid) + '&p=' + encodeURIComponent(path) + '&q=' + encodeURIComponent(search)
    window.location.replace(fallbackTarget)
  } catch (_) {}
})()

