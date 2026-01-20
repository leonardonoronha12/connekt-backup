const STORAGE_PREFIX = 'connekt_notifications_v1'

const listenersByUser = new Map()

function safeParse(json) {
  try { return JSON.parse(json) } catch (_) { return null }
}

function safeStringify(value) {
  try { return JSON.stringify(value) } catch (_) { return '[]' }
}

function getStorageKey(userId) {
  return `${STORAGE_PREFIX}:${userId || 'anon'}`
}

function readNotifications(userId) {
  try {
    const raw = localStorage.getItem(getStorageKey(userId))
    const parsed = raw ? safeParse(raw) : null
    if (!Array.isArray(parsed)) return []
    return parsed.filter(n => n && typeof n === 'object')
  } catch (_) {
    return []
  }
}

function writeNotifications(userId, next) {
  try { localStorage.setItem(getStorageKey(userId), safeStringify(next || [])) } catch (_) {}
  const ls = listenersByUser.get(userId || 'anon')
  if (ls) {
    const snapshot = readNotifications(userId)
    for (const cb of ls) {
      try { cb(snapshot) } catch (_) {}
    }
  }
}

function newId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  } catch (_) {}
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function sortDesc(a, b) {
  const ta = Date.parse(a?.createdAt || '') || 0
  const tb = Date.parse(b?.createdAt || '') || 0
  return tb - ta
}

export const notificationsService = {
  list(userId) {
    return readNotifications(userId).sort(sortDesc)
  },

  subscribe(userId, cb) {
    const key = userId || 'anon'
    let set = listenersByUser.get(key)
    if (!set) {
      set = new Set()
      listenersByUser.set(key, set)
    }
    set.add(cb)
    try { cb(this.list(userId)) } catch (_) {}
    return () => {
      const s = listenersByUser.get(key)
      if (!s) return
      s.delete(cb)
      if (s.size === 0) listenersByUser.delete(key)
    }
  },

  add(userId, payload) {
    const list = readNotifications(userId)
    const now = new Date().toISOString()
    const next = [
      {
        id: newId(),
        createdAt: now,
        readAt: null,
        type: payload?.type || 'system',
        title: payload?.title || '',
        message: payload?.message || '',
        actorName: payload?.actorName || null,
        entityName: payload?.entityName || null,
        href: payload?.href || null,
      },
      ...list,
    ].slice(0, 200)
    writeNotifications(userId, next)
    return next[0]
  },

  markRead(userId, notificationId) {
    const list = readNotifications(userId)
    const now = new Date().toISOString()
    const next = list.map(n => (n?.id === notificationId ? { ...n, readAt: n.readAt || now } : n))
    writeNotifications(userId, next)
    return { ok: true }
  },

  markAllRead(userId) {
    const list = readNotifications(userId)
    const now = new Date().toISOString()
    const next = list.map(n => ({ ...n, readAt: n.readAt || now }))
    writeNotifications(userId, next)
    return { ok: true }
  },

  clearAll(userId) {
    writeNotifications(userId, [])
    return { ok: true }
  },

  ensureWelcome(user) {
    const userId = user?.id || null
    if (!userId) return
    const list = readNotifications(userId)
    const exists = list.some(n => n?.type === 'welcome')
    if (exists) return
    this.add(userId, {
      type: 'welcome',
      title: 'Bem-vindo!',
      message: 'Sua central de notificações está ativa.',
      actorName: 'Connekt',
      entityName: null,
      href: '/dashboard',
    })
  },

  unreadCount(userId) {
    const list = readNotifications(userId)
    return list.reduce((acc, n) => acc + (n && !n.readAt ? 1 : 0), 0)
  },
}

