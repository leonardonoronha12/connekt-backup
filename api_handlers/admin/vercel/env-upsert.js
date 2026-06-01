import { json } from '../../../src/server/supabaseAdmin.js'
import { getVercelToken, readJsonBody, readVercelProjectInfo, requireAdmin } from '../_util.js'

async function upsertOne({ token, projectId, teamId, key, value, type = 'plain' }) {
  const url = `https://api.vercel.com/v10/projects/${encodeURIComponent(projectId)}/env?upsert=true&teamId=${encodeURIComponent(teamId)}`
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      key,
      value,
      type,
      target: ['production'],
    }),
  })
  const body = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(body?.error?.message || body?.error || body?.message || 'vercel_env_upsert_failed')
  return body
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' })
    const auth = await requireAdmin(req, res)
    if (!auth.ok) return

    const token = getVercelToken()
    if (!token) return json(res, 500, { error: 'missing_vercel_token' })
    const info = readVercelProjectInfo()
    if (!info?.projectId || !info?.teamId) return json(res, 500, { error: 'missing_vercel_project_info' })

    const body = await readJsonBody(req).catch(() => ({}))
    const vars = Array.isArray(body?.vars) ? body.vars : []
    if (!vars.length) return json(res, 400, { error: 'missing_vars' })

    const results = []
    for (const v of vars) {
      const key = String(v?.key || '').trim()
      const value = String(v?.value || '').trim()
      const type = String(v?.type || 'plain').trim() || 'plain'
      if (!key) continue
      results.push(await upsertOne({ token, projectId: info.projectId, teamId: info.teamId, key, value, type }))
    }

    return json(res, 200, { ok: true, updated: results.length })
  } catch (e) {
    return json(res, 500, { error: 'internal_error', message: e?.message || String(e) })
  }
}

