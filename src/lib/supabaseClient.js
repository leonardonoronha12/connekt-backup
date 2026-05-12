import { createClient } from '@supabase/supabase-js';
const injected = (() => {
  if (typeof window === 'undefined') return {}
  try {
    const o = window.__CONNEKT__ || window.__CONNEKT_PUBLIC_CONFIG__ || {}
    if (!o || typeof o !== 'object') return {}
    const supabaseUrl = o.supabaseUrl ? String(o.supabaseUrl).trim() : ''
    const supabaseAnonKey = o.supabaseAnonKey ? String(o.supabaseAnonKey).trim() : ''
    return { supabaseUrl, supabaseAnonKey }
  } catch (_) {
    return {}
  }
})()

const rawUrl =
  injected.supabaseUrl ||
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.VITE_PUBLIC_SUPABASE_URL ||
  '';
const rawAnon =
  injected.supabaseAnonKey ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_KEY ||
  import.meta.env.VITE_PUBLIC_SUPABASE_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLIC_ANON_KEY ||
  '';

export const SUPABASE_URL = rawUrl
export const SUPABASE_ANON_KEY = rawAnon
export const SUPABASE_ENV_OK = Boolean(rawUrl && rawAnon)
export const SUPABASE_ENV_ERROR = SUPABASE_ENV_OK ? '' : 'Env Supabase ausente: verifique VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY'

function getStorages() {
  if (typeof window === 'undefined') return { ls: null, ss: null }
  let ls = null
  let ss = null
  try { ls = window.localStorage } catch (_) { ls = null }
  try { ss = window.sessionStorage } catch (_) { ss = null }
  return { ls, ss }
}

