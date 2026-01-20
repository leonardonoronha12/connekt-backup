// Supabase Edge Function: myg-payment-webhook
// Recebe POST do gateway, valida Authorization e atualiza payments/users

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const MYG_WEBHOOK_TOKEN = Deno.env.get('MYG_WEBHOOK_TOKEN') || ''

const supabase = (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null

const statusMap: Record<number, string> = {
  0: 'initiated',
  1: 'canceled',
  2: 'paid',
  3: 'chargeback',
  4: 'reversed',
  5: 'partial_reversed',
  6: 'failed', // reprove
  7: 'pending',
  8: 'failed',
  9: 'challenge',
}

function mapStatus(payload: any): string | null {
  const code = Number(payload?.status ?? payload?.code ?? payload?.payment_status ?? -1)
  if (isFinite(code) && code >= 0) {
    return statusMap[code] || null
  }
  const s = String(payload?.statusStr || payload?.status || '').toLowerCase()
  if (!s) return null
  if (s.includes('pago') || s.includes('paid')) return 'paid'
  if (s.includes('falha') || s.includes('failed') || s.includes('reprov')) return 'failed'
  if (s.includes('cancel')) return 'canceled'
  if (s.includes('pend')) return 'pending'
  return null
}

function sanitizePayload(payload: any): any {
  if (!payload || typeof payload !== 'object') return payload
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(payload)) {
    if (['customer_document', 'customer_email', 'customer_name', 'number_obfuscate'].includes(k)) continue
    out[k] = v
  }
  return out
}

serve(async (req) => {
  try {
    if (!supabase) return new Response('server_missing_db_config', { status: 500 })
    if (req.method !== 'POST') return new Response('method_not_allowed', { status: 405 })

    // Segurança: Authorization deve ser exatamente o token
    const auth = String(req.headers.get('Authorization') || '').trim()
    const okAuth = !!MYG_WEBHOOK_TOKEN && (auth === MYG_WEBHOOK_TOKEN || auth === `Bearer ${MYG_WEBHOOK_TOKEN}`)
    if (!okAuth) {
      return new Response('unauthorized', { status: 401 })
    }

    const payload = await req.json().catch(() => ({}))
    const mapped = mapStatus(payload)
    const gateway_payment_id: string = String(
      payload?.id ||
      payload?.payment_id ||
      payload?.gateway_payment_id ||
      payload?.paymentLinkId ||
      payload?.linkId ||
      payload?.transaction_id ||
      payload?.transactionId ||
      ''
    )
    if (!gateway_payment_id) {
      return new Response('ok', { status: 200 })
    }

    const findByGatewayPaymentId = async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('gateway_payment_id', gateway_payment_id)
        .limit(1)
      return { data, error }
    }

    const findByExternalOrderNumber = async () => {
      const ext = String(payload?.external_order_number || payload?.externalOrderNumber || '').trim()
      if (!ext) return { data: null as any, error: null as any }
      const looksUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ext)
      if (!looksUuid) return { data: null as any, error: null as any }
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('id', ext)
        .limit(1)
      return { data, error }
    }

    let payment: any = null
    const { data: rows, error: selErr } = await findByGatewayPaymentId()
    if (selErr) {
      console.warn('payments select error:', selErr.message)
      return new Response('ok', { status: 200 })
    }
    payment = rows?.[0] || null

    if (!payment) {
      const { data: rows2, error: selErr2 } = await findByExternalOrderNumber()
      if (selErr2) {
        console.warn('payments external_order_number select error:', selErr2.message)
        return new Response('ok', { status: 200 })
      }
      payment = rows2?.[0] || null
    }

    if (!payment) return new Response('ok', { status: 200 })

    // Idempotência: se já finalizado, apenas salva raw_payload
    const finalStatuses = ['paid', 'canceled', 'failed']
    const nextStatus = mapped || payment.status || 'pending'

    const updateData: Record<string, any> = { raw_payload: sanitizePayload(payload) }
    if (!finalStatuses.includes(payment.status)) {
      updateData.status = nextStatus
      if (nextStatus === 'paid') updateData.paid_at = new Date().toISOString()
    }

    await supabase.from('payments').update(updateData).eq('id', payment.id)

    if (nextStatus === 'paid') {
      const now = new Date().toISOString()
      // Atualizar profiles (recomendado para o app)
      try {
        await supabase
          .from('profiles')
          .upsert(
            {
              user_id: payment.user_id,
              active_plan: payment.plan_slug,
              plan_activated_at: now,
            },
            { onConflict: 'user_id' }
          )
      } catch (e) {
        console.warn('profiles upsert error:', (e as Error)?.message)
      }

      // Atualizar users (legado / compatibilidade)
      try {
        await supabase
          .from('users')
          .update({
            plan: payment.plan_slug,
            plan_cycle: payment.cycle,
            plan_active: true,
            plan_activated_at: now,
          })
          .eq('id', payment.user_id)
      } catch (e) {
        console.warn('users update error:', (e as Error)?.message)
      }
    }

    return new Response('ok', { status: 200 })
  } catch (e) {
    console.error('webhook error:', (e as Error)?.message)
    // Webhook não deve falhar com 5xx para não re-tentar continuamente
    return new Response('ok', { status: 200 })
  }
})
