import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Download, Loader2, Search, Users, X } from 'lucide-react'
import { useAuth } from '@/contexts/SupabaseAuthContext'
import { toast } from '@/hooks/use-toast.ts'

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
  const [courseFilter, setCourseFilter] = useState('')
  const [courses, setCourses] = useState([])

  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')

  const [editOpen, setEditOpen] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [editRow, setEditRow] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', phone: '' })
  const [editCourses, setEditCourses] = useState([])
  const [editSimulados, setEditSimulados] = useState([])
  const [editSimuladosOptions, setEditSimuladosOptions] = useState([])

  const fetchStudents = useCallback(async () => {
    const producerId = String(user?.id || '').trim()
    if (!producerId) return { ok: true, students: [], courses: [] }
    const qs = new URLSearchParams()
    qs.set('type', 'students_manage_list')
    qs.set('producerId', producerId)
    if (query.trim()) qs.set('q', query.trim())
    if (courseFilter) qs.set('course_id', courseFilter)
    qs.set('per_page', '5000')
    const r = await fetch(`/api/producer?${qs.toString()}`, { headers: authHeaders })
    const body = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(body?.error || 'Falha ao carregar alunos')
    return body || {}
  }, [authHeaders, courseFilter, query, user?.id])

  const openEdit = useCallback(async (row) => {
    const r = row && typeof row === 'object' ? row : null
    if (!r?.id) return
    setEditRow(r)
    setEditForm({ name: String(r?.name || '').trim(), phone: String(r?.phone || '').trim() })
    setEditCourses([])
    setEditSimulados([])
    setEditSimuladosOptions([])
    setEditOpen(true)
    setEditLoading(true)
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
      setEditCourses(
        courses
          .map((c) => ({ courseId: String(c?.courseId || '').trim(), expiresAt: String(c?.expiresAt || '').trim() }))
          .filter((c) => c.courseId),
      )
      setEditSimulados(
        sims
          .map((s) => ({ simId: String(s?.simId || '').trim(), expiresAt: String(s?.expiresAt || '').trim() }))
          .filter((s) => s.simId),
      )
      setEditSimuladosOptions(
        (Array.isArray(body?.simulados) ? body.simulados : [])
          .map((s) => ({ id: String(s?.id || '').trim(), title: String(s?.title || '').trim() }))
          .filter((s) => s.id && s.title)
          .sort((a, b) => a.title.localeCompare(b.title, 'pt-BR')),
      )
    } catch (e) {
      toast({ title: 'Erro', description: e?.message || 'Erro ao carregar acessos', variant: 'destructive' })
    } finally {
      setEditLoading(false)
    }
  }, [authHeaders, user?.id])

  const saveEdit = useCallback(async () => {
    const producerId = String(user?.id || '').trim()
    const userId = String(editRow?.id || '').trim()
    if (!producerId || !userId) return
    setEditLoading(true)
    try {
      const payload = { userId, name: String(editForm.name || '').trim(), phone: String(editForm.phone || '').trim() }
      const qs = new URLSearchParams()
      qs.set('type', 'student_update_profile')
      qs.set('producerId', producerId)
      const r = await fetch(`/api/producer?${qs.toString()}`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(body?.error || 'Falha ao salvar')

      const qs2 = new URLSearchParams()
      qs2.set('type', 'student_entitlements_update')
      qs2.set('producerId', producerId)
      const r2 = await fetch(`/api/producer?${qs2.toString()}`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          courses: (Array.isArray(editCourses) ? editCourses : []).map((c) => ({
            courseId: String(c?.courseId || '').trim(),
            expiresAt: String(c?.expiresAt || '').trim() || null,
          })).filter((c) => c.courseId),
          simulados: (Array.isArray(editSimulados) ? editSimulados : []).map((s) => ({
            simId: String(s?.simId || '').trim(),
            expiresAt: String(s?.expiresAt || '').trim() || null,
          })).filter((s) => s.simId),
        }),
      })
      const b2 = await r2.json().catch(() => ({}))
      if (!r2.ok) throw new Error(b2?.error || 'Falha ao salvar acessos')

      setRows((prev) => (Array.isArray(prev) ? prev.map((it) => (String(it?.id || '') === userId ? { ...it, name: payload.name || it?.name, phone: payload.phone || it?.phone } : it)) : prev))
      toast({ title: 'Salvo', description: 'Usuário atualizado.' })
      setEditOpen(false)
    } catch (e) {
      toast({ title: 'Erro', description: e?.message || 'Erro ao salvar', variant: 'destructive' })
    } finally {
      setEditLoading(false)
    }
  }, [authHeaders, editCourses, editForm.name, editForm.phone, editRow?.id, editSimulados, user?.id])

  useEffect(() => {
    let active = true
    const run = async () => {
      setLoading(true)
      setError('')
      try {
        const body = await fetchStudents()
        if (!active) return
        setRows(Array.isArray(body?.students) ? body.students : [])
        setCourses(Array.isArray(body?.courses) ? body.courses : [])
      } catch (e) {
        if (!active) return
        const msg = String(e?.message || 'Erro ao carregar alunos')
        setRows([])
        setCourses([])
        setError(msg)
        toast({ title: 'Erro', description: msg, variant: 'destructive' })
      } finally {
        if (active) setLoading(false)
      }
    }
    run()
    return () => { active = false }
  }, [fetchStudents])

  const sortedCourses = useMemo(() => {
    const list = Array.isArray(courses) ? courses : []
    const out = list
      .map((c) => ({ id: String(c?.id || '').trim(), title: String(c?.title || '').trim() }))
      .filter((c) => c.id && c.title)
    out.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))
    return out
  }, [courses])

  const exportXlsx = useCallback(async () => {
    try {
      const students = Array.isArray(rows) ? rows : []
      const XLSX = await import('xlsx')
      const sheetRows = students.map((s) => ({
        nome: String(s?.name || ''),
        email: String(s?.email || ''),
        telefone: String(s?.phone || ''),
        produto: formatProductCell(s) === '—' ? '' : formatProductCell(s),
        cursos: Array.isArray(s?.courses) ? s.courses.map((c) => String(c?.course_name || '')).filter(Boolean).join(', ') : '',
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

            <div className="flex items-center gap-2">
              <select
                value={courseFilter}
                onChange={(e) => setCourseFilter(e.target.value)}
                className="h-[40px] rounded-[10px] border border-[#E3E4E5] px-3 text-[13px] bg-white outline-none focus:border-[#0047BB]"
              >
                <option value="">Curso (todos)</option>
                {sortedCourses.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
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
                  <th className="px-6 py-4 text-left text-[12px] font-semibold text-[#737780]">Cursos</th>
                  <th className="px-6 py-4 text-right text-[12px] font-semibold text-[#737780]">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDEEF0]">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-[14px] text-[#737780]">
                      <Loader2 className="w-4 h-4 inline-block mr-2 animate-spin" />
                      Carregando…
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-[14px] text-[#737780]">{error}</td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-[14px] text-[#737780]">Nenhum aluno encontrado.</td>
                  </tr>
                ) : (
                  rows.slice(0, 500).map((s) => (
                    <tr key={String(s?.id || Math.random())}>
                      <td className="px-6 py-4 text-[13px] text-[#1E1B39]">{String(s?.name || '').trim() || 'Aluno'}</td>
                      <td className="px-6 py-4 text-[13px] text-[#1E1B39]">{String(s?.email || '').trim() || '—'}</td>
                      <td className="px-6 py-4 text-[13px] text-[#1E1B39]">{formatPhone(s?.phone || '') || '—'}</td>
                      <td className="px-6 py-4 text-[13px] text-[#1E1B39]">{formatProductCell(s)}</td>
                      <td className="px-6 py-4 text-[13px] text-[#1E1B39]">{Array.isArray(s?.courses) ? s.courses.length : 0}</td>
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

      {editOpen ? (
        <div className="fixed inset-0 z-[90] bg-black/40 flex items-center justify-center p-6" onMouseDown={() => { if (!editLoading) setEditOpen(false) }}>
          <div className="w-full max-w-[520px] rounded-[14px] bg-white border border-[#E3E4E5] shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-[#E3E4E5] flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[14px] font-semibold text-[#1E1B39]">Editar usuário</div>
                <div className="text-[12px] text-[#737780] truncate">{String(editRow?.email || '').trim()}</div>
              </div>
              <button type="button" className="h-9 px-3 rounded-[10px] border border-[#E3E4E5] bg-white text-[12px] font-semibold text-[#1E1B39] hover:bg-[#F8FAFC]" disabled={editLoading} onClick={() => setEditOpen(false)}>
                Fechar
              </button>
            </div>
            <div className="p-5 grid grid-cols-1 gap-4">
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
                  <div className="text-[12px] font-semibold text-[#1E1B39]">Cursos e expiração</div>
                  <button
                    type="button"
                    className="h-8 px-2 rounded-[10px] border border-[#E3E4E5] bg-white text-[12px] font-semibold text-[#1E1B39] hover:bg-[#F8FAFC] disabled:opacity-50"
                    disabled={editLoading}
                    onClick={() => setEditCourses((prev) => ([...(Array.isArray(prev) ? prev : []), { courseId: '', expiresAt: '' }]))}
                  >
                    + Curso
                  </button>
                </div>
                <div className="mt-3 space-y-2">
                  {(Array.isArray(editCourses) ? editCourses : []).length === 0 ? (
                    <div className="text-[12px] text-[#737780]">Nenhum curso liberado.</div>
                  ) : (
                    (Array.isArray(editCourses) ? editCourses : []).map((c, idx) => (
                      <div key={`${c?.courseId || 'new'}-${idx}`} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                        <div className="md:col-span-7">
                          <select
                            value={String(c?.courseId || '')}
                            onChange={(e) => {
                              const v = e.target.value
                              setEditCourses((p) => {
                                const next = Array.isArray(p) ? p.slice() : []
                                next[idx] = { ...next[idx], courseId: v }
                                return next
                              })
                            }}
                            className="w-full h-[40px] rounded-[10px] border border-[#E3E4E5] px-3 text-[13px] bg-white outline-none focus:border-[#0047BB]"
                          >
                            <option value="">Selecione um curso</option>
                            {sortedCourses.map((opt) => (
                              <option key={opt.id} value={opt.id}>{opt.title}</option>
                            ))}
                          </select>
                        </div>
                        <div className="md:col-span-4">
                          <input
                            type="date"
                            value={String(c?.expiresAt || '')}
                            onChange={(e) => {
                              const v = e.target.value
                              setEditCourses((p) => {
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
                            onClick={() => setEditCourses((p) => (Array.isArray(p) ? p.filter((_, i) => i !== idx) : p))}
                          >
                            X
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-[12px] border border-[#E3E4E5] bg-[#F8FAFC] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[12px] font-semibold text-[#1E1B39]">Produtos (simulados) e expiração</div>
                  <button
                    type="button"
                    className="h-8 px-2 rounded-[10px] border border-[#E3E4E5] bg-white text-[12px] font-semibold text-[#1E1B39] hover:bg-[#F8FAFC] disabled:opacity-50"
                    disabled={editLoading}
                    onClick={() => setEditSimulados((prev) => ([...(Array.isArray(prev) ? prev : []), { simId: '', expiresAt: '' }]))}
                  >
                    + Produto
                  </button>
                </div>
                <div className="mt-3 space-y-2">
                  {(Array.isArray(editSimulados) ? editSimulados : []).length === 0 ? (
                    <div className="text-[12px] text-[#737780]">Nenhum produto liberado.</div>
                  ) : (
                    (Array.isArray(editSimulados) ? editSimulados : []).map((s, idx) => (
                      <div key={`${s?.simId || 'new'}-${idx}`} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                        <div className="md:col-span-7">
                          <select
                            value={String(s?.simId || '')}
                            onChange={(e) => {
                              const v = e.target.value
                              setEditSimulados((p) => {
                                const next = Array.isArray(p) ? p.slice() : []
                                next[idx] = { ...next[idx], simId: v }
                                return next
                              })
                            }}
                            className="w-full h-[40px] rounded-[10px] border border-[#E3E4E5] px-3 text-[13px] bg-white outline-none focus:border-[#0047BB]"
                          >
                            <option value="">Selecione um produto</option>
                            {editSimuladosOptions.map((opt) => (
                              <option key={opt.id} value={opt.id}>{opt.title}</option>
                            ))}
                          </select>
                        </div>
                        <div className="md:col-span-4">
                          <input
                            type="date"
                            value={String(s?.expiresAt || '')}
                            onChange={(e) => {
                              const v = e.target.value
                              setEditSimulados((p) => {
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
                            onClick={() => setEditSimulados((p) => (Array.isArray(p) ? p.filter((_, i) => i !== idx) : p))}
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
              <button type="button" className="h-9 px-3 rounded-[10px] border border-[#E3E4E5] bg-white text-[12px] font-semibold text-[#1E1B39] hover:bg-[#F8FAFC]" disabled={editLoading} onClick={() => setEditOpen(false)}>
                Cancelar
              </button>
              <button type="button" className="h-9 px-3 rounded-[10px] bg-[#0047BB] text-white text-[12px] font-semibold hover:bg-[#003da0] disabled:opacity-50" disabled={editLoading} onClick={saveEdit}>
                {editLoading ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
