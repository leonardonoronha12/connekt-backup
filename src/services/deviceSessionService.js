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

function isAbortError(error) {
  const name = String(error?.name || '').toLowerCase()
  const msg = String(error?.message || error?.msg || '').toLowerCase()
  return name.includes('abort') || msg.includes('abort') || msg.includes('canceled') || msg.includes('cancelled')
}

export async function claimDevice({ userId }) {
  const deviceId = getOrCreateDeviceId()
  const info = getDeviceInfo()
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

  if (error && isMissingColumnError(error)) return { ok: false, disabled: true }
  if (error) return { ok: false, error }
  return { ok: true, deviceId, info }
}

export async function heartbeat({ userId }) {
  const deviceId = getOrCreateDeviceId()
  const info = getDeviceInfo()
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

  if (error && isMissingColumnError(error)) return { ok: false, disabled: true }
  if (error) return { ok: false, error }
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
    if (error && isMissingColumnError(error)) return { ok: false, disabled: true }
    if (error) return { ok: false, error }
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

  if (error && isMissingColumnError(error)) return { ok: false, disabled: true }
  if (error) return { ok: false, error }
  return { ok: true }
}

export async function enforceSingleDevice({ userId, signal } = {}) {
  const currentDeviceId = getOrCreateDeviceId()
  const r = await getActiveDevice({ userId, signal })
  if (!r.ok) return r
  const d = r.device
  if (!d?.active_device_id) return { ok: true, allowed: true, reason: 'no_active_device' }

  const expiresAt = d.active_device_expires_at ? new Date(d.active_device_expires_at).getTime() : 0
  const expired = expiresAt > 0 ? expiresAt <= Date.now() : false
  if (expired) return { ok: true, allowed: true, reason: 'expired' }

  if (String(d.active_device_id) !== String(currentDeviceId)) {
    return { ok: true, allowed: false, reason: 'other_device', activeDevice: d }
  }
  return { ok: true, allowed: true, reason: 'this_device', activeDevice: d }
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
  signOutLocal,
  signOutGlobal,
}
