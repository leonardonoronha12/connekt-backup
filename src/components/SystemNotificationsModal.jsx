import React, { useEffect, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { notificationsService } from '@/services/notificationsService.js'

const formatDateBR = (iso) => {
  try {
    const d = new Date(iso)
    if (!isFinite(d.getTime())) return '-'
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yyyy = d.getFullYear()
    return `Dia ${dd}/${mm}/${yyyy}`
  } catch (_) {
    return '-'
  }
}

const initials = (name) => {
  const s = String(name || '').trim()
  if (!s) return '?'
  const parts = s.split(/\s+/).filter(Boolean)
  const a = parts[0]?.[0] || ''
  const b = parts.length > 1 ? parts[1]?.[0] || '' : (parts[0]?.[1] || '')
  return (a + b).toUpperCase() || '?'
}

const TabButton = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={[
      'px-4 py-2 text-[12px] font-semibold rounded-full transition-colors',
      active ? 'bg-white text-[#0047BB] shadow-sm' : 'text-[#8F9299] hover:text-[#1E1B39]',
    ].join(' ')}
  >
    {children}
  </button>
)

const NotificationRow = ({ n, onOpen }) => {
  const actor = n?.actorName || 'Connekt'
  const read = !!n?.readAt
  const entity = n?.entityName
  const title = n?.title || ''
  const message = n?.message || ''

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left flex items-start gap-3 py-4 border-b border-[#EEF0F3] last:border-b-0"
    >
      <div
        className={[
          'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
          read ? 'bg-[#F3F4F5] text-[#1E1B39]' : 'bg-[#EEF2FF] text-[#0047BB]',
        ].join(' ')}
      >
        <span className="text-[12px] font-bold">{initials(actor)}</span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-[13px] text-[#1E1B39] leading-[18px] break-words">
          {title ? (
            <>
              <span className="font-semibold">{title}</span>
              {entity ? <>: <span className="font-semibold">{entity}</span></> : null}
            </>
          ) : (
            <>
              <span className="font-semibold">{actor}</span>
              {message ? <> {message}</> : null}
              {entity ? <> <span className="font-semibold">{entity}</span></> : null}
            </>
          )}
        </div>
        <div className="text-[12px] text-[#8F9299] mt-1">{formatDateBR(n?.createdAt)}</div>
      </div>

      {!read ? <div className="w-2 h-2 rounded-full bg-[#0047BB] mt-2 flex-shrink-0" /> : null}
    </button>
  )
}

const SystemNotificationsModal = ({ open, onClose, user }) => {
  const userId = user?.id || null
  const [tab, setTab] = useState('all')
  const [items, setItems] = useState([])
  const panelRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onMouseDown = (e) => {
      const el = panelRef.current
      if (!el) return
      if (!el.contains(e.target)) {
        try { onClose && onClose() } catch (_) {}
      }
    }
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        try { onClose && onClose() } catch (_) {}
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    notificationsService.ensureWelcome(user)
  }, [open, user?.id])

  useEffect(() => {
    if (!open) return
    const unsub = notificationsService.subscribe(userId, setItems)
    return () => { try { unsub && unsub() } catch (_) {} }
  }, [open, userId])

  const filtered = useMemo(() => {
    if (tab === 'unread') return items.filter(n => n && !n.readAt)
    if (tab === 'read') return items.filter(n => n && !!n.readAt)
    return items
  }, [items, tab])

  const unreadCount = useMemo(() => items.filter(n => n && !n.readAt).length, [items])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[20000] isolate flex items-start justify-center p-4 bg-black/30 sm:bg-transparent sm:justify-end sm:p-0">
      <div
        ref={panelRef}
        className="w-full max-w-[420px] sm:w-[380px] bg-white rounded-[16px] shadow-xl border border-[#E3E4E5] overflow-hidden mt-16 sm:mt-[72px] sm:mr-[24px]"
      >
        <div className="flex items-center justify-between px-5 py-4">
          <div className="text-[16px] font-bold text-[#1E1B39]">Notificações</div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5 transition-colors"
            aria-label="Fechar"
            title="Fechar"
          >
            <X size={16} className="text-[#8F9299]" />
          </button>
        </div>

        <div className="px-5">
          <div className="bg-[#F3F4F5] rounded-full p-1 flex items-center justify-between gap-1">
            <TabButton active={tab === 'all'} onClick={() => setTab('all')}>Todos</TabButton>
            <TabButton active={tab === 'unread'} onClick={() => setTab('unread')}>Não lidos</TabButton>
            <TabButton active={tab === 'read'} onClick={() => setTab('read')}>Lidos</TabButton>
          </div>

          <div className="flex items-center justify-between mt-3">
            <div className="text-[12px] text-[#8F9299]">
              {unreadCount > 0 ? `${unreadCount} não lida${unreadCount === 1 ? '' : 's'}` : 'Nenhuma não lida'}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => notificationsService.markAllRead(userId)}
                className="text-[12px] font-semibold text-[#0047BB] hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!userId || unreadCount === 0}
              >
                Marcar todas como lidas
              </button>
              <button
                type="button"
                onClick={() => notificationsService.clearAll(userId)}
                className="text-[12px] font-semibold text-[#8F9299] hover:text-[#1E1B39]"
                disabled={!userId || items.length === 0}
              >
                Limpar
              </button>
            </div>
          </div>
        </div>

        <div className="mt-2 max-h-[calc(100vh-220px)] sm:max-h-[520px] overflow-auto px-5">
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-[13px] text-[#8F9299]">
              Sem notificações por aqui.
            </div>
          ) : (
            filtered.map((n) => (
              <NotificationRow
                key={n.id}
                n={n}
                onOpen={() => {
                  notificationsService.markRead(userId, n.id)
                  const href = n?.href
                  if (href && typeof href === 'string' && href.startsWith('/')) {
                    try {
                      window.history.pushState({}, '', href)
                      window.dispatchEvent(new PopStateEvent('popstate'))
                    } catch (_) {}
                    try { onClose && onClose() } catch (_) {}
                  }
                }}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default SystemNotificationsModal
