"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { ArrowLeft, Eye, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Search, Calendar, Clock, X, DollarSign, Award, Check, Plus, Minus, Info, Tag, Layers, BookOpen, BadgeCheck, CreditCard, Database, ListChecks, Trash2, Users, FileText, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import questionBankService from "@/services/questionBankService"
import { supabase } from "@/lib/supabaseClient"
import { TaxonomyDropdown, type TaxonomyItem } from "@/components/TaxonomyDropdown"
import { useTaxonomy } from "@/contexts/TaxonomyContext"

type Question = { id: string; name: string; taxonomy?: { categoryIds: string[]; subcategoryIds: string[]; tagIds: string[] } }
type Category = { id: string; name: string; questions: Question[] }
type Course = { id: string; name: string; taxonomy?: { categoryIds: string[]; subcategoryIds: string[]; tagIds: string[] } }
// Dados dinâmicos do banco de questões do usuário
const initialDynamicCategories: Category[] = []

export default function NovoSimuladoPage() {
  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState<boolean>(false)
  const restoredFromPreviewRef = useRef(false)

  const isBlockedRead = (e: any) => {
    const msg = String(e?.message || e || '').toLowerCase()
    const sc = String(e?.status || e?.statusCode || '')
    return sc === '401' || sc === '403' || msg.includes('row-level security') || msg.includes('permission denied') || msg.includes('not allowed')
  }

  const getAccessToken = async () => {
    try {
      const { data } = await supabase.auth.getSession()
      return data?.session?.access_token || ''
    } catch (_) {
      return ''
    }
  }

  const parseObjMaybe = (v: any) => {
    if (!v) return null
    if (typeof v === 'object') return v
    if (typeof v !== 'string') return null
    try { return JSON.parse(v) } catch { return null }
  }

  const extractIds = (value: any) => {
    if (!Array.isArray(value)) return []
    return value
      .map((x) => {
        if (x && typeof x === 'object') return String((x as any).id || (x as any).value || (x as any).name || '').trim()
        return String(x || '').trim()
      })
      .filter(Boolean)
  }

  const extractCourseTaxonomy = (row: any) => {
    const meta = parseObjMaybe(row?.data) || {}
    const tax = (meta?.taxonomy && typeof meta.taxonomy === 'object') ? meta.taxonomy : {}
    const categoryIds = extractIds(tax.categoryIds || tax.categories || tax.category_ids || meta.selectedCategories || meta.selected_categories || meta.categories || meta.course_categories)
    const subcategoryIds = extractIds(tax.subcategoryIds || tax.subcategories || tax.subcategory_ids || meta.selectedSubcategories || meta.selected_subcategories || meta.subcategories || meta.course_subcategories)
    const tagIds = extractIds(tax.tagIds || tax.tags || tax.tag_ids || meta.selectedTags || meta.selected_tags || meta.tags || meta.course_tags)
    return { categoryIds, subcategoryIds, tagIds }
  }

  function parseBRLToNumber(value: string): number {
    if (!value) return 0
    const normalized = value.replace(/\./g, "").replace(/,/g, ".").trim()
    const num = parseFloat(normalized)
    return isNaN(num) ? 0 : Math.round(num * 100) / 100
  }

  const withTimeout = async <T,>(promise: Promise<T>, ms: number, label: string) => {
    let t: any = null
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          t = setTimeout(() => reject(new Error(label)), ms)
        }),
      ])
    } finally {
      try { if (t) clearTimeout(t) } catch (_) {}
    }
  }

  const fetchJsonWithTimeout = async (url: string, init: RequestInit, ms: number) => {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), ms)
    try {
      const r = await fetch(url, { ...init, signal: controller.signal })
      const body = await r.json().catch(() => ({}))
      return { r, body }
    } finally {
      try { clearTimeout(t) } catch (_) {}
    }
  }

  async function handleCreateSimulado() {
    try {
      if (isSaving) return
      setIsSaving(true)

      // Verificar autenticação antes de salvar
      let currentUserId: string | null = null
      try {
        const { data: sessionData, error: sessionError } = await withTimeout(supabase.auth.getSession(), 10000, 'auth_session_timeout')
        if (sessionError) {
          console.error("Erro ao verificar sessão:", sessionError)
        }
        if (!sessionData?.session) {
          toast({
            title: "Faça login para salvar",
            description: "É necessário estar autenticado para criar ou atualizar simulados.",
            variant: "destructive",
          })
          setIsSaving(false)
          return
        }
        currentUserId = sessionData.session.user?.id || null
      } catch (authCheckErr:any) {
        console.error("Exceção ao checar autenticação:", authCheckErr)
      }

      const titleTrimmed = (title || "").trim()
      if (!titleTrimmed) {
        toast({ title: "Informe o nome do simulado", description: "Preencha o título antes de criar.", variant: "destructive" })
        setIsSaving(false)
        return
      }

      const selectedCourseIds = (selectedCourses || []).map((c: any) => c?.id).filter(Boolean)
      if (accessMode === 'course_students_free' && selectedCourseIds.length === 0) {
        toast({
          title: "Selecione ao menos 1 curso",
          description: "Para deixar gratuito para alunos de determinados cursos, selecione os cursos na seção “Cursos”.",
          variant: "destructive",
        })
        try {
          document.getElementById('simulado-courses-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        } catch (_) {}
        setIsSaving(false)
        return
      }

      const priceNumber = parseBRLToNumber(simulationPrice)
      const coverImageUrl = "/simulado-cover.svg"
      const availabilityISO = (() => {
        const iso = String(availabilityDate || '').trim()
        if (!iso) return null
        const parts = iso.split('-')
        if (parts.length !== 3) return null
        const y = parseInt(parts[0], 10)
        const m = parseInt(parts[1], 10)
        const d = parseInt(parts[2], 10)
        if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null
        return new Date(Date.UTC(y, m - 1, d)).toISOString()
      })()
      const durationMinutes = parseInt((simulationDuration || "0").toString(), 10) || 0
      const maxGradeNumber = parseInt((maxGrade || "0").toString(), 10) || 0

        const payload: any = {
        title: titleTrimmed,
        cover_image_url: coverImageUrl,
        is_paid: accessMode === 'paid' || priceNumber > 0,
        price: priceNumber,
        availability_date: availabilityISO,
        duration_minutes: durationMinutes,
        max_grade: maxGradeNumber,
        // Vincular propriedade ao usuário atual para satisfazer RLS
        produtor_id: currentUserId,
        user_id: currentUserId,
          settings: {
          // Redundância para compatibilidade com schemas antigos
          courseIds: selectedCourseIds,
          questionIds: (selectedQuestions || []).map((q: any) => q?.id).filter(Boolean),
          secondChance,
          shuffleQuestions,
          skipQuestions,
          allowRepeat,
          availabilityStartDate: String(availabilityDate || '').trim() || null,
          availabilityEndDate: String(availabilityEndDate || '').trim() || null,
          categories: selectedCategories,
          subcategories: selectedSubcategories,
          tags: selectedTags,
          description: (description || "").trim(),
          accessMode,
        },
      }

      const isMissingColumn = (err: any, col: string) => {
        const msg = String(err?.message || err?.details || err || '').toLowerCase()
        const code = String(err?.code || '').toUpperCase()
        const colLc = String(col || '').toLowerCase()
        return (
          code === 'PGRST204' ||
          msg.includes(`could not find the '${colLc}' column`) ||
          (msg.includes('schema cache') && msg.includes(colLc)) ||
          (msg.includes('column') && msg.includes(colLc) && msg.includes('does not exist'))
        )
      }

      const attemptUpsert = async (payloadAttempt: any) => {
        if (isEditing && editId) {
          const { data: updated, error: updateError } = await supabase
            .from("simulados")
            .update(payloadAttempt)
            .eq("id", editId)
            .select("id,title,settings")
          return { data: Array.isArray(updated) && updated.length > 0 ? updated[0] : null, error: updateError || null, op: "update" as const }
        }
        const { data: inserted, error: insertError } = await supabase
          .from("simulados")
          .insert([payloadAttempt])
          .select("id,title,settings")
        return { data: Array.isArray(inserted) && inserted.length > 0 ? inserted[0] : null, error: insertError || null, op: "insert" as const }
      }

      let error
      let savedRow: any = null
      let op: "insert" | "update" = "insert"

      // Em edição, garantir que o registro existe e está acessível antes de atualizar
      if (isEditing && editId) {
        try {
          const { data: existing, error: selectErr } = await withTimeout(
            supabase
              .from("simulados")
              .select("id")
              .eq("id", editId)
              .single(),
            15000,
            'simulado_precheck_timeout'
          )
          if (selectErr || !existing) {
            toast({
              title: "Registro não acessível para edição",
              description: "Não foi possível carregar o simulado para editar (RLS ou inexistente).",
              variant: "destructive",
            })
            setIsSaving(false)
            return
          }
        } catch (precheckErr:any) {
          console.error("Falha ao verificar registro para edição:", precheckErr)
          toast({ title: "Falha ao verificar registro", description: precheckErr?.message || "Tente novamente.", variant: "destructive" })
          setIsSaving(false)
          return
        }

        op = "update"
      } else {
        op = "insert"
      }

      let attemptPayload = payload
      ;({ data: savedRow, error, op } = await withTimeout(attemptUpsert(attemptPayload), 20000, 'simulado_upsert_timeout'))
      if (error && isMissingColumn(error, 'produtor_id')) {
        attemptPayload = { ...attemptPayload }
        delete (attemptPayload as any).produtor_id
        ;({ data: savedRow, error, op } = await withTimeout(attemptUpsert(attemptPayload), 20000, 'simulado_upsert_timeout'))
      }

      if (error) {
        console.error("Erro ao salvar simulado:", {
          operation: op,
          code: (error as any)?.code,
          message: (error as any)?.message,
          details: (error as any)?.details,
          hint: (error as any)?.hint,
          payload: attemptPayload,
        })
        // Não criar duplicado: informar claramente sobre a falta de permissão
        if ((error as any)?.code === "42501" && op === "update") {
          toast({
            title: "Sem permissão para editar",
            description: "Este simulado não pode ser alterado pela sua sessão (RLS). Peça transferência de propriedade ou atualize as políticas para permitir edição de registros legados.",
            variant: "destructive",
          })
          setIsSaving(false)
          return
        }
        // Como salvamos apenas em settings, evitamos erros de colunas ausentes;
        // se ainda assim ocorrer, tratamos pelos códigos mais comuns abaixo.
        if ((error as any)?.code === "PGRST205") {
          toast({
            title: "Tabela ausente no Supabase",
            description: "A tabela 'public.simulados' não existe ou não está acessível. Execute a migração para criar a tabela.",
            variant: "destructive"
          })
        } else if ((error as any)?.code === "PGRST301" || (error as any)?.message?.toLowerCase()?.includes("permission")) {
          toast({
            title: "Permissão negada",
            description: "Sua sessão não possui permissão para salvar. Verifique as políticas RLS da tabela 'simulados' (insert/update para 'authenticated').",
            variant: "destructive",
          })
        } else {
          const description = (error as any)?.message || (error as any)?.details || "Verifique os dados e tente novamente."
          toast({ title: isEditing ? "Erro ao atualizar simulado" : "Erro ao criar simulado", description, variant: "destructive" })
        }

        // Salvar rascunho local para não perder dados em caso de falha
        try {
          const draft = { timestamp: Date.now(), op, payload }
          localStorage.setItem("unsavedSimulationDraft", JSON.stringify(draft))
          console.warn("Rascunho local salvo em 'unsavedSimulationDraft'.")
        } catch (lsErr) {
          console.error("Falha ao salvar rascunho local:", lsErr)
        }
      } else {
        if (savedRow) {
          console.debug("Simulado salvo:", savedRow)
        }
        toast({ title: isEditing ? "Simulado atualizado com sucesso" : "Simulado criado com sucesso", description: "Suas configurações foram salvas." })
        // Redirecionar para a página de simulados
        window.history.pushState({}, '', '/simulados')
        window.dispatchEvent(new PopStateEvent('popstate'))
      }
    } catch (err: any) {
      console.error("Exceção ao criar simulado:", err)
      const msg = String(err?.message || err || '')
      if (msg === 'auth_session_timeout' || msg === 'simulado_precheck_timeout' || msg === 'simulado_upsert_timeout') {
        toast({ title: "Tempo excedido", description: "A plataforma demorou para responder. Atualize a página e tente novamente.", variant: "destructive" })
      } else {
        toast({ title: "Falha inesperada", description: err?.message || "Tente novamente mais tarde.", variant: "destructive" })
      }
    } finally {
      setIsSaving(false)
    }
  }

  // Header / cover / metadata
  const [showConfigSidebar, setShowConfigSidebar] = useState(true)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [showCategorySelector, setShowCategorySelector] = useState(false)
  const [showSubcategorySelector, setShowSubcategorySelector] = useState(false)
  const [showTagSelector, setShowTagSelector] = useState(false)
  const {
    categories: taxonomyCategories,
    subcategories: taxonomySubcategories,
    tags: taxonomyTags,
    createCategory,
    updateCategory,
    deleteCategory,
    createSubcategory,
    updateSubcategory,
    deleteSubcategory,
    createTag,
    updateTag,
    deleteTag,
  } = useTaxonomy()

  const categoryMeta = useMemo<Record<string, { desc: string; color: string }>>(
    () =>
      taxonomyCategories.reduce((acc, c) => {
        acc[c.name] = { desc: c.description || 'Categoria', color: c.color || '#8B5CF6' }
        return acc
      }, {} as Record<string, { desc: string; color: string }>),
    [taxonomyCategories],
  )
  const subcategoryMeta = useMemo<Record<string, { desc: string; color: string }>>(
    () =>
      taxonomySubcategories.reduce((acc, s) => {
        acc[s.name] = { desc: s.description || 'Subcategoria', color: s.color || '#22C55E' }
        return acc
      }, {} as Record<string, { desc: string; color: string }>),
    [taxonomySubcategories],
  )
  const tagMeta = useMemo<Record<string, { desc: string; color: string }>>(
    () =>
      taxonomyTags.reduce((acc, t) => {
        acc[t.name] = { desc: t.description || 'Tag', color: t.color || '#EF4444' }
        return acc
      }, {} as Record<string, { desc: string; color: string }>),
    [taxonomyTags],
  )

  // Question bank custom categories and inline creator
  const [customCategories, setCustomCategories] = useState<Category[]>([])
  const [showQBCategoryCreator, setShowQBCategoryCreator] = useState(false)
  const [newQBCategoryName, setNewQBCategoryName] = useState("")
  const questionBankSectionRef = useRef<HTMLDivElement | null>(null)

  // Banco de questões do usuário (dinâmico)
  const [bankCategories, setBankCategories] = useState<Category[]>(initialDynamicCategories)
  const [bankLoading, setBankLoading] = useState<boolean>(true)
  const [bankError, setBankError] = useState<string | null>(null)
  // Nomes de categorias vindas dos bancos (ex.: Neurologia, Cardiologia)
  const [bankCategoryNames, setBankCategoryNames] = useState<string[]>([])
  // Nomes de subcategorias vindas dos bancos
  const [bankSubcategoryNames, setBankSubcategoryNames] = useState<string[]>([])
  // Nomes de tags vindas dos bancos
  const [bankTagNames, setBankTagNames] = useState<string[]>([])
  // Subcategorias personalizadas criadas inline
  const [customSubcategories, setCustomSubcategories] = useState<string[]>([])
  // Tags personalizadas criadas inline
  const [customTags, setCustomTags] = useState<string[]>([])
  const categoryItems = useMemo<TaxonomyItem[]>(
    () => taxonomyCategories.map((c) => ({ id: c.id, name: c.name, color: c.color, description: c.description })),
    [taxonomyCategories],
  )
  const subcategoryItems = useMemo<TaxonomyItem[]>(
    () => taxonomySubcategories.map((s) => ({ id: s.id, name: s.name, color: s.color, description: s.description })),
    [taxonomySubcategories],
  )
  const tagItems = useMemo<TaxonomyItem[]>(
    () => taxonomyTags.map((t) => ({ id: t.id, name: t.name, color: t.color, description: t.description })),
    [taxonomyTags],
  )

  const addCategory = (name: string) => {
    if (!selectedCategories.includes(name)) {
      setSelectedCategories([...selectedCategories, name])
    }
  }
  const addSubcategory = (name: string) => {
    if (!selectedSubcategories.includes(name)) {
      setSelectedSubcategories([...selectedSubcategories, name])
    }
  }
  const addTag = (name: string) => {
    if (!selectedTags.includes(name)) {
      setSelectedTags([...selectedTags, name])
    }
  }

  // Courses
  const [selectedCourses, setSelectedCourses] = useState<Course[]>([])
  const [courseSearchQuery, setCourseSearchQuery] = useState("")
  const [coursesSelectedExpanded, setCoursesSelectedExpanded] = useState(true)
  const [producerCourses, setProducerCourses] = useState<Course[]>([])
  const [producerCoursesLoading, setProducerCoursesLoading] = useState(false)
  const [producerCoursesError, setProducerCoursesError] = useState<string | null>(null)
  const [courseFilterCategoryIds, setCourseFilterCategoryIds] = useState<string[]>([])
  const [courseFilterSubcategoryIds, setCourseFilterSubcategoryIds] = useState<string[]>([])
  const [courseFilterTagIds, setCourseFilterTagIds] = useState<string[]>([])
  const [courseFilterPickerOpen, setCourseFilterPickerOpen] = useState<null | 'category' | 'subcategory' | 'tag'>(null)

  // Payment & availability
  const [accessMode, setAccessMode] = useState<'free' | 'paid' | 'course_students_free'>('free')
  const [simulationPrice, setSimulationPrice] = useState("0,00")
  const [availabilityDate, setAvailabilityDate] = useState("")
  const [availabilityDateDisplay, setAvailabilityDateDisplay] = useState("")
  const [availabilityEndDate, setAvailabilityEndDate] = useState("")
  const [availabilityEndDateDisplay, setAvailabilityEndDateDisplay] = useState("")
  const [availabilityPickerOpen, setAvailabilityPickerOpen] = useState(false)
  const [availabilityPickerMode, setAvailabilityPickerMode] = useState<'start' | 'end'>('start')
  const [availabilityPickerMonth, setAvailabilityPickerMonth] = useState(() => new Date())
  const [simulationDuration, setSimulationDuration] = useState("")
  const simulationDurationRef = useRef<HTMLInputElement | null>(null)
  const availabilityDateRef = useRef<HTMLInputElement | null>(null)
  const availabilityEndDateRef = useRef<HTMLInputElement | null>(null)
  const availabilityPickerWrapRef = useRef<HTMLDivElement | null>(null)
  const availabilityEndPickerWrapRef = useRef<HTMLDivElement | null>(null)

  // Access & behavior
  const [secondChance, setSecondChance] = useState(true)
  const [shuffleQuestions, setShuffleQuestions] = useState(false)
  const [skipQuestions, setSkipQuestions] = useState(true)
  const [allowRepeat, setAllowRepeat] = useState(true)

  // Score & timer
  const [maxGrade, setMaxGrade] = useState("100")
  const maxGradeRef = useRef<HTMLInputElement | null>(null)

  // Question bank
  const [expandedCategories, setExpandedCategories] = useState<string[]>([])
  const [selectedQuestions, setSelectedQuestions] = useState<Question[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [bankFilterCategoryIds, setBankFilterCategoryIds] = useState<string[]>([])
  const [bankFilterSubcategoryIds, setBankFilterSubcategoryIds] = useState<string[]>([])
  const [bankFilterTagIds, setBankFilterTagIds] = useState<string[]>([])
  const [bankFilterPickerOpen, setBankFilterPickerOpen] = useState<null | { scope: 'top' | 'panel'; panelId?: string; kind: 'category' | 'subcategory' | 'tag' }>(null)
  
  // Detectar modo edição e carregar dados do simulado (deve estar dentro do componente)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('fromPreview') === '1') {
      try {
        const raw = sessionStorage.getItem('connekt_simulado_draft') || ''
        const draft = raw ? JSON.parse(raw) : null
        if (draft && typeof draft === 'object') {
          if (typeof draft.title === 'string') setTitle(draft.title)
          if (typeof draft.description === 'string') setDescription(draft.description)
          if (typeof draft.accessMode === 'string') {
            const m = String(draft.accessMode || '').trim()
            if (m === 'paid' || m === 'course_students_free' || m === 'free') setAccessMode(m as any)
          } else if (typeof draft.isPaid === 'boolean') {
            setAccessMode(draft.isPaid ? 'paid' : 'free')
          }
          if (typeof draft.simulationPrice === 'string') setSimulationPrice(draft.simulationPrice)
          if (typeof draft.availabilityDate === 'string') setAvailabilityDate(draft.availabilityDate)
          if (typeof draft.availabilityDateDisplay === 'string') setAvailabilityDateDisplay(draft.availabilityDateDisplay)
          if (typeof draft.availabilityEndDate === 'string') setAvailabilityEndDate(draft.availabilityEndDate)
          if (typeof draft.availabilityEndDateDisplay === 'string') setAvailabilityEndDateDisplay(draft.availabilityEndDateDisplay)
          if (typeof draft.simulationDuration === 'string') setSimulationDuration(draft.simulationDuration)
          if (typeof draft.maxGrade === 'string') setMaxGrade(draft.maxGrade)
          if (Array.isArray(draft.selectedCategories)) setSelectedCategories(draft.selectedCategories.filter((v: any) => typeof v === 'string'))
          if (Array.isArray(draft.selectedSubcategories)) setSelectedSubcategories(draft.selectedSubcategories.filter((v: any) => typeof v === 'string'))
          if (Array.isArray(draft.selectedTags)) setSelectedTags(draft.selectedTags.filter((v: any) => typeof v === 'string'))
          if (typeof draft.secondChance === 'boolean') setSecondChance(draft.secondChance)
          if (typeof draft.shuffleQuestions === 'boolean') setShuffleQuestions(draft.shuffleQuestions)
          if (typeof draft.skipQuestions === 'boolean') setSkipQuestions(draft.skipQuestions)
          if (typeof draft.allowRepeat === 'boolean') setAllowRepeat(draft.allowRepeat)
          if (Array.isArray(draft.selectedCourses)) setSelectedCourses(draft.selectedCourses)
          if (Array.isArray(draft.selectedQuestions)) setSelectedQuestions(draft.selectedQuestions)
          if (typeof draft.isEditing === 'boolean') setIsEditing(draft.isEditing)
          if (typeof draft.editId === 'string') setEditId(draft.editId)
          restoredFromPreviewRef.current = true
        }
      } catch (_) {}
      try {
        const u = new URL(window.location.href)
        u.searchParams.delete('fromPreview')
        window.history.replaceState({}, '', `${u.pathname}${u.search}${u.hash}`)
      } catch (_) {}
    }
    const id = params.get('edit')
    if (!id) return
    if (restoredFromPreviewRef.current) return
    setEditId(id)
    setIsEditing(true)
    ;(async () => {
      try {
        // Verificar sessão antes de buscar registro protegido por RLS
        try {
          const { data: { session } } = await supabase.auth.getSession()
          if (!session) {
            toast({ title: 'Faça login para editar', description: 'Sessão ausente. Entre para carregar os dados do simulado.', variant: 'destructive' })
            return
          }
        } catch (authErr:any) {
          console.error('Falha ao verificar sessão antes de carregar:', authErr)
        }
        const { data, error } = await supabase
          .from('simulados')
          .select('*')
          .eq('id', id)
          .single()
        if (error) {
          console.error('Erro ao carregar simulado para edição:', error)
          toast({ title: 'Erro ao carregar simulado', description: error.message || 'Tente novamente.', variant: 'destructive' })
          return
        }
        if (data) {
          console.debug('Simulado carregado:', {
            id: data.id,
            course_ids: data.course_ids,
            question_ids: data.question_ids,
            settings_courseIds: data?.settings?.courseIds,
            settings_questionIds: data?.settings?.questionIds,
          })
          setTitle(data.title || '')
          setDescription((data as any)?.description || (data as any)?.settings?.description || '')
          const loadedModeRaw =
            (typeof (data as any)?.settings?.accessMode === 'string' ? (data as any).settings.accessMode : null) ||
            (typeof (data as any)?.settings?.access_mode === 'string' ? (data as any).settings.access_mode : null) ||
            ''
          const loadedMode = String(loadedModeRaw || '').trim()
          if (loadedMode === 'paid' || loadedMode === 'course_students_free' || loadedMode === 'free') setAccessMode(loadedMode as any)
          else setAccessMode(Boolean(data.is_paid) ? 'paid' : 'free')
          setSimulationPrice(typeof data.price === 'number' ? String(data.price).replace('.', ',') : (data.price ?? '0,00'))
          const iso = data.availability_date ? new Date(data.availability_date).toISOString().slice(0,10) : ''
          setAvailabilityDate(iso)
          setAvailabilityDateDisplay(iso ? iso.split('-').reverse().join('/') : '')
          const endIsoRaw =
            (typeof data.settings?.availabilityEndDate === 'string' ? data.settings.availabilityEndDate : null)
            || (typeof data.settings?.availability_end_date === 'string' ? data.settings.availability_end_date : null)
            || ''
          const endIso = String(endIsoRaw || '').trim()
          setAvailabilityEndDate(endIso)
          setAvailabilityEndDateDisplay(endIso ? endIso.split('-').reverse().join('/') : '')
          setSimulationDuration(data.duration_minutes ? String(data.duration_minutes) : '')
          setMaxGrade(data.max_grade ? String(data.max_grade) : '100')
          setSelectedCategories(Array.isArray(data.settings?.categories) ? data.settings.categories : [])
          setSelectedSubcategories(Array.isArray(data.settings?.subcategories) ? data.settings.subcategories : [])
          setSelectedTags(Array.isArray(data.settings?.tags) ? data.settings.tags : [])
          setSecondChance(Boolean(data.settings?.secondChance))
          setShuffleQuestions(Boolean(data.settings?.shuffleQuestions))
          setSkipQuestions(Boolean(data.settings?.skipQuestions))
          setAllowRepeat(
            typeof data.settings?.allowRepeat === 'boolean'
              ? Boolean(data.settings.allowRepeat)
              : (typeof data.settings?.allow_repeat === 'boolean' ? Boolean(data.settings.allow_repeat) : true)
          )

          // Preencher cursos selecionados priorizando settings.courseIds (fallback para course_ids)
          try {
            const ids: string[] = Array.isArray(data.settings?.courseIds) && data.settings.courseIds.length > 0
              ? data.settings.courseIds
              : (Array.isArray(data.course_ids) ? data.course_ids : [])
            const mappedCourses = ids.map((cid) => {
              return ({ id: String(cid), name: String(cid) } as Course)
            })
            setSelectedCourses(mappedCourses)
          } catch {}

          // Preencher questões selecionadas priorizando settings.questionIds (fallback para question_ids)
          try {
            const qids: string[] = Array.isArray(data.settings?.questionIds) && data.settings.questionIds.length > 0
              ? data.settings.questionIds
              : (Array.isArray(data.question_ids) ? data.question_ids : [])
            // Buscar nomes das questões pelo ID na tabela questions
            const { data: rows, error: qErr } = await supabase
              .from('questions')
              .select('id, title, body, metadata')
              .in('id', qids)
            if (qErr) {
              console.warn('Falha ao buscar questões por ID:', qErr?.message || qErr)
              const fallback = qids.map((qid) => ({ id: String(qid), name: String(qid) } as Question))
              setSelectedQuestions(fallback)
            } else {
              const byId: Record<string, Question> = {}
              ;(rows || []).forEach((r: any) => {
                const meta = r?.metadata || {}
                const name = (
                  (typeof r?.title === 'string' ? r.title : '') ||
                  (typeof r?.body === 'string' ? r.body : '') ||
                  (typeof meta?.title === 'string' ? meta.title : '') ||
                  (typeof meta?.body === 'string' ? meta.body : '') ||
                  (typeof meta?.text === 'string' ? meta.text : '') ||
                  (typeof meta?.statement === 'string' ? meta.statement : '') ||
                  (typeof meta?.question === 'string' ? meta.question : '') ||
                  ''
                )
                byId[String(r.id)] = { id: String(r.id), name: name || String(r.id) }
              })
              const mapped = qids.map((qid) => byId[String(qid)] || ({ id: String(qid), name: String(qid) } as Question))
              setSelectedQuestions(mapped)
            }
          } catch {}
          if ((!data?.settings?.courseIds || data.settings.courseIds.length === 0) && (!Array.isArray(data.course_ids) || data.course_ids.length === 0)) {
            toast({ title: 'Sem cursos salvos', description: 'Este simulado não possui cursos salvos ainda.', variant: 'default' })
          }
          if ((!data?.settings?.questionIds || data.settings.questionIds.length === 0) && (!Array.isArray(data.question_ids) || data.question_ids.length === 0)) {
            toast({ title: 'Sem questões salvas', description: 'Este simulado não possui questões salvas ainda.', variant: 'default' })
          }
        }
      } catch (e:any) {
        console.error('Exceção ao carregar simulado:', e)
        toast({ title: 'Erro ao carregar simulado', description: e?.message || 'Tente novamente.', variant: 'destructive' })
      }
    })()
  }, [])

  useEffect(() => {
    if (producerCourses.length === 0) return
    setSelectedCourses((prev) =>
      (Array.isArray(prev) ? prev : []).map((c) => {
        const id = String(c?.id || '').trim()
        if (!id) return c
        const found = producerCourses.find((p) => String(p.id) === id)
        return found ? { ...c, name: found.name } : c
      }),
    )
  }, [producerCourses])

  useEffect(() => {
    if (!availabilityDate) {
      if (availabilityDateDisplay) setAvailabilityDateDisplay("")
      return
    }
    const parts = String(availabilityDate).split("-")
    if (parts.length !== 3) return
    const [y, m, d] = parts
    const next = `${d}/${m}/${y}`
    if (availabilityDateDisplay !== next) setAvailabilityDateDisplay(next)
  }, [availabilityDate])

  useEffect(() => {
    if (!availabilityEndDate) {
      if (availabilityEndDateDisplay) setAvailabilityEndDateDisplay("")
      return
    }
    const parts = String(availabilityEndDate).split("-")
    if (parts.length !== 3) return
    const [y, m, d] = parts
    const next = `${d}/${m}/${y}`
    if (availabilityEndDateDisplay !== next) setAvailabilityEndDateDisplay(next)
  }, [availabilityEndDate])

  useEffect(() => {
    if (!availabilityDate || !availabilityEndDate) return
    if (availabilityEndDate < availabilityDate) {
      setAvailabilityEndDate(availabilityDate)
      setAvailabilityEndDateDisplay(availabilityDate.split("-").reverse().join("/"))
    }
  }, [availabilityDate, availabilityEndDate])

  const parseBrDateToIso = (value: string) => {
    const digits = String(value || "").replace(/\D/g, "").slice(0, 8)
    if (digits.length !== 8) return null
    const d = digits.slice(0, 2)
    const m = digits.slice(2, 4)
    const y = digits.slice(4, 8)
    const dd = parseInt(d, 10)
    const mm = parseInt(m, 10)
    const yy = parseInt(y, 10)
    if (!yy || mm < 1 || mm > 12 || dd < 1 || dd > 31) return null
    const dt = new Date(Date.UTC(yy, mm - 1, dd))
    if (dt.getUTCFullYear() !== yy || dt.getUTCMonth() !== (mm - 1) || dt.getUTCDate() !== dd) return null
    return `${y}-${m}-${d}`
  }

  const getTodayIsoLocal = () => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  const isoToLocalDate = (iso: string) => {
    const s = String(iso || '').trim()
    const parts = s.split('-')
    if (parts.length !== 3) return null
    const y = parseInt(parts[0], 10)
    const m = parseInt(parts[1], 10)
    const d = parseInt(parts[2], 10)
    if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null
    const dt = new Date(y, m - 1, d)
    if (Number.isNaN(dt.getTime())) return null
    return dt
  }

  const formatMonthYearPtBR = (date: Date) => {
    const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
    return `${months[date.getMonth()]} ${date.getFullYear()}`
  }

  const pad2 = (n: number) => String(n).padStart(2, '0')

  const localDateToIso = (date: Date) => {
    const y = date.getFullYear()
    const m = pad2(date.getMonth() + 1)
    const d = pad2(date.getDate())
    return `${y}-${m}-${d}`
  }

  const setAvailabilityFromIso = (iso: string, mode: 'start' | 'end') => {
    const todayIso = getTodayIsoLocal()
    if (mode === 'start') {
      const safeIso = iso < todayIso ? todayIso : iso
      setAvailabilityDate(safeIso)
      setAvailabilityDateDisplay(safeIso.split('-').reverse().join('/'))
      if (availabilityEndDate && availabilityEndDate < safeIso) {
        setAvailabilityEndDate(safeIso)
        setAvailabilityEndDateDisplay(safeIso.split('-').reverse().join('/'))
      }
      return
    }
    const minIso = availabilityDate ? (availabilityDate < todayIso ? todayIso : availabilityDate) : todayIso
    const safeIso = iso < minIso ? minIso : iso
    setAvailabilityEndDate(safeIso)
    setAvailabilityEndDateDisplay(safeIso.split('-').reverse().join('/'))
  }

  const openAvailabilityPicker = (mode: 'start' | 'end') => {
    setAvailabilityPickerMode(mode)
    const base =
      mode === 'start'
        ? (isoToLocalDate(availabilityDate) || new Date())
        : (isoToLocalDate(availabilityEndDate) || isoToLocalDate(availabilityDate) || new Date())
    setAvailabilityPickerMonth(new Date(base.getFullYear(), base.getMonth(), 1))
    setAvailabilityPickerOpen(true)
  }

  useEffect(() => {
    if (!availabilityPickerOpen) return
    const onDown = (e: any) => {
      const wrap = availabilityPickerWrapRef.current
      const wrapEnd = availabilityEndPickerWrapRef.current
      if (wrap && wrap.contains(e?.target)) return
      if (wrapEnd && wrapEnd.contains(e?.target)) return
      setAvailabilityPickerOpen(false)
    }
    const onKey = (e: any) => {
      if (e?.key === 'Escape') setAvailabilityPickerOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [availabilityPickerOpen])

  const formatBrDateInput = (raw: string) => {
    const digits = String(raw || "").replace(/\D/g, "").slice(0, 8)
    const p1 = digits.slice(0, 2)
    const p2 = digits.slice(2, 4)
    const p3 = digits.slice(4, 8)
    if (digits.length <= 2) return p1
    if (digits.length <= 4) return `${p1}/${p2}`
    return `${p1}/${p2}/${p3}`
  }
  

  const handleSimulationDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "")
    if (raw === "") {
      setSimulationDuration("")
      return
    }
    const num = Math.max(0, Math.min(9999, parseInt(raw, 10)))
    setSimulationDuration(String(num))
  }

  const handleMaxGradeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "")
    if (raw === "") {
      setMaxGrade("")
      return
    }
    const num = Math.max(1, Math.min(1000, parseInt(raw, 10)))
    setMaxGrade(String(num))
  }

  const incrementDuration = (step = 5) => {
    const cur = parseInt(simulationDuration || "0", 10)
    const next = Math.min(9999, cur + step)
    setSimulationDuration(String(next))
  }

  const decrementDuration = (step = 5) => {
    const cur = parseInt(simulationDuration || "0", 10)
    const next = Math.max(0, cur - step)
    setSimulationDuration(String(next))
  }

  const allQuestionCategories = [...bankCategories, ...customCategories]
  const filteredQuestions = allQuestionCategories.map((category) => ({
    ...category,
    questions: category.questions.filter((q) => {
      const matchesQuery = q.name.toLowerCase().includes(searchQuery.toLowerCase())
      if (!matchesQuery) return false
      const tax: any = (q as any)?.taxonomy || {}
      const qCats: string[] = Array.isArray(tax?.categoryIds) ? tax.categoryIds.map((x: any) => String(x)) : []
      const qSubs: string[] = Array.isArray(tax?.subcategoryIds) ? tax.subcategoryIds.map((x: any) => String(x)) : []
      const qTags: string[] = Array.isArray(tax?.tagIds) ? tax.tagIds.map((x: any) => String(x)) : []
      if (bankFilterCategoryIds.length > 0 && !bankFilterCategoryIds.some((id) => qCats.includes(String(id)))) return false
      if (bankFilterSubcategoryIds.length > 0 && !bankFilterSubcategoryIds.some((id) => qSubs.includes(String(id)))) return false
      if (bankFilterTagIds.length > 0 && !bankFilterTagIds.some((id) => qTags.includes(String(id)))) return false
      return true
    }),
  }))

  const slugify = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')

  const addQuestionBankCategory = (name: string) => {
    const base = slugify(name)
    let candidate = base || `categoria-${Date.now()}`
    const existingIds = new Set(allQuestionCategories.map((c) => c.id))
    let i = 1
    while (existingIds.has(candidate)) {
      candidate = `${base}-${i++}`
    }
    setCustomCategories((prev) => [...prev, { id: candidate, name, questions: [] }])
    setShowQBCategoryCreator(false)
    setNewQBCategoryName("")
    toast({ title: "Categoria criada", description: "A nova categoria foi adicionada ao banco." })
  }

  const createCategoryFromPayload = async (payload: { name: string; color: string; description: string }) => {
    const name = payload.name.trim()
    if (!name) return
    const exists = taxonomyCategories.some((c) => (c.name || '').toLowerCase() === name.toLowerCase())
    if (exists) {
      toast({ title: "Categoria já existe", description: "Escolha um nome diferente.", variant: "destructive" as any })
      return
    }
    const created = createCategory({
      name,
      description: payload.description.trim(),
      color: payload.color || '#8B5CF6',
      tagIds: [],
    })
    addCategory(created.name)
    toast({ title: "Categoria criada", description: "Categoria adicionada às opções e selecionada." })
  }

  const updateCategoryFromPayload = async (itemId: string | number, payload: { name: string; color: string; description: string }) => {
    const id = String(itemId)
    const newName = payload.name.trim()
    if (!newName) return
    const current = taxonomyCategories.find((c) => String(c.id) === id)
    const oldName = current?.name || ''
    const exists = taxonomyCategories.some((c) => String(c.id) !== id && (c.name || '').toLowerCase() === newName.toLowerCase())
    if (exists) {
      toast({ title: "Categoria já existe", description: "Escolha um nome diferente.", variant: "destructive" as any })
      return
    }
    updateCategory(id, { name: newName, description: payload.description.trim(), color: payload.color || '#8B5CF6' })
    if (oldName && oldName !== newName) {
      setSelectedCategories((prev) => prev.map((n) => (n === oldName ? newName : n)))
    }
    toast({ title: "Categoria atualizada", description: "Alterações salvas com sucesso." })
  }

  const deleteCategoryById = async (itemId: string | number) => {
    const id = String(itemId)
    const current = taxonomyCategories.find((c) => String(c.id) === id)
    deleteCategory(id)
    if (current?.name) {
      setSelectedCategories((prev) => prev.filter((n) => n !== current.name))
    }
    toast({ title: "Categoria removida", description: "A categoria foi removida." })
  }

  const createSubcategoryFromPayload = async (payload: { name: string; color: string; description: string }) => {
    const name = payload.name.trim()
    if (!name) return
    const exists = taxonomySubcategories.some((s) => (s.name || '').toLowerCase() === name.toLowerCase())
    if (exists) {
      toast({ title: "Subcategoria já existe", description: "Escolha um nome diferente.", variant: "destructive" as any })
      return
    }
    const created = createSubcategory({
      name,
      description: payload.description.trim(),
      color: payload.color || '#22C55E',
      categoryIds: [],
      tagIds: [],
      productsCount: 0,
    })
    addSubcategory(created.name)
    toast({ title: "Subcategoria criada", description: "Subcategoria adicionada às opções e selecionada." })
  }

  const updateSubcategoryFromPayload = async (itemId: string | number, payload: { name: string; color: string; description: string }) => {
    const id = String(itemId)
    const newName = payload.name.trim()
    if (!newName) return
    const current = taxonomySubcategories.find((s) => String(s.id) === id)
    const oldName = current?.name || ''
    const exists = taxonomySubcategories.some((s) => String(s.id) !== id && (s.name || '').toLowerCase() === newName.toLowerCase())
    if (exists) {
      toast({ title: "Subcategoria já existe", description: "Escolha um nome diferente.", variant: "destructive" as any })
      return
    }
    updateSubcategory(id, { name: newName, description: payload.description.trim(), color: payload.color || '#22C55E' })
    if (oldName && oldName !== newName) {
      setSelectedSubcategories((prev) => prev.map((n) => (n === oldName ? newName : n)))
    }
    toast({ title: "Subcategoria atualizada", description: "Alterações salvas com sucesso." })
  }

  const deleteSubcategoryById = async (itemId: string | number) => {
    const id = String(itemId)
    const current = taxonomySubcategories.find((s) => String(s.id) === id)
    deleteSubcategory(id)
    if (current?.name) {
      setSelectedSubcategories((prev) => prev.filter((n) => n !== current.name))
    }
    toast({ title: "Subcategoria removida", description: "A subcategoria foi removida." })
  }

  const createTagFromPayload = async (payload: { name: string; color: string; description: string }) => {
    const name = payload.name.trim()
    if (!name) return
    const exists = taxonomyTags.some((t) => (t.name || '').toLowerCase() === name.toLowerCase())
    if (exists) {
      toast({ title: "Tag já existe", description: "Escolha um nome diferente.", variant: "destructive" as any })
      return
    }
    const created = createTag({
      name,
      description: payload.description.trim(),
      color: payload.color || '#EF4444',
    })
    addTag(created.name)
    toast({ title: "Tag criada", description: "Tag adicionada às opções e selecionada." })
  }

  const updateTagFromPayload = async (itemId: string | number, payload: { name: string; color: string; description: string }) => {
    const id = String(itemId)
    const newName = payload.name.trim()
    if (!newName) return
    const current = taxonomyTags.find((t) => String(t.id) === id)
    const oldName = current?.name || ''
    const exists = taxonomyTags.some((t) => String(t.id) !== id && (t.name || '').toLowerCase() === newName.toLowerCase())
    if (exists) {
      toast({ title: "Tag já existe", description: "Escolha um nome diferente.", variant: "destructive" as any })
      return
    }
    updateTag(id, { name: newName, description: payload.description.trim(), color: payload.color || '#EF4444' })
    if (oldName && oldName !== newName) {
      setSelectedTags((prev) => prev.map((n) => (n === oldName ? newName : n)))
    }
    toast({ title: "Tag atualizada", description: "Alterações salvas com sucesso." })
  }

  const deleteTagById = async (itemId: string | number) => {
    const id = String(itemId)
    const current = taxonomyTags.find((t) => String(t.id) === id)
    deleteTag(id)
    if (current?.name) {
      setSelectedTags((prev) => prev.filter((n) => n !== current.name))
    }
    toast({ title: "Tag removida", description: "A tag foi removida." })
  }

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId],
    )
  }

  const addQuestion = (question: Question) => {
    if (!selectedQuestions.find((q) => q.id === question.id)) {
      setSelectedQuestions([...selectedQuestions, question])
      toast({ title: "Questão adicionada", description: "A questão foi adicionada ao simulado." })
    }
  }

  const removeQuestion = (questionId: string) => {
    setSelectedQuestions(selectedQuestions.filter((q) => q.id !== questionId))
    toast({ title: "Questão removida", description: "A questão foi removida do simulado." })
  }

  const clearSelectedQuestions = () => {
    setSelectedQuestions([])
    toast({ title: "Seleção limpa", description: "Todas as questões foram removidas." })
  }

  const addAllFromCategory = (category: Category) => {
    const unique = [...selectedQuestions]
    category.questions.forEach((q) => {
      if (!unique.find((s) => s.id === q.id)) {
        unique.push(q)
      }
    })
    setSelectedQuestions(unique)
    toast({ title: "Questões adicionadas", description: `Todas as questões de ${category.name} foram adicionadas.` })
  }

  const removeCategoryChip = (category: string) => {
    setSelectedCategories(selectedCategories.filter((c) => c !== category))
  }
  const removeSubcategoryChip = (subcategory: string) => {
    setSelectedSubcategories(selectedSubcategories.filter((s) => s !== subcategory))
  }
  const removeTagChip = (tag: string) => {
    setSelectedTags(selectedTags.filter((t) => t !== tag))
  }

  const addCourse = (course: Course) => {
    if (!selectedCourses.find((c) => c.id === course.id)) {
      setSelectedCourses([...selectedCourses, course])
      toast({ title: "Curso adicionado", description: "O curso foi adicionado ao simulado." })
    }
  }
  const removeCourse = (courseId: string) => {
    setSelectedCourses(selectedCourses.filter((c) => c.id !== courseId))
    toast({ title: "Curso removido", description: "O curso foi removido do simulado." })
  }

  const clearSelectedCourses = () => {
    if (selectedCourses.length === 0) return
    setSelectedCourses([])
    toast({ title: "Cursos removidos", description: "Todos os cursos selecionados foram removidos." })
  }

  const addAllCourses = () => {
    const unique = [...selectedCourses]
    filteredCourses.forEach((course) => {
      if (!unique.find((c) => c.id === course.id)) {
        unique.push(course)
      }
    })
    setSelectedCourses(unique)
    if (filteredCourses.length > 0) {
      toast({ title: "Cursos adicionados", description: "Todos os cursos filtrados foram adicionados." })
    }
  }

  useEffect(() => {
    let active = true
    const run = async () => {
      setProducerCoursesLoading(true)
      setProducerCoursesError(null)
      try {
        const { data } = await withTimeout(supabase.auth.getSession(), 10000, 'courses_session_timeout')
        const uid = String(data?.session?.user?.id || '').trim()
        if (!uid) {
          if (active) setProducerCourses([])
          return
        }
        const { data: rows, error } = await withTimeout(
          supabase
            .from('courses')
            .select('id,title,data,user_id,created_at')
            .eq('user_id', uid)
            .order('created_at', { ascending: false })
            .limit(200),
          20000,
          'courses_select_timeout'
        )
        if (!active) return
        if (error) throw error
        const list = (Array.isArray(rows) ? rows : []).map((r: any) => ({
          id: String(r?.id || '').trim(),
          name: String(r?.title || 'Curso').trim() || 'Curso',
          taxonomy: extractCourseTaxonomy(r),
        })).filter((c: any) => c.id)
        setProducerCourses(list)
      } catch (e: any) {
        if (!active) return
        const msg = String(e?.message || e || '')
        if (msg === 'courses_session_timeout' || msg === 'courses_select_timeout') {
          setProducerCoursesError('Tempo excedido ao carregar cursos')
          setProducerCourses([])
          return
        }
        if (!isBlockedRead(e)) {
          setProducerCourses([])
          return
        }
        try {
          const { data } = await withTimeout(supabase.auth.getSession(), 10000, 'courses_session_timeout')
          const uid = String(data?.session?.user?.id || '').trim()
          if (!uid) { setProducerCourses([]); return }
          const token = await getAccessToken()
          const { r, body } = await fetchJsonWithTimeout(
            `/api/producer?type=courses&producerId=${encodeURIComponent(uid)}`,
            { headers: token ? { Authorization: `Bearer ${token}` } : {} },
            20000
          )
          if (!active) return
          if (!r.ok) {
            setProducerCourses([])
            return
          }
          const list = (Array.isArray(body?.data) ? body.data : []).map((row: any) => ({
            id: String(row?.id || '').trim(),
            name: String(row?.title || row?.name || 'Curso').trim() || 'Curso',
            taxonomy: extractCourseTaxonomy(row),
          })).filter((c: any) => c.id)
          setProducerCourses(list)
        } catch (e2: any) {
          if (!active) return
          const msg = String(e2?.message || e2 || '')
          if (msg === 'courses_session_timeout' || msg === 'courses_select_timeout' || msg.toLowerCase().includes('aborted')) {
            setProducerCoursesError('Tempo excedido ao carregar cursos')
          } else {
            setProducerCoursesError(e2?.message || 'Falha ao carregar cursos')
          }
          setProducerCourses([])
        }
      } finally {
        if (active) setProducerCoursesLoading(false)
      }
    }
    run()
    return () => { active = false }
  }, [])

  const filteredCourses = useMemo(() => {
    const q = courseSearchQuery.toLowerCase()
    const selectedCatKeys = courseFilterCategoryIds.length
      ? Array.from(new Set([
          ...courseFilterCategoryIds.map(String),
          ...courseFilterCategoryIds.map((id) => String(categoryItems.find((c) => String(c.id) === String(id))?.name || '')).filter(Boolean),
        ]))
      : []
    const selectedSubKeys = courseFilterSubcategoryIds.length
      ? Array.from(new Set([
          ...courseFilterSubcategoryIds.map(String),
          ...courseFilterSubcategoryIds.map((id) => String(subcategoryItems.find((s) => String(s.id) === String(id))?.name || '')).filter(Boolean),
        ]))
      : []
    const selectedTagKeys = courseFilterTagIds.length
      ? Array.from(new Set([
          ...courseFilterTagIds.map(String),
          ...courseFilterTagIds.map((id) => String(tagItems.find((t) => String(t.id) === String(id))?.name || '')).filter(Boolean),
        ]))
      : []
    return producerCourses
      .filter((c) => c.name.toLowerCase().includes(q))
      .filter((c) => {
        const t = c?.taxonomy || { categoryIds: [], subcategoryIds: [], tagIds: [] }
        if (selectedCatKeys.length > 0 && !selectedCatKeys.some((id) => (t.categoryIds || []).includes(String(id)))) return false
        if (selectedSubKeys.length > 0 && !selectedSubKeys.some((id) => (t.subcategoryIds || []).includes(String(id)))) return false
        if (selectedTagKeys.length > 0 && !selectedTagKeys.some((id) => (t.tagIds || []).includes(String(id)))) return false
        return true
      })
  }, [producerCourses, courseSearchQuery, courseFilterCategoryIds, courseFilterSubcategoryIds, courseFilterTagIds, categoryItems, subcategoryItems, tagItems])

  // Carregar bancos de questões do usuário e suas perguntas
  useEffect(() => {
    let cancelled = false
    const loadBanks = async () => {
      setBankLoading(true)
      setBankError(null)
      try {
        const { data: banks, error: banksErr } = await withTimeout(questionBankService.getQuestionBanks(), 20000, 'banks_timeout')
        if (banksErr) throw new Error(typeof banksErr === 'string' ? banksErr : 'Falha ao carregar bancos')
        const categories: Category[] = []
        const categoryNameSet = new Set<string>()
        const subcategoryNameSet = new Set<string>()
        const tagNameSet = new Set<string>()
        for (const bank of banks || []) {
          let qs: any[] = []
          let qErr: any = null
          try {
            const r = await withTimeout(questionBankService.getQuestionsByBankId(bank.id), 20000, 'bank_questions_timeout')
            qs = (r as any)?.data || []
            qErr = (r as any)?.error || null
          } catch (e: any) {
            qErr = e
          }
          if (qErr) console.warn('Erro ao buscar perguntas do banco', bank.id, qErr)
          const mappedQuestions: Question[] = (qs || []).map((q: any) => {
            const meta = (q?.metadata && typeof q.metadata === 'object') ? q.metadata : {}
            const tax = (meta?.taxonomy && typeof meta.taxonomy === 'object') ? meta.taxonomy : {}
            const toArr = (v: any) => Array.isArray(v) ? v.map((x) => String(x)) : []
            const categoryIds = toArr(tax.categoryIds || tax.categories || tax.category_ids || meta.categoryIds || meta.categories)
            const subcategoryIds = toArr(tax.subcategoryIds || tax.subcategories || tax.subcategory_ids || meta.subcategoryIds || meta.subcategories)
            const tagIds = toArr(tax.tagIds || tax.tags || tax.tag_ids || meta.tagIds || meta.tags)
            return {
              id: String(q.id),
              name: (q.title?.trim?.() || q.body?.trim?.() || (meta?.text || meta?.statement || meta?.question) || 'Sem título'),
              taxonomy: { categoryIds, subcategoryIds, tagIds },
            }
          })
          categories.push({ id: String(bank.id), name: bank.name || bank.title || 'Banco sem nome', questions: mappedQuestions })
          const catName = (bank.category || '').trim()
          if (catName) categoryNameSet.add(catName)
          const subName = (bank.subcategory || '').trim()
          if (subName) subcategoryNameSet.add(subName)
          const tagsArr = Array.isArray(bank.tags) ? bank.tags : []
          for (const t of tagsArr) {
            const nm = (typeof t === 'string' ? t : (t?.name || '')).trim()
            if (nm) {
              tagNameSet.add(nm)
              const colorFromBank = (typeof t === 'object' && t?.color) ? t.color : undefined
              if (colorFromBank && !tagMeta[nm]) {
                tagMeta[nm] = { desc: 'Tag do banco de questões', color: colorFromBank }
              }
            }
          }
        }
        if (!cancelled) {
          setBankCategories(categories)
          setBankCategoryNames(Array.from(categoryNameSet))
          setBankSubcategoryNames(Array.from(subcategoryNameSet))
          setBankTagNames(Array.from(tagNameSet))
        }
      } catch (err: any) {
        if (!cancelled) {
          const msg = String(err?.message || err || '')
          if (msg === 'banks_timeout' || msg === 'bank_questions_timeout') {
            setBankError('Tempo excedido ao carregar bancos/questões')
          } else {
            setBankError(err?.message || 'Erro desconhecido ao carregar banco de questões')
          }
        }
      } finally {
        if (!cancelled) setBankLoading(false)
      }
    }
    loadBanks()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FB] font-inter text-[#1E1B39]">
      {/* Header */}
      <header className="border-b border-[#E3E4E5] bg-white w-full">
        <div className="w-full px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-black hover:bg-transparent"
              onClick={() => {
                window.history.pushState({}, '', '/simulados')
                window.dispatchEvent(new PopStateEvent('popstate'))
              }}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          <div className="flex items-center gap-2">
                <span className="font-semibold text-[#1E1B39]">{isEditing ? 'Editar simulado' : 'Criar novo simulado'}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!showConfigSidebar && (
              <Button variant="outline" onClick={() => setShowConfigSidebar(true)} className="gap-2">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Configurações
              </Button>
            )}
            <Button
              className="bg-[#0047BB] hover:bg-[#003a99]"
              onClick={handleCreateSimulado}
              disabled={isSaving}
            >
              {isEditing ? 'Salvar simulado' : 'Criar simulado'}
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={async () => {
                try {
                  const ids = (selectedQuestions || []).map((q: any) => q?.id).filter(Boolean)
                  let detailed: any[] = []
                  if (ids.length > 0) {
                    try {
                      const { data: rows, error: qErr } = await supabase
                        .from('questions')
                        .select('id,title,body,metadata')
                        .in('id', ids)
                      if (!qErr && Array.isArray(rows)) {
                        const mapById = new Map(rows.map(r => [String(r.id), r]))
                        detailed = (selectedQuestions || []).map((q: any) => {
                          const row = mapById.get(String(q?.id))
                          const meta = (row?.metadata || {}) as any
                          const choicesSrc = Array.isArray(meta?.choices)
                            ? meta.choices
                            : (Array.isArray(meta?.alternatives) ? meta.alternatives : (Array.isArray(meta?.options) ? meta.options : []))

                          // Detecta índice da correta a partir de diferentes formatos de metadata
                          const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
                          const correctIndexFromMeta = (() => {
                            const v =
                              typeof meta?.correctIndex === 'number' ? meta.correctIndex :
                              typeof meta?.correct_index === 'number' ? meta.correct_index :
                              typeof meta?.answerIndex === 'number' ? meta.answerIndex :
                              typeof meta?.answer_index === 'number' ? meta.answer_index :
                              (typeof meta?.answer === 'string'
                                ? letters.indexOf(String(meta.answer).trim().toUpperCase())
                                : -1) ||
                              (typeof meta?.correct === 'string'
                                ? letters.indexOf(String(meta.correct).trim().toUpperCase())
                                : -1) ||
                              (typeof meta?.answer_label === 'string'
                                ? letters.indexOf(String(meta.answer_label).trim().toUpperCase())
                                : -1)
                            return typeof v === 'number' && v >= 0 ? v : -1
                          })()

                          function truthyFlag(val: any) {
                            if (typeof val === 'boolean') return val
                            if (typeof val === 'number') return val === 1
                            if (typeof val === 'string') {
                              const t = val.trim().toLowerCase()
                              return t === 'true' || t === '1' || t === 'yes' || t === 'sim' || t === 'y' || t === 't'
                            }
                            return false
                          }

                          function resolveSupabasePublicUrl(value: any, pathValue?: any) {
                            const base = (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_SUPABASE_URL)
                              ? String((import.meta as any).env.VITE_SUPABASE_URL)
                              : ''
                            const bucket = (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_SUPABASE_QUESTION_IMAGES_BUCKET)
                              ? String((import.meta as any).env.VITE_SUPABASE_QUESTION_IMAGES_BUCKET)
                              : 'question-images'

                            const pick = (v: any) => (typeof v === 'string' ? v.trim() : '')
                            const raw = pick(value) || pick(pathValue)
                            if (!raw) return null
                            if (raw.startsWith('data:') || raw.startsWith('blob:')) return raw
                            if (raw.startsWith('http://') || raw.startsWith('https://')) {
                              try {
                                const parsed = new URL(raw)
                                const m = parsed.pathname.match(/\/storage\/v1\/object\/sign\/([^/]+)\/(.+)$/)
                                if (m?.[1] && m?.[2]) {
                                  parsed.pathname = `/storage/v1/object/public/${m[1]}/${m[2]}`
                                  parsed.search = ''
                                  parsed.hash = ''
                                  return parsed.toString()
                                }
                              } catch {}
                              return raw
                            }
                            if (!base) return raw
                            let p = raw.replace(/^\/+/, '')
                            if (p.startsWith(`${bucket}/`)) p = p.slice(bucket.length + 1)
                            if (p.startsWith('question-images/')) p = p.slice('question-images/'.length)
                            return `${base.replace(/\/+$/, '')}/storage/v1/object/public/${bucket}/${p}`
                          }

                          const choicesMedia = (meta && typeof meta === 'object' && meta.choicesMedia && typeof meta.choicesMedia === 'object')
                            ? meta.choicesMedia
                            : {}

                          const choices = (choicesSrc || []).map((c: any, i: number) => {
                            const label = typeof c === 'string' ? c : (c?.label || c?.text || c?.name || c?.value || '')
                            const flag = typeof c === 'object'
                              ? truthyFlag(c?.is_correct) || truthyFlag(c?.correct) || truthyFlag(c?.isCorrect) || truthyFlag(c?.right) || truthyFlag(c?.correta)
                              : (correctIndexFromMeta >= 0 ? i === correctIndexFromMeta : false)
                            const media = (choicesMedia && typeof choicesMedia === 'object') ? (choicesMedia as any)[i] : null
                            const rawImageUrl = typeof c === 'object'
                              ? (c?.image_url || c?.imageUrl || c?.image || c?.img_url || c?.imgUrl || c?.photo_url || c?.photoUrl || c?.picture_url || c?.pictureUrl || null)
                              : null
                            const rawVideoUrl = typeof c === 'object'
                              ? (c?.video_url || c?.videoUrl || c?.video || c?.vimeo_url || c?.vimeoUrl || c?.youtube_url || c?.youtubeUrl || c?.media_url || c?.mediaUrl || null)
                              : null
                            const resolution = typeof c === 'object' ? (c?.resolution || c?.explanation || c?.commentary || c?.rationale || null) : null
                            const image_url = resolveSupabasePublicUrl(
                              rawImageUrl || media?.imageUrl || media?.image_url || media?.image,
                              media?.imagePath || media?.image_path,
                            )
                            const video_url = resolveSupabasePublicUrl(
                              rawVideoUrl || media?.videoUrl || media?.video_url || media?.video,
                              media?.videoPath || media?.video_path,
                            )
                            return { label, is_correct: flag, image_url, video_url, resolution }
                          })
                          const stem = (row?.body || meta?.body || meta?.text || meta?.statement || meta?.question || '') as string
                          const name = (row?.title || q?.name || String(q?.id || '')) as string
                          const rawImageUrl =
                            row?.image_url ||
                            meta?.image_url ||
                            meta?.imageUrl ||
                            meta?.question_image_url ||
                            meta?.questionImageUrl ||
                            meta?.cover_image_url ||
                            meta?.coverImageUrl ||
                            null
                          const rawImagePath =
                            row?.image_path ||
                            meta?.image_path ||
                            meta?.imagePath ||
                            meta?.question_image_path ||
                            meta?.questionImagePath ||
                            null
                          const rawVideoUrl =
                            row?.video_url ||
                            meta?.video_url ||
                            meta?.videoUrl ||
                            meta?.question_video_url ||
                            meta?.questionVideoUrl ||
                            meta?.vimeo_url ||
                            meta?.vimeoUrl ||
                            meta?.youtube_url ||
                            meta?.youtubeUrl ||
                            null
                          const rawVideoPath =
                            meta?.video_path ||
                            meta?.videoPath ||
                            meta?.question_video_path ||
                            meta?.questionVideoPath ||
                            null
                          const image_url = resolveSupabasePublicUrl(rawImageUrl, rawImagePath)
                          const video_url = resolveSupabasePublicUrl(rawVideoUrl, rawVideoPath)
                          const resolution =
                            row?.resolution ||
                            row?.explanation ||
                            meta?.resolution ||
                            meta?.resolucao ||
                            meta?.explanation ||
                            meta?.solution ||
                            meta?.commentary ||
                            meta?.answer_explanation ||
                            meta?.answerExplanation ||
                            null
                          const rawResolutionImageUrl =
                            meta?.resolution_image_url ||
                            meta?.resolutionImageUrl ||
                            meta?.resolutionImage ||
                            meta?.resolution_image ||
                            meta?.explanation_image_url ||
                            meta?.explanationImageUrl ||
                            null
                          const rawResolutionVideoUrl =
                            meta?.resolution_video_url ||
                            meta?.resolutionVideoUrl ||
                            meta?.resolutionVideo ||
                            meta?.resolution_video ||
                            meta?.explanation_video_url ||
                            meta?.explanationVideoUrl ||
                            null
                          const rawResolutionImagePath =
                            meta?.resolution_image_path ||
                            meta?.resolutionImagePath ||
                            meta?.explanation_image_path ||
                            meta?.explanationImagePath ||
                            null
                          const rawResolutionVideoPath =
                            meta?.resolution_video_path ||
                            meta?.resolutionVideoPath ||
                            meta?.explanation_video_path ||
                            meta?.explanationVideoPath ||
                            null
                          const resolution_image_url = resolveSupabasePublicUrl(rawResolutionImageUrl, rawResolutionImagePath)
                          const resolution_video_url = resolveSupabasePublicUrl(rawResolutionVideoUrl, rawResolutionVideoPath)
                          return { id: q?.id, name, stem, choices, image_url, video_url, resolution, resolution_image_url, resolution_video_url }
                        })
                      }
                    } catch (fetchErr) {
                      console.warn('Falha ao buscar detalhes das questões para preview:', fetchErr)
                    }
                  }
                  try {
                    const draft = {
                      title,
                      description,
                      accessMode,
                      isPaid: accessMode !== 'free',
                      simulationPrice,
                      availabilityDate,
                      availabilityDateDisplay,
                      availabilityEndDate,
                      availabilityEndDateDisplay,
                      simulationDuration,
                      maxGrade,
                      selectedCategories,
                      selectedSubcategories,
                      selectedTags,
                      secondChance,
                      shuffleQuestions,
                      skipQuestions,
                      allowRepeat,
                      selectedCourses: Array.isArray(selectedCourses) ? selectedCourses : [],
                      selectedQuestions: Array.isArray(selectedQuestions) ? selectedQuestions : [],
                      isEditing,
                      editId,
                      savedAt: Date.now(),
                    }
                    sessionStorage.setItem('connekt_simulado_draft', JSON.stringify(draft))
                  } catch (_) {}
                  // Persistir snapshot do simulado para o preview
                  const previewData = {
                    title: (title || '').trim(),
                    totalPoints: (() => {
                      const n = parseInt((maxGrade as any) || '0', 10)
                      if (!isNaN(n) && n > 0) return n
                      return (selectedQuestions || []).length * 2
                    })(),
                    attempts: 1 + (Boolean(secondChance) ? 1 : 0),
                    allowRepeat: Boolean(allowRepeat),
                    availabilityStartDate: String(availabilityDate || '').trim() || null,
                    availabilityEndDate: String(availabilityEndDate || '').trim() || null,
                    durationMinutes: parseInt((simulationDuration as any) || '0', 10) || 0,
                    questions: (detailed.length > 0
                      ? detailed
                      : (selectedQuestions || []).map((q: any) => ({ id: q?.id, name: q?.name || String(q?.id || ''), stem: q?.name || '', choices: [] }))
                    ),
                  }
                  localStorage.setItem('simulationPreview', JSON.stringify(previewData))
                  // Salva URL de retorno para reabrir a página que estava sendo editada
                  try {
                    const u = new URL(window.location.href)
                    u.searchParams.set('fromPreview', '1')
                    const backUrl = u.pathname + u.search
                    localStorage.setItem('simulationPreviewBackUrl', backUrl)
                  } catch {}
                } catch (err) {
                  console.warn('Falha ao salvar dados de preview:', err)
                }
                window.history.pushState({}, '', '/reposta-correta-simulado?source=preview')
                window.dispatchEvent(new PopStateEvent('popstate'))
              }}
            >
              <Eye className="h-4 w-4" />
              Preview
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1180px] flex">
        {/* Main Content Area */}
        <div className="flex flex-1 flex-col">
          <div className="flex-1">
            <div className="mx-auto w-full max-w-[950px] p-8">
              {/* Cover Section */}
              <div className="mb-8 overflow-hidden rounded-[8px] border border-[#E3E4E5] bg-white shadow-sm">
                <div className="relative h-56 overflow-hidden bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
                  <div className="absolute inset-0 opacity-30">
                    <div
                      className="absolute inset-0"
                      style={{
                        backgroundImage:
                          `radial-gradient(circle at 20px 20px, rgba(99, 102, 241, 0.15) 2px, transparent 0)`,
                        backgroundSize: "40px 40px",
                      }}
                    />
                  </div>
                  <div className="absolute right-8 top-8 h-16 w-16 rounded-full bg-gradient-to-br from-purple-400/20 to-pink-400/20 blur-2xl" />
                  <div className="absolute bottom-8 left-8 h-20 w-20 rounded-full bg-gradient-to-br from-blue-400/20 to-indigo-400/20 blur-2xl" />
                  {/* Fixed cover image positioned inside the banner */}
                  <div className="absolute bottom-8 left-8 h-24 w-24 overflow-hidden rounded-2xl bg-white shadow-xl ring-4 ring-white">
                    <img
                      src="/simulado-cover.svg"
                      alt="Imagem fixa do simulado"
                      className="h-full w-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                </div>
              {/* Título integrado na capa com foto do simulado */}
              <div className="px-8 py-8">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-[8px] bg-white shadow-sm ring-1 ring-[#F3F4F6]">
                    <img
                      src="/simulado-cover.svg"
                      alt="Foto do simulado"
                      className="h-full w-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <div className="relative flex-1">
                    <FileText className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#9291A5]" />
                    <input
                      placeholder="Digite o nome do simulado aqui"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      aria-label="Título do simulado"
                      aria-describedby="titleHelp"
                      className="h-[44px] w-full rounded-[8px] border border-[#E3E4E5] bg-white pl-10 pr-4 text-[18px] text-[#1E1B39] placeholder:text-[#9AA0A6] focus:border-[#0047BB] focus:outline-none focus:ring-2 focus:ring-[#0047BB]/20"
                    />
                  </div>
                </div>
                <p id="titleHelp" className="mt-2 flex items-center gap-1 text-[12px] text-[#9291A5]">
                  <Info className="h-4 w-4" /> Este título aparece na capa e nas listagens.
                </p>
              </div>
            </div>

            

              {/* Metadata Section - Reestruturada para combinar com a referência */}
              <div className="mb-8 rounded-[4px] border border-[#E3E4E5] bg-white p-6">
                {/* Categoria - layout conforme referência */}
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex-shrink-0 flex items-center gap-2">
                    <img src="/icons/categorias-popup.svg" alt="Categoria" width={14} height={14} className="text-gray-600" />
                    <span className="text-[14px] font-normal text-[#737780]">Categoria:</span>
                  </div>
                  <div className="flex-1 flex items-center">
                    <div className="relative dropdown-container">
                      <button
                        type="button"
                        className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
                        title="Adicionar categoria"
                        style={{ background: 'none' }}
                        onClick={() => setShowCategorySelector((v) => !v)}
                        aria-haspopup="menu"
                        aria-expanded={showCategorySelector}
                        aria-controls="categorySelectorMenu"
                      >
                        <Plus className="w-4 h-4 text-gray-600" />
                      </button>
                      <TaxonomyDropdown
                        open={showCategorySelector}
                        onOpenChange={setShowCategorySelector}
                        items={categoryItems}
                        isSelected={(item) => selectedCategories.includes(item.name)}
                        onSelect={(item) => {
                          addCategory(item.name)
                          setShowCategorySelector(false)
                        }}
                        onCreate={createCategoryFromPayload}
                        onUpdate={updateCategoryFromPayload}
                        onDelete={deleteCategoryById}
                        searchPlaceholder="Pesquisar categorias..."
                        createLabel="Criar nova categoria"
                        defaultColor="#8B5CF6"
                      />
                    </div>
                  </div>
                </div>
                <div className="text-[12px] text-[#9291A5]">Categorias que serão vinculadas:</div>
                <div className="mb-6 flex flex-wrap items-center gap-2">
                  {selectedCategories.map((c) => (
                    <span key={c} className="inline-flex items-center gap-2 rounded-full border border-[#E3E4E5] bg-white px-3 py-1 text-[12px] text-[#1E1B39]">
                <span className="h-2 w-2 rounded-[4px]" style={{ backgroundColor: (categoryMeta[c]?.color || '#D1D5DB') }} />
                      {c}
                      <button className="text-[#6B7280]" onClick={() => removeCategoryChip(c)}>×</button>
                    </span>
                  ))}
                </div>

                

                {/* Subcategoria - layout conforme referência */}
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex-shrink-0 flex items-center gap-2">
                    <img src="/icons/subcategoria-popup.svg" alt="Subcategoria" width={14} height={14} className="text-gray-600" />
                    <span className="text-[14px] font-normal text-[#737780]">Subcategoria:</span>
                  </div>
                  <div className="flex-1 flex items-center">
                    <div className="relative dropdown-container">
                      <button
                        type="button"
                        className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
                        title="Adicionar subcategoria"
                        style={{ background: 'none' }}
                        onClick={() => setShowSubcategorySelector((v) => !v)}
                        aria-haspopup="menu"
                        aria-expanded={showSubcategorySelector}
                        aria-controls="subcategorySelectorMenu"
                      >
                        <Plus className="w-4 h-4 text-gray-600" />
                      </button>
                      <TaxonomyDropdown
                        open={showSubcategorySelector}
                        onOpenChange={setShowSubcategorySelector}
                        items={subcategoryItems}
                        isSelected={(item) => selectedSubcategories.includes(item.name)}
                        onSelect={(item) => {
                          addSubcategory(item.name)
                          setShowSubcategorySelector(false)
                        }}
                        onCreate={createSubcategoryFromPayload}
                        onUpdate={updateSubcategoryFromPayload}
                        onDelete={deleteSubcategoryById}
                        searchPlaceholder="Pesquisar subcategorias..."
                        createLabel="Criar nova subcategoria"
                        defaultColor="#22C55E"
                      />
                    </div>
                  </div>
                </div>
                <div className="text-[12px] text-[#9291A5]">Subcategorias que serão vinculadas:</div>
                <div className="mb-6 flex flex-wrap items-center gap-2">
                  {selectedSubcategories.map((s) => (
                    <span key={s} className="inline-flex items-center gap-2 rounded-full border border-[#E3E4E5] bg-white px-3 py-1 text-[12px] text-[#1E1B39]">
                      <span className="h-2 w-2 rounded-[4px]" style={{ backgroundColor: (subcategoryMeta[s]?.color || '#D1D5DB') }} />
                      {s}
                      <button className="text-[#6B7280]" onClick={() => removeSubcategoryChip(s)}>×</button>
                    </span>
                  ))}
                </div>

                {/* Tags - layout conforme referência */}
                <div className="mb-6 mt-2 flex flex-col">
                  <div className="flex items-center gap-2">
                    <img src="/icons/tag-popup.svg" alt="Tags" width={14} height={14} className="text-gray-600" />
                    <span className="text-[14px] font-normal text-[#737780]">Tags:</span>
                    <div className="relative dropdown-container">
                      <button
                        type="button"
                        className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
                        title="Adicionar tag"
                        style={{ background: 'none' }}
                        onClick={() => setShowTagSelector((v) => !v)}
                        aria-haspopup="menu"
                        aria-expanded={showTagSelector}
                        aria-controls="tagSelectorMenu"
                      >
                        <Plus className="w-4 h-4 text-gray-600" />
                      </button>
                      <TaxonomyDropdown
                        open={showTagSelector}
                        onOpenChange={setShowTagSelector}
                        items={tagItems}
                        isSelected={(item) => selectedTags.includes(item.name)}
                        onSelect={(item) => {
                          addTag(item.name)
                          setShowTagSelector(false)
                        }}
                        onCreate={createTagFromPayload}
                        onUpdate={updateTagFromPayload}
                        onDelete={deleteTagById}
                        searchPlaceholder="Pesquisar tags..."
                        createLabel="Criar nova tag"
                        defaultColor="#EF4444"
                      />
                    </div>
                  </div>
                  <div className="mt-1 text-[12px] text-[#9291A5]">Tags que serão vinculadas:</div>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {selectedTags.map((t) => (
                      <span key={t} className="inline-flex items-center gap-2 rounded-full border border-[#E3E4E5] bg-white px-3 py-1 text-[12px] text-[#1E1B39]">
                        <span className="h-2 w-2 rounded-[4px]" style={{ backgroundColor: (tagMeta[t]?.color || '#D1D5DB') }} />
                        {t}
                        <button className="text-[#6B7280]" onClick={() => removeTagChip(t)}>×</button>
                      </span>
                    ))}
                  </div>
                </div>
                <div className="mt-6">
                  <label className="text-[12px] font-medium text-[#737780]">Descrição</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="mt-1 w-full rounded-[4px] border border-[#E3E4E5] bg-white p-3 text-[12px] text-[#1E1B39] placeholder:text-[#ABADB3] focus:border-[#0047BB] focus:outline-none"
                    rows={3}
                    placeholder="Descreva o objetivo e conteúdo do simulado..."
                  />
                </div>
              </div>

              {/* Pagamento e Disponibilidade */}
              <div className="mb-8">
                <h3 className="mb-1 flex items-center gap-2 text-[14px] font-bold text-[#1E1B39]">Pagamento e Disponibilidade</h3>
                <p className="mb-4 flex items-center gap-1 text-[12px] text-[#9291A5]">
                  <Info className="h-4 w-4" /> Defina acesso (gratuito, pago ou gratuito para alunos do curso) e quando estará disponível.
                </p>
                <div className="rounded-[4px] border border-[#E3E4E5] bg-white p-6">
                  <div className="mb-2 text-[12px] font-medium text-[#737780]">Tipo de simulado</div>
                  <div className="mb-4 grid gap-3 sm:grid-cols-3">
                    <button
                      className={`rounded-[4px] border p-4 text-left ${accessMode === 'free' ? "border-[#0047BB] bg-[#0047BB]/5" : "border-[#E3E4E5]"}`}
                      onClick={() => setAccessMode('free')}
                    >
                      <div className="flex items-center gap-2 text-[12px] font-semibold text-[#1E1B39]"><BadgeCheck className="h-4 w-4 text-[#0047BB]" /> Gratuito</div>
                      <div className="text-[12px] text-[#9291A5]">Disponível para todos os alunos sem custo</div>
                    </button>
                    <button
                      className={`rounded-[4px] border p-4 text-left ${accessMode === 'course_students_free' ? "border-[#0047BB] bg-[#0047BB]/5" : "border-[#E3E4E5]"}`}
                      onClick={() => setAccessMode('course_students_free')}
                    >
                      <div className="flex items-center gap-2 text-[12px] font-semibold text-[#1E1B39]"><Users className="h-4 w-4 text-[#0047BB]" /> Alunos do curso</div>
                      <div className="text-[12px] text-[#9291A5]">Gratuito para quem tem acesso ao curso (demais pagam)</div>
                    </button>
                    <button
                      className={`rounded-[4px] border p-4 text-left ${accessMode === 'paid' ? "border-[#0047BB] bg-[#0047BB]/5" : "border-[#E3E4E5]"}`}
                      onClick={() => setAccessMode('paid')}
                    >
                      <div className="flex items-center gap-2 text-[12px] font-semibold text-[#1E1B39]"><CreditCard className="h-4 w-4 text-[#0047BB]" /> Pago</div>
                      <div className="text-[12px] text-[#9291A5]">Requer pagamento para acessar o simulado</div>
                    </button>
                  </div>
                  {accessMode !== 'free' && (
                    <div className="mb-4">
                      <div
                        className="flex h-[40px] items-center rounded-[6px] border border-[#E3E4E5] bg-white px-2 hover:border-[#D1D5DB] focus-within:border-[#0047BB]"
                        aria-label="Preço do simulado"
                        aria-describedby="priceHelp"
                      >
                        <DollarSign className="mr-2 h-4 w-4 text-[#9291A5]" />
                        <span className="mr-2 text-[12px] text-[#737780]">R$</span>
                        <input
                          value={simulationPrice}
                          onChange={(e) => setSimulationPrice(e.target.value)}
                          className="w-40 bg-transparent text-[12px] text-[#1E1B39] outline-none placeholder:text-[#ABADB3]"
                          placeholder="0,00"
                        />
                      </div>
                      <div id="priceHelp" className="mt-1 text-[11px] text-[#9291A5]">
                        {accessMode === 'paid'
                          ? 'Informe o valor do simulado.'
                          : 'Opcional: defina um valor para vender para quem não é aluno dos cursos selecionados. Use 0,00 para restringir apenas a alunos.'}
                      </div>
                    </div>
                  )}
                  {accessMode === 'course_students_free' ? (
                    <div className="mb-4 flex items-center justify-between rounded-[6px] border border-[#E3E4E5] bg-[#F9FAFB] px-3 py-2">
                      <div className="text-[12px] text-[#1E1B39]">
                        Cursos selecionados: <span className={selectedCourses.length ? 'font-semibold' : 'font-semibold text-[#B91C1C]'}>{selectedCourses.length}</span>
                      </div>
                      <button
                        type="button"
                        className="text-[12px] font-semibold text-[#0047BB] hover:underline"
                        onClick={() => {
                          try {
                            document.getElementById('simulado-courses-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                          } catch (_) {}
                        }}
                      >
                        Selecionar cursos
                      </button>
                    </div>
                  ) : null}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="availabilityDate" className="text-[12px] text-[#737780]">Data de Disponibilidade</label>
                      <div
                        ref={availabilityPickerWrapRef}
                        className="mt-2 relative flex h-[40px] items-center rounded-[6px] border border-[#E3E4E5] bg-white px-2 hover:border-[#D1D5DB] focus-within:border-[#0047BB]"
                        onClick={(e) => {
                          const t = e.target as any
                          if (availabilityPickerOpen && t?.closest?.('[data-availability-picker-panel="1"]')) return
                          availabilityDateRef.current?.focus()
                          openAvailabilityPicker('start')
                        }}
                      >
                        <Calendar
                          className="mr-2 h-4 w-4 cursor-pointer text-[#9291A5]"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            availabilityDateRef.current?.focus()
                            openAvailabilityPicker('start')
                          }}
                        />
                        <input
                          id="availabilityDate"
                          ref={availabilityDateRef}
                          type="text"
                          inputMode="numeric"
                          value={availabilityDateDisplay}
                          onChange={(e) => {
                            const formatted = formatBrDateInput(e.target.value)
                            setAvailabilityDateDisplay(formatted)
                            const iso = parseBrDateToIso(formatted)
                            if (iso) setAvailabilityDate(iso)
                          }}
                          onBlur={() => {
                            if (availabilityPickerOpen) return
                            const iso = parseBrDateToIso(availabilityDateDisplay)
                            if (!availabilityDateDisplay) {
                              setAvailabilityDate("")
                              return
                            }
                            if (!iso) {
                              toast({ title: "Data inválida", description: "Use o formato dd/mm/aaaa.", variant: "destructive" })
                              return
                            }
                            const todayIso = getTodayIsoLocal()
                            if (iso < todayIso) {
                              toast({ title: "Data inválida", description: "Escolha uma data a partir de hoje.", variant: "destructive" })
                              setAvailabilityDate(todayIso)
                              setAvailabilityDateDisplay(todayIso.split("-").reverse().join("/"))
                              return
                            }
                            setAvailabilityDate(iso)
                          }}
                          placeholder="dd/mm/aaaa"
                          className="w-full bg-transparent text-[12px] text-[#1E1B39] outline-none placeholder:text-[#ABADB3]"
                          aria-label="Data de disponibilidade"
                          aria-describedby="availabilityHelp"
                        />
                        {availabilityPickerOpen && availabilityPickerMode === 'start' ? (
                          <div
                            data-availability-picker-panel="1"
                            className="absolute left-0 top-full mt-2 z-50 w-[296px] rounded-[10px] border border-[#E3E4E5] bg-white p-3 shadow-lg"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            role="dialog"
                            aria-label="Selecionar data"
                          >
                            <div className="flex items-center justify-between">
                              <button
                                type="button"
                                className="h-8 w-8 inline-flex items-center justify-center rounded-[8px] border border-[#E3E4E5] bg-white hover:bg-[#F9FAFB]"
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  setAvailabilityPickerMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
                                }}
                                aria-label="Mês anterior"
                              >
                                <ChevronLeft className="h-4 w-4 text-[#22252B]" />
                              </button>
                              <div className="text-[12px] font-semibold text-[#22252B] capitalize">
                                {formatMonthYearPtBR(availabilityPickerMonth)}
                              </div>
                              <button
                                type="button"
                                className="h-8 w-8 inline-flex items-center justify-center rounded-[8px] border border-[#E3E4E5] bg-white hover:bg-[#F9FAFB]"
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  setAvailabilityPickerMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
                                }}
                                aria-label="Próximo mês"
                              >
                                <ChevronRight className="h-4 w-4 text-[#22252B]" />
                              </button>
                            </div>

                            <div className="mt-3 grid grid-cols-7 gap-1 text-[10px] text-[#737780]">
                              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
                                <div key={d} className="text-center">{d}</div>
                              ))}
                            </div>

                            <div className="mt-1 grid grid-cols-7 gap-1">
                              {(() => {
                                const y = availabilityPickerMonth.getFullYear()
                                const m = availabilityPickerMonth.getMonth()
                                const firstDow = new Date(y, m, 1).getDay()
                                const daysInMonth = new Date(y, m + 1, 0).getDate()
                                const todayIso = getTodayIsoLocal()
                                const selectedIso = String(availabilityDate || '').trim()
                                const start = 1 - firstDow
                                const cells = Array.from({ length: 42 }, (_, i) => start + i)
                                return cells.map((day, idx) => {
                                  if (day < 1 || day > daysInMonth) return <div key={idx} className="h-9" />
                                  const iso = `${y}-${pad2(m + 1)}-${pad2(day)}`
                                  const disabled = iso < todayIso
                                  const isSelected = selectedIso === iso
                                  const isToday = iso === todayIso
                                  const cls = (() => {
                                    if (disabled) return 'text-[#C4C7CF] cursor-not-allowed'
                                    if (isSelected) return 'bg-[#0047BB] text-white'
                                    if (isToday) return 'border border-[#0047BB] text-[#0047BB]'
                                    return 'hover:bg-[#F3F4F6] text-[#22252B]'
                                  })()
                                  return (
                                    <button
                                      key={idx}
                                      type="button"
                                      disabled={disabled}
                                      className={`h-9 rounded-[8px] text-[12px] font-medium ${cls}`}
                                      onClick={() => {
                                        setAvailabilityFromIso(iso, 'start')
                                        setAvailabilityPickerOpen(false)
                                      }}
                                      aria-label={`Dia ${day}`}
                                    >
                                      {day}
                                    </button>
                                  )
                                })
                              })()}
                            </div>
                          </div>
                        ) : null}
                      </div>
                      <div id="availabilityHelp" className="mt-1 text-[11px] text-[#9291A5]">Data inicial em que o simulado ficará acessível.</div>
                    </div>
                    <div>
                      <label htmlFor="availabilityEndDate" className="text-[12px] text-[#737780]">Data final (opcional)</label>
                      <div
                        ref={availabilityEndPickerWrapRef}
                        className="mt-2 relative flex h-[40px] items-center rounded-[6px] border border-[#E3E4E5] bg-white px-2 hover:border-[#D1D5DB] focus-within:border-[#0047BB]"
                        onClick={(e) => {
                          const t = e.target as any
                          if (availabilityPickerOpen && t?.closest?.('[data-availability-picker-panel="1"]')) return
                          availabilityEndDateRef.current?.focus()
                          openAvailabilityPicker('end')
                        }}
                      >
                        <Calendar
                          className="mr-2 h-4 w-4 cursor-pointer text-[#9291A5]"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            availabilityEndDateRef.current?.focus()
                            openAvailabilityPicker('end')
                          }}
                        />
                        <input
                          id="availabilityEndDate"
                          ref={availabilityEndDateRef}
                          type="text"
                          inputMode="numeric"
                          value={availabilityEndDateDisplay}
                          onChange={(e) => {
                            const formatted = formatBrDateInput(e.target.value)
                            setAvailabilityEndDateDisplay(formatted)
                            const iso = parseBrDateToIso(formatted)
                            if (iso) setAvailabilityEndDate(iso)
                          }}
                          onBlur={() => {
                            if (availabilityPickerOpen) return
                            const iso = parseBrDateToIso(availabilityEndDateDisplay)
                            if (!availabilityEndDateDisplay) {
                              setAvailabilityEndDate("")
                              return
                            }
                            if (!iso) {
                              toast({ title: "Data inválida", description: "Use o formato dd/mm/aaaa.", variant: "destructive" })
                              return
                            }
                            const todayIso = getTodayIsoLocal()
                            const minIso = availabilityDate ? (availabilityDate < todayIso ? todayIso : availabilityDate) : todayIso
                            if (iso < minIso) {
                              toast({ title: "Data inválida", description: "Escolha uma data igual ou posterior ao início.", variant: "destructive" })
                              setAvailabilityEndDate(minIso)
                              setAvailabilityEndDateDisplay(minIso.split("-").reverse().join("/"))
                              return
                            }
                            setAvailabilityEndDate(iso)
                          }}
                          placeholder="dd/mm/aaaa"
                          className="w-full bg-transparent text-[12px] text-[#1E1B39] outline-none placeholder:text-[#ABADB3]"
                          aria-label="Data final do simulado"
                          aria-describedby="availabilityEndHelp"
                        />
                        {availabilityPickerOpen && availabilityPickerMode === 'end' ? (
                          <div
                            data-availability-picker-panel="1"
                            className="absolute left-0 top-full mt-2 z-50 w-[296px] rounded-[10px] border border-[#E3E4E5] bg-white p-3 shadow-lg"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            role="dialog"
                            aria-label="Selecionar data"
                          >
                            <div className="flex items-center justify-between">
                              <button
                                type="button"
                                className="h-8 w-8 inline-flex items-center justify-center rounded-[8px] border border-[#E3E4E5] bg-white hover:bg-[#F9FAFB]"
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  setAvailabilityPickerMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
                                }}
                                aria-label="Mês anterior"
                              >
                                <ChevronLeft className="h-4 w-4 text-[#22252B]" />
                              </button>
                              <div className="text-[12px] font-semibold text-[#22252B] capitalize">
                                {formatMonthYearPtBR(availabilityPickerMonth)}
                              </div>
                              <button
                                type="button"
                                className="h-8 w-8 inline-flex items-center justify-center rounded-[8px] border border-[#E3E4E5] bg-white hover:bg-[#F9FAFB]"
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  setAvailabilityPickerMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
                                }}
                                aria-label="Próximo mês"
                              >
                                <ChevronRight className="h-4 w-4 text-[#22252B]" />
                              </button>
                            </div>

                            <div className="mt-3 grid grid-cols-7 gap-1 text-[10px] text-[#737780]">
                              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
                                <div key={d} className="text-center">{d}</div>
                              ))}
                            </div>

                            <div className="mt-1 grid grid-cols-7 gap-1">
                              {(() => {
                                const y = availabilityPickerMonth.getFullYear()
                                const m = availabilityPickerMonth.getMonth()
                                const firstDow = new Date(y, m, 1).getDay()
                                const daysInMonth = new Date(y, m + 1, 0).getDate()
                                const todayIso = getTodayIsoLocal()
                                const minIso = availabilityDate ? (availabilityDate < todayIso ? todayIso : availabilityDate) : todayIso
                                const selectedIso = String(availabilityEndDate || '').trim()
                                const start = 1 - firstDow
                                const cells = Array.from({ length: 42 }, (_, i) => start + i)
                                return cells.map((day, idx) => {
                                  if (day < 1 || day > daysInMonth) return <div key={idx} className="h-9" />
                                  const iso = `${y}-${pad2(m + 1)}-${pad2(day)}`
                                  const disabled = iso < minIso
                                  const isSelected = selectedIso === iso
                                  const isToday = iso === todayIso
                                  const cls = (() => {
                                    if (disabled) return 'text-[#C4C7CF] cursor-not-allowed'
                                    if (isSelected) return 'bg-[#0047BB] text-white'
                                    if (isToday) return 'border border-[#0047BB] text-[#0047BB]'
                                    return 'hover:bg-[#F3F4F6] text-[#22252B]'
                                  })()
                                  return (
                                    <button
                                      key={idx}
                                      type="button"
                                      disabled={disabled}
                                      className={`h-9 rounded-[8px] text-[12px] font-medium ${cls}`}
                                      onClick={() => {
                                        setAvailabilityFromIso(iso, 'end')
                                        setAvailabilityPickerOpen(false)
                                      }}
                                      aria-label={`Dia ${day}`}
                                    >
                                      {day}
                                    </button>
                                  )
                                })
                              })()}
                            </div>
                          </div>
                        ) : null}
                      </div>
                      <div id="availabilityEndHelp" className="mt-1 text-[11px] text-[#9291A5]">Data final em que o simulado ficará acessível.</div>
                    </div>
                    <div>
                      <label htmlFor="simulationDuration" className="text-[12px] text-[#737780]">Duração do Simulado</label>
                      <div
                        className="mt-2 flex h-[40px] items-center rounded-[6px] border border-[#E3E4E5] bg-white px-2 py-2 hover:border-[#D1D5DB] focus-within:border-[#0047BB]"
                        onClick={() => simulationDurationRef.current?.focus()}
                        title="Duração em minutos"
                        role="group"
                        aria-label="Duração do simulado"
                      >
                        <Clock
                          className="mr-2 h-4 w-4 cursor-pointer text-[#9291A5]"
                          onClick={() => simulationDurationRef.current?.focus()}
                        />
                        <input
                          id="simulationDuration"
                          ref={simulationDurationRef}
                          type="number"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          min={0}
                          step={1}
                          value={simulationDuration}
                          onChange={handleSimulationDurationChange}
                          className="w-28 bg-transparent text-[12px] text-[#1E1B39] outline-none placeholder:text-[#ABADB3]"
                          placeholder="0"
                          aria-label="Duração do simulado em minutos"
                          aria-describedby="durationHelp"
                        />
                        <div className="ml-2 flex items-center gap-1">
                          <button
                            type="button"
                            aria-label="Diminuir duração"
                            className="inline-flex h-6 w-6 items-center justify-center rounded border border-[#E3E4E5] text-[#1E1B39] transition-colors hover:bg-[#F3F4F6]"
                            onClick={() => decrementDuration()}
                            disabled={parseInt(simulationDuration || "0", 10) <= 0}
                            title="Diminuir 5 minutos"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            aria-label="Aumentar duração"
                            className="inline-flex h-6 w-6 items-center justify-center rounded border border-[#E3E4E5] text-[#1E1B39] transition-colors hover:bg-[#F3F4F6]"
                            onClick={() => incrementDuration()}
                            title="Aumentar 5 minutos"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <span className="ml-2 text-[12px] text-[#9291A5]">minutos</span>
                      </div>
                      <div id="durationHelp" className="mt-1 text-[11px] text-[#9291A5]">Sugestão: 30–180 minutos</div>
                    </div>
                    <div>
                      <label htmlFor="maxGrade" className="text-[12px] text-[#737780]">Nota Máxima</label>
                      <div
                        className="mt-2 flex h-[40px] items-center rounded-[6px] border border-[#E3E4E5] bg-white px-2 hover:border-[#D1D5DB] focus-within:border-[#0047BB]"
                        onClick={() => maxGradeRef.current?.focus()}
                      >
                        <Award
                          className="mr-2 h-4 w-4 cursor-pointer text-[#9291A5]"
                          onClick={() => maxGradeRef.current?.focus()}
                        />
                        <input
                          id="maxGrade"
                          ref={maxGradeRef}
                          type="number"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          min={1}
                          step={1}
                          value={maxGrade}
                          onChange={handleMaxGradeChange}
                          className="w-24 bg-transparent text-[12px] text-[#1E1B39] outline-none placeholder:text-[#ABADB3]"
                          placeholder="100"
                          aria-label="Nota máxima do simulado"
                          aria-describedby="maxGradeHelp"
                        />
                        <span className="ml-2 text-[12px] text-[#9291A5]">pontos</span>
                      </div>
                      <div id="maxGradeHelp" className="mt-1 text-[11px] text-[#9291A5]">Exemplo: 100 pontos. Ajuste conforme seu critério.</div>
                    </div>
                  </div>
                </div>
              </div>

              <div id="simulado-courses-section" className="mb-8 overflow-hidden rounded-[8px] border border-[#E3E4E5] bg-white shadow-sm">
                <div className="flex items-center justify-between px-6 py-4">
                  <h3 className="flex items-center gap-2 text-[12px] font-bold text-[#1E1B39]">
                    <BookOpen className="h-4 w-4" /> Cursos
                  </h3>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 rounded-[4px] border border-[#E3E4E5] bg-white px-2 py-1">
                      <Search className="h-4 w-4 text-[#9291A5]" />
                      <input
                        value={courseSearchQuery}
                        onChange={(e) => setCourseSearchQuery(e.target.value)}
                        placeholder="Buscar curso"
                        className="bg-transparent text-[12px] text-[#1E1B39] placeholder:text-[#ABADB3] outline-none"
                      />
                    </div>
                    {(courseFilterCategoryIds.length > 0 || courseFilterSubcategoryIds.length > 0 || courseFilterTagIds.length > 0) ? (
                      <button
                        type="button"
                        className="text-[11px] font-semibold text-[#0047BB] hover:underline"
                        onClick={() => {
                          setCourseFilterCategoryIds([])
                          setCourseFilterSubcategoryIds([])
                          setCourseFilterTagIds([])
                          setCourseFilterPickerOpen(null)
                        }}
                      >
                        Limpar filtros
                      </button>
                    ) : null}

                    <div className="relative">
                      <button
                        type="button"
                        className="h-7 px-2 rounded-md border border-[#E3E4E5] bg-white text-[11px] font-semibold text-[#1E1B39] hover:bg-[#F9FAFB]"
                        onClick={() => setCourseFilterPickerOpen((prev) => (prev === 'category' ? null : 'category'))}
                      >
                        Categoria{courseFilterCategoryIds.length ? ` (${courseFilterCategoryIds.length})` : ''}
                      </button>
                      <TaxonomyDropdown
                        open={courseFilterPickerOpen === 'category'}
                        onOpenChange={(open) => setCourseFilterPickerOpen(open ? 'category' : null)}
                        items={categoryItems}
                        onSelect={(item) => {
                          const id = String(item?.id || '').trim()
                          if (!id) return
                          setCourseFilterCategoryIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
                        }}
                        isSelected={(item) => courseFilterCategoryIds.includes(String(item?.id))}
                        searchPlaceholder="Filtrar por categoria"
                        createLabel="Criar"
                        defaultColor="#8B5CF6"
                        align="end"
                      />
                    </div>

                    <div className="relative">
                      <button
                        type="button"
                        className="h-7 px-2 rounded-md border border-[#E3E4E5] bg-white text-[11px] font-semibold text-[#1E1B39] hover:bg-[#F9FAFB]"
                        onClick={() => setCourseFilterPickerOpen((prev) => (prev === 'subcategory' ? null : 'subcategory'))}
                      >
                        Sub{courseFilterSubcategoryIds.length ? ` (${courseFilterSubcategoryIds.length})` : ''}
                      </button>
                      <TaxonomyDropdown
                        open={courseFilterPickerOpen === 'subcategory'}
                        onOpenChange={(open) => setCourseFilterPickerOpen(open ? 'subcategory' : null)}
                        items={subcategoryItems}
                        onSelect={(item) => {
                          const id = String(item?.id || '').trim()
                          if (!id) return
                          setCourseFilterSubcategoryIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
                        }}
                        isSelected={(item) => courseFilterSubcategoryIds.includes(String(item?.id))}
                        searchPlaceholder="Filtrar por subcategoria"
                        createLabel="Criar"
                        defaultColor="#22C55E"
                        align="end"
                      />
                    </div>

                    <div className="relative">
                      <button
                        type="button"
                        className="h-7 px-2 rounded-md border border-[#E3E4E5] bg-white text-[11px] font-semibold text-[#1E1B39] hover:bg-[#F9FAFB]"
                        onClick={() => setCourseFilterPickerOpen((prev) => (prev === 'tag' ? null : 'tag'))}
                      >
                        Tags{courseFilterTagIds.length ? ` (${courseFilterTagIds.length})` : ''}
                      </button>
                      <TaxonomyDropdown
                        open={courseFilterPickerOpen === 'tag'}
                        onOpenChange={(open) => setCourseFilterPickerOpen(open ? 'tag' : null)}
                        items={tagItems}
                        onSelect={(item) => {
                          const id = String(item?.id || '').trim()
                          if (!id) return
                          setCourseFilterTagIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
                        }}
                        isSelected={(item) => courseFilterTagIds.includes(String(item?.id))}
                        searchPlaceholder="Filtrar por tag"
                        createLabel="Criar"
                        defaultColor="#EF4444"
                        align="end"
                      />
                    </div>
                  </div>
                </div>
                <div className="px-6 pb-6 pt-0">
                  <span className="flex items-center gap-2 text-[11px] text-[#737780]">
                    <Users className="h-3 w-3 text-[#9291A5]" />
                    Acesso: alunos dos cursos selecionados
                  </span>

                  <div className="mt-3 grid items-start gap-4 grid-cols-1">
                    <div className="rounded-[6px] bg-[#F9FAFB] p-3 min-h-[120px]">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="flex items-center gap-2 text-[12px] font-medium text-[#1E1B39]">Selecionados</span>
                        {selectedCourses.length > 0 && (
                          <button
                            className="ml-auto text-[11px] text-[#9291A5] hover:text-[#6D28D9]"
                            onClick={clearSelectedCourses}
                          >
                            Remover todos
                          </button>
                        )}
                      </div>

                      {selectedCourses.length === 0 ? (
                        <div className="flex items-center justify-center gap-2 rounded-[6px] border border-dashed border-[#E3E4E5] bg-white px-3 py-4 text-[12px] text-[#9291A5]">
                          <BookOpen className="h-4 w-4 text-[#9291A5]" />
                          <div className="text-center">
                            <div>Nenhum curso selecionado.</div>
                            <div className="text-[11px] text-[#ABADB3]">Use a lista abaixo para adicionar.</div>
                          </div>
                        </div>
                      ) : (
                        <div role="list" aria-label="Cursos selecionados" className="flex max-h-24 flex-wrap gap-1.5 overflow-auto pr-1">
                          {selectedCourses.map((course) => (
                            <span
                              key={course.id}
                              title={course.name}
                              role="listitem"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === "Delete" || e.key === "Backspace") {
                                  removeCourse(course.id)
                                }
                              }}
                              className="group inline-flex cursor-default select-none items-center gap-1.5 rounded-full border border-[#E3E4E5] bg-white px-2 py-1 text-[11px] leading-none text-[#1E1B39] transition-colors hover:border-[#D1D5DB] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#6D28D9]"
                            >
                              <span className="max-w-[210px] truncate">{course.name}</span>
                              <button
                                aria-label={`Remover ${course.name}`}
                                className="ml-0.5 inline-flex h-3.5 w-3.5 items-center justify-center text-[#6B7280] transition-opacity opacity-80 group-hover:opacity-100 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8]"
                                onClick={() => removeCourse(course.id)}
                              >
                                <X className="h-3 w-3 text-[#6B7280]" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="overflow-hidden">
                      {producerCoursesLoading ? (
                        <div className="flex items-center gap-2 px-3 py-3 text-[12px] text-[#9291A5]">
                          <span className="inline-flex h-3 w-3 animate-pulse rounded-full bg-[#9CA3AF]" />
                          Carregando cursos...
                        </div>
                      ) : producerCoursesError ? (
                        <div className="flex items-center gap-2 px-3 py-3 text-[12px] text-[#B91C1C]">
                          Erro ao carregar cursos: {producerCoursesError}
                        </div>
                      ) : filteredCourses.length === 0 ? (
                        <div className="flex items-center gap-2 px-3 py-3 text-[12px] text-[#9291A5]">
                          <Search className="h-4 w-4 text-[#9291A5]" />
                          <div>
                            <div>Nenhum curso encontrado.</div>
                            <div className="text-[11px] text-[#ABADB3]">Ajuste a busca ou verifique o catálogo.</div>
                          </div>
                        </div>
                      ) : (
                        <div className="divide-y divide-[#E3E4E5]">
                          {filteredCourses.map((course) => {
                            const isSelected = selectedCourses.some((c) => c.id === course.id)
                            return (
                              <div
                                key={course.id}
                                className={`group flex items-center justify-between rounded-[4px] border border-[#E3E4E5] border-l-[3px] border-l-[#EDE9FE] bg-white p-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] ${!isSelected ? 'hover:bg-[#F8FAFC] hover:shadow-sm cursor-pointer' : ''}`}
                                role={!isSelected ? 'button' : undefined}
                                tabIndex={!isSelected ? 0 : -1}
                                onKeyDown={!isSelected ? (e) => { if (e.key === 'Enter' || e.key === ' ') addCourse(course) } : undefined}
                                onClick={!isSelected ? () => addCourse(course) : undefined}
                              >
                                <span className="flex items-center gap-2 text-[13px] font-medium text-[#1E1B39]">
                                  <Layers className="h-4 w-4 text-[#9291A5]" /> {course.name}
                                </span>
                                {isSelected ? (
                                  <div className="inline-flex items-center gap-2">
                                    <span className="inline-flex items-center gap-1 rounded-[4px] bg-[#E9FFEF] px-2 py-1 text-[12px] text-[#06C270]">
                                      <Check className="h-3 w-3 text-[#06C270]" /> Adicionado
                                    </span>
                                    <button
                                      aria-label={`Remover ${course.name}`}
                                      className="inline-flex items-center gap-1 rounded-[4px] bg-[#FEF2F2] px-2 py-1 text-[12px] text-[#EF4444] hover:bg-[#FEE2E2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF4444]"
                                      onClick={(e) => { e.stopPropagation(); removeCourse(course.id) }}
                                    >
                                      <X className="h-3 w-3 text-[#EF4444]" /> Remover
                                    </button>
                                  </div>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1 h-7 px-2 border-[#E3E4E5] bg-white hover:bg-[#EEF2FF]"
                                    aria-label={`Adicionar ${course.name}`}
                                    onClick={(e) => { e.stopPropagation(); addCourse(course) }}
                                  >
                                    <Plus className="h-3 w-3 text-[#1E1B39]" /> Adicionar
                                  </Button>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Question Selection Section (Unified Card) */}
              <div className="rounded-[4px] border border-[#E3E4E5] bg-white">
                <div className="p-4">
                  {/* Left Column: Question Bank */}
                  <div ref={questionBankSectionRef}>
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="flex items-center gap-2 text-[12px] font-semibold text-[#1E1B39]"><Database className="h-4 w-4" /> Banco de questões</h4>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 rounded-[4px] border border-[#E3E4E5] bg-white px-2 py-1">
                          <Search className="h-4 w-4 text-[#9291A5]" />
                          <input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Buscar questão"
                            className="bg-transparent text-[12px] text-[#1E1B39] placeholder:text-[#ABADB3] outline-none"
                          />
                        </div>
                        {(bankFilterCategoryIds.length > 0 || bankFilterSubcategoryIds.length > 0 || bankFilterTagIds.length > 0) ? (
                          <button
                            type="button"
                            className="text-[11px] font-semibold text-[#0047BB] hover:underline"
                            onClick={() => {
                              setBankFilterCategoryIds([])
                              setBankFilterSubcategoryIds([])
                              setBankFilterTagIds([])
                              setBankFilterPickerOpen(null)
                            }}
                          >
                            Limpar filtros
                          </button>
                        ) : null}

                        <div className="relative">
                          <button
                            type="button"
                            className="h-7 px-2 rounded-md border border-[#E3E4E5] bg-white text-[11px] font-semibold text-[#1E1B39] hover:bg-[#F9FAFB]"
                            onClick={() => setBankFilterPickerOpen((prev) => (prev?.scope === 'top' && prev?.kind === 'category' ? null : { scope: 'top', kind: 'category' }))}
                          >
                            Categoria{bankFilterCategoryIds.length ? ` (${bankFilterCategoryIds.length})` : ''}
                          </button>
                          <TaxonomyDropdown
                            open={bankFilterPickerOpen?.scope === 'top' && bankFilterPickerOpen?.kind === 'category'}
                            onOpenChange={(open) => setBankFilterPickerOpen(open ? { scope: 'top', kind: 'category' } : null)}
                            items={categoryItems}
                            onSelect={(item) => {
                              const id = String(item?.id || '').trim()
                              if (!id) return
                              setBankFilterCategoryIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
                            }}
                            isSelected={(item) => bankFilterCategoryIds.includes(String(item?.id))}
                            searchPlaceholder="Filtrar por categoria"
                            createLabel="Criar"
                            defaultColor="#8B5CF6"
                            align="end"
                          />
                        </div>

                        <div className="relative">
                          <button
                            type="button"
                            className="h-7 px-2 rounded-md border border-[#E3E4E5] bg-white text-[11px] font-semibold text-[#1E1B39] hover:bg-[#F9FAFB]"
                            onClick={() => setBankFilterPickerOpen((prev) => (prev?.scope === 'top' && prev?.kind === 'subcategory' ? null : { scope: 'top', kind: 'subcategory' }))}
                          >
                            Sub{bankFilterSubcategoryIds.length ? ` (${bankFilterSubcategoryIds.length})` : ''}
                          </button>
                          <TaxonomyDropdown
                            open={bankFilterPickerOpen?.scope === 'top' && bankFilterPickerOpen?.kind === 'subcategory'}
                            onOpenChange={(open) => setBankFilterPickerOpen(open ? { scope: 'top', kind: 'subcategory' } : null)}
                            items={subcategoryItems}
                            onSelect={(item) => {
                              const id = String(item?.id || '').trim()
                              if (!id) return
                              setBankFilterSubcategoryIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
                            }}
                            isSelected={(item) => bankFilterSubcategoryIds.includes(String(item?.id))}
                            searchPlaceholder="Filtrar por subcategoria"
                            createLabel="Criar"
                            defaultColor="#22C55E"
                            align="end"
                          />
                        </div>

                        <div className="relative">
                          <button
                            type="button"
                            className="h-7 px-2 rounded-md border border-[#E3E4E5] bg-white text-[11px] font-semibold text-[#1E1B39] hover:bg-[#F9FAFB]"
                            onClick={() => setBankFilterPickerOpen((prev) => (prev?.scope === 'top' && prev?.kind === 'tag' ? null : { scope: 'top', kind: 'tag' }))}
                          >
                            Tags{bankFilterTagIds.length ? ` (${bankFilterTagIds.length})` : ''}
                          </button>
                          <TaxonomyDropdown
                            open={bankFilterPickerOpen?.scope === 'top' && bankFilterPickerOpen?.kind === 'tag'}
                            onOpenChange={(open) => setBankFilterPickerOpen(open ? { scope: 'top', kind: 'tag' } : null)}
                            items={tagItems}
                            onSelect={(item) => {
                              const id = String(item?.id || '').trim()
                              if (!id) return
                              setBankFilterTagIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
                            }}
                            isSelected={(item) => bankFilterTagIds.includes(String(item?.id))}
                            searchPlaceholder="Filtrar por tag"
                            createLabel="Criar"
                            defaultColor="#EF4444"
                            align="end"
                          />
                        </div>
                      </div>
                    </div>
                    <p className="mb-2 flex items-center gap-1 text-[12px] text-[#9291A5]">
                      <Info className="h-4 w-4" /> Filtre por nome/categoria/subcategoria/tags, expanda e adicione.
                    </p>
                    {bankLoading && (
                      <div className="mb-3 flex items-center gap-2 rounded-[6px] border border-[#E3E4E5] bg-white px-3 py-2 text-[12px] text-[#6B7280]">
                        <span className="inline-flex h-3 w-3 animate-pulse rounded-full bg-[#9CA3AF]" />
                        Carregando bancos e questões do usuário...
                      </div>
                    )}
                    {!bankLoading && bankError && (
                      <div className="mb-3 rounded-[6px] border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[12px] text-[#B91C1C]">
                        Erro ao carregar bancos/questões: {bankError}
                      </div>
                    )}
                    {!bankLoading && !bankError && bankCategories.length === 0 && (
                      <div className="mb-3 rounded-[6px] border border-dashed border-[#E3E4E5] bg-white px-3 py-2 text-[12px] text-[#9291A5]">
                        Nenhum banco de questões encontrado. Crie um banco ou adicione questões.
                      </div>
                    )}
                    {showQBCategoryCreator && (
                      <div className="mb-3 flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Nome da nova categoria"
                          value={newQBCategoryName}
                          onChange={(e) => setNewQBCategoryName(e.target.value)}
                          className="flex-1 rounded-[4px] border border-[#E3E4E5] bg-white px-2 py-1 text-[12px] text-[#1E1B39] placeholder:text-[#ABADB3] outline-none"
                        />
                        <Button
                          size="sm"
                          className="h-7 px-3"
                          onClick={() => {
                            const name = newQBCategoryName.trim()
                            if (name) addQuestionBankCategory(name)
                          }}
                        >
                          Salvar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-3"
                          onClick={() => {
                            setShowQBCategoryCreator(false)
                            setNewQBCategoryName("")
                          }}
                        >
                          Cancelar
                        </Button>
                      </div>
                    )}
                    {/* Selected Questions moved below instructions (left column) */}
                    <div className="rounded-[6px] bg-[#F9FAFB] p-3 min-h-[120px]">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="flex items-center gap-2 text-[12px] font-medium text-[#1E1B39]">Selecionados</span>
                        {selectedQuestions.length > 0 && (
                          <button
                            className="ml-auto text-[11px] text-[#9291A5] hover:text-[#6D28D9]"
                            onClick={clearSelectedQuestions}
                          >
                            Remover todos
                          </button>
                        )}
                      </div>

                      {selectedQuestions.length === 0 ? (
                        <div className="flex items-center justify-center gap-2 rounded-[6px] border border-dashed border-[#E3E4E5] bg-white px-3 py-4 text-[12px] text-[#9291A5]">
                          <BookOpen className="h-4 w-4 text-[#9291A5]" />
                          <div className="text-center">
                            <div>Nenhuma questão selecionada.</div>
                            <div className="text-[11px] text-[#ABADB3]">Expanda uma categoria à esquerda e clique em Adicionar.</div>
                          </div>
                        </div>
                      ) : (
                        <div role="list" aria-label="Questões selecionadas" className="flex max-h-24 flex-wrap gap-1.5 overflow-auto pr-1">
                          {selectedQuestions.map((q) => (
                            <span
                              key={q.id}
                              title={q.name}
                              role="listitem"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === "Delete" || e.key === "Backspace") {
                                  removeQuestion(q.id)
                                }
                              }}
                              className="group inline-flex cursor-default select-none items-center gap-1.5 rounded-full border border-[#E3E4E5] bg-white px-2 py-1 text-[11px] leading-none text-[#1E1B39] transition-colors hover:border-[#D1D5DB] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#6D28D9]"
                            >
                              <span className="max-w-[210px] truncate">{q.name}</span>
                              <button
                                aria-label={`Remover ${q.name}`}
                                className="ml-0.5 inline-flex h-3.5 w-3.5 items-center justify-center text-[#6B7280] transition-opacity opacity-80 group-hover:opacity-100 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8]"
                                onClick={() => removeQuestion(q.id)}
                              >
                                <X className="h-3 w-3 text-[#6B7280]" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="divide-y max-h-[480px] overflow-auto pr-1">
                      {filteredQuestions.map((category) => (
                        <div key={category.id}>
                          <button
                            className="flex w-full items-center justify-between rounded-[6px] border border-[#E3E4E5] bg-white px-4 py-3 text-left transition-colors hover:bg-[#F8FAFC] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8]"
                            onClick={() => toggleCategory(category.id)}
                            aria-expanded={expandedCategories.includes(category.id)}
                            aria-controls={`panel-${category.id}`}
                            aria-label={`Categoria ${category.name} com ${category.questions.length} questões`}
                          >
                            <span className="flex items-center gap-2 text-[13px] font-semibold text-[#1E1B39]">
                              <ListChecks className="h-4 w-4 text-[#9291A5]" />
                              {category.name}
                              <span className="inline-flex items-center rounded-full bg-[#EEF2FF] px-2.5 py-0.5 text-[12px] text-[#4338CA]">
                                {category.questions.length}
                              </span>
                            </span>
                            <ChevronDown className={`h-4 w-4 text-[#9291A5] transition-transform ${expandedCategories.includes(category.id) ? 'rotate-180' : ''}`} aria-hidden="true" />
                          </button>
                          {expandedCategories.includes(category.id) && (
                            <div
                              id={`panel-${category.id}`}
                              role="region"
                              aria-labelledby={`category-${category.id}`}
                              className="space-y-2 rounded-[6px] border border-[#E3E4E5] bg-[#F9FAFB] px-3 py-3 mt-1"
                            >
                              <div className="sticky top-0 z-10 -mx-3 flex items-center justify-between rounded-t-[6px] border-b border-[#E3E4E5] bg-[#F3F4F6] px-3 py-2">
                                <span className="flex items-center gap-2 text-[11px] text-[#4B5563]">
                                  <ListChecks className="h-3 w-3" /> {category.name}: {category.questions.length} itens
                                </span>
                                <div className="flex items-center gap-2">
                                  {(bankFilterCategoryIds.length > 0 || bankFilterSubcategoryIds.length > 0 || bankFilterTagIds.length > 0) ? (
                                    <button
                                      type="button"
                                      className="text-[11px] font-semibold text-[#0047BB] hover:underline"
                                      onClick={() => {
                                        setBankFilterCategoryIds([])
                                        setBankFilterSubcategoryIds([])
                                        setBankFilterTagIds([])
                                        setBankFilterPickerOpen(null)
                                      }}
                                    >
                                      Limpar
                                    </button>
                                  ) : null}

                                  <div className="relative">
                                    <button
                                      type="button"
                                      className="h-7 px-2 rounded-md border border-[#E3E4E5] bg-white text-[11px] font-semibold text-[#1E1B39] hover:bg-[#F9FAFB]"
                                      onClick={() => setBankFilterPickerOpen((prev) => (prev?.scope === 'panel' && prev?.panelId === category.id && prev?.kind === 'category' ? null : { scope: 'panel', panelId: category.id, kind: 'category' }))}
                                    >
                                      Categoria{bankFilterCategoryIds.length ? ` (${bankFilterCategoryIds.length})` : ''}
                                    </button>
                                    <TaxonomyDropdown
                                      open={bankFilterPickerOpen?.scope === 'panel' && bankFilterPickerOpen?.panelId === category.id && bankFilterPickerOpen?.kind === 'category'}
                                      onOpenChange={(open) => setBankFilterPickerOpen(open ? { scope: 'panel', panelId: category.id, kind: 'category' } : null)}
                                      items={categoryItems}
                                      onSelect={(item) => {
                                        const id = String(item?.id || '').trim()
                                        if (!id) return
                                        setBankFilterCategoryIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
                                      }}
                                      isSelected={(item) => bankFilterCategoryIds.includes(String(item?.id))}
                                      searchPlaceholder="Filtrar por categoria"
                                      createLabel="Criar"
                                      defaultColor="#8B5CF6"
                                      align="end"
                                    />
                                  </div>

                                  <div className="relative">
                                    <button
                                      type="button"
                                      className="h-7 px-2 rounded-md border border-[#E3E4E5] bg-white text-[11px] font-semibold text-[#1E1B39] hover:bg-[#F9FAFB]"
                                      onClick={() => setBankFilterPickerOpen((prev) => (prev?.scope === 'panel' && prev?.panelId === category.id && prev?.kind === 'subcategory' ? null : { scope: 'panel', panelId: category.id, kind: 'subcategory' }))}
                                    >
                                      Sub{bankFilterSubcategoryIds.length ? ` (${bankFilterSubcategoryIds.length})` : ''}
                                    </button>
                                    <TaxonomyDropdown
                                      open={bankFilterPickerOpen?.scope === 'panel' && bankFilterPickerOpen?.panelId === category.id && bankFilterPickerOpen?.kind === 'subcategory'}
                                      onOpenChange={(open) => setBankFilterPickerOpen(open ? { scope: 'panel', panelId: category.id, kind: 'subcategory' } : null)}
                                      items={subcategoryItems}
                                      onSelect={(item) => {
                                        const id = String(item?.id || '').trim()
                                        if (!id) return
                                        setBankFilterSubcategoryIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
                                      }}
                                      isSelected={(item) => bankFilterSubcategoryIds.includes(String(item?.id))}
                                      searchPlaceholder="Filtrar por subcategoria"
                                      createLabel="Criar"
                                      defaultColor="#22C55E"
                                      align="end"
                                    />
                                  </div>

                                  <div className="relative">
                                    <button
                                      type="button"
                                      className="h-7 px-2 rounded-md border border-[#E3E4E5] bg-white text-[11px] font-semibold text-[#1E1B39] hover:bg-[#F9FAFB]"
                                      onClick={() => setBankFilterPickerOpen((prev) => (prev?.scope === 'panel' && prev?.panelId === category.id && prev?.kind === 'tag' ? null : { scope: 'panel', panelId: category.id, kind: 'tag' }))}
                                    >
                                      Tags{bankFilterTagIds.length ? ` (${bankFilterTagIds.length})` : ''}
                                    </button>
                                    <TaxonomyDropdown
                                      open={bankFilterPickerOpen?.scope === 'panel' && bankFilterPickerOpen?.panelId === category.id && bankFilterPickerOpen?.kind === 'tag'}
                                      onOpenChange={(open) => setBankFilterPickerOpen(open ? { scope: 'panel', panelId: category.id, kind: 'tag' } : null)}
                                      items={tagItems}
                                      onSelect={(item) => {
                                        const id = String(item?.id || '').trim()
                                        if (!id) return
                                        setBankFilterTagIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
                                      }}
                                      isSelected={(item) => bankFilterTagIds.includes(String(item?.id))}
                                      searchPlaceholder="Filtrar por tag"
                                      createLabel="Criar"
                                      defaultColor="#EF4444"
                                      align="end"
                                    />
                                  </div>

                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1 h-7 px-2 border-[#E3E4E5]"
                                    onClick={() => addAllFromCategory(category)}
                                    aria-label={`Adicionar todas as questões de ${category.name}`}
                                  >
                                    <Plus className="h-3 w-3 text-[#1E1B39]" /> Adicionar todas
                                  </Button>
                                </div>
                              </div>
                              {category.questions.map((q) => {
                                const isSelected = selectedQuestions.some((s) => s.id === q.id)
                                return (
                                  <div
                                    key={q.id}
                                    className={`group flex items-center justify-between rounded-[4px] border border-[#E3E4E5] border-l-[3px] border-l-[#EDE9FE] bg-white p-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] ${!isSelected ? 'hover:bg-[#F8FAFC] hover:shadow-sm cursor-pointer' : ''}`}
                                    role={!isSelected ? 'button' : undefined}
                                    tabIndex={!isSelected ? 0 : -1}
                                    onKeyDown={!isSelected ? (e) => { if (e.key === 'Enter' || e.key === ' ') addQuestion(q) } : undefined}
                                    onClick={!isSelected ? () => addQuestion(q) : undefined}
                                    aria-label={!isSelected ? `Adicionar questão ${q.name}` : undefined}
                                  >
                                    <span className="flex items-center gap-2 text-[13px] font-medium text-[#1E1B39]">
                                      <FileText className="h-4 w-4 text-[#9291A5]" /> {q.name}
                                    </span>
                                    {isSelected ? (
                                      <div className="inline-flex items-center gap-2">
                                        <span className="inline-flex items-center gap-1 rounded-[4px] bg-[#E9FFEF] px-2 py-1 text-[12px] text-[#06C270]">
                                          <Check className="h-3 w-3 text-[#06C270]" /> Adicionada
                                        </span>
                                        <button
                                          aria-label={`Remover ${q.name}`}
                                          className="inline-flex items-center gap-1 rounded-[4px] bg-[#FEF2F2] px-2 py-1 text-[12px] text-[#EF4444] hover:bg-[#FEE2E2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF4444]"
                                          onClick={(e) => { e.stopPropagation(); removeQuestion(q.id) }}
                                        >
                                          <X className="h-3 w-3 text-[#EF4444]" /> Remover
                                        </button>
                                      </div>
                                    ) : (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="gap-1 h-7 px-2 border-[#E3E4E5] bg-white hover:bg-[#EEF2FF]"
                                        onClick={(e) => { e.stopPropagation(); addQuestion(q) }}
                                        aria-label={`Adicionar ${q.name}`}
                                      >
                                        <Plus className="h-3 w-3 text-[#1E1B39]" /> Adicionar
                                      </Button>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </div>

              {/* Access Control Section removida para centralizar controles na sidebar, como na referência */}
            </div>
          </div>
        </div>

        {/* Configuration Sidebar */}
        {showConfigSidebar && (
          <aside className="sticky top-0 h-full w-80 shrink-0 overflow-y-auto border-l border-[#E3E4E5] bg-white">
            <div className="sticky top-0 border-b border-[#E3E4E5] p-4">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-[12px] font-bold text-[#1E1B39]">Configurações do simulado</h4>
                <Button variant="ghost" size="icon" onClick={() => setShowConfigSidebar(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-4 p-4">
              <div className="rounded-[4px] border border-[#E3E4E5] bg-white p-4">
                <h5 className="mb-2 text-[12px] font-semibold text-[#737780]">Perguntas</h5>
                <div className="space-y-3">
                  <div className="flex items-center justify-between"><span className="text-[12px]">Permitir alterar resposta antes de enviar o simulado</span><Switch checked={secondChance} onCheckedChange={setSecondChance} /></div>
                  <p className="text-[12px] text-[#9291A5]">Permite que o aluno altere as respostas antes de finalizar o simulado.</p>
                  <div className="flex items-center justify-between"><span className="text-[12px]">Embaralhar questão</span><Switch checked={shuffleQuestions} onCheckedChange={setShuffleQuestions} /></div>
                  <p className="text-[12px] text-[#9291A5]">Ordem diferente de questão, o que evita memorização mecânica e reduz cópia.</p>
                  <div className="flex items-center justify-between"><span className="text-[12px]">Pular questão</span><Switch checked={skipQuestions} onCheckedChange={setSkipQuestions} /></div>
                  <p className="text-[12px] text-[#9291A5]">Avançar sem responder imediatamente e decidir depois.</p>
                  <div className="flex items-center justify-between"><span className="text-[12px]">Permitir repetir simulado</span><Switch checked={allowRepeat} onCheckedChange={setAllowRepeat} /></div>
                  <p className="text-[12px] text-[#9291A5]">Quando desativado, o aluno só pode finalizar uma vez.</p>
                </div>
              </div>
              <div className="rounded-[4px] border border-[#E3E4E5] bg-white p-4">
                <h5 className="mb-2 text-[12px] font-semibold text-[#737780]">Respostas</h5>
                <div className="space-y-3">
                  <div>
                    <label className="text-[12px] text-[#737780]">Nota de aprovação</label>
                  <input value={maxGrade} onChange={(e) => setMaxGrade(e.target.value)} className="mt-1 w-24 rounded-[4px] border border-[#E3E4E5] bg-white px-2 py-1 text-[12px]" />
                  </div>
                  
                </div>
              </div>
              
            </div>
          </aside>
        )}
        </div>
      </div>
    </div>
  )
}
