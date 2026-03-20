import { json } from '../../../src/server/supabaseAdmin.js'
import { requireAdmin } from '../_util.js'

function chunk(list, size) {
  const out = []
  const s = Math.max(1, Number(size || 200))
  for (let i = 0; i < list.length; i += s) out.push(list.slice(i, i + s))
  return out
}

function addDaysIsoDate(days) {
  const d = new Date(Date.now() + Math.max(0, Number(days || 0)) * 24 * 60 * 60 * 1000)
  if (!Number.isFinite(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

function parseIsoDate(value) {
  const v = String(value || '').trim()
  if (!v) return ''
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return ''
  return v
}

function isMissingTableOrColumn(error) {
  const msg = String(error?.message || error || '').toLowerCase()
  return (
    msg.includes('does not exist') ||
    msg.includes('schema cache') ||
    msg.includes('could not find the') ||
    msg.includes('column') ||
    msg.includes('relation')
  )
}

async function fetchReceivableByProducerId(admin, producerIds) {
  const ids = Array.from(new Set((producerIds || []).map((v) => String(v || '').trim()).filter(Boolean)))
  if (!ids.length) return {}
  const approvedStatuses = ['paid', 'aprovado', 'approved', 'succeeded', 'captured']
  const out = {}
  for (const part of chunk(ids, 200)) {
    try {
      const { data, error } = await admin
        .from('sales')
        .select('producer_id, total:amount_cents.sum()')
        .in('producer_id', part)
        .in('status', approvedStatuses)
        .limit(5000)
      if (error) continue
      for (const row of Array.isArray(data) ? data : []) {
        const pid = String(row?.producer_id || '').trim()
        if (!pid) continue
        const total = Number(row?.total || 0)
        out[pid] = Number.isFinite(total) ? total : 0
      }
    } catch (_) {}
  }
  return out
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' })
    const auth = await requireAdmin(req, res)
    if (!auth.ok) return

    const u = new URL(req.url, `http://${req.headers.host}`)
    const q = String(u.searchParams.get('q') || '').trim().toLowerCase()
    const status = String(u.searchParams.get('status') || '').trim().toLowerCase()
    const kind = String(u.searchParams.get('kind') || '').trim().toLowerCase()
    const fromDate = parseIsoDate(u.searchParams.get('from') || '')
    const toDate = parseIsoDate(u.searchParams.get('to') || '')
    const minAmountCents = Number(u.searchParams.get('min_amount_cents') || 0)
    const maxAmountCents = Number(u.searchParams.get('max_amount_cents') || 0)
    const perPage = Math.max(1, Math.min(500, Number(u.searchParams.get('per_page') || 200)))

    const standardPayoutDate = addDaysIsoDate(30)

    let requests = []
    try {
      let query = auth.admin
        .from('withdraw_requests')
        .select('id,producer_id,kind,amount_cents,status,created_at,updated_at')
        .order('created_at', { ascending: false })
        .limit(perPage)
      if (status) query = query.eq('status', status)
      if (kind) query = query.eq('kind', kind)
      if (fromDate) query = query.gte('created_at', `${fromDate}T00:00:00.000Z`)
      if (toDate) query = query.lte('created_at', `${toDate}T23:59:59.999Z`)
      if (Number.isFinite(minAmountCents) && minAmountCents > 0) query = query.gte('amount_cents', Math.floor(minAmountCents))
      if (Number.isFinite(maxAmountCents) && maxAmountCents > 0) query = query.lte('amount_cents', Math.floor(maxAmountCents))
      const { data, error } = await query
      if (error) {
        if (isMissingTableOrColumn(error)) return json(res, 200, { requests: [], users: {}, standardPayoutDate, standardProducers: [], missing: true })
        return json(res, 500, { error: error?.message || String(error) })
      }
      requests = Array.isArray(data) ? data : []
    } catch (e) {
      if (isMissingTableOrColumn(e)) return json(res, 200, { requests: [], users: {}, standardPayoutDate, standardProducers: [], missing: true })
      return json(res, 500, { error: e?.message || String(e) })
    }

    const producerIds = Array.from(new Set(requests.map((r) => String(r?.producer_id || '').trim()).filter(Boolean)))
    const usersById = {}

    if (producerIds.length) {
      for (const part of chunk(producerIds, 200)) {
        try {
          const { data, error } = await auth.admin
            .from('platform_admin_users')
            .select('id,email,name,account_type')
            .in('id', part)
            .limit(5000)
          if (error) continue
          for (const row of Array.isArray(data) ? data : []) {
            const id = String(row?.id || '').trim()
            if (!id) continue
            usersById[id] = {
              id,
              email: String(row?.email || '').trim(),
              name: String(row?.name || '').trim(),
              accountType: String(row?.account_type || '').trim(),
            }
          }
        } catch (_) {}
      }
    }

    let standardProducers = []
    try {
      const { data: producerCourses, error: prodErr } = await auth.admin
        .from('courses')
        .select('user_id')
        .order('created_at', { ascending: false })
        .limit(5000)
      if (!prodErr) {
        const producerIdSet = new Set()
        for (const row of Array.isArray(producerCourses) ? producerCourses : []) {
          const id = String(row?.user_id || '').trim()
          if (id) producerIdSet.add(id)
        }
        const producersAll = Array.from(producerIdSet)

        const advanceSet = new Set()
        const { data: advances, error: advErr } = await auth.admin
          .from('withdraw_requests')
          .select('producer_id,kind')
          .eq('kind', 'advance')
          .order('created_at', { ascending: false })
          .limit(5000)
        if (!advErr) {
          for (const row of Array.isArray(advances) ? advances : []) {
            const id = String(row?.producer_id || '').trim()
            if (id) advanceSet.add(id)
          }
        }

        const withoutAdvance = producersAll.filter((id) => !advanceSet.has(id))
        const info = []
        for (const part of chunk(withoutAdvance, 200)) {
          const { data, error } = await auth.admin.from('platform_admin_users').select('id,email,name').in('id', part).limit(5000)
          if (error) continue
          for (const row of Array.isArray(data) ? data : []) {
            const id = String(row?.id || '').trim()
            if (!id) continue
            info.push({
              producerId: id,
              producerEmail: String(row?.email || '').trim(),
              producerName: String(row?.name || '').trim(),
              standardPayoutDate,
            })
          }
        }
        info.sort((a, b) => String(a?.producerName || '').localeCompare(String(b?.producerName || ''), 'pt-BR'))
        standardProducers = info.slice(0, 500)
      }
    } catch (_) {
      standardProducers = []
    }

    const receivableByProducerId = await fetchReceivableByProducerId(
      auth.admin,
      [...producerIds, ...standardProducers.map((p) => String(p?.producerId || '').trim()).filter(Boolean)],
    )

    const normalizedRequests = requests
      .map((r) => {
        const pid = String(r?.producer_id || '').trim()
        const u = pid ? usersById[pid] : null
        return {
          id: r?.id || null,
          producerId: pid,
          producerEmail: u?.email || '',
          producerName: u?.name || '',
          kind: String(r?.kind || '').trim(),
          amountCents: Number(r?.amount_cents || 0),
          receivableCents: Number(receivableByProducerId?.[pid] || 0),
          status: String(r?.status || '').trim(),
          createdAt: r?.created_at || null,
          updatedAt: r?.updated_at || null,
          standardPayoutDate,
        }
      })
      .filter((r) => {
        if (!q) return true
        const hay = `${String(r?.producerName || '').toLowerCase()} ${String(r?.producerEmail || '').toLowerCase()} ${String(r?.producerId || '').toLowerCase()}`
        return hay.includes(q)
      })

    const standardProducersWithReceivable = standardProducers.map((p) => {
      const pid = String(p?.producerId || '').trim()
      return { ...p, receivableCents: Number(receivableByProducerId?.[pid] || 0) }
    })

    return json(res, 200, { requests: normalizedRequests, standardPayoutDate, standardProducers: standardProducersWithReceivable, missing: false })
  } catch (e) {
    return json(res, 500, { error: e?.message || String(e) })
  }
}
