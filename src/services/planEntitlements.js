import { supabase } from '@/lib/supabaseClient'
import { planService } from '@/services/planService'

const PLANS = {
  qa: {
    key: 'qa',
    limits: { storageGb: 500, questionBankQuestions: 'unlimited', playerIntegrations: 'multi' },
    flags: { npsFeedback: true, whitelabel: true },
  },
  teste: {
    key: 'teste',
    limits: { storageGb: 1, questionBankQuestions: 50, playerIntegrations: 1 },
    flags: { npsFeedback: false, whitelabel: false },
  },
  start: {
    key: 'start',
    limits: { storageGb: 5, questionBankQuestions: 200, playerIntegrations: 1 },
    flags: { npsFeedback: false, whitelabel: false },
  },
  pro: {
    key: 'pro',
    limits: { storageGb: 50, questionBankQuestions: 2000, playerIntegrations: 'multi' },
    flags: { npsFeedback: true, whitelabel: false },
  },
  premium: {
    key: 'premium',
    limits: { storageGb: 500, questionBankQuestions: 'unlimited', playerIntegrations: 'multi' },
    flags: { npsFeedback: true, whitelabel: true },
  },
}

const cache = {
  storageByUser: new Map(),
  questionCountByUser: new Map(),
  planKeyByUser: new Map(),
}

const nowMs = () => Date.now()
const ttlOk = (entry, ttlMs) => entry && typeof entry.ts === 'number' && (nowMs() - entry.ts) < ttlMs

export function resolvePlanKey() {
  try {
    const s = typeof planService.getSubscription === 'function' ? planService.getSubscription() : null
    return (s?.planKey || planService.getActivePlan?.() || 'start') ?? 'start'
  } catch (_) {
    return 'start'
  }
}

async function resolvePlanKeyForUser(userId, fallbackPlanKey) {
  const uid = String(userId || '').trim()
  const fallback = String(fallbackPlanKey || '').trim().toLowerCase() || 'start'
  if (!uid) return PLANS[fallback] ? fallback : 'start'

  const cached = cache.planKeyByUser.get(uid)
  if (ttlOk(cached, 60_000)) return cached.value

  let planKey = fallback
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('active_plan')
      .eq('user_id', uid)
      .maybeSingle()
    if (!error) {
      const k = String(data?.active_plan || '').trim().toLowerCase()
      if (k && PLANS[k]) planKey = k
    }
  } catch (_) {}

  if (!PLANS[planKey]) planKey = 'start'
  cache.planKeyByUser.set(uid, { ts: nowMs(), value: planKey })
  return planKey
}

export function getPlanEntitlements(planKey = resolvePlanKey()) {
  const p = PLANS[planKey] || PLANS.start
  return {
    planKey: p.key,
    limits: { ...(p.limits || {}) },
    flags: { ...(p.flags || {}) },
  }
}

export function canUseWhitelabel(planKey = resolvePlanKey()) {
  return !!getPlanEntitlements(planKey).flags.whitelabel
}

export function canUseNpsFeedback(planKey = resolvePlanKey()) {
  return !!getPlanEntitlements(planKey).flags.npsFeedback
}

export function getPlayerIntegrationsLimit(planKey = resolvePlanKey()) {
  return getPlanEntitlements(planKey).limits.playerIntegrations ?? 1
}

export function getStorageLimitBytes(planKey = resolvePlanKey()) {
  const gb = getPlanEntitlements(planKey).limits.storageGb
  return typeof gb === 'number' ? gb * 1024 * 1024 * 1024 : null
}

export function getQuestionLimit(planKey = resolvePlanKey()) {
  return getPlanEntitlements(planKey).limits.questionBankQuestions ?? 0
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
    if (isFinite(n) && n >= 0) return n
  }
  return null
}

