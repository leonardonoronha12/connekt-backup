import { json } from '../../../src/server/supabaseAdmin.js'
import { requireAdmin } from '../_util.js'

async function readBody(req) {
  const chunks = []
  await new Promise((resolve, reject) => {
    req.on('data', (c) => chunks.push(c))
    req.on('end', resolve)
    req.on('error', reject)
  })
  const text = Buffer.concat(chunks).toString('utf-8') || '{}'
  return JSON.parse(text)
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' })
    const auth = await requireAdmin(req, res)
    if (!auth.ok) return
    const { admin } = auth
    const body = await readBody(req).catch(() => ({}))
    const ids = Array.isArray(body?.userIds) ? body.userIds : []
    const userIds = ids.map((v) => String(v || '').trim()).filter(Boolean)
    if (!userIds.length) return json(res, 400, { error: 'missing_user_ids' })
    let okCount = 0
    for (const id of userIds) {
      try {
        const rUser = await admin.auth.admin.getUserById(id)
        const u = rUser?.data?.user
        const meta = u?.user_metadata && typeof u.user_metadata === 'object' ? u.user_metadata : {}
        await admin.auth.admin.updateUserById(id, { banned_until: null, user_metadata: { ...meta, disabled: false } })
        okCount += 1
      } catch (_) {}
    }
    return json(res, 200, { ok: true, okCount })
  } catch (e) {
    return json(res, 500, { error: 'internal_error', message: e?.message || String(e) })
  }
}

