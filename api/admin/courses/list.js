import { json } from '../../../src/server/supabaseAdmin.js'
import { requireAdmin } from '../_util.js'

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' })
    const auth = await requireAdmin(req, res)
    if (!auth.ok) return
    const { admin } = auth
    const { data, error } = await admin
      .from('courses')
      .select('id,title,user_id,created_at')
      .order('created_at', { ascending: false })
      .limit(500)
    if (error) return json(res, 500, { error: 'query_failed', details: error.message || String(error) })
    const courses = (Array.isArray(data) ? data : []).map((c) => ({
      id: String(c?.id || ''),
      title: String(c?.title || 'Curso'),
      producerId: String(c?.user_id || ''),
      createdAt: c?.created_at || null,
    }))
    return json(res, 200, { ok: true, courses })
  } catch (e) {
    return json(res, 500, { error: 'internal_error', message: e?.message || String(e) })
  }
}

