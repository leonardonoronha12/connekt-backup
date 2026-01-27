import { getSupabaseAdmin, getAuthedUser, json, isUuid } from '../src/server/supabaseAdmin.js'

const GATEWAY_URL = process.env.VITE_PLANS_GATEWAY_URL || process.env.PLANS_GATEWAY_URL || ''
const GATEWAY_API_KEY = process.env.VITE_PLANS_GATEWAY_API_KEY || process.env.PLANS_GATEWAY_API_KEY || ''
const GATEWAY_AUTH = process.env.VITE_PLANS_GATEWAY_AUTH || process.env.PLANS_GATEWAY_AUTH || ''
const GATEWAY_AUTHDATA = process.env.VITE_PLANS_GATEWAY_AUTHDATA || process.env.PLANS_GATEWAY_AUTHDATA || ''

let cachedAuth = null

async function getGatewayAuthToken() {
  try {
    if (cachedAuth && cachedAuth.ts > Date.now() - 55 * 60_000) return cachedAuth.token
  } catch (_) {}

  if (!GATEWAY_URL || !GATEWAY_API_KEY || !GATEWAY_AUTHDATA) return null
  try {
    const url = `${String(GATEWAY_URL).replace(/\/$/, '')}/authentication/v2/auth`
    const headers = { 'x-api-key': GATEWAY_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' }
    const body = { authData: GATEWAY_AUTHDATA }
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
    if (!res.ok) return null
    const data = await res.json().catch(() => ({}))
    const token = data?.auth_token || data?.token || data?.access_token || null
    if (token) cachedAuth = { token, ts: Date.now() }
    return token
  } catch (_) {
    return null
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' })

  const admin = getSupabaseAdmin()
  if (!admin) return json(res, 501, { error: 'proxy_disabled' })

  const auth = await getAuthedUser(admin, req)
  if (!auth.user) return json(res, 401, { error: auth.error || 'unauthorized' })

  if (!GATEWAY_URL || !GATEWAY_API_KEY) return json(res, 501, { error: 'gateway_not_configured' })

  try {
    const u = new URL(req.url, 'http://localhost')
    const simId = String(u.searchParams.get('simId') || '').trim()
    const linkId = String(u.searchParams.get('linkId') || '').trim()
    if (!simId || !isUuid(simId)) return json(res, 400, { error: 'invalid_simId' })
    if (!linkId) return json(res, 400, { error: 'missing_linkId' })

    const token = await getGatewayAuthToken()
    const basicFromEnv = (GATEWAY_AUTH && GATEWAY_AUTH.startsWith('Basic ')) ? GATEWAY_AUTH : (GATEWAY_AUTHDATA ? `Basic ${GATEWAY_AUTHDATA}` : null)
    const envAuthFallback = (!token && !basicFromEnv && GATEWAY_AUTH) ? GATEWAY_AUTH : null
    const authModes = []
    if (token) authModes.push({ value: String(token) })
    if (basicFromEnv) authModes.push({ value: basicFromEnv })
    if (envAuthFallback) authModes.push({ value: envAuthFallback })

    const url = `${String(GATEWAY_URL).replace(/\/$/, '')}/payments/v1/paymentlink/charges/${encodeURIComponent(linkId)}`
    let r = null
    let payload = null
    for (let i = 0; i < Math.max(1, authModes.length); i++) {
      const selected = authModes[i] || { value: undefined }
      const headers = {
        Accept: 'application/json',
        'x-api-key': GATEWAY_API_KEY,
        ...(selected.value ? { Authorization: selected.value } : {}),
      }
      r = await fetch(url, { method: 'GET', headers })
      payload = await r.json().catch(() => ({}))
      if (r.ok) break
    }

    if (!r || !r.ok) return json(res, 502, { error: 'verify_failed', status: r?.status || 0, payload })

    const charges = Array.isArray(payload) ? payload : (payload?.charges || payload?.data || [])
    const paid = Array.isArray(charges) && charges.some((c) => {
      const s = String(c?.status || '').toLowerCase()
      const code = Number(c?.status)
      return s === 'paid' || s === 'succeeded' || s === 'captured' || s === 'aprovado' || c?.paid === true || code === 2
    })
    return json(res, 200, { ok: true, paid: !!paid, simId, linkId })
  } catch (e) {
    return json(res, 500, { error: 'internal_error', message: e?.message || String(e) })
  }
}

