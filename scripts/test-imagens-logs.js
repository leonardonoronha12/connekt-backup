import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE

if (!url || !serviceKey) {
  console.error('Missing SUPABASE_URL or SERVICE ROLE key in env.')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })

async function main() {
  const payload = {
    bank_id: 'validate-bank',
    question_id: 'validate-question',
    filename: 'validate.png',
    content_type: 'image/png',
    path: 'question-images/validate.png',
    url: 'https://example.invalid/validate.png',
    uploader_external_id: 'cli-validation'
  }

  const { data: inserted, error: insertErr } = await supabase
    .from('imagens_logs')
    .insert(payload)
    .select('*')
    .single()

  if (insertErr) {
    console.error('Insert failed:', insertErr.message || String(insertErr))
    process.exit(1)
  }

  console.log('Inserted row:', inserted)

  const { data: rows, error: selectErr } = await supabase
    .from('imagens_logs')
    .select('*')
    .eq('question_id', 'validate-question')
    .order('created_at', { ascending: false })
    .limit(1)

  if (selectErr) {
    console.error('Select failed:', selectErr.message || String(selectErr))
    process.exit(1)
  }

  console.log('Selected row:', rows?.[0] || null)
}

main()