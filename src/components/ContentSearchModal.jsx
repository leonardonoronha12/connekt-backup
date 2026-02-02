import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useActiveProducerUserId } from '@/hooks/useActiveProducerUserId'

function normalize(value) {
  return String(value || '').trim().toLowerCase()
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim()
}

function parseJsonMaybe(value) {
  if (value == null) return null
  if (typeof value === 'object') return value
  if (typeof value !== 'string') return null
  const s = value.trim()
  if (!s) return null
  try { return JSON.parse(s) } catch (_) { return null }
}

function getCourseModules(row) {
  const parsed = parseJsonMaybe(row?.modules)
  if (Array.isArray(parsed)) return parsed
  if (parsed && typeof parsed === 'object') {
    if (Array.isArray(parsed.modules)) return parsed.modules
    if (Array.isArray(parsed.items)) return parsed.items
  }
  const fromData = parseJsonMaybe(row?.data)
  if (fromData && typeof fromData === 'object' && Array.isArray(fromData.modules)) return fromData.modules
  return []
}

function getModuleLessons(mod) {
  if (!mod) return []
  if (Array.isArray(mod.lessons)) return mod.lessons
  if (Array.isArray(mod.aulas)) return mod.aulas
  if (Array.isArray(mod.items)) return mod.items
  if (mod && typeof mod === 'object' && Array.isArray(mod.module_lessons)) return mod.module_lessons
  return []
}

