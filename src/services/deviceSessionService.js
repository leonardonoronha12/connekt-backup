import { supabase } from '@/lib/supabaseClient'

const DEVICE_ID_KEY = 'connekt_device_id'
const LEASE_MS = 10 * 60 * 1000

function nowIso() {
  return new Date().toISOString()
}

function addMsIso(ms) {
  return new Date(Date.now() + ms).toISOString()
}

function safeGetLocalStorage() {
  try {
    return window.localStorage
  } catch (_) {
    return null
  }
}

function randomId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export function getOrCreateDeviceId() {
  const ls = safeGetLocalStorage()
  if (!ls) return randomId()
  const existing = String(ls.getItem(DEVICE_ID_KEY) || '').trim()
  if (existing) return existing
  const next = randomId()
  ls.setItem(DEVICE_ID_KEY, next)
  return next
}

export function getDeviceInfo() {
  const ua = typeof navigator !== 'undefined' ? (navigator.userAgent || '') : ''
  const isIOS = /iPhone|iPad|iPod/i.test(ua)
  const isAndroid = /Android/i.test(ua)
  const isMobile = isIOS || isAndroid

  const isWindows = /Windows NT/i.test(ua)
  const isMac = /Macintosh/i.test(ua)
  const isLinux = /Linux/i.test(ua) && !isAndroid

  const os = isWindows ? 'Windows' : isMac ? 'Mac' : isIOS ? 'iOS' : isAndroid ? 'Android' : isLinux ? 'Linux' : 'Dispositivo'

  const isEdge = /Edg\//i.test(ua)
  const isChrome = /Chrome\//i.test(ua) && !isEdge
  const isFirefox = /Firefox\//i.test(ua)
  const isSafari = /Safari\//i.test(ua) && !isChrome && !isEdge
  const browser = isEdge ? 'Edge' : isChrome ? 'Chrome' : isFirefox ? 'Firefox' : isSafari ? 'Safari' : 'Navegador'

  const type = isMobile ? 'mobile' : 'desktop'
  const label = `${browser} no ${os}`
  return { type, label, userAgent: ua }
}

function isMissingColumnError(error) {
  const msg = String(error?.message || '').toLowerCase()
  return msg.includes('column') && msg.includes('active_device')
}

function isMissingProfilesTableError(error) {
  const msg = String(error?.message || '').toLowerCase()
  return (msg.includes('relation') && msg.includes('profiles') && msg.includes('does not exist')) || msg.includes('profiles does not exist')
}

function isAbortError(error) {
  const name = String(error?.name || '').toLowerCase()
  const msg = String(error?.message || error?.msg || '').toLowerCase()
  return name.includes('abort') || msg.includes('abort') || msg.includes('canceled') || msg.includes('cancelled')
}

async function readAuthedUserMetadata() {
  try {
    const { data, error } = await supabase.auth.getUser()
    if (error) return { ok: false, error }
    const user = data?.user || null
    const meta = user?.user_metadata && typeof user.user_metadata === 'object' ? user.user_metadata : {}
    return { ok: true, user, meta }
  } catch (e) {
    return { ok: false, error: e }
  }
}

function extractDeviceSessionFromMeta(meta) {
  const m = meta && typeof meta === 'object' ? meta : {}
  const ds =
    (m.device_session && typeof m.device_session === 'object')
      ? m.device_session
      : ((m.deviceSession && typeof m.deviceSession === 'object') ? m.deviceSession : {})
  const pick = (k) => ds?.[k] ?? ds?.[k.replace(/_/g, '')] ?? ds?.[k.replace(/_/g, '-')] ?? null
  return {
    active_device_id: pick('active_device_id'),
    active_device_label: pick('active_device_label'),
    active_device_user_agent: pick('active_device_user_agent'),
    active_device_last_seen_at: pick('active_device_last_seen_at'),
    active_device_expires_at: pick('active_device_expires_at'),
  }
}

