import { json } from '../../../src/server/supabaseAdmin.js'
import { computeDisabled, isExpired, normalizeAccountType, normalizeEmail, requireAdmin } from '../_util.js'

function normalizeNameFromMeta(meta) {
  const m = meta && typeof meta === 'object' ? meta : {}
  return String(m?.name || m?.full_name || m?.profile_full_name || '').trim()
}

function decodeJwtRole(token) {
  const raw = String(token || '').trim()
  const parts = raw.split('.')
  if (parts.length < 2) return ''
  const p = parts[1] || ''
  const pad = p.length % 4 === 0 ? '' : '='.repeat(4 - (p.length % 4))
  const b64 = (p + pad).replace(/-/g, '+').replace(/_/g, '/')
  try {
    const jsonText = Buffer.from(b64, 'base64').toString('utf-8')
    const payload = JSON.parse(jsonText || '{}')
    return String(payload?.role || '').trim().toLowerCase()
  } catch (_) {
    return ''
  }
}

function decodeJwtIss(token) {
  const raw = String(token || '').trim()
  const parts = raw.split('.')
  if (parts.length < 2) return ''
  const p = parts[1] || ''
  const pad = p.length % 4 === 0 ? '' : '='.repeat(4 - (p.length % 4))
  const b64 = (p + pad).replace(/-/g, '+').replace(/_/g, '/')
  try {
    const jsonText = Buffer.from(b64, 'base64').toString('utf-8')
    const payload = JSON.parse(jsonText || '{}')
    return String(payload?.iss || '').trim()
  } catch (_) {
    return ''
  }
}

function extractProjectRefFromSupabaseUrl(url) {
  const raw = String(url || '').trim()
  if (!raw) return ''
  try {
    const u = new URL(raw)
    const host = String(u.hostname || '')
    const m = host.match(/^([a-z0-9-]+)\.supabase\.co$/i)
    return m ? String(m[1] || '') : ''
  } catch (_) {
    return ''
  }
}

function extractProjectRefFromIss(iss) {
  const raw = String(iss || '').trim()
  if (!raw) return ''
  try {
    const u = new URL(raw)
    const host = String(u.hostname || '')
    const m = host.match(/^([a-z0-9-]+)\.supabase\.co$/i)
    return m ? String(m[1] || '') : ''
  } catch (_) {
    return ''
  }
}

function serviceKeyRoleHint() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const urlRef = extractProjectRefFromSupabaseUrl(url)
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE || ''
  const role = decodeJwtRole(key)
  const iss = decodeJwtIss(key)
  const keyRef = extractProjectRefFromIss(iss)
  const roleOut = role || 'unknown'
  const urlOut = urlRef || 'unknown'
  const keyOut = keyRef || 'unknown'
  const mismatch = urlRef && keyRef && urlRef !== keyRef ? ' mismatch=1' : ''
  const wrongRole = role && role !== 'service_role' ? ' expected=service_role' : role ? '' : ' expected=service_role'
  return ` (env key_role=${roleOut} url_ref=${urlOut} key_ref=${keyOut}${mismatch}${wrongRole})`
}

async function getCourseAllowedUserIdSet(admin, courseId) {
  const cid = String(courseId || '').trim()
  if (!cid) return null
  const { data, error } = await admin
    .from('notifications')
    .select('recipient_user_id,data,entity_id,entity_type,type')
    .eq('type', 'purchase_confirmed')
    .eq('entity_type', 'course')
    .eq('entity_id', cid)
    .order('created_at', { ascending: false })
    .limit(5000)
  if (error) return new Set()
  const set = new Set()
  for (const row of Array.isArray(data) ? data : []) {
    const uid = String(row?.recipient_user_id || '').trim()
    if (!uid) continue
    const expiresAt =
      String(row?.data?.expires_at || row?.data?.expiresAt || row?.data?.expires_at_iso || '').trim()
    if (expiresAt && isExpired(expiresAt)) continue
    set.add(uid)
  }
  return set
}

function normalizeFromDbRow(row) {
  const r = row && typeof row === 'object' ? row : {}
  const id = String(r?.id || r?.user_id || r?.uid || '').trim()
  const email = normalizeEmail(r?.email || r?.user_email || r?.mail || '')
  const name = String(r?.name || r?.full_name || r?.profile_full_name || r?.display_name || '').trim()
  const accountType = normalizeAccountType(r?.account_type || r?.role || r?.platform_role || r?.type || '')
  const disabled = Boolean(r?.disabled || r?.is_disabled || r?.banned || r?.blocked)
  const createdAt = r?.created_at || r?.createdAt || null
  const lastSignInAt = r?.last_sign_in_at || r?.last_login_at || r?.lastSignInAt || null
  return {
    id,
    email,
    name: name || email || (id ? `Usuário ${id.slice(0, 8)}` : ''),
    accountType,
    disabled,
    createdAt,
    lastSignInAt,
  }
}

