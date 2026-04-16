function readEnv(name, fallback = '') {
  const v = process.env[name]
  return v ? String(v).trim() : fallback
}

function getAppOrigin(req) {
  const proto = String(req?.headers?.['x-forwarded-proto'] || 'https').split(',')[0].trim() || 'https'
  const host = String(req?.headers?.['x-forwarded-host'] || req?.headers?.host || '').split(',')[0].trim()
  return host ? `${proto}://${host}` : ''
}

function parseCookies(req) {
  const header = String(req?.headers?.cookie || '')
  const out = {}
  if (!header) return out
  const parts = header.split(';')
  for (const p of parts) {
    const s = String(p || '').trim()
    if (!s) continue
    const idx = s.indexOf('=')
    if (idx <= 0) continue
    const k = s.slice(0, idx).trim()
    const v = s.slice(idx + 1).trim()
    if (!k) continue
    try { out[k] = decodeURIComponent(v) } catch (_) { out[k] = v }
  }
  return out
}

function safeNextPath(raw) {
  const p = String(raw || '').trim()
  if (!p) return '/login'
  if (!p.startsWith('/')) return '/login'
  if (p.startsWith('//')) return '/login'
  if (p.toLowerCase().includes('http:') || p.toLowerCase().includes('https:')) return '/login'
  return p
}

function decodeJwtPayload(token) {
  const raw = String(token || '').trim()
  const parts = raw.split('.')
  if (parts.length < 2) return null
  const p = parts[1] || ''
  const pad = p.length % 4 === 0 ? '' : '='.repeat(4 - (p.length % 4))
  const b64 = (p + pad).replace(/-/g, '+').replace(/_/g, '/')
  try {
    const jsonText = Buffer.from(b64, 'base64').toString('utf-8')
    return JSON.parse(jsonText || '{}')
  } catch (_) {
    return null
  }
}

function extractProjectRefFromSupabaseUrl(url) {
  const raw = String(url || '').trim()
  if (!raw) return ''
  try {
    const u = new URL(raw)
    const host = String(u.hostname || '')
    const m = host.match(/^([a-z0-9-]+)\.supabase\.co$/i)
    return m ? String(m[1] || '') : ''
  } catch (_) {
    return ''
  }
}

function extractProjectRefFromIss(iss) {
  const raw = String(iss || '').trim()
  if (!raw) return ''
  try {
    const u = new URL(raw)
    const host = String(u.hostname || '')
    const m = host.match(/^([a-z0-9-]+)\.supabase\.co$/i)
    return m ? String(m[1] || '') : ''
  } catch (_) {
    return ''
  }
}

