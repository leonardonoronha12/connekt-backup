import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1'

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

function normalizeEmail(v: unknown) {
  return String(v || '').trim().toLowerCase()
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

async function sendViaSendgrid({ to, subject, html }: { to: string; subject: string; html: string }) {
  const apiKey = String(getEnv('SENDGRID_API_KEY', '') || '').trim()
  const fromEmail = String(getEnv('SENDGRID_FROM_EMAIL', '') || '').trim()
  const fromName = String(getEnv('SENDGRID_FROM_NAME', 'Connekt') || 'Connekt').trim() || 'Connekt'
  if (!apiKey || !fromEmail) return { ok: false, skipped: true, error: 'missing_sendgrid_env' }
  if (!isValidEmail(to) || !isValidEmail(fromEmail)) return { ok: false, skipped: false, error: 'invalid_email' }
  const r = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: fromEmail, name: fromName },
      subject,
      content: [{ type: 'text/html', value: html }],
    }),
  })
  if (!r.ok) {
    const raw = await r.text().catch(() => '')
    return { ok: false, skipped: false, error: 'sendgrid_send_failed', status: r.status, details: raw }
  }
  return { ok: true, skipped: false }
}

function parseIso(v: unknown) {
  const s = String(v || '').trim()
  if (!s) return null
  const t = Date.parse(s)
  return Number.isFinite(t) ? t : null
}

function resolveDueMs(p: any) {
  return (
    parseIso(p?.due_at) ??
    parseIso(p?.dueAt) ??
    parseIso(p?.expires_at) ??
    parseIso(p?.expiresAt) ??
    parseIso(p?.valid_until) ??
    parseIso(p?.validUntil) ??
    parseIso(p?.period_end) ??
    parseIso(p?.current_period_end) ??
    parseIso(p?.currentPeriodEnd) ??
    null
  )
}

function classifyPaymentMethodFromPayload(payload: any): 'card' | 'pix' | 'boleto' | 'unknown' {
  if (!payload) return 'unknown'
  const p = payload && typeof payload === 'object' ? payload : null
  const raw = p ? JSON.stringify(p) : String(payload)
  const s = raw.toLowerCase()
  if (s.includes('pix')) return 'pix'
  if (s.includes('billet') || s.includes('boleto')) return 'boleto'
  if (s.includes('credit') || s.includes('cartao') || s.includes('cartão') || s.includes('card')) return 'card'
  return 'unknown'
}

function mergeMeta(rawPayload: any, patch: Record<string, any>) {
  const base = rawPayload && typeof rawPayload === 'object' && !Array.isArray(rawPayload) ? rawPayload : {}
  const existingMeta = base._connekt_meta && typeof base._connekt_meta === 'object' ? base._connekt_meta : {}
  return { ...base, _connekt_meta: { ...existingMeta, ...patch } }
}

