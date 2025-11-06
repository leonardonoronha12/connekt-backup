import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

function qp(name) {
  try { return new URL(window.location.href).searchParams.get(name) || '' } catch { return '' }
}
const producerExternalId = qp('producer_id') || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { 
    autoRefreshToken: true, 
    persistSession: true, 
    detectSessionInUrl: true,
    redirectTo: `${window.location.origin}/dashboard?email_confirmed=true`
  },
  global: {
    headers: {
      'x-producer-external-id': producerExternalId,
    }
  }
})