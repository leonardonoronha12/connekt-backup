import fs from 'node:fs'
import path from 'node:path'
import { getSupabaseAdmin, isUuid } from '../../src/server/supabaseAdmin.js'

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

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function normalizeHost(raw) {
  const v = String(raw || '').trim().toLowerCase()
  if (!v) return ''
  return v.split(':')[0]
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

async function generateSupabaseLink({ type, email, password, redirectTo }) {
  const baseUrl = supabaseBaseUrl()
  const serviceKey = supabaseServiceRoleKey()
  if (!baseUrl || !serviceKey) return { ok: false, error: 'missing_supabase_admin' }

  const url = `${baseUrl.replace(/\/+$/, '')}/auth/v1/admin/generate_link`
  const body = {
    type,
    email,
    ...(type === 'signup' ? { password } : {}),
    options: redirectTo ? { redirect_to: redirectTo } : undefined,
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

function loadWelcomeTemplateHtml(loginUrl) {
  const templatePath = path.join(process.cwd(), 'supabase', 'templates', 'welcome.html')
  let html = ''
  try { html = fs.readFileSync(templatePath, 'utf8') } catch (_) { html = '' }
  const safeUrl = escapeHtml(loginUrl)
  if (html) return html.replace(/\{\{\s*\.LoginURL\s*\}\}/g, safeUrl)
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Bem-vindo(a) - Connekt</title></head><body style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#22252B;background:#f8fafc;margin:0;padding:24px"><div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #E3E4E5;border-radius:12px;overflow:hidden"><div style="background:#fff;padding:18px 20px;text-align:center;border-bottom:1px solid #E3E4E5"><img src="https://app.connektco.com/logo%20connekt.png" alt="Connekt" style="display:block;margin:0 auto;max-width:180px;width:100%;height:auto" /></div><div style="padding:24px"><h2 style="margin:0 0 12px">Seu cadastro foi criado</h2><p style="margin:0 0 18px">Seja bem-vindo(a) à Connekt. Você já pode acessar sua conta.</p><p style="margin:0 0 18px"><a href="${safeUrl}" style="display:inline-block;background:#0047BB;color:#fff;text-decoration:none;padding:12px 16px;border-radius:8px;font-weight:600">Acessar minha conta</a></p><p style="margin:0;font-size:12px;color:#6b7280">Se você não se cadastrou, ignore este email.</p></div></div></body></html>`
}

function buildRecoveryEmailHtml({ actionLink }) {
  const safeActionLink = escapeHtml(actionLink)
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Redefinir senha - Connekt</title>
    <style>
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; line-height: 1.6; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #0047BB 0%, #321A88 100%); padding: 40px 20px; text-align: center; color: white; }
        .logo { font-size: 36px; font-weight: bold; margin-bottom: 10px; }
        .header-subtitle { font-size: 18px; opacity: 0.9; }
        .content { padding: 40px 30px; }
        .greeting { font-size: 24px; font-weight: 600; color: #1E1B39; margin-bottom: 20px; }
        .message { font-size: 16px; color: #404040; margin-bottom: 18px; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #34A853 0%, #0F9D58 100%); color: white !important; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 20px 0; text-align: center; box-shadow: 0 4px 12px rgba(52, 168, 83, 0.3); transition: all 0.3s ease; }
        .cta-button:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(52, 168, 83, 0.4); color: white !important; }
        .cta-button:visited { color: white !important; }
        .cta-button:active { color: white !important; }
        .security-notice { background-color: #E7EDFC; border-left: 4px solid #0047BB; padding: 20px; border-radius: 8px; margin: 25px 0; }
        .warning { background-color: #FEE2E2; border: 1px solid #DC2626; color: #991B1B; padding: 15px; border-radius: 8px; margin: 20px 0; font-size: 14px; }
        .footer { background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e3e4e5; }
        .footer-text { color: #9291A5; font-size: 14px; margin-bottom: 10px; }
        @media (max-width: 600px) { .container { margin: 0; border-radius: 0; } .content { padding: 30px 20px; } .header { padding: 30px 20px; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🎓 Connekt</div>
            <div class="header-subtitle">🔐 Redefinição de Senha</div>
        </div>
        <div class="content">
            <h1 class="greeting">Redefina sua senha 🔑</h1>
            <p class="message">Recebemos uma solicitação para redefinir a senha da sua conta na <strong>Connekt</strong>.</p>
            <p class="message">Para continuar, clique no botão abaixo e você será redirecionado para a tela de redefinição de senha do sistema.</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${safeActionLink}" class="cta-button">✅ Redefinir minha senha</a>
            </div>
            <div class="security-notice">
                <p style="margin: 0; font-weight: 600; color: #0047BB;">🛡️ <strong>Informações de Segurança:</strong></p>
                <ul style="margin: 10px 0 0 0; padding-left: 20px; color: #0047BB;">
                    <li>Este link expira por motivos de segurança</li>
                    <li>Você pode usar este link apenas uma vez</li>
                    <li>Não compartilhe este email com ninguém</li>
                </ul>
            </div>
            <div class="warning"><strong>⚠️ Não foi você?</strong><br>Se você não solicitou a redefinição de senha, pode ignorar este email com segurança. Sua senha atual permanecerá inalterada.</div>
            <p class="message" style="font-size: 14px; color: #404040; margin-top: 24px;">Se você não conseguir clicar no botão, copie e cole este link no navegador:<br><br><code style="word-break: break-all;">${safeActionLink}</code></p>
        </div>
        <div class="footer">
            <p class="footer-text"><strong>Connekt - Plataforma de Cursos Online</strong><br>Sua segurança é nossa prioridade</p>
            <p class="footer-text">Precisa de ajuda? Entre em contato conosco:<br>📧 <a href="mailto:suporte@appconnekt.com.br" style="color: #0047BB;">suporte@appconnekt.com.br</a><br>🌐 <a href="https://appconnekt.com.br" style="color: #0047BB;">appconnekt.com.br</a></p>
            <p class="footer-text" style="margin-top: 20px;">© 2024 Connekt. Todos os direitos reservados.</p>
        </div>
    </div>
</body>
</html>`
}

async function handleSignup(req, res) {
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

  const payload = await readJsonBody(req)
  const email = String(payload.email || '').trim().toLowerCase()
  const password = String(payload.password || '')
  const userMetadata = payload.user_metadata && typeof payload.user_metadata === 'object' ? payload.user_metadata : null
  const producerUidHint = String(payload.producer_uid || payload.producerUid || '').trim()
  const wlHostHint = normalizeHost(payload.wl_host || payload.wlHost || '')
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

  const requestHost = normalizeHost(req?.headers?.host || req?.headers?.Host || '')
  const hostForWl = wlHostHint || requestHost
  const shouldTryWhitelabel = hostForWl && hostForWl !== 'app.connektco.com'
  if (shouldTryWhitelabel) {
    try {
      const admin = getSupabaseAdmin()
      if (admin) {
        const resolveProducerId = async () => {
          if (producerUidHint && isUuid(producerUidHint)) return producerUidHint
          const host = normalizeHost(hostForWl)
          if (!host) return ''
          const urls = [`https://${host}`, `https://${host}/`, `http://${host}`, `http://${host}/`]
          const { data } = await admin.from('profiles').select('id, member_area_url').in('member_area_url', urls).limit(1)
          return data?.[0]?.id ? String(data[0].id) : ''
        }
        const producerId = await resolveProducerId()
        if (producerId && isUuid(producerId)) {
          const { data } = await admin.auth.admin.getUserById(producerId)
          const wl = data?.user?.user_metadata?.whitelabel || null
          const wlSubject = String(wl?.welcomeEmailSubject || wl?.welcome_email_subject || wl?.welcomeSubject || '').trim()
          const wlMessage = String(wl?.welcomeEmailMessage || wl?.welcome_email_message || wl?.welcomeMessage || '').trim()
          if (wlSubject && wlMessage) {
            const displayName =
              String(userMetadata?.full_name || userMetadata?.name || userMetadata?.first_name || '').trim() ||
              String(email.split('@')[0] || '').trim()
            const replaced = wlMessage
              .replaceAll('{nome}', displayName)
              .replaceAll('{name}', displayName)
            const safeMsgHtml = escapeHtml(replaced).replace(/\n/g, '<br/>')
            const brandName = String(wl?.name || wl?.brandName || fromName || 'Connekt').trim() || 'Connekt'
            const wlLoginUrl = `https://${normalizeHost(hostForWl)}/login-aluno-wl`
            const wlHtml = `<!doctype html><html><body style="margin:0;font-family:Arial,sans-serif;background:#f6f7fb;padding:24px;">
<div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
<div style="padding:18px 20px;background:#0f172a;color:#ffffff;font-size:18px;font-weight:700;">${escapeHtml(brandName)}</div>
<div style="padding:20px;color:#111827;font-size:14px;line-height:1.6;">${safeMsgHtml}</div>
<div style="padding:0 20px 20px 20px;">
<a href="${escapeHtml(wlLoginUrl)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:10px 14px;border-radius:8px;font-size:14px;font-weight:600;">Acessar plataforma</a>
</div>
</div></body></html>`
            await sendSendgridEmail({
              to: email,
              fromEmail,
              fromName: brandName,
              replyTo: replyTo && isValidEmail(replyTo) ? replyTo : '',
              subject: wlSubject,
              html: wlHtml,
            })
          }
        }
      }
    } catch (_) {}
  }

  return json(res, 200, { ok: true })
}

async function handlePasswordRecovery(req, res) {
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
  if (!isValidEmail(fromEmail)) return json(res, 500, { error: 'invalid_from_email' })

  const payload = await readJsonBody(req)
  const email = String(payload.email || '').trim().toLowerCase()
  if (!isValidEmail(email)) return json(res, 400, { error: 'invalid_email' })

  const siteUrl = readEnv('SITE_URL', readEnv('VITE_SITE_URL', readEnv('VITE_APP_BASE_URL', '')))
  const siteOrigin = siteUrl ? safeOriginFromUrl(siteUrl) : ''
  const defaultRedirectTo = siteOrigin ? `${siteOrigin}/reset-password` : ''
  const redirectTo = String(defaultRedirectTo || payload.redirectTo || '').trim()

  const link = await generateSupabaseLink({ type: 'recovery', email, redirectTo })
  if (!link.ok) return json(res, 500, { error: link.error, details: link.details || null })
  if (!link.actionLink) return json(res, 500, { error: 'missing_action_link' })

  const html = buildRecoveryEmailHtml({ actionLink: link.actionLink })
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
}

export default async function handler(req, res) {
  try {
    const action = (() => {
      const q = req?.query || {}
      const fromQuery = q?.action
      if (typeof fromQuery === 'string' && fromQuery.trim()) return fromQuery.trim().toLowerCase()
      try {
        const u = new URL(req.url, 'http://localhost')
        const parts = String(u.pathname || '').split('/').filter(Boolean)
        const last = parts[parts.length - 1] || ''
        return String(last || '').trim().toLowerCase()
      } catch (_) {
        return ''
      }
    })()

    if (action === 'signup') return await handleSignup(req, res)
    if (action === 'password-recovery') return await handlePasswordRecovery(req, res)
    if (action === 'confirmation-email') return json(res, 410, { error: 'gone' })
    return json(res, 404, { error: 'not_found' })
  } catch (e) {
    return json(res, 500, { error: 'internal_error', message: e?.message || String(e) })
  }
}
