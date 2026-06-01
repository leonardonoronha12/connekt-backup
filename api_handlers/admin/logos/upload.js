import { getSupabaseAdmin, getAuthedUser, readRawBody, json, safeName, sanitizeStorageObjectPath, isStorageSubpathOf } from '../../../src/server/supabaseAdmin.js'

const BUCKET = 'images'
const MAX_BYTES = 2 * 1024 * 1024
const ALLOWED_KEYS = new Set(['providers/vdocipher', 'providers/vimeo', 'brand/connekt'])

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' })

  const admin = getSupabaseAdmin()
  if (!admin) return json(res, 501, { error: 'proxy_disabled', hint: 'Configure SUPABASE_SERVICE_ROLE_KEY no ambiente do deploy.' })

  const auth = await getAuthedUser(admin, req)
  if (!auth.user) return json(res, 401, { error: auth.error || 'unauthorized' })

  try {
    const u = new URL(req.url, `http://${req.headers.host}`)
    const key = String(u.searchParams.get('key') || '').trim()
    const filename = String(u.searchParams.get('filename') || '').trim()
    const contentType = String(u.searchParams.get('contentType') || req.headers['content-type'] || 'application/octet-stream').trim()
    const buffer = await readRawBody(req)

    if (!key || !ALLOWED_KEYS.has(key)) return json(res, 400, { error: 'invalid_key' })
    if (!filename) return json(res, 400, { error: 'missing_filename' })
    if (!buffer || buffer.length === 0) return json(res, 400, { error: 'missing_body' })
    if (buffer.length > MAX_BYTES) return json(res, 413, { error: 'file_too_large' })
    if (!contentType.toLowerCase().startsWith('image/')) return json(res, 400, { error: 'invalid_content_type' })

    const desired = sanitizeStorageObjectPath(`logos/${key}`)
    if (!desired || !isStorageSubpathOf(desired, 'logos')) return json(res, 400, { error: 'invalid_path' })

    const objectPath = desired
    const up = await admin.storage.from(BUCKET).upload(objectPath, buffer, {
      contentType,
      upsert: true,
      cacheControl: '60',
    })
    if (up?.error) return json(res, 500, { error: up.error.message || String(up.error) })

    const { data: pub } = await admin.storage.from(BUCKET).getPublicUrl(objectPath)
    const url = pub?.publicUrl || null
    return json(res, 200, { ok: true, bucket: BUCKET, path: objectPath, url, filename: safeName(filename), contentType })
  } catch (e) {
    return json(res, 500, { error: e?.message || String(e) })
  }
}

