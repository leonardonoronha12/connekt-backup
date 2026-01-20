import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, ChevronLeft, ChevronRight, Database, Download, ExternalLink, FileSpreadsheet, FileText, FileType, GraduationCap, Heart, Link as LinkIcon, Menu, Monitor, Settings, X } from 'lucide-react'
import { useAuth } from '@/contexts/SupabaseAuthContext'
import { toast } from '@/components/ui/use-toast'
import { Switch } from '@/components/ui/switch.jsx'
import Header from '@/components/Header'
import CourseFooter from '@/components/CourseFooter'
import { supabase } from '@/lib/supabaseClient'
import { fetchConversationFeed } from '@/services/conversationService'

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

        const { data, error } = await supabase.from('courses').select('id,modules,data').eq('id', courseId).maybeSingle()
        if (error) throw error
        const mods = getModulesFromCourse(data)
        const mod = (Array.isArray(mods) ? mods : []).find((m) => String(m?.id || '') === String(moduleId || '')) || mods[0] || null
        const lessons = Array.isArray(mod?.lessons) ? mod.lessons : []
        const lesson = lessons.find((l) => String(l?.id || '') === String(lessonId || '')) || lessons[0] || null
        const materials = Array.isArray(lesson?.materials) ? lesson.materials : []
        const mapped = materials.map((m, idx) => {
          const type = normalizeMaterialType(m?.type)
          const rawName = String(m?.name || '').trim() || `Material ${idx + 1}`
          const url = type === 'link' ? (rawName.startsWith('http') ? rawName : null) : toPublicCoursesMediaUrl(rawName)
          return { id: String(m?.id || `mat-${idx}`), type, name: rawName, sizeLabel: String(m?.sizeLabel || ''), url }
        })
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
                        className="h-9 px-3 rounded-[8px] border border-[#E3E4E5] bg-white text-[12px] font-semibold text-[#22252B] inline-flex items-center gap-2"
                      >
                        {m.type === 'link' ? <ExternalLink className="w-4 h-4 text-[#737780]" /> : <Download className="w-4 h-4 text-[#737780]" />}
                        {m.type === 'link' ? 'Abrir' : 'Baixar'}
                      </a>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="h-9 px-3 rounded-[8px] border border-[#E3E4E5] bg-white text-[12px] font-semibold text-[#22252B] inline-flex items-center gap-2 opacity-50 cursor-not-allowed"
                      disabled
                    >
                      <Download className="w-4 h-4 text-[#737780]" />
                      Baixar
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

