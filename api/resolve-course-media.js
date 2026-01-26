import { getSupabaseAdmin, getAuthedUser, json, safeName } from './_supabaseAdmin.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' })

  const admin = getSupabaseAdmin()
  if (!admin) return json(res, 501, { error: 'proxy_disabled', hint: 'Configure SUPABASE_SERVICE_ROLE_KEY no ambiente do deploy.' })

  const auth = await getAuthedUser(admin, req)
  if (!auth.user) return json(res, 401, { error: auth.error || 'unauthorized' })

  try {
    const u = new URL(req.url, `http://${req.headers.host}`)
    const courseId = String(u.searchParams.get('courseId') || '').trim()
    const producerId = String(u.searchParams.get('producerId') || '').trim()
    const filename = String(u.searchParams.get('filename') || '').trim()
    const lessonId = String(u.searchParams.get('lessonId') || '').trim()

    if (!courseId || !producerId || !filename) return json(res, 400, { error: 'missing_params' })

    const bucket = 'courses-media'
    const root = `users/${producerId}/courses/${courseId}`
    const wanted = safeName(filename)

    const kinds = ['materials', 'material', 'anexos', 'attachments', 'files', 'docs', 'media', 'pdf', 'doc', 'ppt', 'xls']
    const folders = []
    for (const k of kinds) folders.push(`${root}/${safeName(k)}`)
    if (lessonId) {
      folders.push(`${root}/lessons/${safeName(lessonId)}/materials`)
      folders.push(`${root}/lessons/${safeName(lessonId)}/anexos`)
      folders.push(`${root}/aulas/${safeName(lessonId)}/materials`)
      folders.push(`${root}/aulas/${safeName(lessonId)}/anexos`)
    }
    folders.push(root)

    for (const folder of folders) {
      const { data: list, error } = await admin.storage.from(bucket).list(folder, { limit: 200, search: wanted })
      if (error) continue
      const items = Array.isArray(list) ? list : []
      const exact = items.find((it) => String(it?.name || '') === wanted) || null
      const suffix = items.find((it) => String(it?.name || '').endsWith(`_${wanted}`)) || null
      const picked = exact || suffix || null
      if (!picked?.name) continue

      const objectPath = `${folder}/${picked.name}`
      let url = null
      try {
        const { data: signed } = await admin.storage.from(bucket).createSignedUrl(objectPath, 60 * 10)
        url = signed?.signedUrl || null
      } catch (_) {}
      if (!url) {
        const { data: pub } = await admin.storage.from(bucket).getPublicUrl(objectPath)
        url = pub?.publicUrl || null
      }
      if (url) return json(res, 200, { ok: true, url, path: objectPath, bucket })
    }

    return json(res, 404, { ok: false, error: 'not_found' })
  } catch (e) {
    return json(res, 500, { error: e?.message || String(e) })
  }
}

