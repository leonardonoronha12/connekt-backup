import { getSupabaseAdmin, getAuthedUser, readRawBody, json, isUuid } from '../src/server/supabaseAdmin.js'

const RAW_GATEWAY_URL = process.env.VITE_PLANS_GATEWAY_URL || process.env.PLANS_GATEWAY_URL || ''
const RAW_GATEWAY_URL_FALLBACK = process.env.VITE_PLANS_GATEWAY_URL_FALLBACK || process.env.PLANS_GATEWAY_URL_FALLBACK || ''
const GATEWAY_API_KEY = process.env.VITE_PLANS_GATEWAY_API_KEY || process.env.PLANS_GATEWAY_API_KEY || ''
const GATEWAY_AUTH = process.env.VITE_PLANS_GATEWAY_AUTH || process.env.PLANS_GATEWAY_AUTH || ''
const GATEWAY_AUTHDATA = process.env.VITE_PLANS_GATEWAY_AUTHDATA || process.env.PLANS_GATEWAY_AUTHDATA || ''

const APP_BASE_URL = process.env.APP_BASE_URL || process.env.VITE_APP_BASE_URL || ''

const normalizeGatewayBaseUrl = (raw) => {
  const v = String(raw || '').trim()
  if (!v) return ''
  try {
    const u = new URL(v)
    const host = String(u.hostname || '').toLowerCase()
    if (host === 'api.mygateway.com.br') {
      u.hostname = 'api.whitelabel.mygateway.com.br'
    }
    const p = String(u.pathname || '')
    if (host.endsWith('mygateway.com.br') && (p === '/' || p === '')) {
      u.pathname = '/connekt'
    }
    return u.toString().replace(/\/+$/, '')
  } catch (_) {
    return ''
  }
}

const expandGatewayBaseVariants = (raw) => {
  const base = normalizeGatewayBaseUrl(raw)
  if (!base) return []
  return [base]
}

const GATEWAY_BASE_URLS = Array.from(new Set([
  ...expandGatewayBaseVariants(RAW_GATEWAY_URL),
  ...expandGatewayBaseVariants(RAW_GATEWAY_URL_FALLBACK),
  ...expandGatewayBaseVariants(process.env.MYG_BASE_URL || ''),
])).filter(Boolean)

const cachedAuth = new Map()

function resolveAppBaseUrl(req) {
  const candidates = [
    APP_BASE_URL,
    process.env.PUBLIC_APP_URL,
    process.env.SITE_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '',
  ]
  for (const c of candidates) {
    const raw = String(c || '').trim()
    if (!raw) continue
    try {
      const u = new URL(raw)
      const host = String(u.hostname || '')
      if (u.protocol !== 'https:') continue
      if (!host || host === 'localhost' || host === '127.0.0.1') continue
      return u.toString().replace(/\/+$/, '')
    } catch (_) {}
  }
  try {
    const host = String(req?.headers?.['x-forwarded-host'] || req?.headers?.host || '').trim()
    const proto = String(req?.headers?.['x-forwarded-proto'] || 'https').trim().toLowerCase()
    if (!host) return ''
    if (host === 'localhost' || host.startsWith('localhost:') || host === '127.0.0.1' || host.startsWith('127.0.0.1:')) return ''
    const p = proto === 'http' ? 'http' : 'https'
    if (p !== 'https') return ''
    return `https://${host}`.replace(/\/+$/, '')
  } catch (_) {
    return ''
  }
}

function formatValidUntil(dt) {
  const pad = (n) => String(n).padStart(2, '0')
  const yyyy = dt.getFullYear()
  const mm = pad(dt.getMonth() + 1)
  const dd = pad(dt.getDate())
  const hh = pad(dt.getHours())
  const mi = pad(dt.getMinutes())
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
}

async function fetchWithTimeout(url, init, timeoutMs = 35000) {
  const controller = new AbortController()
  const t = setTimeout(() => {
    try { controller.abort() } catch (_) {}
  }, Math.max(1, Number(timeoutMs || 0)))
  try {
    return await fetch(url, { ...(init || {}), signal: controller.signal })
  } finally {
    clearTimeout(t)
  }
}

function getGatewayMeta(requestUrl) {
  try {
    const u = new URL(String(requestUrl || ''))
    return { gateway_host: String(u.host || ''), gateway_origin: String(u.origin || ''), gateway_path: String(u.pathname || '') }
  } catch (_) {
    return { gateway_host: '', gateway_origin: '', gateway_path: '' }
  }
}

