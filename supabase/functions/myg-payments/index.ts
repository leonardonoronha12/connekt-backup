// Supabase Edge Function: myg-payments
// Responsável por autenticar na MyGateway e criar PaymentLink
// Implementa idempotência no banco (payments) e retorna checkout_url

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

function withCors(res: Response): Response {
  const headers = new Headers(res.headers)
  for (const [k, v] of Object.entries(corsHeaders)) headers.set(k, v)
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers })
}

type CreatePaymentInput = {
  userId: string
  planSlug: 'start' | 'pro' | 'premium' | string
  cycle: 'mensal' | 'anual' | 'monthly' | 'yearly' | string
}

type MygAuthResponse = {
  auth_token?: string
  expires_in?: string // ISO8601 string
}

type MygPaymentLinkResponse = {
  id?: string
  link?: string
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const MYG_BASE_URL = Deno.env.get('MYG_BASE_URL') || 'https://api.whitelabel.mygateway.com.br/connekt'
const MYG_API_KEY = Deno.env.get('MYG_API_KEY') || ''
const MYG_CLIENT_ID = Deno.env.get('MYG_CLIENT_ID') || ''
const MYG_CLIENT_SECRET = Deno.env.get('MYG_CLIENT_SECRET') || ''
// Suporte alternativo: usar Authorization direto (Bearer/Basic) e sessão
const MYG_AUTHORIZATION = Deno.env.get('MYG_AUTHORIZATION') || ''
const APP_BASE_URL = Deno.env.get('APP_BASE_URL') || ''

const supabase = (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null

// Cache simples em memória do worker
let cachedAuth: { token: string; expiresAt: number } | null = null

function toCents(valueStr: string | undefined | null): number {
  if (!valueStr || typeof valueStr !== 'string') return 0
  const normalized = valueStr.replace(/\./g, '').replace(',', '.')
  const num = Number(normalized)
  if (!isFinite(num)) return 0
  return Math.round(num * 100)
}

function getAmountCents(planSlug: string, cycle: string): number {
  // Mesmos valores da UI; ajuste via env se necessário
  const envKey = `MYG_PRICE_${String(planSlug).toUpperCase()}_${String(cycle).toUpperCase()}_CENTS`
  const fromEnv = Number(Deno.env.get(envKey) || '')
  if (isFinite(fromEnv) && fromEnv > 0) return Math.round(fromEnv)

  if (planSlug === 'teste') return 100

  const prices = {
    start: { mensal: '99,00', anual: '79,00' },
    pro: { mensal: '299,00', anual: '249,00' },
    premium: { mensal: '599,00', anual: '499,00' },
  } as const
  const p = (prices as any)[planSlug]
  if (!p) return 0
  const cycleKey = (cycle === 'yearly' ? 'anual' : cycle === 'monthly' ? 'mensal' : cycle) as 'mensal' | 'anual'
  const perMonth = toCents(p[cycleKey])
  const mult = cycleKey === 'anual' ? 12 : 1
  return perMonth * mult
}

function formatValidity(dt: Date): string {
  // Formato exigido: YYYY-MM-DD HH:mm (sem segundos)
  const pad = (n: number) => String(n).padStart(2, '0')
  const yyyy = dt.getFullYear()
  const mm = pad(dt.getMonth() + 1)
  const dd = pad(dt.getDate())
  const hh = pad(dt.getHours())
  const mi = pad(dt.getMinutes())
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
}

async function getMygAuthToken(): Promise<string | null> {
  try {
    const now = Date.now()
    if (cachedAuth && cachedAuth.expiresAt - 60_000 > now) {
      return cachedAuth.token
    }
  } catch (_) {}

  if (!MYG_BASE_URL || !MYG_API_KEY || !MYG_CLIENT_ID || !MYG_CLIENT_SECRET) return null

  const authData = btoa(`${MYG_CLIENT_ID}:${MYG_CLIENT_SECRET}`)
  const url = `${MYG_BASE_URL}/authentication/v2/auth`
  const headers = { 'x-api-key': MYG_API_KEY, 'Content-Type': 'application/json', 'Accept': 'application/json' }
  const body = { authData }
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
  if (!res.ok) return null
  const data = (await res.json().catch(() => ({}))) as MygAuthResponse
  const token = data?.auth_token || null
  const expISO = data?.expires_in
  let expiresAt = Date.now() + 10 * 60_000
  if (expISO) {
    const t = Date.parse(expISO)
    if (isFinite(t)) expiresAt = t
  }
  if (token) cachedAuth = { token, expiresAt }
  return token
}

async function createPaymentLink(input: CreatePaymentInput) {
  const { userId, planSlug, cycle } = input
  // Se supabase não estiver configurado, seguir sem idempotência no banco

  const amount_cents = getAmountCents(planSlug, cycle)
  if (!amount_cents || amount_cents <= 0) {
    return new Response(JSON.stringify({ error: 'invalid_amount' }), { status: 400 })
  }

  // Idempotência: initiated/pending
  let existing: any[] | null = null
  if (supabase) {
    const { data, error: existingErr } = await supabase
      .from('payments')
      .select('*')
      .eq('user_id', userId)
      .eq('plan_slug', planSlug)
      .eq('cycle', cycle)
      .in('status', ['initiated', 'pending'])
      .limit(1)
    if (existingErr) {
      console.warn('payments existing search error:', existingErr?.message)
    }
    existing = data || null
  }

  const basePayment = {
    user_id: userId,
    plan_slug: planSlug,
    cycle,
    status: 'initiated',
    amount_cents,
  }

  let paymentRow: any = existing?.[0] || null
  if (!paymentRow && supabase) {
    const { data: inserted, error: insertErr } = await supabase
      .from('payments')
      .insert(basePayment)
      .select('*')
      .limit(1)
    if (insertErr) {
      console.error('payments insert error:', insertErr.message)
      // Prosseguir sem persistência em caso de falha
    }
    paymentRow = inserted?.[0] || null
  }

  // Tenta token via auth; se não houver, usa Authorization direto se configurado
  const token = await getMygAuthToken()
  if (!token && !MYG_AUTHORIZATION) {
    return new Response(JSON.stringify({ error: 'auth_failed' }), { status: 502 })
  }

  const validity = formatValidity(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
  const url = `${MYG_BASE_URL}/payments/v1/paymentlink`
  const headers = {
    'x-api-key': MYG_API_KEY,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    // Preferir Authorization direto se fornecido, senão usar token obtido
    'Authorization': MYG_AUTHORIZATION || (token ? `${token}` : ''),
  }
  const payment_id = paymentRow?.id || null
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
  const return_url = (allowReturnUrl && payment_id)
    ? `${String(APP_BASE_URL).replace(/\/$/, '')}/planos?payment_id=${encodeURIComponent(String(payment_id))}`
    : null
  const body = {
    value: String(amount_cents),
    title: `${String(planSlug)} ${cycle === 'mensal' || cycle === 'monthly' ? '(mensal)' : '(anual)'}`,
    description: `Assinatura do plano ${String(planSlug)}`,
    validity,
    minimumNumberOfInstallments: 1,
    maximumQuantityOfInstallments: 12,
    numberOfAllowedSales: 1,
    showFormAddress: 0,
    customerInterest: 0,
    acceptedPaymentsType: ['PIX', 'Credit', 'Billet'],
    ...(payment_id ? { external_order_number: String(payment_id) } : {}),
    ...(return_url ? { return_url } : {}),
  }

  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
  const ct = res.headers.get('Content-Type') || ''
  let payload: any = null
  if (ct.includes('application/json')) payload = await res.json().catch(() => ({}))
  else payload = await res.text().catch(() => '')
  const myg: MygPaymentLinkResponse = typeof payload === 'object' && payload ? payload : {}

  if (!res.ok) {
    // Atualiza raw_payload e status=failed quando possível
    if (supabase && paymentRow?.id) {
      await supabase.from('payments').update({ status: 'failed', raw_payload: payload }).eq('id', paymentRow.id)
    }
    return new Response(JSON.stringify({ error: 'create_paymentlink_failed', status: res.status, payload }), { status: 502 })
  }

  const gateway_payment_id = myg.id || null
  const checkout_url = myg.link || (APP_BASE_URL ? `${APP_BASE_URL}/planos?ok=1&pid=${encodeURIComponent(String(gateway_payment_id || ''))}` : null)

  if (supabase && paymentRow?.id) {
    const updateData: Record<string, any> = {
      status: 'pending',
      gateway_payment_id,
      checkout_url: myg.link || checkout_url,
      raw_payload: payload,
    }
    await supabase.from('payments').update(updateData).eq('id', paymentRow.id)
  }

  const out = {
    payment_id,
    gateway_payment_id,
    checkout_url: myg.link || checkout_url,
  }
  return new Response(JSON.stringify(out), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }
    const { pathname } = new URL(req.url)
    if (req.method === 'GET' && pathname.endsWith('/health')) {
      return withCors(new Response('ok'))
    }
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}))
      const input: CreatePaymentInput = {
        userId: String(body?.userId || ''),
        planSlug: String(body?.planSlug || ''),
        cycle: String(body?.cycle || ''),
      }
      if (!input.userId || !input.planSlug || !input.cycle) {
        return withCors(new Response(JSON.stringify({ error: 'missing_parameters' }), { status: 400, headers: { 'Content-Type': 'application/json' } }))
      }
      return withCors(await createPaymentLink(input))
    }
    return withCors(new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: { 'Content-Type': 'application/json' } }))
  } catch (e) {
    return withCors(new Response(JSON.stringify({ error: 'server_error', message: String((e as Error)?.message || e) }), { status: 500, headers: { 'Content-Type': 'application/json' } }))
  }
})
