import { json } from '../../../src/server/supabaseAdmin.js'
import { isValidEmail, readEnv, requireAdmin } from '../_util.js'

function normalizeFromEmail(raw) {
  const v = String(raw || '').trim()
  if (isValidEmail(v)) return v
  if (v && !v.includes('@') && v.includes('.')) return 'no-reply@connektco.com'
  return 'no-reply@connektco.com'
}

async function generateRecoveryLink(email) {
  const baseUrl = readEnv('SUPABASE_URL', readEnv('VITE_SUPABASE_URL', ''))
  const serviceKey = readEnv('SUPABASE_SERVICE_ROLE_KEY', readEnv('SUPABASE_SERVICE_ROLE', ''))
  if (!baseUrl || !serviceKey) return ''
  const redirectTo = String(readEnv('PUBLIC_APP_URL', 'https://app.connektco.com')).replace(/\/+$/, '') + '/reset-password'
  const url = `${baseUrl.replace(/\/+$/, '')}/auth/v1/admin/generate_link`
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      type: 'recovery',
      email: String(email || '').trim(),
      options: { redirect_to: redirectTo },
    }),
  })
  const text = await r.text()
  let data = null
  try { data = JSON.parse(text || '{}') } catch (_) { data = null }
  if (!r.ok) return ''
  const actionLink =
    data?.action_link ||
    data?.properties?.action_link ||
    data?.data?.properties?.action_link ||
    ''
  return String(actionLink || '').trim()
}

async function sendSendgridEmail({ to, subject, text, html }) {
  const apiKey = readEnv('SENDGRID_API_KEY', '')
  if (!apiKey) return { ok: false, error: 'missing_sendgrid_key' }

  const fromEmail = normalizeFromEmail(readEnv('SENDGRID_FROM_EMAIL', readEnv('SMTP_FROM_EMAIL', '')))
  const fromName = readEnv('SENDGRID_FROM_NAME', 'Connekt')
  const replyTo = readEnv('SENDGRID_REPLY_TO', '')
  if (!isValidEmail(fromEmail)) return { ok: false, error: 'invalid_from_email', details: fromEmail }

  const content = []
  if (text) content.push({ type: 'text/plain', value: text })
  if (html) content.push({ type: 'text/html', value: html })
  if (!content.length) return { ok: false, error: 'missing_body' }

  const r = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: fromEmail, name: fromName },
      reply_to: replyTo && isValidEmail(replyTo) ? { email: replyTo } : undefined,
      subject,
      content,
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
    if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' })
    const auth = await requireAdmin(req, res)
    if (!auth.ok) return
    const { admin } = auth
    const sp = new URL(req.url, 'http://localhost').searchParams
    const userId = String(sp.get('user_id') || '').trim()
    const send = sp.get('send') === '1'
    if (!userId) return json(res, 400, { error: 'missing_user_id' })
    const rUser = await admin.auth.admin.getUserById(userId)
    const email = String(rUser?.data?.user?.email || '').trim()
    if (!isValidEmail(email)) return json(res, 400, { error: 'invalid_email' })
    const link = await generateRecoveryLink(email)
    if (!link) return json(res, 500, { error: 'link_failed' })

    let emailed = false
    if (send) {
      const subject = 'Acesso Connekt - Definir senha'
      const text = `Olá!\n\nPara acessar sua conta na Connekt, defina sua senha usando o link abaixo:\n\n${link}\n\nSe você não solicitou esse acesso, ignore este e-mail.`
      const html = `<p>Olá!</p><p>Para acessar sua conta na Connekt, defina sua senha usando o link abaixo:</p><p><a href="${link}">${link}</a></p><p>Se você não solicitou esse acesso, ignore este e-mail.</p>`
      const sent = await sendSendgridEmail({ to: email, subject, text, html })
      if (!sent.ok) return json(res, 500, { error: sent.error, details: sent.details || null })
      emailed = true
    }

    return json(res, 200, { ok: true, firstAccessLink: link, emailed })
  } catch (e) {
    return json(res, 500, { error: 'internal_error', message: e?.message || String(e) })
  }
}
