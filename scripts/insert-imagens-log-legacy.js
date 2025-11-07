import { createClient } from '@supabase/supabase-js'

async function main() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE
  if (!url || !serviceKey) {
    console.error('Missing SUPABASE URL or SERVICE ROLE key')
    process.exit(1)
  }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const image_url = process.env.IMAGE_URL
  const path = process.env.OBJECT_PATH
  if (!image_url || !path) {
    console.error('Provide IMAGE_URL and OBJECT_PATH envs')
    process.exit(1)
  }
  const { data, error } = await admin
    .from('imagens_logs')
    .insert({
      bank_id: null,
      question_id: null,
      filename: path.split('/').pop(),
      content_type: 'image/png',
      path,
      url: image_url,
      uploader_external_id: 'e2e-proxy',
    })
    .select('id')
    .single()
  if (error) {
    console.error('Insert imagens_logs error:', error.message)
    process.exit(1)
  }
  console.log('Inserted log id:', data?.id)
}

main().catch(err => { console.error('Script error:', err?.message || String(err)); process.exit(1) })