async function listAllFilesBytes(bucket, rootPath, { maxItems = 20000 } = {}) {
  const queue = [String(rootPath || '').replace(/\/+$/, '')]
  const visited = new Set()
  let total = 0
  let scanned = 0
  let truncated = false

  while (queue.length > 0) {
    const prefix = queue.shift()
    if (visited.has(prefix)) continue
    visited.add(prefix)
    const { data: items, error } = await supabase.storage.from(bucket).list(prefix || '', { limit: 1000, offset: 0 })
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

async function fetchStorageUsedBytesFromApi(userId) {
  const uid = String(userId || '').trim()
  if (!uid) return null
  try {
    const { data } = await supabase.auth.getSession()
    const token = data?.session?.access_token || ''
    if (!token) return null
    const qs = new URLSearchParams({ type: 'storage_usage', userId: uid })
    const resp = await fetch(`/api/producer?${qs.toString()}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!resp.ok) return null
    const body = await resp.json().catch(() => null)
    if (!body || body.ok !== true) return null
    const bytes = Number(body.bytes)
    const truncated = !!body.truncated
    if (!Number.isFinite(bytes) || bytes < 0) return null
    return { bytes, truncated }
  } catch (_) {
    return null
  }
}

export async function getStorageUsedBytes(userId, { ttlMs = 30_000 } = {}) {
  const key = String(userId || '')
  if (!key) return { bytes: null, truncated: false }
  const cached = cache.storageByUser.get(key)
  if (ttlOk(cached, ttlMs)) return cached.value
  const fromApi = await fetchStorageUsedBytesFromApi(key)
  if (fromApi && typeof fromApi.bytes === 'number') {
    cache.storageByUser.set(key, { ts: nowMs(), value: fromApi })
    return fromApi
  }
  const buckets = [
    { bucket: 'courses-media', prefix: `users/${key}` },
    { bucket: 'question-images', prefix: `${key}` },
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
  const value = { bytes, truncated }
  cache.storageByUser.set(key, { ts: nowMs(), value })
  return value
}

export async function canUploadBytes(userId, bytesToAdd, planKey = resolvePlanKey()) {
  const effectivePlanKey = await resolvePlanKeyForUser(userId, planKey)
  const limit = getStorageLimitBytes(effectivePlanKey)
  if (typeof limit !== 'number') return { ok: true, reason: null }
  const add = Number(bytesToAdd || 0)
  if (!isFinite(add) || add <= 0) return { ok: true, reason: null }
  try {
    const used = await getStorageUsedBytes(userId)
    if (typeof used?.bytes !== 'number') return { ok: true, reason: null }
    if ((used.bytes + add) > limit) {
      return { ok: false, reason: 'storage_limit_reached', usedBytes: used.bytes, limitBytes: limit, planKey: effectivePlanKey }
    }
    try {
      const key = String(userId || '')
      if (key) cache.storageByUser.set(key, { ts: nowMs(), value: { bytes: used.bytes + add, truncated: !!used.truncated } })
    } catch (_) {}
    return { ok: true, reason: null, usedBytes: used.bytes, limitBytes: limit, planKey: effectivePlanKey }
  } catch (_) {
    return { ok: true, reason: null }
  }
}

export async function getTotalQuestionsCount(userId, { ttlMs = 20_000 } = {}) {
  const key = String(userId || '')
  if (!key) return { total: null, truncated: false }
  const cached = cache.questionCountByUser.get(key)
  if (ttlOk(cached, ttlMs)) return cached.value
  const { data, error } = await supabase
    .from('question_banks')
    .select('id,question_count,producer_external_id', { count: 'exact' })
    .eq('producer_external_id', key)
    .range(0, 999)
  if (error) throw error
  const rows = Array.isArray(data) ? data : []
  const total = rows.reduce((acc, r) => acc + (Number(r?.question_count) || 0), 0)
  const value = { total, truncated: false }
  cache.questionCountByUser.set(key, { ts: nowMs(), value })
  return value
}

export async function canCreateQuestion(userId, planKey = resolvePlanKey()) {
  const limit = getQuestionLimit(planKey)
  if (limit === 'unlimited') return { ok: true, reason: null }
  const max = Number(limit)
  if (!isFinite(max) || max <= 0) return { ok: true, reason: null }
  try {
    const { total } = await getTotalQuestionsCount(userId)
    if (typeof total !== 'number') return { ok: true, reason: null }
    if (total >= max) return { ok: false, reason: 'questions_limit_reached', total, limit: max }
    return { ok: true, reason: null, total, limit: max }
  } catch (_) {
    return { ok: true, reason: null }
  }
}

export async function getConnectedVideoProvidersCount(userId) {
  const uid = String(userId || '')
  if (!uid) return { count: 0, providers: { vimeo: false, vdocipher: false } }
  try {
    const [{ data: vimeoData }, { data: vdoData }] = await Promise.all([
      supabase.from('vimeo_connections').select('id').eq('user_id', uid).limit(1),
      supabase.from('vdocipher_connections').select('id').eq('user_id', uid).limit(1),
    ])
    const vimeo = Array.isArray(vimeoData) && vimeoData.length > 0
    const vdocipher = Array.isArray(vdoData) && vdoData.length > 0
    return { count: (vimeo ? 1 : 0) + (vdocipher ? 1 : 0), providers: { vimeo, vdocipher } }
  } catch (_) {
    return { count: 0, providers: { vimeo: false, vdocipher: false } }
  }
}

export function canConnectVideoProvider({ planKey = resolvePlanKey(), alreadyConnectedCount, isAlreadyConnected }) {
  const limit = getPlayerIntegrationsLimit(planKey)
  if (limit === 'multi') return { ok: true, reason: null }
  const max = Number(limit)
  if (!isFinite(max) || max <= 0) return { ok: false, reason: 'player_integrations_disabled' }
  const count = Number(alreadyConnectedCount || 0)
  if (isAlreadyConnected) return { ok: true, reason: null }
  if (count >= max) return { ok: false, reason: 'player_integrations_limit_reached', count, limit: max }
  return { ok: true, reason: null, count, limit: max }
}
