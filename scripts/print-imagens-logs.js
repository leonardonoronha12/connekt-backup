import { createClient } from '@supabase/supabase-js'

async function main() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE
  if (!url || !serviceKey) {
    console.error('Missing SUPABASE URL or SERVICE ROLE key')
    process.exit(1)
  }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const { data, error } = await admin.from('imagens_logs').select('*').order('created_at', { ascending: false }).limit(5)
  if (error) {
    console.error('Select imagens_logs error:', error.message)
    process.exit(1)
  }
  console.log('imagens_logs (last 5):', data)
}

main().catch(err => { console.error('Script error:', err?.message || String(err)); process.exit(1) })