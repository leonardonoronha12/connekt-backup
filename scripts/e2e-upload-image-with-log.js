import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

async function main() {
  const host = process.env.E2E_HOST || 'http://localhost:3001'
  const filePath = path.join(process.cwd(), 'public', 'new-icon.png')
  const b64 = fs.readFileSync(filePath, 'base64')
  const dataUrl = `data:image/png;base64,${b64}`

  const resp = await fetch(`${host}/api/upload-image-with-log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: 'new-icon.png', contentType: 'image/png', dataUrl, title: 'e2e-upload', contentId: null })
  })
  if (!resp.ok) {
    let errMsg = `${resp.status}`
    try { const j = await resp.json(); errMsg = j?.error || errMsg } catch {}
    console.error('Upload failed:', errMsg)
    process.exit(1)
  }
  const result = await resp.json()
  console.log('Upload result:', result)

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

  const { data: list, error: listErr } = await admin.storage.from('images').list('public', { limit: 10, sortBy: { column: 'name', order: 'desc' } })
  if (listErr) {
    console.error('List objects failed:', listErr.message)
  } else {
    console.log('Objects in images/public:', list.map(o => o.name))
  }

  const { data: rows, error: selErr } = await admin.from('imagens_logs').select('*').order('created_at', { ascending: false }).limit(1)
  if (selErr) {
    console.error('Select log failed:', selErr.message)
  } else {
    console.log('Last log row:', rows?.[0] || null)
  }

  console.log('Public URL test:', result.image_url)
}

main().catch(err => { console.error('E2E script error:', err?.message || String(err)); process.exit(1) })