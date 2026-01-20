import { supabase } from '@/lib/supabaseClient.js'
import { notificationsService } from '@/services/notificationsService.js'

const GATEWAY_URL = import.meta.env.VITE_PLANS_GATEWAY_URL
const GATEWAY_API_KEY = import.meta.env.VITE_PLANS_GATEWAY_API_KEY
const GATEWAY_AUTH = import.meta.env.VITE_PLANS_GATEWAY_AUTH
const GATEWAY_AUTHDATA = import.meta.env.VITE_PLANS_GATEWAY_AUTHDATA
// Controle: evitar chamadas diretas ao gateway em ambiente local sem permissão explícita
const ALLOW_DIRECT_GATEWAY = import.meta.env.VITE_ALLOW_DIRECT_GATEWAY === 'true'
const USE_DEV_PROXY = typeof window !== 'undefined' && window.location.hostname === 'localhost'
const GATEWAY_BASE = USE_DEV_PROXY ? '/plans-gateway' : GATEWAY_URL
const SKIP_SUPABASE_FUNCTIONS = import.meta.env.VITE_SKIP_SUPABASE_FUNCTIONS === 'true'

const storageKey = 'connekt_active_plan'
const subscriptionKey = 'connekt_subscription'
const pendingCheckoutKey = 'connekt_pending_checkout'
const USE_PROFILES_TABLE = import.meta.env.VITE_USE_PROFILES_TABLE === 'true'

function planLabel(planKey) {
  const k = String(planKey || '').toLowerCase()
  if (k === 'qa') return 'Connekt QA Tester'
  if (k === 'teste') return 'Connekt Teste'
  if (k === 'start') return 'Connekt Start'
  if (k === 'pro') return 'Connekt Pro'
  if (k === 'premium') return 'Connekt Premium'
  return planKey || 'Plano'
}

function setActivePlan(planKey) {
  try { localStorage.setItem(storageKey, planKey) } catch (_) {}
}

function getActivePlan() {
  try { return localStorage.getItem(storageKey) || null } catch (_) { return null }
}

function setPaymentLinkId(id) {
  try { localStorage.setItem('connekt_payment_link_id', id) } catch (_) {}
}

function getPaymentLinkId() {
  try { return localStorage.getItem('connekt_payment_link_id') || null } catch (_) { return null }
}

function safeJsonParse(text, fallback) {
  try { return JSON.parse(text) } catch (_) { return fallback }
}

function setPendingCheckout(data) {
  try { localStorage.setItem(pendingCheckoutKey, JSON.stringify(data || {})) } catch (_) {}
}

function getPendingCheckout() {
  try {
    const raw = localStorage.getItem(pendingCheckoutKey)
    return raw ? safeJsonParse(raw, null) : null
  } catch (_) {
    return null
  }
}

function clearPendingCheckout() {
  try { localStorage.removeItem(pendingCheckoutKey) } catch (_) {}
}

function setSubscription(data) {
  try { localStorage.setItem(subscriptionKey, JSON.stringify(data || {})) } catch (_) {}
}

function normalizeSubscription(sub) {
  try {
    if (!sub || typeof sub !== 'object') return sub
    const status = String(sub.status || '').toLowerCase()
    if (status === 'trial') return sub

    const planKey = sub.planKey ? String(sub.planKey) : ''
    if (!planKey) return sub

    const billingCycle = String(sub.billingCycle || 'mensal').toLowerCase() === 'anual' ? 'anual' : 'mensal'
    const activatedAtMs = sub.activatedAt ? new Date(sub.activatedAt).getTime() : NaN
    if (!isFinite(activatedAtMs)) return sub

    const expiresAtValue = sub.expiresAt
    const expiresAtMs = expiresAtValue ? new Date(expiresAtValue).getTime() : NaN
    const expectedMs = computeExpiresAt(new Date(activatedAtMs), billingCycle, planKey).getTime()
    const maxMs = planKey === 'teste'
      ? activatedAtMs + 2 * 24 * 60 * 60 * 1000
      : (billingCycle === 'anual'
        ? activatedAtMs + 400 * 24 * 60 * 60 * 1000
        : activatedAtMs + 40 * 24 * 60 * 60 * 1000)

    const shouldFix = !isFinite(expiresAtMs) || expiresAtMs < activatedAtMs || expiresAtMs > maxMs
    if (!shouldFix && String(sub.billingCycle || '').toLowerCase() === billingCycle) return sub

    return {
      ...sub,
      billingCycle,
      expiresAt: new Date(expectedMs).toISOString(),
    }
  } catch (_) {
    return sub
  }
}

function getSubscription() {
  try {
    const raw = localStorage.getItem(subscriptionKey)
    const parsed = raw ? safeJsonParse(raw, null) : null
    const normalized = normalizeSubscription(parsed)
    if (normalized && parsed && typeof normalized === 'object' && typeof parsed === 'object') {
      const changed = normalized.expiresAt !== parsed.expiresAt || String(normalized.billingCycle || '') !== String(parsed.billingCycle || '')
      if (changed) setSubscription(normalized)
    }
    return normalized
  } catch (_) {
    return null
  }
}

function addMonths(date, months) {
  const d = new Date(date.getTime())
  const day = d.getDate()
  d.setMonth(d.getMonth() + months)
  if (d.getDate() !== day) {
    d.setDate(0)
  }
  return d
}

function addYears(date, years) {
  const d = new Date(date.getTime())
  d.setFullYear(d.getFullYear() + years)
  return d
}

function addDays(date, days) {
  const d = new Date(date.getTime())
  d.setDate(d.getDate() + Number(days || 0))
  return d
}

function computeExpiresAt(activatedAt, billingCycle, planKey) {
  const base = activatedAt instanceof Date ? activatedAt : new Date(activatedAt)
  if (planKey === 'teste') return new Date(base.getTime() + 24 * 60 * 60 * 1000)
  if (billingCycle === 'anual') return addYears(base, 1)
  return addMonths(base, 1)
}

