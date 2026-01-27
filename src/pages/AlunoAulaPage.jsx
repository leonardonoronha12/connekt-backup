import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, ChevronLeft, ChevronRight, Database, Download, ExternalLink, FileSpreadsheet, FileText, FileType, GraduationCap, Heart, Link as LinkIcon, Menu, Monitor, Settings, X } from 'lucide-react'
import { useAuth } from '@/contexts/SupabaseAuthContext'
import { toast } from '@/components/ui/use-toast'
import { Switch } from '@/components/ui/switch.jsx'
import Header from '@/components/Header'
import CourseFooter from '@/components/CourseFooter'
import { supabase } from '@/lib/supabaseClient'
import { fetchConversationFeed } from '@/services/conversationService'
import { useActiveProducerUserId } from '@/hooks/useActiveProducerUserId'

const DEMO_PROMO_VIDEO_URL = ''

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

function parseJsonMaybe(value) {
  if (!value) return null
  if (typeof value === 'object') return value
  if (typeof value !== 'string') return null
  try { return JSON.parse(value) } catch (_) { return null }
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

function pickModuleAndLesson(courseRow, { moduleId, moduleIndex, lessonId, lessonIndex }) {
  const modules = getCourseModules(courseRow)
  const list = Array.isArray(modules) ? modules : []

  const moduleIndexNum = (() => {
    const n = Number(moduleIndex)
    return Number.isFinite(n) ? n : -1
  })()
  const lessonIndexNum = (() => {
    const n = Number(lessonIndex)
    return Number.isFinite(n) ? n : -1
  })()

  const targetModuleId = String(moduleId || '').trim()
  const targetLessonId = String(lessonId || '').trim()

  let pickedModule = null
  let pickedModuleIndex = -1

  if (targetModuleId) {
    for (let i = 0; i < list.length; i += 1) {
      const mid = String(list[i]?.id || list[i]?.module_id || list[i]?.moduleId || '').trim()
      if (mid && mid === targetModuleId) {
        pickedModule = list[i]
        pickedModuleIndex = i
        break
      }
    }
  }

  if (!pickedModule && targetLessonId) {
    for (let i = 0; i < list.length; i += 1) {
      const lessons = getModuleLessons(list[i])
      for (const l of (Array.isArray(lessons) ? lessons : [])) {
        const lid = String(l?.id || l?.lesson_id || l?.lessonId || '').trim()
        if (lid && lid === targetLessonId) {
          pickedModule = list[i]
          pickedModuleIndex = i
          break
        }
      }
      if (pickedModule) break
    }
  }

  if (!pickedModule && moduleIndexNum >= 0) {
    pickedModule = list[moduleIndexNum] || null
    pickedModuleIndex = moduleIndexNum
  }

  if (!pickedModule) {
    pickedModule = list[0] || null
    pickedModuleIndex = list.length > 0 ? 0 : -1
  }

  const lessons = getModuleLessons(pickedModule)
  const lessonsList = Array.isArray(lessons) ? lessons : []

  let pickedLesson = null
  let pickedLessonIndex = -1
  if (targetLessonId) {
    for (let j = 0; j < lessonsList.length; j += 1) {
      const lid = String(lessonsList[j]?.id || lessonsList[j]?.lesson_id || lessonsList[j]?.lessonId || '').trim()
      if (lid && lid === targetLessonId) {
        pickedLesson = lessonsList[j]
        pickedLessonIndex = j
        break
      }
    }
  }
  if (!pickedLesson && lessonIndexNum >= 0) {
    pickedLesson = lessonsList[lessonIndexNum] || null
    pickedLessonIndex = lessonIndexNum
  }
  if (!pickedLesson) {
    pickedLesson = lessonsList[0] || null
    pickedLessonIndex = lessonsList.length > 0 ? 0 : -1
  }

  const resolvedModuleId = String(pickedModule?.id || pickedModule?.module_id || pickedModule?.moduleId || '').trim()
  const resolvedLessonId = String(pickedLesson?.id || pickedLesson?.lesson_id || pickedLesson?.lessonId || '').trim()

  return {
    module: pickedModule,
    moduleIndex: pickedModuleIndex,
    moduleId: resolvedModuleId,
    lessons: lessonsList,
    lesson: pickedLesson,
    lessonIndex: pickedLessonIndex,
    lessonId: resolvedLessonId,
  }
}

function getCourseMeta(row) {
  const fromData = parseJsonMaybe(row?.data) || null
  const parsedModules = parseJsonMaybe(row?.modules) || null
  const fromModulesMeta = parsedModules && typeof parsedModules === 'object' ? (parsedModules.meta || null) : null
  return { ...(fromModulesMeta || {}), ...(fromData || {}) }
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0
}

function lessonProgressKey({ courseId, moduleId, moduleIndex, lessonId, lessonIndex }) {
  const cid = String(courseId || '').trim()
  if (!cid) return ''
  const modKey = String(moduleId || '').trim() || `idx:${String(moduleIndex || '').trim() || '0'}`
  const lesKey = String(lessonId || '').trim() || `idx:${String(lessonIndex || '').trim() || '0'}`
  return `connekt_progress:${cid}:${modKey}:${lesKey}`
}

function safeLsGet(key) {
  if (!key) return ''
  try { return String(localStorage.getItem(key) || '') } catch (_) { return '' }
}

function safeLsSet(key, value) {
  if (!key) return
  try { localStorage.setItem(key, String(value)) } catch (_) {}
}

function toPublicCoursesMediaUrl(value) {
  const raw = value == null ? '' : String(value)
  if (!raw) return null
  if (raw.startsWith('data:')) return raw
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw
  if (raw.includes('/')) {
    const { data } = supabase.storage.from('courses-media').getPublicUrl(raw)
    return data?.publicUrl || null
  }
  return raw
}

function vimeoEmbedUrlFromAny(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const idFromUri = raw.match(/^\/videos\/(\d+)/i)?.[1]
  if (idFromUri) return `https://player.vimeo.com/video/${idFromUri}`
  if (raw.includes('player.vimeo.com/video/')) return raw
  const idFromPlayer = raw.match(/player\.vimeo\.com\/video\/(\d+)/i)?.[1]
  if (idFromPlayer) return `https://player.vimeo.com/video/${idFromPlayer}`
  const idFromUrl = raw.match(/vimeo\.com\/(?:video\/)?(\d+)/i)?.[1]
  if (idFromUrl) return `https://player.vimeo.com/video/${idFromUrl}`
  return ''
}

function youtubeEmbedUrlFromAny(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  try {
    const u = new URL(raw)
    if (u.hostname.includes('youtu.be')) {
      const id = u.pathname.replace('/', '').trim()
      return id ? `https://www.youtube.com/embed/${id}` : ''
    }
    if (u.hostname.includes('youtube.com')) {
      const id = u.searchParams.get('v') || ''
      return id ? `https://www.youtube.com/embed/${id}` : ''
    }
  } catch (_) {}
  const m = raw.match(/(?:youtu\.be\/|youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{6,})/i)?.[1]
  return m ? `https://www.youtube.com/embed/${m}` : ''
}

function isSupabaseStorageUrl(u) {
  try { return String(u || '').includes('.supabase.co/storage/v1/object/') } catch (_) { return false }
}

function ProgressRing({ value }) {
  const p = Math.max(0, Math.min(100, Number(value || 0)))
  const size = 28
  const stroke = 3
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const dash = (p / 100) * c
  return (
    <div className="relative w-7 h-7">
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
      <div className="absolute inset-0 flex items-center justify-center text-[9px] font-semibold text-[#22252B]">{p}%</div>
    </div>
  )
}

function NpsModal({ open, onClose, onSubmit }) {
  const [rating, setRating] = useState(null)
  const [comment, setComment] = useState('')
  const [allowContact, setAllowContact] = useState(false)

  useEffect(() => {
    if (!open) return
    setRating(null)
    setComment('')
    setAllowContact(false)
  }, [open])

  if (!open) return null

  const options = [
    { id: 1, label: 'Péssimo', color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
    { id: 2, label: 'Ruim', color: '#F97316', bg: 'rgba(249,115,22,0.12)' },
    { id: 3, label: 'Neutro', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
    { id: 4, label: 'Bom', color: '#22C55E', bg: 'rgba(34,197,94,0.12)' },
    { id: 5, label: 'Excelente', color: '#16A34A', bg: 'rgba(22,163,74,0.12)' },
  ]

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-[420px] rounded-[12px] border border-[#E3E4E5] bg-white shadow-xl">
        <div className="px-5 py-4 border-b border-[#E3E4E5] flex items-center justify-between">
          <div className="text-[12px] font-semibold text-[#22252B]">Avaliação e melhorias</div>
          <button type="button" className="w-8 h-8 rounded-full hover:bg-[#F3F4F5] flex items-center justify-center" onClick={onClose} aria-label="Fechar">
            <X className="w-4 h-4 text-[#737780]" />
          </button>
        </div>

        <div className="px-5 py-4">
          <div className="text-[11px] text-[#737780]">Como você descreveria sua experiência com essa aula que acabou de assistir?</div>
          <div className="mt-3 grid grid-cols-5 gap-2">
            {options.map((opt) => {
              const active = rating === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setRating(opt.id)}
                  className={`rounded-[10px] border px-2 py-2 flex flex-col items-center gap-2 ${active ? 'border-[#0047BB]' : 'border-[#E3E4E5]'}`}
                  style={{ backgroundColor: active ? 'rgba(0,71,187,0.06)' : 'white' }}
                >
                  <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: opt.bg, color: opt.color }}>
                    <span className="text-[12px] font-bold">{opt.id}</span>
                  </div>
                  <div className="text-[10px] font-medium text-[#737780]">{opt.label}</div>
                </button>
              )
            })}
          </div>

          <div className="mt-4">
            <div className="text-[11px] font-medium text-[#737780]">Conte mais sua sobre sua experiência (opcional)</div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="mt-2 w-full min-h-[90px] rounded-[10px] border border-[#E3E4E5] bg-white px-3 py-2 text-[12px] outline-none focus:border-[#0047BB]"
              placeholder="Escreva aqui..."
              maxLength={300}
            />
            <div className="mt-1 text-right text-[10px] text-[#9291A5]">{comment.length}/300</div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-4">
            <div className="text-[11px] text-[#737780]">
              Eu autorizo a Connekt a entrar em contato comigo com base no meu feedback.
            </div>
            <Switch checked={allowContact} onCheckedChange={setAllowContact} />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-[#E3E4E5] flex items-center justify-end gap-2">
          <button type="button" className="h-9 px-4 rounded-[8px] border border-[#E3E4E5] bg-white text-[12px] font-semibold text-[#22252B]" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="h-9 px-4 rounded-[8px] bg-[#0047BB] text-white text-[12px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!rating}
            onClick={() => onSubmit({ rating, comment, allowContact })}
          >
            Enviar avaliação
          </button>
        </div>
      </div>
    </div>
  )
}

