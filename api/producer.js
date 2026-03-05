import { getSupabaseAdmin, getAuthedUser, isUuid, json, readRawBody } from '../src/server/supabaseAdmin.js'
import * as dns from 'node:dns/promises'

function asArray(v) {
  return Array.isArray(v) ? v : []
}

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

function normalizeChoiceText(v) {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  if (typeof v === 'object') return String(v?.text || v?.label || v?.name || v?.value || '')
  return ''
}

function getChoiceMedia(meta, idx) {
  const m = meta && typeof meta === 'object' ? meta : {}
  const media = m.choicesMedia && typeof m.choicesMedia === 'object' ? m.choicesMedia : {}
  const byIndex =
    (Object.prototype.hasOwnProperty.call(media, String(idx)) ? media[String(idx)] : null) ||
    (Object.prototype.hasOwnProperty.call(media, idx) ? media[idx] : null) ||
    null
  const node = byIndex && typeof byIndex === 'object' ? byIndex : {}
  return {
    imageUrl: node.imageUrl || node.image_url || node.image || null,
    videoUrl: node.videoUrl || node.video_url || node.video || null,
  }
}

function mapQuestionRow(row) {
  const meta = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {}
  const rawChoices =
    asArray(meta.choices).length > 0
      ? asArray(meta.choices)
      : (asArray(meta.alternatives).length > 0 ? asArray(meta.alternatives) : (asArray(meta.options).length > 0 ? asArray(meta.options) : []))
  const correctIdx =
    Number.isFinite(Number(meta.correctChoiceIndex)) ? Number(meta.correctChoiceIndex) :
      (Number.isFinite(Number(row?.correct_choice_index)) ? Number(row.correct_choice_index) : null)
  const mappedChoices = rawChoices.map((c, idx) => {
    const text = normalizeChoiceText(c)
    const media = getChoiceMedia(meta, idx)
    return {
      label: text,
      is_correct: typeof correctIdx === 'number' ? idx === correctIdx : false,
      imageUrl: media.imageUrl,
      videoUrl: media.videoUrl,
    }
  })

  return {
    id: row?.id || null,
    title: row?.title || null,
    body: row?.question || row?.body || '',
    points: Number.isFinite(Number(meta.points)) ? Number(meta.points) : (Number.isFinite(Number(row?.points)) ? Number(row.points) : 0),
    attempts: Number.isFinite(Number(meta.attempts)) ? Number(meta.attempts) : (Number.isFinite(Number(row?.attempts)) ? Number(row.attempts) : 0),
    choices: mappedChoices,
    imageUrl: meta.imageUrl || meta.image_url || row?.image_url || null,
    videoUrl: meta.videoUrl || meta.video_url || null,
    resolutionText: meta.resolutionText || meta.resolution || meta.resolucaoText || meta.resolucao || null,
    resolutionImageUrl: meta.resolutionImageUrl || meta.resolution_image_url || null,
    resolutionVideoUrl: meta.resolutionVideoUrl || meta.resolution_video_url || null,
  }
}

function getQuestionIds(simulado) {
  const settings = simulado?.settings && typeof simulado.settings === 'object' ? simulado.settings : {}
  const fromSettings = asArray(settings.questionIds).map((v) => String(v || '').trim()).filter(Boolean)
  const fromTop = asArray(simulado?.question_ids).map((v) => String(v || '').trim()).filter(Boolean)
  const ids = fromSettings.length ? fromSettings : fromTop
  return ids.filter((v) => isUuid(v))
}

function getCourseIds(simulado) {
  const settings = simulado?.settings && typeof simulado.settings === 'object' ? simulado.settings : {}
  const fromSettings = asArray(settings.courseIds).map((v) => String(v || '').trim()).filter(Boolean)
  const fromTop = asArray(simulado?.course_ids).map((v) => String(v || '').trim()).filter(Boolean)
  const ids = fromSettings.length ? fromSettings : fromTop
  return ids.filter((v) => isUuid(v))
}

async function fetchJsonWithTimeout(url, timeoutMs) {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), Math.max(250, Number(timeoutMs) || 4500))
  try {
    const r = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { Accept: 'application/json', 'User-Agent': 'connekt-domain-check/1.0' },
      signal: controller.signal,
    })
    const contentType = String(r.headers.get('content-type') || '')
    let jsonBody = null
    if (contentType.includes('application/json')) {
      jsonBody = await r.json().catch(() => null)
    }
    return { ok: r.ok, status: r.status, headers: Object.fromEntries(r.headers.entries()), json: jsonBody }
  } finally {
    clearTimeout(t)
  }
}

function getErrCode(e) {
  return String(e?.code || e?.cause?.code || e?.cause?.errno || '').trim()
}

function readEnv(name, fallback = '') {
  const v = process.env[name]
  return v ? String(v).trim() : fallback
}

