import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Search, Download, SlidersHorizontal, Mail, CalendarDays, X, Wallet, Lock, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/SupabaseAuthContext'

const formatMoneyFromCents = (cents) => {
  const n = Number(cents || 0)
  const value = Number.isFinite(n) ? n / 100 : 0
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
  } catch (_) {
    return `R$ ${value.toFixed(2).replace('.', ',')}`
  }
}

const formatDateDot = (value) => {
  try {
    const d = value instanceof Date ? value : new Date(value)
    if (!Number.isFinite(d.getTime())) return '—'
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yyyy = d.getFullYear()
    return `${dd}.${mm}.${yyyy}`
  } catch (_) {
    return '—'
  }
}

const normalizeText = (value) => String(value || '').trim().toLowerCase()

const parseYmdToLocalDate = (ymd) => {
  const s = String(ymd || '').trim()
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null
  const dt = new Date(y, Math.max(0, mo - 1), d)
  return Number.isFinite(dt.getTime()) ? dt : null
}

const resolveSaleStatusUi = (rawStatus) => {
  const s = normalizeText(rawStatus)
  if (s === 'paid' || s === 'aprovado' || s === 'approved' || s === 'succeeded' || s === 'captured') {
    return { label: 'Aprovado', className: 'bg-[#E9F9EF] text-[#1F8A42]' }
  }
  if (s === 'declined' || s === 'refused' || s === 'failed' || s === 'rejected' || s === 'denied' || s === 'not_authorized' || s === 'not authorized') {
    return { label: 'Recusado', className: 'bg-[#FDECEC] text-[#E53935]' }
  }
  if (s === 'refunded' || s === 'chargeback' || s === 'canceled' || s === 'cancelled' || s === 'reembolsado') {
    return { label: 'Cancelado', className: 'bg-[#FDECEC] text-[#E53935]' }
  }
  return { label: 'Em análise', className: 'bg-[#FFF4E5] text-[#C7780A]' }
}

const pickFirst = (obj, keys) => {
  const o = obj && typeof obj === 'object' ? obj : {}
  for (const k of keys) {
    const v = o[k]
    if (v == null) continue
    const s = String(v).trim()
    if (s) return s
  }
  return ''
}

const resolveClientName = (row) =>
  pickFirst(row, ['client_name', 'clientName', 'customer_name', 'customerName', 'buyer_name', 'buyerName', 'name'])

const resolveClientEmail = (row) =>
  pickFirst(row, ['client_email', 'clientEmail', 'customer_email', 'customerEmail', 'buyer_email', 'buyerEmail', 'email'])

const resolveProductTitle = (row) =>
  pickFirst(row, ['product_title', 'productTitle', 'product_name', 'productName', 'item_title', 'itemTitle', 'course_title', 'courseTitle'])

const resolvePaymentMethod = (row) =>
  normalizeText(pickFirst(row, ['payment_method', 'paymentMethod', 'method', 'gateway_method', 'gatewayMethod', 'provider', 'brand', 'card_brand', 'cardBrand']))

const paymentIconSrc = (method) => {
  const m = normalizeText(method)
  if (m.includes('pix')) return '/pix.svg'
  if (m.includes('master')) return '/mastercard.svg'
  if (m.includes('visa')) return '/visa.svg'
  if (m.includes('boleto')) return '/boleto.svg'
  if (m.includes('card') || m.includes('credito') || m.includes('credit')) return '/mastercard.svg'
  return '/mastercard.svg'
}

const exportCsv = (rows) => {
  try {
    const headers = ['data', 'cliente', 'email', 'produto', 'valor', 'status']
    const lines = [headers.join(';')]
    for (const r of rows) {
      const date = formatDateDot(r?.created_at || r?.createdAt || '')
      const name = resolveClientName(r) || '—'
      const email = resolveClientEmail(r) || '—'
      const product = resolveProductTitle(r) || '—'
      const value = formatMoneyFromCents(r?.amount_cents || r?.amountCents || 0)
      const status = resolveSaleStatusUi(r?.status).label
      const escapeCell = (v) => String(v || '').replaceAll(';', ',').replaceAll('\n', ' ').trim()
      lines.push([date, name, email, product, value, status].map(escapeCell).join(';'))
    }
    const csv = lines.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vendas_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  } catch (_) {}
}

const MOCK_STATS = [
  { key: 'approved', title: 'Vendas aprovadas', delta: '+24,00%', deltaClass: 'bg-[#F1EDFF] text-[#331A88]', count: 8, value: 'R$ 1.740,00' },
  { key: 'declined', title: 'Vendas recusadas', delta: '+21,01%', deltaClass: 'bg-[#EAFFF0] text-[#34A853]', count: 35, value: 'R$ 5.258,00' },
  { key: 'pending', title: 'Aprovações pendentes', delta: '8,45%', deltaClass: 'bg-[#EAF2FF] text-[#0047BB]', count: 8, value: 'R$ 2.174,00' },
  { key: 'canceled', title: 'Vendas canceladas', delta: '0,00%', deltaClass: 'bg-[#F3F3F3] text-[#414244]', count: 0, value: 'R$ 0,00' },
]

