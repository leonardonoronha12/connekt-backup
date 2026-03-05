import { createClient } from '@supabase/supabase-js';
const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!url || !anon) throw new Error('Env Supabase ausente: verifique VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY');

export const SUPABASE_URL = url
export const SUPABASE_ANON_KEY = anon

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

function createSupabaseClient(flowType) {
  return createClient(url, anon, {
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

export const supabase = createSupabaseClient('implicit')

export const supabasePkce = createSupabaseClient('pkce')