function RecommendedLessonRow({ title, subtitle, active, completed }) {
  return (
    <button type="button" className={`w-full flex items-center gap-3 text-left py-2 ${active ? 'bg-[#F7F7FB] rounded-[10px] px-2' : ''}`}>
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

function ModuleLessonRow({ title, subtitle, completed }) {
  return (
    <button type="button" className="w-full flex items-center gap-3 text-left py-2">
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

function CollapsibleModuleRow({ title, subtitle, percent, open, onToggle }) {
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
            <ModuleLessonRow title="Encontrando e modelando ofertas americanas" subtitle="Aula 1" completed />
            <ModuleLessonRow title="Encontrando e modelando ofertas americanas" subtitle="Aula 2" completed />
            <ModuleLessonRow title="Encontrando e modelando ofertas americanas" subtitle="Aula 3" completed={false} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AlunoAulaPage() {
  const { user } = useAuth()
  const [studentName, setStudentName] = useState('Aluno')
  const [isCompleted, setIsCompleted] = useState(false)
  const [isNpsOpen, setIsNpsOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [isRecommendedOpen, setIsRecommendedOpen] = useState(true)
  const [openModules, setOpenModules] = useState({ m1: false, m2: false, m3: false })
  const [activeTab, setActiveTab] = useState('Sobre a aula')
  const simuladosScrollRef = useRef(null)
  const [canScrollSimuladosLeft, setCanScrollSimuladosLeft] = useState(false)
  const [canScrollSimuladosRight, setCanScrollSimuladosRight] = useState(false)
  const { courseId, moduleId, lessonId } = useMemo(() => {
    try {
      const params = new URLSearchParams(window.location.search || '')
      return {
        courseId: params.get('courseId') || params.get('cursoId') || '',
        moduleId: params.get('moduleId') || '',
        lessonId: params.get('lessonId') || '',
      }
    } catch (_) {
      return { courseId: '', moduleId: '', lessonId: '' }
    }
  }, [])

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

  useEffect(() => {
    try {
      setIsCompleted(String(localStorage.getItem('connekt_aluno_aula_completed') || '') === '1')
    } catch (_) {}
  }, [])

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
    setIsCompleted(true)
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
                  <div className="text-[#737780]">Aula 03 - Prática clínica</div>
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
                    <video className="w-full h-[330px] bg-black" controls poster="/Preview.png">
                    </video>
                  </div>

                  <div className="mt-3">
                    <div className="text-[12px] text-[#737780]">Aula 03 - Práticas clínicas</div>
                    <div className="mt-1 flex items-center gap-3 text-[10px] text-[#737780]">
                      <div>Professor: Dr. Francisco Guerra</div>
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
                        Categoria
                      </span>
                      <span className="inline-flex items-center gap-1 rounded bg-[#F3F4F6] text-[#374151] px-2 py-0.5 text-[12px]">
                        <span className="h-2 w-2 rounded-[4px] inline-block" style={{ backgroundColor: '#10B981' }} />
                        Tag
                      </span>
                      <span className="inline-flex items-center gap-1 rounded bg-[#FEF9C3] text-[#92400E] px-2 py-0.5 text-[12px]">
                        <span className="h-2 w-2 rounded-[4px] inline-block" style={{ backgroundColor: '#94A3B8' }} />
                        Subcategoria
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
                        <div className="mt-5 text-[12px] text-[#737780]">
                          Formação completa, atualizada e baseada em prática clínica real
                        </div>
                        <div className="mt-4 text-[12px] leading-[18px] text-[#737780]">
                          O Curso de Cirurgia Neurológica foi desenvolvido para oferecer uma formação extremamente sólida e aprofundada sobre o diagnóstico,
                          planejamento cirúrgico e tratamento de doenças do sistema nervoso central e periférico. Ao longo do curso, o aluno terá acesso a uma
                          abordagem teórico-prática, prática e multidisciplinar, com foco em tomada de decisão cirúrgica, técnicas modernas e neurocirurgia no
                          manejo no pré, trans e pós-operatório.
                        </div>
                      </>
                    ) : activeTab === 'Comentários' ? (
                      <CommentsPanel user={user} studentName={studentName} lessonKey="aula-03-pratica-clinica" />
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
                          {[{ id: 's1', title: 'SIMULADO 1', progress: 25, is_paid: false, price: 0 }, { id: 's2', title: 'SIMULADO 2', progress: 40, is_paid: true, price: 39.9 }, { id: 's3', title: 'SIMULADO 3', progress: 60, is_paid: false, price: 0 }].map((s) => (
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
                                <p className="text-[10px] text-[#9291A5] font-inter font-[400] mt-1">Simulado criado por você</p>
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
                      </div>
                    ) : activeTab === 'Anexos' ? (
                      <AttachmentsPanel courseId={courseId} moduleId={moduleId} lessonId={lessonId} lessonKey="aula-03-pratica-clinica" demo={isDemoStudent} />
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
                        <div className="text-[10px] text-[#737780]">2 de 5 aulas concluídas</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <ProgressRing value={25} />
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
                        <RecommendedLessonRow title="Encontrando e modelando ofertas americanas" subtitle="Aula 1" active completed />
                        <RecommendedLessonRow title="Encontrando e modelando ofertas americanas" subtitle="Aula 2" completed />
                        <RecommendedLessonRow title="Encontrando e modelando ofertas americanas" subtitle="Aula 3" completed={false} />
                        <RecommendedLessonRow title="Encontrando e modelando ofertas americanas" subtitle="Aula 4" completed={false} />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-[10px] border border-[#E3E4E5] bg-white p-4">
                    <div className="divide-y divide-[#F3F4F5]">
                      <CollapsibleModuleRow
                        title="Práticas clínicas"
                        subtitle="2 de 5 aulas concluídas"
                        percent={25}
                        open={openModules.m1}
                        onToggle={() => setOpenModules((s) => ({ ...s, m1: !s.m1 }))}
                      />
                      <CollapsibleModuleRow
                        title="Práticas clínicas"
                        subtitle="2 de 5 aulas concluídas"
                        percent={25}
                        open={openModules.m2}
                        onToggle={() => setOpenModules((s) => ({ ...s, m2: !s.m2 }))}
                      />
                      <CollapsibleModuleRow
                        title="Práticas clínicas"
                        subtitle="2 de 5 aulas concluídas"
                        percent={25}
                        open={openModules.m3}
                        onToggle={() => setOpenModules((s) => ({ ...s, m3: !s.m3 }))}
                      />
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