function redactGatewayText(input) {
  try {
    let s = String(input || '')
    if (!s) return ''
    s = s.replace(/Authorization\s*[:=]\s*[^)\s,]+/gi, 'Authorization=[redacted]')
    s = s.replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, '$1 [redacted]')
    s = s.replace(/x-api-key\s*[:=]\s*[^)\s,]+/gi, 'x-api-key=[redacted]')
    s = s.replace(/authData\s*[:=]\s*[^)\s,]+/gi, 'authData=[redacted]')
    s = s.replace(/access_token\s*[:=]\s*[^)\s,]+/gi, 'access_token=[redacted]')
    s = s.replace(/refresh_token\s*[:=]\s*[^)\s,]+/gi, 'refresh_token=[redacted]')
    return s.slice(0, 900)
  } catch (_) {
    return ''
  }
}

function gatewayErrorPayload(e, requestUrl) {
  const name = String(e?.name || '').toLowerCase()
  const msg = redactGatewayText(e?.message || e || '')
  const aborted = name.includes('abort')
  const meta = getGatewayMeta(requestUrl)
  const attempted = Array.isArray(GATEWAY_BASE_URLS) ? GATEWAY_BASE_URLS : []
  if (aborted) {
    return {
      status: 504,
      body: {
        error: 'gateway_timeout',
        message: 'Checkout indisponível: o gateway demorou para responder.',
        attempted_bases: attempted,
        ...meta,
      },
    }
  }
  return {
    status: 502,
    body: {
      error: 'gateway_network_error',
      message: 'Checkout indisponível: falha ao conectar no gateway.',
      details: msg ? String(msg).slice(0, 300) : '',
      attempted_bases: attempted,
      ...meta,
    },
  }
}

function normalizeBearerToken(raw) {
  const s = String(raw || '').trim()
  if (!s) return ''
  if (s.toLowerCase().startsWith('bearer ') || s.toLowerCase().startsWith('basic ')) return s
  return `Bearer ${s}`
}

function pickGatewayErrorMessage(payload, fallback = '') {
  try {
    if (!payload) return fallback
    if (typeof payload === 'string') return String(payload).slice(0, 400)
    if (typeof payload !== 'object') return fallback
    const direct = payload.message || payload.error || payload.detail || payload.title || ''
    if (direct) return String(direct).slice(0, 400)
    const errors = payload.errors || payload.erros || payload.validationErrors || null
    if (Array.isArray(errors) && errors.length) return String(errors[0]?.message || errors[0]?.error || errors[0] || '').slice(0, 400)
    return fallback
  } catch (_) {
    return fallback
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, Math.max(0, Number(ms || 0))))
}

async function withHardTimeout(promise, timeoutMs) {
  let t = null
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise((_, reject) => {
        t = setTimeout(() => {
          const e = new Error('hard_timeout')
          e.name = 'AbortError'
          reject(e)
        }, Math.max(1, Number(timeoutMs || 0)))
      }),
    ])
  } finally {
    if (t) clearTimeout(t)
  }
}

function shouldRetryGatewayStatus(status) {
  const s = Number(status || 0)
  if (!Number.isFinite(s) || s <= 0) return false
  if ([401, 403].includes(s)) return false
  if (s >= 520 && s <= 529) return true
  return [408, 425, 429, 500, 502, 503, 504].includes(s)
}

function gatewayFailureMessage(status) {
  const s = Number(status || 0)
  if (s === 401 || s === 403) return 'Checkout indisponível: autenticação no gateway falhou.'
  if (s >= 520 && s <= 529) return `Checkout indisponível: o gateway está fora do ar (Cloudflare ${s}).`
  if (s === 504) return 'Checkout indisponível: o gateway demorou para responder.'
  return 'Falha ao criar o checkout no gateway.'
}

async function readJsonOrText(res) {
  const text = await res.text().catch(() => '')
  const trimmed = String(text || '').trim()
  if (!trimmed) return { payload: {}, text: '' }
  try {
    return { payload: JSON.parse(trimmed), text: trimmed }
  } catch (_) {
    return { payload: {}, text: trimmed.slice(0, 800) }
  }
}

async function createPaymentLink({ requestUrl, requestBody, authHeaders }) {
  let r = null
  let payload = null
  let lastText = ''
  let lastStatus = 0

  const headersBase = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'x-api-key': GATEWAY_API_KEY,
  }

  try {
    for (const authHeader of (authHeaders.length ? authHeaders : [''])) {
      const headers = {
        ...headersBase,
        ...(authHeader ? { Authorization: String(authHeader) } : {}),
      }
      r = await fetchWithTimeout(requestUrl, { method: 'POST', headers, body: JSON.stringify(requestBody) }, 9000)
      lastStatus = r?.status || 0
      const parsed = await readJsonOrText(r)
      payload = parsed.payload || {}
      lastText = parsed.text || ''
      if (r.ok) return { ok: true, r, payload, lastText, lastStatus }
      if ([401, 403].includes(Number(lastStatus || 0))) break
    }
    return { ok: false, r, payload, lastText, lastStatus }
  } catch (e) {
    return { ok: false, exception: e, r, payload, lastText, lastStatus }
  }
}