function createDualStorage() {
  const { ls, ss } = getStorages()
  if (!ls && !ss) return undefined

  const shouldCookie = (k) => {
    const key = String(k || '').toLowerCase()
    return key.includes('code-verifier') || key.includes('code_verifier') || key.includes('verifier') || key.includes('pkce')
  }

  const cookieNameForKey = (k) => {
    try {
      const raw = String(k || '')
      const b64 = btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
      return `ck_${b64}`
    } catch (_) {
      return ''
    }
  }

  const cookieGet = (name) => {
    try {
      const all = String(document.cookie || '')
      if (!all) return null
      const parts = all.split(';')
      for (const p of parts) {
        const s = String(p || '').trim()
        if (!s) continue
        if (!s.startsWith(`${name}=`)) continue
        const v = s.slice(name.length + 1)
        try { return decodeURIComponent(v) } catch (_) { return v }
      }
      return null
    } catch (_) {
      return null
    }
  }

  const cookieSet = (name, value, maxAgeSec = 900) => {
    try {
      if (!name) return
      const v = encodeURIComponent(String(value ?? ''))
      let cookie = `${name}=${v}; Max-Age=${Math.max(1, Number(maxAgeSec || 0) || 900)}; Path=/; SameSite=Lax`
      try {
        if (String(window.location?.protocol || '') === 'https:') cookie += '; Secure'
      } catch (_) {}
      document.cookie = cookie
    } catch (_) {}
  }

  const cookieDel = (name) => {
    try {
      if (!name) return
      let cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`
      try {
        if (String(window.location?.protocol || '') === 'https:') cookie += '; Secure'
      } catch (_) {}
      document.cookie = cookie
    } catch (_) {}
  }

  return {
    getItem(key) {
      const k = String(key || '')
      try {
        const v = ls?.getItem?.(k)
        if (v != null) return v
      } catch (_) {}
      try {
        const v = ss?.getItem?.(k)
        if (v != null) return v
      } catch (_) {}
      if (shouldCookie(k)) {
        const cn = cookieNameForKey(k)
        const v = cn ? cookieGet(cn) : null
        if (v != null) {
          try { ls?.setItem?.(k, v) } catch (_) {}
          try { ss?.setItem?.(k, v) } catch (_) {}
          return v
        }
      }
      return null
    },
    setItem(key, value) {
      const k = String(key || '')
      const v = String(value ?? '')
      try { ls?.setItem?.(k, v) } catch (_) {}
      try { ss?.setItem?.(k, v) } catch (_) {}
      if (shouldCookie(k)) {
        const cn = cookieNameForKey(k)
        if (cn) cookieSet(cn, v, 900)
      }
    },
    removeItem(key) {
      const k = String(key || '')
      try { ls?.removeItem?.(k) } catch (_) {}
      try { ss?.removeItem?.(k) } catch (_) {}
      if (shouldCookie(k)) {
        const cn = cookieNameForKey(k)
        if (cn) cookieDel(cn)
      }
    },
  }
}

function migrateSupabaseAuthFromSessionToLocal() {
  if (typeof window === 'undefined') return
  const { ss, ls } = getStorages()
  if (!ss || !ls) return
  try {
    const keys = Object.keys(ss || {})
    for (const k of keys) {
      const key = String(k || '')
      const isSupabaseKey = (key.startsWith('sb-') && key.endsWith('-auth-token')) || key === 'supabase.auth.token'
      if (!isSupabaseKey) continue
      const v = ss.getItem(key)
      if (!v) continue
      if (!ls.getItem(key)) {
        try { ls.setItem(key, v) } catch (_) {}
      }
    }
  } catch (_) {}
}

function isRetryableNetworkError(err) {
  const msg = String(err?.message || err || '').toLowerCase()
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('load failed') ||
    msg.includes('err_network') ||
    msg.includes('err_connection') ||
    msg.includes('quic') ||
    msg.includes('too_many_rtos')
  )
}

function createTimeoutFetch(baseFetch, timeouts) {
  const cfg = timeouts && typeof timeouts === 'object' ? timeouts : {}
  const defaultMs = Math.max(0, Number(cfg.defaultMs || 0) || 0)
  const authMs = Math.max(0, Number(cfg.authMs || 0) || 0)
  const storageMs = Math.max(0, Number(cfg.storageMs || 0) || 0)
  const pickMs = (input) => {
    let url = ''
    try {
      if (typeof input === 'string') url = input
      else if (input && typeof input === 'object' && typeof input.url === 'string') url = input.url
    } catch (_) { url = '' }
    const u = String(url || '')
    if (authMs && u.includes('/auth/v1/')) return authMs
    if (storageMs && u.includes('/storage/v1/')) return storageMs
    return defaultMs
  }
  if (!defaultMs && !authMs && !storageMs) return baseFetch
  return async (input, init = {}) => {
    const ms = pickMs(input)
    const controller = new AbortController()
    const t = ms ? setTimeout(() => controller.abort(), ms) : null
    const onAbort = () => controller.abort()
    try {
      const signal = init?.signal
      if (signal) {
        if (signal.aborted) controller.abort()
        else {
          try { signal.addEventListener('abort', onAbort, { once: true }) } catch (_) {}
        }
      }
      return await baseFetch(input, { ...init, signal: controller.signal })
    } finally {
      try { if (t) clearTimeout(t) } catch (_) {}
      try {
        const signal = init?.signal
        if (signal) signal.removeEventListener('abort', onAbort)
      } catch (_) {}
    }
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function createRetryingFetch(baseFetch) {
  return async (input, init = {}) => {
    const method = String(init?.method || 'GET').toUpperCase()
    const isIdempotent = method === 'GET' || method === 'HEAD'
    if (!isIdempotent) return baseFetch(input, init)

    const maxAttempts = 3
    let attempt = 0
    while (attempt < maxAttempts) {
      try {
        return await baseFetch(input, init)
      } catch (e) {
        attempt += 1
        if (attempt >= maxAttempts || !isRetryableNetworkError(e)) throw e
        await sleep(250 * attempt)
      }
    }
  }
}

migrateSupabaseAuthFromSessionToLocal()

function disabledError() {
  return { message: SUPABASE_ENV_ERROR }
}

function createDisabledQueryBuilder() {
  const builder = {}
  const chain = () => builder
  const result = () => ({ data: null, error: disabledError() })

  Object.assign(builder, {
    select: chain,
    insert: chain,
    update: chain,
    upsert: chain,
    delete: chain,
    eq: chain,
    neq: chain,
    gt: chain,
    gte: chain,
    lt: chain,
    lte: chain,
    in: chain,
    is: chain,
    order: chain,
    limit: chain,
    range: chain,
    single: chain,
    maybeSingle: chain,
    match: chain,
    filter: chain,
    contains: chain,
    like: chain,
    ilike: chain,
    then: (resolve, reject) => Promise.resolve(result()).then(resolve, reject),
    catch: (reject) => Promise.resolve(result()).catch(reject),
    finally: (cb) => Promise.resolve(result()).finally(cb),
  })

  return builder
}

function createDisabledStorageBucket() {
  const err = disabledError()
  return {
    upload: async () => ({ data: null, error: err }),
    update: async () => ({ data: null, error: err }),
    remove: async () => ({ data: null, error: err }),
    list: async () => ({ data: null, error: err }),
    getPublicUrl: () => ({ data: { publicUrl: '' }, error: err }),
    createSignedUrl: async () => ({ data: null, error: err }),
    createSignedUrls: async () => ({ data: null, error: err }),
  }
}

function createDisabledChannel() {
  return {
    on() { return this },
    subscribe() { return this },
    unsubscribe() { return this },
  }
}

function createDisabledSupabaseClient() {
  return {
    auth: {
      getSession: async () => ({ data: { session: null }, error: disabledError() }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } }, error: null }),
      signInWithOAuth: async () => ({ data: null, error: disabledError() }),
      signInWithPassword: async () => ({ data: null, error: disabledError() }),
      signUp: async () => ({ data: null, error: disabledError() }),
      signOut: async () => ({ error: null }),
      setSession: async () => ({ data: null, error: disabledError() }),
      exchangeCodeForSession: async () => ({ data: null, error: disabledError() }),
    },
    from: () => createDisabledQueryBuilder(),
    rpc: () => createDisabledQueryBuilder(),
    storage: {
      from: () => createDisabledStorageBucket(),
      createBucket: async () => ({ data: null, error: disabledError() }),
    },
    functions: {
      invoke: async () => ({ data: null, error: disabledError() }),
    },
    channel: () => createDisabledChannel(),
    removeChannel: () => {},
  }
}

function createSupabaseClient(flowType) {
  if (!SUPABASE_ENV_OK) return createDisabledSupabaseClient()
  const projectRef = (() => {
    try {
      const u = new URL(String(rawUrl || '').trim())
      const host = String(u.hostname || '')
      const m = host.match(/^([a-z0-9-]+)\.supabase\.co$/i)
      return m ? String(m[1] || '') : ''
    } catch (_) {
      return ''
    }
  })()
  const wantsIsolatedStorage = String(flowType || '').toLowerCase() === 'implicit'
  const storageKey = wantsIsolatedStorage && projectRef ? `sb-${projectRef}-auth-token-implicit` : undefined
  const persistSession = wantsIsolatedStorage ? false : true
  const autoRefreshToken = wantsIsolatedStorage ? false : true
  const timeoutDefaults = (() => {
    const read = (k, fallback) => {
      const raw = import.meta.env?.[k] || ''
      const n = Number(raw)
      return Number.isFinite(n) && n > 0 ? n : fallback
    }
    const defaultMs = read('VITE_SUPABASE_FETCH_TIMEOUT_MS', read('VITE_FETCH_TIMEOUT_MS', 15000))
    const authMs = read('VITE_SUPABASE_AUTH_FETCH_TIMEOUT_MS', 45000)
    const storageMs = read('VITE_SUPABASE_STORAGE_FETCH_TIMEOUT_MS', 60000)
    return { defaultMs, authMs, storageMs }
  })()

  const client = createClient(rawUrl, rawAnon, {
    global: {
      fetch: createRetryingFetch(createTimeoutFetch(fetch, timeoutDefaults)),
    },
    auth: {
      storage: createDualStorage(),
      flowType,
      storageKey,
      persistSession,
      autoRefreshToken,
      detectSessionInUrl: false,
    },
  })

  return client
}

export const supabase = createSupabaseClient('pkce')
export const supabasePkce = supabase
export const supabaseImplicit = createSupabaseClient('implicit')
