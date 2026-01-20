function readEnv(name, fallback = '') {
  const v = process.env[name]
  return v ? String(v).trim() : fallback
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.statusCode = 405
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end('method_not_allowed')
      return
    }

    const supabaseUrl = readEnv('VITE_SUPABASE_URL', readEnv('SUPABASE_URL', ''))
    const supabaseAnonKey = readEnv('VITE_SUPABASE_ANON_KEY', readEnv('SUPABASE_ANON_KEY', ''))
    const siteUrl = readEnv('SITE_URL', readEnv('VITE_SITE_URL', readEnv('VITE_APP_BASE_URL', '')))
    const siteOrigin = (() => {
      try { return new URL(siteUrl).origin } catch (_) { return '' }
    })()

    const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Connekt - Redefinir Senha</title>
    <meta name="robots" content="noindex,nofollow" />
    <style>
      body{font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;margin:0;padding:0;background:#f8fafc;color:#22252B}
      .wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
      .card{width:100%;max-width:520px;background:#fff;border:1px solid #E3E4E5;border-radius:16px;box-shadow:0 8px 24px rgba(0,0,0,.06);padding:24px}
      h1{margin:0 0 8px;font-size:22px}
      p{margin:0 0 16px;color:#6B7280;font-size:14px;line-height:1.5}
      label{display:block;font-size:12px;font-weight:600;color:#374151;margin:12px 0 6px}
      input{width:100%;height:44px;border:1px solid #E3E4E5;border-radius:10px;padding:0 12px;font-size:14px;outline:none}
      input:focus{border-color:#0047BB;box-shadow:0 0 0 3px rgba(0,71,187,.15)}
      button{margin-top:16px;width:100%;height:44px;border:0;border-radius:10px;background:#0047BB;color:#fff;font-weight:700;font-size:14px;cursor:pointer}
      button[disabled]{opacity:.6;cursor:not-allowed}
      .msg{margin-top:14px;border-radius:10px;padding:12px 12px;font-size:13px}
      .msg.error{background:#FEF2F2;border:1px solid #FECACA;color:#B91C1C}
      .msg.success{background:#ECFDF5;border:1px solid #A7F3D0;color:#065F46}
      .link{display:inline-block;margin-top:12px;color:#0047BB;text-decoration:underline;font-size:13px}
      .small{margin-top:14px;color:#9CA3AF;font-size:12px}
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <h1>Redefinir senha</h1>
        <p>Defina uma nova senha para sua conta.</p>

        <form id="form">
          <label for="password">Nova senha</label>
          <input id="password" type="password" autocomplete="new-password" placeholder="Mínimo 6 caracteres" />

          <label for="confirm">Confirmar nova senha</label>
          <input id="confirm" type="password" autocomplete="new-password" placeholder="Repita a senha" />

          <button id="submit" type="submit">Salvar nova senha</button>
        </form>

        <div id="message" class="msg" style="display:none"></div>
        <a id="back" class="link" href="${escapeHtml(siteOrigin || '/')}/login">Voltar para o login</a>
        <div class="small">Se você abriu um link antigo, solicite um novo em “Esqueci minha senha”.</div>
      </div>
    </div>

    <script>
      window.__CONNEKT__ = {
        supabaseUrl: ${JSON.stringify(String(supabaseUrl || ''))},
        supabaseAnonKey: ${JSON.stringify(String(supabaseAnonKey || ''))},
        siteOrigin: ${JSON.stringify(String(siteOrigin || ''))}
      };
    </script>
    <script src="/api/reset-password-client.js" defer></script>
  </body>
</html>`

    res.statusCode = 200
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    if (req.method === 'HEAD') {
      res.end()
      return
    }
    res.end(html)
  } catch (e) {
    res.statusCode = 500
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.end('internal_error')
  }
}