function pickSupabaseAnonKey({ supabaseUrl }) {
  const urlRef = extractProjectRefFromSupabaseUrl(supabaseUrl)
  const candidates = [
    { name: 'VITE_SUPABASE_ANON_KEY', value: readEnv('VITE_SUPABASE_ANON_KEY', '') },
    { name: 'VITE_PUBLIC_SUPABASE_ANON_KEY', value: readEnv('VITE_PUBLIC_SUPABASE_ANON_KEY', '') },
    { name: 'SUPABASE_ANON_KEY', value: readEnv('SUPABASE_ANON_KEY', '') },
    { name: 'VITE_SUPABASE_KEY', value: readEnv('VITE_SUPABASE_KEY', '') },
    { name: 'VITE_PUBLIC_SUPABASE_KEY', value: readEnv('VITE_PUBLIC_SUPABASE_KEY', '') },
  ].filter((c) => Boolean(c.value))

  let firstAnon = null
  let firstAny = null

  for (const c of candidates) {
    if (!firstAny) firstAny = c
    const payload = decodeJwtPayload(c.value) || {}
    const role = String(payload?.role || '').trim().toLowerCase()
    const iss = String(payload?.iss || '').trim()
    const keyRef = extractProjectRefFromIss(iss)
    if (role === 'anon' && !firstAnon) firstAnon = { ...c, role, keyRef, urlRef }
    if (role === 'anon' && (!urlRef || !keyRef || keyRef === urlRef)) {
      return { ...c, role, keyRef, urlRef }
    }
  }
  if (firstAnon) return firstAnon
  if (firstAny) return { ...firstAny, role: '', keyRef: '', urlRef }
  return { name: '', value: '', role: '', keyRef: '', urlRef }
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.statusCode = 405
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'method_not_allowed' }))
      return
    }

    const supabaseUrl =
      readEnv('VITE_SUPABASE_URL', '') ||
      readEnv('VITE_PUBLIC_SUPABASE_URL', '') ||
      readEnv('SUPABASE_URL', '')
    const picked = pickSupabaseAnonKey({ supabaseUrl })
    const anonKey = String(picked?.value || '').trim()

    const appOrigin = getAppOrigin(req)
    if (!appOrigin) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'missing_app_origin' }))
      return
    }

    const url = new URL(req.url, appOrigin)
    const next = safeNextPath(url.searchParams.get('next') || '')
    const code = String(url.searchParams.get('code') || '').trim()

    const clearCookie = [
      'connekt_pkce_verifier=',
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      'Max-Age=0',
    ]
    if (String(appOrigin).startsWith('https://')) clearCookie.push('Secure')

    if (!supabaseUrl || !anonKey) {
      res.setHeader('Set-Cookie', clearCookie.join('; '))
      res.statusCode = 302
      const hint = picked?.name ? ` missing_key_src=${picked.name}` : ''
      res.setHeader('Location', `/login?error=missing_supabase_env&error_description=${encodeURIComponent(`missing_supabase_env${hint}`)}`)
      res.end()
      return
    }

    if (!code) {
      res.setHeader('Set-Cookie', clearCookie.join('; '))
      res.statusCode = 302
      res.setHeader('Location', `/login?error=missing_code&error_description=${encodeURIComponent('missing_code')}`)
      res.end()
      return
    }

    const cookies = parseCookies(req)
    const verifier = String(cookies.connekt_pkce_verifier || '').trim()
    if (!verifier) {
      res.setHeader('Set-Cookie', clearCookie.join('; '))
      res.statusCode = 302
      res.setHeader('Location', `/login?error=missing_pkce_verifier&error_description=${encodeURIComponent('missing_pkce_verifier')}`)
      res.end()
      return
    }

    const tokenUrl = `${supabaseUrl.replace(/\/+$/, '')}/auth/v1/token?grant_type=pkce`
    const r = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ auth_code: code, code_verifier: verifier }),
    })

    const text = await r.text().catch(() => '')
    let body = null
    try { body = JSON.parse(text || '{}') } catch (_) { body = null }

    res.setHeader('Set-Cookie', clearCookie.join('; '))

    if (!r.ok) {
      const baseMsg = String(body?.msg || body?.message || body?.error_description || body?.error || text || 'oauth_token_failed')
      const msgLower = baseMsg.toLowerCase()
      const isInvalidKey = msgLower.includes('invalid api key')
      const extra =
        isInvalidKey
          ? ` (key_src=${String(picked?.name || '')} key_role=${String(picked?.role || '')} url_ref=${String(picked?.urlRef || '')} key_ref=${String(picked?.keyRef || '')})`
          : ''
      const msg = `${baseMsg}${extra}`
      res.statusCode = 302
      res.setHeader('Location', `/login?error=oauth_token_failed&error_description=${encodeURIComponent(msg)}`)
      res.end()
      return
    }

    const at = String(body?.access_token || '').trim()
    const rt = String(body?.refresh_token || '').trim()
    if (!at || !rt) {
      res.statusCode = 302
      res.setHeader('Location', `/login?error=missing_tokens&error_description=${encodeURIComponent('missing_tokens')}`)
      res.end()
      return
    }

    const target = new URL(`${appOrigin}${next}`)
    target.hash = `sb_at=${encodeURIComponent(at)}&sb_rt=${encodeURIComponent(rt)}`
    res.statusCode = 302
    res.setHeader('Location', `${target.pathname}${target.search}${target.hash}`)
    res.end()
  } catch (e) {
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'internal_error', message: e?.message || String(e) }))
  }
}
