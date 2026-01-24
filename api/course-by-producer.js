import { getSupabaseAdmin, getAuthedUser, isUuid, json } from './_supabaseAdmin.js'

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
    if (!courseId || !isUuid(courseId)) return json(res, 400, { error: 'invalid_course_id' })
    if (!producerId || !isUuid(producerId)) return json(res, 400, { error: 'invalid_producer_id' })

    const { data, error } = await admin
      .from('courses')
      .select('*')
      .eq('id', courseId)
      .maybeSingle()

    if (error) return json(res, 500, { error: error.message || String(error) })
    if (!data) return json(res, 404, { error: 'not_found' })
    if (String(data.user_id || '') !== String(producerId)) return json(res, 403, { error: 'forbidden' })

    return json(res, 200, { data })
  } catch (e) {
    return json(res, 500, { error: e?.message || String(e) })
  }
}

