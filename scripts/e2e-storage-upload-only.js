import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

async function main() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE
  if (!url || !serviceKey) {
    console.error('Missing SUPABASE URL or SERVICE ROLE key')
    process.exit(1)
  }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

  const filePath = path.join(process.cwd(), 'public', 'new-icon.png')
  const buf = fs.readFileSync(filePath)
  const safeExt = 'png'
  const uuid = (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(16).slice(2)}`
  const fileName = `${uuid}.${safeExt}`
  const objectPath = `public/${fileName}`

  try { await admin.storage.createBucket('images', { public: true }) } catch (_) {}

  const { error: upErr } = await admin.storage.from('images').upload(objectPath, buf, { contentType: 'image/png', upsert: false })
  if (upErr) { console.error('Upload error:', upErr.message); process.exit(1) }

  const { data: pub } = await admin.storage.from('images').getPublicUrl(objectPath)
  const publicUrl = pub?.publicUrl || ''
  console.log('Uploaded object:', { path: objectPath, publicUrl })

  const { data: list, error: listErr } = await admin.storage.from('images').list('public', { limit: 10, sortBy: { column: 'name', order: 'desc' } })
  if (listErr) {
    console.error('List error:', listErr.message)
  } else {
    console.log('Objects in images/public:', list.map(o => o.name))
  }
}

main().catch(err => { console.error('E2E storage-only error:', err?.message || String(err)); process.exit(1) })