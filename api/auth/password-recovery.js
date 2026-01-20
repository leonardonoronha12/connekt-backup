import sgMail from '@sendgrid/mail'
import { getSupabaseAdmin, json, readRawBody } from '../_supabaseAdmin.js'

function readEnv(name, fallback = '') {
  const v = process.env[name]
  return v ? String(v).trim() : fallback
}

function isValidEmail(value) {
  const v = String(value || '').trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

function safeOriginFromUrl(url) {
  try {
    return new URL(String(url)).origin
  } catch (_) {
    return ''
  }
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

    const admin = getSupabaseAdmin()
    if (!admin) return json(res, 500, { error: 'missing_supabase_admin' })

    const apiKey = readEnv('SENDGRID_API_KEY')
    const fromEmail = readEnv('SENDGRID_FROM_EMAIL', readEnv('SMTP_FROM_EMAIL'))
    const fromName = readEnv('SENDGRID_FROM_NAME', 'Connekt')
    const replyTo = readEnv('SENDGRID_REPLY_TO', '')

    if (!apiKey) return json(res, 500, { error: 'missing_sendgrid_key' })
    if (!isValidEmail(fromEmail)) return json(res, 500, { error: 'invalid_from_email' })

    let payload = null
    try {
      const raw = await readRawBody(req)
      payload = JSON.parse(raw.toString('utf-8') || '{}')
    } catch (_) {
      payload = null
    }
    if (!payload || typeof payload !== 'object') return json(res, 400, { error: 'invalid_json' })

    const email = String(payload.email || '').trim().toLowerCase()
    if (!isValidEmail(email)) return json(res, 400, { error: 'invalid_email' })

    const siteUrl = readEnv('SITE_URL', readEnv('VITE_SITE_URL', readEnv('VITE_APP_BASE_URL', '')))
    const defaultRedirectTo = siteUrl ? `${safeOriginFromUrl(siteUrl)}/reset-password` : ''
    const redirectTo = String(payload.redirectTo || defaultRedirectTo || '').trim()

    const { data, error } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: redirectTo ? { redirectTo } : undefined,
    })

    if (!error && data?.properties?.action_link) {
      sgMail.setApiKey(apiKey)
      await sgMail.send({
        to: email,
        from: { email: fromEmail, name: fromName },
        replyTo: replyTo && isValidEmail(replyTo) ? replyTo : undefined,
        subject: 'Redefinir senha - Connekt',
        html: `
          <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#22252B">
            <h2 style="margin:0 0 12px">Redefinição de senha</h2>
            <p style="margin:0 0 16px">Clique no botão abaixo para criar uma nova senha.</p>
            <p style="margin:0 0 24px">
              <a href="${data.properties.action_link}" style="display:inline-block;background:#0047BB;color:#fff;text-decoration:none;padding:12px 16px;border-radius:8px;font-weight:600">Redefinir senha</a>
            </p>
            <p style="margin:0;font-size:12px;color:#6b7280">Se você não solicitou isso, ignore este email.</p>
          </div>
        `,
      })
    }

    return json(res, 200, { ok: true })
  } catch (e) {
    return json(res, 500, { error: 'internal_error', message: e?.message || String(e) })
  }
}
