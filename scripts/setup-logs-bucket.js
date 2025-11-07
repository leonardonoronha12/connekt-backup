import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE

if (!url || !serviceKey) {
  console.error('Missing SUPABASE URL or SERVICE ROLE key in env.')
  process.exit(1)
}

const supabase = createClient(url, serviceKey)

async function main() {
  const bucket = 'imagens-logs'
  try {
    const { error } = await supabase.storage.createBucket(bucket, { public: true })
    if (error && !String(error.message || '').includes('already exists')) throw error
    console.log(`Bucket ${bucket} is ready (public read).`)
  } catch (err) {
    console.warn('Failed to create bucket:', err?.message || String(err))
  }

  try {
    const path = `healthcheck/${Date.now()}.json`
    const { error } = await supabase.storage.from(bucket).upload(
      path,
      new Blob([JSON.stringify({ ok: true, ts: new Date().toISOString() })], { type: 'application/json' }),
      { upsert: true }
    )
    if (error) throw error
    console.log('Wrote healthcheck object to imagens-logs.')
  } catch (err) {
    console.warn('Failed to write to bucket (likely policy insert missing, will still work via proxy):', err?.message || String(err))
  }
}

main()