function AttachmentsPanel({ courseId, moduleId, lessonId, lessonKey, demo }) {
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState([])
  const [producerId, setProducerId] = useState('')
  const [resolvingById, setResolvingById] = useState({})

  const toPublicCoursesMediaUrl = (value) => {
    const raw = value == null ? '' : String(value)
    if (!raw) return null
    if (raw.startsWith('data:')) return raw
    if (raw.startsWith('http://') || raw.startsWith('https://')) return raw
    const marker = '/storage/v1/object/sign/courses-media/'
    const idx = raw.indexOf(marker)
    if (idx >= 0) {
      const withoutQuery = raw.split('?')[0] || ''
      const path = withoutQuery.slice(idx + marker.length)
      const { data } = supabase.storage.from('courses-media').getPublicUrl(path)
      return data?.publicUrl || null
    }
    if (raw.includes('/')) {
      const { data } = supabase.storage.from('courses-media').getPublicUrl(raw)
      return data?.publicUrl || null
    }
    return raw
  }

  const resolveMaterialDownloadUrl = async ({ courseId, producerId, filename }) => {
    const name = String(filename || '').trim()
    const cid = String(courseId || '').trim()
    const pid = String(producerId || '').trim()
    if (!name || !cid || !pid) return null

    if (name.startsWith('http://') || name.startsWith('https://') || name.startsWith('data:')) return name
    if (name.includes('/')) return toPublicCoursesMediaUrl(name)

    try {
      const { data } = await supabase.auth.getSession()
      const token = data?.session?.access_token || ''
      if (token) {
        const r = await fetch(`/api/resolve-course-media?courseId=${encodeURIComponent(cid)}&producerId=${encodeURIComponent(pid)}&lessonId=${encodeURIComponent(String(lessonId || ''))}&filename=${encodeURIComponent(name)}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const body = await r.json().catch(() => ({}))
        if (r.ok && body?.url) return String(body.url)
      }
    } catch (_) {}

    const root = `users/${pid}/courses/${cid}`
    const folders = ['materials', 'material', 'anexos', 'attachments', 'files', 'docs', 'lessons', 'aulas', '']
    const checkExists = async (url) => {
      try {
        const res = await fetch(String(url), { method: 'GET', headers: { Range: 'bytes=0-0' } })
        return res.ok
      } catch (_) {}
      return false
    }

    const candidates = []
    for (const f of folders) {
      const base = f ? `${root}/${f}` : root
      if (f === 'lessons' || f === 'aulas') {
        if (lessonId) {
          candidates.push(`${base}/${lessonId}/${name}`)
          candidates.push(`${base}/${lessonId}/materials/${name}`)
          candidates.push(`${base}/${lessonId}/anexos/${name}`)
        }
        continue
      }
      candidates.push(`${base}/${name}`)
    }

    for (const path of candidates) {
      try {
        const { data: pub } = supabase.storage.from('courses-media').getPublicUrl(path)
        const url = pub?.publicUrl || null
        if (!url) continue
        if (await checkExists(url)) return url
      } catch (_) {}
    }

    return null
  }

  const parseJsonMaybe = (value) => {
    if (!value) return null
    if (typeof value === 'object') return value
    if (typeof value !== 'string') return null
    try { return JSON.parse(value) } catch (_) { return null }
  }

  const getModulesFromCourse = (row) => {
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

  const normalizeMaterialType = (t) => {
    const key = String(t || '').toLowerCase()
    if (key === 'pdf' || key === 'doc' || key === 'ppt' || key === 'xls' || key === 'link') return key
    return 'pdf'
  }

  const materialIcon = (t) => {
    const key = normalizeMaterialType(t)
    const cls = 'h-4 w-4 text-[#9291A5]'
    if (key === 'xls') return <FileSpreadsheet className={cls} />
    if (key === 'ppt') return <FileType className={cls} />
    if (key === 'link') return <LinkIcon className={cls} />
    return <FileText className={cls} />
  }

  const materialPill = (t) => {
    const key = normalizeMaterialType(t)
    if (key === 'pdf') return 'bg-[#FDE2E4] text-[#B91C1C]'
    if (key === 'doc') return 'bg-[#DBEAFE] text-[#1D4ED8]'
    if (key === 'xls') return 'bg-[#DCFCE7] text-[#166534]'
    if (key === 'ppt') return 'bg-[#EDE9FE] text-[#6D28D9]'
    return 'bg-[#F3F4F6] text-[#374151]'
  }

  useEffect(() => {
    let active = true
    const run = async () => {
      setLoading(true)
      try {
        if (!courseId) {
          if (demo) {
            const demoItems = [
              { id: 'm1', type: 'pdf', name: 'Checklist - Aula 03.pdf', sizeLabel: '1.2MB', url: '/Preview.png' },
              { id: 'm2', type: 'doc', name: 'Resumo - Prática clínica.doc', sizeLabel: '420KB', url: '/Preview.png' },
              { id: 'm3', type: 'link', name: 'https://connekt.com.br/material', sizeLabel: '', url: 'https://connekt.com.br/material' },
            ]
            if (active) setItems(demoItems)
          } else if (active) setItems([])
          return
        }

        const { data, error } = await supabase.from('courses').select('id,user_id,modules,data').eq('id', courseId).maybeSingle()
        if (error) throw error
        const mods = getModulesFromCourse(data)
        const mod = (Array.isArray(mods) ? mods : []).find((m) => String(m?.id || '') === String(moduleId || '')) || mods[0] || null
        const lessons = Array.isArray(mod?.lessons) ? mod.lessons : []
        const lesson = lessons.find((l) => String(l?.id || '') === String(lessonId || '')) || lessons[0] || null
        const materials = Array.isArray(lesson?.materials) ? lesson.materials : []
        const pid = String(data?.user_id || '').trim()
        if (active) setProducerId(pid)
        const mapped = await Promise.all(materials.map(async (m, idx) => {
          const type = normalizeMaterialType(m?.type)
          const rawName = String(m?.name || '').trim() || `Material ${idx + 1}`
          const direct =
            type === 'link'
              ? (rawName.startsWith('http') ? rawName : null)
              : (toPublicCoursesMediaUrl(m?.url) || toPublicCoursesMediaUrl(m?.path) || null)
          const url = direct || (type === 'link' ? null : await resolveMaterialDownloadUrl({ courseId, producerId: pid, filename: rawName }))
          return { id: String(m?.id || `mat-${idx}`), type, name: rawName, sizeLabel: String(m?.sizeLabel || ''), url }
        }))
        if (active) setItems(mapped)
      } catch (_) {
        if (demo) {
          const demoItems = [
            { id: 'm1', type: 'pdf', name: 'Checklist - Aula 03.pdf', sizeLabel: '1.2MB', url: '/Preview.png' },
            { id: 'm2', type: 'doc', name: 'Resumo - Prática clínica.doc', sizeLabel: '420KB', url: '/Preview.png' },
          ]
          if (active) setItems(demoItems)
        } else if (active) setItems([])
      } finally {
        if (active) setLoading(false)
      }
    }
    run()
    return () => { active = false }
  }, [courseId, moduleId, lessonId, demo])

  const downloadItem = async (m) => {
    const id = String(m?.id || '')
    if (!id) return
    if (resolvingById[id]) return
    const type = String(m?.type || '').toLowerCase()
    const name = String(m?.name || '').trim() || 'arquivo'
    if (type === 'link') return
    const cid = String(courseId || '').trim()
    const pid = String(producerId || '').trim()
    if (!cid || !pid || !name) return
    setResolvingById((prev) => ({ ...(prev || {}), [id]: true }))
    try {
      const resolved = m?.url || await resolveMaterialDownloadUrl({ courseId: cid, producerId: pid, filename: name })
      if (!resolved) throw new Error('Não foi possível localizar o arquivo.')
      setItems((prev) => (Array.isArray(prev) ? prev.map((it) => (String(it?.id || '') === id ? { ...it, url: resolved } : it)) : prev))
      const a = document.createElement('a')
      a.href = String(resolved)
      a.download = name
      a.rel = 'noreferrer'
      a.target = '_blank'
      document.body.appendChild(a)
      a.click()
      a.remove()
    } catch (e) {
      toast({ title: 'Não foi possível baixar', description: String(e?.message || 'Tente novamente.') })
    } finally {
      setResolvingById((prev) => ({ ...(prev || {}), [id]: false }))
    }
  }

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between">
        <div className="text-[12px] font-semibold text-[#22252B]">Anexos</div>
        <div className="text-[11px] text-[#737780]">{items.length} anexos</div>
      </div>

      <div className="mt-3 rounded-[10px] border border-[#E3E4E5] bg-white overflow-hidden">
        {loading ? (
          <div className="p-4 text-[12px] text-[#737780]">Carregando...</div>
        ) : items.length === 0 ? (
          <div className="p-4 text-[12px] text-[#737780]">Nenhum anexo nesta aula.</div>
        ) : (
          <div className="divide-y divide-[#F3F4F5]">
            {items.map((m) => (
              <div key={m.id} className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-[10px] border border-[#E3E4E5] bg-white flex items-center justify-center">
                    {materialIcon(m.type)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[12px] font-semibold text-[#22252B] truncate">{m.name}</div>
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-[#737780]">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded ${materialPill(m.type)}`}>{String(m.type).toUpperCase()}</span>
                      {m.sizeLabel ? <span>{m.sizeLabel}</span> : <span />}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {m.url ? (
                    <>
                      <a
                        href={m.url}
                        target={m.type === 'link' ? '_blank' : undefined}
                        rel={m.type === 'link' ? 'noreferrer' : undefined}
                        download={m.type === 'link' ? undefined : String(m.name || 'arquivo')}
                        className="h-9 px-3 rounded-[8px] border border-[#E3E4E5] bg-white text-[12px] font-semibold text-[#22252B] inline-flex items-center gap-2"
                      >
                        {m.type === 'link' ? <ExternalLink className="w-4 h-4 text-[#737780]" /> : <Download className="w-4 h-4 text-[#737780]" />}
                        {m.type === 'link' ? 'Abrir' : 'Baixar'}
                      </a>
                    </>
                  ) : (
                    <button
                      type="button"
                      className={`h-9 px-3 rounded-[8px] border border-[#E3E4E5] bg-white text-[12px] font-semibold text-[#22252B] inline-flex items-center gap-2 cursor-pointer ${resolvingById[String(m.id || '')] ? 'opacity-50 cursor-wait' : ''}`}
                      onClick={() => downloadItem(m)}
                    >
                      <Download className="w-4 h-4 text-[#737780]" />
                      {resolvingById[String(m.id || '')] ? 'Carregando…' : 'Baixar'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CommentsPanel({ user, studentName, lessonKey }) {
  const [loading, setLoading] = useState(false)
  const [conversationId, setConversationId] = useState(null)
  const [posts, setPosts] = useState([])
  const [composer, setComposer] = useState('')
  const [openRepliesById, setOpenRepliesById] = useState({})
  const composerRef = useRef(null)

  const demoKey = useMemo(() => `connekt_aluno_aula_comments_${lessonKey}`, [lessonKey])

  const loadDemo = () => {
    try {
      const raw = localStorage.getItem(demoKey)
      const parsed = raw ? JSON.parse(raw) : null
      const list = Array.isArray(parsed) ? parsed : []
      setPosts(list)
    } catch (_) {
      setPosts([])
    }
  }

  const saveDemo = (list) => {
    try {
      localStorage.setItem(demoKey, JSON.stringify(list))
    } catch (_) {}
  }

  const insertWithColumnPrune = async (table, initialPayload, maxAttempts = 10) => {
    let payload = { ...(initialPayload || {}) }
    for (let i = 0; i < maxAttempts; i += 1) {
      const { data, error } = await supabase.from(table).insert(payload).select('id').single()
      if (!error) return { data, error: null }
      const msg = String(error?.message || '')
      const isMissingColumn = msg.toLowerCase().includes('does not exist') && msg.toLowerCase().includes('column')
      if (!isMissingColumn) return { data: null, error }
      const m = msg.match(/column \"([^\"]+)\"/i)
      const col = m?.[1]
      if (!col || !(col in payload)) return { data: null, error }
      delete payload[col]
    }
    return { data: null, error: new Error('Insert failed after pruning columns') }
  }

  const resolveStudentId = async () => {
    const email = String(user?.email || '').trim().toLowerCase()
    if (!email) return null

    const attempts = [
      () => supabase.from('students').select('id').eq('user_id', user.id).maybeSingle(),
      () => supabase.from('students').select('id').eq('email', email).maybeSingle(),
      () => supabase.from('students').select('id').eq('external_id', user.id).maybeSingle(),
    ]

    for (const fn of attempts) {
      try {
        const { data, error } = await fn()
        if (!error && data?.id) return data.id
      } catch (_) {}
    }

    const payload = {
      user_id: user.id,
      external_id: user.id,
      name: String(studentName || 'Aluno'),
      email,
      avatar_url: null,
    }
    const { data } = await insertWithColumnPrune('students', payload, 8)
    return data?.id || null
  }

  const resolveProducerId = async () => {
    const params = new URLSearchParams(window.location.search || '')
    const producerUserId = params.get('producer_uid') || params.get('producerUserId') || ''
    if (producerUserId) {
      try {
        const { data } = await supabase
          .from('producers')
          .select('id')
          .or(`id.eq.${producerUserId},external_id.eq.${producerUserId}`)
          .maybeSingle()
        if (data?.id) return data.id
      } catch (_) {}
    }

    const courseId = params.get('courseId') || params.get('cursoId') || ''
    if (courseId) {
      try {
        const { data } = await supabase.from('courses').select('user_id').eq('id', courseId).maybeSingle()
        const userId = data?.user_id
        if (userId) {
          const { data: prod } = await supabase
            .from('producers')
            .select('id')
            .or(`id.eq.${userId},external_id.eq.${userId}`)
            .maybeSingle()
          if (prod?.id) return prod.id
        }
      } catch (_) {}
    }

    const producerExternalId = params.get('producer_id') || params.get('producerId') || ''
    if (producerExternalId) {
      try {
        const { data } = await supabase.from('producers').select('id').eq('external_id', producerExternalId).maybeSingle()
        if (data?.id) return data.id
      } catch (_) {}
    }

    try {
      const { data } = await supabase.from('producers').select('id').limit(1)
      const first = Array.isArray(data) ? data[0] : null
      return first?.id || null
    } catch (_) {
      return null
    }
  }

  const ensureConversation = async () => {
    const studentId = await resolveStudentId()
    const producerId = await resolveProducerId()
    if (!studentId || !producerId) return null

    const subject = `Comentários - ${lessonKey}`
    try {
      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .eq('producer_id', producerId)
        .eq('student_id', studentId)
        .eq('subject', subject)
        .maybeSingle()

      if (existing?.id) return existing.id
    } catch (_) {}

    const payload = {
      producer_id: producerId,
      student_id: studentId,
      subject,
      tag: 'Curso',
      unread: 0,
      date: new Date().toISOString(),
    }
    const { data } = await insertWithColumnPrune('conversations', payload, 10)
    return data?.id || null
  }

  const refresh = async () => {
    setLoading(true)
    try {
      if (!user?.id) {
        loadDemo()
        return
      }
      let id = conversationId
      if (!id) {
        id = await ensureConversation()
        setConversationId(id)
      }
      if (!id) {
        loadDemo()
        return
      }
      const feed = await fetchConversationFeed(id, { limit: 50, offset: 0 })
      const mapped = (feed || []).map((p) => ({
        id: p.id,
        text: p.content,
        created_at: p.created_at,
        likes: Number(p.likes || 0),
        liked: !!p.liked,
        replies: Array.isArray(p.replies) ? p.replies : [],
      }))
      setPosts(mapped)
    } catch (_) {
      loadDemo()
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleLikePost = async (postId) => {
    const post = posts.find((p) => p.id === postId)
    if (!post) return
    const nextLiked = !post.liked
    const nextLikes = nextLiked ? post.likes + 1 : Math.max(0, post.likes - 1)
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, liked: nextLiked, likes: nextLikes } : p)))

    if (!user?.id || !conversationId) {
      const next = posts.map((p) => (p.id === postId ? { ...p, liked: nextLiked, likes: nextLikes } : p))
      saveDemo(next)
      return
    }

    try {
      await supabase.from('posts').update({ likes: nextLikes, liked: nextLiked }).eq('id', postId)
    } catch (_) {}
  }

  const handleSubmit = async () => {
    const text = composer.trim()
    if (!text) return

    if (!user?.id) {
      const next = [
        {
          id: `demo-${Date.now()}`,
          text,
          created_at: new Date().toISOString(),
          likes: 0,
          liked: false,
          replies: [],
        },
        ...posts,
      ]
      setPosts(next)
      saveDemo(next)
      setComposer('')
      return
    }

    let id = conversationId
    if (!id) {
      id = await ensureConversation()
      setConversationId(id)
    }
    if (!id) {
      const next = [
        {
          id: `demo-${Date.now()}`,
          text,
          created_at: new Date().toISOString(),
          likes: 0,
          liked: false,
          replies: [],
        },
        ...posts,
      ]
      setPosts(next)
      saveDemo(next)
      setComposer('')
      return
    }

    try {
      const { data, error } = await supabase
        .from('posts')
        .insert([{ conversation_id: id, content: text, likes: 0, liked: false }])
        .select('id,content,created_at,likes,liked')
        .single()
      if (error) throw error
      setPosts((prev) => [
        {
          id: data.id,
          text: data.content,
          created_at: data.created_at,
          likes: Number(data.likes || 0),
          liked: !!data.liked,
          replies: [],
        },
        ...prev,
      ])
      setComposer('')
      toast({ title: 'Comentário enviado' })
    } catch (_) {
      toast({ title: 'Erro ao enviar', description: 'Tente novamente.' })
    }
  }

  const commentsCount = posts.length

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <div className="text-[12px] font-semibold text-[#22252B]">Comentários</div>
        <div className="text-[11px] text-[#737780]">{commentsCount} Comentários</div>
      </div>

      <div className="mt-3 rounded-[10px] border border-[#E3E4E5] bg-white p-4">
        <textarea
          ref={composerRef}
          value={composer}
          onChange={(e) => setComposer(e.target.value)}
          className="w-full min-h-[96px] rounded-[10px] border border-[#E3E4E5] bg-white px-3 py-2 text-[12px] outline-none focus:border-[#0047BB]"
          placeholder="Digite aqui sua pergunta ou comentário"
          maxLength={600}
        />
        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            className="h-9 px-4 rounded-[8px] border border-[#E3E4E5] bg-white text-[12px] font-semibold text-[#22252B]"
            onClick={() => setComposer('')}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="h-9 px-4 rounded-[8px] bg-[#0047BB] text-white text-[12px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!composer.trim() || loading}
            onClick={handleSubmit}
          >
            Comentar
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {loading ? <div className="text-[12px] text-[#737780]">Carregando...</div> : null}
        {posts.map((p) => {
          const replies = Array.isArray(p.replies) ? p.replies : []
          const open = !!openRepliesById[p.id]
          return (
            <div key={p.id} className="rounded-[10px] border border-[#E3E4E5] bg-white p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-[#F3F4F5] border border-[#E3E4E5] flex items-center justify-center text-[#0047BB] font-bold text-[12px]">
                  {String(studentName || 'A').slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="text-[12px] font-semibold text-[#22252B]">{studentName || 'Aluno'}</div>
                  <div className="mt-1 text-[12px] text-[#737780] leading-[18px]">{p.text}</div>
                  <div className="mt-3 flex items-center gap-3 text-[11px] text-[#737780]">
                    <button type="button" className="inline-flex items-center gap-1 hover:text-[#22252B]" onClick={() => handleLikePost(p.id)}>
                      <Heart className={`w-4 h-4 ${p.liked ? 'text-[#EF4444]' : 'text-[#737780]'}`} />
                      Curtir {p.likes ? `(${p.likes})` : ''}
                    </button>
                    {replies.length ? (
                      <button
                        type="button"
                        className="hover:text-[#22252B]"
                        onClick={() => setOpenRepliesById((s) => ({ ...s, [p.id]: !open }))}
                      >
                        {open ? 'Ocultar' : 'Ver'} {replies.length} respostas
                      </button>
                    ) : null}
                  </div>

                  {replies.length && open ? (
                    <div className="mt-3 pl-5 border-l border-[#E3E4E5] space-y-3">
                      {replies.map((r) => (
                        <div key={r.id} className="flex items-start gap-3">
                          <div className="w-7 h-7 rounded-full bg-[#F3F4F5] border border-[#E3E4E5] flex items-center justify-center text-[#22252B] font-bold text-[11px]">
                            {String(r?.author?.name || 'P').slice(0, 1).toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <div className="text-[12px] font-semibold text-[#22252B]">{r?.author?.name || 'Professor'}</div>
                            <div className="mt-1 text-[12px] text-[#737780] leading-[18px]">{r.content}</div>
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="mt-2 text-[11px] font-semibold text-[#0047BB]"
                        onClick={() => {
                          setComposer((prev) => prev || '@Professor ')
                          window.setTimeout(() => composerRef.current?.focus?.(), 0)
                        }}
                      >
                        Responder
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function LessonStatusIcon({ completed }) {
  if (completed) {
    return (
      <div className="w-7 h-7 rounded-full border border-[#0047BB] flex items-center justify-center">
        <Check className="w-4 h-4 text-[#0047BB]" />
      </div>
    )
  }
  return (
    <div className="w-7 h-7 rounded-full border border-[#E3E4E5] flex items-center justify-center">
      <Check className="w-4 h-4 text-[#E3E4E5]" />
    </div>
  )
}

function RecommendedLessonRow({ title, subtitle, active, completed, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`w-full flex items-center gap-3 text-left py-2 ${active ? 'bg-[#F7F7FB] rounded-[10px] px-2' : ''} ${onClick ? 'cursor-pointer' : 'cursor-default opacity-60'}`}
    >
      <div className="relative w-[46px] h-[34px] rounded-[6px] overflow-hidden bg-[#F3F4F5] flex-shrink-0">
        <img src="/Preview.png" alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/10" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full bg-white/90 flex items-center justify-center">
            <div className="w-0 h-0 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-l-[7px] border-l-[#0047BB] ml-[1px]" />
          </div>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-[12px] font-medium ${active ? 'text-[#22252B]' : 'text-[#22252B]'} line-clamp-2`}>{title}</div>
        <div className="text-[10px] text-[#737780]">{subtitle}</div>
      </div>
      <LessonStatusIcon completed={completed} />
    </button>
  )
}

function ModuleLessonRow({ title, subtitle, completed, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`w-full flex items-center gap-3 text-left py-2 ${active ? 'bg-[#F7F7FB] rounded-[10px] px-2' : ''} ${onClick ? 'cursor-pointer' : 'cursor-default opacity-60'}`}
    >
      <div className="relative w-[38px] h-[28px] rounded-[6px] overflow-hidden bg-[#F3F4F5] flex-shrink-0">
        <img src="/Preview.png" alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/10" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-5 h-5 rounded-full bg-white/90 flex items-center justify-center">
            <div className="w-0 h-0 border-t-[3px] border-t-transparent border-b-[3px] border-b-transparent border-l-[6px] border-l-[#0047BB] ml-[1px]" />
          </div>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-medium text-[#22252B] line-clamp-2">{title}</div>
        <div className="text-[10px] text-[#737780]">{subtitle}</div>
      </div>
      <LessonStatusIcon completed={completed} />
    </button>
  )
}

function CollapsibleModuleRow({ title, subtitle, percent, open, onToggle, lessons }) {
  return (
    <div className="w-full">
      <button type="button" className="w-full flex items-center justify-between gap-3 py-3 text-left" onClick={onToggle}>
        <div className="min-w-0">
          <div className="text-[12px] font-semibold text-[#22252B] truncate">{title}</div>
          <div className="text-[10px] text-[#737780]">{subtitle}</div>
        </div>
        <div className="flex items-center gap-2">
          <ProgressRing value={percent} />
          <ChevronDown className={`w-4 h-4 text-[#737780] transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>
      <div
        className={`overflow-hidden transition-[max-height,opacity] duration-200 ease-out ${open ? 'max-h-[260px] opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <div className="pb-2 pl-1 pr-1">
          <div className="border-t border-[#F3F4F5]" />
          <div className="mt-1 divide-y divide-[#F3F4F5]">
            {Array.isArray(lessons) && lessons.length > 0 ? lessons.map((l) => (
              <ModuleLessonRow
                key={l.key}
                title={l.title}
                subtitle={l.subtitle}
                completed={!!l.completed}
                active={!!l.active}
                onClick={l.onClick}
              />
            )) : (
              <div className="py-3 text-[12px] text-[#737780]">Nenhuma aula encontrada.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AlunoAulaPage() {
  const { user } = useAuth()
  const [locationSearch, setLocationSearch] = useState(() => {
    try { return window.location.search || '' } catch (_) { return '' }
  })
  const debugOn = useMemo(() => {
    try {
      const params = new URLSearchParams(window.location.search || '')
      return params.get('debug') === '1'
    } catch (_) {
      return false
    }
  }, [])
  const [studentName, setStudentName] = useState('Aluno')
  const [isCompleted, setIsCompleted] = useState(false)
  const [isNpsOpen, setIsNpsOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [isRecommendedOpen, setIsRecommendedOpen] = useState(true)
  const [openModules, setOpenModules] = useState({})
  const [activeTab, setActiveTab] = useState('Sobre a aula')
  const [courseRow, setCourseRow] = useState(null)
  const [courseLoading, setCourseLoading] = useState(false)
  const [courseError, setCourseError] = useState('')
  const [resolvedPromoUrl, setResolvedPromoUrl] = useState('')
  const [vdocipherEmbedUrl, setVdocipherEmbedUrl] = useState('')
  const [videoUrlOverride, setVideoUrlOverride] = useState('')
  const [progressTick, setProgressTick] = useState(0)
  const [moduleSimulados, setModuleSimulados] = useState([])
  const [moduleSimuladosLoading, setModuleSimuladosLoading] = useState(false)
  const simuladosScrollRef = useRef(null)
  const [canScrollSimuladosLeft, setCanScrollSimuladosLeft] = useState(false)
  const [canScrollSimuladosRight, setCanScrollSimuladosRight] = useState(false)
  useEffect(() => {
    const sync = () => {
      try { setLocationSearch(window.location.search || '') } catch (_) { setLocationSearch('') }
    }
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])

  const { courseId, moduleId, lessonId, moduleIndex, lessonIndex } = useMemo(() => {
    try {
      const params = new URLSearchParams(locationSearch || '')
      return {
        courseId: params.get('courseId') || params.get('cursoId') || '',
        moduleId: params.get('moduleId') || '',
        lessonId: params.get('lessonId') || '',
        moduleIndex: params.get('moduleIndex') || '',
        lessonIndex: params.get('lessonIndex') || '',
      }
    } catch (_) {
      return { courseId: '', moduleId: '', lessonId: '', moduleIndex: '', lessonIndex: '' }
    }
  }, [locationSearch])

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

  const activeProducerUserId = useActiveProducerUserId()

  const isBlockedRead = (e) => {
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

  useEffect(() => {
    let active = true
    const run = async () => {
      const cid = String(courseId || '').trim()
      if (!cid || cid === 'demo' || isDemoStudent) {
        if (active) {
          setCourseRow(null)
          setCourseError('')
          setCourseLoading(false)
          setResolvedPromoUrl(DEMO_PROMO_VIDEO_URL)
        }
        return
      }
      setCourseLoading(true)
      setCourseError('')
      setResolvedPromoUrl('')
      try {
        const { data, error } = await supabase.from('courses').select('*').eq('id', cid).single()
        if (!active) return
        if (error) throw error
        setCourseRow(data || null)
      } catch (e) {
        if (!active) return
        const pid = String(activeProducerUserId || '').trim()
        if (pid && isBlockedRead(e)) {
          try {
            const token = await getAccessToken()
            const r = await fetch(`/api/producer?type=course&courseId=${encodeURIComponent(cid)}&producerId=${encodeURIComponent(pid)}`, {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            })
            const body = await r.json().catch(() => ({}))
            if (!active) return
            if (r.ok && body?.data) {
              setCourseRow(body.data)
              setCourseError('')
              return
            }
          } catch (_) {}
        }
        setCourseRow(null)
        setCourseError(String(e?.message || 'Erro ao carregar curso'))
        setResolvedPromoUrl(DEMO_PROMO_VIDEO_URL)
      } finally {
        if (active) setCourseLoading(false)
      }
    }
    run()
    return () => { active = false }
  }, [courseId, isDemoStudent, activeProducerUserId])

  useEffect(() => {
    const meta = getCourseMeta(courseRow)
    const promoPath =
      courseRow?.promo_video_path ||
      meta?.promo_video_path ||
      meta?.promoVideoPath ||
      null
    const promoUrl =
      courseRow?.promo_video_url ||
      meta?.promo_video_url ||
      meta?.promoVideoUrl ||
      meta?.promo_url ||
      meta?.promoUrl ||
      meta?.video_url ||
      meta?.videoUrl ||
      null
    const candidates = []
    if (isNonEmptyString(promoPath)) candidates.push(toPublicCoursesMediaUrl(promoPath))
    if (isNonEmptyString(promoUrl)) candidates.push(toPublicCoursesMediaUrl(promoUrl))
    const found = candidates.find((v) => isNonEmptyString(v))
    setResolvedPromoUrl(found ? String(found) : (isDemoStudent ? DEMO_PROMO_VIDEO_URL : ''))
  }, [courseRow, isDemoStudent])

  const current = useMemo(() => {
    return pickModuleAndLesson(courseRow, { moduleId, moduleIndex, lessonId, lessonIndex })
  }, [courseRow, moduleId, moduleIndex, lessonId, lessonIndex])

  const currentSimuladosRefs = useMemo(() => {
    const meta = getCourseMeta(courseRow)
    const refs = Array.isArray(meta?.selectedSimulados) ? meta.selectedSimulados : []
    const mid = String(current?.moduleId || '').trim()
    const normalized = refs
      .filter((r) => r && typeof r === 'object' && String(r.id || '').trim())
      .map((r) => ({
        id: String(r.id || '').trim(),
        title: String(r.title || '').trim(),
        scope: String(r.scope || 'curso').trim().toLowerCase(),
        moduleId: r.moduleId == null ? null : String(r.moduleId || '').trim(),
        lessonId: r.lessonId == null ? null : String(r.lessonId || '').trim(),
      }))

    const moduleRefs = normalized.filter((r) => r.scope === 'modulo' && mid && r.moduleId && r.moduleId === mid)
    const courseRefs = normalized.filter((r) => r.scope === 'curso')
    const picked = moduleRefs.length > 0 ? moduleRefs : courseRefs

    const seen = new Set()
    const out = []
    for (const r of picked) {
      if (seen.has(r.id)) continue
      seen.add(r.id)
      out.push(r)
    }
    return out
  }, [courseRow, current])

  useEffect(() => {
    let active = true
    const run = async () => {
      if (isDemoStudent) {
        if (active) {
          setModuleSimulados([])
          setModuleSimuladosLoading(false)
        }
        return
      }

      const pid = String(activeProducerUserId || '').trim()
      const ids = currentSimuladosRefs.map((r) => r.id).filter(Boolean)
      if (ids.length === 0) {
        if (active) setModuleSimulados([])
        return
      }

      setModuleSimuladosLoading(true)
      try {
        let rows = null

        try {
          const { data, error } = await supabase
            .from('simulados')
            .select('id,title,is_paid,price')
            .in('id', ids)
            .limit(200)
          if (!error && Array.isArray(data)) rows = data
        } catch (_) {}

        if (!rows && pid) {
          const token = await getAccessToken()
          const r = await fetch(`/api/producer?type=simulados&producerId=${encodeURIComponent(pid)}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          })
          const body = await r.json().catch(() => ({}))
          if (r.ok && Array.isArray(body?.data)) rows = body.data
        }

        if (!rows) {
          const fallback = currentSimuladosRefs.map((s) => ({
            id: s.id,
            title: s.title || 'Simulado',
            is_paid: false,
            price: 0,
            progress: 0,
          }))
          if (active) setModuleSimulados(fallback)
          return
        }

        const byId = new Map()
        for (const s of rows) {
          const id = String(s?.id || '').trim()
          if (!id) continue
          byId.set(id, s)
        }

        const mapped = ids
          .map((id) => {
            const row = byId.get(id) || {}
            const title = String(row?.title || currentSimuladosRefs.find((x) => x.id === id)?.title || 'Simulado').trim()
            const isPaid = Boolean(row?.is_paid) || Math.max(0, Number(row?.price || 0)) > 0
            const price = Number(row?.price || 0) || 0
            const progressKey = `connekt_simulado_progress:${id}`
            const progress = Number(safeLsGet(progressKey) || 0) || 0
            return { id, title, is_paid: isPaid, price, progress }
          })
          .filter((x) => x && x.id)

        if (active) setModuleSimulados(mapped)
      } catch (_) {
        if (active) setModuleSimulados([])
      } finally {
        if (active) {
          setModuleSimuladosLoading(false)
          window.setTimeout(() => updateSimuladosScrollControls(), 0)
        }
      }
    }
    run()
    return () => { active = false }
  }, [isDemoStudent, activeProducerUserId, currentSimuladosRefs, progressTick])

  const resolved = useMemo(() => {
    const meta = getCourseMeta(courseRow)
    const pickedLesson = current?.lesson || null

    const lessonTitle = String(pickedLesson?.title || '').trim() || 'Aula'
    const courseTitle = String(courseRow?.title || meta?.title || meta?.course_title || '').trim()
    const teacherName = String(meta?.teacher_name || meta?.professor || meta?.teacher || '').trim()
    const norm = (v) => {
      const s = v == null ? '' : String(v)
      const out = s.trim()
      if (!out) return ''
      if (out.toLowerCase() === 'categoria') return ''
      if (out.toLowerCase() === 'subcategoria') return ''
      if (out.toLowerCase() === 'tag') return ''
      return out
    }
    const pickFirst = (value) => {
      if (!Array.isArray(value)) return ''
      for (const it of value) {
        const s = norm(it)
        if (s) return s
      }
      return ''
    }
    const pickAny = (...candidates) => {
      for (const c of candidates) {
        const s = norm(c)
        if (s) return s
      }
      return ''
    }

    const lessonDescription = pickAny(
      pickedLesson?.description,
      pickedLesson?.about,
      pickedLesson?.lesson_description,
      pickedLesson?.metadata?.description,
      pickedLesson?.metadata?.about,
      pickedLesson?.meta?.description,
      pickedLesson?.meta?.about,
    )

    const lessonCategory = pickAny(
      pickFirst(pickedLesson?.categories),
      pickedLesson?.category,
      pickedLesson?.categoria,
      pickedLesson?.lessonCategory,
      pickedLesson?.lesson_category,
      pickedLesson?.metadata?.category,
      pickedLesson?.meta?.category,
    )

    const lessonSubcategory = pickAny(
      pickFirst(pickedLesson?.subcategories),
      pickedLesson?.subcategory,
      pickedLesson?.subcategoria,
      pickedLesson?.lessonSubcategory,
      pickedLesson?.lesson_subcategory,
      pickedLesson?.metadata?.subcategory,
      pickedLesson?.meta?.subcategory,
    )

    const lessonTag = pickAny(
      pickedLesson?.tag,
      pickFirst(pickedLesson?.extraTags),
      pickFirst(pickedLesson?.tags),
      pickedLesson?.tagName,
      pickedLesson?.tag_name,
      pickedLesson?.metadata?.tag,
      pickedLesson?.meta?.tag,
    )
    const courseCategory = pickFirst(meta?.selectedCategories || meta?.selected_categories || meta?.categories || meta?.course_categories)
    const courseSubcategory = pickFirst(meta?.selectedSubcategories || meta?.selected_subcategories || meta?.subcategories || meta?.course_subcategories)
    const courseTag = pickFirst(meta?.selectedTags || meta?.selected_tags || meta?.tags || meta?.course_tags)

    const mediaObj = (pickedLesson && typeof pickedLesson === 'object') ? (pickedLesson.media || pickedLesson.metadata || null) : null
    let pickedProvider = String(pickedLesson?.videoProvider || pickedLesson?.video_provider || mediaObj?.videoProvider || mediaObj?.video_provider || '').trim().toLowerCase()
    const pickedVdoVideoId = String(
      pickedLesson?.videoId ||
      pickedLesson?.video_id ||
      pickedLesson?.vdocipherVideoId ||
      pickedLesson?.vdocipher_video_id ||
      mediaObj?.videoId ||
      mediaObj?.video_id ||
      mediaObj?.vdocipherVideoId ||
      mediaObj?.vdocipher_video_id ||
      ''
    ).trim()
    if (!pickedProvider && pickedVdoVideoId) pickedProvider = 'vdocipher'
    const lessonVideoCandidates = [
      pickedLesson?.video_url,
      pickedLesson?.videoUrl,
      pickedLesson?.video_src,
      pickedLesson?.videoSrc,
      pickedLesson?.media_url,
      pickedLesson?.mediaUrl,
      pickedLesson?.vimeo_url,
      pickedLesson?.vimeoUrl,
      pickedLesson?.vimeoUri,
      pickedLesson?.vimeo_uri,
      pickedLesson?.youtube_url,
      pickedLesson?.youtubeUrl,
      pickedLesson?.video_path,
      pickedLesson?.videoPath,
      pickedLesson?.url,
      mediaObj?.video_url,
      mediaObj?.videoUrl,
      mediaObj?.video_path,
      mediaObj?.videoPath,
      mediaObj?.vimeo_url,
      mediaObj?.vimeoUrl,
      mediaObj?.vimeoUri,
      mediaObj?.vimeo_uri,
      mediaObj?.youtube_url,
      mediaObj?.youtubeUrl,
    ]
      .filter((v) => isNonEmptyString(v))
      .map((v) => toPublicCoursesMediaUrl(v))

    const rawVideo = lessonVideoCandidates.find((v) => isNonEmptyString(v)) || resolvedPromoUrl || ''
    const isMp4Like = /\.(mp4|webm|ogg)(\?.*)?$/i.test(String(rawVideo || ''))
    const isHlsLike = /\.(m3u8)(\?.*)?$/i.test(String(rawVideo || ''))
    const vimeoEmbed = vimeoEmbedUrlFromAny(rawVideo)
    const ytEmbed = youtubeEmbedUrlFromAny(rawVideo)
    const isVdoCipher = String(rawVideo || '').includes('vdocipher') || String(rawVideo || '').includes('player.vdocipher.com')
    const iframeSrc = vimeoEmbed || ytEmbed || (isVdoCipher ? String(rawVideo || '') : '')
    const mode = iframeSrc ? 'vimeo' : (isMp4Like || isHlsLike ? 'video' : (rawVideo ? 'video' : 'none'))
    const finalVideoUrl = (() => {
      if (mode === 'vimeo') return iframeSrc
      const u = String(rawVideo || '')
      if (isSupabaseStorageUrl(u)) {
        let isLocal = false
        try {
          const h = String(window.location.hostname || '').toLowerCase()
          isLocal = h === 'localhost' || h === '127.0.0.1'
        } catch (_) {}
        return isLocal ? u : `/api/media?u=${encodeURIComponent(u)}`
      }
      return u
    })()

    return {
      courseTitle: courseTitle || 'Curso',
      lessonTitle,
      teacherName,
      lessonCategory: lessonCategory || courseCategory || 'Sem categoria',
      lessonTag: lessonTag || courseTag || 'Sem tag',
      lessonSubcategory: lessonSubcategory || courseSubcategory || 'Sem subcategoria',
      lessonDescription: lessonDescription || '',
      videoMode: mode,
      videoUrl: finalVideoUrl,
      videoProvider: pickedProvider,
      vdocipherVideoId: pickedVdoVideoId,
    }
  }, [courseRow, current, resolvedPromoUrl])

  useEffect(() => {
    let active = true
    const run = async () => {
      setVdocipherEmbedUrl('')
      if (isDemoStudent) return
      const cid = String(courseId || '').trim()
      if (!cid) return
      if (resolved.videoProvider !== 'vdocipher') return
      if (!resolved.vdocipherVideoId) return
      try {
        const { data, error } = await supabase.functions.invoke('vdocipher-otp', {
          body: {
            courseId: cid,
            moduleId: String(current?.moduleId || ''),
            lessonId: String(current?.lessonId || ''),
            moduleIndex: Number.isFinite(Number(current?.moduleIndex)) ? Number(current.moduleIndex) : null,
            lessonIndex: Number.isFinite(Number(current?.lessonIndex)) ? Number(current.lessonIndex) : null,
          },
        })
        if (!active) return
        if (error || !data?.otp || !data?.playbackInfo) return
        const src = `https://player.vdocipher.com/v2/?otp=${encodeURIComponent(String(data.otp))}&playbackInfo=${encodeURIComponent(String(data.playbackInfo))}`
        setVdocipherEmbedUrl(src)
      } catch (_) {}
    }
    run()
    return () => { active = false }
  }, [courseId, isDemoStudent, resolved.videoProvider, resolved.vdocipherVideoId, current])

  const player = useMemo(() => {
    if (vdocipherEmbedUrl) return { videoMode: 'vimeo', videoUrl: vdocipherEmbedUrl }
    return { videoMode: resolved.videoMode, videoUrl: resolved.videoUrl }
  }, [resolved.videoMode, resolved.videoUrl, vdocipherEmbedUrl])

  useEffect(() => {
    setVideoUrlOverride('')
  }, [player.videoUrl, player.videoMode])

  const moduleRecommendedLessons = useMemo(() => {
    const cid = String(courseId || '').trim()
    const pickedModule = current?.module || null
    const moduleTitle = String(pickedModule?.title || pickedModule?.name || pickedModule?.module_title || '').trim()
    const mid = String(current?.moduleId || '').trim()
    const moduleIndexNum = Number.isFinite(Number(current?.moduleIndex)) ? Number(current.moduleIndex) : 0
    const lessons = Array.isArray(current?.lessons) ? current.lessons : []

    const out = []
    let inModule = 0
    for (const lesson of lessons) {
      const title = String(lesson?.title || lesson?.name || '').trim()
      const lid = String(lesson?.id || lesson?.lesson_id || lesson?.lessonId || '').trim()
      inModule += 1
      const key = lessonProgressKey({
        courseId: cid,
        moduleId: mid,
        moduleIndex: moduleIndexNum >= 0 ? moduleIndexNum : 0,
        lessonId: lid,
        lessonIndex: inModule - 1,
      })
      out.push({
        key: `${mid || String(moduleIndexNum >= 0 ? moduleIndexNum : 'm')}:${lid || inModule}`,
        title: title || `Aula ${inModule}`,
        subtitle: moduleTitle ? `${moduleTitle} • Aula ${inModule}` : `Aula ${inModule}`,
        moduleId: mid,
        lessonId: lid,
        moduleIndex: moduleIndexNum >= 0 ? moduleIndexNum : 0,
        lessonIndex: inModule - 1,
        inModule,
        completed: safeLsGet(key) === '1',
      })
    }
    return out
  }, [courseId, current, progressTick])

  const recommendedForCurrentLesson = useMemo(() => {
    const list = Array.isArray(moduleRecommendedLessons) ? moduleRecommendedLessons : []
    if (list.length === 0) return []

    const lid = String(current?.lessonId || '').trim()
    const li = Number.isFinite(Number(current?.lessonIndex)) ? Number(current.lessonIndex) : -1

    let idx = -1
    if (lid) idx = list.findIndex((x) => String(x?.lessonId || '') === lid)
    if (idx < 0 && Number.isFinite(li)) idx = list.findIndex((x) => Number(x?.lessonIndex) === li)
    if (idx < 0) idx = 0

    return [...list.slice(idx), ...list.slice(0, idx)]
  }, [moduleRecommendedLessons, current])

  const currentModuleKey = useMemo(() => {
    const mid = String(current?.moduleId || '').trim()
    if (mid) return `id:${mid}`
    const mi = String(current?.moduleIndex ?? '').trim()
    return `idx:${mi || '0'}`
  }, [current])

  const currentLessonKey = useMemo(() => {
    return lessonProgressKey({
      courseId,
      moduleId: current?.moduleId,
      moduleIndex: current?.moduleIndex,
      lessonId: current?.lessonId,
      lessonIndex: current?.lessonIndex,
    })
  }, [courseId, current])

  useEffect(() => {
    setIsCompleted(safeLsGet(currentLessonKey) === '1')
  }, [currentLessonKey, progressTick])

  useEffect(() => {
    setOpenModules((prev) => {
      if (prev && Object.prototype.hasOwnProperty.call(prev, currentModuleKey)) return prev
      return { ...(prev || {}), [currentModuleKey]: true }
    })
  }, [currentModuleKey])

  const sidebarModules = useMemo(() => {
    const modules = getCourseModules(courseRow)
    const list = Array.isArray(modules) ? modules : []
    const cid = String(courseId || '').trim()
    const out = []
    for (let i = 0; i < list.length; i += 1) {
      const mod = list[i]
      const moduleTitle = String(mod?.title || mod?.name || mod?.module_title || '').trim() || `Módulo ${i + 1}`
      const mid = String(mod?.id || mod?.module_id || mod?.moduleId || '').trim()
      const moduleKey = mid ? `id:${mid}` : `idx:${i}`
      const lessons = getModuleLessons(mod)
      const lessonRows = []
      let completedCount = 0
      let inModule = 0
      for (const lesson of (Array.isArray(lessons) ? lessons : [])) {
        const title = String(lesson?.title || lesson?.name || '').trim() || `Aula ${inModule + 1}`
        const lid = String(lesson?.id || lesson?.lesson_id || lesson?.lessonId || '').trim()
        const lessonKey = lessonProgressKey({ courseId: cid, moduleId: mid, moduleIndex: i, lessonId: lid, lessonIndex: inModule })
        const completed = safeLsGet(lessonKey) === '1'
        if (completed) completedCount += 1
        const active =
          (mid && String(mid) === String(current?.moduleId || '') && lid && String(lid) === String(current?.lessonId || '')) ||
          (!mid && String(i) === String(current?.moduleIndex ?? '') && String(inModule) === String(current?.lessonIndex ?? ''))
        lessonRows.push({
          key: `${moduleKey}:${lid || inModule}`,
          title,
          subtitle: `Aula ${inModule + 1}`,
          completed,
          active,
          onClick: () => {
            const qs = new URLSearchParams()
            qs.set('courseId', String(courseId || ''))
            if (mid) qs.set('moduleId', String(mid))
            else qs.set('moduleIndex', String(i))
            if (lid) qs.set('lessonId', String(lid))
            else qs.set('lessonIndex', String(inModule))
            if (isDemoStudent) qs.set('demo', '1')
            navigateTo(`/aluno/aula?${qs.toString()}`)
          },
        })
        inModule += 1
      }
      const total = lessonRows.length
      const percent = total > 0 ? Math.round((completedCount / total) * 100) : 0
      out.push({
        key: moduleKey,
        title: moduleTitle,
        subtitle: `${completedCount} de ${total} aulas concluídas`,
        percent,
        lessons: lessonRows,
      })
    }
    return out
  }, [courseRow, courseId, isDemoStudent, progressTick, current])

  useEffect(() => {
    const syncTabFromSearch = () => {
      try {
        const params = new URLSearchParams(window.location.search || '')
        const raw = (params.get('tab') || params.get('aba') || '').trim()
        if (!raw) return
        const normalized = raw.toLowerCase()
        const next =
          normalized === 'simulados'
            ? 'Simulados'
            : normalized === 'anexos'
              ? 'Anexos'
              : normalized === 'comentarios' || normalized === 'comentários'
                ? 'Comentários'
                : normalized === 'sobre' || normalized === 'sobre a aula'
                  ? 'Sobre a aula'
                  : null
        if (!next) return
        setActiveTab((prev) => (prev === next ? prev : next))
      } catch (_) {}
    }

    syncTabFromSearch()
    window.addEventListener('popstate', syncTabFromSearch)
    return () => window.removeEventListener('popstate', syncTabFromSearch)
  }, [])

  useEffect(() => {
    const name = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'Aluno'
    setStudentName(String(name))
  }, [user])

  const handleFinishClick = () => {
    if (isCompleted) {
      toast({ title: 'Aula já concluída', description: 'Essa aula já está marcada como concluída.' })
      return
    }
    setIsNpsOpen(true)
  }

  const handleSubmitNps = ({ rating, comment, allowContact }) => {
    try {
      localStorage.setItem('connekt_aluno_aula_completed', '1')
      localStorage.setItem('connekt_aluno_aula_nps', JSON.stringify({ rating, comment, allowContact, ts: Date.now() }))
    } catch (_) {}
    safeLsSet(currentLessonKey, '1')
    setIsCompleted(true)
    setProgressTick((v) => v + 1)
    setIsNpsOpen(false)
    toast({ title: 'Aula concluída com sucesso!' })
    window.setTimeout(() => {
      toast({ title: 'Avaliação enviada com sucesso!' })
    }, 350)
  }

  const updateSimuladosScrollControls = () => {
    const el = simuladosScrollRef.current
    if (!el) {
      setCanScrollSimuladosLeft(false)
      setCanScrollSimuladosRight(false)
      return
    }
    const maxScrollLeft = Math.max(0, el.scrollWidth - el.clientWidth)
    const left = el.scrollLeft
    setCanScrollSimuladosLeft(left > 2)
    setCanScrollSimuladosRight(left < maxScrollLeft - 2)
  }

  useEffect(() => {
    if (activeTab !== 'Simulados') return
    window.setTimeout(() => updateSimuladosScrollControls(), 0)
  }, [activeTab])

  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/aluno/aula'

  useEffect(() => {
    if (!mobileNavOpen) return
    const prev = document?.body?.style?.overflow
    if (document?.body?.style) document.body.style.overflow = 'hidden'
    return () => {
      if (document?.body?.style) document.body.style.overflow = prev || ''
    }
  }, [mobileNavOpen])

  return (
    <div className="min-h-screen lg:h-screen w-full bg-[#EEF2FF] flex lg:overflow-hidden">
      {debugOn ? (
        <div className="fixed bottom-3 right-3 z-[9999] rounded bg-white/90 border border-[#E3E4E5] px-3 py-2 text-[11px] text-[#374151]">
          <div>build: {String(typeof __BUILD_SHA__ !== 'undefined' ? __BUILD_SHA__ : '')}</div>
          <div>time: {String(typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : '')}</div>
          <div>lessonCategory: {String(resolved?.lessonCategory || '')}</div>
          <div>lessonTag: {String(resolved?.lessonTag || '')}</div>
          <div>lessonSubcategory: {String(resolved?.lessonSubcategory || '')}</div>
          <div>lessonDescLen: {String((resolved?.lessonDescription || '').length)}</div>
        </div>
      ) : null}
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
                            navigateTo(item.path)
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
                      onClick={() => navigateTo(item.path)}
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
          <NpsModal open={isNpsOpen} onClose={() => setIsNpsOpen(false)} onSubmit={handleSubmitNps} />
          <div className="px-6 py-6">
            <div className="max-w-[1180px] mx-auto">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[12px] text-[#737780]">
                  <button type="button" className="text-[#0047BB] font-semibold" onClick={() => navigateTo('/aluno')}>
                    Meus cursos
                  </button>
                  <span>{'>'}</span>
                  <div className="text-[#737780]">{resolved.lessonTitle}</div>
                </div>
                <button
                  type="button"
                  className={`h-9 px-4 rounded-[8px] text-[12px] font-semibold ${isCompleted ? 'bg-[#EEF2FF] text-[#0047BB] border border-[#C7D2FE]' : 'bg-[#0047BB] text-white'}`}
                  onClick={handleFinishClick}
                >
                  {isCompleted ? 'Aula concluída' : 'Concluir aula'}
                </button>
              </div>

              <div className="mt-4 grid grid-cols-12 gap-6 items-start">
                <div className="col-span-12 lg:col-span-8">
                  <div className="w-full rounded-[10px] overflow-hidden bg-black relative">
                    {player.videoMode === 'vimeo' ? (
                      <iframe
                        title="Aula"
                        src={player.videoUrl}
                        className="w-full h-[330px] bg-black"
                        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                        allowFullScreen
                      />
                    ) : player.videoMode === 'video' ? (
                      <video
                        className="w-full h-[330px] bg-black"
                        controls
                        poster="/Preview.png"
                        onError={(e) => {
                          const v = e.currentTarget
                          if (v?.dataset?.fallbackUsed === '1') return
                          const src = String((videoUrlOverride || player.videoUrl) || '')
                          if (!src.includes('/api/media?u=')) return
                          let direct = ''
                          try {
                            const u = new URL(src, window.location.origin)
                            direct = u.searchParams.get('u') || ''
                          } catch (_) {}
                          if (!direct) return
                          v.dataset.fallbackUsed = '1'
                          setVideoUrlOverride(direct)
                          try {
                            v.load()
                            const p = v.play?.()
                            if (p && typeof p.catch === 'function') p.catch(() => {})
                          } catch (_) {}
                        }}
                      >
                        {(videoUrlOverride || player.videoUrl) ? <source src={videoUrlOverride || player.videoUrl} /> : null}
                      </video>
                    ) : (
                      <div className="w-full h-[330px] bg-black flex items-center justify-center px-6 text-center">
                        <div className="text-[12px] text-white/80">
                          {courseLoading ? 'Carregando vídeo…' : (
                            courseError ? 'Não foi possível carregar o vídeo.' : (
                              resolved.videoProvider === 'vdocipher' ? 'Carregando vídeo…' : 'Vídeo não encontrado para esta aula.'
                            )
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-3">
                    <div className="text-[12px] text-[#737780]">{resolved.courseTitle}</div>
                    <div className="mt-1 flex items-center gap-3 text-[10px] text-[#737780]">
                      {resolved.teacherName ? <div>Professor: {resolved.teacherName}</div> : null}
                      <div className="flex items-center gap-1">
                        <span className="text-[#F59E0B]">★</span>
                        <span className="text-[#22252B] font-semibold">4.8</span>
                        <span>(1.540)</span>
                      </div>
                      <div className="h-3 w-px bg-[#E3E4E5]" />
                      <div>Intermediário</div>
                      <div className="h-3 w-px bg-[#E3E4E5]" />
                      <div>1.200 Alunos</div>
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded bg-[#EEF2FF] text-[#1D4ED8] px-2 py-0.5 text-[12px]">
                        <span className="h-2 w-2 rounded-[4px] inline-block" style={{ backgroundColor: '#8B5CF6' }} />
                        {resolved.lessonCategory}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded bg-[#F3F4F6] text-[#374151] px-2 py-0.5 text-[12px]">
                        <span className="h-2 w-2 rounded-[4px] inline-block" style={{ backgroundColor: '#10B981' }} />
                        {resolved.lessonTag}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded bg-[#FEF9C3] text-[#92400E] px-2 py-0.5 text-[12px]">
                        <span className="h-2 w-2 rounded-[4px] inline-block" style={{ backgroundColor: '#94A3B8' }} />
                        {resolved.lessonSubcategory}
                      </span>
                    </div>

                    <div className="mt-4 flex items-center gap-6 border-b border-[#E3E4E5]">
                      {['Sobre a aula', 'Comentários', 'Simulados', 'Anexos'].map((t) => (
                        <button
                          key={t}
                          type="button"
                          className={`py-3 text-[11px] font-semibold ${activeTab === t ? 'text-[#0047BB] border-b-2 border-[#0047BB]' : 'text-[#737780]'}`}
                          onClick={() => setActiveTab(t)}
                        >
                          {t}
                        </button>
                      ))}
                      <div className="flex-1" />
                      <button
                        type="button"
                        className={`h-8 px-4 rounded-[8px] text-[11px] font-semibold ${isCompleted ? 'bg-[#EEF2FF] text-[#0047BB] border border-[#C7D2FE]' : 'bg-[#0047BB] text-white'}`}
                        onClick={handleFinishClick}
                      >
                        {isCompleted ? 'Aula concluída' : 'Concluir aula'}
                      </button>
                    </div>

                    {activeTab === 'Sobre a aula' ? (
                      <>
                        {resolved.lessonDescription ? (
                          <div className="mt-5 text-[12px] leading-[18px] text-[#737780] whitespace-pre-line">
                            {resolved.lessonDescription}
                          </div>
                        ) : (
                          <div className="mt-5 text-[12px] text-[#737780]">Sem descrição.</div>
                        )}
                      </>
                    ) : activeTab === 'Comentários' ? (
                      <CommentsPanel user={user} studentName={studentName} lessonKey={currentLessonKey} />
                    ) : activeTab === 'Simulados' ? (
                      <div className="mt-5">
                        <div className="flex items-center justify-between">
                          <div className="text-[12px] font-semibold text-[#22252B]">Simulados relacionados</div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className={`w-8 h-8 rounded-full border border-[#E3E4E5] bg-white flex items-center justify-center ${canScrollSimuladosLeft ? 'hover:bg-[#F3F4F5]' : 'opacity-40 cursor-not-allowed'}`}
                              onClick={() => {
                                const el = simuladosScrollRef.current
                                if (!el) return
                                el.scrollBy({ left: -360, behavior: 'smooth' })
                              }}
                              disabled={!canScrollSimuladosLeft}
                              aria-label="Simulados anteriores"
                            >
                              <ChevronLeft className="w-4 h-4 text-[#737780]" />
                            </button>
                            <button
                              type="button"
                              className={`w-8 h-8 rounded-full border border-[#E3E4E5] bg-white flex items-center justify-center ${canScrollSimuladosRight ? 'hover:bg-[#F3F4F5]' : 'opacity-40 cursor-not-allowed'}`}
                              onClick={() => {
                                const el = simuladosScrollRef.current
                                if (!el) return
                                el.scrollBy({ left: 360, behavior: 'smooth' })
                              }}
                              disabled={!canScrollSimuladosRight}
                              aria-label="Próximos simulados"
                            >
                              <ChevronRight className="w-4 h-4 text-[#737780]" />
                            </button>
                          </div>
                        </div>
                        <div ref={simuladosScrollRef} onScroll={updateSimuladosScrollControls} className="mt-3 flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                          {moduleSimulados.map((s) => (
                            <div
                              key={s.id}
                              className="bg-white border border-[#E3E4E5] rounded-[4px] p-4 w-[252px] h-[230px] flex flex-col flex-shrink-0 cursor-pointer"
                              onClick={() => {
                                let demo = false
                                try {
                                  const p = new URLSearchParams(window.location.search || '')
                                  demo = p.get('demo') === '1'
                                } catch (_) {}
                                navigateTo(`/aluno/simulados/acesso?simId=${encodeURIComponent(s.id)}${demo ? '&demo=1' : ''}`)
                              }}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2">
                                  <img src="/t simulados 1.png" alt="Simulado" className="w-[85px] h-[85px] rounded-md object-cover" />
                                </div>
                                <div className="flex flex-col items-end gap-4">
                                  <span className="inline-flex items-center justify-center w-[80px] h-[18px] px-3 text-[10px] rounded-[54px] leading-none font-medium bg-[#E9FFEF] text-[#06C270]">
                                    Publicado
                                  </span>
                                  <span className={`inline-flex items-center justify-center w-[80px] h-[18px] px-3 text-[10px] rounded-[54px] leading-none font-medium ${(s.is_paid || Number(s.price || 0) > 0) ? 'bg-[#FEF3C7] text-[#92400E]' : 'bg-[#EEF2FF] text-[#0047BB]'}`}>
                                    {(s.is_paid || Number(s.price || 0) > 0) ? 'Pago' : 'Gratuito'}
                                  </span>
                                </div>
                              </div>
                              <div className="mt-0">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-[12px] font-medium text-[#1E1B39] font-inter">{s.title}</h4>
                                </div>
                                <p className="text-[10px] text-[#9291A5] font-inter font-[400] mt-1">{currentSimuladosRefs.length > 0 && currentSimuladosRefs[0]?.scope === 'curso' ? 'Simulado do curso' : 'Simulado do módulo'}</p>
                              </div>
                              <div className="mt-3 flex items-center gap-2">
                                <span
                                  className="inline-flex items-center gap-1 text-[12px] font-normal h-[20px] px-2 py-0 rounded-[4px]"
                                  style={{ backgroundColor: 'rgba(173,137,247,0.1)', color: '#22252B' }}
                                >
                                  <span className="leading-none text-[7px] text-[#AD89F7]">🟪</span>
                                  <span className="text-[10px] text-[#22252B] font-normal not-italic">Categoria</span>
                                </span>
                              </div>
                              <div className="mt-4 flex items-center justify-between">
                                <div className="flex flex-col w-full">
                                  <span className="text-[12px] text-[#1E1B39] font-inter font-bold">Aprovação (%)</span>
                                </div>
                                <div className="flex items-center gap-1 text-[#0047BB]">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0047BB" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10" opacity="0.3" />
                                    <path d="M12 2 a10 10 0 0 1 0 20" />
                                  </svg>
                                  <span className="text-[12px] font-bold text-[#0047BB]">{Math.max(0, Math.min(100, Number(s.progress || 0)))}%</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        {!moduleSimuladosLoading && moduleSimulados.length === 0 ? (
                          <div className="mt-3 text-[12px] text-[#737780]">Nenhum simulado encontrado para este módulo.</div>
                        ) : null}
                        {moduleSimuladosLoading ? (
                          <div className="mt-3 text-[12px] text-[#737780]">Carregando simulados…</div>
                        ) : null}
                      </div>
                    ) : activeTab === 'Anexos' ? (
                      <AttachmentsPanel courseId={courseId} moduleId={moduleId} lessonId={lessonId} lessonKey={currentLessonKey} demo={isDemoStudent} />
                    ) : (
                      <div className="mt-5 text-[12px] text-[#737780]">Em breve.</div>
                    )}
                  </div>
                </div>

                <div className="col-span-12 lg:col-span-4 relative">
                  <div className="absolute -z-10 inset-x-0 top-0 w-full h-[520px] opacity-[0.14]" style={{ backgroundImage: 'url(/Preview.png)', backgroundSize: 'cover', backgroundPosition: 'center' }} />
                  <div className="rounded-[10px] border border-[#E3E4E5] bg-white p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[12px] font-semibold text-[#22252B]">Aulas recomendadas</div>
                        <div className="text-[10px] text-[#737780]">{moduleRecommendedLessons.filter((l) => l?.completed).length} de {moduleRecommendedLessons.length} aulas concluídas</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <ProgressRing value={moduleRecommendedLessons.length > 0 ? Math.round((moduleRecommendedLessons.filter((l) => l?.completed).length / moduleRecommendedLessons.length) * 100) : 0} />
                        <button
                          type="button"
                          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#F3F4F5]"
                          onClick={() => setIsRecommendedOpen((v) => !v)}
                          aria-label="Mostrar aulas"
                        >
                          <ChevronDown className={`w-4 h-4 text-[#737780] transition-transform ${isRecommendedOpen ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                    </div>
                    <div
                      className={`overflow-hidden transition-[max-height,opacity] duration-200 ease-out ${isRecommendedOpen ? 'max-h-[260px] opacity-100' : 'max-h-0 opacity-0'}`}
                    >
                      <div className="mt-3 divide-y divide-[#F3F4F5] max-h-[210px] overflow-y-auto scrollbar-hide pr-1">
                        {moduleRecommendedLessons.length > 0 ? recommendedForCurrentLesson.slice(0, 8).map((l) => {
                          const active =
                            (l.lessonId && String(l.lessonId) === String(current?.lessonId || '')) ||
                            (String(l.lessonIndex) === String(current?.lessonIndex ?? ''))
                          return (
                            <RecommendedLessonRow
                              key={l.key}
                              title={l.title}
                              subtitle={l.subtitle}
                              active={active}
                              completed={!!l.completed}
                              onClick={(l.moduleId || l.lessonId || String(l.moduleIndex) !== 'undefined') ? (() => {
                                const qs = new URLSearchParams()
                                qs.set('courseId', String(courseId || ''))
                                if (l.moduleId) qs.set('moduleId', String(l.moduleId))
                                else if (Number.isFinite(Number(l.moduleIndex))) qs.set('moduleIndex', String(l.moduleIndex))
                                if (l.lessonId) qs.set('lessonId', String(l.lessonId))
                                else if (Number.isFinite(Number(l.lessonIndex))) qs.set('lessonIndex', String(l.lessonIndex))
                                if (isDemoStudent) qs.set('demo', '1')
                                navigateTo(`/aluno/aula?${qs.toString()}`)
                              }) : null}
                            />
                          )
                        }) : (
                          <div className="py-3 text-[12px] text-[#737780]">Nenhuma aula encontrada.</div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-[10px] border border-[#E3E4E5] bg-white p-4">
                    <div className="divide-y divide-[#F3F4F5]">
                      {sidebarModules.length > 0 ? sidebarModules.map((m) => (
                        <CollapsibleModuleRow
                          key={m.key}
                          title={m.title}
                          subtitle={m.subtitle}
                          percent={m.percent}
                          open={!!(openModules && openModules[m.key])}
                          onToggle={() => setOpenModules((s) => ({ ...(s || {}), [m.key]: !(s && s[m.key]) }))}
                          lessons={m.lessons}
                        />
                      )) : (
                        <div className="py-3 text-[12px] text-[#737780]">Nenhum módulo encontrado.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <button type="button" className="mt-5 inline-flex items-center gap-2 text-[12px] text-[#737780]" onClick={() => navigateTo('/aluno')}>
                <ChevronLeft className="w-4 h-4" />
                Voltar para o painel
              </button>

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
