function readEnv(name, fallback = '') {
  const v = process.env[name]
  return v ? String(v).trim() : fallback
}

function isValidEmail(value) {
  const v = String(value || '').trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

function normalizeFromEmail(raw) {
  const v = String(raw || '').trim()
  if (isValidEmail(v)) return v
  if (v && !v.includes('@') && v.includes('.')) return 'no-reply@connektco.com'
  return 'no-reply@connektco.com'
}

function json(res, statusCode, payload) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}

async function readJsonBody(req) {
  const chunks = []
  await new Promise((resolve, reject) => {
    req.on('data', (c) => chunks.push(c))
    req.on('end', resolve)
    req.on('error', reject)
  })
  return JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}')
}

function safeOriginFromUrl(url) {
  try {
    return new URL(String(url)).origin
  } catch (_) {
    return ''
  }
}

function supabaseBaseUrl() {
  return readEnv('SUPABASE_URL', readEnv('VITE_SUPABASE_URL', ''))
}

function supabaseServiceRoleKey() {
  return readEnv('SUPABASE_SERVICE_ROLE_KEY', readEnv('SUPABASE_SERVICE_ROLE', ''))
}

async function generateRecoveryLink({ email, redirectTo }) {
  const baseUrl = supabaseBaseUrl()
  const serviceKey = supabaseServiceRoleKey()
  if (!baseUrl || !serviceKey) return { ok: false, error: 'missing_supabase_admin' }

  const url = `${baseUrl.replace(/\/+$/, '')}/auth/v1/admin/generate_link`
  const body = {
    type: 'recovery',
    email,
    options: redirectTo ? { redirectTo } : undefined,
  }

  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify(body),
  })

  const text = await r.text()
  let data = null
  try { data = JSON.parse(text || '{}') } catch (_) { data = null }

  if (!r.ok) return { ok: false, error: 'supabase_generate_link_failed', details: data || text }

  const actionLink =
    data?.action_link ||
    data?.properties?.action_link ||
    data?.data?.properties?.action_link ||
    ''

  return { ok: true, actionLink: String(actionLink || '').trim() }
}

async function sendSendgridEmail({ to, fromEmail, fromName, replyTo, subject, html }) {
  const apiKey = readEnv('SENDGRID_API_KEY')
  if (!apiKey) return { ok: false, error: 'missing_sendgrid_key' }

  const r = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: fromEmail, name: fromName },
      reply_to: replyTo ? { email: replyTo } : undefined,
      subject,
      content: [{ type: 'text/html', value: html }],
    }),
  })

  if (!r.ok) {
    const msg = await r.text().catch(() => '')
    return { ok: false, error: 'sendgrid_send_failed', details: msg }
  }
  return { ok: true }
}

export default async function handler(req, res) {
  try {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Headers', 'content-type')
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
      res.end()
      return
    }

    if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' })

    const fromEmail = normalizeFromEmail(readEnv('SENDGRID_FROM_EMAIL', readEnv('SMTP_FROM_EMAIL')))
    const fromName = readEnv('SENDGRID_FROM_NAME', 'Connekt')
    const replyTo = readEnv('SENDGRID_REPLY_TO', '')
    if (!isValidEmail(fromEmail)) return json(res, 500, { error: 'invalid_from_email', fromEmail: String(fromEmail || '') })

    try {
      const payload = await readJsonBody(req)
      const email = String(payload.email || '').trim().toLowerCase()
      if (!isValidEmail(email)) return json(res, 400, { error: 'invalid_email' })

      const siteUrl = readEnv('SITE_URL', readEnv('VITE_SITE_URL', readEnv('VITE_APP_BASE_URL', '')))
      const defaultRedirectTo = siteUrl ? `${safeOriginFromUrl(siteUrl)}/reset-password` : ''
      const redirectTo = String(payload.redirectTo || defaultRedirectTo || '').trim()

      const link = await generateRecoveryLink({ email, redirectTo })
      if (!link.ok) return json(res, 500, { error: link.error, details: link.details || null })
      if (!link.actionLink) return json(res, 500, { error: 'missing_action_link' })

      const html = `
        <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#22252B">
          <h2 style="margin:0 0 12px">Redefinição de senha</h2>
          <p style="margin:0 0 16px">Clique no botão abaixo para criar uma nova senha.</p>
          <p style="margin:0 0 24px">
            <a href="${link.actionLink}" style="display:inline-block;background:#0047BB;color:#fff;text-decoration:none;padding:12px 16px;border-radius:8px;font-weight:600">Redefinir senha</a>
          </p>
          <p style="margin:0;font-size:12px;color:#6b7280">Se você não solicitou isso, ignore este email.</p>
        </div>
      `

      const sent = await sendSendgridEmail({
        to: email,
        fromEmail,
        fromName,
        replyTo: replyTo && isValidEmail(replyTo) ? replyTo : '',
        subject: 'Redefinir senha - Connekt',
        html,
      })
      if (!sent.ok) return json(res, 500, { error: sent.error, details: sent.details || null })

      return json(res, 200, { ok: true })
    } catch (_) {
      return json(res, 400, { error: 'invalid_json' })
    }
  } catch (e) {
    return json(res, 500, { error: 'internal_error', message: e?.message || String(e) })
  }
}