async function persistCheckoutLog(entry, ctx = {}) {
  try {
    const LOG_BUCKET = 'imagens-logs'
    try { await supabase.storage.createBucket(LOG_BUCKET, { public: true }) } catch (_) {}
    const payload = {
      ts: new Date().toISOString(),
      ...entry,
      context: {
        gatewayBase: GATEWAY_BASE,
        useDevProxy: USE_DEV_PROXY,
        useProfilesTable: USE_PROFILES_TABLE,
        ...ctx,
      },
    }
    const rand = Math.random().toString(36).slice(2, 8)
    const step = typeof entry?.step === 'string' ? entry.step.replace(/[^a-z0-9_-]/gi, '_').toLowerCase() : 'unknown'
    const path = `checkout/${Date.now()}_${step}_${rand}.json`
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
    await supabase.storage.from(LOG_BUCKET).upload(path, blob, { upsert: true })
  } catch (_) {
    try {
      const raw = localStorage.getItem('connekt_checkout_logs')
      const arr = raw ? JSON.parse(raw) : []
      arr.unshift({ ts: new Date().toISOString(), ...(entry || {}), ctx })
      while (arr.length > 200) arr.pop()
      localStorage.setItem('connekt_checkout_logs', JSON.stringify(arr))
    } catch (_) {}
  }
}

function toCents(valueStr) {
  // Converte strings tipo '99,00' para centavos (9900)
  if (typeof valueStr !== 'string') return 0
  const normalized = valueStr.replace(/\./g, '').replace(',', '.')
  const num = Number(normalized)
  if (!isFinite(num)) return 0
  return Math.round(num * 100)
}

function getAmountCents(planKey, billingCycle) {
  // Valores conforme UI (PlanosPage): mensal vs anual (anual = preço mensal com desconto x 12)
  if (planKey === 'teste') return 100
  if (planKey === 'qa') return 100
  const prices = {
    start: { mensal: '99,00', anual: '79,00' },
    pro: { mensal: '299,00', anual: '249,00' },
    premium: { mensal: '599,00', anual: '499,00' },
  }
  const p = prices[planKey]
  if (!p) return 0
  const perMonthCents = toCents(billingCycle === 'anual' ? p.anual : p.mensal)
  const multiplier = billingCycle === 'anual' ? 12 : 1
  return perMonthCents * multiplier
}

function planSlugFromKey(planKey) {
  if (planKey === 'start') return 'basic'
  if (planKey === 'pro') return 'pro'
  if (planKey === 'premium') return 'enterprise'
  if (planKey === 'qa') return 'qa'
  return planKey || 'basic'
}

function parseEmailAllowList(raw) {
  const s = String(raw || '').trim()
  if (!s) return []
  return s
    .split(',')
    .map((v) => String(v || '').trim().toLowerCase())
    .filter(Boolean)
}

function isTesterEmail(email) {
  const list = parseEmailAllowList(import.meta.env.VITE_TESTER_EMAILS || import.meta.env.VITE_TEST_PLAN_EMAILS)
  const e = String(email || '').trim().toLowerCase()
  if (!e) return false
  const fallback = ['cezar@teste.com', 'darin@teste.com', 'caio@teste.com']
  if (fallback.includes(e)) return true
  if (list.length === 0) return false
  return list.includes(e)
}

function canUseTestPlanForUser(user) {
  const host = typeof window !== 'undefined' ? window.location.hostname : ''
  const isLocal = host === 'localhost' || host === '127.0.0.1'
  if (isLocal) return true
  return isTesterEmail(user?.email)
}

function activateTestPlan({ user, planKey = 'qa', billingCycle = 'mensal' } = {}) {
  if (!canUseTestPlanForUser(user)) return { ok: false, error: 'not_allowed' }
  const now = new Date()
  const expiresAt = computeExpiresAt(now, billingCycle, planKey)
  const next = {
    planKey,
    billingCycle,
    status: 'active',
    activatedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    autoRenew: false,
  }
  setActivePlan(planKey)
  setSubscription(next)
  return { ok: true, subscription: next }
}

function pad2(n) { return String(n).padStart(2, '0') }
function formatValidUntil(date) {
  try {
    const y = date.getFullYear()
    const m = pad2(date.getMonth() + 1)
    const d = pad2(date.getDate())
    const hh = pad2(date.getHours())
    const mm = pad2(date.getMinutes())
    return `${y}-${m}-${d} ${hh}:${mm}`
  } catch (_) {
    return new Date().toISOString().slice(0, 16).replace('T', ' ')
  }
}

// Obtém token Bearer no gateway de pagamento
let __gatewayAuthCache = { token: null, ts: 0 }
// Captura extra de credenciais retornadas pelo endpoint de auth (ex.: Basic)
let __gatewayAuthExtra = { basic: null }
async function getGatewayAuthToken(onLog) {
  const emit = async (e) => {
    try { typeof onLog === 'function' && onLog(e) } catch (_) {}
    try { await persistCheckoutLog(e, { auth: true }) } catch (_) {}
  }

  // Usa cache simples por 5 minutos para evitar chamadas excessivas
  try {
    const now = Date.now()
    if (__gatewayAuthCache.token && (now - __gatewayAuthCache.ts) < 5 * 60 * 1000) {
      return __gatewayAuthCache.token
    }
  } catch (_) {}

  if (!GATEWAY_URL) return null

  const url = `${GATEWAY_BASE}/authentication/v2/auth`
  const authDataString = (GATEWAY_AUTHDATA && String(GATEWAY_AUTHDATA)) || (GATEWAY_AUTH?.startsWith('Basic ') ? GATEWAY_AUTH.slice(6).trim() : null)
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(GATEWAY_API_KEY ? { 'x-api-key': GATEWAY_API_KEY } : {}),
  }
  const body = { authData: authDataString }

  await emit({ level: 'debug', step: 'auth_request', message: 'Solicitando token ao gateway', data: { url, headers: { ...headers, ...(headers['x-api-key'] ? { 'x-api-key': '***' } : {}) }, body: { authData: authDataString ? '***' : null } } })

  try {
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
    const resHeaders = {}
    try { res.headers && res.headers.forEach && res.headers.forEach((v,k)=>{ resHeaders[k] = v }) } catch (_) {}
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      await emit({ level: 'error', step: 'auth_error', message: 'Falha ao obter token', data: { status: res.status, responseHeaders: resHeaders, bodyText: text } })
      return null
    }
    const data = await res.json().catch(() => ({}))
    const token = data?.auth_token || data?.token || data?.access_token || data?.authToken || null
    // Heurísticas para capturar possíveis credenciais Basic retornadas pelo auth
    const basicCandidate = (
      data?.basic ||
      data?.auth_basic ||
      data?.basic_token ||
      data?.authBasic ||
      (typeof data?.authorization === 'string' && data.authorization.startsWith('Basic ') ? data.authorization : null) ||
      null
    )
    if (basicCandidate && typeof basicCandidate === 'string') {
      __gatewayAuthExtra.basic = basicCandidate.startsWith('Basic ') ? basicCandidate : `Basic ${basicCandidate}`
    }
    await emit({ level: 'info', step: 'auth_response', message: 'Token obtido', data: { status: res.status, ok: true, responseHeaders: resHeaders, body: { ...data, auth_token: token ? '***' : null, basic: __gatewayAuthExtra.basic ? '***' : undefined } } })
    if (token) {
      __gatewayAuthCache = { token, ts: Date.now() }
    }
    return token
  } catch (e) {
    await emit({ level: 'error', step: 'auth_exception', message: e?.message })
    return null
  }
}

