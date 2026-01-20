import { createClient } from '@supabase/supabase-js';
const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!url || !anon) throw new Error('Env Supabase ausente: verifique VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY');

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

export const supabase = createClient(url, anon, {
  global: {
    fetch: createRetryingFetch(fetch),
  },
  auth: {
    storage: (typeof window !== 'undefined' && window.sessionStorage) ? window.sessionStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
