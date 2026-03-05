import { json } from '../../src/server/supabaseAdmin.js'
import { requireAdmin, normalizeEmail } from './_util.js'

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' })
    const auth = await requireAdmin(req, res)
    if (!auth.ok) return
    const user = auth.user
    const meta = user?.user_metadata && typeof user.user_metadata === 'object' ? user.user_metadata : {}
    return json(res, 200, {
      ok: true,
      me: {
        id: String(user?.id || ''),
        email: normalizeEmail(user?.email || ''),
        name: String(meta?.name || meta?.full_name || ''),
      },
    })
  } catch (e) {
    return json(res, 500, { error: 'internal_error', message: e?.message || String(e) })
  }
}

