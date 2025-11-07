import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

function qp(name) {
  try { return new URL(window.location.href).searchParams.get(name) || '' } catch { return '' }
}
const producerExternalId = qp('producer_id') || ''

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
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
  : null

if (!isSupabaseConfigured) {
  // Ajuda durante desenvolvimento para evitar quebra da aplicação
  console.error('[Supabase] Variáveis de ambiente faltando: VITE_SUPABASE_URL e/ou VITE_SUPABASE_ANON_KEY')
}