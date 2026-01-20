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
    const raw = await r.text().catch(() => '')
    let parsed = null
    try { parsed = JSON.parse(raw || '{}') } catch (_) { parsed = null }
    const details = parsed && typeof parsed === 'object' ? parsed : raw
    return { ok: false, error: 'sendgrid_send_failed', status: r.status, details }
  }
  return { ok: true }
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
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f8fafc;
            line-height: 1.6;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }
        .header {
            background: linear-gradient(135deg, #0047BB 0%, #321A88 100%);
            padding: 40px 20px;
            text-align: center;
            color: white;
        }
        .logo {
            font-size: 36px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .header-subtitle {
            font-size: 18px;
            opacity: 0.9;
        }
        .content {
            padding: 40px 30px;
        }
        .greeting {
            font-size: 24px;
            font-weight: 600;
            color: #1E1B39;
            margin-bottom: 20px;
        }
        .message {
            font-size: 16px;
            color: #404040;
            margin-bottom: 18px;
        }
        .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #34A853 0%, #0F9D58 100%);
            color: white !important;
            padding: 16px 32px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            margin: 20px 0;
            text-align: center;
            box-shadow: 0 4px 12px rgba(52, 168, 83, 0.3);
            transition: all 0.3s ease;
        }
        .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(52, 168, 83, 0.4);
            color: white !important;
        }
        .cta-button:visited {
            color: white !important;
        }
        .cta-button:active {
            color: white !important;
        }
        .security-notice {
            background-color: #E7EDFC;
            border-left: 4px solid #0047BB;
            padding: 20px;
            border-radius: 8px;
            margin: 25px 0;
        }
        .warning {
            background-color: #FEE2E2;
            border: 1px solid #DC2626;
            color: #991B1B;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
            font-size: 14px;
        }
        .footer {
            background-color: #f8fafc;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #e3e4e5;
        }
        .footer-text {
            color: #9291A5;
            font-size: 14px;
            margin-bottom: 10px;
        }
        @media (max-width: 600px) {
            .container {
                margin: 0;
                border-radius: 0;
            }
            .content {
                padding: 30px 20px;
            }
            .header {
                padding: 30px 20px;
            }
        }
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
            
            <p class="message">
                Recebemos uma solicitação para redefinir a senha da sua conta na <strong>Connekt</strong>.
            </p>
            
            <p class="message">
                Para continuar, clique no botão abaixo e você será redirecionado para a tela de redefinição de senha do sistema.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="${safeActionLink}" class="cta-button">
                    ✅ Redefinir minha senha
                </a>
            </div>
            
            <div class="security-notice">
                <p style="margin: 0; font-weight: 600; color: #0047BB;">
                    🛡️ <strong>Informações de Segurança:</strong>
                </p>
                <ul style="margin: 10px 0 0 0; padding-left: 20px; color: #0047BB;">
                    <li>Este link expira por motivos de segurança</li>
                    <li>Você pode usar este link apenas uma vez</li>
                    <li>Não compartilhe este email com ninguém</li>
                </ul>
            </div>
            
            <div class="warning">
                <strong>⚠️ Não foi você?</strong><br>
                Se você não solicitou a redefinição de senha, pode ignorar este email com segurança. Sua senha atual permanecerá inalterada.
            </div>
            
            <p class="message" style="font-size: 14px; color: #404040; margin-top: 24px;">
                Se você não conseguir clicar no botão, copie e cole este link no navegador:
                <br><br>
                <code style="word-break: break-all;">${safeActionLink}</code>
            </p>
        </div>
        
        <div class="footer">
            <p class="footer-text">
                <strong>Connekt - Plataforma de Cursos Online</strong><br>
                Sua segurança é nossa prioridade
            </p>
            
            <p class="footer-text">
                Precisa de ajuda? Entre em contato conosco:<br>
                📧 <a href="mailto:suporte@appconnekt.com.br" style="color: #0047BB;">suporte@appconnekt.com.br</a><br>
                🌐 <a href="https://appconnekt.com.br" style="color: #0047BB;">appconnekt.com.br</a>
            </p>
            
            <p class="footer-text" style="margin-top: 20px;">
                © 2024 Connekt. Todos os direitos reservados.
            </p>
        </div>
    </div>
</body>
</html>`
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
      const siteOrigin = siteUrl ? safeOriginFromUrl(siteUrl) : ''
      const defaultRedirectTo = siteOrigin ? `${siteOrigin}/reset-password` : ''
      const redirectTo = String(defaultRedirectTo || payload.redirectTo || '').trim()

      const link = await generateRecoveryLink({ email, redirectTo })
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
    } catch (_) {
      return json(res, 400, { error: 'invalid_json' })
    }
  } catch (e) {
    return json(res, 500, { error: 'internal_error', message: e?.message || String(e) })
  }
}
