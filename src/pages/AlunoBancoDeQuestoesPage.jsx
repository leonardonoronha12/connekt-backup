import React, { useEffect, useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { toast } from '@/components/ui/use-toast'
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
    <div className="min-h-screen bg-white px-[22px] pt-16 pb-24">
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
  )
}
