import sgMail from '@sendgrid/mail'
import { getAuthedUser, getSupabaseAdmin, json, readRawBody } from './_supabaseAdmin.js'

function readEnv(name, fallback = '') {
  const v = process.env[name]
  return v ? String(v).trim() : fallback
}

function isValidEmail(value) {
  const v = String(value || '').trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.end()
    return
  }

  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' })

  const admin = getSupabaseAdmin()
  if (!admin) return json(res, 500, { error: 'missing_supabase_admin' })

  const { user, error: authError } = await getAuthedUser(admin, req)
  if (!user) return json(res, 401, { error: authError || 'unauthorized' })

  const apiKey = readEnv('SENDGRID_API_KEY')
  if (!apiKey) return json(res, 500, { error: 'missing_sendgrid_key' })

  const fromEmail = readEnv('SENDGRID_FROM_EMAIL', readEnv('SMTP_FROM_EMAIL'))
  const fromName = readEnv('SENDGRID_FROM_NAME', 'Connekt')
  const replyTo = readEnv('SENDGRID_REPLY_TO', '')
  if (!isValidEmail(fromEmail)) return json(res, 500, { error: 'invalid_from_email' })

  let payload = null
  try {
    const raw = await readRawBody(req)
    payload = JSON.parse(raw.toString('utf-8') || '{}')
  } catch (_) {
    payload = null
  }
  if (!payload || typeof payload !== 'object') return json(res, 400, { error: 'invalid_json' })

  const to = String(payload.to || '').trim()
  const subject = String(payload.subject || '').trim()
  const text = String(payload.text || '').trim()
  const html = String(payload.html || '').trim()

  if (!isValidEmail(to)) return json(res, 400, { error: 'invalid_to' })
  if (!subject) return json(res, 400, { error: 'missing_subject' })
  if (!text && !html) return json(res, 400, { error: 'missing_body' })

  const allowAnyTo = readEnv('SENDGRID_ALLOW_ANY_TO', 'false') === 'true'
  const userEmail = String(user.email || '').trim().toLowerCase()
  if (!allowAnyTo && userEmail && to.toLowerCase() !== userEmail) {
    return json(res, 403, { error: 'to_not_allowed' })
  }

  sgMail.setApiKey(apiKey)

  try {
    await sgMail.send({
      to,
      from: { email: fromEmail, name: fromName },
      replyTo: replyTo && isValidEmail(replyTo) ? replyTo : undefined,
      subject,
      text: text || undefined,
      html: html || undefined,
    })
    return json(res, 200, { ok: true })
  } catch (e) {
    return json(res, 500, { error: 'send_failed', message: e?.message || String(e) })
  }
}

