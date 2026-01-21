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
      .ok{display:flex;gap:12px;align-items:center;justify-content:center}
      .ok svg{flex:0 0 auto}
      .ok .t{display:flex;flex-direction:column;gap:2px}
      .ok .t strong{font-weight:700}
      .ok .t span{opacity:.85}
      @keyframes connekt-check-draw{from{stroke-dashoffset:60}to{stroke-dashoffset:0}}
      @keyframes connekt-pop{0%{transform:scale(.92);opacity:0}100%{transform:scale(1);opacity:1}}
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
    <script>
      function qs(id) {
        return document.getElementById(id)
      }
      
      function setMessage(kind, text) {
        const el = qs('message')
        if (!el) return
        el.style.display = 'block'
        el.className = 'msg ' + String(kind || 'error')
        el.textContent = String(text || '')
      }
      
      function clearMessage() {
        const el = qs('message')
        if (!el) return
        el.style.display = 'none'
        el.className = 'msg'
        el.textContent = ''
      }
      
      function parseParams(value) {
        try {
          const raw = String(value || '')
          const trimmed = raw.startsWith('#') ? raw.slice(1) : raw.startsWith('?') ? raw.slice(1) : raw
          return new URLSearchParams(trimmed)
        } catch (_) {
          return new URLSearchParams()
        }
      }
      
      function readRecoveryTokens() {
        const hashParams = parseParams(window.location.hash || '')
        const searchParams = parseParams(window.location.search || '')
      
        const error = hashParams.get('error') || searchParams.get('error') || ''
        const errorCode = hashParams.get('error_code') || searchParams.get('error_code') || ''
        const errorDescription = hashParams.get('error_description') || searchParams.get('error_description') || ''
        if (error || errorCode || errorDescription) {
          return { error: errorDescription || errorCode || error || 'Link inválido ou expirado' }
        }
      
        const accessToken = hashParams.get('access_token') || searchParams.get('access_token') || ''
        const refreshToken = hashParams.get('refresh_token') || searchParams.get('refresh_token') || ''
        const type = hashParams.get('type') || searchParams.get('type') || ''
      
        return {
          accessToken: String(accessToken || '').trim(),
          refreshToken: String(refreshToken || '').trim(),
          type: String(type || '').trim(),
        }
      }
      
      async function refreshSession(opts) {
        const supabaseUrl = String(opts?.supabaseUrl || '')
        const supabaseAnonKey = String(opts?.supabaseAnonKey || '')
        const refreshToken = String(opts?.refreshToken || '')
        const url = supabaseUrl.replace(/\\/+$/, '') + '/auth/v1/token?grant_type=refresh_token'
        const r = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: supabaseAnonKey,
          },
          body: JSON.stringify({ refresh_token: refreshToken }),
        })
        const text = await r.text()
        let data = null
        try { data = JSON.parse(text || '{}') } catch (_) { data = null }
        if (!r.ok) {
          const msg = (data && (data.msg || data.error_description || data.error)) ? (data.msg || data.error_description || data.error) : text || 'Falha ao autenticar link.'
          return { ok: false, error: msg }
        }
        return { ok: true, accessToken: String(data?.access_token || ''), refreshToken: String(data?.refresh_token || refreshToken) }
      }
      
      async function updatePassword(opts) {
        const supabaseUrl = String(opts?.supabaseUrl || '')
        const supabaseAnonKey = String(opts?.supabaseAnonKey || '')
        const accessToken = String(opts?.accessToken || '')
        const password = String(opts?.password || '')
        const url = supabaseUrl.replace(/\\/+$/, '') + '/auth/v1/user'
        const r = await fetch(url, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            apikey: supabaseAnonKey,
            Authorization: 'Bearer ' + accessToken,
          },
          body: JSON.stringify({ password: password }),
        })
        const text = await r.text()
        let data = null
        try { data = JSON.parse(text || '{}') } catch (_) { data = null }
        if (!r.ok) {
          const msg = (data && (data.msg || data.error_description || data.error)) ? (data.msg || data.error_description || data.error) : text || 'Erro ao redefinir senha.'
          return { ok: false, error: msg }
        }
        return { ok: true }
      }
      
      async function main() {
        const cfg = window.__CONNEKT__ || {}
        const supabaseUrl = String(cfg.supabaseUrl || '')
        const supabaseAnonKey = String(cfg.supabaseAnonKey || '')
        const siteOrigin = String(cfg.siteOrigin || '')
        if (!supabaseUrl || !supabaseAnonKey) {
          setMessage('error', 'Configuração do Supabase ausente. Contate o suporte.')
          return
        }
      
        const tokens = readRecoveryTokens()
        if (tokens.error) {
          setMessage('error', tokens.error)
          return
        }
      
        try {
          if (tokens.refreshToken) sessionStorage.setItem('connekt_recovery_refresh_token', tokens.refreshToken)
          if (tokens.accessToken) sessionStorage.setItem('connekt_recovery_access_token', tokens.accessToken)
        } catch (_) {}
      
        const form = qs('form')
        const submit = qs('submit')
        const passwordEl = qs('password')
        const confirmEl = qs('confirm')
        if (!form || !submit || !passwordEl || !confirmEl) return
      
        form.addEventListener('submit', async (e) => {
          e.preventDefault()
          clearMessage()
      
          const password = String(passwordEl.value || '')
          const confirm = String(confirmEl.value || '')
          if (password.length < 6) {
            setMessage('error', 'A senha deve ter no mínimo 6 caracteres.')
            return
          }
          if (password !== confirm) {
            setMessage('error', 'As senhas não coincidem.')
            return
          }
      
          submit.disabled = true
          submit.textContent = 'Salvando...'
      
          try {
            let accessToken = ''
            let refreshToken = ''
            try {
              accessToken = sessionStorage.getItem('connekt_recovery_access_token') || ''
              refreshToken = sessionStorage.getItem('connekt_recovery_refresh_token') || ''
            } catch (_) {}
      
            if (!accessToken && refreshToken) {
              const rr = await refreshSession({ supabaseUrl: supabaseUrl, supabaseAnonKey: supabaseAnonKey, refreshToken: refreshToken })
              if (!rr.ok) {
                setMessage('error', rr.error || 'Link inválido ou expirado.')
                return
              }
              accessToken = rr.accessToken
              refreshToken = rr.refreshToken
              try {
                sessionStorage.setItem('connekt_recovery_access_token', accessToken)
                sessionStorage.setItem('connekt_recovery_refresh_token', refreshToken)
              } catch (_) {}
            }
      
            if (!accessToken) {
              setMessage('error', 'Abra o link enviado no seu e-mail para continuar.')
              return
            }
      
            const up = await updatePassword({ supabaseUrl: supabaseUrl, supabaseAnonKey: supabaseAnonKey, accessToken: accessToken, password: password })
            if (!up.ok) {
              setMessage('error', up.error || 'Erro ao redefinir senha.')
              return
            }

            let countdown = 10
            const msgEl = qs('message')
            if (msgEl) {
              msgEl.style.display = 'block'
              msgEl.className = 'msg success'
              msgEl.style.animation = 'connekt-pop 260ms ease-out both'
              msgEl.innerHTML = '<div class="ok">' +
                '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
                  '<circle cx="12" cy="12" r="10" stroke="#16A34A" stroke-width="2" opacity="0.25" />' +
                  '<path d="M7 12.5l3 3 7-7" stroke="#16A34A" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="stroke-dasharray:60;stroke-dashoffset:60;animation:connekt-check-draw 520ms ease-out 120ms forwards" />' +
                '</svg>' +
                '<div class="t">' +
                  '<strong>Senha alterada com sucesso.</strong>' +
                  '<span id="redir">Redirecionando para o login em 10s…</span>' +
                '</div>' +
              '</div>'
            }

            submit.textContent = 'Senha salva'
            const redirEl = qs('redir')
            const interval = window.setInterval(() => {
              countdown -= 1
              if (redirEl) redirEl.textContent = 'Redirecionando para o login em ' + String(Math.max(0, countdown)) + 's…'
              if (countdown <= 0) {
                window.clearInterval(interval)
                if (siteOrigin) window.location.assign(siteOrigin + '/login')
                else window.location.assign('/login')
              }
            }, 1000)
          } finally {
            setTimeout(() => {
              submit.disabled = false
              submit.textContent = 'Salvar nova senha'
            }, 900)
          }
        })
      }
      
      main()
    </script>
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
