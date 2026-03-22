import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Helmet } from 'react-helmet-async'
import { Download, Loader2, Search, Users, X } from 'lucide-react'
import { useAuth } from '@/contexts/SupabaseAuthContext'
import { toast } from '@/hooks/use-toast.ts'

function parseJsonMaybe(v) {
  if (!v) return null
  if (typeof v === 'object') return v
  if (typeof v !== 'string') return null
  try { return JSON.parse(v) } catch (_) { return null }
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

function formatPhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  return String(raw || '').trim()
}

function formatProductCell(row) {
  const products = Array.isArray(row?.products) ? row.products.map((p) => String(p || '').trim()).filter(Boolean) : []
  const primary = String(row?.product || '').trim() || (products[0] ? String(products[0]) : '')
  if (!primary) return '—'
  const extra = products.filter((p) => p && p !== primary)
  return extra.length ? `${primary} (+${extra.length})` : primary
}

export default function AlunosPage() {
  const { session, user } = useAuth()
  const tokenRef = useRef('')
  useEffect(() => {
    tokenRef.current = String(session?.access_token || '')
  }, [session?.access_token])

  const authHeaders = useMemo(() => {
    const t = String(session?.access_token || '').trim()
    return t ? { Authorization: `Bearer ${t}` } : {}
  }, [session?.access_token])

  const [query, setQuery] = useState('')

  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')

  const [producerCourses, setProducerCourses] = useState([])

  const [editOpen, setEditOpen] = useState(false)
  const [editFetching, setEditFetching] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [editRow, setEditRow] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', phone: '' })
  const [editSimuladosOptions, setEditSimuladosOptions] = useState([])
  const [editPurchasedProducts, setEditPurchasedProducts] = useState([])
  const [editEntitlements, setEditEntitlements] = useState([])

  const fetchStudents = useCallback(async () => {
    const producerId = String(user?.id || '').trim()
    if (!producerId) return { ok: true, students: [], courses: [] }
    const qs = new URLSearchParams()
    qs.set('type', 'students_manage_list')
    qs.set('producerId', producerId)
    if (query.trim()) qs.set('q', query.trim())
    qs.set('per_page', '5000')
    const r = await fetch(`/api/producer?${qs.toString()}`, { headers: authHeaders })
    const body = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(body?.error || 'Falha ao carregar alunos')
    return body || {}
  }, [authHeaders, query, user?.id])

  const openEdit = useCallback(async (row) => {
    const r = row && typeof row === 'object' ? row : null
    if (!r?.id) return
    setEditRow(r)
    setEditForm({ name: String(r?.name || '').trim(), phone: String(r?.phone || '').trim() })
    setEditPurchasedProducts([])
    setEditEntitlements([])
    setEditOpen(true)
    const startedAt = Date.now()
    setEditFetching(true)
    try {
      const producerId = String(user?.id || '').trim()
      const userId = String(r?.id || '').trim()
      if (!producerId || !userId) return
      const qs = new URLSearchParams()
      qs.set('type', 'student_entitlements_get')
      qs.set('producerId', producerId)
      qs.set('user_id', userId)
      const resp = await fetch(`/api/producer?${qs.toString()}`, { headers: authHeaders })
      const body = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(body?.error || 'Falha ao carregar acessos')

      const ent = body?.entitlements || {}
      const courses = Array.isArray(ent?.courses) ? ent.courses : []
      const sims = Array.isArray(ent?.simulados) ? ent.simulados : []
      const purchased = Array.isArray(body?.products) ? body.products : []
      const nextEnt = []
      for (const c of courses) {
        const courseId = String(c?.courseId || c?.course_id || '').trim()
        if (!courseId) continue
        nextEnt.push({ kind: 'course', id: courseId, selectValue: `course:${courseId}`, expiresAt: String(c?.expiresAt || '').trim() })
      }
      for (const s of sims) {
        const simId = String(s?.simId || s?.sim_id || '').trim()
        if (!simId) continue
        nextEnt.push({ kind: 'simulado', id: simId, selectValue: `simulado:${simId}`, expiresAt: String(s?.expiresAt || '').trim() })
      }
      setEditEntitlements(nextEnt)
      setEditPurchasedProducts(
        purchased
          .map((p) => ({ title: String(p?.title || '').trim(), expiresAt: String(p?.expiresAt || '').trim() }))
          .filter((p) => p.title),
      )
    } catch (e) {
      toast({ title: 'Erro', description: e?.message || 'Erro ao carregar acessos', variant: 'destructive' })
    } finally {
      const elapsed = Date.now() - startedAt
      if (elapsed < 250) await new Promise((resolve) => setTimeout(resolve, 250 - elapsed))
      setEditFetching(false)
    }
  }, [authHeaders, user?.id])

  const saveEdit = useCallback(async () => {
    const producerId = String(user?.id || '').trim()
    const userId = String(editRow?.id || '').trim()
    if (!producerId || !userId) return
    setEditSaving(true)
    try {
      const payload = { userId, name: String(editForm.name || '').trim(), phone: String(editForm.phone || '').trim() }
      const qs = new URLSearchParams()
      qs.set('type', 'student_update_profile')
      qs.set('producerId', producerId)
      const qs2 = new URLSearchParams()
      qs2.set('type', 'student_entitlements_update')
      qs2.set('producerId', producerId)
      const dedup = new Map()
      for (const it of Array.isArray(editEntitlements) ? editEntitlements : []) {
        const kind = String(it?.kind || '').trim()
        const id = String(it?.id || '').trim()
        if (!kind || !id) continue
        const key = `${kind}:${id}`
        dedup.set(key, { kind, id, expiresAt: String(it?.expiresAt || '').trim() })
      }
      const courses = []
      const simulados = []
      for (const it of dedup.values()) {
        if (it.kind === 'course') courses.push({ courseId: it.id, expiresAt: it.expiresAt || null })
        if (it.kind === 'simulado') simulados.push({ simId: it.id, expiresAt: it.expiresAt || null })
      }
      const [r, r2] = await Promise.all([
        fetch(`/api/producer?${qs.toString()}`, {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }),
        fetch(`/api/producer?${qs2.toString()}`, {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            courses,
            simulados,
          }),
        }),
      ])

      const body = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(body?.error || 'Falha ao salvar')
      const b2 = await r2.json().catch(() => ({}))
      if (!r2.ok) throw new Error(b2?.error || 'Falha ao salvar acessos')

      setRows((prev) => (Array.isArray(prev) ? prev.map((it) => (String(it?.id || '') === userId ? { ...it, name: payload.name || it?.name, phone: payload.phone || it?.phone } : it)) : prev))
      toast({ title: 'Salvo', description: 'Usuário atualizado.' })
      setEditOpen(false)
    } catch (e) {
      toast({ title: 'Erro', description: e?.message || 'Erro ao salvar', variant: 'destructive' })
    } finally {
      setEditSaving(false)
    }
  }, [authHeaders, editEntitlements, editForm.name, editForm.phone, editRow?.id, user?.id])

  useEffect(() => {
    let active = true
    const run = async () => {
      setLoading(true)
      setError('')
      try {
        const body = await fetchStudents()
        if (!active) return
        setRows(Array.isArray(body?.students) ? body.students : [])
        if (!active) return
        try {
          const producerId = String(user?.id || '').trim()
          if (producerId) {
            const qsS = new URLSearchParams()
            qsS.set('type', 'simulados')
            qsS.set('producerId', producerId)
            const qsC = new URLSearchParams()
            qsC.set('type', 'courses')
            qsC.set('producerId', producerId)
            const [rS, rC] = await Promise.all([
              fetch(`/api/producer?${qsS.toString()}`, { headers: authHeaders }),
              fetch(`/api/producer?${qsC.toString()}`, { headers: authHeaders }),
            ])
            const bS = await rS.json().catch(() => ({}))
            const bC = await rC.json().catch(() => ({}))
            if (active && rS.ok) {
              const list = Array.isArray(bS?.data) ? bS.data : []
              const opts = list
                .map((s) => ({ id: String(s?.id || '').trim(), title: String(s?.title || '').trim() }))
                .filter((s) => s.id && s.title)
              opts.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))
              setEditSimuladosOptions(opts)
            }
            if (active && rC.ok) setProducerCourses(Array.isArray(bC?.data) ? bC.data : [])
          }
        } catch (_) {}
      } catch (e) {
        if (!active) return
        const msg = String(e?.message || 'Erro ao carregar alunos')
        setRows([])
        setError(msg)
        toast({ title: 'Erro', description: msg, variant: 'destructive' })
      } finally {
        if (active) setLoading(false)
      }
    }
    run()
    return () => { active = false }
  }, [fetchStudents])

  const dropdownOptions = useMemo(() => {
    const out = []
    for (const row of Array.isArray(producerCourses) ? producerCourses : []) {
      const courseId = String(row?.id || '').trim()
      if (!courseId) continue
      const courseTitle = String(row?.title || 'Curso').trim()
      out.push({ value: `course:${courseId}`, kind: 'course', id: courseId, label: `Curso • ${courseTitle}` })
      const modules = getCourseModules(row)
      const list = Array.isArray(modules) ? modules : []
      for (let i = 0; i < list.length; i += 1) {
        const mod = list[i]
        const moduleTitle = String(mod?.title || mod?.name || mod?.module_title || '').trim() || `Módulo ${i + 1}`
        const mid = String(mod?.id || mod?.module_id || mod?.moduleId || '').trim()
        const mk = mid ? `id:${mid}` : `idx:${i}`
        out.push({ value: `module:${courseId}:${mk}`, kind: 'course', id: courseId, label: `Módulo • ${courseTitle} • ${moduleTitle}` })
        const lessons = getModuleLessons(mod)
        const lessonsList = Array.isArray(lessons) ? lessons : []
        for (let j = 0; j < lessonsList.length; j += 1) {
          const lesson = lessonsList[j]
          const lessonTitle = String(lesson?.title || lesson?.name || '').trim() || `Aula ${j + 1}`
          const lid = String(lesson?.id || lesson?.lesson_id || lesson?.lessonId || '').trim()
          const lk = lid ? `id:${lid}` : `idx:${j}`
          out.push({ value: `lesson:${courseId}:${mk}:${lk}`, kind: 'course', id: courseId, label: `Aula • ${courseTitle} • ${moduleTitle} • ${lessonTitle}` })
        }
      }
    }
    for (const s of Array.isArray(editSimuladosOptions) ? editSimuladosOptions : []) {
      const simId = String(s?.id || '').trim()
      if (!simId) continue
      out.push({ value: `simulado:${simId}`, kind: 'simulado', id: simId, label: `Simulado • ${String(s?.title || 'Simulado').trim()}` })
    }
    out.sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
    return out
  }, [editSimuladosOptions, producerCourses])

  const dropdownByValue = useMemo(() => {
    const map = new Map()
    for (const o of Array.isArray(dropdownOptions) ? dropdownOptions : []) map.set(o.value, o)
    return map
  }, [dropdownOptions])

  const exportXlsx = useCallback(async () => {
    try {
      const students = Array.isArray(rows) ? rows : []
      const XLSX = await import('xlsx')
      const sheetRows = students.map((s) => ({
        nome: String(s?.name || ''),
        email: String(s?.email || ''),
        telefone: String(s?.phone || ''),
        produto: formatProductCell(s) === '—' ? '' : formatProductCell(s),
      }))
      const ws = XLSX.utils.json_to_sheet(sheetRows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Alunos')
      const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'gerenciar-alunos.xlsx'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast({ title: 'Erro', description: e?.message || 'Erro ao exportar', variant: 'destructive' })
    }
  }, [rows])

  const editModal = editOpen ? (
    <div className="fixed inset-0 z-[99999] bg-black/40 overflow-y-auto" onMouseDown={() => { if (!editSaving) setEditOpen(false) }}>
      <div className="min-h-[100dvh] flex items-start justify-center p-6 py-10" onMouseDown={(e) => e.stopPropagation()}>
        <div className="w-full max-w-[520px] rounded-[14px] bg-white border border-[#E3E4E5] shadow-xl flex flex-col max-h-[calc(100dvh-80px)] relative">
          <div className="px-5 py-4 border-b border-[#E3E4E5] flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[14px] font-semibold text-[#1E1B39]">Editar usuário</div>
              <div className="text-[12px] text-[#737780] truncate">{String(editRow?.email || '').trim()}</div>
            </div>
            <button type="button" className="h-9 px-3 rounded-[10px] border border-[#E3E4E5] bg-white text-[12px] font-semibold text-[#1E1B39] hover:bg-[#F8FAFC]" disabled={editSaving} onClick={() => setEditOpen(false)}>
              Fechar
            </button>
          </div>

          {editFetching ? (
            <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
              <div className="text-[13px] text-[#1E1B39] font-semibold">
                <Loader2 className="w-4 h-4 inline-block mr-2 animate-spin" />
                Carregando…
              </div>
            </div>
          ) : null}

          <div className="p-5 grid grid-cols-1 gap-4 overflow-y-auto">
            <div>
              <label className="text-[12px] text-[#737780]">Nome</label>
              <input value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} className="mt-2 w-full h-[40px] rounded-[10px] border border-[#E3E4E5] px-3 text-[13px] outline-none focus:border-[#0047BB]" />
            </div>
            <div>
              <label className="text-[12px] text-[#737780]">Telefone</label>
              <input value={editForm.phone} onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))} className="mt-2 w-full h-[40px] rounded-[10px] border border-[#E3E4E5] px-3 text-[13px] outline-none focus:border-[#0047BB]" />
            </div>

            <div className="rounded-[12px] border border-[#E3E4E5] bg-[#F8FAFC] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[12px] font-semibold text-[#1E1B39]">Produtos (simulados) e expiração</div>
                <button
                  type="button"
                  className="h-8 px-2 rounded-[10px] border border-[#E3E4E5] bg-white text-[12px] font-semibold text-[#1E1B39] hover:bg-[#F8FAFC] disabled:opacity-50"
                  disabled={editFetching || editSaving}
                  onClick={() => setEditEntitlements((prev) => ([...(Array.isArray(prev) ? prev : []), { kind: '', id: '', selectValue: '', expiresAt: '' }]))}
                >
                  + Produto
                </button>
              </div>
              <div className="mt-3 space-y-2">
                {editFetching ? (
                  <div className="text-[12px] text-[#737780]">
                    <Loader2 className="w-4 h-4 inline-block mr-2 animate-spin" />
                    Carregando…
                  </div>
                ) : null}

                {(Array.isArray(editPurchasedProducts) ? editPurchasedProducts : []).length > 0 ? (
                  <div className="rounded-[12px] border border-[#E3E4E5] bg-white p-3">
                    {(Array.isArray(editPurchasedProducts) ? editPurchasedProducts : []).slice(0, 30).map((p, idx) => (
                      <div key={`${p?.title || ''}-${idx}`} className="flex items-center justify-between gap-3 py-1">
                        <div className="min-w-0 text-[12px] text-[#1E1B39] truncate">{String(p?.title || '').trim()}</div>
                        <div className="text-[11px] text-[#737780] whitespace-nowrap">
                          {p?.expiresAt ? `expira: ${String(p.expiresAt)}` : 'sem expiração'}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                {!editFetching && (Array.isArray(editEntitlements) ? editEntitlements : []).length === 0 ? (
                  <div className="text-[12px] text-[#737780]">Nenhum produto liberado.</div>
                ) : (
                  (Array.isArray(editEntitlements) ? editEntitlements : []).map((s, idx) => (
                    <div key={`${s?.selectValue || s?.id || 'new'}-${idx}`} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                      <div className="md:col-span-7">
                        <select
                          value={String(s?.selectValue || '')}
                          onChange={(e) => {
                            const v = e.target.value
                            const picked = dropdownByValue.get(v) || null
                            setEditEntitlements((p) => {
                              const next = Array.isArray(p) ? p.slice() : []
                              next[idx] = { ...next[idx], selectValue: v, kind: picked?.kind || '', id: picked?.id || '' }
                              return next
                            })
                          }}
                          className="w-full h-[40px] rounded-[10px] border border-[#E3E4E5] px-3 text-[13px] bg-white outline-none focus:border-[#0047BB]"
                        >
                          <option value="">Selecione um produto</option>
                          {dropdownOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="md:col-span-4">
                        <input
                          type="date"
                          value={String(s?.expiresAt || '')}
                          onChange={(e) => {
                            const v = e.target.value
                            setEditEntitlements((p) => {
                              const next = Array.isArray(p) ? p.slice() : []
                              next[idx] = { ...next[idx], expiresAt: v }
                              return next
                            })
                          }}
                          className="w-full h-[40px] rounded-[10px] border border-[#E3E4E5] px-3 text-[13px] outline-none focus:border-[#0047BB]"
                        />
                      </div>
                      <div className="md:col-span-1 flex justify-end">
                        <button
                          type="button"
                          className="h-8 px-2 rounded-[10px] border border-[#E3E4E5] bg-white text-[12px] font-semibold text-[#1E1B39] hover:bg-[#F8FAFC]"
                          onClick={() => setEditEntitlements((p) => (Array.isArray(p) ? p.filter((_, i) => i !== idx) : p))}
                        >
                          X
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="px-5 py-4 border-t border-[#E3E4E5] flex items-center justify-end gap-2">
            <button type="button" className="h-9 px-3 rounded-[10px] border border-[#E3E4E5] bg-white text-[12px] font-semibold text-[#1E1B39] hover:bg-[#F8FAFC]" disabled={editSaving} onClick={() => setEditOpen(false)}>
              Cancelar
            </button>
            <button type="button" className="h-9 px-3 rounded-[10px] bg-[#0047BB] text-white text-[12px] font-semibold hover:bg-[#003da0] disabled:opacity-50" disabled={editSaving || editFetching} onClick={saveEdit}>
              {editSaving || editFetching ? 'Carregando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null

  return (
    <>
      <Helmet>
        <title>Connekt - Gerenciar alunos</title>
      </Helmet>

      <div className="w-full">
        <div className="rounded-[14px] border border-[#E3E4E5] bg-white p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[12px] bg-[#EEF2FF] flex items-center justify-center">
                <Users className="w-5 h-5 text-[#0047BB]" />
              </div>
              <div>
                <div className="text-[16px] font-semibold text-[#1E1B39]">Gerenciar alunos</div>
                <div className="text-[12px] text-[#737780]">Lista de alunos vinculados aos seus cursos</div>
              </div>
            </div>
            <button
              type="button"
              className="h-9 px-3 rounded-[10px] border border-[#E3E4E5] bg-white text-[12px] font-semibold text-[#1E1B39] hover:bg-[#F8FAFC]"
              onClick={exportXlsx}
              disabled={loading}
            >
              <Download className="w-4 h-4 inline-block mr-2" />
              Exportar
            </button>
          </div>

          <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full sm:w-[380px]">
              <Search className="w-4 h-4 text-[#9291A5] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filtrar por nome, email ou telefone"
                className="w-full h-[40px] rounded-[10px] border border-[#E3E4E5] pl-10 pr-9 text-[13px] outline-none focus:border-[#0047BB]"
              />
              {query ? (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-[8px] hover:bg-[#F3F4F6] flex items-center justify-center"
                  onClick={() => setQuery('')}
                >
                  <X className="w-4 h-4 text-[#737780]" />
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-[14px] border border-[#E3E4E5] bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-white">
                  <th className="px-6 py-4 text-left text-[12px] font-semibold text-[#737780]">Aluno</th>
                  <th className="px-6 py-4 text-left text-[12px] font-semibold text-[#737780]">Email</th>
                  <th className="px-6 py-4 text-left text-[12px] font-semibold text-[#737780]">Telefone</th>
                  <th className="px-6 py-4 text-left text-[12px] font-semibold text-[#737780]">Produto</th>
                  <th className="px-6 py-4 text-right text-[12px] font-semibold text-[#737780]">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDEEF0]">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-[14px] text-[#737780]">
                      <Loader2 className="w-4 h-4 inline-block mr-2 animate-spin" />
                      Carregando…
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-[14px] text-[#737780]">{error}</td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-[14px] text-[#737780]">Nenhum aluno encontrado.</td>
                  </tr>
                ) : (
                  rows.slice(0, 500).map((s) => (
                    <tr key={String(s?.id || Math.random())}>
                      <td className="px-6 py-4 text-[13px] text-[#1E1B39]">{String(s?.name || '').trim() || 'Aluno'}</td>
                      <td className="px-6 py-4 text-[13px] text-[#1E1B39]">{String(s?.email || '').trim() || '—'}</td>
                      <td className="px-6 py-4 text-[13px] text-[#1E1B39]">{formatPhone(s?.phone || '') || '—'}</td>
                      <td className="px-6 py-4 text-[13px] text-[#1E1B39]">{formatProductCell(s)}</td>
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          className="h-8 px-2 rounded-[10px] border border-[#E3E4E5] bg-white text-[12px] font-semibold text-[#1E1B39] hover:bg-[#F8FAFC]"
                          onClick={() => openEdit(s)}
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {typeof document !== 'undefined' && editModal ? createPortal(editModal, document.body) : null}
    </>
  )
}
