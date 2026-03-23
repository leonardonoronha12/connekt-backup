import { json } from '../../../src/server/supabaseAdmin.js'
import { requireAdmin } from '../_util.js'

function normalizeStatus(raw) {
  const s = String(raw || '').trim().toLowerCase()
  if (!s) return ''
  if (s === 'requested' || s === 'solicitado') return 'requested'
  if (s === 'processing' || s === 'in_progress' || s === 'in progress' || s === 'em_analise' || s === 'em análise') return 'processing'
  if (s === 'paid' || s === 'completed' || s === 'done' || s === 'concluido' || s === 'concluído') return 'paid'
  if (s === 'canceled' || s === 'cancelled' || s === 'rejected' || s === 'cancelado') return 'canceled'
  return s
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
    const body = await readBody(req).catch(() => ({}))
    const id = String(body?.id || body?.requestId || '').trim()
    const status = normalizeStatus(body?.status || '')
    if (!id) return json(res, 400, { error: 'missing_id' })
    if (!status) return json(res, 400, { error: 'missing_status' })

    const { data, error } = await auth.admin
      .from('withdraw_requests')
      .update({ status })
      .eq('id', id)
      .select('id,status,updated_at')
      .maybeSingle()

    if (error) return json(res, 500, { error: error?.message || String(error) })
    if (!data?.id) return json(res, 404, { error: 'not_found' })
    return json(res, 200, { ok: true, id: String(data.id), status: String(data.status || ''), updatedAt: data.updated_at || null })
  } catch (e) {
    return json(res, 500, { error: 'internal_error', message: e?.message || String(e) })
  }
}

