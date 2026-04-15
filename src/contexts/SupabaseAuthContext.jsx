import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { supabase, supabasePkce, SUPABASE_ENV_OK, SUPABASE_ENV_ERROR } from '@/lib/supabaseClient';
import { deviceSessionService } from '@/services/deviceSessionService';
import { getActiveProducerUserId, setActiveProducerUserId } from '@/services/producerScope'

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
      if (!isLocalhostOrigin(currentOrigin) && currentOrigin && envOrigin && currentOrigin !== envOrigin) return currentOrigin
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

function readStoredLoginMode() {
  try {
    const v = sessionStorage.getItem('connekt_login_mode')
    if (v) return String(v)
  } catch (_) {}
  try {
    const v = localStorage.getItem('connekt_login_mode')
    if (v) return String(v)
  } catch (_) {}
  return ''
}

function readWlHandoffTarget() {
  try {
    const host = String(window.location.hostname || '').toLowerCase()
    const path = String(window.location.pathname || '')
    if (host === 'app.connektco.com' && path === '/login-aluno') return ''
  } catch (_) {}
  const raw = (() => {
    try {
      const v = sessionStorage.getItem('connekt_wl_handoff_target') || localStorage.getItem('connekt_wl_handoff_target')
      return v ? String(v).trim() : ''
    } catch (_) {
      return ''
    }
  })()
  if (!raw) return ''
  const parts = raw.split('|')
  const host = String(parts[0] || '').trim().toLowerCase()
  const ts = Number(parts[1] || 0)
  const now = Date.now()
  const ttlMs = 15 * 60 * 1000
  if (!host || !Number.isFinite(ts) || ts <= 0 || now - ts > ttlMs) return ''
  if (!host.endsWith('.app.connektco.com') || host === 'app.connektco.com') return ''
  return host
}

