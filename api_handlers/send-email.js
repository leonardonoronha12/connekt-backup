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

function supabaseBaseUrl() {
  return readEnv('SUPABASE_URL', readEnv('VITE_SUPABASE_URL', ''))
}

function supabaseApiKey() {
  return (
    readEnv('SUPABASE_SERVICE_ROLE_KEY', '') ||
    readEnv('SUPABASE_SERVICE_ROLE', '') ||
    readEnv('SUPABASE_ANON_KEY', '') ||
    readEnv('VITE_SUPABASE_ANON_KEY', '') ||
    readEnv('VITE_PUBLIC_SUPABASE_ANON_KEY', '') ||
    readEnv('VITE_SUPABASE_KEY', '') ||
    readEnv('VITE_PUBLIC_SUPABASE_KEY', '') ||
    ''
  )
}

function getBearerToken(req) {
  const h = req?.headers || {}
  const raw = h.authorization || h.Authorization || ''
  const token = String(raw || '').startsWith('Bearer ') ? String(raw).slice('Bearer '.length).trim() : ''
  return token || ''
}

async function getUserEmailFromToken(req) {
  const baseUrl = supabaseBaseUrl()
  const apiKey = supabaseApiKey()
  const token = getBearerToken(req)
  if (!token) return { ok: false, error: 'missing_token' }
  if (!baseUrl) return { ok: false, error: 'missing_supabase_url' }
  if (!apiKey) return { ok: false, error: 'missing_supabase_key' }

  const url = `${baseUrl.replace(/\/+$/, '')}/auth/v1/user`
  const r = await fetch(url, {
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${token}`,
    },
  })
  const text = await r.text()
  let data = null
  try { data = JSON.parse(text || '{}') } catch (_) { data = null }
  if (!r.ok) return { ok: false, error: 'invalid_token', details: data || text }
  const email = String(data?.email || '').trim().toLowerCase()
  if (!email) return { ok: false, error: 'missing_email' }
  return { ok: true, email }
}

async function sendSendgridEmail({ to, fromEmail, fromName, replyTo, subject, text, html }) {
  const apiKey = readEnv('SENDGRID_API_KEY')
  if (!apiKey) return { ok: false, error: 'missing_sendgrid_key' }

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
      reply_to: replyTo ? { email: replyTo } : undefined,
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
    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type')
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
      res.end()
      return
    }

    if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' })

    const auth = await getUserEmailFromToken(req)
    if (!auth.ok) {
      const isConfigMissing = auth.error === 'missing_supabase_url' || auth.error === 'missing_supabase_key'
      return json(res, isConfigMissing ? 501 : 401, { error: auth.error, details: auth.details || null })
    }

    const fromEmail = normalizeFromEmail(readEnv('SENDGRID_FROM_EMAIL', readEnv('SMTP_FROM_EMAIL')))
    const fromName = readEnv('SENDGRID_FROM_NAME', 'Connekt')
    const replyTo = readEnv('SENDGRID_REPLY_TO', '')
    if (!isValidEmail(fromEmail)) return json(res, 500, { error: 'invalid_from_email', fromEmail: String(fromEmail || '') })

    try {
      const payload = await readJsonBody(req)
      if (!payload || typeof payload !== 'object') return json(res, 400, { error: 'invalid_json' })

      const to = String(payload.to || '').trim()
      const subject = String(payload.subject || '').trim()
      const text = String(payload.text || '').trim()
      const html = String(payload.html || '').trim()

      if (!isValidEmail(to)) return json(res, 400, { error: 'invalid_to' })
      if (!subject) return json(res, 400, { error: 'missing_subject' })
      if (!text && !html) return json(res, 400, { error: 'missing_body' })

      const allowAnyTo = readEnv('SENDGRID_ALLOW_ANY_TO', 'false') === 'true'
      if (!allowAnyTo && to.toLowerCase() !== auth.email) {
        return json(res, 403, { error: 'to_not_allowed' })
      }

      const sent = await sendSendgridEmail({
        to,
        fromEmail,
        fromName,
        replyTo: replyTo && isValidEmail(replyTo) ? replyTo : '',
        subject,
        text: text || '',
        html: html || '',
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
