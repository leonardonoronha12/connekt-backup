import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { ChevronLeft, ChevronRight, Menu, MoreVertical, X } from 'lucide-react'
import Header from '@/components/Header'
import BrandLogo from '@/components/BrandLogo'
import CourseFooter from '@/components/CourseFooter'
import AlunoInboxThread from '@/components/AlunoInboxThread'
import CheckoutPopup from '@/components/CheckoutPopup.jsx'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/SupabaseAuthContext'
import { useActiveProducerUserId } from '@/hooks/useActiveProducerUserId'
import { ALUNO_NAV_SECTIONS } from '@/constants/alunoNavSections'

function navigateTo(path) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function ApprovalRing({ value }) {
  const p = Math.max(0, Math.min(100, Number(value || 0)))
  const size = 26
  const stroke = 3
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const dash = (p / 100) * c
  return (
    <div className="relative w-[26px] h-[26px]">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E3E4E5" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#0047BB"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
    </div>
  )
}

function SimuladoCard({ title, subtitle, categories, status, approval, isPaid, price, imageUrl, isOwned }) {
  const p = Math.max(0, Math.min(100, Number(approval || 0)))
  const paid =
    typeof isPaid === 'boolean'
      ? isPaid
      : Math.max(0, Number(price || 0)) > 0
  const priceValue = Number(price || 0)
  const showPrice = paid && Number.isFinite(priceValue) && priceValue > 0
  const priceText = (() => {
    if (!showPrice) return ''
    try { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(priceValue) } catch (_) { return `R$ ${priceValue.toFixed(2)}` }
  })()
  const pills = Array.isArray(categories) ? categories.filter(Boolean).slice(0, 2) : []
  return (
    <div className="bg-white border border-[#E3E4E5] rounded-[8px] w-full h-[200px] px-4 py-3 flex flex-col transform-gpu will-change-transform transition-all duration-300 ease-out hover:-translate-y-2 hover:scale-[1.01] hover:shadow-xl">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <img src={imageUrl || '/icone img simulado.png'} alt="" className="w-[54px] h-[54px] rounded-[8px] object-cover" />
          <div className="flex flex-col">
            <div className="text-[12px] font-semibold text-[#1E1B39] font-inter leading-[18px]">{title}</div>
            <div className="text-[10px] text-[#9291A5] font-inter leading-[14px]">{subtitle}</div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <button type="button" className="w-7 h-7 rounded-[6px] bg-[#F6F5FA] flex items-center justify-center">
            <MoreVertical className="w-4 h-4 text-[#737780] -rotate-90" />
          </button>
          <span className="inline-flex items-center justify-center h-[18px] px-3 text-[10px] rounded-[54px] leading-none font-medium bg-[#E9FFEF] text-[#06C270]">
            {status}
          </span>
          {!paid ? (
            <span className="inline-flex items-center justify-center h-[18px] px-3 text-[10px] rounded-[54px] leading-none font-medium bg-[#EEF2FF] text-[#0047BB]">
              Gratuito
            </span>
          ) : null}
          {paid && isOwned ? (
            <span className="inline-flex items-center justify-center h-[18px] px-3 text-[10px] rounded-[54px] leading-none font-medium bg-[#E9FFEF] text-[#06C270]">
              Adquirido
            </span>
          ) : null}
          {showPrice ? (
            <span className="inline-flex items-center justify-center h-[18px] px-3 text-[10px] rounded-[54px] leading-none font-medium bg-[#FEF3C7] text-[#92400E]">
              {priceText}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        {pills.length > 0 ? pills.map((c) => (
          <span key={c} className="inline-flex items-center h-[18px] px-2 rounded-[4px] bg-[#EEF2FF] text-[#0047BB] text-[10px] font-medium">{c}</span>
        )) : (
          <span className="inline-flex items-center h-[18px] px-2 rounded-[4px] bg-[#EEF2FF] text-[#0047BB] text-[10px] font-medium">Simulado</span>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between pt-3">
        <div className="text-[10px] text-[#22252B] font-inter font-semibold">Aprovação (%)</div>
        <div className="flex items-center gap-2 text-[#0047BB]">
          <ApprovalRing value={p} />
          <div className="text-[12px] font-semibold">{p}%</div>
        </div>
      </div>
    </div>
  )
}

export default function AlunoSimuladoAcessoPage() {
  const { user } = useAuth()
  const activeProducerUserId = useActiveProducerUserId()
  const [loading, setLoading] = useState(true)
  const [simulado, setSimulado] = useState(null)
  const [studentName, setStudentName] = useState('Aluno')
  const [activeTab, setActiveTab] = useState('Simulados')
  const [ownedSimuladoIds, setOwnedSimuladoIds] = useState([])
  const [othersLoading, setOthersLoading] = useState(false)
  const [otherSimulados, setOtherSimulados] = useState([])
  const otherScrollRef = useRef(null)
  const [canScrollOtherLeft, setCanScrollOtherLeft] = useState(false)
  const [canScrollOtherRight, setCanScrollOtherRight] = useState(false)
  const [locationSearch, setLocationSearch] = useState(() => {
    try { return window.location.search || '' } catch (_) { return '' }
  })

  const params = useMemo(() => {
    try {
      const p = new URLSearchParams(locationSearch || '')
      return {
        simId: p.get('simId') || '',
        linkId: p.get('linkId') || p.get('paymentLinkId') || '',
        demo: p.get('demo') === '1',
      }
    } catch (_) {
      return { simId: '', linkId: '', demo: false }
    }
  }, [locationSearch])

  useEffect(() => {
    const sync = () => {
      try { setLocationSearch(window.location.search || '') } catch (_) { setLocationSearch('') }
    }
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])

  const safeLsGet = (key) => {
    try { return String(localStorage.getItem(String(key || '')) || '') } catch (_) { return '' }
  }

  const safeLsSet = (key, value) => {
    try { localStorage.setItem(String(key || ''), String(value)) } catch (_) {}
  }

  const ownedSimuladoIdSet = useMemo(() => {
    const set = new Set()
    for (const id of Array.isArray(ownedSimuladoIds) ? ownedSimuladoIds : []) {
      const v = String(id || '').trim()
      if (v) set.add(v)
    }
    return set
  }, [ownedSimuladoIds])

  useEffect(() => {
    const name = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'Aluno'
    setStudentName(String(name))
  }, [user])

  useEffect(() => {
    let active = true
    const run = async () => {
      if (params.demo) return
      try {
        const token = (await supabase.auth.getSession().catch(() => ({ data: null })))?.data?.session?.access_token || ''
        if (!token) return
        const { data, error } = await supabase
          .from('notifications')
          .select('type,entity_type,entity_id,entity_name,data,created_at')
          .eq('type', 'purchase_confirmed')
          .order('created_at', { ascending: false })
          .limit(500)
        if (!active) return
        if (error) throw error
        const set = new Set()
        for (const row of Array.isArray(data) ? data : []) {
          const entityType = String(row?.entity_type || '').trim().toLowerCase()
          const dataObj = row?.data && typeof row.data === 'object' ? row.data : null
          const dataType = String(dataObj?.type || '').trim().toLowerCase()
          if (entityType === 'simulado' || dataType === 'simulado') {
            const id = String(row?.entity_id || dataObj?.simId || dataObj?.simuladoId || '').trim()
            if (id) set.add(id)
          }
        }
        const list = Array.from(set)
        setOwnedSimuladoIds(list)
        for (const id of list) {
          try { localStorage.setItem(`connekt_simulado_owned:${id}`, '1') } catch (_) {}
        }
      } catch (_) {
        if (!active) return
        setOwnedSimuladoIds([])
      }
    }
    run()
    return () => { active = false }
  }, [params.demo])

  useEffect(() => {
    try {
      const p = new URLSearchParams(locationSearch || '')
      const raw = String(p.get('tab') || p.get('aba') || '').trim().toLowerCase()
      if (!raw) return
      const next = raw === 'inbox' ? 'Inbox' : raw === 'simulados' ? 'Simulados' : null
      if (!next) return
      setActiveTab((prev) => (prev === next ? prev : next))
    } catch (_) {}
  }, [locationSearch])

  const setTabAndUrl = (next) => {
    setActiveTab(next)
    try {
      const u = new URL(window.location.href)
      u.searchParams.set('tab', next === 'Inbox' ? 'inbox' : 'simulados')
      window.history.replaceState({}, '', `${u.pathname}${u.search}${u.hash}`)
      window.dispatchEvent(new PopStateEvent('popstate'))
    } catch (_) {}
  }

  useEffect(() => {
    let active = true
    const run = async () => {
      setLoading(true)
      try {
        if (!params.simId) {
          if (active) setSimulado(null)
          return
        }
        if (!user?.id) {
          if (params.demo) {
            if (active) {
              setSimulado({
                id: params.simId,
                title: 'Nome do simulado',
                cover_image_url: '/resposta correta.png',
                is_paid: true,
              })
            }
          } else if (active) {
            setSimulado(null)
          }
          return
        }
        const pid = String(activeProducerUserId || '').trim()
        const token = (await supabase.auth.getSession().catch(() => ({ data: null })))?.data?.session?.access_token || ''
        if (pid && token) {
          try {
            const r = await fetch(`/api/producer?type=simulado&producerId=${encodeURIComponent(pid)}&simId=${encodeURIComponent(params.simId)}`, {
              headers: { Authorization: `Bearer ${token}` },
            })
            const body = await r.json().catch(() => ({}))
            if (!active) return
            if (r.ok && body?.data) {
              setSimulado(body.data)
              return
            }
          } catch (_) {}
        }
        const { data } = await supabase.from('simulados').select('*').eq('id', params.simId).maybeSingle()
        if (!active) return
        setSimulado(data || null)
      } catch (_) {
        if (active) setSimulado(null)
      } finally {
        if (active) setLoading(false)
      }
    }
    run()
    return () => {
      active = false
    }
  }, [params.simId, params.demo, user?.id, activeProducerUserId])

  useEffect(() => {
    let active = true
    const run = async () => {
      if (params.demo) {
        if (active) {
          setOtherSimulados([])
          setOthersLoading(false)
        }
        return
      }
      const pid = String(activeProducerUserId || '').trim()
      if (!pid || !user?.id) {
        if (active) {
          setOtherSimulados([])
          setOthersLoading(false)
        }
        return
      }
      setOthersLoading(true)
      try {
        const token = (await supabase.auth.getSession().catch(() => ({ data: null })))?.data?.session?.access_token || ''
        if (!token) throw new Error('missing_token')
        const r = await fetch(`/api/producer?type=simulados&producerId=${encodeURIComponent(pid)}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const body = await r.json().catch(() => ({}))
        if (!active) return
        if (!r.ok) throw new Error(body?.error || 'fetch_failed')
        const list = Array.isArray(body?.data) ? body.data : []
        const currentId = String(params.simId || '').trim()
        const mapped = list
          .filter((s) => String(s?.id || '') && String(s.id) !== currentId)
          .map((s) => {
            const id = String(s.id)
            const settings = (s.settings && typeof s.settings === 'object') ? s.settings : null
            const subtitle = String(s.description || settings?.description || '').trim()
            const cats = Array.isArray(settings?.categories) ? settings.categories : []
            const progressKey = `connekt_simulado_progress:${id}`
            let approval = 0
            try { approval = Number(localStorage.getItem(progressKey) || 0) || 0 } catch (_) { approval = 0 }
            const availability = s.availability_date ? new Date(String(s.availability_date)) : null
            const status = availability && !Number.isNaN(availability.getTime()) && availability.getTime() > Date.now() ? 'Agendado' : 'Publicado'
            return {
              id,
              title: String(s.title || 'Simulado'),
              subtitle: subtitle || 'Simulado para testar seus conhecimentos.',
              categories: cats,
              status,
              approval,
              is_paid: s.is_paid,
              price: s.price,
              imageUrl: String(s.cover_image_url || s.coverImageUrl || '/icone img simulado.png'),
            }
          })
        setOtherSimulados(mapped)
      } catch (_) {
        if (active) setOtherSimulados([])
      } finally {
        if (active) setOthersLoading(false)
      }
    }
    run()
    return () => { active = false }
  }, [params.demo, params.simId, activeProducerUserId, user?.id])

  const title = simulado?.title || 'Simulado'
  const description = useMemo(() => {
    const settings = simulado?.settings && typeof simulado.settings === 'object' ? simulado.settings : null
    const rawDesc = String(simulado?.description || settings?.description || '').trim()
    if (rawDesc) return rawDesc

    const paid = Boolean(simulado?.is_paid) || Math.max(0, Number(simulado?.price || 0)) > 0
    const durationMin = Number(simulado?.duration_minutes || simulado?.durationMinutes || 0) || 0
    const maxGrade = Number(simulado?.max_grade || simulado?.maxGrade || 0) || 0
    const categories = Array.isArray(settings?.categories) ? settings.categories : []
    const categoryText = categories.filter(Boolean).slice(0, 3).join(', ')

    const parts = [
      'Teste seus conhecimentos com um simulado completo, com tempo e pontuação para medir sua evolução.',
      'Ao final, confira seu aproveitamento e revise as respostas corretas.',
    ]
    if (paid) parts.push('Este simulado é pago.')
    if (durationMin > 0) parts.push(`Duração estimada: ${durationMin} min.`)
    if (maxGrade > 0) parts.push(`Pontuação máxima: ${maxGrade}.`)
    if (categoryText) parts.push(`Categorias: ${categoryText}.`)
    return parts.join(' ')
  }, [simulado])
  const demoSuffix = params.demo ? '&demo=1' : ''
  const currentSimId = String(params.simId || '').trim()
  const progressKey = currentSimId ? `connekt_simulado_progress:${currentSimId}` : ''
  const ownedKey = currentSimId ? `connekt_simulado_owned:${currentSimId}` : ''
  const [ownershipTick, setOwnershipTick] = useState(0)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const [checkoutPopupOpen, setCheckoutPopupOpen] = useState(false)
  const [checkoutPopupUrl, setCheckoutPopupUrl] = useState('')
  const [verifyLoading, setVerifyLoading] = useState(false)
  const progressValue = useMemo(() => {
    const n = Number(safeLsGet(progressKey) || 0)
    return Number.isFinite(n) ? n : 0
  }, [progressKey, ownershipTick])
  const simAccessMode = useMemo(() => {
    const settings = simulado?.settings && typeof simulado.settings === 'object' ? simulado.settings : {}
    const raw = String(settings?.accessMode || settings?.access_mode || '').trim()
    if (raw === 'paid' || raw === 'free' || raw === 'course_students_free') return raw
    const paid = Boolean(simulado?.is_paid) || Math.max(0, Number(simulado?.price || 0)) > 0
    return paid ? 'paid' : 'free'
  }, [simulado])
  const simPriceValue = useMemo(() => {
    const n = Math.max(0, Number(simulado?.price || 0))
    return Number.isFinite(n) ? n : 0
  }, [simulado])
  const hasCourseEntitlementForSimulado = useMemo(() => {
    const settings = simulado?.settings && typeof simulado.settings === 'object' ? simulado.settings : {}
    const idsRaw = Array.isArray(settings?.courseIds) ? settings.courseIds : (Array.isArray(simulado?.course_ids) ? simulado.course_ids : [])
    const ids = (Array.isArray(idsRaw) ? idsRaw : []).map((v) => String(v || '').trim()).filter(Boolean)
    for (const cid of ids) {
      if (safeLsGet(`connekt_course_owned:${cid}`) === '1') return true
    }
    return false
  }, [simulado, ownershipTick])
  const freeForUser = simAccessMode === 'free' || (simAccessMode === 'course_students_free' && hasCourseEntitlementForSimulado)
  const isOwnedSimulado = freeForUser || safeLsGet(ownedKey) === '1' || ownedSimuladoIdSet.has(currentSimId)
  const isRestrictedCourseOnly = simAccessMode === 'course_students_free' && !hasCourseEntitlementForSimulado && simPriceValue <= 0
  const canBuySimulado = !isOwnedSimulado && !isRestrictedCourseOnly && simAccessMode !== 'free' && simPriceValue > 0
  const isPausedSimulado = isOwnedSimulado && progressValue > 0 && progressValue < 100
  const finishKey = currentSimId ? `connekt_simulado_finish_${currentSimId}` : ''
  const hasFinishedSimulado = useMemo(() => {
    if (!finishKey) return false
    try { return !!localStorage.getItem(finishKey) } catch (_) { return false }
  }, [finishKey, ownershipTick])

  const availabilityWindow = useMemo(() => {
    if (params.demo) return { beforeStart: false, afterEnd: false }
    const parseStartMs = (v) => {
      const s = String(v || '').trim()
      if (!s) return null
      const t = new Date(s).getTime()
      if (!Number.isFinite(t)) return null
      return t
    }
    const parseEndMsInclusive = (v) => {
      const s = String(v || '').trim()
      if (!s) return null
      const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
      if (m) {
        const y = Number(m[1])
        const mo = Number(m[2])
        const d = Number(m[3])
        if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return null
        return Date.UTC(y, mo - 1, d, 23, 59, 59, 999)
      }
      const t = new Date(s).getTime()
      if (!Number.isFinite(t)) return null
      return t
    }
    const startMs = parseStartMs(simulado?.availability_date)
    const endIso =
      (typeof simulado?.settings?.availabilityEndDate === 'string' ? simulado.settings.availabilityEndDate : null)
      || (typeof simulado?.settings?.availability_end_date === 'string' ? simulado.settings.availability_end_date : null)
      || null
    const endMs = parseEndMsInclusive(endIso)
    const now = Date.now()
    return {
      beforeStart: startMs != null ? now < startMs : false,
      afterEnd: endMs != null ? now > endMs : false,
    }
  }, [params.demo, simulado])

  useEffect(() => {
    let active = true
    const run = async () => {
      if (params.demo) return
      if (!user?.id) return
      if (!currentSimId) return
      if (!simulado) return
      if (isOwnedSimulado) return
      if (!canBuySimulado) return
      const simTitle = String(simulado?.title || '').trim()
      if (!simTitle) return
      try {
        const token = (await supabase.auth.getSession().catch(() => ({ data: null })))?.data?.session?.access_token || ''
        if (!token) return
        const { data, error } = await supabase
          .from('notifications')
          .select('type,entity_type,entity_id,entity_name,data,created_at')
          .eq('type', 'purchase_confirmed')
          .order('created_at', { ascending: false })
          .limit(500)
        if (!active) return
        if (error) throw error
        const normalize = (v) => String(v || '').trim().toLowerCase()
        const targetTitle = normalize(simTitle)
        for (const row of Array.isArray(data) ? data : []) {
          const entityType = normalize(row?.entity_type)
          const entityId = String(row?.entity_id || '').trim()
          const entityName = normalize(row?.entity_name)
          const dataObj = row?.data && typeof row.data === 'object' ? row.data : null
          const dataType = normalize(dataObj?.type)
          const dataSimId = String(dataObj?.simId || dataObj?.simuladoId || '').trim()
          if (entityType === 'simulado' && (entityId === currentSimId || dataSimId === currentSimId)) {
            try { localStorage.setItem(ownedKey, '1') } catch (_) {}
            setOwnershipTick((v) => v + 1)
            return
          }
          if (dataType === 'simulado' && dataSimId === currentSimId) {
            try { localStorage.setItem(ownedKey, '1') } catch (_) {}
            setOwnershipTick((v) => v + 1)
            return
          }
          if (entityName && entityName === targetTitle) {
            try { localStorage.setItem(ownedKey, '1') } catch (_) {}
            setOwnershipTick((v) => v + 1)
            return
          }
        }
      } catch (_) {}
    }
    run()
    return () => { active = false }
  }, [params.demo, user?.id, currentSimId, simulado?.id, simulado?.title, canBuySimulado, isOwnedSimulado, ownedKey])

  const primaryCtaLabel = (() => {
    if (loading) return 'Carregando...'
    if (checkoutLoading) return 'Abrindo checkout...'
    if (verifyLoading) return 'Verificando pagamento...'
    if (!currentSimId) return 'Selecione um simulado'
    if (!simulado && !params.demo) return 'Simulado não encontrado'
    if (!isOwnedSimulado && isRestrictedCourseOnly) return 'Apenas alunos do curso'
    if (!isOwnedSimulado && canBuySimulado) return 'Comprar simulado'
    if (availabilityWindow.beforeStart) return 'Agendado'
    if (availabilityWindow.afterEnd) return hasFinishedSimulado ? 'Ver resultado' : 'Encerrado'
    if (isPausedSimulado) return 'Voltar para o simulado'
    return 'Fazer simulado'
  })()
  const primaryCtaDisabled =
    loading
    || checkoutLoading
    || verifyLoading
    || !currentSimId
    || (!params.demo && !simulado)
    || availabilityWindow.beforeStart
    || (availabilityWindow.afterEnd && !hasFinishedSimulado)
    || isRestrictedCourseOnly
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/aluno/simulados/acesso'
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const openCheckoutUrl = (url) => {
    const u = String(url || '').trim()
    if (!u) return false
    setCheckoutPopupUrl(u)
    setCheckoutPopupOpen(true)
    return true
  }

  const closeCheckoutPopup = () => {
    setCheckoutPopupOpen(false)
    try { window.setTimeout(() => setCheckoutPopupUrl(''), 150) } catch (_) { setCheckoutPopupUrl('') }
  }

  const startSimuladoCheckout = async () => {
    if (!currentSimId) return
    setCheckoutError('')
    if (isRestrictedCourseOnly) {
      setCheckoutError('Este simulado está disponível apenas para alunos dos cursos vinculados.')
      return
    }
    if (!canBuySimulado) {
      setCheckoutError('Este simulado não está à venda no momento.')
      return
    }
    setCheckoutLoading(true)
    try {
      const token = (await supabase.auth.getSession().catch(() => ({ data: null })))?.data?.session?.access_token || ''
      if (!token) {
        setCheckoutError('Faça login para comprar.')
        return
      }
      const r = await fetch('/api/simulado-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ simId: currentSimId }),
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) {
        try { preOpened && preOpened.close && preOpened.close() } catch (_) {}
        const msg = String(body?.message || body?.error || '').trim()
        const hint = String(body?.hint || '').trim()
        setCheckoutError(msg ? (hint ? `${msg} ${hint}` : msg) : 'Não foi possível abrir o checkout.')
        return
      }
      const checkoutUrl = String(body?.checkout_url || '').trim()
      const linkId = String(body?.link_id || '').trim()
      if (linkId) safeLsSet(`connekt_simulado_pending_link:${currentSimId}`, linkId)
      if (!checkoutUrl) {
        setCheckoutError('Checkout indisponível.')
        return
      }
      openCheckoutUrl(checkoutUrl)
    } catch (_) {
      setCheckoutError('Erro ao abrir checkout.')
    } finally {
      setCheckoutLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    const run = async () => {
      if (params.demo) return
      if (!user?.id) return
      if (!currentSimId) return
      if (isOwnedSimulado) return

      const linkId = String(params.linkId || safeLsGet(`connekt_simulado_pending_link:${currentSimId}`) || '').trim()
      if (!linkId) return

      setVerifyLoading(true)
      try {
        if (!active) return
        const token = (await supabase.auth.getSession().catch(() => ({ data: null })))?.data?.session?.access_token || ''
        if (!token) return
        const r = await fetch(`/api/simulado-checkout-verify?simId=${encodeURIComponent(currentSimId)}&linkId=${encodeURIComponent(linkId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const body = await r.json().catch(() => ({}))
        if (!active) return
        if (r.ok && body?.paid === true) {
          safeLsSet(ownedKey, '1')
          safeLsSet(`connekt_simulado_pending_link:${currentSimId}`, '')
          setOwnershipTick((v) => v + 1)
          setCheckoutError('')
          closeCheckoutPopup()
          try {
            const u = new URL(window.location.href)
            u.searchParams.delete('linkId')
            u.searchParams.delete('paymentLinkId')
            window.history.replaceState({}, '', u.toString())
            window.dispatchEvent(new PopStateEvent('popstate'))
          } catch (_) {}
        }
      } catch (_) {
      } finally {
        if (active) setVerifyLoading(false)
      }
    }
    run()
    return () => { active = false }
  }, [params.demo, params.linkId, user?.id, currentSimId, isOwnedSimulado, ownedKey])

  useEffect(() => {
    if (!checkoutPopupOpen) return
    if (isOwnedSimulado) closeCheckoutPopup()
  }, [checkoutPopupOpen, isOwnedSimulado])

  const demoCards = useMemo(() => ([
    { id: 's1', title: 'Nome do simulado', subtitle: 'Simulado para testar seus conhecimentos.', categories: [], status: 'Publicado', approval: 60, is_paid: false, price: 0, imageUrl: '/icone img simulado.png' },
    { id: 's2', title: 'Nome do simulado', subtitle: 'Simulado para testar seus conhecimentos.', categories: [], status: 'Publicado', approval: 60, is_paid: true, price: 49.9, imageUrl: '/icone img simulado.png' },
    { id: 's3', title: 'Nome do simulado', subtitle: 'Simulado para testar seus conhecimentos.', categories: [], status: 'Publicado', approval: 60, is_paid: false, price: 0, imageUrl: '/icone img simulado.png' },
    { id: 's4', title: 'Nome do simulado', subtitle: 'Simulado para testar seus conhecimentos.', categories: [], status: 'Publicado', approval: 60, is_paid: true, price: 29.9, imageUrl: '/icone img simulado.png' },
  ]), [])

  useEffect(() => {
    if (!mobileNavOpen) return
    const prev = document?.body?.style?.overflow
    if (document?.body?.style) document.body.style.overflow = 'hidden'
    return () => {
      if (document?.body?.style) document.body.style.overflow = prev || ''
    }
  }, [mobileNavOpen])

  const simuladosForCards = params.demo ? demoCards : otherSimulados

  const updateOtherScrollControls = () => {
    const el = otherScrollRef.current
    if (!el) {
      setCanScrollOtherLeft(false)
      setCanScrollOtherRight(false)
      return
    }
    const left = el.scrollLeft || 0
    const maxLeft = Math.max(0, (el.scrollWidth || 0) - (el.clientWidth || 0))
    setCanScrollOtherLeft(left > 2)
    setCanScrollOtherRight(left < maxLeft - 2)
  }

  const scrollOtherBy = (dir) => {
    const el = otherScrollRef.current
    if (!el) return
    const delta = 272
    el.scrollBy({ left: dir * delta, behavior: 'smooth' })
  }

  useEffect(() => {
    updateOtherScrollControls()
    const onResize = () => updateOtherScrollControls()
    window.addEventListener('resize', onResize)
    const t = window.setTimeout(() => updateOtherScrollControls(), 0)
    return () => {
      window.removeEventListener('resize', onResize)
      window.clearTimeout(t)
    }
  }, [simuladosForCards?.length])

  const navigateMenuItem = (path) => {
    if (!params.demo) {
      navigateTo(path)
      return
    }
    try {
      const url = new URL(path, window.location.origin)
      url.searchParams.set('demo', '1')
      navigateTo(`${url.pathname}${url.search}`)
    } catch (_) {
      const sep = String(path || '').includes('?') ? '&' : '?'
      navigateTo(`${path}${sep}demo=1`)
    }
  }

  return (
    <div className="min-h-screen lg:h-screen w-full bg-[#EEF2FF] flex lg:overflow-hidden">
      {mobileNavOpen ? (
        <div className="lg:hidden fixed inset-0 z-[70]">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Fechar menu"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-[280px] max-w-[86vw] flex flex-col" style={{ background: 'linear-gradient(180deg, var(--brand-sidebar-from) 0%, var(--brand-sidebar-to) 100%)' }}>
            <div className="flex items-center justify-between px-4 py-5">
              <BrandLogo variant="sidebar" className="w-[110px] h-auto" />
              <button
                type="button"
                className="h-10 w-10 rounded-full bg-white/10 text-white flex items-center justify-center"
                aria-label="Fechar"
                onClick={() => setMobileNavOpen(false)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="h-px mx-6" style={{ backgroundColor: 'rgb(47, 58, 86)' }} />
            <nav className="flex-1 overflow-y-auto px-4 py-5 space-y-6 scrollbar-hide">
              {ALUNO_NAV_SECTIONS.map((section, idx) => (
                <div key={`${section.title}-${idx}`}>
                  <div className="text-[11px] font-semibold text-white/50 uppercase tracking-wider px-2 mb-3">{section.title}</div>
                  <div className="space-y-1">
                    {section.items.map((item) => {
                      const itemPathname = String(item.path || '').split('?')[0] || '/'
                      const isSimuladosItem = String(item.label || '').toLowerCase() === 'simulados'
                      const isActive = isSimuladosItem
                        ? (currentPath.startsWith('/aluno/simulados') || currentPath === '/aluno/reposta-correta-simulado')
                        : (itemPathname === '/aluno' ? (currentPath === '/aluno' || currentPath.startsWith('/aluno/aula') || currentPath.startsWith('/aluno/curso')) : currentPath === itemPathname)

                      return (
                        <button
                          key={item.path}
                          type="button"
                          onClick={() => {
                            setMobileNavOpen(false)
                            navigateMenuItem(item.path)
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[13px] font-semibold transition-colors ${isActive ? 'brand-bg text-white' : 'text-white/80 hover:bg-white/10'}`}
                        >
                          <item.Icon className="w-5 h-5" />
                          <span className="truncate">{item.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </div>
        </div>
      ) : null}

      <aside className="hidden lg:flex w-[260px] h-screen flex-col" style={{ background: 'linear-gradient(180deg, var(--brand-sidebar-from) 0%, var(--brand-sidebar-to) 100%)' }}>
        <div className="flex justify-center py-5">
          <BrandLogo variant="sidebar" className="w-[119px] h-[35px]" />
        </div>
        <div className="h-px mx-10" style={{ backgroundColor: 'rgb(47, 58, 86)' }} />
        <nav className="flex-1 overflow-y-auto px-4 py-5 space-y-6 scrollbar-hide">
          {ALUNO_NAV_SECTIONS.map((section, idx) => (
            <div key={`${section.title}-${idx}`}>
              <div className="text-[11px] font-semibold text-white/50 uppercase tracking-wider px-2 mb-3">{section.title}</div>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const itemPathname = String(item.path || '').split('?')[0] || '/'
                  const isSimuladosItem = String(item.label || '').toLowerCase() === 'simulados'
                  const isActive = isSimuladosItem
                    ? (currentPath.startsWith('/aluno/simulados') || currentPath === '/aluno/reposta-correta-simulado')
                    : (itemPathname === '/aluno' ? (currentPath === '/aluno' || currentPath.startsWith('/aluno/aula') || currentPath.startsWith('/aluno/curso')) : currentPath === itemPathname)

                  return (
                    <button
                      key={item.path}
                      type="button"
                      onClick={() => {
                        navigateMenuItem(item.path)
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[13px] font-semibold transition-colors ${isActive ? 'brand-bg text-white' : 'text-white/80 hover:bg-white/10'}`}
                    >
                      <item.Icon className="w-5 h-5" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex-1 min-h-screen lg:h-screen flex flex-col overflow-hidden">
        <button
          type="button"
          className="lg:hidden fixed top-3 left-3 z-[60] h-10 w-10 rounded-full bg-white border border-[#E3E4E5] flex items-center justify-center shadow-sm"
          aria-label="Abrir menu"
          onClick={() => setMobileNavOpen(true)}
        >
          <Menu className="w-5 h-5 text-[#22252B]" />
        </button>
        <Header />
        <main className="flex-1 overflow-y-auto">
          <Helmet>
            <title>{`Connekt - ${title}`}</title>
          </Helmet>

          <div className="px-8 py-7">
            <div className="max-w-[1180px] mx-auto">
              <div className="relative overflow-hidden rounded-[12px] bg-white border border-[#E3E4E5]">
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      'radial-gradient(1200px 420px at 35% 40%, rgba(0,71,187,0.10) 0%, rgba(238,242,255,0.75) 42%, rgba(255,255,255,1) 70%)',
                  }}
                />
                <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-8 px-10 py-10 items-center">
                  <div className="max-w-[420px]">
                    <img src="/logo connekt.png" alt="Connekt" className="w-[150px] h-auto" />
                    <div className="mt-4 text-[12px] text-[#737780] leading-[18px]">
                      {description}
                    </div>
                    <button
                      type="button"
                      className="mt-5 h-[36px] px-5 bg-[#0047BB] text-white rounded-[4px] text-[12px] font-semibold hover:bg-[#003da0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => {
                        const simId = currentSimId || 's1'
                        if (!simId) return
                        if (!isOwnedSimulado && isPaidSimulado) {
                          startSimuladoCheckout()
                          return
                        }
                        if (availabilityWindow.afterEnd && hasFinishedSimulado) {
                          navigateTo(`/aluno/simulados/resultado?simId=${encodeURIComponent(simId)}${demoSuffix}`)
                          return
                        }
                        const allowRepeat =
                          typeof simulado?.settings?.allowRepeat === 'boolean'
                            ? Boolean(simulado.settings.allowRepeat)
                            : (typeof simulado?.settings?.allow_repeat === 'boolean' ? Boolean(simulado.settings.allow_repeat) : true)
                        try {
                          localStorage.setItem(`connekt_simulado_allowRepeat:${simId}`, allowRepeat ? '1' : '0')
                          const startRaw = String(simulado?.availability_date || '').trim()
                          const endRaw =
                            (typeof simulado?.settings?.availabilityEndDate === 'string' ? simulado.settings.availabilityEndDate : null)
                            || (typeof simulado?.settings?.availability_end_date === 'string' ? simulado.settings.availability_end_date : null)
                            || ''
                          localStorage.setItem(`connekt_simulado_windowStart:${simId}`, startRaw)
                          localStorage.setItem(`connekt_simulado_windowEnd:${simId}`, String(endRaw || '').trim())
                          const finishKey = `connekt_simulado_finish_${simId}`
                          const hasFinish = !!localStorage.getItem(finishKey)
                          if (hasFinish && !allowRepeat) {
                            navigateTo(`/aluno/simulados/resultado?simId=${encodeURIComponent(simId)}${demoSuffix}`)
                            return
                          }
                          localStorage.removeItem(`connekt_simulado_pause_${simId}`)
                          if (allowRepeat) localStorage.removeItem(finishKey)
                          localStorage.setItem(`connekt_simulado_progress:${simId}`, '0')
                        } catch (_) {}
                        navigateTo(`/aluno/reposta-correta-simulado?simId=${encodeURIComponent(simId)}${demoSuffix}`)
                      }}
                      disabled={primaryCtaDisabled}
                    >
                      {primaryCtaLabel}
                    </button>
                    <div className="mt-3 text-[10px] text-[#9AA0AA]">{loading ? 'Carregando...' : (checkoutError || '')}</div>
                  </div>

                  <div className="relative h-[300px] lg:h-[340px]">
                    <img
                      src="/tela simulados aproveitamento.png"
                      alt=""
                      className="absolute right-[-10px] top-6 w-[520px] max-w-none rounded-[10px] shadow-[0_18px_40px_rgba(0,0,0,0.12)] border border-[#E3E4E5]"
                      style={{ transform: 'rotate(4deg)' }}
                    />
                    <img
                      src="/Simulados aproveitamento.png"
                      alt=""
                      className="absolute right-[-58px] top-3 w-[560px] max-w-none rounded-[10px] shadow-[0_18px_40px_rgba(0,0,0,0.10)] border border-[#E3E4E5]"
                      style={{ transform: 'rotate(10deg)', opacity: 0.92 }}
                    />
                    <img
                      src="/Simulados aproveitamento.png"
                      alt=""
                      className="absolute right-[-96px] top-0 w-[600px] max-w-none rounded-[10px] shadow-[0_18px_40px_rgba(0,0,0,0.08)] border border-[#E3E4E5]"
                      style={{ transform: 'rotate(16deg)', opacity: 0.65 }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <div className="flex items-center gap-6 border-b border-[#E3E4E5]">
                  {['Simulados', 'Inbox'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={`py-3 text-[11px] font-semibold ${activeTab === t ? 'text-[#0047BB] border-b-2 border-[#0047BB]' : 'text-[#737780]'}`}
                      onClick={() => setTabAndUrl(t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                {activeTab === 'Inbox' ? (
                  <div className="mt-5">
                    <div className="rounded-[10px] border border-[#E3E4E5] bg-white p-4">
                      <div className="text-[12px] font-semibold text-[#22252B]">Inbox do simulado</div>
                      <div className="mt-1 text-[11px] text-[#737780] leading-[16px]">
                        Use este espaço para tirar dúvidas sobre este simulado e conversar com o professor. Suas mensagens ficam organizadas por simulado e você pode acompanhar as respostas aqui.
                      </div>
                      <div className="mt-2 text-[10px] text-[#9AA0AA]">
                        Dica: escreva sua dúvida com o máximo de detalhes possível (questão, alternativa e por que você ficou em dúvida).
                      </div>
                    </div>
                    <AlunoInboxThread
                      user={user}
                      studentName={studentName}
                      threadKey={`simulado:${currentSimId || 'geral'}`}
                      title="Inbox"
                      itemLabel="Mensagens"
                      submitLabel="Enviar"
                      successTitle="Mensagem enviada"
                      placeholder="Digite sua mensagem para o professor"
                      producerId={activeProducerUserId}
                    />
                  </div>
                ) : (
                  <div className="mt-5">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-[6px] bg-[#EEF2FF] flex items-center justify-center">
                          <img src="/icons/union.svg" alt="" className="w-4 h-4" />
                        </div>
                        <div className="text-[12px] font-semibold text-[#22252B]">Simulados</div>
                      </div>
                      {Array.isArray(simuladosForCards) && simuladosForCards.length > 4 ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="w-9 h-9 rounded-full border border-[#E3E4E5] bg-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                            onClick={() => scrollOtherBy(-1)}
                            disabled={!canScrollOtherLeft}
                            aria-label="Simulados anteriores"
                          >
                            <ChevronLeft className="w-4 h-4 text-[#737780]" />
                          </button>
                          <button
                            type="button"
                            className="w-9 h-9 rounded-full border border-[#E3E4E5] bg-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                            onClick={() => scrollOtherBy(1)}
                            disabled={!canScrollOtherRight}
                            aria-label="Próximos simulados"
                          >
                            <ChevronRight className="w-4 h-4 text-[#737780]" />
                          </button>
                        </div>
                      ) : null}
                    </div>

                    <div
                      ref={otherScrollRef}
                      onScroll={updateOtherScrollControls}
                      className="mt-4 flex gap-5 overflow-x-auto pt-2 pb-6 px-1 scrollbar-hide"
                    >
                      {simuladosForCards.map((s) => (
                        <div
                          key={s.id}
                          className="cursor-pointer flex-shrink-0 w-[252px]"
                          onClick={() => {
                            const qs = new URLSearchParams()
                            qs.set('simId', String(s.id))
                            if (params.demo) qs.set('demo', '1')
                            navigateTo(`/aluno/simulados/acesso?${qs.toString()}`)
                          }}
                        >
                          <SimuladoCard
                            title={s.title}
                            subtitle={s.subtitle || 'Simulado para testar seus conhecimentos.'}
                            categories={s.categories}
                            status={s.status}
                            approval={s.approval}
                            isPaid={s.is_paid ?? s.isPaid}
                            price={s.price}
                            imageUrl={s.imageUrl || '/icone img simulado.png'}
                            isOwned={(() => {
                              const paid = typeof (s?.is_paid ?? s?.isPaid) === 'boolean' ? (s.is_paid ?? s.isPaid) : Math.max(0, Number(s?.price || 0)) > 0
                              if (!paid) return false
                              const sid = String(s?.id || '').trim()
                              return (sid ? safeLsGet(`connekt_simulado_owned:${sid}`) === '1' : false) || (sid ? ownedSimuladoIdSet.has(sid) : false)
                            })()}
                          />
                        </div>
                      ))}
                    </div>
                    {!params.demo && othersLoading ? (
                      <div className="mt-3 text-[12px] text-[#737780]">Carregando simulados…</div>
                    ) : null}
                    {!params.demo && !othersLoading && otherSimulados.length === 0 ? (
                      <div className="mt-3 text-[12px] text-[#737780]">Nenhum outro simulado disponível.</div>
                    ) : null}
                  </div>
                )}
              </div>

            </div>
          </div>

          <div className="mt-10">
            <CourseFooter />
          </div>

          <CheckoutPopup
            open={checkoutPopupOpen}
            url={checkoutPopupUrl}
            title="Pagamento"
            footerText="Após o pagamento, aguarde a confirmação automática."
            onClose={closeCheckoutPopup}
          />
        </main>
      </div>
    </div>
  )
}
