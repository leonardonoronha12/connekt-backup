import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Search, X } from 'lucide-react'
import { useAuth } from '@/contexts/SupabaseAuthContext'
import { toast } from '@/hooks/use-toast.ts'

function formatMoneyFromCents(cents) {
  const n = Number(cents || 0)
  const value = Number.isFinite(n) ? n / 100 : 0
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
  } catch (_) {
    return `R$ ${value.toFixed(2).replace('.', ',')}`
  }
}

function formatDateTimeBr(value) {
  const v = String(value || '').trim()
  if (!v) return '—'
  const d = new Date(v)
  if (!Number.isFinite(d.getTime())) return v
  try {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(d)
  } catch (_) {
    return d.toLocaleString('pt-BR')
  }
}

function formatIsoDateBr(value) {
  const v = String(value || '').trim()
  if (!v) return '—'
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!iso) return v
  return `${iso[3]}/${iso[2]}/${iso[1]}`
}

function withdrawStatusUi(raw) {
  const s = String(raw || '').trim().toLowerCase()
  if (s === 'paid' || s === 'completed' || s === 'done') return { label: 'Concluído', className: 'bg-[#E9F9EF] text-[#1F8A42]' }
  if (s === 'processing' || s === 'in_progress' || s === 'in progress') return { label: 'Em análise', className: 'bg-[#FFF4E5] text-[#C7780A]' }
  if (s === 'canceled' || s === 'cancelled' || s === 'rejected') return { label: 'Cancelado', className: 'bg-[#FDECEC] text-[#E53935]' }
  return { label: 'Solicitado', className: 'bg-[#EAF2FF] text-[#0047BB]' }
}

function parseMoneyToCents(value) {
  const raw = String(value || '').trim()
  if (!raw) return 0
  const norm = raw.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '')
  const n = Number(norm || 0)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.round(n * 100))
}

function formatIsoDateInput(value) {
  const v = String(value || '').trim()
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? v : ''
}

