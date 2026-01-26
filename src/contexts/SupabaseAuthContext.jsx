import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { deviceSessionService } from '@/services/deviceSessionService';
import { setActiveProducerUserId } from '@/services/producerScope'

const AuthContext = createContext(undefined);

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), Math.max(1, Number(ms || 0)))
    Promise.resolve(promise).then(
      (v) => { clearTimeout(t); resolve(v) },
      (e) => { clearTimeout(t); reject(e) },
    )
  })
}

function getAuthRedirectOrigin() {
  const readEnvUrl = () => {
    try {
      const v = import.meta?.env?.VITE_SITE_URL || import.meta?.env?.VITE_APP_BASE_URL
      if (v) return String(v).trim()
    } catch (_) {}
    return ''
  }

  const isLocalhostOrigin = (origin) => {
    try {
      const u = new URL(origin)
      const host = String(u.hostname || '').toLowerCase()
      return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0'
    } catch (_) {
      return false
    }
  }

  const envUrl = readEnvUrl()
  if (envUrl) {
    try {
      const envOrigin = new URL(envUrl).origin
      const currentOrigin = window.location.origin
      if (!isLocalhostOrigin(currentOrigin) && isLocalhostOrigin(envOrigin)) return currentOrigin
      return envOrigin
    } catch (_) {}
  }

  try {
    return window.location.origin
  } catch (_) {
    return ''
  }
}

function readStoredLoginIntent() {
  try {
    const v = sessionStorage.getItem('connekt_login_intent')
    if (v) return String(v)
  } catch (_) {}
  try {
    const v = sessionStorage.getItem('connekt_login_mode') || localStorage.getItem('connekt_login_mode')
    if (v) return String(v)
  } catch (_) {}
  return ''
}

