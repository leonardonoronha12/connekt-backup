import { json } from '../../../src/server/supabaseAdmin.js'
import { getVercelToken, readVercelProjectInfo, requireAdmin } from '../_util.js'

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' })
    const auth = await requireAdmin(req, res)
    if (!auth.ok) return

    const token = getVercelToken()
    const info = readVercelProjectInfo()

    return json(res, 200, {
      ok: true,
      vercel: {
        hasToken: Boolean(token),
        projectId: info?.projectId || '',
        teamId: info?.teamId || '',
      },
    })
  } catch (e) {
    return json(res, 500, { error: 'internal_error', message: e?.message || String(e) })
  }
}