function captureProducerScopeFromUrl(userId) {
  try {
    const path = String(window.location.pathname || '')
    const params = new URLSearchParams(window.location.search || '')
    const loginIntentParam = String(params.get('login_intent') || '').trim().toLowerCase()
    const hasProducerUidParam =
      !!params.get('producer_uid') ||
      !!params.get('producerUserId') ||
      !!params.get('producer_uid'.toUpperCase())
    const isAlunoContext =
      path === '/login-aluno' ||
      path === '/login-aluno-wl' ||
      path === '/aluno/login' ||
      path === '/aluno' ||
      path.startsWith('/aluno/') ||
      (path === '/login' && (loginIntentParam === 'aluno' || hasProducerUidParam))
    if (!isAlunoContext) return
    if (path === '/login' && (loginIntentParam === 'aluno' || hasProducerUidParam)) {
      try { sessionStorage.setItem('connekt_login_intent', 'aluno') } catch (_) { try { localStorage.setItem('connekt_login_intent', 'aluno') } catch (_) {} }
      try { localStorage.setItem('connekt_login_intent', 'aluno') } catch (_) {}
      try { sessionStorage.setItem('connekt_login_mode', 'aluno') } catch (_) { try { localStorage.setItem('connekt_login_mode', 'aluno') } catch (_) {} }
      try { localStorage.setItem('connekt_login_mode', 'aluno') } catch (_) {}
    }
    const producerUid =
      params.get('producer_uid') ||
      params.get('producerUserId') ||
      params.get('producer_uid'.toUpperCase()) ||
      ''
    if (producerUid) {
      setActiveProducerUserId(producerUid)
      try { sessionStorage.setItem('connekt_producer_uid', String(producerUid).trim()) } catch (_) { try { localStorage.setItem('connekt_producer_uid', String(producerUid).trim()) } catch (_) {} }
      try { localStorage.setItem('connekt_producer_uid', String(producerUid).trim()) } catch (_) {}
      return
    }
    const existing = getActiveProducerUserId()
    if (existing) return
    const uid = String(userId || '').trim()
    if (uid) setActiveProducerUserId(uid)
  } catch (_) {}
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deviceLock, setDeviceLock] = useState(null);
  const [pendingDeviceRequest, setPendingDeviceRequest] = useState(null)
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
    let cancelled = false
    const run = async () => {
      try {
        const host = String(window.location.hostname || '').toLowerCase()
        if (host !== 'app.connektco.com') return
        const path = String(window.location.pathname || '')
        const isAlunoPath = path === '/login-aluno-wl'
        if (!isAlunoPath) return
        const params = new URLSearchParams(window.location.search || '')
        const oauthProvider = String(params.get('oauth_provider') || '').trim().toLowerCase()
        const wlHostParam = String(params.get('wl_host') || '').trim().toLowerCase()
        const producerUid =
          params.get('producer_uid') ||
          params.get('producerUserId') ||
          params.get('producer_uid'.toUpperCase()) ||
          ''
        const pid = String(producerUid || '').trim()
        if (!pid) return
        try {
          const hasCode = !!params.get('code')
          const hasError = !!params.get('error') || !!params.get('error_code')
          let pendingCode = ''
          try { pendingCode = String(sessionStorage.getItem('connekt_pkce_pending_code') || '').trim() } catch (_) { pendingCode = '' }
          if (hasCode || hasError || pendingCode) return
        } catch (_) {}
        if (!wlHostParam && (path === '/login-aluno-wl')) return
        if (oauthProvider) {
          try {
            const wl = wlHostParam
            if (wl && wl.endsWith('.app.connektco.com') && wl !== host) {
              try { sessionStorage.setItem('connekt_wl_host', wl) } catch (_) { try { localStorage.setItem('connekt_wl_host', wl) } catch (_) {} }
            }
            try { sessionStorage.setItem('connekt_producer_uid', pid) } catch (_) { try { localStorage.setItem('connekt_producer_uid', pid) } catch (_) {} }
          } catch (_) {}
          return
        }
        const r = await fetch(`/api/producer?type=public_branding&producerId=${encodeURIComponent(pid)}`)
        const body = await r.json().catch(() => ({}))
        if (cancelled) return
        const memberAreaUrl = String(body?.member_area_url || '').trim()
        if (!memberAreaUrl) return
        let wlHost = ''
        try { wlHost = new URL(memberAreaUrl).host.toLowerCase() } catch (_) { wlHost = '' }
        if (!wlHost) return
        if (wlHost === host) return
        if (!wlHost.endsWith('.app.connektco.com')) return
        try { sessionStorage.setItem('connekt_wl_host', wlHost) } catch (_) { try { localStorage.setItem('connekt_wl_host', wlHost) } catch (_) {} }
        try { sessionStorage.setItem('connekt_producer_uid', pid) } catch (_) { try { localStorage.setItem('connekt_producer_uid', pid) } catch (_) {} }

        const sess = (await supabase.auth.getSession().catch(() => ({ data: null })))?.data?.session || null
        const at = String(sess?.access_token || '').trim()
        const rt = String(sess?.refresh_token || '').trim()
        if (at && rt) {
          return
        }
        window.location.assign(`https://${wlHost}/login-aluno-wl?producer_uid=${encodeURIComponent(pid)}`)
      } catch (_) {}
    }
    run()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const hash = String(window.location.hash || '')
        if (!hash || hash === '#' || (!hash.includes('sb_at=') && !hash.includes('sb_rt='))) return
        try { sessionStorage.setItem('connekt_setting_session_from_hash', '1') } catch (_) {}
        const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)
        const at = String(params.get('sb_at') || '').trim()
        const rt = String(params.get('sb_rt') || '').trim()
        if (!at || !rt) return
        try { sessionStorage.setItem('connekt_login_mode', 'aluno') } catch (_) { try { localStorage.setItem('connekt_login_mode', 'aluno') } catch (_) {} }
        const { data } = await supabase.auth.setSession({ access_token: at, refresh_token: rt }).catch(() => ({ data: null }))
        if (cancelled) return
        if (data?.session) {
          handleSession(data.session)
        }
      } catch (_) {}
      try {
        const clean = `${window.location.pathname}${window.location.search}`
        window.history.replaceState({}, '', clean)
        window.dispatchEvent(new PopStateEvent('popstate'))
      } catch (_) {}
      try { sessionStorage.removeItem('connekt_setting_session_from_hash') } catch (_) {}
    }
    run()
    return () => { cancelled = true }
  }, [handleSession])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const url = new URL(window.location.href)
        let code = String(url.searchParams.get('code') || '').trim()
        if (!code) {
          try { code = String(sessionStorage.getItem('connekt_pkce_pending_code') || '').trim() } catch (_) { code = '' }
        }
        if (!code) return
        if (String(url.searchParams.get('type') || '').toLowerCase() === 'recovery') return

        const guardKey = `connekt_pkce_code_used:${code}`
        try {
          if (sessionStorage.getItem(guardKey) === '1') return
          sessionStorage.setItem(guardKey, '1')
        } catch (_) {}

        try { sessionStorage.removeItem('connekt_pkce_pending_code') } catch (_) {}

        const { data, error } = await supabasePkce.auth.exchangeCodeForSession(code)
        if (cancelled) return
        if (error) {
          try {
            const url = new URL(window.location.href)
            const msg = String(error?.message || error?.error_description || 'Falha ao finalizar login com Google')
            url.searchParams.delete('code')
            url.searchParams.delete('state')
            url.searchParams.set('error', 'oauth_exchange_failed')
            url.searchParams.set('error_description', msg)
            window.history.replaceState({}, '', `${url.pathname}?${url.searchParams.toString()}`)
            window.dispatchEvent(new PopStateEvent('popstate'))
          } catch (_) {}
          return
        }
        if (data?.session) {
          try {
            await supabase.auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token })
          } catch (_) {}
          handleSession(data.session)
        }
      } catch (_) {}
    }
    run()
    return () => { cancelled = true }
  }, [handleSession])

  useEffect(() => {
    const getSession = async () => {
      try {
        if (!SUPABASE_ENV_OK) {
          handleSession(null)
          return
        }
        try {
          if (sessionStorage.getItem('connekt_setting_session_from_hash') === '1') return
        } catch (_) {}
        const { data: { session: currentSession } } = await withTimeout(supabase.auth.getSession(), 12000);
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
        handleSession(null);
      }
    };

    captureProducerScopeFromUrl()
    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        captureProducerScopeFromUrl(currentSession?.user?.id || null)
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
        if (event === 'INITIAL_SESSION') {
          try {
            const pathname = window.location.pathname
            const host = String(window.location.hostname || '').toLowerCase()
            const wlHostFromUrl = (() => {
              try { return String(new URLSearchParams(window.location.search || '').get('wl_host') || '').trim().toLowerCase() } catch (_) { return '' }
            })()
            const storedWlHost = String(sessionStorage.getItem('connekt_wl_host') || localStorage.getItem('connekt_wl_host') || '').trim().toLowerCase()
            const wlHandoffTarget = readWlHandoffTarget()
            const wl = String(wlHostFromUrl || wlHandoffTarget || '').trim().toLowerCase()
            if (
              host === 'app.connektco.com' &&
              wl &&
              wl !== host &&
              wl.endsWith('.app.connektco.com') &&
              pathname === '/login-aluno-wl' &&
              String(currentSession?.access_token || '').trim() &&
              String(currentSession?.refresh_token || '').trim()
            ) {
              const at = encodeURIComponent(String(currentSession.access_token))
              const rt = encodeURIComponent(String(currentSession.refresh_token))
              const producerUid = String(sessionStorage.getItem('connekt_producer_uid') || localStorage.getItem('connekt_producer_uid') || '').trim()
              const q = new URLSearchParams()
              if (producerUid) q.set('producer_uid', producerUid)
              try { sessionStorage.removeItem('connekt_wl_handoff_target') } catch (_) {}
              try { localStorage.removeItem('connekt_wl_handoff_target') } catch (_) {}
              window.location.assign(`https://${wl}/aluno${q.toString() ? `?${q.toString()}` : ''}#sb_at=${at}&sb_rt=${rt}`)
              return
            }
          } catch (_) {}

          try {
            if (!currentSession?.user?.id) return
            const pathname = String(window.location.pathname || '')
            const host = String(window.location.hostname || '').toLowerCase()
            const intent = readStoredLoginIntent()
            const isWhitelabelHost = host.endsWith('.app.connektco.com') && host !== 'app.connektco.com'
            const mode = readStoredLoginMode()
            const isAlunoLogin = pathname === '/login-aluno' || pathname === '/login-aluno-wl' || pathname === '/aluno/login' || (pathname === '/login' && (intent === 'aluno' || mode === 'aluno'))
            if (!isAlunoLogin) return
            if (!(intent === 'aluno' || isWhitelabelHost)) return

            const params = new URLSearchParams(window.location.search || '')
            const producerUidFromUrl =
              params.get('producer_uid') ||
              params.get('producerUserId') ||
              params.get('producer_uid'.toUpperCase()) ||
              ''
            const storedProducerUid = (() => {
              try {
                return String(sessionStorage.getItem('connekt_producer_uid') || localStorage.getItem('connekt_producer_uid') || '').trim()
              } catch (_) {
                return ''
              }
            })()
            const producerUid = String(producerUidFromUrl || storedProducerUid || getActiveProducerUserId() || '').trim()
            let target = '/aluno'
            if (host === 'app.connektco.com' && (pathname === '/login-aluno' || pathname === '/login')) {
              const q = new URLSearchParams()
              if (producerUid) q.set('producer_uid', producerUid)
              q.set('login_intent', 'aluno')
              target = `/aluno${q.toString() ? `?${q.toString()}` : ''}`
            } else {
              target = producerUid ? `/aluno?producer_uid=${encodeURIComponent(producerUid)}` : '/aluno'
            }
            window.history.replaceState({}, '', target)
            window.dispatchEvent(new PopStateEvent('popstate'))
            try { sessionStorage.removeItem('connekt_login_intent') } catch (_) {}
          } catch (_) {}

          try {
            if (!currentSession?.user?.id) return
            const pathname = String(window.location.pathname || '')
            if (pathname !== '/login') return
            const host = String(window.location.hostname || '').toLowerCase()
            const isWhitelabelHost = host.endsWith('.app.connektco.com') && host !== 'app.connektco.com'
            const intent = readStoredLoginIntent()
            if (intent === 'aluno' || isWhitelabelHost) return
            window.history.replaceState({}, '', '/dashboard')
            window.dispatchEvent(new PopStateEvent('popstate'))
            try { sessionStorage.removeItem('connekt_login_intent') } catch (_) {}
          } catch (_) {}
        }
        if (event === 'SIGNED_IN') {
          let isLocked = false
          const pathname = window.location.pathname
          const intent = readStoredLoginIntent()
          const mode = readStoredLoginMode()
          const host = String(window.location.hostname || '').toLowerCase()
          const isWhitelabelHost = host.endsWith('.app.connektco.com') && host !== 'app.connektco.com'
          const isStudentPath =
            pathname === '/login-aluno' ||
            pathname === '/login-aluno-wl' ||
            pathname === '/aluno/login' ||
            pathname === '/aluno' ||
            pathname.startsWith('/aluno/')
          const isStudentFlow = isWhitelabelHost ? true : (isStudentPath || intent === 'aluno' || mode === 'aluno')

          if (shouldEnforceDeviceLock) {
            try {
              const userId = currentSession?.user?.id
              if (userId) {
                const enforcement = await deviceSessionService.enforceDeviceLimit({ userId })
                if (enforcement?.ok && enforcement.allowed) {
                  await deviceSessionService.claimDevice({ userId })
                  setDeviceLock(null)
                } else if (enforcement?.ok && enforcement.allowed === false) {
                  isLocked = true
                  setDeviceLock({
                    reason: enforcement.reason || 'other_device',
                    deviceType: enforcement.deviceType || null,
                    activeDevice: enforcement.activeDevice || null,
                    pending: enforcement.pending || null,
                  })
                }
              }
            } catch (_) {}
          } else {
            setDeviceLock(null)
          }

          const params = new URLSearchParams(window.location.search);
          const hasEmailConfirmedParam = params.get('email_confirmed') === 'true';
          const arrivedFromRoot = pathname === '/' || pathname === '/index.html';
          const arrivedFromAuth = pathname === '/login' || pathname === '/verify-email' || pathname === '/login-aluno' || pathname === '/login-aluno-wl' || pathname === '/aluno/login';
          const shouldRedirect = (arrivedFromRoot || arrivedFromAuth) && pathname !== '/reset-password';

          const producerUidFromUrl =
            params.get('producer_uid') ||
            params.get('producerUserId') ||
            params.get('producer_uid'.toUpperCase()) ||
            ''
          const storedProducerUid = (() => {
            try {
              return String(sessionStorage.getItem('connekt_producer_uid') || localStorage.getItem('connekt_producer_uid') || '').trim()
            } catch (_) {
              return ''
            }
          })()
          const producerUid = String(producerUidFromUrl || storedProducerUid || getActiveProducerUserId() || '').trim()
          const isNormalAlunoLogin = host === 'app.connektco.com' && String(pathname || '') === '/login-aluno'
          if (producerUid && !isNormalAlunoLogin) {
            try { sessionStorage.setItem('connekt_producer_uid', producerUid) } catch (_) { try { localStorage.setItem('connekt_producer_uid', producerUid) } catch (_) {} }
          }

          const wlHostFromUrl = String(params.get('wl_host') || '').trim().toLowerCase()
          const loginIntentParam = String(params.get('login_intent') || '').trim().toLowerCase()
          const forceNonWlAluno =
            host === 'app.connektco.com' &&
            (pathname === '/login-aluno' || (pathname === '/login' && loginIntentParam === 'aluno')) &&
            !wlHostFromUrl
          if (forceNonWlAluno) {
            try { sessionStorage.removeItem('connekt_wl_host') } catch (_) {}
            try { localStorage.removeItem('connekt_wl_host') } catch (_) {}
            try { sessionStorage.removeItem('connekt_wl_handoff_target') } catch (_) {}
            try { localStorage.removeItem('connekt_wl_handoff_target') } catch (_) {}
          }
          const storedWlHost = (() => {
            try {
              return String(sessionStorage.getItem('connekt_wl_host') || localStorage.getItem('connekt_wl_host') || '').trim().toLowerCase()
            } catch (_) {
              return ''
            }
          })()
          const wlHandoffTarget = readWlHandoffTarget()
          const wlHost = forceNonWlAluno ? '' : String(wlHostFromUrl || wlHandoffTarget || storedWlHost || '').trim().toLowerCase()
          if (wlHost) {
            try { sessionStorage.setItem('connekt_wl_host', wlHost) } catch (_) { try { localStorage.setItem('connekt_wl_host', wlHost) } catch (_) {} }
          }

          const shouldHandoff =
            isStudentFlow &&
            (wlHostFromUrl || wlHandoffTarget) &&
            wlHost !== host &&
            host === 'app.connektco.com' &&
            wlHost.endsWith('.app.connektco.com') &&
            !isNormalAlunoLogin &&
            String(currentSession?.access_token || '').trim() &&
            String(currentSession?.refresh_token || '').trim()
          if (shouldHandoff) {
            const at = encodeURIComponent(String(currentSession.access_token))
            const rt = encodeURIComponent(String(currentSession.refresh_token))
            const q = new URLSearchParams()
            if (producerUid) q.set('producer_uid', producerUid)
            try { sessionStorage.removeItem('connekt_wl_handoff_target') } catch (_) {}
            try { localStorage.removeItem('connekt_wl_handoff_target') } catch (_) {}
            window.location.assign(`https://${wlHost}/aluno${q.toString() ? `?${q.toString()}` : ''}#sb_at=${at}&sb_rt=${rt}`)
            return
          }

          if (shouldRedirect && !isLocked) {
            let target = '/dashboard'
            if (isStudentFlow) {
              if (host === 'app.connektco.com') {
                const q = new URLSearchParams()
                if (producerUid) q.set('producer_uid', String(producerUid))
                q.set('login_intent', 'aluno')
                target = `/aluno${q.toString() ? `?${q.toString()}` : ''}`
              } else {
                target = producerUid ? `/aluno?producer_uid=${encodeURIComponent(String(producerUid))}` : '/aluno'
              }
            } else {
              target = (hasEmailConfirmedParam || arrivedFromRoot ? '/dashboard?email_confirmed=true' : '/dashboard')
            }
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
          const isAlunoFlow = mode === 'aluno' || path === '/aluno' || path.startsWith('/aluno/') || path === '/login-aluno' || path === '/login-aluno-wl' || path === '/aluno/login'
          const host = String(window.location.hostname || '').toLowerCase()
          const isWhitelabelHost = host.endsWith('.app.connektco.com') && host !== 'app.connektco.com'
          const target = isAlunoFlow ? (isWhitelabelHost ? '/login-aluno-wl' : '/login-aluno') : '/login'
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
    let inflightController = null

    const doHeartbeat = async () => {
      try {
        if (inflightController) {
          try { inflightController.abort() } catch (_) {}
        }
        inflightController = new AbortController()
        const r = await deviceSessionService.enforceDeviceLimit({ userId, signal: inflightController.signal })
        if (cancelled) return
        if (r?.aborted) return
        if (r?.ok && r.allowed === false) {
          setDeviceLock({
            reason: r.reason || 'other_device',
            deviceType: r.deviceType || null,
            activeDevice: r.activeDevice || null,
            pending: r.pending || null,
          })
          return
        }
        await deviceSessionService.heartbeat({ userId })
      } catch (_) {}
    }

    doHeartbeat()
    const heartbeatInterval = window.setInterval(doHeartbeat, 60 * 1000)
    return () => {
      cancelled = true
      if (inflightController) {
        try { inflightController.abort() } catch (_) {}
      }
      window.clearInterval(heartbeatInterval)
    }
  }, [user?.id, deviceLock, shouldEnforceDeviceLock])

  useEffect(() => {
    if (!shouldEnforceDeviceLock) return
    if (!user?.id) return
    if (!deviceLock) return
    let cancelled = false
    const userId = user.id
    const tick = async () => {
      try {
        const r = await deviceSessionService.enforceDeviceLimit({ userId })
        if (cancelled) return
        if (r?.ok && r.allowed) {
          await deviceSessionService.claimDevice({ userId })
          if (cancelled) return
          setDeviceLock(null)
          if (window.location.pathname === '/login') {
            window.history.replaceState({}, '', '/dashboard')
            window.dispatchEvent(new PopStateEvent('popstate'))
          }
        }
      } catch (_) {}
    }
    tick()
    const id = window.setInterval(tick, 3000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [user?.id, deviceLock, shouldEnforceDeviceLock])

  const signUp = useCallback(async (email, password, options) => {
    if (!SUPABASE_ENV_OK) return { error: { message: SUPABASE_ENV_ERROR } }
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options,
    });

    return { error };
  }, []);

  const signUpWithEmailConfirmation = useCallback(async ({ email, password, userMetadata, redirectTo, producerUid, wlHost }) => {
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
          producer_uid: producerUid || undefined,
          wl_host: wlHost || undefined,
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
    if (!SUPABASE_ENV_OK) return { error: { message: SUPABASE_ENV_ERROR } }
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

    let error = null
    try {
      const r = await supabase.auth.signOut({ scope: 'local' })
      error = r?.error || null
    } catch (_) {
      error = null
    }
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
      if (mode === 'request') {
        const req = await deviceSessionService.requestDeviceAccess()
        if (!req?.ok) return { ok: false, error: req?.error || 'request_failed' }
        setDeviceLock((prev) => ({
          ...(prev || {}),
          reason: 'awaiting_approval',
          deviceType: req.deviceType || (prev?.deviceType || null),
          pending: req.pending || prev?.pending || null,
        }))
        return { ok: true, requested: true }
      }
      return { ok: false, error: 'unsupported_mode' }
    } catch (e) {
      return { ok: false, error: e?.message || String(e) }
    }
  }, [session?.user?.id, signOut])

  const refreshPendingDeviceRequest = useCallback(async () => {
    try {
      const currentUserId = user?.id
      if (!currentUserId) return
      const currentDeviceId = deviceSessionService.getOrCreateDeviceId()
      const r = await deviceSessionService.getDeviceAccessState()
      if (!r?.ok) return
      const pending = r?.state?.pending || null
      if (!pending?.device_id || String(pending.device_id) === String(currentDeviceId)) {
        setPendingDeviceRequest(null)
        return
      }
      if (!pending?.device_type) {
        setPendingDeviceRequest(null)
        return
      }
      setPendingDeviceRequest(pending)
    } catch (_) {}
  }, [user?.id])

  useEffect(() => {
    if (!shouldEnforceDeviceLock) return
    if (!user?.id) return
    let cancelled = false
    const run = async () => {
      if (cancelled) return
      await refreshPendingDeviceRequest()
    }
    run()
    const id = window.setInterval(run, 5000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [user?.id, shouldEnforceDeviceLock, refreshPendingDeviceRequest])

  const approveDeviceRequest = useCallback(async () => {
    const r = await deviceSessionService.approvePendingDeviceAccess().catch(() => null)
    await refreshPendingDeviceRequest()
    return { ok: !!r?.ok, error: r?.error || null }
  }, [refreshPendingDeviceRequest])

  const denyDeviceRequest = useCallback(async () => {
    const r = await deviceSessionService.denyPendingDeviceAccess().catch(() => null)
    await refreshPendingDeviceRequest()
    return { ok: !!r?.ok, error: r?.error || null }
  }, [refreshPendingDeviceRequest])

  const signInWithOAuth = useCallback(async (provider, redirectPath = '/login') => {
    if (!SUPABASE_ENV_OK) return { data: null, error: { message: SUPABASE_ENV_ERROR } }
    const currentHost = String(window.location.hostname || '').toLowerCase()
    const isWhitelabelHost = currentHost.endsWith('.app.connektco.com') && currentHost !== 'app.connektco.com'
    const currentOrigin = (() => {
      try { return String(window.location.origin || '').trim() } catch (_) { return '' }
    })()

    let envOrigin = ''
    try {
      const envUrl = import.meta?.env?.VITE_SITE_URL || import.meta?.env?.VITE_APP_BASE_URL || ''
      if (envUrl) envOrigin = new URL(String(envUrl).trim()).origin
    } catch (_) {
      envOrigin = ''
    }

    const rawPath = String(redirectPath || '/login')
    const safePath = rawPath.startsWith('/') ? rawPath : `/${String(rawPath || 'login')}`
    const intent = readStoredLoginIntent()
    const isAlunoRedirect =
      safePath.startsWith('/login-aluno') ||
      safePath.startsWith('/aluno/login') ||
      safePath.startsWith('/aluno?') ||
      safePath === '/aluno'
    const isNormalAlunoLoginRedirect =
      currentHost === 'app.connektco.com' &&
      safePath.startsWith('/login-aluno') &&
      !safePath.startsWith('/login-aluno-wl')
    const authClient = supabasePkce

    const providerKey = typeof provider === 'string' ? provider.toLowerCase() : provider
    const queryParams = providerKey === 'google'
      ? { prompt: 'select_account' }
      : undefined
    const scopes = providerKey === 'facebook' ? 'email' : undefined

    const withWlHostParam = (origin) => {
      try {
        const u = new URL(`${origin}${safePath}`)
        if (!u.searchParams.get('wl_host')) u.searchParams.set('wl_host', currentHost)
        return `${u.pathname}${u.search}`
      } catch (_) {
        return safePath
      }
    }

    const runOAuth = async ({ origin, path, ensureWlHost }) => {
      const base = String(origin || '').trim()
      if (!base) return { data: null, error: { message: 'Origem de redirect inválida' } }
      const p = ensureWlHost ? withWlHostParam(base) : path
      const redirectTo = `${base}${p}`
      const { data, error } = await authClient.auth.signInWithOAuth({
        provider: providerKey,
        options: { redirectTo, queryParams, scopes },
      })
      return { data, error }
    }

    const looksRedirectBlocked = (e) => {
      const msg = String(e?.message || e || '').toLowerCase()
      return msg.includes('redirect') || msg.includes('not allowed') || msg.includes('not authorized') || msg.includes('invalid')
    }

    let result = null
    if (isWhitelabelHost && currentOrigin) {
      result = await runOAuth({ origin: currentOrigin, path: safePath, ensureWlHost: false })
      if (result?.error && envOrigin && looksRedirectBlocked(result.error)) {
        result = await runOAuth({ origin: envOrigin, path: safePath, ensureWlHost: true })
      }
    } else {
      const origin = getAuthRedirectOrigin()
      result = await runOAuth({ origin, path: safePath, ensureWlHost: false })
    }

    const { data, error } = result || { data: null, error: { message: 'Falha ao iniciar OAuth' } }
    if (!error && !data?.url) {
      return { data, error: { message: 'Não foi possível obter a URL de autenticação' } }
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

  useEffect(() => {
    let active = true
    const isExpired = (expiresAtIso) => {
      const v = String(expiresAtIso || '').trim()
      if (!v) return false
      const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/)
      if (!m) return false
      const endMs = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999)
      return Date.now() > endMs
    }
    const shouldSync = () => {
      try {
        const mode = String(sessionStorage.getItem('connekt_login_mode') || localStorage.getItem('connekt_login_mode') || '').trim().toLowerCase()
        if (mode === 'aluno') return true
      } catch (_) {}
      try {
        const path = String(window.location.pathname || '')
        if (path === '/aluno' || path.startsWith('/aluno/')) return true
      } catch (_) {}
      return false
    }
    const run = async () => {
      if (!user?.id) return
      if (!shouldSync()) return
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('type,entity_type,entity_id,data,created_at')
          .eq('type', 'purchase_confirmed')
          .order('created_at', { ascending: false })
          .limit(500)
        if (!active) return
        if (error) return
        for (const row of Array.isArray(data) ? data : []) {
          const entityType = String(row?.entity_type || '').trim().toLowerCase()
          const entityId = String(row?.entity_id || '').trim()
          const dataObj = row?.data && typeof row.data === 'object' ? row.data : null
          const dataType = String(dataObj?.type || '').trim().toLowerCase()
          const expiresAt = String(dataObj?.expires_at || dataObj?.expiresAt || '').trim()
          const expired = expiresAt ? isExpired(expiresAt) : false

          if (entityType === 'course' || dataType === 'course') {
            const cid = entityId || String(dataObj?.courseId || dataObj?.course_id || '').trim()
            if (!cid) continue
            const k = `connekt_course_owned:${cid}`
            try {
              if (expired) localStorage.removeItem(k)
              else localStorage.setItem(k, '1')
            } catch (_) {}
          }
          if (entityType === 'module' || dataType === 'module') {
            const cid = String(dataObj?.courseId || dataObj?.course_id || '').trim()
            const mid = entityId || String(dataObj?.moduleId || dataObj?.module_id || '').trim()
            if (!cid || !mid) continue
            const k = `connekt_module_owned:${cid}:${mid}`
            try {
              if (expired) localStorage.removeItem(k)
              else localStorage.setItem(k, '1')
            } catch (_) {}
          }
          if (entityType === 'simulado' || dataType === 'simulado') {
            const sid = entityId || String(dataObj?.simId || dataObj?.sim_id || '').trim()
            if (!sid) continue
            const k = `connekt_simulado_owned:${sid}`
            try {
              if (expired) localStorage.removeItem(k)
              else localStorage.setItem(k, '1')
            } catch (_) {}
          }
        }
      } catch (_) {}
    }
    run()
    return () => { active = false }
  }, [user?.id])

  const value = useMemo(() => ({
    user,
    session,
    loading,
    deviceLock,
    pendingDeviceRequest,
    approveDeviceRequest,
    denyDeviceRequest,
    resolveDeviceLock,
    signUp,
    signUpWithEmailConfirmation,
    signIn,
    signOut,
    signInWithOAuth,
    resetPassword,
    verifyEmailCode,
    resendVerificationCode,
  }), [user, session, loading, deviceLock, pendingDeviceRequest, approveDeviceRequest, denyDeviceRequest, resolveDeviceLock, signUp, signUpWithEmailConfirmation, signIn, signOut, signInWithOAuth, resetPassword, verifyEmailCode, resendVerificationCode]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