async function getGatewayAuthTokenForBase(gatewayBaseUrl) {
  const base = String(gatewayBaseUrl || '').trim()
  if (!base) return null
  try {
    const prev = cachedAuth.get(base) || null
    if (prev && prev.ts > Date.now() - 55 * 60_000) return prev.token
  } catch (_) {}

  if (!GATEWAY_API_KEY || !GATEWAY_AUTHDATA) return null
  try {
    const url = `${String(base).replace(/\/$/, '')}/authentication/v2/auth`
    const headers = { 'x-api-key': GATEWAY_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' }
    const body = { authData: GATEWAY_AUTHDATA }
    const res = await fetchWithTimeout(url, { method: 'POST', headers, body: JSON.stringify(body) }, 5000)
    if (!res.ok) return null
    const data = await res.json().catch(() => ({}))
    const token = data?.auth_token || data?.token || data?.access_token || null
    if (token) cachedAuth.set(base, { token, ts: Date.now() })
    return token
  } catch (_) {
    return null
  }
}

async function createPaymentLinkAcrossGateways({ requestBody }) {
  let last = null
  for (const baseUrl of GATEWAY_BASE_URLS) {
    const requestUrl = `${String(baseUrl).replace(/\/$/, '')}/payments/v1/paymentlink`
    const basicFromEnv = (GATEWAY_AUTH && GATEWAY_AUTH.startsWith('Basic ')) ? GATEWAY_AUTH : (GATEWAY_AUTHDATA ? `Basic ${GATEWAY_AUTHDATA}` : null)
    const shouldFetchToken = !GATEWAY_AUTH && !!GATEWAY_AUTHDATA
    const token = shouldFetchToken ? await getGatewayAuthTokenForBase(baseUrl) : null
    const envAuthFallback = (!token && !basicFromEnv && GATEWAY_AUTH) ? GATEWAY_AUTH : null
    const authHeaders = []
    if (token) authHeaders.push(normalizeBearerToken(token))
    if (basicFromEnv) authHeaders.push(String(basicFromEnv))
    if (envAuthFallback) authHeaders.push(String(envAuthFallback))

    const out = await createPaymentLink({ requestUrl, requestBody, authHeaders })
    const metaUrl = requestUrl
    const normalized = { ...(out || {}), requestUrl: metaUrl }
    if (normalized?.ok) return normalized
    if (normalized?.exception) {
      last = normalized
      continue
    }
    last = normalized
  }
  return last || { ok: false, lastStatus: 0, payload: null, lastText: '', requestUrl: '' }
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

function parseJsonMaybe(value) {
  if (!value) return null
  if (typeof value === 'object') return value
  if (typeof value !== 'string') return null
  try { return JSON.parse(value) } catch (_) { return null }
}

function parsePriceNumber(value) {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    let s = String(value || '').trim()
    if (!s) return NaN
    s = s.replace(/\s+/g, '')
    s = s.replace(/^R\$\s*/i, '')
    s = s.replace(/[^\d,.-]/g, '')
    if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.')
    else if (s.includes(',') && !s.includes('.')) s = s.replace(',', '.')
    return parseFloat(s)
  }
  return Number(value)
}

function getCourseMeta(row) {
  const fromData = parseJsonMaybe(row?.data) || null
  const parsedModules = parseJsonMaybe(row?.modules) || null
  const fromModulesMeta = parsedModules && typeof parsedModules === 'object' ? (parsedModules.meta || null) : null
  return { ...(fromModulesMeta || {}), ...(fromData || {}) }
}

function resolveCoursePriceNumber(courseRow) {
  const meta = getCourseMeta(courseRow)
  const candidates = [
    courseRow?.price,
    courseRow?.course_price,
    meta?.price,
    meta?.preco,
    meta?.coursePrice,
    meta?.course_price,
    meta?.productPrice,
    meta?.product_price,
    meta?.checkoutPrice,
    meta?.checkout_price,
  ]
  for (const c of candidates) {
    const n = parsePriceNumber(c)
    if (Number.isFinite(n) && n > 0) return n
  }
  const centsCandidates = [
    courseRow?.price_cents,
    courseRow?.priceCents,
    courseRow?.course_price_cents,
    courseRow?.coursePriceCents,
    meta?.price_cents,
    meta?.priceCents,
    meta?.course_price_cents,
    meta?.coursePriceCents,
  ]
  for (const c of centsCandidates) {
    const n = Number(c)
    if (Number.isFinite(n) && n > 0) return n / 100
  }
  return 0
}

function getCourseModules(row) {
  const parsed = parseJsonMaybe(row?.modules)
  if (Array.isArray(parsed)) return parsed
  if (parsed && typeof parsed === 'object') {
    if (Array.isArray(parsed.modules)) return parsed.modules
    if (Array.isArray(parsed.items)) return parsed.items
  }
  return Array.isArray(row?.modules) ? row.modules : []
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' })

  const admin = getSupabaseAdmin()
  if (!admin) return json(res, 501, { error: 'proxy_disabled', message: 'Backend não configurado.', hint: 'Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY na Vercel.' })

  const auth = await getAuthedUser(admin, req)
  if (!auth.user) return json(res, 401, { error: auth.error || 'unauthorized', message: 'Sessão inválida ou expirada. Faça login novamente.' })

  if (!GATEWAY_BASE_URLS.length) return json(res, 501, { error: 'gateway_not_configured', message: 'Checkout indisponível: gateway não configurado (VITE_PLANS_GATEWAY_URL).' })
  if (!GATEWAY_API_KEY) return json(res, 501, { error: 'gateway_not_configured', message: 'Checkout indisponível: gateway não configurado (VITE_PLANS_GATEWAY_API_KEY).' })

  try {
    const body = await readRawBody(req)
    const parsed = JSON.parse(body.toString('utf-8') || '{}')
    const rawType = String(parsed?.type || parsed?.itemType || parsed?.kind || '').trim().toLowerCase()
    const courseId = String(parsed?.courseId || parsed?.course_id || '').trim()
    const moduleId = String(parsed?.moduleId || parsed?.module_id || '').trim()
    const lessonId = String(parsed?.lessonId || parsed?.lesson_id || '').trim()
    const simId = String(parsed?.simId || parsed?.id || '').trim()
    const type = rawType || (lessonId ? 'lesson' : (moduleId ? 'module' : (courseId ? 'course' : 'simulado')))
    if (type !== 'course' && type !== 'simulado' && type !== 'module' && type !== 'lesson') return json(res, 400, { error: 'invalid_type' })

    if (type === 'course') {
      if (!courseId || !isUuid(courseId)) return json(res, 400, { error: 'invalid_courseId' })

      const { data: course, error: courseErr } = await admin
        .from('courses')
        .select('id,title,description,modules,data')
        .eq('id', courseId)
        .maybeSingle()
      if (courseErr) return json(res, 500, { error: 'supabase_query_failed', message: courseErr.message || String(courseErr) })
      if (!course) return json(res, 404, { error: 'not_found' })

      const priceNumber = resolveCoursePriceNumber(course)
      if (!(priceNumber > 0)) return json(res, 400, { error: 'course_not_paid', message: 'Este curso não está configurado como pago (preço precisa ser > 0).' })

      const amountCents = Math.round(priceNumber * 100)
      if (!amountCents || amountCents <= 0) return json(res, 400, { error: 'invalid_amount', message: 'Valor inválido do curso.' })

      const validityHours = Number(process.env.VITE_PAYMENT_LINK_VALIDITY_HOURS || 48)
      const validUntilHuman = formatValidUntil(new Date(Date.now() + validityHours * 3600 * 1000))

      const acceptedTypesRaw = String(process.env.VITE_ACCEPTED_PAYMENTS_TYPE || 'ALL')
      const acceptedTypesList = acceptedTypesRaw.split(',').map((s) => s.trim()).filter(Boolean)
      const acceptedPaymentsType = (acceptedTypesList.length === 0 || (acceptedTypesList.length === 1 && acceptedTypesList[0].toUpperCase() === 'ALL'))
        ? ['PIX', 'Credit', 'Billet']
        : acceptedTypesList

      const title = String(course?.title || 'Curso').trim() || 'Curso'
      const desc = String(course?.description || '').trim() || `Compra do curso ${title}`
      const externalOrderNumber = `course:${courseId}:user:${String(auth.user.id)}`
      const requestBody = {
        value: String(amountCents),
        title: `Curso: ${title}`,
        description: desc,
        validity: validUntilHuman,
        minimumNumberOfInstallments: Number(process.env.VITE_MIN_INSTALLMENTS || 1),
        maximumQuantityOfInstallments: Number(process.env.VITE_MAX_INSTALLMENTS || 12),
        numberOfAllowedSales: Number(process.env.VITE_MAX_SALES || 1),
        showFormAddress: (process.env.VITE_SHOW_FORM_ADDRESS === 'true') ? 1 : 0,
        customerInterest: (process.env.VITE_CUSTOMER_INTEREST === 'true') ? 1 : 0,
        acceptedPaymentsType,
        external_order_number: externalOrderNumber,
      }

      const out = await withHardTimeout(createPaymentLinkAcrossGateways({ requestBody }), 25_000).catch((e) => ({
        ok: false,
        exception: e,
        requestUrl: (GATEWAY_BASE_URLS[0] ? `${String(GATEWAY_BASE_URLS[0]).replace(/\/$/, '')}/payments/v1/paymentlink` : ''),
      }))
      const requestUrl = String(out?.requestUrl || '').trim()
      if (out?.exception) {
        const err = gatewayErrorPayload(out.exception, requestUrl)
        return json(res, err.status, err.body)
      }
      if (!out?.ok) {
        const meta = getGatewayMeta(requestUrl)
        return json(res, 502, {
          error: 'create_paymentlink_failed',
          message: gatewayFailureMessage(out?.lastStatus || 0),
          status: out?.lastStatus || 0,
          gateway_message: redactGatewayText(pickGatewayErrorMessage(out?.payload, out?.lastText || '')),
          gateway_response: out?.lastText ? redactGatewayText(String(out.lastText).slice(0, 800)) : '',
          ...meta,
        })
      }

      const linkId = out?.payload?.paymentLinkId || out?.payload?.linkId || out?.payload?.id || null
      const checkoutUrl = String(out?.payload?.link || out?.payload?.url || out?.payload?.checkout_url || out?.payload?.payment_url || '').trim()
      if (!checkoutUrl || !linkId) {
        return json(res, 502, { error: 'checkout_url_missing', message: 'O gateway não retornou link de checkout.', payload: out?.payload || {} })
      }

      const baseUrl = resolveAppBaseUrl(req)
      const returnUrl = baseUrl
        ? `${baseUrl}/aluno/curso/${encodeURIComponent(courseId)}?linkId=${encodeURIComponent(String(linkId))}`
        : null
      const finalCheckoutUrl = returnUrl ? appendQueryParam(checkoutUrl, 'return_url', returnUrl) : checkoutUrl

      return json(res, 200, { checkout_url: finalCheckoutUrl, link_id: String(linkId), courseId, type: 'course' })
    }

    if (type === 'module') {
      if (!courseId || !isUuid(courseId)) return json(res, 400, { error: 'invalid_courseId' })
      if (!moduleId) return json(res, 400, { error: 'invalid_moduleId' })

      const { data: course, error: courseErr } = await admin
        .from('courses')
        .select('id,title,description,modules,data')
        .eq('id', courseId)
        .maybeSingle()
      if (courseErr) return json(res, 500, { error: 'supabase_query_failed', message: courseErr.message || String(courseErr) })
      if (!course) return json(res, 404, { error: 'not_found' })

      const modules = getCourseModules(course)
      const moduleRow = (Array.isArray(modules) ? modules : []).find((m) => String(m?.id || m?.module_id || m?.moduleId || '').trim() === moduleId) || null
      if (!moduleRow) return json(res, 404, { error: 'module_not_found', message: 'Módulo não encontrado neste curso.' })

      const vis = String(moduleRow?.visibility || '').trim()
      const paid = vis === 'Paga' || vis === 'Gratuita para alunos do curso' || (Number(moduleRow?.priceCents) > 0)
      const amountCents = Math.round(Number(moduleRow?.priceCents || 0))
      if (!paid || !(amountCents > 0)) return json(res, 400, { error: 'module_not_paid', message: 'Este módulo não está configurado como pago (defina visibilidade Paga ou Gratuita para alunos do curso e valor).' })

      const validityHours = Number(process.env.VITE_PAYMENT_LINK_VALIDITY_HOURS || 48)
      const validUntilHuman = formatValidUntil(new Date(Date.now() + validityHours * 3600 * 1000))

      const acceptedTypesRaw = String(process.env.VITE_ACCEPTED_PAYMENTS_TYPE || 'ALL')
      const acceptedTypesList = acceptedTypesRaw.split(',').map((s) => s.trim()).filter(Boolean)
      const acceptedPaymentsType = (acceptedTypesList.length === 0 || (acceptedTypesList.length === 1 && acceptedTypesList[0].toUpperCase() === 'ALL'))
        ? ['PIX', 'Credit', 'Billet']
        : acceptedTypesList

      const courseTitle = String(course?.title || 'Curso').trim() || 'Curso'
      const moduleTitle = String(moduleRow?.name || moduleRow?.title || moduleRow?.module_title || 'Módulo').trim() || 'Módulo'
      const desc = `Compra do módulo ${moduleTitle} (${courseTitle})`
      const externalOrderNumber = `module:${courseId}:${moduleId}:user:${String(auth.user.id)}`
      const requestBody = {
        value: String(amountCents),
        title: `Módulo: ${moduleTitle}`,
        description: desc,
        validity: validUntilHuman,
        minimumNumberOfInstallments: Number(process.env.VITE_MIN_INSTALLMENTS || 1),
        maximumQuantityOfInstallments: Number(process.env.VITE_MAX_INSTALLMENTS || 12),
        numberOfAllowedSales: Number(process.env.VITE_MAX_SALES || 1),
        showFormAddress: (process.env.VITE_SHOW_FORM_ADDRESS === 'true') ? 1 : 0,
        customerInterest: (process.env.VITE_CUSTOMER_INTEREST === 'true') ? 1 : 0,
        acceptedPaymentsType,
        external_order_number: externalOrderNumber,
      }

      const out = await withHardTimeout(createPaymentLinkAcrossGateways({ requestBody }), 25_000).catch((e) => ({
        ok: false,
        exception: e,
        requestUrl: (GATEWAY_BASE_URLS[0] ? `${String(GATEWAY_BASE_URLS[0]).replace(/\/$/, '')}/payments/v1/paymentlink` : ''),
      }))
      const requestUrl = String(out?.requestUrl || '').trim()
      if (out?.exception) {
        const err = gatewayErrorPayload(out.exception, requestUrl)
        return json(res, err.status, err.body)
      }
      if (!out?.ok) {
        const meta = getGatewayMeta(requestUrl)
        return json(res, 502, {
          error: 'create_paymentlink_failed',
          message: gatewayFailureMessage(out?.lastStatus || 0),
          status: out?.lastStatus || 0,
          gateway_message: redactGatewayText(pickGatewayErrorMessage(out?.payload, out?.lastText || '')),
          gateway_response: out?.lastText ? redactGatewayText(String(out.lastText).slice(0, 800)) : '',
          ...meta,
        })
      }

      const linkId = out?.payload?.paymentLinkId || out?.payload?.linkId || out?.payload?.id || null
      const checkoutUrl = String(out?.payload?.link || out?.payload?.url || out?.payload?.checkout_url || out?.payload?.payment_url || '').trim()
      if (!checkoutUrl || !linkId) {
        return json(res, 502, { error: 'checkout_url_missing', message: 'O gateway não retornou link de checkout.', payload: out?.payload || {} })
      }

      const baseUrl = resolveAppBaseUrl(req)
      const returnUrl = baseUrl
        ? `${baseUrl}/aluno/curso/${encodeURIComponent(courseId)}?moduleId=${encodeURIComponent(moduleId)}&linkId=${encodeURIComponent(String(linkId))}`
        : null
      const finalCheckoutUrl = returnUrl ? appendQueryParam(checkoutUrl, 'return_url', returnUrl) : checkoutUrl

      return json(res, 200, { checkout_url: finalCheckoutUrl, link_id: String(linkId), courseId, moduleId, type: 'module' })
    }

    if (type === 'lesson') {
      if (!courseId || !isUuid(courseId)) return json(res, 400, { error: 'invalid_courseId' })
      if (!moduleId) return json(res, 400, { error: 'invalid_moduleId' })
      if (!lessonId) return json(res, 400, { error: 'invalid_lessonId' })

      const { data: course, error: courseErr } = await admin
        .from('courses')
        .select('id,title,description,modules,data')
        .eq('id', courseId)
        .maybeSingle()
      if (courseErr) return json(res, 500, { error: 'supabase_query_failed', message: courseErr.message || String(courseErr) })
      if (!course) return json(res, 404, { error: 'not_found' })

      const modules = getCourseModules(course)
      const moduleRow = (Array.isArray(modules) ? modules : []).find((m) => String(m?.id || m?.module_id || m?.moduleId || '').trim() === moduleId) || null
      if (!moduleRow) return json(res, 404, { error: 'module_not_found', message: 'Módulo não encontrado neste curso.' })

      const lessons = Array.isArray(moduleRow?.lessons) ? moduleRow.lessons : (Array.isArray(moduleRow?.aulas) ? moduleRow.aulas : [])
      const lessonRow = (Array.isArray(lessons) ? lessons : []).find((l) => String(l?.id || l?.lesson_id || l?.lessonId || '').trim() === lessonId) || null
      if (!lessonRow) return json(res, 404, { error: 'lesson_not_found', message: 'Aula não encontrada neste módulo.' })

      const vis = String(lessonRow?.visibility || '').trim()
      const paid = vis === 'Paga' || vis === 'Gratuita para alunos do curso' || (Number(lessonRow?.priceCents) > 0)
      const amountCents = Math.round(Number(lessonRow?.priceCents || 0))
      if (!paid || !(amountCents > 0)) return json(res, 400, { error: 'lesson_not_paid', message: 'Esta aula não está configurada como paga (defina visibilidade Paga ou Gratuita para alunos do curso e valor).' })

      const validityHours = Number(process.env.VITE_PAYMENT_LINK_VALIDITY_HOURS || 48)
      const validUntilHuman = formatValidUntil(new Date(Date.now() + validityHours * 3600 * 1000))

      const acceptedTypesRaw = String(process.env.VITE_ACCEPTED_PAYMENTS_TYPE || 'ALL')
      const acceptedTypesList = acceptedTypesRaw.split(',').map((s) => s.trim()).filter(Boolean)
      const acceptedPaymentsType = (acceptedTypesList.length === 0 || (acceptedTypesList.length === 1 && acceptedTypesList[0].toUpperCase() === 'ALL'))
        ? ['PIX', 'Credit', 'Billet']
        : acceptedTypesList

      const courseTitle = String(course?.title || 'Curso').trim() || 'Curso'
      const moduleTitle = String(moduleRow?.name || moduleRow?.title || moduleRow?.module_title || 'Módulo').trim() || 'Módulo'
      const lessonTitle = String(lessonRow?.name || lessonRow?.title || lessonRow?.lesson_title || 'Aula').trim() || 'Aula'
      const desc = `Compra da aula ${lessonTitle} (${moduleTitle} • ${courseTitle})`
      const externalOrderNumber = `lesson:${courseId}:${moduleId}:${lessonId}:user:${String(auth.user.id)}`
      const requestBody = {
        value: String(amountCents),
        title: `Aula: ${lessonTitle}`,
        description: desc,
        validity: validUntilHuman,
        minimumNumberOfInstallments: Number(process.env.VITE_MIN_INSTALLMENTS || 1),
        maximumQuantityOfInstallments: Number(process.env.VITE_MAX_INSTALLMENTS || 12),
        numberOfAllowedSales: Number(process.env.VITE_MAX_SALES || 1),
        showFormAddress: (process.env.VITE_SHOW_FORM_ADDRESS === 'true') ? 1 : 0,
        customerInterest: (process.env.VITE_CUSTOMER_INTEREST === 'true') ? 1 : 0,
        acceptedPaymentsType,
        external_order_number: externalOrderNumber,
      }

      const out = await withHardTimeout(createPaymentLinkAcrossGateways({ requestBody }), 25_000).catch((e) => ({
        ok: false,
        exception: e,
        requestUrl: (GATEWAY_BASE_URLS[0] ? `${String(GATEWAY_BASE_URLS[0]).replace(/\/$/, '')}/payments/v1/paymentlink` : ''),
      }))
      const requestUrl = String(out?.requestUrl || '').trim()
      if (out?.exception) {
        const err = gatewayErrorPayload(out.exception, requestUrl)
        return json(res, err.status, err.body)
      }
      if (!out?.ok) {
        const meta = getGatewayMeta(requestUrl)
        return json(res, 502, {
          error: 'create_paymentlink_failed',
          message: gatewayFailureMessage(out?.lastStatus || 0),
          status: out?.lastStatus || 0,
          gateway_message: redactGatewayText(pickGatewayErrorMessage(out?.payload, out?.lastText || '')),
          gateway_response: out?.lastText ? redactGatewayText(String(out.lastText).slice(0, 800)) : '',
          ...meta,
        })
      }

      const linkId = out?.payload?.paymentLinkId || out?.payload?.linkId || out?.payload?.id || null
      const checkoutUrl = String(out?.payload?.link || out?.payload?.url || out?.payload?.checkout_url || out?.payload?.payment_url || '').trim()
      if (!checkoutUrl || !linkId) {
        return json(res, 502, { error: 'checkout_url_missing', message: 'O gateway não retornou link de checkout.', payload: out?.payload || {} })
      }

      const baseUrl = resolveAppBaseUrl(req)
      const returnUrl = baseUrl
        ? `${baseUrl}/aluno/curso/${encodeURIComponent(courseId)}?moduleId=${encodeURIComponent(moduleId)}&lessonId=${encodeURIComponent(lessonId)}&linkId=${encodeURIComponent(String(linkId))}`
        : null
      const finalCheckoutUrl = returnUrl ? appendQueryParam(checkoutUrl, 'return_url', returnUrl) : checkoutUrl

      return json(res, 200, { checkout_url: finalCheckoutUrl, link_id: String(linkId), courseId, moduleId, lessonId, type: 'lesson' })
    }

    if (!simId || !isUuid(simId)) return json(res, 400, { error: 'invalid_simId' })

    const { data: simulado, error: simErr } = await admin
      .from('simulados')
      .select('id,title,is_paid,price,settings')
      .eq('id', simId)
      .maybeSingle()
    if (simErr) return json(res, 500, { error: 'supabase_query_failed', message: simErr.message || String(simErr) })
    if (!simulado) return json(res, 404, { error: 'not_found' })

    const settings = simulado?.settings && typeof simulado.settings === 'object' ? simulado.settings : {}
    const accessModeRaw = String(settings?.accessMode || settings?.access_mode || '').trim()
    const accessMode = (accessModeRaw === 'paid' || accessModeRaw === 'free' || accessModeRaw === 'course_students_free') ? accessModeRaw : ''
    const priceNumber = Math.max(0, Number(simulado?.price || 0) || 0)
    if (accessMode === 'course_students_free' && !(priceNumber > 0)) {
      return json(res, 403, {
        error: 'simulado_course_students_only',
        message: 'Este simulado está disponível apenas para alunos dos cursos vinculados e não está à venda.',
      })
    }
    const isPaid = Boolean(simulado?.is_paid) || (accessMode === 'paid') || (priceNumber > 0)
    if (!isPaid || !(priceNumber > 0)) return json(res, 400, { error: 'simulado_not_paid', message: 'Este simulado não está configurado para compra (preço precisa ser > 0).' })

    const amountCents = Math.round(priceNumber * 100)
    if (!amountCents || amountCents <= 0) return json(res, 400, { error: 'invalid_amount', message: 'Valor inválido do simulado.' })

    const validityHours = Number(process.env.VITE_PAYMENT_LINK_VALIDITY_HOURS || 48)
    const validUntilHuman = formatValidUntil(new Date(Date.now() + validityHours * 3600 * 1000))

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

    const out = await withHardTimeout(createPaymentLinkAcrossGateways({ requestBody }), 25_000).catch((e) => ({
      ok: false,
      exception: e,
      requestUrl: (GATEWAY_BASE_URLS[0] ? `${String(GATEWAY_BASE_URLS[0]).replace(/\/$/, '')}/payments/v1/paymentlink` : ''),
    }))
    const requestUrl = String(out?.requestUrl || '').trim()
    if (out?.exception) {
      const err = gatewayErrorPayload(out.exception, requestUrl)
      return json(res, err.status, err.body)
    }
    if (!out?.ok) {
      const meta = getGatewayMeta(requestUrl)
      return json(res, 502, {
        error: 'create_paymentlink_failed',
        message: gatewayFailureMessage(out?.lastStatus || 0),
        status: out?.lastStatus || 0,
        gateway_message: redactGatewayText(pickGatewayErrorMessage(out?.payload, out?.lastText || '')),
        gateway_response: out?.lastText ? redactGatewayText(String(out.lastText).slice(0, 800)) : '',
        ...meta,
      })
    }

    const linkId = out?.payload?.paymentLinkId || out?.payload?.linkId || out?.payload?.id || null
    const checkoutUrl = String(out?.payload?.link || out?.payload?.url || out?.payload?.checkout_url || out?.payload?.payment_url || '').trim()
    if (!checkoutUrl || !linkId) {
      return json(res, 502, { error: 'checkout_url_missing', message: 'O gateway não retornou link de checkout.', payload: out?.payload || {} })
    }

    const baseUrl = resolveAppBaseUrl(req)
    const returnUrl = baseUrl
      ? `${baseUrl}/aluno/simulados/acesso?simId=${encodeURIComponent(simId)}&linkId=${encodeURIComponent(String(linkId))}`
      : null
    const finalCheckoutUrl = returnUrl ? appendQueryParam(checkoutUrl, 'return_url', returnUrl) : checkoutUrl

    return json(res, 200, { checkout_url: finalCheckoutUrl, link_id: String(linkId), simId })
  } catch (e) {
    return json(res, 500, { error: 'internal_error', message: e?.message || String(e) })
  }
}