export default function PlatformAdminWithdrawRequestsPage() {
  const { session, user } = useAuth()
  const authHeaders = useMemo(() => {
    const t = String(session?.access_token || '')
    return t ? { Authorization: `Bearer ${t}` } : {}
  }, [session?.access_token])

  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [requests, setRequests] = useState([])
  const [standardDate, setStandardDate] = useState('')
  const [standardProducers, setStandardProducers] = useState([])

  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [kind, setKind] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [minAmount, setMinAmount] = useState('')
  const [onlyWithBalance, setOnlyWithBalance] = useState(false)
  const [standardStatus, setStandardStatus] = useState('all')

  const monitorStateRef = useRef({
    statusById: new Map(),
    emailCooldownUntil: 0,
    permissionAsked: false,
    isRunning: false,
    notifiedKeys: new Set(),
    emailWarned: false,
  })

  const runFetch = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (q) qs.set('q', q)
      if (status) qs.set('status', status)
      if (kind) qs.set('kind', kind)
      const fromIso = formatIsoDateInput(fromDate)
      const toIso = formatIsoDateInput(toDate)
      if (fromIso) qs.set('from', fromIso)
      if (toIso) qs.set('to', toIso)
      const minCents = parseMoneyToCents(minAmount)
      if (minCents > 0) qs.set('min_amount_cents', String(minCents))
      qs.set('per_page', '200')
      const r = await fetch(`/api/admin/withdraw-requests/list?${qs.toString()}`, { headers: authHeaders })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(body?.error || 'Falha ao carregar')
      setMissing(!!body?.missing)
      setRequests(Array.isArray(body?.requests) ? body.requests : [])
      setStandardDate(String(body?.standardPayoutDate || ''))
      setStandardProducers(Array.isArray(body?.standardProducers) ? body.standardProducers : [])
    } catch (e) {
      toast({ title: 'Erro', description: e?.message || 'Erro ao carregar', variant: 'destructive' })
      setMissing(false)
      setRequests([])
      setStandardDate('')
      setStandardProducers([])
    } finally {
      setLoading(false)
    }
  }, [authHeaders, fromDate, kind, minAmount, q, status, toDate])

  useEffect(() => {
    runFetch()
  }, [runFetch])

  const sendSelfEmail = useCallback(async ({ subject, text }) => {
    const token = String(session?.access_token || '').trim()
    const to = String(user?.email || '').trim()
    if (!token || !to) return { ok: false, error: 'missing_auth' }
    try {
      const r = await fetch('/api/send-email', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, text }),
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) return { ok: false, error: body?.error || 'send_failed', details: body?.details || null }
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e?.message || String(e) }
    }
  }, [session?.access_token, user?.email])

  const maybeDesktopNotify = useCallback(async ({ title, body }) => {
    try {
      if (typeof window === 'undefined') return
      if (!('Notification' in window)) return
      const state = monitorStateRef.current
      if (!state.permissionAsked) {
        state.permissionAsked = true
        try { await Notification.requestPermission() } catch (_) {}
      }
      if (Notification.permission !== 'granted') return
      const n = new Notification(String(title || 'Connekt'), { body: String(body || '') })
      try { n.onclick = () => { try { window.focus() } catch (_) {} } } catch (_) {}
    } catch (_) {}
  }, [])

  const monitorWithdrawRequests = useCallback(async () => {
    const state = monitorStateRef.current
    if (state.isRunning) return
    state.isRunning = true
    try {
      const t = String(session?.access_token || '').trim()
      if (!t) return
      const r = await fetch('/api/admin/withdraw-requests/list?per_page=200', { headers: { Authorization: `Bearer ${t}` } })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) return
      const list = Array.isArray(body?.requests) ? body.requests : []
      const changes = []
      for (const row of list) {
        const id = String(row?.id || '').trim()
        if (!id) continue
        const prev = state.statusById.get(id) || null
        const nextStatus = String(row?.status || '').trim() || 'requested'
        const nextUpdated = String(row?.updatedAt || row?.updated_at || row?.createdAt || row?.created_at || '').trim()
        const nextKey = `${id}:${nextStatus}:${nextUpdated}`

        if (!prev) {
          state.statusById.set(id, { status: nextStatus, updated: nextUpdated })
          if (state.notifiedKeys.has(nextKey)) continue
          state.notifiedKeys.add(nextKey)
          changes.push({ type: 'new', row, nextStatus })
          continue
        }
        if (prev.status !== nextStatus) {
          state.statusById.set(id, { status: nextStatus, updated: nextUpdated })
          if (state.notifiedKeys.has(nextKey)) continue
          state.notifiedKeys.add(nextKey)
          changes.push({ type: 'status', row, prevStatus: prev.status, nextStatus })
          continue
        }
        state.statusById.set(id, { status: nextStatus, updated: nextUpdated })
      }

      if (!changes.length) return

      for (const c of changes.slice(0, 5)) {
        const producer = String(c?.row?.producerName || '').trim() || `Produtor ${String(c?.row?.producerId || '').slice(0, 8)}`
        const amount = formatMoneyFromCents(c?.row?.amountCents || 0)
        if (c.type === 'new') {
          toast({ title: 'Novo saque solicitado', description: `${producer} • ${amount}` })
          await maybeDesktopNotify({ title: 'Novo saque solicitado', body: `${producer} • ${amount}` })
        } else {
          const ui = withdrawStatusUi(c.nextStatus)
          toast({ title: 'Saque atualizado', description: `${producer} • ${amount} • ${ui.label}` })
          await maybeDesktopNotify({ title: 'Saque atualizado', body: `${producer} • ${amount} • ${ui.label}` })
        }
      }

      const now = Date.now()
      if (now < state.emailCooldownUntil) return
      state.emailCooldownUntil = now + 60_000

      const subject = `Atualização de saques (${changes.length})`
      const lines = changes.slice(0, 20).map((c) => {
        const producer = String(c?.row?.producerName || '').trim() || `Produtor ${String(c?.row?.producerId || '').slice(0, 8)}`
        const email = String(c?.row?.producerEmail || '').trim()
        const amount = formatMoneyFromCents(c?.row?.amountCents || 0)
        if (c.type === 'new') return `Novo: ${producer}${email ? ` <${email}>` : ''} • ${amount} • status=Solicitado`
        return `Status: ${producer}${email ? ` <${email}>` : ''} • ${amount} • ${String(c?.prevStatus || '')} → ${String(c?.nextStatus || '')}`
      })
      const sent = await sendSelfEmail({ subject, text: lines.join('\n') })
      if (!sent.ok && !state.emailWarned) {
        state.emailWarned = true
        toast({ title: 'Aviso', description: 'Não consegui enviar o email de notificação.', variant: 'destructive' })
      }
    } finally {
      state.isRunning = false
    }
  }, [maybeDesktopNotify, sendSelfEmail, session?.access_token])

  useEffect(() => {
    monitorWithdrawRequests()
    const id = window.setInterval(() => {
      monitorWithdrawRequests()
    }, 15000)
    return () => { window.clearInterval(id) }
  }, [monitorWithdrawRequests])

  const filteredStandardProducers = useMemo(() => {
    const list = Array.isArray(standardProducers) ? standardProducers : []
    const query = String(q || '').trim().toLowerCase()
    const filtered = list.filter((p) => {
      if (query) {
        const hay = `${String(p?.producerName || '').toLowerCase()} ${String(p?.producerEmail || '').toLowerCase()} ${String(p?.producerId || '').toLowerCase()}`
        if (!hay.includes(query)) return false
      }
      if (onlyWithBalance) {
        const cents = Number(p?.receivableCents || 0)
        if (!(Number.isFinite(cents) && cents > 0)) return false
      }
      if (standardStatus && standardStatus !== 'all') {
        const ui = standardFlowStatusUi(p)
        if (standardStatus === 'no_balance' && ui.label !== 'Sem saldo') return false
        if (standardStatus === 'scheduled' && ui.label !== 'Agendado') return false
        if (standardStatus === 'available' && ui.label !== 'Disponível') return false
      }
      return true
    })
    return filtered
  }, [onlyWithBalance, q, standardFlowStatusUi, standardProducers, standardStatus])

  const filteredRequests = useMemo(() => {
    const list = Array.isArray(requests) ? requests : []
    const minCents = parseMoneyToCents(minAmount)
    return list.filter((r) => {
      if (onlyWithBalance) {
        const cents = Number(r?.receivableCents || 0)
        if (!(Number.isFinite(cents) && cents > 0)) return false
      }
      if (minCents > 0) {
        const cents = Number(r?.amountCents || 0)
        if (!(Number.isFinite(cents) && cents >= minCents)) return false
      }
      return true
    })
  }, [minAmount, onlyWithBalance, requests])

  const standardFlowStatusUi = useCallback((row) => {
    const cents = Number(row?.receivableCents || 0)
    if (!(Number.isFinite(cents) && cents > 0)) return { label: 'Sem saldo', className: 'bg-[#F3F3F3] text-[#414244]' }
    const dateIso = String(row?.standardPayoutDate || standardDate || '').trim()
    const todayIso = new Date().toISOString().slice(0, 10)
    if (dateIso && dateIso > todayIso) return { label: 'Agendado', className: 'bg-[#EAF2FF] text-[#0047BB]' }
    return { label: 'Disponível', className: 'bg-[#E9F9EF] text-[#1F8A42]' }
  }, [standardDate])

  return (
    <>
      <Helmet>
        <title>Connekt - Admin - Saques</title>
      </Helmet>
      <div className="min-h-screen bg-[#F5F6FA]">
        <div className="max-w-[1200px] mx-auto px-6 py-7 space-y-4">
          <div className="rounded-[12px] border border-[#E3E4E5] bg-white p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-[14px] font-semibold text-[#1E1B39]">Saques</div>
                <div className="text-[12px] text-[#737780]">Solicitações e fluxo padrão</div>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full sm:w-[380px]">
                <Search className="w-4 h-4 text-[#9291A5] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar por nome/email/id do produtor"
                  className="w-full h-[40px] rounded-[10px] border border-[#E3E4E5] pl-10 pr-9 text-[13px] outline-none focus:border-[#0047BB]"
                />
                {q ? (
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-[8px] hover:bg-[#F3F4F6] flex items-center justify-center"
                    onClick={() => setQ('')}
                  >
                    <X className="w-4 h-4 text-[#737780]" />
                  </button>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value)}
                  className="h-[40px] rounded-[10px] border border-[#E3E4E5] px-3 text-[13px] bg-white outline-none focus:border-[#0047BB]"
                >
                  <option value="">Tipo (todos)</option>
                  <option value="advance">Antecipação</option>
                  <option value="withdraw">Saque</option>
                </select>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="h-[40px] rounded-[10px] border border-[#E3E4E5] px-3 text-[13px] bg-white outline-none focus:border-[#0047BB]"
                >
                  <option value="">Status (todos)</option>
                  <option value="requested">Solicitado</option>
                  <option value="processing">Em análise</option>
                  <option value="paid">Concluído</option>
                  <option value="rejected">Cancelado</option>
                </select>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
              <div>
                <label className="text-[12px] text-[#737780]">De</label>
                <input
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  type="date"
                  className="mt-2 w-full h-[40px] rounded-[10px] border border-[#E3E4E5] px-3 text-[13px] bg-white outline-none focus:border-[#0047BB]"
                />
              </div>
              <div>
                <label className="text-[12px] text-[#737780]">Até</label>
                <input
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  type="date"
                  className="mt-2 w-full h-[40px] rounded-[10px] border border-[#E3E4E5] px-3 text-[13px] bg-white outline-none focus:border-[#0047BB]"
                />
              </div>
              <div>
                <label className="text-[12px] text-[#737780]">Valor mínimo</label>
                <input
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  inputMode="decimal"
                  placeholder="0,00"
                  className="mt-2 w-full h-[40px] rounded-[10px] border border-[#E3E4E5] px-3 text-[13px] bg-white outline-none focus:border-[#0047BB]"
                />
              </div>
              <div className="flex items-end">
                <label className="h-[40px] w-full rounded-[10px] border border-[#E3E4E5] px-3 text-[13px] bg-white outline-none focus:border-[#0047BB] flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={onlyWithBalance}
                    onChange={(e) => setOnlyWithBalance(e.target.checked)}
                  />
                  <span>Somente com saldo</span>
                </label>
              </div>
            </div>
          </div>

          <div className="rounded-[12px] border border-[#E3E4E5] bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[13px] font-semibold text-[#1E1B39]">Fluxo padrão (sem adiantamento)</div>
              <select
                value={standardStatus}
                onChange={(e) => setStandardStatus(e.target.value)}
                className="h-[36px] rounded-[10px] border border-[#E3E4E5] px-3 text-[12px] bg-white outline-none focus:border-[#0047BB]"
              >
                <option value="all">Status (todos)</option>
                <option value="available">Disponível</option>
                <option value="scheduled">Agendado</option>
                <option value="no_balance">Sem saldo</option>
              </select>
            </div>
            <div className="mt-2 text-[12px] text-[#737780]">
              Data automática do saque padrão: <span className="font-semibold text-[#1E1B39]">{standardDate ? formatIsoDateBr(standardDate) : '—'}</span>
            </div>

            <div className="mt-4 rounded-[12px] border border-[#E3E4E5] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-white">
                      <th className="px-5 py-4 text-left text-[12px] font-semibold text-[#737780]">Produtor</th>
                      <th className="px-5 py-4 text-left text-[12px] font-semibold text-[#737780]">Email</th>
                      <th className="px-5 py-4 text-left text-[12px] font-semibold text-[#737780]">Valor a receber</th>
                      <th className="px-5 py-4 text-left text-[12px] font-semibold text-[#737780]">Status</th>
                      <th className="px-5 py-4 text-left text-[12px] font-semibold text-[#737780]">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EDEEF0]">
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-8 text-center text-[13px] text-[#737780]">Carregando…</td>
                      </tr>
                    ) : filteredStandardProducers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-8 text-center text-[13px] text-[#737780]">Nenhum produtor encontrado.</td>
                      </tr>
                    ) : (
                      filteredStandardProducers.slice(0, 100).map((p) => (
                        (() => {
                          const statusUi = standardFlowStatusUi(p)
                          return (
                        <tr key={String(p?.producerId || Math.random())}>
                          <td className="px-5 py-4 text-[13px] text-[#1E1B39]">{String(p?.producerName || '').trim() || `Produtor ${String(p?.producerId || '').slice(0, 8)}`}</td>
                          <td className="px-5 py-4 text-[13px] text-[#1E1B39]">{String(p?.producerEmail || '').trim() || '—'}</td>
                          <td className="px-5 py-4 text-[13px] text-[#1E1B39]">{formatMoneyFromCents(p?.receivableCents || 0)}</td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-[12px] font-medium ${statusUi.className}`}>
                              {statusUi.label}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-[13px] text-[#1E1B39]">{formatIsoDateBr(p?.standardPayoutDate || standardDate || '')}</td>
                        </tr>
                          )
                        })()
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="rounded-[12px] border border-[#E3E4E5] bg-white overflow-hidden">
            <div className="px-6 py-5 border-b border-[#E3E4E5] flex items-center justify-between gap-3">
              <div>
                <div className="text-[14px] font-semibold text-[#1E1B39]">Solicitações de saque</div>
                <div className="text-[12px] text-[#737780] mt-1">Antecipações solicitadas pelos produtores</div>
              </div>
              {missing ? (
                <div className="text-[12px] font-semibold text-[#991B1B] bg-[#FDECEC] border border-[#F3C7C7] px-3 py-2 rounded-[10px]">
                  Tabela withdraw_requests não encontrada no banco
                </div>
              ) : null}
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-white">
                    <th className="px-6 py-4 text-left text-[12px] font-semibold text-[#737780]">Data</th>
                    <th className="px-6 py-4 text-left text-[12px] font-semibold text-[#737780]">Produtor</th>
                    <th className="px-6 py-4 text-left text-[12px] font-semibold text-[#737780]">Email</th>
                    <th className="px-6 py-4 text-left text-[12px] font-semibold text-[#737780]">Valor a receber</th>
                    <th className="px-6 py-4 text-left text-[12px] font-semibold text-[#737780]">Tipo</th>
                    <th className="px-6 py-4 text-left text-[12px] font-semibold text-[#737780]">Status</th>
                    <th className="px-6 py-4 text-left text-[12px] font-semibold text-[#737780]">Saque padrão</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EDEEF0]">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-[14px] text-[#737780]">Carregando…</td>
                    </tr>
                  ) : filteredRequests.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-[14px] text-[#737780]">Nenhuma solicitação encontrada.</td>
                    </tr>
                  ) : (
                    filteredRequests.slice(0, 200).map((r) => (
                      (() => {
                        const statusUi = withdrawStatusUi(r?.status)
                        return (
                      <tr key={String(r?.id || Math.random())}>
                        <td className="px-6 py-4 text-[13px] text-[#1E1B39]">{formatDateTimeBr(r?.createdAt)}</td>
                        <td className="px-6 py-4 text-[13px] text-[#1E1B39]">{String(r?.producerName || '').trim() || `Produtor ${String(r?.producerId || '').slice(0, 8)}`}</td>
                        <td className="px-6 py-4 text-[13px] text-[#1E1B39]">{String(r?.producerEmail || '').trim() || '—'}</td>
                        <td className="px-6 py-4 text-[13px] text-[#1E1B39]">{formatMoneyFromCents(r?.amountCents || 0)}</td>
                        <td className="px-6 py-4 text-[13px] text-[#1E1B39]">{String(r?.kind || '').trim().toLowerCase() === 'advance' ? 'Antecipação' : 'Saque'}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-[12px] font-medium ${statusUi.className}`}>
                            {statusUi.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-[13px] text-[#1E1B39]">{formatIsoDateBr(r?.standardPayoutDate || standardDate || '')}</td>
                      </tr>
                        )
                      })()
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
