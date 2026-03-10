import { json } from '../../../src/server/supabaseAdmin.js'
import { isValidEmail, readEnv, requireAdmin } from '../_util.js'

function normalizeFromEmail(raw) {
  const v = String(raw || '').trim()
  if (isValidEmail(v)) return v
  if (v && !v.includes('@') && v.includes('.')) return 'no-reply@connektco.com'
  return 'no-reply@connektco.com'
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
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

function buildFirstAccessEmail({ toEmail, link }) {
  const safeLink = escapeHtml(link)
  const safeEmail = escapeHtml(toEmail)
  const subject = 'Connekt • Defina sua senha de acesso'
  const text =
    `Olá!\n\n` +
    `Seu acesso à Connekt foi liberado.\n\n` +
    `Para definir sua senha e entrar, use o link abaixo:\n\n` +
    `${link}\n\n` +
    `Se você não solicitou esse acesso, ignore este email.\n\n` +
    `Connekt`

  const html = `
  <div style="margin:0;padding:0;background:#F8FAFC;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F8FAFC;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="width:560px;max-width:560px;background:#FFFFFF;border:1px solid #E3E4E5;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="background:linear-gradient(135deg,#0047BB 0%,#321A88 100%);padding:22px 20px;">
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:800;color:#FFFFFF;letter-spacing:.2px;">Connekt</div>
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#E7EDFC;margin-top:6px;">Acesso liberado • Definir senha</div>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 20px;">
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:800;color:#1E1B39;margin-bottom:10px;">Olá!</div>
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#404040;line-height:1.7;">
                  Seu acesso à <strong>Connekt</strong> foi liberado. Para definir sua senha e entrar na plataforma, clique no botão abaixo.
                </div>
                <div style="text-align:center;margin:18px 0 10px 0;">
                  <a href="${safeLink}" style="display:inline-block;background:#0047BB;color:#FFFFFF !important;text-decoration:none;border-radius:10px;padding:12px 18px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;">
                    Definir senha
                  </a>
                </div>
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#737780;line-height:1.6;margin-top:12px;">
                  Se o botão não funcionar, copie e cole este link no navegador:
                  <div style="word-break:break-all;margin-top:6px;color:#0047BB;">${safeLink}</div>
                </div>
                <div style="margin-top:16px;padding:12px 14px;border:1px solid #FCA5A5;background:#FEF2F2;border-radius:10px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#991B1B;line-height:1.6;">
                  Se você não solicitou esse acesso, ignore este email.
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 20px;border-top:1px solid #E3E4E5;background:#F8FAFC;">
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#8F9299;line-height:1.6;">
                  Este email foi enviado para ${safeEmail}.<br />
                  Precisa de ajuda? Fale com a gente em <a href="mailto:suporte@appconnekt.com.br" style="color:#0047BB;text-decoration:none;">suporte@appconnekt.com.br</a>.
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
  `.trim()

  return { subject, text, html }
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
      const payload = buildFirstAccessEmail({ toEmail: email, link })
      const sent = await sendSendgridEmail({ to: email, subject: payload.subject, text: payload.text, html: payload.html })
      if (!sent.ok) return json(res, 500, { error: sent.error, details: sent.details || null })
      emailed = true
    }

    return json(res, 200, { ok: true, firstAccessLink: link, emailed })
  } catch (e) {
    return json(res, 500, { error: 'internal_error', message: e?.message || String(e) })
  }
}
