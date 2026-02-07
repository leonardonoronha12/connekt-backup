import { supabase } from '@/lib/supabaseClient'

const STORAGE_PREFIX = 'connekt_notifications_v1'

const listenersByUser = new Map()
const syncStateByUser = new Map()

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

async function fetchRemote(userId) {
  if (!userId) return []
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('id,recipient_user_id,type,title,message,actor_name,entity_name,href,created_at,read_at')
      .eq('recipient_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) return []
    return (Array.isArray(data) ? data : []).map((r) => ({
      id: String(r?.id || ''),
      createdAt: String(r?.created_at || ''),
      readAt: r?.read_at ? String(r.read_at) : null,
      type: r?.type || 'system',
      title: r?.title || '',
      message: r?.message || '',
      actorName: r?.actor_name || null,
      entityName: r?.entity_name || null,
      href: r?.href || null,
    })).filter((n) => n && n.id)
  } catch (_) {
    return []
  }
}

async function syncRemoteToLocal(userId) {
  const remote = await fetchRemote(userId)
  if (remote.length === 0) return
  writeNotifications(userId, remote)
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

    if (userId) {
      const existing = syncStateByUser.get(userId) || null
      if (!existing) {
        const state = { active: true, channel: null, timer: null }
        syncStateByUser.set(userId, state)
        syncRemoteToLocal(userId)
        try {
          state.channel = supabase
            .channel(`notifications:${userId}`)
            .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'notifications', filter: `recipient_user_id=eq.${userId}` },
              () => { syncRemoteToLocal(userId) }
            )
            .subscribe()
        } catch (_) {
          state.timer = window.setInterval(() => { syncRemoteToLocal(userId) }, 30_000)
        }
      }
    }

    return () => {
      const s = listenersByUser.get(key)
      if (!s) return
      s.delete(cb)
      if (s.size === 0) listenersByUser.delete(key)

      if (userId) {
        const st = syncStateByUser.get(userId)
        if (st && listenersByUser.get(userId)?.size !== 0) return
        if (st) {
          if (st.timer) window.clearInterval(st.timer)
          if (st.channel) {
            try { supabase.removeChannel(st.channel) } catch (_) {}
          }
          syncStateByUser.delete(userId)
        }
      }
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
    if (userId && notificationId) {
      try {
        supabase.from('notifications').update({ read_at: now }).eq('id', notificationId).eq('recipient_user_id', userId)
      } catch (_) {}
    }
    return { ok: true }
  },

  markAllRead(userId) {
    const list = readNotifications(userId)
    const now = new Date().toISOString()
    const next = list.map(n => ({ ...n, readAt: n.readAt || now }))
    writeNotifications(userId, next)
    if (userId) {
      try {
        supabase.from('notifications').update({ read_at: now }).eq('recipient_user_id', userId).is('read_at', null)
      } catch (_) {}
    }
    return { ok: true }
  },

  clearAll(userId) {
    writeNotifications(userId, [])
    if (userId) {
      try { supabase.from('notifications').delete().eq('recipient_user_id', userId) } catch (_) {}
    }
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

