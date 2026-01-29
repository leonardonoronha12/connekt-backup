import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Tag as TagIcon } from 'lucide-react'
import { toast } from '@/components/ui/use-toast'
import { useTaxonomy } from '@/contexts/TaxonomyContext'
import questionBankService from '@/services/questionBankService'

function navigateTo(path) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

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
  const { categories: taxonomyCategories, subcategories: taxonomySubcategories, tags: taxonomyTags } = useTaxonomy()
  const [loading, setLoading] = useState(false)
  const [banks, setBanks] = useState([])

  const [category, setCategory] = useState('')
  const [subcategory, setSubcategory] = useState('')
  const [tag, setTag] = useState('')

  const [openDropdown, setOpenDropdown] = useState(null)
  const [categorySearch, setCategorySearch] = useState('')
  const [subcategorySearch, setSubcategorySearch] = useState('')
  const [tagSearch, setTagSearch] = useState('')

  const categoryRef = useRef(null)
  const subcategoryRef = useRef(null)
  const tagRef = useRef(null)

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

  useEffect(() => {
    if (!openDropdown) return
    const onMouseDown = (e) => {
      const target = e.target
      const ref =
        openDropdown === 'category'
          ? categoryRef
          : openDropdown === 'subcategory'
            ? subcategoryRef
            : tagRef
      if (!ref?.current) return
      if (!ref.current.contains(target)) setOpenDropdown(null)
    }
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpenDropdown(null)
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [openDropdown])

  useEffect(() => {
    if (openDropdown !== 'category') setCategorySearch('')
    if (openDropdown !== 'subcategory') setSubcategorySearch('')
    if (openDropdown !== 'tag') setTagSearch('')
  }, [openDropdown])

  const categoryColors = useMemo(() => {
    const map = new Map()
    for (const c of Array.isArray(taxonomyCategories) ? taxonomyCategories : []) {
      map.set(normalize(c?.name), String(c?.color || '').trim())
    }
    return map
  }, [taxonomyCategories])

  const subcategoryColors = useMemo(() => {
    const map = new Map()
    for (const s of Array.isArray(taxonomySubcategories) ? taxonomySubcategories : []) {
      map.set(normalize(s?.name), String(s?.color || '').trim())
    }
    return map
  }, [taxonomySubcategories])

  const tagColors = useMemo(() => {
    const map = new Map()
    for (const t of Array.isArray(taxonomyTags) ? taxonomyTags : []) {
      map.set(normalize(t?.name), String(t?.color || '').trim())
    }
    return map
  }, [taxonomyTags])

  const resolveColor = (kind, name) => {
    const key = normalize(name)
    if (kind === 'category') return categoryColors.get(key) || '#2563EB'
    if (kind === 'subcategory') return subcategoryColors.get(key) || '#2563EB'
    return tagColors.get(key) || '#2563EB'
  }

  const filteredCategories = useMemo(() => {
    const q = categorySearch.trim().toLowerCase()
    return allCategories.filter((c) => (q ? String(c).toLowerCase().includes(q) : true))
  }, [allCategories, categorySearch])

  const filteredSubcategories = useMemo(() => {
    const q = subcategorySearch.trim().toLowerCase()
    return allSubcategories.filter((c) => (q ? String(c).toLowerCase().includes(q) : true))
  }, [allSubcategories, subcategorySearch])

  const filteredTags = useMemo(() => {
    const q = tagSearch.trim().toLowerCase()
    return allTags.filter((c) => (q ? String(c).toLowerCase().includes(q) : true))
  }, [allTags, tagSearch])

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
    <div className="w-full flex flex-col gap-6">
      <div className="bg-white border border-[#E3E4E5] rounded-[12px] p-6 sm:p-8 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-[1.05fr,1.15fr] gap-10 items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <img src="/bank-icon.svg" alt="Banco de Questões" className="w-10 h-10" />
              <img src="/logo connekt.png" alt="Connekt" className="w-[180px] h-auto" />
            </div>
            <div className="mt-4 text-[13px] leading-[22px] text-[#737780] max-w-[520px]">
              Aprimore seus conhecimentos respondendo questões de múltiplos temas em nosso banco exclusivo. Coloque-se à prova, desafie seus limites e evolua a cada resposta.
            </div>
          </div>
          <div className="hidden lg:flex justify-end">
            <img src="/Preview.png" alt="Banco de Questões" className="w-full max-w-[760px] h-auto object-contain" />
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#E3E4E5] rounded-[12px] p-6 sm:p-8">
        <div className="flex flex-col items-center text-center">
          <div className="text-[16px] font-semibold text-[#1E1B39]">Filtrar</div>
          <div className="mt-1 text-[12px] text-[#737780]">Aplique os filtros e comece a responder.</div>

          <div className="mt-6 w-full max-w-[860px] grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div ref={categoryRef} className="relative">
              <button
                type="button"
                onClick={() => setOpenDropdown((prev) => (prev === 'category' ? null : 'category'))}
                className="w-full h-10 px-3 pr-9 rounded-[6px] border border-[#E3E4E5] bg-white text-[12px] text-[#22252B] outline-none text-left"
              >
                {category || 'Categoria'}
              </button>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#737780] pointer-events-none" aria-hidden="true" />
              {openDropdown === 'category' ? (
                <div className="absolute top-[44px] left-0 w-full min-w-[280px] max-w-[320px] bg-white border border-[#E3E4E5] rounded-[10px] shadow-lg z-50 overflow-hidden">
                  <div className="px-4 pt-3 pb-2">
                    <div className="text-[12px] font-semibold text-[#22252B]">Categorias</div>
                    <div className="mt-2 border-b border-[#E3E4E5]">
                      <input
                        value={categorySearch}
                        onChange={(e) => setCategorySearch(e.target.value)}
                        placeholder="Buscar categoria"
                        className="w-full h-8 text-[12px] text-[#22252B] outline-none"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="max-h-[220px] overflow-y-auto px-2 pb-2">
                    {filteredCategories.map((name) => {
                      const color = resolveColor('category', name)
                      const selected = normalize(name) === normalize(category)
                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() => {
                            setCategory(name)
                            setOpenDropdown(null)
                          }}
                          className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-[8px] hover:bg-[#F9FAFB]"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-3 h-3 rounded-[2px]" style={{ backgroundColor: color }} />
                            <div className="text-[12px] text-[#737780] truncate">{name}</div>
                          </div>
                          <div className={`w-4 h-4 rounded-full ${selected ? 'border-2 border-[#0047BB]' : 'border border-[#D1D5DB]'}`} />
                        </button>
                      )
                    })}
                    {filteredCategories.length === 0 ? (
                      <div className="px-3 py-3 text-[12px] text-[#737780]">Nenhuma categoria encontrada.</div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            <div ref={subcategoryRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  if (allSubcategories.length === 0) return
                  setOpenDropdown((prev) => (prev === 'subcategory' ? null : 'subcategory'))
                }}
                disabled={allSubcategories.length === 0}
                className="w-full h-10 px-3 pr-9 rounded-[6px] border border-[#E3E4E5] bg-white text-[12px] outline-none text-left disabled:bg-[#F9FAFB] disabled:text-[#9AA3AF]"
              >
                {subcategory || 'Subcategoria'}
              </button>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#737780] pointer-events-none" aria-hidden="true" />
              {openDropdown === 'subcategory' ? (
                <div className="absolute top-[44px] left-0 w-full min-w-[280px] max-w-[320px] bg-white border border-[#E3E4E5] rounded-[10px] shadow-lg z-50 overflow-hidden">
                  <div className="px-4 pt-3 pb-2">
                    <div className="text-[12px] font-semibold text-[#22252B]">Subcategorias</div>
                    <div className="mt-2 border-b border-[#E3E4E5]">
                      <input
                        value={subcategorySearch}
                        onChange={(e) => setSubcategorySearch(e.target.value)}
                        placeholder="Buscar subcategoria"
                        className="w-full h-8 text-[12px] text-[#22252B] outline-none"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="max-h-[220px] overflow-y-auto px-2 pb-2">
                    {filteredSubcategories.map((name) => {
                      const color = resolveColor('subcategory', name)
                      const selected = normalize(name) === normalize(subcategory)
                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() => {
                            setSubcategory(name)
                            setOpenDropdown(null)
                          }}
                          className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-[8px] hover:bg-[#F9FAFB]"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                            <div className="text-[12px] text-[#737780] truncate">{name}</div>
                          </div>
                          <div className={`w-4 h-4 rounded-full ${selected ? 'border-2 border-[#0047BB]' : 'border border-[#D1D5DB]'}`} />
                        </button>
                      )
                    })}
                    {filteredSubcategories.length === 0 ? (
                      <div className="px-3 py-3 text-[12px] text-[#737780]">Nenhuma subcategoria encontrada.</div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            <div ref={tagRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  if (allTags.length === 0) return
                  setOpenDropdown((prev) => (prev === 'tag' ? null : 'tag'))
                }}
                disabled={allTags.length === 0}
                className="w-full h-10 px-3 pr-9 rounded-[6px] border border-[#E3E4E5] bg-white text-[12px] outline-none text-left disabled:bg-[#F9FAFB] disabled:text-[#9AA3AF]"
              >
                {tag || 'Tag'}
              </button>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#737780] pointer-events-none" aria-hidden="true" />
              {openDropdown === 'tag' ? (
                <div className="absolute top-[44px] left-0 w-full min-w-[280px] max-w-[320px] bg-white border border-[#E3E4E5] rounded-[10px] shadow-lg z-50 overflow-hidden">
                  <div className="px-4 pt-3 pb-2">
                    <div className="text-[12px] font-semibold text-[#22252B]">Tags</div>
                    <div className="mt-2 border-b border-[#E3E4E5]">
                      <input
                        value={tagSearch}
                        onChange={(e) => setTagSearch(e.target.value)}
                        placeholder="Buscar tag"
                        className="w-full h-8 text-[12px] text-[#22252B] outline-none"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="max-h-[220px] overflow-y-auto px-2 pb-2">
                    {filteredTags.map((name) => {
                      const color = resolveColor('tag', name)
                      const selected = normalize(name) === normalize(tag)
                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() => {
                            setTag(name)
                            setOpenDropdown(null)
                          }}
                          className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-[8px] hover:bg-[#F9FAFB]"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <TagIcon className="w-4 h-4" style={{ color }} />
                            <div className="text-[12px] text-[#737780] truncate">{name}</div>
                          </div>
                          <div className={`w-4 h-4 rounded-full ${selected ? 'border-2 border-[#0047BB]' : 'border border-[#D1D5DB]'}`} />
                        </button>
                      )
                    })}
                    {filteredTags.length === 0 ? (
                      <div className="px-3 py-3 text-[12px] text-[#737780]">Nenhuma tag encontrada.</div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            className="mt-6 h-9 px-6 rounded-[6px] bg-[#0047BB] text-white text-[12px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading}
            onClick={start}
          >
            {loading ? 'Carregando...' : 'Iniciar questões'}
          </button>

          <div className="mt-3 text-[11px] text-[#737780]">
            {loading ? 'Buscando bancos disponíveis...' : `${filteredBanks.length} banco(s) disponível(is)`}
          </div>
        </div>
      </div>
    </div>
  )
}