async function listUsersFallbackFromDb(admin, opts) {
  const q = String(opts?.q || '').trim().toLowerCase()
  const type = String(opts?.type || 'all').trim().toLowerCase()
  const showDisabled = !!opts?.showDisabled
  const allowedByCourse = opts?.allowedByCourse || null
  const perPage = Math.max(1, Math.min(5000, Number(opts?.perPage || 50)))

  const tryTables = ['users', 'profiles']
  for (const table of tryTables) {
    const { data, error } = await admin.from(table).select('*').limit(Math.min(5000, perPage))
    if (error) continue
    const rows = Array.isArray(data) ? data : []
    const out = []
    for (const row of rows) {
      const u = normalizeFromDbRow(row)
      if (!u.id) continue
      if (!showDisabled && u.disabled) continue
      if (type !== 'all' && normalizeAccountType(type) !== u.accountType) continue
      if (allowedByCourse && !allowedByCourse.has(u.id)) continue
      if (q) {
        const hay = `${u.name} ${u.email}`.toLowerCase()
        if (!hay.includes(q)) continue
      }
      out.push(u)
      if (out.length >= perPage) break
    }
    return { ok: true, users: out, source: `db:${table}` }
  }
  return { ok: false, error: 'db_fallback_failed' }
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' })
    const auth = await requireAdmin(req, res)
    if (!auth.ok) return
    const { admin } = auth

    const sp = new URL(req.url, 'http://localhost').searchParams
    const q = String(sp.get('q') || '').trim().toLowerCase()
    const type = String(sp.get('type') || 'all').trim().toLowerCase()
    const showDisabled = sp.get('show_disabled') === '1'
    const courseId = String(sp.get('course_id') || '').trim()
    const perPageRaw = String(sp.get('per_page') || '').trim().toLowerCase()
    const perPage =
      perPageRaw === 'all'
        ? 10_000
        : Math.max(1, Math.min(5000, Number(perPageRaw || 50)))

    const allowedByCourse = await getCourseAllowedUserIdSet(admin, courseId)

    const matches = []
    const scanPerPage = Math.max(50, Math.min(200, perPage >= 500 ? 200 : perPage))
    const maxScanPages = Math.max(20, Math.min(200, Math.ceil(perPage / scanPerPage) + 20))
    for (let page = 1; page <= maxScanPages; page += 1) {
      const r = await admin.auth.admin.listUsers({ page, perPage: scanPerPage })
      if (r?.error) {
        const msg = r.error?.message || 'list_users_failed'
        const status = r.error?.status ? ` (status=${r.error.status})` : ''
        const name = r.error?.name ? ` (name=${r.error.name})` : ''
        const fallback = await listUsersFallbackFromDb(admin, {
          q,
          type,
          showDisabled,
          allowedByCourse,
          perPage,
        })
        if (fallback.ok) {
          return json(res, 200, {
            ok: true,
            users: fallback.users,
            meta: { count: fallback.users.length, limit: perPage, truncated: fallback.users.length >= perPage, source: fallback.source },
          })
        }
        throw new Error(`${msg}${status}${name}${serviceKeyRoleHint()}`)
      }
      const users = Array.isArray(r?.data?.users) ? r.data.users : []
      for (const u of users) {
        const id = String(u?.id || '').trim()
        if (!id) continue
        const email = normalizeEmail(u?.email || '')
        const meta = u?.user_metadata && typeof u.user_metadata === 'object' ? u.user_metadata : {}
        const name = normalizeNameFromMeta(meta)
        const accountType = normalizeAccountType(meta?.account_type || meta?.role || meta?.platform_role || meta?.type || '')
        const disabled = computeDisabled(u)
        if (!showDisabled && disabled) continue
        if (type !== 'all' && normalizeAccountType(type) !== accountType) continue
        if (allowedByCourse && !allowedByCourse.has(id)) continue
        if (q) {
          const hay = `${name} ${email}`.toLowerCase()
          if (!hay.includes(q)) continue
        }
        matches.push({
          id,
          email,
          name: name || email || (id ? `Usuário ${id.slice(0, 8)}` : ''),
          accountType,
          disabled,
          createdAt: u?.created_at || null,
          lastSignInAt: u?.last_sign_in_at || null,
        })
        if (matches.length >= perPage) break
      }
      if (matches.length >= perPage) break
      if (users.length < scanPerPage) break
    }

    return json(res, 200, {
      ok: true,
      users: matches,
      meta: { count: matches.length, limit: perPage, truncated: matches.length >= perPage },
    })
  } catch (e) {
    const msg = e?.message || String(e)
    return json(res, 500, { error: 'internal_error', message: msg })
  }
}
