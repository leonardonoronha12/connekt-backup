import { getSupabaseAdmin, isUuid, json } from '../src/server/supabaseAdmin.js'

function normalizeHost(raw) {
  const v = String(raw || '').trim().toLowerCase()
  if (!v) return ''
  return v.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0] || ''
}

function pickWhitelabel(user) {
  const meta = user?.user_metadata && typeof user.user_metadata === 'object' ? user.user_metadata : {}
  const wl = meta.whitelabel && typeof meta.whitelabel === 'object'
    ? meta.whitelabel
    : (meta.whiteLabel && typeof meta.whiteLabel === 'object' ? meta.whiteLabel : null)
  return wl || null
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' })

  const admin = getSupabaseAdmin()
  if (!admin) return json(res, 501, { error: 'proxy_disabled', hint: 'Configure SUPABASE_SERVICE_ROLE_KEY no ambiente do deploy.' })

  try {
    const u = new URL(req.url, `http://${req.headers.host}`)
    const host = normalizeHost(u.searchParams.get('host') || '')
    const producerIdParam = String(u.searchParams.get('producerId') || '').trim()
    let producerId = producerIdParam && isUuid(producerIdParam) ? producerIdParam : ''

    if (!producerId && host) {
      const httpsUrl = `https://${host}`
      const httpUrl = `http://${host}`
      const { data } = await admin
        .from('profiles')
        .select('user_id,member_area_url')
        .in('member_area_url', [httpsUrl, httpUrl])
        .limit(1)
      const row = Array.isArray(data) ? data[0] : null
      producerId = row?.user_id ? String(row.user_id).trim() : ''
    }

    if (!producerId || !isUuid(producerId)) return json(res, 200, { producerId: '', brand: null })

    let user = null
    try {
      const { data } = await admin.auth.admin.getUserById(producerId)
      user = data?.user || null
    } catch (_) {
      user = null
    }

    const wl = pickWhitelabel(user)
    const brand = wl ? { ...wl } : null
    return json(res, 200, { producerId, brand })
  } catch (e) {
    return json(res, 500, { error: e?.message || String(e) })
  }
}

