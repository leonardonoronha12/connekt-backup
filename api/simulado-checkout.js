import { getSupabaseAdmin, getAuthedUser, readRawBody, json, isUuid } from '../src/server/supabaseAdmin.js'

const GATEWAY_URL = process.env.VITE_PLANS_GATEWAY_URL || process.env.PLANS_GATEWAY_URL || ''
const GATEWAY_API_KEY = process.env.VITE_PLANS_GATEWAY_API_KEY || process.env.PLANS_GATEWAY_API_KEY || ''
const GATEWAY_AUTH = process.env.VITE_PLANS_GATEWAY_AUTH || process.env.PLANS_GATEWAY_AUTH || ''
const GATEWAY_AUTHDATA = process.env.VITE_PLANS_GATEWAY_AUTHDATA || process.env.PLANS_GATEWAY_AUTHDATA || ''

const APP_BASE_URL = process.env.APP_BASE_URL || process.env.VITE_APP_BASE_URL || ''

let cachedAuth = null

function formatValidUntil(dt) {
  const pad = (n) => String(n).padStart(2, '0')
  const yyyy = dt.getFullYear()
  const mm = pad(dt.getMonth() + 1)
  const dd = pad(dt.getDate())
  const hh = pad(dt.getHours())
  const mi = pad(dt.getMinutes())
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
}

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
  if (!admin) return json(res, 501, { error: 'proxy_disabled', message: 'Backend não configurado.', hint: 'Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY na Vercel.' })

  const auth = await getAuthedUser(admin, req)
  if (!auth.user) return json(res, 401, { error: auth.error || 'unauthorized', message: 'Sessão inválida ou expirada. Faça login novamente.' })

  if (!GATEWAY_URL) return json(res, 501, { error: 'gateway_not_configured', message: 'Checkout indisponível: gateway não configurado (VITE_PLANS_GATEWAY_URL).' })
  if (!GATEWAY_API_KEY) return json(res, 501, { error: 'gateway_not_configured', message: 'Checkout indisponível: gateway não configurado (VITE_PLANS_GATEWAY_API_KEY).' })

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
    if (!isPaid || !(priceNumber > 0)) return json(res, 400, { error: 'simulado_not_paid', message: 'Este simulado não está configurado como pago (preço precisa ser > 0).' })

    const amountCents = Math.round(priceNumber * 100)
    if (!amountCents || amountCents <= 0) return json(res, 400, { error: 'invalid_amount', message: 'Valor inválido do simulado.' })

    const requestUrl = `${String(GATEWAY_URL).replace(/\/$/, '')}/payments/v1/paymentlink`
    const validityHours = Number(process.env.VITE_PAYMENT_LINK_VALIDITY_HOURS || 48)
    const validUntilHuman = formatValidUntil(new Date(Date.now() + validityHours * 3600 * 1000))

    const token = await getGatewayAuthToken()
    const basicFromEnv = (GATEWAY_AUTH && GATEWAY_AUTH.startsWith('Basic ')) ? GATEWAY_AUTH : (GATEWAY_AUTHDATA ? `Basic ${GATEWAY_AUTHDATA}` : null)
    const envAuthFallback = (!token && !basicFromEnv && GATEWAY_AUTH) ? GATEWAY_AUTH : null
    const authModes = []
    if (token) authModes.push({ mode: 'auth_token', value: String(token) })
    if (basicFromEnv) authModes.push({ mode: 'basic', value: basicFromEnv })
    if (envAuthFallback) authModes.push({ mode: envAuthFallback.startsWith('Bearer ') ? 'env_bearer' : 'env_basic', value: envAuthFallback })

    const acceptedTypesRaw = String(process.env.VITE_ACCEPTED_PAYMENTS_TYPE || 'ALL')
    const acceptedTypesList = acceptedTypesRaw.split(',').map((s) => s.trim()).filter(Boolean)
    const acceptedPaymentsType = (acceptedTypesList.length === 0 || (acceptedTypesList.length === 1 && acceptedTypesList[0].toUpperCase() === 'ALL'))
      ? ['PIX', 'Credit', 'Billet']
      : acceptedTypesList

    const title = String(simulado?.title || 'Simulado').trim() || 'Simulado'
    const externalOrderNumber = `simulado:${simId}:user:${String(auth.user.id)}`
    const requestBody = {
      value: String(amountCents),
      title: `Simulado: ${title}`,
      description: `Compra do simulado ${title}`,
      validity: validUntilHuman,
      minimumNumberOfInstallments: Number(process.env.VITE_MIN_INSTALLMENTS || 1),
      maximumQuantityOfInstallments: Number(process.env.VITE_MAX_INSTALLMENTS || 12),
      numberOfAllowedSales: Number(process.env.VITE_MAX_SALES || 1),
      showFormAddress: (process.env.VITE_SHOW_FORM_ADDRESS === 'true') ? 1 : 0,
      customerInterest: (process.env.VITE_CUSTOMER_INTEREST === 'true') ? 1 : 0,
      acceptedPaymentsType,
      external_order_number: externalOrderNumber,
    }

    let r = null
    let payload = null
    for (let i = 0; i < Math.max(1, authModes.length); i++) {
      const selected = authModes[i] || { value: undefined }
      const headers = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-api-key': GATEWAY_API_KEY,
        ...(selected.value ? { Authorization: selected.value } : {}),
      }
      r = await fetch(requestUrl, { method: 'POST', headers, body: JSON.stringify(requestBody) })
      payload = await r.json().catch(() => ({}))
      if (r.ok) break
    }

    if (!r || !r.ok) {
      return json(res, 502, {
        error: 'create_paymentlink_failed',
        message: 'Falha ao criar o checkout no gateway.',
        status: r?.status || 0,
        payload,
      })
    }

    const linkId = payload?.paymentLinkId || payload?.linkId || payload?.id || null
    const checkoutUrl = String(payload?.link || payload?.url || payload?.checkout_url || payload?.payment_url || '').trim()
    if (!checkoutUrl || !linkId) {
      return json(res, 502, { error: 'checkout_url_missing', message: 'O gateway não retornou link de checkout.', payload })
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
    const returnUrl = allowReturnUrl
      ? `${String(APP_BASE_URL).replace(/\/$/, '')}/aluno/simulados/acesso?simId=${encodeURIComponent(simId)}&linkId=${encodeURIComponent(String(linkId))}`
      : null
    const finalCheckoutUrl = returnUrl ? appendQueryParam(checkoutUrl, 'return_url', returnUrl) : checkoutUrl

    return json(res, 200, { checkout_url: finalCheckoutUrl, link_id: String(linkId), simId })
  } catch (e) {
    return json(res, 500, { error: 'internal_error', message: e?.message || String(e) })
  }
}

