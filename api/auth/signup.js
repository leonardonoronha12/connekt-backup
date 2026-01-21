import fs from 'node:fs'
import path from 'node:path'

function readEnv(name, fallback = '') {
  const v = process.env[name]
  return v ? String(v).trim() : fallback
}

function isValidEmail(value) {
  const v = String(value || '').trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
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

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function safeOriginFromUrl(url) {
  try {
    return new URL(String(url)).origin
  } catch (_) {
    return ''
  }
}

function normalizeFromEmail(raw) {
  const v = String(raw || '').trim()
  if (isValidEmail(v)) return v
  if (v && !v.includes('@') && v.includes('.')) return 'no-reply@connektco.com'
  return 'no-reply@connektco.com'
}

function validatePassword(passwordValue) {
  const p = String(passwordValue || '')
  const minLength = p.length >= 6
  const hasNumber = /\d/.test(p)
  const hasLetter = /[a-zA-Z]/.test(p)
  if (!minLength) return 'A senha deve ter no mínimo 6 caracteres'
  if (!hasNumber) return 'A senha deve conter pelo menos um número'
  if (!hasLetter) return 'A senha deve conter pelo menos uma letra'
  return null
}

function supabaseBaseUrl() {
  return readEnv('SUPABASE_URL', readEnv('VITE_SUPABASE_URL', ''))
}

function supabaseServiceRoleKey() {
  return readEnv('SUPABASE_SERVICE_ROLE_KEY', readEnv('SUPABASE_SERVICE_ROLE', ''))
}

async function supabaseAdminRequest({ url, body }) {
  const baseUrl = supabaseBaseUrl()
  const serviceKey = supabaseServiceRoleKey()
  if (!baseUrl || !serviceKey) return { ok: false, error: 'missing_supabase_admin' }

  const r = await fetch(`${baseUrl.replace(/\/+$/, '')}${url}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify(body || {}),
  })

  const text = await r.text()
  let data = null
  try { data = JSON.parse(text || '{}') } catch (_) { data = null }
  return { ok: r.ok, status: r.status, data: data || text }
}

async function adminCreateUser({ email, password, userMetadata }) {
  const r = await supabaseAdminRequest({
    url: '/auth/v1/admin/users',
    body: {
      email,
      password,
      email_confirm: true,
      user_metadata: userMetadata && typeof userMetadata === 'object' ? userMetadata : undefined,
    },
  })

  if (r.ok) return { ok: true }

  const msg = JSON.stringify(r.data || '').toLowerCase()
  if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
    return { ok: false, error: 'email_already_registered' }
  }

  return { ok: false, error: 'create_user_failed', details: r.data }
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
    const raw = await r.text().catch(() => '')
    let parsed = null
    try { parsed = JSON.parse(raw || '{}') } catch (_) { parsed = null }
    const details = parsed && typeof parsed === 'object' ? parsed : raw
    return { ok: false, error: 'sendgrid_send_failed', status: r.status, details }
  }
  return { ok: true }
}

function loadConfirmationTemplateHtml(confirmationUrl) {
  const templatePath = path.join(process.cwd(), 'supabase', 'templates', 'confirmation.html')
  let html = ''
  try {
    html = fs.readFileSync(templatePath, 'utf8')
  } catch (_) {
    html = ''
  }

  const safeUrl = escapeHtml(confirmationUrl)
  if (html) {
    return html.replace(/\{\{\s*\.ConfirmationURL\s*\}\}/g, safeUrl)
  }

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Confirme seu cadastro - Connekt</title></head><body style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#22252B;background:#f8fafc;margin:0;padding:24px"><div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #E3E4E5;border-radius:12px;padding:24px"><h2 style="margin:0 0 12px">Confirme seu cadastro</h2><p style="margin:0 0 18px">Clique no botão abaixo para confirmar seu email e ativar sua conta na Connekt.</p><p style="margin:0 0 18px"><a href="${safeUrl}" style="display:inline-block;background:#0047BB;color:#fff;text-decoration:none;padding:12px 16px;border-radius:8px;font-weight:600">Confirmar meu email</a></p><p style="margin:0;font-size:12px;color:#6b7280">Se você não se cadastrou, ignore este email.</p></div></body></html>`
}

function loadWelcomeTemplateHtml(loginUrl) {
  const templatePath = path.join(process.cwd(), 'supabase', 'templates', 'welcome.html')
  let html = ''
  try {
    html = fs.readFileSync(templatePath, 'utf8')
  } catch (_) {
    html = ''
  }

  const safeUrl = escapeHtml(loginUrl)
  if (html) {
    return html.replace(/\{\{\s*\.LoginURL\s*\}\}/g, safeUrl)
  }

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Bem-vindo(a) - Connekt</title></head><body style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#22252B;background:#f8fafc;margin:0;padding:24px"><div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #E3E4E5;border-radius:12px;overflow:hidden"><div style="background:#fff;padding:18px 20px;text-align:center;border-bottom:1px solid #E3E4E5"><img src="https://app.connektco.com/logo%20connekt.png" alt="Connekt" style="display:block;margin:0 auto;max-width:180px;width:100%;height:auto" /></div><div style="padding:24px"><h2 style="margin:0 0 12px">Seu cadastro foi criado</h2><p style="margin:0 0 18px">Seja bem-vindo(a) à Connekt. Você já pode acessar sua conta.</p><p style="margin:0 0 18px"><a href="${safeUrl}" style="display:inline-block;background:#0047BB;color:#fff;text-decoration:none;padding:12px 16px;border-radius:8px;font-weight:600">Acessar minha conta</a></p><p style="margin:0;font-size:12px;color:#6b7280">Se você não se cadastrou, ignore este email.</p></div></div></body></html>`
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

    try {
      const payload = await readJsonBody(req)
      const email = String(payload.email || '').trim().toLowerCase()
      const password = String(payload.password || '')
      const userMetadata = payload.user_metadata && typeof payload.user_metadata === 'object' ? payload.user_metadata : null
      if (!isValidEmail(email)) return json(res, 400, { error: 'invalid_email' })
      const pwdErr = validatePassword(password)
      if (pwdErr) return json(res, 400, { error: 'invalid_password', message: pwdErr })

      const siteUrl = readEnv('SITE_URL', readEnv('VITE_SITE_URL', readEnv('VITE_APP_BASE_URL', '')))
      const siteOrigin = safeOriginFromUrl(siteUrl)
      const defaultRedirectTo = siteOrigin ? `${siteOrigin}/login?email_confirmed=true` : ''
      const redirectTo = String(payload.redirectTo || defaultRedirectTo || '').trim()
      const loginUrl = redirectTo || (siteOrigin ? `${siteOrigin}/login` : '')

      const created = await adminCreateUser({ email, password, userMetadata })
      if (!created.ok) {
        if (created.error === 'email_already_registered') return json(res, 409, { error: 'email_already_registered' })
        return json(res, 500, { error: created.error, details: created.details || null })
      }

      const html = loadWelcomeTemplateHtml(loginUrl)
      const sent = await sendSendgridEmail({
        to: email,
        fromEmail,
        fromName,
        replyTo: replyTo && isValidEmail(replyTo) ? replyTo : '',
        subject: 'Bem-vindo(a) à Connekt',
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
