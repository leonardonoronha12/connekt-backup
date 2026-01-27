import React, { useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Database, GraduationCap, Menu, Monitor, MoreVertical, Settings, X } from 'lucide-react'
import Header from '@/components/Header'
import CourseFooter from '@/components/CourseFooter'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/SupabaseAuthContext'

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

function SimuladoCard({ title, status, approval, isPaid, price }) {
  const p = Math.max(0, Math.min(100, Number(approval || 0)))
  const paid =
    typeof isPaid === 'boolean'
      ? isPaid
      : Math.max(0, Number(price || 0)) > 0
  return (
    <div className="bg-white border border-[#E3E4E5] rounded-[8px] w-full h-[200px] px-4 py-3 flex flex-col">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <img src="/icone img simulado.png" alt="" className="w-[54px] h-[54px] rounded-[8px] object-cover" />
          <div className="flex flex-col">
            <div className="text-[12px] font-semibold text-[#1E1B39] font-inter leading-[18px]">{title}</div>
            <div className="text-[10px] text-[#9291A5] font-inter leading-[14px]">Descrição breve do simulado</div>
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
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className="inline-flex items-center h-[18px] px-2 rounded-[4px] bg-[#EEF2FF] text-[#0047BB] text-[10px] font-medium">Categoria</span>
        <span className="inline-flex items-center h-[18px] px-2 rounded-[4px] bg-[#EEF2FF] text-[#0047BB] text-[10px] font-medium">Categoria</span>
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
  const [loading, setLoading] = useState(true)
  const [simulado, setSimulado] = useState(null)

  const params = useMemo(() => {
    try {
      const p = new URLSearchParams(window.location.search || '')
      return {
        simId: p.get('simId') || '',
        demo: p.get('demo') === '1',
      }
    } catch (_) {
      return { simId: '', demo: false }
    }
  }, [])

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
  }, [params.simId, params.demo, user?.id])

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
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/aluno/simulados/acesso'
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const demoCards = useMemo(() => ([
    { id: 's1', title: 'Nome do simulado', status: 'Publicado', approval: 60, is_paid: false, price: 0 },
    { id: 's2', title: 'Nome do simulado', status: 'Publicado', approval: 60, is_paid: true, price: 49.9 },
    { id: 's3', title: 'Nome do simulado', status: 'Publicado', approval: 60, is_paid: false, price: 0 },
    { id: 's4', title: 'Nome do simulado', status: 'Publicado', approval: 60, is_paid: true, price: 29.9 },
  ]), [])

  useEffect(() => {
    if (!mobileNavOpen) return
    const prev = document?.body?.style?.overflow
    if (document?.body?.style) document.body.style.overflow = 'hidden'
    return () => {
      if (document?.body?.style) document.body.style.overflow = prev || ''
    }
  }, [mobileNavOpen])

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
                      className="mt-5 h-[36px] px-5 bg-[#0047BB] text-white rounded-[4px] text-[12px] font-semibold hover:bg-[#003da0] transition-colors"
                      onClick={() => {
                        const simId = params.simId || 's1'
                        navigateTo(`/aluno/reposta-correta-simulado?simId=${encodeURIComponent(simId)}${demoSuffix}`)
                      }}
                    >
                      Comprar simulado
                    </button>
                    <div className="mt-3 text-[10px] text-[#9AA0AA]">{loading ? 'Carregando...' : ''}</div>
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
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-[6px] bg-[#EEF2FF] flex items-center justify-center">
                    <img src="/icons/union.svg" alt="" className="w-4 h-4" />
                  </div>
                  <div className="text-[12px] font-semibold text-[#22252B]">Simulados</div>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  {demoCards.map((s) => (
                    <div
                      key={s.id}
                      className="cursor-pointer"
                      onClick={() => navigateTo(`/aluno/reposta-correta-simulado?simId=${encodeURIComponent(s.id)}${params.demo ? '&demo=1' : ''}`)}
                    >
                      <SimuladoCard title={s.title} status={s.status} approval={s.approval} isPaid={s.is_paid ?? s.isPaid} price={s.price} />
                    </div>
                  ))}
                </div>
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
