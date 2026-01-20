function qs(id) {
  return document.getElementById(id)
}

function setMessage(kind, text) {
  const el = qs('message')
  if (!el) return
  el.style.display = 'block'
  el.className = `msg ${kind}`
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

async function refreshSession({ supabaseUrl, supabaseAnonKey, refreshToken }) {
  const url = `${String(supabaseUrl).replace(/\\/+$/, '')}/auth/v1/token?grant_type=refresh_token`
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
    return { ok: false, error: (data && (data.msg || data.error_description || data.error)) ? (data.msg || data.error_description || data.error) : text || 'Falha ao autenticar link.' }
  }
  return { ok: true, accessToken: String(data?.access_token || ''), refreshToken: String(data?.refresh_token || refreshToken) }
}

async function updatePassword({ supabaseUrl, supabaseAnonKey, accessToken, password }) {
  const url = `${String(supabaseUrl).replace(/\\/+$/, '')}/auth/v1/user`
  const r = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ password }),
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
        const rr = await refreshSession({ supabaseUrl, supabaseAnonKey, refreshToken })
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

      const up = await updatePassword({ supabaseUrl, supabaseAnonKey, accessToken, password })
      if (!up.ok) {
        setMessage('error', up.error || 'Erro ao redefinir senha.')
        return
      }

      setMessage('success', 'Senha redefinida com sucesso. Você já pode fazer login.')
      submit.textContent = 'Senha salva'
    } finally {
      setTimeout(() => {
        submit.disabled = false
        submit.textContent = 'Salvar nova senha'
      }, 900)
    }
  })
}

main()

