import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1'

type SyncInput = { days?: number; limit?: number }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''

const MYG_BASE_URL = Deno.env.get('MYG_BASE_URL') || 'https://api.whitelabel.mygateway.com.br/connekt'
const MYG_API_KEY = Deno.env.get('MYG_API_KEY') || ''
const MYG_CLIENT_ID = Deno.env.get('MYG_CLIENT_ID') || ''
const MYG_CLIENT_SECRET = Deno.env.get('MYG_CLIENT_SECRET') || ''
const MYG_AUTHORIZATION = Deno.env.get('MYG_AUTHORIZATION') || ''

const supabaseAdmin = (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null

let cachedAuth: { token: string; expiresAt: number } | null = null

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
}

async function getMygAuthToken(): Promise<string | null> {
  if (MYG_AUTHORIZATION) return MYG_AUTHORIZATION

  try {
    const now = Date.now()
    if (cachedAuth && cachedAuth.expiresAt - 60_000 > now) return cachedAuth.token
  } catch (_) {}

  if (!MYG_BASE_URL || !MYG_API_KEY || !MYG_CLIENT_ID || !MYG_CLIENT_SECRET) return null

  const authData = btoa(`${MYG_CLIENT_ID}:${MYG_CLIENT_SECRET}`)
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
    if (isFinite(t)) expiresAt = t
  }
  if (token) cachedAuth = { token, expiresAt }
  return token
}

function sanitizeGatewayPayload(payload: any): any {
  const sanitizeCharge = (c: any) => {
    if (!c || typeof c !== 'object') return c
    const out: Record<string, any> = {}
    for (const [k, v] of Object.entries(c)) {
      if (['customer_document', 'customer_email', 'customer_name', 'number_obfuscate'].includes(k)) continue
      out[k] = v
    }
    return out
  }
  if (Array.isArray(payload)) return payload.map(sanitizeCharge)
  if (payload && typeof payload === 'object') {
    if (Array.isArray((payload as any).data)) return { ...payload, data: (payload as any).data.map(sanitizeCharge) }
    if (Array.isArray((payload as any).charges)) return { ...payload, charges: (payload as any).charges.map(sanitizeCharge) }
  }
  return payload
}

function classifyStatus(chargesPayload: any): { status: 'pending' | 'paid' | 'failed' | 'canceled'; paid: boolean } {
  const charges =
    Array.isArray(chargesPayload) ? chargesPayload
      : Array.isArray(chargesPayload?.data) ? chargesPayload.data
        : (chargesPayload?.charges || [])

  if (!Array.isArray(charges) || charges.length === 0) return { status: 'pending', paid: false }

  const anyPaid = charges.some((c) => {
    const s = String(c?.status || '').toLowerCase()
    const s2 = String(c?.statusStr || '').toLowerCase()
    const code = Number(c?.status)
    return (
      s === 'paid' ||
      s === 'succeeded' ||
      s === 'captured' ||
      s === 'aprovado' ||
      s === 'pago' ||
      s2.includes('pago') ||
      c?.paid === true ||
      code === 2
    )
  })
  if (anyPaid) return { status: 'paid', paid: true }

  const anyCanceled = charges.some((c) => Number(c?.status) === 1 || String(c?.statusStr || '').toLowerCase().includes('cancel'))
  if (anyCanceled) return { status: 'canceled', paid: false }

  const anyFailed = charges.some((c) => {
    const code = Number(c?.status)
    const s = String(c?.statusStr || c?.status || '').toLowerCase()
    return code === 6 || code === 8 || s.includes('falha') || s.includes('failed') || s.includes('reprov')
  })
  if (anyFailed) return { status: 'failed', paid: false }

  return { status: 'pending', paid: false }
}

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
    if (!supabaseAdmin || !SUPABASE_URL || !SUPABASE_ANON_KEY) return json({ error: 'server_missing_db_config' }, 500)

    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader) return json({ error: 'missing_auth' }, 401)

    const supabaseUserClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })

    const { data: authData, error: authErr } = await supabaseUserClient.auth.getUser()
    if (authErr || !authData?.user?.id) return json({ error: 'invalid_auth' }, 401)
    const userId = authData.user.id

    const body = (await req.json().catch(() => ({}))) as Partial<SyncInput>
    const days = Math.max(1, Math.min(30, Number(body?.days || 14)))
    const limit = Math.max(1, Math.min(50, Number(body?.limit || 10)))

    const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    const { data: payments, error: payErr } = await supabaseAdmin
      .from('payments')
      .select('id,user_id,plan_slug,cycle,status,gateway_payment_id,created_at')
      .eq('user_id', userId)
      .in('status', ['pending', 'initiated', 'failed'])
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (payErr) return json({ error: 'db_error', message: payErr.message }, 500)

    const token = await getMygAuthToken()
    if (!token || !MYG_API_KEY) return json({ error: 'gateway_auth_failed' }, 502)

    const items = Array.isArray(payments) ? payments : []
    const results: Array<{ id: string; gateway_payment_id: string | null; before: string; after: string; paid: boolean }> = []

    for (const p of items) {
      const before = String(p.status || 'pending')
      const gid = p.gateway_payment_id ? String(p.gateway_payment_id) : null
      if (!gid) {
        results.push({ id: p.id, gateway_payment_id: null, before, after: before, paid: false })
        continue
      }

      const url = `${MYG_BASE_URL}/payments/v1/paymentlink/charges/${encodeURIComponent(gid)}`
      const res = await fetch(url, { method: 'GET', headers: { 'x-api-key': MYG_API_KEY, 'Accept': 'application/json', 'Authorization': token } })
      const ct = res.headers.get('Content-Type') || ''
      const payload = ct.includes('application/json') ? await res.json().catch(() => ({})) : await res.text().catch(() => '')
      const sanitized = sanitizeGatewayPayload(payload)
      if (!res.ok) {
        await supabaseAdmin.from('payments').update({ raw_payload: sanitized }).eq('id', p.id)
        results.push({ id: p.id, gateway_payment_id: gid, before, after: before, paid: false })
        continue
      }

      const classification = classifyStatus(payload)
      const after = classification.status
      if (after === 'paid') {
        const now = new Date().toISOString()
        await supabaseAdmin.from('payments').update({ status: 'paid', paid_at: now, raw_payload: sanitized }).eq('id', p.id)
        await supabaseAdmin.from('profiles').upsert({ user_id: userId, active_plan: p.plan_slug, plan_activated_at: now }, { onConflict: 'user_id' })
        results.push({ id: p.id, gateway_payment_id: gid, before, after, paid: true })
        continue
      }
      if (after === 'failed' || after === 'canceled') {
        await supabaseAdmin.from('payments').update({ status: after, raw_payload: sanitized }).eq('id', p.id)
        results.push({ id: p.id, gateway_payment_id: gid, before, after, paid: false })
        continue
      }

      await supabaseAdmin.from('payments').update({ raw_payload: sanitized }).eq('id', p.id)
      results.push({ id: p.id, gateway_payment_id: gid, before, after: before, paid: false })
    }

    const updatedPaid = results.filter(r => r.after === 'paid').length
    const updatedFailed = results.filter(r => r.after === 'failed').length
    const updatedCanceled = results.filter(r => r.after === 'canceled').length
    return json({ ok: true, checked: results.length, updatedPaid, updatedFailed, updatedCanceled, results }, 200)
  } catch (e) {
    return json({ error: 'server_error', message: String((e as Error)?.message || e) }, 500)
  }
})

