import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { ChevronLeft, ChevronRight, Database, GraduationCap, Menu, Monitor, MoreVertical, Settings, X } from 'lucide-react'
import Header from '@/components/Header'
import CourseFooter from '@/components/CourseFooter'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/SupabaseAuthContext'
import { useActiveProducerUserId } from '@/hooks/useActiveProducerUserId'

const navSections = [
  {
    title: 'MENU',
    items: [
      { label: 'Painel', Icon: GraduationCap, path: '/aluno' },
      { label: 'Simulados', Icon: Monitor, path: '/aluno/simulados' },
      { label: 'Banco de Questões', Icon: Database, path: '/banco-de-questoes' },
    ],
  },
  {
    title: 'GERAL',
    items: [
      { label: 'Configurações', Icon: Settings, path: '/aluno/configuracoes' },
    ],
  },
]

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
    <div className="bg-white border border-[#E3E4E5] rounded-[8px] w-full h-[200px] px-4 py-3 flex flex-col">
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
          <span className={`inline-flex items-center justify-center h-[18px] px-3 text-[10px] rounded-[54px] leading-none font-medium ${paid ? 'bg-[#FEF3C7] text-[#92400E]' : 'bg-[#EEF2FF] text-[#0047BB]'}`}>
            {paid ? 'Pago' : 'Gratuito'}
          </span>
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
  const [verifyLoading, setVerifyLoading] = useState(false)
  const progressValue = useMemo(() => {
    const n = Number(safeLsGet(progressKey) || 0)
    return Number.isFinite(n) ? n : 0
  }, [progressKey, ownershipTick])
  const isPaidSimulado = Boolean(simulado?.is_paid) || Math.max(0, Number(simulado?.price || 0)) > 0
  const isOwnedSimulado = !isPaidSimulado || safeLsGet(ownedKey) === '1'
  const isPausedSimulado = isOwnedSimulado && progressValue > 0 && progressValue < 100
  const primaryCtaLabel = (() => {
    if (loading) return 'Carregando...'
    if (checkoutLoading) return 'Abrindo checkout...'
    if (verifyLoading) return 'Verificando pagamento...'
    if (!currentSimId) return 'Selecione um simulado'
    if (!simulado && !params.demo) return 'Simulado não encontrado'
    if (!isOwnedSimulado && isPaidSimulado) return 'Comprar simulado'
    if (isPausedSimulado) return 'Voltar para o simulado'
    return 'Fazer simulado'
  })()
  const primaryCtaDisabled = loading || checkoutLoading || verifyLoading || !currentSimId || (!params.demo && !simulado)
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/aluno/simulados/acesso'
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const startSimuladoCheckout = async () => {
    if (!currentSimId) return
    setCheckoutError('')
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
      const w = window.open(checkoutUrl, '_blank', 'noopener')
      if (!w) {
        setCheckoutError('Seu navegador bloqueou a abertura do checkout. Permita pop-ups e tente novamente.')
      }
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
          <div className="absolute left-0 top-0 h-full w-[280px] max-w-[86vw] flex flex-col" style={{ background: 'linear-gradient(180deg, rgb(15, 6, 39) 0%, rgb(0, 0, 104) 100%)' }}>
            <div className="flex items-center justify-between px-4 py-5">
              <img src="/logo-expanded.svg" alt="Connekt" className="w-[110px] h-auto" />
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
              {navSections.map((section, idx) => (
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
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[13px] font-semibold transition-colors ${isActive ? 'bg-[#0047BB] text-white' : 'text-white/80 hover:bg-white/10'}`}
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

      <aside className="hidden lg:flex w-[260px] h-screen flex-col" style={{ background: 'linear-gradient(180deg, rgb(15, 6, 39) 0%, rgb(0, 0, 104) 100%)' }}>
        <div className="flex justify-center py-5">
          <img src="/logo-expanded.svg" alt="Connekt" className="w-[119px] h-[35px]" />
        </div>
        <div className="h-px mx-10" style={{ backgroundColor: 'rgb(47, 58, 86)' }} />
        <nav className="flex-1 overflow-y-auto px-4 py-5 space-y-6 scrollbar-hide">
          {navSections.map((section, idx) => (
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
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[13px] font-semibold transition-colors ${isActive ? 'bg-[#0047BB] text-white' : 'text-white/80 hover:bg-white/10'}`}
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
                  className="mt-4 flex gap-5 overflow-x-auto pb-2 scrollbar-hide"
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
                          return safeLsGet(`connekt_simulado_owned:${String(s?.id || '')}`) === '1'
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

            </div>
          </div>

          <div className="mt-10">
            <CourseFooter />
          </div>
        </main>
      </div>
    </div>
  )
}
