import { json } from '../../../src/server/supabaseAdmin.js'
import { computeDisabled, isExpired, normalizeAccountType, normalizeEmail, requireAdmin } from '../_util.js'

function normalizeName(meta, email) {
  const m = meta && typeof meta === 'object' ? meta : {}
  return String(m?.name || m?.full_name || '').trim() || String(email || '').trim()
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
    if (rUser?.error || !rUser?.data?.user) return json(res, 404, { error: 'not_found' })
    const u = rUser.data.user
    const meta = u?.user_metadata && typeof u.user_metadata === 'object' ? u.user_metadata : {}
    const email = normalizeEmail(u?.email || '')

    let profilePhone = ''
    let profileName = ''
    try {
      const { data } = await admin
        .from('profiles')
        .select('profile_full_name,profile_phone')
        .eq('user_id', userId)
        .maybeSingle()
      profilePhone = String(data?.profile_phone || '').trim()
      profileName = String(data?.profile_full_name || '').trim()
    } catch (_) {}

    const disabled = computeDisabled(u)

    const { data: notif } = await admin
      .from('notifications')
      .select('id,entity_id,entity_type,type,data,created_at')
      .eq('recipient_user_id', userId)
      .eq('type', 'purchase_confirmed')
      .order('created_at', { ascending: false })
      .limit(3000)

    const coursesMap = new Map()
    for (const row of Array.isArray(notif) ? notif : []) {
      const entityType = String(row?.entity_type || '').trim().toLowerCase()
      if (entityType !== 'course') continue
      const courseId = String(row?.entity_id || '').trim()
      if (!courseId) continue
      const expiresAt = String(row?.data?.expires_at || row?.data?.expiresAt || '').trim()
      const source = String(row?.data?.source || '').trim()
      const expired = expiresAt ? isExpired(expiresAt) : false
      const prev = coursesMap.get(courseId)
      if (!prev) {
        coursesMap.set(courseId, { courseId, expiresAt: expiresAt || '', source, expired })
        continue
      }
      if (!prev.expiresAt && expiresAt) {
        coursesMap.set(courseId, { courseId, expiresAt: expiresAt || '', source, expired })
        continue
      }
    }

    const courses = Array.from(coursesMap.values()).filter((c) => !c.expired).map((c) => ({
      courseId: c.courseId,
      expiresAt: c.expiresAt || '',
    }))

    return json(res, 200, {
      ok: true,
      user: {
        id: String(u?.id || ''),
        email,
        name: profileName || normalizeName(meta, email),
        phone: profilePhone || String(meta?.profile_phone || meta?.phone || '').trim(),
        accountType: normalizeAccountType(meta?.account_type || meta?.role || meta?.platform_role || meta?.type || ''),
        disabled,
        createdAt: u?.created_at || null,
        lastSignInAt: u?.last_sign_in_at || null,
        courses,
      },
    })
  } catch (e) {
    return json(res, 500, { error: 'internal_error', message: e?.message || String(e) })
  }
}

