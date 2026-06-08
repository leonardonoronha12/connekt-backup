import React, { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/contexts/SupabaseAuthContext'
import { useBranding } from '@/contexts/BrandingContext'
import BrandLogo from '@/components/BrandLogo'
import { clearActiveProducerUserId, getActiveProducerUserId, setActiveProducerUserId } from '@/services/producerScope'
import { getPublicAppOrigin } from '@/services/publicUrl'

export default function StudentLoginForm({ variant = 'normal' } = {}) {
  const { signIn, signInWithOAuth, resetPassword, signUpWithEmailConfirmation } = useAuth()
  const { brand } = useBranding()
  const [view, setView] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [registerData, setRegisterData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    acceptedTerms: false,
    acceptedPrivacy: false,
  })
  const [registerLoading, setRegisterLoading] = useState(false)
  const [showRegisterPassword, setShowRegisterPassword] = useState(false)
  const [showRegisterConfirmPassword, setShowRegisterConfirmPassword] = useState(false)
  const [showRegisterPasswordRequirements, setShowRegisterPasswordRequirements] = useState(false)

  const cleanEmail = useMemo(() => String(email || '').trim(), [email])
  const isDemoAllowed = useMemo(() => {
    try {
      const host = String(window.location.hostname || '').toLowerCase()
      return host === 'localhost' || host === '127.0.0.1'
    } catch (_) {
      return false
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        try {
          const params = new URLSearchParams(window.location.search || '')
          const err = String(params.get('error') || '').trim()
          const errDesc = String(params.get('error_description') || '').trim()
          const msg = errDesc || err
          if (msg) {
            setErrorMsg(msg)
            setSuccessMsg('')
            const u = new URL(window.location.href)
            u.searchParams.delete('error')
            u.searchParams.delete('error_description')
            u.searchParams.delete('error_code')
            window.history.replaceState({}, '', `${u.pathname}${u.search}${u.hash}`)
          }
        } catch (_) {}

        const host = String(window.location.hostname || '').toLowerCase()
        const isWhitelabelHost = host.endsWith('.app.connektco.com') && host !== 'app.connektco.com'
        const params = new URLSearchParams(window.location.search || '')
        const path = String(window.location.pathname || '')
        const isNormalAppLogin = variant === 'normal' && host === 'app.connektco.com' && path === '/login-aluno'
        if (variant === 'normal' && host === 'app.connektco.com') {
          try {
            const u = new URL(window.location.href)
            let changed = false
            const intentParam = String(u.searchParams.get('login_intent') || '').trim().toLowerCase()
            const shouldPreserveProducerUid = path === '/login-aluno' || (path === '/login' && intentParam === 'aluno')
            if (u.searchParams.has('wl_host')) { u.searchParams.delete('wl_host'); changed = true }
            if (u.searchParams.has('oauth_provider')) { u.searchParams.delete('oauth_provider'); changed = true }
            if (!shouldPreserveProducerUid) {
              if (u.searchParams.has('producer_uid')) { u.searchParams.delete('producer_uid'); changed = true }
              if (u.searchParams.has('producerUserId')) { u.searchParams.delete('producerUserId'); changed = true }
              if (u.searchParams.has('PRODUCER_UID')) { u.searchParams.delete('PRODUCER_UID'); changed = true }
            }
            if (changed) {
              window.history.replaceState({}, '', `${u.pathname}${u.search}${u.hash}`)
            }
          } catch (_) {}
          try { sessionStorage.removeItem('connekt_wl_handoff_target') } catch (_) {}
          try { localStorage.removeItem('connekt_wl_handoff_target') } catch (_) {}
          try { sessionStorage.removeItem('connekt_wl_host') } catch (_) {}
          try { localStorage.removeItem('connekt_wl_host') } catch (_) {}
        }
        if (isNormalAppLogin) {
          try { sessionStorage.setItem('connekt_login_intent', 'aluno') } catch (_) { try { localStorage.setItem('connekt_login_intent', 'aluno') } catch (_) {} }
          try { localStorage.setItem('connekt_login_intent', 'aluno') } catch (_) {}
          try { sessionStorage.setItem('connekt_login_mode', 'aluno') } catch (_) { try { localStorage.setItem('connekt_login_mode', 'aluno') } catch (_) {} }
          try { localStorage.setItem('connekt_login_mode', 'aluno') } catch (_) {}
        }
        let producerUid =
          params.get('producer_uid') ||
          params.get('producerUserId') ||
          params.get('producer_uid'.toUpperCase()) ||
          ''
        producerUid = String(producerUid || '').trim()
        if (!producerUid) {
          try {
            producerUid = String(sessionStorage.getItem('connekt_producer_uid') || localStorage.getItem('connekt_producer_uid') || '').trim()
          } catch (_) {
            producerUid = ''
          }
        }
        if (!producerUid) {
          producerUid = String(getActiveProducerUserId() || '').trim()
        }

        try { sessionStorage.setItem('connekt_login_intent', 'aluno') } catch (_) { try { localStorage.setItem('connekt_login_intent', 'aluno') } catch (_) {} }
        try { localStorage.setItem('connekt_login_intent', 'aluno') } catch (_) {}
        try { sessionStorage.setItem('connekt_login_mode', 'aluno') } catch (_) { try { localStorage.setItem('connekt_login_mode', 'aluno') } catch (_) {} }
        try { localStorage.setItem('connekt_login_mode', 'aluno') } catch (_) {}

        if (isWhitelabelHost) {
          try { sessionStorage.setItem('connekt_wl_host', host) } catch (_) { try { localStorage.setItem('connekt_wl_host', host) } catch (_) {} }
        }

        if (!producerUid && isWhitelabelHost) {
          const r = await fetch(`/api/producer?type=public_branding&host=${encodeURIComponent(host)}`)
          const body = await r.json().catch(() => ({}))
          if (cancelled) return
          producerUid = String(body?.producerId || '').trim()
        }

        if (producerUid) {
          setActiveProducerUserId(producerUid)
          try { sessionStorage.setItem('connekt_producer_uid', producerUid) } catch (_) { try { localStorage.setItem('connekt_producer_uid', producerUid) } catch (_) {} }
          if (!params.get('producer_uid')) {
            try {
              const u = new URL(window.location.href)
              u.searchParams.set('producer_uid', producerUid)
              window.history.replaceState({}, '', `${u.pathname}${u.search}${u.hash}`)
              window.dispatchEvent(new PopStateEvent('popstate'))
            } catch (_) {}
          }
        }
      } catch (_) {}
    }
    run()
    return () => { cancelled = true }
  }, [])
  const isRegisterValid = useMemo(() => {
    const firstName = String(registerData.firstName || '').trim()
    const lastName = String(registerData.lastName || '').trim()
    const emailValue = String(registerData.email || '').trim()
    const passwordValue = String(registerData.password || '')
    const confirmPasswordValue = String(registerData.confirmPassword || '')
    if (!firstName || !lastName || !emailValue || !passwordValue || !confirmPasswordValue) return false
    if (validatePassword(passwordValue)) return false
    if (passwordValue !== confirmPasswordValue) return false
    if (!registerData.acceptedTerms || !registerData.acceptedPrivacy) return false
    return true
  }, [
    registerData.firstName,
    registerData.lastName,
    registerData.email,
    registerData.password,
    registerData.confirmPassword,
    registerData.acceptedTerms,
    registerData.acceptedPrivacy,
  ])
  const registerProblems = useMemo(() => {
    const problems = []
    const firstName = String(registerData.firstName || '').trim()
    const lastName = String(registerData.lastName || '').trim()
    const emailValue = String(registerData.email || '').trim()
    const passwordValue = String(registerData.password || '')
    const confirmPasswordValue = String(registerData.confirmPassword || '')
    if (!firstName) problems.push('Informe seu nome')
    if (!lastName) problems.push('Informe seu sobrenome')
    if (!emailValue) problems.push('Informe seu email')
    if (!passwordValue) {
      problems.push('Informe sua senha')
    } else {
      const pwdErr = validatePassword(passwordValue)
      if (pwdErr) problems.push(pwdErr)
    }
    if (!confirmPasswordValue) problems.push('Confirme sua senha')
    if (passwordValue && confirmPasswordValue && passwordValue !== confirmPasswordValue) problems.push('As senhas não coincidem')
    if (!registerData.acceptedTerms) problems.push('Aceite os termos de uso')
    if (!registerData.acceptedPrivacy) problems.push('Aceite a política de privacidade')
    return problems
  }, [
    registerData.firstName,
    registerData.lastName,
    registerData.email,
    registerData.password,
    registerData.confirmPassword,
    registerData.acceptedTerms,
    registerData.acceptedPrivacy,
  ])
  const isRegisterTouched = useMemo(() => {
    return (
      String(registerData.firstName || '').trim().length > 0 ||
      String(registerData.lastName || '').trim().length > 0 ||
      String(registerData.email || '').trim().length > 0 ||
      String(registerData.password || '').length > 0 ||
      String(registerData.confirmPassword || '').length > 0 ||
      registerData.acceptedTerms ||
      registerData.acceptedPrivacy
    )
  }, [
    registerData.firstName,
    registerData.lastName,
    registerData.email,
    registerData.password,
    registerData.confirmPassword,
    registerData.acceptedTerms,
    registerData.acceptedPrivacy,
  ])

  const goTo = (path) => {
    window.history.pushState({}, '', path)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  const translateErrorMessage = (message) => {
    const m = String(message || '')
    const map = {
      'Invalid login credentials': 'Credenciais de login inválidas',
      'Email not confirmed': 'Email não confirmado',
      'Too many requests': 'Muitas tentativas. Tente novamente mais tarde',
      'User not found': 'Usuário não encontrado',
      'Invalid email': 'Email inválido',
      'Password should be at least 6 characters': 'A senha deve ter pelo menos 6 caracteres',
      'Email already registered': 'Email já cadastrado',
      'User already registered': 'Usuário já cadastrado',
      'Weak password': 'Senha muito fraca',
      'Invalid password': 'Senha inválida',
      timeout: 'A conexão demorou para responder. Tente novamente.',
      'Network error': 'Erro de conexão',
      'Server error': 'Erro do servidor',
      'Unsupported provider: provider is not enabled': 'Login com Google/Facebook não está habilitado.',
    }
    return map[m] || m
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

  function getPasswordRequirements(passwordValue) {
    const p = String(passwordValue || '')
    return {
      minLength: p.length >= 6,
      hasNumber: /\d/.test(p),
      hasLetter: /[a-zA-Z]/.test(p),
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')
    setLoading(true)
    try {
      try { sessionStorage.setItem('connekt_login_mode', 'aluno') } catch (_) { try { localStorage.setItem('connekt_login_mode', 'aluno') } catch (_) {} }
      const { error } = await signIn(cleanEmail, password)
      if (error) {
        setErrorMsg(translateErrorMessage(error?.message || String(error)))
        return
      }
    } catch (err) {
      setErrorMsg(translateErrorMessage(err?.message || String(err)))
    } finally {
      setLoading(false)
    }
  }

  const handleDemoLogin = async () => {
    if (!isDemoAllowed) return
    try {
      localStorage.setItem('connekt_demo_student', '1')
    } catch (_) {}
    try { sessionStorage.setItem('connekt_login_mode', 'aluno') } catch (_) { try { localStorage.setItem('connekt_login_mode', 'aluno') } catch (_) {} }
    window.history.pushState({}, '', '/aluno?demo=1')
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  const handleOAuth = async (provider) => {
    setErrorMsg('')
    setSuccessMsg('')
    try {
      try { sessionStorage.setItem('connekt_login_intent', 'aluno') } catch (_) { try { localStorage.setItem('connekt_login_intent', 'aluno') } catch (_) {} }
      try { localStorage.setItem('connekt_login_intent', 'aluno') } catch (_) {}
      try { sessionStorage.setItem('connekt_login_mode', 'aluno') } catch (_) { try { localStorage.setItem('connekt_login_mode', 'aluno') } catch (_) {} }
      try { localStorage.setItem('connekt_login_mode', 'aluno') } catch (_) {}
      let producerUid = ''
      try {
        const params = new URLSearchParams(window.location.search || '')
        producerUid = String(params.get('producer_uid') || params.get('producerUserId') || params.get('producer_uid'.toUpperCase()) || '').trim()
      } catch (_) {
        producerUid = ''
      }
      if (!producerUid) {
        try {
          producerUid = String(sessionStorage.getItem('connekt_producer_uid') || localStorage.getItem('connekt_producer_uid') || '').trim()
        } catch (_) {
          producerUid = ''
        }
      }
      if (!producerUid) producerUid = String(getActiveProducerUserId() || '').trim()
      let wlHost = ''
      try {
        const params = new URLSearchParams(window.location.search || '')
        const wlHostParam = String(params.get('wl_host') || '').trim().toLowerCase()
        if (wlHostParam) wlHost = wlHostParam
      } catch (_) {}
      const hostName = String(window.location.hostname || '').trim().toLowerCase()
      const isWhitelabelHost = hostName.endsWith('.app.connektco.com') && hostName !== 'app.connektco.com'
      const isNormalAppLogin = variant !== 'whitelabel' && hostName === 'app.connektco.com' && String(window.location.pathname || '') === '/login-aluno'
      if (!wlHost && isWhitelabelHost) wlHost = String(window.location.host || '').trim().toLowerCase()
      if (isNormalAppLogin) {
        wlHost = ''
        try { sessionStorage.removeItem('connekt_wl_handoff_target') } catch (_) {}
        try { localStorage.removeItem('connekt_wl_handoff_target') } catch (_) {}
        try { sessionStorage.removeItem('connekt_wl_host') } catch (_) {}
        try { localStorage.removeItem('connekt_wl_host') } catch (_) {}
      }
      if (isWhitelabelHost) {
        const u = new URL('https://app.connektco.com/login-aluno-wl')
        if (producerUid) u.searchParams.set('producer_uid', producerUid)
        u.searchParams.set('wl_host', wlHost)
        u.searchParams.set('oauth_provider', String(provider || 'google'))
        window.location.assign(u.toString())
        return
      }
      const qp = new URLSearchParams()
      if (producerUid) qp.set('producer_uid', String(producerUid))
      if (wlHost) qp.set('wl_host', wlHost)
      if (variant !== 'whitelabel' && !isWhitelabelHost) qp.set('login_intent', 'aluno')
      const suffix = qp.toString() ? `?${qp.toString()}` : ''
      if (!isNormalAppLogin && wlHost && wlHost.endsWith('.app.connektco.com') && wlHost !== 'app.connektco.com') {
        const stamp = `${wlHost}|${Date.now()}`
        try { sessionStorage.setItem('connekt_wl_handoff_target', stamp) } catch (_) { try { localStorage.setItem('connekt_wl_handoff_target', stamp) } catch (_) {} }
      }
      const redirectPath = (variant === 'whitelabel' || isWhitelabelHost) ? '/login-aluno-wl' : '/login'
      const { error } = await signInWithOAuth(provider, `${redirectPath}${suffix}`)
      if (error) setErrorMsg(translateErrorMessage(error?.message || String(error)))
    } catch (err) {
      setErrorMsg(translateErrorMessage(err?.message || String(err)))
    }
  }

  useEffect(() => {
    try {
      const host = String(window.location.hostname || '').toLowerCase()
      if (host !== 'app.connektco.com') return
      if (variant !== 'whitelabel') return
      const params = new URLSearchParams(window.location.search || '')
      const provider = String(params.get('oauth_provider') || '').trim().toLowerCase()
      if (!provider) return
      try { sessionStorage.setItem('connekt_aluno_oauth_starting', '1') } catch (_) {}
      const wl = String(params.get('wl_host') || '').trim().toLowerCase()
      if (wl && wl.endsWith('.app.connektco.com') && wl !== 'app.connektco.com') {
        const stamp = `${wl}|${Date.now()}`
        try { sessionStorage.setItem('connekt_wl_handoff_target', stamp) } catch (_) { try { localStorage.setItem('connekt_wl_handoff_target', stamp) } catch (_) {} }
      }
      const key = `connekt_oauth_autostarted:${provider}:${String(params.get('producer_uid') || '')}`
      try {
        const last = Number(sessionStorage.getItem(key) || 0)
        if (Number.isFinite(last) && last > 0 && Date.now() - last < 15000) return
        sessionStorage.setItem(key, String(Date.now()))
      } catch (_) {}
      try {
        params.delete('oauth_provider')
        const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}${window.location.hash || ''}`
        window.history.replaceState({}, '', next)
      } catch (_) {}
      handleOAuth(provider)
    } catch (_) {}
  }, [])

  const handleReset = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')
    const em = String(resetEmail || '').trim()
    if (!em) return
    setResetLoading(true)
    try {
      const r = await resetPassword(em)
      if (r?.error) {
        setErrorMsg(translateErrorMessage(r.error?.message || String(r.error)))
        return
      }
      setSuccessMsg('Email enviado. Verifique sua caixa de entrada.')
    } catch (err) {
      setErrorMsg(translateErrorMessage(err?.message || String(err)))
    } finally {
      setResetLoading(false)
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    const emailValue = String(registerData.email || '').trim()
    if (!emailValue) return
    const passwordError = validatePassword(registerData.password)
    if (passwordError) {
      setErrorMsg(passwordError)
      return
    }
    if (registerData.password !== registerData.confirmPassword) {
      setErrorMsg('As senhas não coincidem.')
      return
    }
    if (!registerData.acceptedTerms || !registerData.acceptedPrivacy) {
      setErrorMsg('Você deve aceitar os termos de uso e política de privacidade.')
      return
    }

    setRegisterLoading(true)
    try {
      const fullName = `${String(registerData.firstName || '').trim()} ${String(registerData.lastName || '').trim()}`.trim()
      try { sessionStorage.setItem('connekt_login_mode', 'aluno') } catch (_) { try { localStorage.setItem('connekt_login_mode', 'aluno') } catch (_) {} }
      const hostName = String(window.location.hostname || '').trim().toLowerCase()
      const isWhitelabelHost = hostName.endsWith('.app.connektco.com') && hostName !== 'app.connektco.com'
      const params = new URLSearchParams(window.location.search || '')
      const producerUidForSignup = String(params.get('producer_uid') || params.get('producerUserId') || params.get('producer_uid'.toUpperCase()) || '').trim()
      const wlHostForSignup = String(params.get('wl_host') || '').trim().toLowerCase() || (isWhitelabelHost ? String(window.location.host || '').trim().toLowerCase() : '')
      const loginPathForSignup = (variant === 'whitelabel' || isWhitelabelHost || wlHostForSignup) ? '/login-aluno-wl' : '/login-aluno'
      const result = await signUpWithEmailConfirmation({
        email: emailValue,
        password: registerData.password,
        userMetadata: {
          first_name: String(registerData.firstName || '').trim(),
          last_name: String(registerData.lastName || '').trim(),
          full_name: fullName,
        },
        redirectTo: `${getPublicAppOrigin() || window.location.origin}${loginPathForSignup}?email_confirmed=true`,
        producerUid: producerUidForSignup || undefined,
        wlHost: wlHostForSignup || undefined,
      })
      if (!result?.ok) {
        setErrorMsg(translateErrorMessage(String(result?.error || 'Erro no cadastro.')))
        return
      }
      setSuccessMsg('Cadastro realizado com sucesso! Verifique seu email para acessar a conta.')
      setRegisterData({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        confirmPassword: '',
        acceptedTerms: false,
        acceptedPrivacy: false,
      })
    } catch (err) {
      setErrorMsg(err?.message || String(err))
    } finally {
      setRegisterLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-white">
      <div className="w-full lg:w-[520px] px-8 py-10 flex flex-col">
        <div className="flex items-center justify-center w-full">
          <BrandLogo variant="compact" className="h-8 w-auto" alt={brand?.name || 'Logo'} />
        </div>

        <div className="flex-1 flex items-center w-full">
          <div className="w-full max-w-[360px] mx-auto">
            {view === 'register' ? (
              <>
                <button
                  type="button"
                  className="text-[12px] brand-text font-semibold inline-flex items-center gap-2"
                  onClick={() => {
                    setView('login')
                    setErrorMsg('')
                    setSuccessMsg('')
                  }}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Voltar
                </button>

                <div className="mt-4 text-[22px] font-semibold text-[#1E1B39]">Criar conta</div>
                <div className="mt-1 text-[12px] text-[#737780]">Crie sua conta para acessar seus cursos.</div>

                <form onSubmit={handleRegister} className="mt-6 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[12px] text-[#1E1B39]">Nome</label>
                      <input
                        type="text"
                        value={registerData.firstName}
                        onChange={(e) => setRegisterData((s) => ({ ...s, firstName: e.target.value }))}
                        placeholder="Seu nome"
                        className="mt-2 w-full h-10 rounded-[4px] border border-[#E3E4E5] bg-[#F8FAFC] px-3 text-[13px] outline-none brand-border-focus"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[12px] text-[#1E1B39]">Sobrenome</label>
                      <input
                        type="text"
                        value={registerData.lastName}
                        onChange={(e) => setRegisterData((s) => ({ ...s, lastName: e.target.value }))}
                        placeholder="Seu sobrenome"
                        className="mt-2 w-full h-10 rounded-[4px] border border-[#E3E4E5] bg-[#F8FAFC] px-3 text-[13px] outline-none brand-border-focus"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[12px] text-[#1E1B39]">Email</label>
                    <input
                      type="email"
                      value={registerData.email}
                      onChange={(e) => setRegisterData((s) => ({ ...s, email: e.target.value }))}
                      placeholder="seuemail@gmail.com"
                      className="mt-2 w-full h-10 rounded-[4px] border border-[#E3E4E5] bg-[#F8FAFC] px-3 text-[13px] outline-none brand-border-focus"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[12px] text-[#1E1B39]">Senha</label>
                    <div className="mt-2 relative">
                      <input
                        type={showRegisterPassword ? 'text' : 'password'}
                        value={registerData.password}
                        onChange={(e) => setRegisterData((s) => ({ ...s, password: e.target.value }))}
                        placeholder="••••••••"
                        className="w-full h-10 rounded-[4px] border border-[#E3E4E5] bg-[#F8FAFC] px-3 pr-10 text-[13px] outline-none brand-border-focus"
                        onFocus={() => setShowRegisterPasswordRequirements(true)}
                        onBlur={() => setShowRegisterPasswordRequirements(false)}
                        required
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[#737780]"
                        onClick={() => setShowRegisterPassword((s) => !s)}
                        aria-label={showRegisterPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      >
                        {showRegisterPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {(registerData.password && (showRegisterPasswordRequirements || validatePassword(registerData.password))) ? (
                      <div className="mt-2 p-3 bg-[#F8FAFC] border border-[#E3E4E5] rounded-[4px] text-[12px]">
                        <div className="mb-2 font-medium text-[#22252B]">Requisitos da senha:</div>
                        {(() => {
                          const req = getPasswordRequirements(registerData.password)
                          return (
                            <div className="flex flex-col gap-1">
                              <div className={`flex items-center gap-2 ${req.minLength ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                                <span>{req.minLength ? '✓' : '✗'}</span>
                                <span>Mínimo 6 caracteres</span>
                              </div>
                              <div className={`flex items-center gap-2 ${req.hasNumber ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                                <span>{req.hasNumber ? '✓' : '✗'}</span>
                                <span>Pelo menos um número</span>
                              </div>
                              <div className={`flex items-center gap-2 ${req.hasLetter ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                                <span>{req.hasLetter ? '✓' : '✗'}</span>
                                <span>Pelo menos uma letra</span>
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                    ) : null}
                  </div>

                  <div>
                    <label className="text-[12px] text-[#1E1B39]">Confirmar senha</label>
                    <div className="mt-2 relative">
                      <input
                        type={showRegisterConfirmPassword ? 'text' : 'password'}
                        value={registerData.confirmPassword}
                        onChange={(e) => setRegisterData((s) => ({ ...s, confirmPassword: e.target.value }))}
                        placeholder="••••••••"
                        className="w-full h-10 rounded-[4px] border border-[#E3E4E5] bg-[#F8FAFC] px-3 pr-10 text-[13px] outline-none brand-border-focus"
                        required
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[#737780]"
                        onClick={() => setShowRegisterConfirmPassword((s) => !s)}
                        aria-label={showRegisterConfirmPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      >
                        {showRegisterConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <div className="mt-2 text-[12px] text-[#737780]">
                      Ter no mínimo 6 caracteres, um número e uma letra
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-[11px] text-[#737780]">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border border-[#E3E4E5]"
                        checked={registerData.acceptedTerms}
                        onChange={(e) => setRegisterData((s) => ({ ...s, acceptedTerms: e.target.checked }))}
                      />
                      Aceito os termos de uso
                    </label>
                    <label className="flex items-center gap-2 text-[11px] text-[#737780]">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border border-[#E3E4E5]"
                        checked={registerData.acceptedPrivacy}
                        onChange={(e) => setRegisterData((s) => ({ ...s, acceptedPrivacy: e.target.checked }))}
                      />
                      Aceito a política de privacidade
                    </label>
                  </div>

                  {errorMsg ? <div className="text-[12px] text-[#B91C1C]">{translateErrorMessage(errorMsg)}</div> : null}
                  {successMsg ? <div className="text-[12px] text-[#166534]">{successMsg}</div> : null}

                  <button
                    type="submit"
                    disabled={registerLoading || !isRegisterValid}
                    className="w-full h-10 rounded-[4px] brand-bg brand-bg-hover text-white text-[13px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {registerLoading ? 'Criando…' : 'Criar conta'}
                  </button>
                  {!isRegisterValid && isRegisterTouched && registerProblems.length > 0 ? (
                    <div className="mt-2 text-[12px] text-[#B91C1C]">
                      {registerProblems[0]}
                    </div>
                  ) : null}

                  <div className="text-center text-[11px] text-[#737780]">
                    Já tem conta?{' '}
                    <button
                      type="button"
                      className="brand-text font-semibold"
                      onClick={() => {
                        setView('login')
                        setErrorMsg('')
                        setSuccessMsg('')
                      }}
                    >
                      Entrar
                    </button>
                  </div>
                </form>
              </>
            ) : showForgotPassword ? (
              <>
                <div className="text-[22px] font-semibold text-[#1E1B39]">Recuperar acesso</div>
                <div className="mt-1 text-[12px] text-[#737780]">
                  Digite seu endereço de e-mail e enviaremos um link para redefinir sua senha.
                </div>

                <form onSubmit={handleReset} className="mt-6 space-y-4">
                  <div>
                    <label className="text-[12px] text-[#1E1B39]">Email</label>
                    <input
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="seuemail@gmail.com"
                      className="mt-2 w-full h-10 rounded-[4px] border border-[#E3E4E5] bg-[#F8FAFC] px-3 text-[13px] outline-none brand-border-focus"
                      required
                    />
                  </div>

                  {errorMsg ? (
                    <div className="text-[12px] text-[#B91C1C]">{errorMsg}</div>
                  ) : null}
                  {successMsg ? (
                    <div className="text-[12px] text-[#166534]">{successMsg}</div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={resetLoading || !String(resetEmail || '').trim()}
                    className="w-full h-10 rounded-[4px] brand-bg brand-bg-hover text-white text-[13px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {resetLoading ? 'Enviando…' : 'Enviar'}
                  </button>

                  <button
                    type="button"
                    className="text-[12px] brand-text font-semibold"
                    onClick={() => {
                      setShowForgotPassword(false)
                      setErrorMsg('')
                      setSuccessMsg('')
                    }}
                  >
                    Voltar
                  </button>
                </form>
              </>
            ) : (
              <>
                <div className="text-[22px] font-semibold text-[#1E1B39]">Entrar</div>
                <div className="mt-1 text-[12px] text-[#737780]">Escolha como deseja entrar na sua conta</div>

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                  <div>
                    <label className="text-[12px] text-[#1E1B39]">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seuemail@gmail.com"
                      className="mt-2 w-full h-10 rounded-[4px] border border-[#E3E4E5] bg-[#F8FAFC] px-3 text-[13px] outline-none brand-border-focus"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[12px] text-[#1E1B39]">Senha</label>
                    <div className="mt-2 relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full h-10 rounded-[4px] border border-[#E3E4E5] bg-[#F8FAFC] px-3 pr-10 text-[13px] outline-none brand-border-focus"
                        required
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[#737780]"
                        onClick={() => setShowPassword((s) => !s)}
                        aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-[11px] text-[#737780]">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="h-4 w-4 rounded border border-[#E3E4E5]"
                      />
                      Manter conectado
                    </label>
                    <button
                      type="button"
                      className="text-[11px] brand-text font-semibold"
                      onClick={() => {
                        setShowForgotPassword(true)
                        setResetEmail(cleanEmail)
                        setErrorMsg('')
                        setSuccessMsg('')
                      }}
                    >
                      Esqueci minha senha
                    </button>
                  </div>

                  {errorMsg ? <div className="text-[12px] text-[#B91C1C]">{errorMsg}</div> : null}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-10 rounded-[4px] brand-bg brand-bg-hover text-white text-[13px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Entrando…' : 'Entrar'}
                  </button>
                </form>

                {isDemoAllowed ? (
                  <button
                    type="button"
                    className="mt-3 w-full h-10 rounded-[4px] border border-[#E3E4E5] bg-white text-[#22252B] text-[13px] font-semibold"
                    onClick={handleDemoLogin}
                  >
                    Entrar como demo
                  </button>
                ) : null}

                <div className="my-6 flex items-center gap-3">
                  <div className="h-px flex-1 bg-[#E3E4E5]" />
                  <div className="text-[11px] text-[#737780]">ou faça login com email</div>
                  <div className="h-px flex-1 bg-[#E3E4E5]" />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    className="flex-1 h-10 rounded-[6px] border border-[#E3E4E5] bg-white flex items-center justify-center gap-2 text-[12px] font-medium text-[#1E1B39]"
                    onClick={() => handleOAuth('google')}
                  >
                    <svg width="16" height="16" viewBox="0 0 18 18">
                      <path fill="#4285F4" d="M9.18 7.36v3.28h4.64c-.2 1.04-.8 1.92-1.68 2.52v2.08h2.72c1.6-1.48 2.52-3.64 2.52-6.24 0-.6-.04-1.16-.12-1.72H9.18z" />
                      <path fill="#34A853" d="M4.24 10.78c-.32-.96-.32-2 0-2.96V5.74H1.52c-1.04 2.08-1.04 4.52 0 6.6l2.72-2.08z" />
                      <path fill="#FBBC05" d="M9.18 3.6c1.32 0 2.52.48 3.44 1.36l2.56-2.56C13.68.92 11.56 0 9.18 0 5.6 0 2.52 2.24 1.52 5.36l2.72 2.08c.64-1.92 2.44-3.24 4.94-3.24z" />
                      <path fill="#EA4335" d="M9.18 18c2.38 0 4.38-.8 5.84-2.16l-2.72-2.08c-.8.56-1.84.88-3.12.88-2.5 0-4.3-1.32-4.94-3.24L1.52 13.48C2.52 16.76 5.6 18 9.18 18z" />
                    </svg>
                    Google
                  </button>
                </div>

                <div className="mt-6 text-center text-[11px] text-[#737780]">
                  Novo por aqui?{' '}
                  <button
                    type="button"
                    className="brand-text font-semibold"
                    onClick={() => {
                      setView('register')
                      setShowForgotPassword(false)
                      setErrorMsg('')
                      setSuccessMsg('')
                      setRegisterData((s) => ({ ...s, email: cleanEmail }))
                    }}
                  >
                    Crie sua conta agora
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="text-[11px] text-[#737780] flex flex-col items-center gap-2 text-center">
          <div>Copyright © 2025 - Todos os direitos reservados</div>
          <div className="flex items-center gap-2">
            <button type="button" className="hover:text-[#1E1B39]" onClick={() => goTo('/suporte')}>Suporte</button>
            <span>•</span>
            <button type="button" className="hover:text-[#1E1B39]" onClick={() => goTo('/termos#termos')}>Termos de uso</button>
            <span>•</span>
            <button type="button" className="hover:text-[#1E1B39]" onClick={() => goTo('/termos#privacidade')}>Política de privacidade</button>
          </div>
        </div>
      </div>

      <div className="hidden lg:flex flex-1 relative items-center justify-center overflow-hidden">
        <img src="/login-background.svg" alt="" className="absolute inset-0 w-full h-full object-cover" />
        <BrandLogo variant="sidebar" className="relative h-12 w-auto" alt={brand?.name || 'Logo'} />
      </div>
    </div>
  )
}