async function writeDeviceSessionToMeta(deviceSessionPatch) {
  const base = await readAuthedUserMetadata()
  if (!base.ok) return base
  const existing = extractDeviceSessionFromMeta(base.meta)
  const nextDeviceSession = { ...(existing || {}), ...(deviceSessionPatch || {}) }
  const nextMeta = { ...(base.meta || {}), device_session: nextDeviceSession }
  const { error } = await supabase.auth.updateUser({ data: nextMeta })
  if (error) return { ok: false, error }
  return { ok: true, device: nextDeviceSession }
}

function extractDeviceAccessFromMeta(meta) {
  const m = meta && typeof meta === 'object' ? meta : {}
  const da =
    (m.device_access && typeof m.device_access === 'object')
      ? m.device_access
      : ((m.deviceAccess && typeof m.deviceAccess === 'object') ? m.deviceAccess : {})
  const registered = (da.registered && typeof da.registered === 'object') ? da.registered : {}
  const pending = (da.pending && typeof da.pending === 'object') ? da.pending : null
  const normalizeDevice = (d) => {
    const obj = d && typeof d === 'object' ? d : {}
    return {
      device_id: obj.device_id || obj.deviceId || null,
      label: obj.label || obj.device_label || obj.deviceLabel || null,
      user_agent: obj.user_agent || obj.userAgent || null,
      approved_at: obj.approved_at || obj.approvedAt || null,
      last_seen_at: obj.last_seen_at || obj.lastSeenAt || null,
      expires_at: obj.expires_at || obj.expiresAt || null,
    }
  }
  const normalizePending = (p) => {
    const obj = p && typeof p === 'object' ? p : {}
    return {
      device_type: obj.device_type || obj.deviceType || null,
      device_id: obj.device_id || obj.deviceId || null,
      label: obj.label || obj.device_label || obj.deviceLabel || null,
      user_agent: obj.user_agent || obj.userAgent || null,
      requested_at: obj.requested_at || obj.requestedAt || null,
    }
  }
  return {
    registered: {
      desktop: normalizeDevice(registered.desktop),
      mobile: normalizeDevice(registered.mobile),
    },
    pending: pending ? normalizePending(pending) : null,
  }
}

async function writeDeviceAccessToMeta(deviceAccessPatch) {
  const base = await readAuthedUserMetadata()
  if (!base.ok) return base
  const existing = extractDeviceAccessFromMeta(base.meta)
  const patch = deviceAccessPatch && typeof deviceAccessPatch === 'object' ? deviceAccessPatch : {}
  const nextRegistered = {
    ...(existing?.registered || {}),
    ...(patch.registered && typeof patch.registered === 'object' ? patch.registered : {}),
  }
  const next = {
    ...(existing || {}),
    ...(patch || {}),
    registered: nextRegistered,
  }
  const nextMeta = { ...(base.meta || {}), device_access: next }
  const { error } = await supabase.auth.updateUser({ data: nextMeta })
  if (error) return { ok: false, error }
  return { ok: true, deviceAccess: next }
}

export async function getDeviceAccessState({ signal } = {}) {
  const base = await readAuthedUserMetadata()
  if (!base.ok) return { ok: false, error: base.error }
  if (signal?.aborted) return { ok: false, aborted: true }
  const state = extractDeviceAccessFromMeta(base.meta)
  return { ok: true, state }
}

export async function requestDeviceAccess({ deviceType } = {}) {
  const deviceId = getOrCreateDeviceId()
  const info = getDeviceInfo()
  const dt = String(deviceType || info.type || '').trim().toLowerCase() === 'mobile' ? 'mobile' : 'desktop'
  const requestedAt = nowIso()
  const r = await writeDeviceAccessToMeta({
    pending: {
      device_type: dt,
      device_id: deviceId,
      label: info.label,
      user_agent: info.userAgent,
      requested_at: requestedAt,
    },
  })
  if (!r.ok) return r
  return { ok: true, pending: r.deviceAccess?.pending || null, deviceId, deviceType: dt }
}

