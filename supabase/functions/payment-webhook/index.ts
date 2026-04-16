// Supabase Edge Function: payment-webhook
// Recebe POST do gateway com atualizações de pagamento.
// Valida Authorization (Bearer recomendado) e persiste ativação de plano.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1'

type WebhookBody = {
  status?: string
  paid?: boolean
  paymentLinkId?: string
  linkId?: string
  id?: string
  orderId?: string
  plan?: 'start' | 'pro' | 'premium' | string
  user_id?: string
}

function getEnv(name: string, fallback?: string): string | undefined {
  try { return Deno.env.get(name) ?? fallback } catch (_) { return fallback }
}

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    ...init,
  })
}

function unauthorized(message = 'unauthorized') {
  return json({ ok: false, error: message }, { status: 401 })
}

function badRequest(message: string) {
  return json({ ok: false, error: message }, { status: 400 })
}

function isPaidStatus(status?: string): boolean {
  const s = (status || '').toLowerCase()
  return s === 'paid' || s === 'succeeded' || s === 'captured' || s === 'approved' || s === 'success'
}

async function persistLog(payload: unknown) {
  try {
    const url = getEnv('SUPABASE_URL')
    const key = getEnv('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !key) return
    const supabase = createClient(url, key)
    const LOG_BUCKET = 'imagens-logs'
    try { await supabase.storage.createBucket(LOG_BUCKET, { public: true }) } catch (_) {}
    const path = `webhook/${Date.now()}_${Math.random().toString(36).slice(2,8)}.json`
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
    await supabase.storage.from(LOG_BUCKET).upload(path, blob, { upsert: true })
  } catch (_) {}
}

async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  if (req.method !== 'POST') return badRequest('method not allowed')

  const auth = req.headers.get('authorization') || ''
  const envSecret = String(getEnv('WEBHOOK_SECRET', '') || '').trim()
  if (!envSecret) {
    await persistLog({ type: 'webhook_config_error', error: 'missing_webhook_secret' })
    return json({ ok: false, error: 'missing_webhook_secret' }, { status: 500 })
  }
  const validBearer = auth === `Bearer ${envSecret}`

  let validBasic = false
  if (auth.startsWith('Basic ')) {
    try {
      const b64 = auth.slice(6).trim()
      const decoded = atob(b64)
      // formato "id:segredo" (apenas valida segredo)
      const secretPart = decoded.split(':')[1] || decoded
      validBasic = secretPart === envSecret
    } catch (_) {}
  }

  if (!validBearer && !validBasic) {
    const authType = auth.startsWith('Bearer ')
      ? 'bearer'
      : auth.startsWith('Basic ')
        ? 'basic'
        : (auth ? 'other' : 'missing')
    await persistLog({ type: 'webhook_auth_error', authType })
    return unauthorized('invalid authorization')
  }

  let body: WebhookBody | undefined
  try { body = await req.json() } catch (_) { return badRequest('invalid json') }
  const status = body?.status
  const paid = Boolean(body?.paid) || isPaidStatus(status)
  const userId = body?.user_id || ''
  const plan = body?.plan || ''
  const linkId = body?.paymentLinkId || body?.linkId || body?.id || ''

  await persistLog({ type: 'webhook_received', status, paid, user_id: userId, plan, linkId })

  // Atualiza plano no profiles (best-effort)
  try {
    const url = getEnv('SUPABASE_URL')
    const key = getEnv('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !key) throw new Error('missing supabase env')
    if (!paid) return json({ ok: true, ignored: true, reason: 'not paid' })
    if (!userId || !plan) return json({ ok: true, ignored: true, reason: 'missing user_id or plan' })

    const supabase = createClient(url, key)
    const { error } = await supabase
      .from('profiles')
      .upsert(
        { user_id: userId, active_plan: plan, plan_activated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
    if (error) throw new Error(error.message)
  } catch (e) {
    await persistLog({ type: 'webhook_persist_error', error: (e as Error)?.message, body })
    return json({ ok: false, error: (e as Error)?.message || 'persist error' }, { status: 500 })
  }

  return json({ ok: true })
}

serve(handler)