function isValidEmail(value) {
  const v = String(value || '').trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

function escapeHtml(s) {
  return String(s || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

async function sendSendgridEmail({ to, subject, text, html }) {
  const apiKey = readEnv('SENDGRID_API_KEY')
  const fromEmail = readEnv('SENDGRID_FROM_EMAIL', 'no-reply@connektco.com')
  const fromName = readEnv('SENDGRID_FROM_NAME', 'Connekt')
  const replyTo = readEnv('SENDGRID_REPLY_TO', '')
  if (!apiKey || !isValidEmail(fromEmail) || !isValidEmail(to) || !subject) return { ok: false, skipped: true }

  const content = []
  if (text) content.push({ type: 'text/plain', value: String(text) })
  if (html) content.push({ type: 'text/html', value: String(html) })
  if (content.length === 0) return { ok: false, skipped: true }

  const r = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: fromEmail, name: fromName },
      reply_to: replyTo && isValidEmail(replyTo) ? { email: replyTo } : undefined,
      subject,
      content,
    }),
  })
  if (!r.ok) return { ok: false, skipped: false }
  return { ok: true }
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' })

  const admin = getSupabaseAdmin()
  if (!admin) return json(res, 501, { error: 'proxy_disabled', hint: 'Configure SUPABASE_SERVICE_ROLE_KEY no ambiente do deploy.' })

  try {
    const u = new URL(req.url, `http://${req.headers.host}`)
    const type = String(u.searchParams.get('type') || '').trim().toLowerCase()
    const producerId = String(u.searchParams.get('producerId') || '').trim()

    if (type === 'public_branding') {
      const hostParam = normalizeHost(u.searchParams.get('host') || req.headers.host || '')
      let resolvedProducerId = producerId && isUuid(producerId) ? producerId : ''
      if (!resolvedProducerId && hostParam) {
        const httpsUrl = `https://${hostParam}`
        const httpUrl = `http://${hostParam}`
        const { data } = await admin
          .from('profiles')
          .select('user_id,member_area_url')
          .in('member_area_url', [httpsUrl, httpUrl])
          .limit(1)
        const row = Array.isArray(data) ? data[0] : null
        resolvedProducerId = row?.user_id ? String(row.user_id).trim() : ''
      }
      if (!resolvedProducerId || !isUuid(resolvedProducerId)) return json(res, 200, { producerId: '', brand: null })
      let memberAreaUrl = ''
      try {
        const q1 = await admin.from('profiles').select('member_area_url').eq('user_id', resolvedProducerId).maybeSingle()
        if (q1?.data?.member_area_url) memberAreaUrl = String(q1.data.member_area_url).trim()
      } catch (_) {}
      let user = null
      try {
        const { data } = await admin.auth.admin.getUserById(resolvedProducerId)
        user = data?.user || null
      } catch (_) {
        user = null
      }
      return json(res, 200, { producerId: resolvedProducerId, brand: pickWhitelabel(user), member_area_url: memberAreaUrl })
    }

    if (type === 'public_simulados') {
      res.setHeader('Cache-Control', 'no-store')
      const producerUid = String(u.searchParams.get('producer_uid') || u.searchParams.get('producerId') || producerId || '').trim()
      const debug = String(u.searchParams.get('debug') || '').trim() === '1'
      if (!producerUid || !isUuid(producerUid)) return json(res, 400, { error: 'invalid_producer_uid' })

      const producerKeysSet = new Set([producerUid].filter(Boolean))
      try {
        try {
          const { data: profile } = await admin
            .from('profiles')
            .select('id,user_id')
            .or(`id.eq.${producerUid},user_id.eq.${producerUid}`)
            .maybeSingle()
          if (profile?.id) producerKeysSet.add(String(profile.id).trim())
          if (profile?.user_id) producerKeysSet.add(String(profile.user_id).trim())
        } catch (_) {}
        const { data: prod } = await admin
          .from('producers')
          .select('id,user_id,external_id')
          .or(`id.eq.${producerUid},user_id.eq.${producerUid},external_id.eq.${producerUid}`)
          .maybeSingle()
        if (prod?.id) producerKeysSet.add(String(prod.id).trim())
        if (prod?.user_id) producerKeysSet.add(String(prod.user_id).trim())
        if (prod?.external_id) producerKeysSet.add(String(prod.external_id).trim())
        if (prod?.user_id) {
          try {
            const uid = String(prod.user_id).trim()
            if (uid) {
              const { data: third } = await admin.from('producers').select('id').eq('user_id', uid).maybeSingle()
              if (third?.id) producerKeysSet.add(String(third.id).trim())
            }
          } catch (_) {}
        }
      } catch (_) {}
      const producerKeys = Array.from(producerKeysSet).map((v) => String(v || '').trim()).filter(Boolean)
      if (producerKeys.length === 0) return json(res, 404, { error: 'producer_not_found' })

      const nowIso = new Date().toISOString()
      const isMissingColumn = (err, col) => {
        const msg = String(err?.message || err?.details || err || '').toLowerCase()
        const code = String(err?.code || '').toUpperCase()
        const c = String(col || '').toLowerCase()
        return (
          code === 'PGRST204' ||
          code === '42703' ||
          msg.includes(`could not find the '${c}' column`) ||
          (msg.includes('schema cache') && msg.includes(c)) ||
          (msg.includes('does not exist') && msg.includes(c))
        )
      }

      const selectAttempts = [
        'id,title,cover_image_url,is_paid,price,availability_date,duration_minutes,max_grade,settings,created_at,produtor_id,user_id,created_by',
        'id,title,cover_image_url,is_paid,price,availability_date,duration_minutes,max_grade,settings,created_at,user_id,created_by',
        'id,title,cover_image_url,is_paid,price,availability_date,duration_minutes,max_grade,settings,created_at,user_id',
        'id,title,cover_image_url,is_paid,price,availability_date,duration_minutes,max_grade,settings,created_at',
        '*',
      ]

      const fetchPublishedByOwnerColumn = async (col) => {
        for (const sel of selectAttempts) {
          const orAttempts = [
            `published.eq.true,status.ilike.publicado,availability_date.is.null,availability_date.lte.${nowIso}`,
            `published.eq.true,availability_date.is.null,availability_date.lte.${nowIso}`,
            `status.ilike.publicado,availability_date.is.null,availability_date.lte.${nowIso}`,
            `availability_date.is.null,availability_date.lte.${nowIso}`,
          ]
          for (const orExpr of orAttempts) {
            try {
              const q = admin
                .from('simulados')
                .select(sel)
                .in(col, producerKeys)
                .or(orExpr)
                .order('created_at', { ascending: false })
                .limit(200)
              const { data, error } = await q
              if (error) {
                if (
                  isMissingColumn(error, col) ||
                  (sel.includes('produtor_id') && isMissingColumn(error, 'produtor_id')) ||
                  (sel.includes('created_by') && isMissingColumn(error, 'created_by')) ||
                  (orExpr.includes('availability_date') && isMissingColumn(error, 'availability_date')) ||
                  (orExpr.includes('status.') && isMissingColumn(error, 'status')) ||
                  (orExpr.includes('published.') && isMissingColumn(error, 'published'))
                ) {
                  continue
                }
                return { data: [], error }
              }
              return { data: Array.isArray(data) ? data : [], error: null }
            } catch (e) {
              if (
                isMissingColumn(e, col) ||
                (orExpr.includes('availability_date') && isMissingColumn(e, 'availability_date')) ||
                (orExpr.includes('status.') && isMissingColumn(e, 'status')) ||
                (orExpr.includes('published.') && isMissingColumn(e, 'published'))
              ) {
                continue
              }
              return { data: [], error: e }
            }
          }
        }
        return { data: [], error: null }
      }

      const merged = []
      const seen = new Set()
      let lastError = null
      for (const col of ['produtor_id', 'user_id', 'created_by']) {
        const r = await fetchPublishedByOwnerColumn(col)
        if (r.error) {
          lastError = r.error
          continue
        }
        for (const row of r.data) {
          const id = String(row?.id || '').trim()
          if (!id || seen.has(id)) continue
          seen.add(id)
          merged.push(row)
        }
      }

      if (merged.length === 0 && lastError) {
        const msg = String(lastError?.message || lastError || '')
        const lower = msg.toLowerCase()
        if (lower.includes('does not exist') || lower.includes('unknown') || lower.includes('column') || lower.includes('not found')) {
          return json(res, 200, { data: [], meta: debug ? { producer_uid: producerUid, producerKeys, note: 'schema_missing_columns' } : undefined })
        }
        return json(res, 500, { error: msg || 'fetch_failed' })
      }

      if (debug) {
        const countByOwner = async (col) => {
          try {
            const { count, error } = await admin.from('simulados').select('id', { head: true, count: 'exact' }).in(col, producerKeys)
            if (error) return null
            return Number(count || 0) || 0
          } catch (_) {
            return null
          }
        }
        const countAvailByOwner = async (col) => {
          try {
            const { count, error } = await admin
              .from('simulados')
              .select('id', { head: true, count: 'exact' })
              .in(col, producerKeys)
              .or(`availability_date.is.null,availability_date.lte.${nowIso}`)
            if (error) return null
            return Number(count || 0) || 0
          } catch (_) {
            return null
          }
        }
        const counts = {}
        for (const col of ['produtor_id', 'user_id', 'created_by']) {
          counts[col] = { total: await countByOwner(col), available: await countAvailByOwner(col) }
        }
        return json(res, 200, { producer_uid: producerUid, data: merged, meta: { producer_uid: producerUid, producerKeys, nowIso, counts } })
      }

      return json(res, 200, { producer_uid: producerUid, data: merged })
    }

    if (type === 'aluno_redirect') {
      res.setHeader('Cache-Control', 'no-store')
      const producerUid = String(u.searchParams.get('producer_uid') || producerId || '').trim()
      const p = String(u.searchParams.get('p') || '').trim() || '/aluno'
      const q = String(u.searchParams.get('q') || '').trim()
      if (!producerUid || !isUuid(producerUid)) {
        res.statusCode = 302
        res.setHeader('Location', '/aluno')
        res.end('')
        return
      }
      let memberAreaUrl = ''
      try {
        const r = await admin.from('profiles').select('member_area_url').eq('user_id', producerUid).maybeSingle()
        memberAreaUrl = String(r?.data?.member_area_url || '').trim()
      } catch (_) {
        memberAreaUrl = ''
      }
      if (!memberAreaUrl) {
        res.statusCode = 302
        res.setHeader('Location', `/aluno?producer_uid=${encodeURIComponent(producerUid)}`)
        res.end('')
        return
      }
      let dest = ''
      try {
        const base = new URL(memberAreaUrl)
        const safePath = p.startsWith('/') ? p : `/${p}`
        base.pathname = safePath
        if (q && q.startsWith('?')) base.search = q
        else if (q) base.search = `?${q}`
        else base.search = `?producer_uid=${encodeURIComponent(producerUid)}`
        if (!base.searchParams.get('producer_uid')) base.searchParams.set('producer_uid', producerUid)
        dest = base.toString()
      } catch (_) {
        dest = `/aluno?producer_uid=${encodeURIComponent(producerUid)}`
      }
      res.statusCode = 302
      res.setHeader('Location', dest)
      res.end('')
      return
    }

    const auth = await getAuthedUser(admin, req)
    if (!auth.user) return json(res, 401, { error: auth.error || 'unauthorized' })

    if (type === 'ensure_courses_media_upload' && (req.method === 'GET' || req.method === 'POST')) {
      res.setHeader('Cache-Control', 'no-store')
      const bytesParam = String(u.searchParams.get('bytes') || u.searchParams.get('size') || '').trim()
      const contentTypeParam = String(u.searchParams.get('contentType') || u.searchParams.get('content_type') || '').trim().toLowerCase()
      const bodyRaw = req.method === 'POST' ? await readRawBody(req).catch(() => null) : null
      let body = null
      try { body = bodyRaw ? JSON.parse(bodyRaw.toString('utf-8') || '{}') : null } catch (_) { body = null }
      const bytes = Number(bytesParam || body?.bytes || body?.size || 0)
      if (!Number.isFinite(bytes) || bytes <= 0) return json(res, 400, { ok: false, error: 'invalid_bytes' })
      const contentType = String(contentTypeParam || body?.contentType || body?.content_type || '').trim().toLowerCase()

      const PLAN_LIMITS_GB = { teste: 1, start: 5, pro: 50, premium: 500, qa: 500 }
      const userId = String(auth.user.id || '').trim()
      let activePlan = ''
      try {
        const { data } = await admin.from('profiles').select('active_plan').eq('user_id', userId).maybeSingle()
        if (data?.active_plan) activePlan = String(data.active_plan).trim().toLowerCase()
      } catch (_) {}
      const storageGb = PLAN_LIMITS_GB[activePlan] || null
      const planLimitBytes = typeof storageGb === 'number' ? storageGb * 1024 * 1024 * 1024 : null
      const maxSingleFileBytes = typeof planLimitBytes === 'number' ? planLimitBytes : null
      if (typeof planLimitBytes === 'number' && bytes > planLimitBytes) {
        return json(res, 403, { ok: false, error: 'file_exceeds_plan_storage', planKey: activePlan || null, limitBytes: planLimitBytes, bytes })
      }
      if (typeof maxSingleFileBytes === 'number' && bytes > maxSingleFileBytes) {
        return json(res, 403, { ok: false, error: 'file_exceeds_max_single_file', maxSingleFileBytes, bytes })
      }

      const supabaseUrl = String(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim()
      const serviceRole = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
      if (!supabaseUrl || !serviceRole) return json(res, 501, { ok: false, error: 'missing_supabase_env' })

      const bucketId = 'courses-media'
      const headers = { Authorization: `Bearer ${serviceRole}`, apikey: serviceRole, 'Content-Type': 'application/json' }
      const baseAllowed = [
        'image/*',
        'video/*',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/octet-stream',
      ]
      const unionAllowed = (currentAllowed) => {
        const set = new Set()
        for (const v of Array.isArray(currentAllowed) ? currentAllowed : []) {
          const s = String(v || '').trim()
          if (s) set.add(s)
        }
        for (const v of baseAllowed) set.add(v)
        if (contentType && contentType.includes('/')) set.add(contentType)
        return Array.from(set)
      }
      const readBucket = async () => {
        const r = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/storage/v1/bucket/${encodeURIComponent(bucketId)}`, { method: 'GET', headers })
        const j = await r.json().catch(() => null)
        return { ok: r.ok, status: r.status, data: j }
      }
      const upsertBucket = async (payload) => {
        const r = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/storage/v1/bucket/${encodeURIComponent(bucketId)}`, { method: 'PUT', headers, body: JSON.stringify(payload || {}) })
        const j = await r.json().catch(() => null)
        return { ok: r.ok, status: r.status, data: j }
      }
      const createBucket = async (payload) => {
        const r = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/storage/v1/bucket`, { method: 'POST', headers, body: JSON.stringify(payload || {}) })
        const j = await r.json().catch(() => null)
        return { ok: r.ok, status: r.status, data: j }
      }

      const current = await readBucket()
      const currentLimit = Number(current?.data?.file_size_limit || current?.data?.fileSizeLimit || 0)
      const desired = Math.max(currentLimit || 0, bytes)
      if (!current.ok && current.status === 404) {
        const created = await createBucket({ id: bucketId, name: bucketId, public: true, allowed_mime_types: unionAllowed(null), file_size_limit: desired })
        if (!created.ok) return json(res, 500, { ok: false, error: 'bucket_create_failed', status: created.status })
        return json(res, 200, { ok: true, bucketId, fileSizeLimit: desired, updated: true, created: true })
      }
      if (!current.ok) return json(res, 500, { ok: false, error: 'bucket_read_failed', status: current.status })
      const currentAllowed = Array.isArray(current?.data?.allowed_mime_types) ? current.data.allowed_mime_types : null
      const nextAllowed = unionAllowed(currentAllowed)
      const allowedNeedsUpdate = (() => {
        if (!Array.isArray(currentAllowed)) return true
        if (currentAllowed.length < nextAllowed.length) return true
        if (contentType && contentType.includes('/') && !currentAllowed.includes(contentType)) return true
        return false
      })()
      if (currentLimit && currentLimit >= desired && !allowedNeedsUpdate) return json(res, 200, { ok: true, bucketId, fileSizeLimit: currentLimit, updated: false })

      const nextPayload = {
        id: bucketId,
        name: current?.data?.name || bucketId,
        public: typeof current?.data?.public === 'boolean' ? current.data.public : true,
        allowed_mime_types: nextAllowed,
        file_size_limit: desired,
      }
      const updated = await upsertBucket(nextPayload)
      if (!updated.ok) {
        const msg = String(updated?.data?.message || updated?.data?.error || '').toLowerCase()
        const sc = Number(updated?.data?.statusCode || updated.status || 0)
        const isTooLarge = sc === 413 || msg.includes('payload too large') || msg.includes('maximum allowed size') || msg.includes('exceeded the maximum allowed size')
        if (isTooLarge) {
          const limit = currentLimit > 0 ? currentLimit : null
          return json(res, 403, { ok: false, error: 'file_exceeds_supabase_max', maxBytes: limit, bytes })
        }
        return json(res, 500, { ok: false, error: 'bucket_update_failed', status: updated.status })
      }
      return json(res, 200, { ok: true, bucketId, fileSizeLimit: desired, updated: true })
    }

    const getFileSizeFromMeta = (meta) => {
      if (!meta) return null
      const candidates = [
        meta.size,
        meta.contentLength,
        meta['content-length'],
        meta['Content-Length'],
        meta['contentLength'],
      ]
      for (const c of candidates) {
        const n = Number(c)
        if (Number.isFinite(n) && n >= 0) return n
      }
      return null
    }

    const listAllFilesBytes = async (bucket, rootPath, { maxItems = 50000 } = {}) => {
      const queue = [String(rootPath || '').replace(/\/+$/, '')]
      const visited = new Set()
      let total = 0
      let scanned = 0
      let truncated = false

      while (queue.length > 0) {
        const prefix = queue.shift()
        if (visited.has(prefix)) continue
        visited.add(prefix)
        const { data: items, error } = await admin.storage.from(bucket).list(prefix || '', { limit: 1000, offset: 0 })
        if (error) throw error
        const arr = Array.isArray(items) ? items : []
        for (const it of arr) {
          scanned += 1
          if (scanned > maxItems) { truncated = true; break }
          const name = String(it?.name || '')
          const id = it?.id || null
          const isFolder = !id && (!it?.metadata || Object.keys(it?.metadata || {}).length === 0)
          if (isFolder) {
            const nextPrefix = prefix ? `${prefix}/${name}` : name
            queue.push(nextPrefix)
            continue
          }
          const sz = getFileSizeFromMeta(it?.metadata)
          if (typeof sz === 'number') total += sz
        }
        if (truncated) break
      }

      return { bytes: total, truncated }
    }

    if (req.method === 'GET' && type === 'storage_usage') {
      res.setHeader('Cache-Control', 'no-store')
      const askedUserId = String(u.searchParams.get('userId') || '').trim()
      const userId = askedUserId || String(auth.user.id || '').trim()
      if (!userId || userId !== String(auth.user.id || '').trim()) return json(res, 403, { error: 'forbidden' })

      const buckets = [
        { bucket: 'courses-media', prefix: `users/${userId}` },
        { bucket: 'question-images', prefix: `${userId}` },
      ]
      const results = await Promise.all(
        buckets.map(async (b) => {
          try {
            return await listAllFilesBytes(b.bucket, b.prefix)
          } catch (_) {
            return { bytes: 0, truncated: false }
          }
        })
      )
      const bytes = results.reduce((acc, r) => acc + (Number(r?.bytes) || 0), 0)
      const truncated = results.some((r) => !!r?.truncated)
      return json(res, 200, { ok: true, userId, bytes, truncated })
    }

    const insertWithColumnPrune = async (table, initialPayload, maxAttempts = 10) => {
      let payload = { ...(initialPayload || {}) }
      for (let i = 0; i < maxAttempts; i += 1) {
        const { data, error } = await admin.from(table).insert(payload).select().single()
        if (!error) return { data, error: null }
        const msg = String(error?.message || '')
        const lower = msg.toLowerCase()
        const isMissingColumn =
          (lower.includes('does not exist') && lower.includes('column')) ||
          (lower.includes('schema cache') && lower.includes('could not find') && lower.includes('column'))
        if (!isMissingColumn) return { data: null, error }
        const m1 = msg.match(/column \"([^\"]+)\"/i)
        const m2 = msg.match(/the '([^']+)' column/i)
        const col = m1?.[1] || m2?.[1] || ''
        if (!col || !(col in payload)) return { data: null, error }
        delete payload[col]
      }
      return { data: null, error: new Error('Insert failed after pruning columns') }
    }

    const updateWithColumnPrune = async (table, { eqColumn, eqValue, payload: initialPayload }, maxAttempts = 10) => {
      const col = String(eqColumn || '').trim() || 'id'
      const val = String(eqValue || '').trim()
      let payload = { ...(initialPayload || {}) }
      for (let i = 0; i < maxAttempts; i += 1) {
        const { data, error } = await admin.from(table).update(payload).eq(col, val).select().single()
        if (!error) return { data, error: null }
        const msg = String(error?.message || '')
        const lower = msg.toLowerCase()
        const isMissingColumn =
          (lower.includes('does not exist') && lower.includes('column')) ||
          (lower.includes('schema cache') && lower.includes('could not find') && lower.includes('column'))
        if (!isMissingColumn) return { data: null, error }
        const m1 = msg.match(/column \"([^\"]+)\"/i)
        const m2 = msg.match(/the '([^']+)' column/i)
        const missing = m1?.[1] || m2?.[1] || ''
        if (!missing || !(missing in payload)) return { data: null, error }
        delete payload[missing]
      }
      return { data: null, error: new Error('Update failed after pruning columns') }
    }

    const resolveProducerRowIdFromUserId = async (userId) => {
      const uid = String(userId || '').trim()
      if (!uid) return ''
      try {
        const first = await admin.from('producers').select('id').eq('id', uid).maybeSingle()
        if (first?.data?.id) return String(first.data.id).trim()
      } catch (_) {}
      try {
        const second = await admin.from('producers').select('id').eq('external_id', uid).maybeSingle()
        if (second?.data?.id) return String(second.data.id).trim()
      } catch (_) {}
      try {
        const third = await admin.from('producers').select('id').eq('user_id', uid).maybeSingle()
        if (third?.data?.id) return String(third.data.id).trim()
      } catch (_) {
        return ''
      }
      return ''
    }

    const resolveStudentId = async (user, studentName) => {
      const email = String(user?.email || '').trim().toLowerCase()
      const uid = String(user?.id || '').trim()
      if (!uid) return { id: null, error: 'missing_user_id' }

      const selectFirst = async (queryFactory) => {
        try {
          const { data, error } = await queryFactory()
          if (error) return null
          const first = Array.isArray(data) ? data[0] : data
          const id = first?.id
          return id ? String(id).trim() : null
        } catch (_) {
          return null
        }
      }

      const resolved =
        await selectFirst(() => admin.from('students').select('id').eq('user_id', uid).limit(1)) ||
        await selectFirst(() => admin.from('students').select('id').eq('external_id', uid).limit(1)) ||
        (email ? await selectFirst(() => admin.from('students').select('id').eq('email', email).limit(1)) : null)

      if (resolved) return { id: resolved, error: null }

      const baseName = String(studentName || 'Aluno').trim() || 'Aluno'
      const payloadCandidates = [
        { user_id: uid, external_id: uid, name: baseName, email: email || null, avatar_url: null },
        { user_id: uid, name: baseName, email: email || null },
        { external_id: uid, name: baseName, email: email || null },
        { name: baseName, email: email || null },
      ]

      let lastError = null
      for (const payload of payloadCandidates) {
        const { data, error } = await insertWithColumnPrune('students', payload, 10)
        if (!error) {
          const insertedId = data?.id ? String(data.id).trim() : null
          if (insertedId) return { id: insertedId, error: null }
          const again =
            await selectFirst(() => admin.from('students').select('id').eq('user_id', uid).limit(1)) ||
            await selectFirst(() => admin.from('students').select('id').eq('external_id', uid).limit(1)) ||
            (email ? await selectFirst(() => admin.from('students').select('id').eq('email', email).limit(1)) : null)
          if (again) return { id: again, error: null }
        } else {
          lastError = error
        }
      }

      return { id: null, error: String(lastError?.message || lastError || 'student_insert_failed') }
    }

    const selectFirstRow = async (queryFactory) => {
      try {
        const { data, error } = await queryFactory()
        if (error) return null
        return Array.isArray(data) ? (data[0] || null) : (data || null)
      } catch (_) {
        return null
      }
    }

    const resolveConversationId = async ({ producerKey, studentId, subject }) => {
      const pk = String(producerKey || '').trim()
      const sid = String(studentId || '').trim()
      const subj = String(subject || '').trim()
      if (!pk || !sid || !subj) return ''

      const attempts = [
        { producer_id: pk, student_id: sid, subject: subj },
        { producer_external_id: pk, student_external_id: sid, subject: subj },
        { producer_external_id: pk, student_id: sid, subject: subj },
        { producer_id: pk, student_external_id: sid, subject: subj },
      ]

      for (const where of attempts) {
        try {
          let q = admin.from('conversations').select('id').limit(1)
          for (const [k, v] of Object.entries(where)) {
            q = q.eq(k, v)
          }
          const row = await selectFirstRow(() => q)
          const id = row?.id ? String(row.id).trim() : ''
          if (id) return id
        } catch (_) {}
      }

      return ''
    }

    const conversationBelongsToProducer = async (conversationId, producerKeys) => {
      const cid = String(conversationId || '').trim()
      const keys = Array.isArray(producerKeys) ? producerKeys.map((v) => String(v || '').trim()).filter(Boolean) : []
      if (!cid || keys.length === 0) return false

      const attempts = [
        () => admin.from('conversations').select('id').eq('id', cid).in('producer_id', keys).limit(1),
        () => admin.from('conversations').select('id').eq('id', cid).in('producer_external_id', keys).limit(1),
      ]
      for (const fn of attempts) {
        const row = await selectFirstRow(fn)
        if (row?.id) return true
      }
      return false
    }

    const conversationBelongsToProducerAndStudent = async ({ conversationId, producerKey, studentId }) => {
      const cid = String(conversationId || '').trim()
      const pk = String(producerKey || '').trim()
      const sid = String(studentId || '').trim()
      if (!cid || !pk || !sid) return false

      const attempts = [
        { id: cid, producer_id: pk, student_id: sid },
        { id: cid, producer_external_id: pk, student_external_id: sid },
        { id: cid, producer_external_id: pk, student_id: sid },
        { id: cid, producer_id: pk, student_external_id: sid },
      ]

      for (const where of attempts) {
        try {
          let q = admin.from('conversations').select('id').limit(1)
          for (const [k, v] of Object.entries(where)) q = q.eq(k, v)
          const row = await selectFirstRow(() => q)
          if (row?.id) return true
        } catch (_) {}
      }
      return false
    }

    const fetchConversationFeedLoose = async (conversationId) => {
      const cid = String(conversationId || '').trim()
      if (!cid) return []

      try {
        const { data, error } = await admin
          .from('v_posts_with_replies')
          .select(`
            post_id,
            conversation_id,
            content,
            created_at,
            likes,
            liked,
            replies_json
          `)
          .eq('conversation_id', cid)
          .order('created_at', { ascending: true })
          .limit(200)
        if (!error) {
          return (Array.isArray(data) ? data : []).map((row) => ({
            id: row.post_id,
            conversation_id: row.conversation_id,
            content: row.content,
            created_at: row.created_at,
            likes: row.likes,
            liked: row.liked,
            replies: (row.replies_json || []).map((reply) => ({ ...reply, liked_by: reply.liked_by || [] })),
          }))
        }
      } catch (_) {}

      const conversationCols = ['conversation_id', 'conversationId', 'conversation_external_id', 'conversation_externalId']
      let posts = []
      for (const col of conversationCols) {
        try {
          const { data, error } = await admin.from('posts').select('*').eq(col, cid).order('created_at', { ascending: true }).limit(200)
          if (error) continue
          posts = Array.isArray(data) ? data : []
          if (posts.length > 0) break
        } catch (_) {}
      }

      const mappedPosts = posts.map((p) => ({
        id: p?.id || p?.post_id || null,
        conversation_id: p?.conversation_id || p?.conversationId || p?.conversation_external_id || p?.conversation_externalId || cid,
        content: p?.content || p?.text || p?.body || p?.message || '',
        created_at: p?.created_at || p?.date || p?.inserted_at || null,
        likes: Number(p?.likes || 0),
        liked: !!p?.liked,
        replies: [],
      })).filter((p) => p.id)

      const postIds = mappedPosts.map((p) => p.id).filter(Boolean)
      if (postIds.length === 0) return mappedPosts

      const replyPostCols = ['post_id', 'postId']
      let replies = []
      for (const col of replyPostCols) {
        try {
          const { data, error } = await admin
            .from('replies')
            .select('*, author:producers(id, name, external_id)')
            .in(col, postIds)
            .order('created_at', { ascending: true })
            .limit(500)
          if (error) continue
          replies = Array.isArray(data) ? data : []
          break
        } catch (_) {}
      }
      if (replies.length === 0) {
        for (const col of replyPostCols) {
          try {
            const { data, error } = await admin.from('replies').select('*').in(col, postIds).order('created_at', { ascending: true }).limit(500)
            if (error) continue
            replies = Array.isArray(data) ? data : []
            break
          } catch (_) {}
        }
      }

      const byPostId = new Map()
      for (const r of replies) {
        const pid = r?.post_id || r?.postId
        if (!pid) continue
        const list = byPostId.get(pid) || []
        list.push({
          id: r?.id || null,
          content: r?.content || r?.text || r?.body || r?.message || '',
          created_at: r?.created_at || r?.date || null,
          likes: Number(r?.likes || 0),
          liked_by: Array.isArray(r?.liked_by) ? r.liked_by : (Array.isArray(r?.likedBy) ? r.likedBy : []),
          author: r?.author || null,
        })
        byPostId.set(pid, list)
      }

      return mappedPosts.map((p) => ({ ...p, replies: byPostId.get(p.id) || [] }))
    }

    const fetchConversationFeedCanonical = async (conversationId) => {
      const cid = String(conversationId || '').trim()
      if (!cid) return []

      try {
        try {
          const { data, error } = await admin
            .from('v_posts_with_replies')
            .select('post_id,conversation_id,content,created_at,likes,liked,replies_json')
            .eq('conversation_id', cid)
            .order('created_at', { ascending: true })
            .limit(200)
          if (!error && Array.isArray(data)) {
            return data.map((row) => ({
              id: row?.post_id || null,
              conversation_id: row?.conversation_id || cid,
              content: row?.content || '',
              created_at: row?.created_at || null,
              likes: Number(row?.likes || 0),
              liked: !!row?.liked,
              author: null,
              replies: (Array.isArray(row?.replies_json) ? row.replies_json : []).map((reply) => ({ ...reply, liked_by: reply?.liked_by || reply?.likedBy || [] })),
            })).filter((p) => p.id)
          }
        } catch (_) {}

        const { data: posts, error } = await admin
          .from('posts')
          .select('id,conversation_id,text,created_at,likes,liked,author_id,student_id,student_external_id')
          .eq('conversation_id', cid)
          .order('created_at', { ascending: true })
          .limit(200)
        if (error) return await fetchConversationFeedLoose(cid)

        const list = Array.isArray(posts) ? posts : []
        if (list.length === 0) return []
        const authorIds = Array.from(new Set(list.flatMap((p) => ([
          String(p?.author_id || '').trim(),
          String(p?.student_id || '').trim(),
          String(p?.student_external_id || '').trim(),
        ])).filter((v) => v && isUuid(v))))
        let authors = []
        if (authorIds.length > 0) {
          try {
            const { data } = await admin.from('students').select('id,user_id,external_id,name,avatar_url,email').in('id', authorIds).limit(200)
            authors = Array.isArray(data) ? data : []
          } catch (_) {
            const { data } = await admin.from('students').select('id,name,avatar_url,email').in('id', authorIds).limit(200)
            authors = Array.isArray(data) ? data : []
          }
          if (authors.length === 0) {
            try {
              const { data } = await admin.from('students').select('id,user_id,external_id,name,avatar_url,email').in('user_id', authorIds).limit(200)
              authors = Array.isArray(data) ? data : []
            } catch (_) {}
          }
          if (authors.length === 0) {
            try {
              const { data } = await admin.from('students').select('id,user_id,external_id,name,avatar_url,email').in('external_id', authorIds).limit(200)
              authors = Array.isArray(data) ? data : []
            } catch (_) {}
          }
        }
        const authorById = new Map()
        for (const a of authors) {
          const id = String(a?.id || '').trim()
          const uid = String(a?.user_id || '').trim()
          const ext = String(a?.external_id || '').trim()
          const author = {
            id: id || uid || ext,
            name: String(a?.name || 'Aluno'),
            avatar_url: a?.avatar_url || null,
            email: a?.email || '',
          }
          if (id) authorById.set(id, author)
          if (uid) authorById.set(uid, author)
          if (ext) authorById.set(ext, author)
        }

        const postIds = list.map((p) => p?.id).filter((v) => v && isUuid(String(v)))
        let replies = []
        if (postIds.length > 0) {
          try {
            const { data, error: rErr } = await admin
              .from('replies')
              .select('id,post_id,text,created_at,likes,liked_by,producer_id,author:producers(id,name,external_id)')
              .in('post_id', postIds)
              .order('created_at', { ascending: true })
              .limit(500)
            if (!rErr) replies = Array.isArray(data) ? data : []
          } catch (_) {}
          if (replies.length === 0) {
            try {
              const { data, error: rErr } = await admin
                .from('replies')
                .select('*')
                .in('post_id', postIds)
                .order('created_at', { ascending: true })
                .limit(500)
              if (!rErr) replies = Array.isArray(data) ? data : []
            } catch (_) {}
          }
        }

        const repliesByPostId = new Map()
        for (const r of replies) {
          const pid = String(r?.post_id || '').trim()
          if (!pid) continue
          const arr = repliesByPostId.get(pid) || []
          arr.push({
            id: r?.id || null,
            content: r?.text || r?.content || r?.body || r?.message || '',
            created_at: r?.created_at || null,
            likes: Number(r?.likes || 0),
            liked_by: Array.isArray(r?.liked_by) ? r.liked_by : (Array.isArray(r?.likedBy) ? r.likedBy : []),
            author: (r?.author && typeof r.author === 'object') ? r.author : null,
          })
          repliesByPostId.set(pid, arr)
        }

        return list.map((p) => {
          const pid = String(p?.id || '').trim()
          const aid = String(p?.author_id || p?.student_id || p?.student_external_id || '').trim()
          return {
            id: p?.id || null,
            conversation_id: p?.conversation_id || cid,
            content: p?.text || '',
            created_at: p?.created_at || null,
            likes: Number(p?.likes || 0),
            liked: !!p?.liked,
            author: aid ? (authorById.get(aid) || null) : null,
            replies: repliesByPostId.get(pid) || [],
          }
        }).filter((p) => p.id)
      } catch (_) {
        return await fetchConversationFeedLoose(cid)
      }
    }

    const conversationBelongsToProducerLoose = async (conversationId, producerKeys) => {
      const cid = String(conversationId || '').trim()
      const keys = Array.isArray(producerKeys) ? producerKeys.map((v) => String(v || '').trim()).filter(Boolean) : []
      if (!cid || keys.length === 0) return false

      for (const col of ['producer_id', 'producer_external_id']) {
        const row = await selectFirstRow(() => admin.from('conversations').select('id').eq('id', cid).in(col, keys).limit(1))
        if (row?.id) return true
      }
      return false
    }

    const insertPostForConversation = async ({ conversationId, content, authorId, authorUserId }) => {
      const cid = String(conversationId || '').trim()
      const bodyText = String(content || '').trim()
      const aid = String(authorId || '').trim()
      const uid = String(authorUserId || '').trim()
      if (!cid || !bodyText) return { post: null, error: new Error('invalid_post_payload') }

      const base = {
        conversation_id: cid,
        conversation_external_id: cid,
        conversationId: cid,
        conversation_externalId: cid,
        text: bodyText,
        content: bodyText,
        body: bodyText,
        message: bodyText,
        likes: 0,
        liked: false,
      }

      const candidates = [
        { ...base, ...(aid ? { author_id: aid } : {}), ...(aid ? { student_id: aid } : {}), ...(uid ? { student_external_id: uid } : {}) },
        { ...base, ...(uid ? { author_id: uid } : {}), ...(aid ? { student_id: aid } : {}), ...(uid ? { student_external_id: uid } : {}) },
        { ...base, ...(uid ? { author_id: uid } : {}), ...(aid ? { student_id: aid } : {}) },
        { ...base, ...(aid ? { author_id: aid } : {}) },
        { ...base, ...(uid ? { author_id: uid } : {}) },
      ].map((p) => Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined && v !== null && v !== '')))

      let lastErr = null
      for (const payload of candidates) {
        try {
          const { data, error } = await insertWithColumnPrune('posts', payload, 20)
          if (error || !data?.id) {
            lastErr = error || new Error('insert_failed')
            continue
          }
          const insertedCid = String(data?.conversation_id || data?.conversation_external_id || data?.conversationId || data?.conversation_externalId || '').trim()
          if (!insertedCid || insertedCid !== cid) {
            lastErr = new Error('post_without_conversation_link')
            continue
          }
          return { post: data, error: null }
        } catch (e) {
          lastErr = e
        }
      }
      return { post: null, error: lastErr || new Error('insert_failed') }
    }

    if (req.method === 'POST' && type === 'student_post_update') {
      const raw = await readRawBody(req)
      const parsed = JSON.parse(raw.toString('utf-8') || '{}')
      const postId = String(parsed?.postId || parsed?.post_id || '').trim()
      const content = String(parsed?.content || parsed?.text || '').trim()
      const studentName = String(parsed?.studentName || parsed?.student_name || 'Aluno').trim()

      if (!postId || !isUuid(postId)) return json(res, 400, { error: 'invalid_postId' })
      if (!content) return json(res, 400, { error: 'invalid_content' })

      const studentResolution = await resolveStudentId(auth.user, studentName)
      const studentId = String(studentResolution?.id || '').trim()
      if (!studentId) return json(res, 500, { error: 'student_not_resolved', message: String(studentResolution?.error || '') })
      const userId = String(auth.user?.id || '').trim()

      const isMissingColumn = (err, col) => {
        const msg = String(err?.message || err?.details || err || '').toLowerCase()
        const code = String(err?.code || '').toUpperCase()
        const c = String(col || '').toLowerCase()
        return (
          code === 'PGRST204' ||
          code === '42703' ||
          msg.includes(`could not find the '${c}' column`) ||
          (msg.includes('schema cache') && msg.includes(c)) ||
          (msg.includes('does not exist') && msg.includes(c))
        )
      }

      const fetchPostRow = async () => {
        const selects = [
          'id,conversation_id,author_id,student_id,student_external_id,text,content,body,message',
          'id,conversation_id,author_id,text,content,body,message',
          '*',
        ]
        for (const sel of selects) {
          try {
            const { data, error } = await admin.from('posts').select(sel).eq('id', postId).maybeSingle()
            if (error) {
              if (sel !== '*' && (isMissingColumn(error, 'student_id') || isMissingColumn(error, 'student_external_id') || isMissingColumn(error, 'author_id'))) continue
              if (sel !== '*' && isMissingColumn(error, 'body')) continue
              if (sel !== '*' && isMissingColumn(error, 'message')) continue
              if (sel !== '*' && isMissingColumn(error, 'content')) continue
              if (sel !== '*' && isMissingColumn(error, 'text')) continue
              return { row: null, error }
            }
            return { row: data || null, error: null }
          } catch (e) {
            if (sel !== '*' && (isMissingColumn(e, 'student_id') || isMissingColumn(e, 'student_external_id') || isMissingColumn(e, 'author_id'))) continue
            if (sel !== '*' && isMissingColumn(e, 'body')) continue
            if (sel !== '*' && isMissingColumn(e, 'message')) continue
            if (sel !== '*' && isMissingColumn(e, 'content')) continue
            if (sel !== '*' && isMissingColumn(e, 'text')) continue
            return { row: null, error: e }
          }
        }
        return { row: null, error: null }
      }

      const { row: postRow, error: postErr } = await fetchPostRow()
      if (postErr) return json(res, 500, { error: 'post_fetch_failed', message: String(postErr?.message || postErr || '') })
      if (!postRow) return json(res, 404, { error: 'post_not_found' })

      const authorKeys = [
        String(postRow?.author_id || '').trim(),
        String(postRow?.student_id || '').trim(),
        String(postRow?.student_external_id || '').trim(),
      ].filter(Boolean)
      let allowed = authorKeys.includes(studentId) || (userId ? authorKeys.includes(userId) : false)

      const conversationId = String(postRow?.conversation_id || postRow?.conversation_external_id || postRow?.conversationId || postRow?.conversation_externalId || '').trim()
      if (!allowed && conversationId) {
        const attempts = [
          () => admin.from('conversations').select('id').eq('id', conversationId).eq('student_id', studentId).maybeSingle(),
          () => admin.from('conversations').select('id').eq('id', conversationId).eq('student_external_id', studentId).maybeSingle(),
          () => admin.from('conversations').select('id').eq('id', conversationId).eq('student_id', userId).maybeSingle(),
          () => admin.from('conversations').select('id').eq('id', conversationId).eq('student_external_id', userId).maybeSingle(),
        ]
        for (const fn of attempts) {
          try {
            const { data, error } = await fn()
            if (!error && data?.id) { allowed = true; break }
          } catch (_) {}
        }
      }
      if (!allowed) return json(res, 403, { error: 'forbidden' })

      const updatePayload = {
        text: content,
        content,
        body: content,
        message: content,
      }
      const { data: updated, error: upErr } = await updateWithColumnPrune('posts', { eqColumn: 'id', eqValue: postId, payload: updatePayload }, 20)
      if (upErr || !updated?.id) return json(res, 500, { error: 'post_update_failed', message: String(upErr?.message || upErr || '') })

      try {
        if (conversationId) await admin.from('conversations').update({ date: new Date().toISOString() }).eq('id', conversationId)
      } catch (_) {}

      const updatedText = String(updated?.text || updated?.content || updated?.body || updated?.message || content)
      return json(res, 200, { ok: true, post: { id: updated.id, content: updatedText } })
    }

    if (req.method === 'POST' && type === 'student_post_delete') {
      const raw = await readRawBody(req)
      const parsed = JSON.parse(raw.toString('utf-8') || '{}')
      const postId = String(parsed?.postId || parsed?.post_id || '').trim()
      const studentName = String(parsed?.studentName || parsed?.student_name || 'Aluno').trim()

      if (!postId || !isUuid(postId)) return json(res, 400, { error: 'invalid_postId' })

      const studentResolution = await resolveStudentId(auth.user, studentName)
      const studentId = String(studentResolution?.id || '').trim()
      if (!studentId) return json(res, 500, { error: 'student_not_resolved', message: String(studentResolution?.error || '') })
      const userId = String(auth.user?.id || '').trim()

      const isMissingColumn = (err, col) => {
        const msg = String(err?.message || err?.details || err || '').toLowerCase()
        const code = String(err?.code || '').toUpperCase()
        const c = String(col || '').toLowerCase()
        return (
          code === 'PGRST204' ||
          code === '42703' ||
          msg.includes(`could not find the '${c}' column`) ||
          (msg.includes('schema cache') && msg.includes(c)) ||
          (msg.includes('does not exist') && msg.includes(c))
        )
      }

      const fetchPostRow = async () => {
        const selects = [
          'id,conversation_id,author_id,student_id,student_external_id',
          'id,conversation_id,author_id',
          '*',
        ]
        for (const sel of selects) {
          try {
            const { data, error } = await admin.from('posts').select(sel).eq('id', postId).maybeSingle()
            if (error) {
              if (sel !== '*' && (isMissingColumn(error, 'student_id') || isMissingColumn(error, 'student_external_id') || isMissingColumn(error, 'author_id'))) continue
              return { row: null, error }
            }
            return { row: data || null, error: null }
          } catch (e) {
            if (sel !== '*' && (isMissingColumn(e, 'student_id') || isMissingColumn(e, 'student_external_id') || isMissingColumn(e, 'author_id'))) continue
            return { row: null, error: e }
          }
        }
        return { row: null, error: null }
      }

      const { row: postRow, error: postErr } = await fetchPostRow()
      if (postErr) return json(res, 500, { error: 'post_fetch_failed', message: String(postErr?.message || postErr || '') })
      if (!postRow) return json(res, 404, { error: 'post_not_found' })

      const authorKeys = [
        String(postRow?.author_id || '').trim(),
        String(postRow?.student_id || '').trim(),
        String(postRow?.student_external_id || '').trim(),
      ].filter(Boolean)
      let allowed = authorKeys.includes(studentId) || (userId ? authorKeys.includes(userId) : false)

      const conversationId = String(postRow?.conversation_id || postRow?.conversation_external_id || postRow?.conversationId || postRow?.conversation_externalId || '').trim()
      if (!allowed && conversationId) {
        const attempts = [
          () => admin.from('conversations').select('id').eq('id', conversationId).eq('student_id', studentId).maybeSingle(),
          () => admin.from('conversations').select('id').eq('id', conversationId).eq('student_external_id', studentId).maybeSingle(),
          () => admin.from('conversations').select('id').eq('id', conversationId).eq('student_id', userId).maybeSingle(),
          () => admin.from('conversations').select('id').eq('id', conversationId).eq('student_external_id', userId).maybeSingle(),
        ]
        for (const fn of attempts) {
          try {
            const { data, error } = await fn()
            if (!error && data?.id) { allowed = true; break }
          } catch (_) {}
        }
      }
      if (!allowed) return json(res, 403, { error: 'forbidden' })

      const deleteReplies = async () => {
        const cols = ['post_id', 'postId']
        for (const col of cols) {
          try {
            const { error } = await admin.from('replies').delete().eq(col, postId)
            if (!error) return
            if (isMissingColumn(error, col)) continue
          } catch (e) {
            if (isMissingColumn(e, col)) continue
          }
        }
      }

      try { await deleteReplies() } catch (_) {}

      try {
        const { error: delErr } = await admin.from('posts').delete().eq('id', postId)
        if (delErr) return json(res, 500, { error: 'post_delete_failed', message: String(delErr?.message || delErr || '') })
      } catch (e) {
        return json(res, 500, { error: 'post_delete_failed', message: String(e?.message || e || '') })
      }

      try {
        if (conversationId) await admin.from('conversations').update({ date: new Date().toISOString() }).eq('id', conversationId)
      } catch (_) {}

      return json(res, 200, { ok: true, postId })
    }

    if (req.method === 'POST' && type === 'aluno_inbox_post') {
      const raw = await readRawBody(req)
      const parsed = JSON.parse(raw.toString('utf-8') || '{}')
      const courseId = String(parsed?.courseId || parsed?.course_id || '').trim()
      const threadKey = String(parsed?.threadKey || parsed?.thread_key || '').trim()
      const title = String(parsed?.title || 'Comentários').trim()
      const content = String(parsed?.content || parsed?.text || '').trim()
      const studentName = String(parsed?.studentName || parsed?.student_name || 'Aluno').trim()
      const tag = String(parsed?.tag || 'Curso').trim() || 'Curso'

      if (!courseId || !isUuid(courseId)) return json(res, 400, { error: 'invalid_courseId' })
      if (!threadKey) return json(res, 400, { error: 'invalid_threadKey' })
      if (!content) return json(res, 400, { error: 'invalid_content' })

      const { data: course, error: courseErr } = await admin.from('courses').select('id,user_id').eq('id', courseId).maybeSingle()
      if (courseErr) return json(res, 500, { error: courseErr.message || String(courseErr) })
      if (!course?.user_id) return json(res, 404, { error: 'course_not_found' })

      const resolvedProducerRowId = await resolveProducerRowIdFromUserId(String(course.user_id))
      const producerKey = String(resolvedProducerRowId || course.user_id || '').trim()
      if (!producerKey) return json(res, 404, { error: 'producer_not_found' })

      const studentResolution = await resolveStudentId(auth.user, studentName)
      const studentId = String(studentResolution?.id || '').trim()
      if (!studentId) return json(res, 500, { error: 'student_not_resolved', message: String(studentResolution?.error || '') })

      const subjects = [`${title} - ${threadKey}`]
      const conversationId = await ensureLessonConversationId({ producerKey, subjects, tag, threadKey })
      if (!conversationId) return json(res, 500, { error: 'conversation_create_failed' })

      const inserted = await insertPostForConversation({ conversationId, content, authorId: studentId, authorUserId: String(auth.user?.id || '') })
      if (inserted?.error || !inserted?.post?.id) return json(res, 500, { error: 'post_create_failed', message: String(inserted?.error?.message || inserted?.error || '') })

      let author = null
      try {
        const { data } = await admin.from('students').select('id,name,avatar_url,email').eq('id', studentId).maybeSingle()
        if (data?.id) author = { id: String(data.id), name: String(data.name || 'Aluno'), avatar_url: data.avatar_url || null, email: data.email || '' }
      } catch (_) {}

      const post = {
        id: inserted.post.id,
        content,
        created_at: inserted.post.created_at || null,
        likes: Number(inserted.post.likes || 0),
        liked: !!inserted.post.liked,
        author,
      }

      try {
        await admin.from('conversations').update({ date: new Date().toISOString(), unread: 1 }).eq('id', conversationId)
      } catch (_) {}

      return json(res, 200, { ok: true, conversationId, producerId: producerKey, studentId, post })
    }

    if (req.method === 'POST' && type === 'reply_create') {
      const raw = await readRawBody(req)
      const parsed = JSON.parse(raw.toString('utf-8') || '{}')
      const conversationId = String(parsed?.conversationId || parsed?.conversation_id || '').trim()
      const postId = String(parsed?.postId || parsed?.post_id || '').trim()
      const text = String(parsed?.text || parsed?.content || parsed?.body || parsed?.message || '').trim()
      const producerName = String(parsed?.producerName || parsed?.producer_name || 'Professor').trim() || 'Professor'

      if (!conversationId || !isUuid(conversationId)) return json(res, 400, { error: 'invalid_conversationId' })
      if (!postId || !isUuid(postId)) return json(res, 400, { error: 'invalid_postId' })
      if (!text) return json(res, 400, { error: 'invalid_text' })

      const producerUserId = String(auth.user?.id || '').trim()
      if (!producerUserId) return json(res, 400, { error: 'invalid_producer_id' })

      const producerRowId = await resolveProducerRowIdFromUserId(producerUserId)
      const producerKeys = Array.from(new Set([producerUserId, producerRowId].map((v) => String(v || '').trim()).filter(Boolean)))
      const allowed = await conversationBelongsToProducerLoose(conversationId, producerKeys)
      if (!allowed) return json(res, 403, { error: 'forbidden' })

      let lastErr = null
      let created = null
      const candidates = [
        { post_id: postId, text, author_id: producerUserId, producer_id: producerRowId || undefined },
        { post_id: postId, text, author_id: producerUserId },
        { post_id: postId, text, producer_id: producerRowId || undefined },
        { post_id: postId, text },
      ]

      for (const payload of candidates) {
        const clean = Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined && v !== ''))
        try {
          const { data, error } = await insertWithColumnPrune('replies', clean, 10)
          if (!error && data) {
            created = data
            break
          }
          lastErr = error || new Error('insert_failed')
        } catch (e) {
          lastErr = e
        }
      }

      if (!created) return json(res, 500, { error: 'reply_create_failed', message: String(lastErr?.message || lastErr || '') })

      const reply = {
        id: created.id,
        content: created.content || created.text || created.body || created.message || text,
        created_at: created.created_at || null,
        likes: Number(created.likes || 0),
        liked_by: Array.isArray(created.liked_by) ? created.liked_by : (Array.isArray(created.likedBy) ? created.likedBy : []),
        author: (created.author && typeof created.author === 'object') ? created.author : { name: producerName },
      }

      try {
        await admin.from('conversations').update({ date: new Date().toISOString(), unread: 0 }).eq('id', conversationId)
      } catch (_) {}

      try {
        const baseUrl = (readEnv('APP_BASE_URL', readEnv('SITE_URL', 'https://app.connektco.com')) || 'https://app.connektco.com').replace(/\/+$/, '')
        const fetchPost = async () => {
          const candidates = [
            () => admin.from('posts').select('id,author_id,student_id,student_external_id,text,content,body,message,conversation_id,conversation_external_id').eq('id', postId).maybeSingle(),
            () => admin.from('posts').select('id,author_id,student_id,student_external_id,text,content,body,message,conversation_id,conversation_external_id').eq('post_id', postId).maybeSingle(),
            () => admin.from('posts').select('*').eq('id', postId).maybeSingle(),
          ]
          for (const fn of candidates) {
            try {
              const { data, error } = await fn()
              if (!error && data) return data
            } catch (_) {}
          }
          return null
        }
        const postRow = await fetchPost()
        const studentKey = String(postRow?.author_id || postRow?.student_id || postRow?.student_external_id || '').trim()
        const resolveStudent = async () => {
          if (!studentKey) return null
          const attempts = [
            () => admin.from('students').select('id,name,email').eq('id', studentKey).maybeSingle(),
            () => admin.from('students').select('id,name,email').eq('external_id', studentKey).maybeSingle(),
            () => admin.from('students').select('id,name,email').eq('user_id', studentKey).maybeSingle(),
          ]
          for (const fn of attempts) {
            try {
              const { data, error } = await fn()
              if (!error && data?.email) return data
            } catch (_) {}
          }
          return null
        }
        const student = await resolveStudent()
        const toEmail = String(student?.email || '').trim().toLowerCase()
        if (isValidEmail(toEmail)) {
          const studentName = String(student?.name || 'Aluno').trim() || 'Aluno'
          const postText = String(postRow?.text || postRow?.content || postRow?.body || postRow?.message || '').trim()
          const replyText = String(reply?.content || text || '').trim()
          const subject = `${producerName} respondeu sua mensagem`
          const textBody =
            `Olá ${studentName},\n\n` +
            `${producerName} respondeu seu comentário:\n` +
            `${replyText}\n\n` +
            (postText ? `Seu comentário:\n${postText}\n\n` : '') +
            `Acesse a plataforma para ver: ${baseUrl}\n`
          const htmlBody =
            `<div style="font-family:Arial,Helvetica,sans-serif;background:#F8FAFC;padding:24px;">` +
            `<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #E3E4E5;border-radius:12px;overflow:hidden;">` +
            `<div style="padding:18px 20px;border-bottom:1px solid #E3E4E5;">` +
            `<div style="font-size:18px;font-weight:800;color:#1E1B39;">Connekt</div>` +
            `</div>` +
            `<div style="padding:20px;">` +
            `<div style="font-size:16px;font-weight:800;color:#1E1B39;margin-bottom:10px;">${escapeHtml(producerName)} respondeu sua mensagem</div>` +
            `<div style="font-size:13px;color:#404040;line-height:1.6;">Olá ${escapeHtml(studentName)},</div>` +
            `<div style="margin-top:14px;padding:12px;border:1px solid #E3E4E5;border-radius:10px;background:#F9FAFB;">` +
            `<div style="font-size:12px;color:#111827;font-weight:700;margin-bottom:6px;">Resposta</div>` +
            `<div style="font-size:13px;color:#111827;white-space:pre-wrap;">${escapeHtml(replyText)}</div>` +
            `</div>` +
            (postText
              ? `<div style="margin-top:12px;padding:12px;border:1px solid #E3E4E5;border-radius:10px;background:#FFFFFF;">` +
                `<div style="font-size:12px;color:#111827;font-weight:700;margin-bottom:6px;">Seu comentário</div>` +
                `<div style="font-size:13px;color:#111827;white-space:pre-wrap;">${escapeHtml(postText)}</div>` +
                `</div>`
              : '') +
            `<a href="${escapeHtml(baseUrl)}" style="display:inline-block;margin-top:18px;background:#0047BB;color:#fff;padding:12px 16px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">Abrir Connekt</a>` +
            `</div>` +
            `<div style="padding:14px 20px;border-top:1px solid #E3E4E5;font-size:12px;color:#8F9299;">` +
            `Este email foi enviado para ${escapeHtml(toEmail)}.` +
            `</div>` +
            `</div>` +
            `</div>`
          await sendSendgridEmail({ to: toEmail, subject, text: textBody, html: htmlBody })
        }
      } catch (_) {}

      return json(res, 200, { ok: true, reply })
    }

    const resolveLessonConversationId = async ({ producerKey, subjects, threadKey, courseId, title, lessonTitle }) => {
      const pk = String(producerKey || '').trim()
      const list = (Array.isArray(subjects) ? subjects : []).map((s) => String(s || '').trim()).filter(Boolean)
      if (!pk || list.length === 0) return ''

      for (const subj of list) {
        const attempts = [
          { producer_id: pk, subject: subj },
          { producer_external_id: pk, subject: subj },
        ]

        for (const where of attempts) {
          try {
            let q = admin.from('conversations').select('id').limit(1)
            for (const [k, v] of Object.entries(where)) q = q.eq(k, v)
            const row = await selectFirstRow(() => q)
            const id = row?.id ? String(row.id).trim() : ''
            if (id) return id
          } catch (_) {}
        }
      }
      const tk = String(threadKey || '').trim()
      if (tk) {
        for (const col of ['producer_id', 'producer_external_id']) {
          try {
            const row = await selectFirstRow(() =>
              admin
                .from('conversations')
                .select('id')
                .in(col, [pk])
                .ilike('subject', `%${tk}%`)
                .limit(1),
            )
            const id = row?.id ? String(row.id).trim() : ''
            if (id) return id
          } catch (_) {}
        }
      }

      const cid = String(courseId || '').trim()
      const t = String(title || '').trim()
      const lt = String(lessonTitle || '').trim()
      if (cid && t && lt) {
        const needleTitle = `${t} - ${lt}`
        const needleCourse = `connekt_progress:${cid}`
        for (const col of ['producer_id', 'producer_external_id']) {
          try {
            const row = await selectFirstRow(() =>
              admin
                .from('conversations')
                .select('id')
                .in(col, [pk])
                .ilike('subject', `%${needleTitle}%`)
                .ilike('subject', `%${needleCourse}%`)
                .limit(1),
            )
            const id = row?.id ? String(row.id).trim() : ''
            if (id) return id
          } catch (_) {}
        }
      }

      if (tk) {
        try {
          const row = await selectFirstRow(() => admin.from('conversations').select('id').ilike('subject', `%${tk}%`).limit(1))
          const id = row?.id ? String(row.id).trim() : ''
          if (id) return id
        } catch (_) {}
      }

      if (cid && t && lt) {
        const needleTitle = `${t} - ${lt}`
        const needleCourse = `connekt_progress:${cid}`
        try {
          const row = await selectFirstRow(() =>
            admin
              .from('conversations')
              .select('id')
              .ilike('subject', `%${needleTitle}%`)
              .ilike('subject', `%${needleCourse}%`)
              .limit(1),
          )
          const id = row?.id ? String(row.id).trim() : ''
          if (id) return id
        } catch (_) {}
      }
      return ''
    }

    const ensureLessonConversationId = async ({ producerKey, subjects, tag, threadKey, courseId, title, lessonTitle }) => {
      const pk = String(producerKey || '').trim()
      const list = (Array.isArray(subjects) ? subjects : []).map((s) => String(s || '').trim()).filter(Boolean)
      const t = String(tag || 'Curso').trim() || 'Curso'
      if (!pk || list.length === 0) return ''

      const existing = await resolveLessonConversationId({ producerKey: pk, subjects: list, threadKey, courseId, title, lessonTitle })
      if (existing) return existing

      const canonical = list[list.length - 1]
      const base = { subject: canonical, tag: t, unread: 0, date: new Date().toISOString() }
      const payloadCandidates = [
        { ...base, producer_id: pk },
        { ...base, producer_external_id: pk },
        { ...base },
      ]
      let lastErr = null
      for (const payload of payloadCandidates) {
        const { data, error } = await insertWithColumnPrune('conversations', payload, 12)
        if (!error) {
          const id = String(data?.id || '').trim()
          if (id) return id
          lastErr = new Error('missing_conversation_id')
          continue
        }
        lastErr = error
      }
      return ''
    }

    if (req.method === 'GET' && type === 'lesson_comments_thread') {
      const courseId = String(u.searchParams.get('courseId') || u.searchParams.get('course_id') || '').trim()
      const threadKey = String(u.searchParams.get('threadKey') || u.searchParams.get('thread_key') || '').trim()
      const title = String(u.searchParams.get('title') || 'Comentários').trim() || 'Comentários'
      const lessonTitle = String(u.searchParams.get('lessonTitle') || u.searchParams.get('lesson_title') || '').trim()

      if (!courseId || !isUuid(courseId)) return json(res, 400, { error: 'invalid_courseId' })
      if (!threadKey) return json(res, 400, { error: 'invalid_threadKey' })

      const { data: course, error: courseErr } = await admin.from('courses').select('id,user_id').eq('id', courseId).maybeSingle()
      if (courseErr) return json(res, 500, { error: courseErr.message || String(courseErr) })
      if (!course?.user_id) return json(res, 404, { error: 'course_not_found' })

      const resolvedProducerRowId = await resolveProducerRowIdFromUserId(String(course.user_id))
      const producerKey = String(resolvedProducerRowId || course.user_id || '').trim()
      if (!producerKey) return json(res, 404, { error: 'producer_not_found' })

      const subjects = [
        lessonTitle ? `${title} - ${lessonTitle} - ${threadKey}` : '',
        `${title} - ${threadKey}`,
      ].filter(Boolean)
      const conversationId = await ensureLessonConversationId({ producerKey, subjects, tag: 'Curso', threadKey, courseId, title, lessonTitle })
      if (!conversationId) return json(res, 200, { conversationId: '', data: [] })

      const feed = await fetchConversationFeedCanonical(conversationId)
      return json(res, 200, { conversationId, data: Array.isArray(feed) ? feed : [] })
    }

    if (req.method === 'POST' && type === 'lesson_comment_post') {
      const raw = await readRawBody(req)
      const parsed = JSON.parse(raw.toString('utf-8') || '{}')
      const courseId = String(parsed?.courseId || parsed?.course_id || '').trim()
      const threadKey = String(parsed?.threadKey || parsed?.thread_key || '').trim()
      const title = String(parsed?.title || 'Comentários').trim() || 'Comentários'
      const lessonTitle = String(parsed?.lessonTitle || parsed?.lesson_title || '').trim()
      const content = String(parsed?.content || parsed?.text || '').trim()
      const studentName = String(parsed?.studentName || parsed?.student_name || 'Aluno').trim()

      if (!courseId || !isUuid(courseId)) return json(res, 400, { error: 'invalid_courseId' })
      if (!threadKey) return json(res, 400, { error: 'invalid_threadKey' })
      if (!content) return json(res, 400, { error: 'invalid_content' })

      const { data: course, error: courseErr } = await admin.from('courses').select('id,user_id').eq('id', courseId).maybeSingle()
      if (courseErr) return json(res, 500, { error: courseErr.message || String(courseErr) })
      if (!course?.user_id) return json(res, 404, { error: 'course_not_found' })

      const resolvedProducerRowId = await resolveProducerRowIdFromUserId(String(course.user_id))
      const producerKey = String(resolvedProducerRowId || course.user_id || '').trim()
      if (!producerKey) return json(res, 404, { error: 'producer_not_found' })

      const studentResolution = await resolveStudentId(auth.user, studentName)
      const studentId = String(studentResolution?.id || '').trim()
      if (!studentId) return json(res, 500, { error: 'student_not_resolved', message: String(studentResolution?.error || '') })

      const subjects = [
        lessonTitle ? `${title} - ${lessonTitle} - ${threadKey}` : '',
        `${title} - ${threadKey}`,
      ].filter(Boolean)
      const conversationId = await ensureLessonConversationId({ producerKey, subjects, tag: 'Curso', threadKey, courseId, title, lessonTitle })
      if (!conversationId) return json(res, 500, { error: 'conversation_create_failed' })

      const inserted = await insertPostForConversation({ conversationId, content, authorId: studentId, authorUserId: String(auth.user?.id || '') })
      if (inserted?.error || !inserted?.post?.id) return json(res, 500, { error: 'post_create_failed', message: String(inserted?.error?.message || inserted?.error || '') })

      let author = null
      try {
        const { data } = await admin.from('students').select('id,name,avatar_url,email').eq('id', studentId).maybeSingle()
        if (data?.id) {
          author = { id: String(data.id), name: String(data.name || 'Aluno'), avatar_url: data.avatar_url || null, email: data.email || '' }
        }
      } catch (_) {}

      const post = {
        id: inserted.post.id,
        content,
        created_at: inserted.post.created_at || null,
        likes: Number(inserted.post.likes || 0),
        liked: !!inserted.post.liked,
        author,
      }

      try {
        await admin.from('conversations').update({ date: new Date().toISOString(), unread: 1 }).eq('id', conversationId)
      } catch (_) {}

      return json(res, 200, { ok: true, conversationId, post })
    }

    if (req.method === 'GET' && type === 'simulado_inbox_thread') {
      res.setHeader('Cache-Control', 'no-store')
      const simId = String(u.searchParams.get('simId') || u.searchParams.get('sim_id') || '').trim()
      const threadKey = String(u.searchParams.get('threadKey') || u.searchParams.get('thread_key') || '').trim()
      const title = String(u.searchParams.get('title') || 'Inbox').trim() || 'Inbox'

      if (!simId || !isUuid(simId)) return json(res, 400, { error: 'invalid_simId' })
      if (!threadKey) return json(res, 400, { error: 'invalid_threadKey' })

      const isMissingColumn = (err, col) => {
        const msg = String(err?.message || err?.details || err || '').toLowerCase()
        const code = String(err?.code || '').toUpperCase()
        const c = String(col || '').toLowerCase()
        return (
          code === 'PGRST204' ||
          code === '42703' ||
          msg.includes(`could not find the '${c}' column`) ||
          (msg.includes('schema cache') && msg.includes(c)) ||
          (msg.includes('does not exist') && msg.includes(c))
        )
      }
      let sim = null
      let simErr = null
      ;({ data: sim, error: simErr } = await admin.from('simulados').select('id,produtor_id,user_id,created_by,title').eq('id', simId).maybeSingle())
      if (simErr && isMissingColumn(simErr, 'produtor_id')) {
        ;({ data: sim, error: simErr } = await admin.from('simulados').select('id,user_id,created_by,title').eq('id', simId).maybeSingle())
      }
      if (simErr) return json(res, 500, { error: simErr.message || String(simErr) })
      if (!sim) return json(res, 404, { error: 'simulado_not_found' })

      const producerUserId = String(sim?.produtor_id || sim?.user_id || sim?.created_by || '').trim()
      if (!producerUserId) return json(res, 404, { error: 'producer_not_found' })
      const resolvedProducerRowId = await resolveProducerRowIdFromUserId(producerUserId)
      const producerKey = String(resolvedProducerRowId || producerUserId || '').trim()
      if (!producerKey) return json(res, 404, { error: 'producer_not_found' })

      const subjects = [
        `${title} - ${threadKey}`,
      ].filter(Boolean)
      const conversationId = await ensureLessonConversationId({ producerKey, subjects, tag: 'Simulado', threadKey, courseId: '', title, lessonTitle: '' })
      if (!conversationId) return json(res, 200, { conversationId: '', data: [] })

      const feed = await fetchConversationFeedCanonical(conversationId)
      return json(res, 200, { conversationId, data: Array.isArray(feed) ? feed : [] })
    }

    if (req.method === 'POST' && type === 'simulado_inbox_post') {
      const raw = await readRawBody(req)
      const parsed = JSON.parse(raw.toString('utf-8') || '{}')
      const simId = String(parsed?.simId || parsed?.sim_id || '').trim()
      const threadKey = String(parsed?.threadKey || parsed?.thread_key || '').trim()
      const title = String(parsed?.title || 'Inbox').trim() || 'Inbox'
      const content = String(parsed?.content || parsed?.text || '').trim()
      const studentName = String(parsed?.studentName || parsed?.student_name || 'Aluno').trim()

      if (!simId || !isUuid(simId)) return json(res, 400, { error: 'invalid_simId' })
      if (!threadKey) return json(res, 400, { error: 'invalid_threadKey' })
      if (!content) return json(res, 400, { error: 'invalid_content' })

      const isMissingColumn = (err, col) => {
        const msg = String(err?.message || err?.details || err || '').toLowerCase()
        const code = String(err?.code || '').toUpperCase()
        const c = String(col || '').toLowerCase()
        return (
          code === 'PGRST204' ||
          code === '42703' ||
          msg.includes(`could not find the '${c}' column`) ||
          (msg.includes('schema cache') && msg.includes(c)) ||
          (msg.includes('does not exist') && msg.includes(c))
        )
      }
      let sim = null
      let simErr = null
      ;({ data: sim, error: simErr } = await admin.from('simulados').select('id,produtor_id,user_id,created_by,title').eq('id', simId).maybeSingle())
      if (simErr && isMissingColumn(simErr, 'produtor_id')) {
        ;({ data: sim, error: simErr } = await admin.from('simulados').select('id,user_id,created_by,title').eq('id', simId).maybeSingle())
      }
      if (simErr) return json(res, 500, { error: simErr.message || String(simErr) })
      if (!sim) return json(res, 404, { error: 'simulado_not_found' })

      const producerUserId = String(sim?.produtor_id || sim?.user_id || sim?.created_by || '').trim()
      if (!producerUserId) return json(res, 404, { error: 'producer_not_found' })
      const resolvedProducerRowId = await resolveProducerRowIdFromUserId(producerUserId)
      const producerKey = String(resolvedProducerRowId || producerUserId || '').trim()
      if (!producerKey) return json(res, 404, { error: 'producer_not_found' })

      const studentResolution = await resolveStudentId(auth.user, studentName)
      const studentId = String(studentResolution?.id || '').trim()
      if (!studentId) return json(res, 500, { error: 'student_not_resolved', message: String(studentResolution?.error || '') })

      const subjects = [
        `${title} - ${threadKey}`,
      ].filter(Boolean)
      const conversationId = await ensureLessonConversationId({ producerKey, subjects, tag: 'Simulado', threadKey, courseId: '', title, lessonTitle: '' })
      if (!conversationId) return json(res, 500, { error: 'conversation_create_failed' })

      const inserted = await insertPostForConversation({ conversationId, content, authorId: studentId, authorUserId: String(auth.user?.id || '') })
      if (inserted?.error || !inserted?.post?.id) return json(res, 500, { error: 'post_create_failed', message: String(inserted?.error?.message || inserted?.error || '') })

      let author = null
      try {
        const { data } = await admin.from('students').select('id,name,avatar_url,email').eq('id', studentId).maybeSingle()
        if (data?.id) {
          author = { id: String(data.id), name: String(data.name || 'Aluno'), avatar_url: data.avatar_url || null, email: data.email || '' }
        }
      } catch (_) {}

      const post = {
        id: inserted.post.id,
        content,
        created_at: inserted.post.created_at || null,
        likes: Number(inserted.post.likes || 0),
        liked: !!inserted.post.liked,
        author,
      }

      try {
        await admin.from('conversations').update({ date: new Date().toISOString(), unread: 1 }).eq('id', conversationId)
      } catch (_) {}

      return json(res, 200, { ok: true, conversationId, post })
    }

    if (req.method === 'GET' && type === 'aluno_inbox_thread') {
      const courseId = String(u.searchParams.get('courseId') || u.searchParams.get('course_id') || '').trim()
      const threadKey = String(u.searchParams.get('threadKey') || u.searchParams.get('thread_key') || '').trim()
      const title = String(u.searchParams.get('title') || 'Comentários').trim()
      const lessonTitle = String(u.searchParams.get('lessonTitle') || u.searchParams.get('lesson_title') || '').trim()

      if (!courseId || !isUuid(courseId)) return json(res, 400, { error: 'invalid_courseId' })
      if (!threadKey) return json(res, 400, { error: 'invalid_threadKey' })

      const { data: course, error: courseErr } = await admin.from('courses').select('id,user_id').eq('id', courseId).maybeSingle()
      if (courseErr) return json(res, 500, { error: courseErr.message || String(courseErr) })
      if (!course?.user_id) return json(res, 404, { error: 'course_not_found' })

      const resolvedProducerRowId = await resolveProducerRowIdFromUserId(String(course.user_id))
      const producerKey = String(resolvedProducerRowId || course.user_id || '').trim()
      if (!producerKey) return json(res, 404, { error: 'producer_not_found' })

      const subjects = [
        lessonTitle ? `${title} - ${lessonTitle} - ${threadKey}` : '',
        `${title} - ${threadKey}`,
      ].filter(Boolean)
      const conversationId = await ensureLessonConversationId({ producerKey, subjects, tag: 'Curso', threadKey, courseId, title, lessonTitle })
      if (!conversationId) return json(res, 200, { conversationId: '', data: [] })

      const feed = await fetchConversationFeedCanonical(conversationId)
      return json(res, 200, { conversationId, data: Array.isArray(feed) ? feed : [] })
    }

    if (type === 'domain_status') {
      const hostParam = normalizeHost(u.searchParams.get('host') || '')
      if (!hostParam || !hostParam.includes('.') || hostParam.length > 253) {
        return json(res, 200, { active: false, state: 'error', reason: 'invalid_host', host: hostParam || '' })
      }

      try {
        await dns.lookup(hostParam, { all: true })
      } catch (e) {
        const code = getErrCode(e)
        const pending = code === 'ENOTFOUND' || code === 'EAI_AGAIN' || code === 'SERVFAIL' || code === 'NXDOMAIN'
        return json(res, 200, {
          active: false,
          state: pending ? 'pending' : 'error',
          reason: pending ? 'dns_not_propagated' : 'dns_error',
          host: hostParam,
          code,
        })
      }

      try {
        const r = await fetchJsonWithTimeout(`https://${hostParam}/api/version?ts=${Date.now()}`, 4500)
        if (r.ok && r.status === 200) {
          return json(res, 200, { active: true, state: 'active', reason: 'ok', host: hostParam })
        }
        return json(res, 200, {
          active: false,
          state: 'error',
          reason: 'not_pointing_to_app',
          host: hostParam,
          httpStatus: r.status,
        })
      } catch (e) {
        const code = getErrCode(e)
        const msg = String(e?.message || '')
        const pending =
          code.includes('TLS') ||
          msg.toLowerCase().includes('tls') ||
          msg.toLowerCase().includes('certificate') ||
          code === 'UND_ERR_CONNECT_TIMEOUT' ||
          code === 'ETIMEDOUT' ||
          code === 'ECONNRESET'
        return json(res, 200, {
          active: false,
          state: pending ? 'pending' : 'error',
          reason: pending ? 'ssl_or_deploy_pending' : 'fetch_error',
          host: hostParam,
          code,
        })
      }
    }

    if (!producerId || !isUuid(producerId)) return json(res, 400, { error: 'invalid_producer_id' })

    const resolveProducerRowId = async () => resolveProducerRowIdFromUserId(producerId)

    if (type === 'branding') {
      let user = null
      try {
        const { data } = await admin.auth.admin.getUserById(producerId)
        user = data?.user || null
      } catch (_) {
        user = null
      }
      return json(res, 200, { producerId, brand: pickWhitelabel(user) })
    }

    if (type === 'courses') {
      const isMissingColumn = (err, col) => {
        const msg = String(err?.message || err?.details || err || '').toLowerCase()
        const code = String(err?.code || '').toUpperCase()
        const c = String(col || '').toLowerCase()
        return (
          code === 'PGRST204' ||
          code === '42703' ||
          msg.includes(`could not find the '${c}' column`) ||
          (msg.includes('schema cache') && msg.includes(c)) ||
          (msg.includes('does not exist') && msg.includes(c))
        )
      }

      const producerKeysSet = new Set([String(producerId || '').trim()].filter(Boolean))
      try {
        const { data: prod } = await admin
          .from('producers')
          .select('id,user_id,external_id')
          .or(`id.eq.${producerId},user_id.eq.${producerId},external_id.eq.${producerId}`)
          .maybeSingle()
        if (prod?.id) producerKeysSet.add(String(prod.id).trim())
        if (prod?.user_id) producerKeysSet.add(String(prod.user_id).trim())
        if (prod?.external_id) producerKeysSet.add(String(prod.external_id).trim())
        if (prod?.user_id) {
          const resolved = await resolveProducerRowIdFromUserId(String(prod.user_id))
          if (resolved) producerKeysSet.add(String(resolved).trim())
        }
      } catch (_) {}
      const producerKeys = Array.from(producerKeysSet).map((v) => String(v || '').trim()).filter(Boolean)

      const select = 'id,title,cover_image_url,promo_video_url,module_layout_image_url,modules,data,user_id,created_at,status'
      const fetchByColumn = async (col) => {
        try {
          const { data, error } = await admin
            .from('courses')
            .select(select)
            .in(col, producerKeys)
            .order('created_at', { ascending: false })
            .limit(200)
          if (error) return { data: [], error }
          return { data: Array.isArray(data) ? data : [], error: null }
        } catch (e) {
          return { data: [], error: e }
        }
      }

      const merged = []
      const seen = new Set()
      let lastError = null
      for (const col of ['user_id', 'producer_id', 'producer_user_id', 'producer_external_id']) {
        const r = await fetchByColumn(col)
        if (r.error) {
          lastError = r.error
          if (isMissingColumn(r.error, col)) continue
          continue
        }
        for (const row of r.data) {
          const id = String(row?.id || '').trim()
          if (!id || seen.has(id)) continue
          seen.add(id)
          merged.push(row)
        }
      }

      if (merged.length === 0 && lastError) {
        const msg = String(lastError?.message || lastError || '')
        const lower = msg.toLowerCase()
        if (lower.includes('does not exist') || lower.includes('unknown') || lower.includes('column') || lower.includes('not found')) {
          return json(res, 200, { data: [] })
        }
        return json(res, 500, { error: msg || 'fetch_failed' })
      }

      return json(res, 200, { data: merged })
    }

  if (type === 'simulados') {
    const isMissingColumn = (err, col) => {
      const msg = String(err?.message || err?.details || err || '').toLowerCase()
      const code = String(err?.code || '').toUpperCase()
      const c = String(col || '').toLowerCase()
      return (
        code === 'PGRST204' ||
        code === '42703' ||
        msg.includes(`could not find the '${c}' column`) ||
        (msg.includes('schema cache') && msg.includes(c)) ||
        (msg.includes('does not exist') && msg.includes(c))
      )
    }

    const producerKeysSet = new Set([String(producerId || '').trim()].filter(Boolean))
    try {
      const { data: prod } = await admin
        .from('producers')
        .select('id,user_id,external_id')
        .or(`id.eq.${producerId},user_id.eq.${producerId},external_id.eq.${producerId}`)
        .maybeSingle()
      if (prod?.id) producerKeysSet.add(String(prod.id).trim())
      if (prod?.user_id) producerKeysSet.add(String(prod.user_id).trim())
      if (prod?.external_id) producerKeysSet.add(String(prod.external_id).trim())
      if (prod?.user_id) {
        const resolved = await resolveProducerRowIdFromUserId(String(prod.user_id))
        if (resolved) producerKeysSet.add(String(resolved).trim())
      }
    } catch (_) {}
    const producerKeys = Array.from(producerKeysSet).filter(Boolean)

    const selectAttempts = [
      'id,title,cover_image_url,is_paid,price,availability_date,duration_minutes,max_grade,settings,created_at,produtor_id,user_id,created_by',
      'id,title,cover_image_url,is_paid,price,availability_date,duration_minutes,max_grade,settings,created_at,user_id,created_by',
      'id,title,cover_image_url,is_paid,price,availability_date,duration_minutes,max_grade,settings,created_at,user_id',
      'id,title,cover_image_url,is_paid,price,availability_date,duration_minutes,max_grade,settings,created_at',
      '*',
    ]

    const fetchByColumn = async (col) => {
      for (const sel of selectAttempts) {
        try {
          const { data, error } = await admin
            .from('simulados')
            .select(sel)
            .in(col, producerKeys)
            .order('created_at', { ascending: false })
            .limit(200)
          if (error) {
            if (isMissingColumn(error, col) || (sel.includes('produtor_id') && isMissingColumn(error, 'produtor_id')) || (sel.includes('created_by') && isMissingColumn(error, 'created_by'))) {
              continue
            }
            return { data: [], error }
          }
          return { data: Array.isArray(data) ? data : [], error: null }
        } catch (e) {
          if (isMissingColumn(e, col)) continue
          return { data: [], error: e }
        }
      }
      return { data: [], error: null }
    }

    const merged = []
    const seen = new Set()
    let lastError = null
    for (const col of ['produtor_id', 'user_id', 'created_by']) {
      const r = await fetchByColumn(col)
      if (r.error) {
        lastError = r.error
        continue
      }
      for (const row of r.data) {
        const id = String(row?.id || '').trim()
        if (!id || seen.has(id)) continue
        seen.add(id)
        merged.push(row)
      }
    }

    if (merged.length === 0 && lastError) {
      const msg = String(lastError?.message || lastError || '')
      const lower = msg.toLowerCase()
      if (lower.includes('does not exist') || lower.includes('unknown') || lower.includes('column') || lower.includes('not found')) {
        return json(res, 200, { data: [] })
      }
      return json(res, 500, { error: msg || 'fetch_failed' })
    }

    return json(res, 200, { data: merged })
  }

  if (type === 'sales') {
    const producerRowId = await resolveProducerRowId()
    const producerKeys = Array.from(new Set([String(producerId || '').trim(), String(producerRowId || '').trim()].filter(Boolean)))
    const selectCandidates = [
      'id,amount_cents,status,created_at,currency,producer_id,producer_external_id,producer_user_id',
      'id,amount_cents,status,created_at,producer_id',
    ]

    const fetchByColumn = async (col, select) => {
      try {
        const { data, error } = await admin
          .from('sales')
          .select(select)
          .in(col, producerKeys)
          .order('created_at', { ascending: false })
          .limit(5000)
        if (error) return { data: [], error }
        return { data: Array.isArray(data) ? data : [], error: null }
      } catch (e) {
        return { data: [], error: e }
      }
    }

    const merged = []
    const seen = new Set()
    let lastError = null
    for (const col of ['producer_id', 'producer_external_id', 'producer_user_id']) {
      for (const select of selectCandidates) {
        const r = await fetchByColumn(col, select)
        if (r.error) {
          lastError = r.error
          const msg = String(r.error?.message || r.error || '').toLowerCase()
          const missingCol = msg.includes('does not exist') || msg.includes('schema cache') || msg.includes('could not find the') || msg.includes('column')
          if (missingCol) continue
          break
        }
        for (const row of r.data) {
          const id = String(row?.id || '').trim()
          if (!id || seen.has(id)) continue
          seen.add(id)
          merged.push(row)
        }
        break
      }
    }

    if (merged.length === 0 && lastError) {
      const msg = String(lastError?.message || lastError || '')
      const lower = msg.toLowerCase()
      if (lower.includes('does not exist') || lower.includes('unknown') || lower.includes('column') || lower.includes('not found')) {
        return json(res, 200, { data: [] })
      }
      return json(res, 500, { error: msg || 'fetch_failed' })
    }

    const parseJsonMaybe = (value) => {
      if (!value) return null
      if (typeof value === 'object') return value
      if (typeof value !== 'string') return null
      try { return JSON.parse(value) } catch (_) { return null }
    }

    const normalizeSaleFromNotification = (n) => {
      const data = parseJsonMaybe(n?.data) || (n?.data && typeof n.data === 'object' ? n.data : null) || {}
      const saleId = String(data?.sale_id || data?.saleId || '').trim()
      const id = saleId || String(n?.id || '').trim()
      if (!id) return null
      const amount = Number(data?.amount_cents ?? data?.amountCents ?? 0)
      const createdAt = n?.created_at || n?.createdAt || data?.created_at || data?.createdAt || null
      return {
        id,
        amount_cents: Number.isFinite(amount) ? amount : 0,
        status: String(data?.status || (String(n?.type || '').trim().toLowerCase() === 'purchase_received' ? 'paid' : 'paid')),
        created_at: createdAt,
        payment_method: String(data?.payment_method || data?.paymentMethod || '').trim() || undefined,
        buyer_id: String(data?.buyer_id || data?.buyerId || '').trim() || undefined,
        client_name: String(n?.actor_name || data?.buyer_name || data?.buyerName || '').trim() || undefined,
        client_email: String(data?.buyer_email || data?.buyerEmail || '').trim() || undefined,
        product_title: String(n?.entity_name || data?.entity_name || data?.entityName || '').trim() || undefined,
        entity_type: String(data?.type || data?.entity_type || data?.entityType || '').trim() || undefined,
        course_id: String(data?.courseId || data?.course_id || '').trim() || undefined,
        module_id: String(data?.moduleId || data?.module_id || '').trim() || undefined,
        lesson_id: String(data?.lessonId || data?.lesson_id || '').trim() || undefined,
        sim_id: String(data?.simId || data?.sim_id || data?.simuladoId || data?.simulado_id || '').trim() || undefined,
      }
    }

    const fetchNotifications = async () => {
      if (producerKeys.length === 0) return []
      const recipientCols = ['recipient_user_id', 'recipientUserId', 'recipient_id', 'recipientId']
      const selectList = [
        'id,created_at,type,recipient_user_id,actor_name,entity_name,data',
        'id,created_at,type,recipient_user_id,actor_name,entity_name',
        'id,created_at,recipient_user_id,actor_name,entity_name,data',
        'id,created_at,recipient_user_id,data',
        '*',
      ]

      for (const col of recipientCols) {
        for (const select of selectList) {
          try {
            const { data, error } = await admin
              .from('notifications')
              .select(select)
              .in(col, producerKeys)
              .order('created_at', { ascending: false })
              .limit(5000)
            if (error) {
              const msg = String(error?.message || error || '').toLowerCase()
              const missing = msg.includes('does not exist') || msg.includes('schema cache') || msg.includes('could not find the') || msg.includes('column')
              if (missing) continue
              break
            }
            return Array.isArray(data) ? data : []
          } catch (e) {
            const msg = String(e?.message || e || '').toLowerCase()
            const missing = msg.includes('does not exist') || msg.includes('schema cache') || msg.includes('could not find the') || msg.includes('column')
            if (missing) continue
            break
          }
        }
      }
      return []
    }

    try {
      const notifications = await fetchNotifications()
      const purchaseNotifs = notifications.filter((n) => String(n?.type || '').trim().toLowerCase() === 'purchase_received')
      const notifSales = purchaseNotifs.map(normalizeSaleFromNotification).filter(Boolean)
      const parseJsonMaybe2 = (value) => {
        if (!value) return null
        if (typeof value === 'object') return value
        if (typeof value !== 'string') return null
        try { return JSON.parse(value) } catch (_) { return null }
      }
      const getCourseMeta = (row) => {
        const fromData = parseJsonMaybe2(row?.data) || null
        const parsedModules = parseJsonMaybe2(row?.modules) || null
        const fromModulesMeta = parsedModules && typeof parsedModules === 'object' ? (parsedModules.meta || null) : null
        return { ...(fromModulesMeta || {}), ...(fromData || {}) }
      }
      const resolveCoursePriceNumber = (courseRow) => {
        const meta = getCourseMeta(courseRow)
        const candidates = [
          courseRow?.price,
          courseRow?.course_price,
          meta?.price,
          meta?.preco,
          meta?.valor,
          meta?.value,
          meta?.coursePrice,
          meta?.course_price,
          meta?.productPrice,
          meta?.product_price,
          meta?.checkoutPrice,
          meta?.checkout_price,
          meta?.checkoutValue,
          meta?.checkout_value,
          meta?.paymentValue,
          meta?.payment_value,
        ]
        for (const c of candidates) {
          const n = Number(c)
          if (Number.isFinite(n) && n > 0) return n
        }
        return 0
      }
      const getCourseModules = (row) => {
        const extractModules = (input, depth = 0) => {
          if (depth > 2) return []
          const parsed = parseJsonMaybe2(input)
          if (Array.isArray(parsed)) return parsed
          if (!parsed || typeof parsed !== 'object') return []
          const directKeys = ['modules', 'modulos', 'items', 'aulas', 'lessons', 'module_lessons']
          for (const k of directKeys) {
            if (Array.isArray(parsed[k])) return parsed[k]
          }
          const nestedKeys = ['course', 'curso', 'content', 'conteudo', 'payload', 'data']
          for (const k of nestedKeys) {
            const v = parsed[k]
            const out = extractModules(v, depth + 1)
            if (Array.isArray(out) && out.length > 0) return out
          }
          return []
        }
        const fromModules = extractModules(row?.modules)
        if (Array.isArray(fromModules) && fromModules.length > 0) return fromModules
        const fromData = extractModules(row?.data)
        if (Array.isArray(fromData) && fromData.length > 0) return fromData
        return []
      }
      const getModuleLessons = (mod) => {
        if (!mod) return []
        if (Array.isArray(mod.lessons)) return mod.lessons
        if (Array.isArray(mod.aulas)) return mod.aulas
        if (Array.isArray(mod.items)) return mod.items
        if (mod && typeof mod === 'object' && Array.isArray(mod.module_lessons)) return mod.module_lessons
        return []
      }

      const courseIds = Array.from(new Set(notifSales.map((s) => String(s?.course_id || '').trim()).filter(Boolean)))
      const simIds = Array.from(new Set(notifSales.map((s) => String(s?.sim_id || '').trim()).filter(Boolean)))
      const needTitleMatch = notifSales.some((s) => !String(s?.course_id || '').trim() && !String(s?.sim_id || '').trim() && String(s?.product_title || '').trim())
      const courseById = new Map()
      const simById = new Map()
      const courseByTitle = new Map()
      const simByTitle = new Map()

      const normTitle = (v) => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ')
      if (courseIds.length > 0) {
        const selectCandidates = [
          'id,title,price,modules,data',
          'id,title,price,modules',
          'id,title,modules,data',
          'id,title,modules',
          '*',
        ]
        for (const select of selectCandidates) {
          try {
            const { data, error } = await admin
              .from('courses')
              .select(select)
              .in('id', courseIds)
              .limit(500)
            if (error) {
              const msg = String(error?.message || error || '').toLowerCase()
              const missing = msg.includes('does not exist') || msg.includes('schema cache') || msg.includes('could not find the') || msg.includes('column')
              if (missing) continue
              break
            }
            for (const c of (Array.isArray(data) ? data : [])) {
              const id = String(c?.id || '').trim()
              if (id) courseById.set(id, c)
              const title = String(c?.title || '').trim()
              if (title) courseByTitle.set(normTitle(title), c)
            }
            break
          } catch (e) {
            const msg = String(e?.message || e || '').toLowerCase()
            const missing = msg.includes('does not exist') || msg.includes('schema cache') || msg.includes('could not find the') || msg.includes('column')
            if (missing) continue
            break
          }
        }
      }
      if (simIds.length > 0) {
        const selectCandidates = [
          'id,title,price,is_paid',
          'id,title,price',
          'id,title,is_paid,price',
          '*',
        ]
        for (const select of selectCandidates) {
          try {
            const { data, error } = await admin
              .from('simulados')
              .select(select)
              .in('id', simIds)
              .limit(500)
            if (error) {
              const msg = String(error?.message || error || '').toLowerCase()
              const missing = msg.includes('does not exist') || msg.includes('schema cache') || msg.includes('could not find the') || msg.includes('column')
              if (missing) continue
              break
            }
            for (const s of (Array.isArray(data) ? data : [])) {
              const id = String(s?.id || '').trim()
              if (id) simById.set(id, s)
              const title = String(s?.title || '').trim()
              if (title) simByTitle.set(normTitle(title), s)
            }
            break
          } catch (e) {
            const msg = String(e?.message || e || '').toLowerCase()
            const missing = msg.includes('does not exist') || msg.includes('schema cache') || msg.includes('could not find the') || msg.includes('column')
            if (missing) continue
            break
          }
        }
      }

      if (needTitleMatch) {
        const fetchCoursesByOwner = async () => {
          const cols = ['produtor_id', 'user_id', 'created_by']
          const selectCandidates2 = [
            'id,title,price,course_price,modules,data,produtor_id,user_id,created_by',
            'id,title,price,course_price,modules,data,user_id,created_by',
            'id,title,price,course_price,modules,data,user_id',
            'id,title,price,course_price,modules,data',
            '*',
          ]
          for (const col of cols) {
            for (const select of selectCandidates2) {
              try {
                const { data, error } = await admin
                  .from('courses')
                  .select(select)
                  .in(col, producerKeys)
                  .limit(500)
                if (error) {
                  const msg = String(error?.message || error || '').toLowerCase()
                  const missing = msg.includes('does not exist') || msg.includes('schema cache') || msg.includes('could not find the') || msg.includes('column')
                  if (missing) continue
                  break
                }
                return Array.isArray(data) ? data : []
              } catch (e) {
                const msg = String(e?.message || e || '').toLowerCase()
                const missing = msg.includes('does not exist') || msg.includes('schema cache') || msg.includes('could not find the') || msg.includes('column')
                if (missing) continue
                break
              }
            }
          }
          return []
        }
        const fetchSimuladosByOwner = async () => {
          const cols = ['produtor_id', 'user_id', 'created_by']
          const selectCandidates2 = [
            'id,title,price,produtor_id,user_id,created_by',
            'id,title,price,user_id,created_by',
            'id,title,price,user_id',
            'id,title,price',
            '*',
          ]
          for (const col of cols) {
            for (const select of selectCandidates2) {
              try {
                const { data, error } = await admin
                  .from('simulados')
                  .select(select)
                  .in(col, producerKeys)
                  .limit(500)
                if (error) {
                  const msg = String(error?.message || error || '').toLowerCase()
                  const missing = msg.includes('does not exist') || msg.includes('schema cache') || msg.includes('could not find the') || msg.includes('column')
                  if (missing) continue
                  break
                }
                return Array.isArray(data) ? data : []
              } catch (e) {
                const msg = String(e?.message || e || '').toLowerCase()
                const missing = msg.includes('does not exist') || msg.includes('schema cache') || msg.includes('could not find the') || msg.includes('column')
                if (missing) continue
                break
              }
            }
          }
          return []
        }

        const [moreCourses, moreSims] = await Promise.all([
          fetchCoursesByOwner().catch(() => []),
          fetchSimuladosByOwner().catch(() => []),
        ])

        for (const c of moreCourses) {
          const id = String(c?.id || '').trim()
          if (id && !courseById.has(id)) courseById.set(id, c)
          const title = String(c?.title || '').trim()
          if (title && !courseByTitle.has(normTitle(title))) courseByTitle.set(normTitle(title), c)
        }
        for (const s of moreSims) {
          const id = String(s?.id || '').trim()
          if (id && !simById.has(id)) simById.set(id, s)
          const title = String(s?.title || '').trim()
          if (title && !simByTitle.has(normTitle(title))) simByTitle.set(normTitle(title), s)
        }
      }

      const parseBrlNumber = (value) => {
        if (value === null || value === undefined) return 0
        if (typeof value === 'number') return Number.isFinite(value) ? value : 0
        const raw = String(value).trim()
        if (!raw) return 0
        const hasDot = raw.includes('.')
        const hasComma = raw.includes(',')
        if (hasDot && hasComma) {
          const normalized = raw.replace(/\./g, '').replace(',', '.')
          const n = Number(normalized)
          return Number.isFinite(n) ? n : 0
        }
        if (hasComma && !hasDot) {
          const n = Number(raw.replace(',', '.'))
          return Number.isFinite(n) ? n : 0
        }
        const n = Number(raw)
        return Number.isFinite(n) ? n : 0
      }

      const inferPriceCents = (sale) => {
        const t = String(sale?.entity_type || '').trim().toLowerCase()
        if (t === 'simulado' || t === 'simulados') {
          const simId = String(sale?.sim_id || '').trim()
          let sim = simId ? simById.get(simId) : null
          if (!sim) {
            const title = normTitle(sale?.product_title)
            if (title) sim = simByTitle.get(title) || null
          }
          const p = parseBrlNumber(sim?.price || 0)
          return Number.isFinite(p) && p > 0 ? Math.round(p * 100) : 0
        }
        const courseId = String(sale?.course_id || '').trim()
        let course = courseId ? courseById.get(courseId) : null
        const titleRaw = String(sale?.product_title || '').trim()
        const parts = titleRaw.split('•').map((x) => String(x || '').trim()).filter(Boolean)
        const courseTitle = parts[0] ? normTitle(parts[0]) : ''
        if (!course && courseTitle) {
          course = courseByTitle.get(courseTitle) || null
        }
        if (!course) return 0
        if (t === 'course') {
          const p = resolveCoursePriceNumber(course)
          return p > 0 ? Math.round(p * 100) : 0
        }
        const modules = getCourseModules(course)
        if (t === 'module') {
          const mid = String(sale?.module_id || '').trim()
          const targetModuleTitle = parts[1] ? normTitle(parts[1]) : ''
          const mod = (Array.isArray(modules) ? modules : []).find((m) => {
            const id = String(m?.id || m?.module_id || m?.moduleId || '').trim()
            if (mid && id === mid) return true
            if (!targetModuleTitle) return false
            const name = normTitle(m?.name || m?.title || m?.module_title || '')
            return !!name && name === targetModuleTitle
          }) || null
          const cents = Number(mod?.priceCents || mod?.price_cents || 0)
          if (Number.isFinite(cents) && cents > 0) return Math.round(cents)
          const brl = parseBrlNumber(mod?.price ?? mod?.preco ?? mod?.valor ?? mod?.value ?? mod?.amount ?? mod?.amount_brl ?? mod?.price_brl)
          return brl > 0 ? Math.round(brl * 100) : 0
        }
        if (t === 'lesson') {
          const mid = String(sale?.module_id || '').trim()
          const lid = String(sale?.lesson_id || '').trim()
          const targetModuleTitle = parts[1] ? normTitle(parts[1]) : ''
          const targetLessonTitle = parts[2] ? normTitle(parts[2]) : ''
          const mod = (Array.isArray(modules) ? modules : []).find((m) => {
            const id = String(m?.id || m?.module_id || m?.moduleId || '').trim()
            if (mid && id === mid) return true
            if (!targetModuleTitle) return false
            const name = normTitle(m?.name || m?.title || m?.module_title || '')
            return !!name && name === targetModuleTitle
          }) || null
          const lessons = getModuleLessons(mod)
          const lesson = (Array.isArray(lessons) ? lessons : []).find((l) => {
            const id = String(l?.id || l?.lesson_id || l?.lessonId || '').trim()
            if (lid && id === lid) return true
            if (!targetLessonTitle) return false
            const name = normTitle(l?.title || l?.name || '')
            return !!name && name === targetLessonTitle
          }) || null
          const cents = Number(lesson?.priceCents || lesson?.price_cents || 0)
          if (Number.isFinite(cents) && cents > 0) return Math.round(cents)
          const brl = parseBrlNumber(lesson?.price ?? lesson?.preco ?? lesson?.valor ?? lesson?.value ?? lesson?.amount ?? lesson?.amount_brl ?? lesson?.price_brl)
          return brl > 0 ? Math.round(brl * 100) : 0
        }
        return 0
      }

      for (let i = 0; i < notifSales.length; i += 1) {
        const s = notifSales[i]
        const inferred = inferPriceCents(s)
        const current = Number(s?.amount_cents || 0)
        if (!(inferred > 0) || !Number.isFinite(current)) continue
        const mismatch = current === 0 || current === inferred * 100 || current >= inferred * 10 || inferred >= current * 10
        if (mismatch) {
          notifSales[i] = { ...s, amount_cents: inferred }
        }
      }

      const byId = new Map(notifSales.map((s) => [String(s.id), s]))
      for (let i = 0; i < merged.length; i += 1) {
        const row = merged[i]
        const id = String(row?.id || '').trim()
        if (!id) continue
        const extra = byId.get(id)
        if (!extra) continue
        merged[i] = { ...row, ...Object.fromEntries(Object.entries(extra).filter(([, v]) => v !== undefined && v !== null && v !== '')) }
        try {
          const inferred = inferPriceCents(merged[i])
          const current = Number(merged[i]?.amount_cents || 0)
          const mismatch = inferred > 0 && Number.isFinite(current) && current > 0 && (current === inferred * 100 || current >= inferred * 10 || inferred >= current * 10)
          if (mismatch) {
            merged[i] = { ...merged[i], amount_cents: inferred }
            try { await admin.from('sales').update({ amount_cents: inferred }).eq('id', id) } catch (_) {}
          }
        } catch (_) {}
      }
      for (const s of notifSales) {
        const id = String(s?.id || '').trim()
        if (!id || seen.has(id)) continue
        seen.add(id)
        merged.push(s)
      }
    } catch (_) {}

    try {
      for (let i = 0; i < merged.length; i += 1) {
        const r = merged[i]
        const current = Number(r?.amount_cents || 0)
        if (!Number.isFinite(current) || !(current > 0)) continue
        const status = String(r?.status || '').trim().toLowerCase()
        if (status && status !== 'paid' && status !== 'approved' && status !== 'succeeded' && status !== 'captured') continue
        const hasAnyRef =
          !!String(r?.course_id || '').trim() ||
          !!String(r?.module_id || '').trim() ||
          !!String(r?.lesson_id || '').trim() ||
          !!String(r?.sim_id || '').trim() ||
          !!String(r?.product_title || '').trim() ||
          !!String(r?.entity_type || '').trim()
        if (hasAnyRef) continue
        if (current >= 100000 && current % 10000 === 0) {
          const corrected = Math.round(current / 10000)
          if (corrected > 0 && corrected <= 1000000) {
            merged[i] = { ...r, amount_cents: corrected }
            const id = String(r?.id || '').trim()
            if (id) {
              try { await admin.from('sales').update({ amount_cents: corrected }).eq('id', id) } catch (_) {}
            }
          }
        }
      }
    } catch (_) {}

    merged.sort((a, b) => {
      const ad = a?.created_at || a?.createdAt || null
      const bd = b?.created_at || b?.createdAt || null
      const at = ad ? new Date(ad).getTime() : 0
      const bt = bd ? new Date(bd).getTime() : 0
      return bt - at
    })

    return json(res, 200, { data: merged })
  }

  if (type === 'conversations') {
    const producerUserId = String(auth.user?.id || '').trim()
    const producerRowId = await resolveProducerRowIdFromUserId(producerUserId)
    const producerKeys = Array.from(new Set([producerUserId, producerRowId].map((v) => String(v || '').trim()).filter(Boolean)))
    if (producerKeys.length === 0) return json(res, 200, { data: [] })
    const baseSelect = `
      id,
      subject,
      tag,
      unread,
      date,
      producer:producers(id, name, external_id),
      student:students (
        id, name, email, avatar_url, whatsapp,
        courses:student_courses(course_name, progress, tag)
      )
    `

    const fetchByProducerColumn = async (col) => {
      try {
        const { data, error } = await admin
          .from('conversations')
          .select(baseSelect)
          .in(col, producerKeys)
          .order('date', { ascending: false })
          .limit(200)
        if (error) return { data: [], error }
        return { data: Array.isArray(data) ? data : [], error: null }
      } catch (e) {
        return { data: [], error: e }
      }
    }

    const merged = []
    const seen = new Set()
    let lastError = null
    for (const col of ['producer_id', 'producer_external_id']) {
      const r = await fetchByProducerColumn(col)
      if (r.error) {
        lastError = r.error
        continue
      }
      for (const row of r.data) {
        const id = String(row?.id || '').trim()
        if (!id || seen.has(id)) continue
        seen.add(id)
        merged.push(row)
      }
    }

    if (merged.length === 0 && lastError) {
      return json(res, 500, { error: String(lastError?.message || lastError || 'fetch_failed') })
    }

    const extractCourseIdFromSubject = (subject) => {
      const s = String(subject || '')
      const m = s.match(/connekt_progress:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)
      return m?.[1] ? String(m[1]).trim() : ''
    }

    const extractLessonTitleFromSubject = (subject) => {
      const s = String(subject || '').trim()
      const prefix = 'Comentários - '
      if (!s.startsWith(prefix)) return ''
      const rest = s.slice(prefix.length)
      const idx = rest.indexOf(' - connekt_progress:')
      if (idx <= 0) return ''
      const title = rest.slice(0, idx).trim()
      return title
    }

    const courseIds = Array.from(new Set(merged.map((r) => extractCourseIdFromSubject(r?.subject)).filter((v) => v && isUuid(v))))
    const courseTitleById = new Map()
    const courseInfoById = new Map()
    if (courseIds.length > 0) {
      const selectAttempts = [
        'id,title,modules,data',
        'id,course_name,modules,data',
        'id,name,modules,data',
        'id,title,modules',
        'id,course_name,modules',
        'id,name,modules',
        'id,title',
        'id,course_name',
        'id,name',
        'id',
      ]
      let rows = []
      for (const cols of selectAttempts) {
        try {
          const { data, error } = await admin.from('courses').select(cols).in('id', courseIds).limit(200)
          if (error) continue
          rows = Array.isArray(data) ? data : []
          break
        } catch (_) {}
      }
      for (const r of rows) {
        const id = String(r?.id || '').trim()
        if (!id) continue
        const title =
          String(r?.title || r?.course_name || r?.name || '').trim()
        if (title) courseTitleById.set(id, title)
        courseInfoById.set(id, { ...(r || {}), id, title: title || '' })
      }
    }

    const parseJsonMaybe = (value) => {
      if (!value) return null
      if (typeof value === 'object') return value
      if (typeof value !== 'string') return null
      try { return JSON.parse(value) } catch (_) { return null }
    }

    const getCourseModules = (row) => {
      const parsed = parseJsonMaybe(row?.modules)
      if (Array.isArray(parsed)) return parsed
      if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed.modules)) return parsed.modules
        if (Array.isArray(parsed.items)) return parsed.items
      }
      const fromData = parseJsonMaybe(row?.data)
      if (fromData && typeof fromData === 'object' && Array.isArray(fromData.modules)) return fromData.modules
      return []
    }

    const getModuleLessons = (mod) => {
      if (!mod) return []
      if (Array.isArray(mod.lessons)) return mod.lessons
      if (Array.isArray(mod.aulas)) return mod.aulas
      if (Array.isArray(mod.items)) return mod.items
      if (mod && typeof mod === 'object' && Array.isArray(mod.module_lessons)) return mod.module_lessons
      return []
    }

    const parseProgressParts = (subject) => {
      const s = String(subject || '')
      const idx = s.indexOf('connekt_progress:')
      if (idx < 0) return { courseId: '', modKey: '', lesKey: '' }
      const raw = s.slice(idx + 'connekt_progress:'.length)
      const parts = raw.split(':').map((p) => String(p || '').trim()).filter((p) => p.length > 0)
      const courseId = parts[0] && isUuid(parts[0]) ? parts[0] : ''
      let i = 1
      const readKey = () => {
        const a = parts[i] || ''
        if (!a) return ''
        if (a === 'idx') {
          const n = parts[i + 1] || '0'
          i += 2
          return `idx:${n}`
        }
        i += 1
        return a
      }
      const modKey = readKey()
      const lesKey = readKey()
      return { courseId, modKey, lesKey }
    }

    const resolveLessonTitleFromCourse = ({ courseId, modKey, lesKey }) => {
      const info = courseInfoById.get(courseId) || null
      if (!info) return ''
      const modules = getCourseModules(info)
      const modList = Array.isArray(modules) ? modules : []
      if (modList.length === 0) return ''

      const pickByIndex = (list, idx) => {
        const n = Number(idx)
        if (!Number.isFinite(n)) return list[0] || null
        const clamped = Math.max(0, Math.min(list.length - 1, n))
        return list[clamped] || null
      }

      const pickModule = () => {
        const mk = String(modKey || '').trim()
        if (mk.startsWith('idx:')) return pickByIndex(modList, mk.slice('idx:'.length))
        for (const m of modList) {
          const mid = String(m?.id || m?.module_id || m?.moduleId || '').trim()
          if (mid && mid === mk) return m
        }
        return modList[0] || null
      }

      const mod = pickModule()
      const lessons = getModuleLessons(mod)
      const lesList = Array.isArray(lessons) ? lessons : []
      if (lesList.length === 0) return ''

      const pickLesson = () => {
        const lk = String(lesKey || '').trim()
        if (lk.startsWith('idx:')) return pickByIndex(lesList, lk.slice('idx:'.length))
        for (const l of lesList) {
          const lid = String(l?.id || l?.lesson_id || l?.lessonId || '').trim()
          if (lid && lid === lk) return l
        }
        return lesList[0] || null
      }

      const lesson = pickLesson()
      return String(lesson?.title || lesson?.name || lesson?.lesson_title || '').trim()
    }

    const studentIds = Array.from(new Set(merged.map((r) => String(r?.student?.id || '').trim()).filter(Boolean)))
    const studentCoursesById = new Map()
    if (studentIds.length > 0) {
      const mapCourseRow = (row) => {
        const name = String(row?.course_name || row?.courseName || row?.title || row?.name || '').trim()
        const progress = Number(row?.progress || row?.course_progress || row?.completion || 0)
        const tag = String(row?.tag || row?.course_tag || '').trim() || 'Curso'
        const cover = row?.cover_image_url || row?.coverImageUrl || row?.cover || null
        return { course_name: name, progress: Number.isFinite(progress) ? progress : 0, tag, cover_image_url: cover || null }
      }

      const fetchByStudentColumn = async (col) => {
        const selectAttempts = [
          `${col},course_name,progress,tag,cover_image_url`,
          `${col},course_name,progress,tag`,
          `${col},course_name,progress`,
          `${col},course_name,tag`,
          `${col},course_name`,
          '*',
        ]
        for (const cols of selectAttempts) {
          try {
            const { data, error } = await admin.from('student_courses').select(cols).in(col, studentIds).limit(1000)
            if (error) continue
            const rows = Array.isArray(data) ? data : []
            if (rows.length === 0) continue
            return rows
          } catch (_) {}
        }
        return []
      }

      let rows = await fetchByStudentColumn('student_id')
      if (rows.length === 0) rows = await fetchByStudentColumn('student_external_id')
      if (rows.length === 0) rows = await fetchByStudentColumn('user_id')

      for (const r of rows) {
        const sid = String(r?.student_id || r?.student_external_id || r?.user_id || '').trim()
        if (!sid) continue
        const list = studentCoursesById.get(sid) || []
        const mapped = mapCourseRow(r)
        if (mapped.course_name) list.push(mapped)
        studentCoursesById.set(sid, list)
      }
    }

    const mapped = merged.map((row) => {
      const student = row?.student && typeof row.student === 'object' ? row.student : null
      const studentId = student?.id ? String(student.id).trim() : ''
      const studentCoursesExisting = Array.isArray(student?.courses) ? student.courses : []
      const studentCourses = studentId ? (studentCoursesById.get(studentId) || studentCoursesExisting) : studentCoursesExisting
      const courseIdFromSubject = extractCourseIdFromSubject(row?.subject)
      const courseTitle = courseIdFromSubject ? (courseTitleById.get(courseIdFromSubject) || '') : ''
      const lessonTitleFromSubject = extractLessonTitleFromSubject(row?.subject)
      const progress = parseProgressParts(row?.subject)
      const lessonTitle = lessonTitleFromSubject || (progress.courseId ? resolveLessonTitleFromCourse(progress) : '')
      return {
        ...row,
        course_title: courseTitle,
        lesson_title: lessonTitle,
        student: student
          ? { ...student, courses: studentCourses }
          : {
            id: null,
            name: 'Aluno',
            email: '',
            avatar_url: null,
            whatsapp: null,
            courses: [],
          },
      }
    })
    return json(res, 200, { data: mapped })
  }

  if (type === 'conversation_feed') {
    const producerUserId = String(auth.user?.id || '').trim()
    const producerRowId = await resolveProducerRowIdFromUserId(producerUserId)
    const producerKeys = Array.from(new Set([producerUserId, producerRowId].map((v) => String(v || '').trim()).filter(Boolean)))
    if (producerKeys.length === 0) return json(res, 200, { data: [] })
    const conversationId = String(u.searchParams.get('conversationId') || '').trim()
    if (!conversationId || !isUuid(conversationId)) return json(res, 400, { error: 'invalid_conversationId' })
    const allowed = await conversationBelongsToProducer(conversationId, producerKeys)
    if (!allowed) return json(res, 200, { data: [] })
    const feed = await fetchConversationFeedCanonical(conversationId)
    return json(res, 200, { data: Array.isArray(feed) ? feed : [] })
  }

  if (type === 'conversation_mark_read') {
    const producerUserId = String(auth.user?.id || '').trim()
    const producerRowId = await resolveProducerRowIdFromUserId(producerUserId)
    const producerKeys = Array.from(new Set([producerUserId, producerRowId].map((v) => String(v || '').trim()).filter(Boolean)))
    if (producerKeys.length === 0) return json(res, 200, { ok: true })
    const conversationId = String(u.searchParams.get('conversationId') || '').trim()
    if (!conversationId || !isUuid(conversationId)) return json(res, 400, { error: 'invalid_conversationId' })
    let lastError = null
    for (const col of ['producer_id', 'producer_external_id']) {
      try {
        const { error } = await admin.from('conversations').update({ unread: 0 }).eq('id', conversationId).in(col, producerKeys)
        if (!error) return json(res, 200, { ok: true })
        lastError = error
      } catch (e) {
        lastError = e
      }
    }
    if (lastError) return json(res, 500, { error: String(lastError?.message || lastError || 'update_failed') })
    return json(res, 200, { ok: true })
  }

  if (type === 'simulado') {
    const simId = String(u.searchParams.get('simId') || '').trim()
    if (!simId || !isUuid(simId)) return json(res, 400, { error: 'invalid_simId' })

      const { data, error } = await admin
        .from('simulados')
        .select('*')
        .eq('id', simId)
        .maybeSingle()

      if (error) return json(res, 500, { error: error.message || String(error) })
      if (!data) return json(res, 404, { error: 'not_found' })
      const owner = String(data.produtor_id || data.user_id || data.created_by || '')
      const producerKeysSet = new Set([String(producerId || '').trim()].filter(Boolean))
      try {
        const { data: prod } = await admin
          .from('producers')
          .select('id,user_id,external_id')
          .or(`id.eq.${producerId},user_id.eq.${producerId},external_id.eq.${producerId}`)
          .maybeSingle()
        if (prod?.id) producerKeysSet.add(String(prod.id).trim())
        if (prod?.user_id) producerKeysSet.add(String(prod.user_id).trim())
        if (prod?.external_id) producerKeysSet.add(String(prod.external_id).trim())
        if (prod?.user_id) {
          const resolved = await resolveProducerRowIdFromUserId(String(prod.user_id))
          if (resolved) producerKeysSet.add(String(resolved).trim())
        }
      } catch (_) {}
      if (!producerKeysSet.has(String(owner || '').trim())) return json(res, 403, { error: 'forbidden' })
      return json(res, 200, { data })
    }

    if (type === 'simulado_runner') {
      const simId = String(u.searchParams.get('simId') || '').trim()
      if (!simId || !isUuid(simId)) return json(res, 400, { error: 'invalid_simId' })

      const isMissingColumn = (err, col) => {
        const msg = String(err?.message || err?.details || err || '').toLowerCase()
        const code = String(err?.code || '').toUpperCase()
        const c = String(col || '').toLowerCase()
        return (
          code === 'PGRST204' ||
          code === '42703' ||
          msg.includes(`could not find the '${c}' column`) ||
          (msg.includes('schema cache') && msg.includes(c)) ||
          (msg.includes('does not exist') && msg.includes(c))
        )
      }
      let simulado = null
      let simErr = null
      ;({ data: simulado, error: simErr } = await admin
        .from('simulados')
        .select('id,title,cover_image_url,is_paid,price,availability_date,duration_minutes,max_grade,settings,question_ids,produtor_id,user_id,created_by,created_at')
        .eq('id', simId)
        .maybeSingle())
      if (simErr && isMissingColumn(simErr, 'produtor_id')) {
        ;({ data: simulado, error: simErr } = await admin
          .from('simulados')
          .select('id,title,cover_image_url,is_paid,price,availability_date,duration_minutes,max_grade,settings,question_ids,user_id,created_by,created_at')
          .eq('id', simId)
          .maybeSingle())
      }
      if (simErr) return json(res, 500, { error: simErr.message || String(simErr) })
      if (!simulado) return json(res, 404, { error: 'not_found' })
      const owner = String(simulado.produtor_id || simulado.user_id || simulado.created_by || '')
      const producerKeysSet = new Set([String(producerId || '').trim()].filter(Boolean))
      try {
        const { data: prod } = await admin
          .from('producers')
          .select('id,user_id,external_id')
          .or(`id.eq.${producerId},user_id.eq.${producerId},external_id.eq.${producerId}`)
          .maybeSingle()
        if (prod?.id) producerKeysSet.add(String(prod.id).trim())
        if (prod?.user_id) producerKeysSet.add(String(prod.user_id).trim())
        if (prod?.external_id) producerKeysSet.add(String(prod.external_id).trim())
        if (prod?.user_id) {
          const resolved = await resolveProducerRowIdFromUserId(String(prod.user_id))
          if (resolved) producerKeysSet.add(String(resolved).trim())
        }
      } catch (_) {}
      if (!producerKeysSet.has(String(owner || '').trim())) return json(res, 403, { error: 'forbidden' })

      const questionIds = getQuestionIds(simulado)
      if (!questionIds.length) {
        return json(res, 200, {
          data: {
            title: String(simulado.title || ''),
            totalPoints: Number(simulado.max_grade) || 0,
            attempts: 1,
            durationMinutes: Number(simulado.duration_minutes) || 0,
            questions: [],
          },
        })
      }

      const { data: rows, error: qErr } = await admin
        .from('questions')
        .select('id,title,body,metadata,created_at,updated_at')
        .in('id', questionIds)
        .limit(500)
      if (qErr) return json(res, 500, { error: qErr.message || String(qErr) })

      const byId = new Map()
      for (const r of Array.isArray(rows) ? rows : []) {
        byId.set(String(r?.id || ''), r)
      }

      const fetchedIds = []
      const ordered = []
      for (const id of questionIds) {
        const row = byId.get(String(id))
        if (!row) continue
        fetchedIds.push(String(id))
        ordered.push(mapQuestionRow(row))
      }

      const settings = simulado?.settings && typeof simulado.settings === 'object' ? simulado.settings : {}
      const courseIds = getCourseIds(simulado)
      const attempts =
        Number.isFinite(Number(settings.attempts)) ? Number(settings.attempts) :
          (Number.isFinite(Number(settings.tentativas)) ? Number(settings.tentativas) : 1)
      const durationMinutes =
        Number.isFinite(Number(simulado.duration_minutes)) ? Number(simulado.duration_minutes) :
          (Number.isFinite(Number(settings.durationMinutes)) ? Number(settings.durationMinutes) : 0)
      const totalPoints =
        Number.isFinite(Number(simulado.max_grade)) ? Number(simulado.max_grade) :
          (Number.isFinite(Number(settings.totalPoints)) ? Number(settings.totalPoints) : 0)
      const computedTotal = totalPoints > 0 ? totalPoints : ordered.reduce((acc, q) => acc + (Number(q?.points) || 0), 0)

      return json(res, 200, {
        data: {
          title: String(simulado.title || ''),
          totalPoints: Number(computedTotal) || 0,
          attempts: Number(attempts) || 1,
          durationMinutes: Number(durationMinutes) || 0,
          coverImageUrl: simulado.cover_image_url || null,
          questions: ordered,
          meta: { simId, producerId, questionIds: fetchedIds, courseIds },
        },
      })
    }

    if (type === 'course') {
      const courseId = String(u.searchParams.get('courseId') || '').trim()
      if (!courseId || !isUuid(courseId)) return json(res, 400, { error: 'invalid_course_id' })

      const { data, error } = await admin
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .maybeSingle()

      if (error) return json(res, 500, { error: error.message || String(error) })
      if (!data) return json(res, 404, { error: 'not_found' })
      const producerKeysSet = new Set([String(producerId || '').trim()].filter(Boolean))
      try {
        const { data: prod } = await admin
          .from('producers')
          .select('id,user_id,external_id')
          .or(`id.eq.${producerId},user_id.eq.${producerId},external_id.eq.${producerId}`)
          .maybeSingle()
        if (prod?.id) producerKeysSet.add(String(prod.id).trim())
        if (prod?.user_id) producerKeysSet.add(String(prod.user_id).trim())
        if (prod?.external_id) producerKeysSet.add(String(prod.external_id).trim())
        if (prod?.user_id) {
          const resolved = await resolveProducerRowIdFromUserId(String(prod.user_id))
          if (resolved) producerKeysSet.add(String(resolved).trim())
        }
      } catch (_) {}
      const producerKeys = Array.from(producerKeysSet).map((v) => String(v || '').trim()).filter(Boolean)
      const courseOwnerCandidates = [
        data?.user_id,
        data?.producer_id,
        data?.producer_user_id,
        data?.producer_external_id,
      ].map((v) => String(v || '').trim()).filter(Boolean)
      const allowed = courseOwnerCandidates.some((v) => producerKeys.includes(v))
      if (!allowed) return json(res, 403, { error: 'forbidden' })
      return json(res, 200, { data })
    }

    return json(res, 400, { error: 'invalid_type' })
  } catch (e) {
    return json(res, 500, { error: e?.message || String(e) })
  }
}
