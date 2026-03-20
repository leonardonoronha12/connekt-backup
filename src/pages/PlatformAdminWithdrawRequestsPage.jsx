import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { ArrowLeft, Loader2, RefreshCcw, Search, X, Wallet } from 'lucide-react'
import { useAuth } from '@/contexts/SupabaseAuthContext'
import { toast } from '@/hooks/use-toast.ts'

function navigateTo(path) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

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

export default function PlatformAdminWithdrawRequestsPage() {
  const { session } = useAuth()
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
  const [refreshTick, setRefreshTick] = useState(0)

  const runFetch = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (q) qs.set('q', q)
      if (status) qs.set('status', status)
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
  }, [authHeaders, q, status])

  useEffect(() => {
    runFetch()
  }, [runFetch, refreshTick])

  const filteredStandardProducers = useMemo(() => {
    const list = Array.isArray(standardProducers) ? standardProducers : []
    const query = String(q || '').trim().toLowerCase()
    if (!query) return list
    return list.filter((p) => {
      const hay = `${String(p?.producerName || '').toLowerCase()} ${String(p?.producerEmail || '').toLowerCase()} ${String(p?.producerId || '').toLowerCase()}`
      return hay.includes(query)
    })
  }, [standardProducers, q])

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
        <div className="border-b border-[#E3E4E5] bg-white">
          <div className="max-w-[1200px] mx-auto px-6 py-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="w-10 h-10 rounded-[12px] border border-[#E3E4E5] bg-white flex items-center justify-center hover:bg-[#F8FAFC]"
                onClick={() => navigateTo('/admin')}
              >
                <ArrowLeft className="w-5 h-5 text-[#1E1B39]" />
              </button>
              <div className="w-10 h-10 rounded-[12px] bg-[#EEF2FF] flex items-center justify-center">
                <Wallet className="w-5 h-5 text-[#0047BB]" />
              </div>
              <div>
                <div className="text-[14px] font-semibold text-[#1E1B39]">Saques</div>
                <div className="text-[12px] text-[#737780]">Solicitações e fluxo padrão</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="h-9 px-3 rounded-[10px] border border-[#E3E4E5] bg-white text-[12px] font-semibold text-[#1E1B39] hover:bg-[#F8FAFC]"
                onClick={() => navigateTo('/admin/deploy')}
              >
                Publicar
              </button>
              <button
                type="button"
                className="h-9 px-3 rounded-[10px] bg-[#0047BB] text-white text-[12px] font-semibold hover:bg-[#003da0] disabled:opacity-50"
                disabled={loading}
                onClick={() => setRefreshTick((v) => v + 1)}
              >
                {loading ? <Loader2 className="w-4 h-4 inline-block mr-2 animate-spin" /> : <RefreshCcw className="w-4 h-4 inline-block mr-2" />}
                Atualizar
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-[1200px] mx-auto px-6 py-7 space-y-4">
          <div className="rounded-[12px] border border-[#E3E4E5] bg-white p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
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
          </div>

          <div className="rounded-[12px] border border-[#E3E4E5] bg-white p-5">
            <div className="text-[13px] font-semibold text-[#1E1B39]">Fluxo padrão (sem adiantamento)</div>
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
                  ) : requests.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-[14px] text-[#737780]">Nenhuma solicitação encontrada.</td>
                    </tr>
                  ) : (
                    requests.slice(0, 200).map((r) => (
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
