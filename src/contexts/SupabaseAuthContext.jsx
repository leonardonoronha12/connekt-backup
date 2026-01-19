import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { deviceSessionService } from '@/services/deviceSessionService';

const AuthContext = createContext(undefined);

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
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        handleSession(currentSession);
      } catch (e) {
        const msg = (e && (e.message || e.error_description || e.msg)) ? (e.message || e.error_description || e.msg) : String(e);
        const msgLower = String(msg || '').toLowerCase()
        const isNetworkError =
          msgLower.includes('failed to fetch') ||
          msgLower.includes('networkerror') ||
          msgLower.includes('load failed') ||
          msgLower.includes('err_network') ||
          msgLower.includes('network');
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

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
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
          if (shouldEnforceDeviceLock) {
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
          const pathname = window.location.pathname;
          const arrivedFromRoot = pathname === '/' || pathname === '/index.html';
          const arrivedFromAuth = pathname === '/login' || pathname === '/verify-email' || pathname === '/login-aluno' || pathname === '/aluno/login';
          const shouldRedirect = (arrivedFromRoot || arrivedFromAuth) && pathname !== '/reset-password';
          if (shouldRedirect && !isLocked) {
            const isStudentFlow = pathname === '/login-aluno' || pathname === '/aluno/login';
            const target = isStudentFlow
              ? '/aluno'
              : (hasEmailConfirmedParam || arrivedFromRoot ? '/dashboard?email_confirmed=true' : '/dashboard');
            window.history.replaceState({}, '', target);
            window.dispatchEvent(new PopStateEvent('popstate'));
          }
        }
        // Opcional: em SIGNED_OUT, volta para login
        if (event === 'SIGNED_OUT') {
          setDeviceLock(null)
          const path = window.location.pathname || ''
          const target = (path === '/aluno' || path.startsWith('/aluno/') || path === '/login-aluno') ? '/login-aluno' : '/login'
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

  const getAuthRedirectOrigin = useCallback(() => {
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
  }, [])

  const signInWithOAuth = useCallback(async (provider, redirectPath = '/login') => {
    const origin = getAuthRedirectOrigin()
    const safePath = String(redirectPath || '/login').startsWith('/') ? String(redirectPath || '/login') : `/${String(redirectPath || 'login')}`
    const redirectTo = `${origin}${safePath}`;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (!error && data?.url && typeof window !== 'undefined') {
      try {
        window.location.assign(data.url)
      } catch (_) {}
    }
    return { data, error };
  }, [getAuthRedirectOrigin]);

  const resetPassword = useCallback(async (email) => {
    try {
      const trimmed = String(email || '').trim();
      if (trimmed) {
        try { localStorage.setItem('password_reset_email', trimmed); } catch (_) {}
      }
      const origin = getAuthRedirectOrigin()
      const redirectTo = `${origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, { redirectTo });
      if (!error) return { error: null, mode: 'supabase' };

      // Gera um código de 6 dígitos
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Armazena o código temporariamente (em produção, usar banco de dados)
      localStorage.setItem(`reset_code_${trimmed}`, JSON.stringify({
        code: verificationCode,
        timestamp: Date.now(),
        email: trimmed
      }));
      
      // Simula envio de email (em produção, usar serviço de email)
      console.log(`Código de recuperação para ${trimmed}: ${verificationCode}`);
      
      return { error: null, mode: 'code' };
    } catch (error) {
      console.error('Erro ao gerar código de recuperação:', error);
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
    signIn,
    signOut,
    signInWithOAuth,
    resetPassword,
    verifyEmailCode,
    resendVerificationCode,
  }), [user, session, loading, deviceLock, resolveDeviceLock, signUp, signIn, signOut, signInWithOAuth, resetPassword, verifyEmailCode, resendVerificationCode]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