export async function approvePendingDeviceAccess() {
  const base = await readAuthedUserMetadata()
  if (!base.ok) return { ok: false, error: base.error }
  const state = extractDeviceAccessFromMeta(base.meta)
  const p = state.pending
  const dt = String(p?.device_type || '').trim().toLowerCase()
  if (dt !== 'desktop' && dt !== 'mobile') return { ok: false, error: 'missing_pending' }
  const nextDevice = {
    device_id: String(p.device_id || ''),
    label: String(p.label || ''),
    user_agent: String(p.user_agent || ''),
    approved_at: nowIso(),
    last_seen_at: nowIso(),
    expires_at: addMsIso(LEASE_MS),
  }
  const r = await writeDeviceAccessToMeta({
    registered: { [dt]: nextDevice },
    pending: null,
  })
  if (!r.ok) return r
  return { ok: true, registered: r.deviceAccess?.registered || null }
}

export async function denyPendingDeviceAccess() {
  const r = await writeDeviceAccessToMeta({ pending: null })
  if (!r.ok) return r
  return { ok: true }
}

export async function unregisterDeviceType({ deviceType } = {}) {
  const dt = String(deviceType || '').trim().toLowerCase() === 'mobile' ? 'mobile' : 'desktop'
  const r = await writeDeviceAccessToMeta({
    registered: {
      [dt]: {
        device_id: null,
        label: null,
        user_agent: null,
        approved_at: null,
        last_seen_at: null,
        expires_at: null,
      },
    },
  })
  if (!r.ok) return r
  return { ok: true }
}

export async function claimDevice({ userId }) {
  const deviceId = getOrCreateDeviceId()
  const info = getDeviceInfo()
  const deviceType = info.type === 'mobile' ? 'mobile' : 'desktop'
  try {
    const meta = await getDeviceAccessState()
    if (meta?.ok) {
      const slot = meta.state?.registered?.[deviceType] || {}
      const slotId = String(slot?.device_id || '').trim()
      if (slotId && slotId !== String(deviceId)) {
        const expiresAt = slot?.expires_at ? new Date(slot.expires_at).getTime() : 0
        const expired = expiresAt > 0 ? expiresAt <= Date.now() : false
        if (!expired) return { ok: false, needsApproval: true, reason: 'slot_taken', deviceType, activeDevice: slot }
      }
      await writeDeviceAccessToMeta({
        registered: {
          [deviceType]: {
            device_id: deviceId,
            label: info.label,
            user_agent: info.userAgent,
            approved_at: slotId ? (slot.approved_at || nowIso()) : nowIso(),
            last_seen_at: nowIso(),
            expires_at: addMsIso(LEASE_MS),
          },
        },
      })
    }
  } catch (_) {}
  const payload = {
    user_id: userId,
    active_device_id: deviceId,
    active_device_label: info.label,
    active_device_user_agent: info.userAgent,
    active_device_last_seen_at: nowIso(),
    active_device_expires_at: addMsIso(LEASE_MS),
  }

  const { error } = await supabase
    .from('profiles')
    .upsert(payload, { onConflict: 'user_id' })

  if (error && (isMissingColumnError(error) || isMissingProfilesTableError(error))) {
    const metaResult = await writeDeviceSessionToMeta({
      active_device_id: deviceId,
      active_device_label: info.label,
      active_device_user_agent: info.userAgent,
      active_device_last_seen_at: nowIso(),
      active_device_expires_at: addMsIso(LEASE_MS),
    })
    if (!metaResult.ok) return { ok: false, error: metaResult.error }
    return { ok: true, deviceId, info, mode: 'auth_metadata' }
  }
  if (error) {
    const metaResult = await writeDeviceSessionToMeta({
      active_device_id: deviceId,
      active_device_label: info.label,
      active_device_user_agent: info.userAgent,
      active_device_last_seen_at: nowIso(),
      active_device_expires_at: addMsIso(LEASE_MS),
    })
    if (!metaResult.ok) return { ok: false, error }
    return { ok: true, deviceId, info, mode: 'auth_metadata' }
  }
  return { ok: true, deviceId, info }
}