export const planService = {
  getActivePlan,
  getSubscription,
  getPendingCheckout,
  clearPendingCheckout,
  activateTestPlan,
  canUseTestPlanForUser,

  // Navegação robusta para ambientes com iframe ou restrições
  _forceNavigate(url) {
    try {
      window.location.assign(url);
      return;
    } catch (_) {}
    try {
      if (window.top && window.top.location && typeof window.top.location.assign === 'function') {
        window.top.location.assign(url);
        return;
      }
    } catch (_) {}
    try {
      const a = document.createElement('a');
      a.href = url;
      a.target = '_self';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    } catch (_) {}
    try {
      window.open(url, '_blank');
    } catch (_) {}
  },

  async startCheckout(planKey, billingCycle, user, options = {}) {
    const onLog = typeof options?.onLog === 'function' ? options.onLog : null
    const redirect = options?.redirect !== false
    const openInNewTab = options?.openInNewTab === true
    const appBaseUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_APP_BASE_URL)
      ? String(import.meta.env.VITE_APP_BASE_URL)
      : (typeof window !== 'undefined' ? window.location.origin : '')
    const allowReturnUrl = (() => {
      try {
        const u = new URL(appBaseUrl)
        const host = String(u.hostname || '')
        return host && host !== 'localhost' && host !== '127.0.0.1'
      } catch (_) {
        return false
      }
    })()
    const appendQueryParam = (rawUrl, key, value) => {
      try {
        const u = new URL(String(rawUrl))
        if (!u.searchParams.has(key)) u.searchParams.set(key, String(value))
        return u.toString()
      } catch (_) {
        return String(rawUrl)
      }
    }
    const tryOpenNewTab = (url) => {
      try {
        const w = window.open(url, '_blank', 'noopener')
        return w || null
      } catch (_) {
        return null
      }
    }
    const emit = async (e) => {
      const ctx = { planKey, billingCycle, userId: user?.id || null }
      const withCtx = { ...e, ctx }
      try { onLog && onLog(withCtx) } catch (_) {}
      try { await persistCheckoutLog(e, ctx) } catch (_) {}
    }
    let resolvedUserId = user?.id || null
    if (!resolvedUserId && supabase?.auth?.getUser) {
      try {
        const { data } = await supabase.auth.getUser()
        resolvedUserId = data?.user?.id || null
      } catch (_) {}
    }
    if (!resolvedUserId) {
      await emit({ level: 'error', step: 'missing_user', message: 'Usuário não autenticado' })
      return { ok: false, error: 'not_authenticated' }
    }
    const successUrl = `${window.location.origin}/planos/callback?status=success&plan=${encodeURIComponent(planKey)}&billing=${encodeURIComponent(billingCycle)}`
    const cancelUrl = `${window.location.origin}/planos?cancel=true`

    // Preferir criação via Edge Function (segurança de segredos), exceto se estiver desabilitada
    if (!SKIP_SUPABASE_FUNCTIONS) {
      try {
        const { data, error } = await supabase.functions.invoke('myg-payments', {
          body: { userId: resolvedUserId, planSlug: planKey, cycle: billingCycle },
        })
        await emit({ level: 'debug', step: 'serverless_request', message: 'Invocando myg-payments/paymentlink', data: { ok: !error, error: error?.message } })
        if (!error && data?.checkout_url) {
          const gatewayPaymentId = data?.gateway_payment_id || null
          const paymentId = data?.payment_id || null
          const linkId = gatewayPaymentId || paymentId || null
          if (linkId) setPaymentLinkId(linkId)
          setPendingCheckout({ planKey, billingCycle, linkId: gatewayPaymentId, paymentId, createdAt: new Date().toISOString(), via: 'serverless' })
          await emit({ level: 'info', step: 'serverless_response', message: 'Checkout URL obtida via função', data: { checkout_url: data.checkout_url, gateway_payment_id: gatewayPaymentId, payment_id: paymentId } })
          let checkoutUrl = String(data.checkout_url)
          if (allowReturnUrl && paymentId) {
            const returnUrl = `${appBaseUrl.replace(/\/$/, '')}/planos?payment_id=${encodeURIComponent(String(paymentId))}`
            checkoutUrl = appendQueryParam(checkoutUrl, 'return_url', returnUrl)
          }
          if (!redirect) return { ok: true, linkId, paymentId, via: 'serverless', checkout_url: checkoutUrl }
          if (openInNewTab) {
            const w = tryOpenNewTab(checkoutUrl)
            if (w) return { ok: true, linkId, paymentId, via: 'serverless', checkout_url: checkoutUrl, opened: true }
          }
          try { await new Promise(r => setTimeout(r, 200)) } catch (_) {}
          this._forceNavigate(checkoutUrl)
          return { ok: true, linkId, paymentId, via: 'serverless', checkout_url: checkoutUrl, opened: false }
        }
        await emit({ level: 'error', step: 'serverless_missing_checkout_url', message: 'Falha ao obter checkout_url via função', data: { error: error?.message || null, data } })
        return { ok: false, error: error?.message || 'serverless_missing_checkout_url', via: 'serverless' }
      } catch (e) {
        await emit({ level: 'warn', step: 'serverless_error', message: e?.message })
        return { ok: false, error: e?.message || 'serverless_error', via: 'serverless' }
      }
    } else {
      await emit({ level: 'warn', step: 'serverless_skipped', message: 'Skip supabase functions por configuração (VITE_SKIP_SUPABASE_FUNCTIONS=true)' })
    }

    // Se não houver gateway configurado, simula ativação para testes
    if (!GATEWAY_URL) {
      setActivePlan(planKey)
      const now = new Date()
      setSubscription({
        planKey,
        billingCycle,
        status: 'active',
        autoRenew: false,
        activatedAt: now.toISOString(),
        expiresAt: computeExpiresAt(now, billingCycle, planKey).toISOString(),
        canceledAt: null,
      })
      clearPendingCheckout()
      console.log('[planService] Simulado: redirecionando para callback', successUrl)
      await emit({ level: 'warn', step: 'gateway_request_skipped', message: 'VITE_PLANS_GATEWAY_URL vazio; pulando chamada', data: { successUrl } })
      await emit({ level: 'info', step: 'simulate_no_gateway', message: 'Sem gateway configurado, simulando contratação', data: { successUrl } })
      try { await new Promise(r => setTimeout(r, 1500)) } catch (_) {}
      this._forceNavigate(successUrl)
      return { ok: true, simulated: true }
    }

    try {
      // Cria Payment Link no gateway real (DEV – AWS API Gateway)
      const requestUrl = `${GATEWAY_BASE}/payments/v1/paymentlink`

      // Em localhost, se não permitido explicitamente, pular chamada direta e usar fallback dev
      const isLocalHost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      if (isLocalHost && !ALLOW_DIRECT_GATEWAY) {
        await emit({ level: 'warn', step: 'skip_direct_gateway', message: 'Ambiente local sem permissão para chamada direta; usando gateway dev' })
        try {
          const devRes = await fetch('http://localhost:8080/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              plan: planKey,
              billing: billingCycle,
              user_id: user?.id || null,
              success_url: successUrl,
              cancel_url: cancelUrl,
            }),
          })
          if (devRes.ok) {
            const devData = await devRes.json().catch(() => ({}))
            const devUrl = devData?.checkout_url
            if (devUrl) {
              await emit({ level: 'info', step: 'dev_gateway_redirect', message: 'Redirecionando via gateway dev', data: { checkout_url: devUrl } })
              try { await new Promise(r => setTimeout(r, 1500)) } catch (_) {}
              this._forceNavigate(devUrl)
              return { ok: true, simulated_dev: true }
            }
          }
        } catch (e) {
          await emit({ level: 'warn', step: 'dev_gateway_error', message: e?.message })
        }
        await emit({ level: 'error', step: 'direct_gateway_disabled', message: 'Chamada direta ao gateway desabilitada em localhost' })
        return { ok: false, error: 'direct_gateway_disabled', fallback: true }
      }

      // Preparar modos de autenticação: bearer (token) e basic (authData)
      const bearerToken = await getGatewayAuthToken(async (log) => { await emit(log) }).catch(() => null)
      const basicFromEnv = (GATEWAY_AUTH && GATEWAY_AUTH.startsWith('Basic ')) ? GATEWAY_AUTH : (GATEWAY_AUTHDATA ? `Basic ${GATEWAY_AUTHDATA}` : null)
      const basicFromAuth = __gatewayAuthExtra.basic || null
      const envAuthFallback = (!bearerToken && !basicFromEnv && GATEWAY_AUTH) ? GATEWAY_AUTH : null

      const baseHeaders = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(GATEWAY_API_KEY ? { 'x-api-key': GATEWAY_API_KEY } : {}),
      }
      const authModes = []
      if (bearerToken) authModes.push({ mode: 'auth_token', value: `${bearerToken}` })
      if (basicFromAuth) authModes.push({ mode: 'basic_auth_response', value: basicFromAuth })
      if (basicFromEnv) authModes.push({ mode: 'basic', value: basicFromEnv })
      if (envAuthFallback) authModes.push({ mode: envAuthFallback.startsWith('Bearer ') ? 'env_bearer' : 'env_basic', value: envAuthFallback })
      // Parâmetros exigidos pelo gateway
      const amountCents = getAmountCents(planKey, billingCycle)
      const validityHours = Number(import.meta.env.VITE_PAYMENT_LINK_VALIDITY_HOURS || 48)
      const validUntilDate = new Date(Date.now() + validityHours * 3600 * 1000)
      const validUntilHuman = formatValidUntil(validUntilDate)
      const minInstallments = Number(import.meta.env.VITE_MIN_INSTALLMENTS || 1)
      const maxInstallments = Number(import.meta.env.VITE_MAX_INSTALLMENTS || 12)
      const maxSales = Number(import.meta.env.VITE_MAX_SALES || 1)
      const showFormAddress = (import.meta.env.VITE_SHOW_FORM_ADDRESS === 'true') ? 1 : 0
      const customerInterest = (import.meta.env.VITE_CUSTOMER_INTEREST === 'true') ? 1 : 0
      const acceptedTypesRaw = (import.meta.env.VITE_ACCEPTED_PAYMENTS_TYPE || 'ALL')
      const acceptedTypesList = acceptedTypesRaw.split(',').map(s => s.trim()).filter(Boolean)
      const acceptedPaymentsType = (acceptedTypesList.length === 0 || (acceptedTypesList.length === 1 && acceptedTypesList[0].toUpperCase() === 'ALL'))
        ? ['PIX', 'Credit', 'Billet']
        : acceptedTypesList

      const requestBody = {
        value: String(amountCents),
        title: `Connekt ${planKey} ${billingCycle}`,
        description: `Connekt ${planKey} (${billingCycle})`,
        validity: validUntilHuman,
        minimumNumberOfInstallments: minInstallments,
        maximumQuantityOfInstallments: maxInstallments,
        numberOfAllowedSales: maxSales,
        showFormAddress: showFormAddress,
        customerInterest: customerInterest,
        acceptedPaymentsType,
      }
      let res = null
      let lastErrorText = ''
      let lastStatus = 0
      for (let i = 0; i < Math.max(1, authModes.length); i++) {
        const selected = authModes[i] || { mode: 'none', value: undefined }
        const requestHeaders = { ...baseHeaders, ...(selected.value ? { 'Authorization': selected.value } : {}) }
        await emit({
          level: 'debug',
          step: 'gateway_request',
          message: 'Criando PaymentLink',
          data: {
            method: 'POST',
            url: requestUrl,
            auth_mode: selected.mode,
            headers: { ...requestHeaders, ...(requestHeaders['x-api-key'] ? { 'x-api-key': '***' } : {}), ...(requestHeaders['Authorization'] ? { 'Authorization': '***' } : {}) },
            body: requestBody,
          },
        })
        res = await fetch(requestUrl, {
          method: 'POST',
          headers: requestHeaders,
          body: JSON.stringify(requestBody),
        })
        if (res.ok) break

        lastStatus = res.status
        const responseHeadersErr = {}
        try { res.headers && res.headers.forEach && res.headers.forEach((v, k) => { responseHeadersErr[k] = v }) } catch (_) {}
        let errText = ''
        try {
          const ct = res.headers.get('Content-Type') || ''
          if (ct.includes('application/json')) {
            const json = await res.json().catch(() => null)
            errText = json ? JSON.stringify(json) : ''
          } else {
            errText = await res.text().catch(() => '')
          }
        } catch (_) {}
        lastErrorText = errText
        await emit({ level: 'error', step: 'gateway_error', message: 'Falha na criação do PaymentLink', data: { status: res.status, url: requestUrl, responseHeaders: responseHeadersErr, bodyText: errText, auth_mode: selected.mode } })

        // Heurística: se payload inválido ou resposta HTML/500, tenta próximo modo
        const isHtml = (lastErrorText || '').toLowerCase().includes('<!doctype html>')
        const mentionsInvalidPayload = (lastErrorText || '').toLowerCase().includes('payload is invalid')
        const shouldRetry = (res.status >= 500 || res.status === 401 || res.status === 403 || res.status === 422 || isHtml || mentionsInvalidPayload)
        if (shouldRetry && i < authModes.length - 1) {
          await emit({ level: 'warn', step: 'gateway_retry', message: 'Tentando novamente com outro modo de Authorization', data: { next_mode: authModes[i+1]?.mode } })
          continue
        }
        break
      }
      if (!res || !res.ok) {
        throw new Error(`Create payment link failed: ${lastStatus}${lastErrorText ? ` - ${lastErrorText}` : ''}`)
      }
      const responseHeaders = {}
      try { res.headers && res.headers.forEach && res.headers.forEach((v, k) => { responseHeaders[k] = v }) } catch (_) {}
      const data = await res.json().catch(() => ({}))
      await emit({ level: 'info', step: 'gateway_response', message: 'PaymentLink criado', data: { status: res.status, ok: res.ok, url: requestUrl, responseHeaders, body: data } })
      const paymentUrl =
        data?.link ||
        data?.url ||
        data?.payment_url ||
        data?.redirectUrl ||
        data?.href ||
        data?.checkout_url || // alguns gateways usam este nome
        successUrl
      const linkId = data?.paymentLinkId || data?.linkId || data?.id || null
      if (linkId) setPaymentLinkId(linkId)
      setPendingCheckout({ planKey, billingCycle, linkId, createdAt: new Date().toISOString(), via: 'gateway' })
      console.log('[planService] PaymentLink criado', { linkId, paymentUrl, response: data })
      await emit({ level: 'info', step: 'redirect', message: 'Redirecionando para página de pagamento', data: { paymentUrl, linkId } })
      if (!redirect) return { ok: true, linkId, via: 'gateway', checkout_url: paymentUrl }
      if (openInNewTab) {
        const w = tryOpenNewTab(paymentUrl)
        if (w) return { ok: true, linkId, via: 'gateway', checkout_url: paymentUrl, opened: true }
      }
      try { await new Promise(r => setTimeout(r, 200)) } catch (_) {}
      this._forceNavigate(paymentUrl)
      return { ok: true, linkId, via: 'gateway', checkout_url: paymentUrl, opened: false }
    } catch (error) {
      console.error('startCheckout error:', error)
      await emit({ level: 'error', step: 'gateway_error', message: String(error?.message || error) })

      // Tentativa de fallback com gateway local simulado (scripts/plans-gateway-dev.js)
      const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      if (isLocal) {
        try {
          const devRes = await fetch('http://localhost:8080/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              plan: planKey,
              billing: billingCycle,
              user_id: user?.id || null,
              success_url: successUrl,
              cancel_url: cancelUrl,
            }),
          })
          if (devRes.ok) {
            const devData = await devRes.json().catch(() => ({}))
            const devUrl = devData?.checkout_url
            if (devUrl) {
              console.log('[planService] Dev gateway: redirecionando para checkout_url', devUrl)
              await emit({ level: 'info', step: 'dev_gateway_redirect', message: 'Redirecionando via gateway dev', data: { checkout_url: devUrl } })
              try { await new Promise(r => setTimeout(r, 1500)) } catch (_) {}
              this._forceNavigate(devUrl)
              return { ok: true, simulated_dev: true }
            }
          }
        } catch (e) {
          console.warn('Dev gateway fallback falhou:', e?.message)
          await emit({ level: 'warn', step: 'dev_gateway_error', message: e?.message })
        }
      }

      // Fallback seguro: navegar ao sucesso local para não travar a UX
      setActivePlan(planKey)
      console.log('[planService] Fallback: redirecionando para callback local', successUrl)
      // await emit({ level: 'warn', step: 'local_fallback', message: 'Gateway indisponível; navegando para sucesso local', data: { successUrl } })
      // try { await new Promise(r => setTimeout(r, 1500)) } catch (_) {}
      // this._forceNavigate(successUrl)
      return { ok: false, error: error?.message, fallback: true }
    }
  },

  async startTrial(planKey, user, options = {}) {
    const days = Number(options?.days || 7)
    const billingCycle = options?.billingCycle || 'mensal'
    const onLog = typeof options?.onLog === 'function' ? options.onLog : null
    const emit = async (e) => {
      const ctx = { trial: true, planKey, days, userId: user?.id || null }
      const withCtx = { ...e, ctx }
      try { onLog && onLog(withCtx) } catch (_) {}
      try { await persistCheckoutLog(e, ctx) } catch (_) {}
    }

    if (!user?.id) {
      await emit({ level: 'error', step: 'trial_missing_user', message: 'Usuário não autenticado' })
      return { ok: false, error: 'not_authenticated' }
    }

    const now = new Date()
    setActivePlan(planKey)
    setSubscription({
      planKey,
      billingCycle,
      status: 'trial',
      autoRenew: false,
      activatedAt: now.toISOString(),
      expiresAt: addDays(now, days).toISOString(),
      canceledAt: null,
      trialDays: days,
    })
    clearPendingCheckout()
    await emit({ level: 'info', step: 'trial_started', message: 'Trial iniciado', data: { planKey, days } })

    if (USE_PROFILES_TABLE && supabase) {
      try {
        const { error } = await supabase
          .from('profiles')
          .upsert(
            { user_id: user.id, active_plan: planKey, plan_activated_at: now.toISOString() },
            { onConflict: 'user_id' }
          )
        if (error) await emit({ level: 'warn', step: 'trial_persist_supabase_error', message: error.message })
      } catch (e) {
        await emit({ level: 'warn', step: 'trial_persist_supabase_exception', message: e?.message || String(e) })
      }
    }

    return { ok: true, planKey, expiresAt: addDays(now, days).toISOString() }
  },

  async checkPaymentLinkPaid(linkId, options = {}) {
    const onLog = typeof options?.onLog === 'function' ? options.onLog : null
    const emit = async (e) => {
      try { onLog && onLog(e) } catch (_) {}
      try { await persistCheckoutLog(e, { linkId, verify: true }) } catch (_) {}
    }
    if (!GATEWAY_URL || !linkId) return { ok: false, error: 'missing_gateway_or_link' }

    const bearerToken = await getGatewayAuthToken(async (log) => { await emit(log) }).catch(() => null)
    const basicFromEnv = (GATEWAY_AUTH && GATEWAY_AUTH.startsWith('Basic ')) ? GATEWAY_AUTH : (GATEWAY_AUTHDATA ? `Basic ${GATEWAY_AUTHDATA}` : null)
    const basicFromAuth = __gatewayAuthExtra.basic || null
    const envAuthFallback = (!bearerToken && !basicFromEnv && GATEWAY_AUTH) ? GATEWAY_AUTH : null
    const baseHeaders = { ...(GATEWAY_API_KEY ? { 'x-api-key': GATEWAY_API_KEY } : {}), 'Accept': 'application/json' }
    const authModes = []
    if (bearerToken) authModes.push({ mode: 'auth_token', value: `${bearerToken}` })
    if (basicFromAuth) authModes.push({ mode: 'basic_auth_response', value: basicFromAuth })
    if (basicFromEnv) authModes.push({ mode: 'basic', value: basicFromEnv })
    if (envAuthFallback) authModes.push({ mode: envAuthFallback.startsWith('Bearer ') ? 'env_bearer' : 'env_basic', value: envAuthFallback })

    const url = `${GATEWAY_BASE}/payments/v1/paymentlink/charges/${encodeURIComponent(String(linkId))}`
    let res = null
    let lastBody = null
    for (let i = 0; i < Math.max(1, authModes.length); i++) {
      const selected = authModes[i] || { mode: 'none', value: undefined }
      const headers = { ...baseHeaders, ...(selected.value ? { 'Authorization': selected.value } : {}) }
      await emit({ level: 'debug', step: 'verify_request', message: 'Consultando cobranças do PaymentLink', data: { url, auth_mode: selected.mode } })
      res = await fetch(url, { method: 'GET', headers })
      const ct = res.headers.get('Content-Type') || ''
      if (ct.includes('application/json')) lastBody = await res.json().catch(() => null)
      else lastBody = await res.text().catch(() => null)
      if (res.ok) break
    }
    if (!res || !res.ok) {
      await emit({ level: 'error', step: 'verify_error', message: 'Falha ao consultar cobranças', data: { status: res?.status || 0, body: lastBody } })
      return { ok: false, error: 'verify_failed', status: res?.status || 0, body: lastBody }
    }

    const charges = Array.isArray(lastBody) ? lastBody : (Array.isArray(lastBody?.data) ? lastBody.data : (lastBody?.charges || []))
    const paid = Array.isArray(charges) && charges.some(c => {
      const s = String(c?.status || '').toLowerCase()
      const code = Number(c?.status)
      return s === 'paid' || s === 'succeeded' || s === 'captured' || c?.paid === true || s === 'aprovado' || code === 2
    })
    return { ok: true, paid: !!paid, charges }
  },

  async getPaymentByGatewayId(gatewayPaymentId) {
    if (!supabase || !gatewayPaymentId) return { ok: false, error: 'missing_parameters' }
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('id,user_id,plan_slug,cycle,status,paid_at,gateway_payment_id,created_at')
        .eq('gateway_payment_id', String(gatewayPaymentId))
        .maybeSingle()
      if (error) return { ok: false, error: error.message }
      return { ok: true, payment: data || null }
    } catch (e) {
      return { ok: false, error: e?.message || String(e) }
    }
  },

  async getPaymentById(paymentId) {
    if (!supabase || !paymentId) return { ok: false, error: 'missing_parameters' }
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('id,user_id,plan_slug,cycle,status,paid_at,gateway_payment_id,created_at')
        .eq('id', String(paymentId))
        .maybeSingle()
      if (error) return { ok: false, error: error.message }
      return { ok: true, payment: data || null }
    } catch (e) {
      return { ok: false, error: e?.message || String(e) }
    }
  },

  async syncPaymentStatus(gatewayPaymentId) {
    if (!supabase || !gatewayPaymentId) return { ok: false, error: 'missing_parameters' }
    try {
      const { data, error } = await supabase.functions.invoke('myg-sync-payment', {
        body: { gateway_payment_id: String(gatewayPaymentId) },
      })
      if (error) return { ok: false, error: error.message, data }
      return { ok: true, data }
    } catch (e) {
      return { ok: false, error: e?.message || String(e) }
    }
  },

  async syncUserPayments(options = {}) {
    if (!supabase) return { ok: false, error: 'missing_supabase' }
    const days = Number(options?.days || 14)
    const limit = Number(options?.limit || 10)
    try {
      const { data, error } = await supabase.functions.invoke('myg-sync-user-payments', {
        body: { days, limit },
      })
      if (error) return { ok: false, error: error.message, data }
      return { ok: true, data }
    } catch (e) {
      return { ok: false, error: e?.message || String(e) }
    }
  },

  async createCheckout(userId, planSlug, cycle) {
    try {
      const { data, error } = await supabase.functions.invoke('myg-payments', {
        body: { userId, planSlug, cycle },
      })
      if (error) throw new Error(error.message)
      if (data?.checkout_url) {
        const linkId = data?.gateway_payment_id || data?.payment_id || null
        if (linkId) setPaymentLinkId(linkId)
        setPendingCheckout({ planKey: planSlug, billingCycle: cycle, linkId, createdAt: new Date().toISOString(), via: 'serverless' })
        return { ok: true, checkout_url: data.checkout_url, gateway_payment_id: data?.gateway_payment_id, payment_id: data?.payment_id }
      }
      return { ok: false, error: 'checkout_url_missing' }
    } catch (e) {
      return { ok: false, error: e?.message }
    }
  },

  async handleCheckoutCallback({ status, plan, billing, link_id, session_id }, user, options = {}) {
    const onLog = typeof options?.onLog === 'function' ? options.onLog : null
    const emit = async (e) => {
      const ctx = { callback: true, plan, userId: user?.id || null, link_id }
      const withCtx = { ...e, ctx }
      try { onLog && onLog(withCtx) } catch (_) {}
      try { await persistCheckoutLog(e, ctx) } catch (_) {}
    }
    const pending = getPendingCheckout()
    const resolvedPlan = plan || pending?.planKey || null
    const resolvedBilling = billing || pending?.billingCycle || null
    if (!resolvedPlan) return { ok: false, error: 'missing plan' }

    // Verificação via gateway real (Payment Link charges)
    if (GATEWAY_URL) {
      const resolvedLinkId = link_id || getPaymentLinkId()
      if (resolvedLinkId) {
        try {
        const bearerToken = await getGatewayAuthToken(async (log) => { await emit(log) }).catch(() => null)
        const basicFromEnv = (GATEWAY_AUTH && GATEWAY_AUTH.startsWith('Basic ')) ? GATEWAY_AUTH : (GATEWAY_AUTHDATA ? `Basic ${GATEWAY_AUTHDATA}` : null)
        const basicFromAuth = __gatewayAuthExtra.basic || null
        const envAuthFallback = (!bearerToken && !basicFromEnv && GATEWAY_AUTH) ? GATEWAY_AUTH : null
        const baseHeaders = { ...(GATEWAY_API_KEY ? { 'x-api-key': GATEWAY_API_KEY } : {}), 'Accept': 'application/json' }
        const authModes = []
        if (bearerToken) authModes.push({ mode: 'auth_token', value: `${bearerToken}` })
        if (basicFromAuth) authModes.push({ mode: 'basic_auth_response', value: basicFromAuth })
        if (basicFromEnv) authModes.push({ mode: 'basic', value: basicFromEnv })
        if (envAuthFallback) authModes.push({ mode: envAuthFallback.startsWith('Bearer ') ? 'env_bearer' : 'env_basic', value: envAuthFallback })

          let res = null
          for (let i = 0; i < Math.max(1, authModes.length); i++) {
            const selected = authModes[i] || { mode: 'none', value: undefined }
            const headers = { ...baseHeaders, ...(selected.value ? { 'Authorization': selected.value } : {}) }
            await emit({ level: 'debug', step: 'verify_request', message: 'Verificando cobrança do PaymentLink', data: { linkId: resolvedLinkId, url: `${GATEWAY_BASE}/payments/v1/paymentlink/charges/${encodeURIComponent(resolvedLinkId)}`, auth_mode: selected.mode } })
            res = await fetch(`${GATEWAY_BASE}/payments/v1/paymentlink/charges/${encodeURIComponent(resolvedLinkId)}`, { method: 'GET', headers })
            if (res.ok) break
            const ct = res.headers.get('Content-Type') || ''
            let bodyText = ''
            if (ct.includes('application/json')) {
              const j = await res.json().catch(() => null)
              bodyText = j ? JSON.stringify(j) : ''
            } else {
              bodyText = await res.text().catch(() => '')
            }
            await emit({ level: 'error', step: 'verify_error', message: 'Falha ao verificar cobranças', data: { status: res.status, url: `${GATEWAY_BASE}/payments/v1/paymentlink/charges/${encodeURIComponent(resolvedLinkId)}`, responseHeaders: {}, bodyText, auth_mode: selected.mode } })
            const mentionsInvalidPayload = bodyText.toLowerCase().includes('payload is invalid')
            const shouldRetry = (res.status >= 500 || res.status === 401 || res.status === 403 || res.status === 422 || mentionsInvalidPayload)
            if (shouldRetry && i < authModes.length - 1) {
              await emit({ level: 'warn', step: 'verify_retry', message: 'Tentando novamente com outro modo de Authorization', data: { next_mode: authModes[i+1]?.mode } })
              continue
            }
            break
          }
          if (!res || !res.ok) throw new Error(`Verify charges failed: ${res?.status || 0}`)
          await emit({ level: 'debug', step: 'verify_request', message: 'Verificando cobrança do PaymentLink', data: { linkId: resolvedLinkId, url: `${GATEWAY_BASE}/payments/v1/paymentlink/charges/${encodeURIComponent(resolvedLinkId)}` } })
          if (!res.ok) {
            const responseHeadersErr = {}
            try { res.headers && res.headers.forEach && res.headers.forEach((v, k) => { responseHeadersErr[k] = v }) } catch (_) {}
            const errText = await res.text().catch(() => '')
            await emit({ level: 'error', step: 'verify_error', message: 'Falha ao verificar cobranças', data: { status: res.status, url: `${GATEWAY_BASE}/payments/v1/paymentlink/charges/${encodeURIComponent(resolvedLinkId)}`, responseHeaders: responseHeadersErr, bodyText: errText } })
            throw new Error(`Verify charges failed: ${res.status}${errText ? ` - ${errText}` : ''}`)
          }
          const data = await res.json().catch(() => ({}))
          await emit({ level: 'info', step: 'verify_response', message: 'Cobranças retornadas', data })
          const charges = Array.isArray(data) ? data : (data?.charges || [])
          const paid = charges.some(c => {
            const s = (c?.status || '').toLowerCase()
            return s === 'paid' || s === 'succeeded' || s === 'captured' || c?.paid === true
          })
          if (!paid) throw new Error('no paid charge found')
        } catch (e) {
          console.warn('PaymentLink verify failed, continuing with local activation:', e?.message)
          await emit({ level: 'warn', step: 'verify_error', message: e?.message })
        }
      }
    }

    // Persistência local (em produção, persistir no backend/Supabase)
    setActivePlan(resolvedPlan)
    const now = new Date()
    const existing = getSubscription()
    const next = {
      ...(existing && typeof existing === 'object' ? existing : {}),
      planKey: resolvedPlan,
      billingCycle: resolvedBilling || 'mensal',
      status: 'active',
      autoRenew: (existing && typeof existing?.autoRenew === 'boolean') ? existing.autoRenew : true,
      activatedAt: now.toISOString(),
      expiresAt: computeExpiresAt(now, resolvedBilling || 'mensal', resolvedPlan).toISOString(),
      canceledAt: null,
    }
    setSubscription(next)
    clearPendingCheckout()
    try {
      const res = await supabase.functions.invoke('plan-notify', {
        body: { event: 'subscribed', planKey: resolvedPlan, billingCycle: resolvedBilling || 'mensal' },
      })
      if (res?.error) console.warn('plan-notify subscribed error:', res.error?.message || String(res.error))
    } catch (_) {}
    try {
      if (user?.id) {
        notificationsService.add(user.id, {
          type: 'plan_subscribed',
          title: 'Plano contratado',
          entityName: planLabel(resolvedPlan),
          message: resolvedBilling ? `(${String(resolvedBilling).toLowerCase() === 'anual' ? 'Anual' : 'Mensal'})` : '',
          actorName: 'Connekt',
          href: '/planos',
        })
      }
    } catch (_) {}
    // Persistência no Supabase (best-effort)
    if (USE_PROFILES_TABLE && user?.id && supabase) {
      try {
        const { error } = await supabase
          .from('profiles')
          .upsert(
            { user_id: user.id, active_plan: resolvedPlan, plan_activated_at: new Date().toISOString() },
            { onConflict: 'user_id' }
          )
        if (error) console.warn('Supabase persist plan error:', error.message)
        await emit({ level: 'info', step: 'persist_supabase', message: 'Plano persistido no Supabase', data: { user_id: user.id, active_plan: resolvedPlan } })
      } catch (e) {
        console.warn('Supabase persist plan exception:', e?.message)
        await emit({ level: 'warn', step: 'persist_supabase_error', message: e?.message })
      }
    }
    return { ok: true, plan: resolvedPlan }
  },

  setAutoRenew(enabled) {
    const current = getSubscription()
    if (!current || typeof current !== 'object') return { ok: false, error: 'no_subscription' }
    const next = { ...current, autoRenew: !!enabled }
    setSubscription(next)
    return { ok: true, subscription: next }
  },

  cancelSubscription(options = {}) {
    const current = getSubscription()
    if (!current || typeof current !== 'object') return { ok: false, error: 'no_subscription' }
    const now = new Date().toISOString()
    const reason = typeof options === 'string' ? options : (options?.reason || '')
    const next = { ...current, status: 'canceled', autoRenew: false, canceledAt: now }
    setSubscription(next)
    try { localStorage.removeItem(storageKey) } catch (_) {}
    if (USE_PROFILES_TABLE && supabase) {
      try {
        const userId = options?.userId || null
        if (userId) {
          Promise.resolve().then(async () => {
            try {
              await supabase
                .from('profiles')
                .upsert({ user_id: userId, active_plan: null, plan_activated_at: null }, { onConflict: 'user_id' })
            } catch (_) {}
          })
        }
      } catch (_) {}
    }
    try {
      const userId = options?.userId || null
      if (userId) {
        notificationsService.add(userId, {
          type: 'plan_canceled',
          title: 'Plano cancelado',
          entityName: planLabel(next.planKey),
          message: '',
          actorName: 'Connekt',
          href: '/planos',
        })
      }
    } catch (_) {}
    try {
      Promise.resolve().then(async () => {
        try {
          const res = await supabase.functions.invoke('plan-notify', {
            body: { event: 'canceled', planKey: next.planKey, billingCycle: next.billingCycle, reason: String(reason || '').trim() || null },
          })
          if (res?.error) console.warn('plan-notify canceled error:', res.error?.message || String(res.error))
        } catch (_) {}
      })
    } catch (_) {}
    return { ok: true, subscription: next }
  },
}

