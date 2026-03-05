import { json } from '../../../src/server/supabaseAdmin.js'
import { getVercelToken, readVercelProjectInfo, requireAdmin } from '../_util.js'

async function getLatestDeploymentId({ token, projectId, teamId }) {
  const url = `https://api.vercel.com/v6/deployments?projectId=${encodeURIComponent(projectId)}&limit=1&teamId=${encodeURIComponent(teamId)}`
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  const body = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(body?.error?.message || body?.error || 'vercel_list_deployments_failed')
  const list = Array.isArray(body?.deployments) ? body.deployments : []
  const first = list[0] || null
  const id = String(first?.uid || first?.id || '').trim()
  if (!id) throw new Error('missing_latest_deployment')
  return id
}

async function createDeploymentFromPrevious({ token, teamId, deploymentId }) {
  const r = await fetch(`https://api.vercel.com/v13/deployments?teamId=${encodeURIComponent(teamId)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      deploymentId,
      target: 'production',
      withLatestCommit: true,
    }),
  })
  const text = await r.text().catch(() => '')
  let body = null
  try { body = JSON.parse(text || '{}') } catch (_) { body = null }
  if (!r.ok) throw new Error(body?.error?.message || body?.error || text || 'vercel_create_deployment_failed')
  const url = String(body?.url || '').trim()
  const id = String(body?.id || '').trim()
  return { id, url }
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

    const latestId = await getLatestDeploymentId({ token, projectId: info.projectId, teamId: info.teamId })
    const created = await createDeploymentFromPrevious({ token, teamId: info.teamId, deploymentId: latestId })

    return json(res, 200, {
      ok: true,
      latestDeploymentId: latestId,
      created: {
        id: created.id,
        url: created.url ? `https://${created.url}` : '',
      },
    })
  } catch (e) {
    return json(res, 500, { error: 'internal_error', message: e?.message || String(e) })
  }
}