function TypePill({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-7 px-3 rounded-[16px] text-[11px] font-semibold border ${
        active ? 'bg-[#EEF2FF] border-[#BFD0FF] text-[#0047BB]' : 'bg-white border-[#E3E4E5] text-[#737780]'
      }`}
    >
      {label}
    </button>
  )
}

function ResultRow({ item, onSelect }) {
  const badgeColor =
    item.type === 'Curso'
      ? { bg: '#EEF2FF', fg: '#0047BB' }
      : item.type === 'Simulado'
        ? { bg: '#FFE8F6', fg: '#E051B3' }
        : item.type === 'Aula'
          ? { bg: '#E9FFEF', fg: '#06C270' }
          : { bg: '#F6F5FA', fg: '#22252B' }

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className="w-full text-left px-4 py-3 hover:bg-[#F9FAFB] flex items-start gap-3"
    >
      <div className="w-9 h-9 rounded-[8px] flex items-center justify-center shrink-0" style={{ backgroundColor: badgeColor.bg }}>
        <div className="w-3.5 h-3.5 rounded-[4px]" style={{ backgroundColor: badgeColor.fg }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[12px] font-semibold text-[#22252B] truncate">{item.title}</div>
          <span className="shrink-0 h-6 px-2 rounded-[6px] text-[10px] font-semibold inline-flex items-center" style={{ backgroundColor: badgeColor.bg, color: badgeColor.fg }}>
            {item.type}
          </span>
        </div>
        {item.subtitle ? <div className="mt-0.5 text-[11px] text-[#737780] truncate">{item.subtitle}</div> : null}
        {Array.isArray(item.tags) && item.tags.length ? (
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {item.tags.slice(0, 3).map((t) => (
              <span key={t} className="h-5 px-2 rounded-[6px] bg-[#EEF2FF] text-[#0047BB] text-[10px] font-medium inline-flex items-center">
                {t}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </button>
  )
}

export default function ContentSearchModal({ open, query, onChangeQuery, onClose, onSelect }) {
  const activeProducerUserId = useActiveProducerUserId()
  const [typeFilter, setTypeFilter] = useState('Todos')
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [filters, setFilters] = useState({ categories: [], subcategories: [], tags: [] })
  const filterButtonRef = useRef(null)
  const filterPanelRef = useRef(null)
  const [loading, setLoading] = useState(false)
  const [producerCourses, setProducerCourses] = useState([])
  const [producerSimulados, setProducerSimulados] = useState([])
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    setTypeFilter('Todos')
    setIsFilterOpen(false)
    setFilters({ categories: [], subcategories: [], tags: [] })
  }, [open])

  useEffect(() => {
    let active = true
    const run = async () => {
      if (!open) return
      const pid = String(activeProducerUserId || '').trim()
      if (!pid) {
        if (active) {
          setProducerCourses([])
          setProducerSimulados([])
          setLoadError('')
          setLoading(false)
        }
        return
      }
      setLoading(true)
      setLoadError('')
      try {
        const token = (await supabase.auth.getSession().catch(() => ({ data: null })))?.data?.session?.access_token || ''
        if (!token) throw new Error('missing_token')
        const [coursesRes, simuladosRes] = await Promise.all([
          fetch(`/api/producer?type=courses&producerId=${encodeURIComponent(pid)}`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`/api/producer?type=simulados&producerId=${encodeURIComponent(pid)}`, { headers: { Authorization: `Bearer ${token}` } }),
        ])
        const [coursesBody, simuladosBody] = await Promise.all([
          coursesRes.json().catch(() => ({})),
          simuladosRes.json().catch(() => ({})),
        ])
        if (!active) return
        setProducerCourses(Array.isArray(coursesBody?.data) ? coursesBody.data : [])
        setProducerSimulados(Array.isArray(simuladosBody?.data) ? simuladosBody.data : [])
        if (!coursesRes.ok || !simuladosRes.ok) {
          setLoadError(String(coursesBody?.error || simuladosBody?.error || 'Não foi possível carregar o conteúdo.'))
        }
      } catch (e) {
        if (!active) return
        setProducerCourses([])
        setProducerSimulados([])
        setLoadError(String(e?.message || 'Não foi possível carregar o conteúdo.'))
      } finally {
        if (active) setLoading(false)
      }
    }
    run()
    return () => { active = false }
  }, [open, activeProducerUserId])

  useEffect(() => {
    if (!open) return
    if (!isFilterOpen) return
    const onMouseDown = (e) => {
      const btn = filterButtonRef.current
      const panel = filterPanelRef.current
      if (btn && btn.contains(e.target)) return
      if (panel && panel.contains(e.target)) return
      setIsFilterOpen(false)
    }
    window.addEventListener('mousedown', onMouseDown)
    return () => window.removeEventListener('mousedown', onMouseDown)
  }, [open, isFilterOpen])

  const filterOptions = useMemo(
    () => ({
      categories: [
        { id: 'cat-azul', label: 'Categoria', color: '#0047BB' },
        { id: 'cat-verde', label: 'Categoria', color: '#06C270' },
        { id: 'cat-roxo', label: 'Categoria', color: '#5B4DEA' },
        { id: 'cat-amarelo', label: 'Categoria', color: '#E5B800' },
      ],
      subcategories: [
        { id: 'sub-azul', label: 'Subcategoria', color: '#0047BB' },
        { id: 'sub-verde', label: 'Subcategoria', color: '#06C270' },
        { id: 'sub-roxo', label: 'Subcategoria', color: '#5B4DEA' },
        { id: 'sub-amarelo', label: 'Subcategoria', color: '#E5B800' },
      ],
      tags: [
        { id: 'tag-azul', label: 'Tag', color: '#0047BB' },
        { id: 'tag-verde', label: 'Tag', color: '#06C270' },
        { id: 'tag-roxo', label: 'Tag', color: '#5B4DEA' },
        { id: 'tag-amarelo', label: 'Tag', color: '#E5B800' },
      ],
    }),
    []
  )

  const filterGroups = useMemo(() => {
    const find = (group, id) => (filterOptions[group] || []).find((o) => o.id === id)
    return [
      {
        key: 'categories',
        group: 'categories',
        left: [find('categories', 'cat-roxo'), find('categories', 'cat-amarelo')].filter(Boolean),
        right: [find('categories', 'cat-azul'), find('categories', 'cat-verde')].filter(Boolean),
      },
      {
        key: 'subcategories',
        group: 'subcategories',
        left: [find('subcategories', 'sub-roxo'), find('subcategories', 'sub-amarelo')].filter(Boolean),
        right: [find('subcategories', 'sub-azul'), find('subcategories', 'sub-verde')].filter(Boolean),
      },
      {
        key: 'tags',
        group: 'tags',
        left: [find('tags', 'tag-roxo'), find('tags', 'tag-amarelo')].filter(Boolean),
        right: [find('tags', 'tag-azul'), find('tags', 'tag-verde')].filter(Boolean),
      },
    ]
  }, [filterOptions])

  const renderFilterRow = (group, opt) => {
    const checkedList = Array.isArray(filters[group]) ? filters[group] : []
    const checked = checkedList.includes(opt.id)
    return (
      <label
        key={opt.id}
        className={`flex items-center justify-between gap-3 cursor-pointer select-none px-4 py-2 text-[11px] ${
          checked ? 'bg-[#F6F5FA]' : 'bg-white hover:bg-[#F9FAFB]'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-[3px]" style={{ backgroundColor: opt.color }} />
          <span className="text-[#22252B] font-medium">{opt.label}</span>
        </div>
        <input
          type="checkbox"
          className="w-4 h-4 accent-[#0047BB]"
          checked={checked}
          onChange={() => toggleFilter(group, opt.id)}
        />
      </label>
    )
  }

  const activeFilterCount = useMemo(() => {
    const a = Array.isArray(filters.categories) ? filters.categories.length : 0
    const b = Array.isArray(filters.subcategories) ? filters.subcategories.length : 0
    const c = Array.isArray(filters.tags) ? filters.tags.length : 0
    return a + b + c
  }, [filters.categories, filters.subcategories, filters.tags])

  const toggleFilter = (group, id) => {
    setFilters((prev) => {
      const next = { ...prev }
      const current = Array.isArray(next[group]) ? next[group] : []
      next[group] = current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
      return next
    })
  }

  const clearFilters = () => setFilters({ categories: [], subcategories: [], tags: [] })

  const items = useMemo(
    () => {
      const out = []

      for (const row of Array.isArray(producerCourses) ? producerCourses : []) {
        const courseId = String(row?.id || '').trim()
        const courseTitle = String(row?.title || '').trim() || 'Curso'
        if (courseId) {
          out.push({
            id: `course:${courseId}`,
            type: 'Curso',
            title: courseTitle,
            subtitle: 'Curso',
            courseId,
            tags: [],
            tagIds: [],
            categoryId: '',
            subcategoryId: '',
          })
        }

        const modules = getCourseModules(row)
        for (const mod of (Array.isArray(modules) ? modules : [])) {
          const moduleTitle = String(mod?.title || mod?.name || '').trim()
          const moduleId = String(mod?.id || mod?.module_id || mod?.moduleId || '').trim()
          const lessons = getModuleLessons(mod)
          for (let lessonIndex = 0; lessonIndex < lessons.length; lessonIndex += 1) {
            const lesson = lessons[lessonIndex]
            const lessonTitle = String(lesson?.title || lesson?.name || '').trim() || 'Aula'
            const lessonId = String(lesson?.id || lesson?.lesson_id || lesson?.lessonId || '').trim()
            out.push({
              id: `lesson:${courseId}:${moduleId || ''}:${lessonId || ''}:${lessonIndex}`,
              type: 'Aula',
              title: lessonTitle,
              subtitle: moduleTitle ? `${courseTitle} • ${moduleTitle}` : courseTitle,
              courseId,
              moduleId,
              lessonId,
              lessonIndex,
              tags: [],
              tagIds: [],
              categoryId: '',
              subcategoryId: '',
            })
          }
        }
      }

      for (const row of Array.isArray(producerSimulados) ? producerSimulados : []) {
        const simId = String(row?.id || '').trim()
        const title = String(row?.title || '').trim() || 'Simulado'
        if (!simId) continue
        out.push({
          id: `simulado:${simId}`,
          type: 'Simulado',
          title,
          subtitle: 'Simulado',
          simId,
          tags: [],
          tagIds: [],
          categoryId: '',
          subcategoryId: '',
        })
      }

      return out
    },
    [producerCourses, producerSimulados]
  )

  const filtered = useMemo(() => {
    const q = normalize(query)
    const byType = typeFilter === 'Todos' ? items : items.filter((i) => i.type === typeFilter)
    const byText = !q ? byType : byType.filter((i) => normalize(i.title).includes(q) || normalize(i.subtitle).includes(q))

    const cats = Array.isArray(filters.categories) ? filters.categories : []
    const subs = Array.isArray(filters.subcategories) ? filters.subcategories : []
    const tags = Array.isArray(filters.tags) ? filters.tags : []

    return byText.filter((i) => {
      if (cats.length > 0 && !cats.includes(i.categoryId)) return false
      if (subs.length > 0 && !subs.includes(i.subcategoryId)) return false
      if (tags.length > 0) {
        const itemTags = Array.isArray(i.tagIds) ? i.tagIds : []
        if (!itemTags.some((t) => tags.includes(t))) return false
      }
      return true
    })
  }, [filters.categories, filters.subcategories, filters.tags, items, query, typeFilter])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[9999] bg-black/30 flex items-start justify-center px-4" role="dialog" aria-modal="true" onMouseDown={onClose}>
      <div
        className="mt-20 w-full max-w-[980px] rounded-[12px] border border-[#E3E4E5] bg-white shadow-xl overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-[#E3E4E5] flex items-center justify-between">
          <div className="text-[12px] font-semibold text-[#22252B]">Busca de conteúdo</div>
          <button type="button" className="w-8 h-8 rounded-full hover:bg-[#F3F4F5] flex items-center justify-center" onClick={onClose} aria-label="Fechar">
            <X className="w-4 h-4 text-[#737780]" />
          </button>
        </div>

        <div className="px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 w-full h-9 px-3 rounded-[8px] border border-[#E3E4E5] bg-[#F9FAFB]">
                <Search className="w-4 h-4 text-[#737780]" />
                <input
                  value={query}
                  onChange={(e) => onChangeQuery(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-[12px] text-[#22252B]"
                  placeholder="Busque por um termo desejado"
                  autoFocus
                />
              </div>
            </div>
            <div className="relative">
              <button
                ref={filterButtonRef}
                type="button"
                className="h-9 px-3 rounded-[8px] border border-[#E3E4E5] bg-white text-[12px] font-semibold text-[#22252B] inline-flex items-center gap-2"
                onClick={() => setIsFilterOpen((v) => !v)}
              >
                <img src="/Filtro simulados 1.png" alt="" className="w-4 h-4 object-contain" />
                Filtros
                {activeFilterCount > 0 ? (
                  <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#0047BB] text-white text-[10px] font-bold">
                    {activeFilterCount}
                  </span>
                ) : null}
                <ChevronDown className={`w-4 h-4 text-[#737780] transition-transform duration-200 ${isFilterOpen ? 'rotate-180' : 'rotate-0'}`} />
              </button>

              {isFilterOpen ? (
                <div
                  ref={filterPanelRef}
                  className="absolute right-0 top-full mt-2 w-[420px] rounded-[10px] border border-[#E3E4E5] bg-white shadow-xl overflow-hidden z-[10000]"
                >
                  <div className="px-4 py-3 flex items-center justify-between">
                    <div className="text-[12px] font-semibold text-[#22252B]">Aplicar filtros de pesquisa</div>
                    <button type="button" className="text-[11px] font-semibold text-[#0047BB] hover:underline" onClick={clearFilters}>
                      Limpar
                    </button>
                  </div>
                  <div className="border-t border-[#E3E4E5]" />
                  <div>
                    {filterGroups.map((g, idx) => (
                      <div key={g.key}>
                        {idx > 0 ? <div className="border-t border-[#E3E4E5]" /> : null}
                        <div className="grid grid-cols-2">
                          <div className="py-1">
                            {g.left.map((opt) => renderFilterRow(g.group, opt))}
                          </div>
                          <div className="py-1 border-l border-[#E3E4E5]">
                            {g.right.map((opt) => renderFilterRow(g.group, opt))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {['Todos', 'Curso', 'Aula', 'Simulado'].map((t) => (
              <TypePill key={t} label={t} active={typeFilter === t} onClick={() => setTypeFilter(t)} />
            ))}
          </div>
        </div>

        <div className="border-t border-[#E3E4E5]">
          {loading ? (
            <div className="min-h-[320px] flex items-center justify-center px-6 py-10 text-center">
              <div className="max-w-[320px]">
                <div className="text-[12px] font-semibold text-[#22252B]">Carregando...</div>
                <div className="mt-1 text-[11px] text-[#737780]">Buscando conteúdo do produtor.</div>
              </div>
            </div>
          ) : loadError ? (
            <div className="min-h-[320px] flex items-center justify-center px-6 py-10 text-center">
              <div className="max-w-[320px]">
                <div className="text-[12px] font-semibold text-[#22252B]">Erro ao carregar</div>
                <div className="mt-1 text-[11px] text-[#737780]">{loadError}</div>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="min-h-[320px] flex items-center justify-center px-6 py-10 text-center">
              <div className="max-w-[320px]">
                <div className="text-[12px] font-semibold text-[#22252B]">Nenhum resultado</div>
                <div className="mt-1 text-[11px] text-[#737780]">Tente buscar por outro termo.</div>
              </div>
            </div>
          ) : (
            <div className="max-h-[420px] overflow-auto divide-y divide-[#E3E4E5]">
              {filtered.map((item) => (
                <ResultRow key={item.id} item={item} onSelect={onSelect} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
