import React, { useEffect, useMemo, useState } from 'react'
import { ChevronDown, Database, GraduationCap, Menu, Monitor, Settings, X } from 'lucide-react'
import Header from '@/components/Header'
import { toast } from '@/components/ui/use-toast'
import questionBankService from '@/services/questionBankService'

function navigateTo(path) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

const navSections = [
  {
    title: 'MENU',
    items: [
      { label: 'Painel', Icon: GraduationCap, path: '/aluno' },
      { label: 'Simulados', Icon: Monitor, path: '/aluno/simulados' },
      { label: 'Banco de Questões', Icon: Database, path: '/aluno/banco-de-questoes' },
    ],
  },
  {
    title: 'GERAL',
    items: [
      { label: 'Configurações', Icon: Settings, path: '/aluno/configuracoes' },
    ],
  },
]

function normalize(value) {
  return String(value || '').trim().toLowerCase()
}

function getTagNames(bank) {
  const tags = Array.isArray(bank?.tags) ? bank.tags : []
  return tags
    .map((t) => {
      if (typeof t === 'string') return t
      if (t && typeof t === 'object') return t.name || t.label || t.title || ''
      return ''
    })
    .map((t) => String(t || '').trim())
    .filter(Boolean)
}

export default function AlunoBancoDeQuestoesPage() {
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/aluno/banco-de-questoes'
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [banks, setBanks] = useState([])

  const [category, setCategory] = useState('')
  const [subcategory, setSubcategory] = useState('')
  const [tag, setTag] = useState('')

  const isDemoStudent = useMemo(() => {
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
  }, [])

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

  useEffect(() => {
    let active = true
    const run = async () => {
      if (isDemoStudent) {
        if (!active) return
        setBanks([
          { id: 'demo-1', name: 'Banco demo', category: 'Cardiologia', subcategory: 'ECG', tags: ['Arritmias'] },
          { id: 'demo-2', name: 'Banco demo 2', category: 'Neurologia', subcategory: 'AVC', tags: ['Emergência'] },
        ])
        return
      }
      setLoading(true)
      try {
        const r = await questionBankService.getQuestionBanks()
        if (!active) return
        if (r?.error) throw new Error(String(r.error))
        setBanks(Array.isArray(r?.data) ? r.data : [])
      } catch (e) {
        if (!active) return
        setBanks([])
        toast({ description: String(e?.message || 'Erro ao carregar bancos de questões'), variant: 'destructive' })
      } finally {
        if (active) setLoading(false)
      }
    }
    run()
    return () => { active = false }
  }, [isDemoStudent])

  const allCategories = useMemo(() => {
    const set = new Set()
    for (const b of Array.isArray(banks) ? banks : []) {
      const v = String(b?.category || '').trim()
      if (v) set.add(v)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [banks])

  const allSubcategories = useMemo(() => {
    const set = new Set()
    for (const b of Array.isArray(banks) ? banks : []) {
      if (category && normalize(b?.category) !== normalize(category)) continue
      const v = String(b?.subcategory || '').trim()
      if (v) set.add(v)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [banks, category])

  const allTags = useMemo(() => {
    const set = new Set()
    for (const b of Array.isArray(banks) ? banks : []) {
      if (category && normalize(b?.category) !== normalize(category)) continue
      if (subcategory && normalize(b?.subcategory) !== normalize(subcategory)) continue
      for (const t of getTagNames(b)) set.add(t)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [banks, category, subcategory])

  useEffect(() => {
    setSubcategory('')
    setTag('')
  }, [category])

  useEffect(() => {
    setTag('')
  }, [subcategory])

  const filteredBanks = useMemo(() => {
    const list = Array.isArray(banks) ? banks : []
    return list.filter((b) => {
      if (category && normalize(b?.category) !== normalize(category)) return false
      if (subcategory && normalize(b?.subcategory) !== normalize(subcategory)) return false
      if (tag) {
        const tags = getTagNames(b).map(normalize)
        if (!tags.includes(normalize(tag))) return false
      }
      return true
    })
  }, [banks, category, subcategory, tag])

  const start = () => {
    const ids = filteredBanks.map((b) => String(b?.id || '').trim()).filter(Boolean)
    if (ids.length === 0) {
      toast({ description: 'Nenhum banco encontrado com esses filtros.', variant: 'destructive' })
      return
    }
    const qs = new URLSearchParams()
    qs.set('bankIds', ids.join(','))
    if (category) qs.set('category', category)
    if (subcategory) qs.set('subcategory', subcategory)
    if (tag) qs.set('tag', tag)
    if (isDemoStudent) qs.set('demo', '1')
    navigateTo(`/aluno/questoes?${qs.toString()}`)
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
                      const isActive =
                        itemPathname === '/aluno'
                          ? (currentPath === '/aluno' || currentPath.startsWith('/aluno/aula') || currentPath.startsWith('/aluno/curso'))
                          : (itemPathname === '/aluno/simulados'
                              ? currentPath.startsWith('/aluno/simulados') || currentPath === '/aluno/reposta-correta-simulado'
                              : currentPath === itemPathname)
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
                  const isActive =
                    itemPathname === '/aluno'
                      ? (currentPath === '/aluno' || currentPath.startsWith('/aluno/aula') || currentPath.startsWith('/aluno/curso'))
                      : (itemPathname === '/aluno/simulados'
                          ? currentPath.startsWith('/aluno/simulados') || currentPath === '/aluno/reposta-correta-simulado'
                          : currentPath === itemPathname)
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
          <div className="min-h-full bg-white">
            <div className="px-[22px] pt-16 pb-24">
              <div className="max-w-[1904px] mx-auto w-full">
                <div className="w-full max-w-[1200px] mx-auto">
                  <div className="grid grid-cols-1 lg:grid-cols-[1.05fr,1.15fr] gap-10 items-start">
                    <div className="min-w-0 pt-6">
                      <img src="/logo connekt.png" alt="Connekt" className="w-[240px] h-auto" />
                      <div className="mt-5 text-[16px] leading-[28px] text-[#9AA3AF] max-w-[420px]">
                        Aprimore seus conhecimentos respondendo questões de múltiplos temas em nosso banco exclusivo. Coloque-se à prova, desafie seus limites e evolua a cada resposta.
                      </div>
                    </div>
                    <div className="hidden lg:flex justify-end">
                      <img src="/questoes.png" alt="" className="w-full max-w-[760px] h-auto object-contain" />
                    </div>
                  </div>

                  <div className="mt-16 flex flex-col items-center text-center">
                    <div className="text-[28px] font-semibold text-[#111827]">Filtrar</div>
                    <div className="mt-2 text-[16px] text-[#6B7280]">Aplique os filtros e comece a responder.</div>

                    <div className="mt-10 w-full max-w-[860px] grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="relative">
                        <select
                          value={category}
                          onChange={(e) => setCategory(e.target.value)}
                          className="w-full h-12 px-4 pr-10 rounded-[6px] border border-[#E3E4E5] bg-white text-[14px] text-[#111827] outline-none appearance-none"
                        >
                          <option value="">Categoria</option>
                          {allCategories.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#737780] pointer-events-none" aria-hidden="true" />
                      </div>
                      <div className="relative">
                        <select
                          value={subcategory}
                          onChange={(e) => setSubcategory(e.target.value)}
                          className="w-full h-12 px-4 pr-10 rounded-[6px] border border-[#E3E4E5] bg-white text-[14px] text-[#111827] outline-none appearance-none disabled:bg-[#F9FAFB]"
                          disabled={allSubcategories.length === 0}
                        >
                          <option value="">Subcategoria</option>
                          {allSubcategories.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#737780] pointer-events-none" aria-hidden="true" />
                      </div>
                      <div className="relative">
                        <select
                          value={tag}
                          onChange={(e) => setTag(e.target.value)}
                          className="w-full h-12 px-4 pr-10 rounded-[6px] border border-[#E3E4E5] bg-white text-[14px] text-[#111827] outline-none appearance-none disabled:bg-[#F9FAFB]"
                          disabled={allTags.length === 0}
                        >
                          <option value="">Tag</option>
                          {allTags.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#737780] pointer-events-none" aria-hidden="true" />
                      </div>
                    </div>

                    <button
                      type="button"
                      className="mt-12 h-10 px-7 rounded-[4px] bg-[#0047BB] text-white text-[12px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={loading}
                      onClick={start}
                    >
                      {loading ? 'Carregando...' : 'Iniciar questões'}
                    </button>
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
