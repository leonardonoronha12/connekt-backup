"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { ArrowLeft, Plus, FileText, FileSpreadsheet, FileType, Link as LinkIcon, Info, ExternalLink, BookOpen, Search, Layers, X, Users, Check, Trash2, ChevronDown, Folder, Play, Pencil, Timer, Lock, Tag as TagIcon, DownloadCloud, Image as ImageIcon, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/SupabaseAuthContext"
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog"
import { toast } from "@/hooks/use-toast"
import { useToast } from "@/hooks/use-toast"
import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabaseClient"
import { canUploadBytes, resolvePlanKey } from "@/services/planEntitlements"
import { planService } from "@/services/planService.js"
import { sanitizeStorageObjectPath, sanitizeStorageSegment } from "@/shared/storagePath.js"
import ChatArea from "@/components/ChatArea"
import { TaxonomyDropdown, type TaxonomyItem } from "@/components/TaxonomyDropdown"
import { useTaxonomy } from "@/contexts/TaxonomyContext"
import RichTextNotionEditor from "@/components/RichTextNotionEditor"

type Course = { id: string; name: string }
type LessonMaterial = { id: string; name: string; sizeLabel: string; type: "pdf" | "doc" | "ppt" | "xls" | "link"; path?: string | null; url?: string | null }
type Lesson = {
  id: string;
  title: string;
  description?: string;
  description_rich?: any;
  durationMin: number;
  visibility: "Gratuita" | "Paga" | "Gratuita para alunos do curso";
  priceCents?: number;
  difficulty?: "Iniciante" | "Intermediário" | "Avançado";
  tag: string;
  categories?: string[];
  subcategories?: string[];
  extraTags?: string[];
  videoProvider?: "vimeo" | "vdocipher" | "upload";
  videoUrl?: string | null;
  videoId?: string | null;
  videoPath?: string | null;
  materials?: LessonMaterial[];
}

export default function NovoCursoPage() {
  const { toast } = useToast()
  const { user, session } = useAuth()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [hiddenAdvanceButtons, setHiddenAdvanceButtons] = useState<string[]>([])
  const [modules, setModules] = useState<{ id: string; name: string; description: string; lessonsCount: number; lessons: Lesson[]; materials?: LessonMaterial[]; cover_image_url?: string | null; cover_image_path?: string | null; visibility?: 'Gratuita' | 'Paga' | 'Gratuita para alunos do curso'; priceCents?: number; freeCourseIds?: string[] }[]>([])
  const [showChatBot, setShowChatBot] = useState(false)
  const [expandedModules, setExpandedModules] = useState<string[]>([])

  const hideAdvanceButton = (id: string) => {
    setHiddenAdvanceButtons((prev) => (prev.includes(id) ? prev : [...prev, id]))
  }
  const isAdvanceButtonHidden = (id: string) => hiddenAdvanceButtons.includes(id)
  // Editor de aulas (inline)
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null)
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null)
  const [moduleEditId, setModuleEditId] = useState<string | null>(null)
  const [moduleEditTitle, setModuleEditTitle] = useState('')
  const [moduleEditDescription, setModuleEditDescription] = useState('')
  const [moduleEditVisibility, setModuleEditVisibility] = useState<'Gratuita' | 'Paga' | 'Gratuita para alunos do curso'>('Gratuita')
  const [moduleEditPrice, setModuleEditPrice] = useState<string>('')
  const [moduleEditFreeCourseIds, setModuleEditFreeCourseIds] = useState<string[]>(['self'])
const editorRef = useRef<HTMLDivElement | null>(null)
const lessonTitleRef = useRef<HTMLInputElement | null>(null)
const modulesSectionRef = useRef<HTMLDivElement | null>(null)
const extrasSectionRef = useRef<HTMLDivElement | null>(null)
  // Seleção de simulados (Recursos extras)
  type SimuladoRef = { 
    id: string; 
    title: string; 
    questionsCount: number; 
    priceLabel: string; 
    rating: number; 
    reviewsCount: number;
    kind?: 'simulado' | 'banco';
    scope?: 'curso' | 'modulo' | 'aula';
    moduleId?: string | null;
    lessonId?: string | null;
  }
  const [isSelectSimuladoOpen, setIsSelectSimuladoOpen] = useState(false)
  const [selectedSimulados, setSelectedSimulados] = useState<SimuladoRef[]>([])
  const [courseMaterials, setCourseMaterials] = useState<LessonMaterial[]>([])
  const [courseMaterialFilesById, setCourseMaterialFilesById] = useState<Record<string, File>>({})
  const [moduleMaterialFilesById, setModuleMaterialFilesById] = useState<Record<string, File>>({})
  const [resourceLibrary, setResourceLibrary] = useState<Array<LessonMaterial & { sourceCourseId?: string; sourceCourseTitle?: string }>>([])
  const [resourceLibraryLoading, setResourceLibraryLoading] = useState(false)
  const [resourceLibraryQuery, setResourceLibraryQuery] = useState('')
  const [isResourceLibraryOpen, setIsResourceLibraryOpen] = useState(false)
  const [resourceLibraryTarget, setResourceLibraryTarget] = useState<{ scope: 'curso' | 'modulo' | 'aula'; moduleId?: string | null; lessonId?: string | null } | null>(null)
  const [lessonLibrary, setLessonLibrary] = useState<Array<{ id: string; title: string; provider: string; durationMin: number; courseId: string; courseTitle: string; moduleId: string; moduleTitle: string; lesson: any }>>([])
  const [lessonLibraryLoading, setLessonLibraryLoading] = useState(false)
  const [lessonLibraryQuery, setLessonLibraryQuery] = useState('')
  const [isLessonLibraryOpen, setIsLessonLibraryOpen] = useState(false)
  const [lessonLibraryTargetModuleId, setLessonLibraryTargetModuleId] = useState<string | null>(null)
  const extraMaterialFileInputRef = useRef<HTMLInputElement | null>(null)
  const [pendingExtraMaterialTarget, setPendingExtraMaterialTarget] = useState<{ scope: 'curso' | 'modulo' | 'aula'; moduleId?: string | null; lessonId?: string | null; type: LessonMaterial['type'] } | null>(null)
  const [isExtraLinkOpen, setIsExtraLinkOpen] = useState(false)
  const [extraLinkUrl, setExtraLinkUrl] = useState('')
  const [extraLinkTarget, setExtraLinkTarget] = useState<{ scope: 'curso' | 'modulo' | 'aula'; moduleId?: string | null; lessonId?: string | null } | null>(null)
  
  const [simuladosCatalog, setSimuladosCatalog] = useState<SimuladoRef[]>([])
  const [isLoadingSimulados, setIsLoadingSimulados] = useState(false)
  const [questionBanksCatalog, setQuestionBanksCatalog] = useState<SimuladoRef[]>([])
  const [isLoadingQuestionBanks, setIsLoadingQuestionBanks] = useState(false)

  useEffect(() => {
    if (!user) return
    const fetchSimulados = async () => {
      setIsLoadingSimulados(true)
      setSimuladosCatalog([])
      try {
        const pid = String(user.id || '').trim()
        if (!pid) return
        const { data, error } = await supabase
          .from('simulados')
          .select('*')
          .eq('user_id', pid)
        
        if (error) throw error

        if (data) {
          const mapped: SimuladoRef[] = data.map((s: any) => ({
            id: s.id,
            title: s.title,
            questionsCount: s.settings?.questionIds?.length || 0,
            priceLabel: s.price ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(s.price) : 'Grátis',
            rating: 5.0,
            reviewsCount: 0,
            kind: 'simulado',
          }))
          setSimuladosCatalog(mapped)
        }
      } catch (err) {
        console.error("Erro ao buscar simulados:", err)
        setSimuladosCatalog([])
        toast({
          title: "Erro ao carregar simulados",
          description: "Não foi possível carregar seus simulados.",
          variant: "destructive"
        })
      } finally {
        setIsLoadingSimulados(false)
      }
    }
    fetchSimulados()
  }, [user, toast])

  useEffect(() => {
    if (!user) return
    const fetchQuestionBanks = async () => {
      setIsLoadingQuestionBanks(true)
      setQuestionBanksCatalog([])
      try {
        const pid = String(user.id || '').trim()
        if (!pid) return
        const { data, error } = await supabase
          .from('question_banks')
          .select('id,name,question_count,created_at,producer_external_id')
          .eq('producer_external_id', pid)
          .order('created_at', { ascending: false })
          .limit(200)
        if (error) throw error
        const mapped: SimuladoRef[] = (Array.isArray(data) ? data : []).map((b: any) => ({
          id: String(b?.id || '').trim(),
          title: String(b?.name || 'Banco de questões').trim() || 'Banco de questões',
          questionsCount: Number(b?.question_count || 0) || 0,
          priceLabel: 'Grátis',
          rating: 5.0,
          reviewsCount: 0,
          kind: 'banco',
        })).filter((x) => x.id)
        setQuestionBanksCatalog(mapped)
      } catch (err) {
        console.error("Erro ao buscar bancos de questões:", err)
        setQuestionBanksCatalog([])
      } finally {
        setIsLoadingQuestionBanks(false)
      }
    }
    fetchQuestionBanks()
  }, [user])

  useEffect(() => {
    if (!user) return
    let active = true
    const run = async () => {
      setResourceLibraryLoading(true)
      setLessonLibraryLoading(true)
      try {
        const pid = String(user.id || '').trim()
        if (!pid) return
        const { data: rows, error } = await supabase
          .from('courses')
          .select('id,title,modules,data,user_id,created_at')
          .eq('user_id', pid)
          .order('created_at', { ascending: false })
          .limit(200)
        if (error) throw error
        const courses = Array.isArray(rows) ? rows : []

        const parseJsonMaybe = (value: any) => {
          if (!value) return null
          if (typeof value === 'object') return value
          if (typeof value !== 'string') return null
          try { return JSON.parse(value) } catch (_) { return null }
        }
        const getCourseModules = (row: any) => {
          const parsed = parseJsonMaybe(row?.modules)
          if (Array.isArray(parsed)) return parsed
          if (parsed && typeof parsed === 'object') {
            if (Array.isArray((parsed as any).modules)) return (parsed as any).modules
            if (Array.isArray((parsed as any).items)) return (parsed as any).items
          }
          const fromData = parseJsonMaybe(row?.data)
          if (fromData && typeof fromData === 'object' && Array.isArray((fromData as any).modules)) return (fromData as any).modules
          return []
        }
        const getModuleLessons = (mod: any) => {
          if (!mod) return []
          if (Array.isArray(mod.lessons)) return mod.lessons
          if (Array.isArray(mod.aulas)) return mod.aulas
          if (Array.isArray(mod.items)) return mod.items
          if (mod && typeof mod === 'object' && Array.isArray(mod.module_lessons)) return mod.module_lessons
          return []
        }
        const getCourseMeta = (row: any) => {
          const fromData = parseJsonMaybe(row?.data) || null
          const parsedModules = parseJsonMaybe(row?.modules) || null
          const fromModulesMeta = parsedModules && typeof parsedModules === 'object' ? ((parsedModules as any).meta || null) : null
          return { ...(fromModulesMeta || {}), ...(fromData || {}) }
        }

        const seen = new Set<string>()
        const out: Array<LessonMaterial & { sourceCourseId?: string; sourceCourseTitle?: string }> = []
        const lessonOut: Array<{ id: string; title: string; provider: string; durationMin: number; courseId: string; courseTitle: string; moduleId: string; moduleTitle: string; lesson: any }> = []
        const lessonSeen = new Set<string>()
        const normalizeProvider = (value: any) => {
          const raw = String(value || '').trim().toLowerCase()
          if (raw === 'vimeo' || raw === 'vdocipher' || raw === 'upload') return raw
          if (!raw) return ''
          return raw
        }
        const inferProviderFromUrl = (value: any) => {
          const raw = String(value || '').toLowerCase()
          if (!raw) return ''
          if (raw.includes('vimeo.com')) return 'vimeo'
          if (raw.includes('vdocipher')) return 'vdocipher'
          if (raw.includes('/storage/v1/object/')) return 'upload'
          return ''
        }

        for (const c of courses) {
          const courseId = String(c?.id || '').trim()
          const courseTitle = String(c?.title || '').trim()
          const meta = getCourseMeta(c) || {}
          const courseMats =
            (Array.isArray((meta as any).course_materials) ? (meta as any).course_materials : null) ||
            (Array.isArray((meta as any).courseMaterials) ? (meta as any).courseMaterials : null) ||
            (Array.isArray((meta as any).materials) ? (meta as any).materials : null) ||
            []
          for (const m of Array.isArray(courseMats) ? courseMats : []) {
            const name = String(m?.name || '').trim()
            const path = String(m?.path || '').trim()
            const url = String(m?.url || '').trim()
            const type = String(m?.type || '').trim().toLowerCase() || inferMaterialType(name || url)
            const key = `${type}:${path || url || name}`
            if (!key || seen.has(key)) continue
            seen.add(key)
            out.push({ id: String(m?.id || key), name: name || url || 'Recurso', sizeLabel: String(m?.sizeLabel || ''), type: type as any, path: path || null, url: url || null, sourceCourseId: courseId || undefined, sourceCourseTitle: courseTitle || undefined })
          }

          const mods = getCourseModules(c)
          for (const mod of Array.isArray(mods) ? mods : []) {
            const moduleId = String(mod?.id || mod?.module_id || mod?.moduleId || '').trim()
            const moduleTitle = String(mod?.name || mod?.title || mod?.module_title || 'Módulo').trim() || 'Módulo'
            const moduleMats = Array.isArray((mod as any)?.materials) ? (mod as any).materials : []
            for (const m of Array.isArray(moduleMats) ? moduleMats : []) {
              const name = String(m?.name || '').trim()
              const path = String(m?.path || '').trim()
              const url = String(m?.url || '').trim()
              const type = String(m?.type || '').trim().toLowerCase() || inferMaterialType(name || url)
              const key = `${type}:${path || url || name}`
              if (!key || seen.has(key)) continue
              seen.add(key)
              out.push({ id: String(m?.id || key), name: name || url || 'Recurso', sizeLabel: String(m?.sizeLabel || ''), type: type as any, path: path || null, url: url || null, sourceCourseId: courseId || undefined, sourceCourseTitle: courseTitle || undefined })
            }

            const lessons = getModuleLessons(mod)
            const lessonsList = Array.isArray(lessons) ? lessons : []
            for (let i = 0; i < lessonsList.length; i += 1) {
              const les = lessonsList[i]
              const lessonTitle = String(les?.title || les?.name || 'Aula').trim() || 'Aula'
              const lid = String(les?.id || les?.lesson_id || les?.lessonId || '').trim()
              const dur = Number(les?.durationMin ?? les?.duration_min ?? les?.duration_minutes ?? 0) || 0
              const provider =
                normalizeProvider(les?.videoProvider || les?.video_provider || les?.provider) ||
                inferProviderFromUrl(les?.videoUrl || les?.video_url || les?.videoPath || les?.video_path || les?.url) ||
                ''
              const vId = String(les?.videoId || les?.video_id || les?.vimeoId || les?.vimeo_id || '').trim()
              const vPath = String(les?.videoPath || les?.video_path || '').trim()
              const vUrl = String(les?.videoUrl || les?.video_url || les?.url || '').trim()
              const dedupeKey = `${provider}:${vId || vPath || vUrl || lid || lessonTitle}`.toLowerCase()
              if (dedupeKey && lessonSeen.has(dedupeKey)) continue
              if (dedupeKey) lessonSeen.add(dedupeKey)
              const entryId = `lesson:${courseId}:${moduleId || ''}:${lid || `idx:${i}`}`
              lessonOut.push({ id: entryId, title: lessonTitle, provider, durationMin: dur, courseId, courseTitle: courseTitle || 'Curso', moduleId, moduleTitle, lesson: les })

              const mats = Array.isArray((les as any)?.materials) ? (les as any).materials : []
              for (const m of Array.isArray(mats) ? mats : []) {
                const name = String(m?.name || '').trim()
                const path = String(m?.path || '').trim()
                const url = String(m?.url || '').trim()
                const type = String(m?.type || '').trim().toLowerCase() || inferMaterialType(name || url)
                const key = `${type}:${path || url || name}`
                if (!key || seen.has(key)) continue
                seen.add(key)
                out.push({ id: String(m?.id || key), name: name || url || 'Recurso', sizeLabel: String(m?.sizeLabel || ''), type: type as any, path: path || null, url: url || null, sourceCourseId: courseId || undefined, sourceCourseTitle: courseTitle || undefined })
              }
            }
          }
        }

        if (active) setResourceLibrary(out)
        if (active) setLessonLibrary(lessonOut)
      } catch (_) {
        if (active) setResourceLibrary([])
        if (active) setLessonLibrary([])
      } finally {
        if (active) setResourceLibraryLoading(false)
        if (active) setLessonLibraryLoading(false)
      }
    }
    run()
    return () => { active = false }
  }, [user, session?.access_token])
  const [simuladoConnectScope, setSimuladoConnectScope] = useState<'curso' | 'modulo' | 'aula'>('curso')
  const [simuladoConnectModuleId, setSimuladoConnectModuleId] = useState<string | null>(null)
  const [simuladoConnectLessonId, setSimuladoConnectLessonId] = useState<string | null>(null)

  const openSimuladoSelector = (scope: 'curso' | 'modulo' | 'aula', moduleId: string | null = null, lessonId: string | null = null) => {
    setSimuladoConnectScope(scope)
    if (scope === 'curso') {
      setSimuladoConnectModuleId(null)
      setSimuladoConnectLessonId(null)
    } else if (scope === 'modulo') {
      setSimuladoConnectModuleId(moduleId)
      setSimuladoConnectLessonId(null)
    } else {
      setSimuladoConnectModuleId(moduleId)
      setSimuladoConnectLessonId(lessonId)
    }
    setIsSelectSimuladoOpen(true)
  }

  const acceptForMaterialType = (type: LessonMaterial['type']) => {
    switch (type) {
      case 'pdf': return '.pdf,application/pdf'
      case 'doc': return '.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      case 'ppt': return '.ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation'
      case 'xls': return '.xls,.xlsx,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv'
      default: return '*/*'
    }
  }

  const openResourceLibrary = (target: { scope: 'curso' | 'modulo' | 'aula'; moduleId?: string | null; lessonId?: string | null }) => {
    setResourceLibraryTarget(target)
    setResourceLibraryQuery('')
    setIsResourceLibraryOpen(true)
  }

  const openLessonLibrary = (moduleId: string) => {
    const mid = String(moduleId || '').trim()
    if (!mid) return
    setLessonLibraryTargetModuleId(mid)
    setLessonLibraryQuery('')
    setIsLessonLibraryOpen(true)
  }

  const normalizeLessonForReuse = (rawLesson: any): Lesson => {
    const r = rawLesson && typeof rawLesson === 'object' ? rawLesson : {}
    const title = String(r.title || r.name || 'Aula').trim() || 'Aula'
    const description = String(r.description || r.desc || '').trim()
    const durationMin = Number(r.durationMin ?? r.duration_min ?? r.duration_minutes ?? 0) || 0
    const rawVisibility = String(r.visibility || '').trim()
    const visibility = (rawVisibility === 'Gratuita' || rawVisibility === 'Paga' || rawVisibility === 'Gratuita para alunos do curso')
      ? rawVisibility
      : 'Gratuita'
    const tag = String(r.tag || 'Anatomia')
    const rawProvider = String(r.videoProvider || r.video_provider || '').trim().toLowerCase()
    const videoUrl = (r.videoUrl ?? r.video_url ?? r.videoSrc ?? r.video_src ?? r.url ?? null)
    const videoId = (r.videoId ?? r.video_id ?? r.vimeoId ?? r.vimeo_id ?? null)
    const videoPath = (r.videoPath ?? r.video_path ?? null)
    const inferredProvider = (() => {
      if (rawProvider === 'vimeo' || rawProvider === 'vdocipher' || rawProvider === 'upload') return rawProvider
      const u = String(videoUrl || '').toLowerCase()
      const p = String(videoPath || '').toLowerCase()
      if (u.includes('vimeo.com')) return 'vimeo'
      if (u.includes('vdocipher')) return 'vdocipher'
      if (p) return 'upload'
      if (u.includes('/storage/v1/object/')) return 'upload'
      return ''
    })()
    const difficulty = r.difficulty || r.level || undefined
    const categories = Array.isArray(r.categories) ? r.categories : undefined
    const subcategories = Array.isArray(r.subcategories) ? r.subcategories : undefined
    const extraTags = Array.isArray(r.extraTags) ? r.extraTags : undefined
    const materials = Array.isArray(r.materials) ? r.materials : undefined
    const description_rich = r.description_rich ?? r.descriptionRich ?? undefined
    const priceCents = Number.isFinite(Number(r.priceCents)) ? Number(r.priceCents) : undefined
    return {
      id: generateLocalId(),
      title,
      description,
      description_rich,
      durationMin,
      visibility,
      priceCents,
      difficulty,
      tag,
      categories,
      subcategories,
      extraTags,
      videoProvider: (inferredProvider === 'vimeo' || inferredProvider === 'vdocipher' || inferredProvider === 'upload') ? (inferredProvider as any) : undefined,
      videoUrl: videoUrl != null ? String(videoUrl) : null,
      videoId: videoId != null ? String(videoId) : null,
      videoPath: videoPath != null ? String(videoPath) : null,
      materials,
    }
  }

  const addExistingLessonToModule = (moduleId: string, lessonItem: any) => {
    const mid = String(moduleId || '').trim()
    if (!mid) return
    const cloned = normalizeLessonForReuse(lessonItem?.lesson || lessonItem)
    setModules((prev) => (Array.isArray(prev) ? prev.map((m) => {
      if (String(m?.id || '') !== mid) return m
      const lessons = Array.isArray(m?.lessons) ? m.lessons : []
      return { ...m, lessons: [...lessons, cloned], lessonsCount: Number(m?.lessonsCount || lessons.length) + 1 }
    }) : prev))
  }

  const openExtraMaterialUploader = (target: { scope: 'curso' | 'modulo' | 'aula'; moduleId?: string | null; lessonId?: string | null }, type: LessonMaterial['type']) => {
    if (type === 'link') {
      setExtraLinkTarget(target)
      setExtraLinkUrl('')
      setIsExtraLinkOpen(true)
      return
    }
    setPendingExtraMaterialTarget({ ...target, type })
    const input = extraMaterialFileInputRef.current
    if (input) {
      input.value = ''
      input.accept = acceptForMaterialType(type)
      input.click()
    }
  }

  const attachMaterialTo = (target: { scope: 'curso' | 'modulo' | 'aula'; moduleId?: string | null; lessonId?: string | null }, item: LessonMaterial, file?: File | null) => {
    const scope = target.scope
    const newItem: LessonMaterial = { ...item, id: generateLocalId() }
    if (scope === 'curso') {
      setCourseMaterials((prev) => ([...(Array.isArray(prev) ? prev : []), newItem]))
      if (file && String(newItem?.type || '').toLowerCase() !== 'link') {
        setCourseMaterialFilesById((prev) => ({ ...(prev || {}), [newItem.id]: file }))
      }
      return
    }
    if (scope === 'modulo') {
      const mid = String(target.moduleId || '').trim()
      if (!mid) return
      setModules((prev) => (Array.isArray(prev) ? prev.map((m) => {
        if (String(m?.id || '') !== mid) return m
        const mats = Array.isArray((m as any)?.materials) ? (m as any).materials : []
        return { ...(m as any), materials: [...mats, newItem] }
      }) : prev))
      if (file && String(newItem?.type || '').toLowerCase() !== 'link') {
        setModuleMaterialFilesById((prev) => ({ ...(prev || {}), [newItem.id]: file }))
      }
      return
    }
    if (scope === 'aula') {
      const mid = String(target.moduleId || '').trim()
      const lid = String(target.lessonId || '').trim()
      if (!mid || !lid) return
      const currentMod = modules.find((m) => String(m?.id || '') === mid)
      const lesson = currentMod?.lessons?.find((l) => String(l?.id || '') === lid) || null
      const current = Array.isArray((lesson as any)?.materials) ? (lesson as any).materials : []
      updateLessonField(mid, lid, 'materials', [...current, newItem] as any)
      if (file && String(newItem?.type || '').toLowerCase() !== 'link') {
        setLessonMaterialFilesById((prev) => ({ ...(prev || {}), [newItem.id]: file }))
      }
    }
  }

  const handleExtraMaterialFileSelected: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files && e.target.files[0]
    const target = pendingExtraMaterialTarget
    if (!file || !target) return
    const type = target.type
    const newItem: LessonMaterial = {
      id: generateLocalId(),
      name: String(file.name || 'arquivo'),
      sizeLabel: String(formatSize(file.size) || ''),
      type,
      path: null,
      url: null,
    }
    attachMaterialTo(target, newItem, file)
    setPendingExtraMaterialTarget(null)
  }

  const visibleExtrasCatalog = useMemo(() => {
    const scope = simuladoConnectScope
    const moduleId = simuladoConnectModuleId ?? null
    const lessonId = simuladoConnectLessonId ?? null
    const base = [...(Array.isArray(simuladosCatalog) ? simuladosCatalog : []), ...(Array.isArray(questionBanksCatalog) ? questionBanksCatalog : [])]
    return base.filter((s) => {
      const kind = (s as any)?.kind || 'simulado'
      const exists = selectedSimulados.some((x) => {
        const xScope = x.scope || 'curso'
        const xKind = (x as any)?.kind || 'simulado'
        return x.id === s.id && xKind === kind && xScope === scope && (x.moduleId ?? null) === moduleId && (x.lessonId ?? null) === lessonId
      })
      return !exists
    })
  }, [simuladosCatalog, questionBanksCatalog, selectedSimulados, simuladoConnectScope, simuladoConnectModuleId, simuladoConnectLessonId])

  const visibleResourceLibrary = useMemo(() => {
    const q = String(resourceLibraryQuery || '').trim().toLowerCase()
    const base = Array.isArray(resourceLibrary) ? resourceLibrary : []
    if (!q) return base
    return base.filter((m) => {
      const name = String(m?.name || '').toLowerCase()
      const type = String(m?.type || '').toLowerCase()
      const src = String((m as any)?.sourceCourseTitle || '').toLowerCase()
      return name.includes(q) || type.includes(q) || src.includes(q)
    })
  }, [resourceLibrary, resourceLibraryQuery])

  const localLessonLibrary = useMemo(() => {
    const courseTitle = (String(title || '').trim() || 'Este curso')
    const courseId = (() => {
      try {
        const m = String(window.location.pathname || '').match(/\/produtos\/editar\/(.+)/)
        return String(m?.[1] || '').trim() || 'current'
      } catch (_) {
        return 'current'
      }
    })()
    const out: Array<{ id: string; title: string; provider: string; durationMin: number; courseId: string; courseTitle: string; moduleId: string; moduleTitle: string; lesson: any }> = []
    const modulesList = Array.isArray(modules) ? modules : []
    for (let mi = 0; mi < modulesList.length; mi += 1) {
      const mod: any = modulesList[mi]
      const moduleId = String(mod?.id || mod?.module_id || mod?.moduleId || `mod-${mi}`).trim()
      const moduleTitle = String(mod?.name || mod?.title || 'Módulo').trim() || 'Módulo'
      const lessonsList = Array.isArray(mod?.lessons) ? mod.lessons : []
      for (let li = 0; li < lessonsList.length; li += 1) {
        const les: any = lessonsList[li]
        const lessonTitle = String(les?.title || les?.name || 'Aula').trim() || 'Aula'
        const lid = String(les?.id || les?.lesson_id || les?.lessonId || `idx-${li}`).trim()
        const dur = Number(les?.durationMin ?? les?.duration_min ?? les?.duration_minutes ?? 0) || 0
        const rawProvider = String(les?.videoProvider || les?.video_provider || '').trim().toLowerCase()
        const rawUrl = String(les?.videoUrl || les?.video_url || les?.url || '').trim().toLowerCase()
        const rawPath = String(les?.videoPath || les?.video_path || '').trim().toLowerCase()
        const provider =
          (rawProvider === 'vimeo' || rawProvider === 'vdocipher' || rawProvider === 'upload')
            ? rawProvider
            : (rawUrl.includes('vimeo.com') ? 'vimeo' : (rawUrl.includes('vdocipher') ? 'vdocipher' : (rawPath || rawUrl.includes('/storage/v1/object/') ? 'upload' : '')))
        out.push({ id: `local:${courseId}:${moduleId}:${lid}`, title: lessonTitle, provider, durationMin: dur, courseId, courseTitle, moduleId, moduleTitle, lesson: les })
      }
    }
    return out
  }, [modules, title])

  const visibleLessonLibrary = useMemo(() => {
    const q = String(lessonLibraryQuery || '').trim().toLowerCase()
    const merged = [
      ...(Array.isArray(lessonLibrary) ? lessonLibrary : []),
      ...localLessonLibrary,
    ]
    const seen = new Set<string>()
    const deduped: typeof merged = []
    for (const it of merged) {
      const provider = String((it as any)?.provider || '').trim().toLowerCase()
      const les = (it as any)?.lesson || {}
      const vId = String(les?.videoId || les?.video_id || les?.vimeoId || les?.vimeo_id || '').trim()
      const vPath = String(les?.videoPath || les?.video_path || '').trim()
      const vUrl = String(les?.videoUrl || les?.video_url || les?.url || '').trim()
      const t = String((it as any)?.title || '').trim()
      const key = `${provider}:${vId || vPath || vUrl || t}`.toLowerCase()
      if (key && seen.has(key)) continue
      if (key) seen.add(key)
      deduped.push(it)
    }
    if (!q) return deduped
    return deduped.filter((it) => {
      const title = String((it as any)?.title || '').toLowerCase()
      const provider = String((it as any)?.provider || '').toLowerCase()
      const courseTitle = String((it as any)?.courseTitle || '').toLowerCase()
      const moduleTitle = String((it as any)?.moduleTitle || '').toLowerCase()
      return title.includes(q) || provider.includes(q) || courseTitle.includes(q) || moduleTitle.includes(q)
    })
  }, [lessonLibrary, localLessonLibrary, lessonLibraryQuery])

  // Estados para visualização de recursos nas listas
  const [resourceViewModuleId, setResourceViewModuleId] = useState<string | null>(null)
  const [resourceViewLessonId, setResourceViewLessonId] = useState<string | null>(null)
  const [courseMaterialAddType, setCourseMaterialAddType] = useState<LessonMaterial['type']>('pdf')
  const [moduleMaterialAddType, setModuleMaterialAddType] = useState<LessonMaterial['type']>('pdf')
  const [lessonMaterialAddType, setLessonMaterialAddType] = useState<LessonMaterial['type']>('pdf')
  const resourceViewLessonMeta = useMemo(() => {
    const lid = String(resourceViewLessonId || '').trim()
    if (!lid) return null
    for (const m of (Array.isArray(modules) ? modules : [])) {
      for (const l of (Array.isArray(m?.lessons) ? m.lessons : [])) {
        if (String(l?.id || '').trim() === lid) {
          return { moduleId: String(m?.id || '').trim(), lesson: l }
        }
      }
    }
    return null
  }, [modules, resourceViewLessonId])

  // Inicializa visualização de recursos se houver módulos
  useEffect(() => {
    if (modules.length > 0) {
      if (!resourceViewModuleId) setResourceViewModuleId(modules[0].id)
      
      // Inicializa com a primeira aula disponível se não houver aula selecionada
      if (!resourceViewLessonId) {
        const firstModuleWithLessons = modules.find(m => m.lessons.length > 0)
        if (firstModuleWithLessons && firstModuleWithLessons.lessons.length > 0) {
           setResourceViewLessonId(firstModuleWithLessons.lessons[0].id)
        }
      }
    }
  }, [modules])

  // Pré-seleção automática ao abrir o modal e ao trocar escopo/módulo
  useEffect(() => {
    if (!isSelectSimuladoOpen) return
    if ((simuladoConnectScope === 'modulo' || simuladoConnectScope === 'aula') && !simuladoConnectModuleId && modules.length > 0) {
      setSimuladoConnectModuleId(modules[0].id)
    }
  }, [isSelectSimuladoOpen, simuladoConnectScope, simuladoConnectModuleId, modules])

  useEffect(() => {
    if (!isSelectSimuladoOpen) return
    if (simuladoConnectScope === 'aula') {
      if (simuladoConnectModuleId) {
        const mod = modules.find((m) => m.id === simuladoConnectModuleId)
        const firstLessonId = mod?.lessons?.[0]?.id ?? null
        setSimuladoConnectLessonId(firstLessonId)
      } else {
        setSimuladoConnectLessonId(null)
      }
    }
  }, [isSelectSimuladoOpen, simuladoConnectScope, simuladoConnectModuleId, modules])

  // Effect to load course data if in edit mode
  useEffect(() => {
    const loadCourse = async () => {
      const toPublicCoursesMediaUrl = (value: any) => {
        const raw = value == null ? '' : String(value)
        if (!raw) return null
        if (raw.startsWith('data:')) return raw
        const marker = '/storage/v1/object/sign/courses-media/'
        const idx = raw.indexOf(marker)
        if (idx >= 0) {
          const withoutQuery = raw.split('?')[0] || ''
          const path = withoutQuery.slice(idx + marker.length)
          const { data } = supabase.storage.from('courses-media').getPublicUrl(path)
          return data?.publicUrl || null
        }
        return raw
      }

      const path = window.location.pathname;
      const match = path.match(/\/produtos\/editar\/(.+)/);
      setIsEditMode(Boolean(match))
      if (match) {
        const courseId = match[1];
        setEditingCourseId(courseId)
        const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
        if (!isUuid(courseId)) {
          toast({
            title: "Erro",
            description: "ID do curso inválido para edição.",
            variant: "destructive"
          });
          return
        }
        try {
          const { data, error } = await supabase
            .from('courses')
            .select('*')
            .eq('id', courseId)
            .single();

          if (error) throw error;
          if (data) {
            const titleValue = String(data.title || '')
            const moduleLayoutUrlFromRow = toPublicCoursesMediaUrl((data as any).module_layout_image_url) || null
            const coverUrlFromRow = toPublicCoursesMediaUrl((data as any).cover_image_url) || null
            const promoUrlFromRow = toPublicCoursesMediaUrl((data as any).promo_video_url) || null
            const statusValue = String((data as any).status || '')
            setCourseStatus(statusValue === 'published' ? 'published' : 'draft')

            setTitle(data.title || '');
            setDescription(data.description || '');
            if (moduleLayoutUrlFromRow) setModuleLayoutImage(moduleLayoutUrlFromRow)
            if (coverUrlFromRow) setCoverImage(coverUrlFromRow)
            if (promoUrlFromRow) setPromoVideo(promoUrlFromRow)

            let metaFromData: any = null
            if (data.data) {
              metaFromData = (typeof data.data === 'string' ? (() => { try { return JSON.parse(data.data) } catch { return null } })() : data.data) as any
              if (metaFromData) {
                if (metaFromData.price) setPrice(String(metaFromData.price))
                if (Array.isArray(metaFromData.selectedCourses)) setSelectedCourses(metaFromData.selectedCourses)
                if (Array.isArray(metaFromData.selectedCategories)) setSelectedCategories(metaFromData.selectedCategories)
                if (Array.isArray(metaFromData.selectedSubcategories)) setSelectedSubcategories(metaFromData.selectedSubcategories)
                if (Array.isArray(metaFromData.selectedTags)) setSelectedTags(metaFromData.selectedTags)
                if (Array.isArray(metaFromData.selectedSimulados)) setSelectedSimulados(metaFromData.selectedSimulados)
                {
                  const mats =
                    (Array.isArray(metaFromData.course_materials) ? metaFromData.course_materials : null) ||
                    (Array.isArray(metaFromData.courseMaterials) ? metaFromData.courseMaterials : null) ||
                    (Array.isArray(metaFromData.materials) ? metaFromData.materials : null) ||
                    []
                  if (Array.isArray(mats)) setCourseMaterials(mats as any)
                }
                if (metaFromData.theme_text_color) setThemeTextColor(String(metaFromData.theme_text_color))
                if (metaFromData.theme_button_primary_color) setThemeButtonPrimaryColor(String(metaFromData.theme_button_primary_color))
                if (metaFromData.theme_button_secondary_color) setThemeButtonSecondaryColor(String(metaFromData.theme_button_secondary_color))
                if (metaFromData.theme_page_background_color) setThemePageBackgroundColor(String(metaFromData.theme_page_background_color))
                if (metaFromData.module_layout_image_path) setModuleLayoutImagePath(String(metaFromData.module_layout_image_path))
                if (metaFromData.cover_image_path) setCoverImagePath(String(metaFromData.cover_image_path))
                if (metaFromData.promo_video_path) setPromoVideoPath(String(metaFromData.promo_video_path))
                if (metaFromData.module_layout_image_url) setModuleLayoutImage(String(toPublicCoursesMediaUrl(metaFromData.module_layout_image_url) || metaFromData.module_layout_image_url))
                if (metaFromData.cover_image_url) setCoverImage(String(toPublicCoursesMediaUrl(metaFromData.cover_image_url) || metaFromData.cover_image_url))
                if (metaFromData.promo_video_url) setPromoVideo(String(toPublicCoursesMediaUrl(metaFromData.promo_video_url) || metaFromData.promo_video_url))
              }
            }

            let modulesForProgress: any[] = []
            let metaFromModules: any = null
            if (data.modules) {
               try {
                 const parsedModules = typeof data.modules === 'string' ? JSON.parse(data.modules) : data.modules;
                 if (Array.isArray(parsedModules)) {
                   setModules(parsedModules);
                   modulesForProgress = parsedModules
                 } else if (parsedModules && typeof parsedModules === 'object') {
                   const modArr = Array.isArray((parsedModules as any).modules) ? (parsedModules as any).modules : []
                   setModules(modArr)
                   modulesForProgress = modArr
                   const meta = (parsedModules as any).meta
                   if (meta) {
                     metaFromModules = meta
                     if (meta.price) setPrice(String(meta.price))
                     if (Array.isArray(meta.selectedCourses)) setSelectedCourses(meta.selectedCourses)
                     if (Array.isArray(meta.selectedCategories)) setSelectedCategories(meta.selectedCategories)
                     if (Array.isArray(meta.selectedSubcategories)) setSelectedSubcategories(meta.selectedSubcategories)
                     if (Array.isArray(meta.selectedTags)) setSelectedTags(meta.selectedTags)
                     if (Array.isArray(meta.selectedSimulados)) setSelectedSimulados(meta.selectedSimulados)
                    {
                      const mats =
                        (Array.isArray(meta.course_materials) ? meta.course_materials : null) ||
                        (Array.isArray(meta.courseMaterials) ? meta.courseMaterials : null) ||
                        (Array.isArray(meta.materials) ? meta.materials : null) ||
                        []
                      if (Array.isArray(mats)) setCourseMaterials(mats as any)
                    }
                    if (meta.module_layout_image_url) setModuleLayoutImage(String(toPublicCoursesMediaUrl(meta.module_layout_image_url) || meta.module_layout_image_url))
                    if (meta.cover_image_url) setCoverImage(String(toPublicCoursesMediaUrl(meta.cover_image_url) || meta.cover_image_url))
                    if (meta.promo_video_url) setPromoVideo(String(toPublicCoursesMediaUrl(meta.promo_video_url) || meta.promo_video_url))
                  }
                } else {
                   setModules([])
                   modulesForProgress = []
                 }
               } catch (e) {
                 console.error("Error parsing modules:", e);
               }
            }

            const mergedMeta = metaFromData || metaFromModules || null
            const titleFromMeta = mergedMeta?.title || mergedMeta?.course_title || mergedMeta?.courseTitle || null
            const descriptionFromMeta = mergedMeta?.description || mergedMeta?.course_description || mergedMeta?.courseDescription || null
            if (!titleValue && titleFromMeta) setTitle(String(titleFromMeta))
            if (!String(data.description || '') && descriptionFromMeta) setDescription(String(descriptionFromMeta))

            if ((!Array.isArray(modulesForProgress) || modulesForProgress.length === 0) && Array.isArray(mergedMeta?.modules)) {
              setModules(mergedMeta.modules)
              modulesForProgress = mergedMeta.modules
            }
            const phaseDoneFromMetaRaw = mergedMeta?.phase_done || mergedMeta?.phaseDone || null
            let phaseDoneFromMeta: any = null
            if (typeof phaseDoneFromMetaRaw === 'string') {
              try { phaseDoneFromMeta = JSON.parse(phaseDoneFromMetaRaw) } catch { phaseDoneFromMeta = null }
            } else if (phaseDoneFromMetaRaw && typeof phaseDoneFromMetaRaw === 'object') {
              phaseDoneFromMeta = phaseDoneFromMetaRaw
            }

            if (phaseDoneFromMeta) {
              setPhaseDone({
                conteudo: Boolean(phaseDoneFromMeta.conteudo),
                aulas: Boolean(phaseDoneFromMeta.aulas),
                recursos: Boolean(phaseDoneFromMeta.recursos),
                visual: Boolean(phaseDoneFromMeta.visual),
                monetizacao: Boolean(phaseDoneFromMeta.monetizacao),
              } as any)
            } else {
              const hasModule = Array.isArray(modulesForProgress) && modulesForProgress.length > 0
              const hasAnyLesson = hasModule && modulesForProgress.some((m: any) => Array.isArray(m?.lessons) && m.lessons.length > 0)

              const simulados = Array.isArray(mergedMeta?.selectedSimulados) ? mergedMeta.selectedSimulados : []
              const courseMats =
                (Array.isArray(mergedMeta?.course_materials) ? mergedMeta.course_materials : null) ||
                (Array.isArray(mergedMeta?.courseMaterials) ? mergedMeta.courseMaterials : null) ||
                (Array.isArray(mergedMeta?.materials) ? mergedMeta.materials : null) ||
                []
              const hasAnyMaterials =
                (Array.isArray(courseMats) && courseMats.length > 0)
                || (hasModule && modulesForProgress.some((m: any) => {
                  const mm = Array.isArray(m?.materials) ? m.materials : []
                  if (mm.length > 0) return true
                  const lessons = Array.isArray(m?.lessons) ? m.lessons : []
                  return lessons.some((l: any) => Array.isArray(l?.materials) && l.materials.length > 0)
                }))
              const hasRecursos = simulados.length > 0 || hasAnyMaterials

              const visualUrl = mergedMeta?.cover_image_url || coverUrlFromRow || mergedMeta?.promo_video_url || promoUrlFromRow || mergedMeta?.module_layout_image_url || moduleLayoutUrlFromRow
              const hasVisual = Boolean(visualUrl)

              const priceRaw = mergedMeta?.price
              const priceString = String(priceRaw || '').trim()
              const priceParsed = parseFloat(priceString.replace('R$', '').trim().replace(/\./g, '').replace(',', '.'))
              const hasMonetizacao = Boolean(statusValue === 'published' || (priceString.length > 0 && !isNaN(priceParsed) && priceParsed > 0))

              setPhaseDone({
                conteudo: Boolean(titleValue.trim()),
                aulas: Boolean(hasAnyLesson),
                recursos: Boolean(hasRecursos),
                visual: Boolean(hasVisual),
                monetizacao: Boolean(hasMonetizacao),
              } as any)
            }
          }
        } catch (err) {
          toast({
            title: "Erro",
            description: "Erro ao carregar curso para edição.",
            variant: "destructive"
          });
        }
      } else {
        setEditingCourseId(null)
      }
    };
    
    loadCourse();
  }, []);

  const [themeTextColor, setThemeTextColor] = useState("#1E1B39")
  const [themeButtonPrimaryColor, setThemeButtonPrimaryColor] = useState("#0047BB")
  const [themeButtonSecondaryColor, setThemeButtonSecondaryColor] = useState("#0047BB")
  const [themePageBackgroundColor, setThemePageBackgroundColor] = useState("#FFFFFF")

  const [moduleLayoutImage, setModuleLayoutImage] = useState<string | null>(null)
  const [moduleLayoutImagePath, setModuleLayoutImagePath] = useState<string | null>(null)
  const [moduleLayoutImageFile, setModuleLayoutImageFile] = useState<File | null>(null)
  const moduleLayoutImageInputRef = useRef<HTMLInputElement | null>(null)

  const handleModuleLayoutImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!isImageFile(file)) {
        toast({ title: 'Arquivo inválido', description: 'Envie apenas arquivos de imagem.', variant: 'destructive' as any })
        if (moduleLayoutImageInputRef.current) moduleLayoutImageInputRef.current.value = ''
        return
      }
      setModuleLayoutImageFile(file)
      const imageUrl = URL.createObjectURL(file)
      setModuleLayoutImage(imageUrl)
    }
  }

  const handleRemoveModuleLayoutImage = () => {
    setModuleLayoutImage(null)
    setModuleLayoutImagePath(null)
    setModuleLayoutImageFile(null)
    if (moduleLayoutImageInputRef.current) {
      moduleLayoutImageInputRef.current.value = ''
    }
  }

  const [coverImage, setCoverImage] = useState<string | null>(null)
  const [coverImagePath, setCoverImagePath] = useState<string | null>(null)
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null)
  const coverImageInputRef = useRef<HTMLInputElement | null>(null)
  const [isCoverGalleryOpen, setIsCoverGalleryOpen] = useState(false)

  const [promoVideo, setPromoVideo] = useState<string | null>(null)
  const [promoVideoPath, setPromoVideoPath] = useState<string | null>(null)
  const [promoVideoFile, setPromoVideoFile] = useState<File | null>(null)
  const promoVideoInputRef = useRef<HTMLInputElement | null>(null)

  const isImageFile = (file: File) => {
    const type = (file.type || '').toLowerCase()
    if (type.startsWith('image/')) return true
    const name = (file.name || '').toLowerCase()
    return /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(name)
  }

  const isVideoFile = (file: File) => {
    const type = (file.type || '').toLowerCase()
    if (type.startsWith('video/')) return true
    const name = (file.name || '').toLowerCase()
    return /\.(mp4|mov|webm|m4v|avi|mkv)$/.test(name)
  }

  const getApproxDataUrlBytes = (dataUrl: string) => {
    const idx = dataUrl.indexOf(',')
    const b64 = idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl
    const padding = b64.endsWith('==') ? 2 : (b64.endsWith('=') ? 1 : 0)
    return Math.max(0, Math.floor((b64.length * 3) / 4) - padding)
  }

  const compressImageFileToDataUrl = async (file: File, maxBytes: number) => {
    const bitmap = await (async () => {
      if (typeof createImageBitmap === 'function') {
        try { return await createImageBitmap(file) } catch { return null }
      }
      return null
    })()

    const drawFromImage = async () => {
      const url = URL.createObjectURL(file)
      try {
        const img = new Image()
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve()
          img.onerror = (e) => reject(e)
          img.src = url
        })
        return { width: img.naturalWidth || img.width, height: img.naturalHeight || img.height, source: img as any }
      } finally {
        try { URL.revokeObjectURL(url) } catch (_) {}
      }
    }

    const sourceInfo = bitmap
      ? { width: bitmap.width, height: bitmap.height, source: bitmap as any }
      : await drawFromImage()

    const baseW = sourceInfo.width || 1
    const baseH = sourceInfo.height || 1

    let targetW = Math.min(1600, baseW)
    let targetH = Math.max(1, Math.round((baseH / baseW) * targetW))

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas não suportado')

    const tryEncode = (w: number, h: number, q: number) => {
      canvas.width = w
      canvas.height = h
      ctx.clearRect(0, 0, w, h)
      ctx.drawImage(sourceInfo.source, 0, 0, w, h)
      return canvas.toDataURL('image/jpeg', q)
    }

    let best: string | null = null

    const qualities = [0.92, 0.86, 0.8, 0.74, 0.68, 0.62, 0.56]
    for (let scaleStep = 0; scaleStep < 5; scaleStep++) {
      for (const q of qualities) {
        const dataUrl = tryEncode(targetW, targetH, q)
        if (getApproxDataUrlBytes(dataUrl) <= maxBytes) {
          best = dataUrl
          break
        }
      }
      if (best) break
      targetW = Math.max(420, Math.floor(targetW * 0.85))
      targetH = Math.max(1, Math.round((baseH / baseW) * targetW))
    }

    if (!best) {
      const dataUrl = tryEncode(targetW, targetH, 0.5)
      best = dataUrl
    }
    return best
  }

  const setCoverImageFromFile = (file: File) => {
    if (!isImageFile(file)) {
      toast({ title: 'Arquivo inválido', description: 'Envie apenas arquivos de imagem.', variant: 'destructive' as any })
      if (coverImageInputRef.current) coverImageInputRef.current.value = ''
      return
    }
    setCoverImageFile(file)
    const imageUrl = URL.createObjectURL(file)
    setCoverImage(imageUrl)
  }

  const setPromoVideoFromFile = (file: File) => {
    if (!isVideoFile(file)) {
      toast({ title: 'Arquivo inválido', description: 'Envie apenas arquivos de vídeo.', variant: 'destructive' as any })
      if (promoVideoInputRef.current) promoVideoInputRef.current.value = ''
      return
    }
    setPromoVideoFile(file)
    const videoUrl = URL.createObjectURL(file)
    setPromoVideo(videoUrl)
  }

  const handleCoverImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setCoverImageFromFile(file)
    }
  }

  const handleRemoveCoverImage = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCoverImage(null)
    setCoverImagePath(null)
    setCoverImageFile(null)
    if (coverImageInputRef.current) {
      coverImageInputRef.current.value = ''
    }
  }

  const handlePromoVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setPromoVideoFromFile(file)
    }
  }

  const handleRemovePromoVideo = (e: React.MouseEvent) => {
    e.stopPropagation()
    setPromoVideo(null)
    setPromoVideoPath(null)
    setPromoVideoFile(null)
    if (promoVideoInputRef.current) {
      promoVideoInputRef.current.value = ''
    }
  }

  const [isInfoSectionExpanded, setIsInfoSectionExpanded] = useState(true)
  const tagClass = (t: string) => {
    const k = t.toLowerCase()
    if (k === "anatomia") return "bg-[#FEF9C3] text-[#92400E]"
    if (k === "cardiologia" || k === "cardio") return "bg-[#DBEAFE] text-[#1D4ED8]"
    if (k === "imagem" || k === "diagnóstico") return "bg-[#FDE2E4] text-[#B91C1C]"
    return "bg-[#F3F4F6] text-[#374151]"
  }
  const ConnektWordmark = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="119" height="36" viewBox="0 0 119 36" fill="none" className={className}>
      <g clipPath="url(#clip0_914_61509)">
        <path d="M88.3434 35.5774H85.6503C84.9025 35.5774 84.2022 35.2854 83.6748 34.7536C83.1431 34.2176 82.8535 33.5115 82.8535 32.7575V2.41459C82.8535 2.36665 82.8535 2.31871 82.8535 2.27077C82.9097 1.1681 83.6705 0.278997 84.7469 0.0523619C85.8405 -0.174273 86.9039 0.348731 87.3924 1.35115L91.1358 9.01752V18.0045L90.7079 18.4272C90.1935 18.9371 89.9125 19.6171 89.9125 20.3449C89.9125 21.0727 90.1978 21.757 90.7079 22.2669L91.1358 22.6897V32.7575C91.1358 33.5115 90.8462 34.2219 90.3145 34.7536C89.7871 35.2854 89.0825 35.5774 88.339 35.5774H88.3434ZM85.7065 32.6965H88.2785V23.8447C87.4875 22.8553 87.0552 21.635 87.0552 20.3449C87.0552 19.0548 87.4875 17.8345 88.2785 16.8451V9.6887L85.7065 4.4238V32.7009V32.6965Z" fill="#DADADA" />
        <path d="M98.1691 20.0965L103.218 15.7338L108.799 10.9091L118.417 2.59766H106.11L89.6317 16.2219L89.5323 16.3091C88.4905 17.342 87.9199 18.7236 87.9199 20.1967C87.9199 21.6699 88.4776 23.0209 89.502 24.0539C89.5885 24.141 89.6793 24.2151 89.783 24.2805L106.192 35.098H119L98.1691 20.0965ZM91.4084 21.9837C90.9588 21.4955 90.7167 20.8679 90.7167 20.1967C90.7167 19.5255 90.9761 18.8544 91.4559 18.3619L107.108 5.41752H110.861L105.989 9.6277L104.472 10.9396V12.9924H102.094L93.6389 20.297L110.277 32.2781H107.026L91.4084 21.9837Z" fill="white" />
        <path d="M7.92786 23.2653C5.28668 23.2653 4.10658 21.5481 4.10658 19.4386C4.10658 17.3292 5.28668 15.612 7.92786 15.612C10.046 15.612 11.2218 16.7234 11.5806 18.2749H15.5229C14.8485 14.2522 11.3428 12.6309 7.92786 12.6309C4.18006 12.6309 0 14.4483 0 19.4386C0 24.4289 4.18006 26.2464 7.92786 26.2464C11.3428 26.2464 14.8485 24.6469 15.5229 20.6285H11.5806C11.2218 22.1539 10.046 23.2653 7.92786 23.2653Z" fill="white" />
        <path d="M24.4844 12.6309C20.7366 12.6309 16.5781 14.4483 16.5781 19.4386C16.5781 24.4289 20.7366 26.2464 24.4844 26.2464C28.2322 26.2464 32.3906 24.4289 32.3906 19.4386C32.3906 14.4483 28.2322 12.6309 24.4844 12.6309ZM24.4844 23.2653C21.8432 23.2653 20.6631 21.5481 20.6631 19.4386C20.6631 17.3292 21.8432 15.612 24.4844 15.612C27.1255 15.612 28.2797 17.3292 28.2797 19.4386C28.2797 21.5481 27.1299 23.2653 24.4844 23.2653Z" fill="white" />
        <path d="M43.1536 12.6309C40.4865 12.6309 38.9476 14.0822 38.4419 14.8362V12.9926H34.1191V25.9064H38.4419V18.3229C38.4419 16.8933 39.4274 15.8037 41.351 15.8037C43.2746 15.8037 44.1867 16.8933 44.1867 18.3229V25.9064H48.5138V17.3553C48.5138 14.4483 46.4475 12.6309 43.1536 12.6309Z" fill="white" />
        <path d="M59.8528 12.6309C57.1857 12.6309 55.6468 14.0822 55.1454 14.8362V12.9926H50.8184V25.9064H55.1454V18.3229C55.1454 16.8933 56.131 15.8037 58.0503 15.8037C59.9695 15.8037 60.886 16.8933 60.886 18.3229V25.9064H65.213V17.3553C65.213 14.4483 63.1467 12.6309 59.8528 12.6309Z" fill="white" />
        <path d="M74.2292 12.6562C70.5549 12.6562 66.5391 14.5957 66.5391 19.464C66.5391 24.3323 70.5549 26.2718 74.2292 26.2718C77.4755 26.2718 80.6225 24.9904 81.4395 21.5473H77.5966C77.0649 22.5672 76.1052 23.2907 74.2292 23.2907C72.0203 23.2907 70.8445 22.0834 70.5073 20.4316H81.634C82.0187 14.8616 77.9813 12.6562 74.2292 12.6562ZM70.6759 17.9124C71.1557 16.5831 72.3099 15.6374 74.2292 15.6374C76.1485 15.6374 77.1859 16.557 77.5966 17.9124H70.6759Z" fill="white" />
        <path d="M112.546 15.733V12.9916H108.798V9.62695H104.471V12.9916H102.094V15.733H104.471V20.8454C104.471 24.088 105.241 26.1016 109.974 26.1016C110.986 26.1016 111.656 26.0275 112.546 25.9054V22.5887C109.71 22.9505 108.798 22.6105 108.798 20.8454V15.733H112.546Z" fill="white" />
      </g>
      <defs>
        <clipPath id="clip0_914_61509">
          <rect width="119" height="35.5773" fill="white" />
        </clipPath>
      </defs>
    </svg>
  )
  const CoverCardPreview = ({ src, titleText }: { src: string; titleText: string }) => (
    <div className="relative w-[180px] h-[326px] rounded-[10px] overflow-hidden border border-[#E3E4E5] bg-[#F8FAFF]">
      <img src={src} alt="Capa" className="absolute inset-0 h-full w-full object-cover" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 pb-6 flex flex-col items-center text-center px-3">
        <ConnektWordmark className="w-[110px] h-auto" />
        <div className="mt-2 h-[2px] w-10 bg-white/70 rounded" />
        <div className="mt-3 text-[14px] font-semibold text-white truncate w-full">{titleText}</div>
      </div>
    </div>
  )
  const medicalCourseCoverOptions = useMemo(() => {
    const svgToDataUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
    const base = (opts: { a: string; b: string; c: string; icon: string }) => svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600" viewBox="0 0 1200 600">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="${opts.a}"/>
            <stop offset="0.55" stop-color="${opts.b}"/>
            <stop offset="1" stop-color="${opts.c}"/>
          </linearGradient>
          <radialGradient id="r" cx="0.2" cy="0.25" r="0.9">
            <stop offset="0" stop-color="#ffffff" stop-opacity="0.22"/>
            <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <rect width="1200" height="600" fill="url(#g)"/>
        <rect width="1200" height="600" fill="url(#r)"/>
        <g opacity="0.16" fill="#fff">
          <circle cx="140" cy="120" r="82"/>
          <circle cx="310" cy="270" r="52"/>
          <circle cx="980" cy="130" r="110"/>
          <circle cx="1030" cy="390" r="75"/>
          <circle cx="760" cy="480" r="46"/>
        </g>
        <g opacity="0.22" stroke="#fff" stroke-width="18" fill="none" stroke-linecap="round" stroke-linejoin="round">
          ${opts.icon}
        </g>
      </svg>
    `)
    return [
      { id: 'med-1', label: 'Cardiologia', src: base({ a: '#0EA5E9', b: '#1D4ED8', c: '#0F172A', icon: '<path d="M280 350c80-120 160 20 240-90 70-95 185-40 190 55 4 78-65 145-150 200-85-55-170-120-210-165-35-41-55-84-70-100z"/>' }) },
      { id: 'med-2', label: 'Neurologia', src: base({ a: '#7C3AED', b: '#2563EB', c: '#0F172A', icon: '<path d="M420 360c0-85 70-155 155-155 95 0 175 80 175 175 0 70-45 130-110 160"/><path d="M520 250c20 25 20 55 0 80"/><path d="M610 230c25 35 25 75 0 110"/><path d="M700 250c20 25 20 55 0 80"/>' }) },
      { id: 'med-3', label: 'Radiologia', src: base({ a: '#06B6D4', b: '#0EA5E9', c: '#0B1220', icon: '<rect x="410" y="210" width="380" height="250" rx="22"/><path d="M520 280h160"/><path d="M600 250v220"/><circle cx="520" cy="360" r="32"/><circle cx="680" cy="360" r="32"/>' }) },
      { id: 'med-4', label: 'Emergência', src: base({ a: '#EF4444', b: '#F97316', c: '#111827', icon: '<path d="M560 230h80v80h80v80h-80v80h-80v-80h-80v-80h80z"/>' }) },
      { id: 'med-5', label: 'Pediatria', src: base({ a: '#22C55E', b: '#0EA5E9', c: '#0F172A', icon: '<path d="M520 430c35 35 125 35 160 0"/><circle cx="560" cy="320" r="18"/><circle cx="680" cy="320" r="18"/><path d="M600 210c-60 0-110 50-110 110 0 35 18 68 45 88"/><path d="M600 210c60 0 110 50 110 110 0 35-18 68-45 88"/>' }) },
      { id: 'med-6', label: 'Ortopedia', src: base({ a: '#64748B', b: '#334155', c: '#0F172A', icon: '<path d="M520 220c35-15 70 15 55 50l-28 66c-10 24 6 52 32 52h42c26 0 42 28 32 52l-20 48c-10 24-38 40-62 34"/><path d="M670 220c-35-15-70 15-55 50l28 66c10 24-6 52-32 52h-42c-26 0-42 28-32 52l20 48c10 24 38 40 62 34"/>' }) },
      { id: 'med-7', label: 'Cirurgia', src: base({ a: '#14B8A6', b: '#0EA5E9', c: '#0B1220', icon: '<path d="M520 250l160 160"/><path d="M680 250L520 410"/><path d="M500 230l-60-60"/><path d="M700 230l60-60"/>' }) },
      { id: 'med-8', label: 'Dermatologia', src: base({ a: '#F59E0B', b: '#EF4444', c: '#0F172A', icon: '<path d="M600 210c70 60 130 140 130 220 0 85-60 140-130 140s-130-55-130-140c0-80 60-160 130-220z"/><path d="M600 330c0 40 30 70 70 70"/>' }) },
      { id: 'med-9', label: 'Farmacologia', src: base({ a: '#A78BFA', b: '#38BDF8', c: '#0B1220', icon: '<path d="M520 260l160 160"/><path d="M560 220l-40 40"/><path d="M720 380l-40 40"/><rect x="470" y="310" width="260" height="120" rx="60"/><path d="M600 310v120"/>' }) },
      { id: 'med-10', label: 'Odontologia', src: base({ a: '#60A5FA', b: '#22C55E', c: '#0F172A', icon: '<path d="M520 230c-40 30-50 95-30 150 25 70 10 160 60 160 25 0 30-55 50-55s25 55 50 55c50 0 35-90 60-160 20-55 10-120-30-150-25-20-60-10-80 10-20-20-55-30-80-10z"/>' }) },
    ] as const
  }, [])
  const applyCourseCoverFromGallery = (src: string) => {
    setCoverImage(src)
    setCoverImagePath(null)
    setCoverImageFile(null)
    if (coverImageInputRef.current) coverImageInputRef.current.value = ''
    setModuleLayoutImage(src)
    setModuleLayoutImagePath(null)
    setModuleLayoutImageFile(null)
    if (moduleLayoutImageInputRef.current) moduleLayoutImageInputRef.current.value = ''
    setIsCoverGalleryOpen(false)
  }
  const applyNewModuleCoverFromGallery = (src: string) => {
    setNewModuleCoverImage(src)
    setNewModuleCoverFile(null)
    if (newModuleCoverInputRef.current) newModuleCoverInputRef.current.value = ''
    setIsNewModuleCoverGalleryOpen(false)
  }
  const applyModuleEditCoverFromGallery = (src: string) => {
    setModuleEditCoverImage(src)
    setModuleEditCoverFile(null)
    setModuleEditCoverPath(null)
    if (moduleEditCoverInputRef.current) moduleEditCoverInputRef.current.value = ''
    setIsModuleEditCoverGalleryOpen(false)
  }
  const materialColor = (t: LessonMaterial['type']) => {
    switch (t) {
      case 'pdf': return 'bg-[#FDE2E4] text-[#B91C1C]'
      case 'doc': return 'bg-[#DBEAFE] text-[#1D4ED8]'
      case 'xls': return 'bg-[#DCFCE7] text-[#166534]'
      case 'ppt': return 'bg-[#EDE9FE] text-[#6D28D9]'
      case 'link': return 'bg-[#F3F4F6] text-[#374151]'
      default: return 'bg-[#F3F4F6] text-[#374151]'
    }
  }
  const materialIcon = (t: LessonMaterial['type']) => {
    const cls = "h-4 w-4 text-[#9291A5]"
    switch (t) {
      case 'pdf': return <FileText className={cls} />
      case 'doc': return <FileText className={cls} />
      case 'ppt': return <FileType className={cls} />
      case 'xls': return <FileSpreadsheet className={cls} />
      case 'link': return <LinkIcon className={cls} />
      default: return <FileText className={cls} />
    }
  }

  const generateLocalId = () => {
    const c = globalThis.crypto as Crypto | undefined
    if (c && 'randomUUID' in c && typeof (c as any).randomUUID === 'function') return (c as any).randomUUID() as string
    const bytes = new Uint8Array(16)
    c?.getRandomValues?.(bytes)
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const toHex = (n: number) => n.toString(16).padStart(2, '0')
    const hex = Array.from(bytes, toHex).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }

  const inferMaterialType = (nameOrUrl: string): LessonMaterial['type'] => {
    const raw = String(nameOrUrl || '').trim().toLowerCase()
    if (!raw) return 'pdf'
    if (raw.startsWith('http://') || raw.startsWith('https://')) return 'link'
    if (raw.endsWith('.pdf')) return 'pdf'
    if (raw.endsWith('.doc') || raw.endsWith('.docx')) return 'doc'
    if (raw.endsWith('.ppt') || raw.endsWith('.pptx')) return 'ppt'
    if (raw.endsWith('.xls') || raw.endsWith('.xlsx') || raw.endsWith('.csv')) return 'xls'
    return 'pdf'
  }

  const removeCourseMaterial = (materialId: string) => {
    const id = String(materialId || '').trim()
    if (!id) return
    setCourseMaterials((prev) => (Array.isArray(prev) ? prev.filter((m) => String(m?.id || '') !== id) : []))
    setCourseMaterialFilesById((prev) => {
      if (!prev || !(id in prev)) return prev
      const next = { ...(prev || {}) }
      delete next[id]
      return next
    })
  }

  const removeModuleMaterial = (moduleId: string, materialId: string) => {
    const mid = String(moduleId || '').trim()
    const id = String(materialId || '').trim()
    if (!mid || !id) return
    setModules((prev) => (Array.isArray(prev) ? prev.map((m) => {
      if (String(m?.id || '') !== mid) return m
      const mats = Array.isArray((m as any)?.materials) ? (m as any).materials : []
      return { ...(m as any), materials: mats.filter((x: any) => String(x?.id || '') !== id) }
    }) : prev))
    setModuleMaterialFilesById((prev) => {
      if (!prev || !(id in prev)) return prev
      const next = { ...(prev || {}) }
      delete next[id]
      return next
    })
  }

  const removeLessonMaterialFromList = (moduleId: string, lessonId: string, materialId: string) => {
    const mid = String(moduleId || '').trim()
    const lid = String(lessonId || '').trim()
    const id = String(materialId || '').trim()
    if (!mid || !lid || !id) return
    const mod = modules.find((m) => String(m?.id || '') === mid)
    const lesson = mod?.lessons?.find((l) => String(l?.id || '') === lid) || null
    const current = Array.isArray((lesson as any)?.materials) ? (lesson as any).materials : []
    const next = current.filter((m: any) => String(m?.id || '') !== id)
    updateLessonField(mid, lid, 'materials', next as any)
    setLessonMaterialFilesById((prev) => {
      if (!prev || !(id in prev)) return prev
      const out = { ...(prev || {}) }
      delete out[id]
      return out
    })
  }

  const [showModuleForm, setShowModuleForm] = useState(false)
  const [newModuleTitle, setNewModuleTitle] = useState("")
  const [newModuleDescription, setNewModuleDescription] = useState("")
  const [newModuleVisibility, setNewModuleVisibility] = useState<'Gratuita' | 'Paga' | 'Gratuita para alunos do curso'>('Gratuita')
  const [newModulePrice, setNewModulePrice] = useState<string>('')
  const [newModuleFreeCourseIds, setNewModuleFreeCourseIds] = useState<string[]>(['self'])
  const [newModuleCoverImage, setNewModuleCoverImage] = useState<string | null>(null)
  const [newModuleCoverFile, setNewModuleCoverFile] = useState<File | null>(null)
  const newModuleCoverInputRef = useRef<HTMLInputElement | null>(null)
  const [isNewModuleCoverGalleryOpen, setIsNewModuleCoverGalleryOpen] = useState(false)
  const [moduleCoverFilesById, setModuleCoverFilesById] = useState<Record<string, File>>({})
  const [moduleEditCoverImage, setModuleEditCoverImage] = useState<string | null>(null)
  const [moduleEditCoverPath, setModuleEditCoverPath] = useState<string | null>(null)
  const [moduleEditCoverFile, setModuleEditCoverFile] = useState<File | null>(null)
  const moduleEditCoverInputRef = useRef<HTMLInputElement | null>(null)
  const [isModuleEditCoverGalleryOpen, setIsModuleEditCoverGalleryOpen] = useState(false)
  const [price, setPrice] = useState("297,00")

  const parseBrl = (value: any) => {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    const raw = String(value ?? '').trim()
    if (!raw) return 0
    const cleaned = raw
      .replace(/R\$\s*/gi, '')
      .replace(/\u00A0/g, ' ')
      .replace(/\s/g, '')
      .replace(/\./g, '')
      .replace(',', '.')
    const n = Number.parseFloat(cleaned)
    return Number.isFinite(n) ? n : 0
  }

  const paidBreakdown = useMemo(() => {
    let paidModulesCount = 0
    let paidLessonsCount = 0
    let paidModulesTotal = 0
    let paidLessonsTotal = 0

    for (const mod of (Array.isArray(modules) ? modules : [])) {
      const modVis = String((mod as any)?.visibility || '').trim()
      const modCents = Number((mod as any)?.priceCents || 0)
      const modPaid = modVis === 'Paga' || (Number.isFinite(modCents) && modCents > 0)
      if (modPaid) {
        paidModulesCount += 1
        const modValue =
          (Number.isFinite(modCents) && modCents > 0)
            ? modCents / 100
            : parseBrl((mod as any)?.price ?? (mod as any)?.valor ?? (mod as any)?.preco ?? 0)
        paidModulesTotal += Math.max(0, modValue || 0)
      }

      const lessons = Array.isArray((mod as any)?.lessons) ? (mod as any).lessons : []
      for (const lesson of lessons) {
        const lesVis = String((lesson as any)?.visibility || '').trim()
        const lesCents = Number((lesson as any)?.priceCents || 0)
        const lesPaid = lesVis === 'Paga' || (Number.isFinite(lesCents) && lesCents > 0)
        if (!lesPaid) continue
        paidLessonsCount += 1
        const lesValue =
          (Number.isFinite(lesCents) && lesCents > 0)
            ? lesCents / 100
            : parseBrl((lesson as any)?.price ?? (lesson as any)?.valor ?? (lesson as any)?.preco ?? 0)
        paidLessonsTotal += Math.max(0, lesValue || 0)
      }
    }

    return { paidModulesCount, paidLessonsCount, paidModulesTotal, paidLessonsTotal }
  }, [modules])

  const baseCourseValue = parseBrl(price)
  const extrasTotalValue = selectedSimulados
    ? selectedSimulados.reduce((acc, sim) => acc + parseBrl((sim as any)?.priceLabel || 0), 0)
    : 0
  const monetizacaoTotalValue =
    baseCourseValue + extrasTotalValue + (paidBreakdown?.paidModulesTotal || 0) + (paidBreakdown?.paidLessonsTotal || 0)
  const monetizacaoFee = monetizacaoTotalValue > 0 ? (monetizacaoTotalValue * 0.0499) + 1 : 0
  const monetizacaoNet = monetizacaoTotalValue - monetizacaoFee
  const showPaidModules = (paidBreakdown?.paidModulesCount || 0) > 0
  const showPaidLessons = (paidBreakdown?.paidLessonsCount || 0) > 0

  // Configurações por usuário do Vimeo
  const [isVimeoSettingsOpen, setIsVimeoSettingsOpen] = useState(false)
  const [vimeoSettings, setVimeoSettings] = useState<{ client_id: string; client_secret: string; redirect_uri: string; scope: string }>({
    client_id: '',
    client_secret: '',
    redirect_uri: '',
    scope: 'public private upload video_files',
  })
  // Configurações por usuário do VdoCipher
  const [isVdoSettingsOpen, setIsVdoSettingsOpen] = useState(false)
  const [vdoSettings, setVdoSettings] = useState<{ api_secret: string }>({ api_secret: '' })
  const reloadVimeoSettings = async () => {
    if (!user) return
    const { data } = await supabase
      .from('vimeo_settings')
      .select('client_id, client_secret, redirect_uri, scope')
      .eq('user_id', user.id)
      .maybeSingle()
    if (data) {
      setVimeoSettings({
        client_id: data.client_id || '',
        client_secret: data.client_secret || '',
        redirect_uri: data.redirect_uri || '',
        scope: data.scope || 'public private upload video_files',
      })
    }
  }
  const reloadVdoSettings = async () => {
    if (!user) return
    const { data } = await supabase
      .from('vdocipher_settings')
      .select('api_secret')
      .eq('user_id', user.id)
      .maybeSingle()
    if (data) setVdoSettings({ api_secret: data.api_secret || '' })
  }
  useEffect(() => {
    reloadVimeoSettings()
    reloadVdoSettings()
  }, [user])
  useEffect(() => {
    if (isVimeoSettingsOpen) reloadVimeoSettings()
  }, [isVimeoSettingsOpen])
  useEffect(() => {
    if (isVdoSettingsOpen) reloadVdoSettings()
  }, [isVdoSettingsOpen])
  const saveVimeoSettings = async () => {
    if (!user) {
      toast({ title: 'Faça login', description: 'Entre para salvar suas configurações do Vimeo.' })
      return false
    }
    const systemRedirectUri = `${window.location.origin}/vimeo/callback`
    const payload = {
      user_id: user.id,
      client_id: vimeoSettings.client_id,
      client_secret: vimeoSettings.client_secret,
      redirect_uri: systemRedirectUri,
      scope: vimeoSettings.scope || 'public private upload video_files',
    }
      const { error } = await supabase
      .from('vimeo_settings')
      .upsert(payload, { onConflict: 'user_id' })
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message })
      return false
    }
    setVimeoSettings(payload)
    toast({ title: 'Configurações Vimeo salvas', description: 'Você pode conectar agora.' })
    return true
  }

  const saveVdoSettings = async () => {
    if (!user) {
      toast({ title: 'Faça login', description: 'Entre para salvar suas configurações do VdoCipher.' })
      return false
    }
    const payload = {
      user_id: user.id,
      api_secret: vdoSettings.api_secret,
    }
    const { error } = await supabase
      .from('vdocipher_settings')
      .upsert(payload, { onConflict: 'user_id' })
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message })
      return false
    }
    setVdoSettings({ api_secret: payload.api_secret })
    toast({ title: 'Configurações VdoCipher salvas', description: 'Você pode conectar agora.' })
    return true
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

  const ensureHasPlanToCreateCourse = async () => {
    const now = Date.now()
    const local = (() => {
      try {
        const sub = typeof planService.getSubscription === 'function' ? planService.getSubscription() : null
        const status = String(sub?.status || '').toLowerCase()
        const planKey = String(sub?.planKey || '').toLowerCase().trim()
        const expiresAtMs = sub?.expiresAt ? new Date(sub.expiresAt).getTime() : NaN
        if (planKey) {
          if (Number.isFinite(expiresAtMs)) return { ok: expiresAtMs > now, reason: expiresAtMs > now ? null : 'expired' }
          if (status === 'active' || status === 'trial') return { ok: true, reason: null }
          return { ok: true, reason: null }
        }
        const legacy = typeof planService.getActivePlan === 'function' ? planService.getActivePlan() : null
        return legacy ? { ok: true, reason: null } : { ok: false, reason: 'missing' }
      } catch (_) {
        return { ok: false, reason: 'missing' }
      }
    })()
    if (local.ok) return local
    try {
      const { data, error } = await withTimeout(
        supabase.from('profiles').select('active_plan').eq('user_id', String(user?.id || '')).maybeSingle(),
        8000,
        'plan_check_timeout'
      )
      if (!error) {
        const activePlan = String((data as any)?.active_plan || '').trim()
        if (activePlan) return { ok: true, reason: null }
        return { ok: false, reason: 'missing' }
      }
    } catch (_) {}
    return local
  }

  const handleCreateCourse = async () => {
    if (isSavingCourse) return
    if (!user) {
      toast({ title: 'Erro', description: 'Você precisa estar logado para criar um curso.', variant: 'destructive' })
      return
    }

    if (!title.trim()) {
      toast({ title: 'Erro', description: 'O título do curso é obrigatório.', variant: 'destructive' })
      return
    }

    const planCheck = await ensureHasPlanToCreateCourse()
    if (!planCheck.ok) {
      const desc = planCheck.reason === 'expired'
        ? 'Seu plano expirou. Renove ou contrate um plano para criar um curso.'
        : 'Para criar um curso, você precisa contratar um plano.'
      toast({ title: 'Plano necessário', description: desc, variant: 'destructive' })
      try {
        window.history.pushState({}, '', '/planos')
        window.dispatchEvent(new PopStateEvent('popstate'))
      } catch (_) {}
      return
    }

    setIsSavingCourse(true)
    try {
      const generateUuid = () => {
        const c = globalThis.crypto as Crypto | undefined
        if (c && 'randomUUID' in c && typeof (c as any).randomUUID === 'function') return (c as any).randomUUID() as string
        const bytes = new Uint8Array(16)
        c?.getRandomValues?.(bytes)
        bytes[6] = (bytes[6] & 0x0f) | 0x40
        bytes[8] = (bytes[8] & 0x3f) | 0x80
        const toHex = (n: number) => n.toString(16).padStart(2, '0')
        const hex = Array.from(bytes, toHex).join('')
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
      }

      const sanitizeFilename = (name: string) => (name || 'file').replace(/[^a-zA-Z0-9_.-]/g, '_')

      const uploadCourseMedia = async (courseId: string, kind: string, file: File) => {
        if (!user?.id) throw new Error('Usuário não autenticado')
        const safeName = sanitizeFilename(file.name || `${kind}`)
        const envAny = (import.meta as any)?.env || {}
        const isVideo = String(file.type || '').startsWith('video/') || /\.(mp4|mov|m4v|webm|ogg)(\?.*)?$/i.test(String(file.name || ''))
        const shouldUseResumable = isVideo && file.size >= 15_000_000
        const formatBytes = (n: number) => {
          const v = Number(n || 0)
          if (!isFinite(v) || v <= 0) return '0 B'
          const kb = v / 1024
          if (kb < 1024) return `${Math.round(kb)} KB`
          const mb = kb / 1024
          if (mb < 1024) return `${mb.toFixed(1)} MB`
          const gb = mb / 1024
          return `${gb.toFixed(2)} GB`
        }
        const allowed = await withTimeout(canUploadBytes(user.id, file.size, resolvePlanKey()), 8000, 'storage_check_timeout')
          .catch(() => ({ ok: true, reason: 'storage_check_timeout' } as any))
        if (allowed && allowed.ok === false) {
          const usedText = typeof (allowed as any)?.usedBytes === 'number' ? formatBytes(Number((allowed as any).usedBytes)) : null
          const limitText = typeof (allowed as any)?.limitBytes === 'number' ? formatBytes(Number((allowed as any).limitBytes)) : null
          throw new Error(`Limite de armazenamento atingido${usedText && limitText ? ` (${usedText} de ${limitText})` : ''}. Faça upgrade do seu plano para continuar.`)
        }
        const ensureBucketLimit = async () => {
          const token = String(
            session?.access_token ||
            (await supabase.auth.getSession().catch(() => ({ data: null })))?.data?.session?.access_token ||
            ''
          ).trim()
          if (!token) throw new Error('Sessão expirada. Faça login novamente para enviar o vídeo.')
          try {
            const qs = new URLSearchParams({ type: 'ensure_courses_media_upload', bytes: String(file.size) })
            const r = await withTimeout(fetch(`/api/producer?${qs.toString()}`, { headers: { Authorization: `Bearer ${token}` } }), 15000, 'upload_limit_check_timeout')
            const body = await withTimeout(r.json().catch(() => ({} as any)), 5000, 'upload_limit_check_parse_timeout').catch(() => ({} as any))
            if (r.ok && body?.ok === true) return
            const err = String(body?.error || 'upload_limit_check_failed')
            if (err === 'file_exceeds_plan_storage' || err === 'file_exceeds_max_single_file') {
              throw new Error('Esse arquivo excede o limite permitido para o seu plano.')
            }
            if (err === 'file_exceeds_supabase_max') {
              const maxBytes = Number(body?.maxBytes || 0)
              const maxText = maxBytes > 0 ? formatBytes(maxBytes) : null
              const sizeText = formatBytes(file.size)
              throw new Error(`Esse vídeo (${sizeText}) excede o limite máximo do Storage${maxText ? ` (${maxText})` : ''}. Use Vimeo/VdoCipher.`)
            }
          } catch (e) {
            const msg = String((e as any)?.message || e || '')
            if (msg) throw new Error(msg)
          }
        }
        const uploadResumable = async () => {
          const supabaseUrl = String(SUPABASE_URL || '')
          const supabaseAnon = String(SUPABASE_ANON_KEY || '')
          if (!supabaseUrl || !supabaseAnon) throw new Error('Env Supabase ausente: verifique VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY')
          const accessToken = String(session?.access_token || (await supabase.auth.getSession().catch(() => ({ data: null })))?.data?.session?.access_token || '').trim()
          if (!accessToken) throw new Error('Sessão expirada. Faça login novamente para enviar o vídeo.')
          const bucket = 'courses-media'
          const uidSeg = sanitizeStorageSegment(user.id, "user")
          const courseSeg = sanitizeStorageSegment(courseId, "course")
          const kindPath = sanitizeStorageObjectPath(kind) || "media"
          const objectPath = sanitizeStorageObjectPath(`users/${uidSeg}/courses/${courseSeg}/${kindPath}/${Date.now()}_${safeName}`)
          if (!objectPath) throw new Error("invalid_path")
          const endpoint = `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/upload/resumable`
          const tusMod: any = await import('tus-js-client')
          const Upload = tusMod?.Upload
          if (typeof Upload !== 'function') throw new Error('Falha ao inicializar upload resumível')
          await new Promise<void>((resolve, reject) => {
            try {
              let timeoutId: any = null
              const upload = new Upload(file, {
                endpoint,
                retryDelays: [0, 3000, 5000, 10_000, 20_000],
                headers: {
                  authorization: `Bearer ${accessToken}`,
                  apikey: supabaseAnon,
                  'x-upsert': 'true',
                },
                uploadDataDuringCreation: true,
                removeFingerprintOnSuccess: true,
                metadata: {
                  bucketName: bucket,
                  objectName: objectPath,
                  contentType: file.type || 'application/octet-stream',
                },
                onError: (err: any) => {
                  try { if (timeoutId) clearTimeout(timeoutId) } catch (_) {}
                  let status = 0
                  try { status = Number(err?.originalResponse?.getStatus?.() || err?.originalResponse?.getStatusCode?.() || 0) } catch (_) { status = 0 }
                  const msg = String(err?.message || err || '').toLowerCase()
                  const isTooLarge = status === 413 || msg.includes('response code: 413') || msg.includes('maximum size exceeded') || msg.includes('maximum allowed size') || msg.includes('payload too large')
                  if (isTooLarge) {
                    reject(new Error(`Esse vídeo (${formatBytes(file.size)}) excede o limite máximo do Storage no Supabase. Use Vimeo/VdoCipher.`))
                    return
                  }
                  reject(err)
                },
                onSuccess: () => {
                  try { if (timeoutId) clearTimeout(timeoutId) } catch (_) {}
                  resolve()
                },
              })
              timeoutId = setTimeout(() => {
                try { upload.abort(true) } catch (_) {}
                reject(new Error('upload_timeout'))
              }, 10 * 60 * 1000)
              upload.start()
            } catch (e) {
              reject(e)
            }
          })
          const { data: pub } = supabase.storage.from(bucket).getPublicUrl(objectPath)
          return { url: pub?.publicUrl || null, path: objectPath }
        }
        const shouldTryProxy = Boolean(envAny.DEV && envAny.VITE_USE_LOCAL_UPLOAD_PROXY)
        if (shouldTryProxy) {
          try {
            const qs = new URLSearchParams({
              userId: user.id,
              courseId,
              kind,
              filename: safeName,
              contentType: file.type || 'application/octet-stream',
            })
            const resp = await fetch(`/api/upload-course-media?${qs.toString()}`, {
              method: 'POST',
              headers: { 'Content-Type': file.type || 'application/octet-stream', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
              body: file,
            })
            if (resp.ok) {
              const json = await resp.json().catch(() => ({}))
              if (json?.url) return { url: json.url as string, path: (json.path as string) || null }
            }
          } catch (_) {
          }
        }

        await ensureBucketLimit()

        if (shouldUseResumable) {
          try {
            return await uploadResumable()
          } catch (_) {
          }
        }

        const bucket = 'courses-media'
        const uidSeg = sanitizeStorageSegment(user.id, "user")
        const courseSeg = sanitizeStorageSegment(courseId, "course")
        const kindPath = sanitizeStorageObjectPath(kind) || "media"
        const objectPath = sanitizeStorageObjectPath(`users/${uidSeg}/courses/${courseSeg}/${kindPath}/${Date.now()}_${safeName}`)
        if (!objectPath) throw new Error("invalid_path")
        const { data, error } = await withTimeout(
          supabase.storage.from(bucket).upload(objectPath, file, { upsert: true, contentType: file.type || 'application/octet-stream' }),
          180_000,
          'upload_timeout'
        )
        if (error) {
          const msg = String((error as any)?.message || error || '')
          if (isVideo && (msg.toLowerCase().includes('maximum allowed size') || msg.toLowerCase().includes('exceeded the maximum'))) {
            return await uploadResumable()
          }
          throw error
        }
        const storedPath = data?.path || objectPath
        const { data: pub } = supabase.storage.from(bucket).getPublicUrl(storedPath)
        const url = pub?.publicUrl || null
        return { url, path: storedPath }
      }

      const courseId = generateUuid()

      const moduleLayout = moduleLayoutImageFile ? await uploadCourseMedia(courseId, 'module_layout_image', moduleLayoutImageFile) : null
      let cover: any = null
      if (coverImageFile) {
        try {
          cover = await uploadCourseMedia(courseId, 'cover_image', coverImageFile)
        } catch (e: any) {
          const msg = String(e?.message || e || '')
          const isStorageIssue = msg.toLowerCase().includes('bucket not found') || msg.toLowerCase().includes('row-level security') || msg.toLowerCase().includes('unauthorized')
          if (isStorageIssue) {
            const dataUrl = await compressImageFileToDataUrl(coverImageFile, 300_000)
            if (dataUrl) cover = { url: dataUrl, path: null }
          } else {
            throw e
          }
        }
      }
      const promo = promoVideoFile ? await uploadCourseMedia(courseId, 'promo_video', promoVideoFile) : null

      if (!cover && coverImage) {
        cover = { url: coverImage, path: null }
      }

      const modulesWithUploadedCovers = await (async () => {
        const base = Array.isArray(modules) ? modules : []
        const keys = moduleCoverFilesById ? Object.keys(moduleCoverFilesById) : []
        if (keys.length === 0) return base
        const next = await Promise.all(base.map(async (m: any) => {
          const mid = String(m?.id || '')
          const file = mid ? moduleCoverFilesById[mid] : undefined
          if (!file) return m
          try {
            const uploaded = await uploadCourseMedia(courseId, `module_cover/${mid}`, file)
            return { ...m, cover_image_url: uploaded?.url || null, cover_image_path: uploaded?.path || null }
          } catch (e: any) {
            const msg = String(e?.message || e || '')
            const isStorageIssue = msg.toLowerCase().includes('bucket not found') || msg.toLowerCase().includes('row-level security') || msg.toLowerCase().includes('unauthorized')
            if (isStorageIssue) {
              const dataUrl = await compressImageFileToDataUrl(file, 300_000)
              return { ...m, cover_image_url: dataUrl || null, cover_image_path: null }
            }
            throw e
          }
        }))
        setModules(next as any)
        setModuleCoverFilesById({})
        return next as any
      })()

      const modulesWithUploadedLessonVideos = await (async () => {
        const base = Array.isArray(modulesWithUploadedCovers) ? modulesWithUploadedCovers : []
        const keys = lessonVideoFilesById ? Object.keys(lessonVideoFilesById) : []
        if (keys.length === 0) return base
        const next = await Promise.all(base.map(async (m: any) => {
          const moduleId = String(m?.id || '').trim()
          const lessons = Array.isArray(m?.lessons) ? m.lessons : []
          if (lessons.length === 0) return m
          const nextLessons = await Promise.all(lessons.map(async (l: any) => {
            const lid = String(l?.id || '').trim()
            const file = lid ? lessonVideoFilesById[lid] : undefined
            if (!file) return l
            const uploaded = await uploadCourseMedia(courseId, `lesson_video/${moduleId || 'mod'}/${lid}`, file)
            return {
              ...l,
              videoProvider: 'upload',
              videoUrl: uploaded?.url || null,
              videoPath: uploaded?.path || null,
              videoId: null,
            }
          }))
          return { ...m, lessons: nextLessons }
        }))
        setModules(next as any)
        setLessonVideoFilesById({})
        return next as any
      })()

      const modulesWithUploadedMaterials = await (async () => {
        const base = Array.isArray(modulesWithUploadedLessonVideos) ? modulesWithUploadedLessonVideos : []
        const keys = lessonMaterialFilesById ? Object.keys(lessonMaterialFilesById) : []
        if (keys.length === 0) return base
        const next = await Promise.all(base.map(async (m: any) => {
          const lessons = Array.isArray(m?.lessons) ? m.lessons : []
          if (lessons.length === 0) return m
          const nextLessons = await Promise.all(lessons.map(async (l: any) => {
            const mats = Array.isArray(l?.materials) ? l.materials : []
            if (mats.length === 0) return l
            const nextMats = await Promise.all(mats.map(async (mat: any) => {
              const mid = String(mat?.id || '')
              const file = mid ? lessonMaterialFilesById[mid] : undefined
              const t = String(mat?.type || '').toLowerCase()
              if (!file || t === 'link') return mat
              const uploaded = await uploadCourseMedia(courseId, 'materials', file)
              return {
                ...mat,
                id: mid || mat?.id,
                name: String(file.name || mat?.name || '').trim() || mat?.name,
                sizeLabel: String(formatSize(file.size) || mat?.sizeLabel || ''),
                path: uploaded?.path || null,
                url: uploaded?.url || null,
              }
            }))
            return { ...l, materials: nextMats }
          }))
          return { ...m, lessons: nextLessons }
        }))
        setModules(next as any)
        setLessonMaterialFilesById({})
        return next as any
      })()

      const courseMaterialsUploaded = await (async () => {
        const base = Array.isArray(courseMaterials) ? courseMaterials : []
        const keys = courseMaterialFilesById ? Object.keys(courseMaterialFilesById) : []
        if (keys.length === 0) return base
        const next = await Promise.all(base.map(async (mat: any) => {
          const mid = String(mat?.id || '')
          const file = mid ? courseMaterialFilesById[mid] : undefined
          const t = String(mat?.type || '').toLowerCase()
          if (!file || t === 'link') return mat
          const uploaded = await uploadCourseMedia(courseId, 'materials', file)
          return {
            ...mat,
            id: mid || mat?.id,
            name: String(file.name || mat?.name || '').trim() || mat?.name,
            sizeLabel: String(formatSize(file.size) || mat?.sizeLabel || ''),
            path: uploaded?.path || null,
            url: uploaded?.url || null,
          }
        }))
        setCourseMaterials(next as any)
        setCourseMaterialFilesById({})
        return next as any
      })()

      const modulesWithUploadedModuleMaterials = await (async () => {
        const base = Array.isArray(modulesWithUploadedMaterials) ? modulesWithUploadedMaterials : []
        const keys = moduleMaterialFilesById ? Object.keys(moduleMaterialFilesById) : []
        if (keys.length === 0) return base
        const next = await Promise.all(base.map(async (m: any) => {
          const mats = Array.isArray(m?.materials) ? m.materials : []
          if (mats.length === 0) return m
          const nextMats = await Promise.all(mats.map(async (mat: any) => {
            const mid = String(mat?.id || '')
            const file = mid ? moduleMaterialFilesById[mid] : undefined
            const t = String(mat?.type || '').toLowerCase()
            if (!file || t === 'link') return mat
            const uploaded = await uploadCourseMedia(courseId, 'materials', file)
            return {
              ...mat,
              id: mid || mat?.id,
              name: String(file.name || mat?.name || '').trim() || mat?.name,
              sizeLabel: String(formatSize(file.size) || mat?.sizeLabel || ''),
              path: uploaded?.path || null,
              url: uploaded?.url || null,
            }
          }))
          return { ...m, materials: nextMats }
        }))
        setModules(next as any)
        setModuleMaterialFilesById({})
        return next as any
      })()

      const modulesFinal = (Array.isArray(modulesWithUploadedModuleMaterials) ? modulesWithUploadedModuleMaterials : []).map((m: any) => {
        const vis = String(m?.visibility || '').trim()
        if (vis !== 'Gratuita para alunos do curso') return { ...m, freeCourseIds: undefined }
        const raw = m?.freeCourseIds || m?.free_course_ids || []
        const normalized = normalizeFreeCourseIds(raw, String(courseId))
        return { ...m, freeCourseIds: normalized }
      })

      const payloadData = {
        title,
        description,
        modules: modulesFinal,
        status: 'draft',
        selectedCourses,
        selectedCategories,
        selectedSubcategories,
        selectedTags,
        selectedSimulados,
        course_materials: courseMaterialsUploaded,
        courseMaterials: courseMaterialsUploaded,
        price,
        phase_done: phaseDone,
        theme_text_color: themeTextColor,
        theme_button_primary_color: themeButtonPrimaryColor,
        theme_button_secondary_color: themeButtonSecondaryColor,
        theme_page_background_color: themePageBackgroundColor,
        refund_policy_text: 'Reembolso: caso seja acionado, será feito diretamente com o produtor após 7 dias.',
        module_layout_image_url: moduleLayout?.url || null,
        module_layout_image_path: moduleLayout?.path || null,
        cover_image_url: cover?.url || null,
        cover_image_path: cover?.path || null,
        promo_video_url: promo?.url || null,
        promo_video_path: promo?.path || null,
      }

      const metaForModules: any = { ...payloadData }
      delete metaForModules.modules
      const dataForRow: any = { ...payloadData }
      delete dataForRow.modules

      const fullPayload: any = {
        id: courseId,
        user_id: user.id,
        title,
        description,
        modules: { modules: modulesFinal, meta: metaForModules },
        cover_image_url: cover?.url || null,
        promo_video_url: promo?.url || null,
        module_layout_image_url: moduleLayout?.url || null,
        data: dataForRow,
        status: 'draft'
      }

      let insertError: any = null
      {
        let attemptPayload: any = { ...fullPayload }
        for (let i = 0; i < 12; i++) {
          const { error } = await withTimeout(supabase.from('courses').insert(attemptPayload).select('id').single(), 30000, 'courses_insert_timeout')
          insertError = error
          if (!insertError) break
          const msg = String(insertError?.message || insertError || '')
          const isMissingColumn = msg.toLowerCase().includes('does not exist') && msg.toLowerCase().includes('column')
          if (!isMissingColumn) break
          const m = msg.match(/column \"([^\"]+)\"/i)
          const col = m?.[1]
          if (!col || !(col in attemptPayload)) break
          delete attemptPayload[col]
        }
      }
      if (insertError) throw insertError

      toast({ title: 'Sucesso', description: 'Curso criado com sucesso!' })

      setCreatedCourseId(courseId)
      setIsPublishAfterCreateOpen(true)
      setModuleCoverFilesById({})

    } catch (error: any) {
      console.error('Erro ao criar curso:', error)
      const msg = String(error?.message || error || '')
      if (msg.toLowerCase().includes('limite de armazenamento atingido')) {
        toast({ title: 'Plano necessário', description: 'Para enviar arquivos e criar cursos, faça upgrade/contrate um plano.', variant: 'destructive' })
        try {
          window.history.pushState({}, '', '/planos')
          window.dispatchEvent(new PopStateEvent('popstate'))
        } catch (_) {}
        return
      }
      if (msg === 'courses_insert_timeout') {
        toast({ title: 'Tempo excedido', description: 'Não foi possível salvar o curso agora. Tente novamente.', variant: 'destructive' })
        return
      }
      if (msg === 'upload_timeout' || msg === 'upload_limit_check_timeout' || msg === 'upload_limit_check_parse_timeout') {
        toast({ title: 'Tempo excedido', description: 'O envio de arquivos demorou muito. Tente novamente.', variant: 'destructive' })
        return
      }
      if (msg.toLowerCase().includes('bucket not found')) {
        toast({
          title: 'Storage não configurado',
          description: 'Crie o bucket "courses-media" no Supabase (ou rode: npm run migrate:courses-media) e tente novamente.',
          variant: 'destructive'
        })
        return
      }
      if (msg.toLowerCase().includes('row-level security') || msg.toLowerCase().includes('unauthorized')) {
        toast({
          title: 'Sem permissão para upload',
          description: 'Falta policy de INSERT no Storage. Rode: npm run migrate:courses-media (ou ajuste as policies do bucket no Supabase).',
          variant: 'destructive'
        })
        return
      }
      if (msg.toLowerCase().includes('payload too large') || msg.toLowerCase().includes('maximum allowed size')) {
        toast({
          title: 'Arquivo muito grande',
          description: 'Esse vídeo é grande demais para upload simples. Tente novamente (o sistema usa upload resumível). Se persistir, envie um arquivo menor ou use Vimeo/VdoCipher.',
          variant: 'destructive'
        })
        return
      }
      toast({ title: 'Erro', description: 'Erro ao criar curso: ' + msg, variant: 'destructive' })
    } finally {
      setIsSavingCourse(false)
    }
  }

  const handleSaveCourse = async () => {
    if (isSavingCourse) return
    if (!user) {
      toast({ title: 'Erro', description: 'Você precisa estar logado para salvar o curso.', variant: 'destructive' })
      return
    }

    if (!editingCourseId) {
      toast({ title: 'Erro', description: 'Não foi possível identificar o curso para edição.', variant: 'destructive' })
      return
    }

    if (!title.trim()) {
      toast({ title: 'Erro', description: 'O título do curso é obrigatório.', variant: 'destructive' })
      return
    }

    setIsSavingCourse(true)
    try {
      const sanitizeFilename = (name: string) => (name || 'file').replace(/[^a-zA-Z0-9_.-]/g, '_')

      const uploadCourseMedia = async (courseId: string, kind: string, file: File) => {
        if (!user?.id) throw new Error('Usuário não autenticado')
        const safeName = sanitizeFilename(file.name || `${kind}`)
        const envAny = (import.meta as any)?.env || {}
        const isVideo = String(file.type || '').startsWith('video/') || /\.(mp4|mov|m4v|webm|ogg)(\?.*)?$/i.test(String(file.name || ''))
        const shouldUseResumable = isVideo && file.size >= 15_000_000
        const formatBytes = (n: number) => {
          const v = Number(n || 0)
          if (!isFinite(v) || v <= 0) return '0 B'
          const kb = v / 1024
          if (kb < 1024) return `${Math.round(kb)} KB`
          const mb = kb / 1024
          if (mb < 1024) return `${mb.toFixed(1)} MB`
          const gb = mb / 1024
          return `${gb.toFixed(2)} GB`
        }
        const allowed = await canUploadBytes(user.id, file.size, resolvePlanKey())
        if (!allowed.ok) {
          const usedText = typeof (allowed as any)?.usedBytes === 'number' ? formatBytes(Number((allowed as any).usedBytes)) : null
          const limitText = typeof (allowed as any)?.limitBytes === 'number' ? formatBytes(Number((allowed as any).limitBytes)) : null
          throw new Error(`Limite de armazenamento atingido${usedText && limitText ? ` (${usedText} de ${limitText})` : ''}. Faça upgrade do seu plano para continuar.`)
        }
        const uploadResumable = async () => {
          const supabaseUrl = String(SUPABASE_URL || '')
          const supabaseAnon = String(SUPABASE_ANON_KEY || '')
          if (!supabaseUrl || !supabaseAnon) throw new Error('Env Supabase ausente: verifique VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY')
          const accessToken = String(session?.access_token || (await supabase.auth.getSession().catch(() => ({ data: null })))?.data?.session?.access_token || '').trim()
          if (!accessToken) throw new Error('Sessão expirada. Faça login novamente para enviar o vídeo.')
          const bucket = 'courses-media'
          const uidSeg = sanitizeStorageSegment(user.id, "user")
          const courseSeg = sanitizeStorageSegment(courseId, "course")
          const kindPath = sanitizeStorageObjectPath(kind) || "media"
          const objectPath = sanitizeStorageObjectPath(`users/${uidSeg}/courses/${courseSeg}/${kindPath}/${Date.now()}_${safeName}`)
          if (!objectPath) throw new Error("invalid_path")
          const endpoint = `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/upload/resumable`
          const tusMod: any = await import('tus-js-client')
          const Upload = tusMod?.Upload
          if (typeof Upload !== 'function') throw new Error('Falha ao inicializar upload resumível')
          await new Promise<void>((resolve, reject) => {
            try {
              const upload = new Upload(file, {
                endpoint,
                retryDelays: [0, 3000, 5000, 10_000, 20_000],
                headers: {
                  authorization: `Bearer ${accessToken}`,
                  apikey: supabaseAnon,
                  'x-upsert': 'true',
                },
                uploadDataDuringCreation: true,
                removeFingerprintOnSuccess: true,
                metadata: {
                  bucketName: bucket,
                  objectName: objectPath,
                  contentType: file.type || 'application/octet-stream',
                },
                onError: (err: any) => {
                  let status = 0
                  try { status = Number(err?.originalResponse?.getStatus?.() || err?.originalResponse?.getStatusCode?.() || 0) } catch (_) { status = 0 }
                  const msg = String(err?.message || err || '').toLowerCase()
                  const isTooLarge = status === 413 || msg.includes('response code: 413') || msg.includes('maximum size exceeded') || msg.includes('maximum allowed size') || msg.includes('payload too large')
                  if (isTooLarge) {
                    reject(new Error(`Esse vídeo (${formatBytes(file.size)}) excede o limite máximo do Storage no Supabase. Use Vimeo/VdoCipher.`))
                    return
                  }
                  reject(err)
                },
                onSuccess: () => resolve(),
              })
              upload.start()
            } catch (e) {
              reject(e)
            }
          })
          const { data: pub } = supabase.storage.from(bucket).getPublicUrl(objectPath)
          return { url: pub?.publicUrl || null, path: objectPath }
        }
        const shouldTryProxy = Boolean(envAny.DEV && envAny.VITE_USE_LOCAL_UPLOAD_PROXY)
        if (shouldTryProxy) {
          try {
            const qs = new URLSearchParams({
              userId: user.id,
              courseId,
              kind,
              filename: safeName,
              contentType: file.type || 'application/octet-stream',
            })
            const resp = await fetch(`/api/upload-course-media?${qs.toString()}`, {
              method: 'POST',
              headers: { 'Content-Type': file.type || 'application/octet-stream', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
              body: file,
            })
            if (resp.ok) {
              const json = await resp.json().catch(() => ({}))
              if (json?.url) return { url: json.url as string, path: (json.path as string) || null }
            }
          } catch (_) {
          }
        }

        if (shouldUseResumable) {
          try {
            return await uploadResumable()
          } catch (_) {
          }
        }

        const bucket = 'courses-media'
        const uidSeg = sanitizeStorageSegment(user.id, "user")
        const courseSeg = sanitizeStorageSegment(courseId, "course")
        const kindPath = sanitizeStorageObjectPath(kind) || "media"
        const objectPath = sanitizeStorageObjectPath(`users/${uidSeg}/courses/${courseSeg}/${kindPath}/${Date.now()}_${safeName}`)
        if (!objectPath) throw new Error("invalid_path")
        const { data, error } = await supabase.storage.from(bucket).upload(objectPath, file, {
          upsert: true,
          contentType: file.type || 'application/octet-stream',
        })
        if (error) {
          const msg = String((error as any)?.message || error || '')
          if (isVideo && (msg.toLowerCase().includes('maximum allowed size') || msg.toLowerCase().includes('exceeded the maximum'))) {
            return await uploadResumable()
          }
          throw error
        }
        const storedPath = data?.path || objectPath
        const { data: pub } = supabase.storage.from(bucket).getPublicUrl(storedPath)
        const url = pub?.publicUrl || null
        return { url, path: storedPath }
      }

      const moduleLayout = moduleLayoutImageFile ? await uploadCourseMedia(editingCourseId, 'module_layout_image', moduleLayoutImageFile) : null
      let cover: any = null
      if (coverImageFile) {
        try {
          cover = await uploadCourseMedia(editingCourseId, 'cover_image', coverImageFile)
        } catch (e: any) {
          const msg = String(e?.message || e || '')
          const isStorageIssue = msg.toLowerCase().includes('bucket not found') || msg.toLowerCase().includes('row-level security') || msg.toLowerCase().includes('unauthorized')
          if (isStorageIssue) {
            const dataUrl = await compressImageFileToDataUrl(coverImageFile, 300_000)
            if (dataUrl) cover = { url: dataUrl, path: null }
          } else {
            throw e
          }
        }
      }
      const promo = promoVideoFile ? await uploadCourseMedia(editingCourseId, 'promo_video', promoVideoFile) : null

      const finalModuleLayoutUrl = moduleLayout?.url ?? moduleLayoutImage
      const resolvedCoverUrl = cover?.url ?? coverImage
      const finalCoverUrl = resolvedCoverUrl ?? (finalModuleLayoutUrl || null)
      const finalPromoUrl = promo?.url ?? promoVideo

      const finalModuleLayoutPath = moduleLayoutImage === null ? null : (moduleLayout?.path ?? moduleLayoutImagePath)
      const resolvedCoverPath = coverImage === null ? null : (cover?.path ?? coverImagePath)
      const finalCoverPath = resolvedCoverPath ?? null
      const finalPromoPath = promoVideo === null ? null : (promo?.path ?? promoVideoPath)

      setModuleLayoutImage(finalModuleLayoutUrl)
      setCoverImage(finalCoverUrl)
      setPromoVideo(finalPromoUrl)
      setModuleLayoutImagePath(finalModuleLayoutPath)
      setCoverImagePath(finalCoverPath)
      setPromoVideoPath(finalPromoPath)
      setModuleLayoutImageFile(null)
      setCoverImageFile(null)
      setPromoVideoFile(null)

      const modulesWithUploadedCovers = await (async () => {
        const base = Array.isArray(modules) ? modules : []
        const keys = moduleCoverFilesById ? Object.keys(moduleCoverFilesById) : []
        if (keys.length === 0) return base
        const next = await Promise.all(base.map(async (m: any) => {
          const mid = String(m?.id || '')
          const file = mid ? moduleCoverFilesById[mid] : undefined
          if (!file) return m
          try {
            const uploaded = await uploadCourseMedia(editingCourseId, `module_cover/${mid}`, file)
            return { ...m, cover_image_url: uploaded?.url || null, cover_image_path: uploaded?.path || null }
          } catch (e: any) {
            const msg = String(e?.message || e || '')
            const isStorageIssue = msg.toLowerCase().includes('bucket not found') || msg.toLowerCase().includes('row-level security') || msg.toLowerCase().includes('unauthorized')
            if (isStorageIssue) {
              const dataUrl = await compressImageFileToDataUrl(file, 300_000)
              return { ...m, cover_image_url: dataUrl || null, cover_image_path: null }
            }
            throw e
          }
        }))
        setModules(next as any)
        setModuleCoverFilesById({})
        return next as any
      })()

      const modulesWithUploadedLessonVideos = await (async () => {
        const base = Array.isArray(modulesWithUploadedCovers) ? modulesWithUploadedCovers : []
        const keys = lessonVideoFilesById ? Object.keys(lessonVideoFilesById) : []
        if (keys.length === 0) return base
        const next = await Promise.all(base.map(async (m: any) => {
          const moduleId = String(m?.id || '').trim()
          const lessons = Array.isArray(m?.lessons) ? m.lessons : []
          if (lessons.length === 0) return m
          const nextLessons = await Promise.all(lessons.map(async (l: any) => {
            const lid = String(l?.id || '').trim()
            const file = lid ? lessonVideoFilesById[lid] : undefined
            if (!file) return l
            const uploaded = await uploadCourseMedia(editingCourseId, `lesson_video/${moduleId || 'mod'}/${lid}`, file)
            return {
              ...l,
              videoProvider: 'upload',
              videoUrl: uploaded?.url || null,
              videoPath: uploaded?.path || null,
              videoId: null,
            }
          }))
          return { ...m, lessons: nextLessons }
        }))
        setModules(next as any)
        setLessonVideoFilesById({})
        return next as any
      })()

      const modulesWithUploadedMaterials = await (async () => {
        const base = Array.isArray(modulesWithUploadedLessonVideos) ? modulesWithUploadedLessonVideos : []
        const keys = lessonMaterialFilesById ? Object.keys(lessonMaterialFilesById) : []
        if (keys.length === 0) return base
        const next = await Promise.all(base.map(async (m: any) => {
          const lessons = Array.isArray(m?.lessons) ? m.lessons : []
          if (lessons.length === 0) return m
          const nextLessons = await Promise.all(lessons.map(async (l: any) => {
            const mats = Array.isArray(l?.materials) ? l.materials : []
            if (mats.length === 0) return l
            const nextMats = await Promise.all(mats.map(async (mat: any) => {
              const mid = String(mat?.id || '')
              const file = mid ? lessonMaterialFilesById[mid] : undefined
              const t = String(mat?.type || '').toLowerCase()
              if (!file || t === 'link') return mat
              const uploaded = await uploadCourseMedia(editingCourseId, 'materials', file)
              return {
                ...mat,
                id: mid || mat?.id,
                name: String(file.name || mat?.name || '').trim() || mat?.name,
                sizeLabel: String(formatSize(file.size) || mat?.sizeLabel || ''),
                path: uploaded?.path || null,
                url: uploaded?.url || null,
              }
            }))
            return { ...l, materials: nextMats }
          }))
          return { ...m, lessons: nextLessons }
        }))
        setModules(next as any)
        setLessonMaterialFilesById({})
        return next as any
      })()

      const courseMaterialsUploaded = await (async () => {
        const base = Array.isArray(courseMaterials) ? courseMaterials : []
        const keys = courseMaterialFilesById ? Object.keys(courseMaterialFilesById) : []
        if (keys.length === 0) return base
        const next = await Promise.all(base.map(async (mat: any) => {
          const mid = String(mat?.id || '')
          const file = mid ? courseMaterialFilesById[mid] : undefined
          const t = String(mat?.type || '').toLowerCase()
          if (!file || t === 'link') return mat
          const uploaded = await uploadCourseMedia(editingCourseId, 'materials', file)
          return {
            ...mat,
            id: mid || mat?.id,
            name: String(file.name || mat?.name || '').trim() || mat?.name,
            sizeLabel: String(formatSize(file.size) || mat?.sizeLabel || ''),
            path: uploaded?.path || null,
            url: uploaded?.url || null,
          }
        }))
        setCourseMaterials(next as any)
        setCourseMaterialFilesById({})
        return next as any
      })()

      const modulesWithUploadedModuleMaterials = await (async () => {
        const base = Array.isArray(modulesWithUploadedMaterials) ? modulesWithUploadedMaterials : []
        const keys = moduleMaterialFilesById ? Object.keys(moduleMaterialFilesById) : []
        if (keys.length === 0) return base
        const next = await Promise.all(base.map(async (m: any) => {
          const mats = Array.isArray(m?.materials) ? m.materials : []
          if (mats.length === 0) return m
          const nextMats = await Promise.all(mats.map(async (mat: any) => {
            const mid = String(mat?.id || '')
            const file = mid ? moduleMaterialFilesById[mid] : undefined
            const t = String(mat?.type || '').toLowerCase()
            if (!file || t === 'link') return mat
            const uploaded = await uploadCourseMedia(editingCourseId, 'materials', file)
            return {
              ...mat,
              id: mid || mat?.id,
              name: String(file.name || mat?.name || '').trim() || mat?.name,
              sizeLabel: String(formatSize(file.size) || mat?.sizeLabel || ''),
              path: uploaded?.path || null,
              url: uploaded?.url || null,
            }
          }))
          return { ...m, materials: nextMats }
        }))
        setModules(next as any)
        setModuleMaterialFilesById({})
        return next as any
      })()

      const modulesFinal = (Array.isArray(modulesWithUploadedModuleMaterials) ? modulesWithUploadedModuleMaterials : []).map((m: any) => {
        const vis = String(m?.visibility || '').trim()
        if (vis !== 'Gratuita para alunos do curso') return { ...m, freeCourseIds: undefined }
        const raw = m?.freeCourseIds || m?.free_course_ids || []
        const normalized = normalizeFreeCourseIds(raw, String(editingCourseId))
        return { ...m, freeCourseIds: normalized }
      })

      const payloadData = {
        title,
        description,
        modules: modulesFinal,
        status: courseStatus,
        selectedCourses,
        selectedCategories,
        selectedSubcategories,
        selectedTags,
        selectedSimulados,
        course_materials: courseMaterialsUploaded,
        courseMaterials: courseMaterialsUploaded,
        price,
        phase_done: phaseDone,
        theme_text_color: themeTextColor,
        theme_button_primary_color: themeButtonPrimaryColor,
        theme_button_secondary_color: themeButtonSecondaryColor,
        theme_page_background_color: themePageBackgroundColor,
        refund_policy_text: 'Reembolso: caso seja acionado, será feito diretamente com o produtor após 7 dias.',
        module_layout_image_url: finalModuleLayoutUrl || null,
        module_layout_image_path: finalModuleLayoutPath || null,
        cover_image_url: finalCoverUrl || null,
        cover_image_path: finalCoverPath || null,
        promo_video_url: finalPromoUrl || null,
        promo_video_path: finalPromoPath || null,
      }

      const metaForModules: any = { ...payloadData }
      delete metaForModules.modules
      const dataForRow: any = { ...payloadData }
      delete dataForRow.modules

      const updatePayload: any = {
        title,
        description,
        modules: { modules: modulesFinal, meta: metaForModules },
        cover_image_url: finalCoverUrl || null,
        promo_video_url: finalPromoUrl || null,
        module_layout_image_url: finalModuleLayoutUrl || null,
        data: dataForRow,
      }

      let updateError: any = null
      {
        let attemptPayload: any = { ...updatePayload }
        for (let i = 0; i < 12; i++) {
          const { error } = await supabase
            .from('courses')
            .update(attemptPayload)
            .eq('id', editingCourseId)
            .eq('user_id', user.id)

          updateError = error
          if (!updateError) break
          const msg = String(updateError?.message || updateError || '')
          const isMissingColumn = msg.toLowerCase().includes('does not exist') && msg.toLowerCase().includes('column')
          if (!isMissingColumn) break
          const m = msg.match(/column \"([^\"]+)\"/i)
          const col = m?.[1]
          if (!col || !(col in attemptPayload)) break
          delete attemptPayload[col]
        }
      }
      if (updateError) throw updateError

      toast({ title: 'Sucesso', description: 'Curso salvo com sucesso!' })
      setModuleCoverFilesById({})
    } catch (error: any) {
      console.error('Erro ao salvar curso:', error)
      const msg = String(error?.message || error || '')
      if (msg.toLowerCase().includes('bucket not found')) {
        toast({
          title: 'Storage não configurado',
          description: 'Crie o bucket "courses-media" no Supabase (ou rode: npm run migrate:courses-media) e tente novamente.',
          variant: 'destructive'
        })
        return
      }
      if (msg.toLowerCase().includes('row-level security') || msg.toLowerCase().includes('unauthorized')) {
        toast({
          title: 'Sem permissão para upload',
          description: 'Falta policy de UPDATE/INSERT no Storage. Rode: npm run migrate:courses-media (ou ajuste as policies do bucket no Supabase).',
          variant: 'destructive'
        })
        return
      }
      if (msg.toLowerCase().includes('payload too large') || msg.toLowerCase().includes('maximum allowed size')) {
        toast({
          title: 'Arquivo muito grande',
          description: 'Esse vídeo é grande demais para upload simples. Tente novamente (o sistema usa upload resumível). Se persistir, envie um arquivo menor ou use Vimeo/VdoCipher.',
          variant: 'destructive'
        })
        return
      }
      toast({ title: 'Erro', description: 'Erro ao salvar curso: ' + msg, variant: 'destructive' })
    } finally {
      setIsSavingCourse(false)
    }
  }

  // Conexão com provedores de vídeo: verifica Vimeo e VdoCipher
  const [connectedProviders, setConnectedProviders] = useState<{ vimeo: boolean; vdocipher: boolean }>({ vimeo: false, vdocipher: false })
  useEffect(() => {
    let active = true
    const checkConnections = async () => {
      try {
        let vdocipher = localStorage.getItem('connectedProvider.vdocipher') === 'true'
        if (!user) {
          if (active) setConnectedProviders({ vimeo: false, vdocipher })
          return
        }
        const { data, error } = await supabase
          .from('vimeo_connections')
          .select('id')
          .eq('user_id', user.id)
          .limit(1)
        if (error) {
          console.warn('Erro verificando conexão Vimeo:', error.message)
        }
        const vimeoConnected = Array.isArray(data) && data.length > 0
        if (!vimeoConnected) {
          try { localStorage.removeItem('connectedProvider.vimeo') } catch (_) {}
        }
        // Verifica vdocipher_connections
        const { data: vdData, error: vdError } = await supabase
          .from('vdocipher_connections')
          .select('id')
          .eq('user_id', user.id)
          .limit(1)
        if (vdError) {
          console.warn('Erro verificando conexão VdoCipher:', vdError.message)
        }
        const vdocipherConnected = Array.isArray(vdData) && vdData.length > 0
        if (vdocipherConnected) {
          vdocipher = true
          try { localStorage.setItem('connectedProvider.vdocipher', 'true') } catch (_) {}
        }
        if (active) setConnectedProviders({ vimeo: vimeoConnected, vdocipher })
      } catch (e) {
        console.warn('Falha ao verificar conexões:', e)
        const vdocipher = localStorage.getItem('connectedProvider.vdocipher') === 'true'
        if (active) setConnectedProviders({ vimeo: false, vdocipher })
      }
    }
    checkConnections()
    return () => { active = false }
  }, [user])
  const handleConnectService = (provider: 'vimeo' | 'vdocipher') => {
    if (!user) {
      toast({ title: 'Faça login', description: `Entre para conectar ao ${provider}.` })
      const next = encodeURIComponent('/produtos/novo#aulas')
      window.location.href = `/login?next=${next}`
      return
    }
    if (provider === 'vimeo') {
      const clientId = vimeoSettings.client_id
      const clientSecret = vimeoSettings.client_secret
      const redirectUri = `${window.location.origin}/vimeo/callback`
      const scope = vimeoSettings.scope || 'public private upload video_files'
      if (!clientId || !clientSecret) {
        toast({ title: 'Configuração do Vimeo', description: 'Defina seu Client ID e Client Secret.' })
        setIsVimeoSettingsOpen(true)
        return
      }
      const state = Math.random().toString(36).slice(2)
      try { localStorage.setItem('vimeo_oauth_state', state) } catch (_) {}
      try { localStorage.setItem('vimeo_redirect_uri', redirectUri) } catch (_) {}
      try { localStorage.setItem('vimeo_post_connect_next', '/produtos/novo#aulas') } catch (_) {}
      const url = `https://api.vimeo.com/oauth/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${encodeURIComponent(state)}`
      window.location.href = url
      return
    }
    // VdoCipher: validar api_secret via Edge Function e marcar conexão
    if (provider === 'vdocipher') {
      const apiSecret = vdoSettings.api_secret
      if (!apiSecret) {
        toast({ title: 'Configuração do VdoCipher', description: 'Informe seu API Secret.' })
        setIsVdoSettingsOpen(true)
        return
      }
      if (!session?.access_token) {
        toast({ title: 'Sessão expirada', description: 'Faça login novamente.' })
        const next = encodeURIComponent('/produtos/novo#aulas')
        window.location.href = `/login?next=${next}`
        return
      }
      const fnUrl = `${SUPABASE_URL}/functions/v1/vdocipher-connect`
      fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({}),
      }).then(async (res) => {
        if (!res.ok) {
          const err = await res.text()
          console.error('VdoCipher connect failed:', err)
          toast({ title: 'Conexão VdoCipher', description: 'Falha ao validar a chave. Verifique o API Secret.' })
          return
        }
        try { localStorage.setItem('connectedProvider.vdocipher', 'true') } catch (_) {}
        setConnectedProviders((prev) => ({ ...prev, vdocipher: true }))
        toast({ title: 'VdoCipher conectado', description: 'Integração concluída com sucesso.' })
      }).catch((e) => {
        console.error(e)
        toast({ title: 'Conexão VdoCipher', description: 'Erro inesperado.' })
      })
      return
    }
  }

  const [selectedCourses, setSelectedCourses] = useState<Course[]>([])
  const [showCourseSelector, setShowCourseSelector] = useState(false)
  const [availableCourses, setAvailableCourses] = useState<Course[]>([])
  const [isLoadingAvailableCourses, setIsLoadingAvailableCourses] = useState(false)
const [isModulesSectionExpanded, setIsModulesSectionExpanded] = useState(false)
const [isLessonsSectionExpanded, setIsLessonsSectionExpanded] = useState(true)
const [isExtrasSectionExpanded, setIsExtrasSectionExpanded] = useState(false)
const [isStudentAreaSectionExpanded, setIsStudentAreaSectionExpanded] = useState(false)
  const [isSettingsSectionExpanded, setIsSettingsSectionExpanded] = useState(false)
  // Estado derivado: habilita conexão Vimeo somente quando configurado
  const isVimeoConfigured = !!(vimeoSettings.client_id && vimeoSettings.client_secret)
  // Estado derivado: habilita conexão VdoCipher somente quando configurado
  const isVdoConfigured = !!(vdoSettings.api_secret)

  // Upload de vídeo via VdoCipher (título + arquivo)
  const [vdoUploadTitle, setVdoUploadTitle] = useState("")
  const [vdoUploadFile, setVdoUploadFile] = useState<File | null>(null)
  const [isVdoUploading, setIsVdoUploading] = useState(false)

  const getLessonTitleForUpload = () => {
    if (editingModuleId && editingLessonId) {
      const mod = modules.find((m) => m.id === editingModuleId)
      const lt = mod?.lessons.find((l) => l.id === editingLessonId)?.title?.trim() || ''
      if (lt) return lt
    }
    return (newLessonTitle?.trim() || '')
  }

  const handleVdoUpload = async () => {
    try {
      if (!user) {
        toast({ title: 'Faça login', description: 'Entre para enviar vídeos.' })
        const next = encodeURIComponent('/produtos/novo#aulas')
        window.location.href = `/login?next=${next}`
        return
      }
      if (!connectedProviders.vdocipher) {
        toast({ title: 'VdoCipher não conectado', description: 'Conecte o VdoCipher antes de enviar.' })
        return
      }
      const effectiveTitle = getLessonTitleForUpload() || vdoUploadTitle.trim()
      if (!effectiveTitle || !vdoUploadFile) {
        toast({ title: 'Dados incompletos', description: 'Defina o título da aula e selecione um arquivo.' })
        return
      }
      if (!session?.access_token) {
        toast({ title: 'Sessão expirada', description: 'Faça login novamente.' })
        const next = encodeURIComponent('/produtos/novo#aulas')
        window.location.href = `/login?next=${next}`
        return
      }
      setIsVdoUploading(true)
      const fnUrl = `${SUPABASE_URL}/functions/v1/vdocipher-upload`
      const credsRes = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ title: effectiveTitle }),
      })
      if (!credsRes.ok) {
        const err = await credsRes.text()
        console.error('VdoCipher creds error:', err)
        toast({ title: 'Falha ao obter credenciais', description: 'Verifique o API Secret e tente novamente.' })
        setIsVdoUploading(false)
        return
      }
      const { clientPayload, videoId } = await credsRes.json()
      if (!clientPayload || !clientPayload.uploadLink) {
        toast({ title: 'Resposta inválida', description: 'Credenciais incompletas para upload.' })
        setIsVdoUploading(false)
        return
      }
      const form = new FormData()
      form.append('policy', clientPayload['policy'])
      form.append('key', clientPayload['key'])
      form.append('x-amz-signature', clientPayload['x-amz-signature'])
      form.append('x-amz-algorithm', clientPayload['x-amz-algorithm'])
      form.append('x-amz-date', clientPayload['x-amz-date'])
      form.append('x-amz-credential', clientPayload['x-amz-credential'])
      form.append('success_action_status', '201')
      form.append('success_action_redirect', '')
      form.append('file', vdoUploadFile)

      const uploadRes = await fetch(clientPayload['uploadLink'], { method: 'POST', body: form })
      if (!uploadRes.ok) {
        const txt = await uploadRes.text()
        console.error('S3 upload failed:', txt)
        toast({ title: 'Upload falhou', description: 'Não foi possível enviar o arquivo.' })
        setIsVdoUploading(false)
        return
      }
      toast({ title: 'Upload iniciado', description: `Vídeo ${videoId} enviado. O processamento será iniciado.` })
      try {
        if (editingModuleId && editingLessonId && videoId) {
          updateLessonField(editingModuleId, editingLessonId, 'videoProvider', 'vdocipher')
          updateLessonField(editingModuleId, editingLessonId, 'videoId', String(videoId))
          updateLessonField(editingModuleId, editingLessonId, 'videoUrl', '')
        }
      } catch (_) {}
      if (videoId) {
        setDefaultVideoProvider('vdocipher')
        setNewLessonVideoId(String(videoId))
        setNewLessonVideoUrl('')
        setNewLessonVideoPath(null)
      }
      setVdoUploadTitle('')
      setVdoUploadFile(null)
      setIsVdoUploading(false)
    } catch (e) {
      console.error(e)
      toast({ title: 'Erro no upload', description: 'Tente novamente em instantes.' })
      setIsVdoUploading(false)
    }
  }

  const handleLessonStorageUpload = async () => {
    const courseId = String(editingCourseId || createdCourseId || '').trim()
    const lessonId = String(editingLessonId || draftLessonId || '').trim()
    const file = lessonUploadFile || (lessonId ? lessonVideoFilesById?.[lessonId] : null)
    const sanitizeFilename = (name: string) => (name || 'file').replace(/[^a-zA-Z0-9_.-]/g, '_')
    const formatBytes = (n: number) => {
      const v = Number(n || 0)
      if (!isFinite(v) || v <= 0) return '0 B'
      const kb = v / 1024
      if (kb < 1024) return `${Math.round(kb)} KB`
      const mb = kb / 1024
      if (mb < 1024) return `${mb.toFixed(1)} MB`
      const gb = mb / 1024
      return `${gb.toFixed(2)} GB`
    }

    try {
      if (!user) {
        toast({ title: 'Faça login', description: 'Entre para enviar vídeos.' })
        const next = encodeURIComponent('/produtos/novo#aulas')
        window.location.href = `/login?next=${next}`
        return
      }
      if (!lessonId) {
        toast({ title: 'Aula não definida', description: 'Defina a aula antes de enviar o vídeo.' })
        return
      }
      if (!file) {
        toast({ title: 'Selecione um arquivo', description: 'Escolha um vídeo para enviar.' })
        return
      }
      setIsLessonUploadUploading(true)
      const allowed = await canUploadBytes(user.id, file.size, resolvePlanKey())
      if (!allowed.ok) {
        const usedText = typeof (allowed as any)?.usedBytes === 'number' ? formatBytes(Number((allowed as any).usedBytes)) : null
        const limitText = typeof (allowed as any)?.limitBytes === 'number' ? formatBytes(Number((allowed as any).limitBytes)) : null
        toast({ title: 'Limite de armazenamento', description: `Limite de armazenamento atingido${usedText && limitText ? ` (${usedText} de ${limitText})` : ''}. Faça upgrade do seu plano para continuar.`, variant: 'destructive' as any })
        setIsLessonUploadUploading(false)
        return
      }
      const bucket = 'courses-media'
      const safeName = sanitizeFilename(file.name || 'video')
      const root = courseId ? `users/${user.id}/courses/${courseId}` : `users/${user.id}/drafts`
      const lessonSeg = sanitizeStorageSegment(lessonId, "lesson")
      const objectPath = sanitizeStorageObjectPath(`${root}/lesson_video/${lessonSeg}/${Date.now()}_${safeName}`)
      if (!objectPath) throw new Error("invalid_path")
      const token = String(session?.access_token || '').trim()
      const effectiveToken = token || String((await supabase.auth.getSession().catch(() => ({ data: null })))?.data?.session?.access_token || '').trim()
      if (effectiveToken) {
        const qs = new URLSearchParams({ type: 'ensure_courses_media_upload', bytes: String(file.size) })
        const r = await fetch(`/api/producer?${qs.toString()}`, { headers: { Authorization: `Bearer ${effectiveToken}` } })
        const body = await r.json().catch(() => ({}))
        if (!r.ok || body?.ok !== true) {
          const err = String(body?.error || '')
          if (err === 'file_exceeds_plan_storage' || err === 'file_exceeds_max_single_file') {
            throw new Error('Esse arquivo excede o limite permitido para o seu plano.')
          }
          if (err === 'file_exceeds_supabase_max') {
            const maxBytes = Number(body?.maxBytes || 0)
            const maxText = maxBytes > 0 ? formatBytes(maxBytes) : null
            const sizeText = formatBytes(file.size)
            throw new Error(`Esse vídeo (${sizeText}) excede o limite máximo do Storage${maxText ? ` (${maxText})` : ''}. Use Vimeo/VdoCipher.`)
          }
        }
      } else {
        throw new Error('Sessão expirada. Faça login novamente para enviar o vídeo.')
      }

      const supabaseUrl = String(SUPABASE_URL || '')
      const supabaseAnon = String(SUPABASE_ANON_KEY || '')
      const isVideo = String(file.type || '').startsWith('video/') || /\.(mp4|mov|m4v|webm|ogg)(\?.*)?$/i.test(String(file.name || ''))
      const shouldUseResumable = isVideo && file.size >= 15_000_000
      const uploadResumable = async () => {
        if (!supabaseUrl || !supabaseAnon) throw new Error('Env Supabase ausente: verifique VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY')
        const accessToken = String(session?.access_token || (await supabase.auth.getSession().catch(() => ({ data: null })))?.data?.session?.access_token || '').trim()
        if (!accessToken) throw new Error('Sessão expirada. Faça login novamente para enviar o vídeo.')
        const endpoint = `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/upload/resumable`
        const tusMod: any = await import('tus-js-client')
        const Upload = tusMod?.Upload
        if (typeof Upload !== 'function') throw new Error('Falha ao inicializar upload resumível')
        await new Promise<void>((resolve, reject) => {
          try {
            const upload = new Upload(file, {
              endpoint,
              retryDelays: [0, 3000, 5000, 10_000, 20_000],
              headers: {
                authorization: `Bearer ${accessToken}`,
                apikey: supabaseAnon,
                'x-upsert': 'true',
              },
              uploadDataDuringCreation: true,
              removeFingerprintOnSuccess: true,
              metadata: {
                bucketName: bucket,
                objectName: objectPath,
                contentType: file.type || 'application/octet-stream',
              },
              onError: (err: any) => {
                let status = 0
                try { status = Number(err?.originalResponse?.getStatus?.() || err?.originalResponse?.getStatusCode?.() || 0) } catch (_) { status = 0 }
                const msg = String(err?.message || err || '').toLowerCase()
                const isTooLarge = status === 413 || msg.includes('response code: 413') || msg.includes('maximum size exceeded') || msg.includes('maximum allowed size') || msg.includes('payload too large')
                if (isTooLarge) {
                  reject(new Error(`Esse vídeo (${formatBytes(file.size)}) excede o limite máximo do Storage no Supabase. Use Vimeo/VdoCipher.`))
                  return
                }
                reject(err)
              },
              onSuccess: () => resolve(),
            })
            upload.start()
          } catch (e) {
            reject(e)
          }
        })
        return { path: objectPath }
      }

      if (shouldUseResumable) {
        await uploadResumable()
      } else {
        const { data, error } = await supabase.storage.from(bucket).upload(objectPath, file, { upsert: true, contentType: file.type || 'application/octet-stream' })
        if (error) {
          const msg = String((error as any)?.message || error || '').toLowerCase()
          const isTooLarge = msg.includes('maximum allowed size') || msg.includes('exceeded the maximum allowed size') || msg.includes('payload too large')
          if (isTooLarge && isVideo) {
            await uploadResumable()
          } else {
            throw error
          }
        }
        void data
      }
      const storedPath = objectPath
      const { data: pub } = supabase.storage.from(bucket).getPublicUrl(storedPath)
      const url = pub?.publicUrl || ''
      if (!url) throw new Error('Não foi possível obter a URL do vídeo.')
      setDefaultVideoProvider('upload')
      setNewLessonVideoUrl(url)
      setNewLessonVideoId('')
      setNewLessonVideoPath(storedPath)
      setLessonUploadFile(null)
      setLessonVideoFilesById((prev) => {
        const next = { ...(prev || {}) }
        delete next[lessonId]
        return next
      })
      toast({ title: 'Vídeo enviado', description: 'Upload concluído com sucesso.' })
    } catch (e: any) {
      const raw = String(e?.message || e || '')
      const lower = raw.toLowerCase()
      const msg = lower.includes('maximum allowed size') || lower.includes('exceeded the maximum allowed size') || lower.includes('payload too large') || (lower.includes('response code: 413') && lower.includes('tus')) || lower.includes('maximum size exceeded')
        ? 'Esse vídeo excede o limite máximo do Storage no Supabase. Use Vimeo/VdoCipher.'
        : raw
      toast({ title: 'Erro no upload', description: msg || 'Tente novamente.', variant: 'destructive' as any })
    } finally {
      setIsLessonUploadUploading(false)
    }
  }

  const vdoUploadSectionRef = useRef<HTMLDivElement | null>(null)
  const handleVdoDisconnect = async () => {
    try {
      if (!user) {
        toast({ title: 'Faça login', description: 'Entre para desconectar.' })
        const next = encodeURIComponent('/produtos/novo#aulas')
        window.location.href = `/login?next=${next}`
        return
      }
      const { error } = await supabase
        .from('vdocipher_connections')
        .delete()
        .eq('user_id', user.id)
      if (error) {
        toast({ title: 'Falha ao desconectar', description: error.message })
        return
      }
      try { localStorage.removeItem('connectedProvider.vdocipher') } catch (_) {}
      setConnectedProviders((prev) => ({ ...prev, vdocipher: false }))
      toast({ title: 'VdoCipher desconectado', description: 'Você pode reconectar quando quiser.' })
    } catch (e) {
      console.error(e)
      toast({ title: 'Erro ao desconectar', description: 'Tente novamente.' })
    }
  }

  // Upload de vídeo via Vimeo (arquivo apenas; título usa nome da aula)
  const [vimeoUploadFile, setVimeoUploadFile] = useState<File | null>(null)
  const [isVimeoUploading, setIsVimeoUploading] = useState(false)
  const [vimeoUploadProgress, setVimeoUploadProgress] = useState<number>(0)

  const handleVimeoUpload = async () => {
    try {
      if (!user) {
        toast({ title: 'Faça login', description: 'Entre para enviar vídeos.' })
        const next = encodeURIComponent('/produtos/novo#aulas')
        window.location.href = `/login?next=${next}`
        return
      }
      if (!connectedProviders.vimeo) {
        toast({ title: 'Conecte o Vimeo', description: 'Finalize a integração do Vimeo para enviar vídeos.' })
        return
      }
      if (!vimeoUploadFile) {
        toast({ title: 'Selecione um arquivo', description: 'Escolha um vídeo para enviar.' })
        return
      }

      const effectiveTitle = getLessonTitleForUpload()

      // Obter token do Vimeo
      const { data: vcRow, error: vcErr } = await supabase
        .from('vimeo_connections')
        .select('access_token')
        .eq('user_id', user.id)
        .single()
      if (vcErr || !vcRow?.access_token) {
        toast({ title: 'Token Vimeo indisponível', description: 'Reconecte o Vimeo e tente novamente.' })
        return
      }
      const accessToken = vcRow.access_token as string

      setIsVimeoUploading(true)
      setVimeoUploadProgress(0)

      // Criar vídeo com abordagem TUS
      const initRes = await fetch('https://api.vimeo.com/me/videos', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/vnd.vimeo.*+json;version=3.4',
        },
        body: JSON.stringify({
          upload: { approach: 'tus', size: vimeoUploadFile.size },
          name: effectiveTitle,
        }),
      })
      if (!initRes.ok) {
        const txt = await initRes.text()
        console.error('Vimeo init failed:', txt)
        toast({ title: 'Falha ao iniciar upload', description: 'Não foi possível criar o vídeo no Vimeo.' })
        setIsVimeoUploading(false)
        return
      }
      const initJson = await initRes.json()
      const uploadLink: string = initJson?.upload?.upload_link
      const vimeoUri: string = initJson?.uri
      if (!uploadLink) {
        toast({ title: 'Link de upload ausente', description: 'Tente reconectar o Vimeo.' })
        setIsVimeoUploading(false)
        return
      }

      // Envio TUS em chunks
      const chunkSize = 8 * 1024 * 1024 // 8MB
      let offset = 0
      while (offset < vimeoUploadFile.size) {
        const chunk = vimeoUploadFile.slice(offset, Math.min(offset + chunkSize, vimeoUploadFile.size))
        const patchRes = await fetch(uploadLink, {
          method: 'PATCH',
          headers: {
            'Tus-Resumable': '1.0.0',
            'Upload-Offset': String(offset),
            'Content-Type': 'application/offset+octet-stream',
          },
          body: chunk,
        })
        if (!patchRes.ok) {
          const txt = await patchRes.text()
          console.error('Vimeo TUS patch failed:', txt)
          toast({ title: 'Falha no upload Vimeo', description: 'Erro ao enviar os dados do vídeo.' })
          setIsVimeoUploading(false)
          return
        }
        const newOffsetHeader = patchRes.headers.get('Upload-Offset')
        offset = newOffsetHeader ? Number(newOffsetHeader) : offset + chunk.size
        setVimeoUploadProgress(Math.round((offset / vimeoUploadFile.size) * 100))
      }

      toast({ title: 'Upload Vimeo iniciado', description: `Vídeo criado: ${vimeoUri}. Processamento em andamento.` })
      try {
        if (editingModuleId && editingLessonId && vimeoUri) {
          const id = String(vimeoUri).match(/\/videos\/(\d+)/i)?.[1] || ''
          const url = id ? `https://player.vimeo.com/video/${id}` : String(vimeoUri)
          updateLessonField(editingModuleId, editingLessonId, 'videoProvider', 'vimeo')
          updateLessonField(editingModuleId, editingLessonId, 'videoUrl', url)
          updateLessonField(editingModuleId, editingLessonId, 'videoId', '')
        }
      } catch (_) {}
      setVimeoUploadFile(null)
      setIsVimeoUploading(false)
      setVimeoUploadProgress(0)
    } catch (e) {
      console.error(e)
      toast({ title: 'Erro no upload Vimeo', description: 'Tente novamente em instantes.' })
      setIsVimeoUploading(false)
    }
  }

  const handleVimeoDisconnect = async () => {
    try {
      if (!user) {
        toast({ title: 'Faça login', description: 'Entre para desconectar.' })
        const next = encodeURIComponent('/produtos/novo#aulas')
        window.location.href = `/login?next=${next}`
        return
      }
      const { error } = await supabase
        .from('vimeo_connections')
        .delete()
        .eq('user_id', user.id)
      if (error) {
        toast({ title: 'Falha ao desconectar Vimeo', description: error.message })
        return
      }
      try { localStorage.removeItem('connectedProvider.vimeo') } catch (_) {}
      setConnectedProviders((prev) => ({ ...prev, vimeo: false }))
      toast({ title: 'Vimeo desconectado', description: 'Você pode reconectar quando quiser.' })
    } catch (e) {
      console.error(e)
      toast({ title: 'Erro ao desconectar Vimeo', description: 'Tente novamente.' })
    }
  }

  // Seleções de metadados do curso (categoria, subcategoria, tags)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [courseCategoryInput, setCourseCategoryInput] = useState<string>("")
  const [courseSubcategoryInput, setCourseSubcategoryInput] = useState<string>("")
  const [courseTagInput, setCourseTagInput] = useState<string>("")
  const [showCourseCategorySelector, setShowCourseCategorySelector] = useState(false)
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

  const courseCategoryMeta = useMemo<Record<string, { desc: string; color: string }>>(
    () =>
      taxonomyCategories.reduce((acc, c) => {
        acc[c.name] = { desc: c.description || 'Categoria', color: c.color || '#8B5CF6' }
        return acc
      }, {} as Record<string, { desc: string; color: string }>),
    [taxonomyCategories],
  )
  const courseSubcategoryMeta = useMemo<Record<string, { desc: string; color: string }>>(
    () =>
      taxonomySubcategories.reduce((acc, s) => {
        acc[s.name] = { desc: s.description || 'Subcategoria', color: s.color || '#10B981' }
        return acc
      }, {} as Record<string, { desc: string; color: string }>),
    [taxonomySubcategories],
  )
  const courseTagMeta = useMemo<Record<string, { desc: string; color: string }>>(
    () =>
      taxonomyTags.reduce((acc, t) => {
        acc[t.name] = { desc: t.description || 'Tag', color: t.color || '#0EA5E9' }
        return acc
      }, {} as Record<string, { desc: string; color: string }>),
    [taxonomyTags],
  )
  const availableCourseCategories = useMemo(() => taxonomyCategories.map((c) => c.name), [taxonomyCategories])
  const availableCourseSubcategories = useMemo(() => taxonomySubcategories.map((s) => s.name), [taxonomySubcategories])
  const availableCourseTags = useMemo(() => taxonomyTags.map((t) => t.name), [taxonomyTags])
  const addCourseCategory = (name: string) => {
    if (!selectedCategories.includes(name)) {
      setSelectedCategories((prev) => [...prev, name])
    }
  }
  const courseCategoryItems = useMemo<TaxonomyItem[]>(
    () => taxonomyCategories.map((c) => ({ id: c.id, name: c.name, color: c.color, description: c.description })),
    [taxonomyCategories],
  )
  const createCourseCategoryFromPayload = async (payload: { name: string; color: string; description: string }) => {
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
    addCourseCategory(created.name)
    toast({ title: "Categoria criada", description: "Categoria adicionada às opções e selecionada." })
  }

  const updateCourseCategoryFromPayload = async (itemId: string | number, payload: { name: string; color: string; description: string }) => {
    const id = String(itemId)
    const nextName = payload.name.trim()
    if (!nextName) return
    const current = taxonomyCategories.find((c) => String(c.id) === id)
    const oldName = current?.name || ''
    updateCategory(id, { name: nextName, description: payload.description.trim(), color: payload.color || '#8B5CF6' })
    if (oldName && oldName !== nextName) {
      setSelectedCategories((prev) => prev.map((n) => (n === oldName ? nextName : n)))
    }
    toast({ title: "Categoria atualizada", description: "Alterações salvas com sucesso." })
  }

  const deleteCourseCategoryById = async (itemId: string | number) => {
    const id = String(itemId)
    const current = taxonomyCategories.find((c) => String(c.id) === id)
    deleteCategory(id)
    if (current?.name) {
      setSelectedCategories((prev) => prev.filter((n) => n !== current.name))
    }
    toast({ title: "Categoria removida", description: "A categoria foi removida." })
  }
  // Seletor estilo banco de questões (Subcategoria)
  const [showCourseSubcategorySelector, setShowCourseSubcategorySelector] = useState(false)
  const addCourseSubcategory = (name: string) => {
    if (!selectedSubcategories.includes(name)) {
      setSelectedSubcategories((prev) => [...prev, name])
    }
  }
  const courseSubcategoryItems = useMemo<TaxonomyItem[]>(
    () => taxonomySubcategories.map((s) => ({ id: s.id, name: s.name, color: s.color, description: s.description })),
    [taxonomySubcategories],
  )
  const createCourseSubcategoryFromPayload = async (payload: { name: string; color: string; description: string }) => {
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
      color: payload.color || '#10B981',
      categoryIds: [],
      tagIds: [],
      productsCount: 0,
    })
    addCourseSubcategory(created.name)
    toast({ title: "Subcategoria criada", description: "Subcategoria adicionada às opções e selecionada." })
  }

  const updateCourseSubcategoryFromPayload = async (itemId: string | number, payload: { name: string; color: string; description: string }) => {
    const id = String(itemId)
    const nextName = payload.name.trim()
    if (!nextName) return
    const current = taxonomySubcategories.find((s) => String(s.id) === id)
    const oldName = current?.name || ''
    updateSubcategory(id, { name: nextName, description: payload.description.trim(), color: payload.color || '#10B981' })
    if (oldName && oldName !== nextName) {
      setSelectedSubcategories((prev) => prev.map((n) => (n === oldName ? nextName : n)))
    }
    toast({ title: "Subcategoria atualizada", description: "Alterações salvas com sucesso." })
  }

  const deleteCourseSubcategoryById = async (itemId: string | number) => {
    const id = String(itemId)
    const current = taxonomySubcategories.find((s) => String(s.id) === id)
    deleteSubcategory(id)
    if (current?.name) {
      setSelectedSubcategories((prev) => prev.filter((n) => n !== current.name))
    }
    toast({ title: "Subcategoria removida", description: "A subcategoria foi removida." })
  }
  // Seletor estilo banco de questões (Tag)
  const [showCourseTagSelector, setShowCourseTagSelector] = useState(false)
  const addCourseTag = (name: string) => {
    if (!selectedTags.includes(name)) {
      setSelectedTags((prev) => [...prev, name])
    }
  }
  const courseTagItems = useMemo<TaxonomyItem[]>(
    () => taxonomyTags.map((t) => ({ id: t.id, name: t.name, color: t.color, description: t.description })),
    [taxonomyTags],
  )
  const createCourseTagFromPayload = async (payload: { name: string; color: string; description: string }) => {
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
      color: payload.color || '#0EA5E9',
    })
    addCourseTag(created.name)
    toast({ title: "Tag criada", description: "Tag adicionada às opções e selecionada." })
  }

  const updateCourseTagFromPayload = async (itemId: string | number, payload: { name: string; color: string; description: string }) => {
    const id = String(itemId)
    const nextName = payload.name.trim()
    if (!nextName) return
    const current = taxonomyTags.find((t) => String(t.id) === id)
    const oldName = current?.name || ''
    updateTag(id, { name: nextName, description: payload.description.trim(), color: payload.color || '#0EA5E9' })
    if (oldName && oldName !== nextName) {
      setSelectedTags((prev) => prev.map((n) => (n === oldName ? nextName : n)))
    }
    toast({ title: "Tag atualizada", description: "Alterações salvas com sucesso." })
  }

  const deleteCourseTagById = async (itemId: string | number) => {
    const id = String(itemId)
    const current = taxonomyTags.find((t) => String(t.id) === id)
    deleteTag(id)
    if (current?.name) {
      setSelectedTags((prev) => prev.filter((n) => n !== current.name))
    }
    toast({ title: "Tag removida", description: "A tag foi removida." })
  }
  const removeCourseCategory = (idx: number) => setSelectedCategories(prev => prev.filter((_, i) => i !== idx))
  const removeCourseSubcategory = (idx: number) => setSelectedSubcategories(prev => prev.filter((_, i) => i !== idx))
  const removeCourseTag = (idx: number) => setSelectedTags(prev => prev.filter((_, i) => i !== idx))

  // Critério de liberação da seção de módulos
  const isCourseInfoComplete = (
    title.trim().length > 0 &&
    selectedCategories.length > 0 &&
    selectedSubcategories.length > 0 &&
    selectedTags.length > 0 &&
    description.trim().length > 0 &&
    Boolean(moduleLayoutImage)
  )

  const missingToAdvance = useMemo(() => {
    const missing: string[] = []
    if (!title.trim()) missing.push('nome do curso')
    if (selectedCategories.length < 1) missing.push('1 categoria para vincular')
    if (selectedSubcategories.length < 1) missing.push('1 subcategoria para vincular')
    if (selectedTags.length < 1) missing.push('1 tag para vincular')
    if (!description.trim()) missing.push('descrição')
    if (!moduleLayoutImage) missing.push('capa do módulo')
    return missing
  }, [
    title,
    selectedCategories.length,
    selectedSubcategories.length,
    selectedTags.length,
    description,
    moduleLayoutImage,
  ])

  const canAdvanceToModules = missingToAdvance.length === 0

  const addCourse = (course: Course) => {
    if (!selectedCourses.find((c) => c.id === course.id)) {
      setSelectedCourses([...selectedCourses, course])
    }
  }
  const removeCourse = (courseId: string) => {
    setSelectedCourses(selectedCourses.filter((c) => c.id !== courseId))
  }
  const clearSelectedCourses = () => {
    if (selectedCourses.length === 0) return
    setSelectedCourses([])
  }

  useEffect(() => {
    if (!user) return
    let cancelled = false
    const load = async () => {
      setIsLoadingAvailableCourses(true)
      try {
        const path = window.location.pathname
        const match = path.match(/\/produtos\/editar\/(.+)/)
        const currentCourseId = match ? match[1] : null
        const { data, error } = await supabase
          .from('courses')
          .select('id,title')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        if (error) throw error
        if (cancelled) return
        const mapped: Course[] = (data || [])
          .map((c: any) => ({ id: String(c.id), name: String(c.title || '').trim() || 'Sem título' }))
          .filter((c: Course) => (currentCourseId ? c.id !== currentCourseId : true))
        setAvailableCourses(mapped)
      } catch (err) {
        console.error('Error fetching courses:', err)
        toast({ title: 'Erro ao carregar cursos', description: 'Não foi possível carregar os cursos do usuário.', variant: 'destructive' as any })
        setAvailableCourses([])
      } finally {
        if (!cancelled) setIsLoadingAvailableCourses(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [user])

  const courseItems = useMemo<TaxonomyItem[]>(
    () => availableCourses.map((c) => ({ id: c.id, name: c.name, color: '#6B7588', description: '' })),
    [availableCourses],
  )

  const updateLessonField = (moduleId: string, lessonId: string, field: keyof Lesson, value: any) => {
    setModules((prev) => prev.map((m) => {
      if (m.id !== moduleId) return m
      return {
        ...m,
        lessons: m.lessons.map((l) => l.id === lessonId ? { ...l, [field]: value } : l)
      }
    }))
  }

  const formatCentsToBRLValue = (cents: number) => {
    if (!Number.isFinite(cents)) return ''
    return (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const parseBRLValueToCents = (raw: string) => {
    const s = String(raw || '').trim()
    if (!s) return null
    const lastComma = s.lastIndexOf(',')
    const lastDot = s.lastIndexOf('.')
    const sepIndex = Math.max(lastComma, lastDot)
    if (sepIndex >= 0) {
      const intPartRaw = s.slice(0, sepIndex)
      const decPartRaw = s.slice(sepIndex + 1)
      const intDigits = intPartRaw.replace(/\D/g, '')
      const decDigits = decPartRaw.replace(/\D/g, '').slice(0, 2)
      const intValue = intDigits ? Number(intDigits) : 0
      const decValue = Number((decDigits + '00').slice(0, 2))
      if (!Number.isFinite(intValue) || !Number.isFinite(decValue)) return null
      return intValue * 100 + decValue
    }
    const intDigits = s.replace(/\D/g, '')
    if (!intDigits) return null
    const intValue = Number(intDigits)
    if (!Number.isFinite(intValue)) return null
    return intValue * 100
  }

  const normalizeFreeCourseIds = (ids: any, selfCourseId: string) => {
    const arr = Array.isArray(ids) ? ids : []
    const out: string[] = []
    for (const v of arr) {
      const s = String(v || '').trim()
      if (!s) continue
      if (s === 'self') {
        if (selfCourseId) out.push(selfCourseId)
        continue
      }
      out.push(s)
    }
    return Array.from(new Set(out))
  }

  const startEditingLesson = (module: { id: string }, lesson: Lesson) => {
    setNewLessonTitle(lesson.title)
    setNewLessonDescription(lesson.description || '')
    setNewLessonDescriptionRich((lesson as any)?.description_rich || null)
    setNewLessonDurationMin(lesson.durationMin)
    setNewLessonVisibility(lesson.visibility)
    setNewLessonPrice(lesson.visibility === 'Paga' && typeof lesson.priceCents === 'number' ? formatCentsToBRLValue(lesson.priceCents) : '')
    setNewLessonDifficulty(((lesson as any).difficulty as any) || 'Intermediário')
    setNewLessonCategories(lesson.categories && lesson.categories.length ? lesson.categories : [])
    setNewLessonSubcategories(lesson.subcategories && lesson.subcategories.length ? lesson.subcategories : [])
    setNewLessonExtraTags(lesson.extraTags && lesson.extraTags.length ? lesson.extraTags : [])
    setNewLessonMaterials(lesson.materials || [])
    setDefaultVideoProvider(lesson.videoProvider || 'vimeo')
    setDraftLessonId(String(lesson.id || ''))
    setNewLessonVideoUrl(String(lesson.videoUrl || ''))
    setNewLessonVideoId(String(lesson.videoId || ''))
    setNewLessonVideoPath(lesson.videoPath ? String(lesson.videoPath) : null)
    setLessonUploadFile(null)
    
    setEditingModuleId(module.id)
    setEditingLessonId(lesson.id)
    setIsAddLessonModalOpen(true)
  }

  const editorJsToPlainText = (data: any) => {
    const blocks = Array.isArray(data?.blocks) ? data.blocks : []
    const parts: string[] = []
    for (const b of blocks) {
      const type = String(b?.type || '')
      const d = b?.data || {}
      if (type === 'header' || type === 'paragraph' || type === 'quote' || type === 'warning') {
        const t = String(d?.text || d?.message || '').replace(/<[^>]*>/g, '').trim()
        if (t) parts.push(t)
        continue
      }
      if (type === 'list') {
        const items = Array.isArray(d?.items) ? d.items : []
        const text = items.map((it: any) => String(it || '').replace(/<[^>]*>/g, '').trim()).filter(Boolean).join(' ')
        if (text) parts.push(text)
        continue
      }
      if (type === 'checklist') {
        const items = Array.isArray(d?.items) ? d.items : []
        const text = items.map((it: any) => String(it?.text || '').replace(/<[^>]*>/g, '').trim()).filter(Boolean).join(' ')
        if (text) parts.push(text)
        continue
      }
      if (type === 'table') {
        const content = Array.isArray(d?.content) ? d.content : []
        const flat = content.flatMap((row: any) => (Array.isArray(row) ? row : [row]))
        const text = flat.map((it: any) => String(it || '').replace(/<[^>]*>/g, '').trim()).filter(Boolean).join(' ')
        if (text) parts.push(text)
        continue
      }
    }
    return parts.join('\n').trim()
  }

  // Tokens (categoria, subcategoria, tags extras)
  const [newCategory, setNewCategory] = useState("")
  const [newSubcategory, setNewSubcategory] = useState("")
  const [newTag, setNewTag] = useState("")

  // Seletores da modal (estilo banco de questões)
  const [showLessonCategorySelector, setShowLessonCategorySelector] = useState(false)
  const lessonCategoryDropdownRef = useRef<HTMLDivElement | null>(null)
  const [lessonCategorySearchQuery, setLessonCategorySearchQuery] = useState("")
  const [isCreatingNewLessonCategory, setIsCreatingNewLessonCategory] = useState(false)
  const [newLessonCategoryName, setNewLessonCategoryName] = useState("")
  const [newLessonCategoryColor, setNewLessonCategoryColor] = useState('#8B5CF6')
  const [newLessonCategoryDescription, setNewLessonCategoryDescription] = useState('')
  const addLessonCategory = (name: string) => {
    if (!newLessonCategories.includes(name)) {
      setNewLessonCategories((prev) => [...prev, name])
    }
  }
  const startInlineLessonCategoryCreation = () => {
    setNewLessonCategoryName(lessonCategorySearchQuery.trim())
    setIsCreatingNewLessonCategory(true)
    setTimeout(() => {
      const el = lessonCategoryDropdownRef.current
      if (el) el.scrollTop = el.scrollHeight
    }, 0)
  }
  const createInlineLessonCategory = () => {
    const name = newLessonCategoryName.trim()
    if (!name) return
    const exists = availableCourseCategories.some((n) => n.toLowerCase() === name.toLowerCase())
    if (exists) {
      toast({ title: "Categoria já existe", description: "Escolha um nome diferente.", variant: "destructive" as any })
      return
    }
    const created = createCategory({
      name,
      description: newLessonCategoryDescription.trim(),
      color: newLessonCategoryColor,
      tagIds: [],
    })
    addLessonCategory(created.name)
    setIsCreatingNewLessonCategory(false)
    setNewLessonCategoryName("")
    setNewLessonCategoryColor('#8B5CF6')
    setNewLessonCategoryDescription('')
    setLessonCategorySearchQuery("")
    setShowLessonCategorySelector(false)
    toast({ title: "Categoria criada", description: "Categoria adicionada às opções e selecionada." })
  }
  const cancelInlineLessonCategoryCreation = () => {
    setIsCreatingNewLessonCategory(false)
    setNewLessonCategoryName("")
    setNewLessonCategoryColor('#8B5CF6')
    setNewLessonCategoryDescription('')
  }

  const [showLessonSubcategorySelector, setShowLessonSubcategorySelector] = useState(false)
  const lessonSubcategoryDropdownRef = useRef<HTMLDivElement | null>(null)
  const [lessonSubcategorySearchQuery, setLessonSubcategorySearchQuery] = useState("")
  const [isCreatingNewLessonSubcategory, setIsCreatingNewLessonSubcategory] = useState(false)
  const [newLessonSubcategoryName, setNewLessonSubcategoryName] = useState("")
  const [newLessonSubcategoryColor, setNewLessonSubcategoryColor] = useState('#10B981')
  const [newLessonSubcategoryDescription, setNewLessonSubcategoryDescription] = useState('')
  const addLessonSubcategory = (name: string) => {
    if (!newLessonSubcategories.includes(name)) {
      setNewLessonSubcategories((prev) => [...prev, name])
    }
  }
  const startInlineLessonSubcategoryCreation = () => {
    setNewLessonSubcategoryName(lessonSubcategorySearchQuery.trim())
    setIsCreatingNewLessonSubcategory(true)
    setTimeout(() => {
      const el = lessonSubcategoryDropdownRef.current
      if (el) el.scrollTop = el.scrollHeight
    }, 0)
  }
  const createInlineLessonSubcategory = () => {
    const name = newLessonSubcategoryName.trim()
    if (!name) return
    const exists = availableCourseSubcategories.some((n) => n.toLowerCase() === name.toLowerCase())
    if (exists) {
      toast({ title: "Subcategoria já existe", description: "Escolha um nome diferente.", variant: "destructive" as any })
      return
    }
    const created = createSubcategory({
      name,
      description: newLessonSubcategoryDescription.trim(),
      color: newLessonSubcategoryColor,
      categoryIds: [],
      tagIds: [],
      productsCount: 0,
    })
    addLessonSubcategory(created.name)
    setIsCreatingNewLessonSubcategory(false)
    setNewLessonSubcategoryName("")
    setNewLessonSubcategoryColor('#10B981')
    setNewLessonSubcategoryDescription('')
    setLessonSubcategorySearchQuery("")
    setShowLessonSubcategorySelector(false)
    toast({ title: "Subcategoria criada", description: "Subcategoria adicionada às opções e selecionada." })
  }
  const cancelInlineLessonSubcategoryCreation = () => {
    setIsCreatingNewLessonSubcategory(false)
    setNewLessonSubcategoryName("")
    setNewLessonSubcategoryColor('#10B981')
    setNewLessonSubcategoryDescription('')
  }

  const [showLessonTagSelector, setShowLessonTagSelector] = useState(false)
  const lessonTagDropdownRef = useRef<HTMLDivElement | null>(null)
  const [lessonTagSearchQuery, setLessonTagSearchQuery] = useState("")
  const [isCreatingNewLessonTag, setIsCreatingNewLessonTag] = useState(false)
  const [newLessonTagName, setNewLessonTagName] = useState("")
  const [newLessonTagColor, setNewLessonTagColor] = useState('#0EA5E9')
  const [newLessonTagDescription, setNewLessonTagDescription] = useState('')
  const addLessonTag = (name: string) => {
    if (!newLessonExtraTags.includes(name)) {
      setNewLessonExtraTags((prev) => [...prev, name])
    }
  }
  const startInlineLessonTagCreation = () => {
    setNewLessonTagName(lessonTagSearchQuery.trim())
    setIsCreatingNewLessonTag(true)
    setTimeout(() => {
      const el = lessonTagDropdownRef.current
      if (el) el.scrollTop = el.scrollHeight
    }, 0)
  }
  const createInlineLessonTag = () => {
    const name = newLessonTagName.trim()
    if (!name) return
    const exists = availableCourseTags.some((n) => n.toLowerCase() === name.toLowerCase())
    if (exists) {
      toast({ title: "Tag já existe", description: "Escolha um nome diferente.", variant: "destructive" as any })
      return
    }
    const created = createTag({
      name,
      description: newLessonTagDescription.trim(),
      color: newLessonTagColor,
    })
    addLessonTag(created.name)
    setIsCreatingNewLessonTag(false)
    setNewLessonTagName("")
    setNewLessonTagColor('#0EA5E9')
    setNewLessonTagDescription('')
    setLessonTagSearchQuery("")
    setShowLessonTagSelector(false)
    toast({ title: "Tag criada", description: "Tag adicionada às opções e selecionada." })
  }
  const cancelInlineLessonTagCreation = () => {
    setIsCreatingNewLessonTag(false)
    setNewLessonTagName("")
    setNewLessonTagColor('#0EA5E9')
    setNewLessonTagDescription('')
  }

  const createLessonCategoryFromPayload = async (payload: { name: string; color: string; description: string }) => {
    const name = String(payload?.name || '').trim()
    if (!name) return
    const exists = taxonomyCategories.some((c) => (c.name || '').toLowerCase() === name.toLowerCase())
    if (exists) {
      toast({ title: "Categoria já existe", description: "Escolha um nome diferente.", variant: "destructive" as any })
      return
    }
    const created = createCategory({
      name,
      description: String(payload?.description || '').trim(),
      color: String(payload?.color || '#8B5CF6'),
      tagIds: [],
    })
    setNewLessonCategories((prev) => (prev.includes(created.name) ? prev : [...prev, created.name]))
    toast({ title: "Categoria criada", description: "Categoria adicionada às opções e selecionada." })
  }
  const updateLessonCategoryFromPayload = async (itemId: string | number, payload: { name: string; color: string; description: string }) => {
    const id = String(itemId)
    const nextName = String(payload?.name || '').trim()
    if (!nextName) return
    const current = taxonomyCategories.find((c) => String(c.id) === id)
    const oldName = current?.name || ''
    updateCategory(id, { name: nextName, description: String(payload?.description || '').trim(), color: String(payload?.color || '#8B5CF6') })
    if (oldName && oldName !== nextName) {
      setNewLessonCategories((prev) => prev.map((n) => (n === oldName ? nextName : n)))
      setSelectedCategories((prev) => prev.map((n) => (n === oldName ? nextName : n)))
      setModules((prev) => prev.map((m) => ({
        ...m,
        lessons: (m.lessons || []).map((l) => ({
          ...l,
          categories: (l.categories || []).map((n) => (n === oldName ? nextName : n)),
        })),
      })))
    }
    toast({ title: "Categoria atualizada", description: "Alterações salvas com sucesso." })
  }
  const deleteLessonCategoryById = async (itemId: string | number) => {
    const id = String(itemId)
    const current = taxonomyCategories.find((c) => String(c.id) === id)
    deleteCategory(id)
    if (current?.name) {
      const name = current.name
      setNewLessonCategories((prev) => prev.filter((n) => n !== name))
      setSelectedCategories((prev) => prev.filter((n) => n !== name))
      setModules((prev) => prev.map((m) => ({
        ...m,
        lessons: (m.lessons || []).map((l) => ({
          ...l,
          categories: (l.categories || []).filter((n) => n !== name),
        })),
      })))
    }
    toast({ title: "Categoria removida", description: "A categoria foi removida." })
  }

  const createLessonSubcategoryFromPayload = async (payload: { name: string; color: string; description: string }) => {
    const name = String(payload?.name || '').trim()
    if (!name) return
    const exists = taxonomySubcategories.some((s) => (s.name || '').toLowerCase() === name.toLowerCase())
    if (exists) {
      toast({ title: "Subcategoria já existe", description: "Escolha um nome diferente.", variant: "destructive" as any })
      return
    }
    const created = createSubcategory({
      name,
      description: String(payload?.description || '').trim(),
      color: String(payload?.color || '#10B981'),
      categoryIds: [],
      tagIds: [],
      productsCount: 0,
    })
    setNewLessonSubcategories((prev) => (prev.includes(created.name) ? prev : [...prev, created.name]))
    toast({ title: "Subcategoria criada", description: "Subcategoria adicionada às opções e selecionada." })
  }
  const updateLessonSubcategoryFromPayload = async (itemId: string | number, payload: { name: string; color: string; description: string }) => {
    const id = String(itemId)
    const nextName = String(payload?.name || '').trim()
    if (!nextName) return
    const current = taxonomySubcategories.find((s) => String(s.id) === id)
    const oldName = current?.name || ''
    updateSubcategory(id, { name: nextName, description: String(payload?.description || '').trim(), color: String(payload?.color || '#10B981') })
    if (oldName && oldName !== nextName) {
      setNewLessonSubcategories((prev) => prev.map((n) => (n === oldName ? nextName : n)))
      setSelectedSubcategories((prev) => prev.map((n) => (n === oldName ? nextName : n)))
      setModules((prev) => prev.map((m) => ({
        ...m,
        lessons: (m.lessons || []).map((l) => ({
          ...l,
          subcategories: (l.subcategories || []).map((n) => (n === oldName ? nextName : n)),
        })),
      })))
    }
    toast({ title: "Subcategoria atualizada", description: "Alterações salvas com sucesso." })
  }
  const deleteLessonSubcategoryById = async (itemId: string | number) => {
    const id = String(itemId)
    const current = taxonomySubcategories.find((s) => String(s.id) === id)
    deleteSubcategory(id)
    if (current?.name) {
      const name = current.name
      setNewLessonSubcategories((prev) => prev.filter((n) => n !== name))
      setSelectedSubcategories((prev) => prev.filter((n) => n !== name))
      setModules((prev) => prev.map((m) => ({
        ...m,
        lessons: (m.lessons || []).map((l) => ({
          ...l,
          subcategories: (l.subcategories || []).filter((n) => n !== name),
        })),
      })))
    }
    toast({ title: "Subcategoria removida", description: "A subcategoria foi removida." })
  }

  const createLessonTagFromPayload = async (payload: { name: string; color: string; description: string }) => {
    const name = String(payload?.name || '').trim()
    if (!name) return
    const exists = taxonomyTags.some((t) => (t.name || '').toLowerCase() === name.toLowerCase())
    if (exists) {
      toast({ title: "Tag já existe", description: "Escolha um nome diferente.", variant: "destructive" as any })
      return
    }
    const created = createTag({
      name,
      description: String(payload?.description || '').trim(),
      color: String(payload?.color || '#0EA5E9'),
    })
    setNewLessonExtraTags((prev) => (prev.includes(created.name) ? prev : [...prev, created.name]))
    toast({ title: "Tag criada", description: "Tag adicionada às opções e selecionada." })
  }
  const updateLessonTagFromPayload = async (itemId: string | number, payload: { name: string; color: string; description: string }) => {
    const id = String(itemId)
    const nextName = String(payload?.name || '').trim()
    if (!nextName) return
    const current = taxonomyTags.find((t) => String(t.id) === id)
    const oldName = current?.name || ''
    updateTag(id, { name: nextName, description: String(payload?.description || '').trim(), color: String(payload?.color || '#0EA5E9') })
    if (oldName && oldName !== nextName) {
      setNewLessonExtraTags((prev) => prev.map((n) => (n === oldName ? nextName : n)))
      setSelectedTags((prev) => prev.map((n) => (n === oldName ? nextName : n)))
      setModules((prev) => prev.map((m) => ({
        ...m,
        lessons: (m.lessons || []).map((l) => ({
          ...l,
          tag: l.tag === oldName ? nextName : l.tag,
          extraTags: (l.extraTags || []).map((n) => (n === oldName ? nextName : n)),
        })),
      })))
    }
    toast({ title: "Tag atualizada", description: "Alterações salvas com sucesso." })
  }
  const deleteLessonTagById = async (itemId: string | number) => {
    const id = String(itemId)
    const current = taxonomyTags.find((t) => String(t.id) === id)
    deleteTag(id)
    if (current?.name) {
      const name = current.name
      setNewLessonExtraTags((prev) => prev.filter((n) => n !== name))
      setSelectedTags((prev) => prev.filter((n) => n !== name))
      setModules((prev) => prev.map((m) => ({
        ...m,
        lessons: (m.lessons || []).map((l) => ({
          ...l,
          tag: l.tag === name ? '' : l.tag,
          extraTags: (l.extraTags || []).filter((n) => n !== name),
        })),
      })))
    }
    toast({ title: "Tag removida", description: "A tag foi removida." })
  }

  // Provedor padrão para vídeos das aulas
  const [defaultVideoProvider, setDefaultVideoProvider] = useState<'vimeo' | 'vdocipher' | 'upload'>('vimeo')

  // Navegação de telas locais (Passos do fluxo)
  const [activeScreen, setActiveScreen] = useState<'editor' | 'layout' | 'aulas' | 'recursos' | 'visual' | 'monetizacao'>('editor')
  const [isEditMode, setIsEditMode] = useState(false)
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null)
  const [isPublishAfterCreateOpen, setIsPublishAfterCreateOpen] = useState(false)
  const [createdCourseId, setCreatedCourseId] = useState<string | null>(null)
  const [isPublishingAfterCreate, setIsPublishingAfterCreate] = useState(false)
  const [isSavingCourse, setIsSavingCourse] = useState(false)
  const [courseStatus, setCourseStatus] = useState<'draft' | 'published'>('draft')
  // Flag para abrir modal de aula após trocar para tela 'aulas'
  const [pendingAddLessonModal, setPendingAddLessonModal] = useState(false)
  useEffect(() => {
    const resolveFromHash = () => {
      const hash = (window.location.hash || '').replace('#', '')
      if (['layout', 'aulas', 'recursos', 'visual', 'monetizacao'].includes(hash)) {
        setActiveScreen(hash as any)
      } else {
        setActiveScreen('editor')
      }
    }
    resolveFromHash()
    const onHashChange = () => resolveFromHash()
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // Quando a tela 'aulas' estiver ativa e houver flag pendente, abre o modal
  useEffect(() => {
    if (activeScreen === 'aulas' && pendingAddLessonModal) {
      setIsAddLessonModalOpen(true)
      setPendingAddLessonModal(false)
    }
  }, [activeScreen, pendingAddLessonModal])

  // Fase ativa para o stepper (conteúdo agrupa editor/layout)
  const activePhase: 'conteudo' | 'aulas' | 'recursos' | 'visual' | 'monetizacao' =
    (activeScreen === 'editor' || activeScreen === 'layout') ? 'conteudo' : (activeScreen as any)

  // Metadados das etapas para stepper e barra inferior
  const stepsMeta = [
    { key: 'conteudo', label: 'Conteúdo', icon: '/icons/book-open.svg' },
    { key: 'aulas', label: 'Aulas', icon: '/question-icon.svg' },
    { key: 'recursos', label: 'Recursos', icon: '/icons/circle-stack.svg' },
    { key: 'visual', label: 'Visual', icon: '/icons/union.svg' },
    { key: 'monetizacao', label: 'Monetização', icon: '/icons/vendas.svg' },
  ] as const
  const stepOrder = stepsMeta.map(s => s.key) as Array<'conteudo' | 'aulas' | 'recursos' | 'visual' | 'monetizacao'>
  const currentIndex = stepOrder.indexOf(activePhase)
  const currentLabel = stepsMeta.find(s => s.key === activePhase)?.label || ''

  // Controle de conclusão por etapa (gated progression)
  type Phase = 'conteudo' | 'aulas' | 'recursos' | 'visual' | 'monetizacao'
  const [phaseDone, setPhaseDone] = useState<Record<Phase, boolean>>({
    conteudo: false,
    aulas: false,
    recursos: false,
    visual: false,
    monetizacao: false,
  })
  const completedCount = Object.values(phaseDone).filter(Boolean).length
  const progressPercent = Math.round((completedCount / stepOrder.length) * 100)

  const getPhaseErrors = (phase: Phase) => {
    const errs: string[] = []
    if (phase === 'conteudo') {
      if (!title || !title.trim()) errs.push('Informe o título do curso.')
    }
    if (phase === 'aulas') {
      const hasModule = modules.length > 0
      const hasAnyLesson = modules.some(m => Array.isArray(m.lessons) && m.lessons.length > 0)
      if (!hasModule) errs.push('Adicione ao menos um módulo.')
      if (!hasAnyLesson) errs.push('Adicione ao menos uma aula.')
    }
    // As próximas etapas não têm campos obrigatórios neste protótipo
    return errs
  }

  const concluirEtapa = (phase: Phase) => {
    const errs = getPhaseErrors(phase)
    if (errs.length) {
      toast({
        title: 'Finalize esta etapa',
        description: errs.join(' '),
        variant: 'destructive'
      })
      return
    }
    setPhaseDone(prev => ({ ...prev, [phase]: true }))
    toast({ title: 'Etapa concluída', description: `${stepsMeta.find(s => s.key === phase)?.label} marcada como concluída.` })
    const idx = stepOrder.indexOf(phase)
    const next = stepOrder[idx + 1]
    if (next) {
      if (next === 'conteudo') {
        setActiveScreen('editor')
        history.replaceState({}, '', window.location.pathname)
      } else {
        setActiveScreen(next as any)
        location.hash = next
      }
    }
  }

  const maxUnlockedIndex = (() => {
    if (isEditMode) return stepOrder.length - 1
    const firstNotDone = stepOrder.findIndex(k => !phaseDone[k])
    return firstNotDone === -1 ? stepOrder.length - 1 : firstNotDone
  })()

  const attemptGoToScreen = (screen: 'editor' | 'layout' | 'aulas' | 'recursos' | 'visual' | 'monetizacao') => {
    const targetPhase: Phase = (screen === 'editor' || screen === 'layout') ? 'conteudo' : (screen as Phase)
    const targetIndex = stepOrder.indexOf(targetPhase)
    // Permitir voltar sempre; bloquear avançar além do desbloqueado
    if (isEditMode || targetIndex <= maxUnlockedIndex) {
      if (screen === 'editor') {
        setActiveScreen('editor')
        history.replaceState({}, '', window.location.pathname)
      } else {
        setActiveScreen(screen)
        location.hash = screen
      }
    } else {
      const needLabel = stepsMeta[targetIndex]?.label || 'etapa'
      toast({ title: 'Etapa bloqueada', description: `Conclua as etapas anteriores para acessar ${needLabel}.`, variant: 'destructive' })
    }
  }

  const goToNext = () => {
    const idx = stepOrder.indexOf(activePhase)
    const next = stepOrder[idx + 1]
    if (!next) return
    // Impedir avançar sem concluir a etapa atual
    if (!phaseDone[activePhase]) {
      toast({ title: 'Conclua esta etapa', description: `Finalize ${currentLabel} antes de seguir.`, variant: 'destructive' })
      return
    }
    attemptGoToScreen(next as any)
  }
  const goToPrev = () => {
    const idx = stepOrder.indexOf(activePhase)
    const prev = stepOrder[idx - 1]
    if (prev) attemptGoToScreen(prev as any)
  }

  // Modal de criação de aula
  const [isAddLessonModalOpen, setIsAddLessonModalOpen] = useState(false)
  const [newLessonTitle, setNewLessonTitle] = useState<string>('')
  const [newLessonDescription, setNewLessonDescription] = useState<string>('')
  const [newLessonDescriptionRich, setNewLessonDescriptionRich] = useState<any>(null)
  const [newLessonDurationMin, setNewLessonDurationMin] = useState<number>(0)
  const [newLessonVisibility, setNewLessonVisibility] = useState<'Gratuita' | 'Paga' | 'Gratuita para alunos do curso'>('Gratuita')
  const [newLessonPrice, setNewLessonPrice] = useState<string>('')
  const [newLessonDifficulty, setNewLessonDifficulty] = useState<Lesson['difficulty']>('Intermediário')
  // Estados para tokens no modal de nova aula
  const [newLessonCategories, setNewLessonCategories] = useState<string[]>([])
  const [newLessonSubcategories, setNewLessonSubcategories] = useState<string[]>([])
  const [newLessonExtraTags, setNewLessonExtraTags] = useState<string[]>([])
  const [modalNewCategory, setModalNewCategory] = useState<string>('')
  const [modalNewSubcategory, setModalNewSubcategory] = useState<string>('')
  const [modalNewTagExtra, setModalNewTagExtra] = useState<string>('')
  // Materiais no modal de configuração da aula
  const [newLessonMaterials, setNewLessonMaterials] = useState<LessonMaterial[]>([])
  const [lessonMaterialFilesById, setLessonMaterialFilesById] = useState<Record<string, File>>({})
  const [lessonVideoFilesById, setLessonVideoFilesById] = useState<Record<string, File>>({})
  const [draftLessonId, setDraftLessonId] = useState<string | null>(null)
  const [newLessonVideoUrl, setNewLessonVideoUrl] = useState<string>('')
  const [newLessonVideoId, setNewLessonVideoId] = useState<string>('')
  const [newLessonVideoPath, setNewLessonVideoPath] = useState<string | null>(null)
  const [lessonUploadFile, setLessonUploadFile] = useState<File | null>(null)
  const [isLessonUploadUploading, setIsLessonUploadUploading] = useState(false)
  const materialFileInputRef = useRef<HTMLInputElement | null>(null)
  const [pendingMaterialType, setPendingMaterialType] = useState<LessonMaterial['type'] | null>(null)
  const [showLinkInput, setShowLinkInput] = useState<boolean>(false)
  const [newMaterialLinkUrl, setNewMaterialLinkUrl] = useState<string>('')
  // Listas filtradas para os seletores da modal (busca + não selecionados)
  const filteredLessonCategoriesList = (availableCourseCategories || [])
    .filter((n) => n.toLowerCase().includes(lessonCategorySearchQuery.toLowerCase()))
    .filter((n) => !newLessonCategories.includes(n))

  const filteredLessonSubcategoriesList = (availableCourseSubcategories || [])
    .filter((n) => n.toLowerCase().includes(lessonSubcategorySearchQuery.toLowerCase()))
    .filter((n) => !newLessonSubcategories.includes(n))

  const filteredLessonTagsList = (availableCourseTags || [])
    .filter((n) => n.toLowerCase().includes(lessonTagSearchQuery.toLowerCase()))
    .filter((n) => !newLessonExtraTags.includes(n))

  useEffect(() => {
    if (!isAddLessonModalOpen) {
      setDraftLessonId(null)
      setLessonUploadFile(null)
      setIsLessonUploadUploading(false)
      return
    }
    if (editingLessonId) return
    if (!draftLessonId) setDraftLessonId(`lesson-${Date.now()}`)
    setNewLessonTitle('')
    setNewLessonDescription('')
    setNewLessonDescriptionRich(null)
    setNewLessonDurationMin(0)
    setNewLessonVisibility('Gratuita')
    setNewLessonPrice('')
    setNewLessonDifficulty('Intermediário')
    setNewLessonCategories([])
    setNewLessonSubcategories([])
    setNewLessonExtraTags([])
    setNewLessonMaterials([])
    setNewLessonVideoUrl('')
    setNewLessonVideoId('')
    setNewLessonVideoPath(null)
  }, [draftLessonId, editingLessonId, isAddLessonModalOpen])

  const goToPhase = (phase: 'conteudo' | 'aulas' | 'recursos' | 'visual' | 'monetizacao') => {
    if (phase === 'conteudo') {
      setActiveScreen('editor')
      history.replaceState({}, '', window.location.pathname)
    } else {
      setActiveScreen(phase as any)
      location.hash = phase
    }
  }
  // Removidos: goToNext/goToPrev simples (substituídos por versões com validação mais abaixo)

  const addToken = (field: "categories" | "subcategories" | "extraTags", token: string) => {
    if (!editingModuleId || !editingLessonId) return
    const mod = modules.find((m) => m.id === editingModuleId)
    const lesson = mod?.lessons.find((l) => l.id === editingLessonId)
    const current = (lesson && (lesson as any)[field]) ? (lesson as any)[field] as string[] : []
    const next = token.trim()
    if (!next) return
    updateLessonField(editingModuleId, editingLessonId, field as keyof Lesson, [...current, next])
  }
  const removeToken = (field: "categories" | "subcategories" | "extraTags", index: number) => {
    if (!editingModuleId || !editingLessonId) return
    const mod = modules.find((m) => m.id === editingModuleId)
    const lesson = mod?.lessons.find((l) => l.id === editingLessonId)
    const current = (lesson && (lesson as any)[field]) ? (lesson as any)[field] as string[] : []
    const next = current.filter((_, i) => i !== index)
    updateLessonField(editingModuleId, editingLessonId, field as keyof Lesson, next)
  }

  

  // Materiais complementares (adicionar/remover)
  const addMaterial = (type: LessonMaterial['type']) => {
    if (!editingModuleId || !editingLessonId) return
    const mod = modules.find((m) => m.id === editingModuleId)
    const lesson = mod?.lessons.find((l) => l.id === editingLessonId)
    const current = (lesson?.materials ?? []) as LessonMaterial[]
    const defaultNameByType: Record<LessonMaterial['type'], string> = {
      pdf: 'NovoMaterial.pdf',
      doc: 'NovoDocumento.doc',
      ppt: 'NovaApresentacao.ppt',
      xls: 'NovaPlanilha.xlsx',
      link: 'https://exemplo.com/recurso'
    }
    const newItem: LessonMaterial = {
      id: `mat-${Date.now()}`,
      name: defaultNameByType[type],
      sizeLabel: type === 'link' ? '' : '—',
      type
    }
    updateLessonField(editingModuleId, editingLessonId, 'materials', [...current, newItem])
  }
  const removeMaterial = (materialId: string) => {
    if (!editingModuleId || !editingLessonId) return
    const mod = modules.find((m) => m.id === editingModuleId)
    const lesson = mod?.lessons.find((l) => l.id === editingLessonId)
    const current = (lesson?.materials ?? []) as LessonMaterial[]
    const next = current.filter(m => m.id !== materialId)
    updateLessonField(editingModuleId, editingLessonId, 'materials', next)
  }

  // Handlers de materiais dentro do modal de configuração da aula
  const addModalMaterial = (type: LessonMaterial['type']) => {
    const defaultNameByType: Record<LessonMaterial['type'], string> = {
      pdf: 'NovoMaterial.pdf',
      doc: 'NovoDocumento.doc',
      ppt: 'NovaApresentacao.ppt',
      xls: 'NovaPlanilha.xlsx',
      link: 'https://exemplo.com/recurso'
    }
    const newItem: LessonMaterial = {
      id: `mat-${Date.now()}`,
      name: defaultNameByType[type],
      sizeLabel: type === 'link' ? '' : '—',
      type
    }
    setNewLessonMaterials(prev => [...prev, newItem])
  }
  const removeModalMaterial = (materialId: string) => {
    setNewLessonMaterials(prev => prev.filter(m => m.id !== materialId))
    setLessonMaterialFilesById((prev) => {
      if (!prev || !(materialId in prev)) return prev
      const next = { ...prev }
      delete next[materialId]
      return next
    })
  }

  // Uploader para materiais específicos do modal
  const getAcceptForType = (type: LessonMaterial['type']) => {
    switch (type) {
      case 'pdf': return 'application/pdf,.pdf'
      case 'doc': return '.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      case 'ppt': return '.ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation'
      case 'xls': return '.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      default: return '*/*'
    }
  }
  const formatSize = (bytes?: number) => {
    if (!bytes || bytes <= 0) return '—'
    const kb = bytes / 1024
    if (kb < 1024) return `${Math.round(kb)} KB`
    const mb = kb / 1024
    return `${mb.toFixed(1)} MB`
  }
  const openMaterialUploader = (type: LessonMaterial['type']) => {
    if (type === 'link') {
      setShowLinkInput(true)
      setTimeout(() => {
        const el = document.getElementById('new-material-link-input') as HTMLInputElement | null
        el?.focus()
      }, 0)
      return
    }
    setPendingMaterialType(type)
    const input = materialFileInputRef.current
    if (input) {
      input.value = ''
      input.accept = getAcceptForType(type)
      input.click()
    }
  }
  const handleMaterialFileSelected: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files && e.target.files[0]
    if (!file || !pendingMaterialType) return
    const newItem: LessonMaterial = {
      id: `mat-${Date.now()}`,
      name: file.name,
      sizeLabel: formatSize(file.size),
      type: pendingMaterialType,
      path: null,
      url: null,
    }
    setNewLessonMaterials(prev => [...prev, newItem])
    setPendingMaterialType(null)

    const canUploadNow = Boolean(isEditMode && editingCourseId && user?.id)
    if (!canUploadNow) {
      setLessonMaterialFilesById((prev) => ({ ...(prev || {}), [newItem.id]: file }))
      return
    }

    try {
      const allowed = await canUploadBytes(user!.id, file.size, resolvePlanKey())
      if (!allowed.ok) {
        const formatBytes = (n: number) => {
          const v = Number(n || 0)
          if (!isFinite(v) || v <= 0) return '0 B'
          const kb = v / 1024
          if (kb < 1024) return `${Math.round(kb)} KB`
          const mb = kb / 1024
          if (mb < 1024) return `${mb.toFixed(1)} MB`
          const gb = mb / 1024
          return `${gb.toFixed(2)} GB`
        }
        const usedText = typeof (allowed as any)?.usedBytes === 'number' ? formatBytes(Number((allowed as any).usedBytes)) : null
        const limitText = typeof (allowed as any)?.limitBytes === 'number' ? formatBytes(Number((allowed as any).limitBytes)) : null
        throw new Error(`Limite de armazenamento atingido${usedText && limitText ? ` (${usedText} de ${limitText})` : ''}. Faça upgrade do seu plano para continuar.`)
      }

      const sanitizeFilename = (name: string) => (name || 'file').replace(/[^a-zA-Z0-9_.-]/g, '_')
      const safeName = sanitizeFilename(file.name || `materials`)
      const envAny = (import.meta as any)?.env || {}
      const token = String(
        session?.access_token ||
        (await supabase.auth.getSession().catch(() => ({ data: null })))?.data?.session?.access_token ||
        ''
      ).trim()
      if (token) {
        const qs0 = new URLSearchParams({
          type: 'ensure_courses_media_upload',
          bytes: String(file.size),
          contentType: String(file.type || 'application/octet-stream'),
        })
        await fetch(`/api/producer?${qs0.toString()}`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null)
      }
      const shouldTryProxy = Boolean(envAny.DEV && envAny.VITE_USE_LOCAL_UPLOAD_PROXY)
      if (shouldTryProxy) {
        const qs = new URLSearchParams({
          userId: user!.id,
          courseId: String(editingCourseId),
          kind: 'materials',
          filename: safeName,
          contentType: file.type || 'application/octet-stream',
        })
        const resp = await fetch(`/api/upload-course-media?${qs.toString()}`, {
          method: 'POST',
          headers: { 'Content-Type': file.type || 'application/octet-stream', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
          body: file,
        })
        if (resp.ok) {
          const json = await resp.json().catch(() => ({}))
          const nextUrl = json?.url ? String(json.url) : ''
          const nextPath = json?.path ? String(json.path) : ''
          if (nextUrl || nextPath) {
            setNewLessonMaterials((prev) => prev.map((m) => m.id === newItem.id ? { ...m, url: nextUrl || null, path: nextPath || null } : m))
            toast({ title: 'Anexo enviado', description: 'Arquivo pronto para download após salvar o curso.' })
            return
          }
        }
      }

      const bucket = 'courses-media'
      const uidSeg = sanitizeStorageSegment(user!.id, "user")
      const courseSeg = sanitizeStorageSegment(String(editingCourseId), "course")
      const objectPath = sanitizeStorageObjectPath(`users/${uidSeg}/courses/${courseSeg}/materials/${Date.now()}_${safeName}`)
      if (!objectPath) throw new Error("invalid_path")
      const { data, error } = await supabase.storage.from(bucket).upload(objectPath, file, {
        upsert: true,
        contentType: file.type || 'application/octet-stream',
      })
      if (error) throw error
      const storedPath = (data as any)?.path || objectPath
      const { data: pub } = supabase.storage.from(bucket).getPublicUrl(String(storedPath))
      const nextUrl = pub?.publicUrl ? String(pub.publicUrl) : null
      setNewLessonMaterials((prev) => prev.map((m) => m.id === newItem.id ? { ...m, url: nextUrl, path: String(storedPath) } : m))
      toast({ title: 'Anexo enviado', description: 'Arquivo pronto para download após salvar o curso.' })
    } catch (err: any) {
      setLessonMaterialFilesById((prev) => ({ ...(prev || {}), [newItem.id]: file }))
      toast({ title: 'Erro ao enviar anexo', description: String(err?.message || err || ''), variant: 'destructive' as any })
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FB] font-inter text-[#1E1B39]">
      <AlertDialog open={isPublishAfterCreateOpen} onOpenChange={setIsPublishAfterCreateOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Publicar curso?</AlertDialogTitle>
            <AlertDialogDescription>
              Você deseja publicar este curso agora?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isPublishingAfterCreate}
              onClick={() => {
                setIsPublishAfterCreateOpen(false)
                setCreatedCourseId(null)
                window.history.pushState({}, '', '/produtos')
                window.dispatchEvent(new PopStateEvent('popstate'))
              }}
            >
              Agora não
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isPublishingAfterCreate || !createdCourseId}
              onClick={async () => {
                if (!user || !createdCourseId) return
                try {
                  setIsPublishingAfterCreate(true)
                  const { error } = await supabase
                    .from('courses')
                    .update({ status: 'published' })
                    .eq('id', createdCourseId)
                    .eq('user_id', user.id)
                  if (error) throw error
                  toast({ title: 'Sucesso', description: 'Curso publicado com sucesso!' })
                } catch (error: any) {
                  const msg = String(error?.message || error || '')
                  toast({ title: 'Erro', description: 'Erro ao publicar curso: ' + msg, variant: 'destructive' })
                } finally {
                  setIsPublishingAfterCreate(false)
                  setIsPublishAfterCreateOpen(false)
                  setCreatedCourseId(null)
                  window.history.pushState({}, '', '/produtos')
                  window.dispatchEvent(new PopStateEvent('popstate'))
                }
              }}
            >
              Publicar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <header className="border-b border-[#E3E4E5] bg-white w-full">
        <div className="w-full px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-black hover:bg-transparent"
              onClick={() => {
                window.history.pushState({}, '', '/produtos')
                window.dispatchEvent(new PopStateEvent('popstate'))
              }}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[#1E1B39]">{isEditMode ? 'Editar curso' : 'Criar novo curso'}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                const previewId = (isEditMode ? editingCourseId : createdCourseId) || ''
                if (!previewId) {
                  toast({ title: 'Preview indisponível', description: isEditMode ? 'Salve o curso para gerar o preview.' : 'Crie o curso para gerar o preview.', variant: 'destructive' as any })
                  return
                }
                window.history.pushState({}, '', `/curso-preview/${previewId}`)
                window.dispatchEvent(new PopStateEvent('popstate'))
              }}
            >
              <ExternalLink className="h-4 w-4" />
              Preview
            </Button>
            <Button className="bg-[#0047BB] hover:bg-[#003a99] gap-2" disabled={isSavingCourse} onClick={isEditMode ? handleSaveCourse : handleCreateCourse}>
              {isSavingCourse ? <Loader2 className="h-4 w-4 animate-spin" /> : (!isEditMode ? <Plus className="h-4 w-4" /> : null)}
              {isSavingCourse ? (isEditMode ? 'Salvando...' : 'Criando...') : (isEditMode ? 'Salvar curso' : 'Criar curso')}
            </Button>
          </div>
        </div>
      </header>
      {/* Modal de configurações do Vimeo */}
      <AlertDialog open={isVimeoSettingsOpen} onOpenChange={setIsVimeoSettingsOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Configurações do Vimeo</AlertDialogTitle>
            <AlertDialogDescription>
              Preencha os dados do seu app do Vimeo para conectar sua conta à Connekt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="mt-2 space-y-3">
            <div className="rounded-[8px] border border-[#E3E4E5] bg-[#F8FAFC] p-3">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-[#0047BB] mt-0.5" />
                <div className="space-y-1">
                  <div className="text-[12px] font-semibold text-[#1E1B39]">Como conectar</div>
                  <div className="text-[12px] text-[#737780]">1) Crie um app no Vimeo Developer e copie o Client ID e Client Secret.</div>
                  <div className="text-[12px] text-[#737780]">2) No app do Vimeo, registre a Redirect URI exatamente como abaixo.</div>
                  <div className="text-[12px] text-[#737780]">3) Clique em “Salvar e Conectar” para autorizar e voltar para a Connekt.</div>
                  <a href="https://developer.vimeo.com/apps" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] text-[#0047BB] hover:underline pt-1">
                    Abrir Vimeo Developer Apps <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            </div>
            <div>
              <label className="text-[12px] text-[#6B7280]">Client ID</label>
              <input className="mt-1 w-full rounded-[8px] border border-[#E3E4E5] bg-white px-3 py-2 text-[13px]" value={vimeoSettings.client_id} onChange={(e) => setVimeoSettings((s) => ({ ...s, client_id: e.target.value }))} placeholder="ex: 123abc..." />
            </div>
            <div>
              <label className="text-[12px] text-[#6B7280]">Client Secret</label>
              <input type="password" className="mt-1 w-full rounded-[8px] border border-[#E3E4E5] bg-white px-3 py-2 text-[13px]" value={vimeoSettings.client_secret} onChange={(e) => setVimeoSettings((s) => ({ ...s, client_secret: e.target.value }))} placeholder="ex: super-secreto" />
            </div>
            <div>
              <label className="text-[12px] text-[#6B7280]">Redirect URI</label>
              <input className="mt-1 w-full rounded-[8px] border border-[#E3E4E5] bg-white px-3 py-2 text-[13px]" value={`${window.location.origin}/vimeo/callback`} readOnly title="Definida automaticamente. Copie e registre no app do Vimeo." />
              <div className="mt-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-3"
                  onClick={() => {
                    const uri = `${window.location.origin}/vimeo/callback`
                    try {
                      navigator.clipboard.writeText(uri)
                      toast({ title: 'Redirect URI copiada', description: uri })
                    } catch (err) {
                      toast({ title: 'Falha ao copiar', description: 'Copie manualmente a URL.' })
                    }
                  }}
                >
                  Copiar Redirect URI
                </Button>
              </div>
            </div>
            <div>
            {/* Campo Scope removido conforme solicitação para ocultar essa parte */}
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsVimeoSettingsOpen(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              const ok = await saveVimeoSettings()
              if (ok) {
                setIsVimeoSettingsOpen(false)
                handleConnectService('vimeo')
              }
            }}>Salvar e Conectar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Modal de seleção de recursos extras */}
      <AlertDialog open={isSelectSimuladoOpen} onOpenChange={setIsSelectSimuladoOpen}>
        <AlertDialogContent
          style={{ width: '560px', height: '560px', maxWidth: '92vw', maxHeight: '82vh' }}
          className="flex flex-col overflow-hidden"
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Selecionar recurso</AlertDialogTitle>
            <AlertDialogDescription>Escolha um simulado ou banco de questões para conectar ao curso.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto pr-1">
            <div className="rounded-[8px] border border-[#E3E4E5] bg-white p-4">
              <div className="text-[13px] font-semibold text-[#1E1B39] mb-2">Conectar a:</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <select
                    className="w-full rounded-[8px] border border-[#E3E4E5] bg-white px-3 py-2 text-[13px]"
                    value={simuladoConnectScope}
                    onChange={(e) => {
                      const v = e.target.value as 'curso' | 'modulo' | 'aula'
                      setSimuladoConnectScope(v)
                      if (v === 'curso') { setSimuladoConnectModuleId(null); setSimuladoConnectLessonId(null) }
                    }}
                  >
                    <option value="curso">Todo o curso</option>
                    <option value="modulo">Módulo</option>
                    <option value="aula">Aula</option>
                  </select>
                </div>
                {(simuladoConnectScope === 'modulo' || simuladoConnectScope === 'aula') && (
                  <div>
                    <label className="text-[12px] text-[#737780]">Módulo:</label>
                    <select
                      className="mt-1 w-full rounded-[8px] border border-[#E3E4E5] bg-white px-3 py-2 text-[13px]"
                      value={simuladoConnectModuleId ?? ''}
                      onChange={(e) => { setSimuladoConnectModuleId(e.target.value || null); setSimuladoConnectLessonId(null) }}
                    >
                      <option value="">Selecione o módulo</option>
                      {modules.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                {simuladoConnectScope === 'aula' && (
                  <div>
                    <label className="text-[12px] text-[#737780]">Aula:</label>
                    <select
                      className="mt-1 w-full rounded-[8px] border border-[#E3E4E5] bg-white px-3 py-2 text-[13px]"
                      value={simuladoConnectLessonId ?? ''}
                      onChange={(e) => setSimuladoConnectLessonId(e.target.value || null)}
                      disabled={!simuladoConnectModuleId}
                    >
                      <option value="">Selecione a aula</option>
                      {modules.find((m) => m.id === simuladoConnectModuleId)?.lessons.map((l) => (
                        <option key={l.id} value={l.id}>{l.title}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
            
            <div className="text-[13px] font-semibold text-[#1E1B39]">Selecione um recurso</div>

            <div className="space-y-3">
              {(isLoadingSimulados || isLoadingQuestionBanks) && (
                <div className="flex items-center justify-center py-8 text-sm text-gray-500">
                  Carregando recursos...
                </div>
              )}

              {!(isLoadingSimulados || isLoadingQuestionBanks) && visibleExtrasCatalog.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center border rounded-lg border-dashed border-gray-200">
                  {(simuladosCatalog.length === 0 && questionBanksCatalog.length === 0) ? (
                    <>
                      <p className="text-sm font-medium text-gray-900">Nenhum recurso encontrado</p>
                      <p className="text-sm text-gray-500 mt-1">Crie um simulado ou banco de questões para aparecer aqui.</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-gray-900">Nenhum recurso disponível</p>
                      <p className="text-sm text-gray-500 mt-1">Todos os recursos já foram adicionados para este destino.</p>
                    </>
                  )}
                </div>
              )}

              {!(isLoadingSimulados || isLoadingQuestionBanks) && visibleExtrasCatalog.map((s) => (
                <div key={`${String((s as any)?.kind || 'simulado')}:${s.id}`} className="rounded-[8px] border border-[#E3E4E5] bg-white p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-[8px] bg-[#F3F4F6] flex items-center justify-center overflow-hidden">
                      {(s as any)?.kind === 'banco'
                        ? <BookOpen className="h-5 w-5 text-[#0047BB]" />
                        : <Layers className="h-5 w-5 text-[#0047BB]" />
                      }
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-[#1E1B39] truncate">{(s as any)?.kind === 'banco' ? 'Banco: ' : 'Simulado: '}{s.title}</div>
                      <div className="text-[12px] text-[#737780]">{s.questionsCount} questões</div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="inline-flex items-center rounded-full bg-[#F3F4F6] px-2.5 py-1 text-[11px] text-[#737780]">{(s as any)?.kind === 'banco' ? 'Banco de Questões' : 'Simulado'}</span>
                        <span className="inline-flex items-center rounded-full bg-[#FEF9C3] px-2.5 py-1 text-[11px] text-[#92400E]">{s.priceLabel}</span>
                      </div>
                      <div className="mt-1 text-[12px] text-[#737780]">⭐ {s.rating} ({s.reviewsCount} avaliações)</div>
                    </div>
                  </div>
                  <div className="sm:self-center">
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (simuladoConnectScope === 'modulo' && !simuladoConnectModuleId) {
                          toast({ title: 'Selecione o módulo', description: 'Escolha um módulo para conectar.' })
                          return
                        }
                        if (simuladoConnectScope === 'aula' && (!simuladoConnectModuleId || !simuladoConnectLessonId)) {
                          toast({ title: 'Selecione a aula', description: 'Escolha o módulo e a aula para conectar.' })
                          return
                        }
                        setSelectedSimulados((prev) => {
                          const newItem = { 
                            ...s, 
                            scope: simuladoConnectScope, 
                            moduleId: simuladoConnectModuleId, 
                            lessonId: simuladoConnectLessonId 
                          }
                          const exists = prev.some(x => 
                            x.id === s.id && 
                            ((x as any)?.kind || 'simulado') === (((s as any)?.kind) || 'simulado') &&
                            x.scope === simuladoConnectScope && 
                            x.moduleId === simuladoConnectModuleId && 
                            x.lessonId === simuladoConnectLessonId
                          )
                          return exists ? prev : [...prev, newItem]
                        })
                        const scopeLabel = simuladoConnectScope === 'curso'
                          ? 'ao curso inteiro'
                          : simuladoConnectScope === 'modulo'
                            ? `ao módulo ${(modules.find(m => m.id === simuladoConnectModuleId)?.name) || ''}`
                            : `à aula ${(modules.find(m => m.id === simuladoConnectModuleId)?.lessons.find(l => l.id === simuladoConnectLessonId)?.title) || ''}`
                        toast({ title: 'Recurso selecionado', description: `${s.title} conectado ${scopeLabel}.` })
                      }}
                    >
                      Selecionar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsSelectSimuladoOpen(false)}>Fechar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <input ref={extraMaterialFileInputRef} type="file" className="hidden" onChange={handleExtraMaterialFileSelected} />

      <AlertDialog open={isExtraLinkOpen} onOpenChange={(v) => { setIsExtraLinkOpen(v); if (!v) { setExtraLinkUrl(''); setExtraLinkTarget(null) } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Adicionar link</AlertDialogTitle>
            <AlertDialogDescription>Informe a URL do recurso.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="mt-2 space-y-3">
            <div>
              <label className="text-[12px] text-[#6B7280]">URL</label>
              <input
                id="extra-link-input"
                className="mt-1 w-full rounded-[8px] border border-[#E3E4E5] bg-white px-3 py-2 text-[13px]"
                value={extraLinkUrl}
                onChange={(e) => setExtraLinkUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setIsExtraLinkOpen(false); setExtraLinkUrl(''); setExtraLinkTarget(null) }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const url = String(extraLinkUrl || '').trim()
                if (!url) {
                  toast({ title: 'Informe a URL', description: 'Digite um link válido.' })
                  return
                }
                const target = extraLinkTarget || { scope: 'curso' as const }
                const item: LessonMaterial = { id: generateLocalId(), name: url, sizeLabel: '', type: 'link', url, path: null }
                attachMaterialTo(target, item, null)
                setIsExtraLinkOpen(false)
                setExtraLinkUrl('')
                setExtraLinkTarget(null)
              }}
            >
              Adicionar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isResourceLibraryOpen} onOpenChange={(v) => { setIsResourceLibraryOpen(v); if (!v) setResourceLibraryTarget(null) }}>
        <AlertDialogContent style={{ width: '720px', height: '620px', maxWidth: '96vw', maxHeight: '86vh' }} className="flex flex-col overflow-hidden">
          <AlertDialogHeader>
            <AlertDialogTitle>Biblioteca de recursos</AlertDialogTitle>
            <AlertDialogDescription>Reutilize recursos já enviados em outros cursos, sem precisar carregar novamente.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-3 flex-1 min-h-0 overflow-y-auto pr-1">
            <div className="flex items-center gap-2">
              <input
                className="flex-1 h-9 rounded-[8px] border border-[#E3E4E5] bg-white px-3 text-[13px]"
                value={resourceLibraryQuery}
                onChange={(e) => setResourceLibraryQuery(e.target.value)}
                placeholder="Buscar por nome, tipo ou curso..."
              />
              {resourceLibraryLoading ? (
                <div className="text-[12px] text-[#737780]">Carregando…</div>
              ) : null}
            </div>

            {visibleResourceLibrary.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center border rounded-lg border-dashed border-gray-200">
                <p className="text-sm font-medium text-gray-900">Nenhum recurso encontrado</p>
                <p className="text-sm text-gray-500 mt-1">Envie anexos em aulas/cursos/módulos para aparecerem aqui.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {visibleResourceLibrary.map((m, idx) => (
                  <div key={`lib-${String(m?.id || idx)}`} className="rounded-[8px] border border-[#E3E4E5] bg-white p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-[10px] border border-[#E3E4E5] bg-white flex items-center justify-center">
                        {materialIcon(m.type)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-[#1E1B39] truncate">{m.name}</div>
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-[#737780]">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded ${materialColor(m.type)}`}>{String(m.type).toUpperCase()}</span>
                          {(m as any)?.sourceCourseTitle ? <span className="truncate">• {(m as any).sourceCourseTitle}</span> : null}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      className="h-8 px-3"
                      onClick={() => {
                        const target = resourceLibraryTarget
                        if (!target) return
                        const { sourceCourseId, sourceCourseTitle, ...mat } = (m as any) || {}
                        attachMaterialTo(target, mat as LessonMaterial, null)
                        toast({ title: 'Recurso adicionado', description: 'Recurso conectado com sucesso.' })
                        setIsResourceLibraryOpen(false)
                        setResourceLibraryTarget(null)
                      }}
                    >
                      Usar
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setIsResourceLibraryOpen(false); setResourceLibraryTarget(null) }}>Fechar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isLessonLibraryOpen} onOpenChange={(v) => { setIsLessonLibraryOpen(v); if (!v) setLessonLibraryTargetModuleId(null) }}>
        <AlertDialogContent style={{ width: '820px', height: '620px', maxWidth: '96vw', maxHeight: '86vh' }} className="flex flex-col overflow-hidden">
          <AlertDialogHeader>
            <AlertDialogTitle>Biblioteca de aulas</AlertDialogTitle>
            <AlertDialogDescription>Reutilize aulas já configuradas em outros cursos (Upload/Vimeo/VdoCipher), sem precisar reenviar.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-3 flex-1 min-h-0 overflow-y-auto pr-1">
            <div className="flex items-center gap-2">
              <input
                className="flex-1 h-9 rounded-[8px] border border-[#E3E4E5] bg-white px-3 text-[13px]"
                value={lessonLibraryQuery}
                onChange={(e) => setLessonLibraryQuery(e.target.value)}
                placeholder="Buscar por aula, curso, módulo ou provedor..."
              />
              {lessonLibraryLoading ? (
                <div className="text-[12px] text-[#737780]">Carregando…</div>
              ) : null}
            </div>

            {visibleLessonLibrary.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center border rounded-lg border-dashed border-gray-200">
                <p className="text-sm font-medium text-gray-900">Nenhuma aula encontrada</p>
                <p className="text-sm text-gray-500 mt-1">Crie aulas em outros cursos para aparecerem aqui.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {visibleLessonLibrary.map((it, idx) => (
                  <div key={String(it?.id || idx)} className="rounded-[8px] border border-[#E3E4E5] bg-white p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-[10px] border border-[#E3E4E5] bg-white flex items-center justify-center">
                        <Play className="h-4 w-4 text-[#0047BB]" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-[#1E1B39] truncate">{String(it?.title || 'Aula')}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[#737780]">
                          <span className="inline-flex items-center gap-1">
                            <Timer className="h-3.5 w-3.5 text-[#6B7280]" /> {Number(it?.durationMin || 0)} min
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#F3F4F6] text-[#374151]">
                            {String(it?.provider || 'video').toUpperCase()}
                          </span>
                          <span className="truncate">• {String(it?.courseTitle || 'Curso')} • {String(it?.moduleTitle || 'Módulo')}</span>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      className="h-8 px-3"
                      onClick={() => {
                        const mid = String(lessonLibraryTargetModuleId || '').trim()
                        if (!mid) return
                        addExistingLessonToModule(mid, it)
                        toast({ title: 'Aula adicionada', description: 'Aula reutilizada com sucesso.' })
                        setIsLessonLibraryOpen(false)
                        setLessonLibraryTargetModuleId(null)
                      }}
                    >
                      Usar
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setIsLessonLibraryOpen(false); setLessonLibraryTargetModuleId(null) }}>Fechar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Modal de configurações do VdoCipher */}
      <AlertDialog open={isVdoSettingsOpen} onOpenChange={setIsVdoSettingsOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Configurações do VdoCipher</AlertDialogTitle>
            <AlertDialogDescription>
              Informe seu API Secret para validar e conectar sua conta do VdoCipher.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="mt-2 space-y-3">
            <div className="rounded-[8px] border border-[#E3E4E5] bg-[#F8FAFC] p-3">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-[#0047BB] mt-0.5" />
                <div className="space-y-1">
                  <div className="text-[12px] font-semibold text-[#1E1B39]">Como conectar</div>
                  <div className="text-[12px] text-[#737780]">1) Gere/copiar o API Secret no painel do VdoCipher.</div>
                  <div className="text-[12px] text-[#737780]">2) Cole aqui e clique em “Salvar e Conectar” para validar automaticamente.</div>
                  <div className="text-[12px] text-[#737780]">3) Depois de conectado, você pode enviar e usar vídeos no VdoCipher.</div>
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <a href="https://www.vdocipher.com/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] text-[#0047BB] hover:underline">
                      Abrir VdoCipher <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <a href="https://www.vdocipher.com/docs/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] text-[#0047BB] hover:underline">
                      Documentação <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <label className="text-[12px] text-[#6B7280]">API Secret</label>
              <input type="password" className="mt-1 w-full rounded-[8px] border border-[#E3E4E5] bg-white px-3 py-2 text-[13px]" value={vdoSettings.api_secret} onChange={(e) => setVdoSettings((s) => ({ ...s, api_secret: e.target.value }))} placeholder="ex: sk_live_..." />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsVdoSettingsOpen(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              const ok = await saveVdoSettings()
              if (ok) {
                setIsVdoSettingsOpen(false)
                handleConnectService('vdocipher')
              }
            }}>Salvar e Conectar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {showChatBot && (
        <div className="fixed bottom-6 right-6 w-[420px] h-[520px] bg-white border border-[#E3E4E5] rounded-[10px] shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#E3E4E5]">
            <span className="text-[13px] font-semibold text-[#1E1B39]">Assistente</span>
            <button
              className="w-7 h-7 rounded hover:bg-[#F3F4F6] grid place-items-center"
              onClick={() => setShowChatBot(false)}
              title="Fechar"
            >
              <X className="h-4 w-4 text-[#6B7280]" />
            </button>
          </div>
          <div className="h-[calc(100%-40px)]">
            <ChatArea
              conversation={null}
              onAddReply={() => {}}
              onLikePost={() => {}}
              onLikeReply={() => {}}
              onEditReply={() => {}}
              onDeleteReply={() => {}}
              onToggleStudentInfo={() => {}}
              activeFilterData={null}
              currentUser={null}
              error={null}
              onRetry={() => {}}
            />
          </div>
        </div>
      )}

      <AlertDialog open={isAddLessonModalOpen} onOpenChange={setIsAddLessonModalOpen}>
        <AlertDialogContent className="w-[95vw] max-w-[720px] max-h-[85vh] overflow-y-auto overflow-x-hidden">
          <AlertDialogHeader>
            <AlertDialogTitle>{editingLessonId ? 'Editar aula' : 'Nova aula'}</AlertDialogTitle>
            <AlertDialogDescription>{editingLessonId ? 'Edite os campos da aula.' : 'Preencha os campos básicos para criar a aula.'}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 pb-64">
            <div>
              <label className="text-[12px] font-medium text-[#374151]">Título</label>
              <input value={newLessonTitle} onChange={(e) => setNewLessonTitle(e.target.value)} className="mt-1 h-9 w-full rounded-[8px] border border-[#E3E4E5] px-3 text-[12px]" placeholder="Digite o título da aula" />
            </div>
            <div>
              <label className="text-[12px] font-medium text-[#374151]">Descrição</label>
              <div className="mt-1">
                <RichTextNotionEditor
                  value={
                    newLessonDescriptionRich
                    || (newLessonDescription ? { blocks: [{ type: 'paragraph', data: { text: newLessonDescription } }] } : null)
                  }
                  placeholder="Digite uma descrição"
                  onChange={(next) => {
                    setNewLessonDescriptionRich(next)
                    const plain = editorJsToPlainText(next)
                    if (plain) setNewLessonDescription(plain.slice(0, 240))
                    else setNewLessonDescription('')
                  }}
                  minHeight={220}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[12px] font-medium text-[#374151]">Duração (min)</label>
                <input type="number" min={1} value={newLessonDurationMin} onChange={(e) => setNewLessonDurationMin(Number(e.target.value))} className="mt-1 h-9 w-full rounded-[8px] border border-[#E3E4E5] px-3 text-[12px]" />
              </div>
              <div>
                <label className="text-[12px] font-medium text-[#374151]">Visibilidade</label>
                <select value={newLessonVisibility} onChange={(e) => { const v = e.target.value as 'Gratuita' | 'Paga' | 'Gratuita para alunos do curso'; setNewLessonVisibility(v); if (v === 'Gratuita') setNewLessonPrice('') }} className="mt-1 h-9 w-full rounded-[8px] border border-[#E3E4E5] px-3 text-[12px]">
                  <option value="Gratuita">Gratuita</option>
                  <option value="Gratuita para alunos do curso">Gratuita para alunos do curso</option>
                  <option value="Paga">Paga</option>
                </select>
              </div>
              <div>
                <label className="text-[12px] font-medium text-[#374151]">Dificuldade</label>
                <select value={newLessonDifficulty || 'Intermediário'} onChange={(e) => setNewLessonDifficulty(e.target.value as any)} className="mt-1 h-9 w-full rounded-[8px] border border-[#E3E4E5] px-3 text-[12px]">
                  <option value="Iniciante">Iniciante</option>
                  <option value="Intermediário">Intermediário</option>
                  <option value="Avançado">Avançado</option>
                </select>
              </div>
            </div>

            {newLessonVisibility !== 'Gratuita' && (
              <div>
                <label className="text-[12px] font-medium text-[#374151]">Valor da aula</label>
                <div className="mt-1 flex items-center rounded-[8px] border border-[#E3E4E5] bg-white px-3">
                  <span className="text-[12px] text-[#6B7280]">R$</span>
                  <input
                    value={newLessonPrice}
                    onChange={(e) => {
                      const v = e.target.value
                      const cleaned = v.replace(/[^\d.,]/g, '')
                      setNewLessonPrice(cleaned)
                    }}
                    inputMode="decimal"
                    className="h-9 w-full bg-transparent px-2 text-[12px] outline-none"
                    placeholder="0,00"
                  />
                </div>
              </div>
            )}

            <div className="space-y-4 pt-2">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img src="/icons/categorias-popup.svg" alt="Categoria" className="w-4 h-4" />
                    <span className="text-[12px] font-medium text-[#374151]">Categoria:</span>
                  </div>
                  <div className="relative dropdown-container flex justify-end w-full">
                    <button
                      type="button"
                      className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
                      title="Adicionar categoria"
                      aria-haspopup="menu"
                      aria-expanded={showLessonCategorySelector}
                      style={{ background: 'none' }}
                      aria-label="Adicionar categoria"
                      onClick={() => setShowLessonCategorySelector((v) => !v)}
                    >
                      <Plus className="w-4 h-4 text-[#0047BB]" />
                    </button>
                    <TaxonomyDropdown
                      open={showLessonCategorySelector}
                      onOpenChange={setShowLessonCategorySelector}
                      items={courseCategoryItems}
                      align="end"
                      isSelected={(item) => newLessonCategories.includes(item.name)}
                      onSelect={(item) => {
                        if (!newLessonCategories.includes(item.name)) setNewLessonCategories((prev) => [...prev, item.name])
                        setShowLessonCategorySelector(false)
                      }}
                      onCreate={async (payload) => { await (createLessonCategoryFromPayload as any)(payload); setShowLessonCategorySelector(false) }}
                      onUpdate={async (id, payload) => { await (updateLessonCategoryFromPayload as any)(id, payload); setShowLessonCategorySelector(false) }}
                      onDelete={async (id) => { await (deleteLessonCategoryById as any)(id); setShowLessonCategorySelector(false) }}
                      searchPlaceholder="Pesquisar categorias..."
                      createLabel="Criar nova categoria"
                      defaultColor="#8B5CF6"
                    />
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {newLessonCategories.map((c, idx) => (
                    <span key={`${c}-${idx}`} className="inline-flex items-center gap-1 rounded bg-[#EEF2FF] text-[#1D4ED8] px-2 py-0.5 text-[12px]">
                      {c}
                      <button className="text-[#6B7280]" onClick={() => setNewLessonCategories(prev => prev.filter((_, i) => i !== idx))}>&times;</button>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img src="/icons/subcategoria-popup.svg" alt="Subcategoria" className="w-4 h-4" />
                    <span className="text-[12px] font-medium text-[#374151]">Subcategoria:</span>
                  </div>
                  <div className="relative dropdown-container flex justify-end w-full">
                    <button
                      type="button"
                      className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
                      title="Adicionar subcategoria"
                      aria-haspopup="menu"
                      aria-expanded={showLessonSubcategorySelector}
                      style={{ background: 'none' }}
                      aria-label="Adicionar subcategoria"
                      onClick={() => setShowLessonSubcategorySelector((v) => !v)}
                    >
                      <Plus className="w-4 h-4 text-[#0047BB]" />
                    </button>
                    <TaxonomyDropdown
                      open={showLessonSubcategorySelector}
                      onOpenChange={setShowLessonSubcategorySelector}
                      items={courseSubcategoryItems}
                      align="end"
                      isSelected={(item) => newLessonSubcategories.includes(item.name)}
                      onSelect={(item) => {
                        if (!newLessonSubcategories.includes(item.name)) setNewLessonSubcategories((prev) => [...prev, item.name])
                        setShowLessonSubcategorySelector(false)
                      }}
                      onCreate={async (payload) => { await (createLessonSubcategoryFromPayload as any)(payload); setShowLessonSubcategorySelector(false) }}
                      onUpdate={async (id, payload) => { await (updateLessonSubcategoryFromPayload as any)(id, payload); setShowLessonSubcategorySelector(false) }}
                      onDelete={async (id) => { await (deleteLessonSubcategoryById as any)(id); setShowLessonSubcategorySelector(false) }}
                      searchPlaceholder="Pesquisar subcategorias..."
                      createLabel="Criar nova subcategoria"
                      defaultColor="#10B981"
                    />
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {newLessonSubcategories.map((s, idx) => (
                    <span key={`${s}-${idx}`} className="inline-flex items-center gap-1 rounded bg-[#F3F4F6] text-[#374151] px-2 py-0.5 text-[12px]">
                      {s}
                      <button className="text-[#6B7280]" onClick={() => setNewLessonSubcategories(prev => prev.filter((_, i) => i !== idx))}>&times;</button>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img src="/icons/tag-popup.svg" alt="Tag" className="w-4 h-4" />
                    <span className="text-[12px] font-medium text-[#374151]">Tags:</span>
                  </div>
                  <div className="relative dropdown-container flex justify-end w-full">
                    <button
                      type="button"
                      className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
                      title="Adicionar tag"
                      aria-haspopup="menu"
                      aria-expanded={showLessonTagSelector}
                      style={{ background: 'none' }}
                      aria-label="Adicionar tag"
                      onClick={() => setShowLessonTagSelector((v) => !v)}
                    >
                      <Plus className="w-4 h-4 text-[#0047BB]" />
                    </button>
                    <TaxonomyDropdown
                      open={showLessonTagSelector}
                      onOpenChange={setShowLessonTagSelector}
                      items={courseTagItems}
                      align="end"
                      isSelected={(item) => newLessonExtraTags.includes(item.name)}
                      onSelect={(item) => {
                        if (!newLessonExtraTags.includes(item.name)) setNewLessonExtraTags((prev) => [...prev, item.name])
                        setShowLessonTagSelector(false)
                      }}
                      onCreate={async (payload) => { await (createLessonTagFromPayload as any)(payload); setShowLessonTagSelector(false) }}
                      onUpdate={async (id, payload) => { await (updateLessonTagFromPayload as any)(id, payload); setShowLessonTagSelector(false) }}
                      onDelete={async (id) => { await (deleteLessonTagById as any)(id); setShowLessonTagSelector(false) }}
                      searchPlaceholder="Pesquisar tags..."
                      createLabel="Criar nova tag"
                      defaultColor="#0EA5E9"
                    />
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {newLessonExtraTags.map((t, idx) => (
                    <span key={`${t}-${idx}`} className="inline-flex items-center gap-1 rounded bg-[#FEF9C3] text-[#92400E] px-2 py-0.5 text-[12px]">
                      {t}
                      <button className="text-[#6B7280]" onClick={() => setNewLessonExtraTags(prev => prev.filter((_, i) => i !== idx))}>&times;</button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-4">
              <p className="text-[12px] font-medium text-[#374151]">Materiais complementares</p>
              <div className="flex items-center flex-wrap gap-2">
                <Button type="button" variant="outline" className="gap-2" onClick={() => openMaterialUploader('pdf')}>
                  <FileText className="h-4 w-4 text-[#9291A5]" />
                  PDF
                </Button>
                <Button type="button" variant="outline" className="gap-2" onClick={() => openMaterialUploader('xls')}>
                  <FileSpreadsheet className="h-4 w-4 text-[#9291A5]" />
                  Planilha
                </Button>
                <Button type="button" variant="outline" className="gap-2" onClick={() => openMaterialUploader('doc')}>
                  <FileText className="h-4 w-4 text-[#9291A5]" />
                  Documento
                </Button>
                <Button type="button" variant="outline" className="gap-2" onClick={() => openMaterialUploader('ppt')}>
                  <FileType className="h-4 w-4 text-[#9291A5]" />
                  PPT
                </Button>
                <Button type="button" variant="outline" className="gap-2" onClick={() => openMaterialUploader('link')}>
                  <LinkIcon className="h-4 w-4 text-[#9291A5]" />
                  Link
                </Button>
              </div>
              <input
                ref={materialFileInputRef}
                type="file"
                className="hidden"
                onChange={handleMaterialFileSelected}
              />
              {showLinkInput && (
                <div className="mt-2 flex gap-2">
                  <input
                    id="new-material-link-input"
                    value={newMaterialLinkUrl}
                    onChange={(e) => setNewMaterialLinkUrl(e.target.value)}
                    placeholder="https://exemplo.com/recurso"
                    className="h-9 flex-1 rounded-[8px] border border-[#E3E4E5] px-3 text-[12px]"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const url = newMaterialLinkUrl.trim()
                      if (!url) return
                      const newItem: LessonMaterial = { id: `mat-${Date.now()}`, name: url, sizeLabel: '', type: 'link' }
                      setNewLessonMaterials(prev => [...prev, newItem])
                      setNewMaterialLinkUrl('')
                      setShowLinkInput(false)
                    }}
                  >Adicionar</Button>
                  <Button type="button" variant="ghost" onClick={() => { setShowLinkInput(false); setNewMaterialLinkUrl('') }}>Cancelar</Button>
                </div>
              )}
              <div className="space-y-2">
                {newLessonMaterials.length === 0 ? (
                  <div className="text-[12px] text-[#737780]">Nenhum material adicionado.</div>
                ) : (
                  newLessonMaterials.map((m) => (
                    <div key={m.id} className="flex items-center justify-between rounded-[8px] border border-[#E3E4E5] bg-white px-3 py-2 text-[12px]">
                      <div className="flex items-center gap-2 min-w-0">
                        {materialIcon(m.type)}
                        <span className="text-[#1E1B39] truncate max-w-[420px]" title={m.name}>{m.name}</span>
                        {m.sizeLabel && m.sizeLabel !== '—' && (
                          <span className="text-[11px] text-[#737780]">{m.sizeLabel}</span>
                        )}
                      </div>
                      <button type="button" className="text-[#737780] hover:underline" onClick={() => removeModalMaterial(m.id)}>Remover</button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="pt-4">
              <p className="text-[12px] font-medium text-[#374151]">Integração de armazenamento de videos</p>
              <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className={`rounded-[8px] border ${defaultVideoProvider === 'vimeo' ? 'border-[#0047BB]' : 'border-[#E3E4E5]'} bg-white p-3`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <img src="/vimeologo.svg" alt="Vimeo" className="h-5" />
                      <span className="text-[12px]">Vimeo</span>
                    </div>
                    <input type="radio" name="provider" checked={defaultVideoProvider === 'vimeo'} onChange={() => setDefaultVideoProvider('vimeo')} />
                  </div>
                  <p className="mt-2 text-[11px] text-[#737780]">Selecione para usar Vimeo como provedor de vídeo.</p>
                  <div className="mt-2 flex items-center justify-end gap-2">
                    {connectedProviders.vimeo ? (
                      <span className="inline-flex items-center gap-1 text-[12px] text-[#166534]"><Check className="h-3 w-3" /> Conectado</span>
                    ) : (
                      <>
                        <Button type="button" size="sm" variant="outline" className="h-7 px-3" onClick={async () => { await reloadVimeoSettings(); setIsVimeoSettingsOpen(true) }}>Configurar</Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className={`h-7 px-3 ${!isVimeoConfigured ? 'opacity-50 cursor-not-allowed' : ''}`}
                          disabled={!isVimeoConfigured}
                          onClick={async () => { await reloadVimeoSettings(); handleConnectService('vimeo') }}
                        >
                          Conectar
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <div className={`rounded-[8px] border ${defaultVideoProvider === 'vdocipher' ? 'border-[#0047BB]' : 'border-[#E3E4E5]'} bg-white p-3`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <img src="/vdologo.svg" alt="VdoCipher" className="h-5" />
                      <span className="text-[12px]">VdoCipher</span>
                    </div>
                    <input type="radio" name="provider" checked={defaultVideoProvider === 'vdocipher'} onChange={() => setDefaultVideoProvider('vdocipher')} />
                  </div>
                  <p className="mt-2 text-[11px] text-[#737780]">Selecione para usar VdoCipher como provedor de vídeo.</p>
                  <div className="mt-2 flex items-center justify-end gap-2">
                    {connectedProviders.vdocipher ? (
                      <>
                        <span className="inline-flex items-center gap-1 text-[12px] text-[#166534]"><Check className="h-3 w-3" /> Conectado</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-3"
                          onClick={handleVdoDisconnect}
                        >
                          Desconectar
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button type="button" size="sm" variant="outline" className="h-7 px-3" onClick={async () => { await reloadVdoSettings(); setIsVdoSettingsOpen(true) }}>Configurar</Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className={`h-7 px-3 ${!isVdoConfigured ? 'opacity-50 cursor-not-allowed' : ''}`}
                          disabled={!isVdoConfigured}
                          onClick={async () => { await reloadVdoSettings(); handleConnectService('vdocipher') }}
                        >
                          Conectar
                        </Button>
                      </>
                    )}
                  </div>
                  {connectedProviders.vdocipher && (
                    <div className="mt-2 rounded-[8px] border border-[#E3E4E5] bg-[#FBFCFF] p-2">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-[#EEF2FF]">
                          <DownloadCloud className="h-3.5 w-3.5 text-[#0047BB]" />
                        </span>
                        <span className="text-[12px] font-semibold text-[#1E1B39]">Upload direto para VdoCipher</span>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        <div>
                          <label className="text-[11px] text-[#6B7280]">Arquivo (MP4/Mov)</label>
                          <input
                            className="mt-1 w-full rounded-[8px] border border-[#E3E4E5] bg-white px-3 py-1.5 text-[12px]"
                            type="file"
                            accept="video/*"
                            onChange={(e) => setVdoUploadFile(e.target.files?.[0] ?? null)}
                          />
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-end">
                        <Button
                          className="h-8 px-3 bg-[#0047BB] hover:bg-[#003a99] text-white"
                          type="button"
                          disabled={isVdoUploading}
                          onClick={handleVdoUpload}
                        >
                          {isVdoUploading ? (
                            <span className="inline-flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Enviando...
                            </span>
                          ) : 'Enviar vídeo'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                <div className={`rounded-[8px] border ${defaultVideoProvider === 'upload' ? 'border-[#0047BB]' : 'border-[#E3E4E5]'} bg-white p-3`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Folder className="h-5 w-5 text-[#0047BB]" />
                      <span className="text-[12px]">Upload</span>
                    </div>
                    <input type="radio" name="provider" checked={defaultVideoProvider === 'upload'} onChange={() => setDefaultVideoProvider('upload')} />
                  </div>
                  <p className="mt-2 text-[11px] text-[#737780]">Envie um vídeo direto do seu dispositivo.</p>
                  <div className="mt-2">
                    <label className="text-[11px] text-[#6B7280]">Arquivo (MP4/Mov)</label>
                    <input
                      className="mt-1 w-full rounded-[8px] border border-[#E3E4E5] bg-white px-3 py-1.5 text-[12px]"
                      type="file"
                      accept="video/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null
                        setLessonUploadFile(file)
                        setDefaultVideoProvider('upload')
                        const lid = String(editingLessonId || draftLessonId || '').trim()
                        if (file && lid) setLessonVideoFilesById((prev) => ({ ...(prev || {}), [lid]: file }))
                      }}
                    />
                    {(() => {
                      const lid = String(editingLessonId || draftLessonId || '').trim()
                      const f = lid ? lessonVideoFilesById?.[lid] : null
                      if (!f) return null
                      return <div className="mt-2 text-[11px] text-[#737780] truncate">{f.name}</div>
                    })()}
                    {defaultVideoProvider === 'upload' && newLessonVideoUrl ? (
                      <div className="mt-2 text-[11px] text-[#166534]">Vídeo pronto para a aula.</div>
                    ) : null}
                  </div>
                  <div className="mt-2 flex items-center justify-end">
                    <Button
                      className="h-8 px-3 bg-[#0047BB] hover:bg-[#003a99] text-white"
                      type="button"
                      disabled={isLessonUploadUploading}
                      onClick={handleLessonStorageUpload}
                    >
                      {isLessonUploadUploading ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Enviando...
                        </span>
                      ) : 'Enviar vídeo'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setIsAddLessonModalOpen(false)
              setEditingLessonId(null)
              setEditingModuleId(null)
              setDraftLessonId(null)
              setNewLessonDifficulty('Intermediário')
              setNewLessonVideoUrl('')
              setNewLessonVideoId('')
              setNewLessonVideoPath(null)
              setLessonUploadFile(null)
              setNewLessonDescriptionRich(null)
            }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              let selectedModuleId = editingModuleId ?? modules[0]?.id
              if (!selectedModuleId) {
                const modId = `mod-${Date.now()}`
                setModules([{ id: modId, name: 'Módulo 1', description: '', lessonsCount: 0, lessons: [] }])
                selectedModuleId = modId
              }
              const paidLike = newLessonVisibility !== 'Gratuita'
              const lessonPriceCents = paidLike ? parseBRLValueToCents(newLessonPrice) : null
              if (paidLike && (!lessonPriceCents || lessonPriceCents <= 0)) {
                toast({ title: 'Informe o valor', description: 'Defina o valor da aula para visibilidade Paga.', variant: 'destructive' as any })
                return
              }
              const lessonId = String(editingLessonId || draftLessonId || Date.now()).trim()
              const provider = defaultVideoProvider
              const videoUrl = provider === 'vimeo' || provider === 'upload' ? (newLessonVideoUrl || null) : null
              const videoId = provider === 'vdocipher' ? (newLessonVideoId || null) : null
              const videoPath = provider === 'upload' ? (newLessonVideoPath || null) : null
                const lessonData: Lesson = {
                  id: lessonId,
                  title: newLessonTitle || 'Nova aula',
                  description: (newLessonDescription || '').trim(),
                  description_rich: newLessonDescriptionRich || null,
                  durationMin: newLessonDurationMin || 15,
                  visibility: newLessonVisibility,
                  priceCents: paidLike ? (lessonPriceCents || undefined) : undefined,
                  difficulty: newLessonDifficulty || 'Intermediário',
                  tag: newLessonExtraTags.length ? newLessonExtraTags[0] : '',
                  categories: newLessonCategories,
                  subcategories: newLessonSubcategories,
                  extraTags: newLessonExtraTags,
                  videoProvider: provider,
                  videoUrl,
                  videoId,
                  videoPath,
                  materials: newLessonMaterials,
                }
              if (editingLessonId) {
                setModules(modules.map((m) => {
                  if (m.id !== selectedModuleId) return m
                  return {
                    ...m,
                    lessons: m.lessons.map(l => l.id === editingLessonId ? lessonData : l)
                  }
                }))
              } else {
                setModules(modules.map((x) => x.id === selectedModuleId ? { ...x, lessons: [...x.lessons, lessonData], lessonsCount: x.lessonsCount + 1 } : x))
              }

              setIsAddLessonModalOpen(false)
              setEditingLessonId(null)
              setEditingModuleId(null)
              setDraftLessonId(null)

              setNewLessonTitle('')
              setNewLessonDescription('')
              setNewLessonDescriptionRich(null)
              setNewLessonDurationMin(0)
              setNewLessonVisibility('Gratuita')
              setNewLessonPrice('')
              setNewLessonDifficulty('Intermediário')
              setNewLessonCategories([])
              setNewLessonSubcategories([])
              setNewLessonExtraTags([])
              setNewLessonMaterials([])
              setNewLessonVideoUrl('')
              setNewLessonVideoId('')
              setNewLessonVideoPath(null)
              setLessonUploadFile(null)
              setModalNewCategory('')
              setModalNewSubcategory('')
              setModalNewTagExtra('')
              setIsExtrasSectionExpanded(true)
              setTimeout(() => {
                extrasSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }, 0)
            }}>Salvar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showModuleForm} onOpenChange={(open) => {
        setShowModuleForm(open)
        if (!open) {
          setNewModuleTitle("")
          setNewModuleDescription("")
          setNewModuleVisibility('Gratuita')
          setNewModulePrice('')
          setNewModuleCoverImage(null)
          setNewModuleCoverFile(null)
          setIsNewModuleCoverGalleryOpen(false)
          if (newModuleCoverInputRef.current) newModuleCoverInputRef.current.value = ''
        }
      }}>
        <AlertDialogContent className="max-w-md max-h-[80vh] overflow-y-auto overflow-x-hidden">
          <AlertDialogHeader>
          <AlertDialogTitle>Criar módulo</AlertDialogTitle>
          <AlertDialogDescription>Defina título e descrição do módulo.</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-[12px] font-medium text-[#737780]">Capa do módulo</label>
            <div className="mt-2">
                <label
                  className={`relative mx-auto w-[180px] h-[326px] rounded-[10px] border border-dashed border-[#C7D2FE] bg-[#F8FAFF] ${newModuleCoverImage ? 'p-0' : 'p-4'} cursor-pointer hover:bg-[#EEF2FF] transition-colors overflow-hidden flex items-center justify-center`}
                  onDragOver={(e) => { e.preventDefault() }}
                  onDrop={(e) => {
                    e.preventDefault()
                    const file = e.dataTransfer.files?.[0]
                    if (!file) return
                    if (!isImageFile(file)) {
                      toast({ title: 'Arquivo inválido', description: 'Envie apenas arquivos de imagem.', variant: 'destructive' as any })
                      return
                    }
                    setNewModuleCoverFile(file)
                    const url = URL.createObjectURL(file)
                    setNewModuleCoverImage(url)
                    setIsNewModuleCoverGalleryOpen(false)
                  }}
                >
                  {newModuleCoverImage ? (
                    <>
                      <img src={newModuleCoverImage} alt="Capa do módulo" className="absolute inset-0 h-full w-full object-cover" />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 pb-6 flex flex-col items-center text-center px-3">
                        <ConnektWordmark className="w-[110px] h-auto" />
                        <div className="mt-2 h-[2px] w-10 bg-white/70 rounded" />
                        <div className="mt-3 text-[14px] font-semibold text-white truncate w-full">{(newModuleTitle || '').trim() || 'Nome do módulo'}</div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setNewModuleCoverImage(null)
                          setNewModuleCoverFile(null)
                          if (newModuleCoverInputRef.current) newModuleCoverInputRef.current.value = ''
                        }}
                        className="absolute top-2 right-2 p-1 bg-white/85 rounded-full hover:bg-white text-red-500 transition-colors z-10"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <div className="text-center text-[12px] text-[#737780]">
                      Arraste uma imagem ou clique para selecionar
                    </div>
                  )}
                  <input
                    ref={newModuleCoverInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      if (!isImageFile(file)) {
                        toast({ title: 'Arquivo inválido', description: 'Envie apenas arquivos de imagem.', variant: 'destructive' as any })
                        if (newModuleCoverInputRef.current) newModuleCoverInputRef.current.value = ''
                        return
                      }
                      setNewModuleCoverFile(file)
                      const url = URL.createObjectURL(file)
                      setNewModuleCoverImage(url)
                      setIsNewModuleCoverGalleryOpen(false)
                    }}
                  />
                </label>
              </div>
              <div className="mt-2 text-[11px] text-[#737780]">Tamanho recomendado: 1080×1920 px (9:16). Máx. 5MB.</div>
              <div className="mt-3 flex items-center justify-between">
                <button
                  type="button"
                  className="text-[12px] font-medium text-[#0047BB] hover:underline"
                  onClick={() => setIsNewModuleCoverGalleryOpen((v) => !v)}
                >
                  {isNewModuleCoverGalleryOpen ? 'Ocultar sugestões' : 'Escolher uma capa pronta'}
                </button>
              </div>
              {isNewModuleCoverGalleryOpen ? (
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {medicalCourseCoverOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className="relative rounded-[8px] overflow-hidden border border-[#E3E4E5] bg-white hover:border-[#0047BB] transition-colors"
                      onClick={() => applyNewModuleCoverFromGallery(opt.src)}
                      title={opt.label}
                    >
                      <img src={opt.src} alt={opt.label} className="h-[64px] w-full object-cover" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div>
              <label className="text-[12px] font-medium text-[#737780]">Título do módulo*</label>
              <input
                value={newModuleTitle}
                onChange={(e) => setNewModuleTitle(e.target.value)}
                placeholder="Digite o título"
                className="mt-1 w-full h-10 px-3 border border-[#E3E4E5] rounded-[6px] bg-white text-[14px]"
              />
            </div>
            <div>
              <label className="text-[12px] font-medium text-[#737780]">Descrição*</label>
              <textarea
                value={newModuleDescription}
                onChange={(e) => setNewModuleDescription(e.target.value)}
                placeholder="Digite uma descrição para o módulo"
                className="mt-1 w-full rounded-[6px] border border-[#E3E4E5] bg-white p-3 text-[12px]"
                rows={3}
              />
            </div>
            <div className={newModuleVisibility !== 'Gratuita' ? "grid grid-cols-2 gap-3" : "grid grid-cols-1 gap-3"}>
              <div>
                <label className="text-[12px] font-medium text-[#737780]">Visibilidade</label>
                <select
                  value={newModuleVisibility}
                  onChange={(e) => {
                    const v = e.target.value as 'Gratuita' | 'Paga' | 'Gratuita para alunos do curso'
                    setNewModuleVisibility(v)
                    if (v === 'Gratuita') setNewModulePrice('')
                  }}
                  className="mt-1 w-full h-10 px-3 border border-[#E3E4E5] rounded-[6px] bg-white text-[14px]"
                >
                  <option value="Gratuita">Gratuito</option>
                  <option value="Gratuita para alunos do curso">Gratuito para alunos do curso</option>
                  <option value="Paga">Pago</option>
                </select>
              </div>
              {newModuleVisibility !== 'Gratuita' ? (
                <div>
                  <label className="text-[12px] font-medium text-[#737780]">Valor</label>
                  <div className="mt-1 flex items-center rounded-[6px] border border-[#E3E4E5] bg-white px-3">
                    <span className="text-[12px] text-[#6B7280]">R$</span>
                    <input
                      value={newModulePrice}
                      onChange={(e) => {
                        const v = e.target.value
                        const cleaned = v.replace(/[^\d.,]/g, '')
                        setNewModulePrice(cleaned)
                      }}
                      inputMode="decimal"
                      className="h-10 w-full bg-transparent px-2 text-[14px] outline-none"
                      placeholder="0,00"
                    />
                  </div>
                  {newModuleVisibility === 'Gratuita para alunos do curso' ? (
                    <div className="mt-1 text-[11px] text-[#737780]">Opcional: defina um valor para vender o módulo avulso para quem não é aluno do(s) curso(s).</div>
                  ) : null}
                </div>
              ) : null}
            </div>
            {newModuleVisibility === 'Gratuita para alunos do curso' ? (
              <div>
                <label className="text-[12px] font-medium text-[#737780]">Gratuito para alunos de</label>
                <select
                  multiple
                  value={Array.isArray(newModuleFreeCourseIds) ? newModuleFreeCourseIds : []}
                  onChange={(e) => {
                    const selected = Array.from(e.currentTarget.selectedOptions).map((o) => String(o.value || '').trim()).filter(Boolean)
                    setNewModuleFreeCourseIds(selected)
                  }}
                  className="mt-1 w-full min-h-[96px] rounded-[6px] border border-[#E3E4E5] bg-white px-3 py-2 text-[13px]"
                >
                  <option value="self">Este curso</option>
                  {availableCourses.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <div className="mt-1 text-[11px] text-[#737780]">Dica: segure Ctrl (Windows) para selecionar mais de um.</div>
              </div>
            ) : null}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowModuleForm(false);
              setNewModuleTitle("");
              setNewModuleDescription("");
              setNewModuleVisibility('Gratuita')
              setNewModulePrice('')
              setNewModuleFreeCourseIds(['self'])
              setNewModuleCoverImage(null)
              setNewModuleCoverFile(null)
              setIsNewModuleCoverGalleryOpen(false)
              if (newModuleCoverInputRef.current) newModuleCoverInputRef.current.value = ''
            }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const name = newModuleTitle.trim();
                const desc = newModuleDescription.trim();
                if (!name || !desc) return;
                const hasPrice = newModuleVisibility !== 'Gratuita'
                const priceCents = hasPrice ? (parseBRLValueToCents(newModulePrice) || 0) : null
                if (newModuleVisibility === 'Paga' && (!priceCents || priceCents <= 0)) {
                  toast({ title: 'Informe o valor', description: 'Defina o valor do módulo para visibilidade Paga.', variant: 'destructive' as any })
                  return
                }
                const id = `mod-${Date.now()}`
                const freeCourseIds =
                  newModuleVisibility === 'Gratuita para alunos do curso'
                    ? (Array.isArray(newModuleFreeCourseIds) && newModuleFreeCourseIds.length ? newModuleFreeCourseIds : ['self'])
                    : undefined
                setModules((prev) => [...prev, { id, name, description: desc, lessonsCount: 0, lessons: [], cover_image_url: newModuleCoverImage || null, cover_image_path: null, visibility: newModuleVisibility, priceCents: hasPrice ? (priceCents || 0) : undefined, freeCourseIds } as any]);
                if (newModuleCoverFile) {
                  setModuleCoverFilesById((prev) => ({ ...prev, [id]: newModuleCoverFile }))
                }
                setEditingModuleId(id)
                setEditingLessonId(null)
                setShowModuleForm(false);
                setNewModuleTitle("");
                setNewModuleDescription("");
                setNewModuleVisibility('Gratuita')
                setNewModulePrice('')
                setNewModuleFreeCourseIds(['self'])
                setNewModuleCoverImage(null)
                setNewModuleCoverFile(null)
                setIsNewModuleCoverGalleryOpen(false)
                if (newModuleCoverInputRef.current) newModuleCoverInputRef.current.value = ''
              }}
            >
              Adicionar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex-1 w-full">
      <div className="w-full max-w-[650px] mx-auto px-3 py-3 hd:max-w-none hd:px-0">
        {/* Stepper redesenhado com ícones e progresso */}
        {/* Stepper removido */}
        {/* Alternância Editor/Layout (aparece só no passo de conteúdo) */}
        {(activeScreen === 'editor' || activeScreen === 'layout') && (
          <div className="-mt-2 mb-2">
            <div className="inline-flex items-center rounded-[8px] border border-[#E3E4E5] bg-white overflow-hidden">
              <button
                className={`px-3 py-2 text-[12px] ${activeScreen === 'editor' ? 'bg-[#F3F4F6] font-semibold' : 'bg-white'} transition-colors`}
                onClick={() => { setActiveScreen('editor'); history.replaceState({}, '', window.location.pathname); }}
              >
                Informações
              </button>
            </div>
          </div>
        )}
        <div
          className={`flex items-start gap-3 justify-start overflow-x-auto hd:justify-center hd:${(activeScreen === 'editor' || activeScreen === 'monetizacao') ? 'gap-3' : 'gap-0'} hd:overflow-visible hd:w-full`}
          style={{ scrollbarWidth: 'none' }}
        >
        <aside className="bg-white rounded-[10px] border border-[#E3E4E5] p-2 h-fit sticky top-4 self-start w-[400px] shrink-0 overflow-hidden">
          <div className="space-y-3">
            <div>
              <h3 className="text-[14px] font-semibold text-[#1E1B39]">{isEditMode ? 'Edição do curso' : 'Criação do curso'}</h3>
              <div className="mt-2 h-2 w-full rounded-full bg-[#E5E7EB] overflow-hidden">
                <div className="h-full rounded-full bg-[#0047BB]" style={{ width: `${progressPercent}%` }} />
              </div>
              <p className="mt-2 text-[12px] text-[#737780]">{completedCount} de {stepsMeta.length} sessões concluídas • {progressPercent}%</p>
            </div>

            <div className="mt-3">
              <div className="text-[11px] font-semibold text-[#9291A5] mb-2">CONTEÚDO</div>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => attemptGoToScreen('editor')}
                  className={`w-full text-left rounded-[8px] border ${isEditMode ? 'border-[#0047BB]' : (activePhase === 'conteudo' ? 'border-[#0047BB]' : 'border-[#E3E4E5]')} ${activePhase === 'conteudo' ? 'bg-[#F5F9FF]' : 'bg-white'} p-3 transition-colors hover:bg-[#F8FAFF]`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`inline-flex w-6 h-6 items-center justify-center rounded-full ${activePhase === 'conteudo' ? 'bg-[#0047BB] text-white' : 'bg-[#EEF2FF] text-[#0047BB]'} text-[12px] font-bold`}>1</span>
                    <div>
                      <div className="text-[12px] font-semibold text-[#1E1B39]">Conteúdo do curso</div>
                      <div className="text-[11px] text-[#9291A5]">Defina título, categorias e estrutura de módulos</div>
                      {isEditMode && <div className="mt-1 text-[11px] font-semibold text-[#0047BB]">Modo edição</div>}
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => attemptGoToScreen('aulas')}
                  disabled={!isEditMode && stepOrder.indexOf('aulas') > maxUnlockedIndex}
                  className={`w-full text-left rounded-[8px] border ${isEditMode ? 'border-[#0047BB]' : (activePhase === 'aulas' ? 'border-[#0047BB]' : 'border-[#E3E4E5]')} ${activePhase === 'aulas' ? 'bg-[#F5F9FF]' : 'bg-white'} p-3 transition-colors ${!isEditMode && stepOrder.indexOf('aulas') > maxUnlockedIndex ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#F8FAFF]'}`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`inline-flex w-6 h-6 items-center justify-center rounded-full ${activePhase === 'aulas' ? 'bg-[#0047BB] text-white' : 'bg-[#EEF2FF] text-[#0047BB]'} text-[12px] font-bold`}>2</span>
                    <div>
                      <div className="text-[12px] font-semibold text-[#1E1B39]">Criar aulas</div>
                      <div className="text-[11px] text-[#9291A5]">Adicione e edite aulas de cada módulo</div>
                      {isEditMode && <div className="mt-1 text-[11px] font-semibold text-[#0047BB]">Modo edição</div>}
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => attemptGoToScreen('recursos')}
                  disabled={!isEditMode && stepOrder.indexOf('recursos') > maxUnlockedIndex}
                  className={`w-full text-left rounded-[8px] border ${isEditMode ? 'border-[#0047BB]' : (activePhase === 'recursos' ? 'border-[#0047BB]' : 'border-[#E3E4E5]')} ${activePhase === 'recursos' ? 'bg-[#F5F9FF]' : 'bg-white'} p-3 transition-colors ${!isEditMode && stepOrder.indexOf('recursos') > maxUnlockedIndex ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#F8FAFF]'}`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`inline-flex w-6 h-6 items-center justify-center rounded-full ${activePhase === 'recursos' ? 'bg-[#0047BB] text-white' : 'bg-[#EEF2FF] text-[#0047BB]'} text-[12px] font-bold`}>3</span>
                    <div>
                      <div className="text-[12px] font-semibold text-[#1E1B39]">Recursos extras</div>
                      <div className="text-[11px] text-[#9291A5]">Adicione recursos extras ao seu curso</div>
                      {isEditMode && <div className="mt-1 text-[11px] font-semibold text-[#0047BB]">Modo edição</div>}
                    </div>
                  </div>
                </button>
              </div>
            </div>

            <div className="mt-3">
              <div className="text-[11px] font-semibold text-[#9291A5] mb-2">ÁREA DO ALUNO</div>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => attemptGoToScreen('visual')}
                  disabled={!isEditMode && stepOrder.indexOf('visual') > maxUnlockedIndex}
                  className={`w-full text-left rounded-[8px] border ${isEditMode ? 'border-[#0047BB]' : (activePhase === 'visual' ? 'border-[#0047BB]' : 'border-[#E3E4E5]')} ${activePhase === 'visual' ? 'bg-[#F5F9FF]' : 'bg-white'} p-3 transition-colors ${!isEditMode && stepOrder.indexOf('visual') > maxUnlockedIndex ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#F8FAFF]'}`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`inline-flex w-6 h-6 items-center justify-center rounded-full ${activePhase === 'visual' ? 'bg-[#0047BB] text-white' : 'bg-[#EEF2FF] text-[#0047BB]'} text-[12px] font-bold`}>4</span>
                    <div>
                      <div className="text-[12px] font-semibold text-[#1E1B39]">Personalização visual</div>
                      <div className="text-[11px] text-[#9291A5]">Customize sua área de membros</div>
                      {isEditMode && <div className="mt-1 text-[11px] font-semibold text-[#0047BB]">Modo edição</div>}
                    </div>
                  </div>
                </button>
              </div>
            </div>

            <div className="mt-3">
              <div className="text-[11px] font-semibold text-[#9291A5] mb-2">CONFIGURAÇÕES</div>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => attemptGoToScreen('monetizacao')}
                  disabled={!isEditMode && stepOrder.indexOf('monetizacao') > maxUnlockedIndex}
                  className={`w-full text-left rounded-[8px] border ${isEditMode ? 'border-[#0047BB]' : (activePhase === 'monetizacao' ? 'border-[#0047BB]' : 'border-[#E3E4E5]')} ${activePhase === 'monetizacao' ? 'bg-[#F5F9FF]' : 'bg-white'} p-3 transition-colors ${!isEditMode && stepOrder.indexOf('monetizacao') > maxUnlockedIndex ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#F8FAFF]'}`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`inline-flex w-6 h-6 items-center justify-center rounded-full ${activePhase === 'monetizacao' ? 'bg-[#0047BB] text-white' : 'bg-[#EEF2FF] text-[#0047BB]'} text-[12px] font-bold`}>5</span>
                    <div>
                      <div className="text-[12px] font-semibold text-[#1E1B39]">Monetização / Publicação</div>
                      <div className="text-[11px] text-[#9291A5]">Configure seu meio de pagamento e publique seu curso</div>
                      {isEditMode && <div className="mt-1 text-[11px] font-semibold text-[#0047BB]">Modo edição</div>}
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </aside>
        <section className="w-[520px] shrink-0 min-w-0 overflow-visible">
          {activeScreen === 'layout' ? (
            <div className="bg-white rounded-[10px] border border-[#E3E4E5] p-3">
              {/* Bloco didático */}
              <div className="rounded-[8px] bg-gradient-to-br from-[#F8FAFF] to-[#EEF2FF] border border-[#C7D2FE] p-4 mb-4">
                <div className="text-[13px] font-semibold text-[#1E1B39] mb-1">O que fazer nesta etapa</div>
                <ul className="list-disc pl-5 text-[12px] text-[#737780] space-y-1">
                  <li>Ajuste a imagem de capa e confira o título.</li>
                  <li>Veja como seu módulo será apresentado ao aluno.</li>
                  <li>Se precisar, volte para “Informações” para editar conteúdo.</li>
                </ul>
              </div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[14px] font-semibold">Capa do curso</h3>
                <button
                  className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-[#F3F4F6]"
                  onClick={() => { setActiveScreen('editor'); history.replaceState({}, '', window.location.pathname); }}
                >
                  <X className="h-4 w-4 text-[#6B7280]" />
                </button>
              </div>
              <div className="flex justify-center">
                {moduleLayoutImage ? (
                  <CoverCardPreview src={moduleLayoutImage} titleText={(title || '').trim() || 'Nome do curso'} />
                ) : (
                  <div className="w-[180px] h-[326px] rounded-[10px] border border-dashed border-[#C7D2FE] bg-[#F8FAFF] flex items-center justify-center text-[12px] text-[#737780]">
                    Sem capa
                  </div>
                )}
              </div>
              <div className="mt-4 flex items-center justify-end">
                <Button variant="outline" onClick={() => { setActiveScreen('editor'); history.replaceState({}, '', window.location.pathname); }}>Voltar para informações</Button>
              </div>
            </div>
          ) : activeScreen === 'editor' ? (
            <div className="bg-white rounded-[10px] border border-[#E3E4E5] p-3 overflow-visible">
              <div className="space-y-4">
                {/* Conteúdo existente do editor */}
                <div className="px-4 py-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-[8px] bg-white shadow-sm ring-1 ring-[#F3F4F6] flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 52 52" fill="none" className="block">
                        <path d="M0 4C0 1.79086 1.79086 0 4 0H48C50.2091 0 52 1.79086 52 4V48C52 50.2091 50.2091 52 48 52H4C1.79086 52 0 50.2091 0 48V4Z" fill="#5B4DEA"/>
                        <g clipPath="url(#clip0_914_58592)">
                          <path d="M37.375 34.75C37.375 34.9821 37.2828 35.2046 37.1187 35.3687C36.9546 35.5328 36.7321 35.625 36.5 35.625H15.5C15.2679 35.625 15.0454 35.5328 14.8813 35.3687C14.7172 35.2046 14.625 34.9821 14.625 34.75C14.625 34.5179 14.7172 34.2954 14.8813 34.1313C15.0454 33.9672 15.2679 33.875 15.5 33.875H36.5C36.7321 33.875 36.9546 33.9672 37.1187 34.1313C37.2828 34.2954 37.375 34.5179 37.375 34.75ZM37.375 18.125V30.375C37.375 30.8391 37.1906 31.2842 36.8624 31.6124C36.5342 31.9406 36.0891 32.125 35.625 32.125H16.375C15.9109 32.125 15.4658 31.9406 15.1376 31.6124C14.8094 31.2842 14.625 30.8391 14.625 30.375V18.125C14.625 17.6609 14.8094 17.2158 15.1376 16.8876C15.4658 16.5594 15.9109 16.375 16.375 16.375H35.625C36.0891 16.375 36.5342 16.5594 36.8624 16.8876C37.1906 17.2158 37.375 17.6609 37.375 18.125ZM29.9375 24.25C29.9375 24.1094 29.9035 23.9709 29.8386 23.8462C29.7737 23.7215 29.6797 23.6143 29.5645 23.5336L25.1895 20.4711C25.0584 20.3793 24.9047 20.3251 24.7449 20.3146C24.5852 20.3041 24.4257 20.3376 24.2837 20.4115C24.1417 20.4854 24.0226 20.5968 23.9396 20.7336C23.8565 20.8704 23.8125 21.0274 23.8125 21.1875V27.3125C23.8125 27.4726 23.8565 27.6296 23.9396 27.7664C24.0226 27.9032 24.1417 28.0146 24.2837 28.0885C24.4257 28.1624 24.5852 28.1959 24.7449 28.1854C24.9047 28.1749 25.0584 28.1207 25.1895 28.0289L29.5645 24.9664C29.6797 24.8857 29.7737 24.7785 29.8386 24.6538C29.9035 24.5291 29.9375 24.3906 29.9375 24.25Z" fill="#F9FAFB"/>
                        </g>
                        <defs>
                          <clipPath id="clip0_914_58592">
                            <rect width="28" height="28" fill="white" transform="translate(12 12)"/>
                          </clipPath>
                        </defs>
                      </svg>
                    </div>
                    <div className="relative flex-1 min-w-0">
                      <FileText className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#9291A5]" />
                      <input
                        placeholder="Digite o nome do curso aqui"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        aria-label="Título do curso"
                        aria-describedby="titleHelpCurso"
                        className="h-[38px] w-full min-w-0 rounded-[8px] border border-[#E3E4E5] bg-white pl-10 pr-4 text-[14px] text-[#1E1B39] placeholder:text-[#9AA0A6] focus:border-[#0047BB] focus:outline-none focus:ring-2 focus:ring-[#0047BB]/20"
                      />
                    </div>
                  </div>
                  <p id="titleHelpCurso" className="mt-2 flex items-center gap-1 text-[12px] text-[#9291A5]">
                    <Info className="h-4 w-4" /> Este título aparece na capa e nas listagens.
                  </p>
                </div>

                {/* A seguir permanece o conteúdo existente (selector de cursos, categorias, descrição, módulos, etc.) */}
            </div>
          {/* Editor-only blocks (course selection, categories, description) */}
          <div className="space-y-6">
          <div className="mb-6 rounded-[4px] border border-[#E3E4E5] bg-white p-4 overflow-visible">
                <div className="mb-6">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex-shrink-0 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="12" viewBox="0 0 14 12" fill="none">
                      <path d="M13.5 0H9.5C8.96957 0 8.46086 0.210714 8.08579 0.585786C7.71071 0.960859 7.5 1.46957 7.5 2V7.48312C7.50174 7.61216 7.45455 7.73707 7.36794 7.83273C7.28132 7.92839 7.1617 7.9877 7.03312 7.99875C6.96473 8.00329 6.89614 7.99372 6.8316 7.97064C6.76706 7.94755 6.70795 7.91144 6.65796 7.86455C6.60796 7.81766 6.56814 7.76099 6.54097 7.69806C6.51379 7.63514 6.49985 7.56729 6.5 7.49875V2C6.5 1.46957 6.28929 0.960859 5.91421 0.585786C5.53914 0.210714 5.03043 0 4.5 0H0.5C0.367392 0 0.240215 0.0526785 0.146447 0.146447C0.0526784 0.240215 0 0.367392 0 0.5V9.5C0 9.63261 0.0526784 9.75979 0.146447 9.85355C0.240215 9.94732 0.367392 10 0.5 10H5C5.39718 10 5.77814 10.1575 6.05934 10.438C6.34053 10.7185 6.49901 11.0991 6.5 11.4963C6.498 11.5983 6.5277 11.6985 6.58501 11.783C6.64232 11.8676 6.72442 11.9322 6.82 11.9681C6.89588 11.9974 6.97776 12.0077 7.05853 11.9982C7.1393 11.9887 7.21653 11.9596 7.28352 11.9135C7.35052 11.8674 7.40525 11.8056 7.44297 11.7336C7.48069 11.6615 7.50027 11.5813 7.5 11.5C7.5 11.1022 7.65804 10.7206 7.93934 10.4393C8.22064 10.158 8.60218 10 9 10H13.5C13.6326 10 13.7598 9.94732 13.8536 9.85355C13.9473 9.75979 14 9.63261 14 9.5V0.5C14 0.367392 13.9473 0.240215 13.8536 0.146447C13.7598 0.0526785 13.6326 0 13.5 0ZM12 7.5H9.51688C9.38784 7.50174 9.26293 7.45455 9.16727 7.36794C9.07161 7.28132 9.01229 7.1617 9.00125 7.03312C8.99671 6.96473 9.00628 6.89613 9.02936 6.8316C9.05245 6.76706 9.08856 6.70795 9.13545 6.65796C9.18234 6.60796 9.23901 6.56814 9.30194 6.54097C9.36486 6.51379 9.43271 6.49985 9.50125 6.5H11.9844C12.1134 6.49826 12.2383 6.54545 12.334 6.63206C12.4296 6.71868 12.489 6.8383 12.5 6.96688C12.5045 7.03527 12.495 7.10387 12.4719 7.1684C12.4488 7.23294 12.4127 7.29205 12.3658 7.34204C12.3189 7.39204 12.2622 7.43186 12.1993 7.45903C12.1364 7.48621 12.0685 7.50015 12 7.5ZM12 5.5H9.51688C9.38784 5.50174 9.26293 5.45455 9.16727 5.36794C9.07161 5.28132 9.01229 5.1617 9.00125 5.03312C8.99671 4.96473 9.00628 4.89614 9.02936 4.8316C9.05245 4.76706 9.08856 4.70795 9.13545 4.65796C9.18234 4.60796 9.23901 4.56814 9.30194 4.54097C9.36486 4.51379 9.43271 4.49985 9.50125 4.5H11.9844C12.1134 4.49826 12.2383 4.54545 12.334 4.63206C12.4296 4.71868 12.489 4.8383 12.5 4.96688C12.5045 5.03527 12.495 5.10387 12.4719 5.1684C12.4488 5.23294 12.4127 5.29205 12.3658 5.34204C12.3189 5.39204 12.2622 5.43186 12.1993 5.45903C12.1364 5.48621 12.0685 5.50015 12 5.5ZM12 3.5H9.51688C9.38763 3.50206 9.26241 3.45502 9.16648 3.36837C9.07055 3.28172 9.01106 3.16192 9 3.03312C8.99546 2.96473 9.00503 2.89614 9.02811 2.8316C9.0512 2.76706 9.08731 2.70795 9.1342 2.65796C9.18109 2.60796 9.23776 2.56814 9.30069 2.54097C9.36361 2.51379 9.43146 2.49985 9.5 2.5H11.9831C12.1124 2.49794 12.2376 2.54498 12.3335 2.63163C12.4294 2.71828 12.4889 2.83808 12.5 2.96688C12.5045 3.03527 12.495 3.10386 12.4719 3.1684C12.4488 3.23294 12.4127 3.29205 12.3658 3.34204C12.3189 3.39204 12.2622 3.43186 12.1993 3.45903C12.1364 3.48621 12.0685 3.50015 12 3.5Z" fill="#6B7588"/>
                    </svg>
                    <span className="text-[14px] font-normal text-[#737780]">Curso:</span>
                  </div>
                  <div className="flex-1 flex items-center min-w-0">
                    <div className="relative dropdown-container">
                      <button type="button" disabled={isLoadingAvailableCourses} className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors disabled:opacity-60 disabled:hover:bg-transparent" title="Adicionar curso" aria-haspopup="menu" aria-expanded={showCourseSelector} aria-controls="courseSelectorMenu" style={{ background: 'none' }} onClick={() => setShowCourseSelector((v) => !v)}>
                        <Plus className="w-4 h-4 text-gray-600" />
                      </button>
                      <TaxonomyDropdown
                        open={showCourseSelector}
                        onOpenChange={setShowCourseSelector}
                        items={courseItems}
                        isSelected={(item) => selectedCourses.some((c) => c.id === String(item.id))}
                        onSelect={(item) => {
                          addCourse({ id: String(item.id), name: item.name })
                          setShowCourseSelector(false)
                        }}
                        searchPlaceholder="Pesquisar cursos..."
                        createLabel="Criar novo curso"
                        defaultColor="#6B7588"
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-[12px] text-[#9291A5]">Cursos que serão vinculados:</div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <div className="flex flex-wrap gap-2">
                    {selectedCourses.map((course) => (
                      <span key={`inline-${course.id}`} className="inline-flex items-center gap-1 rounded bg-[#EEF2FF] text-[#1D4ED8] px-2 py-0.5 text-[12px]">
                        <span className="h-2 w-2 rounded-[4px] inline-block" style={{ backgroundColor: '#6B7588' }} />
                        {course.name}
                        <button type="button" className="text-[#6B7280]" onClick={() => removeCourse(course.id)}>
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
                </div>
                <div className="mb-8">
                  <div className="flex items-center gap-4">
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
                          onClick={() => setShowCourseCategorySelector((v) => !v)}
                          aria-haspopup="menu"
                          aria-expanded={showCourseCategorySelector}
                          aria-controls="categorySelectorMenuPrimary"
                        >
                          <Plus className="w-4 h-4 text-gray-600" />
                        </button>
                        <TaxonomyDropdown
                          open={showCourseCategorySelector}
                          onOpenChange={setShowCourseCategorySelector}
                          items={courseCategoryItems}
                          isSelected={(item) => selectedCategories.includes(item.name)}
                          onSelect={(item) => {
                            addCourseCategory(item.name)
                            setShowCourseCategorySelector(false)
                          }}
                          onCreate={createCourseCategoryFromPayload}
                          onUpdate={updateCourseCategoryFromPayload}
                          onDelete={deleteCourseCategoryById}
                          searchPlaceholder="Pesquisar categorias..."
                          createLabel="Criar nova categoria"
                          defaultColor="#8B5CF6"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="mt-1 text-[12px] text-[#9291A5]">Categorias que serão vinculadas:</div>
                </div>
                <div className={isInfoSectionExpanded ? "" : "hidden"}>
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  {/* Campo de entrada de Categoria removido */}
                  <div className="flex flex-wrap gap-2">
                    {selectedCategories.map((c, idx) => (
                      <span key={`${c}-${idx}`} className="inline-flex items-center gap-1 rounded bg-[#EEF2FF] text-[#1D4ED8] px-2 py-0.5 text-[12px]">
                        <span className="h-2 w-2 rounded-[4px] inline-block" style={{ backgroundColor: (courseCategoryMeta[c]?.color || '#D1D5DB') }} />
                        {c}
                        <button className="text-[#6B7280]" onClick={() => removeCourseCategory(idx)}>&times;</button>
                      </span>
                    ))}
                  </div>
                </div>
                <div className="mb-8">
                  <div className="flex items-center gap-4">
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
                          aria-haspopup="menu"
                          aria-expanded={showCourseSubcategorySelector}
                          aria-controls="subcategorySelectorMenu"
                          style={{ background: 'none' }}
                          onClick={() => setShowCourseSubcategorySelector((v) => !v)}
                        >
                          <Plus className="w-4 h-4 text-gray-600" />
                        </button>
                        <TaxonomyDropdown
                          open={showCourseSubcategorySelector}
                          onOpenChange={setShowCourseSubcategorySelector}
                          items={courseSubcategoryItems}
                          isSelected={(item) => selectedSubcategories.includes(item.name)}
                          onSelect={(item) => {
                            addCourseSubcategory(item.name)
                            setShowCourseSubcategorySelector(false)
                          }}
                          onCreate={createCourseSubcategoryFromPayload}
                          onUpdate={updateCourseSubcategoryFromPayload}
                          onDelete={deleteCourseSubcategoryById}
                          searchPlaceholder="Pesquisar subcategorias..."
                          createLabel="Criar nova subcategoria"
                          defaultColor="#10B981"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="mt-1 text-[12px] text-[#9291A5]">Subcategorias que serão vinculadas:</div>
                </div>
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  {/* Campo de entrada de Subcategoria removido */}
                  <div className="flex flex-wrap gap-2">
                    {selectedSubcategories.map((s, idx) => (
                      <span key={`${s}-${idx}`} className="inline-flex items-center gap-1 rounded bg-[#F3F4F6] text-[#374151] px-2 py-0.5 text-[12px]">
                        <span className="h-2 w-2 rounded-[4px] inline-block" style={{ backgroundColor: (courseSubcategoryMeta[s]?.color || '#D1D5DB') }} />
                        {s}
                        <button className="text-[#6B7280]" onClick={() => removeCourseSubcategory(idx)}>&times;</button>
                      </span>
                    ))}
                  </div>
                </div>
                <div className="mb-8 mt-2 flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <img src="/icons/tag-popup.svg" alt="Tags" width={14} height={14} className="text-gray-600" />
                    <span className="text-[14px] font-normal text-[#737780]">Tags:</span>
                    <div className="relative dropdown-container">
                      <button
                        type="button"
                        className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
                        title="Adicionar tag"
                        aria-haspopup="menu"
                        aria-expanded={showCourseTagSelector}
                        aria-controls="tagSelectorMenu"
                        style={{ background: 'none' }}
                        onClick={() => setShowCourseTagSelector((v) => !v)}
                      >
                        <Plus className="w-4 h-4 text-gray-600" />
                      </button>
                      <TaxonomyDropdown
                        open={showCourseTagSelector}
                        onOpenChange={setShowCourseTagSelector}
                        items={courseTagItems}
                        isSelected={(item) => selectedTags.includes(item.name)}
                        onSelect={(item) => {
                          addCourseTag(item.name)
                          setShowCourseTagSelector(false)
                        }}
                        onCreate={createCourseTagFromPayload}
                        onUpdate={updateCourseTagFromPayload}
                        onDelete={deleteCourseTagById}
                        searchPlaceholder="Pesquisar tags..."
                        createLabel="Criar nova tag"
                        defaultColor="#0EA5E9"
                      />
                    </div>
                  </div>
                  <div className="mt-1 text-[12px] text-[#9291A5]">Tags que serão vinculadas:</div>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {/* Campo de entrada de Tag removido */}
                    <div className="flex flex-wrap gap-2">
                      {selectedTags.map((t, idx) => (
                        <span key={`${t}-${idx}`} className="inline-flex items-center gap-1 rounded bg-[#FEF9C3] text-[#92400E] px-2 py-0.5 text-[12px]">
                          <span className="h-2 w-2 rounded-[4px] inline-block" style={{ backgroundColor: (courseTagMeta[t]?.color || '#D1D5DB') }} />
                          {t}
                          <button className="text-[#6B7280]" onClick={() => removeCourseTag(idx)}>&times;</button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              <div className="mt-6">
                <label className="text-[12px] font-medium text-[#737780]">Descrição</label>
                <textarea className="mt-1 w-full rounded-[4px] border border-[#E3E4E5] bg-white p-3 text-[12px] text-[#1E1B39] placeholder:text-[#ABADB3] focus:border-[#0047BB] focus:outline-none" rows={3} placeholder="Descreva o objetivo e conteúdo do curso..." value={description} onChange={(e) => setDescription(e.target.value)}></textarea>
                <div className="mt-3 flex items-center justify-end">
                  {!isAdvanceButtonHidden('conteudo_avancar') && (
                    <Button
                      className="h-8 px-3 text-[12px]"
                      onClick={() => { 
                      if (!canAdvanceToModules) {
                        toast({
                          title: 'Preencha os campos obrigatórios',
                          description: missingToAdvance.join(', '),
                          variant: 'destructive' as any,
                        })
                        return
                      }

                      hideAdvanceButton('conteudo_avancar')
                      concluirEtapa('conteudo')
                      setIsModulesSectionExpanded(true)
                      setTimeout(() => {
                        modulesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      }, 100)
                      }}
                      title={canAdvanceToModules ? 'Avançar' : `Preencha: ${missingToAdvance.join(', ')}`}
                    >
                      Avançar
                    </Button>
                  )}
                </div>
              </div>
            </div>
            </div>

            <div ref={modulesSectionRef} className={`hidden overflow-hidden rounded-[8px] border border-[#E3E4E5] bg-white ${!phaseDone.conteudo ? 'opacity-50 grayscale pointer-events-none' : ''}`}>
                <div className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={!phaseDone.conteudo}
                      className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-[#F3F4F6] transition-colors disabled:cursor-not-allowed"
                      title={isModulesSectionExpanded ? 'Minimizar' : 'Expandir'}
                      onClick={() => setIsModulesSectionExpanded(prev => !prev)}
                    >
                      <ChevronDown className={`h-4 w-4 text-[#6B7280] transition-transform ${isModulesSectionExpanded ? 'rotate-180' : ''}`} />
                    </button>
                    <div>
                      <h2 className="text-[16px] font-bold text-[#1E1B39]">1.2 Módulos do curso</h2>
                      <p className="text-[12px] text-[#737780]">Organize seu conteúdo em módulos estruturados</p>
                    </div>
                  </div>
                  {isModulesSectionExpanded && (
                    <Button
                      className="bg-[#0047BB] hover:bg-[#003a99] gap-2"
                      onClick={() => {
                        setNewModuleCoverImage(null)
                        setNewModuleCoverFile(null)
                        if (newModuleCoverInputRef.current) newModuleCoverInputRef.current.value = ''
                        setShowModuleForm(true)
                      }}
                    >
                      <Plus className="h-4 w-4" />
                      Criar módulo
                    </Button>
                  )}
                </div>
              </div>

              {isModulesSectionExpanded ? (
              <>
              {modules.length === 0 ? (
                <div className="px-6 pb-8">
                  <div className="mx-auto mt-6 max-w-md text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#EEF2FF]">
                      <Plus className="h-6 w-6 text-[#0047BB]" />
                    </div>
                    <div className="text-[14px] font-semibold text-[#1E1B39]">Crie seu primeiro módulo</div>
                    <div className="mt-1 text-[12px] text-[#9291A5]">Organize seu conteúdo em módulos para facilitar o aprendizado dos seus alunos</div>

                    <div className="mt-6 rounded-[8px] border border-[#D6E4FF] bg-[#F5F9FF] p-4 text-left">
                      <div className="flex items-start gap-2">
                        <Info className="h-4 w-4 text-[#0047BB]" />
                        <div>
                          <div className="text-[12px] font-semibold text-[#1E1B39]">Dica Importante!</div>
                          <div className="text-[12px] text-[#737780]">Comece criando módulos temáticos. Cada módulo pode conter várias aulas relacionadas ao mesmo tópico médico para melhor organização do conhecimento.</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="px-6 pb-6">
                  <ul className="space-y-3">
                    {modules.map((m) => (
                      <li key={m.id} className="rounded-[8px] border border-[#E3E4E5] bg-white p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className="h-10 w-10 rounded-[8px] bg-[#5B4DEA] flex items-center justify-center">
                              <Folder className="h-5 w-5 text-white" />
                            </div>
                            <div>
                              <div className="text-[13px] font-semibold text-[#1E1B39]">{m.name}</div>
                              <div className="text-[12px] text-[#737780]">{m.description}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center rounded-full bg-[#F3F4F6] px-2.5 py-1 text-[12px] text-[#737780]">{m.lessonsCount} Aulas</span>
                            <button className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-[#F3F4F6]" title="Excluir" onClick={() => setModules(modules.filter((x) => x.id !== m.id))}>
                              <Trash2 className="h-4 w-4 text-[#6B7280]" />
                            </button>
                            <button
                              className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-[#F3F4F6]"
                              title="Opções"
                              onClick={() => {
                                setExpandedModules((prev) =>
                                  prev.includes(m.id) ? prev.filter((id) => id !== m.id) : [...prev, m.id]
                                )
                              }}
                            >
                              <ChevronDown className="h-4 w-4 text-[#6B7280]" />
                            </button>
                          </div>
                        </div>
                        {expandedModules.includes(m.id) && (
                          m.lessonsCount > 0 ? (
                            <div className="mt-3">
                              {editingModuleId === m.id && editingLessonId ? (
                                <div ref={editorRef} className="rounded-[8px] border border-[#E3E4E5] bg-[#FBFCFF] p-4 mt-0">
                                  <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                      <span className="inline-flex h-7 w-7 items-center justify-center rounded bg-[#EEF2FF]">
                                        <Play className="h-4 w-4 text-[#0047BB]" />
                                      </span>
                                      <span className="text-[14px] font-semibold text-[#1E1B39]">Editar aula</span>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                      <label className="text-[12px] font-medium text-[#737780]">Título da aula*</label>
                                      <input
                                        ref={lessonTitleRef}
                                        className="mt-1 w-full rounded-[8px] border border-[#E3E4E5] bg-white px-3 py-2 text-[13px]"
                                        value={m.lessons.find((l) => l.id === editingLessonId)?.title ?? ''}
                                        placeholder="Digite o título da aula"
                                        onChange={(e) => updateLessonField(m.id, editingLessonId!, 'title', e.target.value)}
                                      />
                                    </div>
                                    <div className="col-span-2">
                                      <label className="text-[12px] font-medium text-[#737780]">Descrição*</label>
                                      <input
                                        className="mt-1 w-full rounded-[8px] border border-[#E3E4E5] bg-white px-3 py-2 text-[13px]"
                                        value={m.lessons.find((l) => l.id === editingLessonId)?.description ?? ''}
                                        placeholder="Digite uma descrição para a sua aula"
                                        onChange={(e) => updateLessonField(m.id, editingLessonId!, 'description', e.target.value)}
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[12px] font-medium text-[#737780]">Duração (minuto)*</label>
                                      <input
                                        type="number"
                                        min={0}
                                        className="mt-1 w-full rounded-[8px] border border-[#E3E4E5] bg-white px-3 py-2 text-[13px]"
                                        value={m.lessons.find((l) => l.id === editingLessonId)?.durationMin ?? 0}
                                        onChange={(e) => updateLessonField(m.id, editingLessonId!, 'durationMin', Number(e.target.value))}
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[12px] font-medium text-[#737780]">Visibilidade*</label>
                                      <select
                                        className="mt-1 w-full rounded-[8px] border border-[#E3E4E5] bg-white px-3 py-2 text-[13px]"
                                        value={m.lessons.find((l) => l.id === editingLessonId)?.visibility ?? 'Gratuita'}
                                        onChange={(e) => updateLessonField(m.id, editingLessonId!, 'visibility', e.target.value as Lesson['visibility'])}
                                      >
                                        <option value="Gratuita">Gratuita</option>
                                        <option value="Gratuita para alunos do curso">Gratuita para alunos do curso</option>
                                        <option value="Paga">Paga</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="text-[12px] font-medium text-[#737780]">Tag</label>
                                      <select
                                        className="mt-1 w-full rounded-[8px] border border-[#E3E4E5] bg-white px-3 py-2 text-[13px]"
                                        value={m.lessons.find((l) => l.id === editingLessonId)?.tag ?? 'Anatomia'}
                                        onChange={(e) => updateLessonField(m.id, editingLessonId!, 'tag', e.target.value)}
                                      >
                                        <option>Anatomia</option>
                                        <option>Cardiologia</option>
                                        <option>Diagnóstico</option>
                                        <option>Geral</option>
                                      </select>
                                    </div>
                                  </div>
                                  <div className="mt-4 space-y-3 text-[12px]">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[#737780]">Categoria:</span>
                                      <input
                                        className="h-7 w-40 rounded-[8px] border border-[#E3E4E5] bg-white px-2"
                                        placeholder="+ Categoria"
                                        value={newCategory}
                                        onChange={(e) => setNewCategory(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') { addToken('categories', newCategory); setNewCategory('') } }}
                                      />
                                      <div className="flex flex-wrap gap-2">
                                        {(m.lessons.find((l) => l.id === editingLessonId)?.categories ?? []).map((c, idx) => (
                                          <span key={idx} className="inline-flex items-center gap-1 rounded bg-[#EEF2FF] text-[#1D4ED8] px-2 py-0.5">
                                            {c} <button className="text-[#6B7280]" onClick={() => removeToken('categories', idx)}>&times;</button>
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[#737780]">Subcategoria:</span>
                                      <input
                                        className="h-7 w-40 rounded-[8px] border border-[#E3E4E5] bg-white px-2"
                                        placeholder="+ Subcategoria"
                                        value={newSubcategory}
                                        onChange={(e) => setNewSubcategory(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') { addToken('subcategories', newSubcategory); setNewSubcategory('') } }}
                                      />
                                      <div className="flex flex-wrap gap-2">
                                        {(m.lessons.find((l) => l.id === editingLessonId)?.subcategories ?? []).map((c, idx) => (
                                          <span key={idx} className="inline-flex items-center gap-1 rounded bg-[#F3F4F6] text-[#374151] px-2 py-0.5">
                                            {c} <button className="text-[#6B7280]" onClick={() => removeToken('subcategories', idx)}>&times;</button>
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[#737780]">Tags:</span>
                                      <input
                                        className="h-7 w-32 rounded-[8px] border border-[#E3E4E5] bg-white px-2"
                                        placeholder="+ Tag"
                                        value={newTag}
                                        onChange={(e) => setNewTag(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') { addToken('extraTags', newTag); setNewTag('') } }}
                                      />
                                      <div className="flex flex-wrap gap-2">
                                        {(m.lessons.find((l) => l.id === editingLessonId)?.extraTags ?? []).map((t, idx) => (
                                          <span key={idx} className="inline-flex items-center gap-1 rounded bg-[#FEF9C3] text-[#92400E] px-2 py-0.5">
                                            Tag <span className="mx-1">{t}</span> <button className="text-[#6B7280]" onClick={() => removeToken('extraTags', idx)}>&times;</button>
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="mt-4 flex items-center justify-end gap-3">
                                    <Button variant="outline" onClick={() => { setEditingModuleId(null); setEditingLessonId(null) }}>Cancelar</Button>
                                    <Button className="bg-[#0047BB] hover:bg-[#003a99]" onClick={() => { setEditingModuleId(null); setEditingLessonId(null) }}>Concluir</Button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <ul className="divide-y divide-[#E3E4E5]">
                                    {m.lessons.map((lesson) => (
                                      <li key={lesson.id} className="flex items-center justify-between py-3">
                                        <div className="flex items-center gap-3">
                                          <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-[#EEF2FF]">
                                            <Play className="h-3.5 w-3.5 text-[#0047BB]" />
                                          </span>
                                          <div>
                                            <div className="text-[13px] font-semibold text-[#1E1B39]">{lesson.title}</div>
                                            <div className="flex items-center gap-3 text-[12px] text-[#737780]">
                                              <span className="inline-flex items-center gap-1">
                                                <Timer className="h-3.5 w-3.5 text-[#6B7280]" /> {lesson.durationMin} min
                                              </span>
                                              <span className="inline-flex items-center gap-1">
                                                <Lock className="h-3.5 w-3.5 text-[#6B7280]" /> {lesson.visibility}
                                              </span>
                                              <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 ${tagClass(lesson.tag)}`}>
                                                <TagIcon className="h-3.5 w-3.5" /> {lesson.tag}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <button
                                            className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-[#F3F4F6]"
                                            title="Editar"
                                            onClick={() => startEditingLesson(m, lesson)}
                                          >
                                            <Pencil className="h-4 w-4 text-[#6B7280]" />
                                          </button>
                                          <button
                                            className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-[#F3F4F6]"
                                            title="Excluir"
                                            onClick={() => {
                                              setModules(modules.map((x) => x.id === m.id
                                                ? { ...x, lessons: x.lessons.filter((l) => l.id !== lesson.id), lessonsCount: Math.max(0, x.lessonsCount - 1) }
                                                : x
                                              ))
                                            }}
                                          >
                                            <Trash2 className="h-4 w-4 text-[#6B7280]" />
                                          </button>
                                        </div>
                                       </li>
                                     ))}
                                  </ul>
                                  <div className="mt-3 grid grid-cols-2 gap-2">
                                    <Button
                                      type="button"
                                      className="bg-[#0047BB] hover:bg-[#003a99]"
                                      onClick={() => {
                                        setEditingModuleId(m.id);
                                        setIsAddLessonModalOpen(true);
                                        toast({ title: "Nova aula", description: "Abrindo modal de criação de aula." })
                                      }}
                                    >
                                      Adicionar Aula
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      onClick={() => {
                                        openLessonLibrary(m.id)
                                        toast({ title: "Biblioteca de aulas", description: "Selecione uma aula existente para reutilizar." })
                                      }}
                                    >
                                      Usar Aula Existente
                                    </Button>
                                  </div>
                                </>
                              )}
                            </div>
                          ) : (
                            <>
                              {editingModuleId === m.id && editingLessonId ? (
                                <div ref={editorRef} className="mt-4 rounded-[8px] border border-[#E3E4E5] bg-[#FBFCFF] p-4">
                                  <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                      <span className="inline-flex h-7 w-7 items-center justify-center rounded bg-[#EEF2FF]">
                                        <Play className="h-4 w-4 text-[#0047BB]" />
                                      </span>
                                      <span className="text-[14px] font-semibold text-[#1E1B39]">Nova aula</span>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                      <label className="text-[12px] font-medium text-[#737780]">Título da aula*</label>
                                      <input
                                        ref={lessonTitleRef}
                                        className="mt-1 w-full rounded-[8px] border border-[#E3E4E5] bg-white px-3 py-2 text-[13px]"
                                        value={m.lessons.find((l) => l.id === editingLessonId)?.title ?? ''}
                                        placeholder="Digite o título da aula"
                                        onChange={(e) => updateLessonField(m.id, editingLessonId!, 'title', e.target.value)}
                                      />
                                    </div>
                                    <div className="col-span-2">
                                      <label className="text-[12px] font-medium text-[#737780]">Descrição*</label>
                                      <input
                                        className="mt-1 w-full rounded-[8px] border border-[#E3E4E5] bg-white px-3 py-2 text-[13px]"
                                        value={m.lessons.find((l) => l.id === editingLessonId)?.description ?? ''}
                                        placeholder="Digite uma descrição para a sua aula"
                                        onChange={(e) => updateLessonField(m.id, editingLessonId!, 'description', e.target.value)}
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[12px] font-medium text-[#737780]">Duração (minuto)*</label>
                                      <input
                                        type="number"
                                        min={0}
                                        className="mt-1 w-full rounded-[8px] border border-[#E3E4E5] bg-white px-3 py-2 text-[13px]"
                                        value={m.lessons.find((l) => l.id === editingLessonId)?.durationMin ?? 0}
                                        onChange={(e) => updateLessonField(m.id, editingLessonId!, 'durationMin', Number(e.target.value))}
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[12px] font-medium text-[#737780]">Visibilidade*</label>
                                      <select
                                        className="mt-1 w-full rounded-[8px] border border-[#E3E4E5] bg-white px-3 py-2 text-[13px]"
                                        value={m.lessons.find((l) => l.id === editingLessonId)?.visibility ?? 'Gratuita'}
                                        onChange={(e) => updateLessonField(m.id, editingLessonId!, 'visibility', e.target.value as Lesson['visibility'])}
                                      >
                                        <option value="Gratuita">Gratuita</option>
                                        <option value="Gratuita para alunos do curso">Gratuita para alunos do curso</option>
                                        <option value="Paga">Paga</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="text-[12px] font-medium text-[#737780]">Tag</label>
                                      <select
                                        className="mt-1 w-full rounded-[8px] border border-[#E3E4E5] bg-white px-3 py-2 text-[13px]"
                                        value={m.lessons.find((l) => l.id === editingLessonId)?.tag ?? 'Anatomia'}
                                        onChange={(e) => updateLessonField(m.id, editingLessonId!, 'tag', e.target.value)}
                                      >
                                        <option>Anatomia</option>
                                        <option>Cardiologia</option>
                                        <option>Diagnóstico</option>
                                        <option>Geral</option>
                                      </select>
                                    </div>
                                  </div>
                                  <div className="mt-4 space-y-3 text-[12px]">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[#737780]">Categoria:</span>
                                      <input
                                        className="h-7 w-40 rounded-[8px] border border-[#E3E4E5] bg-white px-2"
                                        placeholder="+ Categoria"
                                        value={newCategory}
                                        onChange={(e) => setNewCategory(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') { addToken('categories', newCategory); setNewCategory('') } }}
                                      />
                                      <div className="flex flex-wrap gap-2">
                                        {(m.lessons.find((l) => l.id === editingLessonId)?.categories ?? []).map((c, idx) => (
                                          <span key={idx} className="inline-flex items-center gap-1 rounded bg-[#EEF2FF] text-[#1D4ED8] px-2 py-0.5">
                                            {c} <button className="text-[#6B7280]" onClick={() => removeToken('categories', idx)}>&times;</button>
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[#737780]">Subcategoria:</span>
                                      <input
                                        className="h-7 w-40 rounded-[8px] border border-[#E3E4E5] bg-white px-2"
                                        placeholder="+ Subcategoria"
                                        value={newSubcategory}
                                        onChange={(e) => setNewSubcategory(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') { addToken('subcategories', newSubcategory); setNewSubcategory('') } }}
                                      />
                                      <div className="flex flex-wrap gap-2">
                                        {(m.lessons.find((l) => l.id === editingLessonId)?.subcategories ?? []).map((c, idx) => (
                                          <span key={idx} className="inline-flex items-center gap-1 rounded bg-[#F3F4F6] text-[#374151] px-2 py-0.5">
                                            {c} <button className="text-[#6B7280]" onClick={() => removeToken('subcategories', idx)}>&times;</button>
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[#737780]">Tags:</span>
                                      <input
                                        className="h-7 w-32 rounded-[8px] border border-[#E3E4E5] bg-white px-2"
                                        placeholder="+ Tag"
                                        value={newTag}
                                        onChange={(e) => setNewTag(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') { addToken('extraTags', newTag); setNewTag('') } }}
                                      />
                                      <div className="flex flex-wrap gap-2">
                                        {(m.lessons.find((l) => l.id === editingLessonId)?.extraTags ?? []).map((t, idx) => (
                                          <span key={idx} className="inline-flex items-center gap-1 rounded bg-[#FEF9C3] text-[#92400E] px-2 py-0.5">
                                            Tag <span className="mx-1">{t}</span> <button className="text-[#6B7280]" onClick={() => removeToken('extraTags', idx)}>&times;</button>
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="mt-4 flex items-center justify-end gap-3">
                                    <Button variant="outline" onClick={() => { setEditingModuleId(null); setEditingLessonId(null) }}>Cancelar</Button>
                                    <Button className="bg-[#0047BB] hover:bg-[#003a99]" onClick={() => { setEditingModuleId(null); setEditingLessonId(null) }}>Concluir</Button>
                                  </div>
                                </div>
                              ) : (
                                <Button
                                  type="button"
                                  className="mt-3 w-full bg-[#0047BB] hover:bg-[#003a99]"
                                  onClick={() => {
                                    setEditingModuleId(m.id);
                                    setIsAddLessonModalOpen(true);
                                    toast({ title: "Nova aula", description: "Abrindo modal de criação de aula." })
                                  }}
                                >
                                  Adicionar Aula
                                </Button>
                              )}
                            </>
                          )
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            }
            {!isAdvanceButtonHidden('aulas_avancar') && (
              <div className="mt-6 flex justify-end">
                <Button
                  className="bg-[#0047BB] hover:bg-[#003a99]"
                  onClick={() => {
                    hideAdvanceButton('aulas_avancar')
                    concluirEtapa('aulas');
                    setIsExtrasSectionExpanded(true);
                    setTimeout(() => {
                      extrasSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 100);
                  }}
                >
                  Avançar
                </Button>
              </div>
            )}
            </>
            ) : null}
            
                        {/* Bloco de botões Avançar/Adicionar Aula removido conforme solicitado */}

                        {/* Modal simples para adicionar aula */}
                        <AlertDialog open={false} onOpenChange={() => {}}>
                          <AlertDialogContent className="w-[95vw] max-w-[720px] max-h-[85vh] overflow-y-auto">
                            <AlertDialogHeader>
                              <AlertDialogTitle>{editingLessonId ? 'Editar aula' : 'Nova aula'}</AlertDialogTitle>
                              <AlertDialogDescription>{editingLessonId ? 'Edite os campos da aula.' : 'Preencha os campos básicos para criar a aula.'}</AlertDialogDescription>
                            </AlertDialogHeader>
                            <div className="space-y-3 pb-64">
                              <div>
                                <label className="text-[12px] font-medium text-[#374151]">Título</label>
                                <input value={newLessonTitle} onChange={(e) => setNewLessonTitle(e.target.value)} className="mt-1 h-9 w-full rounded-[8px] border border-[#E3E4E5] px-3 text-[12px]" placeholder="Digite o título da aula" />
                              </div>
                              <div>
                                <label className="text-[12px] font-medium text-[#374151]">Descrição</label>
                                <textarea value={newLessonDescription} onChange={(e) => setNewLessonDescription(e.target.value)} className="mt-1 w-full rounded-[8px] border border-[#E3E4E5] p-3 text-[12px]" rows={3} placeholder="Digite uma descrição"></textarea>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="text-[12px] font-medium text-[#374151]">Duração (min)</label>
                                  <input type="number" min={1} value={newLessonDurationMin} onChange={(e) => setNewLessonDurationMin(Number(e.target.value))} className="mt-1 h-9 w-full rounded-[8px] border border-[#E3E4E5] px-3 text-[12px]" />
                                </div>
                              <div>
                                  <label className="text-[12px] font-medium text-[#374151]">Visibilidade</label>
                                  <select value={newLessonVisibility} onChange={(e) => setNewLessonVisibility(e.target.value as 'Gratuita' | 'Paga' | 'Gratuita para alunos do curso')} className="mt-1 h-9 w-full rounded-[8px] border border-[#E3E4E5] px-3 text-[12px]">
                                    <option value="Gratuita">Gratuita</option>
                                    <option value="Gratuita para alunos do curso">Gratuita para alunos do curso</option>
                                    <option value="Paga">Paga</option>
                                  </select>
                                </div>
                              </div>

                              {/* Seletor de curso removido conforme solicitado */}

                              {/* Seletores de categorias, subcategorias e tags */}
                              <div className="space-y-4 pt-2">
                                <div>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <img src="/icons/categorias-popup.svg" alt="Categoria" className="w-4 h-4" />
                                      <span className="text-[12px] font-medium text-[#374151]">Categoria:</span>
                                    </div>
                                    <div className="relative dropdown-container overflow-visible" ref={lessonCategoryDropdownRef}>
                                      <button
                                        type="button"
                                        className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
                                        title="Adicionar categoria"
                                        aria-haspopup="menu"
                                        aria-expanded={showLessonCategorySelector}
                                        aria-controls="lessonCategorySelectorMenu"
                                        style={{ background: 'none' }}
                                        aria-label="Adicionar categoria"
                                        onClick={() => setShowLessonCategorySelector((v) => !v)}
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-gray-600"><path d="M5 12h14"></path><path d="M12 5v14"></path></svg>
                                      </button>
                                      {showLessonCategorySelector && (
                                        <div
                                          id="lessonCategorySelectorMenu"
                                          role="menu"
                                          className="absolute right-0 top-full z-50 mt-2 w-[300px] rounded-[8px] border border-[#E3E4E5] bg-white shadow-md"
                                        >
                                          <div className="p-3">
                                            <div className="relative">
                                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9291A5]"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                              <input
                                                value={lessonCategorySearchQuery}
                                                onChange={(e) => setLessonCategorySearchQuery(e.target.value)}
                                                placeholder="Pesquisar categorias..."
                                                className="h-[36px] w-full rounded-[8px] border border-[#E3E4E5] bg-white pl-10 pr-3 text-[12px] text-[#1E1B39] placeholder:text-[#ABADB3] focus:border-[#0047BB] focus:outline-none"
                                                aria-label="Pesquisar categorias"
                                              />
                                            </div>
                                          </div>
                                          <ul className="max-h-48 overflow-auto px-2">
                                            {filteredLessonCategoriesList.map((cat) => {
                                              const meta = courseCategoryMeta[cat] || { desc: "Categoria do banco de questões", color: "#D1D5DB" }
                                              return (
                                                <li
                                                  key={cat}
                                                  role="menuitem"
                                                  tabIndex={0}
                                                  className="flex cursor-pointer items-start justify-between gap-3 rounded-[6px] px-3 py-2 hover:bg-[#F3F4F6]"
                                                  onClick={() => { addLessonCategory(cat); setShowLessonCategorySelector(false) }}
                                                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { addLessonCategory(cat); setShowLessonCategorySelector(false) } }}
                                                >
                                                  <div className="flex items-start gap-2">
                                                    <span className="mt-[6px] h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: meta.color }} />
                                                    <div>
                                                      <div className="text-[12px] font-medium text-[#1E1B39]">{cat}</div>
                                                      <div className="text-[11px] text-[#737780]">{meta.desc}</div>
                                                    </div>
                                                  </div>
                                                  <div className="flex items-center gap-2 text-[#737780]" onClick={(e) => e.stopPropagation()}>
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z"></path></svg>
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path></svg>
                                                  </div>
                                                </li>
                                              )
                                            })}
                                          </ul>
                                          <div className="border-t border-[#E3E4E5] p-3">
                                            {!isCreatingNewLessonCategory ? (
                                              <button type="button" className="flex items-center gap-2 text-[12px] text-[#0047BB] hover:underline" onClick={startInlineLessonCategoryCreation}>
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M5 12h14"></path><path d="M12 5v14"></path></svg> Criar nova categoria
                                              </button>
                                            ) : (
                                              <div className="space-y-2">
                                                <div className="flex items-center gap-2">
                                                  <input
                                                    value={newLessonCategoryName}
                                                    onChange={(e) => setNewLessonCategoryName(e.target.value)}
                                                    placeholder="Nome da nova categoria"
                                                    className="flex-1 rounded-[8px] border border-[#E3E4E5] bg-white px-2 py-1 text-[12px] text-[#1E1B39] placeholder:text-[#ABADB3] outline-none"
                                                    autoFocus
                                                  />
                                                  <input type="color" value={newLessonCategoryColor} onChange={(e) => setNewLessonCategoryColor(e.target.value)} title="Cor da categoria" className="h-7 w-10 rounded-[8px] border border-[#E3E4E5] p-0" />
                                                </div>
                                                <textarea value={newLessonCategoryDescription} onChange={(e) => setNewLessonCategoryDescription(e.target.value)} placeholder="Descrição da categoria (opcional)" className="w-full rounded-[8px] border border-[#E3E4E5] bg-white px-2 py-1 text-[12px] text-[#1E1B39] placeholder:text-[#ABADB3] outline-none" rows={2} />
                                                <div className="flex items-center gap-2">
                                                  <Button size="sm" className="h-7 px-3" onClick={createInlineLessonCategory} disabled={!newLessonCategoryName.trim()}>Criar</Button>
                                                  <Button size="sm" variant="outline" className="h-7 px-3" onClick={cancelInlineLessonCategoryCreation}>Cancelar</Button>
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {newLessonCategories.map((cat) => (
                                      <span key={cat} className="inline-flex items-center gap-2 rounded-[8px] border border-[#E3E4E5] bg-white px-2 py-1 text-[12px]">
                                        {cat}
                                        <button type="button" className="text-[#737780]" onClick={() => setNewLessonCategories(newLessonCategories.filter(c => c !== cat))}>x</button>
                                      </span>
                                    ))}
                                  </div>
                                </div>

                                <div>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <img src="/icons/subcategoria-popup.svg" alt="Subcategoria" className="w-4 h-4" />
                                      <span className="text-[12px] font-medium text-[#374151]">Subcategoria:</span>
                                    </div>
                                    <div className="relative dropdown-container overflow-visible" ref={lessonSubcategoryDropdownRef}>
                                      <button
                                        type="button"
                                        className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
                                        title="Adicionar subcategoria"
                                        aria-haspopup="menu"
                                        aria-expanded={showLessonSubcategorySelector}
                                        aria-controls="lessonSubcategorySelectorMenu"
                                        style={{ background: 'none' }}
                                        aria-label="Adicionar subcategoria"
                                        onClick={() => setShowLessonSubcategorySelector((v) => !v)}
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-gray-600"><path d="M5 12h14"></path><path d="M12 5v14"></path></svg>
                                      </button>
                                      {showLessonSubcategorySelector && (
                                        <div id="lessonSubcategorySelectorMenu" role="menu" className="absolute right-0 top-full z-50 mt-2 w-[300px] rounded-[8px] border border-[#E3E4E5] bg-white shadow-md">
                                          <div className="p-3">
                                            <div className="relative">
                                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9291A5]"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                              <input value={lessonSubcategorySearchQuery} onChange={(e) => setLessonSubcategorySearchQuery(e.target.value)} placeholder="Pesquisar subcategorias..." className="h-[36px] w-full rounded-[8px] border border-[#E3E4E5] bg-white pl-10 pr-3 text-[12px] text-[#1E1B39] placeholder:text-[#ABADB3] focus:border-[#0047BB] focus:outline-none" aria-label="Pesquisar subcategorias" />
                                            </div>
                                          </div>
                                          <ul className="max-h-48 overflow-auto px-2">
                                            {filteredLessonSubcategoriesList.map((sub) => {
                                              const meta = courseSubcategoryMeta[sub] || { desc: "Subcategoria do banco de questões", color: "#D1D5DB" }
                                              return (
                                                <li key={sub} role="menuitem" tabIndex={0} className="flex cursor-pointer items-start justify-between gap-3 rounded-[6px] px-3 py-2 hover:bg-[#F3F4F6]" onClick={() => { addLessonSubcategory(sub); setShowLessonSubcategorySelector(false) }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { addLessonSubcategory(sub); setShowLessonSubcategorySelector(false) } }}>
                                                  <div className="flex items-start gap-2">
                                                    <span className="mt-[6px] h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: meta.color }} />
                                                    <div>
                                                      <div className="text-[12px] font-medium text-[#1E1B39]">{sub}</div>
                                                      <div className="text-[11px] text-[#737780]">{meta.desc}</div>
                                                    </div>
                                                  </div>
                                                  <div className="flex items-center gap-2 text-[#737780]" onClick={(e) => e.stopPropagation()}>
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z"></path></svg>
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path></svg>
                                                  </div>
                                                </li>
                                              )
                                            })}
                                          </ul>
                                          <div className="border-t border-[#E3E4E5] p-3">
                                            {!isCreatingNewLessonSubcategory ? (
                                              <button type="button" className="flex items-center gap-2 text-[12px] text-[#0047BB] hover:underline" onClick={startInlineLessonSubcategoryCreation}>
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M5 12h14"></path><path d="M12 5v14"></path></svg> Criar nova subcategoria
                                              </button>
                                            ) : (
                                              <div className="space-y-2">
                                                <div className="flex items-center gap-2">
                                                  <input value={newLessonSubcategoryName} onChange={(e) => setNewLessonSubcategoryName(e.target.value)} placeholder="Nome da nova subcategoria" className="flex-1 rounded-[8px] border border-[#E3E4E5] bg-white px-2 py-1 text-[12px] text-[#1E1B39] placeholder:text-[#ABADB3] outline-none" autoFocus />
                                                  <input type="color" value={newLessonSubcategoryColor} onChange={(e) => setNewLessonSubcategoryColor(e.target.value)} aria-label="Cor da subcategoria" className="h-7 w-10 rounded-[8px] border border-[#E3E4E5] p-0" />
                                                </div>
                                                <textarea value={newLessonSubcategoryDescription} onChange={(e) => setNewLessonSubcategoryDescription(e.target.value)} placeholder="Descrição da subcategoria (opcional)" className="w-full rounded-[8px] border border-[#E3E4E5] bg-white px-2 py-1 text-[12px] text-[#1E1B39] placeholder:text-[#ABADB3] outline-none" rows={2} />
                                                <div className="flex items-center gap-2">
                                                  <Button size="sm" className="h-7 px-3" onClick={createInlineLessonSubcategory} disabled={!newLessonSubcategoryName.trim()}>Criar</Button>
                                                  <Button size="sm" variant="outline" className="h-7 px-3" onClick={cancelInlineLessonSubcategoryCreation}>Cancelar</Button>
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {newLessonSubcategories.map((sub) => (
                                      <span key={sub} className="inline-flex items-center gap-2 rounded-[8px] border border-[#E3E4E5] bg-white px-2 py-1 text-[12px]">
                                        {sub}
                                        <button type="button" className="text-[#737780]" onClick={() => setNewLessonSubcategories(newLessonSubcategories.filter(s => s !== sub))}>x</button>
                                      </span>
                                    ))}
                                  </div>
                                </div>

                                <div>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <img src="/icons/tag-popup.svg" alt="Tags" className="w-4 h-4" />
                                      <span className="text-[12px] font-medium text-[#374151]">Tags:</span>
                                    </div>
                                    <div className="relative dropdown-container overflow-visible" ref={lessonTagDropdownRef}>
                                      <button
                                        type="button"
                                        className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
                                        title="Adicionar tag"
                                        aria-haspopup="menu"
                                        aria-expanded={showLessonTagSelector}
                                        aria-controls="lessonTagSelectorMenu"
                                        style={{ background: 'none' }}
                                        aria-label="Adicionar tag"
                                        onClick={() => setShowLessonTagSelector((v) => !v)}
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-gray-600"><path d="M5 12h14"></path><path d="M12 5v14"></path></svg>
                                      </button>
                                      {showLessonTagSelector && (
                                        <div id="lessonTagSelectorMenu" role="menu" className="absolute right-0 top-full z-50 mt-2 w-[300px] rounded-[8px] border border-[#E3E4E5] bg-white shadow-md">
                                          <div className="p-3">
                                            <div className="relative">
                                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9291A5]"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                              <input value={lessonTagSearchQuery} onChange={(e) => setLessonTagSearchQuery(e.target.value)} placeholder="Pesquisar tags..." className="h-[36px] w-full rounded-[8px] border border-[#E3E4E5] bg-white pl-10 pr-3 text-[12px] text-[#1E1B39] placeholder:text-[#ABADB3] focus:border-[#0047BB] focus:outline-none" aria-label="Pesquisar tags" />
                                            </div>
                                          </div>
                                          <ul className="max-h-48 overflow-auto px-2">
                                            {filteredLessonTagsList.map((tag) => {
                                              const meta = courseTagMeta[tag] || { desc: "Tag do banco de questões", color: "#D1D5DB" }
                                              return (
                                                <li key={tag} role="menuitem" tabIndex={0} className="flex cursor-pointer items-start justify-between gap-3 rounded-[6px] px-3 py-2 hover:bg-[#F3F4F6]" onClick={() => { addLessonTag(tag); setShowLessonTagSelector(false) }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { addLessonTag(tag); setShowLessonTagSelector(false) } }}>
                                                  <div className="flex items-start gap-2">
                                                    <span className="mt-[6px] h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: meta.color }} />
                                                    <div>
                                                      <div className="text-[12px] font-medium text-[#1E1B39]">{tag}</div>
                                                      <div className="text-[11px] text-[#737780]">{meta.desc}</div>
                                                    </div>
                                                  </div>
                                                  <div className="flex items-center gap-2 text-[#737780]" onClick={(e) => e.stopPropagation()}>
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z"></path></svg>
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path></svg>
                                                  </div>
                                                </li>
                                              )
                                            })}
                                          </ul>
                                          <div className="border-t border-[#E3E4E5] p-3">
                                            {!isCreatingNewLessonTag ? (
                                              <button type="button" className="flex items-center gap-2 text-[12px] text-[#0047BB] hover:underline" onClick={startInlineLessonTagCreation}>
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M5 12h14"></path><path d="M12 5v14"></path></svg> Criar nova tag
                                              </button>
                                            ) : (
                                              <div className="space-y-2">
                                                <div className="flex items-center gap-2">
                                                  <input value={newLessonTagName} onChange={(e) => setNewLessonTagName(e.target.value)} placeholder="Nome da nova tag" className="flex-1 rounded-[8px] border border-[#E3E4E5] bg-white px-2 py-1 text-[12px] text-[#1E1B39] placeholder:text-[#ABADB3] outline-none" autoFocus />
                                                  <input type="color" value={newLessonTagColor} onChange={(e) => setNewLessonTagColor(e.target.value)} className="h-7 w-10 rounded-[8px] border border-[#E3E4E5] p-0" />
                                                </div>
                                                <textarea value={newLessonTagDescription} onChange={(e) => setNewLessonTagDescription(e.target.value)} placeholder="Descrição da tag (opcional)" className="w-full rounded-[8px] border border-[#E3E4E5] bg-white px-2 py-1 text-[12px] text-[#1E1B39] placeholder:text-[#ABADB3] outline-none" rows={2} />
                                                <div className="flex items-center gap-2">
                                                  <Button size="sm" className="h-7 px-3" onClick={createInlineLessonTag} disabled={!newLessonTagName.trim()}>Criar</Button>
                                                  <Button size="sm" variant="outline" className="h-7 px-3" onClick={cancelInlineLessonTagCreation}>Cancelar</Button>
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {newLessonExtraTags.map((tag) => (
                                      <span key={tag} className="inline-flex items-center gap-2 rounded-[8px] border border-[#E3E4E5] bg-white px-2 py-1 text-[12px]">
                                        {tag}
                                        <button type="button" className="text-[#737780]" onClick={() => setNewLessonExtraTags(newLessonExtraTags.filter(t => t !== tag))}>x</button>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              {/* Materiais complementares */}
                              <div className="space-y-2 pt-4">
                                <p className="text-[12px] font-medium text-[#374151]">Materiais complementares</p>
                                <div className="flex items-center flex-wrap gap-2">
                                  <Button type="button" variant="outline" className="gap-2" onClick={() => openMaterialUploader('pdf')}>
                                    <FileText className="h-4 w-4 text-[#9291A5]" />
                                    PDF
                                  </Button>
                                  <Button type="button" variant="outline" className="gap-2" onClick={() => openMaterialUploader('xls')}>
                                    <FileSpreadsheet className="h-4 w-4 text-[#9291A5]" />
                                    Planilha
                                  </Button>
                                  <Button type="button" variant="outline" className="gap-2" onClick={() => openMaterialUploader('doc')}>
                                    <FileText className="h-4 w-4 text-[#9291A5]" />
                                    Documento
                                  </Button>
                                  <Button type="button" variant="outline" className="gap-2" onClick={() => openMaterialUploader('ppt')}>
                                    <FileType className="h-4 w-4 text-[#9291A5]" />
                                    PPT
                                  </Button>
                                  <Button type="button" variant="outline" className="gap-2" onClick={() => openMaterialUploader('link')}>
                                    <LinkIcon className="h-4 w-4 text-[#9291A5]" />
                                    Link
                                  </Button>
                                </div>
                                {/* Uploader oculto para arquivos (PDF/DOC/PPT/XLS) */}
                                <input
                                  ref={materialFileInputRef}
                                  type="file"
                                  className="hidden"
                                  onChange={handleMaterialFileSelected}
                                />
                                {/* Entrada inline para adicionar link */}
                                {showLinkInput && (
                                  <div className="mt-2 flex gap-2">
                                    <input
                                      id="new-material-link-input"
                                      value={newMaterialLinkUrl}
                                      onChange={(e) => setNewMaterialLinkUrl(e.target.value)}
                                      placeholder="https://exemplo.com/recurso"
                                      className="h-9 flex-1 rounded-[8px] border border-[#E3E4E5] px-3 text-[12px]"
                                    />
                                    <Button
                                      type="button"
                                      variant="outline"
                                      onClick={() => {
                                        const url = newMaterialLinkUrl.trim()
                                        if (!url) return
                                        const newItem: LessonMaterial = { id: `mat-${Date.now()}`, name: url, sizeLabel: '', type: 'link' }
                                        setNewLessonMaterials(prev => [...prev, newItem])
                                        setNewMaterialLinkUrl('')
                                        setShowLinkInput(false)
                                      }}
                                    >Adicionar</Button>
                                    <Button type="button" variant="ghost" onClick={() => { setShowLinkInput(false); setNewMaterialLinkUrl('') }}>Cancelar</Button>
                                  </div>
                                )}
                                <div className="space-y-2">
                                  {newLessonMaterials.length === 0 ? (
                                    <div className="text-[12px] text-[#737780]">Nenhum material adicionado.</div>
                                  ) : (
                                    newLessonMaterials.map((m) => (
                                      <div key={m.id} className="flex items-center justify-between rounded-[8px] border border-[#E3E4E5] bg-white px-3 py-2 text-[12px]">
                                        <div className="flex items-center gap-2 min-w-0">
                                          {materialIcon(m.type)}
                                          <span className="text-[#1E1B39] truncate max-w-[420px]" title={m.name}>{m.name}</span>
                                          {m.sizeLabel && m.sizeLabel !== '—' && (
                                            <span className="text-[11px] text-[#737780]">{m.sizeLabel}</span>
                                          )}
                                        </div>
                                        <button type="button" className="text-[#737780] hover:underline" onClick={() => removeModalMaterial(m.id)}>Remover</button>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>

                              {/* Integração de armazenamento de vídeos */}
                              <div className="pt-4">
                                <p className="text-[12px] font-medium text-[#374151]">Integração de armazenamento de videos</p>
                                <div className="mt-2 grid grid-cols-2 gap-3">
                                  <div className={`rounded-[8px] border ${defaultVideoProvider === 'vimeo' ? 'border-[#0047BB]' : 'border-[#E3E4E5]'} bg-white p-3`}>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <img src="/vimeologo.svg" alt="Vimeo" className="h-5" />
                                        <span className="text-[12px]">Vimeo</span>
                                      </div>
                                      <input type="radio" name="provider" checked={defaultVideoProvider === 'vimeo'} onChange={() => setDefaultVideoProvider('vimeo')} />
                                    </div>
                                    <p className="mt-2 text-[11px] text-[#737780]">Selecione para usar Vimeo como provedor de vídeo.</p>
                                    <div className="mt-2 flex items-center justify-end gap-2">
                                      {connectedProviders.vimeo ? (
                                        <span className="inline-flex items-center gap-1 text-[12px] text-[#166534]"><Check className="h-3 w-3" /> Conectado</span>
                                      ) : (
                                        <>
                                          <Button type="button" size="sm" variant="outline" className="h-7 px-3" onClick={async () => { await reloadVimeoSettings(); setIsVimeoSettingsOpen(true) }}>Configurar</Button>
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className={`h-7 px-3 ${!isVimeoConfigured ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            disabled={!isVimeoConfigured}
                                            onClick={async () => { await reloadVimeoSettings(); handleConnectService('vimeo') }}
                                          >
                                            Conectar
                                          </Button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  <div className={`rounded-[8px] border ${defaultVideoProvider === 'vdocipher' ? 'border-[#0047BB]' : 'border-[#E3E4E5]'} bg-white p-3`}>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <img src="/vdologo.svg" alt="VdoCipher" className="h-5" />
                                        <span className="text-[12px]">VdoCipher</span>
                                      </div>
                                      <input type="radio" name="provider" checked={defaultVideoProvider === 'vdocipher'} onChange={() => setDefaultVideoProvider('vdocipher')} />
                                    </div>
                                    <p className="mt-2 text-[11px] text-[#737780]">Selecione para usar VdoCipher como provedor de vídeo.</p>
                                    <div className="mt-2 flex items-center justify-end gap-2">
                                      {connectedProviders.vdocipher ? (
                                        <>
                                          <span className="inline-flex items-center gap-1 text-[12px] text-[#166534]"><Check className="h-3 w-3" /> Conectado</span>
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className="h-7 px-3"
                                            onClick={handleVdoDisconnect}
                                          >
                                            Desconectar
                                          </Button>
                                        </>
                                      ) : (
                                        <>
                                          <Button type="button" size="sm" variant="outline" className="h-7 px-3" onClick={async () => { await reloadVdoSettings(); setIsVdoSettingsOpen(true) }}>Configurar</Button>
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className={`h-7 px-3 ${!isVdoConfigured ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            disabled={!isVdoConfigured}
                                            onClick={async () => { await reloadVdoSettings(); handleConnectService('vdocipher') }}
                                          >
                                            Conectar
                                          </Button>
                                        </>
                                      )}
                                    </div>
                                    {connectedProviders.vdocipher && (
                                      <div className="mt-2 rounded-[8px] border border-[#E3E4E5] bg-[#FBFCFF] p-2">
                                        <div className="flex items-center gap-2 mb-2">
                                          <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-[#EEF2FF]">
                                            <DownloadCloud className="h-3.5 w-3.5 text-[#0047BB]" />
                                          </span>
                                          <span className="text-[12px] font-semibold text-[#1E1B39]">Upload direto para VdoCipher</span>
                                        </div>
                                        <div className="grid grid-cols-1 gap-2">
                                          <div>
                                            <label className="text-[11px] text-[#6B7280]">Arquivo (MP4/Mov)</label>
                                            <input
                                              className="mt-1 w-full rounded-[8px] border border-[#E3E4E5] bg-white px-3 py-1.5 text-[12px]"
                                              type="file"
                                              accept="video/*"
                                              onChange={(e) => setVdoUploadFile(e.target.files?.[0] ?? null)}
                                            />
                                          </div>
                                        </div>
                                        <div className="mt-2 flex items-center justify-end">
                                          <Button
                                            className="h-8 px-3 bg-[#0047BB] hover:bg-[#003a99] text-white"
                                            type="button"
                                            disabled={isVdoUploading}
                                            onClick={handleVdoUpload}
                                          >
                                            {isVdoUploading ? (
                                              <span className="inline-flex items-center gap-2">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Enviando...
                                              </span>
                                            ) : 'Enviar vídeo'}
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <AlertDialogFooter>
                              <AlertDialogCancel onClick={() => { setIsAddLessonModalOpen(false); setEditingLessonId(null); setEditingModuleId(null); }}>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => {
                                let selectedModuleId = editingModuleId ?? modules[0]?.id
                                if (!selectedModuleId) {
                                  const modId = `mod-${Date.now()}`
                                  setModules([{ id: modId, name: 'Módulo 1', description: '', lessonsCount: 0, lessons: [] }])
                                  selectedModuleId = modId
                                }
                                
                                const lessonData: Lesson = {
                                  id: editingLessonId ?? String(Date.now()),
                                  title: newLessonTitle || 'Nova aula',
                                  description: newLessonDescription || '',
                                  durationMin: newLessonDurationMin || 15,
                                  visibility: newLessonVisibility,
                                  tag: newLessonExtraTags.length ? newLessonExtraTags[0] : '',
                                  categories: newLessonCategories,
                                  subcategories: newLessonSubcategories,
                                  extraTags: newLessonExtraTags,
                                  videoProvider: defaultVideoProvider,
                                  materials: newLessonMaterials,
                                }

                                if (editingLessonId) {
                                  setModules(modules.map((m) => {
                                    if (m.id !== selectedModuleId) return m;
                                    return {
                                      ...m,
                                      lessons: m.lessons.map(l => l.id === editingLessonId ? lessonData : l)
                                    }
                                  }))
                                } else {
                                  setModules(modules.map((x) => x.id === selectedModuleId ? { ...x, lessons: [...x.lessons, lessonData], lessonsCount: x.lessonsCount + 1 } : x))
                                }

              setIsAddLessonModalOpen(false)
              setEditingLessonId(null)
              setEditingModuleId(null)

              setNewLessonTitle('Nova aula')
              setNewLessonDescription('')
              setNewLessonDurationMin(15)
              setNewLessonVisibility('Gratuita')
              setNewLessonPrice('')
              setNewLessonCategories(['Categoria'])
              setNewLessonSubcategories(['Subcategoria'])
              setNewLessonExtraTags(['Tag'])
              setNewLessonMaterials([])
                                setModalNewCategory('')
                                setModalNewSubcategory('')
                                setModalNewTagExtra('')
                                setIsExtrasSectionExpanded(true)
                                setTimeout(() => {
                                  extrasSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                                }, 0)
                              }}>Salvar</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>


                      {/* Lista de aulas do módulo selecionado */}
                      {(() => {
                        const selectedId = editingModuleId ?? modules[0]?.id
                        const mod = modules.find((m) => m.id === selectedId)
                        if (!mod) return (
                          <div className="rounded-[8px] border border-[#E3E4E5] bg-white p-4 text-[12px] text-[#737780]">Nenhum módulo encontrado. Crie um módulo na etapa de Conteúdo.</div>
                        )
                        return null
                      })()}

                      {/* Editor de aula simplificado */}
                      {editingModuleId && editingLessonId && (() => {
                        const mod = modules.find((m) => m.id === editingModuleId)
                        if (!mod) return null
                        return (
                          <div ref={editorRef} className="rounded-[8px] border border-[#E3E4E5] bg-[#FBFCFF] p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <span className="inline-flex h-7 w-7 items-center justify-center rounded bg-[#EEF2FF]">
                                  <Play className="h-4 w-4 text-[#0047BB]" />
                                </span>
                                <span className="text-[14px] font-semibold text-[#1E1B39]">Editar aula</span>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="col-span-2">
                                <label className="text-[12px] font-medium text-[#737780]">Título da aula*</label>
                                <input ref={lessonTitleRef} className="mt-1 w-full rounded-[8px] border border-[#E3E4E5] bg-white px-3 py-2 text-[13px]" value={mod.lessons.find((l) => l.id === editingLessonId)?.title ?? ''} placeholder="Digite o título da aula" onChange={(e) => updateLessonField(mod.id, editingLessonId!, 'title', e.target.value)} />
                              </div>
                              <div className="col-span-2">
                                <label className="text-[12px] font-medium text-[#737780]">Descrição*</label>
                                <input className="mt-1 w-full rounded-[8px] border border-[#E3E4E5] bg-white px-3 py-2 text-[13px]" value={mod.lessons.find((l) => l.id === editingLessonId)?.description ?? ''} placeholder="Digite uma descrição para a sua aula" onChange={(e) => updateLessonField(mod.id, editingLessonId!, 'description', e.target.value)} />
                              </div>
                              <div>
                                <label className="text-[12px] font-medium text-[#737780]">Duração (minuto)*</label>
                                <input type="number" min={0} className="mt-1 w-full rounded-[8px] border border-[#E3E4E5] bg-white px-3 py-2 text-[13px]" value={mod.lessons.find((l) => l.id === editingLessonId)?.durationMin ?? 0} onChange={(e) => updateLessonField(mod.id, editingLessonId!, 'durationMin', Number(e.target.value))} />
                              </div>
                              <div>
                                <label className="text-[12px] font-medium text-[#737780]">Visibilidade*</label>
                                <select className="mt-1 w-full rounded-[8px] border border-[#E3E4E5] bg-white px-3 py-2 text-[13px]" value={mod.lessons.find((l) => l.id === editingLessonId)?.visibility ?? 'Gratuita'} onChange={(e) => updateLessonField(mod.id, editingLessonId!, 'visibility', e.target.value as Lesson['visibility'])}>
                                  <option value="Gratuita">Gratuita</option>
                                  <option value="Gratuita para alunos do curso">Gratuita para alunos do curso</option>
                                  <option value="Paga">Paga</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-[12px] font-medium text-[#737780]">Provedor de vídeo</label>
                                <select className="mt-1 w-full rounded-[8px] border border-[#E3E4E5] bg-white px-3 py-2 text-[13px]" value={mod.lessons.find((l) => l.id === editingLessonId)?.videoProvider ?? defaultVideoProvider} onChange={(e) => updateLessonField(mod.id, editingLessonId!, 'videoProvider', e.target.value as Lesson['videoProvider'])}>
                                  <option value="vdocipher">VdoCipher</option>
                                  <option value="vimeo">Vimeo</option>
                                  <option value="upload">Upload</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-[12px] font-medium text-[#737780]">Tag</label>
                                <select className="mt-1 w-full rounded-[8px] border border-[#E3E4E5] bg-white px-3 py-2 text-[13px]" value={mod.lessons.find((l) => l.id === editingLessonId)?.tag ?? 'Anatomia'} onChange={(e) => updateLessonField(mod.id, editingLessonId!, 'tag', e.target.value)}>
                                  <option>Anatomia</option>
                                  <option>Cardiologia</option>
                                  <option>Diagnóstico</option>
                                  <option>Geral</option>
                                </select>
                              </div>
                            </div>
                            <div className="mt-4 space-y-3 text-[12px]">
                              <div className="flex items-center gap-2">
                                <span className="text-[#737780]">Categoria:</span>
                                {/* input de categoria removido */}
                                <div className="flex flex-wrap gap-2">
                                  {(mod.lessons.find((l) => l.id === editingLessonId)?.categories ?? []).map((c, idx) => (
                                    <span key={idx} className="inline-flex items-center gap-1 rounded bg-[#EEF2FF] text-[#1D4ED8] px-2 py-0.5">
                                      {c} <button className="text-[#6B7280]" onClick={() => removeToken('categories', idx)}>&times;</button>
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[#737780]">Subcategoria:</span>
                                {/* input de subcategoria removido */}
                                <div className="flex flex-wrap gap-2">
                                  {(mod.lessons.find((l) => l.id === editingLessonId)?.subcategories ?? []).map((c, idx) => (
                                    <span key={idx} className="inline-flex items-center gap-1 rounded bg-[#F3F4F6] text-[#374151] px-2 py-0.5">
                                      {c} <button className="text-[#6B7280]" onClick={() => removeToken('subcategories', idx)}>&times;</button>
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[#737780]">Tags:</span>
                                {/* input de tag removido */}
                                <div className="flex flex-wrap gap-2">
                                  {(mod.lessons.find((l) => l.id === editingLessonId)?.extraTags ?? []).map((t, idx) => (
                                    <span key={idx} className="inline-flex items-center gap-1 rounded bg-[#FEF9C3] text-[#92400E] px-2 py-0.5">
                                      Tag <span className="mx-1">{t}</span> <button className="text-[#6B7280]" onClick={() => removeToken('extraTags', idx)}>&times;</button>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                            <div className="mt-4 flex items-center justify-end gap-3">
                              <Button variant="outline" onClick={() => { setEditingModuleId(null); setEditingLessonId(null) }}>Cancelar</Button>
                              <Button className="bg-[#0047BB] hover:bg-[#003a99]" onClick={() => { setEditingModuleId(null); setEditingLessonId(null) }}>Concluir</Button>
                            </div>
                          </div>
                        )
                      })()}


            </div>

            {/* 1.4 Recursos extras (etapa separada) */}
            <div id="section-resources" ref={extrasSectionRef} className={`hidden mt-8 overflow-hidden rounded-[8px] border border-[#E3E4E5] bg-white ${!phaseDone.aulas ? 'opacity-50 grayscale pointer-events-none' : ''}`}>
              <div className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={!phaseDone.aulas}
                    className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-[#F3F4F6] transition-colors disabled:cursor-not-allowed"
                    title={isExtrasSectionExpanded ? 'Minimizar' : 'Expandir'}
                    onClick={() => setIsExtrasSectionExpanded(prev => !prev)}
                  >
                    <ChevronDown className={`h-4 w-4 text-[#6B7280] transition-transform ${isExtrasSectionExpanded ? 'rotate-180' : ''}`} />
                  </button>
                  <div>
                    <h2 className="text-[16px] font-bold text-[#1E1B39]">1.4 Recursos extras</h2>
                    <p className="text-[12px] text-[#737780]">Adicione materiais complementares ao seu curso</p>
                  </div>
                </div>
                {isExtrasSectionExpanded && (
                  <div />
                )}
              </div>

              {isExtrasSectionExpanded ? (
                <div className="px-6 pb-6">

                  {/* Conteúdo de Recursos e Anexos embutido nesta seção */}
                  <div className="bg-white rounded-[10px] border border-[#E3E4E5] p-5 mt-6">
                    <div className="rounded-[8px] bg-gradient-to-br from-[#F8FAFF] to-[#EEF2FF] border border-[#C7D2FE] p-4 mb-4">
                      <div className="text-[13px] font-semibold text-[#1E1B39] mb-1">O que fazer nesta etapa</div>
                      <ul className="list-disc pl-5 text-[12px] text-[#737780] space-y-1">
                        <li>Conecte simulados e bancos de questões.</li>
                        <li>Adicione recursos globais do curso ou específicos por módulo/aula.</li>
                        <li>Revise os recursos conectados na lista abaixo.</li>
                      </ul>
                    </div>

                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-[16px] font-bold text-[#1E1B39]">Recursos e Anexos</h2>
                        <p className="text-[12px] text-[#737780]">Conecte simulados e bancos de questões ao seu curso</p>
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-3 gap-4 mb-6">
                      <div className="rounded-[8px] border border-[#E3E4E5] bg-white p-4">
                        <div className="h-10 w-10 rounded-[8px] bg-[#EEF2FF] flex items-center justify-center">
                          <img src="/simulado-cover.svg" alt="" className="h-5 w-5" />
                        </div>
                        <div className="mt-2 text-[13px] font-semibold text-[#1E1B39]">Simulados</div>
                        <div className="text-[12px] text-[#737780]">Bancos de questões e simulados</div>
                        <Button variant="outline" className="px-4 py-2 mt-3 h-8" onClick={() => openSimuladoSelector('curso')}>Adicionar recursos</Button>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="rounded-[8px] border border-[#E3E4E5] bg-white">
                        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[#E3E4E5]">
                          <span className="text-[13px] font-semibold">Recursos do Curso</span>
                          <div className="flex items-center gap-2">
                            <select
                              className="h-8 rounded-[6px] border border-[#E3E4E5] bg-white px-2 text-[12px] outline-none focus:border-[#0047BB]"
                              value={courseMaterialAddType}
                              onChange={(e) => setCourseMaterialAddType(e.target.value as any)}
                            >
                              <option value="pdf">PDF</option>
                              <option value="doc">DOC</option>
                              <option value="ppt">PPT</option>
                              <option value="xls">XLS</option>
                              <option value="link">Link</option>
                            </select>
                            <Button variant="outline" className="px-3 py-2 h-8" onClick={() => openExtraMaterialUploader({ scope: 'curso' }, courseMaterialAddType)}>Adicionar</Button>
                            <Button variant="outline" className="px-3 py-2 h-8" onClick={() => openResourceLibrary({ scope: 'curso' })}>Biblioteca</Button>
                          </div>
                        </div>
                        {(selectedSimulados.filter(s => !s.scope || s.scope === 'curso').length > 0 || (Array.isArray(courseMaterials) && courseMaterials.length > 0)) ? (
                          <div className="p-4 space-y-2">
                            {selectedSimulados.filter(s => !s.scope || s.scope === 'curso').map((sim, idx) => (
                              <div key={idx} className="flex items-center justify-between rounded border border-[#E3E4E5] p-2">
                                <div className="flex items-center gap-2">
                                  <div className="h-8 w-8 rounded bg-[#F3F4F6] flex items-center justify-center">
                                    <img src="/simulado-cover.svg" alt="" className="h-4 w-4" />
                                  </div>
                                  <div>
                                    <div className="text-[12px] font-medium text-[#1E1B39]">{sim.title}</div>
                                    <div className="text-[11px] text-[#737780]">{sim.questionsCount} questões • <span className="text-[#0047BB] font-medium">{sim.priceLabel}</span></div>
                                  </div>
                                </div>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setSelectedSimulados(prev => prev.filter(s => s !== sim))}>
                                  <Trash2 className="h-4 w-4 text-[#EF4444]" />
                                </Button>
                              </div>
                            ))}
                            {Array.isArray(courseMaterials) ? courseMaterials.map((mat, idx) => (
                              <div key={`course-mat-${String(mat?.id || idx)}`} className="flex items-center justify-between rounded border border-[#E3E4E5] p-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="h-8 w-8 rounded bg-[#F3F4F6] flex items-center justify-center">
                                    {materialIcon(mat.type)}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="text-[12px] font-medium text-[#1E1B39] truncate">{mat.name}</div>
                                    <div className="text-[11px] text-[#737780]">
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded ${materialColor(mat.type)}`}>{String(mat.type).toUpperCase()}</span>
                                      {mat.sizeLabel ? <span className="ml-2">{mat.sizeLabel}</span> : null}
                                    </div>
                                  </div>
                                </div>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => removeCourseMaterial(String(mat?.id || ''))}>
                                  <Trash2 className="h-4 w-4 text-[#EF4444]" />
                                </Button>
                              </div>
                            )) : null}
                          </div>
                        ) : (
                          <div className="p-4 text-[12px] text-[#737780]">Nenhum recurso adicionado. Use os cartões acima para conectar.</div>
                        )}
                      </div>
                      <div className="rounded-[8px] border border-[#E3E4E5] bg-white">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E3E4E5]">
                          <span className="text-[13px] font-semibold">Recursos por módulo</span>
                          <div className="flex items-center gap-2">
                            <select
                              className="h-8 rounded-[6px] border border-[#E3E4E5] bg-white px-2 text-[12px] min-w-[150px] outline-none focus:border-[#0047BB]"
                              value={resourceViewModuleId || ''}
                              onChange={(e) => setResourceViewModuleId(e.target.value || null)}
                            >
                              <option value="">Selecione o módulo</option>
                              {modules.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                              ))}
                            </select>
                            <select
                              className="h-8 rounded-[6px] border border-[#E3E4E5] bg-white px-2 text-[12px] outline-none focus:border-[#0047BB]"
                              value={moduleMaterialAddType}
                              onChange={(e) => setModuleMaterialAddType(e.target.value as any)}
                              disabled={!resourceViewModuleId}
                            >
                              <option value="pdf">PDF</option>
                              <option value="doc">DOC</option>
                              <option value="ppt">PPT</option>
                              <option value="xls">XLS</option>
                              <option value="link">Link</option>
                            </select>
                            <Button
                              variant="outline"
                              className="px-3 py-2 h-8"
                              disabled={!resourceViewModuleId}
                              onClick={() => openExtraMaterialUploader({ scope: 'modulo', moduleId: resourceViewModuleId }, moduleMaterialAddType)}
                            >
                              Adicionar
                            </Button>
                            <Button
                              variant="outline"
                              className="px-3 py-2 h-8"
                              disabled={!resourceViewModuleId}
                              onClick={() => openResourceLibrary({ scope: 'modulo', moduleId: resourceViewModuleId })}
                            >
                              Biblioteca
                            </Button>
                          </div>
                        </div>
                        {resourceViewModuleId ? (
                          (selectedSimulados.filter(s => s.scope === 'modulo' && s.moduleId === resourceViewModuleId).length > 0
                            || (Array.isArray(modules.find(m => m.id === resourceViewModuleId)?.materials) && (modules.find(m => m.id === resourceViewModuleId)?.materials?.length || 0) > 0)
                          ) ? (
                            <div className="p-4 space-y-2">
                              {selectedSimulados.filter(s => s.scope === 'modulo' && s.moduleId === resourceViewModuleId).map((sim, idx) => (
                                <div key={idx} className="flex items-center justify-between rounded border border-[#E3E4E5] p-2">
                                  <div className="flex items-center gap-2">
                                    <div className="h-8 w-8 rounded bg-[#F3F4F6] flex items-center justify-center">
                                      <img src="/simulado-cover.svg" alt="" className="h-4 w-4" />
                                    </div>
                                    <div>
                                      <div className="text-[12px] font-medium text-[#1E1B39]">{sim.title}</div>
                                      <div className="text-[11px] text-[#737780]">Módulo: {modules.find(m => m.id === sim.moduleId)?.name || 'N/A'} • <span className="text-[#0047BB] font-medium">{sim.priceLabel}</span></div>
                                    </div>
                                  </div>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setSelectedSimulados(prev => prev.filter(s => s !== sim))}>
                                    <Trash2 className="h-4 w-4 text-[#EF4444]" />
                                  </Button>
                                </div>
                              ))}
                              {(modules.find(m => m.id === resourceViewModuleId)?.materials || []).map((mat: any, idx: number) => (
                                <div key={`mod-mat-${String(mat?.id || idx)}`} className="flex items-center justify-between rounded border border-[#E3E4E5] p-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="h-8 w-8 rounded bg-[#F3F4F6] flex items-center justify-center">
                                      {materialIcon(mat.type)}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="text-[12px] font-medium text-[#1E1B39] truncate">{mat.name}</div>
                                      <div className="text-[11px] text-[#737780]">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded ${materialColor(mat.type)}`}>{String(mat.type).toUpperCase()}</span>
                                        {mat.sizeLabel ? <span className="ml-2">{mat.sizeLabel}</span> : null}
                                      </div>
                                    </div>
                                  </div>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => removeModuleMaterial(resourceViewModuleId, String(mat?.id || ''))}>
                                    <Trash2 className="h-4 w-4 text-[#EF4444]" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="p-4 text-[12px] text-[#737780]">Nenhum recurso adicionado a este módulo.</div>
                          )
                        ) : (
                          <div className="p-4 text-[12px] text-[#737780]">Selecione um módulo para visualizar.</div>
                        )}
                      </div>

                      <div className="rounded-[8px] border border-[#E3E4E5] bg-white">
                        <div className="flex flex-col gap-3 px-4 py-3 border-b border-[#E3E4E5]">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[13px] font-semibold">Recursos por aula</span>
                            <div className="flex items-center gap-2">
                              <select
                                className="h-8 rounded-[6px] border border-[#E3E4E5] bg-white px-2 text-[12px] outline-none focus:border-[#0047BB]"
                                value={lessonMaterialAddType}
                                onChange={(e) => setLessonMaterialAddType(e.target.value as any)}
                                disabled={!resourceViewLessonMeta}
                              >
                                <option value="pdf">PDF</option>
                                <option value="doc">DOC</option>
                                <option value="ppt">PPT</option>
                                <option value="xls">XLS</option>
                                <option value="link">Link</option>
                              </select>
                              <Button
                                variant="outline"
                                className="px-3 py-2 h-8"
                                disabled={!resourceViewLessonMeta}
                                onClick={() => openExtraMaterialUploader({ scope: 'aula', moduleId: resourceViewLessonMeta?.moduleId, lessonId: resourceViewLessonId }, lessonMaterialAddType)}
                              >
                                Adicionar
                              </Button>
                              <Button
                                variant="outline"
                                className="px-3 py-2 h-8"
                                disabled={!resourceViewLessonMeta}
                                onClick={() => openResourceLibrary({ scope: 'aula', moduleId: resourceViewLessonMeta?.moduleId, lessonId: resourceViewLessonId })}
                              >
                                Biblioteca
                              </Button>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <select 
                              className="flex-1 h-8 rounded-[6px] border border-[#E3E4E5] bg-white px-2 text-[12px] outline-none focus:border-[#0047BB]"
                              value={resourceViewLessonId || ''}
                              onChange={(e) => setResourceViewLessonId(e.target.value || null)}
                            >
                              <option value="">Selecione a aula</option>
                              {modules.flatMap(m => m.lessons.map(l => ({...l, moduleName: m.name}))).map(l => (
                                <option key={l.id} value={l.id}>{l.title} ({l.moduleName})</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        {resourceViewLessonId ? (
                          (selectedSimulados.filter(s => s.scope === 'aula' && s.lessonId === resourceViewLessonId).length > 0
                            || (Array.isArray(resourceViewLessonMeta?.lesson?.materials) && (resourceViewLessonMeta?.lesson?.materials?.length || 0) > 0)
                          ) ? (
                            <div className="p-4 space-y-2">
                              {selectedSimulados.filter(s => s.scope === 'aula' && s.lessonId === resourceViewLessonId).map((sim, idx) => (
                                <div key={idx} className="flex items-center justify-between rounded border border-[#E3E4E5] p-2">
                                  <div className="flex items-center gap-2">
                                    <div className="h-8 w-8 rounded bg-[#F3F4F6] flex items-center justify-center">
                                      <img src="/simulado-cover.svg" alt="" className="h-4 w-4" />
                                    </div>
                                    <div>
                                      <div className="text-[12px] font-medium text-[#1E1B39]">{sim.title}</div>
                                      <div className="text-[11px] text-[#737780]">Aula: {modules.find(m => m.id === sim.moduleId)?.lessons.find(l => l.id === sim.lessonId)?.title || 'N/A'} • <span className="text-[#0047BB] font-medium">{sim.priceLabel}</span></div>
                                    </div>
                                  </div>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setSelectedSimulados(prev => prev.filter(s => s !== sim))}>
                                    <Trash2 className="h-4 w-4 text-[#EF4444]" />
                                  </Button>
                                </div>
                              ))}
                              {(resourceViewLessonMeta?.lesson?.materials || []).map((mat: any, idx: number) => (
                                <div key={`lesson-mat-${String(mat?.id || idx)}`} className="flex items-center justify-between rounded border border-[#E3E4E5] p-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="h-8 w-8 rounded bg-[#F3F4F6] flex items-center justify-center">
                                      {materialIcon(mat.type)}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="text-[12px] font-medium text-[#1E1B39] truncate">{mat.name}</div>
                                      <div className="text-[11px] text-[#737780]">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded ${materialColor(mat.type)}`}>{String(mat.type).toUpperCase()}</span>
                                        {mat.sizeLabel ? <span className="ml-2">{mat.sizeLabel}</span> : null}
                                      </div>
                                    </div>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={() => removeLessonMaterialFromList(String(resourceViewLessonMeta?.moduleId || ''), String(resourceViewLessonId || ''), String(mat?.id || ''))}
                                  >
                                    <Trash2 className="h-4 w-4 text-[#EF4444]" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="p-4 text-[12px] text-[#737780]">Nenhum recurso adicionado a esta aula.</div>
                          )
                        ) : (
                          <div className="p-4 text-[12px] text-[#737780]">Selecione uma aula para visualizar.</div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {!isAdvanceButtonHidden('recursos_avancar_inline') && (
                    <div className="mt-6 flex justify-end">
                      <Button
                        className="bg-[#0047BB] hover:bg-[#003a99]"
                        onClick={() => {
                          hideAdvanceButton('recursos_avancar_inline')
                          setPhaseDone(prev => ({ ...prev, recursos: true }));
                          setIsStudentAreaSectionExpanded(true);
                          setTimeout(() => document.getElementById('section-student-area')?.scrollIntoView({ behavior: 'smooth' }), 100);
                        }}
                      >
                        Avançar
                      </Button>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            {/* 2 Área do aluno (texto com subseção) */}
            <div id="section-student-area" className={`hidden mt-8 overflow-hidden rounded-[8px] border border-[#E3E4E5] bg-white ${!phaseDone.recursos ? 'opacity-50 grayscale pointer-events-none' : ''}`}>
              <div className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={!phaseDone.recursos}
                    className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-[#F3F4F6] transition-colors disabled:cursor-not-allowed"
                    title={isStudentAreaSectionExpanded ? 'Minimizar' : 'Expandir'}
                    onClick={() => setIsStudentAreaSectionExpanded(prev => !prev)}
                  >
                    <ChevronDown className={`h-4 w-4 text-[#6B7280] transition-transform ${isStudentAreaSectionExpanded ? 'rotate-180' : ''}`} />
                  </button>
                  <div>
      <h2 className="text-[16px] font-bold text-[#1E1B39]">1.5 Área do aluno</h2>
                    <p className="text-[12px] text-[#737780]">Configurações e personalização da experiência do aluno</p>
                  </div>
                </div>
              </div>

              {isStudentAreaSectionExpanded ? (
                <div className="px-6 pb-6">
                  <div className="rounded-[8px] border border-[#D6E4FF] bg-[#F5F9FF] p-4">
                    <div className="text-[13px] font-semibold text-[#1E1B39]">1 Personalização visual</div>
                    <div className="mt-1 text-[12px] text-[#737780]">Ajuste cores, logotipo e elementos visuais da área do aluno.</div>
                  </div>

                  {/* Conteúdo de Personalização visual embutido */}
                  <div className="bg-white rounded-[10px] border border-[#E3E4E5] p-5 mt-6">
                    {/* Bloco didático */}
                    <div className="rounded-[8px] bg-gradient-to-br from-[#F8FAFF] to-[#EEF2FF] border border-[#C7D2FE] p-4 mb-4">
                      <div className="text-[13px] font-semibold text-[#1E1B39] mb-1">O que fazer nesta etapa</div>
                      <ul className="list-disc pl-5 text-[12px] text-[#737780] space-y-1">
                        <li>Envie uma imagem de capa e vídeo de apresentação.</li>
                        <li>Ajuste as cores do tema para combinar com sua marca.</li>
                      </ul>
                    </div>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-[16px] font-bold text-[#1E1B39]">Personalização visual do curso</h2>
                        <p className="text-[12px] text-[#737780]">Configure capa, vídeo, cores e página de vendas</p>
                      </div>
                    </div>
                    <div className="space-y-6">
                      <div className="rounded-[8px] border border-[#E3E4E5] bg-white p-4">
                        <div className="text-[13px] font-semibold mb-2">Banner da página do curso</div>
                        <label
                          className={`relative rounded-[8px] border border-dashed border-[#C7D2FE] bg-[#F8FAFF] ${coverImage ? 'p-0' : 'p-8'} text-center text-[12px] text-[#737780] cursor-pointer hover:bg-[#EEF2FF] transition-colors overflow-hidden flex items-center justify-center min-h-[100px]`}
                          onDragOver={(e) => { e.preventDefault() }}
                          onDrop={(e) => {
                            e.preventDefault()
                            const file = e.dataTransfer.files?.[0]
                            if (file) setCoverImageFromFile(file)
                          }}
                        >
                          {coverImage ? (
                            <>
                              <img src={coverImage} alt="Banner" className="w-full h-auto max-h-[300px] object-cover" />
                              <button
                                type="button"
                                onClick={handleRemoveCoverImage}
                                className="absolute top-2 right-2 p-1 bg-white/80 rounded-full hover:bg-white text-red-500 transition-colors z-10"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            "Arraste sua imagem aqui ou clique para selecionar"
                          )}
                          <input
                            ref={coverImageInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleCoverImageUpload}
                          />
                        </label>
                        <div className="mt-2 text-[11px] text-[#737780]">Tamanho recomendado: 1200×600 px (JPG/PNG). Máx. 5MB.</div>
                        <div className="mt-3 flex items-center justify-between">
                          <button
                            type="button"
                            className="text-[12px] font-medium text-[#0047BB] hover:underline"
                            onClick={() => setIsCoverGalleryOpen((v) => !v)}
                          >
                            {isCoverGalleryOpen ? 'Ocultar sugestões' : 'Escolher uma capa pronta'}
                          </button>
                        </div>
                        {isCoverGalleryOpen ? (
                          <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2">
                            {medicalCourseCoverOptions.map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                className="relative rounded-[8px] overflow-hidden border border-[#E3E4E5] bg-white hover:border-[#0047BB] transition-colors"
                                onClick={() => applyCourseCoverFromGallery(opt.src)}
                                title={opt.label}
                              >
                                <img src={opt.src} alt={opt.label} className="h-[64px] w-full object-cover" />
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="rounded-[8px] border border-[#E3E4E5] bg-white p-4">
                        <div className="text-[13px] font-semibold mb-2">Vídeo da página do curso</div>
                        <label
                          className={`relative rounded-[8px] border border-dashed border-[#C7D2FE] bg-[#F8FAFF] ${promoVideo ? 'p-0' : 'p-8'} text-center text-[12px] text-[#737780] cursor-pointer hover:bg-[#EEF2FF] transition-colors overflow-hidden flex items-center justify-center min-h-[100px]`}
                          onDragOver={(e) => { e.preventDefault() }}
                          onDrop={(e) => {
                            e.preventDefault()
                            const file = e.dataTransfer.files?.[0]
                            if (file) setPromoVideoFromFile(file)
                          }}
                        >
                          {promoVideo ? (
                            <>
                              <video
                                src={promoVideo}
                                className="w-full h-auto max-h-[300px]"
                                controls
                                onClick={(e) => e.stopPropagation()}
                              />
                              <button
                                type="button"
                                onClick={handleRemovePromoVideo}
                                className="absolute top-2 right-2 p-1 bg-white/80 rounded-full hover:bg-white text-red-500 transition-colors z-10"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            "Arraste seu vídeo aqui ou clique para selecionar"
                          )}
                          <input
                            ref={promoVideoInputRef}
                            type="file"
                            accept="video/*"
                            className="hidden"
                            onChange={handlePromoVideoUpload}
                          />
                        </label>
                      </div>
                      
                      <div className="rounded-[8px] border border-[#E3E4E5] bg-white p-4">
                        <div className="text-[13px] font-semibold mb-3">Cores do tema</div>
                        <div className="grid sm:grid-cols-3 gap-4 mb-6">
                          <div className="space-y-1">
                            <label className="text-[12px] text-[#737780]">Cor do texto</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                className="h-10 w-10 rounded-[8px] border border-[#E3E4E5] p-1 cursor-pointer"
                                value={themeTextColor}
                                onChange={(e) => setThemeTextColor(e.target.value)}
                              />
                              <span className="text-[12px] text-[#374151] font-mono uppercase">{themeTextColor}</span>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[12px] text-[#737780]">Botão principal</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                className="h-10 w-10 rounded-[8px] border border-[#E3E4E5] p-1 cursor-pointer"
                                value={themeButtonPrimaryColor}
                                onChange={(e) => setThemeButtonPrimaryColor(e.target.value)}
                              />
                              <span className="text-[12px] text-[#374151] font-mono uppercase">{themeButtonPrimaryColor}</span>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[12px] text-[#737780]">Botão secundário</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                className="h-10 w-10 rounded-[8px] border border-[#E3E4E5] p-1 cursor-pointer"
                                value={themeButtonSecondaryColor}
                                onChange={(e) => setThemeButtonSecondaryColor(e.target.value)}
                              />
                              <span className="text-[12px] text-[#374151] font-mono uppercase">{themeButtonSecondaryColor}</span>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[12px] text-[#737780]">Cor de fundo da página</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                className="h-10 w-10 rounded-[8px] border border-[#E3E4E5] p-1 cursor-pointer"
                                value={themePageBackgroundColor}
                                onChange={(e) => setThemePageBackgroundColor(e.target.value)}
                              />
                              <span className="text-[12px] text-[#374151] font-mono uppercase">{themePageBackgroundColor}</span>
                            </div>
                          </div>
                        </div>
                        <div className="border-t border-[#E3E4E5] pt-4">
                          <div className="text-[12px] font-medium text-[#737780] mb-3">Pré-visualização</div>
                          <div className="rounded-[8px] border border-[#E3E4E5] p-4 max-w-[260px] space-y-3" style={{ backgroundColor: themePageBackgroundColor }}>
                            <div className="text-[12px] text-[#9CA3AF]">Botão principal</div>
                            <Button style={{ backgroundColor: themeButtonPrimaryColor, borderColor: themeButtonPrimaryColor, color: themeTextColor }} className="w-full hover:opacity-90 transition-opacity">
                              Botão Principal
                            </Button>
                            <div className="text-[12px] text-[#9CA3AF]">Botão secundário</div>
                            <Button style={{ backgroundColor: themeButtonSecondaryColor, borderColor: themeButtonSecondaryColor, color: themeTextColor }} className="w-full hover:opacity-90 transition-opacity">
                              Botão Secundário
                            </Button>
                          </div>
                        </div>
                      </div>
                      
                    </div>
                  </div>

                  {!isAdvanceButtonHidden('visual_avancar_inline') && (
                    <div className="mt-6 flex justify-end">
                      <Button
                        className="bg-[#0047BB] hover:bg-[#003a99]"
                        onClick={() => {
                          hideAdvanceButton('visual_avancar_inline')
                          concluirEtapa('visual');
                          setIsSettingsSectionExpanded(true);
                          setTimeout(() => document.getElementById('section-settings')?.scrollIntoView({ behavior: 'smooth' }), 100);
                        }}
                      >
                        Avançar
                      </Button>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            {/* 3 CONFIGURAÇÕES (texto com subseções) */}
            <div id="section-settings" className={`hidden mt-8 overflow-hidden rounded-[8px] border border-[#E3E4E5] bg-white ${!phaseDone.visual ? 'opacity-50 grayscale pointer-events-none' : ''}`}>
              <div className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={!phaseDone.visual}
                    className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-[#F3F4F6] transition-colors disabled:cursor-not-allowed"
                    title={isSettingsSectionExpanded ? 'Minimizar' : 'Expandir'}
                    onClick={() => setIsSettingsSectionExpanded(prev => !prev)}
                  >
                    <ChevronDown className={`h-4 w-4 text-[#6B7280] transition-transform ${isSettingsSectionExpanded ? 'rotate-180' : ''}`} />
                  </button>
                  <div>
      <h2 className="text-[16px] font-bold text-[#1E1B39]">1.6 Configurações</h2>
                    <p className="text-[12px] text-[#737780]">Defina preços, planos e parâmetros de publicação</p>
                  </div>
                </div>
              </div>

              {isSettingsSectionExpanded ? (
                <div className="px-6 pb-6">
                  <div className="rounded-[8px] border border-[#D6E4FF] bg-[#F5F9FF] p-4 space-y-3">
                    <div>
                      <div className="text-[13px] font-semibold text-[#1E1B39]">1.1 Monetização / Publicação</div>
                      <div className="mt-1 text-[12px] text-[#737780]">Defina preços, planos e parâmetros de publicação.</div>
                      {/* Conteúdo de Monetização embutido dentro do item 1.1 */}
                      <div className="bg-white rounded-[10px] border border-[#E3E4E5] p-5 mt-4">
                        {/* Bloco didático */}
                        <div className="rounded-[8px] bg-gradient-to-br from-[#F8FAFF] to-[#EEF2FF] border border-[#C7D2FE] p-4 mb-4">
                          <div className="text-[13px] font-semibold text-[#1E1B39] mb-1">O que fazer nesta etapa</div>
                          <ul className="list-disc pl-5 text-[12px] text-[#737780] space-y-1">
                            <li>Revise e publique quando estiver pronto.</li>
                          </ul>
                        </div>
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h2 className="text-[16px] font-bold text-[#1E1B39]">Monetização e pagamentos</h2>
                            <p className="text-[12px] text-[#737780]">Configure preço, gateway e políticas financeiras</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <div className="space-y-4">
                            <div className="rounded-[8px] border border-[#E3E4E5] bg-white p-4">
                              <div className="text-[13px] font-semibold mb-2">Gateway</div>
                              <div className="flex items-center gap-3 text-[12px] text-[#737780]">
                                Mygateway
                              </div>
                              {(() => {
                                const baseP = parseFloat(price.replace('R$', '').trim().replace(/\./g, '').replace(',', '.')) || 0;
                                const resP = selectedSimulados.reduce((acc, sim) => {
                                    const pStr = sim.priceLabel.replace('R$', '').trim().replace(/\./g, '').replace(',', '.');
                                    const p = parseFloat(pStr);
                                    return acc + (isNaN(p) ? 0 : p);
                                }, 0);
                                const total = baseP + resP;
                                const connekt = total > 0 ? (total * 0.0499 + 1) : 0;
                                
                                return (
                                  <div className="mt-3 pt-3 border-t border-[#E3E4E5] space-y-1">
                                    <div className="text-[12px] font-medium text-[#1E1B39] mb-1">Receita estimada:</div>
                                    <div className="flex justify-between items-center text-[12px]">
                                      <span className="text-[#737780]">Valor Bruto:</span>
                                      <span className="font-semibold text-[#1E1B39]">
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total)}
                                      </span>
                                    </div>
                                    <div className="flex justify-between items-center text-[12px]">
                                      <span className="text-[#737780]">Taxa da Connekt (4.99% + R$ 1,00):</span>
                                      <span className="font-semibold text-[#EF4444]">
                                        - {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(connekt)}
                                      </span>
                                    </div>
                                    <div className="flex justify-between items-center text-[12px] pt-1 border-t border-dashed border-[#E3E4E5]">
                                      <span className="font-medium text-[#1E1B39]">Líquido Estimado:</span>
                                      <span className="font-bold text-[#059669]">
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total - connekt)}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })()}
                              {selectedSimulados.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-[#E3E4E5] flex justify-between items-center text-[12px]">
                                  <span className="text-[#737780]">Total em recursos adicionais:</span>
                                  <span className="font-semibold text-[#1E1B39]">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                                      selectedSimulados.reduce((acc, sim) => {
                                         const priceString = sim.priceLabel.replace('R$', '').trim().replace('.', '').replace(',', '.');
                                         const price = parseFloat(priceString);
                                         return acc + (isNaN(price) ? 0 : price);
                                      }, 0)
                                    )}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="rounded-[8px] border border-[#E3E4E5] bg-white p-4">
                              <div className="text-[13px] font-semibold mb-2">Preço base do curso</div>
                              <div className="relative">
                                <span className="absolute left-3 top-2.5 text-[12px] text-[#374151]">R$</span>
                                <input 
                                  className="h-10 w-full rounded-[8px] border border-[#E3E4E5] pl-8 pr-3 text-[12px]" 
                                  placeholder="297,00" 
                                  value={price}
                                  onChange={(e) => setPrice(e.target.value)}
                                />
                              </div>
                            </div>
                            <div className="rounded-[8px] border border-[#E3E4E5] bg-white p-4">
                              <div className="text-[13px] font-semibold mb-2">Recursos adicionais</div>
                              {selectedSimulados.length > 0 ? (
                                <div className="space-y-2">
                                  {selectedSimulados.map((sim, idx) => (
                                    <div key={idx} className="flex items-center justify-between text-[12px] text-[#374151] border-b border-[#E3E4E5] pb-2 last:border-0 last:pb-0">
                                      <span>{sim.title}</span>
                                      <span className="font-medium">{sim.priceLabel}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-[12px] text-[#737780]">Nenhum recurso adicional detectado.</div>
                              )}
                            </div>
                          </div>
                          
                          <div className="rounded-[8px] border border-[#E3E4E5] bg-[#F9FAFB] p-4 text-[12px] text-[#374151]">
                            Reembolso: caso seja acionado, será feito diretamente com o produtor após 7 dias.
                          </div>
                          
                        </div>

                        
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
            </div>
          ) : activeScreen === 'aulas' ? (
            <div className="bg-white rounded-[10px] border border-[#E3E4E5] p-5">
              {/* Bloco didático */}
              <div className="rounded-[8px] bg-gradient-to-br from-[#F8FAFF] to-[#EEF2FF] border border-[#C7D2FE] p-4 mb-4">
                <div className="text-[13px] font-semibold text-[#1E1B39] mb-1">O que fazer nesta etapa</div>
                <ul className="list-disc pl-5 text-[12px] text-[#737780] space-y-1">
                  <li>Selecione um módulo para gerenciar suas aulas.</li>
                  <li>Crie novas aulas e edite título, descrição e duração.</li>
                  <li>Defina visibilidade, tags e categorias conforme necessário.</li>
                </ul>
              </div>
              {/* Integração de armazenamento de vídeos (redesign) — movida para o modal */}
              <div className="hidden rounded-[12px] border border-[#DDE1E6] bg-white p-5 mb-4 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded bg-[#EEF2FF] ring-1 ring-[#C7D2FE]">
                      <Layers className="h-4 w-4 text-[#0047BB]" aria-hidden="true" />
                    </span>
                    <h3 className="text-[14px] font-semibold text-[#1E1B39]">Integração de armazenamento de vídeos</h3>
                  </div>
                </div>

                {/* Escolha de provedor padrão */}
                <div className="mb-3">
                  <label className="text-[12px] font-medium text-[#737780]">Escolha o provedor padrão</label>
                  <div className="mt-2 flex items-center gap-3 text-[12px]">
                    <button
                      type="button"
                      className={`inline-flex items-center gap-2 rounded-[8px] px-3 h-8 border ${defaultVideoProvider==='vdocipher' ? 'border-[#0047BB] bg-[#EEF2FF] text-[#1E1B39] font-semibold' : 'border-[#E3E4E5] bg-white text-[#374151]'}`}
                      aria-pressed={defaultVideoProvider==='vdocipher'}
                      onClick={() => setDefaultVideoProvider('vdocipher')}
                    >
                      <img src="/vdologo.svg" alt="VdoCipher" className="h-3.5 w-auto" /> VdoCipher
                    </button>
                    <button
                      type="button"
                      className={`inline-flex items-center gap-2 rounded-[8px] px-3 h-8 border ${defaultVideoProvider==='vimeo' ? 'border-[#0047BB] bg-[#EEF2FF] text-[#1E1B39] font-semibold' : 'border-[#E3E4E5] bg-white text-[#374151]'}`}
                      aria-pressed={defaultVideoProvider==='vimeo'}
                      onClick={() => setDefaultVideoProvider('vimeo')}
                    >
                      <img src="/vimeologo.svg" alt="Vimeo" className="h-3.5 w-auto" /> Vimeo
                    </button>
                    <span className="ml-2 inline-flex items-center gap-2 text-[11px] text-[#6B7280]">
                      <span className="inline-block h-2 w-2 rounded-full bg-[#6B7280]"></span> Não conectado
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] text-[#9291A5]">Novas aulas usarão este provedor por padrão. Você pode alterar por aula no editor.</p>
                </div>

                {/* Aviso didático */}
                <div className="rounded-[10px] border border-[#C7D2FE] bg-[#F8FAFF] p-3 mb-4">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-[#0047BB]" aria-hidden="true" />
                    <p className="text-[12px] text-[#374151]">
                      Para enviar vídeos, conecte o provedor selecionado ({defaultVideoProvider === 'vdocipher' ? 'VdoCipher' : 'Vimeo'}). Caso não tenha conta, crie uma agora e finalize a integração:
                      <a
                        href={defaultVideoProvider === 'vdocipher' ? 'https://www.vdocipher.com/' : 'https://vimeo.com/join'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-1 text-[#0047BB] font-semibold underline"
                      >
                        Criar conta
                      </a>
                    </p>
                  </div>
                </div>

                {/* Cartões dos provedores */}
                <div className="grid sm:grid-cols-1 gap-3">
                  {/* VdoCipher */}
                    <div className="rounded-[10px] border border-[#E3E4E5] bg-white p-4 shadow-sm hover:shadow-md transition-shadow hover:border-[#D1D5DB]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex items-center justify-center rounded bg-[#FFF1F2] ring-1 ring-[#FECACA] px-2 h-9">
                            <img src="/vdologo.svg" alt="VdoCipher" className="h-5 w-auto" />
                          </span>
                          <div>
                            <div className="text-[14px] font-semibold text-[#1E1B39]">VdoCipher</div>
                            <div className="text-[11px] text-[#737780]">Proteção DRM • Anti-download • Player seguro</div>
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#F3F4F6] px-2.5 py-0.5 text-[11px] text-[#6B7280]" aria-live="polite">
                          {connectedProviders.vdocipher ? (
                            <>
                              <span className="h-2 w-2 rounded-full bg-[#10B981]"></span> Conectado
                            </>
                          ) : (
                            <>
                              <span className="h-2 w-2 rounded-full bg-[#F59E0B]"></span> Pendente
                            </>
                          )}
                        </span>
                      </div>
                      <ul className="mt-3 space-y-2 text-[12px] text-[#737780]">
                        <li className="inline-flex items-center gap-2"><Check className="h-3.5 w-3.5 text-[#10B981]" /> Alta segurança</li>
                        <li className="inline-flex items-center gap-2"><Check className="h-3.5 w-3.5 text-[#10B981]" /> Ideal para cursos premium</li>
                      </ul>
                      <div className="mt-4 flex items-center justify-end gap-2">
                        {!connectedProviders.vdocipher ? (
                          <>
                            <Button
                              className="h-9 px-4"
                              variant="outline"
                              type="button"
                              onClick={() => setIsVdoSettingsOpen(true)}
                            >
                              Configurar
                            </Button>
                            <Button
                              className={`h-9 px-4 ${isVdoConfigured ? 'bg-[#0047BB] hover:bg-[#003a99] text-white' : 'bg-[#E5E7EB] text-[#6B7280] cursor-not-allowed'}`}
                              aria-label="Conectar VdoCipher"
                              type="button"
                              disabled={!isVdoConfigured}
                              onClick={() => handleConnectService('vdocipher')}
                            >
                              Conectar
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              className="h-9 px-4"
                              variant="outline"
                              type="button"
                              onClick={handleVdoDisconnect}
                            >
                              Desconectar
                            </Button>
                          </>
                        )}
                      </div>
                      {connectedProviders.vdocipher && (
                        <div ref={vdoUploadSectionRef} className="mt-4 rounded-[8px] border border-[#E3E4E5] bg-[#FBFCFF] p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-[#EEF2FF]">
                              <DownloadCloud className="h-3.5 w-3.5 text-[#0047BB]" />
                            </span>
                            <span className="text-[13px] font-semibold text-[#1E1B39]">Upload direto para VdoCipher</span>
                          </div>
                          <div className="grid sm:grid-cols-1 gap-2">
                            <div>
                              <label className="text-[12px] text-[#737780]">Arquivo de vídeo</label>
                              <input
                                type="file"
                                accept="video/*"
                                className="mt-1 w-full text-[12px]"
                                onChange={(e) => setVdoUploadFile(e.target.files?.[0] || null)}
                              />
                            </div>
                          </div>
                          <div className="mt-3">
                            <Button
                              className="h-9 px-4 bg-[#0047BB] hover:bg-[#003a99] text-white disabled:bg-[#E5E7EB] disabled:text-[#6B7280]"
                              type="button"
                              disabled={isVdoUploading}
                              onClick={handleVdoUpload}
                            >
                              {isVdoUploading ? (
                                <span className="inline-flex items-center gap-2">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Enviando...
                                </span>
                              ) : 'Enviar vídeo'}
                            </Button>
                          </div>
                          <p className="mt-2 text-[11px] text-[#737780]">Após o upload, o vídeo entra em processamento no VdoCipher. Você poderá usar o videoId retornado para gerar OTP na reprodução.</p>
                        </div>
                      )}
                    </div>

                  {/* Vimeo */}
                    <div className="rounded-[10px] border border-[#E3E4E5] bg-white p-4 shadow-sm hover:shadow-md transition-shadow hover:border-[#D1D5DB]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex items-center justify-center rounded bg-[#F5F3FF] ring-1 ring-[#DDD6FE] px-2 h-9">
                            <img src="/vimeologo.svg" alt="Vimeo" className="h-5 w-auto" />
                          </span>
                          <div>
                            <div className="text-[14px] font-semibold text-[#1E1B39]">Vimeo</div>
                            <div className="text-[11px] text-[#737780]">Hospedagem estável • Player amigável</div>
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#F3F4F6] px-2.5 py-0.5 text-[11px] text-[#6B7280]" aria-live="polite">
                          {connectedProviders.vimeo ? (
                            <>
                              <span className="h-2 w-2 rounded-full bg-[#10B981]"></span> Conectado
                            </>
                          ) : (
                            <>
                              <span className="h-2 w-2 rounded-full bg-[#F59E0B]"></span> Pendente
                            </>
                          )}
                        </span>
                      </div>
                      <ul className="mt-3 space-y-2 text-[12px] text-[#737780]">
                        <li className="inline-flex items-center gap-2"><Check className="h-3.5 w-3.5 text-[#10B981]" /> Configuração rápida</li>
                        <li className="inline-flex items-center gap-2"><Check className="h-3.5 w-3.5 text-[#10B981]" /> Bom custo-benefício</li>
                      </ul>
                      <div className="mt-4 flex items-center justify-end gap-2">
                        {!connectedProviders.vimeo ? (
                          <>
                            <Button
                              className="h-9 px-4"
                              variant="outline"
                              type="button"
                              onClick={() => setIsVimeoSettingsOpen(true)}
                            >
                              Configurar
                            </Button>
                            <Button
                              className="h-9 px-4"
                              variant="outline"
                              type="button"
                              onClick={() => {
                                const uri = vimeoSettings.redirect_uri || `${window.location.origin}/vimeo/callback`
                                try {
                                  navigator.clipboard.writeText(uri)
                                  toast({ title: 'Redirect URI copiada', description: uri })
                                } catch (err) {
                                  toast({ title: 'Falha ao copiar', description: 'Copie manualmente a URL.' })
                                }
                              }}
                            >
                              Copiar Redirect URI
                            </Button>
                            <Button
                              className={`h-9 px-4 ${isVimeoConfigured ? 'bg-[#0047BB] hover:bg-[#003a99] text-white' : 'bg-[#E5E7EB] text-[#6B7280] cursor-not-allowed'}`}
                              aria-label="Conectar Vimeo"
                              type="button"
                              disabled={!isVimeoConfigured}
                              onClick={() => handleConnectService('vimeo')}
                            >
                              Conectar
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              className="h-9 px-4"
                              variant="outline"
                              type="button"
                              onClick={handleVimeoDisconnect}
                            >
                              Desconectar
                            </Button>
                          </>
                        )}
                      </div>
                      {connectedProviders.vimeo && (
                        <div className="mt-4 rounded-[8px] border border-[#E3E4E5] bg-[#FBFCFF] p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-[#EEF2FF]">
                              <DownloadCloud className="h-3.5 w-3.5 text-[#0047BB]" />
                            </span>
                            <span className="text-[13px] font-semibold text-[#1E1B39]">Upload direto para Vimeo</span>
                          </div>
                          <div className="grid sm:grid-cols-1 gap-2">
                            <div>
                              <label className="text-[12px] text-[#737780]">Arquivo de vídeo</label>
                              <input
                                type="file"
                                accept="video/*"
                                className="mt-1 w-full text-[12px]"
                                onChange={(e) => setVimeoUploadFile(e.target.files?.[0] || null)}
                              />
                            </div>
                          </div>
                          <div className="mt-3">
                            <Button
                              className="h-9 px-4 bg-[#0047BB] hover:bg-[#003a99] text-white disabled:bg-[#E5E7EB] disabled:text-[#6B7280]"
                              type="button"
                              disabled={isVimeoUploading}
                              onClick={handleVimeoUpload}
                            >
                              {isVimeoUploading ? (
                                <span className="inline-flex items-center gap-2">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  {`Enviando... (${vimeoUploadProgress}%)`}
                                </span>
                              ) : 'Enviar vídeo'}
                            </Button>
                          </div>
                          <p className="mt-2 text-[11px] text-[#737780]">Após o upload, o Vimeo processará o vídeo. Você poderá associá-lo à aula conforme necessário.</p>
                        </div>
                      )}
                    </div>
                </div>
              </div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-[16px] font-bold text-[#1E1B39]">Criação de aulas</h2>
                  <p className="text-[12px] text-[#737780]">Adicione e edite aulas dentro dos módulos</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="rounded-[10px] border border-[#E3E4E5] bg-white p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-[13px] font-semibold text-[#1E1B39]">Módulos</div>
                      <div className="text-[12px] text-[#737780]">Selecione um módulo para gerenciar suas aulas.</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        className="h-9 bg-[#0047BB] hover:bg-[#003a99] text-white"
                        onClick={() => {
                          setNewModuleCoverImage(null)
                          setNewModuleCoverFile(null)
                          if (newModuleCoverInputRef.current) newModuleCoverInputRef.current.value = ''
                          setShowModuleForm(true)
                        }}
                      >
                        Criar módulo
                      </Button>
                    </div>
                  </div>

                  {modules.length === 0 ? (
                    <div className="rounded-[8px] border border-[#E3E4E5] bg-[#FBFCFF] p-3 text-[12px] text-[#737780]">
                      Nenhum módulo criado. Clique em “Criar módulo” para começar.
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 gap-2">
                        {modules.map((m) => {
                          const selected = (editingModuleId ?? modules[0]?.id) === m.id
                          const isEditingThis = moduleEditId === m.id
                          return (
                            <div key={m.id} className={`rounded-[10px] border transition-colors ${selected ? 'border-[#0047BB] bg-[#F5F9FF]' : 'border-[#E3E4E5] bg-white'}`}>
                              <div className="flex items-center justify-between gap-3 p-3">
                                <button
                                  type="button"
                                  onClick={() => { setEditingModuleId(m.id); setEditingLessonId(null) }}
                                  className="min-w-0 text-left flex items-center gap-3 w-full"
                                >
                                  <div className="h-[56px] w-[40px] rounded-[8px] overflow-hidden border border-[#E3E4E5] bg-[#F3F4F6] flex-shrink-0">
                                    {(m as any).cover_image_url ? (
                                      <img src={(m as any).cover_image_url} alt="" className="h-full w-full object-cover" />
                                    ) : null}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="text-[13px] font-semibold text-[#1E1B39] truncate">{m.name}</div>
                                    <div className="mt-0.5 flex items-center gap-2 text-[12px] text-[#737780]">
                                      <span className="inline-flex items-center rounded-full bg-[#EEF2FF] text-[#1D4ED8] px-2 py-0.5 text-[11px] font-medium">
                                        {m.lessons?.length ?? 0} aulas
                                      </span>
                                      {!!m.description && <span className="truncate">{m.description}</span>}
                                    </div>
                                  </div>
                                </button>

                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <button
                                    type="button"
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] border border-[#E3E4E5] bg-white hover:bg-[#F3F4F6]"
                                    title={isEditingThis ? 'Fechar edição' : 'Editar módulo'}
                                    onClick={() => {
                                      if (isEditingThis) {
                                        setModuleEditId(null)
                                        setModuleEditTitle('')
                                        setModuleEditDescription('')
                                        setModuleEditVisibility('Gratuita')
                                        setModuleEditPrice('')
                                        setModuleEditFreeCourseIds(['self'])
                                        setModuleEditCoverImage(null)
                                        setModuleEditCoverPath(null)
                                        setModuleEditCoverFile(null)
                                        setIsModuleEditCoverGalleryOpen(false)
                                        if (moduleEditCoverInputRef.current) moduleEditCoverInputRef.current.value = ''
                                        return
                                      }
                                      setModuleEditId(m.id)
                                      setModuleEditTitle(m.name)
                                      setModuleEditDescription(m.description || '')
                                      {
                                        const vis = String((m as any).visibility || '').trim()
                                        const v = (vis === 'Paga' || vis === 'Gratuita para alunos do curso') ? vis : 'Gratuita'
                                        setModuleEditVisibility(v as any)
                                        const cents = Number((m as any).priceCents || 0)
                                        setModuleEditPrice((v !== 'Gratuita' && Number.isFinite(cents) && cents > 0) ? formatCentsToBRLValue(cents) : '')
                                        const rawIds = (m as any).freeCourseIds || (m as any).free_course_ids || []
                                        const ids = Array.isArray(rawIds) ? rawIds.map((x: any) => String(x || '').trim()).filter(Boolean) : []
                                        setModuleEditFreeCourseIds(ids.length ? ids : ['self'])
                                      }
                                      setModuleEditCoverImage((m as any).cover_image_url || null)
                                      setModuleEditCoverPath((m as any).cover_image_path || null)
                                      setModuleEditCoverFile(null)
                                      setIsModuleEditCoverGalleryOpen(false)
                                      if (moduleEditCoverInputRef.current) moduleEditCoverInputRef.current.value = ''
                                    }}
                                  >
                                    <Pencil className="h-4 w-4 text-[#6B7280]" />
                                  </button>
                                  <button
                                    type="button"
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] border border-[#E3E4E5] bg-white hover:bg-[#F3F4F6]"
                                    title="Excluir módulo"
                                    onClick={() => {
                                      setModules((prev) => prev.filter((x) => x.id !== m.id))
                                      if (editingModuleId === m.id) setEditingModuleId(null)
                                      if (editingLessonId) setEditingLessonId(null)
                                      if (moduleEditId === m.id) {
                                        setModuleEditId(null)
                                        setModuleEditTitle('')
                                        setModuleEditDescription('')
                                        setModuleEditVisibility('Gratuita')
                                        setModuleEditPrice('')
                                        setModuleEditCoverImage(null)
                                        setModuleEditCoverPath(null)
                                        setModuleEditCoverFile(null)
                                        setIsModuleEditCoverGalleryOpen(false)
                                        if (moduleEditCoverInputRef.current) moduleEditCoverInputRef.current.value = ''
                                      }
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4 text-[#6B7280]" />
                                  </button>
                                </div>
                              </div>

                              {isEditingThis && (
                                <div className="border-t border-[#E3E4E5] bg-white/50 p-3">
                                  <div className="grid grid-cols-1 gap-3">
                                    <div>
                                      <label className="text-[12px] text-[#737780]">Capa do módulo</label>
                                      <div className="mt-2">
                                        <label
                                          className={`relative mx-auto w-[180px] h-[326px] rounded-[10px] border border-dashed border-[#C7D2FE] bg-[#F8FAFF] ${moduleEditCoverImage ? 'p-0' : 'p-4'} cursor-pointer hover:bg-[#EEF2FF] transition-colors overflow-hidden flex items-center justify-center`}
                                          onDragOver={(e) => { e.preventDefault() }}
                                          onDrop={(e) => {
                                            e.preventDefault()
                                            const file = e.dataTransfer.files?.[0]
                                            if (!file) return
                                            if (!isImageFile(file)) {
                                              toast({ title: 'Arquivo inválido', description: 'Envie apenas arquivos de imagem.', variant: 'destructive' as any })
                                              return
                                            }
                                            setModuleEditCoverFile(file)
                                            setModuleEditCoverPath(null)
                                            const url = URL.createObjectURL(file)
                                            setModuleEditCoverImage(url)
                                            setIsModuleEditCoverGalleryOpen(false)
                                          }}
                                        >
                                          {moduleEditCoverImage ? (
                                            <>
                                              <img src={moduleEditCoverImage} alt="Capa do módulo" className="absolute inset-0 h-full w-full object-cover" />
                                              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                                              <div className="pointer-events-none absolute inset-x-0 bottom-0 pb-6 flex flex-col items-center text-center px-3">
                                                <ConnektWordmark className="w-[110px] h-auto" />
                                                <div className="mt-2 h-[2px] w-10 bg-white/70 rounded" />
                                                <div className="mt-3 text-[14px] font-semibold text-white truncate w-full">{(moduleEditTitle || '').trim() || 'Nome do módulo'}</div>
                                              </div>
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.preventDefault()
                                                  e.stopPropagation()
                                                  setModuleEditCoverImage(null)
                                                  setModuleEditCoverPath(null)
                                                  setModuleEditCoverFile(null)
                                                  setModuleCoverFilesById((prev) => {
                                                    const next = { ...prev }
                                                    delete next[m.id]
                                                    return next
                                                  })
                                                  if (moduleEditCoverInputRef.current) moduleEditCoverInputRef.current.value = ''
                                                }}
                                                className="absolute top-2 right-2 p-1 bg-white/85 rounded-full hover:bg-white text-red-500 transition-colors z-10"
                                              >
                                                <X className="w-4 h-4" />
                                              </button>
                                            </>
                                          ) : (
                                            <div className="text-center text-[12px] text-[#737780]">
                                              Arraste uma imagem ou clique para selecionar
                                            </div>
                                          )}
                                          <input
                                            ref={moduleEditCoverInputRef}
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => {
                                              const file = e.target.files?.[0]
                                              if (!file) return
                                              if (!isImageFile(file)) {
                                                toast({ title: 'Arquivo inválido', description: 'Envie apenas arquivos de imagem.', variant: 'destructive' as any })
                                                if (moduleEditCoverInputRef.current) moduleEditCoverInputRef.current.value = ''
                                                return
                                              }
                                              setModuleEditCoverFile(file)
                                              setModuleEditCoverPath(null)
                                              const url = URL.createObjectURL(file)
                                              setModuleEditCoverImage(url)
                                              setIsModuleEditCoverGalleryOpen(false)
                                            }}
                                          />
                                        </label>
                                      </div>
                                      <div className="mt-2 text-[11px] text-[#737780]">Tamanho recomendado: 1080×1920 px (9:16). Máx. 5MB.</div>
                                      <div className="mt-3 flex items-center justify-between">
                                        <button
                                          type="button"
                                          className="text-[12px] font-medium text-[#0047BB] hover:underline"
                                          onClick={() => setIsModuleEditCoverGalleryOpen((v) => !v)}
                                        >
                                          {isModuleEditCoverGalleryOpen ? 'Ocultar sugestões' : 'Escolher uma capa pronta'}
                                        </button>
                                      </div>
                                      {isModuleEditCoverGalleryOpen ? (
                                        <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2">
                                          {medicalCourseCoverOptions.map((opt) => (
                                            <button
                                              key={opt.id}
                                              type="button"
                                              className="relative rounded-[8px] overflow-hidden border border-[#E3E4E5] bg-white hover:border-[#0047BB] transition-colors"
                                              onClick={() => applyModuleEditCoverFromGallery(opt.src)}
                                              title={opt.label}
                                            >
                                              <img src={opt.src} alt={opt.label} className="h-[64px] w-full object-cover" />
                                            </button>
                                          ))}
                                        </div>
                                      ) : null}
                                    </div>
                                    <div>
                                      <label className="text-[12px] text-[#737780]">Título</label>
                                      <input
                                        value={moduleEditTitle}
                                        onChange={(e) => setModuleEditTitle(e.target.value)}
                                        className="mt-1 h-9 w-full rounded-[8px] border border-[#E3E4E5] bg-white px-3 text-[12px]"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[12px] text-[#737780]">Descrição</label>
                                      <textarea
                                        value={moduleEditDescription}
                                        onChange={(e) => setModuleEditDescription(e.target.value)}
                                        className="mt-1 w-full rounded-[8px] border border-[#E3E4E5] bg-white p-3 text-[12px]"
                                        rows={2}
                                      />
                                    </div>
                                    <div className={moduleEditVisibility !== 'Gratuita' ? "grid grid-cols-2 gap-3" : "grid grid-cols-1 gap-3"}>
                                      <div>
                                        <label className="text-[12px] text-[#737780]">Visibilidade</label>
                                        <select
                                          value={moduleEditVisibility}
                                          onChange={(e) => {
                                            const v = e.target.value as 'Gratuita' | 'Paga' | 'Gratuita para alunos do curso'
                                            setModuleEditVisibility(v)
                                            if (v === 'Gratuita') setModuleEditPrice('')
                                          }}
                                          className="mt-1 h-9 w-full rounded-[8px] border border-[#E3E4E5] bg-white px-3 text-[12px]"
                                        >
                                          <option value="Gratuita">Gratuito</option>
                                          <option value="Gratuita para alunos do curso">Gratuito para alunos do curso</option>
                                          <option value="Paga">Pago</option>
                                        </select>
                                      </div>
                                      {moduleEditVisibility !== 'Gratuita' ? (
                                        <div>
                                          <label className="text-[12px] text-[#737780]">Valor</label>
                                          <div className="mt-1 flex items-center rounded-[8px] border border-[#E3E4E5] bg-white px-3">
                                            <span className="text-[11px] text-[#6B7280]">R$</span>
                                            <input
                                              value={moduleEditPrice}
                                              onChange={(e) => {
                                                const v = e.target.value
                                                const cleaned = v.replace(/[^\d.,]/g, '')
                                                setModuleEditPrice(cleaned)
                                              }}
                                              inputMode="decimal"
                                              className="h-9 w-full bg-transparent px-2 text-[12px] outline-none"
                                              placeholder="0,00"
                                            />
                                          </div>
                                          {moduleEditVisibility === 'Gratuita para alunos do curso' ? (
                                            <div className="mt-1 text-[11px] text-[#737780]">Opcional: defina um valor para vender o módulo avulso para quem não é aluno do(s) curso(s).</div>
                                          ) : null}
                                        </div>
                                      ) : null}
                                    </div>
                                    {moduleEditVisibility === 'Gratuita para alunos do curso' ? (
                                      <div>
                                        <label className="text-[12px] text-[#737780]">Gratuito para alunos de</label>
                                        <select
                                          multiple
                                          value={Array.isArray(moduleEditFreeCourseIds) ? moduleEditFreeCourseIds : []}
                                          onChange={(e) => {
                                            const selected = Array.from(e.currentTarget.selectedOptions).map((o) => String(o.value || '').trim()).filter(Boolean)
                                            setModuleEditFreeCourseIds(selected)
                                          }}
                                          className="mt-1 w-full min-h-[96px] rounded-[8px] border border-[#E3E4E5] bg-white px-3 py-2 text-[13px]"
                                        >
                                          <option value="self">Este curso</option>
                                          {availableCourses.map((c) => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                          ))}
                                        </select>
                                        <div className="mt-1 text-[11px] text-[#737780]">Dica: segure Ctrl (Windows) para selecionar mais de um.</div>
                                      </div>
                                    ) : null}
                                  </div>
                                  <div className="mt-3 flex items-center justify-end gap-2">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      className="h-9"
                                      onClick={() => {
                                        setModuleEditId(null)
                                        setModuleEditTitle('')
                                        setModuleEditDescription('')
                                        setModuleEditVisibility('Gratuita')
                                        setModuleEditPrice('')
                                        setModuleEditCoverImage(null)
                                        setModuleEditCoverPath(null)
                                        setModuleEditCoverFile(null)
                                        setIsModuleEditCoverGalleryOpen(false)
                                        if (moduleEditCoverInputRef.current) moduleEditCoverInputRef.current.value = ''
                                      }}
                                    >
                                      Cancelar
                                    </Button>
                                    <Button
                                      type="button"
                                      className="h-9 bg-[#0047BB] hover:bg-[#003a99] text-white"
                                      onClick={() => {
                                        const name = moduleEditTitle.trim()
                                        const desc = moduleEditDescription.trim()
                                        if (!name) return
                                        const hasPrice = moduleEditVisibility !== 'Gratuita'
                                        const priceCents = hasPrice ? (parseBRLValueToCents(moduleEditPrice) || 0) : null
                                        if (moduleEditVisibility === 'Paga' && (!priceCents || priceCents <= 0)) {
                                          toast({ title: 'Informe o valor', description: 'Defina o valor do módulo para visibilidade Paga.', variant: 'destructive' as any })
                                          return
                                        }
                                        const nextCoverUrl = moduleEditCoverImage || null
                                        const nextCoverPath = moduleEditCoverFile ? null : (moduleEditCoverImage ? moduleEditCoverPath : null)
                                        const freeCourseIds =
                                          moduleEditVisibility === 'Gratuita para alunos do curso'
                                            ? (Array.isArray(moduleEditFreeCourseIds) && moduleEditFreeCourseIds.length ? moduleEditFreeCourseIds : ['self'])
                                            : undefined
                                        setModules((prev) => prev.map((x: any) => x.id === m.id ? { ...x, name, description: desc, cover_image_url: nextCoverUrl, cover_image_path: nextCoverPath, visibility: moduleEditVisibility, priceCents: hasPrice ? (priceCents || 0) : undefined, freeCourseIds } : x))
                                        if (moduleEditCoverFile) {
                                          setModuleCoverFilesById((prev) => ({ ...prev, [m.id]: moduleEditCoverFile }))
                                        }
                                        if (moduleEditCoverFile) {
                                          setModuleLayoutImage(nextCoverUrl)
                                          setModuleLayoutImageFile(moduleEditCoverFile)
                                          setModuleLayoutImagePath(null)
                                        } else if (nextCoverUrl) {
                                          setModuleLayoutImage(nextCoverUrl)
                                          setModuleLayoutImageFile(null)
                                          setModuleLayoutImagePath(null)
                                        }
                                        setModuleEditId(null)
                                        setModuleEditTitle('')
                                        setModuleEditDescription('')
                                        setModuleEditVisibility('Gratuita')
                                        setModuleEditPrice('')
                                        setModuleEditFreeCourseIds(['self'])
                                        setModuleEditCoverImage(null)
                                        setModuleEditCoverPath(null)
                                        setModuleEditCoverFile(null)
                                        setIsModuleEditCoverGalleryOpen(false)
                                        if (moduleEditCoverInputRef.current) moduleEditCoverInputRef.current.value = ''
                                      }}
                                    >
                                      Salvar
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>

                <div className="rounded-[10px] border border-[#E3E4E5] bg-white p-4">
                  <div className="flex items-center justify-between mb-3">
                    {(() => {
                      const selectedId = editingModuleId ?? modules[0]?.id
                      const mod = selectedId ? modules.find((m) => m.id === selectedId) : null
                      const cover = (mod as any)?.cover_image_url || null
                      return (
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-[40px] w-[28px] rounded-[6px] overflow-hidden border border-[#E3E4E5] bg-[#F3F4F6] flex-shrink-0">
                            {cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : null}
                          </div>
                          <div className="min-w-0">
                            <div className="text-[13px] font-semibold text-[#1E1B39]">Aulas do módulo</div>
                            <div className="text-[12px] font-normal text-[#737780] truncate">{mod?.name || '—'}</div>
                          </div>
                        </div>
                      )
                    })()}
                  </div>

                  {(() => {
                    const selectedId = editingModuleId ?? modules[0]?.id
                    const mod = selectedId ? modules.find((m) => m.id === selectedId) : null
                    if (!mod) {
                      return (
                        <div className="text-[12px] text-[#737780]">Selecione um módulo para visualizar.</div>
                      )
                    }
                    if (!mod.lessons || mod.lessons.length === 0) {
                      return (
                        <div className="text-[12px] text-[#737780]">Nenhuma aula criada neste módulo.</div>
                      )
                    }
                    return (
                      <div className="space-y-2">
                        {mod.lessons.map((l) => (
                          <div key={l.id} className="flex items-start justify-between gap-3 rounded-[8px] border border-[#E3E4E5] bg-white p-3">
                            <div className="min-w-0">
                              <div className="text-[13px] font-semibold text-[#1E1B39] truncate">{l.title}</div>
                              <div className="text-[12px] text-[#737780] truncate">
                                {l.durationMin ? `${l.durationMin} min` : '—'} • {l.visibility || 'Gratuita'}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button type="button" variant="outline" className="h-9" onClick={() => startEditingLesson(mod, l)}>
                                Editar
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                className="h-9"
                                onClick={() => {
                                  setModules(prev => prev.map((x) => {
                                    if (x.id !== mod.id) return x
                                    const nextLessons = (x.lessons || []).filter((it) => it.id !== l.id)
                                    return { ...x, lessons: nextLessons, lessonsCount: Math.max(0, (x.lessonsCount || 0) - 1) }
                                  }))
                                  if (editingLessonId === l.id) setEditingLessonId(null)
                                }}
                              >
                                Remover
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                </div>

                <div className="flex items-center justify-end gap-3 mt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      const selectedId = editingModuleId ?? modules[0]?.id
                      if (!selectedId) return
                      openLessonLibrary(selectedId)
                      toast({ title: "Biblioteca de aulas", description: "Selecione uma aula existente para reutilizar." })
                    }}
                  >
                    Usar Aula Existente
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingLessonId(null)
                      if (!editingModuleId && modules[0]?.id) setEditingModuleId(modules[0].id)
                      setIsAddLessonModalOpen(true)
                      toast({ title: "Nova aula", description: "Abrindo modal de criação de aula." })
                    }}
                  >
                    Adicionar Aula
                  </Button>
                  {!isAdvanceButtonHidden('aulas_screen_avancar') && (
                    <Button
                      className="bg-[#0047BB] hover:bg-[#003a99]"
                      onClick={() => {
                        hideAdvanceButton('aulas_screen_avancar')
                        setPhaseDone(prev => ({ ...prev, aulas: true }));
                        setActiveScreen('recursos');
                        location.hash = 'recursos';
                      }}
                    >
                      Avançar
                    </Button>
                  )}
                </div>
                
                {/* Removido bloco inline para evitar duplicidade com o modal overlay */}

                {/* Lista de aulas removida conforme solicitado */}

                {/* Editor de aula simplificado */}
                {editingModuleId && editingLessonId && (() => {
                  const mod = modules.find((m) => m.id === editingModuleId)
                  if (!mod) return null
                  return (
                    <div ref={editorRef} className="rounded-[8px] border border-[#E3E4E5] bg-[#FBFCFF] p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded bg-[#EEF2FF]">
                            <Play className="h-4 w-4 text-[#0047BB]" />
                          </span>
                          <span className="text-[14px] font-semibold text-[#1E1B39]">Editar aula</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <label className="text-[12px] font-medium text-[#737780]">Título da aula*</label>
                          <input
                            ref={lessonTitleRef}
                            className="mt-1 w-full rounded-[8px] border border-[#E3E4E5] bg-white px-3 py-2 text-[13px]"
                            value={mod.lessons.find((l) => l.id === editingLessonId)?.title ?? ''}
                            placeholder="Digite o título da aula"
                            onChange={(e) => updateLessonField(mod.id, editingLessonId!, 'title', e.target.value)}
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="text-[12px] font-medium text-[#737780]">Descrição*</label>
                          <input
                            className="mt-1 w-full rounded-[8px] border border-[#E3E4E5] bg-white px-3 py-2 text-[13px]"
                            value={mod.lessons.find((l) => l.id === editingLessonId)?.description ?? ''}
                            placeholder="Digite uma descrição para a sua aula"
                            onChange={(e) => updateLessonField(mod.id, editingLessonId!, 'description', e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="text-[12px] font-medium text-[#737780]">Duração (minuto)*</label>
                          <input
                            type="number"
                            min={0}
                            className="mt-1 w-full rounded-[8px] border border-[#E3E4E5] bg-white px-3 py-2 text-[13px]"
                            value={mod.lessons.find((l) => l.id === editingLessonId)?.durationMin ?? 0}
                            onChange={(e) => updateLessonField(mod.id, editingLessonId!, 'durationMin', Number(e.target.value))}
                          />
                        </div>
                        <div>
                          <label className="text-[12px] font-medium text-[#737780]">Visibilidade*</label>
                          <select
                            className="mt-1 w-full rounded-[8px] border border-[#E3E4E5] bg-white px-3 py-2 text-[13px]"
                            value={mod.lessons.find((l) => l.id === editingLessonId)?.visibility ?? 'Gratuita'}
                            onChange={(e) => updateLessonField(mod.id, editingLessonId!, 'visibility', e.target.value as Lesson['visibility'])}
                          >
                            <option value="Gratuita">Gratuita</option>
                            <option value="Gratuita para alunos do curso">Gratuita para alunos do curso</option>
                            <option value="Paga">Paga</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[12px] font-medium text-[#737780]">Provedor de vídeo</label>
                          <select
                            className="mt-1 w-full rounded-[8px] border border-[#E3E4E5] bg-white px-3 py-2 text-[13px]"
                            value={mod.lessons.find((l) => l.id === editingLessonId)?.videoProvider ?? defaultVideoProvider}
                            onChange={(e) => updateLessonField(mod.id, editingLessonId!, 'videoProvider', e.target.value as Lesson['videoProvider'])}
                          >
                            <option value="vdocipher">VdoCipher</option>
                            <option value="vimeo">Vimeo</option>
                            <option value="upload">Upload</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[12px] font-medium text-[#737780]">Tag</label>
                          <select
                            className="mt-1 w-full rounded-[8px] border border-[#E3E4E5] bg-white px-3 py-2 text-[13px]"
                            value={mod.lessons.find((l) => l.id === editingLessonId)?.tag ?? 'Anatomia'}
                            onChange={(e) => updateLessonField(mod.id, editingLessonId!, 'tag', e.target.value)}
                          >
                            <option>Anatomia</option>
                            <option>Cardiologia</option>
                            <option>Diagnóstico</option>
                            <option>Geral</option>
                          </select>
                        </div>
                      </div>
                      <div className="mt-4 space-y-3 text-[12px]">
                        <div className="flex items-center gap-2">
                          <span className="text-[#737780]">Categoria:</span>
                          {/* input de categoria removido */}
                          <div className="flex flex-wrap gap-2">
                            {(mod.lessons.find((l) => l.id === editingLessonId)?.categories ?? []).map((c, idx) => (
                              <span key={idx} className="inline-flex items-center gap-1 rounded bg-[#EEF2FF] text-[#1D4ED8] px-2 py-0.5">
                                {c} <button className="text-[#6B7280]" onClick={() => removeToken('categories', idx)}>&times;</button>
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[#737780]">Subcategoria:</span>
                          {/* input de subcategoria removido */}
                          <div className="flex flex-wrap gap-2">
                            {(mod.lessons.find((l) => l.id === editingLessonId)?.subcategories ?? []).map((c, idx) => (
                              <span key={idx} className="inline-flex items-center gap-1 rounded bg-[#F3F4F6] text-[#374151] px-2 py-0.5">
                                {c} <button className="text-[#6B7280]" onClick={() => removeToken('subcategories', idx)}>&times;</button>
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[#737780]">Tags:</span>
                          {/* input de tag removido */}
                          <div className="flex flex-wrap gap-2">
                            {(mod.lessons.find((l) => l.id === editingLessonId)?.extraTags ?? []).map((t, idx) => (
                              <span key={idx} className="inline-flex items-center gap-1 rounded bg-[#FEF9C3] text-[#92400E] px-2 py-0.5">
                                Tag <span className="mx-1">{t}</span> <button className="text-[#6B7280]" onClick={() => removeToken('extraTags', idx)}>&times;</button>
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      {/* Materiais complementares movidos para o modal de configuração da aula */}
                      <div className="mt-4 flex items-center justify-end gap-3">
                        <Button variant="outline" onClick={() => { setEditingModuleId(null); setEditingLessonId(null) }}>Cancelar</Button>
                        <Button className="bg-[#0047BB] hover:bg-[#003a99]" onClick={() => { setEditingModuleId(null); setEditingLessonId(null) }}>Concluir</Button>
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>
          ) : activeScreen === 'recursos' ? (
            <div className="bg-white rounded-[10px] border border-[#E3E4E5] p-5">
              {/* Bloco didático */}
              <div className="rounded-[8px] bg-gradient-to-br from-[#F8FAFF] to-[#EEF2FF] border border-[#C7D2FE] p-4 mb-4">
                <div className="text-[13px] font-semibold text-[#1E1B39] mb-1">O que fazer nesta etapa</div>
                <ul className="list-disc pl-5 text-[12px] text-[#737780] space-y-1">
                  <li>Conecte simulados e bancos de questões.</li>
                  <li>Adicione recursos globais do curso ou específicos por módulo/aula.</li>
                  <li>Revise os recursos conectados na lista abaixo.</li>
                </ul>
              </div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-[16px] font-bold text-[#1E1B39]">Recursos e Anexos</h2>
                  <p className="text-[12px] text-[#737780]">Conecte simulados e bancos de questões ao seu curso</p>
                </div>
              </div>
              <div className="flex flex-wrap justify-center gap-4 mb-6">
                {[{title:'Simulados',desc:'Bancos de questões e simulados',color:'#EEF2FF'}].map((c,idx)=> (
                  <div key={idx} className="w-full rounded-[8px] border border-[#E3E4E5] bg-white p-4">
                    <div className="h-10 w-10 rounded-[8px]" style={{background:c.color}}></div>
                    <div className="mt-2 text-[13px] font-semibold text-[#1E1B39]">{c.title}</div>
                    <div className="text-[12px] text-[#737780]">{c.desc}</div>
                    <Button
                      variant="outline"
                      className="mt-3 h-8 w-full justify-center"
                      onClick={() => { if (c.title === 'Simulados') openSimuladoSelector('curso') }}
                    >
                      Adicionar recursos
                    </Button>
                  </div>
                ))}
              </div>
              <div className="space-y-6">
                <div className="rounded-[8px] border border-[#E3E4E5] bg-white">
                  <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[#E3E4E5]">
                    <span className="text-[13px] font-semibold">Recursos do Curso</span>
                    <div className="flex items-center gap-2">
                      <select
                        className="h-8 rounded-[6px] border border-[#E3E4E5] bg-white px-2 text-[12px] outline-none focus:border-[#0047BB]"
                        value={courseMaterialAddType}
                        onChange={(e) => setCourseMaterialAddType(e.target.value as any)}
                      >
                        <option value="pdf">PDF</option>
                        <option value="doc">DOC</option>
                        <option value="ppt">PPT</option>
                        <option value="xls">XLS</option>
                        <option value="link">Link</option>
                      </select>
                      <Button variant="outline" className="px-3 py-2 h-8" onClick={() => openExtraMaterialUploader({ scope: 'curso' }, courseMaterialAddType)}>Adicionar</Button>
                      <Button variant="outline" className="px-3 py-2 h-8" onClick={() => openResourceLibrary({ scope: 'curso' })}>Biblioteca</Button>
                    </div>
                  </div>
                  {(selectedSimulados.filter(s => !s.scope || s.scope === 'curso').length > 0 || (Array.isArray(courseMaterials) && courseMaterials.length > 0)) ? (
                    <div className="p-4 space-y-2">
                      {selectedSimulados.filter(s => !s.scope || s.scope === 'curso').map((sim, idx) => (
                        <div key={idx} className="flex items-center justify-between rounded border border-[#E3E4E5] p-2">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded bg-[#F3F4F6] flex items-center justify-center">
                              {(sim as any)?.kind === 'banco'
                                ? <BookOpen className="h-4 w-4 text-[#0047BB]" />
                                : <Layers className="h-4 w-4 text-[#0047BB]" />
                              }
                            </div>
                            <div>
                              <div className="text-[12px] font-medium text-[#1E1B39]">{sim.title}</div>
                              <div className="text-[11px] text-[#737780]">{(sim as any)?.kind === 'banco' ? 'Banco de Questões' : 'Simulado'} • {sim.questionsCount} questões • <span className="text-[#0047BB] font-medium">{sim.priceLabel}</span></div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => setSelectedSimulados(prev => prev.filter((x) => !(
                              x.id === sim.id &&
                              ((x as any)?.kind || 'simulado') === (((sim as any)?.kind) || 'simulado') &&
                              (x.scope || 'curso') === (sim.scope || 'curso') &&
                              (x.moduleId ?? null) === (sim.moduleId ?? null) &&
                              (x.lessonId ?? null) === (sim.lessonId ?? null)
                            )))}
                          >
                            <Trash2 className="h-4 w-4 text-[#EF4444]" />
                          </Button>
                        </div>
                      ))}
                      {Array.isArray(courseMaterials) ? courseMaterials.map((mat, idx) => (
                        <div key={`course-mat-${String(mat?.id || idx)}`} className="flex items-center justify-between rounded border border-[#E3E4E5] p-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="h-8 w-8 rounded bg-[#F3F4F6] flex items-center justify-center">
                              {materialIcon(mat.type)}
                            </div>
                            <div className="min-w-0">
                              <div className="text-[12px] font-medium text-[#1E1B39] truncate">{mat.name}</div>
                              <div className="text-[11px] text-[#737780]">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded ${materialColor(mat.type)}`}>{String(mat.type).toUpperCase()}</span>
                                {mat.sizeLabel ? <span className="ml-2">{mat.sizeLabel}</span> : null}
                              </div>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => removeCourseMaterial(String(mat?.id || ''))}>
                            <Trash2 className="h-4 w-4 text-[#EF4444]" />
                          </Button>
                        </div>
                      )) : null}
                    </div>
                  ) : (
                    <div className="p-4 text-[12px] text-[#737780]">Nenhum recurso adicionado. Use os cartões acima para conectar.</div>
                  )}
                </div>
                <div className="rounded-[8px] border border-[#E3E4E5] bg-white">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[#E3E4E5]">
                    <span className="text-[13px] font-semibold">Recursos por módulo</span>
                    <div className="flex items-center gap-2">
                      <select
                        className="h-8 rounded-[6px] border border-[#E3E4E5] bg-white px-2 text-[12px] min-w-[150px] outline-none focus:border-[#0047BB]"
                        value={resourceViewModuleId || ''}
                        onChange={(e) => setResourceViewModuleId(e.target.value || null)}
                      >
                        <option value="">Selecione o módulo</option>
                        {modules.map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                      <select
                        className="h-8 rounded-[6px] border border-[#E3E4E5] bg-white px-2 text-[12px] outline-none focus:border-[#0047BB]"
                        value={moduleMaterialAddType}
                        onChange={(e) => setModuleMaterialAddType(e.target.value as any)}
                        disabled={!resourceViewModuleId}
                      >
                        <option value="pdf">PDF</option>
                        <option value="doc">DOC</option>
                        <option value="ppt">PPT</option>
                        <option value="xls">XLS</option>
                        <option value="link">Link</option>
                      </select>
                      <Button
                        variant="outline"
                        className="px-3 py-2 h-8"
                        disabled={!resourceViewModuleId}
                        onClick={() => openExtraMaterialUploader({ scope: 'modulo', moduleId: resourceViewModuleId }, moduleMaterialAddType)}
                      >
                        Adicionar
                      </Button>
                      <Button
                        variant="outline"
                        className="px-3 py-2 h-8"
                        disabled={!resourceViewModuleId}
                        onClick={() => openResourceLibrary({ scope: 'modulo', moduleId: resourceViewModuleId })}
                      >
                        Biblioteca
                      </Button>
                    </div>
                  </div>
                  {resourceViewModuleId ? (
                    (selectedSimulados.filter(s => s.scope === 'modulo' && s.moduleId === resourceViewModuleId).length > 0
                      || (Array.isArray(modules.find(m => m.id === resourceViewModuleId)?.materials) && (modules.find(m => m.id === resourceViewModuleId)?.materials?.length || 0) > 0)
                    ) ? (
                      <div className="p-4 space-y-2">
                        {selectedSimulados.filter(s => s.scope === 'modulo' && s.moduleId === resourceViewModuleId).map((sim, idx) => (
                          <div key={idx} className="flex items-center justify-between rounded border border-[#E3E4E5] p-2">
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded bg-[#F3F4F6] flex items-center justify-center">
                                {(sim as any)?.kind === 'banco'
                                  ? <BookOpen className="h-4 w-4 text-[#0047BB]" />
                                  : <Layers className="h-4 w-4 text-[#0047BB]" />
                                }
                              </div>
                              <div>
                                <div className="text-[12px] font-medium text-[#1E1B39]">{sim.title}</div>
                                <div className="text-[11px] text-[#737780]">{(sim as any)?.kind === 'banco' ? 'Banco de Questões' : 'Simulado'} • {sim.questionsCount} questões • Módulo: {modules.find(m => m.id === sim.moduleId)?.name || 'N/A'} • <span className="text-[#0047BB] font-medium">{sim.priceLabel}</span></div>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => setSelectedSimulados(prev => prev.filter((x) => !(
                                x.id === sim.id &&
                                ((x as any)?.kind || 'simulado') === (((sim as any)?.kind) || 'simulado') &&
                                (x.scope || 'curso') === (sim.scope || 'curso') &&
                                (x.moduleId ?? null) === (sim.moduleId ?? null) &&
                                (x.lessonId ?? null) === (sim.lessonId ?? null)
                              )))}
                            >
                              <Trash2 className="h-4 w-4 text-[#EF4444]" />
                            </Button>
                          </div>
                        ))}
                        {(modules.find(m => m.id === resourceViewModuleId)?.materials || []).map((mat: any, idx: number) => (
                          <div key={`mod-mat-${String(mat?.id || idx)}`} className="flex items-center justify-between rounded border border-[#E3E4E5] p-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="h-8 w-8 rounded bg-[#F3F4F6] flex items-center justify-center">
                                {materialIcon(mat.type)}
                              </div>
                              <div className="min-w-0">
                                <div className="text-[12px] font-medium text-[#1E1B39] truncate">{mat.name}</div>
                                <div className="text-[11px] text-[#737780]">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded ${materialColor(mat.type)}`}>{String(mat.type).toUpperCase()}</span>
                                  {mat.sizeLabel ? <span className="ml-2">{mat.sizeLabel}</span> : null}
                                </div>
                              </div>
                            </div>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => removeModuleMaterial(resourceViewModuleId, String(mat?.id || ''))}>
                              <Trash2 className="h-4 w-4 text-[#EF4444]" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 text-[12px] text-[#737780]">Nenhum recurso adicionado a este módulo.</div>
                    )
                  ) : (
                    <div className="p-4 text-[12px] text-[#737780]">Selecione um módulo para visualizar.</div>
                  )}
                </div>
                <div className="rounded-[8px] border border-[#E3E4E5] bg-white">
                  <div className="flex flex-col gap-3 px-4 py-3 border-b border-[#E3E4E5]">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[13px] font-semibold">Recursos por aula</span>
                      <div className="flex items-center gap-2">
                        <select
                          className="h-8 rounded-[6px] border border-[#E3E4E5] bg-white px-2 text-[12px] outline-none focus:border-[#0047BB]"
                          value={lessonMaterialAddType}
                          onChange={(e) => setLessonMaterialAddType(e.target.value as any)}
                          disabled={!resourceViewLessonMeta}
                        >
                          <option value="pdf">PDF</option>
                          <option value="doc">DOC</option>
                          <option value="ppt">PPT</option>
                          <option value="xls">XLS</option>
                          <option value="link">Link</option>
                        </select>
                        <Button
                          variant="outline"
                          className="px-3 py-2 h-8"
                          disabled={!resourceViewLessonMeta}
                          onClick={() => openExtraMaterialUploader({ scope: 'aula', moduleId: resourceViewLessonMeta?.moduleId, lessonId: resourceViewLessonId }, lessonMaterialAddType)}
                        >
                          Adicionar
                        </Button>
                        <Button
                          variant="outline"
                          className="px-3 py-2 h-8"
                          disabled={!resourceViewLessonMeta}
                          onClick={() => openResourceLibrary({ scope: 'aula', moduleId: resourceViewLessonMeta?.moduleId, lessonId: resourceViewLessonId })}
                        >
                          Biblioteca
                        </Button>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <select
                        className="flex-1 h-8 rounded-[6px] border border-[#E3E4E5] bg-white px-2 text-[12px] outline-none focus:border-[#0047BB]"
                        value={resourceViewLessonId || ''}
                        onChange={(e) => setResourceViewLessonId(e.target.value || null)}
                      >
                        <option value="">Selecione a aula</option>
                        {modules.flatMap(m => m.lessons.map(l => ({...l, moduleName: m.name}))).map(l => (
                          <option key={l.id} value={l.id}>{l.title} ({l.moduleName})</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {resourceViewLessonId ? (
                    (selectedSimulados.filter(s => s.scope === 'aula' && s.lessonId === resourceViewLessonId).length > 0
                      || (Array.isArray(resourceViewLessonMeta?.lesson?.materials) && (resourceViewLessonMeta?.lesson?.materials?.length || 0) > 0)
                    ) ? (
                      <div className="p-4 space-y-2">
                        {selectedSimulados.filter(s => s.scope === 'aula' && s.lessonId === resourceViewLessonId).map((sim, idx) => (
                          <div key={idx} className="flex items-center justify-between rounded border border-[#E3E4E5] p-2">
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded bg-[#F3F4F6] flex items-center justify-center">
                                {(sim as any)?.kind === 'banco'
                                  ? <BookOpen className="h-4 w-4 text-[#0047BB]" />
                                  : <Layers className="h-4 w-4 text-[#0047BB]" />
                                }
                              </div>
                              <div>
                                <div className="text-[12px] font-medium text-[#1E1B39]">{sim.title}</div>
                                <div className="text-[11px] text-[#737780]">{(sim as any)?.kind === 'banco' ? 'Banco de Questões' : 'Simulado'} • {sim.questionsCount} questões • Aula: {modules.find(m => m.id === sim.moduleId)?.lessons.find(l => l.id === sim.lessonId)?.title || 'N/A'} • <span className="text-[#0047BB] font-medium">{sim.priceLabel}</span></div>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => setSelectedSimulados(prev => prev.filter((x) => !(
                                x.id === sim.id &&
                                ((x as any)?.kind || 'simulado') === (((sim as any)?.kind) || 'simulado') &&
                                (x.scope || 'curso') === (sim.scope || 'curso') &&
                                (x.moduleId ?? null) === (sim.moduleId ?? null) &&
                                (x.lessonId ?? null) === (sim.lessonId ?? null)
                              )))}
                            >
                              <Trash2 className="h-4 w-4 text-[#EF4444]" />
                            </Button>
                          </div>
                        ))}
                        {(resourceViewLessonMeta?.lesson?.materials || []).map((mat: any, idx: number) => (
                          <div key={`lesson-mat-${String(mat?.id || idx)}`} className="flex items-center justify-between rounded border border-[#E3E4E5] p-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="h-8 w-8 rounded bg-[#F3F4F6] flex items-center justify-center">
                                {materialIcon(mat.type)}
                              </div>
                              <div className="min-w-0">
                                <div className="text-[12px] font-medium text-[#1E1B39] truncate">{mat.name}</div>
                                <div className="text-[11px] text-[#737780]">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded ${materialColor(mat.type)}`}>{String(mat.type).toUpperCase()}</span>
                                  {mat.sizeLabel ? <span className="ml-2">{mat.sizeLabel}</span> : null}
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => removeLessonMaterialFromList(String(resourceViewLessonMeta?.moduleId || ''), String(resourceViewLessonId || ''), String(mat?.id || ''))}
                            >
                              <Trash2 className="h-4 w-4 text-[#EF4444]" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 text-[12px] text-[#737780]">Nenhum recurso adicionado a esta aula.</div>
                    )
                  ) : (
                    <div className="p-4 text-[12px] text-[#737780]">Selecione uma aula para visualizar.</div>
                  )}
                </div>
                {!isAdvanceButtonHidden('recursos_screen_avancar') && (
                  <div className="flex justify-end mt-6">
                    <Button
                      className="bg-[#0047BB] hover:bg-[#003a99]"
                      onClick={() => {
                        hideAdvanceButton('recursos_screen_avancar')
                        setPhaseDone(prev => ({ ...prev, recursos: true }));
                        setActiveScreen('visual');
                        location.hash = 'visual';
                      }}
                    >
                      Avançar
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ) : activeScreen === 'visual' ? (
            <div className="bg-white rounded-[10px] border border-[#E3E4E5] p-5">
              {/* Bloco didático */}
              <div className="rounded-[8px] bg-gradient-to-br from-[#F8FAFF] to-[#EEF2FF] border border-[#C7D2FE] p-4 mb-4">
                <div className="text-[13px] font-semibold text-[#1E1B39] mb-1">O que fazer nesta etapa</div>
                <ul className="list-disc pl-5 text-[12px] text-[#737780] space-y-1">
                  <li>Envie uma imagem de capa e vídeo de apresentação.</li>
                  <li>Ajuste as cores do tema para combinar com sua marca.</li>
                </ul>
              </div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-[16px] font-bold text-[#1E1B39]">Personalização visual do curso</h2>
                  <p className="text-[12px] text-[#737780]">Configure capa, vídeo, cores e página de vendas</p>
                </div>
              </div>
              <div className="space-y-6">
                <div className="rounded-[8px] border border-[#E3E4E5] bg-white p-4">
                  <div className="text-[13px] font-semibold mb-2">Banner da página do curso</div>
                  <label 
                    className={`relative rounded-[8px] border border-dashed border-[#C7D2FE] bg-[#F8FAFF] ${coverImage ? 'p-0' : 'p-8'} text-center text-[12px] text-[#737780] cursor-pointer hover:bg-[#EEF2FF] transition-colors overflow-hidden flex items-center justify-center min-h-[100px]`}
                    onDragOver={(e) => { e.preventDefault() }}
                    onDrop={(e) => {
                      e.preventDefault()
                      const file = e.dataTransfer.files?.[0]
                      if (file) setCoverImageFromFile(file)
                    }}
                  >
                    {coverImage ? (
                      <>
                        <img src={coverImage} alt="Capa" className="w-full h-auto max-h-[300px] object-cover" />
                        <button 
                          type="button"
                          onClick={handleRemoveCoverImage}
                          className="absolute top-2 right-2 p-1 bg-white/80 rounded-full hover:bg-white text-red-500 transition-colors z-10"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      "Arraste sua imagem aqui ou clique para selecionar"
                    )}
                    <input 
                      ref={coverImageInputRef}
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleCoverImageUpload}
                    />
                  </label>
                  <div className="mt-2 text-[11px] text-[#737780]">Tamanho recomendado: 1200×600 px (JPG/PNG). Máx. 5MB.</div>
                </div>
                <div className="rounded-[8px] border border-[#E3E4E5] bg-white p-4">
                  <div className="text-[13px] font-semibold mb-2">Vídeo da página do curso</div>
                  <label 
                    className={`relative rounded-[8px] border border-dashed border-[#C7D2FE] bg-[#F8FAFF] ${promoVideo ? 'p-0' : 'p-8'} text-center text-[12px] text-[#737780] cursor-pointer hover:bg-[#EEF2FF] transition-colors overflow-hidden flex items-center justify-center min-h-[100px]`}
                    onDragOver={(e) => { e.preventDefault() }}
                    onDrop={(e) => {
                      e.preventDefault()
                      const file = e.dataTransfer.files?.[0]
                      if (file) setPromoVideoFromFile(file)
                    }}
                  >
                    {promoVideo ? (
                      <>
                        <video 
                          src={promoVideo} 
                          className="w-full h-auto max-h-[300px]" 
                          controls 
                          onClick={(e) => e.stopPropagation()} 
                        />
                        <button 
                          type="button"
                          onClick={handleRemovePromoVideo}
                          className="absolute top-2 right-2 p-1 bg-white/80 rounded-full hover:bg-white text-red-500 transition-colors z-10"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      "Arraste seu vídeo aqui ou clique para selecionar"
                    )}
                    <input 
                      ref={promoVideoInputRef}
                      type="file" 
                      accept="video/*" 
                      className="hidden" 
                      onChange={handlePromoVideoUpload}
                    />
                  </label>
                </div>
                <div className="rounded-[8px] border border-[#E3E4E5] bg-white p-4">
                  <div className="text-[13px] font-semibold mb-3">Cores do tema</div>
                  <div className="grid sm:grid-cols-3 gap-4 mb-6">
                    <div className="space-y-1">
                      <label className="text-[12px] text-[#737780]">Cor do texto</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          className="h-10 w-10 rounded-[8px] border border-[#E3E4E5] p-1 cursor-pointer"
                          value={themeTextColor}
                          onChange={(e) => setThemeTextColor(e.target.value)}
                        />
                        <span className="text-[12px] text-[#374151] font-mono uppercase">{themeTextColor}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[12px] text-[#737780]">Botão principal</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          className="h-10 w-10 rounded-[8px] border border-[#E3E4E5] p-1 cursor-pointer"
                          value={themeButtonPrimaryColor}
                          onChange={(e) => setThemeButtonPrimaryColor(e.target.value)}
                        />
                        <span className="text-[12px] text-[#374151] font-mono uppercase">{themeButtonPrimaryColor}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[12px] text-[#737780]">Botão secundário</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          className="h-10 w-10 rounded-[8px] border border-[#E3E4E5] p-1 cursor-pointer"
                          value={themeButtonSecondaryColor}
                          onChange={(e) => setThemeButtonSecondaryColor(e.target.value)}
                        />
                        <span className="text-[12px] text-[#374151] font-mono uppercase">{themeButtonSecondaryColor}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[12px] text-[#737780]">Cor de fundo da página</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          className="h-10 w-10 rounded-[8px] border border-[#E3E4E5] p-1 cursor-pointer"
                          value={themePageBackgroundColor}
                          onChange={(e) => setThemePageBackgroundColor(e.target.value)}
                        />
                        <span className="text-[12px] text-[#374151] font-mono uppercase">{themePageBackgroundColor}</span>
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-[#E3E4E5] pt-4">
                    <div className="text-[12px] font-medium text-[#737780] mb-3">Pré-visualização</div>
                    <div className="rounded-[8px] border border-[#E3E4E5] p-4 max-w-[260px] space-y-3" style={{ backgroundColor: themePageBackgroundColor }}>
                      <div className="text-[12px] text-[#9CA3AF]">Botão principal</div>
                      <Button style={{ backgroundColor: themeButtonPrimaryColor, borderColor: themeButtonPrimaryColor, color: themeTextColor }} className="w-full hover:opacity-90 transition-opacity">
                        Botão Principal
                      </Button>
                      <div className="text-[12px] text-[#9CA3AF]">Botão secundário</div>
                      <Button style={{ backgroundColor: themeButtonSecondaryColor, borderColor: themeButtonSecondaryColor, color: themeTextColor }} className="w-full hover:opacity-90 transition-opacity">
                        Botão Secundário
                      </Button>
                    </div>
                  </div>
                </div>
                {!isAdvanceButtonHidden('visual_screen_avancar') && (
                  <div className="flex justify-end mt-6">
                    <Button
                      className="bg-[#0047BB] hover:bg-[#003a99]"
                      onClick={() => {
                        hideAdvanceButton('visual_screen_avancar')
                        setPhaseDone(prev => ({ ...prev, visual: true }));
                        setActiveScreen('monetizacao');
                        location.hash = 'monetizacao';
                      }}
                    >
                      Avançar
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ) : activeScreen === 'monetizacao' ? (
            <div className="bg-white rounded-[10px] border border-[#E3E4E5] p-5">
              {/* Bloco didático */}
              <div className="rounded-[8px] bg-gradient-to-br from-[#F8FAFF] to-[#EEF2FF] border border-[#C7D2FE] p-4 mb-4">
                <div className="text-[13px] font-semibold text-[#1E1B39] mb-1">O que fazer nesta etapa</div>
                <ul className="list-disc pl-5 text-[12px] text-[#737780] space-y-1">
                  <li>Revise e publique quando estiver pronto.</li>
                </ul>
              </div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-[16px] font-bold text-[#1E1B39]">Monetização e pagamentos</h2>
                  <p className="text-[12px] text-[#737780]">Configure preço, gateway e políticas financeiras</p>
                </div>
                
              </div>
              <div className="space-y-6">
                <div className="rounded-[8px] border border-[#E3E4E5] bg-white p-4">
                  <div className="text-[13px] font-semibold mb-2">Gateway</div>
                  <div className="flex items-center gap-3 text-[12px] text-[#737780]">
                    Mygateway
                  </div>
                  {(() => {
                    const baseP = parseFloat(price.replace('R$', '').trim().replace(/\./g, '').replace(',', '.')) || 0;
                    const resP = selectedSimulados.reduce((acc, sim) => {
                        const pStr = sim.priceLabel.replace('R$', '').trim().replace(/\./g, '').replace(',', '.');
                        const p = parseFloat(pStr);
                        return acc + (isNaN(p) ? 0 : p);
                    }, 0);
                    const total = baseP + resP;
                    const connekt = total > 0 ? (total * 0.0499 + 1) : 0;
                    
                    return (
                      <div className="mt-3 pt-3 border-t border-[#E3E4E5] space-y-1">
                        <div className="text-[12px] font-medium text-[#1E1B39] mb-1">Receita estimada:</div>
                        <div className="flex justify-between items-center text-[12px]">
                          <span className="text-[#737780]">Valor Bruto:</span>
                          <span className="font-semibold text-[#1E1B39]">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[12px]">
                          <span className="text-[#737780]">Taxa da Connekt (4.99% + R$ 1,00):</span>
                          <span className="font-semibold text-[#EF4444]">
                            - {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(connekt)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[12px] pt-1 border-t border-dashed border-[#E3E4E5]">
                          <span className="font-medium text-[#1E1B39]">Líquido Estimado:</span>
                          <span className="font-bold text-[#059669]">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total - connekt)}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                  {selectedSimulados.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-[#E3E4E5] flex justify-between items-center text-[12px]">
                      <span className="text-[#737780]">Total em recursos adicionais:</span>
                      <span className="font-semibold text-[#1E1B39]">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                          selectedSimulados.reduce((acc, sim) => {
                             const priceString = sim.priceLabel.replace('R$', '').trim().replace('.', '').replace(',', '.');
                             const price = parseFloat(priceString);
                             return acc + (isNaN(price) ? 0 : price);
                          }, 0)
                        )}
                      </span>
                    </div>
                  )}
                </div>
                <div className="rounded-[8px] border border-[#E3E4E5] bg-white p-4">
                  <div className="text-[13px] font-semibold mb-2">Preço base do curso</div>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-[12px] text-[#374151]">R$</span>
                    <input 
                      className="h-10 w-full rounded-[8px] border border-[#E3E4E5] pl-8 pr-3 text-[12px]" 
                      placeholder="297,00" 
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                    />
                  </div>
                </div>
                <div className="rounded-[8px] border border-[#E3E4E5] bg-white p-4">
                  <div className="text-[13px] font-semibold mb-2">Recursos adicionais</div>
                  {selectedSimulados.length > 0 ? (
                    <div className="space-y-2">
                      {selectedSimulados.map((sim, idx) => (
                        <div key={idx} className="flex items-center justify-between text-[12px] text-[#374151] border-b border-[#E3E4E5] pb-2 last:border-0 last:pb-0">
                          <span>{sim.title}</span>
                          <span className="font-medium">{sim.priceLabel}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[12px] text-[#737780]">Nenhum recurso adicional detectado.</div>
                  )}
                </div>
                <div className="rounded-[8px] border border-[#E3E4E5] bg-[#F9FAFB] p-4 text-[12px] text-[#374151]">
                  Reembolso: caso seja acionado, será feito diretamente com o produtor após 7 dias.
                </div>
              </div>
            </div>
          ) : null}
        </section>

        {(activeScreen === 'editor' || activeScreen === 'monetizacao') && (
        <aside className="bg-white rounded-[10px] border border-[#E3E4E5] p-2 h-fit shadow-sm block min-h-[120px] sticky top-4 self-start w-[240px] overflow-visible hd:w-[320px]">
          {activeScreen === 'editor' && (
          <>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[14px] font-semibold">Capa do curso</h3>
            <button
              type="button"
              className="text-[12px] font-medium text-[#0047BB] hover:underline"
              onClick={() => setIsCoverGalleryOpen(true)}
            >
              Sugestões
            </button>
          </div>
          <div className="flex justify-center">
            <div className="relative group">
              {moduleLayoutImage ? (
                <CoverCardPreview src={moduleLayoutImage} titleText={(title || '').trim() || 'Nome do curso'} />
              ) : (
                <div
                  className="w-[180px] h-[326px] rounded-[10px] border border-dashed border-[#C7D2FE] bg-[#F8FAFF] flex flex-col items-center justify-center text-[#737780] gap-3 p-6 text-center cursor-pointer hover:bg-[#EEF2FF] transition-colors"
                  onClick={() => moduleLayoutImageInputRef.current?.click()}
                >
                  <div className="h-12 w-12 rounded-full bg-[#EEF2FF] flex items-center justify-center mb-1">
                    <ImageIcon className="h-6 w-6 text-[#0047BB]" />
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold text-[#1E1B39]">Capa do Curso</div>
                    <div className="text-[12px]">Clique para fazer upload <br />ou arraste uma imagem</div>
                  </div>
                </div>
              )}

              {moduleLayoutImage && (
                <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => moduleLayoutImageInputRef.current?.click()}
                    className="bg-white/90 p-1.5 rounded-full hover:bg-white text-gray-700 shadow-sm"
                    title="Alterar imagem"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handleRemoveModuleLayoutImage}
                    className="bg-white/90 p-1.5 rounded-full hover:bg-white text-red-600 shadow-sm"
                    title="Remover imagem"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}

              <input
                type="file"
                ref={moduleLayoutImageInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleModuleLayoutImageUpload}
              />
            </div>
          </div>
          <div className="mt-2 text-center text-[11px] text-[#737780]">Tamanho recomendado: 1080×1920 px (9:16). Máx. 5MB.</div>
          {isCoverGalleryOpen ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {medicalCourseCoverOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className="relative rounded-[8px] overflow-hidden border border-[#E3E4E5] bg-white hover:border-[#0047BB] transition-colors"
                  onClick={() => applyCourseCoverFromGallery(opt.src)}
                  title={opt.label}
                >
                  <img src={opt.src} alt={opt.label} className="h-[56px] w-full object-cover" />
                </button>
              ))}
            </div>
          ) : null}
          </>
          )}

          {activeScreen === 'monetizacao' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-[14px] font-semibold text-[#1E1B39]">Resumo Financeiro</h3>
                <p className="text-[12px] text-[#737780]">Visualização em tempo real dos valores</p>
              </div>

              <div>
                <h4 className="text-[12px] font-semibold text-[#1E1B39] mb-2">Composição do preço</h4>
                <div className="space-y-2">
                   <div className="flex items-center gap-2 rounded-[8px] border border-[#E3E4E5] bg-[#F9FAFB] p-2 text-[12px] text-[#374151]">
                      <Layers className="h-4 w-4 text-[#9CA3AF]" />
                      <span>Módulos: {modules ? modules.length : 0}</span>
                   </div>
                   <div className="flex items-center gap-2 rounded-[8px] border border-[#E3E4E5] bg-[#F9FAFB] p-2 text-[12px] text-[#374151]">
                      <Play className="h-4 w-4 text-[#9CA3AF]" />
                      <span>Aulas adicionadas: {modules ? modules.reduce((acc, m) => acc + (m.lessons?.length || 0), 0) : 0}</span>
                   </div>

                   {showPaidModules ? (
                     <div className="flex items-center justify-between gap-2 rounded-[8px] border border-[#E3E4E5] bg-[#F9FAFB] p-2 text-[12px] text-[#374151]">
                       <span>Módulos pagos: {paidBreakdown.paidModulesCount}</span>
                       <span className="font-semibold text-[#1E1B39]">
                         {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(paidBreakdown.paidModulesTotal)}
                       </span>
                     </div>
                   ) : null}

                   {showPaidLessons ? (
                     <div className="flex items-center justify-between gap-2 rounded-[8px] border border-[#E3E4E5] bg-[#F9FAFB] p-2 text-[12px] text-[#374151]">
                       <span>Aulas pagas: {paidBreakdown.paidLessonsCount}</span>
                       <span className="font-semibold text-[#1E1B39]">
                         {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(paidBreakdown.paidLessonsTotal)}
                       </span>
                     </div>
                   ) : null}
                   
                   {selectedSimulados && selectedSimulados.length > 0 && (
                     <div className="rounded-[8px] border border-[#E3E4E5] bg-[#F9FAFB] p-2">
                        <div className="text-[12px] text-[#737780] mb-2">{selectedSimulados.length} Recursos extras</div>
                        <div className="space-y-2">
                          {selectedSimulados.map((sim, i) => (
                            <div key={i} className="flex items-center gap-2 text-[12px] text-[#374151]">
                               <FileText className="h-4 w-4 text-[#F59E0B]" />
                               <span>{sim.title}</span>
                            </div>
                          ))}
                        </div>
                     </div>
                   )}
                </div>
              </div>

              <div className="rounded-[8px] border border-[#E3E4E5] bg-[#F9FAFB] p-4 text-center">
                 <div className="text-[11px] text-[#737780] mb-1">Valor total do curso</div>
                 <div className="text-[18px] font-bold text-[#1E1B39]">
                   {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                      monetizacaoTotalValue
                   )}
                 </div>
              </div>

              <div>
                <h4 className="text-[12px] font-semibold text-[#1E1B39] mb-2">Gateway</h4>
                <div className="rounded-[8px] border border-[#E3E4E5] bg-[#F9FAFB] p-3 flex items-center gap-3">
                   <div className="h-8 w-8 rounded bg-white border border-[#E3E4E5] flex items-center justify-center text-[10px] font-bold text-[#6366F1]">MG</div>
                   <div className="flex-1">
                     <div className="text-[12px] font-semibold text-[#1E1B39]">MyGateway</div>
                   </div>
                </div>
              </div>

              <div>
                 <h4 className="text-[12px] font-semibold text-[#1E1B39] mb-2">Receita estimada</h4>
                 <div className="space-y-2 text-[12px]">
                   <div className="flex justify-between text-[#737780]">
                     <span>Valor Bruto</span>
                     <span className="font-medium text-[#1E1B39]">
                       {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                          monetizacaoTotalValue
                       )}
                     </span>
                   </div>
                   <div className="flex justify-between text-[#EF4444]">
                     <span>Taxa da Connekt</span>
                     <span>
                       - {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                          monetizacaoFee
                       )}
                     </span>
                   </div>
                 </div>
              </div>

              <div className="rounded-[8px] bg-[#ECFDF5] border border-[#D1FAE5] p-4 text-center">
                 <div className="text-[11px] text-[#065F46] mb-1">Você recebe:</div>
                 <div className="text-[20px] font-bold text-[#059669]">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                      monetizacaoNet
                    )}
                 </div>
              </div>
              
            </div>
          )}
        </aside>
        )}
      </div>
      </div>
      {/* Barra fixa de navegação inferior removida conforme solicitação */}
      </div>
    </div>
  )
}
