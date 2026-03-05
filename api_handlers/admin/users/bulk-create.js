import { json } from '../../../src/server/supabaseAdmin.js'
import { isValidEmail, normalizeAccountType, normalizeEmail, parseExpiresAt, requireAdmin } from '../_util.js'
import { deterministicUuid } from '../_util.js'

function randomPassword() {
  return `Tmp${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}1A`
}

async function findUserIdByEmail(admin, email) {
  const target = normalizeEmail(email)
  if (!target) return ''
  const perPage = 200
  for (let page = 1; page <= 30; page += 1) {
    const r = await admin.auth.admin.listUsers({ page, perPage })
    const users = Array.isArray(r?.data?.users) ? r.data.users : []
    for (const u of users) {
      const e = normalizeEmail(u?.email || '')
      if (e && e === target) return String(u?.id || '').trim()
    }
    if (users.length < perPage) break
  }
  return ''
}

async function upsertProfile(admin, userId, name) {
  const fullName = String(name || '').trim()
  if (!fullName) return
  try {
    await admin.from('profiles').upsert({ user_id: userId, profile_full_name: fullName }, { onConflict: 'user_id' })
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
    const { admin, user: actor } = auth
    const body = await readBody(req).catch(() => ({}))
    const users = Array.isArray(body?.users) ? body.users : []
    if (!users.length) return json(res, 400, { error: 'missing_users' })
    const actorUserId = String(actor?.id || '').trim()
    let okCount = 0
    let failCount = 0
    const failures = []

    for (const item of users.slice(0, 300)) {
      try {
        const email = normalizeEmail(item?.email || '')
        const name = String(item?.name || '').trim()
        const accountType = normalizeAccountType(item?.accountType || 'aluno')
        const courses = Array.isArray(item?.courses) ? item.courses : []
        if (!isValidEmail(email)) throw new Error('invalid_email')

        let userId = ''
        const password = randomPassword()
        const created = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            name: name || '',
            full_name: name || '',
            account_type: accountType,
          },
        })
        if (created?.data?.user?.id) userId = String(created.data.user.id).trim()
        if (!userId) {
          userId = await findUserIdByEmail(admin, email)
          if (!userId) throw new Error(created?.error?.message || 'create_failed')
          await admin.auth.admin.updateUserById(userId, {
            user_metadata: {
              ...(created?.data?.user?.user_metadata || {}),
              name: name || '',
              full_name: name || '',
              account_type: accountType,
            },
          })
        }

        await upsertProfile(admin, userId, name)

        for (const c of courses) {
          const courseId = String(c?.courseId || '').trim()
          const expiresAtIso = parseExpiresAt(c?.expiresAt || '') || null
          await upsertCourseEntitlement({ admin, userId, courseId, expiresAtIso, actorUserId })
        }

        okCount += 1
      } catch (e) {
        failCount += 1
        failures.push({ email: String(item?.email || '').trim(), error: e?.message || String(e) })
      }
    }

    return json(res, 200, { ok: true, okCount, failCount, failures })
  } catch (e) {
    return json(res, 500, { error: 'internal_error', message: e?.message || String(e) })
  }
}

