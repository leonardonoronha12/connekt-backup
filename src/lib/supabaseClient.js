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
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.VITE_PUBLIC_SUPABASE_URL ||
  injected.supabaseUrl ||
  '';
const rawAnon =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_KEY ||
  import.meta.env.VITE_PUBLIC_SUPABASE_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLIC_ANON_KEY ||
  injected.supabaseAnonKey ||
  '';

export const SUPABASE_URL = rawUrl
export const SUPABASE_ANON_KEY = rawAnon
export const SUPABASE_ENV_OK = Boolean(rawUrl && rawAnon)
export const SUPABASE_ENV_ERROR = SUPABASE_ENV_OK ? '' : 'Env Supabase ausente: verifique VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY'

function getAvailableStorage() {
  if (typeof window === 'undefined') return undefined
  try {
    const ls = window.localStorage
    if (ls) return ls
  } catch (_) {}
  try {
    const ss = window.sessionStorage
    if (ss) return ss
  } catch (_) {}
  return undefined
}

function migrateSupabaseAuthFromSessionToLocal() {
  if (typeof window === 'undefined') return
  let ss = null
  let ls = null
  try { ss = window.sessionStorage } catch (_) { ss = null }
  try { ls = window.localStorage } catch (_) { ls = null }
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
  return createClient(rawUrl, rawAnon, {
    global: {
      fetch: createRetryingFetch(fetch),
    },
    auth: {
      storage: getAvailableStorage(),
      flowType,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
}

export const supabase = createSupabaseClient('pkce')
export const supabasePkce = supabase
