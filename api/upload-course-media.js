import { getSupabaseAdmin, getAuthedUser, readRawBody, json, safeName, isoSafeNow } from '../src/server/supabaseAdmin.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' })

  const admin = getSupabaseAdmin()
  if (!admin) return json(res, 501, { error: 'proxy_disabled', hint: 'Configure SUPABASE_SERVICE_ROLE_KEY no ambiente do deploy.' })

  const auth = await getAuthedUser(admin, req)
  if (!auth.user) return json(res, 401, { error: auth.error || 'unauthorized' })

  try {
    const u = new URL(req.url, `http://${req.headers.host}`)
    const courseId = u.searchParams.get('courseId')
    const kind = u.searchParams.get('kind') || 'media'
    const filename = u.searchParams.get('filename')
    const contentType = u.searchParams.get('contentType') || req.headers['content-type'] || 'application/octet-stream'
    const buffer = await readRawBody(req)

    if (!courseId || !filename || !buffer || buffer.length === 0) return json(res, 400, { error: 'missing_params_or_body' })

    const bucket = 'courses-media'
    const ts = isoSafeNow()
    const objectPath = `users/${auth.user.id}/courses/${String(courseId)}/${safeName(kind)}/${ts}_${safeName(filename)}`

    const up = await admin.storage.from(bucket).upload(objectPath, buffer, { contentType: String(contentType), upsert: true })
    if (up.error) return json(res, 500, { error: up.error.message || String(up.error) })

    let url = null
    try {
      const { data: signed } = await admin.storage.from(bucket).createSignedUrl(objectPath, 60 * 60 * 24 * 365)
      url = signed?.signedUrl || null
    } catch (_) {
      const { data: pub } = await admin.storage.from(bucket).getPublicUrl(objectPath)
      url = pub?.publicUrl || null
    }

    return json(res, 200, { url, path: objectPath, bucket })
  } catch (e) {
    return json(res, 500, { error: e?.message || String(e) })
  }
}