export async function heartbeat({ userId }) {
  const deviceId = getOrCreateDeviceId()
  const info = getDeviceInfo()
  const deviceType = info.type === 'mobile' ? 'mobile' : 'desktop'
  try {
    const meta = await getDeviceAccessState()
    if (meta?.ok) {
      const slot = meta.state?.registered?.[deviceType] || {}
      const slotId = String(slot?.device_id || '').trim()
      if (slotId && slotId !== String(deviceId)) {
        const expiresAt = slot?.expires_at ? new Date(slot.expires_at).getTime() : 0
        const expired = expiresAt > 0 ? expiresAt <= Date.now() : false
        if (!expired) return { ok: false, needsApproval: true, reason: 'slot_taken', deviceType, activeDevice: slot }
      }
      await writeDeviceAccessToMeta({
        registered: {
          [deviceType]: {
            device_id: deviceId,
            label: info.label,
            user_agent: info.userAgent,
            approved_at: slotId ? (slot.approved_at || nowIso()) : nowIso(),
            last_seen_at: nowIso(),
            expires_at: addMsIso(LEASE_MS),
          },
        },
      })
    }
  } catch (_) {}
  const { error } = await supabase
    .from('profiles')
    .update({
      active_device_id: deviceId,
      active_device_label: info.label,
      active_device_user_agent: info.userAgent,
      active_device_last_seen_at: nowIso(),
      active_device_expires_at: addMsIso(LEASE_MS),
    })
    .eq('user_id', userId)

  if (error && (isMissingColumnError(error) || isMissingProfilesTableError(error))) {
    const metaResult = await writeDeviceSessionToMeta({
      active_device_id: deviceId,
      active_device_label: info.label,
      active_device_user_agent: info.userAgent,
      active_device_last_seen_at: nowIso(),
      active_device_expires_at: addMsIso(LEASE_MS),
    })
    if (!metaResult.ok) return { ok: false, error: metaResult.error }
    return { ok: true, mode: 'auth_metadata' }
  }
  if (error) {
    const metaResult = await writeDeviceSessionToMeta({
      active_device_id: deviceId,
      active_device_label: info.label,
      active_device_user_agent: info.userAgent,
      active_device_last_seen_at: nowIso(),
      active_device_expires_at: addMsIso(LEASE_MS),
    })
    if (!metaResult.ok) return { ok: false, error }
    return { ok: true, mode: 'auth_metadata' }
  }
  return { ok: true }
}

export async function getActiveDevice({ userId, signal } = {}) {
  try {
    let q = supabase
      .from('profiles')
      .select('active_device_id,active_device_label,active_device_user_agent,active_device_last_seen_at,active_device_expires_at')
      .eq('user_id', userId)
      .maybeSingle()

    if (signal && typeof q?.abortSignal === 'function') {
      q = q.abortSignal(signal)
    }

    const { data, error } = await q

    if (error && isAbortError(error)) return { ok: false, aborted: true }
    if (error && (isMissingColumnError(error) || isMissingProfilesTableError(error))) {
      const base = await readAuthedUserMetadata()
      if (!base.ok) return { ok: false, error: base.error }
      const device = extractDeviceSessionFromMeta(base.meta)
      return { ok: true, device }
    }
    if (error) {
      const base = await readAuthedUserMetadata()
      if (!base.ok) return { ok: false, error }
      const device = extractDeviceSessionFromMeta(base.meta)
      return { ok: true, device }
    }
    return { ok: true, device: data || null }
  } catch (e) {
    if (isAbortError(e)) return { ok: false, aborted: true }
    return { ok: false, error: e }
  }
}