function captureProducerScopeFromUrl() {
  try {
    const path = String(window.location.pathname || '')
    const isAlunoContext = path === '/login-aluno' || path === '/aluno/login' || path === '/aluno' || path.startsWith('/aluno/')
    if (!isAlunoContext) return
    const params = new URLSearchParams(window.location.search || '')
    const producerUid =
      params.get('producer_uid') ||
      params.get('producerUserId') ||
      params.get('producer_uid'.toUpperCase()) ||
      ''
    if (producerUid) setActiveProducerUserId(producerUid)
  } catch (_) {}
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deviceLock, setDeviceLock] = useState(null);
  const shouldEnforceDeviceLock = useMemo(() => {
    try {
      const host = String(window.location.hostname || '').toLowerCase()
      if (host === 'localhost' || host === '127.0.0.1') return false
    } catch (_) {}
    return true
  }, [])

  const handleSession = useCallback(async (currentSession) => {
    setSession(currentSession);
    setUser(currentSession?.user ?? null);
    setLoading(false);
  }, []);

  const tryReadStoredSession = useCallback(() => {
    const readFrom = (storage) => {
      if (!storage) return null
      try {
        const keys = Object.keys(storage || {});
        const key = keys.find((k) => k.startsWith('sb-') && k.endsWith('-auth-token'));
        if (!key) return null
        const raw = storage.getItem(key);
        if (!raw) return null
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          if (parsed.currentSession && typeof parsed.currentSession === 'object') return parsed.currentSession
          if (parsed.access_token && parsed.refresh_token) return parsed
        }
      } catch (_) {}
      return null
    }
    return readFrom(sessionStorage) || readFrom(localStorage) || null
  }, []);

  useEffect(() => {
    const getSession = async () => {
      try {
        const { data: { session: currentSession } } = await withTimeout(supabase.auth.getSession(), 4500);
        handleSession(currentSession);
      } catch (e) {
        const msg = (e && (e.message || e.error_description || e.msg)) ? (e.message || e.error_description || e.msg) : String(e);
        const msgLower = String(msg || '').toLowerCase()
        const isNetworkError =
          msgLower.includes('failed to fetch') ||
          msgLower.includes('networkerror') ||
          msgLower.includes('load failed') ||
          msgLower.includes('err_network') ||
          msgLower.includes('network') ||
          msgLower.includes('timeout');
        const isInvalidRefresh = msg.toLowerCase().includes('invalid refresh token');
        if (isNetworkError) {
          const stored = tryReadStoredSession()
          handleSession(stored || null)
          return
        }
        if (!isInvalidRefresh) {
          console.error("Error getting session:", e);
        } else {
          console.warn("Sessão inválida: refresh token ausente/expirado. Efetuando signOut e limpando storage.");
        }
        // Sessão inválida/expirada ou refresh falhou: limpar storage e garantir signOut
        try {
          const clean = (storage) => {
            if (!storage) return
            try {
              const keys = Object.keys(storage || {});
              keys
                .filter((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))
                .forEach((k) => {
                  try { storage.removeItem(k); } catch (_) {}
                });
              try { storage.removeItem('supabase.auth.token'); } catch (_) {}
            } catch (_) {}
          }
          clean(localStorage)
          clean(sessionStorage)
        } catch (_) {}
        try { await supabase.auth.signOut(); } catch (_) {}
        handleSession(null);
      }
    };

    captureProducerScopeFromUrl()
    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        captureProducerScopeFromUrl()
        const isRecoveryUrl = () => {
          try {
            const h = String(window.location.hash || '').toLowerCase()
            const s = String(window.location.search || '').toLowerCase()
            return h.includes('type=recovery') || s.includes('type=recovery')
          } catch (_) {
            return false
          }
        }

        if (isRecoveryUrl() && window.location.pathname !== '/reset-password') {
          try { sessionStorage.setItem('connekt_pending_recovery', '1') } catch (_) {}
          window.history.replaceState({}, '', `/reset-password${window.location.search || ''}${window.location.hash || ''}`);
          window.dispatchEvent(new PopStateEvent('popstate'));
        }

        try {
          const pending = sessionStorage.getItem('connekt_pending_recovery') === '1'
          const okEvent = event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY' || event === 'INITIAL_SESSION'
          if (pending && okEvent && currentSession && window.location.pathname !== '/reset-password') {
            window.history.replaceState({}, '', `/reset-password${window.location.search || ''}${window.location.hash || ''}`);
            window.dispatchEvent(new PopStateEvent('popstate'));
          }
          if (pending && okEvent && currentSession) {
            sessionStorage.removeItem('connekt_pending_recovery')
          }
        } catch (_) {}

        // Redireciona ao dashboard em SIGNED_IN.
        // Caso tenha vindo da confirmação e caiu na raiz '/', adiciona email_confirmed=true.
        if (event === 'PASSWORD_RECOVERY') {
          if (window.location.pathname !== '/reset-password') {
            window.history.replaceState({}, '', '/reset-password');
            window.dispatchEvent(new PopStateEvent('popstate'));
          }
        }
        if (event === 'SIGNED_IN') {
          let isLocked = false
          const pathname = window.location.pathname
          const isStudentFlow =
            pathname === '/login-aluno' ||
            pathname === '/aluno/login' ||
            pathname === '/aluno' ||
            pathname.startsWith('/aluno/')

          if (shouldEnforceDeviceLock && !isStudentFlow) {
            try {
              const userId = currentSession?.user?.id
              if (userId) {
                const enforcement = await deviceSessionService.enforceSingleDevice({ userId })
                if (enforcement?.ok && enforcement.allowed) {
                  await deviceSessionService.claimDevice({ userId })
                  setDeviceLock(null)
                } else if (enforcement?.ok && enforcement.allowed === false) {
                  isLocked = true
                  setDeviceLock({ reason: enforcement.reason || 'other_device', activeDevice: enforcement.activeDevice || null })
                }
              }
            } catch (_) {}
          } else {
            setDeviceLock(null)
          }

          const params = new URLSearchParams(window.location.search);
          const hasEmailConfirmedParam = params.get('email_confirmed') === 'true';
          const arrivedFromRoot = pathname === '/' || pathname === '/index.html';
          const arrivedFromAuth = pathname === '/login' || pathname === '/verify-email' || pathname === '/login-aluno' || pathname === '/aluno/login';
          const shouldRedirect = (arrivedFromRoot || arrivedFromAuth) && pathname !== '/reset-password';
          if (shouldRedirect && !isLocked) {
            const producerUidFromUrl =
              params.get('producer_uid') ||
              params.get('producerUserId') ||
              params.get('producer_uid'.toUpperCase()) ||
              ''
            const target = (isStudentFlow || (arrivedFromRoot && producerUidFromUrl))
              ? (producerUidFromUrl ? `/aluno?producer_uid=${encodeURIComponent(String(producerUidFromUrl))}` : '/aluno')
              : (hasEmailConfirmedParam || arrivedFromRoot ? '/dashboard?email_confirmed=true' : '/dashboard');
            window.history.replaceState({}, '', target);
            window.dispatchEvent(new PopStateEvent('popstate'));
            try { sessionStorage.removeItem('connekt_login_intent') } catch (_) {}
          }
        }
        // Opcional: em SIGNED_OUT, volta para login
        if (event === 'SIGNED_OUT') {
          setDeviceLock(null)
          const path = window.location.pathname || ''
          let mode = ''
          try { mode = String(sessionStorage.getItem('connekt_login_mode') || localStorage.getItem('connekt_login_mode') || '') } catch (_) { mode = '' }
          const isAlunoFlow = mode === 'aluno' || path === '/aluno' || path.startsWith('/aluno/') || path === '/login-aluno' || path === '/aluno/login'
          const target = isAlunoFlow ? '/login-aluno' : '/login'
          window.history.replaceState({}, '', target);
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
        handleSession(currentSession);
      }
    );

    return () => subscription.unsubscribe();
  }, [handleSession, shouldEnforceDeviceLock]);

  useEffect(() => {
    if (!shouldEnforceDeviceLock) return
    if (!user?.id) return
    if (deviceLock) return
    try {
      const intent = readStoredLoginIntent()
      const path = String(window.location.pathname || '')
      const isStudentFlow = intent === 'aluno' || path === '/aluno' || path.startsWith('/aluno/') || path === '/login-aluno' || path === '/aluno/login'
      if (isStudentFlow) return
    } catch (_) {}
    let cancelled = false
    const userId = user.id

    const doHeartbeat = async () => {
      try {
        const r = await deviceSessionService.enforceSingleDevice({ userId })
        if (cancelled) return
        if (r?.ok && r.allowed === false) {
          setDeviceLock({ reason: r.reason || 'other_device', activeDevice: r.activeDevice || null })
          return
        }
        await deviceSessionService.heartbeat({ userId })
      } catch (_) {}
    }

    doHeartbeat()
    const heartbeatInterval = window.setInterval(doHeartbeat, 60 * 1000)
    return () => {
      cancelled = true
      window.clearInterval(heartbeatInterval)
    }
  }, [user?.id, deviceLock, shouldEnforceDeviceLock])

  const signUp = useCallback(async (email, password, options) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options,
    });

    return { error };
  }, []);

  const signUpWithEmailConfirmation = useCallback(async ({ email, password, userMetadata, redirectTo }) => {
    try {
      const em = String(email || '').trim().toLowerCase()
      const pwd = String(password || '')
      if (!em) return { ok: false, error: 'missing_email' }
      if (!pwd) return { ok: false, error: 'missing_password' }
      const r = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: em,
          password: pwd,
          user_metadata: userMetadata && typeof userMetadata === 'object' ? userMetadata : undefined,
          redirectTo: redirectTo || undefined,
        }),
      })
      const text = await r.text()
      let data = null
      try { data = JSON.parse(text || '{}') } catch (_) { data = null }
      if (!r.ok) return { ok: false, error: data?.message || data?.error || text || 'send_failed' }
      return { ok: true }
    } catch (_) {
      return { ok: false, error: 'send_failed' }
    }
  }, [])

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return { error };
  }, []);

  const signOut = useCallback(async () => {
    try {
      const userId = session?.user?.id
      if (userId) {
        try {
          const currentDeviceId = deviceSessionService.getOrCreateDeviceId()
          const r = await deviceSessionService.getActiveDevice({ userId })
          if (r?.ok && r.device?.active_device_id && String(r.device.active_device_id) === String(currentDeviceId)) {
            await deviceSessionService.clearActiveDevice({ userId })
          }
        } catch (_) {}
      }
    } catch (_) {}

    const { error } = await supabase.auth.signOut();
    setDeviceLock(null)
    return { error };
  }, [session?.user?.id]);

  const resolveDeviceLock = useCallback(async (mode = 'takeover') => {
    const userId = session?.user?.id
    if (!userId) return { ok: false, error: 'missing_user' }
    if (mode === 'signout') {
      const r = await signOut()
      return { ok: !r?.error, error: r?.error || null }
    }
    try {
      await deviceSessionService.claimDevice({ userId })
      setDeviceLock(null)
      if (window.location.pathname !== '/dashboard') {
        window.history.replaceState({}, '', '/dashboard')
        window.dispatchEvent(new PopStateEvent('popstate'))
      }
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e?.message || String(e) }
    }
  }, [session?.user?.id, signOut])

  const signInWithOAuth = useCallback(async (provider, redirectPath = '/login') => {
    const origin = getAuthRedirectOrigin()
    const safePath = String(redirectPath || '/login').startsWith('/') ? String(redirectPath || '/login') : `/${String(redirectPath || 'login')}`
    const redirectTo = `${origin}${safePath}`;
    if (!origin) {
      return { data: null, error: { message: 'Origem de redirect inválida' } };
    }
    const providerKey = typeof provider === 'string' ? provider.toLowerCase() : provider
    const queryParams = providerKey === 'google'
      ? { prompt: 'select_account' }
      : undefined
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: providerKey,
      options: { redirectTo, skipBrowserRedirect: true, queryParams },
    });
    if (!error && !data?.url) {
      return { data, error: { message: 'Não foi possível obter a URL de autenticação' } }
    }
    if (!error && data?.url && typeof window !== 'undefined') {
      try {
        window.location.assign(data.url)
      } catch (_) {}
    }
    return { data, error };
  }, []);

  const resetPassword = useCallback(async (email) => {
    try {
      const trimmed = String(email || '').trim();
      if (trimmed) {
        try { localStorage.setItem('password_reset_email', trimmed); } catch (_) {}
      }
      const origin = getAuthRedirectOrigin()
      const redirectTo = `${origin}/reset-password`;
      let emailAttemptError = null
      let emailAttemptDetails = null
      try {
        const r = await fetch('/api/auth/password-recovery', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: trimmed, redirectTo }),
        })
        if (r.ok) return { error: null, mode: 'email' }
        try {
          const body = await r.json()
          if (body?.error) emailAttemptError = String(body.error)
          if (body?.details) emailAttemptDetails = body.details
        } catch (_) {}
      } catch (_) {}

      if (emailAttemptError && emailAttemptError !== 'missing_supabase_admin' && emailAttemptError !== 'supabase_generate_link_failed') {
        const extra = emailAttemptDetails ? ` (${typeof emailAttemptDetails === 'string' ? emailAttemptDetails : JSON.stringify(emailAttemptDetails)})` : ''
        return { error: { message: `Falha ao enviar email de recuperação. (${emailAttemptError})${extra}` } }
      }
      return { error: { message: 'Falha ao enviar email de recuperação. Tente novamente.' } }
    } catch (error) {
      console.error('Erro ao enviar recuperação de senha:', error);
      return { error: { message: error?.message || String(error) } };
    }
  }, []);

  const verifyEmailCode = useCallback(async (email, code, isPasswordReset = false) => {
    try {
      const storageKey = isPasswordReset ? `reset_code_${email}` : `verification_code_${email}`;
      const storedData = localStorage.getItem(storageKey);
      
      if (!storedData) {
        return { success: false, error: 'Código não encontrado ou expirado' };
      }
      
      const { code: storedCode, timestamp } = JSON.parse(storedData);
      
      // Verifica se o código expirou (10 minutos)
      if (Date.now() - timestamp > 10 * 60 * 1000) {
        localStorage.removeItem(storageKey);
        return { success: false, error: 'Código expirado' };
      }
      
      // Verifica se o código está correto
      if (code !== storedCode) {
        return { success: false, error: 'Código inválido' };
      }
      
      // Remove o código usado
      localStorage.removeItem(storageKey);
      
      if (isPasswordReset) {
        // Gera um token temporário para redefinição de senha
        const resetToken = Math.random().toString(36).substring(2, 15);
        localStorage.setItem(`reset_token_${email}`, JSON.stringify({
          token: resetToken,
          timestamp: Date.now(),
          email: email
        }));
        
        return { success: true, token: resetToken };
      }
      
      return { success: true };
    } catch (error) {
      console.error('Erro ao verificar código:', error);
      return { success: false, error: 'Erro interno' };
    }
  }, []);

  const resendVerificationCode = useCallback(async (email, isPasswordReset = false) => {
    try {
      // Gera um novo código de 6 dígitos
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      const storageKey = isPasswordReset ? `reset_code_${email}` : `verification_code_${email}`;
      
      // Armazena o novo código
      localStorage.setItem(storageKey, JSON.stringify({
        code: verificationCode,
        timestamp: Date.now(),
        email: email
      }));
      
      // Simula reenvio de email
      console.log(`Novo código para ${email}: ${verificationCode}`);
      
      return { success: true };
    } catch (error) {
      console.error('Erro ao reenviar código:', error);
      return { success: false, error: 'Erro ao reenviar código' };
    }
  }, []);

  const value = useMemo(() => ({
    user,
    session,
    loading,
    deviceLock,
    resolveDeviceLock,
    signUp,
    signUpWithEmailConfirmation,
    signIn,
    signOut,
    signInWithOAuth,
    resetPassword,
    verifyEmailCode,
    resendVerificationCode,
  }), [user, session, loading, deviceLock, resolveDeviceLock, signUp, signUpWithEmailConfirmation, signIn, signOut, signInWithOAuth, resetPassword, verifyEmailCode, resendVerificationCode]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
