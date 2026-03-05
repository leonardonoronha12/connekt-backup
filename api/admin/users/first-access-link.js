import { json } from '../../../src/server/supabaseAdmin.js'
import { isValidEmail, readEnv, requireAdmin } from '../_util.js'

async function generateRecoveryLink(email) {
  const baseUrl = readEnv('SUPABASE_URL', readEnv('VITE_SUPABASE_URL', ''))
  const serviceKey = readEnv('SUPABASE_SERVICE_ROLE_KEY', readEnv('SUPABASE_SERVICE_ROLE', ''))
  if (!baseUrl || !serviceKey) return ''
  const redirectTo = String(readEnv('PUBLIC_APP_URL', 'https://app.connektco.com')).replace(/\/+$/, '') + '/reset-password'
  const url = `${baseUrl.replace(/\/+$/, '')}/auth/v1/admin/generate_link`
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      type: 'recovery',
      email: String(email || '').trim(),
      options: { redirect_to: redirectTo },
    }),
  })
  const text = await r.text()
  let data = null
  try { data = JSON.parse(text || '{}') } catch (_) { data = null }
  if (!r.ok) return ''
  const actionLink =
    data?.action_link ||
    data?.properties?.action_link ||
    data?.data?.properties?.action_link ||
    ''
  return String(actionLink || '').trim()
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' })
    const auth = await requireAdmin(req, res)
    if (!auth.ok) return
    const { admin } = auth
    const sp = new URL(req.url, 'http://localhost').searchParams
    const userId = String(sp.get('user_id') || '').trim()
    if (!userId) return json(res, 400, { error: 'missing_user_id' })
    const rUser = await admin.auth.admin.getUserById(userId)
    const email = String(rUser?.data?.user?.email || '').trim()
    if (!isValidEmail(email)) return json(res, 400, { error: 'invalid_email' })
    const link = await generateRecoveryLink(email)
    if (!link) return json(res, 500, { error: 'link_failed' })
    return json(res, 200, { ok: true, firstAccessLink: link })
  } catch (e) {
    return json(res, 500, { error: 'internal_error', message: e?.message || String(e) })
  }
}

