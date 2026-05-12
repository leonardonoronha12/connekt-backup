import crypto from 'node:crypto'

function readEnv(name, fallback = '') {
  const v = process.env[name]
  return v ? String(v).trim() : fallback
}

function getAppOrigin(req) {
  const rawHost = String(req?.headers?.['x-forwarded-host'] || req?.headers?.host || '').split(',')[0].trim()
  const isLocal =
    rawHost.includes('localhost') ||
    rawHost.startsWith('127.0.0.1') ||
    rawHost.startsWith('0.0.0.0')
  const proto = String(req?.headers?.['x-forwarded-proto'] || (isLocal ? 'http' : 'https')).split(',')[0].trim() || (isLocal ? 'http' : 'https')
  const host = rawHost
  return host ? `${proto}://${host}` : ''
}

function base64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function safeNextPath(raw) {
  const p = String(raw || '').trim()
  if (!p) return '/login'
  if (!p.startsWith('/')) return '/login'
  if (p.startsWith('//')) return '/login'
  if (p.toLowerCase().includes('http:') || p.toLowerCase().includes('https:')) return '/login'
  return p
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
    const cleanedSupabaseUrl = String(supabaseUrl || '').trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '')
    if (!cleanedSupabaseUrl) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'missing_supabase_url' }))
      return
    }

    const appOrigin = getAppOrigin(req)
    if (!appOrigin) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'missing_app_origin' }))
      return
    }

    const u = new URL(req.url, appOrigin)
    const next = safeNextPath(u.searchParams.get('next') || u.searchParams.get('redirect') || '')

    const state = base64url(crypto.randomBytes(16))
    const codeVerifier = base64url(crypto.randomBytes(32))
    const codeChallenge = base64url(crypto.createHash('sha256').update(codeVerifier).digest())

    const callbackUrl = new URL('/api/oauth/facebook/callback', appOrigin)
    callbackUrl.searchParams.set('next', next)

    const authorizeUrl = new URL(`${cleanedSupabaseUrl.replace(/\/+$/, '')}/auth/v1/authorize`)
    authorizeUrl.searchParams.set('provider', 'facebook')
    authorizeUrl.searchParams.set('redirect_to', callbackUrl.toString())
    authorizeUrl.searchParams.set('code_challenge', codeChallenge)
    authorizeUrl.searchParams.set('code_challenge_method', 's256')
    authorizeUrl.searchParams.set('state', state)

    const cookieName = `connekt_pkce_${state}`
    const cookie = [
      `${cookieName}=${encodeURIComponent(codeVerifier)}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      'Max-Age=900',
    ]
    if (String(appOrigin).startsWith('https://')) cookie.push('Secure')
    res.setHeader('Set-Cookie', cookie.join('; '))
    res.statusCode = 302
    res.setHeader('Location', authorizeUrl.toString())
    res.end()
  } catch (e) {
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'internal_error', message: e?.message || String(e) }))
  }
}

