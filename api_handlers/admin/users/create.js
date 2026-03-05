import { json } from '../../../src/server/supabaseAdmin.js'
import { deterministicUuid, isValidEmail, normalizeAccountType, normalizeEmail, parseExpiresAt, readEnv, requireAdmin } from '../_util.js'

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
  const notifId = deterministicUuid(`notif:platform_admin:course:${cid}:user:${userId}`)
  let courseTitle = 'Curso'
  try {
    const { data } = await admin.from('courses').select('title').eq('id', cid).maybeSingle()
    courseTitle = String(data?.title || '').trim() || courseTitle
  } catch (_) {}
  const row = {
    id: notifId,
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
    const body = await (async () => {
      try {
        const chunks = []
        await new Promise((resolve, reject) => {
          req.on('data', (c) => chunks.push(c))
          req.on('end', resolve)
          req.on('error', reject)
        })
        return JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}')
      } catch (_) {
        return {}
      }
    })()

    const email = normalizeEmail(body?.email || '')
    const name = String(body?.name || '').trim()
    const accountType = normalizeAccountType(body?.accountType || 'aluno')
    const courses = Array.isArray(body?.courses) ? body.courses : []

    if (!isValidEmail(email)) return json(res, 400, { error: 'invalid_email' })

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
      if (!userId) return json(res, 500, { error: 'create_failed', details: created?.error?.message || null })
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

    const actorUserId = String(actor?.id || '').trim()
    for (const c of courses) {
      const courseId = String(c?.courseId || '').trim()
      const expiresAtIso = parseExpiresAt(c?.expiresAt || '') || null
      await upsertCourseEntitlement({ admin, userId, courseId, expiresAtIso, actorUserId })
    }

    const firstAccessLink = await generateRecoveryLink(email)
    return json(res, 200, { ok: true, userId, firstAccessLink })
  } catch (e) {
    return json(res, 500, { error: 'internal_error', message: e?.message || String(e) })
  }
}