const MOCK_ROWS = [
  { id: 'm1', created_at: '2025-09-02', payment_method: 'pix', client_name: 'Ygor Rafael', client_email: 'ygorrafaell@gmail.com', product_title: 'Neurologia', amount_cents: 899700, status: 'paid' },
  { id: 'm2', created_at: '2025-09-02', payment_method: 'visa', client_name: 'Sandra Peixoto', client_email: 'sandrapeixoto@gmail.com', product_title: 'Cirurgia Minimamente Invasiva', amount_cents: 289700, status: 'paid' },
  { id: 'm3', created_at: '2025-09-02', payment_method: 'mastercard', client_name: 'Manuela de Alcantara', client_email: 'manuelaalcantra@outlook.com', product_title: 'Cardiologia Avançada', amount_cents: 985000, status: 'canceled' },
  { id: 'm4', created_at: '2025-09-02', payment_method: 'mastercard', client_name: 'Maria Cavalcante', client_email: 'maria.cavalcante@gmail.com', product_title: 'Neurologia', amount_cents: 899700, status: 'pending' },
  { id: 'm5', created_at: '2025-09-02', payment_method: 'pix', client_name: 'Antônio de Aguiar', client_email: 'aguiar.antonio@hotmail.com', product_title: 'Cirurgia Minimamente Invasiva', amount_cents: 289700, status: 'pending' },
  { id: 'm6', created_at: '2025-09-02', payment_method: 'pix', client_name: 'Pedrosa', client_email: 'pedrosa.22@yahoo.com', product_title: 'Neurologia', amount_cents: 899700, status: 'paid' },
  { id: 'm7', created_at: '2025-09-02', payment_method: 'boleto', client_name: 'Aline Cardoso', client_email: 'aline.cardoso@outlook.com', product_title: 'Cardiologia Avançada', amount_cents: 985000, status: 'paid' },
  { id: 'm8', created_at: '2025-09-02', payment_method: 'boleto', client_name: 'Francisco de Queiroz', client_email: 'fran.queiroz@gmail.com', product_title: 'Neurologia', amount_cents: 899700, status: 'canceled' },
]

const DEFAULT_FILTERS = {
  startDate: '',
  endDate: '',
  product: '',
  paymentMethods: {
    card: true,
    pix: true,
    boleto: true,
  },
  statuses: {
    pending: true,
    approved: true,
    canceled: true,
  },
}

const cloneFilters = (filters) => {
  const f = filters || DEFAULT_FILTERS
  return {
    startDate: String(f.startDate || ''),
    endDate: String(f.endDate || ''),
    product: String(f.product || ''),
    paymentMethods: {
      card: !!f.paymentMethods?.card,
      pix: !!f.paymentMethods?.pix,
      boleto: !!f.paymentMethods?.boleto,
    },
    statuses: {
      pending: !!f.statuses?.pending,
      approved: !!f.statuses?.approved,
      canceled: !!f.statuses?.canceled,
    },
  }
}

const countActiveFilters = (filters) => {
  const f = cloneFilters(filters)
  let count = 0
  if (String(f.startDate || '').trim() || String(f.endDate || '').trim()) count += 1
  if (String(f.product || '').trim()) count += 1
  const pm = f.paymentMethods
  count += [pm.card, pm.pix, pm.boleto].filter((v) => v === false).length
  const st = f.statuses
  count += [st.pending, st.approved, st.canceled].filter((v) => v === false).length
  return count
}

const resolveMethodKey = (row) => {
  const m = resolvePaymentMethod(row)
  if (m.includes('pix')) return 'pix'
  if (m.includes('boleto')) return 'boleto'
  if (m.includes('card') || m.includes('credito') || m.includes('credit') || m.includes('visa') || m.includes('master')) return 'card'
  return ''
}

const resolveStatusKey = (row) => {
  const s = normalizeText(row?.status)
  if (s === 'paid' || s === 'aprovado' || s === 'approved' || s === 'succeeded' || s === 'captured') return 'approved'
  if (s === 'declined' || s === 'refused' || s === 'failed' || s === 'rejected' || s === 'denied' || s === 'not_authorized' || s === 'not authorized') return 'canceled'
  if (s === 'refunded' || s === 'chargeback' || s === 'canceled' || s === 'cancelled' || s === 'reembolsado') return 'canceled'
  return 'pending'
}

