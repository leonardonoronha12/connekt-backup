import { getSupabaseAdmin, getAuthedUser, json, isUuid } from '../src/server/supabaseAdmin.js'

const MYG_BASE_URL = process.env.MYG_BASE_URL || 'https://api.whitelabel.mygateway.com.br/connekt'
const MYG_API_KEY = process.env.MYG_API_KEY || ''
const MYG_CLIENT_ID = process.env.MYG_CLIENT_ID || ''
const MYG_CLIENT_SECRET = process.env.MYG_CLIENT_SECRET || ''
const MYG_AUTHORIZATION = process.env.MYG_AUTHORIZATION || ''

let cachedAuth = null

async function getMygAuthToken() {
  try {
    const now = Date.now()
    if (cachedAuth && cachedAuth.expiresAt - 60_000 > now) return cachedAuth.token
  } catch (_) {}

  if (!MYG_BASE_URL || !MYG_API_KEY || !MYG_CLIENT_ID || !MYG_CLIENT_SECRET) return null

  const authData = Buffer.from(`${MYG_CLIENT_ID}:${MYG_CLIENT_SECRET}`).toString('base64')
  const url = `${MYG_BASE_URL}/authentication/v2/auth`
  const headers = { 'x-api-key': MYG_API_KEY, 'Content-Type': 'application/json', 'Accept': 'application/json' }
  const body = { authData }
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
  if (!res.ok) return null
  const data = await res.json().catch(() => ({}))
  const token = data?.auth_token || null
  const expISO = data?.expires_in
  let expiresAt = Date.now() + 10 * 60_000
  if (expISO) {
    const t = Date.parse(expISO)
    if (Number.isFinite(t)) expiresAt = t
  }
  if (token) cachedAuth = { token, expiresAt }
  return token
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' })

  const admin = getSupabaseAdmin()
  if (!admin) return json(res, 501, { error: 'proxy_disabled', hint: 'Configure SUPABASE_SERVICE_ROLE_KEY no ambiente do deploy.' })

  const auth = await getAuthedUser(admin, req)
  if (!auth.user) return json(res, 401, { error: auth.error || 'unauthorized' })

  if (!MYG_BASE_URL || !MYG_API_KEY || (!MYG_AUTHORIZATION && (!MYG_CLIENT_ID || !MYG_CLIENT_SECRET))) {
    return json(res, 501, { error: 'mygateway_not_configured' })
  }

  try {
    const u = new URL(req.url, 'http://localhost')
    const simId = String(u.searchParams.get('simId') || '').trim()
    const linkId = String(u.searchParams.get('linkId') || '').trim()
    if (!simId || !isUuid(simId)) return json(res, 400, { error: 'invalid_simId' })
    if (!linkId) return json(res, 400, { error: 'missing_linkId' })

    const { data: simulado, error: simErr } = await admin
      .from('simulados')
      .select('id,is_paid,price')
      .eq('id', simId)
      .maybeSingle()
    if (simErr) return json(res, 500, { error: simErr.message || String(simErr) })
    if (!simulado) return json(res, 404, { error: 'not_found' })

    const isPaid = Boolean(simulado?.is_paid) || Math.max(0, Number(simulado?.price || 0)) > 0
    const priceNumber = Number(simulado?.price || 0) || 0
    if (!isPaid || !(priceNumber > 0)) return json(res, 400, { error: 'simulado_not_paid' })

    const token = MYG_AUTHORIZATION ? null : await getMygAuthToken()
    if (!MYG_AUTHORIZATION && !token) return json(res, 502, { error: 'auth_failed' })

    const url = `${MYG_BASE_URL}/payments/v1/paymentlink/charges/${encodeURIComponent(linkId)}`
    const headers = {
      'x-api-key': MYG_API_KEY,
      'Accept': 'application/json',
      'Authorization': MYG_AUTHORIZATION || String(token || ''),
    }
    const r = await fetch(url, { method: 'GET', headers })
    const ct = r.headers.get('Content-Type') || ''
    const payload = ct.includes('application/json') ? await r.json().catch(() => ({})) : await r.text().catch(() => '')
    if (!r.ok) return json(res, 502, { error: 'verify_failed', status: r.status, payload })

    const charges = Array.isArray(payload) ? payload : (payload?.charges || [])
    const paid = charges.some((c) => {
      const s = String(c?.status || '').toLowerCase()
      return s === 'paid' || s === 'succeeded' || s === 'captured' || c?.paid === true
    })
    return json(res, 200, { paid: !!paid, simId, linkId })
  } catch (e) {
    return json(res, 500, { error: 'internal_error', message: e?.message || String(e) })
  }
}

