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
              <svg xmlns="http://www.w3.org/2000/svg" width="172" height="52" viewBox="0 0 172 52" fill="none" className="w-[180px] h-auto">
                <g clipPath="url(#clip0_1151_46034)">
                  <path d="M127.693 51.4228H123.8C122.719 51.4228 121.707 51.0007 120.945 50.2322C120.176 49.4573 119.758 48.4368 119.758 47.347V3.49C119.758 3.42071 119.758 3.35141 119.758 3.28212C119.839 1.68835 120.939 0.403256 122.494 0.0756827C124.075 -0.25189 125.612 0.504048 126.318 1.95293L131.729 13.0337V26.0233L131.11 26.6343C130.367 27.3713 129.961 28.3541 129.961 29.4061C129.961 30.4581 130.373 31.4471 131.11 32.1841L131.729 32.7952V47.347C131.729 48.4368 131.31 49.4636 130.542 50.2322C129.78 51.0007 128.761 51.4228 127.686 51.4228H127.693ZM123.881 47.2588H127.599V34.4646C126.456 33.0346 125.831 31.2707 125.831 29.4061C125.831 27.5414 126.456 25.7776 127.599 24.3476V14.0038L123.881 6.39406V47.2651V47.2588Z" fill="#0047BB" />
                  <path d="M141.892 29.0463L149.19 22.7405L157.256 15.767L171.157 3.75391H153.37L129.552 23.4461L129.409 23.5721C127.903 25.0651 127.078 27.062 127.078 29.1912C127.078 31.3204 127.884 33.2733 129.365 34.7663C129.49 34.8923 129.621 34.9993 129.771 35.0938L153.488 50.7292H172.001L141.892 29.0463ZM132.12 31.774C131.47 31.0685 131.121 30.1613 131.121 29.1912C131.121 28.2211 131.495 27.251 132.189 26.5391L154.813 7.82967H160.236L153.195 13.915L151.002 15.8111V18.7782H147.565L135.344 29.3361L159.393 46.6534H154.694L132.12 31.774Z" fill="#0777E5" />
                  <path d="M11.4588 33.6276C7.64125 33.6276 5.93556 31.1456 5.93556 28.0966C5.93556 25.0477 7.64125 22.5657 11.4588 22.5657C14.5203 22.5657 16.2197 24.1721 16.7383 26.4147H22.4364C21.4617 20.6002 16.3946 18.2568 11.4588 18.2568C6.04177 18.2568 0 20.8837 0 28.0966C0 35.3095 6.04177 37.9364 11.4588 37.9364C16.3946 37.9364 21.4617 35.6245 22.4364 29.8164H16.7383C16.2197 32.0212 14.5203 33.6276 11.4588 33.6276Z" fill="#0047BB" />
                  <path d="M35.3885 18.2568C29.9715 18.2568 23.9609 20.8837 23.9609 28.0966C23.9609 35.3095 29.9715 37.9364 35.3885 37.9364C40.8054 37.9364 46.816 35.3095 46.816 28.0966C46.816 20.8837 40.8054 18.2568 35.3885 18.2568ZM35.3885 33.6276C31.5709 33.6276 29.8653 31.1456 29.8653 28.0966C29.8653 25.0477 31.5709 22.5657 35.3885 22.5657C39.206 22.5657 40.8742 25.0477 40.8742 28.0966C40.8742 31.1456 39.2122 33.6276 35.3885 33.6276Z" fill="#0047BB" />
                  <path d="M62.3707 18.2568C58.5157 18.2568 56.2915 20.3546 55.5605 21.4444V18.7797H49.3125V37.4451H55.5605V26.484C55.5605 24.4177 56.985 22.8429 59.7653 22.8429C62.5457 22.8429 63.864 24.4177 63.864 26.484V37.4451H70.1182V25.0855C70.1182 20.8837 67.1317 18.2568 62.3707 18.2568Z" fill="#0047BB" />
                  <path d="M86.5114 18.2568C82.6564 18.2568 80.4321 20.3546 79.7073 21.4444V18.7797H73.4531V37.4451H79.7073V26.484C79.7073 24.4177 81.1319 22.8429 83.906 22.8429C86.68 22.8429 88.0046 24.4177 88.0046 26.484V37.4451H94.2588V25.0855C94.2588 20.8837 91.2723 18.2568 86.5114 18.2568Z" fill="#0047BB" />
                  <path d="M107.287 18.293C101.976 18.293 96.1719 21.0962 96.1719 28.1328C96.1719 35.1693 101.976 37.9726 107.287 37.9726C111.979 37.9726 116.528 36.1205 117.709 31.1439H112.154C111.386 32.618 109.999 33.6637 107.287 33.6637C104.094 33.6637 102.395 31.9188 101.908 29.5312H117.99C118.546 21.4805 112.71 18.293 107.287 18.293ZM102.151 25.8901C102.845 23.9688 104.513 22.6018 107.287 22.6018C110.061 22.6018 111.561 23.931 112.154 25.8901H102.151Z" fill="#0047BB" />
                  <path d="M162.67 22.7406V18.7782H157.253V13.915H150.999V18.7782H147.562V22.7406H150.999V30.1299C150.999 34.8167 152.111 37.7271 158.953 37.7271C160.415 37.7271 161.383 37.62 162.67 37.4436V32.6497C158.571 33.1726 157.253 32.6812 157.253 30.1299V22.7406H162.67Z" fill="#0047BB" />
                </g>
                <defs>
                  <clipPath id="clip0_1151_46034">
                    <rect width="172" height="51.4227" fill="white" />
                  </clipPath>
                </defs>
              </svg>
            </div>
            <div className="mt-4 text-[13px] leading-[22px] text-[#737780] max-w-[520px]">
              Aprimore seus conhecimentos respondendo questões de múltiplos temas em nosso banco exclusivo. Coloque-se à prova, desafie seus limites e evolua a cada resposta.
            </div>
          </div>
          <div className="hidden lg:flex justify-end">
            <div className="w-full max-w-[760px] bg-black rounded-[12px] overflow-hidden shadow-sm border border-black/10 px-10 py-8">
              <img
                src="/Preview.png"
                alt="Banco de Questões"
                className="w-full h-auto object-contain rotate-[-8deg] scale-[1.08] origin-center"
              />
            </div>
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
