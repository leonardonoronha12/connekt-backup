import { getSupabaseAdmin, getAuthedUser, readRawBody, json } from './_supabaseAdmin.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' })

  const admin = getSupabaseAdmin()
  if (!admin) return json(res, 501, { error: 'proxy_disabled', hint: 'Configure SUPABASE_SERVICE_ROLE_KEY no ambiente do deploy.' })

  const auth = await getAuthedUser(admin, req)
  if (!auth.user) return json(res, 401, { error: auth.error || 'unauthorized' })

  try {
    const body = await readRawBody(req)
    const parsed = JSON.parse(body.toString('utf-8') || '{}')
    const questionId = parsed?.questionId || parsed?.id || null
    const updates = (parsed?.updates && typeof parsed.updates === 'object') ? parsed.updates : {}
    if (!questionId) return json(res, 400, { error: 'missing_questionId' })

    const { data: q } = await admin
      .from('questions')
      .select('id,question_bank_id')
      .eq('id', String(questionId))
      .maybeSingle()
    if (!q?.question_bank_id) return json(res, 404, { error: 'not_found' })

    const { data: bank } = await admin
      .from('question_banks')
      .select('id,producer_external_id')
      .eq('id', String(q.question_bank_id))
      .maybeSingle()
    if (bank && String(bank.producer_external_id || '') !== String(auth.user.id)) return json(res, 403, { error: 'forbidden' })

    const payload = {}
    if (Object.prototype.hasOwnProperty.call(updates, 'title')) payload.title = updates.title
    if (Object.prototype.hasOwnProperty.call(updates, 'body')) payload.body = updates.body
    if (updates.metadata && typeof updates.metadata === 'object') payload.metadata = updates.metadata
    payload.updated_at = new Date().toISOString()

    const { data, error } = await admin
      .from('questions')
      .update(payload)
      .eq('id', String(questionId))
      .select('id, question_bank_id, title, body, metadata, created_at, updated_at')
      .single()

    if (error) return json(res, 500, { error: error.message || String(error) })
    return json(res, 200, { data })
  } catch (e) {
    return json(res, 500, { error: e?.message || String(e) })
  }
}

