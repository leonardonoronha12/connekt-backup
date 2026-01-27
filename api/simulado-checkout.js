import { getSupabaseAdmin, getAuthedUser, readRawBody, json, isUuid } from '../src/server/supabaseAdmin.js'

const MYG_BASE_URL = process.env.MYG_BASE_URL || 'https://api.whitelabel.mygateway.com.br/connekt'
const MYG_API_KEY = process.env.MYG_API_KEY || ''
const MYG_CLIENT_ID = process.env.MYG_CLIENT_ID || ''
const MYG_CLIENT_SECRET = process.env.MYG_CLIENT_SECRET || ''
const MYG_AUTHORIZATION = process.env.MYG_AUTHORIZATION || ''
const APP_BASE_URL = process.env.APP_BASE_URL || process.env.VITE_APP_BASE_URL || ''

let cachedAuth = null

function formatValidity(dt) {
  const pad = (n) => String(n).padStart(2, '0')
  const yyyy = dt.getFullYear()
  const mm = pad(dt.getMonth() + 1)
  const dd = pad(dt.getDate())
  const hh = pad(dt.getHours())
  const mi = pad(dt.getMinutes())
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
}

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

function appendQueryParam(rawUrl, key, value) {
  try {
    const u = new URL(String(rawUrl))
    if (!u.searchParams.has(key)) u.searchParams.set(key, String(value))
    return u.toString()
  } catch (_) {
    return String(rawUrl)
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' })

  const admin = getSupabaseAdmin()
  if (!admin) {
    return json(res, 501, {
      error: 'proxy_disabled',
      message: 'Backend não configurado para validar sessão.',
      hint: 'Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente do deploy (Vercel).',
    })
  }

  const auth = await getAuthedUser(admin, req)
  if (!auth.user) {
    return json(res, 401, {
      error: auth.error || 'unauthorized',
      message: 'Sessão inválida ou expirada. Faça login novamente.',
    })
  }

  if (!MYG_BASE_URL || !MYG_API_KEY || (!MYG_AUTHORIZATION && (!MYG_CLIENT_ID || !MYG_CLIENT_SECRET))) {
    return json(res, 501, {
      error: 'mygateway_not_configured',
      message: 'Checkout indisponível: MyGateway não configurado.',
      hint: 'Configure MYG_BASE_URL, MYG_API_KEY e (MYG_AUTHORIZATION ou MYG_CLIENT_ID/MYG_CLIENT_SECRET) na Vercel.',
    })
  }

  try {
    const body = await readRawBody(req)
    const parsed = JSON.parse(body.toString('utf-8') || '{}')
    const simId = String(parsed?.simId || parsed?.id || '').trim()
    if (!simId || !isUuid(simId)) return json(res, 400, { error: 'invalid_simId' })

    const { data: simulado, error: simErr } = await admin
      .from('simulados')
      .select('id,title,is_paid,price')
      .eq('id', simId)
      .maybeSingle()
    if (simErr) return json(res, 500, { error: 'supabase_query_failed', message: simErr.message || String(simErr) })
    if (!simulado) return json(res, 404, { error: 'not_found' })

    const isPaid = Boolean(simulado?.is_paid) || Math.max(0, Number(simulado?.price || 0)) > 0
    const priceNumber = Number(simulado?.price || 0) || 0
    if (!isPaid || !(priceNumber > 0)) {
      return json(res, 400, {
        error: 'simulado_not_paid',
        message: 'Este simulado não está configurado como pago (preço precisa ser > 0).',
      })
    }

    const amountCents = Math.round(priceNumber * 100)
    if (!amountCents || amountCents <= 0) return json(res, 400, { error: 'invalid_amount', message: 'Valor inválido do simulado.' })

    const token = MYG_AUTHORIZATION ? null : await getMygAuthToken()
    if (!MYG_AUTHORIZATION && !token) {
      return json(res, 502, {
        error: 'auth_failed',
        message: 'Falha ao autenticar no MyGateway.',
        hint: 'Verifique MYG_API_KEY + MYG_CLIENT_ID/MYG_CLIENT_SECRET (ou MYG_AUTHORIZATION).',
      })
    }

    const validity = formatValidity(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
    const title = String(simulado?.title || 'Simulado').trim() || 'Simulado'
    const externalOrderNumber = `simulado:${simId}:user:${String(auth.user.id)}`
    const url = `${MYG_BASE_URL}/payments/v1/paymentlink`
    const headers = {
      'x-api-key': MYG_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': MYG_AUTHORIZATION || String(token || ''),
    }
    const requestBody = {
      value: String(amountCents),
      title: `Simulado: ${title}`,
      description: `Compra do simulado ${title}`,
      validity,
      minimumNumberOfInstallments: 1,
      maximumQuantityOfInstallments: 12,
      numberOfAllowedSales: 1,
      showFormAddress: 0,
      customerInterest: 0,
      acceptedPaymentsType: ['PIX', 'Credit', 'Billet'],
      external_order_number: externalOrderNumber,
    }

    const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(requestBody) })
    const ct = r.headers.get('Content-Type') || ''
    const payload = ct.includes('application/json') ? await r.json().catch(() => ({})) : await r.text().catch(() => '')
    if (!r.ok) {
      return json(res, 502, {
        error: 'create_paymentlink_failed',
        message: 'Falha ao criar o checkout no MyGateway.',
        status: r.status,
        payload: typeof payload === 'string' ? payload.slice(0, 800) : payload,
      })
    }

    const linkId = payload?.id || null
    const checkoutUrl = String(payload?.link || '').trim()
    if (!checkoutUrl) {
      return json(res, 502, {
        error: 'checkout_url_missing',
        message: 'O MyGateway não retornou link de checkout.',
        payload: typeof payload === 'string' ? payload.slice(0, 800) : payload,
      })
    }

    const allowReturnUrl = (() => {
      if (!APP_BASE_URL) return false
      try {
        const u = new URL(APP_BASE_URL)
        const host = String(u.hostname || '')
        return u.protocol === 'https:' && host && host !== 'localhost' && host !== '127.0.0.1'
      } catch (_) {
        return false
      }
    })()
    const returnUrl = allowReturnUrl && linkId
      ? `${String(APP_BASE_URL).replace(/\/$/, '')}/aluno/simulados/acesso?simId=${encodeURIComponent(simId)}&linkId=${encodeURIComponent(String(linkId))}`
      : null
    const finalCheckoutUrl = returnUrl ? appendQueryParam(checkoutUrl, 'return_url', returnUrl) : checkoutUrl

    return json(res, 200, { checkout_url: finalCheckoutUrl, link_id: linkId, simId })
  } catch (e) {
    return json(res, 500, { error: 'internal_error', message: e?.message || String(e) })
  }
}
