import React, { useEffect, useMemo, useState } from 'react'
import Header from '@/components/Header'
import { Database, FileText, GraduationCap, LayoutGrid, Menu, Monitor, Search, Settings, X } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { getActiveProducerUserId } from '@/services/producerScope'

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

export default function AlunoSimuladosPage() {
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/aluno/simulados'
  const [searchValue, setSearchValue] = useState('')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [simulados, setSimulados] = useState([])
  const [simuladosLoading, setSimuladosLoading] = useState(false)
  const isDemoStudent = (() => {
    try {
      const host = String(window.location.hostname || '').toLowerCase()
      const allowed = host === 'localhost' || host === '127.0.0.1'
      if (!allowed) return false
      const params = new URLSearchParams(window.location.search || '')
      if (params.get('demo') === '1') return true
      return String(localStorage.getItem('connekt_demo_student') || '') === '1'
    } catch (_) {
      return false
    }
  })()
  const activeProducerUserId = useMemo(() => {
    try { return getActiveProducerUserId() } catch (_) { return '' }
  }, [])
  const filteredSimulados = useMemo(() => {
    const q = String(searchValue || '').trim().toLowerCase()
    if (!q) return simulados
    return simulados.filter((s) => String(s?.title || '').toLowerCase().includes(q))
  }, [simulados, searchValue])

  useEffect(() => {
    let active = true
    const run = async () => {
      if (isDemoStudent) {
        if (!active) return
        setSimulados([])
        return
      }
      const pid = String(activeProducerUserId || '').trim()
      setSimuladosLoading(true)
      try {
        const token = (await supabase.auth.getSession().catch(() => ({ data: null })))?.data?.session?.access_token || ''
        if (!token || !pid) throw new Error('missing_scope')
        const r = await fetch(`/api/producer?type=simulados&producerId=${encodeURIComponent(pid)}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const body = await r.json().catch(() => ({}))
        if (!active) return
        if (!r.ok) throw new Error(body?.error || 'fetch_failed')
        setSimulados(Array.isArray(body?.data) ? body.data : [])
      } catch (_) {
        if (!active) return
        setSimulados([])
      } finally {
        if (active) setSimuladosLoading(false)
      }
    }
    run()
    return () => { active = false }
  }, [activeProducerUserId, isDemoStudent])

  useEffect(() => {
    if (!mobileNavOpen) return
    const prev = document?.body?.style?.overflow
    if (document?.body?.style) document.body.style.overflow = 'hidden'
    return () => {
      if (document?.body?.style) document.body.style.overflow = prev || ''
    }
  }, [mobileNavOpen])

  const navigateMenuItem = (path) => {
    if (!isDemoStudent) {
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

  const safeLsGet = (key) => {
    try { return String(localStorage.getItem(String(key || '')) || '') } catch (_) { return '' }
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
                      const isActive = itemPathname === '/aluno'
                        ? (currentPath === '/aluno' || currentPath.startsWith('/aluno/aula') || currentPath.startsWith('/aluno/curso'))
                        : (itemPathname === '/aluno/simulados' ? currentPath.startsWith('/aluno/simulados') || currentPath === '/aluno/reposta-correta-simulado' : currentPath === itemPathname)
                      return (
                        <button
                          key={item.path}
                          type="button"
                          onClick={() => {
                            setMobileNavOpen(false)
                            navigateMenuItem(item.path)
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[13px] font-semibold transition-colors ${
                            isActive ? 'bg-[#0047BB] text-white' : 'text-white/80 hover:bg-white/10'
                          }`}
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
                  const isActive = itemPathname === '/aluno'
                    ? (currentPath === '/aluno' || currentPath.startsWith('/aluno/aula') || currentPath.startsWith('/aluno/curso'))
                    : (itemPathname === '/aluno/simulados' ? currentPath.startsWith('/aluno/simulados') || currentPath === '/aluno/reposta-correta-simulado' : currentPath === itemPathname)
                  return (
                    <button
                      key={item.path}
                      type="button"
                      onClick={() => {
                        navigateMenuItem(item.path)
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[13px] font-semibold transition-colors ${
                        isActive ? 'bg-[#0047BB] text-white' : 'text-white/80 hover:bg-white/10'
                      }`}
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
          <div className="min-h-full bg-[#F5F6FA]">
            <div className="px-[22px] pt-12 pb-10">
              <div className="max-w-[1904px] mx-auto w-full">
                <div className="relative w-full max-w-[1076px] mx-auto">
                  <div className="relative pl-[42px] pr-[42px] pt-[22px] pb-[22px] bg-[#003a99] text-white rounded-[10px] shadow-lg overflow-hidden w-full h-fit flex flex-col">
                    <div className="relative z-10 h-fit flex flex-col gap-[22px]">
                      <div className="h-fit">
                        <h1 className="text-base sm:text-[18px] font-medium font-inter mb-0 h-[37px]">Simulados</h1>
                        <p className="text-sm sm:text-[16px] font-normal font-inter text-blue-100 mb-0 h-[30px]">Gerencie todos os simulados</p>
                      </div>
                    </div>

                    <div className="absolute right-6 top-1/2 -translate-y-1/2 z-50 pointer-events-none hidden sm:flex items-center gap-3">
                      <div className="h-11 w-11 rounded-[10px] bg-[#E051B3] flex items-center justify-center shadow-sm">
                        <FileText className="w-5 h-5 text-white" />
                      </div>
                      <div className="h-11 w-11 rounded-[10px] bg-[#3BC5BD] flex items-center justify-center shadow-sm">
                        <LayoutGrid className="w-5 h-5 text-white" />
                      </div>
                      <div className="h-11 w-11 rounded-[10px] bg-[#E5B800] flex items-center justify-center shadow-sm">
                        <Monitor className="w-5 h-5 text-white" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 w-full max-w-[1076px] mx-auto">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[14px] font-semibold text-[#22252B] font-inter">Simulados</div>
                      <div className="text-[12px] text-[#737780] font-inter">Todos os seus simulados</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#737780]" aria-hidden="true" />
                        <input
                          value={searchValue}
                          onChange={(e) => setSearchValue(e.target.value)}
                          className="h-[36px] w-[220px] rounded-[4px] border border-[#E3E4E5] bg-white pl-9 pr-3 text-[12px] outline-none focus:ring-1 focus:ring-[#0047BB]"
                          placeholder="Buscar simulado"
                        />
                      </div>
                      <button type="button" className="h-[36px] px-3 rounded-[4px] border border-[#E3E4E5] bg-white text-[12px] text-[#22252B] inline-flex items-center gap-2">
                        <img src="/Filtro simulados 1.png" alt="" className="w-4 h-4 object-contain" />
                        Filtrar
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 bg-white border border-[#E3E4E5] rounded-[10px] min-h-[520px] flex items-center justify-center">
                    {simuladosLoading ? (
                      <div className="text-[12px] text-[#737780]">Carregando…</div>
                    ) : filteredSimulados.length === 0 ? (
                      <div className="flex flex-col items-center text-center">
                        <img src="/icone backup simulados.png" alt="" className="w-[64px] h-[64px] object-contain opacity-60" />
                        <div className="mt-3 text-[12px] font-semibold text-[#22252B]">Nenhum simulado</div>
                        <div className="mt-1 text-[11px] text-[#737780] max-w-[260px]">Não encontramos nenhum simulado no momento</div>
                      </div>
                    ) : (
                      <div className="w-full h-full p-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                          {filteredSimulados.map((s) => {
                            const id = String(s?.id || '').trim()
                            const paid = Boolean(s?.is_paid) || Math.max(0, Number(s?.price || 0)) > 0
                            const owned = paid ? safeLsGet(`connekt_simulado_owned:${id}`) === '1' : true
                            const progress = Math.max(0, Math.min(100, Number(safeLsGet(`connekt_simulado_progress:${id}`) || 0)))
                            const priceValue = Number(s?.price || 0) || 0
                            const showPrice = paid && Number.isFinite(priceValue) && priceValue > 0
                            const priceText = (() => {
                              if (!showPrice) return ''
                              try { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(priceValue) } catch (_) { return `R$ ${priceValue.toFixed(2)}` }
                            })()
                            const settings = s?.settings && typeof s.settings === 'object' ? s.settings : null
                            const categories = Array.isArray(settings?.categories) ? settings.categories : []
                            const categoryLabel = String(categories?.[0] || 'Categoria')
                            return (
                              <div
                                key={id}
                                className="bg-white border border-[#E3E4E5] rounded-[4px] p-4 w-full h-[230px] flex flex-col flex-shrink-0 cursor-pointer"
                                onClick={() => {
                                  const qs = new URLSearchParams()
                                  qs.set('simId', id)
                                  if (isDemoStudent) qs.set('demo', '1')
                                  navigateTo(`/aluno/simulados/acesso?${qs.toString()}`)
                                }}
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex items-center gap-2">
                                    <img src={String(s?.cover_image_url || '').trim() || '/simulado-cover.svg'} alt="Simulado" className="w-[85px] h-[85px] rounded-md object-cover" />
                                  </div>
                                  <div className="flex flex-col items-end gap-4">
                                    <span className="inline-flex items-center justify-center w-[80px] h-[18px] px-3 text-[10px] rounded-[54px] leading-none font-medium bg-[#E9FFEF] text-[#06C270]">
                                      Publicado
                                    </span>
                                    <span className={`inline-flex items-center justify-center w-[80px] h-[18px] px-3 text-[10px] rounded-[54px] leading-none font-medium ${paid ? 'bg-[#FEF3C7] text-[#92400E]' : 'bg-[#EEF2FF] text-[#0047BB]'}`}>
                                      {paid ? 'Pago' : 'Gratuito'}
                                    </span>
                                    {paid && owned ? (
                                      <span className="inline-flex items-center justify-center w-[80px] h-[18px] px-3 text-[10px] rounded-[54px] leading-none font-medium bg-[#E9FFEF] text-[#06C270]">
                                        Adquirido
                                      </span>
                                    ) : null}
                                    {showPrice ? (
                                      <span className="inline-flex items-center justify-center w-[80px] h-[18px] px-3 text-[10px] rounded-[54px] leading-none font-medium bg-[#FEF3C7] text-[#92400E]">
                                        {priceText}
                                      </span>
                                    ) : null}
                                  </div>
                                </div>

                                <div className="mt-0">
                                  <div className="flex items-center justify-between">
                                    <h4 className="text-[12px] font-medium text-[#1E1B39] font-inter">{String(s?.title || 'Simulado')}</h4>
                                  </div>
                                  <p className="text-[10px] text-[#9291A5] font-inter font-[400] mt-1">Simulado do curso</p>
                                </div>

                                <div className="mt-3 flex items-center gap-2">
                                  <span
                                    className="inline-flex items-center gap-1 text-[12px] font-normal h-[20px] px-2 py-0 rounded-[4px]"
                                    style={{ backgroundColor: 'rgba(173, 137, 247, 0.1)', color: 'rgb(34, 37, 43)' }}
                                  >
                                    <span className="leading-none text-[7px] text-[#AD89F7]">🟪</span>
                                    <span className="text-[10px] text-[#22252B] font-normal not-italic">{categoryLabel}</span>
                                  </span>
                                </div>

                                <div className="mt-4 flex items-center justify-between">
                                  <div className="flex flex-col w-full">
                                    <span className="text-[12px] text-[#1E1B39] font-inter font-bold">Aprovação (%)</span>
                                  </div>
                                  <div className="flex items-center gap-1 text-[#0047BB]">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0047BB" strokeWidth="2">
                                      <circle cx="12" cy="12" r="10" opacity="0.3"></circle>
                                      <path d="M12 2 a10 10 0 0 1 0 20"></path>
                                    </svg>
                                    <span className="text-[12px] font-bold text-[#0047BB]">{progress}%</span>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
