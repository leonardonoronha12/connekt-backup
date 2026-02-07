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
        const { data: posts, error } = await admin
          .from('posts')
          .select('id,conversation_id,text,created_at,likes,liked,author_id')
          .eq('conversation_id', cid)
          .order('created_at', { ascending: true })
          .limit(200)
        if (error) return await fetchConversationFeedLoose(cid)

        const list = Array.isArray(posts) ? posts : []
        if (list.length === 0) return await fetchConversationFeedLoose(cid)
        const authorIds = Array.from(new Set(list.map((p) => String(p?.author_id || '').trim()).filter((v) => v && isUuid(v))))
        let authors = []
        if (authorIds.length > 0) {
          const { data } = await admin.from('students').select('id,name,avatar_url,email').in('id', authorIds).limit(200)
          authors = Array.isArray(data) ? data : []
        }
        const authorById = new Map()
        for (const a of authors) {
          const id = String(a?.id || '').trim()
          if (!id) continue
          authorById.set(id, {
            id,
            name: String(a?.name || 'Aluno'),
            avatar_url: a?.avatar_url || null,
            email: a?.email || '',
          })
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
          const aid = String(p?.author_id || '').trim()
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

    const insertPostForConversation = async ({ conversationId, content, authorId }) => {
      const cid = String(conversationId || '').trim()
      const bodyText = String(content || '').trim()
      const aid = String(authorId || '').trim()
      if (!cid || !bodyText) return { post: null, error: new Error('invalid_post_payload') }

      const conversationCols = ['conversation_id', 'conversation_external_id', 'conversationId', 'conversation_externalId']
      const textCols = ['text', 'content', 'body', 'message']
      const authorCols = ['author_id', 'student_id', 'student_external_id']

      let lastErr = null
      for (const convCol of conversationCols) {
        for (const txtCol of textCols) {
          const base = { [convCol]: cid, [txtCol]: bodyText, likes: 0, liked: false }
          for (const aCol of authorCols) {
            if (aid) base[aCol] = aid
          }
          try {
            const { data, error } = await insertWithColumnPrune('posts', base, 12)
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
      }
      return { post: null, error: lastErr || new Error('insert_failed') }
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

      const inserted = await insertPostForConversation({ conversationId, content, authorId: studentId })
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

      const producerIdParam = String(u.searchParams.get('producerId') || '').trim() || String(auth.user?.id || '').trim()
      if (!producerIdParam) return json(res, 400, { error: 'invalid_producer_id' })

      const producerRowId = await resolveProducerRowIdFromUserId(producerIdParam)
      const producerKeys = Array.from(new Set([producerIdParam, producerRowId].map((v) => String(v || '').trim()).filter(Boolean)))
      const allowed = await conversationBelongsToProducerLoose(conversationId, producerKeys)
      if (!allowed) return json(res, 403, { error: 'forbidden' })

      let lastErr = null
      let created = null
      const candidates = [
        { post_id: postId, text, author_id: producerIdParam, producer_id: producerRowId || undefined },
        { post_id: postId, text, author_id: producerIdParam },
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

      const inserted = await insertPostForConversation({ conversationId, content, authorId: studentId })
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
      const { data, error } = await admin
        .from('courses')
        .select('id,title,cover_image_url,promo_video_url,module_layout_image_url,modules,data,user_id,created_at,status')
        .eq('user_id', producerId)
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) return json(res, 500, { error: error.message || String(error) })
      return json(res, 200, { data: Array.isArray(data) ? data : [] })
    }

  if (type === 'simulados') {
    const { data, error } = await admin
      .from('simulados')
      .select('id,title,cover_image_url,is_paid,price,availability_date,duration_minutes,max_grade,settings,created_at,user_id')
      .eq('user_id', producerId)
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) return json(res, 500, { error: error.message || String(error) })
    return json(res, 200, { data: Array.isArray(data) ? data : [] })
  }

  if (type === 'sales') {
    const producerRowId = await resolveProducerRowId()
    const producerKeys = Array.from(new Set([String(producerId || '').trim(), String(producerRowId || '').trim()].filter(Boolean)))
    const select = 'id,amount_cents,status,created_at,currency,producer_id,producer_external_id,producer_user_id'

    const fetchByColumn = async (col) => {
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

  if (type === 'conversations') {
    const producerRowId = await resolveProducerRowId()
    const producerKeys = Array.from(new Set([String(producerId || '').trim(), String(producerRowId || '').trim()].filter(Boolean)))
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
    const producerRowId = await resolveProducerRowId()
    const producerKeys = Array.from(new Set([String(producerId || '').trim(), String(producerRowId || '').trim()].filter(Boolean)))
    if (producerKeys.length === 0) return json(res, 200, { data: [] })
    const conversationId = String(u.searchParams.get('conversationId') || '').trim()
    if (!conversationId || !isUuid(conversationId)) return json(res, 400, { error: 'invalid_conversationId' })
    const allowed = await conversationBelongsToProducer(conversationId, producerKeys)
    if (!allowed) return json(res, 200, { data: [] })
    const feed = await fetchConversationFeedCanonical(conversationId)
    return json(res, 200, { data: Array.isArray(feed) ? feed : [] })
  }

  if (type === 'conversation_mark_read') {
    const producerRowId = await resolveProducerRowId()
    const producerKeys = Array.from(new Set([String(producerId || '').trim(), String(producerRowId || '').trim()].filter(Boolean)))
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
      if (String(data.user_id || '') !== String(producerId)) return json(res, 403, { error: 'forbidden' })
      return json(res, 200, { data })
    }

    if (type === 'simulado_runner') {
      const simId = String(u.searchParams.get('simId') || '').trim()
      if (!simId || !isUuid(simId)) return json(res, 400, { error: 'invalid_simId' })

      const { data: simulado, error: simErr } = await admin
        .from('simulados')
        .select('id,title,cover_image_url,is_paid,price,availability_date,duration_minutes,max_grade,settings,question_ids,user_id,created_at')
        .eq('id', simId)
        .maybeSingle()
      if (simErr) return json(res, 500, { error: simErr.message || String(simErr) })
      if (!simulado) return json(res, 404, { error: 'not_found' })
      if (String(simulado.user_id || '') !== String(producerId)) return json(res, 403, { error: 'forbidden' })

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
          meta: { simId, producerId, questionIds: fetchedIds },
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
      if (String(data.user_id || '') !== String(producerId)) return json(res, 403, { error: 'forbidden' })
      return json(res, 200, { data })
    }

    return json(res, 400, { error: 'invalid_type' })
  } catch (e) {
    return json(res, 500, { error: e?.message || String(e) })
  }
}
