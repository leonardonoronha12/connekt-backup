import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ucsijwfarkrljbkdvrbd.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjc2lqd2ZhcmtybGpia2R2cmJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0MDYwODksImV4cCI6MjA3NTk4MjA4OX0.-H3eogCZ4YNE4Fr8y_-c-T88VRGehUGlgiQtr7xaglY'

function qp(name) {
  try { return new URL(window.location.href).searchParams.get(name) || '' } catch { return '' }
}
const producerExternalId = qp('producer_id') || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
  global: {
    headers: {
      'x-producer-external-id': producerExternalId,
    }
  }
})