export async function clearActiveDevice({ userId }) {
  const { error } = await supabase
    .from('profiles')
    .update({
      active_device_id: null,
      active_device_label: null,
      active_device_user_agent: null,
      active_device_last_seen_at: null,
      active_device_expires_at: null,
    })
    .eq('user_id', userId)

  if (error && (isMissingColumnError(error) || isMissingProfilesTableError(error))) {
    const metaResult = await writeDeviceSessionToMeta({
      active_device_id: null,
      active_device_label: null,
      active_device_user_agent: null,
      active_device_last_seen_at: null,
      active_device_expires_at: null,
    })
    if (!metaResult.ok) return { ok: false, error: metaResult.error }
    return { ok: true, mode: 'auth_metadata' }
  }
  if (error) {
    const metaResult = await writeDeviceSessionToMeta({
      active_device_id: null,
      active_device_label: null,
      active_device_user_agent: null,
      active_device_last_seen_at: null,
      active_device_expires_at: null,
    })
    if (!metaResult.ok) return { ok: false, error }
    return { ok: true, mode: 'auth_metadata' }
  }
  return { ok: true }
}

export async function enforceDeviceLimit({ userId, signal } = {}) {
  const currentDeviceId = getOrCreateDeviceId()
  const info = getDeviceInfo()
  const deviceType = info.type === 'mobile' ? 'mobile' : 'desktop'
  const state = await getDeviceAccessState({ signal })
  if (!state.ok) return state
  const slot = state.state?.registered?.[deviceType] || {}
  const slotId = String(slot?.device_id || '').trim()
  if (!slotId) return { ok: true, allowed: true, reason: 'slot_empty', deviceType }
  const expiresAt = slot?.expires_at ? new Date(slot.expires_at).getTime() : 0
  const expired = expiresAt > 0 ? expiresAt <= Date.now() : false
  if (expired) return { ok: true, allowed: true, reason: 'expired', deviceType }
  if (slotId !== String(currentDeviceId)) {
    const pending = state.state?.pending || null
    if (pending && String(pending.device_id || '') === String(currentDeviceId) && String(pending.device_type || '') === deviceType) {
      return { ok: true, allowed: false, reason: 'awaiting_approval', deviceType, activeDevice: slot, pending }
    }
    return { ok: true, allowed: false, reason: 'other_device', deviceType, activeDevice: slot, pending }
  }
  return { ok: true, allowed: true, reason: 'this_device', deviceType, activeDevice: slot }
}

export async function enforceSingleDevice({ userId, signal } = {}) {
  return enforceDeviceLimit({ userId, signal })
}

export async function signOutLocal() {
  try {
    const { error } = await supabase.auth.signOut({ scope: 'local' })
    return { error }
  } catch (e) {
    const msg = String(e?.message || '').toLowerCase()
    if (msg.includes('abort')) return { error: null }
    try {
      const { error } = await supabase.auth.signOut()
      return { error }
    } catch (e2) {
      const msg2 = String(e2?.message || '').toLowerCase()
      if (msg2.includes('abort')) return { error: null }
      return { error: e2 }
    }
  }
}

export async function signOutGlobal() {
  try {
    const { error } = await supabase.auth.signOut({ scope: 'global' })
    return { error }
  } catch (e) {
    const msg = String(e?.message || '').toLowerCase()
    if (msg.includes('abort')) return { error: null }
    try {
      const { error } = await supabase.auth.signOut()
      return { error }
    } catch (e2) {
      const msg2 = String(e2?.message || '').toLowerCase()
      if (msg2.includes('abort')) return { error: null }
      return { error: e2 }
    }
  }
}

export const deviceSessionService = {
  LEASE_MS,
  getOrCreateDeviceId,
  getDeviceInfo,
  claimDevice,
  heartbeat,
  getActiveDevice,
  clearActiveDevice,
  enforceSingleDevice,
  enforceDeviceLimit,
  getDeviceAccessState,
  requestDeviceAccess,
  approvePendingDeviceAccess,
  denyPendingDeviceAccess,
  unregisterDeviceType,
  signOutLocal,
  signOutGlobal,
}