function buildEmailHtml({ title, message, when, ctaUrl }: { title: string; message: string; when: string; ctaUrl: string }) {
  const cta = ctaUrl
    ? `<a href="${ctaUrl}" style="display:inline-block;margin-top:18px;background:#0047BB;color:#fff;padding:12px 16px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">Efetuar pagamento atrasado</a>`
    : ''
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;background:#F8FAFC;padding:24px;">
      <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #E3E4E5;border-radius:12px;overflow:hidden;">
        <div style="padding:18px 20px;border-bottom:1px solid #E3E4E5;">
          <div style="font-size:18px;font-weight:800;color:#1E1B39;">Connekt</div>
        </div>
        <div style="padding:20px;">
          <div style="font-size:18px;font-weight:800;color:#1E1B39;margin-bottom:10px;">${title}</div>
          <div style="font-size:14px;color:#404040;line-height:1.6;">${message}</div>
          <div style="font-size:12px;color:#737780;margin-top:10px;">Data: ${when}</div>
          ${cta}
        </div>
      </div>
    </div>
  `
}

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      })
    }
    if (req.method !== 'POST') return badRequest('method_not_allowed')

    const cronSecret = String(getEnv('CRON_SECRET', '') || '').trim()
    if (cronSecret) {
      const auth = String(req.headers.get('authorization') || '').trim()
      if (auth !== `Bearer ${cronSecret}`) return unauthorized('invalid authorization')
    }

    const url = String(getEnv('SUPABASE_URL', '') || '').trim()
    const key = String(getEnv('SUPABASE_SERVICE_ROLE_KEY', '') || '').trim()
    const appBaseUrl = String(getEnv('APP_BASE_URL', '') || '').trim().replace(/\/+$/, '')
    if (!url || !key) return json({ ok: false, error: 'missing_supabase_env' }, { status: 500 })

    const supabase = createClient(url, key)
    const nowIso = new Date().toISOString()
    const nowMs = Date.now()
    const weekMs = 7 * 24 * 60 * 60 * 1000

    const selects = [
      'id,user_id,plan_slug,cycle,status,created_at,paid_at,due_at,expires_at,valid_until,period_end,current_period_end,checkout_url,gateway_payment_id,raw_payload',
      'id,user_id,plan_slug,cycle,status,created_at,paid_at,due_at,expires_at,checkout_url,gateway_payment_id,raw_payload',
      'id,user_id,plan_slug,cycle,status,created_at,paid_at,due_at,checkout_url,gateway_payment_id,raw_payload',
      'id,user_id,plan_slug,cycle,status,created_at,paid_at,checkout_url,gateway_payment_id,raw_payload',
    ]
    let payments: any[] = []
    let lastErr: any = null
    for (const sel of selects) {
      const r = await supabase
        .from('payments')
        .select(sel)
        .in('status', ['pending'])
        .in('cycle', ['mensal', 'monthly'])
        .order('created_at', { ascending: false })
        .limit(2000)
      if (!r.error) {
        payments = Array.isArray(r.data) ? r.data : []
        lastErr = null
        break
      }
      lastErr = r.error
      const msg = String(r.error?.message || '').toLowerCase()
      if (!(msg.includes('column') || msg.includes('schema cache') || String(r.error?.code || '').toUpperCase() === 'PGRST204')) break
    }
    if (lastErr) return json({ ok: false, error: 'db_error', message: lastErr.message || String(lastErr) }, { status: 500 })

    const latestByKey = new Map<string, any>()
    for (const p of payments) {
      const uid = String(p?.user_id || '').trim()
      const plan = String(p?.plan_slug || '').trim()
      const cycle = String(p?.cycle || '').trim()
      if (!uid || !plan || !cycle) continue
      const k = `${uid}:${plan}:${cycle}`
      const prev = latestByKey.get(k)
      const prevMs = prev ? (parseIso(prev?.created_at) || 0) : 0
      const curMs = parseIso(p?.created_at) || 0
      if (!prev || curMs > prevMs) latestByKey.set(k, p)
    }

    const entries = Array.from(latestByKey.values())
    const userEmailCache = new Map<string, string>()

    const results: any[] = []
    for (const p of entries) {
      const paymentId = String(p?.id || '').trim()
      const userId = String(p?.user_id || '').trim()
      const planSlug = String(p?.plan_slug || '').trim()
      const cycle = String(p?.cycle || '').trim()
      const createdMs = parseIso(p?.created_at) || 0
      const dueMs = resolveDueMs(p)
      const overdue = dueMs ? dueMs < nowMs : (createdMs > 0 && (nowMs - createdMs) >= weekMs)
      if (!overdue) continue

      const rawPayload = p?.raw_payload
      const meta = rawPayload && typeof rawPayload === 'object' && rawPayload._connekt_meta && typeof rawPayload._connekt_meta === 'object'
        ? rawPayload._connekt_meta
        : {}
      const lastReminderAtMs = parseIso(meta?.last_reminder_at)
      if (lastReminderAtMs && (nowMs - lastReminderAtMs) < weekMs) continue

      const method = (() => {
        const m = String(meta?.last_payment_method || '').trim().toLowerCase()
        if (m === 'card' || m === 'pix' || m === 'boleto') return m as any
        return classifyPaymentMethodFromPayload(rawPayload)
      })()

      let email = userEmailCache.get(userId) || ''
      if (!email) {
        const r = await supabase.auth.admin.getUserById(userId)
        const uEmail = normalizeEmail(r?.data?.user?.email || '')
        if (!uEmail || !isValidEmail(uEmail)) {
          results.push({ ok: false, paymentId, userId, error: 'missing_user_email' })
          continue
        }
        email = uEmail
        userEmailCache.set(userId, email)
      }

      let checkoutUrl = String(p?.checkout_url || '').trim()
      let retryPaymentId: string | null = null
      let createdNewLink = false

      if (method === 'card') {
        try {
          const { data, error } = await supabase.functions.invoke('myg-payments', {
            body: { userId, planSlug, cycle, forceNew: true },
          })
          if (!error && data?.checkout_url) {
            checkoutUrl = String(data.checkout_url)
            retryPaymentId = data?.payment_id ? String(data.payment_id) : null
            createdNewLink = true
          }
        } catch (_) {}
      }

      if (!checkoutUrl) {
        try {
          const { data, error } = await supabase.functions.invoke('myg-payments', {
            body: { userId, planSlug, cycle, forceNew: false },
          })
          if (!error && data?.checkout_url) {
            checkoutUrl = String(data.checkout_url)
            retryPaymentId = data?.payment_id ? String(data.payment_id) : null
          }
        } catch (_) {}
      }

      if (!checkoutUrl && appBaseUrl && paymentId) {
        checkoutUrl = `${appBaseUrl}/planos?payment_id=${encodeURIComponent(paymentId)}`
      }

      const planLabel = planSlug ? planSlug.toUpperCase() : 'Plano'
      const subject = `Pagamento pendente — ${planLabel}`
      const when = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date())
      const message = method === 'card'
        ? `Identificamos um pagamento mensal pendente do seu plano (${planLabel}). Para regularizar, você pode efetuar o pagamento pelo botão abaixo.`
        : `Identificamos um pagamento mensal pendente do seu plano (${planLabel}). Para regularizar, use o botão abaixo para efetuar o pagamento.`
      const html = buildEmailHtml({ title: 'Pagamento pendente', message, when, ctaUrl: checkoutUrl })
      const send = await sendViaSendgrid({ to: email, subject, html })

      const metaPatch: Record<string, any> = {
        last_reminder_at: nowIso,
        last_payment_method: method === 'unknown' ? null : method,
      }
      if (createdNewLink) {
        metaPatch.last_retry_at = nowIso
        metaPatch.retry_count = Number(meta?.retry_count || 0) + 1
      }

      try {
        await supabase
          .from('payments')
          .update({ raw_payload: mergeMeta(rawPayload, metaPatch) })
          .eq('id', paymentId)
      } catch (_) {}

      if (retryPaymentId && createdNewLink) {
        try {
          const { data: retryRow } = await supabase
            .from('payments')
            .select('id,raw_payload')
            .eq('id', retryPaymentId)
            .maybeSingle()
          if (retryRow) {
            await supabase
              .from('payments')
              .update({ raw_payload: mergeMeta(retryRow.raw_payload, metaPatch) })
              .eq('id', retryPaymentId)
          }
        } catch (_) {}
      }

      results.push({
        ok: !!send.ok,
        skipped: !!send.skipped,
        paymentId,
        retryPaymentId,
        userId,
        method,
        email,
        createdNewLink,
        error: send.ok ? null : send.error,
      })
    }

    return json({ ok: true, processed: results.length, results })
  } catch (e) {
    return json({ ok: false, error: 'internal_error', message: (e as Error)?.message || String(e) }, { status: 500 })
  }
})