const Toggle = ({ checked, onToggle, disabled }) => (
  <label className={`inline-flex items-center ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
    <input
      type="checkbox"
      checked={!!checked}
      onChange={(e) => onToggle(!!e.target.checked)}
      disabled={disabled}
      className="sr-only"
    />
    <span className={`w-10 h-6 rounded-full relative transition-colors ${checked ? 'bg-[#0047BB]' : 'bg-[#E5E7EB]'}`}>
      <span className={`absolute top-[2px] left-[2px] w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
    </span>
  </label>
)

const VendasPage = () => {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [salesLoaded, setSalesLoaded] = useState(false)
  const [rows, setRows] = useState([])
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false)
  const [advanceStage, setAdvanceStage] = useState('idle')
  const advanceTimeoutRef = useRef({ t1: null, t2: null })
  const [appliedFilters, setAppliedFilters] = useState(() => cloneFilters(DEFAULT_FILTERS))
  const [draftFilters, setDraftFilters] = useState(() => cloneFilters(DEFAULT_FILTERS))
  const draftFiltersRef = useRef(draftFilters)

  useEffect(() => {
    draftFiltersRef.current = draftFilters
  }, [draftFilters])

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    ;(async () => {
      setSalesLoaded(false)
      setLoading(true)
      try {
        const token = (await supabase.auth.getSession().catch(() => ({ data: null })))?.data?.session?.access_token || ''
        if (!token) throw new Error('missing_token')
        const r = await fetch(`/api/producer?type=sales&producerId=${encodeURIComponent(String(user.id))}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const body = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(String(body?.error || 'fetch_failed'))
        const data = Array.isArray(body?.data) ? body.data : []
        if (!cancelled) setRows(data)
      } catch (_) {
        if (!cancelled) setRows([])
      } finally {
        if (!cancelled) setSalesLoaded(true)
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  const baseRows = salesLoaded ? rows : MOCK_ROWS

  const productOptions = useMemo(() => {
    const set = new Set()
    for (const r of baseRows) {
      const t = resolveProductTitle(r)
      if (t) set.add(t)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [baseRows])

  const filteredByFilters = useMemo(() => {
    const f = appliedFilters || DEFAULT_FILTERS
    const startDt = f.startDate ? parseYmdToLocalDate(f.startDate) : null
    const endDtRaw = f.endDate ? parseYmdToLocalDate(f.endDate) : null
    const endDt = endDtRaw ? new Date(endDtRaw.getTime()) : null
    if (endDt) endDt.setHours(23, 59, 59, 999)
    const product = String(f.product || '').trim()

    return (baseRows || []).filter((r) => {
      if (product) {
        const t = resolveProductTitle(r)
        if (t !== product) return false
      }

      if (startDt || endDt) {
        const raw = r?.created_at || r?.createdAt || null
        const dt = raw ? new Date(raw) : null
        if (!dt || !Number.isFinite(dt.getTime())) return false
        if (startDt && dt.getTime() < startDt.getTime()) return false
        if (endDt && dt.getTime() > endDt.getTime()) return false
      }

      const methodKey = resolveMethodKey(r)
      const methodEnabled =
        (methodKey === 'pix' && !!f.paymentMethods?.pix) ||
        (methodKey === 'boleto' && !!f.paymentMethods?.boleto) ||
        (methodKey === 'card' && !!f.paymentMethods?.card) ||
        (!methodKey && (!!f.paymentMethods?.pix || !!f.paymentMethods?.boleto || !!f.paymentMethods?.card))
      if (!methodEnabled) return false

      const statusKey = resolveStatusKey(r)
      const statusEnabled =
        (statusKey === 'pending' && !!f.statuses?.pending) ||
        (statusKey === 'approved' && !!f.statuses?.approved) ||
        (statusKey === 'canceled' && !!f.statuses?.canceled)
      if (!statusEnabled) return false

      return true
    })
  }, [baseRows, appliedFilters])

  const filteredRows = useMemo(() => {
    const term = normalizeText(q)
    if (!term) return filteredByFilters
    return (filteredByFilters || []).filter((r) => {
      const hay = [
        resolveClientName(r),
        resolveClientEmail(r),
        resolveProductTitle(r),
        String(r?.id || ''),
        String(r?.status || ''),
      ]
        .map((v) => normalizeText(v))
        .join(' ')
      return hay.includes(term)
    })
  }, [filteredByFilters, q])

  const pageSize = 8
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const safePage = Math.max(1, Math.min(page, totalPages))
  const pagedRows = filteredRows.slice((safePage - 1) * pageSize, safePage * pageSize)

  useEffect(() => {
    if (page !== safePage) setPage(safePage)
  }, [page, safePage])

  const stats = useMemo(() => {
    if (!salesLoaded) return MOCK_STATS
    const totals = {
      approved: { count: 0, cents: 0 },
      declined: { count: 0, cents: 0 },
      pending: { count: 0, cents: 0 },
      canceled: { count: 0, cents: 0 },
    }
    const bucketOf = (statusRaw) => {
      const s = normalizeText(statusRaw)
      if (s === 'paid' || s === 'aprovado' || s === 'approved' || s === 'succeeded' || s === 'captured') return 'approved'
      if (s === 'declined' || s === 'refused' || s === 'failed' || s === 'rejected' || s === 'denied' || s === 'not_authorized' || s === 'not authorized') return 'declined'
      if (s === 'refunded' || s === 'chargeback' || s === 'canceled' || s === 'cancelled' || s === 'reembolsado') return 'canceled'
      return 'pending'
    }
    for (const r of rows || []) {
      const key = bucketOf(r?.status)
      const t = totals[key] || totals.pending
      t.count += 1
      const v = Number(r?.amount_cents || 0)
      if (Number.isFinite(v)) t.cents += v
    }
    return [
      { key: 'approved', title: 'Vendas aprovadas', delta: '0,00%', deltaClass: 'bg-[#F1EDFF] text-[#331A88]', count: totals.approved.count, value: formatMoneyFromCents(totals.approved.cents) },
      { key: 'declined', title: 'Vendas recusadas', delta: '0,00%', deltaClass: 'bg-[#EAFFF0] text-[#34A853]', count: totals.declined.count, value: formatMoneyFromCents(totals.declined.cents) },
      { key: 'pending', title: 'Aprovações pendentes', delta: '0,00%', deltaClass: 'bg-[#EAF2FF] text-[#0047BB]', count: totals.pending.count, value: formatMoneyFromCents(totals.pending.cents) },
      { key: 'canceled', title: 'Vendas canceladas', delta: '0,00%', deltaClass: 'bg-[#F3F3F3] text-[#414244]', count: totals.canceled.count, value: formatMoneyFromCents(totals.canceled.cents) },
    ]
  }, [rows, salesLoaded])

  const receivableCents = useMemo(() => {
    const list = salesLoaded ? (Array.isArray(rows) ? rows : []) : (Array.isArray(baseRows) ? baseRows : [])
    let sum = 0
    for (const r of list) {
      if (resolveStatusKey(r) !== 'approved') continue
      const v = Number(r?.amount_cents || r?.amountCents || 0)
      if (Number.isFinite(v)) sum += v
    }
    return sum
  }, [baseRows, rows, salesLoaded])

  const openWithdraw = () => {
    setIsWithdrawOpen(true)
    setAdvanceStage('idle')
  }

  const requestAdvanceWithdraw = () => {
    if (advanceStage !== 'idle') return
    setAdvanceStage('sending')
    try {
      if (advanceTimeoutRef.current?.t1) window.clearTimeout(advanceTimeoutRef.current.t1)
      if (advanceTimeoutRef.current?.t2) window.clearTimeout(advanceTimeoutRef.current.t2)
    } catch (_) {}
    try {
      advanceTimeoutRef.current.t1 = window.setTimeout(() => setAdvanceStage('done'), 900)
      advanceTimeoutRef.current.t2 = window.setTimeout(() => setIsWithdrawOpen(false), 3200)
    } catch (_) {}
  }

  const appliedFilterCount = useMemo(() => countActiveFilters(appliedFilters), [appliedFilters])

  const goTo = (path) => {
    try {
      window.history.pushState({}, '', path)
      window.dispatchEvent(new PopStateEvent('popstate'))
    } catch (_) {
      window.location.assign(path)
    }
  }

  useEffect(() => {
    if (!isFilterOpen) return
    const onKeyDown = (e) => {
      if (e?.key === 'Escape') closeFilters()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isFilterOpen])

  useEffect(() => {
    if (!isWithdrawOpen) return
    const onKeyDown = (e) => {
      if (e?.key === 'Escape') setIsWithdrawOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isWithdrawOpen])

  useEffect(() => {
    if (isWithdrawOpen) return
    setAdvanceStage('idle')
    try {
      if (advanceTimeoutRef.current?.t1) window.clearTimeout(advanceTimeoutRef.current.t1)
      if (advanceTimeoutRef.current?.t2) window.clearTimeout(advanceTimeoutRef.current.t2)
      advanceTimeoutRef.current = { t1: null, t2: null }
    } catch (_) {}
  }, [isWithdrawOpen])

  const openFilters = () => {
    setDraftFilters(cloneFilters(appliedFilters || DEFAULT_FILTERS))
    setIsFilterOpen(true)
  }

  const closeFilters = () => {
    setAppliedFilters(cloneFilters(draftFiltersRef.current || DEFAULT_FILTERS))
    setIsFilterOpen(false)
    setPage(1)
  }

  const applyFilters = () => {
    closeFilters()
  }

  const clearDraftFilters = () => {
    setDraftFilters(cloneFilters(DEFAULT_FILTERS))
  }

  const debugSales = (() => {
    try {
      return new URLSearchParams(window.location.search || '').get('debugSales') === '1'
    } catch (_) {
      return false
    }
  })()

  const setDraftPaymentAll = () => {
    setDraftFilters((prev) => {
      const next = cloneFilters(prev)
      const all = next.paymentMethods.card && next.paymentMethods.pix && next.paymentMethods.boleto
      const value = !all
      return { ...next, paymentMethods: { card: value, pix: value, boleto: value } }
    })
  }

  const setDraftStatusAll = () => {
    setDraftFilters((prev) => {
      const next = cloneFilters(prev)
      const all = next.statuses.pending && next.statuses.approved && next.statuses.canceled
      const value = !all
      return { ...next, statuses: { pending: value, approved: value, canceled: value } }
    })
  }

  return (
    <div className="min-h-screen min-h-[100dvh] overflow-y-auto bg-gray-50">
      <Helmet>
        <title>Vendas - Connekt</title>
      </Helmet>

      <div className="max-w-[1180px] mx-auto pt-8 px-4 pb-8 space-y-[22px]">
        <div className="bg-gradient-to-r from-[#321A88] to-[#0D0439] rounded-[10px] px-6 py-5 text-white">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-white/15 rounded-[10px] flex items-center justify-center">
                <Mail className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-[14px] font-semibold">Finalize seu cadastro! 🔥</div>
                <div className="text-[12px] opacity-90">Você precisa completar o seu cadastro antes de começar a vender.</div>
              </div>
            </div>
            <button
              onClick={() => goTo('/configuracoes')}
              className="h-9 px-4 bg-white text-[#0047BB] text-[13px] font-semibold rounded-[6px] hover:bg-gray-50 transition-colors w-full md:w-auto"
              type="button"
            >
              Ativar sua conta aqui!
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="text-[18px] font-semibold text-[#1E1B39]">Vendas</div>
            <div className="text-[14px] text-[#737780] mt-1">Gerencie suas vendas e saques</div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:items-center w-full lg:w-auto">
            <div className="relative w-full sm:w-[420px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8F9299] w-4 h-4" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por nome ou email do cliente..."
                className="w-full h-10 pl-10 pr-3 rounded-[6px] border border-[#E3E4E5] bg-white text-[13px] text-[#1E1B39] outline-none focus:border-[#0047BB]"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={openWithdraw}
                className="h-10 px-4 rounded-[6px] bg-[#0047BB] text-white text-[13px] font-semibold hover:bg-[#003a99] inline-flex items-center gap-2"
              >
                <Wallet className="w-4 h-4 text-white" />
                Saque
              </button>
              <button
                type="button"
                onClick={() => exportCsv(filteredRows)}
                className="h-10 px-4 rounded-[6px] border border-[#E3E4E5] bg-white text-[13px] font-medium text-[#1E1B39] hover:bg-[#F8FAFC] inline-flex items-center gap-2"
              >
                <Download className="w-4 h-4 text-[#6B7280]" />
                Exportar
              </button>
              <button
                type="button"
                onClick={openFilters}
                className="h-10 px-4 rounded-[6px] border border-[#E3E4E5] bg-white text-[13px] font-medium text-[#1E1B39] hover:bg-[#F8FAFC] inline-flex items-center gap-2"
              >
                <SlidersHorizontal className="w-4 h-4 text-[#6B7280]" />
                Filtrar
                {!isFilterOpen && appliedFilterCount > 0 ? (
                  <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#0047BB] text-white text-[11px] font-semibold flex items-center justify-center">
                    {appliedFilterCount}
                  </span>
                ) : null}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-[22px]">
          {stats.map((s) => (
            <div key={s.key} className="bg-white rounded-[10px] shadow-[0_1px_4px_rgba(13,10,44,0.08)] px-[22px] py-8">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="text-xs text-[#9291A5] mb-1">Total</p>
                  <p className="text-xs font-medium text-[#1E1B39]">{s.title}</p>
                </div>
                <span className={`${s.deltaClass} text-xs font-medium px-2 py-1 rounded`}>{s.delta}</span>
              </div>
              <div className="flex justify-between items-end">
                <span className="text-[28px] font-semibold">{Number(s.count || 0).toLocaleString('pt-BR')}</span>
                <span className="text-sm font-medium">{s.value}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-[10px] shadow-[0_1px_4px_rgba(13,10,44,0.08)] border border-[#E3E4E5] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-white">
                  <th className="px-6 py-4 text-left text-[12px] font-semibold text-[#737780]">Venda</th>
                  <th className="px-6 py-4 text-left text-[12px] font-semibold text-[#737780]">Data</th>
                  <th className="px-6 py-4 text-left text-[12px] font-semibold text-[#737780]">Cliente</th>
                  <th className="px-6 py-4 text-left text-[12px] font-semibold text-[#737780]">Produto</th>
                  <th className="px-6 py-4 text-left text-[12px] font-semibold text-[#737780]">Valor (R$)</th>
                  <th className="px-6 py-4 text-left text-[12px] font-semibold text-[#737780]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDEEF0]">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-[14px] text-[#737780]">Carregando…</td>
                  </tr>
                ) : pagedRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-[14px] text-[#737780]">Nenhuma venda encontrada.</td>
                  </tr>
                ) : (
                  pagedRows.map((r) => {
                    const clientName = resolveClientName(r) || '—'
                    const clientEmail = resolveClientEmail(r) || '—'
                    const productTitle = resolveProductTitle(r) || '—'
                    const value = formatMoneyFromCents(r?.amount_cents || 0)
                    const statusUi = resolveSaleStatusUi(r?.status)
                    const method = resolvePaymentMethod(r)
                    const icon = paymentIconSrc(method)
                    const date = formatDateDot(r?.created_at || r?.createdAt || '')
                    return (
                      <tr key={String(r?.id || Math.random())}>
                        <td className="px-6 py-4">
                          <div className="w-8 h-8 rounded-[8px] bg-white border border-[#E3E4E5] flex items-center justify-center overflow-hidden">
                            <img src={icon} alt="" className="w-5 h-5" />
                          </div>
                        </td>
                        <td className="px-6 py-4 text-[14px] text-[#1E1B39]">{date}</td>
                        <td className="px-6 py-4">
                          <div className="text-[14px] text-[#1E1B39] leading-5">{clientName}</div>
                          <div className="text-[12px] text-[#737780] leading-4">{clientEmail}</div>
                        </td>
                        <td className="px-6 py-4 text-[14px] text-[#1E1B39]">{productTitle}</td>
                        <td className="px-6 py-4 text-[14px] text-[#1E1B39]">{value}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-[12px] font-medium ${statusUi.className}`}>
                            {statusUi.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end items-center gap-3 text-[12px] text-[#737780]">
          {(totalPages <= 6
            ? Array.from({ length: totalPages }).map((_, idx) => idx + 1)
            : [1, 2, '…', Math.max(1, totalPages - 2), Math.max(1, totalPages - 1), totalPages]
          ).map((p, idx) => {
            if (p === '…') return <span key={`dots-${idx}`} className="px-2">…</span>
            const n = Number(p)
            const active = n === safePage
            return (
              <button
                key={n}
                type="button"
                onClick={() => setPage(n)}
                className={`px-2 py-1 rounded ${active ? 'text-[#1E1B39]' : 'hover:bg-white'}`}
              >
                {String(n).padStart(2, '0')}
              </button>
            )
          })}
        </div>

        {debugSales ? (
          <div className="bg-white rounded-[10px] shadow-[0_1px_4px_rgba(13,10,44,0.08)] border border-[#E3E4E5] px-6 py-5">
            <div className="text-[12px] font-semibold text-[#1E1B39] mb-3">debugSales=1</div>
            <pre className="text-[11px] whitespace-pre-wrap break-words text-[#111827] bg-[#F9FAFB] border border-[#E5E7EB] rounded p-3 max-h-[420px] overflow-auto">
              {JSON.stringify({ rows: (rows || []).slice(0, 25) }, null, 2)}
            </pre>
          </div>
        ) : null}
      </div>

      {isWithdrawOpen ? (
        <div className="fixed inset-0 z-[90] bg-black/40 flex items-center justify-center p-6">
          <button type="button" className="absolute inset-0" aria-label="Fechar" onClick={() => setIsWithdrawOpen(false)} />
          <div role="dialog" aria-modal="true" className="relative w-full max-w-[520px] rounded-[14px] border border-[#E3E4E5] bg-white overflow-hidden">
            <div className="px-6 py-5 border-b border-[#E3E4E5] flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[12px] bg-[#EEF2FF] flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-[#0047BB]" />
                </div>
                <div>
                  <div className="text-[14px] font-semibold text-[#1E1B39]">Saque</div>
                  <div className="text-[12px] text-[#737780]">Solicite o recebimento das suas vendas</div>
                </div>
              </div>
              <button
                type="button"
                className="w-9 h-9 rounded-[10px] hover:bg-[#F3F4F6] flex items-center justify-center"
                onClick={() => setIsWithdrawOpen(false)}
                aria-label="Fechar"
              >
                <X className="w-4 h-4 text-[#737780]" />
              </button>
            </div>

            <div className={`p-6 space-y-4 ${advanceStage === 'idle' ? '' : 'opacity-30 pointer-events-none'}`}>
              <div className="rounded-[12px] border border-[#E3E4E5] bg-[#F8FAFC] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[12px] text-[#737780]">Valor a receber</div>
                    <div className="mt-1 text-[22px] font-semibold text-[#1E1B39]">{formatMoneyFromCents(receivableCents)}</div>
                  </div>
                  <div className="inline-flex items-center gap-2 px-3 py-2 rounded-[10px] border border-[#E3E4E5] bg-white text-[12px] font-semibold text-[#6B7280] opacity-70 select-none">
                    <Lock className="w-4 h-4" />
                    Bloqueado
                  </div>
                </div>
                <div className="mt-3 text-[12px] text-[#737780]">
                  Bloqueado por negociação de recebimento no fluxo padrão.
                </div>
              </div>

              <button
                type="button"
                onClick={requestAdvanceWithdraw}
                disabled={advanceStage !== 'idle'}
                className="h-11 w-full rounded-[10px] bg-gradient-to-r from-[#321A88] to-[#0047BB] text-white text-[13px] font-semibold hover:opacity-95 inline-flex items-center justify-center gap-2 disabled:opacity-60"
              >
                Antecipar saque
                <ArrowRight className="w-4 h-4 text-white" />
              </button>

              <div className="text-[12px] text-[#737780]">
                Ao clicar em “Antecipar saque”, a área comercial vai entrar em contato com você.
              </div>
            </div>

            {advanceStage !== 'idle' ? (
              <div className="absolute inset-0 flex items-center justify-center p-6">
                <div className="w-full max-w-[420px] rounded-[14px] border border-[#E3E4E5] bg-white shadow-xl overflow-hidden">
                  <div className="p-6">
                    <div className="flex items-center justify-center">
                      <div className="relative">
                        <div className="w-16 h-16 rounded-full bg-[#EEF2FF] flex items-center justify-center">
                          {advanceStage === 'sending' ? (
                            <Loader2 className="w-7 h-7 text-[#0047BB] animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-7 h-7 text-[#16A34A]" />
                          )}
                        </div>
                        <div className="absolute inset-0 rounded-full border border-[#C7D2FE] animate-ping opacity-30" />
                      </div>
                    </div>
                    <div className="mt-4 text-center">
                      <div className="text-[14px] font-semibold text-[#1E1B39]">
                        {advanceStage === 'sending' ? 'Enviando solicitação…' : 'Solicitação enviada'}
                      </div>
                      <div className="mt-2 text-[12px] text-[#737780]">
                        A área comercial vai entrar em contato com você para seguir com a antecipação do saque.
                      </div>
                      <div className="mt-3 text-[12px] text-[#737780]">
                        Valor a receber: <span className="font-semibold text-[#1E1B39]">{formatMoneyFromCents(receivableCents)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

        <div className={`fixed inset-0 z-[80] ${isFilterOpen ? '' : 'pointer-events-none'}`}>
        <div
          className={`absolute inset-0 bg-black/40 transition-opacity ${isFilterOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={closeFilters}
        />
        <div
          className={`absolute right-0 top-0 h-full w-full max-w-[420px] bg-white shadow-2xl transition-transform duration-200 ${isFilterOpen ? 'translate-x-0' : 'translate-x-full'}`}
          role="dialog"
          aria-modal="true"
          aria-label="Filtros"
        >
          <div className="h-full flex flex-col">
            <div className="px-6 pt-6 pb-4 border-b border-[#EDEEF0]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[16px] font-semibold text-[#1E1B39]">Filtros</div>
                  <div className="text-[12px] text-[#737780] mt-1">Aplique filtros em seu sistema de vendas</div>
                </div>
                <button
                  type="button"
                  onClick={closeFilters}
                  className="w-9 h-9 rounded-[8px] hover:bg-[#F8FAFC] flex items-center justify-center"
                  aria-label="Fechar"
                >
                  <X className="w-5 h-5 text-[#6B7280]" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              <div>
                <div className="text-[12px] font-medium text-[#1E1B39] mb-3">Período</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8F9299]" />
                    <input
                      type="date"
                      value={draftFilters.startDate}
                      onChange={(e) => setDraftFilters((p) => ({ ...(p || DEFAULT_FILTERS), startDate: e.target.value }))}
                      className="w-full h-10 pl-10 pr-3 rounded-[6px] border border-[#E3E4E5] bg-white text-[13px] text-[#1E1B39] outline-none focus:border-[#0047BB]"
                      placeholder="dd/mm/aaaa"
                    />
                  </div>
                  <div className="relative">
                    <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8F9299]" />
                    <input
                      type="date"
                      value={draftFilters.endDate}
                      onChange={(e) => setDraftFilters((p) => ({ ...(p || DEFAULT_FILTERS), endDate: e.target.value }))}
                      className="w-full h-10 pl-10 pr-3 rounded-[6px] border border-[#E3E4E5] bg-white text-[13px] text-[#1E1B39] outline-none focus:border-[#0047BB]"
                      placeholder="dd/mm/aaaa"
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="text-[12px] font-medium text-[#1E1B39] mb-3">Produto</div>
                <select
                  value={draftFilters.product}
                  onChange={(e) => setDraftFilters((p) => ({ ...(p || DEFAULT_FILTERS), product: e.target.value }))}
                  className="w-full h-10 px-3 rounded-[6px] border border-[#E3E4E5] bg-white text-[13px] text-[#1E1B39] outline-none focus:border-[#0047BB]"
                >
                  <option value="">Selecione o produto</option>
                  {productOptions.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[12px] font-medium text-[#1E1B39]">Método de pagamento</div>
                  <button type="button" onClick={setDraftPaymentAll} className="text-[12px] text-[#0047BB] font-medium hover:underline">
                    Selecionar todos
                  </button>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-[12px] text-[#1E1B39]">Cartão de crédito</div>
                    <Toggle
                      checked={!!draftFilters.paymentMethods.card}
                      onToggle={(v) => setDraftFilters((p) => ({ ...(p || DEFAULT_FILTERS), paymentMethods: { ...(p?.paymentMethods || DEFAULT_FILTERS.paymentMethods), card: v } }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-[12px] text-[#1E1B39]">PIX</div>
                    <Toggle
                      checked={!!draftFilters.paymentMethods.pix}
                      onToggle={(v) => setDraftFilters((p) => ({ ...(p || DEFAULT_FILTERS), paymentMethods: { ...(p?.paymentMethods || DEFAULT_FILTERS.paymentMethods), pix: v } }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-[12px] text-[#1E1B39]">Boleto Bancário</div>
                    <Toggle
                      checked={!!draftFilters.paymentMethods.boleto}
                      onToggle={(v) => setDraftFilters((p) => ({ ...(p || DEFAULT_FILTERS), paymentMethods: { ...(p?.paymentMethods || DEFAULT_FILTERS.paymentMethods), boleto: v } }))}
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[12px] font-medium text-[#1E1B39]">Status da transação</div>
                  <button type="button" onClick={setDraftStatusAll} className="text-[12px] text-[#0047BB] font-medium hover:underline">
                    Selecionar todos
                  </button>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-[12px] text-[#1E1B39]">Aguardando Aprovação</div>
                    <Toggle
                      checked={!!draftFilters.statuses.pending}
                      onToggle={(v) => setDraftFilters((p) => ({ ...(p || DEFAULT_FILTERS), statuses: { ...(p?.statuses || DEFAULT_FILTERS.statuses), pending: v } }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-[12px] text-[#1E1B39]">Aprovada</div>
                    <Toggle
                      checked={!!draftFilters.statuses.approved}
                      onToggle={(v) => setDraftFilters((p) => ({ ...(p || DEFAULT_FILTERS), statuses: { ...(p?.statuses || DEFAULT_FILTERS.statuses), approved: v } }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-[12px] text-[#1E1B39]">Cancelado</div>
                    <Toggle
                      checked={!!draftFilters.statuses.canceled}
                      onToggle={(v) => setDraftFilters((p) => ({ ...(p || DEFAULT_FILTERS), statuses: { ...(p?.statuses || DEFAULT_FILTERS.statuses), canceled: v } }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-[12px] text-[#1E1B39]">Chargeback</div>
                    <Toggle
                      checked={!!draftFilters.statuses.canceled}
                      onToggle={(v) => setDraftFilters((p) => ({ ...(p || DEFAULT_FILTERS), statuses: { ...(p?.statuses || DEFAULT_FILTERS.statuses), canceled: v } }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-[12px] text-[#1E1B39]">Reembolsada</div>
                    <Toggle
                      checked={!!draftFilters.statuses.canceled}
                      onToggle={(v) => setDraftFilters((p) => ({ ...(p || DEFAULT_FILTERS), statuses: { ...(p?.statuses || DEFAULT_FILTERS.statuses), canceled: v } }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-[12px] text-[#1E1B39]">Em Análise</div>
                    <Toggle
                      checked={!!draftFilters.statuses.pending}
                      onToggle={(v) => setDraftFilters((p) => ({ ...(p || DEFAULT_FILTERS), statuses: { ...(p?.statuses || DEFAULT_FILTERS.statuses), pending: v } }))}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[#EDEEF0] bg-white">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={clearDraftFilters}
                  className="h-10 rounded-[6px] bg-[#EAF2FF] text-[#0047BB] text-[13px] font-semibold hover:bg-[#DCEAFF]"
                >
                  Limpar filtros
                </button>
                <button
                  type="button"
                  onClick={applyFilters}
                  className="h-10 rounded-[6px] bg-[#0047BB] text-white text-[13px] font-semibold hover:bg-[#003a99]"
                >
                  Aplicar filtros
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default VendasPage
