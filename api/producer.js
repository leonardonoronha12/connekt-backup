import { getSupabaseAdmin, getAuthedUser, isUuid, json } from '../src/server/supabaseAdmin.js'

function asArray(v) {
  return Array.isArray(v) ? v : []
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

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' })

  const admin = getSupabaseAdmin()
  if (!admin) return json(res, 501, { error: 'proxy_disabled', hint: 'Configure SUPABASE_SERVICE_ROLE_KEY no ambiente do deploy.' })

  const auth = await getAuthedUser(admin, req)
  if (!auth.user) return json(res, 401, { error: auth.error || 'unauthorized' })

  try {
    const u = new URL(req.url, `http://${req.headers.host}`)
    const type = String(u.searchParams.get('type') || '').trim().toLowerCase()
    const producerId = String(u.searchParams.get('producerId') || '').trim()

    if (!producerId || !isUuid(producerId)) return json(res, 400, { error: 'invalid_producer_id' })

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
        .from('v_questions_flat')
        .select('id,title,question,choices,correct_choice_index,points,attempts,image_url,created_at,updated_at')
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
        const meta = {
          choices: Array.isArray(row?.choices) ? row.choices : [],
          correctChoiceIndex: Number.isFinite(Number(row?.correct_choice_index)) ? Number(row.correct_choice_index) : null,
          points: Number.isFinite(Number(row?.points)) ? Number(row.points) : 0,
          attempts: Number.isFinite(Number(row?.attempts)) ? Number(row.attempts) : 0,
          imageUrl: row?.image_url || null,
        }
        ordered.push(mapQuestionRow({ ...row, metadata: meta }))
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
