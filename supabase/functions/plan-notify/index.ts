import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function withCors(res: Response): Response {
  const headers = new Headers(res.headers)
  for (const [k, v] of Object.entries(corsHeaders)) headers.set(k, v)
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers })
}

type Body = {
  event?: 'subscribed' | 'canceled'
  planKey?: string
  billingCycle?: string
  reason?: string
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''
const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY') || ''
const SENDGRID_FROM_EMAIL = Deno.env.get('SENDGRID_FROM_EMAIL') || ''
const SENDGRID_FROM_NAME = Deno.env.get('SENDGRID_FROM_NAME') || 'Connekt'
const APP_BASE_URL = Deno.env.get('APP_BASE_URL') || Deno.env.get('SITE_URL') || ''

const planName = (key: string) => {
  const k = String(key || '').toLowerCase()
  if (k === 'start') return 'Connekt Start'
  if (k === 'pro') return 'Connekt Pro'
  if (k === 'premium') return 'Connekt Premium'
  if (k === 'teste') return 'Connekt Teste'
  return key || 'Plano'
}

const cycleLabel = (cycle: string) => {
  const c = String(cycle || '').toLowerCase()
  if (c === 'anual' || c === 'yearly') return 'Anual'
  return 'Mensal'
}

async function sendViaSendgrid({ to, subject, html }: { to: string; subject: string; html: string }) {
  if (!SENDGRID_API_KEY || !SENDGRID_FROM_EMAIL) {
    return { ok: false, skipped: true, error: 'sendgrid_not_configured' }
  }
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: SENDGRID_FROM_EMAIL, name: SENDGRID_FROM_NAME },
      subject,
      content: [{ type: 'text/html', value: html }],
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    console.error('sendgrid_send_failed', JSON.stringify({ status: res.status, body: text }))
    return { ok: false, skipped: false, error: `sendgrid_error_${res.status}`, details: text }
  }
  return { ok: true }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return withCors(new Response('ok', { status: 200 }))
  if (req.method !== 'POST') return withCors(new Response(JSON.stringify({ ok: false, error: 'method_not_allowed' }), { status: 200 }))

  try {
    const authHeader = req.headers.get('Authorization') || ''
    const body = (await req.json().catch(() => ({}))) as Body
    const event = body?.event
    const planKey = body?.planKey || ''
    const billingCycle = body?.billingCycle || 'mensal'
    const reason = String(body?.reason || '').trim()

    if (!event || (event !== 'subscribed' && event !== 'canceled')) {
      return withCors(new Response(JSON.stringify({ ok: false, error: 'invalid_event' }), { status: 200 }))
    }

    console.log('plan_notify_received', JSON.stringify({ event, planKey, billingCycle, hasReason: !!reason }))

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    })

    const { data: userData, error: userErr } = await supabase.auth.getUser()
    if (userErr) throw userErr
    const user = userData?.user
    const email = user?.email || null
    if (!email) return withCors(new Response(JSON.stringify({ ok: false, error: 'missing_email' }), { status: 200 }))

    const when = new Date().toISOString()
    const pName = planName(planKey)
    const cycle = cycleLabel(billingCycle)
    const dashboardUrl = APP_BASE_URL ? `${APP_BASE_URL.replace(/\/+$/, '')}/dashboard` : ''
    const planosUrl = APP_BASE_URL ? `${APP_BASE_URL.replace(/\/+$/, '')}/planos` : ''

    const subject = event === 'subscribed'
      ? `Plano contratado: ${pName}`
      : `Plano cancelado: ${pName}`

    const title = event === 'subscribed' ? 'Plano contratado com sucesso' : 'Assinatura cancelada'
    const message = event === 'subscribed'
      ? `Seu plano <strong>${pName}</strong> (${cycle}) foi ativado com sucesso.`
      : `Sua assinatura do plano <strong>${pName}</strong> foi cancelada.`

    const reasonBlock = (event === 'canceled' && reason)
      ? `<div style="margin-top:16px;padding:12px;border:1px solid #FECACA;background:#FEF2F2;border-radius:8px;">
          <div style="font-size:12px;color:#DC2626;font-weight:600;margin-bottom:6px;">Motivo informado</div>
          <div style="font-size:12px;color:#7F1D1D;white-space:pre-wrap;">${reason.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</div>
        </div>`
      : ''

    const cta = event === 'subscribed'
      ? (dashboardUrl ? `<a href="${dashboardUrl}" style="display:inline-block;margin-top:18px;background:#0047BB;color:#fff;padding:12px 16px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Ir para o Dashboard</a>` : '')
      : (planosUrl ? `<a href="${planosUrl}" style="display:inline-block;margin-top:18px;background:#0047BB;color:#fff;padding:12px 16px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Ver planos</a>` : '')

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;background:#F8FAFC;padding:24px;">
        <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #E3E4E5;border-radius:12px;overflow:hidden;">
          <div style="padding:18px 20px;border-bottom:1px solid #E3E4E5;">
            <div style="font-size:18px;font-weight:800;color:#1E1B39;">Connekt</div>
          </div>
          <div style="padding:20px;">
            <div style="font-size:18px;font-weight:800;color:#1E1B39;margin-bottom:10px;">${title}</div>
            <div style="font-size:14px;color:#404040;line-height:1.6;">${message}</div>
            <div style="font-size:12px;color:#737780;margin-top:10px;">Data: ${when}</div>
            ${reasonBlock}
            ${cta}
          </div>
          <div style="padding:14px 20px;border-top:1px solid #E3E4E5;font-size:12px;color:#8F9299;">
            Este email foi enviado para ${email}.
          </div>
        </div>
      </div>
    `

    const send = await sendViaSendgrid({ to: email, subject, html })
    console.log('plan_notify_send_result', JSON.stringify({ event, to: email, subject, ok: !!send.ok, skipped: !!send.skipped, error: send?.error || null }))
    if (!send.ok && !send.skipped) {
      return withCors(new Response(JSON.stringify({ ok: false, sent: false, skipped: false, error: send.error, details: (send as any).details || null }), { status: 200 }))
    }
    return withCors(new Response(JSON.stringify({ ok: true, sent: !!send.ok, skipped: !!send.skipped, subject }), { status: 200 }))
  } catch (e) {
    console.error('plan_notify_error', e?.message || String(e))
    return withCors(new Response(JSON.stringify({ ok: false, error: e?.message || String(e) }), { status: 200 }))
  }
})
