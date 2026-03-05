import { json } from '../../../src/server/supabaseAdmin.js'
import { computeDisabled, deterministicUuid, normalizeAccountType, parseExpiresAt, requireAdmin } from '../_util.js'

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

async function upsertProfile(admin, userId, name, phone) {
  const payload = { user_id: userId }
  const fullName = String(name || '').trim()
  const phoneValue = String(phone || '').trim()
  if (fullName) payload.profile_full_name = fullName
  if (phoneValue) payload.profile_phone = phoneValue
  if (Object.keys(payload).length <= 1) return
  try {
    await admin.from('profiles').upsert(payload, { onConflict: 'user_id' })
  } catch (_) {}
}

async function upsertCourseEntitlement({ admin, userId, courseId, expiresAtIso, actorUserId }) {
  const cid = String(courseId || '').trim()
  if (!cid) return
  const id = deterministicUuid(`notif:platform_admin:course:${cid}:user:${userId}`)
  let courseTitle = 'Curso'
  try {
    const { data } = await admin.from('courses').select('title').eq('id', cid).maybeSingle()
    courseTitle = String(data?.title || '').trim() || courseTitle
  } catch (_) {}
  const row = {
    id,
    recipient_user_id: userId,
    type: 'purchase_confirmed',
    title: 'Acesso liberado',
    message: `Acesso liberado: ${courseTitle}`,
    actor_name: actorUserId ? String(actorUserId) : null,
    entity_name: courseTitle,
    entity_type: 'course',
    entity_id: cid,
    data: {
      type: 'course',
      source: 'platform_admin',
      courseId: cid,
      expires_at: expiresAtIso || null,
      granted_by: actorUserId || null,
    },
    href: '/aluno',
    read_at: null,
  }
  await admin.from('notifications').upsert(row, { onConflict: 'id' })
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' })
    const auth = await requireAdmin(req, res)
    if (!auth.ok) return
    const { admin, user: actor } = auth
    const body = await readBody(req).catch(() => ({}))

    const userId = String(body?.userId || '').trim()
    if (!userId) return json(res, 400, { error: 'missing_user_id' })

    const rUser = await admin.auth.admin.getUserById(userId)
    if (rUser?.error || !rUser?.data?.user) return json(res, 404, { error: 'not_found' })
    const existing = rUser.data.user
    const existingMeta = existing?.user_metadata && typeof existing.user_metadata === 'object' ? existing.user_metadata : {}

    const name = String(body?.name || '').trim()
    const phone = String(body?.phone || '').trim()
    const accountType = normalizeAccountType(body?.accountType || existingMeta?.account_type || 'aluno')
    const desiredDisabled = Boolean(body?.disabled)
    const actorUserId = String(actor?.id || '').trim()

    const nextMeta = {
      ...existingMeta,
      ...(name ? { name, full_name: name } : {}),
      ...(phone ? { profile_phone: phone } : { profile_phone: existingMeta?.profile_phone || '' }),
      account_type: accountType,
      disabled: desiredDisabled,
    }

    const bannedUntil = desiredDisabled ? '9999-12-31T23:59:59.999Z' : null
    await admin.auth.admin.updateUserById(userId, {
      banned_until: bannedUntil,
      user_metadata: nextMeta,
    })

    await upsertProfile(admin, userId, name, phone)

    const desiredCourses = Array.isArray(body?.courses) ? body.courses : []
    const desiredMap = new Map()
    for (const c of desiredCourses) {
      const cid = String(c?.courseId || '').trim()
      if (!cid) continue
      const exp = parseExpiresAt(c?.expiresAt || '') || ''
      desiredMap.set(cid, exp)
    }

    const { data: notif } = await admin
      .from('notifications')
      .select('id,entity_id,entity_type,type,data')
      .eq('recipient_user_id', userId)
      .eq('type', 'purchase_confirmed')
      .eq('entity_type', 'course')
      .order('created_at', { ascending: false })
      .limit(3000)

    for (const row of Array.isArray(notif) ? notif : []) {
      const src = String(row?.data?.source || '').trim()
      if (src !== 'platform_admin') continue
      const cid = String(row?.entity_id || '').trim()
      if (!cid) continue
      if (!desiredMap.has(cid)) {
        await admin.from('notifications').delete().eq('id', String(row?.id || '').trim())
      }
    }

    for (const [courseId, expiresAtIso] of desiredMap.entries()) {
      await upsertCourseEntitlement({ admin, userId, courseId, expiresAtIso: expiresAtIso || null, actorUserId })
    }

    const updated = await admin.auth.admin.getUserById(userId)
    const disabled = computeDisabled(updated?.data?.user || existing)
    return json(res, 200, { ok: true, userId, disabled })
  } catch (e) {
    return json(res, 500, { error: 'internal_error', message: e?.message || String(e) })
  }
}

